extends RefCounted
## Drives only public controls from a natural Needle Bank reset; never mutates a sim.

const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 195
const OUTBOUND := [Vector2(-44, 0), Vector2(-29, -32), Vector2(2, -65)]
const RECOVERY := [Vector2(15, -64), Vector2(-30, -48), Vector2(-52, -15), Vector2(-54, 15)]
const REEF_NAME := "中央针礁"
const REEF_CENTER := Vector2(2, -22)

var mode := "recover"
var ticks := 0
var scan_tick := 0
var attach_tick := 0
var impact_tick := 0
var impact_event := ""
var preimpact_snapshot: Dictionary = {}
var impact_snapshot: Dictionary = {}
var impact_hull := 100.0
var impact_cargo := 100.0
var hull_before_impact := 100.0
var cargo_before_impact := 100.0
var dock_hold := 0
var peak_dock_tug_speed := 0.0
var peak_dock_cargo_speed := 0.0
var peak_dock_tension := 0.0
var peak_storm := 0.0
var peak_wind := 0.0
var dock_bounds_valid := true
var early_report := false
var tug_only_progress := false
var departed := false
var survived_impact := false
var peak_overload := 0.0
var _outbound_leg := 0
var _recovery_leg := 0
var _last_tow := false


func _init(policy: String = "recover") -> void:
	mode = policy


func controls(state: Dictionary) -> Dictionary:
	var pos: Vector2 = state.position
	var harbor: Vector2 = state.harbor
	var beacon: Vector2 = state.beacon
	var outward := (beacon - harbor).normalized()
	var input: Dictionary
	if not state.scanned:
		if _outbound_leg < OUTBOUND.size() and pos.distance_to(OUTBOUND[_outbound_leg]) < 7.0:
			_outbound_leg += 1
		var scan_zone := pos.distance_to(beacon) < 24.0
		var goal: Vector2 = OUTBOUND[_outbound_leg] if _outbound_leg < OUTBOUND.size() else beacon - outward * 7.0
		input = _pilot(state, goal, 4.0 if scan_zone else 9.0, 1 if scan_zone else 0, false)
		input.scan = scan_zone
	elif not state.tow_attached:
		input = _pilot(state, state.cargo_position - outward * 9.0, 3.0, 2, true)
		input.tow_pressed = not _last_tow and pos.distance_to(state.cargo_position) < 11.0 \
			and (state.velocity - state.cargo_velocity).length() < 1.6
	elif impact_tick == 0:
		# Deliberately take the direct bearing into the actual central reef. A real
		# collision event, not a waypoint or timer alone, switches to recovery.
		input = _pilot(state, REEF_CENTER, 5.0, 2, false)
		input.reel = -0.5 if state.tension < 0.45 else 0.0
	elif mode == "overload":
		input = {"throttle": 1.0, "steer": clampf(wrapf(0.0 - float(state.heading), -PI, PI) * 2.2, -1.0, 1.0),
			"power": 0, "reel": -1.0}
	else:
		var radius: float = state.harbor_radius
		if _recovery_leg < RECOVERY.size() and pos.distance_to(RECOVERY[_recovery_leg]) < 7.0:
			_recovery_leg += 1
		if pos.distance_to(harbor) <= radius and state.cargo_position.distance_to(harbor) <= radius:
			input = {"power": 2, "slow": true}
		else:
			var goal: Vector2 = RECOVERY[_recovery_leg] if _recovery_leg < RECOVERY.size() else harbor + Vector2(0.0, -radius * 0.45)
			var near_harbor := pos.distance_to(harbor) < radius + 12.0
			input = _pilot(state, goal, 3.2 if near_harbor else 5.0, 2, near_harbor)
			input.reel = -0.5 if state.tension < 0.45 else 0.0
	_last_tow = input.get("tow_pressed", false)
	return input


func observe(before: Dictionary, after: Dictionary) -> void:
	ticks += 1
	if before.position.distance_to(after.position) > 0.0 and after.position.distance_to(Vector2(-51, 48)) > 20.0:
		departed = true
	if scan_tick == 0 and after.scanned:
		scan_tick = ticks
	if attach_tick == 0 and after.tow_attached:
		attach_tick = ticks
	if impact_tick == 0 and after.event_kind == "collision" and String(after.event).contains(REEF_NAME):
		impact_tick = ticks
		impact_event = after.event
		preimpact_snapshot = before.duplicate(true)
		impact_snapshot = after.duplicate(true)
		hull_before_impact = before.hull
		cargo_before_impact = before.cargo_integrity
		impact_hull = after.hull
		impact_cargo = after.cargo_integrity
		survived_impact = after.phase == "return" and after.tow_attached and after.hull > 0.0 and after.cargo_integrity > 0.0
	peak_storm = maxf(peak_storm, after.storm)
	peak_wind = maxf(peak_wind, after.wind.length())
	peak_overload = maxf(peak_overload, after.overload)
	early_report = early_report or (after.phase != "success" and not after.report.is_empty())
	if after.position.distance_to(after.harbor) <= float(after.harbor_radius) \
			and after.cargo_position.distance_to(after.harbor) > float(after.harbor_radius):
		tug_only_progress = tug_only_progress or after.dock > before.dock or after.phase == "success"
	if after.dock > before.dock:
		dock_hold += 1
		dock_bounds_valid = dock_bounds_valid and after.position.distance_to(after.harbor) <= float(after.harbor_radius) \
			and after.cargo_position.distance_to(after.harbor) <= float(after.harbor_radius)
		peak_dock_tug_speed = maxf(peak_dock_tug_speed, after.velocity.length())
		peak_dock_cargo_speed = maxf(peak_dock_cargo_speed, after.cargo_velocity.length())
		peak_dock_tension = maxf(peak_dock_tension, after.tension)
	else:
		dock_hold = 0


func metrics(state: Dictionary) -> String:
	return "phase=%s ticks=%d scan=%d attach=%d impact=%d t=%.2f hull=%.1f cargo=%.1f battery=%.1f hold=%d peak_storm=%.3f peak_wind=%.3f peak_overload=%.3f reason=%s" % [
		state.phase, ticks, scan_tick, attach_tick, impact_tick, state.time, state.hull, state.cargo_integrity,
		state.battery, dock_hold, peak_storm, peak_wind, peak_overload, state.fail_reason]


func _pilot(state: Dictionary, goal: Vector2, cruise: float, power: int, slow: bool) -> Dictionary:
	var pos: Vector2 = state.position
	var velocity: Vector2 = state.velocity
	var heading: float = state.heading
	var course := goal - pos - velocity * 0.45
	var desired := atan2(course.x, -course.y) if course.length() > 0.25 else heading
	var error := wrapf(desired - heading, -PI, PI)
	var speed := minf(cruise, maxf(0.0, (course.length() - 0.25) * 0.65))
	var forward := Vector2(sin(heading), -cos(heading))
	var throttle := clampf((speed * maxf(0.0, cos(error)) - velocity.dot(forward)) * 0.26, -0.65, 1.0)
	return {"throttle": throttle, "steer": clampf(error * 2.2, -1.0, 1.0), "power": power, "slow": slow}
