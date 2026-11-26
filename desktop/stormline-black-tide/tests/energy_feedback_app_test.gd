extends "res://tests/damage_control_app_test.gd"
## Input-only natural impact, matched decision checkpoint, real HUD and Store.
## No model/resource writes. These fixed strategies do not establish an optimum.
var _energy_report := {"cases": [], "human_playtested": false,
	"scope": "Fixed input program comparison; not optimal strategies or human balance evidence."}
var _checkpoint: Dictionary = {}


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/energy-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	_check(DirAccess.make_dir_recursive_absolute(_folder) == OK, "isolated energy-app directory")
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST,
				"seed isolated quickplay scores and sidecars")
	_original_records = _record_bytes()
	for strategy: String in ["none", "pump", "seal"]:
		await _strategy(_folder.path_join(strategy + ".json"), strategy)
	_check(_energy_report.cases.size() == 3 and Keys.all_released() and not Input.is_key_pressed(KEY_H), "three matched voyages and no leaked keys")
	_check(_record_bytes() == _original_records, "energy feedback never writes quickplay scores")
	if _energy_report.cases.size() == 3:
		var untreated: Dictionary = _energy_report.cases[0].terminal
		var pumped: Dictionary = _energy_report.cases[1].terminal
		var sealed: Dictionary = _energy_report.cases[2].terminal
		_check(untreated.phase == "failed" and pumped.phase == "success" and sealed.phase == "success",
			"fixed input comparison: untreated fails, pump and seal deliver")
		_check(untreated.energy_budget.spent.pump == 0.0 and pumped.energy_budget.spent.pump > sealed.energy_budget.spent.pump
			and sealed.energy_budget.spent.pump > 0.0 and untreated.damage_control.kits == 2
			and pumped.damage_control.kits == 2 and sealed.damage_control.kits == 1,
			"fixed input comparison retains measured pump cost and actual one-kit tradeoff")
	_clean_fixtures()
	var report_path := "res://build/energy-feedback-app-%d.json" % OS.get_process_id()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://build"))
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if _check(file != null, "write strategy evidence"):
		_energy_report["checks"] = _checks
		_energy_report["failures"] = _failures
		file.store_string(JSON.stringify(_energy_report, "  ", true, true) + "\n")
		file.close()
	print("Stormline energy feedback app: %d checks, %d failures; evidence %s; input-only strategy fixtures, NOT human play." % [_checks, _failures, report_path])
	quit(0 if _failures == 0 else 1)


func _strategy(path: String, strategy: String) -> void:
	var app := _new_damage(path)
	_service(app, path, "prepare_kit")
	_service(app, path, "prepare_kit")
	if not _launch(app, path, "black-tide-survey-safe"):
		await _close(app)
		return
	var active := _state(app).duplicate(true)
	var sim = app.get("sim")
	var view: Dictionary = sim.snapshot()
	_check(view.energy_budget.spent.total == 0 and view.energy_budget.rate.total == 0, "fresh real launch has zero history")
	var reef: Dictionary = sim.contract.hazards.back()
	for tick in 1800:
		app.call("_advance_simulation", DT, Pilot._pilot(view, reef.position, 6.0, 1))
		view = sim.snapshot()
		if view.hull < active.hull or view.phase == "failed":
			break
	if not _check(view.hull < active.hull and view.damage_control.breach > 0 and view.phase != "failed", strategy + " real steering impact"):
		await _close(app)
		return
	for tick in 360:
		app.call("_advance_simulation", DT, {"power": 1, "throttle": -0.6 if tick < 90 else 0.0})
	view = sim.snapshot()
	var checkpoint := {}
	for key: String in ["time", "position", "velocity", "heading", "battery", "hull", "damage_control", "energy_budget"]:
		checkpoint[key] = view[key]
	if _checkpoint.is_empty():
		_checkpoint = checkpoint.duplicate(true)
	_check(checkpoint == _checkpoint, strategy + " identical natural impact and pre-decision checkpoint")
	print("APP ENERGY CHECKPOINT strategy=%s t=%.6f battery=%.6f water=%.6f breach=%.6f kits=%d" % [
		strategy, checkpoint.time, checkpoint.battery, checkpoint.damage_control.water,
		checkpoint.damage_control.breach, checkpoint.damage_control.kits])
	# All cases wait the same eleven seconds. Pump and patch use actual G/H polling.
	if strategy != "none":
		Keys.edge(app.get_viewport(), KEY_G)
	for tick in 660:
		_hold(KEY_H, strategy == "seal" and (tick < 300 or (tick >= 301 and tick < 601)))
		app.call("_physics_process", DT)
	_hold(KEY_H, false)
	if strategy == "seal":
		Keys.edge(app.get_viewport(), KEY_G)
		# Queued switch takes effect on the next real simulation tick.
		app.call("_physics_process", DT)
	else:
		app.call("_physics_process", DT)
	var decision: Dictionary = sim.snapshot()
	_check(decision.phase == "approach" and _saved(path) == active, strategy + " no mid-flight archive mutation")
	_check(absf(float(decision.time) - float(checkpoint.time) - 661.0 * DT) < 1e-8,
		strategy + " same 661-tick response window")
	_check(_balanced(decision, float(active.battery)) and decision.damage_control.pump_on == (strategy == "pump"),
		strategy + " response账 balances and real G reaches intended pump state")
	if strategy == "seal":
		_check(decision.damage_control.kits == 1 and decision.damage_control.patches_used == 1
			and decision.damage_control.sealed == decision.damage_control.breach
			and decision.hull <= float(checkpoint.hull) and not decision.damage_control.pump_on,
			"one completed real H hold seals the sub-unit breach without healing and G pump is switched off")
	app.call("_publish", 0.0)
	_check(_energy_hud_matches(app, decision), strategy + " cockpit uses exact last-step rate")
	await _geometry(app, strategy + " energy cockpit")
	Keys.edge(app.get_viewport(), KEY_P)
	_check(_texts(_desk(app)).contains("上一步耗电 %.3f 点/秒" % float(decision.energy_budget.rate.total))
		and _texts(_desk(app)).contains("本航实耗 %.3f 电量点" % float(decision.energy_budget.spent.total)),
		strategy + " paused live device breakdown and actual voyage spend")
	for delta: float in [0.0, DT, 2.0, 60.0]:
		app.call("_advance_simulation", delta, {"throttle": 1.0, "pump_pressed": true})
		app.call("_publish", delta)
		app.call("_physics_process", delta)
	_check(sim.snapshot() == decision and _saved(path) == active, strategy + " pause/repaint cannot consume or save energy")
	await _geometry(app, strategy + " energy pause")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var balanced := true
	var published := true
	var dock_ticks := 0
	var dock_measured := false
	var scan_tick := 0
	var tow_tick := 0
	for tick in 12000:
		view = sim.snapshot()
		var controls := _pilot_controls(sim, view, cursor)
		app.call("_advance_simulation", DT, controls)
		view = sim.snapshot()
		balanced = balanced and _balanced(view, float(active.battery))
		if scan_tick == 0 and view.scanned:
			scan_tick = tick + 1
		if tow_tick == 0 and view.tow_attached:
			tow_tick = tick + 1
		dock_ticks = dock_ticks + 1 if view.dock > 0.0 else 0
		if app.get("screen") != "running":
			break
		if tick % 120 == 0:
			app.call("_publish", 0.0)
			published = published and _energy_hud_matches(app, view)
		if not dock_measured and view.dock > 0.0:
			dock_measured = true
			app.call("_publish", 0.0)
			await _geometry(app, strategy + " energy docking")
		if tick % 900 == 0:
			await process_frame
	var terminal: Dictionary = sim.snapshot()
	_check(balanced and published, strategy + " every navigation tick账 matches battery and live sampled HUD")
	_check(terminal.phase in ["success", "failed"] and not app.get("_pending").has("change"), strategy + " terminal settles through formal Store")
	_check(terminal.phase != "success" or dock_ticks >= 60, strategy + " delivery retains 60-tick docking gate")
	_check(terminal.phase != "success" or (scan_tick > 0 and tow_tick > scan_tick and dock_measured),
		strategy + " successful return preserves ordered scan, tow and docking")
	_check(_saved(path) == _state(app) and not _saved(path).has("energy_budget"), strategy + " energy账 is not a persistent field")
	_check(_texts(_desk(app)).contains("本航实耗 %.3f 电量点" % float(terminal.energy_budget.spent.total)), strategy + " terminal page shows actual consumed total")
	await _geometry(app, strategy + " energy result")
	app.call("_advance_simulation", 60.0, {"throttle": 1.0})
	app.call("_publish", 60.0)
	_check(sim.snapshot() == terminal, strategy + " terminal repaint freezes账")
	_energy_report.cases.append({"strategy": strategy, "checkpoint": checkpoint, "decision": decision,
		"terminal": terminal, "saved": _state(app).duplicate(true), "dock_ticks": dock_ticks,
		"scan_tick": scan_tick, "tow_tick": tow_tick, "checkpoint_identical": checkpoint == _checkpoint,
		"response_ticks": 661})
	print("APP ENERGY strategy=%s phase=%s t=%.2f battery=%.6f water=%.3f flood_spend=%.6f pump_spend=%.6f kits=%d" % [
		strategy, terminal.phase, terminal.time, terminal.battery, terminal.damage_control.water,
		terminal.energy_budget.spent.flood, terminal.energy_budget.spent.pump, terminal.damage_control.kits])
	await _close(app)
	# Read the archive in a fresh main; the settled resource facts persist, not账.
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	if _state(app).status == "dock":
		_service(app, path, "repair")
		_service(app, path, "recharge")
		var next_offer := "black-tide-recovery-safe" if _state(app).path.size() == 1 else "black-tide-survey-safe"
		if _launch(app, path, next_offer):
			var fresh: Dictionary = app.get("sim").snapshot()
			_check(fresh.energy_budget.spent.total == 0 and fresh.energy_budget.rate.total == 0, strategy + " fresh main/new paid voyage starts new账")
	await _close(app)


func _energy_hud_matches(app: Node, view: Dictionary) -> bool:
	var rate: Dictionary = view.energy_budget.rate
	return app.get("hud").get("_energy_status").text == "上步耗电 %.2f/s\n含进水 +%.2f · 水泵 %.2f" % [float(rate.total), float(rate.flood), float(rate.pump)]


func _balanced(view: Dictionary, initial: float) -> bool:
	var rate_sum := 0.0
	var spent_sum := 0.0
	for key: String in ["idle", "propulsion", "flood", "sonar", "tow", "pump"]:
		rate_sum += float(view.energy_budget.rate[key])
		spent_sum += float(view.energy_budget.spent[key])
	return absf(rate_sum - view.energy_budget.rate.total) < 1e-10 \
		and absf(spent_sum - view.energy_budget.spent.total) < 1e-8 \
		and absf(initial - view.battery - view.energy_budget.spent.total) < 1e-8
