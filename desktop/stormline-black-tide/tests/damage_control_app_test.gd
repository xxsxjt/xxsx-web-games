extends "res://tests/expedition_app_test.gd"
## Natural collision and full digital-key campaigns through formal main + Store.
## Never assigns simulator, campaign, or archived resource fields during journeys.
const Damage = preload("res://src/damage_control.gd")
const Navigator = preload("res://tests/tide_survey_driver.gd")
const ROUTE := ["black-tide-chart-safe", "black-tide-recovery-safe", "needle-bank-chart-high",
	"needle-bank-recovery-safe", "cross-current-chart-safe", "cross-current-recovery-safe"]
var _report := {"campaigns": [], "damage_journey": {}, "digital_deliveries": 0}


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/damage-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_folder) != OK:
		quit(1)
		return
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST, "seed isolated score")
	_original_records = _record_bytes()
	await _legacy_enable(_folder.path_join("legacy.json"))
	await _damage_journey(_folder.path_join("damage.json"))
	await _digital_campaign(_folder.path_join("drive.json"), ["drive", "sonar"])
	await _digital_campaign(_folder.path_join("tow.json"), ["tow", "sonar"])
	await _interrupted_kits(_folder.path_join("interrupt.json"))
	await _enable_conflict(_folder.path_join("conflict.json"))
	await _bad_extension(_folder.path_join("bad-extension.json"))
	_check(_report.digital_deliveries == 12 and Keys.all_released() and not Input.is_key_pressed(KEY_H), "twelve digital deliveries and no leaked keys")
	_check(_record_bytes() == _original_records, "quick scores and both sidecars byte-identical")
	_report["checks"] = _checks
	_report["failures"] = _failures
	_report["human_playtested"] = false
	var report_path := "res://build/damage-control-app-%d.json" % OS.get_process_id()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://build"))
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(_report, "  ", true, true) + "\n")
		file.close()
	else:
		_check(false, "write isolated journey evidence")
	_clean_fixtures()
	print("Stormline damage-control app: %d checks, %d failures; 12 digital-key deliveries; evidence %s; NOT human play." % [_checks, _failures, report_path])
	quit(0 if _failures == 0 else 1)


func _new_damage(path: String) -> Node:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_check(_state(app).has("damage_control") and _state(app).damage_control == Damage.fresh() and _saved(path) == _state(app), "UI creates explicit damage-control archive")
	return app


func _legacy_enable(path: String) -> void:
	# A deliberate old-format storage fixture; opening must not migrate it.
	var store := Store.new(path)
	store.load_state()
	_check(store.save_state(State.new_campaign(), -1).ok, "seed old exact v1 archive")
	var bytes := FileAccess.get_file_as_bytes(path)
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_press(app, "tab_outfit")
	_check(not _state(app).has("damage_control") and FileAccess.get_file_as_bytes(path) == bytes, "legacy read/continue/outfit preserve exact bytes and old rules")
	_press(app, "enable_damage")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	_check(not _state(app).has("damage_control") and FileAccess.get_file_as_bytes(path) == bytes, "cancel enable never writes")
	_press(app, "enable_damage")
	_block_backup(path)
	_press(app, "confirm")
	_check(not _state(app).has("damage_control") and FileAccess.get_file_as_bytes(path) == bytes, "failed extension write keeps legacy shape")
	_unblock_backup(path)
	_press(app, "enable_damage")
	_press(app, "confirm")
	_check(_state(app).damage_control == Damage.fresh() and _saved(path + ".bak").has("damage_control") == false, "confirmed upgrade saved with original legacy backup")
	_press(app, "tab_outfit")
	await _geometry(app, "damage controls outfitting")
	await _close(app)


func _damage_journey(path: String) -> void:
	var app := _new_damage(path)
	_press(app, "tab_outfit")
	_service(app, path, "prepare_kit")
	_service(app, path, "prepare_kit")
	_check(_button(app, "prepare_kit").disabled, "native UI enforces kit ceiling")
	if not _launch(app, path, "black-tide-survey-safe"):
		await _close(app)
		return
	var active := _state(app).duplicate(true)
	var sim = app.get("sim")
	var view: Dictionary = sim.snapshot()
	var reef: Dictionary = sim.contract.hazards.back()
	# Continuous Pilot input for the intentional collision, not field injection.
	for tick in 1800:
		app.call("_advance_simulation", DT, Pilot._pilot(view, reef.position, 6.0, 1))
		view = sim.snapshot()
		if view.hull < active.hull or view.phase == "failed":
			break
	if not _check(view.hull < active.hull and view.damage_control.breach > 0 and app.get("screen") == "running", "charted reef creates real hull loss AND persistent breach by steering"):
		await _close(app)
		return
	var hit := view.duplicate(true)
	# Back out along the incoming heading, then coast; no position/velocity writes.
	for tick in 180:
		app.call("_advance_simulation", DT, {"power": 1, "throttle": -0.6 if tick < 90 else 0.0})
	view = sim.snapshot()
	for tick in 180:
		app.call("_advance_simulation", DT, {"power": 1})
	view = sim.snapshot()
	_check(view.damage_control.water > 0 and view.hull <= hit.hull and view.damage_control.kits == 2, "untreated real breach fills water without phantom kit use")
	app.call("_publish", 0.0)
	await _geometry(app, "damaged cockpit before response")
	var wet: Dictionary = view.duplicate(true)
	# G is an actual queued input edge. No operating-system key events.
	Keys.edge(app.get_viewport(), KEY_G)
	app.call("_physics_process", DT)
	for tick in 90:
		app.call("_physics_process", DT)
	var pumped: Dictionary = sim.snapshot()
	_check(pumped.damage_control.pump_on and pumped.damage_control.water < wet.damage_control.water
		and pumped.battery < wet.battery and pumped.damage_control.pump_draw == Damage.PUMP_DRAW, "real G toggles costly pump, original physics drains measured water")
	# Work must be continuous: releasing H aborts the first attempt for free.
	_hold(KEY_H, true)
	for tick in 90:
		app.call("_physics_process", DT)
	var partial: Dictionary = sim.snapshot()
	_hold(KEY_H, false)
	app.call("_physics_process", DT)
	_check(partial.damage_control.patch_progress > 0 and sim.snapshot().damage_control.patch_progress == 0
		and sim.snapshot().damage_control.kits == 2, "real partial H hold then release discards work but not kit")
	_hold(KEY_H, true)
	for tick in 300:
		app.call("_physics_process", DT)
	_hold(KEY_H, false)
	view = sim.snapshot()
	if not _check(view.damage_control.kits == 1 and view.damage_control.patches_used == 1 and view.damage_control.sealed > 0
		and view.damage_control.breach >= wet.damage_control.breach and view.hull == wet.hull, "real 300 H ticks consume one kit; temporary patch cannot heal hull/structure"):
		await _close(app)
		return
	var patched := view.duplicate(true)
	Keys.edge(app.get_viewport(), KEY_G)
	app.call("_physics_process", DT)
	Keys.edge(app.get_viewport(), KEY_P)
	var paused: Dictionary = sim.snapshot()
	Keys.edge(app.get_viewport(), KEY_G)
	_hold(KEY_H, true)
	for tick in 60:
		app.call("_physics_process", DT)
	_hold(KEY_H, false)
	_check(sim.snapshot() == paused and _saved(path) == active, "paused G/H cannot progress, consume or save physics frames")
	await _geometry(app, "damaged paused controls")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	# The original Pilot continues the real damaged vessel to scan/tow/dock.
	_block_backup(path)
	var metrics := await _sail(app)
	var terminal: Dictionary = metrics.view
	if not _check(terminal.phase == "success" and metrics.dock >= 60 and terminal.damage_control.kits == 1
		and terminal.damage_control.breach >= patched.damage_control.breach, "damaged, temporarily patched ship naturally completes original docking gates"):
		print("DAMAGE journey failure: " + str(terminal))
		_unblock_backup(path)
		await _close(app)
		return
	_check(_saved(path) == active and _state(app) == active and app.get("_pending").has("change"), "failed settlement does not pay or save kit refund")
	_press(app, "retry_save")
	_check(_saved(path) == active, "repeat failed settlement keeps original departure")
	_unblock_backup(path)
	_press(app, "retry_save")
	var settled := _state(app).duplicate(true)
	_check(settled.path.size() == 1 and settled.damage_control.kits == 1
		and is_equal_approx(settled.damage_control.breach, terminal.damage_control.breach) and _saved(path) == settled,
		"retry submits same one-time result; breach and unused kit persist")
	await _geometry(app, "damaged result")
	_press(app, "dock")
	await _close(app)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	# Depart without repair, proving the seal is not a free persistent repair.
	if not _launch(app, path, "black-tide-recovery-safe"):
		await _close(app)
		return
	sim = app.get("sim")
	var relaunched: Dictionary = sim.snapshot()
	_check(relaunched.damage_control.breach == settled.damage_control.breach and relaunched.damage_control.kits == 1
		and relaunched.damage_control.sealed == 0 and relaunched.damage_control.water == 0, "fresh main + paid next departure preserves breach, removes temporary seal, starts dry")
	for tick in 120:
		app.call("_physics_process", DT)
	var leaking_again: Dictionary = sim.snapshot()
	_check(leaking_again.damage_control.water > 0 and leaking_again.damage_control.inflow > 0, "unrepaired next voyage really leaks again")
	Keys.edge(app.get_viewport(), KEY_P)
	_press(app, "abandon")
	_press(app, "confirm")
	var abandoned := _state(app).duplicate(true)
	_check(abandoned.path.size() == 1 and abandoned.damage_control.kits == 1
		and is_equal_approx(abandoned.damage_control.breach, leaking_again.damage_control.breach), "real abandoned snapshot preserves actual breach and unused pack without reward")
	_service(app, path, "repair")
	var repaired := _state(app).duplicate(true)
	_check(repaired.damage_control.breach < abandoned.damage_control.breach and repaired.parts == abandoned.parts - 1
		and repaired.credits == abandoned.credits - State.REPAIR_COST and repaired.pressure == abandoned.pressure + 1, "actual dock repair spends money/material/time and fixes structure")
	_service(app, path, "unload_kit")
	_check(_state(app).parts == repaired.parts + 1 and _state(app).damage_control.kits == 0, "unused real kit can be unloaded, not duplicated")
	_report.damage_journey = {"hit": hit, "uncontrolled": wet, "pumped": pumped, "patched": patched,
		"terminal": terminal, "settled": settled, "relaunched": relaunched, "leaking_again": leaking_again, "repaired": repaired}
	print("APP DAMAGE hit t=%.2f breach=%.3f; pump water %.3f→%.3f; patch kits 2→1; delivered=%.2fs; next water=%.3f; repair breach %.3f→%.3f" % [hit.time, hit.damage_control.breach,
		wet.damage_control.water, pumped.damage_control.water, terminal.time, leaking_again.damage_control.water, abandoned.damage_control.breach, repaired.damage_control.breach])
	await _close(app)


func _digital_campaign(path: String, modules: Array) -> void:
	var app := _new_damage(path)
	_press(app, "tab_outfit")
	_build(app, modules)
	_service(app, path, "prepare_kit")
	var campaign := {"build": modules, "legs": []}
	for index in ROUTE.size():
		while float(_state(app).battery) < (70.0 if index < 2 else 90.0):
			if not _service(app, path, "recharge"):
				await _close(app)
				return
		if not _launch(app, path, ROUTE[index]):
			await _close(app)
			return
		var departure := _state(app).duplicate(true)
		var sim = app.get("sim")
		var reference := Sim.new()
		_check(reference.reset_expedition(State.launch_spec(departure)), "reference accepts exact durable departure")
		var driver := Keys.new()
		var view: Dictionary = sim.snapshot()
		var cursor := {"stage": "outbound", "index": 0, "tow": false}
		var mismatch := 0
		var dock := 0
		var samples := 0
		var ticks := 0
		var scan_tick := 0
		var tow_tick := 0
		for tick in ceili(float(view.deadline) / DT) + 3:
			var digital := driver.quantize(Navigator.controls(sim, view, cursor))
			driver.apply(app.get_viewport(), digital)
			app.call("_physics_process", DT)
			var before := view
			view = sim.snapshot()
			if reference.step(DT, digital) != view and mismatch == 0:
				mismatch = tick + 1
			if view.has("tide_survey") and view.tide_survey.completed > before.tide_survey.completed:
				samples += 1
			if view.scanned and scan_tick == 0:
				scan_tick = tick + 1
			if view.tow_attached and tow_tick == 0:
				tow_tick = tick + 1
			dock = dock + 1 if view.dock > 0 else 0
			ticks = tick + 1
			if app.get("screen") != "running":
				break
			if tick % 120 == 0:
				app.call("_publish", DT)
			if tick % 1800 == 0:
				await process_frame
		driver.release()
		_check(mismatch == 0 and view.phase == "success" and dock == 60 and scan_tick > 0 and tow_tick > scan_tick
			and samples == (2 if index % 2 == 0 else 0), "every digital tick matches reference, ordered samples + scan/tow/double-hull delivery")
		_check(_saved(path) == _state(app) and _state(app).path.size() == index + 1 and _state(app).damage_control.kits == 1,
			"each digital delivery is durable; intact unused kit conserved")
		campaign.legs.append({"offer": ROUTE[index], "ticks": ticks, "samples": samples, "dock_ticks": dock, "reference_mismatch": mismatch,
			"scan_tick": scan_tick, "tow_tick": tow_tick, "terminal": view, "saved": _state(app).duplicate(true)})
		print("APP DAMAGE DIGITAL %s %s ticks=%d phase=%s battery=%.4f breach=%.4f samples=%d" % ["+".join(modules), ROUTE[index], ticks, view.phase, view.battery, view.damage_control.breach, samples])
		if view.phase != "success":
			await _close(app)
			return
		_report.digital_deliveries += 1
		_press(app, "dock")
		var durable := _state(app).duplicate(true)
		await _close(app)
		app = _open(path)
		Keys.edge(app.get_viewport(), KEY_X)
		_press(app, "continue")
		_check(_state(app) == durable and _saved(path) == durable, "fresh main reloads each digital leg without bonus or migration")
	_check(_state(app).status == "completed" and _state(app).path == ROUTE, "six-deployment digital expedition complete")
	_report.campaigns.append(campaign)
	await _close(app)


func _interrupted_kits(path: String) -> void:
	var app := _new_damage(path)
	_press(app, "tab_outfit")
	_service(app, path, "prepare_kit")
	_service(app, path, "prepare_kit")
	_launch(app, path, "black-tide-survey-safe")
	var active := _state(app).duplicate(true)
	for tick in 60:
		app.call("_physics_process", DT)
	await _close(app)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_check(_texts(_desk(app)).contains("全部预装"), "interruption explicitly discloses kit loss")
	_press(app, "confirm")
	_check(_saved(path) == _state(app) and _state(app).damage_control.kits == 0
		and is_equal_approx(_state(app).damage_control.breach, 0.35) and _state(app).parts == active.parts,
		"interruption loses kits once, adds rescue breach, no parts returned")
	await _close(app)


func _enable_conflict(path: String) -> void:
	var store := Store.new(path)
	store.load_state()
	_check(store.save_state(State.new_campaign(), -1).ok, "seed old format conflict fixture")
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_press(app, "tab_outfit")
	var other := _open(path)
	Keys.edge(other.get_viewport(), KEY_X)
	_press(other, "continue")
	_press(other, "tab_outfit")
	_press(other, "buy_sonar")
	var bytes := FileAccess.get_file_as_bytes(path)
	_press(app, "enable_damage")
	_press(app, "confirm")
	_check(not _state(app).has("damage_control") and FileAccess.get_file_as_bytes(path) == bytes and app.get("_expedition_conflict"), "stale extension upgrade cannot overwrite newer legacy progress")
	await _close(other)
	await _close(app)


func _bad_extension(path: String) -> void:
	var app := _new_damage(path)
	_press(app, "tab_outfit")
	_service(app, path, "prepare_kit")
	var prior := _saved(path + ".bak").duplicate(true)
	await _close(app)
	var valid_bytes := FileAccess.get_file_as_bytes(path)
	var data: Dictionary = JSON.parse_string(valid_bytes.get_string_from_utf8())
	data.state.damage_control.kits = 3 # Isolated corruption fixture, never a voyage.
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(data))
	file.close()
	var corrupt := FileAccess.get_file_as_bytes(path)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_check(_button(app, "new") == null and _button(app, "restore") != null and FileAccess.get_file_as_bytes(path) == corrupt,
		"malformed extended save rejected without stripping extension or overwriting")
	_press(app, "restore")
	_press(app, "confirm")
	_check(_saved(path) == prior and _state(app) == prior, "explicit recovery loads verified extended backup")
	var quarantine := path + ".corrupt-" + _hash_bytes(corrupt).substr(0, 12)
	_check(FileAccess.file_exists(quarantine) and FileAccess.get_file_as_bytes(quarantine) == corrupt, "exact corrupt extension retained in quarantine")
	await _close(app)


func _hash_bytes(bytes: PackedByteArray) -> String:
	var hash := HashingContext.new()
	hash.start(HashingContext.HASH_SHA256)
	hash.update(bytes)
	return hash.finish().hex_encode()


func _hold(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)
	Input.flush_buffered_events()


func _same_resources(saved: Dictionary, expected: Dictionary) -> bool:
	# Same 1e-9 JSON float roundtrip bound as the base helper, applied only to
	# the newly persisted breach. Identity, ints, kit counts and all keys stay exact.
	var actual := saved.duplicate(true)
	var wanted := expected.duplicate(true)
	if actual.history.size() != wanted.history.size():
		return false
	var left: Array = [actual] + actual.history
	var right: Array = [wanted] + wanted.history
	for index in left.size():
		if left[index].has("damage_control") != right[index].has("damage_control"):
			return false
		if left[index].has("damage_control"):
			if absf(float(left[index].damage_control.breach) - float(right[index].damage_control.breach)) > 1e-9:
				return false
			left[index].damage_control.breach = right[index].damage_control.breach
	return super._same_resources(actual, wanted)
