extends SceneTree
## Headless composition-root regression for the third contract and its isolated best.
const Sim = preload("res://src/storm_sim.gd")
const MainScene = preload("res://scenes/main.tscn")
const Store = preload("res://src/storm_records.gd")
const Keys = preload("res://tests/needle_keyboard_driver.gd")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const ID := "cross-current"
const ROUTE := "shortcut"
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 220

var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/cross-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		printerr("FAIL: cannot make isolated Cross Current record folder")
		quit(1)
		return
	var primary := folder.path_join("best.json")
	var expansion := primary + ".expansion.json"
	var seeded := Store.new(primary)
	var fixture := {"score": 7200, "time": 95.0, "grade": "A", "hull": 98.0, "peak_tension": 0.48}
	_check(seeded.record("black-tide", fixture) == Store.NEW_BEST
		and seeded.record("needle-bank", fixture) == Store.NEW_BEST, "seed both original bests in an isolated v1 store")
	var primary_bytes := FileAccess.get_file_as_bytes(primary)
	var backup_bytes := FileAccess.get_file_as_bytes(primary + ".bak")
	var app := _open_app(primary)
	var hud: CanvasLayer = app.get("hud")
	var sim: Sim = app.get("sim")
	var world: Node3D = app.get("world")
	var route_name: String = Sim.CONTRACTS[ID].name
	var buttons: Dictionary = hud.get("_contract_cards")
	_check(app.get("screen") == "briefing" and sim.contract_id == "black-tide"
		and buttons.keys() == Sim.CONTRACTS.keys(), "initial briefing has every contract and keeps the original default")
	Keys.edge(root, KEY_3)
	_check(sim.contract_id == ID and app.get("selected_contract") == ID and world.get("_contract").id == ID
		and world.get("_view").contract_id == ID and hud.get("_brief_name").text == route_name
		and buttons[ID].button.text.begins_with("03"), "briefing key 3 updates model, world, card and selected dossier together")
	buttons["needle-bank"].button.pressed.emit()
	_check(sim.contract_id == "needle-bank" and hud.get("_contract_id") == "needle-bank", "original contract button stays wired")
	buttons[ID].button.pressed.emit()
	_check(sim.contract_id == ID and hud.get("_contract_id") == ID, "third contract button follows the same production path")
	Keys.edge(root, KEY_ENTER)
	Keys.edge(root, KEY_2)
	_check(app.get("screen") == "running" and sim.contract_id == ID and sim.power_profile == 1,
		"during flight key 2 changes power, not contracts")
	Keys.edge(root, KEY_SPACE)
	Keys.edge(root, KEY_P)
	_check(app.get("screen") == "paused" and not app.get("_tow_queued"), "pausing clears queued attachment")
	Keys.edge(root, KEY_ENTER)
	_check(app.get("screen") == "briefing" and sim.contract_id == ID and sim.mission_time == 0.0
		and not FileAccess.file_exists(expansion), "abandon returns to the same contract without recording anything")
	Keys.edge(root, KEY_ENTER)
	var voyage := await _voyage(app)
	var report: Dictionary = sim.report
	_check(voyage.get("success", false) and app.get("screen") == "debrief" and sim.phase == "success",
		"a natural voyage reaches the real debrief without altering production simulation state")
	_check(hud.get("_screen") == "debrief" and hud.get("_result_subtitle").text == route_name
		and hud.get("_result_score").text == str(report.get("score", -1))
		and world.get("_view").phase == "success" and app.get("_record_status") == Store.NEW_BEST,
		"the terminal frame already shows third-contract stats and the saved-best result")
	var sidecar_bytes := FileAccess.get_file_as_bytes(expansion) if FileAccess.file_exists(expansion) else PackedByteArray()
	var all_bests: Dictionary = Store.new(primary).records
	_check(all_bests.size() == 3 and all_bests.get(ID, {}).get("score", -1) == report.get("score", -2),
		"the third contract's actual delivered score reloads alongside both old bests")
	_check(not sidecar_bytes.is_empty() and FileAccess.get_file_as_bytes(primary) == primary_bytes
		and FileAccess.get_file_as_bytes(primary + ".bak") == backup_bytes,
		"new-contract write leaves the old v1 primary and backup byte-for-byte intact")
	print("APP cross_current/delivery: %s" % str(voyage))
	Keys.edge(root, KEY_R)
	_check(app.get("screen") == "running" and sim.contract_id == ID and sim.mission_time == 0.0
		and sim.report.is_empty() and app.get("_record_status") == "", "debrief restart starts a clean run of the same contract")
	for tick in range(MAX_TICKS):
		app.call("_physics_process", DT)
		if app.get("screen") != "running":
			break
	_check(app.get("screen") == "debrief" and sim.phase == "failed" and sim.report.is_empty()
		and hud.get("_result_score").text == "—" and app.get("_record_status") == "",
		"an unattended failed retry reports no score on its first debrief frame")
	_check(FileAccess.get_file_as_bytes(primary) == primary_bytes and FileAccess.get_file_as_bytes(primary + ".bak") == backup_bytes
		and not sidecar_bytes.is_empty() and FileAccess.get_file_as_bytes(expansion) == sidecar_bytes,
		"failed retry touches neither scores partition")
	Keys.edge(root, KEY_ENTER)
	_check(app.get("screen") == "briefing" and hud.get("_brief_name").text == route_name
		and hud.get("_brief_best").text.contains(str(report.get("score", -1))), "return to briefing immediately shows the persisted new best")
	app.queue_free()
	await process_frame
	var reopened := _open_app(primary)
	_check(reopened.get("records").records == all_bests and reopened.get("screen") == "briefing",
		"a fresh application scene loads all bests without resuming the old run")
	reopened.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		_check(DirAccess.remove_absolute(folder.path_join(name)) == OK, "remove isolated fixture " + name)
	_check(DirAccess.remove_absolute(folder) == OK, "remove this run's private test folder")
	print("Stormline Cross Current app: %d checks, %d failures; isolated headless app only." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _open_app(file_path: String) -> Node:
	var app := MainScene.instantiate()
	app.set("records_file", file_path)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	return app


func _voyage(app: Node) -> Dictionary:
	var sim: Sim = app.get("sim")
	var model := Sim.new()
	model.reset(ID)
	var leg := "outbound"
	var route_index := 0
	var last_tow_input := false
	var scan_tick := 0
	var tow_tick := 0
	var matching := true
	for tick in range(1, MAX_TICKS + 1):
		if leg == "outbound" and sim.scanned:
			leg = "cargo"
			route_index = 0
		if leg == "cargo" and sim.tow_attached:
			leg = "return"
			route_index = 0
		if leg != "cargo":
			route_index = Pilot.route_index_for(sim.snapshot(), leg, route_index, ROUTE)
		var controls := Pilot.controls_for(sim, leg, route_index, last_tow_input, ROUTE)
		last_tow_input = bool(controls.get("tow_pressed", false))
		app.call("_advance_simulation", DT, controls)
		model.step(DT, controls)
		var after: Dictionary = sim.snapshot()
		matching = matching and after == model.snapshot()
		if scan_tick == 0 and after.scanned:
			scan_tick = tick
		if tow_tick == 0 and after.tow_attached:
			tow_tick = tick
		if app.get("screen") != "running":
			return {"success": sim.phase == "success" and matching and scan_tick > 0 and tow_tick > scan_tick,
				"phase": sim.phase, "ticks": tick, "scan_tick": scan_tick, "tow_tick": tow_tick,
				"model_tickwise_match": matching, "reason": after.fail_reason}
		if tick % 30 == 0:
			app.call("_publish", DT * 30.0)
		if tick % 600 == 0:
			await process_frame
	return {"success": false, "reason": "pilot exhausted the test tick limit"}


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
