extends SceneTree
## Sampling threshold fixtures are explicitly distinct from natural-input voyages.
const Sim = preload("res://src/storm_sim.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const State = preload("res://src/expedition_state.gd")
const Driver = preload("res://tests/tide_survey_driver.gd")
const Rules = preload("res://tests/expedition_state_test.gd")
const DT := 1.0 / 60.0
const CHART := "black-tide-chart-safe"
const RECOVERY := "black-tide-recovery-safe"
var checks := 0
var failures := 0


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_sampling_fixtures()
	_atomic_overlays()
	_flow_fixtures()
	_settlement_fixtures()
	for offer: String in [CHART, "black-tide-chart-high"]:
		_natural(offer)
	print("PASS tide survey: %d checks, %d failures; fixtures and input voyages are separate; no rendered play." % [checks, failures])
	quit(0 if failures == 0 else 1)


func _spec(id: String = CHART, path: Array = [], loadout: Array = []) -> Dictionary:
	return {"token": "tide-fixture:1", "offer_id": id, "contract": Catalog.build_contract(id, 0, path),
		"loadout": loadout, "pressure": 0, "path": path, "hull": 100.0, "battery": 100.0}


func _sim(loadout: Array = []) -> Sim:
	var sim := Sim.new()
	_check(sim.reset_expedition(_spec(CHART, [], loadout)), "chart fixture envelope accepted")
	return sim


func _sampling_fixtures() -> void:
	var sim := _sim()
	var stations: Array = sim.snapshot().tide_survey.stations
	# Geometry assignments below are fixtures, not claimed as actual driving.
	sim.position = stations[1]
	for tick in 180:
		sim.step(DT, {"power": 1, "scan": true, "slow": true, "tow_pressed": true})
	_check(sim.snapshot().tide_survey.completed == 0 and not sim.scanned and not sim.tow_attached,
		"B cannot be sampled before A, and neither sonar nor tow bypasses the stations")
	sim.position = stations[0] + Vector2(Catalog.TIDE_RADIUS, 0)
	sim.velocity = Vector2.ZERO
	sim.step(DT, {"power": 1, "scan": true})
	_check(sim.snapshot().tide_survey.progress > 0.0, "sampling includes the exact radius boundary")
	sim.position = stations[0]
	sim.velocity = Vector2.ZERO
	sim.step(DT, {"power": 1, "scan": false})
	_check(sim.snapshot().tide_survey.progress == 0.0, "releasing E resets incomplete current sample")
	for mode: String in ["range", "speed"]:
		sim.position = stations[0]
		sim.velocity = Vector2.ZERO
		sim.step(DT, {"power": 1, "scan": true})
		_check(sim.snapshot().tide_survey.progress > 0.0, "partial sample before " + mode)
		sim.position = stations[0] + Vector2(Catalog.TIDE_RADIUS + 0.001 if mode == "range" else 0.0, 0)
		sim.velocity = Vector2(Catalog.TIDE_SPEED if mode == "speed" else 0.0, 0)
		sim.step(DT, {"power": 1, "scan": true})
		_check(sim.snapshot().tide_survey.progress == 0.0, "outside radius or exact speed limit resets sample: " + mode)
	var times: Array = []
	for config: Array in [[0, []], [1, []], [2, []], [1, ["sonar"]]]:
		var probe := _sim(config[1])
		probe.position = stations[0]
		var ticks := 0
		while probe.snapshot().tide_survey.completed == 0 and ticks < 300:
			probe.step(DT, {"power": config[0], "scan": true, "slow": true})
			ticks += 1
		times.append(ticks)
		_check(probe.snapshot().tide_survey.completed == 1 and not probe.scanned, "one real continuous sample in profile %s" % [config])
		probe.step(DT, {"power": 1})
		_check(probe.snapshot().tide_survey.completed == 1, "release preserves the already completed A sample")
	_check(times[1] == 150 and times[3] < times[1] and times[0] > times[1] and times[2] > times[1],
		"stock Search takes 2.5 seconds; sensors and power routing change sample duration: %s" % [times])
	var quiet := _sim()
	var active := _sim()
	var amplified := _sim(["sonar"])
	for probe in [quiet, active, amplified]:
		probe.position = stations[0]
	for tick in 60:
		quiet.step(DT, {"power": 1, "slow": true})
		active.step(DT, {"power": 1, "slow": true, "scan": true})
		amplified.step(DT, {"power": 1, "slow": true, "scan": true})
	_check(quiet.battery > active.battery and active.battery > amplified.battery,
		"station work uses real sonar draw; the fast sonar loadout pays more energy per second")
	active.reset()
	_check(not active.snapshot().has("tide_survey") and active.contract == Sim.CONTRACTS["black-tide"],
		"quickplay reset removes all chart geometry and sampling state")


func _atomic_overlays() -> void:
	var sim := _sim()
	var before := sim.snapshot()
	var bad := _spec()
	bad.contract.tide_stations[0] = Vector2.ZERO
	_check(not sim.reset_expedition(bad) and sim.snapshot() == before, "caller cannot alter authored stations")
	bad = _spec()
	bad.contract.current_scale = 0.1
	_check(not sim.reset_expedition(bad) and sim.snapshot() == before, "chart launch cannot smuggle its own current discount")
	bad = _spec(RECOVERY, [CHART])
	bad.contract.current_scale = 0.1
	_check(not sim.reset_expedition(bad) and sim.snapshot() == before, "recovery current discount rebuilt from delivered ID")


func _flow_fixtures() -> void:
	for risk: String in ["safe", "high"]:
		var chart := Sim.new()
		_check(chart.reset_expedition(_spec(RECOVERY, ["black-tide-chart-" + risk])), "delivered chart recovery starts")
		chart.step(DT, {})
		var scale: float = chart.contract.current_scale
		var hazard: Dictionary = chart.contract.hazards[1]
		var at: Vector2 = hazard.position + Vector2(5, 0)
		var normal := Sim.new()
		normal.reset_expedition(_spec(RECOVERY, ["black-tide-survey-safe"]))
		# Matched-time/weather field fixtures isolate ONLY the new local eddy term.
		normal.mission_time = chart.mission_time
		normal.storm_intensity = chart.storm_intensity
		var far := Vector2(-100, 100)
		var background: Vector2 = Vector2(sin(chart.mission_time * 0.32), -cos(chart.mission_time * 0.21)) * (0.32 + chart.storm_intensity * 0.52)
		var local: Vector2 = chart._flow(at) - background
		var ordinary: Vector2 = normal._flow(at) - background
		_check(local.distance_to(ordinary * scale) < 0.000001 and local.length() < ordinary.length(),
			"measured local eddy is ×%.2f after %s chart delivery" % [scale, risk])
		_check(chart._flow(far) == normal._flow(far), "chart does not change base drift outside local eddies")
	var old := Catalog.build_contract(RECOVERY, 0, ["black-tide-survey-safe"])
	_check(not old.has("current_scale"), "old successful tide logger path retains its old overlay")
	var later: Array = [CHART, RECOVERY]
	var later_quote := Catalog.build_contract("needle-bank-chart-safe", 0, later)
	_check(not later_quote.has("current_scale"), "previous-sector chart does not discount next-sector local flow")


func _settlement_fixtures() -> void:
	var launch := State.act(State.new_campaign(), "launch", {"offer_id": CHART})
	_check(launch.ok, "rules accept chart as one of original six branch deployments")
	var active: Dictionary = launch.state
	var snap := Rules.terminal_fixture(active)
	_check(not State.act(active, "settle", {"token": active.active.token, "snapshot": snap}).ok,
		"even a terminal fixture cannot settle a chart without both recorded samples")
	snap.tide_survey = {"completed": 1}
	_check(not State.act(active, "settle", {"token": active.active.token, "snapshot": snap}).ok, "one sample is not a deliverable chart")
	snap.tide_survey.completed = 2
	var settled := State.act(active, "settle", {"token": active.active.token, "snapshot": snap})
	_check(settled.ok and settled.state.path == [CHART], "delivered chart ID is the only extra durable proof; v1 state schema unchanged")
	var interrupted := State.act(active, "recover_interrupted")
	_check(interrupted.ok and interrupted.state.path.is_empty(), "no final frame on interruption means no saved sample benefit")
	var fixture := Sim.new()
	_check(fixture.reset_expedition(State.launch_spec(active)), "abandon fixture matches the real deployment identity")
	var abandoned := State.act(active, "abandon", {"token": active.active.token, "snapshot": fixture.snapshot()})
	_check(abandoned.ok and abandoned.state.path.is_empty(), "abandon before delivery yields neither chart path nor flow discount")


func _natural(id: String) -> void:
	var launch := State.act(State.new_campaign(), "launch", {"offer_id": id})
	var sim := Sim.new()
	_check(launch.ok and sim.reset_expedition(State.launch_spec(launch.state)), "natural chart departure from paid State envelope")
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var view := sim.snapshot()
	var samples: Array = []
	var scan := 0
	var attach := 0
	var hold := 0
	var tick := 0
	for step in ceili(view.deadline / DT) + 2:
		var input := Driver.controls(sim, view, cursor)
		var completed: int = view.tide_survey.completed
		view = sim.step(DT, input)
		tick = step + 1
		if view.tide_survey.completed > completed:
			samples.append(tick)
		if scan == 0 and view.scanned:
			scan = tick
		if attach == 0 and view.tow_attached:
			attach = tick
		hold = hold + 1 if view.dock > 0 else 0
		if view.phase in ["success", "failed"]:
			break
	print("TIDE NATURAL %s phase=%s tick=%d t=%.2f/%.0f samples=%s scan=%d tow=%d hold=%d hull=%.1f battery=%.1f pos=%s reason=%s" % [
		id, view.phase, tick, view.time, view.deadline, samples, scan, attach, hold, view.hull, view.battery, view.position, view.fail_reason])
	_check(view.phase == "success" and samples.size() == 2 and scan > samples.back() and attach > scan and hold >= 60,
		"input-only ordered sampling, capsule scan, tow and stable two-body delivery: " + id)
	var result := State.act(launch.state, "settle", {"token": view.expedition_token, "snapshot": view})
	_check(result.ok and result.state.path == [id], "actual terminal produces the chart benefit only after delivery")


func _check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + message)
