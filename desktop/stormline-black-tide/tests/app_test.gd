extends SceneTree
## Headless scene/integration regression. Never starts a desktop window.

const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 120
const NEEDLE_OUTBOUND := [Vector2(-44, 0), Vector2(-29, -32), Vector2(2, -65)]
const NEEDLE_RETURN := [Vector2(11, -69), Vector2(-30, -35), Vector2(-45, 3)]

var _checks := 0
var _failures := 0
var _root_path := ""


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("app_test.gd requires --headless")
		quit(1)
		return
	_root_path = ProjectSettings.globalize_path("res://.testdata/app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root_path) != OK:
		printerr("Cannot create isolated app test directory")
		quit(1)
		return
	var record_path := _root_path.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	var hud: CanvasLayer = app.get("hud")
	_check(app.get("screen") == "briefing", "scene starts at its contract briefing")
	_check(app.get("selected_contract") == "black-tide", "default contract is selected")
	_check(app.get("records").records.is_empty(), "test-specific record file is initially empty")
	hud.emit_signal("contract_selected", "needle-bank")
	_check(app.get("selected_contract") == "needle-bank" and app.get("sim").contract_id == "needle-bank", "contract selection updates the model")
	_check(app.get("world")._contract.get("name") == app.get("sim").contract.get("name"), "contract selection updates the 3D scene")
	hud.emit_signal("start_requested")
	_check(app.get("screen") == "running" and app.get("sim").mission_time == 0.0, "selected contract starts from natural time zero")
	app.call("_advance_simulation", DT, {"throttle": 1.0, "power": 0})
	var elapsed_before_pause: float = app.get("sim").mission_time
	app.call("_on_pause_requested")
	_check(app.get("screen") == "paused", "pause signal changes screen state")
	app.call("_advance_simulation", 1.0, {"throttle": 1.0, "power": 0})
	_check(is_equal_approx(app.get("sim").mission_time, elapsed_before_pause), "paused app ignores control ticks")
	app.call("_on_pause_requested")
	_check(app.get("screen") == "running", "pause signal resumes")
	app.call("_on_contract_selected", "black-tide")
	_check(app.get("sim").contract_id == "needle-bank", "active run rejects contract switching")
	app.set("_tow_queued", true)
	app.call("_on_restart_requested")
	_check(app.get("screen") == "running" and app.get("sim").mission_time == 0.0 and app.get("sim").contract_id == "needle-bank", "restart preserves the selected contract and clears mission progress")
	_check(not app.get("_tow_queued"), "restart clears queued attachment input")
	app.call("_on_briefing_requested")
	_check(app.get("screen") == "running", "running cannot return directly to briefing")
	app.call("_on_focus_exited")
	_check(app.get("screen") == "paused", "focus loss pauses the active mission")
	hud.emit_signal("briefing_requested")
	_check(app.get("screen") == "briefing", "pause return opens the briefing")
	_check(not FileAccess.file_exists(record_path), "abandoned run never writes a best score")
	app.call("_on_contract_selected", "black-tide")
	_check(app.get("sim").contract_id == "black-tide", "black-tide is actually selected before its journey")
	await process_frame
	_check_world(app, "black-tide")
	app.call("_on_start_requested")
	_check(await _run_journey(app, "black-tide"), "full black-tide journey completes through the app input boundary")
	_check(app.get("screen") == "debrief", "terminal delivery opens debrief")
	_check(app.get("_record_status") == RecordsStore.NEW_BEST, "successful app delivery persists the local best result")
	_check(RecordsStore.new(record_path).records.has("black-tide"), "successful app record reloads from isolated disk storage")
	_check(not RecordsStore.new(record_path).records.has("needle-bank"), "incomplete second contract is not saved")
	var previous_bytes := FileAccess.get_file_as_bytes(record_path)
	app.call("_on_restart_requested")
	_check(app.get("screen") == "running" and app.get("sim").mission_time == 0.0, "debrief restart starts a clean retry")
	_check(app.get("records").records.has("black-tide"), "retry preserves previous verified best")
	_check(await _run_journey(app, "black-tide", true), "legitimate attachment then active overload reaches snap debrief")
	_check(app.get("_record_status") == "", "failed retry does not claim a saved result")
	_check(FileAccess.get_file_as_bytes(record_path) == previous_bytes, "failed retry leaves successful score bytes unchanged")
	hud.emit_signal("briefing_requested")
	_check(app.get("screen") == "briefing", "debrief return opens briefing")
	hud.emit_signal("mute_requested")
	_check(app.get("muted"), "mute toggle is retained by the app")
	_check(hud.get("_muted") and app.get("world")._view.get("muted", false), "mute state reaches HUD and snapshot consumers")
	app.call("_on_contract_selected", "needle-bank")
	await process_frame
	_check_world(app, "needle-bank")
	app.call("_on_start_requested")
	_check(await _run_journey(app, "needle-bank"), "full needle-bank journey completes through the app input boundary")
	var loaded: Dictionary = RecordsStore.new(record_path).records
	_check(loaded.has("black-tide") and loaded.has("needle-bank"), "both successful contracts reload independently from disk")
	_check(hud.get("_screen") == "debrief" and hud.get("_contract_id") == "needle-bank", "needle-bank result is shown by the HUD")
	_check(app.get("sound").get("_seen_event") == app.get("sim").event_id, "audio presenter consumed the terminal event through the shared snapshot")
	_check(app.get("sound").get("_motor") == null, "headless integration never creates an audio stream")
	app.call("_on_briefing_requested")
	app.call("_on_contract_selected", "black-tide")
	await process_frame
	_check_world(app, "black-tide")
	app.queue_free()
	await process_frame
	var reloaded_app: Node = MainScene.instantiate()
	reloaded_app.set("records_file", record_path)
	root.add_child(reloaded_app)
	await process_frame
	_check(reloaded_app.get("records").records == loaded, "new application scene reloads both verified local bests")
	_check(reloaded_app.get("screen") == "briefing", "reloaded application returns to briefing, not the previous mission")
	reloaded_app.queue_free()
	await process_frame
	_cleanup()
	print("Stormline headless app integration: %d checks, %d failures; model journey and local record ran through the scene composition root; real-window play not tested." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _run_journey(app: Node, id: String, overload: bool = false) -> bool:
	var sim: Variant = app.get("sim")
	var state: Dictionary = sim.snapshot()
	if not _check(state.contract_id == id and state.time == 0.0, "journey starts with actual contract " + id):
		return false
	var harbor: Vector2 = state.harbor
	var beacon: Vector2 = state.beacon
	var outbound := (beacon - harbor).normalized()
	var outward_route := NEEDLE_OUTBOUND if id == "needle-bank" else []
	var return_route := NEEDLE_RETURN if id == "needle-bank" else []
	var outward_leg := 0
	var return_leg := 0
	var scan_tick := 0
	var attach_tick := 0
	var last_tow_input := false
	for tick in range(1, MAX_TICKS + 1):
		var pos: Vector2 = state.position
		var input: Dictionary
		if not state.scanned:
			if outward_leg < outward_route.size() and pos.distance_to(outward_route[outward_leg]) < 7.0:
				outward_leg += 1
			var scan_zone := pos.distance_to(beacon) < 24.0
			var goal: Vector2 = outward_route[outward_leg] if outward_leg < outward_route.size() else beacon - outbound * 7.0
			input = _pilot(state, goal, 4.0 if scan_zone else 9.0, 1 if scan_zone else 0)
			input.scan = scan_zone
		elif not state.tow_attached:
			input = _pilot(state, state.cargo_position - outbound * 9.0, 3.0, 2, true)
			input.tow_pressed = not last_tow_input and pos.distance_to(state.cargo_position) < 11.0 \
				and (state.velocity - state.cargo_velocity).length() < 1.6
		elif overload:
			input = {"throttle": 1.0, "steer": clampf(wrapf(PI / 2.0 - state.heading, -PI, PI) * 2.2, -1.0, 1.0), "power": 0, "reel": -1.0}
		else:
			var cargo: Vector2 = state.cargo_position
			var both_inside := pos.distance_to(harbor) <= float(state.harbor_radius) \
				and cargo.distance_to(harbor) <= float(state.harbor_radius)
			var close_to_port := pos.distance_to(harbor) < float(state.harbor_radius) + 12.0
			var goal := harbor - outbound * float(state.harbor_radius) * 0.45
			if return_leg < return_route.size() and pos.distance_to(return_route[return_leg]) < 7.0:
				return_leg += 1
			if return_leg < return_route.size():
				goal = return_route[return_leg]
			if both_inside:
				input = {"power": 2, "slow": true}
			else:
				input = _pilot(state, goal, 3.2 if close_to_port else 5.0, 2, close_to_port)
				input.reel = -0.5 if state.tension < 0.45 else 0.0
		last_tow_input = input.get("tow_pressed", false)
		app.call("_advance_simulation", DT, input)
		state = sim.snapshot()
		if state.scanned and scan_tick == 0:
			scan_tick = tick
		if state.tow_attached and attach_tick == 0:
			attach_tick = tick
		if tick % 30 == 0:
			app.call("_publish", 1.0 / 30.0)
		if tick % 600 == 0:
			await process_frame
		if app.get("screen") == "debrief":
			print("APP %s/%s: phase=%s ticks=%d time=%.2f scan_tick=%d attach_tick=%d event=%s record_status=%s" % [
				id, "overload" if overload else "delivery", state.phase, tick, state.time, scan_tick, attach_tick,
				state.event_kind, app.get("_record_status")])
			return state.contract_id == id and scan_tick > 0 and attach_tick > scan_tick \
				and (state.phase == "failed" and state.event_kind == "snap" and state.report.is_empty() if overload else state.phase == "success")
	return false


func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow := false) -> Dictionary:
	var position: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading := float(state.heading)
	var course := goal - position - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var along := velocity.dot(forward)
	var throttle := clampf((speed * maxf(0.0, cos(error)) - along) * 0.26, -0.65, 1.0)
	return {
		"throttle": throttle,
		"steer": clampf(wrapf(desired - heading, -PI, PI) * 2.2, -1.0, 1.0),
		"power": power,
		"slow": slow,
	}


func _check_world(app: Node, id: String) -> void:
	var world: Node = app.get("world")
	var links: Array = world.get("_cable_links")
	var all_valid := links.size() == 14
	for link: Variant in links:
		all_valid = all_valid and is_instance_valid(link) and link.is_inside_tree()
	_check(all_valid, id + " rebuilt world owns exactly 14 live cable segments")
	_check(world.get_child_count() == 1, id + " old world root was released")
	_check(world.get("_view").get("contract_id") == id, id + " world consumes the selected snapshot")


func _cleanup() -> void:
	for filename in DirAccess.get_files_at(_root_path):
		DirAccess.remove_absolute(_root_path.path_join(filename))
	_check(DirAccess.remove_absolute(_root_path) == OK, "remove only this run's isolated app test directory")


func _check(ok: bool, message: String) -> bool:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
	return ok
