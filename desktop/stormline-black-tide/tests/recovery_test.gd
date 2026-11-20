extends SceneTree
## Active post-impact return recovery; model only, never injects a terminal result.

const Sim = preload("res://src/storm_sim.gd")
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 120
const REEF_NAME := "旧防波堤"

var _checks := 0
var _failures := 0


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("recovery_test.gd requires --headless")
		quit(1)
		return
	_run_recovery()
	_run_compound_recovery()
	print("Stormline post-impact recovery: %d checks, %d failures; deterministic controls/model only, not a full interactive route." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _run_recovery() -> void:
	var sim := Sim.new()
	sim.reset("black-tide")
	var reef: Dictionary = {}
	for hazard: Dictionary in sim.contract.hazards:
		if hazard.kind == "reef" and hazard.name == REEF_NAME:
			reef = hazard
	_check(not reef.is_empty(), "recovery contract includes the selected reef")
	if reef.is_empty():
		return

	# Begin in an active tow state near the reef, then resolve a real model contact.
	# This is a post-impact recovery fixture, not a success-state or score injection.
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 20.0
	sim.heading = PI
	var center: Vector2 = reef.position
	var tug_margin := float(reef.radius) + 1.55
	var cargo_margin := float(reef.radius) + 1.10
	sim.position = center + Vector2(0.0, -(tug_margin - 0.05))
	sim.velocity = Vector2(0.0, 2.0)
	sim.cargo_position = sim.position + Vector2(0.0, -12.0)
	sim.cargo_velocity = Vector2.ZERO
	sim.rope_length = 14.0
	sim._apply_reefs(DT)
	_check(sim.hull < 100.0 and sim.hull > 0.0, "reef contact produces nonfatal tug damage")
	_check(sim.cargo_integrity == 100.0 and sim.tow_attached and sim.phase == "return",
		"isolated tug scrape preserves pod integrity and active tow")
	_check(sim.event_kind == "collision" and sim.event_message.contains(REEF_NAME),
		"impact reports the selected reef")
	if sim.phase != "return" or sim.hull <= 0.0 or not sim.tow_attached:
		return

	var route: Array[Vector2] = [center + Vector2(-18.0, -16.0), Vector2(3.0, 8.0)]
	var leg := 0
	var dock_hold := 0
	var ticks := 0
	var harbor: Vector2 = sim.contract.harbor
	var radius := float(sim.contract.harbor_radius)
	for tick in range(1, MAX_TICKS + 1):
		var state: Dictionary = sim.snapshot()
		var tug_distance: float = state.position.distance_to(harbor)
		var cargo_distance: float = state.cargo_position.distance_to(harbor)
		var input: Dictionary
		if leg < route.size() and state.position.distance_to(route[leg]) < 7.0:
			leg += 1
		var both_inside := tug_distance <= radius and cargo_distance <= radius
		if both_inside:
			input = {"power": 2, "slow": true}
		else:
			var goal: Vector2 = route[leg] if leg < route.size() else harbor + Vector2(0.0, radius * 0.45)
			var near_harbor := tug_distance < radius + 12.0
			input = _pilot(state, goal, 3.2 if near_harbor else 4.6, 2, near_harbor)
			input.reel = -0.5 if state.tension < 0.45 else 0.0
		var previous_dock := sim.dock
		sim.step(DT, input)
		if sim.dock > previous_dock:
			dock_hold += 1
		else:
			dock_hold = 0
		ticks = tick
		if sim.phase in ["success", "failed"]:
			break

	_check(sim.phase == "success", "damaged active tow returns and docks through controlled sailing; phase=%s leg=%d ticks=%d reason=%s" % [sim.phase, leg, ticks, sim.fail_reason])
	if sim.phase == "success":
		_check(sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			"recovery finishes with both bodies operational and battery remaining")
		_check(sim.report.has("score") and sim.report.score >= 0 and sim.report.score <= 10000,
			"only the actual docking transition creates a bounded success report")
		_check(sim.position.distance_to(harbor) <= radius and sim.cargo_position.distance_to(harbor) <= radius,
			"recovery success still requires both tug and pod inside the harbor")
		_check(dock_hold >= 60, "recovery success observes the full stable docking hold")


func _run_compound_recovery() -> void:
	var scenarios: Array[Dictionary] = [
		{"name": "standard", "hull": 40.0, "cargo": 42.0, "battery": 24.0, "success": true},
		{"name": "hull-edge", "hull": 16.0, "cargo": 42.0, "battery": 24.0, "success": true},
		{"name": "cargo-edge", "hull": 40.0, "cargo": 13.0, "battery": 24.0, "success": true},
		{"name": "battery-edge", "hull": 40.0, "cargo": 42.0, "battery": 17.0, "success": true},
		{"name": "hull-exhausted", "hull": 15.0, "cargo": 42.0, "battery": 24.0, "success": false},
		{"name": "cargo-exhausted", "hull": 40.0, "cargo": 12.2, "battery": 24.0, "success": false},
		{"name": "battery-exhausted", "hull": 40.0, "cargo": 42.0, "battery": 16.0, "success": false},
	]
	for scenario: Dictionary in scenarios:
		_run_compound_case(scenario)


func _run_compound_case(scenario: Dictionary) -> void:
	var label: String = scenario.name
	var sim := Sim.new()
	sim.reset("black-tide")
	var reef: Dictionary = {}
	for hazard: Dictionary in sim.contract.hazards:
		if hazard.kind == "reef" and hazard.name == REEF_NAME:
			reef = hazard
	_check(not reef.is_empty(), "compound-risk route includes the selected reef")
	if reef.is_empty():
		return

	# Start with carried damage, low but nonzero battery, and later mission time
	# so the existing weather model supplies a stronger deterministic flow phase.
	# Then produce fresh tug and pod damage through a real two-body reef response.
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 80.0
	sim._update_weather()
	sim.hull = scenario.hull
	sim.cargo_integrity = scenario.cargo
	sim.battery = scenario.battery
	sim.power_profile = 2
	var center: Vector2 = reef.position
	var tug_margin := float(reef.radius) + 1.55
	var cargo_margin := float(reef.radius) + 1.10
	var tug_normal := Vector2.UP
	var cargo_normal := Vector2.UP.rotated(0.68)
	sim.heading = PI
	sim.position = center + tug_normal * (tug_margin - 0.05)
	sim.velocity = -tug_normal * 2.0
	sim.cargo_position = center + cargo_normal * (cargo_margin - 0.05)
	sim.cargo_velocity = -cargo_normal * 2.0
	sim.rope_length = Sim.ROPE_MIN
	var hull_before_contact := sim.hull
	var cargo_before_contact := sim.cargo_integrity
	sim._apply_reefs(DT)
	_check(sim.hull < hull_before_contact and sim.cargo_integrity < cargo_before_contact,
		label + " fixture receives real tug and pod reef-impact damage")
	_check(sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery == scenario.battery
		and sim.tow_attached and sim.phase == "return",
		label + " setup starts the route with live resources and an active tow")
	_check(sim.event_kind == "collision" and sim.event_message.contains(REEF_NAME),
		label + " reef impact retains a concrete collision event")
	if sim.hull <= 0.0 or sim.cargo_integrity <= 0.0 or not sim.tow_attached:
		return

	var route: Array[Vector2] = [center + Vector2(-18.0, -16.0), Vector2(3.0, 8.0)]
	var leg := 0
	var dock_hold := 0
	var ticks := 0
	var peak_storm := sim.storm_intensity
	var peak_wind := sim.wind.length()
	var harbor: Vector2 = sim.contract.harbor
	var radius := float(sim.contract.harbor_radius)
	for tick in range(1, MAX_TICKS + 1):
		var state: Dictionary = sim.snapshot()
		var tug_distance: float = state.position.distance_to(harbor)
		var cargo_distance: float = state.cargo_position.distance_to(harbor)
		var input: Dictionary
		if leg < route.size() and state.position.distance_to(route[leg]) < 7.0:
			leg += 1
		var both_inside := tug_distance <= radius and cargo_distance <= radius
		if both_inside:
			input = {"power": 2, "slow": true}
		else:
			var goal: Vector2 = route[leg] if leg < route.size() else harbor + Vector2(0.0, radius * 0.45)
			var near_harbor := tug_distance < radius + 12.0
			input = _pilot(state, goal, 3.2 if near_harbor else 4.6, 2, near_harbor)
			input.reel = -0.5 if state.tension < 0.45 else 0.0
		var previous_dock := sim.dock
		sim.step(DT, input)
		peak_storm = maxf(peak_storm, sim.storm_intensity)
		peak_wind = maxf(peak_wind, sim.wind.length())
		if sim.dock > previous_dock:
			dock_hold += 1
		else:
			dock_hold = 0
		ticks = tick
		if sim.phase in ["success", "failed"]:
			break

	var expect_success: bool = scenario.success
	_check((sim.phase == "success") == expect_success,
		label + " reaches the expected success/failure boundary; phase=%s leg=%d ticks=%d hull=%.1f pod=%.1f battery=%.1f reason=%s" % [sim.phase, leg, ticks, sim.hull, sim.cargo_integrity, sim.battery, sim.fail_reason])
	print("MODEL compound_recovery/%s: phase=%s ticks=%d t=%.2fs hull=%.1f pod=%.1f battery=%.1f peak_storm=%.3f peak_wind=%.3f peak_tension=%.3f reason=%s" % [label, sim.phase, ticks, sim.mission_time, sim.hull, sim.cargo_integrity, sim.battery, peak_storm, peak_wind, sim.peak_tension, sim.fail_reason])
	if expect_success and sim.phase == "success":
		_check(sim.hull > 0.0 and sim.cargo_integrity > 0.0 and sim.battery > 0.0,
			label + " recovery reaches harbor before any survival resource is exhausted")
		_check(peak_storm >= 0.70 and peak_wind >= 2.4,
			label + " recovery traverses a measured high-storm wind phase; peak=%.3f/%.3f" % [peak_storm, peak_wind])
		_check(sim.report.has("score") and not sim.report.is_empty()
			and sim.position.distance_to(harbor) <= radius
			and sim.cargo_position.distance_to(harbor) <= radius,
			label + " success and score require an actual two-body harbor transition")
		_check(dock_hold >= 60 and sim.dock == 1.0,
			label + " delivery still observes the full stable docking hold")
	if not expect_success:
		_check(sim.phase == "failed" and sim.report.is_empty() and not sim.fail_reason.is_empty(),
			label + " resource exhaustion fails safely without creating a success report")
		var expected_reason := "电量耗尽" if label == "battery-exhausted" else (
			"船体耐久归零" if label == "hull-exhausted" else "回收舱破损")
		var expected_kind := "power_lost" if label == "battery-exhausted" else "collision"
		_check(sim.fail_reason.contains(expected_reason) and sim.event_kind == expected_kind,
			label + " retains the specific exhausted-resource failure classification")
		var terminal: Dictionary = sim.snapshot()
		sim.step(DT, {"throttle": 1.0, "tow_pressed": true})
		_check(sim.snapshot() == terminal,
			label + " terminal failure cannot advance, resume or manufacture a later score")


func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow: bool) -> Dictionary:
	var pos: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading: float = state.heading
	var course := goal - pos - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var along := velocity.dot(forward)
	var throttle := clampf((speed * maxf(0.0, cos(error)) - along) * 0.26, -0.65, 1.0)
	return {"throttle": throttle, "steer": clampf(error * 2.2, -1.0, 1.0), "power": power, "slow": slow}


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
