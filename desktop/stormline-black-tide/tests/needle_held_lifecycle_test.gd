extends SceneTree
## Held synthetic keys across natural-impact pause/resume/restart, never OS input.

const Sim = preload("res://src/storm_sim.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const Driver = preload("res://tests/needle_keyboard_driver.gd")
const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0
const HELD := {"throttle": 1.0, "steer": 1.0, "reel": -1.0,
	"power": 2, "scan": true, "slow": true, "tow_pressed": false}

var _checks := 0
var _failures := 0
var _baselines: Dictionary = {}
var _impact: Dictionary = {}
var _record_path := ""
var _saved_bytes := PackedByteArray()
var _saved_records: Dictionary = {}


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("needle_held_lifecycle_test.gd requires --headless")
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/needle-held-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "create isolated held-key lifecycle records directory")
		quit(1)
		return
	_record_path = folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", _record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	_check(Driver.all_released(), "headless held-key test starts without synthetic held input")
	Driver.edge(root, KEY_2)
	for origin: String in ["resume", "fresh"]:
		for keep: bool in [false, true]:
			var policies := ["recover", "overload"] if origin == "resume" else ["recover"]
			for policy: String in policies:
				Driver.edge(root, KEY_ENTER if app.get("screen") == "briefing" else KEY_R)
				var key := _baseline_key(origin, keep, policy)
				var pair := _new_pair(app, policy, "baseline/" + key)
				if origin == "resume":
					_drive_to_impact(app, pair, "baseline/" + key)
				var held: Dictionary = HELD.duplicate()
				held.power = 2 if origin == "resume" else 0
				pair.driver.apply(root, held)
				if not keep:
					pair.driver.release()
				var prior_bytes := _record_bytes()
				_polled_step(app, pair, _expected(keep, held.power), "baseline/" + key)
				if origin == "fresh":
					pair.driver.release()
				_finish(app, pair, "baseline/" + key)
				_baselines[key] = _result(app, pair)
				var sim: Variant = app.get("sim")
				if policy == "recover":
					var stored: Dictionary = RecordsStore.new(_record_path).records
					_check(not _record_bytes().is_empty() and stored.keys() == ["needle-bank"]
						and stored["needle-bank"].score >= sim.report.get("score", -1)
						and app.get("_record_status") in [RecordsStore.NEW_BEST, RecordsStore.EXISTING_BEST],
						"baseline/" + key + " stores only a real delivered best")
				else:
					_check(_record_bytes() == prior_bytes and String(app.get("_record_status")).is_empty(),
						"baseline/" + key + " failure preserves prior record bytes")
	_saved_bytes = _record_bytes()
	_saved_records = RecordsStore.new(_record_path).records.duplicate(true)
	for focus: bool in [false, true]:
		for keep: bool in [false, true]:
			for action: String in ["recover", "overload", "restart", "briefing"]:
				_run_case(app, focus, keep, action)
				await process_frame
	_check(Driver.all_released() and app.get("sound").get("_motor") == null,
		"all held keys released and no live audio stream was created")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "remove only this held-key lifecycle record directory")
	print("Stormline held-key lifecycle: %d checks, %d failures; 6 same-input baselines and 16 natural-impact held/released-key cases, production polling only, no OS input or rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _new_pair(app: Node, policy: String, label: String) -> Dictionary:
	var model := Sim.new()
	model.reset("needle-bank")
	var pair := {"model": model, "route": Route.new(policy), "model_route": Route.new(policy),
		"driver": Driver.new(), "model_driver": Driver.new(), "matches": true,
		"first_mismatch": 0, "policy": policy, "poll_steps": 0}
	var sim: Variant = app.get("sim")
	_check(app.get("screen") == "running" and sim.snapshot() == model.snapshot() and _latent(sim) == _latent(model)
		and not bool(app.get("_tow_queued")) and String(app.get("_record_status")).is_empty(),
		label + " starts with the complete untouched natural contract and no old input queue")
	return pair


func _digital_step(app: Node, pair: Dictionary) -> void:
	var controls: Dictionary = pair.driver.quantize(pair.route.controls(app.get("sim").snapshot()))
	var expected: Dictionary = pair.model_driver.quantize(pair.model_route.controls(pair.model.snapshot()))
	pair.driver.apply(root, controls)
	_pair_step(app, pair, expected, controls == expected and _polled_controls(app) == expected)


func _pair_step(app: Node, pair: Dictionary, expected: Dictionary, matched_inputs: bool) -> void:
	var sim: Variant = app.get("sim")
	var before: Dictionary = sim.snapshot()
	var model_before: Dictionary = pair.model.snapshot()
	app.call("_physics_process", DT)
	pair.model.step(DT, expected)
	pair.route.observe(before, sim.snapshot())
	pair.model_route.observe(model_before, pair.model.snapshot())
	pair.poll_steps += 1
	if not matched_inputs or bool(app.get("_tow_queued")) or sim.snapshot() != pair.model.snapshot() \
			or _latent(sim) != _latent(pair.model):
		pair.matches = false
		if pair.first_mismatch == 0:
			pair.first_mismatch = pair.route.ticks


func _polled_step(app: Node, pair: Dictionary, expected: Dictionary, label: String) -> void:
	var before_time: float = app.get("sim").mission_time
	var actual := _polled_controls(app)
	_pair_step(app, pair, expected, actual == expected)
	_check(actual == expected and pair.matches and is_equal_approx(app.get("sim").mission_time, before_time + DT)
		and not bool(app.get("_tow_queued")), label + " first actual polling tick uses current held/released keys without a stale tow edge")


func _drive_to_impact(app: Node, pair: Dictionary, label: String) -> void:
	while app.get("screen") == "running" and pair.route.impact_tick == 0 and pair.route.ticks < Route.MAX_TICKS:
		_digital_step(app, pair)
	var sim: Variant = app.get("sim")
	var actual := {"pre": pair.route.preimpact_snapshot, "post": pair.route.impact_snapshot,
		"latent": _latent(sim), "tick": pair.route.impact_tick}
	if _impact.is_empty():
		_impact = actual.duplicate(true)
	_check(pair.matches and actual == _impact and pair.route.survived_impact
		and sim.phase == "return" and sim.tow_attached and sim.hull < 100.0,
		label + " reaches the same real damaged central-reef impact using only polled digital keys")


func _run_case(app: Node, focus: bool, keep: bool, action: String) -> void:
	var label := ("focus/" if focus else "manual/") + ("keep/" if keep else "release/") + action
	Driver.edge(root, KEY_R)
	var policy := "overload" if action == "overload" else "recover"
	var pair := _new_pair(app, policy, label)
	_drive_to_impact(app, pair, label)
	var sim: Variant = app.get("sim")
	pair.driver.apply(root, HELD)
	var before: Dictionary = sim.snapshot()
	var latent := _latent(sim)
	var driver_ticks: int = pair.driver.ticks
	var route_ticks: int = pair.route.ticks
	_check(_polled_controls(app) == HELD, label + " physically held Godot W/D/Q/E/Shift state is armed before pausing")
	Driver.edge(root, KEY_SPACE)
	_check(bool(app.get("_tow_queued")), label + " viewport Space queues an edge while running")
	if focus:
		app.call("_on_focus_exited")
	else:
		Driver.edge(root, KEY_P)
	_check(app.get("screen") == "paused" and not bool(app.get("_tow_queued"))
		and sim.snapshot() == before and _latent(sim) == latent,
		label + " pause discards the Space edge but leaves the real damaged model and clocks unchanged")
	app.call("_on_focus_exited")
	app.call("_on_focus_exited")
	for keycode: int in [KEY_SPACE, KEY_1, KEY_2, KEY_3]:
		Driver.edge(root, keycode)
	_check(sim.snapshot() == before and not bool(app.get("_tow_queued")) and app.get("screen") == "paused",
		label + " paused power/Space edges and repeated focus callbacks cannot change the running contract")
	if not keep:
		pair.driver.release()
	var paused_input := _expected(keep, 2)
	_check(_polled_controls(app) == paused_input, label + " release during pause is visible to the next actual polling call")
	for blocked_delta: float in [DT, 0.75, 60.0]:
		app.call("_physics_process", blocked_delta)
		app.call("_process", blocked_delta)
		_check(sim.snapshot() == before and _latent(sim) == latent and app.get("screen") == "paused"
			and pair.driver.ticks == driver_ticks and pair.route.ticks == route_ticks
			and _polled_controls(app) == paused_input,
			label + " paused delta %.3f consumes neither held input, time, driver ticks nor collision clocks" % blocked_delta)
		_check(_same_record() and String(app.get("_record_status")).is_empty(), label + " paused held input never writes a best score")
	var baseline_key := _baseline_key("resume", keep, policy)
	if action in ["recover", "overload"]:
		Driver.edge(root, KEY_ESCAPE)
		_check(app.get("screen") == "running" and sim.snapshot() == before and _latent(sim) == latent,
			label + " resume adds no hidden catch-up tick")
		_polled_step(app, pair, paused_input, label)
		_check(sim.tow_attached and sim.phase == "return", label + " cleared Space edge cannot detach the resumed tow")
	else:
		var old_driver: Variant = pair.driver
		Driver.edge(root, KEY_R if action == "restart" else KEY_ENTER)
		if action == "briefing":
			_check(app.get("screen") == "briefing" and sim.mission_time == 0.0 and not sim.tow_attached
				and not bool(app.get("_tow_queued")), label + " abandoning the damaged tow resets to briefing without a score")
			Driver.edge(root, KEY_ENTER)
		_check(_same_record(), label + " restart or briefing does not replace any real saved best")
		pair = _new_pair(app, "recover", label + "/fresh")
		_polled_step(app, pair, _expected(keep, 0), label + "/fresh")
		_check(sim.phase == "approach" and not sim.tow_attached and sim.event_kind.is_empty(),
			label + " fresh first tick may use still-held navigation keys but never an abandoned Space edge")
		old_driver.release()
		_check(Driver.all_released(), label + " releasing the old physical holds clears the new mission's polling state")
		baseline_key = _baseline_key("fresh", keep, "recover")
	_finish(app, pair, label)
	_check(_result(app, pair) == _baselines[baseline_key], label + " entire collision and terminal result equals its same-input uninterrupted baseline")
	_check(_same_record() and (app.get("_record_status") == RecordsStore.EXISTING_BEST
		if pair.policy == "recover" else String(app.get("_record_status")).is_empty()),
		label + " delivery/failure keeps baseline best bytes and rankings unchanged")


func _finish(app: Node, pair: Dictionary, label: String) -> void:
	while app.get("screen") == "running" and pair.route.ticks < Route.MAX_TICKS:
		_digital_step(app, pair)
	var sim: Variant = app.get("sim")
	var route: Variant = pair.route
	_check(pair.matches and pair.first_mismatch == 0 and pair.poll_steps == route.ticks,
		label + " every navigation tick uses production polling and matches digital model/public/latent state; mismatch=%d" % pair.first_mismatch)
	_check(route.scan_tick > 0 and route.attach_tick > route.scan_tick and route.impact_tick > route.attach_tick
		and route.survived_impact and not route.early_report and not route.tug_only_progress
		and app.get("screen") == "debrief", label + " natural digital route scans, attaches, survives impact and reaches only a legitimate terminal")
	if pair.policy == "recover":
		_check(sim.phase == "success" and sim.report.has("score") and sim.hull > 0.0 and sim.hull < 100.0
			and sim.cargo_integrity > 0.0 and sim.battery > 0.0 and route.dock_hold >= 60 and sim.dock == 1.0
			and route.dock_bounds_valid and route.peak_dock_tug_speed <= Sim.DOCK_SPEED
			and route.peak_dock_cargo_speed <= Sim.DOCK_SPEED and route.peak_dock_tension < Sim.DOCK_TENSION,
			label + " actual damaged bodies earn a full low-speed low-tension delivery; " + route.metrics(sim.snapshot()))
	else:
		_check(sim.phase == "failed" and sim.event_kind == "snap" and not sim.tow_attached
			and sim.report.is_empty() and route.peak_overload >= 1.0, label + " unsafe held/digital controls fail by real cable overload; " + route.metrics(sim.snapshot()))
	var terminal: Dictionary = sim.snapshot()
	var latent := _latent(sim)
	var saved := _record_bytes()
	Driver.edge(root, KEY_SPACE)
	app.call("_on_focus_exited")
	app.call("_physics_process", 60.0)
	app.call("_process", 0.75)
	_check(sim.snapshot() == terminal and _latent(sim) == latent and _record_bytes() == saved,
		label + " held keys after debrief cannot replay results or overwrite a score")
	pair.driver.release()
	_check(Driver.all_released(), label + " releases all synthetic navigation keys after the complete voyage")
	print("APP needle_held/%s: %s model_tickwise_match=%s" % [label, route.metrics(sim.snapshot()), str(pair.matches)])


func _result(app: Node, pair: Dictionary) -> Dictionary:
	return {"snapshot": app.get("sim").snapshot().duplicate(true), "latent": _latent(app.get("sim")),
		"ticks": pair.route.ticks, "impact": pair.route.impact_tick,
		"preimpact": pair.route.preimpact_snapshot, "postimpact": pair.route.impact_snapshot}


func _polled_controls(app: Node) -> Dictionary:
	return {"throttle": float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
		- float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)),
		"steer": float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT))
		- float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		"reel": float(Input.is_key_pressed(KEY_F)) - float(Input.is_key_pressed(KEY_Q)),
		"power": app.get("sim").power_profile, "scan": Input.is_key_pressed(KEY_E),
		"slow": Input.is_key_pressed(KEY_SHIFT), "tow_pressed": bool(app.get("_tow_queued"))}


func _expected(keep: bool, power: int) -> Dictionary:
	var controls: Dictionary = HELD.duplicate() if keep else {"throttle": 0.0, "steer": 0.0,
		"reel": 0.0, "power": power, "scan": false, "slow": false, "tow_pressed": false}
	controls.power = power
	return controls


func _latent(sim: Variant) -> Dictionary:
	return {"contract": sim.contract.duplicate(true), "event_message": sim.event_message,
		"notice_until": sim.get("_notice_until"), "collision_notice_at": sim.get("_collision_notice_at"),
		"tug_impact_at": sim.get("_tug_impact_at"), "cargo_impact_at": sim.get("_cargo_impact_at"), "danger": sim.get("_danger")}


func _baseline_key(origin: String, keep: bool, policy: String) -> String:
	return origin + "/" + ("keep/" if keep else "release/") + policy


func _record_bytes() -> PackedByteArray:
	return FileAccess.get_file_as_bytes(_record_path) if FileAccess.file_exists(_record_path) else PackedByteArray()


func _same_record() -> bool:
	return not _saved_bytes.is_empty() and _record_bytes() == _saved_bytes and RecordsStore.new(_record_path).records == _saved_records


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
