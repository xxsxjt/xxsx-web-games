extends SceneTree
## Natural-start Needle Bank collision/recovery with model and headless app controls.

const Sim = preload("res://src/storm_sim.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0

var _checks := 0
var _failures := 0
var _model_results: Dictionary = {}
var _root_path := ""


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("needle_recovery_test.gd requires --headless")
		quit(1)
		return
	for mode: String in ["recover", "overload"]:
		var sim := Sim.new()
		sim.reset("needle-bank")
		_check_natural_start(sim, "MODEL " + mode)
		var route := Route.new(mode)
		for _tick in range(Route.MAX_TICKS):
			var before: Dictionary = sim.snapshot()
			sim.step(DT, route.controls(before))
			route.observe(before, sim.snapshot())
			if sim.phase in ["success", "failed"]:
				break
		_check_route(sim, route, "MODEL " + mode)
		if mode == "overload":
			_check(route.preimpact_snapshot == _model_results["recover"]["preimpact_snapshot"]
				and route.impact_snapshot == _model_results["recover"]["impact_snapshot"],
				"MODEL both policies match before and after the real collision, before control choices diverge")
		_model_results[mode] = {"snapshot": sim.snapshot(), "ticks": route.ticks,
			"impact": route.impact_tick, "preimpact_snapshot": route.preimpact_snapshot,
			"impact_snapshot": route.impact_snapshot}
		var terminal: Dictionary = sim.snapshot()
		sim.step(DT, {"throttle": 1.0, "tow_pressed": true})
		_check(sim.snapshot() == terminal, "MODEL " + mode + " terminal state remains frozen")
		print("MODEL needle_recovery/%s: %s" % [mode, route.metrics(sim.snapshot())])
	await _run_app()
	print("Stormline Needle Bank recovery: %d checks, %d failures; 2 model and 2 headless-app natural-start voyages, no rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _run_app() -> void:
	_root_path = ProjectSettings.globalize_path("res://.testdata/needle-recovery-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root_path) != OK:
		_check(false, "create isolated Needle Bank records directory")
		return
	var record_path := _root_path.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	app.call("_on_contract_selected", "needle-bank")
	var saved_bytes := PackedByteArray()
	var saved_records: Dictionary = {}
	for mode: String in ["recover", "overload"]:
		if mode == "recover":
			app.call("_on_start_requested")
		else:
			app.call("_on_restart_requested")
		var sim: Variant = app.get("sim")
		_check_natural_start(sim, "APP " + mode)
		var route := Route.new(mode)
		for tick in range(Route.MAX_TICKS):
			var before: Dictionary = sim.snapshot()
			app.call("_advance_simulation", DT, route.controls(before))
			route.observe(before, sim.snapshot())
			if app.get("screen") != "running":
				break
			if tick % 600 == 0:
				await process_frame
		_check_route(sim, route, "APP " + mode)
		_check(app.get("screen") == "debrief", "APP " + mode + " reaches normal debrief")
		var model: Dictionary = _model_results[mode]
		_check(route.ticks == model.ticks and route.impact_tick == model.impact
			and route.preimpact_snapshot == model.preimpact_snapshot
			and route.impact_snapshot == model.impact_snapshot and sim.snapshot() == model.snapshot,
			"APP " + mode + " exactly matches model pre/post-impact and terminal snapshots")
		if mode == "recover":
			_check(sim.phase == "success" and app.get("_record_status") == RecordsStore.NEW_BEST
				and FileAccess.file_exists(record_path), "APP recovered delivery saves a real best record")
			saved_bytes = FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()
			saved_records = RecordsStore.new(record_path).records.duplicate(true)
			_check(not saved_bytes.is_empty() and saved_records.keys() == ["needle-bank"]
				and saved_records["needle-bank"].score == sim.report.score,
				"APP delivered score is reloaded under Needle Bank only")
		else:
			_check(not saved_bytes.is_empty() and FileAccess.get_file_as_bytes(record_path) == saved_bytes
				and RecordsStore.new(record_path).records == saved_records
				and String(app.get("_record_status")).is_empty(), "APP unsafe retry preserves delivered record bytes and ranking")
		var terminal: Dictionary = sim.snapshot()
		app.call("_advance_simulation", 60.0, {"throttle": 1.0, "tow_pressed": true})
		_check(sim.snapshot() == terminal and FileAccess.get_file_as_bytes(record_path) == saved_bytes,
			"APP " + mode + " debrief cannot replay the result or write another record")
		print("APP needle_recovery/%s: %s" % [mode, route.metrics(sim.snapshot())])
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(_root_path):
		DirAccess.remove_absolute(_root_path.path_join(name))
	_check(DirAccess.remove_absolute(_root_path) == OK, "remove only the Needle Bank test record directory")


func _check_natural_start(sim: Variant, label: String) -> void:
	_check(sim.contract_id == "needle-bank" and sim.phase == "approach" and sim.position == sim.contract.start
		and sim.cargo_position == sim.contract.target and sim.mission_time == 0.0
		and not sim.scanned and not sim.tow_attached and sim.report.is_empty() and sim.dock == 0.0,
		label + " begins at the untouched natural contract start")
	_check(sim.hull == 100.0 and sim.cargo_integrity == 100.0 and sim.battery == 100.0,
		label + " begins without injected damage, energy or weather changes")


func _check_route(sim: Variant, route: Route, label: String) -> void:
	_check(route.departed and route.scan_tick > 0 and route.attach_tick > route.scan_tick
		and route.impact_tick > route.attach_tick, label + " sails, scans, attaches and then physically hits a reef")
	_check(route.survived_impact and route.impact_event.contains(Route.REEF_NAME)
		and (route.impact_hull < route.hull_before_impact or route.impact_cargo < route.cargo_before_impact),
		label + " actual named collision leaves a damaged but surviving attached tow")
	_check(not route.early_report and not route.tug_only_progress, label + " no early score or tug-only docking progress")
	_check(route.peak_storm >= 0.9 and route.peak_wind >= 3.0,
		label + " naturally traverses a measured high-storm wind phase")
	_check(sim.phase in ["success", "failed"] and route.ticks <= Route.MAX_TICKS, label + " reaches a bounded terminal state; " + route.metrics(sim.snapshot()))
	if route.mode == "recover":
		_check(sim.phase == "success" and sim.tow_attached and sim.report.has("score") and sim.fail_reason.is_empty(),
			label + " damage is recoverable via real controls and normal docking; " + route.metrics(sim.snapshot()))
		_check(sim.hull > 0.0 and sim.hull < 100.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			label + " actual damage persists to a live, powered delivery")
		_check(route.dock_hold >= 60 and sim.dock == 1.0 and route.dock_bounds_valid
			and route.peak_dock_tug_speed <= Sim.DOCK_SPEED and route.peak_dock_cargo_speed <= Sim.DOCK_SPEED
			and route.peak_dock_tension < Sim.DOCK_TENSION, label + " true two-body docking observes speed/tension and a full 60-tick hold")
		_check(sim.position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
			and sim.cargo_position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
			and sim.mission_time < float(sim.contract.deadline), label + " both real bodies arrive before the contract deadline")
	else:
		_check(sim.phase == "failed" and sim.event_kind == "snap" and not sim.tow_attached
			and sim.fail_reason.contains("断裂") and sim.report.is_empty() and route.peak_overload >= 1.0,
			label + " sustained unsafe inputs break the real tow without a success score; " + route.metrics(sim.snapshot()))
	_check(Sim.CONTRACTS["needle-bank"].hazards.size() == 5, label + " production map is untouched")


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
