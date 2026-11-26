extends SceneTree
## Explicit accounting/lifecycle fixtures; not navigation or human play.
const Sim = preload("res://src/storm_sim.gd")
const State = preload("res://src/expedition_state.gd")
const DT := 1.0 / 60.0
var checks := 0
var failures := 0


func _init() -> void:
	_component_matrix()
	var state := State.new_campaign(true)
	state.damage_control.breach = 2.0
	state = State.act(state, "launch", {"offer_id": "black-tide-survey-safe"}).state
	var spec := State.launch_spec(state)
	var sim := Sim.new()
	_expect(sim.reset_expedition(spec), "launch accepted")
	var start := sim.snapshot()
	_expect(_sum(start.energy_budget.rate) == 0.0 and _sum(start.energy_budget.spent) == 0.0, "new voyage has no fabricated previous tick")
	var balanced := true
	for tick in 600:
		var before := sim.snapshot()
		var view := sim.step(DT, {"power": tick % 3, "throttle": -0.4 if tick % 2 == 0 else 0.7,
			"scan": tick % 5 < 2, "pump_pressed": tick % 120 == 0, "steer": 0.2})
		balanced = balanced and absf(_sum(view.energy_budget.rate) - view.energy_budget.rate.total) < 1e-10 \
			and absf(_sum(view.energy_budget.spent) - view.energy_budget.spent.total) < 1e-9 \
			and absf(start.battery - view.battery - view.energy_budget.spent.total) < 1e-9 \
			and absf(view.energy_budget.spent.total - before.energy_budget.spent.total - (before.battery - view.battery)) < 1e-10
	_expect(balanced and sim.snapshot().energy_budget.spent.flood > 0 and sim.snapshot().energy_budget.spent.pump > 0,
		"600 active ticks conserve all components and actual battery with switching devices")
	var before := sim.snapshot()
	var public := sim.snapshot()
	public.energy_budget.rate.total = 999.0
	public.energy_budget.spent.pump = -50.0
	_expect(sim.snapshot() == before, "telemetry projections are deep independent copies")
	for delta: float in [0.0, -1.0, NAN, INF]:
		_expect(sim.step(delta, {"throttle": 1.0}) == before, "invalid delta cannot fabricate consumption")
	var invalid := spec.duplicate(true)
	invalid.damage_control.kits = 9
	_expect(not sim.reset_expedition(invalid) and sim.snapshot() == before, "rejected launch preserves previous energy账")
	# Deliberately tiny reserve: same original budget reaches zero this tick.
	sim.battery = 0.001
	var terminal := sim.step(DT, {"throttle": 1.0, "scan": true, "pump_pressed": not sim._damage.pump_on})
	_expect(terminal.phase == "failed" and terminal.event_kind == "power_lost" and terminal.battery == 0,
		"synthetic final reserve follows original exhaustion rule")
	_expect(absf(terminal.energy_budget.spent.total - before.energy_budget.spent.total - 0.001) < 1e-10
		and absf(_sum(terminal.energy_budget.spent) - terminal.energy_budget.spent.total) < 1e-9,
		"last tick prorates components to actual deduction instead of charging unavailable power")
	_expect(sim.step(60.0, {"throttle": 1.0}) == terminal, "terminal energy账 freezes")
	for key: String in ["idle", "propulsion", "flood", "sonar", "tow", "pump"]:
		_expect(absf(terminal.energy_budget.spent[key] - before.energy_budget.spent[key]
			- 0.001 * terminal.energy_budget.rate[key] / terminal.energy_budget.rate.total) < 1e-10,
			"exhausted reserve prorates individual component: " + key)
	_expect(sim.reset_expedition(spec) and sim.snapshot().energy_budget.spent.total == 0
		and sim.snapshot().energy_budget.rate.total == 0, "fresh deployment clears previous voyage账")
	sim.reset("needle-bank")
	_expect(not sim.snapshot().has("energy_budget"), "quickplay has no new energy extension")
	var legacy: Dictionary = State.act(State.new_campaign(), "launch", {"offer_id": "black-tide-survey-safe"}).state
	_expect(sim.reset_expedition(State.launch_spec(legacy)) and not sim.snapshot().has("energy_budget"), "legacy expedition snapshot unchanged")
	print("Stormline energy-budget fixtures: %d checks, %d failures; synthetic accounting/lifecycle only." % [checks, failures])
	quit(0 if failures == 0 else 1)


func _component_matrix() -> void:
	# Synthetic boundary fixtures; live water/tow/battery assignments are intentional.
	for modules: Array in [[], ["drive", "sonar"], ["tow", "sonar"]]:
		var state := State.new_campaign(true)
		for id: String in modules:
			state = State.act(state, "buy", {"module_id": id}).state
			state = State.act(state, "equip", {"module_id": id}).state
		state.damage_control.breach = 2.0
		state = State.act(state, "launch", {"offer_id": "black-tide-survey-safe"}).state
		var effects := Sim.Catalog.loadout_effects(modules)
		for water: float in [0.0, 40.0, 99.0]:
			for power in 3:
				for throttle_value: float in [0.0, 0.75, -0.75]:
					for scan: bool in [false, true]:
						for tow: bool in [false, true]:
							for pump: bool in [false, true]:
								var sim := Sim.new()
								_expect(sim.reset_expedition(State.launch_spec(state)), "matrix launch")
								sim._damage.water = water
								if tow:
									sim.scanned = true
									sim.tow_attached = true
									sim.phase = "return"
									sim.cargo_position = sim.position + Vector2(0, 6)
								var mult: float = effects.energy
								var base := absf(throttle_value) * (0.4 if power == 0 else 0.3)
								var expected := {"idle": 0.13 * mult, "propulsion": base * mult,
									"flood": base * water * 0.0035 * mult,
									"sonar": (0.20 + float(Sim.PROFILES[power].sensors) * float(effects.sensors) * 0.22) * mult if scan and not tow else 0.0,
									"tow": (0.08 + 0.5 * 0.19) * mult if tow else 0.0,
									"pump": 0.45 if pump else 0.0}
								var view := sim.step(DT, {"power": power, "throttle": throttle_value, "scan": scan,
									"reel": -0.5, "pump_pressed": pump})
								for key: String in expected:
									_expect(absf(view.energy_budget.rate[key] - expected[key]) < 1e-10
										and absf(view.energy_budget.spent[key] - expected[key] * DT) < 1e-10,
										"individual rate/spend %s modules=%s water=%s power=%s throttle=%s scan=%s tow=%s pump=%s" % [key, modules, water, power, throttle_value, scan, tow, pump])
	var dry: Dictionary = State.act(State.new_campaign(true), "launch", {"offer_id": "black-tide-survey-safe"}).state
	var sim := Sim.new()
	sim.reset_expedition(State.launch_spec(dry))
	var view := sim.step(60.0, {"pump_pressed": true})
	_expect(view.damage_control.pump_on and not view.damage_control.pump_active and view.energy_budget.rate.pump == 0.0,
		"dry latched pump has no fabricated pump spend")
	_expect(absf(view.energy_budget.spent.total - 0.13 / 30.0) < 1e-10, "stalled-frame clamp accounts only accepted dt")
	sim.reset_expedition(State.launch_spec(dry))
	sim.position = sim.cargo_position
	sim.scan_progress = 0.999
	view = sim.step(DT, {"power": 1, "scan": true})
	_expect(view.scanned and view.energy_budget.rate.sonar > 0.0, "scan-lock completion tick charges active sonar")
	view = sim.step(DT, {"power": 1, "scan": true})
	_expect(view.energy_budget.rate.sonar == 0.0, "held scan after lock does not charge inactive sonar")


func _sum(components: Dictionary) -> float:
	var total := 0.0
	for key: String in ["idle", "propulsion", "flood", "sonar", "tow", "pump"]:
		total += float(components[key])
	return total


func _expect(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + message)
