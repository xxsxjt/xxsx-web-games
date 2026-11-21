extends SceneTree
## Every navigation tick uses synthetic Godot keys and the production polling adapter.

const Sim = preload("res://src/storm_sim.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const Driver = preload("res://tests/needle_keyboard_driver.gd")
const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0

var _checks := 0
var _failures := 0
var _wasd_results: Dictionary = {}


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("needle_keyboard_test.gd requires --headless")
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/needle-keyboard-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "create isolated keyboard-voyage record directory")
		quit(1)
		return
	var record_path := folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	_check(Driver.all_released(), "new headless process begins without held navigation keys")
	Driver.edge(root, KEY_2)
	Driver.edge(root, KEY_ENTER)
	var saved_bytes := PackedByteArray()
	var saved_records: Dictionary = {}
	for arrows: bool in [false, true]:
		for mode: String in ["recover", "overload"]:
			if arrows or mode == "overload":
				Driver.edge(root, KEY_R)
			var label := ("arrows/" if arrows else "wasd/") + mode
			var sim: Variant = app.get("sim")
			var model := Sim.new()
			model.reset("needle-bank")
			_check(app.get("screen") == "running" and sim.snapshot() == model.snapshot()
				and sim.position == sim.contract.start and sim.mission_time == 0.0
				and sim.hull == 100.0 and sim.cargo_integrity == 100.0 and sim.battery == 100.0
				and not sim.scanned and not sim.tow_attached and sim.report.is_empty(),
				label + " menu and restart keys enter the untouched natural contract")
			var route := Route.new(mode)
			var model_route := Route.new(mode)
			var driver := Driver.new()
			var model_driver := Driver.new()
			var matches := true
			var discrete := true
			var held_sampling := true
			var prior_controls: Dictionary = {}
			var queue_consumed := true
			var first_mismatch := 0
			for tick in range(Route.MAX_TICKS):
				var before: Dictionary = sim.snapshot()
				var model_before: Dictionary = model.snapshot()
				var controls: Dictionary = driver.quantize(route.controls(before))
				var model_controls: Dictionary = model_driver.quantize(model_route.controls(model_before))
				for channel: String in Driver.CHANNELS:
					discrete = discrete and float(controls[channel]) in [-1.0, 0.0, 1.0]
					if tick % Driver.HOLD_TICKS != 0:
						held_sampling = held_sampling and controls[channel] == prior_controls.get(channel)
				prior_controls = controls.duplicate()
				driver.apply(root, controls, arrows)
				queue_consumed = queue_consumed and bool(app.get("_tow_queued")) == bool(controls.tow_pressed)
				# The test never calls _advance_simulation or writes to the application sim.
				app.call("_physics_process", DT)
				model.step(DT, model_controls)
				route.observe(before, sim.snapshot())
				model_route.observe(model_before, model.snapshot())
				queue_consumed = queue_consumed and not bool(app.get("_tow_queued"))
				if controls != model_controls or sim.snapshot() != model.snapshot():
					matches = false
					if first_mismatch == 0:
						first_mismatch = tick + 1
				if app.get("screen") != "running":
					break
				if tick % 600 == 0:
					await process_frame
			_check(matches and first_mismatch == 0 and route.ticks == model_route.ticks,
				label + " all keyboard polling ticks match independent digital model; first mismatch=%d" % first_mismatch)
			_check(discrete and queue_consumed and driver.ticks == route.ticks and driver.tow_edges > 0
				and driver.power_edges >= 3 and driver.key_edges > 0,
				label + " only discrete held keys and consumed power/tow edges drive the voyage")
			_check(held_sampling, label + " throttle, steering and reel remain fixed for every six-tick sample block")
			_check_route(sim, route, label)
			if not arrows:
				_wasd_results[mode] = {"snapshot": sim.snapshot().duplicate(true), "ticks": route.ticks,
					"impact": route.impact_tick, "preimpact": route.preimpact_snapshot, "postimpact": route.impact_snapshot}
			else:
				var baseline: Dictionary = _wasd_results[mode]
				_check(sim.snapshot() == baseline.snapshot and route.ticks == baseline.ticks
					and route.impact_tick == baseline.impact and route.preimpact_snapshot == baseline.preimpact
					and route.impact_snapshot == baseline.postimpact, label + " arrow aliases exactly match WASD impact and terminal results")
			if mode == "recover" and not arrows:
				_check(app.get("_record_status") == RecordsStore.NEW_BEST and FileAccess.file_exists(record_path),
					label + " actual keyboard delivery saves the isolated baseline best")
				saved_bytes = FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()
				saved_records = RecordsStore.new(record_path).records.duplicate(true)
				_check(not saved_bytes.is_empty() and saved_records.keys() == ["needle-bank"]
					and saved_records["needle-bank"].score == sim.report.get("score", -1), label + " delivered score reloads under Needle Bank only")
			else:
				_check(not saved_bytes.is_empty() and FileAccess.get_file_as_bytes(record_path) == saved_bytes
					and RecordsStore.new(record_path).records == saved_records
					and (app.get("_record_status") == RecordsStore.EXISTING_BEST if mode == "recover"
					else String(app.get("_record_status")).is_empty()), label + " retry preserves real best bytes, rankings and result status")
			var terminal: Dictionary = sim.snapshot()
			driver.apply(root, {"throttle": 1.0, "steer": 1.0, "reel": -1.0,
				"power": 0, "slow": false, "scan": true, "tow_pressed": true}, arrows)
			app.call("_physics_process", 60.0)
			_check(app.get("screen") == "debrief" and sim.snapshot() == terminal
				and FileAccess.get_file_as_bytes(record_path) == saved_bytes,
				label + " held drive and Space after debrief cannot replay the result")
			driver.release()
			_check(Driver.all_released(), label + " releases every synthetic held key before the next voyage")
			print("APP needle_keyboard/%s: %s key_edges=%d hold_ticks=%d model_tickwise_match=%s" % [
				label, route.metrics(sim.snapshot()), driver.key_edges, Driver.HOLD_TICKS, str(matches)])
	_check(_wasd_results.recover.preimpact == _wasd_results.overload.preimpact
		and _wasd_results.recover.postimpact == _wasd_results.overload.postimpact,
		"digital recovery and overload policies diverge only after the same real collision")
	_check(app.get("sound").get("_motor") == null, "headless keyboard voyages never create an audio stream")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "remove only this keyboard-voyage record directory")
	print("Stormline Needle Bank keyboard: %d checks, %d failures; 4 natural digital-key voyages through production polling, no OS input or rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check_route(sim: Variant, route: Variant, label: String) -> void:
	_check(route.departed and route.scan_tick > 0 and route.attach_tick > route.scan_tick
		and route.impact_tick > route.attach_tick and route.survived_impact
		and (route.impact_hull < route.hull_before_impact or route.impact_cargo < route.cargo_before_impact),
		label + " actual digital keys sail, scan, attach and survive a real damaging central-reef collision")
	_check(not route.early_report and not route.tug_only_progress and route.ticks <= Route.MAX_TICKS,
		label + " no early score or tug-only docking, bounded route; " + route.metrics(sim.snapshot()))
	if route.mode == "recover":
		_check(sim.phase == "success" and sim.report.has("score") and sim.fail_reason.is_empty()
			and sim.hull > 0.0 and sim.hull < 100.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			label + " damaged digital-key voyage completes a real live, powered delivery; " + route.metrics(sim.snapshot()))
		_check(route.dock_hold >= 60 and sim.dock == 1.0 and route.dock_bounds_valid
			and route.peak_dock_tug_speed <= Sim.DOCK_SPEED and route.peak_dock_cargo_speed <= Sim.DOCK_SPEED
			and route.peak_dock_tension < Sim.DOCK_TENSION
			and sim.position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
			and sim.cargo_position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius),
			label + " both digital-driven bodies earn low-speed low-tension docking for 60 ticks")
	else:
		_check(sim.phase == "failed" and sim.event_kind == "snap" and not sim.tow_attached
			and sim.report.is_empty() and sim.fail_reason.contains("断裂") and route.peak_overload >= 1.0,
			label + " unsafe digital-key controls cause real overload failure without a success report; " + route.metrics(sim.snapshot()))


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
