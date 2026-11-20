extends SceneTree
## Full-step and headless-app final-tick ordering; synthetic fixtures, not navigation.

const Sim = preload("res://src/storm_sim.gd")
const MainScene = preload("res://scenes/main.tscn")
const RecordsStore = preload("res://src/storm_records.gd")
const Fixture = preload("res://tests/terminal_priority_fixture.gd")
const DT := 1.0 / 60.0

var _checks := 0
var _failures := 0
var _root_path := ""


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("terminal_priority_test.gd requires --headless")
		quit(1)
		return
	for contract_id: String in ["black-tide", "needle-bank"]:
		for scenario: Dictionary in Fixture.CASES:
			_run_model_case(contract_id, scenario)
	await _run_app_cases()
	print("Stormline terminal priority: %d checks, %d failures; 28 model and 28 headless-app final-tick cases, synthetic harbor fixtures only." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _run_model_case(contract_id: String, scenario: Dictionary) -> void:
	var sim := Sim.new()
	Fixture.prepare(sim, contract_id)
	for _tick in range(Fixture.PRIOR_HOLD_TICKS):
		sim.step(DT, Fixture.CONTROLS)
	_check_ready(sim, contract_id + "/" + String(scenario.name))
	Fixture.arm_final_tick(sim, scenario)
	var before: Dictionary = sim.snapshot()
	sim.step(DT, Fixture.CONTROLS)
	_check_result(sim, before, contract_id, scenario, "MODEL")
	var terminal: Dictionary = sim.snapshot()
	sim.step(DT, {"throttle": 1.0, "tow_pressed": true})
	_check(sim.snapshot() == terminal, contract_id + "/" + String(scenario.name) + " model terminal state is frozen")


func _run_app_cases() -> void:
	_root_path = ProjectSettings.globalize_path("res://.testdata/terminal-priority-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root_path) != OK:
		_check(false, "create isolated terminal-priority records directory")
		return
	var record_path := _root_path.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	await process_frame
	app.set_process(false)
	app.set_physics_process(false)
	for contract_id: String in ["black-tide", "needle-bank"]:
		var saved_bytes := PackedByteArray()
		var saved_records: Dictionary = {}
		for scenario: Dictionary in Fixture.CASES:
			if app.get("screen") == "debrief":
				app.call("_on_briefing_requested")
			app.call("_on_contract_selected", contract_id)
			app.call("_on_start_requested")
			var sim: Variant = app.get("sim")
			Fixture.prepare(sim, contract_id)
			for _tick in range(Fixture.PRIOR_HOLD_TICKS):
				app.call("_advance_simulation", DT, Fixture.CONTROLS)
			var label := contract_id + "/" + String(scenario.name)
			_check(app.get("screen") == "running" and sim.contract_id == contract_id,
				label + " app remains running on the selected contract before the last tick")
			_check_ready(sim, label)
			Fixture.arm_final_tick(sim, scenario)
			var before: Dictionary = sim.snapshot()
			app.call("_advance_simulation", DT, Fixture.CONTROLS)
			_check_result(sim, before, contract_id, scenario, "APP")
			_check(app.get("screen") == "debrief", label + " app enters terminal debrief")
			if scenario.name == "healthy":
				_check(sim.phase == "success" and FileAccess.file_exists(record_path)
					and app.get("_record_status") == RecordsStore.NEW_BEST,
					label + " genuine 60-tick docking saves the baseline record")
				saved_bytes = FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()
				saved_records = RecordsStore.new(record_path).records.duplicate(true)
				_check(not saved_bytes.is_empty() and saved_records.has(contract_id), label + " baseline record is reloadable")
			else:
				_check(not saved_bytes.is_empty() and FileAccess.get_file_as_bytes(record_path) == saved_bytes
					and RecordsStore.new(record_path).records == saved_records,
					label + " final-tick outcome preserves the earlier better record byte-for-byte")
				_check(app.get("_record_status") == RecordsStore.EXISTING_BEST if scenario.success
					else String(app.get("_record_status")).is_empty(),
					label + " record status distinguishes a lesser success from failure")
			var terminal: Dictionary = sim.snapshot()
			var terminal_bytes := FileAccess.get_file_as_bytes(record_path) if FileAccess.file_exists(record_path) else PackedByteArray()
			app.call("_advance_simulation", DT, {"throttle": 1.0, "tow_pressed": true})
			_check(sim.snapshot() == terminal and app.get("screen") == "debrief"
				and FileAccess.get_file_as_bytes(record_path) == terminal_bytes,
				label + " debrief rejects further simulation and record writes")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(_root_path):
		DirAccess.remove_absolute(_root_path.path_join(name))
	_check(DirAccess.remove_absolute(_root_path) == OK, "remove only the terminal-priority test record directory")


func _check_ready(sim: Variant, label: String) -> void:
	_check(sim.phase == "return" and sim.report.is_empty() and sim.hull > 0.0
		and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
		label + " 59 physical steps leave a live uncompleted tow")
	_check(is_equal_approx(sim.dock, float(Fixture.PRIOR_HOLD_TICKS) * DT)
		and sim.dock < 1.0 and sim.dock + DT >= 1.0,
		label + " stable hold is earned by 59 real steps rather than assigned")


func _check_result(sim: Variant, before: Dictionary, contract_id: String, scenario: Dictionary, layer: String) -> void:
	var label := layer + " " + contract_id + "/" + String(scenario.name)
	_check(before.hull > 0.0 and before.cargo_integrity > 0.0 and before.battery > 0.0
		and before.phase == "return" and before.report.is_empty(),
		label + " final tick begins alive without a terminal result")
	_check(is_equal_approx(sim.mission_time, float(before.time) + DT), label + " final result advances exactly one fixed tick")
	_check(sim.position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
		and sim.cargo_position.distance_to(sim.contract.harbor) <= float(sim.contract.harbor_radius)
		and sim.velocity.length() <= Sim.DOCK_SPEED and sim.cargo_velocity.length() <= Sim.DOCK_SPEED
		and sim.tow_attached and sim.cable_tension < Sim.DOCK_TENSION,
		label + " both bodies remain physically eligible for docking")
	_check(Sim.CONTRACTS[contract_id].hazards.size() == (4 if contract_id == "black-tide" else 5),
		label + " synthetic scrape geometry does not change the production contract")
	if scenario.success:
		_check(sim.phase == "success" and sim.event_kind == "docked" and sim.dock == 1.0,
			label + " a valid final tick completes normal docking")
		_check(sim.report.has("score") and sim.report.has("grade") and sim.fail_reason.is_empty()
			and sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0
			and sim.mission_time < float(sim.contract.deadline), label + " success has a real report and remaining resources/time")
	else:
		_check(sim.phase == "failed" and sim.event_kind == scenario.kind
			and sim.fail_reason.contains(String(scenario.reason)), label + " correct failure takes priority over docking")
		_check(sim.report.is_empty() and sim.dock == before.dock and sim.dock < 1.0,
			label + " failure prevents the last hold increment and success report")
	if String(scenario.name).begins_with("battery-") or scenario.name in ["cargo-battery-deadline", "all-exhausted"]:
		_check(is_equal_approx(sim.battery, maxf(0.0, float(before.battery) - Fixture.IDLE_TOW_DRAW)),
			label + " battery changes through real final-tick energy draw")
	if scenario.name in ["hull-survives", "hull-exhausted", "all-exhausted"]:
		_check(sim.hull < float(before.hull) and (sim.hull > 0.0 if scenario.success else sim.hull == 0.0),
			label + " actual reef scrape causes the intended hull boundary")
	if scenario.name in ["cargo-survives", "cargo-exhausted", "cargo-battery-deadline", "all-exhausted"]:
		_check(sim.cargo_integrity < float(before.cargo_integrity)
			and (sim.cargo_integrity > 0.0 if scenario.success else sim.cargo_integrity == 0.0),
			label + " actual reef scrape causes the intended cargo boundary")
	if "deadline" in String(scenario.name) or scenario.name == "all-exhausted":
		_check(sim.mission_time < float(sim.contract.deadline) if scenario.success else sim.mission_time >= float(sim.contract.deadline),
			label + " deadline comparison uses the post-step mission clock")
	print("%s terminal_priority/%s/%s: phase=%s dock=%.6f->%.6f hull=%.3f cargo=%.3f battery=%.6f event=%s" % [
		layer, contract_id, scenario.name, sim.phase, before.dock, sim.dock, sim.hull, sim.cargo_integrity, sim.battery, sim.event_kind])


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
