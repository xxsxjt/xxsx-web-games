extends SceneTree
## Natural collision plus synthetic lifecycle controls, compared at every model tick.

const Sim = preload("res://src/storm_sim.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0
const CASES := [
	{"name": "manual-resume", "focus": false, "action": "resume", "policy": "recover"},
	{"name": "focus-resume", "focus": true, "action": "resume", "policy": "recover"},
	{"name": "manual-overload", "focus": false, "action": "resume", "policy": "overload"},
	{"name": "focus-overload", "focus": true, "action": "resume", "policy": "overload"},
	{"name": "manual-restart", "focus": false, "action": "restart", "policy": "recover"},
	{"name": "focus-restart", "focus": true, "action": "restart", "policy": "recover"},
	{"name": "manual-briefing", "focus": false, "action": "briefing", "policy": "recover"},
	{"name": "focus-briefing", "focus": true, "action": "briefing", "policy": "recover"},
]

var _checks := 0
var _failures := 0
var _baseline: Dictionary = {}
var _record_path := ""
var _saved_bytes := PackedByteArray()
var _saved_records: Dictionary = {}


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("needle_lifecycle_test.gd requires --headless")
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/needle-lifecycle-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "create isolated natural-lifecycle records directory")
		quit(1)
		return
	_record_path = folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", _record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	_key(app, KEY_2)
	_key(app, KEY_ENTER)
	for mode: String in ["recover", "overload"]:
		if mode == "overload":
			_key(app, KEY_R)
		var pair := _new_pair(app, mode, "baseline/" + mode)
		_finish(app, pair, "baseline/" + mode)
		var sim: Variant = app.get("sim")
		_baseline[mode] = {"snapshot": sim.snapshot().duplicate(true), "latent": _latent(sim),
			"ticks": pair.route.ticks, "impact": pair.route.impact_tick,
			"preimpact": pair.route.preimpact_snapshot, "postimpact": pair.route.impact_snapshot}
		if mode == "recover":
			_check(sim.phase == "success" and app.get("_record_status") == RecordsStore.NEW_BEST
				and FileAccess.file_exists(_record_path), "uninterrupted natural delivery writes the actual baseline best")
			_saved_bytes = FileAccess.get_file_as_bytes(_record_path) if FileAccess.file_exists(_record_path) else PackedByteArray()
			_saved_records = RecordsStore.new(_record_path).records.duplicate(true)
			_check(not _saved_bytes.is_empty() and _saved_records.keys() == ["needle-bank"]
				and _saved_records["needle-bank"].score == sim.report.get("score", -1),
				"baseline record reloads only the delivered Needle Bank score")
		else:
			_check(_same_record() and String(app.get("_record_status")).is_empty(),
				"uninterrupted overload leaves baseline score bytes and rankings unchanged")
	_check(_baseline.recover.preimpact == _baseline.overload.preimpact
		and _baseline.recover.postimpact == _baseline.overload.postimpact,
		"both baseline policies have identical actual pre/post-impact snapshots")
	for scenario: Dictionary in CASES:
		_run_case(app, scenario)
		await process_frame
	_check(app.get("sound").get("_motor") == null, "headless lifecycle never creates a live audio stream")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "remove only this run's natural-lifecycle test record directory")
	print("Stormline Needle Bank lifecycle: %d checks, %d failures; 2 uninterrupted baselines and 8 natural-impact headless lifecycle cases, tickwise model comparison, no rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _new_pair(app: Node, policy: String, label: String) -> Dictionary:
	var reference := Sim.new()
	reference.reset("needle-bank")
	var pair := {"model": reference, "route": Route.new(policy), "model_route": Route.new(policy),
		"matches": true, "first_mismatch": 0, "neutral_after_impact": false, "policy": policy}
	var sim: Variant = app.get("sim")
	_check(app.get("screen") == "running" and sim.snapshot() == reference.snapshot()
		and _latent(sim) == _latent(reference) and sim.position == Sim.CONTRACTS["needle-bank"].start
		and sim.mission_time == 0.0 and sim.hull == 100.0 and sim.cargo_integrity == 100.0
		and sim.battery == 100.0 and not sim.scanned and not sim.tow_attached
		and not bool(app.get("_tow_queued")) and String(app.get("_record_status")).is_empty(),
		label + " starts from an untouched natural contract through app transitions")
	# Use the production polling adapter for the first tick, not a manual queue clear.
	_step_pair(app, pair, true)
	_check(pair.matches and sim.phase == "approach" and is_equal_approx(sim.mission_time, DT)
		and not bool(app.get("_tow_queued")) and sim.event_kind.is_empty(),
		label + " first actual polling tick inherits no old tow edge or collision clock")
	return pair


func _step_pair(app: Node, pair: Dictionary, poll_neutral: bool = false) -> void:
	var sim: Variant = app.get("sim")
	var before: Dictionary = sim.snapshot()
	var model_before: Dictionary = pair.model.snapshot()
	var controls: Dictionary
	var model_controls: Dictionary
	if poll_neutral:
		controls = {"power": sim.power_profile}
		model_controls = {"power": pair.model.power_profile}
		app.call("_physics_process", DT)
	else:
		controls = pair.route.controls(before)
		model_controls = pair.model_route.controls(model_before)
		app.call("_advance_simulation", DT, controls)
	pair.model.step(DT, model_controls)
	var after: Dictionary = sim.snapshot()
	var model_after: Dictionary = pair.model.snapshot()
	pair.route.observe(before, after)
	pair.model_route.observe(model_before, model_after)
	if controls != model_controls or after != model_after or _latent(sim) != _latent(pair.model):
		pair.matches = false
		if pair.first_mismatch == 0:
			pair.first_mismatch = pair.route.ticks


func _impact_neutral_step(app: Node, pair: Dictionary, label: String) -> void:
	var sim: Variant = app.get("sim")
	var before: Dictionary = sim.snapshot()
	_check(not bool(app.get("_tow_queued")), label + " no pending tow action reaches the resumed polling boundary")
	_step_pair(app, pair, true)
	pair.neutral_after_impact = true
	_check(pair.matches and sim.tow_attached and sim.phase == "return"
		and is_equal_approx(sim.mission_time, float(before.time) + DT)
		and not bool(app.get("_tow_queued")),
		label + " actual resumed physics tick preserves the tow and matches one uninterrupted neutral step")


func _finish(app: Node, pair: Dictionary, label: String) -> void:
	while app.get("screen") == "running" and pair.route.ticks < Route.MAX_TICKS:
		if pair.route.impact_tick > 0 and not pair.neutral_after_impact:
			_impact_neutral_step(app, pair, label)
		else:
			_step_pair(app, pair)
	var sim: Variant = app.get("sim")
	var route: Variant = pair.route
	_check(pair.matches and pair.first_mismatch == 0 and route.ticks == pair.model_route.ticks,
		label + " every logical tick matches uninterrupted controls, public state and latent clocks; first mismatch=%d" % pair.first_mismatch)
	_check(route.scan_tick > 0 and route.attach_tick > route.scan_tick and route.impact_tick > route.attach_tick
		and route.survived_impact and route.impact_event.contains(Route.REEF_NAME)
		and (route.impact_hull < route.hull_before_impact or route.impact_cargo < route.cargo_before_impact),
		label + " natural scanning and attachment precede a real surviving, damaging central-reef impact")
	_check(app.get("screen") == "debrief" and not route.early_report and not route.tug_only_progress,
		label + " only the normal terminal flow reaches debrief without early reports or tug-only docking")
	if pair.policy == "recover":
		_check(sim.phase == "success" and sim.report.has("score") and sim.fail_reason.is_empty()
			and sim.hull > 0.0 and sim.hull < 100.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0
			and route.dock_hold >= 60 and sim.dock == 1.0 and route.dock_bounds_valid
			and route.peak_dock_tug_speed <= Sim.DOCK_SPEED and route.peak_dock_cargo_speed <= Sim.DOCK_SPEED
			and route.peak_dock_tension < Sim.DOCK_TENSION,
			label + " damaged natural route still earns a real two-body low-speed 60-tick delivery")
	else:
		_check(sim.phase == "failed" and sim.event_kind == "snap" and not sim.tow_attached
			and sim.report.is_empty() and sim.fail_reason.contains("断裂") and route.peak_overload >= 1.0,
			label + " resumed unsafe inputs cause real overload failure rather than a success score")
	if _baseline.has(pair.policy):
		var baseline: Dictionary = _baseline[pair.policy]
		_check(route.ticks == baseline.ticks and route.impact_tick == baseline.impact
			and route.preimpact_snapshot == baseline.preimpact and route.impact_snapshot == baseline.postimpact
			and sim.snapshot() == baseline.snapshot and _latent(sim) == baseline.latent,
			label + " complete collision and terminal results equal the uninterrupted application baseline")
	if not _saved_bytes.is_empty():
		_check(_same_record() and (app.get("_record_status") == RecordsStore.EXISTING_BEST
			if pair.policy == "recover" else String(app.get("_record_status")).is_empty()),
			label + " stored best bytes, rankings and normal result status stay correct")
	var terminal: Dictionary = sim.snapshot()
	var latent := _latent(sim)
	var terminal_bytes := FileAccess.get_file_as_bytes(_record_path) if FileAccess.file_exists(_record_path) else PackedByteArray()
	app.call("_on_focus_exited")
	app.call("_advance_simulation", 60.0, {"throttle": 1.0, "tow_pressed": true})
	app.call("_physics_process", DT)
	app.call("_process", 0.75)
	_check(app.get("screen") == "debrief" and sim.snapshot() == terminal and _latent(sim) == latent
		and FileAccess.get_file_as_bytes(_record_path) == terminal_bytes,
		label + " debrief cannot replay a terminal event or write another record")
	print("APP needle_lifecycle/%s: %s model_tickwise_match=%s" % [label, route.metrics(sim.snapshot()), str(pair.matches)])


func _run_case(app: Node, scenario: Dictionary) -> void:
	var label: String = scenario.name
	_key(app, KEY_R)
	var pair := _new_pair(app, scenario.policy, label)
	while app.get("screen") == "running" and pair.route.impact_tick == 0 and pair.route.ticks < Route.MAX_TICKS:
		_step_pair(app, pair)
	var sim: Variant = app.get("sim")
	var before: Dictionary = sim.snapshot()
	var before_latent := _latent(sim)
	_check(pair.matches and pair.route.impact_tick == _baseline[scenario.policy].impact
		and before == _baseline[scenario.policy].postimpact and sim.phase == "return" and sim.tow_attached,
		label + " reaches the same real damaged impact before lifecycle controls diverge")
	_key(app, KEY_SPACE)
	_check(bool(app.get("_tow_queued")), label + " running adapter queues the deliberately pending Space edge")
	if scenario.focus:
		app.call("_on_focus_exited")
	else:
		_key(app, KEY_P)
	_check(app.get("screen") == "paused" and not bool(app.get("_tow_queued"))
		and sim.snapshot() == before and _latent(sim) == before_latent,
		label + " pause clears the input edge without altering damaged bodies or collision clocks")
	app.call("_on_focus_exited")
	app.call("_on_focus_exited")
	for keycode: int in [KEY_SPACE, KEY_1, KEY_2, KEY_3]:
		_key(app, keycode)
	_check(app.get("screen") == "paused" and not bool(app.get("_tow_queued"))
		and sim.snapshot() == before and _latent(sim) == before_latent,
		label + " repeated focus and paused power/tow keys cannot resume or mutate the active tow")
	var route_ticks: int = pair.route.ticks
	for blocked_delta: float in [DT, 0.75, 60.0]:
		app.call("_advance_simulation", blocked_delta, {"throttle": 1.0, "power": 0, "tow_pressed": true, "reel": -1.0})
		app.call("_physics_process", blocked_delta)
		app.call("_process", blocked_delta)
		_check(app.get("screen") == "paused" and sim.snapshot() == before and _latent(sim) == before_latent
			and pair.route.ticks == route_ticks and pair.model_route.ticks == route_ticks,
			label + " paused delta %.3f advances neither model, recovery clocks nor input driver" % blocked_delta)
		_check(_same_record() and String(app.get("_record_status")).is_empty(),
			label + " pause after an actual collision cannot write or replace a best score")
	if scenario.action == "resume":
		_key(app, KEY_ESCAPE)
		_check(app.get("screen") == "running" and sim.snapshot() == before and _latent(sim) == before_latent
			and not bool(app.get("_tow_queued")), label + " resume restores the exact damaged state without a catch-up tick")
	else:
		_key(app, KEY_R if scenario.action == "restart" else KEY_ENTER)
		if scenario.action == "briefing":
			_check(app.get("screen") == "briefing" and sim.mission_time == 0.0 and sim.position == sim.contract.start
				and sim.report.is_empty() and not sim.tow_attached and not bool(app.get("_tow_queued")),
				label + " returning to briefing resets the abandoned damaged mission without scoring it")
			_key(app, KEY_ENTER)
		_check(_same_record(), label + " abandoning the natural damaged tow preserves the prior best")
		pair = _new_pair(app, "recover", label + "/fresh")
	_finish(app, pair, label)


func _latent(sim: Variant) -> Dictionary:
	# Read-only visibility for state omitted from the presentation snapshot.
	return {"contract": sim.contract.duplicate(true), "event_message": sim.event_message,
		"notice_until": sim.get("_notice_until"), "collision_notice_at": sim.get("_collision_notice_at"),
		"tug_impact_at": sim.get("_tug_impact_at"), "cargo_impact_at": sim.get("_cargo_impact_at"),
		"danger": sim.get("_danger")}


func _key(app: Node, keycode: int) -> void:
	var event := InputEventKey.new()
	event.keycode = keycode
	event.pressed = true
	app.call("_unhandled_input", event)


func _same_record() -> bool:
	return not _saved_bytes.is_empty() and FileAccess.file_exists(_record_path) \
		and FileAccess.get_file_as_bytes(_record_path) == _saved_bytes \
		and RecordsStore.new(_record_path).records == _saved_records


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
