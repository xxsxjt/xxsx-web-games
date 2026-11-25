extends RefCounted
## Fixed-step planar tug and free-body recovery pod, presented as a 3D scene.
## Coordinates are metres on x/z; heading zero points north (-Y), positive turns right.

const Catalog = preload("res://src/expedition_catalog.gd")
const Damage = preload("res://src/damage_control.gd")
const WORLD_LIMIT := 140.0
const SCAN_RADIUS := 27.0
const SCAN_SPEED := 5.5
const ATTACH_RADIUS := 15.5
const ATTACH_SPEED := 2.9
const ATTACH_RELATIVE_SPEED := 4.2
const SLOW_TARGET := 2.9
const DOCK_SPEED := 2.6
const DOCK_TENSION := 0.68
const DOCK_TIME := 1.0
const ROPE_MIN := 7.0
const ROPE_MAX := 22.0
const OVERLOAD_TIME := 2.45
const PROFILES := [
	{"name": "推进", "thrust": 10.6, "yaw": 1.72, "sensors": 0.45, "rating": 15.0, "winch": 1.4, "stability": 0.86},
	{"name": "搜索", "thrust": 7.4, "yaw": 1.49, "sensors": 1.0, "rating": 17.0, "winch": 2.0, "stability": 0.97},
	{"name": "稳索", "thrust": 6.2, "yaw": 1.22, "sensors": 0.57, "rating": 24.0, "winch": 3.4, "stability": 1.26},
]
const CONTRACTS := {
	"black-tide": {
		"id": "black-tide", "name": "黑潮回收", "subtitle": "01 / BREAKWATER · 基础航线",
		"briefing": "找到北侧失联舱，低速扫描并挂索。沿港口灯带返航，拖船和回收舱都要进入青色港圈。",
		"harbor": Vector2(0, 22), "start": Vector2(0, 13), "harbor_radius": 18.0,
		"beacon": Vector2(0, -75), "target": Vector2(8, -88), "deadline": 145.0,
		"wind_angle": 0.28, "severity": 0.48, "mass": 2.3,
		"hazards": [
			{"position": Vector2(-25, -34), "radius": 10.0, "name": "黑礁", "kind": "reef"},
			{"position": Vector2(28, -57), "radius": 14.0, "name": "碎浪回旋", "kind": "current"},
			{"position": Vector2(-32, -85), "radius": 9.0, "name": "沉没栈桥", "kind": "reef"},
			{"position": Vector2(31, -5), "radius": 9.0, "name": "旧防波堤", "kind": "reef"},
		],
	},
	"needle-bank": {
		"id": "needle-bank", "name": "针礁水道", "subtitle": "02 / NEEDLE BANK · 偏航回旋",
		"briefing": "浪流更强，舱体更重。中央针礁挡住直线；利用雷达绕开礁圈，转弯前收油，给回旋水流留出减速距离。",
		"harbor": Vector2(-51, 57), "start": Vector2(-51, 48), "harbor_radius": 17.0,
		"beacon": Vector2(38, -80), "target": Vector2(49, -92), "deadline": 195.0,
		"wind_angle": 2.33, "severity": 0.73, "mass": 3.0,
		"hazards": [
			{"position": Vector2(-29, 17), "radius": 12.0, "name": "港外尖礁", "kind": "reef"},
			{"position": Vector2(2, -22), "radius": 17.0, "name": "中央针礁", "kind": "reef"},
			{"position": Vector2(27, -51), "radius": 20.0, "name": "断浪急流", "kind": "current"},
			{"position": Vector2(67, -77), "radius": 10.0, "name": "东翼礁", "kind": "reef"},
			{"position": Vector2(-34, -55), "radius": 13.0, "name": "浅滩回旋", "kind": "current"},
		],
	},
	"cross-current": {
		"id": "cross-current", "name": "碎潮回廊", "subtitle": "03 / CROSS CURRENT · 叠流择道",
		"briefing": "回收舱落在碎潮外缘。断桅礁切断直返线；东横流与西折涡之间可抢一条急弯捷径，也可走南脊外侧的宽水绕行。拖带转弯留意尾舱与横流。",
		"harbor": Vector2(52, 46), "start": Vector2(52, 56), "harbor_radius": 18.0,
		"beacon": Vector2(-58, -75), "target": Vector2(-65, -87), "deadline": 215.0,
		"wind_angle": 1.18, "severity": 0.66, "mass": 2.7,
		"hazards": [
			{"position": Vector2(-2, -16), "radius": 19.0, "name": "断桅礁", "kind": "reef"},
			{"position": Vector2(-27, -45), "radius": 24.0, "name": "西折涡", "kind": "current"},
			{"position": Vector2(22, -38), "radius": 27.0, "name": "东横流", "kind": "current"},
			{"position": Vector2(34, -71), "radius": 12.0, "name": "南门礁", "kind": "reef"},
			{"position": Vector2(79, 23), "radius": 11.0, "name": "港外礁", "kind": "reef"},
		],
	},
}

const _EXPEDITION_SPEC_KEYS := ["token", "offer_id", "contract", "loadout", "hull", "battery", "pressure", "path"]
const _EXPEDITION_OVERRIDES := ["id", "name", "briefing", "base_contract", "sector", "sector_name", "leg",
	"risk", "branch", "flagship", "reward", "parts_reward", "launch_cost", "severity", "mass", "deadline", "wind_angle"]
const _OPTIONAL_EXPEDITION_OVERRIDES := ["tide_stations", "current_scale"]
const _EXPEDITION_THRESHOLDS := {
	"scan_radius": SCAN_RADIUS, "scan_speed": SCAN_SPEED, "attach_radius": ATTACH_RADIUS, "attach_speed": ATTACH_SPEED,
	"attach_relative_speed": ATTACH_RELATIVE_SPEED, "slow_target": SLOW_TARGET, "dock_speed": DOCK_SPEED,
	"dock_tension": DOCK_TENSION, "dock_time": DOCK_TIME, "rated_tension": 1.0,
	"rope_min": ROPE_MIN, "rope_max": ROPE_MAX, "overload_time": OVERLOAD_TIME,
}

var contract_id := "black-tide"
var contract: Dictionary = {}
var phase := "approach"
var position := Vector2.ZERO
var velocity := Vector2.ZERO
var heading := 0.0
var cargo_position := Vector2.ZERO
var cargo_velocity := Vector2.ZERO
var wind := Vector2.ZERO
var storm_intensity := 0.0
var hull := 100.0
var cargo_integrity := 100.0
var battery := 100.0
var mission_time := 0.0
var power_profile := 0
var throttle := 0.0
var speed_mode := false
var scan_progress := 0.0
var scanned := false
var tow_attached := false
var rope_length := 12.0
var cable_tension := 0.0
var peak_tension := 0.0
var overload := 0.0
var dock := 0.0
var fail_reason := ""
var event_message := ""
var event_id := 0
var event_kind := ""
var report: Dictionary = {}

var _notice_until := 0.0
var _collision_notice_at := -3.0
var _tug_impact_at := -3.0
var _cargo_impact_at := -3.0
var _danger := false
var _expedition: Dictionary = {}
var _profiles: Array = PROFILES
var _tug_mass := 1.0
var _energy_multiplier := 1.0
var _current_scale := 1.0
var _tide_stations: Array = []
var _tide_completed := 0
var _tide_hold := 0.0
var _damage: RefCounted


func _init() -> void:
	reset()


func reset(id: String = "black-tide") -> void:
	contract_id = id if CONTRACTS.has(id) else "black-tide"
	contract = CONTRACTS[contract_id]
	_expedition = {}
	_profiles = PROFILES
	_tug_mass = 1.0
	_energy_multiplier = 1.0
	_current_scale = 1.0
	_tide_stations = []
	_damage = null
	_reset_voyage(100.0, 100.0)


func reset_expedition(spec: Dictionary) -> bool:
	var spec_keys := _EXPEDITION_SPEC_KEYS.duplicate()
	if spec.has("damage_control"):
		spec_keys.append("damage_control")
		if not Damage.valid_persistent(spec.damage_control):
			return false
	if spec.size() != spec_keys.size() or not spec.has_all(spec_keys):
		return false
	if not _valid_deployment_token(spec.token) or not spec.offer_id is String or not spec.contract is Dictionary \
			or not spec.loadout is Array or not spec.pressure is int or not spec.path is Array \
			or not _usable_resource(spec.hull) or not _usable_resource(spec.battery):
		return false
	var effects := Catalog.loadout_effects(spec.loadout)
	if effects.is_empty():
		return false
	var overlay := Catalog.build_contract(spec.offer_id, spec.pressure, spec.path)
	var keys := _EXPEDITION_OVERRIDES.duplicate()
	for key: String in _OPTIONAL_EXPEDITION_OVERRIDES:
		if overlay.has(key):
			keys.append(key)
	if overlay.is_empty() or not CONTRACTS.has(overlay.base_contract) \
			or spec.contract.size() != keys.size() or overlay.size() != keys.size():
		return false
	# Use the rebuilt values, not the caller's contract. Reject extra fields,
	# malformed values, stale quotes and attempts to smuggle in geometry.
	var next_contract: Dictionary = CONTRACTS[overlay.base_contract].duplicate(true)
	for key: String in keys:
		var quoted: Variant = spec.contract.get(key)
		if not overlay.has(key) or typeof(quoted) != typeof(overlay[key]) or quoted != overlay[key]:
			return false
		next_contract[key] = overlay[key]

	# No mutation of the running voyage before the full launch envelope is valid.
	contract_id = String(overlay.base_contract)
	contract = next_contract
	_tug_mass = float(effects.mass)
	_energy_multiplier = float(effects.energy)
	_current_scale = float(overlay.get("current_scale", 1.0))
	_tide_stations = overlay.get("tide_stations", []).duplicate()
	_profiles = _effective_profiles(effects) if not spec.loadout.is_empty() else PROFILES
	_expedition = overlay
	_expedition.merge({"token": spec.token, "offer_id": spec.offer_id, "path": spec.path.duplicate(),
		"pressure": spec.pressure, "loadout": spec.loadout.duplicate(), "effects": effects,
		"thresholds": _EXPEDITION_THRESHOLDS, "initial_hull": float(spec.hull), "initial_battery": float(spec.battery)})
	_reset_voyage(float(spec.hull), float(spec.battery))
	_damage = Damage.new(spec.damage_control, storm_intensity) if spec.has("damage_control") else null
	return true


func _valid_deployment_token(value: Variant) -> bool:
	# Correlation ID only: State owns authorization and one-time settlement.
	if not value is String or value.is_empty() or value.length() > 40:
		return false
	for character: String in value:
		if not character in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_:":
			return false
	return true


func _usable_resource(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) > 0.0 and float(value) <= 100.0


func _effective_profiles(effects: Dictionary) -> Array:
	var result := PROFILES.duplicate(true)
	for profile: Dictionary in result:
		for key: String in ["thrust", "sensors", "rating", "stability"]:
			profile[key] = float(profile[key]) * float(effects[key])
		profile.yaw = float(profile.yaw) / _tug_mass
	return result


func _reset_voyage(initial_hull: float, initial_battery: float) -> void:
	phase = "approach"
	position = contract.start
	velocity = Vector2.ZERO
	heading = 0.0
	cargo_position = contract.target
	cargo_velocity = Vector2.ZERO
	wind = Vector2.ZERO
	storm_intensity = float(contract.severity)
	hull = initial_hull
	cargo_integrity = 100.0
	battery = initial_battery
	mission_time = 0.0
	power_profile = 0
	throttle = 0.0
	speed_mode = false
	scan_progress = 0.0
	scanned = false
	tow_attached = false
	rope_length = 12.0
	cable_tension = 0.0
	peak_tension = 0.0
	overload = 0.0
	dock = 0.0
	fail_reason = ""
	event_message = ""
	event_id = 0
	event_kind = ""
	report = {}
	_notice_until = 0.0
	_collision_notice_at = -3.0
	_tug_impact_at = -3.0
	_cargo_impact_at = -3.0
	_danger = false
	_tide_completed = 0
	_tide_hold = 0.0


func set_power_profile(value: int) -> void:
	power_profile = clampi(value, 0, PROFILES.size() - 1)


func step(delta: float, input: Dictionary = {}) -> Dictionary:
	if phase in ["success", "failed"] or not is_finite(delta) or delta <= 0.0:
		return snapshot()
	# Prevent a stalled frame from advancing physics past the fixed simulation cadence.
	var dt := minf(delta, 1.0 / 30.0)
	mission_time += dt
	# Energy responds to the water level that attenuates this tick's propulsion.
	var propulsion_energy_multiplier: float = float(_damage.propulsion_energy_multiplier()) if _damage != null else 1.0
	if input.has("power"):
		var requested_power: Variant = input.power
		if (requested_power is int or requested_power is float) and is_finite(float(requested_power)):
			set_power_profile(int(clampf(float(requested_power), 0.0, float(PROFILES.size() - 1))))
	var profile: Dictionary = _profiles[power_profile]
	var steer := _bounded_control(input.get("steer", 0.0))
	throttle = _bounded_control(input.get("throttle", 0.0))
	var reel := _bounded_control(input.get("reel", 0.0))
	speed_mode = bool(input.get("slow", false))
	var scanning := bool(input.get("scan", false)) and not scanned
	_update_weather()
	var forward := Vector2(sin(heading), -cos(heading))
	var right := Vector2(-forward.y, forward.x)
	var initial_speed := velocity.length()
	var yaw_rate: float = float(profile.yaw) / (1.0 + initial_speed * 0.065)
	if _damage != null and _damage.water > 0.0:
		yaw_rate *= 1.0 - float(_damage.water) * 0.002
	if tow_attached:
		yaw_rate *= 0.83
	heading = wrapf(heading + steer * yaw_rate * dt, -PI, PI)
	forward = Vector2(sin(heading), -cos(heading))
	right = Vector2(-forward.y, forward.x)
	var drive: float = float(profile.thrust) * throttle * (0.74 if throttle < 0.0 else 1.0)
	if speed_mode:
		# The governor brakes in-world; it does not teleport a fast vessel to a lower speed.
		drive = clampf((throttle * SLOW_TARGET - velocity.dot(forward)) * 2.5, -6.2, 5.0)
	elif is_zero_approx(throttle):
		drive = -velocity.dot(forward) * (0.24 if tow_attached else 0.66)
	if _damage != null and _damage.water > 0.0:
		drive *= 1.0 - float(_damage.water) * Damage.PROPULSION_WATER_FACTOR
	var tug_flow := _flow(position)
	var pod_flow := _flow(cargo_position)
	var relative := velocity - tug_flow
	var tug_accel: Vector2 = forward * (drive - relative.dot(forward) * 0.67)
	tug_accel -= right * relative.dot(right) * 1.28 * float(profile.stability)
	tug_accel += wind * (0.21 if power_profile == 2 else 0.31)
	var cargo_accel: Vector2 = (pod_flow - cargo_velocity) * 0.56 + wind * 0.38
	if not tow_attached:
		cargo_accel += (Vector2(contract.target) - cargo_position) * 0.50
	# E is routed to the active survey station before it can lock the capsule.
	# Its draw still goes through the same sonar energy budget below.
	var taking_tide_sample := _tide_completed < _tide_stations.size()
	if taking_tide_sample:
		_update_tide_sample(scanning, initial_speed, float(profile.sensors), dt)
	elif scanning and position.distance_to(cargo_position) <= SCAN_RADIUS and initial_speed < SCAN_SPEED:
		scan_progress = minf(1.0, scan_progress + dt * (0.23 + float(profile.sensors) * 0.49))
		if scan_progress >= 1.0:
			scanned = true
			_emit("scan_locked", "声纳锁定。降到 2.9 m/s 以下，靠近后按空格挂索。")
	elif not scanned:
		scan_progress = maxf(0.0, scan_progress - dt * 0.07)
	if bool(input.get("tow_pressed", false)):
		_attach(forward)
	if tow_attached:
		rope_length = clampf(rope_length + reel * float(profile.winch) * dt, ROPE_MIN, ROPE_MAX)
		var separation := cargo_position - _stern_position(forward)
		var cable_dir := separation.normalized()
		var extension := separation.length() - rope_length
		var separating_speed := (cargo_velocity - velocity).dot(cable_dir)
		var force := maxf(0.0, extension * 3.8 + separating_speed * 1.7) if extension > 0.0 else 0.0
		var raw_tension: float = force / float(profile.rating)
		cable_tension = clampf(raw_tension, 0.0, 1.5)
		peak_tension = maxf(peak_tension, cable_tension)
		tug_accel += cable_dir * minf(force, 48.0) * 0.23
		cargo_accel -= cable_dir * minf(force, 48.0) / (float(contract.mass) * 1.40)
		if raw_tension >= 1.0:
			if not _danger:
				_emit("overload", "拖缆过载！松油门、放绳，或切换 3 稳索。")
			_danger = true
			overload = minf(1.0, overload + dt * clampf(raw_tension, 1.0, 1.8) / OVERLOAD_TIME)
			cargo_integrity = maxf(0.0, cargo_integrity - (raw_tension - 1.0) * dt * 6.0)
			if overload >= 1.0:
				tow_attached = false
				_fail("拖缆持续过载后断裂。", "snap")
		else:
			_danger = false
			overload = maxf(0.0, overload - dt * 0.45)
	if _tug_mass != 1.0:
		tug_accel /= _tug_mass
	velocity = (velocity + tug_accel * dt).limit_length(18.5)
	cargo_velocity = (cargo_velocity + cargo_accel * dt).limit_length(17.0)
	position = _clamp_world(position + velocity * dt)
	cargo_position = _clamp_world(cargo_position + cargo_velocity * dt)
	_apply_reefs(dt)
	# A contact on the would-be completion tick interrupts the work before any
	# kit can be consumed. Flooding affects drive from the next fixed tick.
	if _damage != null:
		if _damage.step(dt, input, initial_speed, throttle, cable_tension, storm_intensity):
			_emit("patched", "临时封堵完成，耗用一包。已封最多 1.0 破口；结构损伤仍须返港维修。")
	var propulsion_draw: float = absf(throttle) * (0.40 if power_profile == 0 else 0.30) * propulsion_energy_multiplier
	var energy_draw: float = 0.13 + propulsion_draw
	if scanning:
		energy_draw += 0.20 + float(profile.sensors) * 0.22
	if tow_attached:
		energy_draw += 0.08 + absf(reel) * 0.19
	if _energy_multiplier != 1.0:
		energy_draw *= _energy_multiplier
	if _damage != null:
		energy_draw += float(_damage.pump_draw)
	battery = maxf(0.0, battery - energy_draw * dt)
	if hull <= 0.0:
		_fail("船体耐久归零，拖船失去动力。", "collision")
	elif cargo_integrity <= 0.0:
		_fail("回收舱破损，任务终止。", "collision")
	elif battery <= 0.0:
		_fail("电量耗尽，任务终止。", "power_lost")
	elif mission_time >= float(contract.deadline):
		_fail("风暴窗口关闭，拖船必须撤离。", "timeout")
	elif _damage != null and _damage.water >= 100.0:
		_fail("舱底进水达到 100%，拖船失去浮力。", "flooded")
	if phase == "return":
		_update_docking(dt)
	return snapshot()


func _stern_position(forward: Vector2) -> Vector2:
	return position - forward * 2.2


func _bounded_control(value: Variant) -> float:
	if not (value is int or value is float):
		return 0.0
	var number := float(value)
	return clampf(number, -1.0, 1.0) if is_finite(number) else 0.0


func _attach(forward: Vector2) -> void:
	if phase != "approach":
		return
	if _tide_completed < _tide_stations.size():
		_emit("denied", "先在 A、B 两个潮流测站依次取样。")
	elif not scanned:
		_emit("denied", "目标尚未锁定。靠近信号区域后按住 E 扫描。")
	elif position.distance_to(cargo_position) > ATTACH_RADIUS:
		_emit("denied", "挂索距离过远：靠近到 15.5 米以内。")
	elif velocity.length() > ATTACH_SPEED or (velocity - cargo_velocity).length() > ATTACH_RELATIVE_SPEED:
		_emit("denied", "相对速度过高。松油门或倒车修正，稳住再挂索。")
	else:
		phase = "return"
		tow_attached = true
		rope_length = clampf(_stern_position(forward).distance_to(cargo_position) + 0.7, 9.0, ROPE_MAX)
		_emit("tow_attached", "挂索成功。切到 3 稳索返航，注意舱体切弯与缆绳张力。")


func _update_tide_sample(sampling: bool, speed: float, sensors: float, dt: float) -> void:
	var station: Vector2 = _tide_stations[_tide_completed]
	if not sampling or speed >= Catalog.TIDE_SPEED or position.distance_to(station) > Catalog.TIDE_RADIUS:
		_tide_hold = 0.0
		return
	_tide_hold += dt * (0.52 + 0.48 * sensors) / Catalog.TIDE_WORK
	if _tide_hold >= 1.0 - 1e-9:
		_tide_completed += 1
		_tide_hold = 0.0
		_emit("tide_sample", "测站 A 已记录，前往 B 站。" if _tide_completed < _tide_stations.size()
			else "两处潮流样本已记录。追踪橙色信号，带回回收舱才算完成制图。")


func _update_weather() -> void:
	storm_intensity = clampf(float(contract.severity) + sin(mission_time * 0.24 + 1.1) * 0.19 + sin(mission_time * 0.73) * 0.10, 0.16, 0.97)
	var angle := float(contract.wind_angle) + sin(mission_time * 0.23) * 0.75
	wind = Vector2(cos(angle), sin(angle)) * (0.48 + storm_intensity * 2.8)


func _flow(at: Vector2) -> Vector2:
	var result := Vector2(sin(mission_time * 0.32), -cos(mission_time * 0.21)) * (0.32 + storm_intensity * 0.52)
	for hazard: Dictionary in contract.hazards:
		if hazard.kind != "current":
			continue
		var offset: Vector2 = at - hazard.position
		var falloff := 1.0 - offset.length() / float(hazard.radius)
		if falloff > 0.0:
			var tangent := Vector2(-offset.y, offset.x) / maxf(offset.length(), 2.5)
			var eddy := (tangent * (0.82 + storm_intensity) + Vector2(0.24, -0.57)) * falloff * 3.2
			result += eddy if _current_scale == 1.0 else eddy * _current_scale
	var lee := clampf(1.0 - at.distance_to(contract.harbor) / 24.0, 0.0, 1.0)
	return result * (1.0 - lee * 0.72)


func _clamp_world(at: Vector2) -> Vector2:
	return at.clamp(Vector2(-WORLD_LIMIT, -WORLD_LIMIT), Vector2(WORLD_LIMIT, WORLD_LIMIT))


func _apply_reefs(dt: float) -> void:
	for hazard: Dictionary in contract.hazards:
		if hazard.kind != "reef":
			continue
		var center: Vector2 = hazard.position
		var margin: float = float(hazard.radius) + 1.55
		var offset := position - center
		if offset.length_squared() < margin * margin:
			var normal := offset.normalized() if offset.length_squared() > 0.0001 else Vector2.DOWN
			var inbound_speed := maxf(0.0, -velocity.dot(normal))
			position = center + normal * margin
			velocity += normal * inbound_speed * 1.18
			hull = maxf(0.0, hull - dt * 7.0)
			if _damage != null:
				_damage.add_breach(dt * 0.025)
			if mission_time - _tug_impact_at > 0.54 and inbound_speed > 0.6:
				_tug_impact_at = mission_time
				hull = maxf(0.0, hull - inbound_speed * 4.3)
				if _damage != null:
					_damage.add_breach(clampf((inbound_speed - 0.6) * 0.20, 0.08, 0.90))
				if mission_time - _collision_notice_at > 0.54:
					_collision_notice_at = mission_time
					_emit("collision", "船体碰撞：%s。倒车脱离，再绕标线。" % hazard.name)
		if not tow_attached:
			continue
		var cargo_margin: float = float(hazard.radius) + 1.10
		var cargo_offset := cargo_position - center
		if cargo_offset.length_squared() < cargo_margin * cargo_margin:
			var normal := cargo_offset.normalized() if cargo_offset.length_squared() > 0.0001 else Vector2.DOWN
			var inbound_speed := maxf(0.0, -cargo_velocity.dot(normal))
			cargo_position = center + normal * cargo_margin
			cargo_velocity += normal * inbound_speed * 1.13
			cargo_integrity = maxf(0.0, cargo_integrity - dt * 10.5)
			if mission_time - _cargo_impact_at > 0.54 and inbound_speed > 0.6:
				_cargo_impact_at = mission_time
				cargo_integrity = maxf(0.0, cargo_integrity - inbound_speed * 6.0)
				if mission_time - _collision_notice_at > 0.54:
					_collision_notice_at = mission_time
					_emit("collision", "舱体擦碰：%s。留更大的外弯。" % hazard.name)


func _update_docking(dt: float) -> void:
	var harbor: Vector2 = contract.harbor
	var radius := float(contract.harbor_radius)
	if tow_attached and position.distance_to(harbor) <= radius and cargo_position.distance_to(harbor) <= radius \
			and velocity.length() <= DOCK_SPEED and cargo_velocity.length() <= DOCK_SPEED and cable_tension < DOCK_TENSION:
		dock = minf(1.0, dock + dt / DOCK_TIME)
	else:
		dock = 0.0
	if dock >= 1.0:
		phase = "success"
		var score := clampi(roundi(10000.0 - mission_time * 12.0 - (100.0 - hull) * 27.0 \
			- (100.0 - cargo_integrity) * 32.0 - (100.0 - battery) * 8.0 - peak_tension * 490.0), 0, 10000)
		var grade := "S" if score >= 8800 else ("A" if score >= 7600 else ("B" if score >= 6200 else "C"))
		report = {"score": score, "grade": grade, "time": mission_time, "hull": hull,
			"cargo": cargo_integrity, "battery": battery, "peak_tension": peak_tension}
		_emit("docked", "拖船和回收舱已稳定入港。任务完成。")


func _fail(reason: String, kind: String) -> void:
	if phase in ["failed", "success"]:
		return
	phase = "failed"
	fail_reason = reason
	_emit(kind, reason)


func _emit(kind: String, text: String) -> void:
	event_id += 1
	event_kind = kind
	event_message = text
	_notice_until = mission_time + 4.5


func phase_text() -> String:
	match phase:
		"approach":
			return "搜寻 / 声纳锁定" if not scanned else "接近 / 准备挂索"
		"return":
			return "带载返航 / 稳索"
		"success":
			return "成功 / 已交付"
		"failed":
			return "任务失败"
	return phase


func profile_name() -> String:
	return String(PROFILES[power_profile].name)


func objective_text() -> String:
	if phase == "success":
		return "带载入港完成。"
	if phase == "failed":
		return fail_reason
	if phase == "return":
		if position.distance_to(contract.harbor) < float(contract.harbor_radius) + 7.0:
			return "拖船和回收舱均入港；低于 2.6 m/s、低张力稳定一秒。"
		return "带载返航，沿雷达青色港圈过礁。转向前松油门。"
	if _tide_completed < _tide_stations.size():
		return "前往海图 %s 站，减速并持续按 E 取样。" % ("A" if _tide_completed == 0 else "B")
	if scanned:
		return "减速到 2.9 m/s 以下，15.5 米内按空格挂索。"
	return "追踪橙色信号；保持低速，按住 E 扫描。"


func snapshot() -> Dictionary:
	var visible := scanned and (tow_attached or position.distance_to(cargo_position) < 51.0)
	var view := {
		"contract_id": contract_id, "phase": phase, "objective": objective_text(),
		"position": position, "velocity": velocity, "heading": heading,
		"cargo_position": cargo_position, "cargo_velocity": cargo_velocity,
		"harbor": contract.harbor, "harbor_radius": contract.harbor_radius,
		"beacon": contract.beacon, "hazards": contract.hazards, "deadline": contract.deadline,
		"wind": wind, "storm": storm_intensity,
		"hull": hull, "cargo_integrity": cargo_integrity, "battery": battery, "time": mission_time,
		"power": power_profile, "profile_name": profile_name(), "throttle": throttle, "speed_mode": speed_mode,
		"scan": scan_progress, "scanned": scanned, "target_visible": visible,
		"tow_attached": tow_attached, "rope_length": rope_length,
		"tension": cable_tension, "peak_tension": peak_tension, "overload": overload,
		"dock": dock, "home_distance": position.distance_to(contract.harbor),
		"target_distance": position.distance_to(cargo_position if scanned else Vector2(contract.beacon)),
		"event_id": event_id, "event_kind": event_kind,
		"event": event_message if mission_time <= _notice_until or phase == "failed" else "",
		"notice": event_message if mission_time <= _notice_until or phase == "failed" else "",
		"fail_reason": fail_reason, "report": report.duplicate(),
	}
	if not _expedition.is_empty():
		var expedition := _expedition.duplicate(true)
		expedition["profile"] = _profiles[power_profile].duplicate()
		view["hazards"] = contract.hazards.duplicate(true)
		view["expedition"] = expedition
		view["expedition_token"] = expedition.token
		view["offer_id"] = expedition.offer_id
		if _damage != null:
			view["damage_control"] = _damage.snapshot()
		if not _tide_stations.is_empty():
			view["tide_survey"] = {"stations": _tide_stations.duplicate(), "completed": _tide_completed,
				"progress": _tide_hold, "radius": Catalog.TIDE_RADIUS, "speed_limit": Catalog.TIDE_SPEED}
	return view
