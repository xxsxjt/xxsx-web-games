extends SceneTree
## Headless post-impact application and records integration; no rendered/manual play.

const MainScene = preload("res://scenes/main.tscn")
const Sim = preload("res://src/storm_sim.gd")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 120
const REEF_NAME := "旧防波堤"

var _checks := 0
var _failures := 0
var _root_path := ""


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("recovery_app_test.gd requires --headless")
		quit(1)
		return
	_root_path = ProjectSettings.globalize_path("res://.testdata/recovery-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root_path) != OK:
		printerr("Cannot create isolated recovery test directory")
		quit(1)
		return
	var record_path := _root_path.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	app.call("_on_start_requested")
	var sim: Variant = app.get("sim")
	var hazard := _find_reef(sim, REEF_NAME)
	_check(not hazard.is_empty(), "black-tide recovery fixture resolves the named reef")
	if hazard.is_empty():
		await _finish(app)
		return

	_check(_stage_nonfatal_tug_impact(app, sim, hazard), "active tow receives a real, nonfatal tug collision")
	_check(app.get("screen") == "running" and sim.phase == "return" and sim.tow_attached,
		"nonfatal collision leaves the app running with an active tow")
	_check(sim.cargo_integrity == 100.0 and sim.event_kind == "collision"
		and sim.event_message.contains(REEF_NAME), "the isolated tug strike preserves cargo and reports its reef")
	if app.get("screen") != "running" or sim.phase != "return":
		await _finish(app)
		return

	var recovery := await _pilot_to_dock(app, sim)
	_check(recovery["success"], "damaged tow can naturally return and dock via the app input boundary")
	if recovery["success"]:
		_check(sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			"post-impact delivery ends with both bodies and power still operational")
		_check(sim.position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
			and sim.cargo_position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius),
			"recovery success requires both actual bodies inside harbor")
		_check(recovery["dock_hold"] >= 60 and sim.report.has("score"),
			"success report is created only after the sustained docking rule")
		_check(app.get("screen") == "debrief" and app.get("_record_status") in [RecordsStore.NEW_BEST, RecordsStore.EXISTING_BEST],
			"the app records the actually delivered recovery result")
	var saved_records: Dictionary = RecordsStore.new(record_path).records
	_check(saved_records.has("black-tide"), "delivered post-impact recovery is reloadable from the isolated record file")
	var saved_bytes := FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()

	# Retry through the real app start path, then produce a fatal pod scrape.
	app.call("_on_restart_requested")
	sim = app.get("sim")
	var fatal := _stage_fatal_pod_impact(app, sim, hazard)
	_check(fatal, "fatal cargo impact enters the normal failed debrief")
	if fatal:
		_check(sim.phase == "failed" and app.get("screen") == "debrief"
			and sim.event_kind == "collision" and sim.fail_reason.contains("回收舱破损"),
			"fatal pod collision retains its failure classification")
		_check(sim.report.is_empty(), "fatal collision never manufactures a success report")
		_check(FileAccess.get_file_as_bytes(record_path) == saved_bytes,
			"fatal retry leaves the verified post-impact best record byte-for-byte unchanged")
		_check(RecordsStore.new(record_path).records == saved_records,
			"fatal retry leaves reloaded best scores unchanged")

	# Use the stage-09 physical recovery route with stage-10 near-exhaustion
	# resources. Every failed route must travel through the app's normal debrief
	# boundary and leave the earlier successful record and its bytes unchanged.
	var exhausted_cases: Array[Dictionary] = [
		{"name": "hull", "hull": 15.0, "cargo": 42.0, "battery": 24.0,
			"reason": "船体耐久归零", "kind": "collision"},
		{"name": "cargo", "hull": 40.0, "cargo": 12.2, "battery": 24.0,
			"reason": "回收舱破损", "kind": "collision"},
		{"name": "battery", "hull": 40.0, "cargo": 42.0, "battery": 16.0,
			"reason": "电量耗尽", "kind": "power_lost"},
	]
	for scenario: Dictionary in exhausted_cases:
		app.call("_on_restart_requested")
		sim = app.get("sim")
		_stage_compound_impact(app, sim, hazard, scenario)
		_check(app.get("screen") == "running" and sim.phase == "return"
			and sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			String(scenario.name) + " exhaustion route starts alive after a real dual-body impact")
		var exhausted_route := await _pilot_to_dock(app, sim)
		_check(not exhausted_route["success"] and sim.phase == "failed"
			and app.get("screen") == "debrief" and sim.report.is_empty(),
			String(scenario.name) + " exhaustion reaches failed debrief without a success report")
		_check(sim.fail_reason.contains(String(scenario.reason)) and sim.event_kind == scenario.kind,
			String(scenario.name) + " exhaustion keeps its specific app failure reason")
		_check(FileAccess.get_file_as_bytes(record_path) == saved_bytes
			and RecordsStore.new(record_path).records == saved_records
			and String(app.get("_record_status")).is_empty(),
			String(scenario.name) + " failed route leaves stored best bytes and rankings unchanged")
		print("APP recovery_exhaustion/%s: phase=%s ticks=%d hull=%.1f cargo=%.1f battery=%.1f reason=%s" % [
			scenario.name, sim.phase, exhausted_route["ticks"], sim.hull, sim.cargo_integrity, sim.battery, sim.fail_reason])

	await _finish(app)
	print("Stormline post-impact app recovery: %d checks, %d failures; headless scene/input/record integration only, no rendered route play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _stage_nonfatal_tug_impact(app: Node, sim: Variant, hazard: Dictionary) -> bool:
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 20.0
	sim.heading = PI
	var center: Vector2 = hazard.position
	var margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2(0.0, -(margin - 0.05))
	sim.velocity = Vector2(0.0, 2.0)
	sim.cargo_position = center + Vector2(0.0, -(margin + cargo_margin + 8.0))
	sim.cargo_velocity = Vector2.ZERO
	sim.cargo_integrity = 100.0
	sim.hull = 100.0
	sim.rope_length = Sim.ROPE_MAX
	app.call("_publish", 0.0, true)
	app.call("_advance_simulation", DT, {"power": 2})
	return sim.hull < 100.0 and sim.hull > 0.0


func _stage_fatal_pod_impact(app: Node, sim: Variant, hazard: Dictionary) -> bool:
	if app.get("screen") != "running":
		return false
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 45.0
	sim.heading = 0.0
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2(0.0, -(tug_margin + 25.0))
	sim.velocity = Vector2.ZERO
	sim.cargo_position = center + Vector2(cargo_margin - 0.8, 0.0)
	sim.cargo_velocity = Vector2(-4.0, 0.0)
	sim.cargo_integrity = 0.5
	sim.hull = 100.0
	sim.rope_length = Sim.ROPE_MAX
	app.call("_publish", 0.0, true)
	app.call("_advance_simulation", DT, {"power": 2})
	return sim.phase == "failed" and app.get("screen") == "debrief"


func _stage_compound_impact(app: Node, sim: Variant, hazard: Dictionary, scenario: Dictionary) -> void:
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 80.0
	sim._update_weather()
	sim.hull = scenario.hull
	sim.cargo_integrity = scenario.cargo
	sim.battery = scenario.battery
	sim.power_profile = 2
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	var tug_normal := Vector2.UP
	var cargo_normal := Vector2.UP.rotated(0.68)
	sim.heading = PI
	sim.position = center + tug_normal * (tug_margin - 0.05)
	sim.velocity = -tug_normal * 2.0
	sim.cargo_position = center + cargo_normal * (cargo_margin - 0.05)
	sim.cargo_velocity = -cargo_normal * 2.0
	sim.rope_length = Sim.ROPE_MIN
	sim._apply_reefs(DT)
	app.call("_publish", 0.0, true)


func _pilot_to_dock(app: Node, sim: Variant) -> Dictionary:
	var route: Array[Vector2] = [_find_reef(sim, REEF_NAME).position + Vector2(-18.0, -16.0), Vector2(3.0, 8.0)]
	var leg := 0
	var dock_hold := 0
	var harbor: Vector2 = sim.contract.harbor
	var radius := float(sim.contract.harbor_radius)
	for tick in range(1, MAX_TICKS + 1):
		var state: Dictionary = sim.snapshot()
		var tug_distance: float = state.position.distance_to(harbor)
		var cargo_distance: float = state.cargo_position.distance_to(harbor)
		if leg < route.size() and state.position.distance_to(route[leg]) < 7.0:
			leg += 1
		var input: Dictionary
		if tug_distance <= radius and cargo_distance <= radius:
			input = {"power": 2, "slow": true}
		else:
			var goal: Vector2 = route[leg] if leg < route.size() else harbor + Vector2(0.0, radius * 0.45)
			var near_harbor := tug_distance < radius + 12.0
			input = _pilot(state, goal, 3.2 if near_harbor else 4.6, 2, near_harbor)
			input.reel = -0.5 if state.tension < 0.45 else 0.0
		var previous_dock: float = sim.dock
		app.call("_advance_simulation", DT, input)
		if sim.dock > previous_dock:
			dock_hold += 1
		else:
			dock_hold = 0
		if app.get("screen") != "running":
			return {"success": sim.phase == "success", "dock_hold": dock_hold, "ticks": tick}
		if tick % 600 == 0:
			await process_frame
	return {"success": false, "dock_hold": dock_hold, "ticks": MAX_TICKS}


func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow: bool) -> Dictionary:
	var pos: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading: float = state.heading
	var course := goal - pos - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var along := velocity.dot(forward)
	var throttle := clampf((speed * maxf(0.0, cos(error)) - along) * 0.26, -0.65, 1.0)
	return {"throttle": throttle, "steer": clampf(error * 2.2, -1.0, 1.0), "power": power, "slow": slow}


func _find_reef(sim: Variant, reef_name: String) -> Dictionary:
	for hazard: Dictionary in sim.contract.hazards:
		if hazard.kind == "reef" and hazard.name == reef_name:
			return hazard
	return {}


func _finish(app: Node) -> void:
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(_root_path):
		DirAccess.remove_absolute(_root_path.path_join(name))
	_check(DirAccess.remove_absolute(_root_path) == OK, "remove only this test's isolated records directory")


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
