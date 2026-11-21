extends Node3D

## Standalone procedural 3D presentation for Stormline: Black Tide.
## The simulation owns all gameplay state; this node only consumes configure/present.

const MAP_LIMIT := 140.0
const SEA_SIZE := 440.0
const CABLE_LINKS := 14
const TOW_RATED_LOAD := 1.0
const TOW_DISPLAY_LIMIT := 1.5

const DEEP_WATER := Color("061a2e")
const PALE_WATER := Color("327284")
const CYAN := Color("65e2e4")
const AMBER := Color("ffc47a")
const HAZARD_ORANGE := Color("ff754f")
const HULL_WHITE := Color("e1e8e4")

var _contract: Dictionary = {}
var _view: Dictionary = {}
var _world_root: Node3D
var _camera: Camera3D
var _water_material: ShaderMaterial
var _moon: DirectionalLight3D
var _boat: Node3D
var _hull_material: StandardMaterial3D
var _cargo: Node3D
var _cable: Node3D
var _cable_links: Array[MeshInstance3D] = []
var _cable_light: OmniLight3D
var _towline_material: StandardMaterial3D
var _tow_label: Label3D
var _target_marker: Node3D
var _target_label: Label3D
var _port_beacon_light: OmniLight3D
var _port_beacon_shell: MeshInstance3D
var _boat_wake: ImmediateMesh
var _cargo_wake: ImmediateMesh
var _boat_wake_material: StandardMaterial3D
var _cargo_wake_material: StandardMaterial3D
var _elapsed := 0.0
var _has_presented := false
var _harbor := Vector2.ZERO
var _beacon := Vector2.ZERO
var _target := Vector2(0.0, -86.0)
var _harbor_radius := 15.0
var _hazards: Array[Dictionary] = []


func _ready() -> void:
	if _contract.is_empty():
		_contract = _default_contract()
	_read_contract()
	_rebuild_world()
	if _has_presented:
		_update_world(_view, 0.0, true)


func _exit_tree() -> void:
	_detach_dummy_meshes()


## May be called again in-tree to swap mission locations and hazards.
func configure(contract: Dictionary) -> void:
	_contract = contract.duplicate(true)
	_has_presented = false
	_view = {}
	_read_contract()
	if is_inside_tree():
		_rebuild_world()


## Positions and vectors are Vector2(x, z); heading zero points along -Z.
func present(view: Dictionary, delta: float, snap_camera: bool = false) -> void:
	_view = view
	_elapsed += clampf(delta, 0.0, 0.1)
	if not is_instance_valid(_world_root):
		if _contract.is_empty():
			_contract = _default_contract()
		_read_contract()
		_rebuild_world()
	_update_world(view, delta, snap_camera)
	_has_presented = true


func _default_contract() -> Dictionary:
	return {
		"name": "BLACK TIDE / RECOVERY OPERATIONS",
		"harbor": Vector2.ZERO,
		"beacon": Vector2(7.0, 14.0),
		"target": Vector2(0.0, -86.0),
		"harbor_radius": 15.0,
		"hazards": [],
	}


func _read_contract() -> void:
	_harbor = _contract.get("harbor", Vector2.ZERO) as Vector2
	_beacon = _contract.get("beacon", _harbor + Vector2(7.0, 14.0)) as Vector2
	_target = _contract.get("target", Vector2(0.0, -86.0)) as Vector2
	_harbor_radius = maxf(4.0, float(_contract.get("harbor_radius", 15.0)))
	_hazards.clear()
	for hazard: Variant in _contract.get("hazards", []):
		if hazard is Dictionary:
			var entry: Dictionary = hazard.duplicate(true)
			if entry.get("position") is Vector2:
				_hazards.append(entry)


func _rebuild_world() -> void:
	if is_instance_valid(_world_root):
		_detach_dummy_meshes()
		_cable_links.clear()
		remove_child(_world_root)
		_world_root.queue_free()
	_world_root = Node3D.new()
	_world_root.name = "StormlineProceduralWorld"
	add_child(_world_root)
	_build_environment()
	_build_sea()
	_build_navigation()
	_build_harbor()
	_build_port_beacon()
	_build_hazards()
	_build_tug()
	_build_capsule()
	_build_tow_system()
	_build_target_contact()
	_build_camera()


func _detach_dummy_meshes() -> void:
	# In 4.3 the dummy renderer doesn't track mesh lifetime (Godot #86806).
	# Unbind instances while their mesh resources are still alive.
	if DisplayServer.get_name() != "headless" or not is_instance_valid(_world_root):
		return
	for instance: MeshInstance3D in _world_root.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = instance.mesh
		if mesh != null:
			instance.mesh = null
	# Label3D owns a private mesh too; it is not a MeshInstance3D child.
	for label: Label3D in _world_root.find_children("*", "Label3D", true, false):
		RenderingServer.instance_set_base(label.get_instance(), RID())


func _build_environment() -> void:
	var world_environment := WorldEnvironment.new()
	world_environment.name = "BlackTideAtmosphere"
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("06111f")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("80a6b8")
	environment.ambient_light_energy = 0.72
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.fog_enabled = true
	environment.fog_light_color = Color("10283a")
	environment.fog_density = 0.0032
	world_environment.environment = environment
	_world_root.add_child(world_environment)

	_moon = DirectionalLight3D.new()
	_moon.name = "StormFilteredMoonlight"
	_moon.rotation_degrees = Vector3(-55.0, -28.0, 0.0)
	_moon.light_color = Color("a4c9d5")
	_moon.light_energy = 1.05
	_moon.shadow_enabled = true
	_moon.directional_shadow_max_distance = 110.0
	_world_root.add_child(_moon)

	var fill := OmniLight3D.new()
	fill.name = "HarborSkyFill"
	fill.position = _to_world(_harbor, 17.0)
	fill.light_color = Color("438396")
	fill.light_energy = 0.8
	fill.omni_range = 78.0
	fill.shadow_enabled = false
	_world_root.add_child(fill)


func _build_sea() -> void:
	var water := MeshInstance3D.new()
	water.name = "StormDrivenSea"
	var plane := PlaneMesh.new()
	plane.size = Vector2(SEA_SIZE, SEA_SIZE)
	plane.subdivide_width = 72
	plane.subdivide_depth = 72
	water.mesh = plane
	water.position.y = -0.28
	_water_material = _make_water_material()
	water.material_override = _water_material
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world_root.add_child(water)

	_boat_wake_material = _mat(Color(0.62, 0.86, 0.89, 0.43), 0.32, true, true)
	_cargo_wake_material = _mat(Color(1.0, 0.47, 0.23, 0.45), 0.4, true, true)
	_boat_wake = ImmediateMesh.new()
	var boat_wake_node := MeshInstance3D.new()
	boat_wake_node.name = "TugFoamWake"
	boat_wake_node.mesh = _boat_wake
	boat_wake_node.material_override = _boat_wake_material
	boat_wake_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world_root.add_child(boat_wake_node)
	_cargo_wake = ImmediateMesh.new()
	var cargo_wake_node := MeshInstance3D.new()
	cargo_wake_node.name = "CapsuleFoamWake"
	cargo_wake_node.mesh = _cargo_wake
	cargo_wake_node.material_override = _cargo_wake_material
	cargo_wake_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world_root.add_child(cargo_wake_node)


func _make_water_material() -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded;

uniform float storm : hint_range(0.0, 1.0) = 0.35;
uniform vec2 wind_dir = vec2(0.5, -0.8);
uniform float wind_strength = 0.0;

varying vec2 sea_position;

void vertex() {
	sea_position = VERTEX.xz;
	vec2 d = normalize(wind_dir + vec2(0.001, 0.0));
	float swell = 0.10 + storm * 0.35 + wind_strength * 0.015;
	float phase_a = dot(VERTEX.xz, d) * 0.11 + TIME * (0.65 + wind_strength * 0.025);
	float phase_b = dot(VERTEX.xz, vec2(-d.y, d.x)) * 0.18 - TIME * 0.5;
	VERTEX.y += (sin(phase_a) + sin(phase_b) * 0.42) * swell;
}

void fragment() {
	vec2 d = normalize(wind_dir + vec2(0.001, 0.0));
	float swell_a = sin(dot(sea_position, d) * 0.11 + TIME * (0.65 + wind_strength * 0.025));
	float swell_b = sin(dot(sea_position, vec2(-d.y, d.x)) * 0.18 - TIME * 0.5);
	float wave = swell_a * 0.52 + swell_b * 0.22;
	float glint = smoothstep(0.52 - storm * 0.16, 0.92, wave + 0.3 * sin(sea_position.x * 0.31 + sea_position.y * 0.17 + TIME * 0.85));
	float foam = smoothstep(0.77, 0.96, swell_a + 0.16 * sin(sea_position.y * 0.34 + TIME));
	vec3 calm_color = vec3(0.018, 0.09, 0.14);
	vec3 storm_color = vec3(0.035, 0.105, 0.145);
	vec3 base = mix(calm_color, storm_color, storm * 0.84);
	vec3 water_color = base + vec3(0.045, 0.12, 0.14) * glint * (0.24 + storm * 0.56);
	water_color = mix(water_color, vec3(0.30, 0.47, 0.52), foam * (0.07 + storm * 0.24));
	ALBEDO = water_color;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("storm", 0.35)
	material.set_shader_parameter("wind_dir", Vector2(0.5, -0.8))
	material.set_shader_parameter("wind_strength", 2.0)
	return material


func _build_navigation() -> void:
	var grid_mesh := ImmediateMesh.new()
	var grid_material := _mat(Color(0.25, 0.60, 0.66, 0.09), 1.0, true, true)
	grid_mesh.surface_begin(Mesh.PRIMITIVE_LINES, grid_material)
	for coordinate in range(-120, 121, 30):
		grid_mesh.surface_add_vertex(Vector3(float(coordinate), -0.06, -MAP_LIMIT))
		grid_mesh.surface_add_vertex(Vector3(float(coordinate), -0.06, MAP_LIMIT))
		grid_mesh.surface_add_vertex(Vector3(-MAP_LIMIT, -0.06, float(coordinate)))
		grid_mesh.surface_add_vertex(Vector3(MAP_LIMIT, -0.06, float(coordinate)))
	grid_mesh.surface_end()
	var grid_node := MeshInstance3D.new()
	grid_node.name = "SubtleChartGrid"
	grid_node.mesh = grid_mesh
	grid_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world_root.add_child(grid_node)

	var boundary_mesh := ImmediateMesh.new()
	boundary_mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP, _mat(Color(0.90, 0.49, 0.27, 0.45), 0.8, true, true))
	var corners := [
		Vector3(-MAP_LIMIT, 0.05, -MAP_LIMIT),
		Vector3(MAP_LIMIT, 0.05, -MAP_LIMIT),
		Vector3(MAP_LIMIT, 0.05, MAP_LIMIT),
		Vector3(-MAP_LIMIT, 0.05, MAP_LIMIT),
		Vector3(-MAP_LIMIT, 0.05, -MAP_LIMIT),
	]
	for corner: Vector3 in corners:
		boundary_mesh.surface_add_vertex(corner)
	boundary_mesh.surface_end()
	var boundary_node := MeshInstance3D.new()
	boundary_node.name = "ChartLimit140m"
	boundary_node.mesh = boundary_mesh
	boundary_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world_root.add_child(boundary_node)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			var marker := _add_cylinder(_world_root, 0.65, 2.1, _to_world(Vector2(sx * 137.0, sz * 137.0), 0.75), _mat(Color("e18755"), 0.46, false, false, Color("b84f32")))
			marker.name = "WorldLimitBuoy"

	for offset in [-1.0, 1.0]:
		for index in range(6):
			var z := _harbor.y - 23.0 - float(index) * 9.0
			_add_navigation_buoy(Vector2(_harbor.x + offset * 11.0, z), offset < 0.0)

	var safety_ring := _add_ring(
		_world_root,
		_to_world(_harbor, 0.13),
		_harbor_radius,
		0.28,
		Color(0.29, 0.89, 0.84, 0.64),
		88
	)
	safety_ring.name = "HarborSafeWaterRadius"
	var search_ring := _add_ring(_world_root, _to_world(_beacon, 0.44), 18.0, 0.28, Color(1.0, 0.59, 0.28, 0.60), 72)
	search_ring.name = "PublicSonarSearchArea"


func _add_navigation_buoy(position_2d: Vector2, port_side: bool) -> void:
	var buoy := Node3D.new()
	buoy.name = "PortHandBuoy" if port_side else "StarboardHandBuoy"
	buoy.position = _to_world(position_2d)
	_world_root.add_child(buoy)
	var color := Color("78e7cb") if port_side else Color("ff775e")
	_add_cylinder(buoy, 0.48, 1.15, Vector3(0.0, 0.55, 0.0), _mat(Color("244b57"), 0.3, false, true))
	_add_cylinder(buoy, 0.32, 1.25, Vector3(0.0, 1.38, 0.0), _mat(color, 0.25, false, true, color * 0.7))
	_add_box(buoy, Vector3(0.82, 0.13, 0.82), Vector3(0.0, 0.62, 0.0), _mat(Color("34535d"), 0.45, false, true))
	var buoy_index := roundi(absf(position_2d.y - _harbor.y - 23.0) / 9.0)
	if buoy_index % 3 == 0:
		var lamp := OmniLight3D.new()
		lamp.position.y = 2.2
		lamp.light_color = color
		lamp.light_energy = 1.15
		lamp.omni_range = 6.0
		lamp.shadow_enabled = false
		buoy.add_child(lamp)


func _build_harbor() -> void:
	var harbor := Node3D.new()
	harbor.name = "BlackTidePier"
	harbor.position = _to_world(_harbor)
	_world_root.add_child(harbor)
	var steel := _mat(Color("315465"), 0.58, false, true)
	var dark_steel := _mat(Color("1b3545"), 0.63, false, true)
	var deck := _mat(Color("627276"), 0.76, false, true)
	_add_box(harbor, Vector3(22.0, 0.78, 8.6), Vector3(0.0, -0.04, 14.8), dark_steel)
	_add_box(harbor, Vector3(20.2, 0.24, 7.1), Vector3(0.0, 0.42, 14.0), deck)
	_add_box(harbor, Vector3(6.8, 0.7, 5.6), Vector3(0.0, -0.02, 5.3), steel)
	_add_box(harbor, Vector3(11.0, 0.12, 0.22), Vector3(0.0, 0.57, 9.0), _mat(CYAN, 0.45, true, true))
	for side in [-1.0, 1.0]:
		for index in range(4):
			var z := 9.0 + float(index) * 4.2
			_add_cylinder(harbor, 0.38, 3.5, Vector3(side * 8.3, -0.42, z), _mat(Color("294b56"), 0.52, false, true))
			_add_box(harbor, Vector3(0.18, 0.56, 0.22), Vector3(side * 9.7, 0.8, z), _mat(AMBER, 0.35, true, true, Color("df7840")))
		_add_cylinder(harbor, 0.53, 1.15, Vector3(side * 8.9, 0.85, 6.5), _mat(Color("253e4a"), 0.35, false, true))

	var warehouse := Node3D.new()
	warehouse.name = "HarborServiceShed"
	warehouse.position = Vector3(-6.0, 0.58, 17.0)
	harbor.add_child(warehouse)
	_add_box(warehouse, Vector3(7.0, 3.1, 5.2), Vector3.ZERO, _mat(Color("344b53"), 0.78, false, true))
	_add_box(warehouse, Vector3(7.8, 0.32, 6.0), Vector3(0.0, 1.72, 0.0), _mat(Color("203b4b"), 0.68, false, true))
	_add_box(warehouse, Vector3(3.6, 1.15, 0.12), Vector3(0.0, -0.64, -2.68), _mat(Color("4a7880"), 0.36, false, true))
	var sign := Label3D.new()
	sign.name = "PierIdentification"
	sign.text = "%s   /   RECOVERY PIER" % String(_contract.get("name", "BLACK TIDE"))
	sign.font_size = 36
	sign.outline_size = 7
	sign.modulate = Color("a4e8e2")
	sign.position = Vector3(0.0, 2.5, -2.75)
	sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	warehouse.add_child(sign)

	# A compact loading crane gives the dock a clear silhouette without crowding the channel.
	var crane := Node3D.new()
	crane.name = "DeckRecoveryCrane"
	crane.position = Vector3(6.5, 0.65, 17.5)
	harbor.add_child(crane)
	var crane_material := _mat(Color("d28a4e"), 0.52, false, true)
	_add_box(crane, Vector3(0.72, 5.7, 0.72), Vector3.ZERO, dark_steel)
	_add_box(crane, Vector3(0.98, 0.8, 0.86), Vector3(0.0, 2.85, 0.0), crane_material)
	var jib := _add_box(crane, Vector3(0.45, 0.55, 7.0), Vector3(0.0, 2.9, -3.35), crane_material)
	jib.rotation.x = deg_to_rad(-7.0)
	_add_cylinder(crane, 0.055, 3.2, Vector3(0.0, 1.32, -5.8), _mat(Color("d9d8c6"), 0.45, false, true))
	_add_box(crane, Vector3(1.6, 0.8, 1.0), Vector3(-3.6, 0.95, 1.0), _mat(Color("9e6b46"), 0.8, false, true))
	_add_box(crane, Vector3(1.8, 0.92, 1.1), Vector3(-2.8, 0.99, 2.35), _mat(Color("324c59"), 0.7, false, true))


func _build_port_beacon() -> void:
	var tower := Node3D.new()
	tower.name = "ContractPortBeacon"
	tower.position = _to_world(_harbor + Vector2(9.0, 13.0), 0.42)
	_world_root.add_child(tower)
	_add_cylinder(tower, 0.88, 6.6, Vector3(0.0, 3.3, 0.0), _mat(Color("52747a"), 0.54, false, true))
	_add_cylinder(tower, 1.08, 0.46, Vector3(0.0, 5.4, 0.0), _mat(Color("223e4b"), 0.5, false, true))
	_add_cylinder(tower, 0.55, 1.08, Vector3(0.0, 6.12, 0.0), _mat(Color("92d8d5"), 0.28, true, true, Color("53c4c1")))
	_add_cylinder(tower, 0.9, 0.22, Vector3(0.0, 6.82, 0.0), _mat(Color("d9a66a"), 0.55, false, true))
	_port_beacon_shell = _add_sphere(tower, 0.31, Vector3(0.0, 6.18, 0.0), _mat(Color("b4ffff"), 0.2, true, true, Color("8cffff")))
	_port_beacon_light = OmniLight3D.new()
	_port_beacon_light.name = "PortBeaconLamp"
	_port_beacon_light.position = Vector3(0.0, 6.18, 0.0)
	_port_beacon_light.light_color = CYAN
	_port_beacon_light.light_energy = 1.6
	_port_beacon_light.omni_range = 24.0
	_port_beacon_light.shadow_enabled = false
	tower.add_child(_port_beacon_light)
	var label := Label3D.new()
	label.text = "RECOVERY PIER   /   SAFE WATER"
	label.font_size = 28
	label.outline_size = 6
	label.modulate = Color("a6eeeb")
	label.position = Vector3(0.0, 8.2, 0.0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tower.add_child(label)


func _build_hazards() -> void:
	for index in range(_hazards.size()):
		var hazard := _hazards[index]
		var location: Vector2 = hazard.get("position", Vector2.ZERO)
		var radius := maxf(1.5, float(hazard.get("radius", 8.0)))
		var is_current := String(hazard.get("kind", "reef")) == "current"
		var group := Node3D.new()
		group.name = "CurrentDanger_%02d" % index if is_current else "ReefDanger_%02d" % index
		group.position = _to_world(location)
		_world_root.add_child(group)
		var rim := _add_ring(
			group,
			Vector3(0.0, 0.18, 0.0),
			radius,
			0.22,
			Color(1.0, 0.35, 0.20, 0.92),
			64
		)
		rim.name = "ExactHazardRadius"
		for tick in range(16):
			var angle := TAU * float(tick) / 16.0
			var tick_position := Vector3(cos(angle) * radius, 0.22, sin(angle) * radius)
			var radial := _add_box(group, Vector3(0.14, 0.13, 1.15), tick_position, _mat(Color("ff976b"), 0.45, true, true, Color("b94831")))
			radial.rotation.y = -angle
		if is_current:
			_build_current_visual(group, radius)
		else:
			_build_reef_visual(group, radius, index)
		var label := Label3D.new()
		label.name = "HazardName"
		label.text = String(hazard.get("name", "DANGER")) + ("   /   CURRENT" if is_current else "   /   REEF")
		label.font_size = 30
		label.outline_size = 7
		label.modulate = Color("ffb08b")
		label.position = Vector3(0.0, 3.0, -radius * 0.55)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		group.add_child(label)


func _build_reef_visual(parent: Node3D, radius: float, seed: int) -> void:
	var rock_material := _mat(Color("394a4c"), 0.94, false, true)
	var wet_material := _mat(Color("263d43"), 0.36, false, true)
	var pebble_count := 5
	for index in range(pebble_count):
		var angle := TAU * float(index) / float(pebble_count) + float(seed) * 0.73
		var distance := radius * (0.12 + 0.28 * float((index * 3 + seed) % 5) / 4.0)
		var rock := _add_sphere(
			parent,
			0.85 + radius * (0.10 + 0.035 * float((index + seed) % 4)),
			Vector3(cos(angle) * distance, 0.44, sin(angle) * distance),
			rock_material
		)
		rock.scale = Vector3(1.0 + float((index + 1) % 3) * 0.28, 0.35 + float(index % 3) * 0.12, 0.86 + float((index + seed) % 2) * 0.25)
		rock.rotation.y = angle * 0.7
		var cap := _add_sphere(
			parent,
			maxf(0.75, radius * 0.17),
			Vector3(cos(angle) * distance * 0.58, 0.57, sin(angle) * distance * 0.58),
			wet_material
		)
		cap.scale = Vector3(1.2, 0.33, 0.95)
	var warning_post := _add_cylinder(parent, 0.10, 2.4, Vector3(0.0, 1.0, 0.0), _mat(Color("d16e4f"), 0.38, false, true))
	warning_post.name = "RockWarningStake"
	_add_sphere(parent, 0.24, Vector3(0.0, 2.24, 0.0), _mat(Color("ff8a62"), 0.2, true, true, Color("dc5639")))


func _build_current_visual(parent: Node3D, radius: float) -> void:
	for band in range(3):
		var band_radius := radius * (0.27 + float(band) * 0.20)
		var swirl := _add_ring(
			parent,
			Vector3(0.0, 0.24 + float(band) * 0.025, 0.0),
			band_radius,
			0.13,
			Color(1.0, 0.51, 0.25, 0.58 - float(band) * 0.10),
			48
		)
		swirl.name = "VisibleCrossCurrentBand"
	for index in range(4):
		var angle := TAU * float(index) / 4.0 + 0.42
		var arrow := Node3D.new()
		arrow.name = "CurrentDirectionIndicator"
		arrow.position = Vector3(cos(angle) * radius * 0.53, 0.38, sin(angle) * radius * 0.53)
		arrow.rotation.y = -angle + PI * 0.5
		parent.add_child(arrow)
		_add_box(arrow, Vector3(0.17, 0.09, 1.4), Vector3(0.0, 0.0, 0.0), _mat(Color("ffb06f"), 0.42, true, true, Color("bd563a")))
		_add_box(arrow, Vector3(0.56, 0.10, 0.16), Vector3(0.0, 0.0, -0.54), _mat(Color("ffae6d"), 0.42, true, true, Color("bd563a")))


func _build_tug() -> void:
	_boat = Node3D.new()
	_boat.name = "WhiteStormTug"
	_world_root.add_child(_boat)
	var hull := MeshInstance3D.new()
	hull.name = "SculptedIceWhiteHull"
	hull.mesh = _make_tug_hull()
	_hull_material = _mat(HULL_WHITE, 0.34)
	hull.material_override = _hull_material
	hull.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	_boat.add_child(hull)
	_add_box(_boat, Vector3(3.75, 0.34, 5.1), Vector3(0.0, 0.35, 0.25), _mat(Color("c7d5d2"), 0.48, false, true))
	_add_box(_boat, Vector3(2.72, 1.72, 2.9), Vector3(0.0, 1.08, 0.62), _mat(Color("375565"), 0.26, false, true))
	_add_box(_boat, Vector3(2.29, 0.78, 0.09), Vector3(0.0, 1.45, -0.88), _mat(Color("7cdde0"), 0.12, true, true, Color("2e7c84")))
	_add_box(_boat, Vector3(0.12, 0.92, 2.35), Vector3(-1.38, 1.41, 0.66), _mat(Color("a7c1c2"), 0.34, false, true))
	_add_box(_boat, Vector3(0.12, 0.92, 2.35), Vector3(1.38, 1.41, 0.66), _mat(Color("a7c1c2"), 0.34, false, true))
	_add_box(_boat, Vector3(1.42, 0.24, 2.05), Vector3(0.0, 2.03, 0.76), _mat(Color("dbe3d9"), 0.42, false, true))
	_add_box(_boat, Vector3(0.14, 0.46, 1.55), Vector3(0.0, 1.81, 2.95), _mat(Color("ffbb70"), 0.38, true, true, Color("ba6138")))
	_add_box(_boat, Vector3(1.56, 0.21, 0.44), Vector3(0.0, 0.72, -3.0), _mat(Color("f5ab68"), 0.42, false, true))
	for side in [-1.0, 1.0]:
		_add_box(_boat, Vector3(0.13, 0.12, 2.2), Vector3(side * 1.47, 0.84, -1.45), _mat(AMBER, 0.37, true, true, Color("a85336")))
		_add_cylinder(_boat, 0.055, 0.98, Vector3(side * 1.23, 1.48, 2.45), _mat(Color("d7e4df"), 0.37, false, true))
	_add_cylinder(_boat, 0.09, 3.6, Vector3(0.0, 2.83, 0.0), _mat(Color("bacbc8"), 0.45, false, true))
	_add_box(_boat, Vector3(0.09, 0.52, 0.08), Vector3(0.0, 4.33, 0.0), _mat(Color("f3d796"), 0.3, true, true, Color("a97641")))
	_add_cylinder(_boat, 0.36, 0.14, Vector3(0.0, -0.30, 0.0), _mat(Color("122937"), 0.72, false, true))
	var deck_lamp := OmniLight3D.new()
	deck_lamp.name = "TugDeckWorkLight"
	deck_lamp.position = Vector3(0.0, 2.05, -0.76)
	deck_lamp.light_color = Color("ffd69b")
	deck_lamp.light_energy = 2.2
	deck_lamp.omni_range = 19.0
	deck_lamp.shadow_enabled = false
	_boat.add_child(deck_lamp)
	var stern_lamp := OmniLight3D.new()
	stern_lamp.position = Vector3(0.0, 1.0, 3.32)
	stern_lamp.light_color = Color("ff775e")
	stern_lamp.light_energy = 0.65
	stern_lamp.omni_range = 9.0
	stern_lamp.shadow_enabled = false
	_boat.add_child(stern_lamp)


func _make_tug_hull() -> ArrayMesh:
	var profiles := [
		{"half": 1.78, "bottom": -0.48, "top": 0.24, "z": 3.72},
		{"half": 2.12, "bottom": -0.55, "top": 0.29, "z": 1.58},
		{"half": 1.74, "bottom": -0.47, "top": 0.23, "z": -1.12},
		{"half": 0.95, "bottom": -0.30, "top": 0.08, "z": -3.18},
		{"half": 0.12, "bottom": -0.13, "top": -0.06, "z": -4.48},
	]
	var rings: Array[PackedVector3Array] = []
	for profile: Dictionary in profiles:
		var half_width: float = profile.half
		var bottom: float = profile.bottom
		var top: float = profile.top
		var z: float = profile.z
		var ring := PackedVector3Array()
		ring.append(Vector3(-half_width, bottom, z))
		ring.append(Vector3(half_width, bottom, z))
		ring.append(Vector3(half_width, top, z))
		ring.append(Vector3(-half_width, top, z))
		rings.append(ring)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in range(rings.size() - 1):
		var rear := rings[index]
		var fore := rings[index + 1]
		# Bottom, upper chine, upper deck, and both sides of each narrowing hull station.
		_add_quad(surface, rear[0], fore[0], fore[1], rear[1])
		_add_quad(surface, rear[3], rear[2], fore[2], fore[3])
		_add_quad(surface, rear[2], rear[1], fore[1], fore[2])
		_add_quad(surface, rear[0], rear[3], fore[3], fore[0])
	_add_triangle(surface, rings[0][0], rings[0][1], rings[0][2])
	_add_triangle(surface, rings[0][0], rings[0][2], rings[0][3])
	var last := rings[rings.size() - 1]
	_add_triangle(surface, last[0], last[2], last[1])
	_add_triangle(surface, last[0], last[3], last[2])
	surface.generate_normals()
	var result := surface.commit()
	return result if result is ArrayMesh else ArrayMesh.new()


func _build_capsule() -> void:
	_cargo = Node3D.new()
	_cargo.name = "AmberRecoveryCapsule"
	_cargo.visible = false
	_world_root.add_child(_cargo)
	var shell_material := _mat(Color("e8793f"), 0.31, false, true)
	var body := _add_cylinder(_cargo, 1.28, 2.9, Vector3(0.0, 0.72, 0.0), shell_material)
	body.rotation.x = PI * 0.5
	var nose := _add_sphere(_cargo, 1.2, Vector3(0.0, 0.70, -1.38), _mat(Color("f18c47"), 0.30, false, true))
	nose.scale = Vector3(0.78, 0.78, 0.66)
	var tail := _add_sphere(_cargo, 1.2, Vector3(0.0, 0.70, 1.35), shell_material)
	tail.scale = Vector3(0.82, 0.82, 0.62)
	var safety_stripe := _add_box(_cargo, Vector3(2.66, 0.24, 0.30), Vector3(0.0, 1.14, 0.42), _mat(Color("ffd18a"), 0.27, true, true, Color("c57737")))
	safety_stripe.rotation.y = -0.12
	_add_box(_cargo, Vector3(2.25, 0.16, 0.22), Vector3(0.0, 0.35, -0.86), _mat(Color("ffb861"), 0.3, false, true))
	_add_cylinder(_cargo, 0.07, 0.9, Vector3(0.0, 1.82, 0.3), _mat(Color("e7d9b1"), 0.5, false, true))
	var lamp_shell := _add_sphere(_cargo, 0.34, Vector3(0.0, 2.0, 0.3), _mat(Color("ffe2a0"), 0.2, true, true, Color("ffa548")))
	lamp_shell.name = "AmberLocatorBeaconLens"
	var locator := OmniLight3D.new()
	locator.name = "CapsuleLocatorBeacon"
	locator.position = Vector3(0.0, 2.0, 0.3)
	locator.light_color = Color("ff9d54")
	locator.light_energy = 2.8
	locator.omni_range = 12.0
	locator.shadow_enabled = false
	_cargo.add_child(locator)
	var label := Label3D.new()
	label.text = "RECOVERY CAPSULE"
	label.font_size = 23
	label.outline_size = 5
	label.modulate = Color("ffd199")
	label.position = Vector3(0.0, 2.8, 0.0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_cargo.add_child(label)


func _build_tow_system() -> void:
	_cable = Node3D.new()
	_cable.name = "VisibleTensionedTowline"
	_cable.visible = false
	_world_root.add_child(_cable)
	_towline_material = _mat(Color("f0dcad"), 0.25, true, true, Color("574c39"))
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.5
	cylinder.bottom_radius = 0.5
	cylinder.height = 1.0
	cylinder.radial_segments = 8
	for index in range(CABLE_LINKS):
		var link := MeshInstance3D.new()
		link.name = "BraidedTowlineSegment_%02d" % index
		link.mesh = cylinder
		link.material_override = _towline_material
		link.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		link.visible = false
		_cable.add_child(link)
		_cable_links.append(link)
	_cable_light = OmniLight3D.new()
	_cable_light.name = "TowlineOverloadCue"
	_cable_light.light_color = Color("ff714f")
	_cable_light.light_energy = 0.0
	_cable_light.omni_range = 7.5
	_cable_light.shadow_enabled = false
	_cable.add_child(_cable_light)
	_tow_label = Label3D.new()
	_tow_label.name = "TensionPercentLabel"
	_tow_label.text = ""
	_tow_label.font_size = 26
	_tow_label.outline_size = 6
	_tow_label.modulate = Color("ffe1a3")
	_tow_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_tow_label.position.y = 2.4
	_tow_label.visible = false
	_cable.add_child(_tow_label)


func _build_target_contact() -> void:
	_target_marker = Node3D.new()
	_target_marker.name = "ScannedOnlyWreckContact"
	_target_marker.position = _to_world(_target)
	_target_marker.visible = false
	_world_root.add_child(_target_marker)
	var perimeter := _add_ring(
		_target_marker,
		Vector3(0.0, 0.32, 0.0),
		7.5,
		0.17,
		Color(1.0, 0.48, 0.25, 0.78),
		64
	)
	perimeter.name = "ScannedWreckSearchRadius"
	_add_box(_target_marker, Vector3(0.24, 3.8, 0.24), Vector3(0.0, 1.75, 0.0), _mat(Color("bf6746"), 0.55, false, true))
	var top_light := _add_sphere(_target_marker, 0.43, Vector3(0.0, 3.8, 0.0), _mat(Color("ffd08a"), 0.18, true, true, Color("ff8b54")))
	top_light.name = "AcquiredContactLight"
	var contact_light := OmniLight3D.new()
	contact_light.position = Vector3(0.0, 4.0, 0.0)
	contact_light.light_color = HAZARD_ORANGE
	contact_light.light_energy = 2.3
	contact_light.omni_range = 13.0
	contact_light.shadow_enabled = false
	_target_marker.add_child(contact_light)
	_target_label = Label3D.new()
	_target_label.text = "VISUAL CONTACT   /   RECOVERY CAPSULE"
	_target_label.font_size = 29
	_target_label.outline_size = 6
	_target_label.modulate = Color("ffd1a1")
	_target_label.position = Vector3(0.0, 5.35, 0.0)
	_target_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_target_marker.add_child(_target_label)


func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.name = "IndependentTacticalFollowCamera"
	_camera.fov = 54.0
	_camera.near = 0.18
	_camera.far = 520.0
	_camera.current = true
	_camera.position = _to_world(_harbor + Vector2(0.0, 43.0), 78.0)
	_world_root.add_child(_camera)
	_camera.look_at(_to_world(_harbor), Vector3.UP)


func _update_world(view: Dictionary, delta: float, snap_camera: bool) -> void:
	if not is_instance_valid(_boat) or not is_instance_valid(_camera):
		return
	var position_2d: Vector2 = view.get("position", _harbor)
	var velocity: Vector2 = view.get("velocity", Vector2.ZERO)
	var cargo_position: Vector2 = view.get("cargo_position", _target)
	var cargo_velocity: Vector2 = view.get("cargo_velocity", Vector2.ZERO)
	var heading := float(view.get("heading", 0.0))
	var storm := clampf(float(view.get("storm", 0.35)), 0.0, 1.0)
	var tension := clampf(float(view.get("tension", 0.0)), 0.0, TOW_DISPLAY_LIMIT)
	var overload_risk := clampf(float(view.get("overload", 0.0)), 0.0, 1.0)
	var hull := clampf(float(view.get("hull", 100.0)), 0.0, 100.0)
	var wind: Vector2 = view.get("wind", Vector2.ZERO)
	var tow_attached := bool(view.get("tow_attached", false))
	var scanned := bool(view.get("scanned", false))
	var target_visible := bool(view.get("target_visible", false))
	var phase := String(view.get("phase", "approach"))
	var screen := String(view.get("screen", "running"))

	var bob := sin(_elapsed * (1.25 + storm * 0.38) + position_2d.x * 0.04) * (0.055 + storm * 0.07)
	_boat.position = _to_world(position_2d, 0.70 + bob)
	_boat.rotation.y = -heading
	_cargo.position = _to_world(cargo_position, 0.43 + sin(_elapsed * 1.48 + cargo_position.y * 0.033) * (0.06 + storm * 0.065))
	var has_recovery_object := tow_attached or target_visible
	_cargo.visible = has_recovery_object
	_cargo.rotation.y = -_velocity_heading(cargo_velocity, heading)
	_target_marker.visible = target_visible and not tow_attached and phase == "approach"
	_target_label.text = "SONAR LOCK   /   RECOVERY CAPSULE" if scanned else "VISUAL CONTACT   /   RECOVERY CAPSULE"
	_update_wakes(position_2d, velocity, cargo_position, cargo_velocity, tow_attached, storm)
	_update_towline(position_2d, cargo_position, cargo_velocity, heading, tow_attached, tension, overload_risk, storm, phase)
	_update_sea_and_lights(storm, wind, hull, phase, screen)
	_update_camera(position_2d, cargo_position, tow_attached, phase, screen, maxf(0.0, delta), snap_camera)


func _update_wakes(position_2d: Vector2, velocity: Vector2, cargo_position: Vector2, cargo_velocity: Vector2, towing: bool, storm: float) -> void:
	_draw_wake(_boat_wake, _boat_wake_material, position_2d, velocity, 0.74 + storm * 0.24)
	if towing:
		_draw_wake(_cargo_wake, _cargo_wake_material, cargo_position, cargo_velocity, 0.57 + storm * 0.16)
	else:
		# Erase the capsule wake when its bearing is not yet permitted to be shown.
		_cargo_wake.clear_surfaces()


func _draw_wake(mesh: ImmediateMesh, material: Material, position_2d: Vector2, velocity: Vector2, width: float) -> void:
	mesh.clear_surfaces()
	var speed := velocity.length()
	if speed < 0.8:
		return
	var direction := velocity.normalized()
	var side := Vector2(-direction.y, direction.x)
	var back := -direction
	var wake_length := clampf(1.6 + speed * 0.38, 2.1, 8.2)
	var base := position_2d + back * 1.8
	var first := Vector3(base.x, 0.16, base.y)
	var mid_position := base + back * wake_length * 0.46
	var middle := Vector3(mid_position.x, 0.15, mid_position.y)
	var tip_position := base + back * wake_length
	var tip := Vector3(tip_position.x, 0.14, tip_position.y)
	var start_left := first + Vector3(side.x * 0.34, 0.0, side.y * 0.34)
	var start_right := first - Vector3(side.x * 0.34, 0.0, side.y * 0.34)
	var mid_width := width * minf(1.15, 0.64 + speed * 0.025)
	var middle_left := middle + Vector3(side.x * mid_width, 0.0, side.y * mid_width)
	var middle_right := middle - Vector3(side.x * mid_width, 0.0, side.y * mid_width)
	var end_width := mid_width * 0.82
	var tip_left := tip + Vector3(side.x * end_width, 0.0, side.y * end_width)
	var tip_right := tip - Vector3(side.x * end_width, 0.0, side.y * end_width)
	mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES, material)
	mesh.surface_add_vertex(start_left)
	mesh.surface_add_vertex(middle_left)
	mesh.surface_add_vertex(middle_right)
	mesh.surface_add_vertex(start_left)
	mesh.surface_add_vertex(middle_right)
	mesh.surface_add_vertex(start_right)
	mesh.surface_add_vertex(middle_left)
	mesh.surface_add_vertex(tip_left)
	mesh.surface_add_vertex(tip_right)
	mesh.surface_add_vertex(middle_left)
	mesh.surface_add_vertex(tip_right)
	mesh.surface_add_vertex(middle_right)
	mesh.surface_end()


func _update_towline(position_2d: Vector2, cargo_position: Vector2, cargo_velocity: Vector2, heading: float, towing: bool, tension: float, overload_risk: float, storm: float, phase: String) -> void:
	_cable.visible = towing
	_cable_light.light_energy = 0.0
	_tow_label.visible = false
	for link: MeshInstance3D in _cable_links:
		link.visible = towing
	if not towing:
		_tow_label.text = ""
		return
	var load_ratio := clampf(tension, 0.0, TOW_DISPLAY_LIMIT)
	var risk := clampf(overload_risk, 0.0, 1.0)
	var pulse := 0.72 + 0.28 * sin(_elapsed * (7.0 + storm * 5.0))
	var overloaded := load_ratio >= TOW_RATED_LOAD
	var recovering := not overloaded and risk > 0.0
	var line_color := Color("f0dcad")
	if load_ratio >= 0.72:
		line_color = Color("ffb35e")
	if overloaded:
		line_color = Color("ff684f")
		_cable_light.light_color = HAZARD_ORANGE
		_cable_light.light_energy = 1.1 + pulse * minf(2.2, load_ratio)
	else:
		_cable_light.light_color = Color("ffc86e")
		_cable_light.light_energy = maxf(0.0, load_ratio - 0.58) * 1.1
	var forward := Vector2(sin(heading), -cos(heading))
	var start_2d := position_2d - forward * 3.2
	var cargo_heading := _velocity_heading(cargo_velocity, heading)
	var end_2d := cargo_position + Vector2(sin(cargo_heading), -cos(cargo_heading)) * 1.35
	var slack := lerpf(0.68, 0.12, clampf(load_ratio / 1.25, 0.0, 1.0))
	var thick := 0.16 + minf(load_ratio, 1.4) * 0.12
	_towline_material.albedo_color = line_color
	_towline_material.emission = line_color * (0.20 + (0.38 if overloaded else 0.10) * pulse)
	for index in range(CABLE_LINKS):
		var t0 := float(index) / float(CABLE_LINKS)
		var t1 := float(index + 1) / float(CABLE_LINKS)
		var p0_2d := start_2d.lerp(end_2d, t0)
		var p1_2d := start_2d.lerp(end_2d, t1)
		var p0 := Vector3(p0_2d.x, 0.91 - sin(PI * t0) * slack, p0_2d.y)
		var p1 := Vector3(p1_2d.x, 0.91 - sin(PI * t1) * slack, p1_2d.y)
		var segment := _cable_links[index]
		var direction := p1 - p0
		if direction.length_squared() < 0.000001:
			segment.hide()
			continue
		segment.position = (p0 + p1) * 0.5
		segment.scale = Vector3(thick, direction.length() * 1.04, thick)
		segment.quaternion = Quaternion(Vector3.UP, direction.normalized())
	var midpoint := start_2d.lerp(end_2d, 0.5)
	_cable_light.position = Vector3(midpoint.x, 0.88 - slack, midpoint.y)
	if overloaded or load_ratio >= 0.72 or recovering:
		_tow_label.visible = true
		_tow_label.position = Vector3(midpoint.x, 3.2, midpoint.y)
		var load_text := "≥150%" if load_ratio >= TOW_DISPLAY_LIMIT else "%.1f%%" % (load_ratio * 100.0)
		if load_ratio < TOW_RATED_LOAD and load_text == "100.0%":
			load_text = "<100%"
		var risk_text := "<0.1%" if risk > 0.0 and risk < 0.001 else "%.1f%%" % (risk * 100.0)
		if risk < 1.0 and risk_text == "100.0%":
			risk_text = "<100%"
		var state := "OVERLOAD / RISK ACCUM " + risk_text if overloaded else ("RISK FALLING " + risk_text if recovering else "MONITOR")
		_tow_label.text = "TOW LOAD   %s   /   %s" % [load_text, state]
		_tow_label.modulate = Color("ff8967") if overloaded else (Color("d8c5ff") if recovering else Color("ffd18a"))
	elif phase == "return":
		_tow_label.visible = false
		_tow_label.text = ""


func _update_sea_and_lights(storm: float, wind: Vector2, hull: float, phase: String, screen: String) -> void:
	if is_instance_valid(_water_material):
		_water_material.set_shader_parameter("storm", storm)
		_water_material.set_shader_parameter("wind_dir", wind.normalized() if wind.length_squared() > 0.02 else Vector2(0.5, -0.8))
		_water_material.set_shader_parameter("wind_strength", wind.length())
	if is_instance_valid(_moon):
		_moon.light_energy = lerpf(1.13, 0.58, storm)
		_moon.light_color = Color("b3d1d7").lerp(Color("778c9e"), storm * 0.56)
	if is_instance_valid(_port_beacon_light):
		var rhythm := 0.82 + 0.18 * sin(_elapsed * 2.2)
		if phase == "success":
			rhythm = 1.0 + 0.36 * sin(_elapsed * 5.4)
		_port_beacon_light.light_energy = (1.2 + 0.55 * (1.0 - storm)) * rhythm
	if is_instance_valid(_port_beacon_shell):
		_port_beacon_shell.scale = Vector3.ONE * (0.92 + 0.06 * sin(_elapsed * 2.2))
	if is_instance_valid(_hull_material):
		var damaged_pulse := 0.72 + 0.28 * sin(_elapsed * 11.0)
		_hull_material.albedo_color = HULL_WHITE.lerp(HAZARD_ORANGE, 0.65 * damaged_pulse) if hull < 30.0 else HULL_WHITE
	if screen == "briefing":
		# Quiet dockside ambience while the player reads the contract.
		if is_instance_valid(_port_beacon_light):
			_port_beacon_light.light_energy *= 0.96


func _update_camera(position_2d: Vector2, cargo_position: Vector2, towing: bool, phase: String, screen: String, delta: float, snap_camera: bool) -> void:
	var focus := position_2d
	if towing:
		focus = position_2d.lerp(cargo_position, 0.36)
	if screen == "briefing" or phase == "success":
		focus = focus.lerp(_harbor, 0.2 if phase == "success" else 0.12)
	focus.x = clampf(focus.x, -MAP_LIMIT + 15.0, MAP_LIMIT - 15.0)
	focus.y = clampf(focus.y, -MAP_LIMIT + 15.0, MAP_LIMIT - 15.0)
	var look_target := _to_world(focus, 0.0)
	var desired_camera := _to_world(focus + Vector2(0.0, 41.0), 79.0)
	if snap_camera or not _has_presented:
		_camera.position = desired_camera
	else:
		var blend := 1.0 - exp(-clampf(delta, 0.0, 0.2) * (4.0 if screen != "paused" else 1.4))
		_camera.position = _camera.position.lerp(desired_camera, blend)
	_camera.look_at(look_target, Vector3.UP)


func _velocity_heading(velocity: Vector2, fallback: float) -> float:
	if velocity.length_squared() < 0.04:
		return fallback
	return atan2(velocity.x, -velocity.y)


func _add_ring(parent: Node3D, at: Vector3, radius: float, thickness: float, color: Color, segments: int) -> MeshInstance3D:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var inner := maxf(0.04, radius - thickness * 0.5)
	var outer := radius + thickness * 0.5
	for index in range(segments):
		var a0 := TAU * float(index) / float(segments)
		var a1 := TAU * float(index + 1) / float(segments)
		var p_inner_0 := Vector3(cos(a0) * inner, 0.0, sin(a0) * inner)
		var p_inner_1 := Vector3(cos(a1) * inner, 0.0, sin(a1) * inner)
		var p_outer_0 := Vector3(cos(a0) * outer, 0.0, sin(a0) * outer)
		var p_outer_1 := Vector3(cos(a1) * outer, 0.0, sin(a1) * outer)
		_add_triangle(surface, p_inner_0, p_inner_1, p_outer_1)
		_add_triangle(surface, p_inner_0, p_outer_1, p_outer_0)
	surface.generate_normals()
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.position = at
	mesh_instance.mesh = surface.commit()
	mesh_instance.material_override = _mat(color, 0.7, true, color.a < 1.0)
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mesh_instance)
	return mesh_instance


func _add_quad(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> void:
	_add_triangle(surface, a, b, c)
	_add_triangle(surface, a, c, d)


func _add_triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	# Our hull stations and horizontal rings have outward CCW vertices; Godot uses CW.
	surface.add_vertex(a)
	surface.add_vertex(c)
	surface.add_vertex(b)


func _add_box(parent: Node3D, size: Vector3, at: Vector3, material: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = at
	node.material_override = material
	parent.add_child(node)
	return node


func _add_cylinder(parent: Node3D, radius: float, height: float, at: Vector3, material: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 16
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = at
	node.material_override = material
	parent.add_child(node)
	return node


func _add_sphere(parent: Node3D, radius: float, at: Vector3, material: Material) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 16
	mesh.rings = 8
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = at
	node.material_override = material
	parent.add_child(node)
	return node


func _mat(color: Color, roughness: float = 0.55, unshaded: bool = false, emissive: bool = false, emission: Color = Color.BLACK) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = 0.12 if roughness < 0.5 else 0.04
	if unshaded:
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if color.a < 1.0:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emissive:
		material.emission_enabled = true
		material.emission = emission if emission != Color.BLACK else color
		material.emission_energy_multiplier = 0.55
	return material


func _to_world(position_2d: Vector2, height: float = 0.0) -> Vector3:
	return Vector3(position_2d.x, height, position_2d.y)
