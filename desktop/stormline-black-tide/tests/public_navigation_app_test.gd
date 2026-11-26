extends "res://tests/expedition_app_test.gd"
const Nav = preload("res://src/public_navigation.gd")
const Radar = preload("res://src/radar.gd")

func _run() -> void:
	_folder = ProjectSettings.globalize_path("res://.testdata/navigation-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	_check(DirAccess.make_dir_recursive_absolute(_folder) == OK, "isolated fixtures")
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST, "seed isolated records")
	_original_records = _record_bytes()
	var path := _folder.path_join("navigation.json")
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	var saved := FileAccess.get_file_as_bytes(path)
	_press(app, "tab_work_order")
	_press(app, "queue_buy_sonar")
	var draft: Array = app.get("_work_order").duplicate(true)
	_press(app, "tab_navigation")
	_press(app, "nav_select_reef-0-1")
	_check(app.get("_nav_route") == "reef-0-1" and app.get("_work_order") == draft and FileAccess.get_file_as_bytes(path) == saved, "native navigation preserves unpaid work order and save bytes")
	await _geometry(app, "navigation routes and long labels")
	_press(app, "tab_work_order")
	_press(app, "clear_work_order")
	_press(app, "tab_chart")
	_press(app, "offer_black-tide-chart-safe")
	_check(app.get("_nav_route") == "", "offer change clears draft route")
	_press(app, "tab_navigation")
	_press(app, "nav_select_tide-0")
	_press(app, "nav_clear")
	_press(app, "nav_select_harbor")
	app.call("_on_expedition_action", "reload", "")
	_check(app.get("_nav_route") == "" and FileAccess.get_file_as_bytes(path) == saved, "explicit archive reload clears navigation without a save")
	_press(app, "continue")
	_press(app, "tab_chart")
	_press(app, "offer_black-tide-chart-safe")
	_press(app, "tab_navigation")
	_press(app, "nav_select_reef-0-1")
	_press(app, "launch")
	_press(app, "cancel")
	_check(FileAccess.get_file_as_bytes(path) == saved and app.get("_nav_route") == "reef-0-1", "cancel paid launch leaves only navigation draft")
	_press(app, "launch")
	_press(app, "confirm")
	_check(app.get("screen") == "running" and app.get("_nav_route") == "reef-0-1", "saved matching deployment takes preparation route")
	var sim = app.get("sim")
	var snapshot: Dictionary = sim.snapshot().duplicate(true)
	var oracle := Sim.new()
	_check(oracle.reset_expedition(State.launch_spec(_state(app))) and oracle.snapshot() == snapshot, "independent same-spec sailing oracle")
	saved = FileAccess.get_file_as_bytes(path)
	var hud: CanvasLayer = app.get("hud")
	var pick: OptionButton = hud.get("_navigation_pick")
	var ids: Array = hud.get("_navigation_ids")
	pick.item_selected.emit(ids.find("reef-0-1"))
	var commands: Node = pick.get_parent().get_child(pick.get_index() + 1)
	commands.get_child(1).pressed.emit()
	_check(app.get("_nav_index") == 1, "actual native advance button")
	commands.get_child(1).pressed.emit()
	commands.get_child(1).pressed.emit()
	app.call("_publish", 0.0)
	_check(app.get("_nav_index") == 3 and not hud.get("_radar").get("_snapshot").navigation.active and sim.snapshot() == snapshot, "last manual advance ends only navigation, never contract")
	commands.get_child(2).pressed.emit()
	_check(app.get("_nav_route") == "", "actual native clear button")
	pick.item_selected.emit(ids.find("reef-0-1"))
	_check(sim.snapshot() == snapshot and FileAccess.get_file_as_bytes(path) == saved, "native helm choice has no physics/resource/save effects")
	await _geometry(app, "cockpit navigation beside radar")
	Keys.edge(app.get_viewport(), KEY_B)
	_check(app.get("_nav_index") == 1, "digital B advances manually")
	Keys.edge(app.get_viewport(), KEY_C)
	_check(app.get("_nav_route") == "", "digital C clears")
	Keys.edge(app.get_viewport(), KEY_N)
	_check(app.get("_nav_route") == "harbor", "digital N selects public route")
	var event := InputEventKey.new()
	event.keycode = KEY_N
	event.pressed = true
	app.call("_input", event)
	var held: String = app.get("_nav_route")
	app.call("_on_focus_exited")
	app.call("_input", event)
	app.call("_on_pause_requested")
	app.call("_input", event)
	_check(app.get("_nav_route") == held and sim.snapshot() == snapshot, "focus pause retains route but held N cannot reactivate")
	event.pressed = false
	app.call("_input", event)
	Keys.edge(app.get_viewport(), KEY_N)
	_check(app.get("_nav_route") != held and FileAccess.get_file_as_bytes(path) == saved, "release rearms without persistent action")
	app.call("_on_navigation_action", "select", "reef-0-1")
	app.call("_on_pause_requested")
	for key: Key in [KEY_N, KEY_B, KEY_C]:
		Keys.edge(app.get_viewport(), key)
	for action: String in ["cycle", "advance", "clear", "select"]:
		app.call("_on_navigation_action", action, "harbor")
	_check(app.get("_nav_route") == "reef-0-1" and app.get("_nav_index") == 0 and sim.snapshot() == snapshot and FileAccess.get_file_as_bytes(path) == saved, "paused digital and native navigation are inert for every action")
	app.call("_on_pause_requested")
	# Natural public detour from the actual paid chart start. Continuous Pilot
	# supplies legal throttle/steer, not keyboard quantization or human driving.
	app.call("_on_navigation_action", "select", "reef-0-1")
	var goal: Vector2 = Nav.project(sim.snapshot(), "reef-0-1", 0).point
	var reached := false
	var samples := 0
	var agree := true
	var model_agree := true
	for tick in range(1, 4501):
		var view: Dictionary = sim.snapshot()
		var controls: Dictionary = Pilot._pilot(view, goal, 5.0, 1)
		app.call("_advance_simulation", DT, controls)
		view = sim.snapshot()
		model_agree = model_agree and oracle.step(DT, controls) == view
		if tick % 30 == 0:
			app.call("_publish", 0.0)
			var projected: Dictionary = hud.get("_radar").get("_snapshot").navigation
			var offset := goal - Vector2(view.position)
			agree = agree and absf(projected.distance_m - offset.length()) < 0.000001 and absf(projected.bearing_degrees - fposmod(rad_to_deg(atan2(offset.x, -offset.y)), 360.0)) < 0.000001
			samples += 1
		if view.position.distance_to(goal) <= Nav.NEAR_METERS:
			reached = true
			print("APP PUBLIC DETOUR tick=%d time=%.2f range=%.3f hull=%.2f battery=%.2f samples=%d" % [tick, view.time, view.position.distance_to(goal), view.hull, view.battery, samples])
			break
		if view.phase == "failed":
			break
	_check(reached and agree and model_agree and samples > 10 and app.get("_nav_index") == 0, "natural detour matches independent sim and public snapshots; arrival never advances or completes sample")
	_check(FileAccess.get_file_as_bytes(path) == saved and not sim.snapshot().scanned and sim.snapshot().tide_survey.completed == 0, "navigation detour not mission completion or save")
	app.call("_on_pause_requested")
	_press(app, "abandon")
	_press(app, "confirm")
	_check(app.get("screen") == "dock" and app.get("_nav_route") == "", "actual abandon and return dock clear route")
	_press(app, "desk")
	app.call("_on_start_requested")
	Keys.edge(app.get_viewport(), KEY_N)
	event.pressed = true
	app.call("_input", event)
	app.call("_on_restart_requested")
	app.call("_input", event)
	_check(app.get("_nav_route") == "", "quickplay restart clears navigation")
	event.pressed = false
	app.call("_input", event)
	Keys.edge(app.get_viewport(), KEY_N)
	app.call("_on_pause_requested")
	app.call("_on_briefing_requested")
	app.call("_on_contract_selected", "needle-bank")
	_check(app.get("_nav_route") == "" and sim.contract_id == "needle-bank", "quick contract rebuild has no stale route")
	# Real quickplay terminal paths: no phase/time/position injection.
	app.call("_on_start_requested")
	Keys.edge(app.get_viewport(), KEY_N)
	var metrics := await _sail(app)
	_check(metrics.view.phase == "success" and app.get("_nav_route") == "", "natural quick delivery clears navigation on success")
	app.call("_on_restart_requested")
	Keys.edge(app.get_viewport(), KEY_N)
	for tick in range(14000):
		app.call("_advance_simulation", DT, {})
		if app.get("screen") == "debrief":
			break
	_check(sim.snapshot().phase == "failed" and app.get("_nav_route") == "", "real idle failure clears navigation")
	_check(_record_bytes() == _original_records and Keys.all_released(), "navigation and terminal tests preserve all four superior score bytes and release keys")
	await _close(app)
	_clean_fixtures()
	print("Stormline public navigation app: %d checks, %d failures; native controls, synthetic edges and continuous-input detour; NOT human play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)
