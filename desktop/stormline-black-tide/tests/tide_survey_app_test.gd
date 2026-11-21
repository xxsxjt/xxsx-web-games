extends "res://tests/expedition_app_test.gd"
## Reuses formal scene, storage, geometry and input evidence helpers, not fake states.
const TideDriver = preload("res://tests/tide_survey_driver.gd")
const CHART_ROUTE := ["black-tide-chart-safe", "black-tide-recovery-safe", "needle-bank-chart-high",
	"needle-bank-recovery-safe", "cross-current-chart-safe", "cross-current-recovery-safe"]
var _station_samples := 0


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/tide-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_folder) != OK:
		quit(1)
		return
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST,
				"seed isolated best/backup for " + id)
	_original_records = _record_bytes()
	await _chart_campaign(_folder.path_join("drive.json"), ["drive", "sonar"], true)
	await _chart_campaign(_folder.path_join("tow.json"), ["tow", "sonar"], false)
	_check(_delivered == 12 and _station_samples == 12, "two builds each complete all six deployments and all six A/B station samples")
	await _sampled_abandon(_folder.path_join("abandon.json"))
	await _sampled_interrupt(_folder.path_join("interrupt.json"))
	await _sampled_failure(_folder.path_join("failure.json"))
	await _chart_conflict(_folder.path_join("conflict.json"))
	_check(_delivered == 12 and _station_samples == 14, "recovery voyage adds two freshly acquired samples without recounting campaign deliveries")
	_check(_original_records == _record_bytes() and Keys.all_released(), "chart voyages never alter quickplay scores/sidecars or leak held keys")
	_clean_fixtures()
	print("Stormline tide app: %d checks, %d failures, %d durable deliveries, %d samples; headless input/scene checks, not human play." % [
		_checks, _failures, _delivered, _station_samples])
	quit(0 if _failures == 0 else 1)


func _pilot_controls(sim, view: Dictionary, cursor: Dictionary) -> Dictionary:
	return TideDriver.controls(sim, view, cursor)


func _chart_campaign(path: String, modules: Array, block_first: bool) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_press(app, "tab_outfit")
	if not _build(app, modules):
		await _close(app)
		return
	for index in CHART_ROUTE.size():
		while float(_state(app).battery) < (70.0 if index < 2 else 90.0):
			if not _service(app, path, "recharge"):
				await _close(app)
				return
		if float(_state(app).hull) < 80.0 and not _service(app, path, "repair"):
			await _close(app)
			return
		var id: String = CHART_ROUTE[index]
		if not _launch(app, path, id):
			await _close(app)
			return
		var active := _state(app).duplicate(true)
		if index % 2 == 0:
			_check(_texts(_desk(app)).is_empty() or app.get("screen") == "running", "active chart does not remain in dock")
			await _geometry(app, "chart start " + id)
		else:
			var contract: Dictionary = app.get("sim").contract
			_check(contract.has("current_scale") and float(contract.current_scale) < 1.0,
				"actual same-sector recovery has saved local-flow benefit: " + id)
		if block_first and index == 0:
			_block_backup(path)
		var metrics := await _sail_chart(app, index % 2 == 0)
		if not _delivery(app, metrics, id):
			await _close(app)
			return
		if block_first and index == 0:
			_check(_state(app) == active and _saved(path) == active and _texts(_desk(app)).contains("缓流时窗未入档"),
				"physically completed chart grants no persisted benefit before save succeeds")
			await _geometry(app, "chart pending result")
			_unblock_backup(path)
			_press(app, "retry_save")
		if not _check_saved_delivery(app, path, active, metrics.view, index + 1):
			await _close(app)
			return
		if index % 2 == 0:
			_check(_texts(_desk(app)).contains("缓流时窗已入档"), "saved chart result distinguishes durable benefit from pending samples")
		_press(app, "dock")
		if index % 2 == 0:
			var persisted := _state(app).duplicate(true)
			await _close(app)
			app = _open(path)
			Keys.edge(app.get_viewport(), KEY_X)
			_check(_state(app) == persisted, "new main reloads chart IDs through unmodified v1 Store")
			_press(app, "continue")
	_check(_state(app).status == "completed" and _state(app).path == CHART_ROUTE and _saved(path) == _state(app),
		"full formal-main six-deployment expedition for " + "+".join(modules))
	await _geometry(app, "completed chart expedition " + "+".join(modules))
	await _close(app)


func _sail_chart(app: Node, inspect: bool = false) -> Dictionary:
	var sim = app.get("sim")
	var start: Dictionary = sim.snapshot()
	var view := start
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var scan := 0
	var attach := 0
	var dock := 0
	var tick := 0
	var samples: Array = []
	var keyboard_ticks := 0
	var keyboard := Keys.new()
	var before_sample_seen := false
	for step in ceili(float(start.deadline) / DT) + 3:
		var input := _pilot_controls(sim, view, cursor)
		var before: Dictionary = view.get("tide_survey", {})
		if inspect and not before.is_empty() and int(before.completed) < 2 and float(before.progress) > 0.05 and keyboard_ticks < 120:
			keyboard.apply(app.get_viewport(), keyboard.quantize(input))
			app.call("_physics_process", DT)
			keyboard_ticks += 1
		else:
			keyboard.release()
			app.call("_advance_simulation", DT, input)
		view = sim.snapshot()
		tick = step + 1
		if inspect and not before_sample_seen and view.has("tide_survey") and float(view.tide_survey.progress) > 0.0:
			before_sample_seen = true
			app.call("_publish", 0.0)
			await _geometry(app, "active tide sample")
			_check(String(app.get("hud").get("_objective").text).contains("<4.0"), "sampling cockpit explicitly shows strict speed boundary")
		if not before.is_empty() and int(view.tide_survey.completed) > int(before.completed):
			samples.append(tick)
			_station_samples += 1
			app.call("_publish", 0.0)
			var chart: Dictionary = app.get("hud").get("_radar").get("_snapshot")
			_check(not view.scanned and not view.tow_attached and chart.tide_survey.completed == view.tide_survey.completed
				and not chart.has("cargo_position"), "ordered sample updates radar without granting capsule lock or revealing hidden pod")
			var markers: Array = app.get("world").get("_station_markers")
			_check(markers.size() == 2 and not markers[0].visible and markers[1].visible == (int(view.tide_survey.completed) == 1),
				"world marker advances A→B→none using the same snapshot")
		if scan == 0 and view.scanned:
			scan = tick
		if attach == 0 and view.tow_attached:
			attach = tick
		dock = dock + 1 if view.dock > 0.0 else 0
		if app.get("screen") != "running":
			break
		if step % 120 == 0:
			app.call("_publish", DT)
		if step % 900 == 0:
			await process_frame
	keyboard.release()
	if start.has("tide_survey"):
		_check(samples.size() == 2 and scan > int(samples.back()) and keyboard_ticks == 120,
			"A/B samples precede capsule lock; 120 ticks use formal key polling including E")
		print("APP TIDE samples=%s E-key ticks=%d t=%.2f battery=%.2f" % [samples, keyboard_ticks, view.time, view.battery])
	return {"view": view, "start": start, "tick": tick, "scan": scan, "attach": attach, "dock": dock}


func _reach_samples(app: Node, target: int) -> Dictionary:
	var sim = app.get("sim")
	var view: Dictionary = sim.snapshot()
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	for tick in 6000:
		app.call("_advance_simulation", DT, _pilot_controls(sim, view, cursor))
		view = sim.snapshot()
		if int(view.tide_survey.completed) >= target or view.phase in ["failed", "success"]:
			break
	_check(int(view.tide_survey.completed) == target and view.phase == "approach", "reach ordered samples by actual controls before failure/withdrawal fixture")
	return view


func _new_chart(path: String) -> Node:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_launch(app, path, CHART_ROUTE[0])
	return app


func _sampled_abandon(path: String) -> void:
	var app := _new_chart(path)
	var sampled := _reach_samples(app, 2)
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	_press(app, "abandon")
	_press(app, "confirm")
	_check(_state(app).path.is_empty() and _saved(path).path.is_empty() and _state(app).battery < sampled.battery,
		"completed samples without delivery are abandoned using actual battery plus rescue loss; no chart benefit")
	_check(not _offer(app, CHART_ROUTE[0]).has("current_scale"), "no discount on next offer after abandonment")
	await _close(app)


func _sampled_interrupt(path: String) -> void:
	var app := _new_chart(path)
	_reach_samples(app, 2)
	var departure := _saved(path).duplicate(true)
	await _close(app)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_press(app, "confirm")
	_check(_state(app).path.is_empty() and _saved(path).path.is_empty() and _state(app).battery == departure.active.battery - State.INTERRUPTED_BATTERY_LOSS,
		"interrupted recovery has no saved final frame or samples and uses departure-register rescue rule")
	await _close(app)


func _sampled_failure(path: String) -> void:
	var app := _new_chart(path)
	_reach_samples(app, 2)
	var metrics := await _sail(app, false)
	_check(metrics.view.phase == "failed" and _state(app).path.is_empty() and _saved(path).path.is_empty(),
		"natural timeout after both samples grants no chart benefit")
	_press(app, "dock")
	while float(_state(app).battery) < 80.0:
		if not _service(app, path, "recharge"):
			break
	_check(_launch(app, path, CHART_ROUTE[0]) and app.get("sim").snapshot().tide_survey.completed == 0,
		"paid redeployment after failure begins fresh samples rather than reusing failed work")
	var metrics_retry := await _sail_chart(app, true)
	_check(metrics_retry.view.phase == "success" and _state(app).path == [CHART_ROUTE[0]],
		"actual failure, paid recovery and new successful chart delivery form a cross-voyage journey")
	await _close(app)


func _chart_conflict(path: String) -> void:
	var app := _new_chart(path)
	_reach_samples(app, 2)
	var other := _open(path)
	Keys.edge(other.get_viewport(), KEY_X)
	_press(other, "continue")
	_press(other, "confirm")
	var winner := _saved(path).duplicate(true)
	var bytes := FileAccess.get_file_as_bytes(path)
	await _close(other)
	var metrics := await _sail(app)
	_check(metrics.view.phase == "success" and not app.get("_pending").is_empty() and _saved(path) == winner
		and winner.path.is_empty() and FileAccess.get_file_as_bytes(path) == bytes and _texts(_desk(app)).contains("缓流时窗未入档"),
		"stale physically delivered chart stays unpaid/unlogged and never overwrites recovered archive")
	_press(app, "reload")
	_press(app, "confirm")
	_check(_state(app) == winner and _saved(path) == winner, "explicit stale result discard cannot grant chart benefit")
	await _close(app)
