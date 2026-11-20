extends SceneTree
## Synthetic headless pause/focus callbacks around the last physical docking tick.

const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const Fixture = preload("res://tests/terminal_priority_fixture.gd")
const DT := 1.0 / 60.0
const CASES := [
	{"name": "manual-resume", "focus": false, "action": "resume", "boundary": "healthy"},
	{"name": "focus-resume", "focus": true, "action": "resume", "boundary": "healthy"},
	{"name": "manual-battery", "focus": false, "action": "resume", "boundary": "battery-exact"},
	{"name": "focus-battery", "focus": true, "action": "resume", "boundary": "battery-exact"},
	{"name": "manual-timeout", "focus": false, "action": "resume", "boundary": "deadline-exact"},
	{"name": "focus-timeout", "focus": true, "action": "resume", "boundary": "deadline-exact"},
	{"name": "manual-restart", "focus": false, "action": "restart", "boundary": "healthy"},
	{"name": "focus-restart", "focus": true, "action": "restart", "boundary": "healthy"},
	{"name": "manual-briefing", "focus": false, "action": "briefing", "boundary": "healthy"},
	{"name": "focus-briefing", "focus": true, "action": "briefing", "boundary": "healthy"},
]

var _checks := 0
var _failures := 0
var _root_path := ""


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("docking_lifecycle_test.gd requires --headless")
		quit(1)
		return
	_root_path = ProjectSettings.globalize_path("res://.testdata/docking-lifecycle-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root_path) != OK:
		_check(false, "create isolated docking-lifecycle directory")
		quit(1)
		return
	var record_path := _root_path.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	for contract_id: String in ["black-tide", "needle-bank"]:
		_start_near_docking(app, contract_id)
		var sim: Variant = app.get("sim")
		app.call("_advance_simulation", DT, Fixture.CONTROLS)
		_check(sim.phase == "success" and app.get("screen") == "debrief"
			and sim.report.has("score") and app.get("_record_status") == RecordsStore.NEW_BEST,
			contract_id + " saves a real 60-step baseline before any pause case")
		var saved_bytes := FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()
		var saved_records: Dictionary = RecordsStore.new(record_path).records.duplicate(true)
		_check(not saved_bytes.is_empty() and saved_records.has(contract_id), contract_id + " baseline is reloadable")
		for scenario: Dictionary in CASES:
			_run_case(app, contract_id, scenario, record_path, saved_bytes, saved_records)
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(_root_path):
		DirAccess.remove_absolute(_root_path.path_join(name))
	_check(DirAccess.remove_absolute(_root_path) == OK, "remove only the lifecycle test records directory")
	print("Stormline docking lifecycle: %d checks, %d failures; 20 headless app pause/focus cases, synthetic callbacks and harbor state only." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _start_near_docking(app: Node, contract_id: String) -> void:
	if app.get("screen") != "briefing":
		app.call("_on_briefing_requested")
	app.call("_on_contract_selected", contract_id)
	app.call("_on_start_requested")
	var sim: Variant = app.get("sim")
	Fixture.prepare(sim, contract_id)
	for _tick in range(Fixture.PRIOR_HOLD_TICKS):
		app.call("_advance_simulation", DT, Fixture.CONTROLS)
	_check(app.get("screen") == "running" and sim.phase == "return" and sim.report.is_empty()
		and is_equal_approx(sim.dock, 59.0 * DT), contract_id + " earns 59 docking ticks through application stepping")


func _run_case(app: Node, contract_id: String, scenario: Dictionary, record_path: String,
		saved_bytes: PackedByteArray, saved_records: Dictionary) -> void:
	_start_near_docking(app, contract_id)
	var sim: Variant = app.get("sim")
	var boundary: Dictionary = {}
	for candidate: Dictionary in Fixture.CASES:
		if candidate.name == scenario.boundary:
			boundary = candidate
	_check(not boundary.is_empty(), String(scenario.name) + " resolves a known final-tick resource boundary")
	if boundary.is_empty():
		return
	Fixture.arm_final_tick(sim, boundary)
	var before: Dictionary = sim.snapshot()
	var label := contract_id + "/" + String(scenario.name)
	_key(app, KEY_SPACE)
	_check(bool(app.get("_tow_queued")), label + " running adapter queues the test tow input")
	if scenario.focus:
		app.call("_on_focus_exited")
	else:
		_key(app, KEY_P)
	_check(app.get("screen") == "paused" and not bool(app.get("_tow_queued"))
		and sim.snapshot() == before, label + " entering pause clears pending tow without changing the model")
	app.call("_on_focus_exited")
	app.call("_on_focus_exited")
	_check(app.get("screen") == "paused" and sim.snapshot() == before,
		label + " repeated focus-exit callbacks never toggle a paused game back to running")
	_key(app, KEY_SPACE)
	_check(not bool(app.get("_tow_queued")), label + " paused Space cannot queue a delayed tow action")
	for blocked_delta: float in [DT, 0.75, 60.0]:
		app.call("_advance_simulation", blocked_delta, {"throttle": 1.0, "tow_pressed": true, "reel": -1.0})
		app.call("_physics_process", blocked_delta)
		app.call("_process", blocked_delta)
		_check(app.get("screen") == "paused" and sim.snapshot() == before,
			label + " paused update delta %.3f cannot advance time, hold, resources or events" % blocked_delta)
		_check(_same_record(record_path, saved_bytes, saved_records)
			and String(app.get("_record_status")).is_empty(), label + " paused updates cannot save a score")
	if scenario.action == "resume":
		_key(app, KEY_ESCAPE)
		_check(app.get("screen") == "running" and sim.snapshot() == before and not bool(app.get("_tow_queued")),
			label + " resume restores the exact physical snapshot without replaying queued input")
		app.call("_advance_simulation", DT, Fixture.CONTROLS)
		_check(is_equal_approx(sim.mission_time, float(before.time) + DT) and app.get("screen") == "debrief",
			label + " resumed outcome consumes exactly one ordinary fixed tick")
		if boundary.success:
			_check(sim.phase == "success" and sim.dock == 1.0 and sim.report.has("score")
				and sim.event_kind == "docked" and app.get("_record_status") == RecordsStore.EXISTING_BEST,
				label + " safe resumed docking produces only the normal success and preserves the best")
		else:
			_check(sim.phase == "failed" and sim.dock == before.dock and sim.report.is_empty()
				and sim.event_kind == boundary.kind and sim.fail_reason.contains(String(boundary.reason))
				and String(app.get("_record_status")).is_empty(), label + " resume cannot bypass exhaustion or timeout")
		var terminal: Dictionary = sim.snapshot()
		app.call("_on_focus_exited")
		app.call("_advance_simulation", 60.0, Fixture.CONTROLS)
		_check(app.get("screen") == "debrief" and sim.snapshot() == terminal,
			label + " focus or delayed steps after debrief cannot replay the result")
	else:
		_key(app, KEY_R if scenario.action == "restart" else KEY_ENTER)
		if scenario.action == "briefing":
			_check(app.get("screen") == "briefing" and sim.mission_time == 0.0 and sim.dock == 0.0,
				label + " abandoning paused docking resets the mission at briefing")
			_key(app, KEY_ENTER)
		_check(app.get("screen") == "running" and sim.phase == "approach" and sim.contract_id == contract_id
			and sim.mission_time == 0.0 and sim.dock == 0.0 and not sim.scanned and not sim.tow_attached
			and sim.report.is_empty() and not bool(app.get("_tow_queued")) and String(app.get("_record_status")).is_empty(),
			label + " new mission clears old docking, tow input and score status")
		app.call("_advance_simulation", DT, Fixture.CONTROLS)
		_check(app.get("screen") == "running" and sim.phase == "approach" and sim.dock == 0.0
			and sim.report.is_empty() and is_equal_approx(sim.mission_time, DT),
			label + " first new-mission tick cannot inherit the prior final docking tick")
	_check(_same_record(record_path, saved_bytes, saved_records), label + " complete lifecycle leaves stored best bytes/rankings unchanged")
	print("APP docking_lifecycle/%s/%s: screen=%s phase=%s dock=%.6f time=%.6f record_preserved=%s" % [
		contract_id, scenario.name, app.get("screen"), sim.phase, sim.dock, sim.mission_time,
		str(_same_record(record_path, saved_bytes, saved_records))])
	# Return through supported transitions, without modifying the production app.
	if app.get("screen") == "running":
		_key(app, KEY_P)
	app.call("_on_briefing_requested")


func _key(app: Node, keycode: int) -> void:
	var event := InputEventKey.new()
	event.keycode = keycode
	event.pressed = true
	app.call("_unhandled_input", event)


func _same_record(record_path: String, saved_bytes: PackedByteArray, saved_records: Dictionary) -> bool:
	return not saved_bytes.is_empty() and FileAccess.file_exists(record_path) \
		and FileAccess.get_file_as_bytes(record_path) == saved_bytes \
		and RecordsStore.new(record_path).records == saved_records


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
