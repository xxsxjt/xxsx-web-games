extends "res://tests/expedition_app_test.gd"
const Segments = preload("res://src/voyage_segments.gd")
const Nav = preload("res://src/public_navigation.gd")

func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/segments-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	_check(DirAccess.make_dir_recursive_absolute(_folder) == OK, "isolated fixtures")
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST, "seed isolated superior scores")
	_original_records = _record_bytes()
	await _controls_and_lifecycle(_folder.path_join("controls.json"))
	await _natural_pair(_folder.path_join("observed.json"), _folder.path_join("unobserved.json"))
	await _old_shape(_folder.path_join("legacy.json"))
	_check(_record_bytes() == _original_records and Keys.all_released(), "all four frozen score files and key releases preserved")
	_clean_fixtures()
	print("Stormline voyage segments app: %d checks, %d failures; native signals, process-local keys, paid natural turn/return and terminal; NOT human play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _controls_and_lifecycle(path: String) -> void:
	var app := _open(path)
	var hud: CanvasLayer = app.get("hud")
	app.call("_on_start_requested")
	var quick: Dictionary = app.get("sim").snapshot()
	for action: String in ["start", "finish", "cancel"]:
		app.call("_on_segment_action", action)
	for key: Key in [KEY_J, KEY_K, KEY_L]:
		Keys.edge(app.get_viewport(), key)
	_check(_segments(app).records.is_empty() and _segments(app).active.is_empty() and app.get("sim").snapshot() == quick and not hud.get("_segment_panel").visible and not FileAccess.file_exists(path), "original quickplay has no segment actions, panel or archive effect")
	app.call("_on_restart_requested")
	app.call("_on_pause_requested")
	app.call("_on_briefing_requested")
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	var saved := FileAccess.get_file_as_bytes(path)
	_press(app, "tab_work_order")
	_press(app, "queue_buy_sonar")
	var draft: Array = app.get("_work_order").duplicate(true)
	for action: String in ["start", "finish", "cancel"]:
		app.call("_on_segment_action", action)
	_check(app.get("_work_order") == draft and FileAccess.get_file_as_bytes(path) == saved and _segments(app).records.is_empty(), "segment commands cannot confirm or spend unpaid work order")
	_press(app, "clear_work_order")
	_check(_launch(app, path, "black-tide-chart-safe"), "real paid launch")
	var sim = app.get("sim")
	var snapshot: Dictionary = sim.snapshot().duplicate(true)
	saved = FileAccess.get_file_as_bytes(path)
	_native(app, "start")
	_check(not _segments(app).active.is_empty() and hud.get("_segment_status").text.contains("观察中"), "actual start button creates visible active status")
	var active := _segments(app)
	app.call("_on_segment_action", "start")
	_check(_segments(app) == active and sim.snapshot() == snapshot, "repeated start cannot reset baseline")
	_native(app, "finish")
	_check(_segments(app).records.size() == 1 and _segments(app).records[0].elapsed_s == 0.0, "actual finish button honestly retains zero duration")
	_native(app, "start")
	_native(app, "cancel")
	_check(_segments(app).active.is_empty() and _segments(app).records.size() == 1, "native cancel leaves completed observations")
	var event := InputEventKey.new()
	event.physical_keycode = KEY_J
	event.pressed = true
	app.call("_input", event)
	_check(not _segments(app).active.is_empty(), "physical-only J fallback starts")
	event.echo = true
	app.call("_input", event)
	event.echo = false
	app.call("_on_focus_exited")
	var frozen := _segments(app)
	for key: Key in [KEY_J, KEY_K, KEY_L]:
		Keys.edge(app.get_viewport(), key)
	for action: String in ["start", "finish", "cancel"]:
		app.call("_on_segment_action", action)
		_native(app, action, false)
	for delta: float in [0.0, DT, 2.0, 60.0]:
		app.call("_advance_simulation", delta, {"throttle": 1.0})
		app.call("_physics_process", delta)
		app.call("_publish", delta)
	_check(app.get("screen") == "paused" and sim.snapshot() == snapshot and _segments(app) == frozen and FileAccess.get_file_as_bytes(path) == saved, "pause/focus presentation, native and key actions cannot progress measurements, sim or save")
	await _geometry(app, "paused observations with original resume focus")
	# Held L across resume must not cancel. Both logical and physical values agree.
	event.physical_keycode = KEY_L
	event.keycode = KEY_L
	event.pressed = true
	app.call("_input", event)
	_press(app, "resume")
	app.call("_input", event)
	_check(_segments(app) == frozen, "held key across resume is not replayed")
	event.pressed = false
	app.call("_input", event)
	Keys.edge(app.get_viewport(), KEY_L)
	_check(_segments(app).active.is_empty(), "released L rearms cancellation")
	event.keycode = KEY_J
	event.physical_keycode = KEY_J
	event.pressed = true
	app.call("_input", event)
	app.call("_input", event)
	_check(not _segments(app).active.is_empty(), "dual-code event and repeated non-echo down only start once")
	event.pressed = false
	app.call("_input", event)
	Keys.edge(app.get_viewport(), KEY_K)
	for index in range(6):
		_native(app, "start")
		_native(app, "finish")
	_check(_segments(app).records.size() == 6 and _segments(app).records.front().number == 3 and _segments(app).records.back().number == 8, "real native retention capped at latest six")
	_check(sim.snapshot() == snapshot and FileAccess.get_file_as_bytes(path) == saved and _record_bytes() == _original_records, "all segment native/key actions have zero simulation/resource/archive/score side effects")
	_native(app, "start")
	await _geometry(app, "active cockpit alongside navigation and radar")
	await _segment_rectangles(app)
	app.call("_on_pause_requested")
	_check(_texts(_desk(app)).contains("航段 #8") and _texts(_desk(app)).contains("不同于电池净变") and _texts(_desk(app)).contains("最近6段"), "pause displays comparable retained rows and honest units/policy")
	await _geometry(app, "six long observation records")
	Keys.edge(app.get_viewport(), KEY_END)
	_check(_desk(app).get("_scroll").scroll_vertical > 0, "long records use existing keyboard scroll")
	_press(app, "abandon")
	_press(app, "cancel")
	_check(_segments(app).records.size() == 6, "cancel abandonment does not discard observations")
	_press(app, "abandon")
	_press(app, "confirm")
	_check(app.get("screen") == "dock" and _segments(app).records.is_empty(), "actual abandon/return dock clears all observations")
	app.call("_on_expedition_action", "reload", "")
	_check(_segments(app).active.is_empty() and _segments(app).records.is_empty(), "archive reread remains clear")
	_press(app, "continue")
	_press(app, "desk")
	app.call("_on_contract_selected", "needle-bank")
	app.call("_on_start_requested")
	Keys.edge(app.get_viewport(), KEY_J)
	app.call("_on_restart_requested")
	_check(_segments(app).records.is_empty() and _segments(app).active.is_empty() and not hud.get("_segment_panel").visible, "mode/contract/restart cannot leak previous expedition observations")
	await _close(app)


func _natural_pair(path: String, off_path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	# Identical actual initial saved archive gives both mains exactly the same token.
	var file := FileAccess.open(off_path, FileAccess.WRITE)
	file.store_buffer(FileAccess.get_file_as_bytes(path))
	file.close()
	var off := _open(off_path)
	Keys.edge(off.get_viewport(), KEY_X)
	_press(off, "continue")
	_check(_launch(app, path, "black-tide-chart-safe") and _launch(off, off_path, "black-tide-chart-safe"), "two actual independently saved paid starts")
	var oracle := Sim.new()
	_check(oracle.reset_expedition(State.launch_spec(_state(app))), "independent unchanged Sim reset from saved active spec")
	var sim = app.get("sim")
	var begin: Dictionary = sim.snapshot().duplicate(true)
	var initial_bytes := _archive_bytes(path)
	_check(initial_bytes == _archive_bytes(off_path), "paid archive and backup bytes equal before observation")
	app.call("_on_navigation_action", "select", "reef-0-1")
	off.call("_on_navigation_action", "select", "reef-0-1")
	_native(app, "start")
	var goal: Vector2 = Nav.project(begin, "reef-0-1", 0).point
	var outbound := false
	var returned := false
	var equal := true
	var saves_equal := true
	var travel := 0.0
	var before: Vector2 = begin.position
	var ticks := 0
	for tick in range(1, 6001):
		var view: Dictionary = sim.snapshot()
		var controls: Dictionary = Pilot._pilot(view, begin.position if outbound else goal, 5.0, 1)
		app.call("_advance_simulation", DT, controls)
		off.call("_advance_simulation", DT, controls)
		var expected := oracle.step(DT, controls)
		view = sim.snapshot()
		equal = equal and view == expected and off.get("sim").snapshot() == expected and _state(app) == _state(off)
		# Independent scalar Euclidean oracle, not the observer helper.
		var dx: float = view.position.x - before.x
		var dy: float = view.position.y - before.y
		travel += sqrt(dx * dx + dy * dy)
		before = view.position
		ticks = tick
		if tick % 120 == 0:
			app.call("_publish", 0.0)
			off.call("_publish", 0.0)
			saves_equal = saves_equal and _archive_bytes(path) == initial_bytes and _archive_bytes(off_path) == initial_bytes and _record_bytes() == _original_records
		if not outbound and view.position.distance_to(goal) <= Nav.NEAR_METERS:
			outbound = true
			_check(not _segments(app).active.is_empty() and _segments(app).records.is_empty() and app.get("_nav_index") == 0 and view.tide_survey.completed == 0, "arrival at existing public detour never finishes segment, advances navigation or samples")
		if outbound and view.position.distance_to(begin.position) <= 8.0:
			returned = true
			break
		if app.get("screen") != "running":
			break
	_native(app, "finish")
	var record: Dictionary = _segments(app).records[0]
	var ending: Dictionary = sim.snapshot()
	_check(outbound and returned and equal and saves_equal, "natural continuous-input detour AND turn/return every tick equals observation-off main and independent Sim; stores/scores unchanged")
	_check(absf(record.distance_m - travel) < 0.00001 and travel > begin.position.distance_to(ending.position) + 50.0 and absf(record.elapsed_s - ticks * DT) < 0.000001, "natural independent traveled-sum exceeds endpoint displacement and uses actual sim elapsed")
	_check(record.battery_delta_pp == ending.battery - begin.battery and absf(record.energy_spent_points - (ending.energy_budget.spent.total - begin.energy_budget.spent.total)) < 0.000000001, "actual signed battery versus accumulated energy measured separately")
	print("APP SEGMENT TURN RETURN tick=%d seconds=%.6f distance=%.6f displacement=%.6f hull_delta=%.6f battery_delta=%.6f spent=%.6f equal=%s" % [ticks, record.elapsed_s, record.distance_m, begin.position.distance_to(ending.position), record.hull_delta_pp, record.battery_delta_pp, record.energy_spent_points, equal])
	# Genuine terminal portion under legal idle controls, no fabricated phase/HP/time.
	_native(app, "start")
	var terminal_start: Dictionary = sim.snapshot().duplicate(true)
	for tick in range(ceili(float(ending.deadline) / DT) + 5):
		app.call("_advance_simulation", DT, {"power": 1})
		off.call("_advance_simulation", DT, {"power": 1})
		var expected := oracle.step(DT, {"power": 1})
		equal = equal and sim.snapshot() == expected and off.get("sim").snapshot() == expected and _state(app) == _state(off)
		if app.get("screen") == "debrief":
			break
	ending = sim.snapshot()
	var terminal: Dictionary = _segments(app).records.back()
	_check(equal and ending.phase == "failed" and terminal.reason == "terminal" and terminal.end.time == ending.time and terminal.elapsed_s == ending.time - terminal_start.time and _segments(app).active.is_empty(), "real natural failure closes active at actual last snapshot once before debrief")
	var retained := _segments(app)
	var settled := _archive_bytes(path)
	for delta: float in [0.0, DT, 3.0]:
		app.call("_advance_simulation", delta, {})
		app.call("_publish", delta)
		app.call("_present_expedition")
	_check(_segments(app) == retained and _archive_bytes(path) == settled and settled == _archive_bytes(off_path) and _segments(off).records.is_empty(), "terminal repeated render cannot duplicate record or settlement; enabled/disabled stores byte-identical")
	_check(_texts(_desk(app)).contains("终局收尾") and _texts(_desk(app)).contains("航段 #1"), "actual debrief retains both manual and terminal observations")
	Keys.edge(app.get_viewport(), KEY_V)
	_check(bool(_desk(app).get("_review_open")) and _texts(_desk(app)).contains("碰撞通知非全部接触") and _texts(_desk(app)).contains("手动航段观察"), "Stage25 original event review remains alongside separate observations")
	await _geometry(app, "terminal observations and original event review")
	print("APP SEGMENT REAL TERMINAL phase=%s t=%.6f records=%d same-input-store-bytes=%s reason=%s" % [ending.phase, ending.time, retained.records.size(), settled == _archive_bytes(off_path), ending.fail_reason])
	_press(app, "dock")
	_check(_segments(app).records.is_empty(), "debrief clearing action is actual return to dock")
	await _close(app)
	await _close(off)


func _old_shape(path: String) -> void:
	var old := State.new_campaign()
	_check(Store.new(path).save_state(old, -1).ok, "save legitimate pre-damage compatible shape")
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_check(_launch(app, path, "black-tide-survey-safe"), "old-compatible paid departure")
	var sim = app.get("sim")
	var first: Dictionary = sim.snapshot()
	_native(app, "start")
	app.call("_advance_simulation", DT, {"throttle": 1.0})
	_native(app, "finish")
	var record: Dictionary = _segments(app).records[0]
	_check(not first.has("energy_budget") and record.energy_spent_points == null and record.elapsed_s == DT and record.battery_delta_pp < 0.0 and not _state(app).has("damage_control"), "old expedition observed without adding damage/energy/persistence extension; unavailable is not zero")
	_native(app, "start")
	var metrics := await _sail(app, true, true)
	_check(metrics.view.phase == "success" and _segments(app).records.size() == 2 and _segments(app).records.back().reason == "terminal" and _segments(app).records.back().end.time == metrics.view.time, "real successful old-shape delivery also closes at final public snapshot")
	app.call("_publish", 0.0)
	_check(_segments(app).records.size() == 2, "successful debrief cannot duplicate terminal observation")
	# A key held in debrief remains latched through a new saved deployment.
	var event := InputEventKey.new()
	event.keycode = KEY_J
	event.pressed = true
	app.call("_input", event)
	_press(app, "dock")
	_check(_launch(app, path, "black-tide-recovery-safe"), "next actual paid voyage after successful debrief")
	app.call("_input", event)
	_check(_segments(app).active.is_empty() and _segments(app).records.is_empty(), "held key cannot start stale observation across dock/new voyage reset")
	event.pressed = false
	app.call("_input", event)
	Keys.edge(app.get_viewport(), KEY_J)
	_check(not _segments(app).active.is_empty(), "release rearms on distinct saved voyage")
	await _close(app)


func _segments(app: Node) -> Dictionary:
	return app.get("segments").view()


func _native(app: Node, action: String, enabled: bool = true) -> void:
	var button: Button = app.get("hud").get("_segment_buttons")[action]
	if enabled:
		_check(button.is_visible_in_tree() and not button.disabled, "actual cockpit segment button reachable: " + action)
	button.pressed.emit()


func _archive_bytes(path: String) -> Dictionary:
	var result := {}
	for suffix: String in ["", ".bak"]:
		if FileAccess.file_exists(path + suffix):
			result[suffix] = FileAccess.get_file_as_bytes(path + suffix)
	return result


func _segment_rectangles(app: Node) -> void:
	var viewport := app.get_viewport() as SubViewport
	var hud: CanvasLayer = app.get("hud")
	for dimensions: Vector2i in VIEWPORTS:
		viewport.size = dimensions
		for frame in range(4):
			await process_frame
		var panel: Control = hud.get("_segment_panel")
		for button: Button in hud.get("_segment_buttons").values():
			_check(_rect(panel).encloses(_rect(button)) and button.get_theme_font_size("font_size") == 18 and button.focus_mode == Control.FOCUS_NONE, "four viewport native segment rectangles and no stale cockpit Enter focus: " + str(dimensions))
	viewport.size = Vector2i(1280, 720)


func _geometry(app: Node, note: String) -> void:
	await super._geometry(app, note)
	if app.get("screen") != "running":
		return
	var viewport := app.get_viewport() as SubViewport
	var hud: CanvasLayer = app.get("hud")
	for dimensions: Vector2i in VIEWPORTS:
		viewport.size = dimensions
		for frame in range(4):
			await process_frame
		for property: String in ["_dock", "_navigation_panel", "_segment_panel"]:
			var panel: Control = hud.get(property)
			if not panel.is_visible_in_tree():
				continue
			for child: Control in panel.find_children("*", "Control", true, false):
				if child.is_visible_in_tree():
					_check(_rect(panel).grow(1).encloses(_rect(child)), "four viewport nested controls " + property + "/" + str(child.get_class()) + str(dimensions))
	viewport.size = Vector2i(1280, 720)
