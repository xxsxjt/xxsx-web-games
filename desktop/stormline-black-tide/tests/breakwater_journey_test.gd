extends SceneTree
## Natural, fixed-tick contract journeys with input-only steering.
## Reusable by the application lifecycle suite: preload this script and call
## controls_for()/route_index_for(), then pass the controls through real app input.
const Sim = preload("res://src/storm_sim.gd")
const DT := 1.0 / 60.0
const WAYPOINT_RADIUS := 7.0
const ROUTE_WAYPOINT_RADIUS := WAYPOINT_RADIUS
const MAX_TICKS := 60 * 215
const ROUTES := {
	"safe": {
		"outbound": [Vector2(-45, 10), Vector2(-67, -35), Vector2(-60, -75)],
		"return": [Vector2(-65, -100), Vector2(15, -102), Vector2(62, -98), Vector2(63, -27), Vector2(55, 17)],
	},
	"shortcut": {
		"outbound": [Vector2(23, -5), Vector2(45, -45), Vector2(-45, -59)],
		"return": [Vector2(-45, -59), Vector2(45, -45), Vector2(54, -28), Vector2(55, 17)],
	},
}
const OLD_CONTRACT_EXPECTED := {
	"black-tide": {"id": "black-tide", "name": "黑潮回收", "subtitle": "01 / BREAKWATER · 基础航线", "briefing": "找到北侧失联舱，低速扫描并挂索。沿港口灯带返航，拖船和回收舱都要进入青色港圈。", "harbor": Vector2(0, 22), "start": Vector2(0, 13), "harbor_radius": 18.0, "beacon": Vector2(0, -75), "target": Vector2(8, -88), "deadline": 145.0, "wind_angle": 0.28, "severity": 0.48, "mass": 2.3, "hazards": [{"position": Vector2(-25, -34), "radius": 10.0, "name": "黑礁", "kind": "reef"}, {"position": Vector2(28, -57), "radius": 14.0, "name": "碎浪回旋", "kind": "current"}, {"position": Vector2(-32, -85), "radius": 9.0, "name": "沉没栈桥", "kind": "reef"}, {"position": Vector2(31, -5), "radius": 9.0, "name": "旧防波堤", "kind": "reef"}]},
	"needle-bank": {"id": "needle-bank", "name": "针礁水道", "subtitle": "02 / NEEDLE BANK · 偏航回旋", "briefing": "浪流更强，舱体更重。中央针礁挡住直线；利用雷达绕开礁圈，转弯前收油，给回旋水流留出减速距离。", "harbor": Vector2(-51, 57), "start": Vector2(-51, 48), "harbor_radius": 17.0, "beacon": Vector2(38, -80), "target": Vector2(49, -92), "deadline": 195.0, "wind_angle": 2.33, "severity": 0.73, "mass": 3.0, "hazards": [{"position": Vector2(-29, 17), "radius": 12.0, "name": "港外尖礁", "kind": "reef"}, {"position": Vector2(2, -22), "radius": 17.0, "name": "中央针礁", "kind": "reef"}, {"position": Vector2(27, -51), "radius": 20.0, "name": "断浪急流", "kind": "current"}, {"position": Vector2(67, -77), "radius": 10.0, "name": "东翼礁", "kind": "reef"}, {"position": Vector2(-34, -55), "radius": 13.0, "name": "浅滩回旋", "kind": "current"}]},
}
const OLD_NATURAL_BASELINES := {
	"black-tide": {"position": Vector2(81.57569, 53.73254), "velocity": Vector2(-2.996451, 2.067243), "heading": -2.270900478, "cargo_position": Vector2(8.622864, -87.93658), "cargo_velocity": Vector2(0.208351, -0.131607), "hull": 58.273435624, "cargo_integrity": 100.0, "battery": 71.08, "storm": 0.254628915},
	"needle-bank": {"position": Vector2(-102.3465, 110.489), "velocity": Vector2(-3.56838, 2.524426), "heading": -2.392568738, "cargo_position": Vector2(48.03157, -92.45369), "cargo_velocity": Vector2(0.343419, 0.145835), "hull": 100.0, "cargo_integrity": 100.0, "battery": 71.08, "storm": 0.504628915},
}
var _checks := 0
var _failures := 0


static func route_index_for(state: Dictionary, leg: String, route_index: int, route_choice: String = "safe") -> int:
	var route: Array = ROUTES.get(route_choice, ROUTES.safe).get(leg, [])
	var index := clampi(route_index, 0, route.size())
	var position: Vector2 = state.position
	while index < route.size() and position.distance_to(route[index]) <= ROUTE_WAYPOINT_RADIUS:
		index += 1
	return index


static func controls_for(sim, leg: String, route_index: int, last_tow_input: bool = false, route_choice: String = "safe") -> Dictionary:
	var state: Dictionary = sim.snapshot()
	var input := {"power": 1}
	match leg:
		"outbound":
			var beacon: Vector2 = state.beacon
			var route: Array = ROUTES.get(route_choice, ROUTES.safe).outbound
			var goal: Vector2 = route[route_index] if route_index < route.size() else beacon - (beacon - state.harbor).normalized() * 7.0
			var scan_zone: bool = state.position.distance_to(beacon) < 24.0
			input = _pilot(state, goal, 3.8 if scan_zone else 8.0, 1)
			input.scan = scan_zone
		"cargo":
			var direction: Vector2 = (state.beacon - state.harbor).normalized()
			var goal: Vector2 = state.cargo_position - direction * 9.0
			input = _pilot(state, goal, 2.8, 2, true)
			var relative_speed: float = (state.velocity - state.cargo_velocity).length()
			var ready: bool = state.scanned and state.position.distance_to(state.cargo_position) < 11.0 and relative_speed < 1.6
			input.tow_pressed = ready and not last_tow_input
		"return":
			var harbor: Vector2 = state.harbor
			var route: Array = ROUTES.get(route_choice, ROUTES.safe).return
			var both_inside: bool = state.position.distance_to(harbor) <= state.harbor_radius and state.cargo_position.distance_to(harbor) <= state.harbor_radius
			if both_inside:
				input = {"power": 2, "slow": true}
			else:
				var goal: Vector2 = route[route_index] if route_index < route.size() else harbor - (state.beacon - harbor).normalized() * state.harbor_radius * 0.45
				input = _pilot(state, goal, 3.4 if state.position.distance_to(harbor) < state.harbor_radius + 15.0 else 5.0, 2, state.position.distance_to(harbor) < state.harbor_radius + 15.0)
				input.reel = -0.5 if state.tension < 0.45 else 0.0
	return input


static func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow: bool = false) -> Dictionary:
	var position: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading: float = state.heading
	var course := goal - position - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var along := velocity.dot(forward)
	var throttle := clampf((speed * maxf(0.0, cos(error)) - along) * 0.26, -0.65, 1.0)
	return {"throttle": throttle, "steer": clampf(error * 2.2, -1.0, 1.0), "power": power, "slow": slow}


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("breakwater_journey_test.gd requires --headless")
		quit(1)
		return
	_check(Sim.CONTRACTS.has("cross-current"), "contract ID is registered")
	if Sim.CONTRACTS.has("cross-current"):
		var contract_data: Dictionary = Sim.CONTRACTS["cross-current"]
		_check(contract_data.id == "cross-current" and contract_data.name == "碎潮回廊" and contract_data.subtitle.begins_with("03"), "third contract identity and HUD fields")
		_check(contract_data.deadline <= 220.0 and _within_world(contract_data.harbor) and _within_world(contract_data.start) and _within_world(contract_data.beacon) and _within_world(contract_data.target), "deadline and coordinates stay in model limits")
		_check(contract_data.hazards.size() >= 5 and ROUTES.size() == 2 and ROUTES.safe.outbound.size() >= 3 and ROUTES.shortcut.outbound.size() >= 3, "charted hazard corridor offers two distinct routes")
		_check(ROUTES.safe.outbound[0].distance_to(ROUTES.shortcut.outbound[0]) > 30.0 and ROUTES.safe.outbound[1].distance_to(ROUTES.shortcut.outbound[1]) > 30.0, "safe outer bypass and current-cutting shortcut differ materially")
	_check_old_contracts_unchanged()
	_check_old_natural_baselines()
	_run_journey("safe")
	_run_journey("shortcut")
	_run_timeout_and_reset()
	print("Breakwater natural journeys: checks=%d failures=%d; routes=safe,shortcut; desktop play not tested." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check_old_contracts_unchanged() -> void:
	for id: String in OLD_CONTRACT_EXPECTED:
		var actual: Dictionary = Sim.CONTRACTS[id]
		var expected: Dictionary = OLD_CONTRACT_EXPECTED[id]
		_check(actual == expected, "%s complete contract dictionary unchanged" % id)


func _check_old_natural_baselines() -> void:
	for id: String in OLD_NATURAL_BASELINES:
		var sim = Sim.new()
		sim.reset(id)
		_check(sim.contract_id == id and sim.snapshot().contract_id == id, "%s reset selects exact contract" % id)
		var state: Dictionary
		for tick in range(1, 7201):
			var controls := {"throttle": 0.37, "steer": 0.16 if tick < 1300 else -0.11, "power": 1}
			sim.step(DT, controls)
		state = sim.snapshot()
		var expected: Dictionary = OLD_NATURAL_BASELINES[id]
		_check(state.phase == "approach" and is_equal_approx(state.time, 120.0), "%s fixed-input 120s natural baseline phase/time" % id)
		for key: String in ["position", "velocity", "cargo_position", "cargo_velocity"]:
			_check(state[key].distance_to(expected[key]) < 0.002, "%s fixed-input baseline %s=%s expected=%s" % [id, key, state[key], expected[key]])
		_check(absf(state.heading - expected.heading) < 0.00001 and absf(state.hull - expected.hull) < 0.00001 and absf(state.cargo_integrity - expected.cargo_integrity) < 0.00001 and absf(state.battery - expected.battery) < 0.00001 and absf(sim.storm_intensity - expected.storm) < 0.00001, "%s fixed-input baseline heading/resources/weather unchanged" % id)
		print("BASELINE %s 120s pos=%s velocity=%s heading=%.9f cargo=%s cargo_velocity=%s hull=%.9f integrity=%.9f battery=%.9f storm=%.9f" % [id, state.position, state.velocity, state.heading, state.cargo_position, state.cargo_velocity, state.hull, state.cargo_integrity, state.battery, sim.storm_intensity])


func _run_timeout_and_reset() -> void:
	var sim = Sim.new()
	sim.reset("cross-current")
	var state: Dictionary = sim.snapshot()
	for tick in range(1, 60 * 220 + 2):
		if state.phase in ["success", "failed"]:
			break
		sim.step(DT, {"power": 1, "throttle": 0.0})
		state = sim.snapshot()
	var fail_kind: String = state.event_kind
	var fail_reason: String = state.fail_reason
	_check(state.phase == "failed" and fail_kind == "timeout" and not fail_reason.is_empty() and state.report.is_empty(), "cross-current natural timeout is a real failed terminal without a success report")
	print("FAILURE cross-current timeout t=%.2f event=%s reason=%s" % [state.time, fail_kind, fail_reason])
	sim.reset("cross-current")
	state = sim.snapshot()
	_check(sim.contract_id == "cross-current" and state.contract_id == "cross-current" and state.phase == "approach" and state.position == Sim.CONTRACTS["cross-current"].start and state.cargo_position == Sim.CONTRACTS["cross-current"].target, "restart restores fresh contract origin and target after failure")
	_check(state.time == 0.0 and state.velocity == Vector2.ZERO and state.cargo_velocity == Vector2.ZERO and not state.scanned and not state.tow_attached and state.scan == 0.0 and state.dock == 0.0 and state.hull == 100.0 and state.cargo_integrity == 100.0 and state.battery == 100.0 and state.event_id == 0 and state.event_kind.is_empty() and state.fail_reason.is_empty() and state.report.is_empty(), "restart clears scan, tow, damage, timer, feedback, and report residue")


func _run_journey(route_choice: String) -> void:
	var label := "cross-current/%s" % route_choice
	var sim = Sim.new()
	sim.reset("cross-current")
	var state: Dictionary = sim.snapshot()
	_check(sim.contract_id == "cross-current" and state.contract_id == "cross-current" and state.phase == "approach" and state.time == 0.0 and not state.scanned and not state.tow_attached, "%s starts naturally at contract origin" % label)
	var leg := "outbound"
	var route_index := 0
	var last_tow_input := false
	var scan_tick := 0
	var attach_tick := 0
	var peak_tension := 0.0
	var dock_hold := 0
	var minimum_east_current_range := INF
	var traversed_current_zone := false
	var stage := "initial outbound"
	var tick := 0
	for frame in range(1, MAX_TICKS + 1):
		state = sim.snapshot()
		var before_controls: Dictionary = state.duplicate(true) if frame == 1 else {}
		if leg == "outbound" and state.scanned:
			leg = "cargo"
			route_index = 0
		if leg == "cargo" and state.tow_attached:
			leg = "return"
			route_index = 0
		if leg == "outbound" or leg == "return":
			route_index = route_index_for(state, leg, route_index, route_choice)
		var input := controls_for(sim, leg, route_index, last_tow_input, route_choice)
		if frame == 1:
			_check(sim.snapshot() == before_controls, "%s Pilot route and input helpers are read-only" % label)
		last_tow_input = bool(input.get("tow_pressed", false))
		var previous_scan: float = state.scan
		sim.step(DT, input)
		state = sim.snapshot()
		tick = frame
		if state.scan > previous_scan and input.get("scan", false):
			stage = "active sonar"
		if state.scanned and scan_tick == 0:
			scan_tick = frame
		if state.tow_attached and attach_tick == 0:
			attach_tick = frame
			stage = "towed return"
		if state.tow_attached:
			peak_tension = maxf(peak_tension, state.tension)
			for hazard: Dictionary in state.hazards:
				if hazard.kind == "current":
					var current_range: float = state.position.distance_to(hazard.position)
					minimum_east_current_range = minf(minimum_east_current_range, current_range)
					if current_range < hazard.radius:
						traversed_current_zone = true
			if state.dock > 0.0:
				dock_hold += 1
			else:
				dock_hold = 0
		if state.phase in ["success", "failed"]:
			break
	var metrics := "phase=%s tick=%d time=%.2f tug=%s cargo=%s hull=%.2f integrity=%.2f battery=%.2f peak_tension=%.3f min_current_range=%.2f current_zone=%s dock_hold=%d stage=%s" % [state.phase, tick, state.time, state.position, state.cargo_position, state.hull, state.cargo_integrity, state.battery, peak_tension, minimum_east_current_range, traversed_current_zone, dock_hold, stage]
	_check(state.phase == "success", "%s completes by actual input navigation, scan, tow, and docking; %s" % [label, metrics])
	_check(scan_tick > 0 and attach_tick > scan_tick and state.tow_attached and state.scanned, "%s sonar and edge-triggered tow occur in natural order; %s" % [label, metrics])
	_check(tick < MAX_TICKS and state.time < state.deadline and state.hull > 0.0 and state.cargo_integrity > 0.0 and state.battery > 0.0 and not state.report.is_empty(), "%s reaches success before timeout/resource failure; %s" % [label, metrics])
	_check(state.position.distance_to(state.harbor) <= state.harbor_radius and state.cargo_position.distance_to(state.harbor) <= state.harbor_radius and state.dock >= 1.0, "%s completes stable tow delivery inside harbor; %s" % [label, metrics])
	if route_choice == "shortcut":
		_check(traversed_current_zone and minimum_east_current_range < 27.0, "shortcut physically crosses east cross-current exposure; %s" % metrics)
	else:
		_check(minimum_east_current_range > 27.0, "safe route skirts the eastern current core; %s" % metrics)
	print("JOURNEY %s %s" % [label, metrics])
	sim.reset("cross-current")
	state = sim.snapshot()
	_check(sim.contract_id == "cross-current" and state.contract_id == "cross-current" and state.phase == "approach" and state.position == Sim.CONTRACTS["cross-current"].start and state.cargo_position == Sim.CONTRACTS["cross-current"].target, "%s re-open restores exact contract and spawn points" % label)
	_check(state.time == 0.0 and state.velocity == Vector2.ZERO and state.cargo_velocity == Vector2.ZERO and not state.scanned and not state.tow_attached and state.scan == 0.0 and state.dock == 0.0 and state.hull == 100.0 and state.cargo_integrity == 100.0 and state.battery == 100.0 and state.event_id == 0 and state.event_kind.is_empty() and state.fail_reason.is_empty() and state.report.is_empty(), "%s re-open clears completed-journey scan, tow, resources, clock, event and report" % label)


func _check(condition: bool, expectation: String) -> void:
	_checks += 1
	if not condition:
		_failures += 1
		printerr("FAIL: " + expectation)


func _within_world(point: Vector2) -> bool:
	return point.x >= -140.0 and point.x <= 140.0 and point.y >= -140.0 and point.y <= 140.0
