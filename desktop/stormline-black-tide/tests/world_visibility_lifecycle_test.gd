extends SceneTree
## Headless scene-node and radar projection checks, not rendered or natural-input play.

const World = preload("res://src/storm_world.gd")
const Sim = preload("res://src/storm_sim.gd")
const Radar = preload("res://src/radar.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const RADAR_SIZES := [Vector2(296, 238), Vector2(296, 194), Vector2(248, 194), Vector2(400, 280)]

var _checks := 0
var _failures := 0
var _world: Node3D


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("world_visibility_lifecycle_test.gd requires --headless")
		quit(1)
		return
	_radar_boundary_fixtures()
	_radar_contract_fixtures()
	await _radar_lifecycle_fixtures()
	_world = World.new()
	_world.configure(Sim.CONTRACTS["black-tide"])
	root.add_child(_world)
	await process_frame
	for id: String in ["black-tide", "needle-bank"]:
		await _exercise_contract(id)
	_world.queue_free()
	await process_frame
	_check(not is_instance_valid(_world), "test world releases its scene tree after lifecycle checks")
	print("Stormline world visibility lifecycle: %d checks, %d failures; two world contracts, all three radar charts and authored tide stations, synthetic clipping/boundary/freeze fixtures; snapshot-driven headless projections only; no rendering, gameplay, records or desktop play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _radar_boundary_fixtures() -> void:
	# Unit-scale chart makes the exact 100-pixel inset boundary representable.
	var chart := {"origin": Vector2.ZERO, "center": Vector2(32, 64), "radius": 108.0, "scale": 1.0, "extent": 108.0}
	var before := chart.duplicate(true)
	for direction: Vector2 in [Vector2.UP, Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT]:
		for distance: float in [0.0, 99.999, 100.0, 100.001, 500.0]:
			var world := direction * distance
			var result := Radar.project_contact(chart, world, Vector2(7, -9))
			_check(result.plotted.is_equal_approx(chart.center + world.limit_length(100.0))
				and bool(result.clipped) == (distance > 100.0), "radar exact/inset boundary plots truthfully at " + str(world))
			_check(is_equal_approx(result.range_m, world.distance_to(Vector2(7, -9)))
				and is_equal_approx(result.chart_range_m, distance), "radar boundary exposes world/public-reference range, not a clamped pixel distance")
			if distance > 0.0:
				var expected := fposmod(rad_to_deg(atan2(direction.x, -direction.y)), 360.0)
				_check(is_equal_approx(result.bearing_degrees, expected) and result.direction.is_equal_approx(direction),
					"radar bearing is north=0/east=90/south=180/west=270 independently of heading")
	# Pythagorean diagonals cover radial (not per-axis square) clipping.
	for world: Vector2 in [Vector2(60, 80), Vector2(-60, -80), Vector2(120, 160), Vector2(-120, -160)]:
		var result := Radar.project_contact(chart, world, Vector2.ZERO)
		_check(result.plotted.is_equal_approx(chart.center + world.limit_length(100.0))
			and bool(result.clipped) == (world.length() > 100.0), "radar diagonal contact uses the same circular inset boundary")
	_check(chart == before, "contact projection never annotates or changes its supplied chart dictionary")
	var tiny := Radar.project_snapshot({"position": Vector2(30, 40)}, Vector2.ZERO)
	_check(tiny.tug.plotted == tiny.chart.center and bool(tiny.tug.clipped)
		and tiny.tug.range_m == 50.0, "non-drawable collapsed viewport projection remains finite without inventing a range")


func _radar_contract_fixtures() -> void:
	var expected_extents := {"black-tide": 125.0, "needle-bank": 150.0, "cross-current": 125.0}
	var path: Array = []
	for id: String in Sim.CONTRACTS:
		var sim := Sim.new()
		sim.reset(id)
		var view: Dictionary = sim.snapshot()
		var original := view.duplicate(true)
		for dimensions: Vector2 in RADAR_SIZES:
			var chart := Radar.chart_geometry(view, dimensions)
			var origin: Vector2 = sim.contract.harbor.lerp(sim.contract.beacon, 0.42)
			var radius := minf(dimensions.x * 0.37, (dimensions.y - 48.0) * 0.5)
			_check(chart.origin.is_equal_approx(origin) and chart.center == Vector2(dimensions.x * 0.46, dimensions.y * 0.5 + 1.0)
				and chart.radius == radius and chart.extent == expected_extents[id]
				and chart.scale == radius / float(expected_extents[id]), id + " retains its old public chart origin, extent and viewport geometry")
			var north := Radar.project_contact(chart, origin + Vector2.UP * 20.0, origin)
			_check(not north.clipped and north.plotted.is_equal_approx(chart.center + Vector2.UP * 20.0 * chart.scale),
				id + " in-chart positions retain the exact north-up metric projection")
			for hazard: Dictionary in view.hazards:
				_check(origin.distance_to(hazard.position) + float(hazard.radius) + 8.0 <= float(chart.extent),
					id + " chart extent still encloses the entire public hazard and margin")
			_radar_contact_fixtures(view, dimensions, id)
		_check(view == original and sim.snapshot() == original, id + " all radar helpers leave model snapshots and contract geometry unchanged")

		# Use real, validated chart deployment envelopes, not save-supplied geometry.
		var offer_id := id + "-chart-safe"
		var spec := {"token": "radar-fixture:1", "offer_id": offer_id, "contract": Catalog.build_contract(offer_id, 0, path),
			"loadout": [], "pressure": 0, "path": path.duplicate(), "hull": 100.0, "battery": 100.0}
		_check(sim.reset_expedition(spec), id + " radar fixture uses an accepted real tide-chart deployment")
		view = sim.snapshot()
		original = view.duplicate(true)
		for dimensions: Vector2 in RADAR_SIZES:
			var chart := Radar.chart_geometry(view, dimensions)
			_check(chart.extent == expected_extents[id] and view.tide_survey.stations.size() == 2,
				id + " authored A/B stations retain the existing contract extent")
			for station: Vector2 in view.tide_survey.stations:
				_check(Vector2(chart.origin).distance_to(station) + float(view.tide_survey.radius) + 8.0 <= float(chart.extent),
					id + " chart contains the whole tide sampling ring and margin")
			var relocated := view.duplicate(true)
			relocated.tide_survey.stations = [Vector2(chart.origin) + Vector2(360, 0)]
			var extended := Radar.chart_geometry(relocated, dimensions)
			_check(extended.origin == chart.origin and extended.extent == 400.0,
				id + " a public distant tide station actually expands the quantized extent, not just its marker")
			_radar_contact_fixtures(view, dimensions, id + " tide")
		_check(view == original and sim.snapshot() == original, id + " radar projection does not change real tide samples or their input dictionaries")
		path.append(id + "-survey-safe")
		path.append(id + "-recovery-safe")


func _radar_contact_fixtures(base: Dictionary, dimensions: Vector2, label: String) -> void:
	var base_before := base.duplicate(true)
	var view := base.duplicate(true)
	var chart := Radar.chart_geometry(view, dimensions)
	var origin: Vector2 = chart.origin
	var inset_metres := (float(chart.radius) - Radar.CONTACT_INSET) / float(chart.scale)
	view.scanned = true
	view.tow_attached = true
	view.target_visible = true
	view.heading = PI # A southbound ship off the east edge must not look eastbound.
	view.position = origin + Vector2(inset_metres + 70.0, 0)
	view.cargo_position = origin + Vector2(inset_metres + 95.0, 0)
	view.home_distance = -123.0
	view.target_distance = -456.0 # Incorrect redundant inputs must not supply the readout.
	var before := view.duplicate(true)
	var result := Radar.project_snapshot(view, dimensions)
	_check(result.tug.clipped and result.cargo.clipped and result.tug.plotted.is_equal_approx(result.cargo.plotted)
		and not result.solid_towline, label + " same-bearing distant pair is explicitly clipped and never joined by an ordinary solid towline")
	_check(is_equal_approx(result.cargo.range_m, 25.0)
		and is_equal_approx(result.tug.range_m, Vector2(view.position).distance_to(view.harbor))
		and is_equal_approx(result.tug.chart_range_m, inset_metres + 70.0)
		and is_equal_approx(result.cargo.chart_range_m, inset_metres + 95.0),
		label + " collapsed pixels retain distinct true world ranges and nonzero public ship/pod separation")
	_check(result.edge_readouts.size() == 2 and String(result.edge_readouts[0]).begins_with("船 图外 图心090° 港距")
		and String(result.edge_readouts[1]) == "舱 图外 图心090° 船距25.0m",
		label + " separate role/range captions identify chart-origin bearing rather than heading or coincident positions")
	var turned := view.duplicate(true)
	turned.heading = -PI * 0.5
	_check(Radar.project_snapshot(turned, dimensions) == result, label + " changing heading does not rotate chart-origin edge bearing or range")
	var closer := view.duplicate(true)
	closer.cargo_position = Vector2(closer.position) + Vector2(0.01, 0)
	var short_pair := Radar.project_snapshot(closer, dimensions)
	_check(String(short_pair.edge_readouts[1]).ends_with("船距<0.1m"), label + " positive sub-decimetre range is not rounded into a false zero")

	for tug_out: bool in [false, true]:
		for cargo_out: bool in [false, true]:
			view.position = origin + Vector2((inset_metres + 50.0) if tug_out else 10.0, 0)
			view.cargo_position = origin + Vector2(0, -(inset_metres + 60.0) if cargo_out else -10.0)
			result = Radar.project_snapshot(view, dimensions)
			_check(bool(result.tug.clipped) == tug_out and bool(result.cargo.clipped) == cargo_out
				and bool(result.solid_towline) == (not tug_out and not cargo_out),
				label + " towline requires both actual endpoints to be inside the inset boundary")
			_check(result.edge_readouts.size() == int(tug_out) + int(cargo_out), label + " each and only each clipped public contact has an edge/range caption")
			if not tug_out and not cargo_out:
				_check(result.tug.plotted.is_equal_approx(chart.center + Vector2(10, 0) * chart.scale)
					and result.cargo.plotted.is_equal_approx(chart.center + Vector2(0, -10) * chart.scale)
					and result.cargo.filled, label + " in-bounds attached contact keeps normal metric marks and filled cargo styling")
	view.position = origin
	view.cargo_position = origin + Vector2(10, 0)
	view.tow_attached = false
	view.target_visible = false
	result = Radar.project_snapshot(view, dimensions)
	_check(not result.cargo.filled and not result.cargo.clipped and not result.solid_towline and result.edge_readouts.is_empty(),
		label + " in-chart sonar trace remains hollow, not an out-of-chart cue or a tow")
	view.target_visible = true
	_check(Radar.project_snapshot(view, dimensions).cargo.filled, label + " in-chart visually disclosed pod keeps its original filled diamond style")
	view.target_visible = false
	view.cargo_position = origin + Vector2(inset_metres + 80.0, 0)
	result = Radar.project_snapshot(view, dimensions)
	_check(result.cargo.clipped and not result.cargo.filled and String(result.edge_readouts[0]).begins_with("舱迹 图外"),
		label + " off-chart sonar-only trace is distinct from both in-chart hollow trace and visible capsule")
	view.tow_attached = true
	_check(Radar.project_snapshot(view, dimensions).cargo.filled, label + " attached pod remains a known body even outside visual range")

	view.scanned = false
	var hidden := Radar.project_snapshot(view, dimensions)
	var changed := view.duplicate(true)
	changed.cargo_position = Vector2(-100000, 200000)
	changed.cargo_velocity = Vector2(900, -700)
	changed.cargo_integrity = 1.0
	changed.target_visible = true
	changed.target_distance = 999999.0
	_check(hidden.cargo.is_empty() and not hidden.solid_towline and hidden.edge_readouts.is_empty()
		and Radar.project_snapshot(changed, dimensions) == hidden and hidden.chart == chart,
		label + " unknown capsule cannot leak coordinates, range, bearing, tow cues or change the public chart scale")
	changed.scanned = true
	changed.erase("cargo_position")
	result = Radar.project_snapshot(changed, dimensions)
	_check(result.cargo.is_empty() and not result.solid_towline and result.edge_readouts.is_empty(),
		label + " missing public pod coordinate does not fabricate a contact or tow endpoint")
	_check(base == base_before, label + " synthetic contact movements are confined to fixture copies")
	# Re-project the original captured fixture to verify every nested input is unchanged.
	var frozen := before.duplicate(true)
	Radar.project_snapshot(before, dimensions)
	_check(before == frozen, label + " clipping and caption generation never annotate caller dictionaries")


func _radar_lifecycle_fixtures() -> void:
	var radar := Radar.new()
	radar.hide()
	radar.size = RADAR_SIZES[0]
	root.add_child(radar)
	var sim := Sim.new()
	sim.reset("needle-bank")
	# Explicit synthetic positions; not a natural voyage or docking claim.
	sim.scanned = true
	sim.tow_attached = true
	sim.phase = "return"
	sim.position = Vector2(250, -180)
	sim.cargo_position = Vector2(275, -180)
	var model_before: Dictionary = sim.snapshot()
	var view := model_before.duplicate(true)
	view.screen = "running"
	var original := view.duplicate(true)
	radar.set_snapshot(view)
	var projected := radar.projection()
	_check(projected.tug.clipped and projected.cargo.clipped and not projected.solid_towline,
		"live radar node consumes the same clipped projection helper as drawing")
	for screen: String in ["paused", "debrief"]:
		for phase: String in ["return", "success", "failed"]:
			var frozen := view.duplicate(true)
			frozen.screen = screen
			frozen.phase = phase
			var before := frozen.duplicate(true)
			radar.set_snapshot(frozen)
			await process_frame
			for _repeat in range(8):
				_check(radar.projection() == projected, "pause/terminal frozen radar neither drifts nor reinterprets clipped public ranges")
			_check(frozen == before, "pause/terminal radar redraw leaves the complete frozen source dictionary unchanged")
	_check(view == original and sim.snapshot() == model_before,
		"snapshot-only radar presentation cannot advance model positions, time, phase or results")
	for id: String in ["black-tide", "cross-current", "needle-bank"]:
		sim.reset(id)
		var fresh: Dictionary = sim.snapshot()
		var before := fresh.duplicate(true)
		radar.set_snapshot(fresh)
		await process_frame
		var reset := radar.projection()
		_check(reset == Radar.project_snapshot(fresh, radar.size) and reset.cargo.is_empty()
			and reset.edge_readouts.is_empty() and not reset.solid_towline,
			id + " restart/contract rebuild clears old clipped pod, edge ranges and tow feedback immediately")
		_check(reset.chart.origin.is_equal_approx(Vector2(fresh.harbor).lerp(fresh.beacon, 0.42)) and fresh == before,
			id + " restart uses the new contract chart without changing its input")
		radar.size = RADAR_SIZES[1]
		var resized := radar.projection()
		_check(resized.chart.origin == reset.chart.origin and resized.chart.extent == reset.chart.extent
			and resized.tug.range_m == reset.tug.range_m and sim.snapshot() == fresh,
			id + " resizing changes only pixels, not public range, chart extent or simulation")
		radar.size = RADAR_SIZES[0]
	radar.set_snapshot({})
	var empty := radar.projection()
	_check(empty.tug.is_empty() and empty.cargo.is_empty() and empty.edge_readouts.is_empty() and not empty.solid_towline,
		"empty radar snapshot cannot retain a previous contract's edge state")
	radar.queue_free()
	await process_frame
	_check(not is_instance_valid(radar), "radar lifecycle fixture releases its control without launching a scene or game")


func _exercise_contract(id: String) -> void:
	var sim := Sim.new()
	sim.reset(id)
	_world.configure(sim.contract)
	await process_frame
	var label := id
	var old_root: Node3D = _world.get("_world_root")
	var old_marker: Node3D = _world.get("_target_marker")
	var old_link: MeshInstance3D = _world.get("_cable_links")[0]
	_check(_world.get_child_count() == 1 and old_root.is_inside_tree(), label + " rebuild leaves one current world root")
	_check(old_marker.position == Vector3(sim.contract.target.x, 0.0, sim.contract.target.y),
		label + " acquired-contact marker uses the selected contract location")

	var view: Dictionary = sim.snapshot()
	view["screen"] = "briefing"
	_world.present(view, 0.0, true)
	_check(_projection(false, false, false), label + " fresh briefing conceals unknown capsule and tow system")
	_check(view == sim.snapshot().merged({"screen": "briefing"}), label + " scene presentation does not mutate a fresh model snapshot")

	# A scan lock only reveals the target when its public snapshot permits it.
	sim.scanned = true
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(not bool(view.target_visible) and _projection(false, false, false),
		label + " a scanned but distant contact remains concealed")
	sim.position = sim.cargo_position + Vector2(51.0, 0.0)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(not bool(view.target_visible) and _projection(false, false, false),
		label + " exact 51 metre disclosure boundary remains concealed")
	sim.position = sim.cargo_position + Vector2(50.999, 0.0)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(bool(view.target_visible) and _projection(true, true, false),
		label + " contact becomes visible just inside the snapshot disclosure radius")
	_check(_world.get("_target_label").text == "SONAR LOCK   /   RECOVERY CAPSULE",
		label + " visible contact label agrees with the locked snapshot")
	_check(not bool(_world.get("_tow_label").visible), label + " unattached contact has no stale tow warning")

	# The same contract becomes a disclosed contact directly over its true target.
	sim.position = sim.cargo_position
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(bool(view.target_visible) and _projection(true, true, false),
		label + " acquired contact reveals its exact scene marker and capsule after sonar lock")

	view["screen"] = "paused"
	var paused := view.duplicate(true)
	_world.present(view, 0.0)
	_check(view == paused and _projection(true, true, false),
		label + " pause preserves contact projection without advancing its snapshot")
	_moving_contact_fixtures(view, sim.contract, label)

	# Return uses the known object but retires the approach-only marker.
	sim.phase = "return"
	sim.tow_attached = true
	sim.cable_tension = 0.80
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(_projection(false, true, true), label + " attached return hides approach marker but keeps capsule and cable")
	_check(_all_links_visible(), label + " attached tow activates every cable segment")

	# Cable snap clears tow-only cues; a scanned, still-nearby pod remains a known object.
	sim.phase = "failed"
	sim.tow_attached = false
	sim.cable_tension = 1.5
	sim.overload = 0.8
	view = sim.snapshot()
	view["screen"] = "debrief"
	_world.present(view, 0.0)
	_check(bool(view.target_visible) and _projection(false, true, false),
		label + " post-snap debrief keeps a nearby known capsule but no approach marker or cable")
	_check(not bool(_world.get("_tow_label").visible) and _world.get("_tow_label").text.is_empty()
		and _world.get("_cable_light").light_energy == 0.0 and not _all_links_visible(),
		label + " terminal cable break clears all tow-only visual residue")

	# Restart resets the model-derived presentation, then a second contract replaces old nodes.
	sim.reset(id)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(_projection(false, false, false), label + " restart hides old acquired-contact and tow state")

	var next_id := "needle-bank" if id == "black-tide" else "black-tide"
	var next_sim := Sim.new()
	next_sim.reset(next_id)
	_world.configure(next_sim.contract)
	_check(_world.get_child_count() == 1 and not old_root.is_inside_tree(),
		label + " contract replacement immediately detaches its former world root")
	await process_frame
	_check(not is_instance_valid(old_root) and not is_instance_valid(old_marker) and not is_instance_valid(old_link),
		label + " contract replacement releases old marker and cable nodes")
	var next_view: Dictionary = next_sim.snapshot()
	var fresh_contract_marker: Node3D = _world.get("_target_marker")
	next_view["screen"] = "briefing"
	_world.present(next_view, 0.0, true)
	_check(_projection(false, false, false), label + " replacement contract begins with all hidden states reset")
	_check(fresh_contract_marker.position == Vector3(next_sim.contract.target.x, 0.0, next_sim.contract.target.y)
		and _world.get("_hazards").size() == next_sim.contract.hazards.size(),
		label + " replacement world owns the new contact and hazard layout")

	# Successful debrief snaps to the contract harbor; this is presentation-only.
	next_sim.scanned = true
	next_sim.tow_attached = true
	next_sim.phase = "success"
	next_sim.position = next_sim.contract.harbor + Vector2(40.0, -18.0)
	next_sim.cargo_position = next_sim.contract.harbor + Vector2(8.0, 3.0)
	var success_view: Dictionary = next_sim.snapshot()
	success_view["screen"] = "debrief"
	var success_before := success_view.duplicate(true)
	var camera_before_terminal: Vector3 = _world.get("_camera").position
	_world.present(success_view, 0.0)
	var pair_focus: Vector2 = next_sim.position.lerp(next_sim.cargo_position, 0.36)
	var expected_focus: Vector2 = pair_focus.lerp(next_sim.contract.harbor, 0.2)
	var expected_camera := Vector3(expected_focus.x, 79.0, expected_focus.y + 41.0)
	_check(_projection(false, true, true) and _all_links_visible(),
		label + " successful debrief retains delivered pair while retiring approach marker")
	_check(_world.get("_camera").position == camera_before_terminal,
		label + " terminal success camera eases instead of snapping on its first frame")
	for _frame in range(180):
		_world.present(success_view, 1.0 / 60.0)
	_check(_world.get("_camera").position.distance_to(expected_camera) < 0.05,
		label + " terminal success camera converges to a harbor-framed view")
	_check(success_view == success_before and next_sim.snapshot()["phase"] == "success",
		label + " terminal camera and visibility projection leave model/result unchanged")


func _moving_contact_fixtures(base: Dictionary, contract: Dictionary, label: String) -> void:
	# Synthetic snapshot positions, deliberately separate from natural-input voyages.
	for offset: Vector2 in [Vector2(13.0, -6.0), Vector2(-7.0, 9.0), Vector2.ZERO]:
		var view := base.duplicate(true)
		var contact: Vector2 = contract.target + offset
		view.screen = "running"
		view.cargo_position = contact
		view.position = contact + Vector2(8.0, 0.0)
		view.target_distance = 8.0
		var original := view.duplicate(true)
		_world.present(view, 0.0, true)
		var marker: Node3D = _world.get("_target_marker")
		var caption: Label3D = _world.get("_target_label")
		_check(marker.visible and marker.position == Vector3(contact.x, 0.0, contact.y)
			and Vector2(caption.global_position.x, caption.global_position.z) == contact,
			label + " moving contact ring and inherited label follow the live capsule at " + str(offset))
		_check(view == original and _world.get("_target") == contract.target,
			label + " contact projection leaves the snapshot and configured initial target unchanged")
		view.screen = "paused"
		_world.present(view, 0.75)
		_check(marker.position == Vector3(contact.x, 0.0, contact.y) and marker.visible,
			label + " paused contact stays at the measured capsule position")
	var hidden := base.duplicate(true)
	hidden.cargo_position = contract.target + Vector2(21.0, 17.0)
	hidden.target_visible = false
	_world.present(hidden, 0.0)
	_check(not _world.get("_target_marker").visible and not _world.get("_cargo").visible,
		label + " moving contact still respects snapshot concealment")
	hidden.target_visible = true
	_world.present(hidden, 0.0)
	_check(_world.get("_target_marker").visible
		and _world.get("_target_marker").position == Vector3(hidden.cargo_position.x, 0.0, hidden.cargo_position.y),
		label + " newly disclosed contact uses the current capsule rather than the previous contact position")
	_world.present(base, 0.0)


func _projection(marker: bool, capsule: bool, cable: bool) -> bool:
	var actual_marker: bool = _world.get("_target_marker").visible
	var actual_capsule: bool = _world.get("_cargo").visible
	var actual_cable: bool = _world.get("_cable").visible
	_check(actual_marker == marker and actual_capsule == capsule and actual_cable == cable,
		"marker/capsule/cable visibility is %s/%s/%s" % [actual_marker, actual_capsule, actual_cable])
	return actual_marker == marker and actual_capsule == capsule and actual_cable == cable


func _all_links_visible() -> bool:
	var links: Array = _world.get("_cable_links")
	if links.size() != 14:
		return false
	for link: MeshInstance3D in links:
		if not link.visible or not link.is_inside_tree():
			return false
	return true


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
