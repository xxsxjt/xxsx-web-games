class_name StormRadar
extends Control

const GRID := Color(0.33, 0.70, 0.77, 0.24)
const INK := Color("a8c8d6")
const TUG := Color("9ff5f3")
const HARBOR := Color("79e8cc")
const SIGNAL := Color("eeb575")
const CARGO := Color("ff9c63")
const REEF := Color("f58c91")
const CURRENT := Color("a6a4f5")

var world_radius := 118.0
var _snapshot: Dictionary = {}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true

func set_snapshot(value: Dictionary) -> void:
	_snapshot = value
	queue_redraw()

func _draw() -> void:
	var radius := minf(size.x * 0.37, (size.y - 48.0) * 0.5)
	if radius < 18.0:
		return
	var center := Vector2(size.x * 0.46, size.y * 0.5 + 1.0)
	var harbor: Vector2 = _snapshot.get("harbor", Vector2.ZERO)
	var beacon: Vector2 = _snapshot.get("beacon", harbor)
	var harbor_radius := maxf(0.0, float(_snapshot.get("harbor_radius", 0.0)))
	var hazards: Array = _snapshot.get("hazards", [])
	# Stable north-up chart: only public chart features contribute to its extent.
	var origin := harbor.lerp(beacon, 0.42)
	var extent := maxf(maxf(world_radius, 25.0), origin.distance_to(harbor) + harbor_radius + 8.0)
	extent = maxf(extent, origin.distance_to(beacon) + 23.0)
	for raw in hazards:
		if raw is Dictionary and raw.get("position") is Vector2:
			var point: Vector2 = raw.get("position")
			extent = maxf(extent, origin.distance_to(point) + maxf(0.0, float(raw.get("radius", 0.0))) + 8.0)
	var scale := radius / (ceilf(extent / 25.0) * 25.0)
	_draw_grid(center, radius, scale)

	for raw in hazards:
		if raw is Dictionary and raw.get("position") is Vector2:
			var point: Vector2 = raw.get("position")
			_draw_hazard(center + (point - origin) * scale, maxf(5.0, float(raw.get("radius", 0.0)) * scale), String(raw.get("kind", "reef")))
	for landmark: Dictionary in _snapshot.get("current_landmarks", []):
		var point: Vector2 = landmark.get("position", origin)
		var mark := center + (point - origin) * scale
		var label := str(int(landmark.get("number", 0)))
		var font := get_theme_default_font()
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		draw_circle(mark, 9.0, Color("171e3b"))
		draw_string(font, mark + Vector2(-width * 0.5, 5.5), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("f2efff"))
	if _snapshot.has("harbor"):
		var dock := center + (harbor - origin) * scale
		var ring := maxf(5.0, harbor_radius * scale)
		draw_circle(dock, ring, Color(HARBOR, 0.11))
		draw_arc(dock, ring, 0.0, TAU, 36, HARBOR, 1.5, true)
		draw_rect(Rect2(dock - Vector2(3.0, 3.0), Vector2(6.0, 6.0)), HARBOR)

	var tug: Vector2 = _snapshot.get("position", origin)
	var tug_mark := _mark(center, origin, tug, scale, radius)
	if bool(_snapshot.get("scanned", false)):
		if _snapshot.get("cargo_position") is Vector2:
			var cargo: Vector2 = _snapshot.get("cargo_position")
			var cargo_mark := _mark(center, origin, cargo, scale, radius)
			var attached := bool(_snapshot.get("tow_attached", false))
			if attached:
				draw_line(tug_mark, cargo_mark, Color(CARGO, 0.78), 1.6, true)
			var diamond := PackedVector2Array([cargo_mark + Vector2(0, -6), cargo_mark + Vector2(6, 0), cargo_mark + Vector2(0, 6), cargo_mark + Vector2(-6, 0)])
			if attached or bool(_snapshot.get("target_visible", true)):
				draw_colored_polygon(diamond, CARGO)
			else:
				# Hollow trace: locked by sonar, but outside visual range.
				diamond.append(diamond[0])
				draw_polyline(diamond, CARGO, 1.7, true)
	elif _snapshot.has("beacon"):
		var region := center + (beacon - origin) * scale
		var uncertainty := maxf(11.0, 18.0 * scale)
		draw_circle(region, uncertainty, Color(SIGNAL, 0.10))
		_broken_ring(region, uncertainty, SIGNAL)

	if _snapshot.has("position"):
		var heading := float(_snapshot.get("heading", 0.0))
		var forward := Vector2(sin(heading), -cos(heading))
		var side := Vector2(-forward.y, forward.x)
		var ship := PackedVector2Array([tug_mark + forward * 9.0, tug_mark - forward * 5.0 + side * 5.0, tug_mark - forward * 2.0, tug_mark - forward * 5.0 - side * 5.0])
		draw_colored_polygon(ship, TUG)
	_draw_wind(_snapshot.get("wind", Vector2.ZERO))

func _draw_grid(center: Vector2, radius: float, scale: float) -> void:
	draw_circle(center, radius + 5.0, Color("132b3b"))
	draw_circle(center, radius, Color("091a29"))
	for circle in [0.33, 0.66, 1.0]:
		draw_arc(center, radius * float(circle), 0.0, TAU, 72, GRID, 1.0, true)
	for axis in [Vector2.RIGHT, Vector2.DOWN]:
		draw_line(center - axis * radius, center + axis * radius, GRID, 1.0, true)
	for i in range(24):
		var tick := Vector2.UP.rotated(i * TAU / 24.0)
		var depth := 8.0 if i % 6 == 0 else 3.0
		draw_line(center + tick * (radius - depth), center + tick * radius, GRID, 1.0, true)
	draw_string(get_theme_default_font(), Vector2(center.x - 5.5, center.y - radius - 8.0), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TUG)
	var scale_origin := Vector2(10, size.y - 10.0)
	draw_line(scale_origin, scale_origin + Vector2(25.0 * scale, 0), INK, 1.0)
	draw_string(get_theme_default_font(), scale_origin + Vector2(0, -5), "25 m", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, INK)

func _draw_hazard(at: Vector2, radius: float, kind: String) -> void:
	if kind == "current":
		draw_circle(at, radius, Color(CURRENT, 0.15))
		_broken_ring(at, radius, Color(CURRENT, 0.86))
		draw_line(at + Vector2(-4, -1), at + Vector2(4, -3), CURRENT, 1.4, true)
		draw_line(at + Vector2(-4, 3), at + Vector2(4, 1), CURRENT, 1.4, true)
	else:
		draw_circle(at, radius, Color(REEF, 0.19))
		draw_arc(at, radius, 0.0, TAU, 32, Color(REEF, 0.86), 1.2, true)
		draw_line(at - Vector2(3, 3), at + Vector2(3, 3), REEF, 1.5, true)
		draw_line(at - Vector2(3, -3), at + Vector2(3, -3), REEF, 1.5, true)

func _broken_ring(at: Vector2, radius: float, color: Color) -> void:
	for i in range(8):
		var start := i * TAU / 8.0
		draw_arc(at, radius, start, start + 0.49, 7, color, 1.6, true)

func _mark(center: Vector2, origin: Vector2, world: Vector2, scale: float, radius: float) -> Vector2:
	return center + ((world - origin) * scale).limit_length(radius - 8.0)

func _draw_wind(wind: Vector2) -> void:
	var at := Vector2(size.x - 25.0, size.y - 40.0)
	draw_circle(at, 18.0, Color("132b3b"))
	if wind.length_squared() > 0.0025:
		var direction := wind.normalized()
		var nose := at + direction * 11.0
		var wing := Vector2(-direction.y, direction.x) * 4.0
		draw_line(at - direction * 10.0, nose, INK, 1.6, true)
		draw_colored_polygon(PackedVector2Array([nose, nose - direction * 6.0 + wing, nose - direction * 6.0 - wing]), INK)
	else:
		draw_circle(at, 2.5, INK)
	draw_string(get_theme_default_font(), at + Vector2(-8, 35), "风", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, INK)
