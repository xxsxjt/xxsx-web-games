extends SceneTree
## Run with Godot 4.3: --headless --audio-driver Dummy --path . --script res://tests/journey_test.gd
## Fixed-tick model regression only; no scene, desktop input, rendering, or audio.

const Sim = preload("res://src/storm_sim.gd")
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 120
const CONTRACTS := ["black-tide", "needle-bank"]
const DOCK_SPEED_LIMIT := 2.6
const DOCK_TENSION_LIMIT := 0.68
const DOCK_HOLD_MIN_TICKS := 60
const SIGNAL_RANGE := 24.0
# Needle Bank's marked harbor and central reefs straddle the direct bearing.
# Stay west on departure, go north around the central reef, and leave a wide
# outer turn for the trailing pod on the reverse route. These are helm goals.
const NEEDLE_OUTBOUND := [Vector2(-44, 0), Vector2(-29, -32), Vector2(2, -65)]
const NEEDLE_RETURN := [Vector2(11, -69), Vector2(-30, -35), Vector2(-45, 3)]
const REQUIRED_FIELDS := [
	"contract_id", "phase", "position", "velocity", "heading", "cargo_position",
	"cargo_velocity", "harbor", "beacon", "harbor_radius", "hazards", "tension",
	"hull", "cargo_integrity", "battery", "scanned", "scan", "tow_attached",
	"rope_length", "target_distance", "fail_reason", "report", "time", "dock",
	"event_kind",
]

var _checks := 0
var _failures := 0
var _completed := 0


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("journey_test.gd requires --headless")
		quit(1)
		return
	for id: String in CONTRACTS:
		_run_journey(id, false)
	_run_journey("black-tide", true)
	var scenario_count := CONTRACTS.size() + 1
	print("Stormline model journeys: %d/%d scenarios reached assertions, %d checks, %d failures; real-window play not tested." % [
		_completed, scenario_count, _checks, _failures])
	quit(0 if _failures == 0 and _completed == scenario_count else 1)


func _run_journey(id: String, overload: bool) -> void:
	var label := id + ("/overload" if overload else "/delivery")
	var sim := Sim.new()
	sim.reset(id)
	var state: Dictionary = sim.snapshot()
	if not _check(state.has_all(REQUIRED_FIELDS), label, "public snapshot covers the journey contract"):
		return
	if not _check(state.contract_id == id and state.phase == "approach"
			and not state.scanned and not state.tow_attached and is_zero_approx(state.time)
			and is_zero_approx(state.scan) and is_zero_approx(state.dock), label, "natural contract start"):
		return
	var start: Vector2 = state.position
	var harbor: Vector2 = state.harbor
	var harbor_radius: float = state.harbor_radius
	var beacon: Vector2 = state.beacon
	var outbound := (beacon - harbor).normalized()
	var ticks := 0
	var scan_tick := 0
	var scan_progress_ticks := 0
	var attach_tick := 0
	var last_tow_input := false
	var peak_tension := 0.0
	var overload_ticks := 0
	var dock_ticks := 0
	var dock_hold_ticks := 0
	var dock_progress_in_bounds := true
	var dock_max_tug_speed := 0.0
	var dock_max_cargo_speed := 0.0
	var dock_max_tension := 0.0
	var tug_arrived_first := false
	var tug_only_progress := false
	var stage := "public signal"
	var outward_leg := 0
	var return_leg := 0
	var outward_route := NEEDLE_OUTBOUND if id == "needle-bank" else []
	var return_route := NEEDLE_RETURN if id == "needle-bank" else []
	for tick in range(1, MAX_TICKS + 1):
		var pos: Vector2 = state.position
		var input: Dictionary
		if not state.scanned:
			var distance := pos.distance_to(beacon)
			if outward_leg < outward_route.size() and pos.distance_to(outward_route[outward_leg]) < 7.0:
				outward_leg += 1
			var scan_zone := distance < SIGNAL_RANGE
			var goal: Vector2 = outward_route[outward_leg] if outward_leg < outward_route.size() else beacon - outbound * 7.0
			stage = "scan" if scan_zone else "public signal leg %d" % outward_leg
			input = _pilot(state, goal, 4.0 if scan_zone else 9.0, 1 if scan_zone else 0)
			input.scan = scan_zone
		elif not state.tow_attached:
			stage = "attach"
			var cargo: Vector2 = state.cargo_position
			input = _pilot(state, cargo - outbound * 9.0, 3.0, 2, true)
			var relative_speed: float = (state.velocity - state.cargo_velocity).length()
			input.tow_pressed = not last_tow_input and pos.distance_to(cargo) < 11.0 and relative_speed < 1.6
		elif overload:
			stage = "unassisted overload"
			# A deliberately bad tow: max propulsion, hard reel-in, no slow assist.
			input = {"throttle": 1.0, "steer": _steer(state.heading, PI / 2.0), "power": 0, "reel": -1.0}
		else:
			stage = "harbor tow"
			var cargo: Vector2 = state.cargo_position
			var both_inside := pos.distance_to(harbor) <= harbor_radius and cargo.distance_to(harbor) <= harbor_radius
			var goal := harbor - outbound * harbor_radius * 0.45
			var near_harbor := pos.distance_to(harbor) < harbor_radius + 12.0
			if return_leg < return_route.size() and pos.distance_to(return_route[return_leg]) < 7.0:
				return_leg += 1
			if return_leg < return_route.size():
				goal = return_route[return_leg]
				stage = "harbor tow leg %d" % return_leg
			if both_inside:
				stage = "dock hold"
				input = {"power": 2, "slow": true}
			else:
				input = _pilot(state, goal, 3.2 if near_harbor else 5.0, 2, near_harbor)
				input.reel = -0.5 if state.tension < 0.45 else 0.0
		last_tow_input = input.get("tow_pressed", false)
		var previous_dock: float = state.dock
		var previous_scan: float = state.scan
		sim.step(DT, input)
		state = sim.snapshot()
		ticks = tick
		if scan_tick == 0 and state.scan > previous_scan and input.get("scan", false):
			scan_progress_ticks += 1
		if scan_tick == 0 and state.scanned:
			scan_tick = tick
			_check(input.get("scan", false) and pos.distance_to(beacon) < SIGNAL_RANGE
				and pos.distance_to(start) > 5.0 and is_equal_approx(state.scan, 1.0)
				and scan_progress_ticks > 1, label,
				"signal reached by sailing and sonar completes under scan input")
		if attach_tick == 0 and state.tow_attached:
			attach_tick = tick
			_check(scan_tick > 0 and scan_tick < attach_tick and last_tow_input
				and state.phase == "return", label, "tow edge after scan starts return")
		if attach_tick > 0:
			peak_tension = maxf(peak_tension, state.tension)
			if state.tension >= 1.0:
				overload_ticks += 1
			var tug_distance: float = state.position.distance_to(harbor)
			var cargo_distance: float = state.cargo_position.distance_to(harbor)
			if tug_distance < harbor_radius and cargo_distance > harbor_radius:
				tug_arrived_first = true
				tug_only_progress = tug_only_progress or state.dock > previous_dock or state.phase == "success"
			if state.dock > previous_dock:
				dock_ticks += 1
				dock_hold_ticks += 1
				dock_progress_in_bounds = dock_progress_in_bounds and tug_distance <= harbor_radius and cargo_distance <= harbor_radius
				dock_max_tug_speed = maxf(dock_max_tug_speed, state.velocity.length())
				dock_max_cargo_speed = maxf(dock_max_cargo_speed, state.cargo_velocity.length())
				dock_max_tension = maxf(dock_max_tension, state.tension)
			else:
				dock_hold_ticks = 0
		if state.phase == "success" or state.phase == "failed":
			break

	var metrics := _metrics(state, harbor, peak_tension, ticks)
	if not _check(state.phase == "success" or state.phase == "failed", label,
			"terminal state within %d ticks; stage=%s; %s" % [MAX_TICKS, stage, metrics]):
		return
	if overload:
		_check(state.phase == "failed" and attach_tick > scan_tick and scan_tick > 0
			and overload_ticks > 1 and state.event_kind == "snap" and not state.tow_attached
			and not String(state.fail_reason).is_empty() and state.report.is_empty(), label,
			"unassisted overload after a legitimate attachment; %s" % metrics)
		print("MODEL %s: %s; scan_tick=%d attach_tick=%d overload_ticks=%d" % [label, metrics, scan_tick, attach_tick, overload_ticks])
		_completed += 1
		return
	if not _check(state.phase == "success", label, "delivery succeeds; stage=%s; %s" % [stage, metrics]):
		return
	_check(state.tow_attached and state.scanned and scan_tick > 0 and attach_tick > scan_tick, label, "arrival retains the scanned tow")
	_check(tug_arrived_first and not tug_only_progress, label, "entry with tug alone did not advance docking")
	_check(dock_progress_in_bounds and state.position.distance_to(harbor) <= harbor_radius
		and state.cargo_position.distance_to(harbor) <= harbor_radius, label, "dock progress and finish require both tug and cargo inside")
	_check(dock_hold_ticks >= DOCK_HOLD_MIN_TICKS and is_equal_approx(state.dock, 1.0)
		and dock_max_tug_speed <= DOCK_SPEED_LIMIT and dock_max_cargo_speed <= DOCK_SPEED_LIMIT
		and dock_max_tension < DOCK_TENSION_LIMIT, label,
		"progress requires a sustained slow, low-tension hold")
	_check(state.hull > 0.0 and state.cargo_integrity > 0.0 and state.battery > 0.0
		and not state.report.is_empty() and String(state.fail_reason).is_empty(), label, "successful terminal report with a live tug and cargo")
	print("MODEL %s: %s; scan_tick=%d attach_tick=%d dock_ticks=%d final_hold_ticks=%d dock_peak_speeds=%.2f/%.2f dock_peak_tension=%.3f" % [
		label, metrics, scan_tick, attach_tick, dock_ticks, dock_hold_ticks, dock_max_tug_speed, dock_max_cargo_speed, dock_max_tension])
	_completed += 1


func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow: bool = false) -> Dictionary:
	var pos: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading: float = state.heading
	# Aim where position will be after a short drift, then brake into the waypoint.
	var course := goal - pos - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var along := velocity.dot(forward)
	var throttle := clampf((speed * maxf(0.0, cos(error)) - along) * 0.26, -0.65, 1.0)
	return {"throttle": throttle, "steer": _steer(heading, desired), "power": power, "slow": slow}


func _steer(heading: float, desired: float) -> float:
	return clampf(wrapf(desired - heading, -PI, PI) * 2.2, -1.0, 1.0)


func _metrics(s: Dictionary, harbor: Vector2, peak: float, ticks: int) -> String:
	var cargo_text := "unscanned"
	if s.scanned:
		cargo_text = "%.2f" % s.cargo_position.distance_to(harbor)
	return "phase=%s ticks=%d t=%.2fs pos=%s tug/cargo_range=%.2f/%s scan=%.3f dock=%.3f speed=%.2f rope=%.2f tension=%.3f peak_tension=%.3f hull=%.1f cargo=%.1f battery=%.1f reason=%s" % [
		s.phase, ticks, s.time, s.position, s.position.distance_to(harbor), cargo_text, s.scan,
		s.dock, s.velocity.length(), s.rope_length, s.tension, peak, s.hull, s.cargo_integrity, s.battery, s.fail_reason]


func _check(condition: bool, label: String, expectation: String) -> bool:
	_checks += 1
	if not condition:
		_failures += 1
		printerr("FAIL %s: %s" % [label, expectation])
	return condition
