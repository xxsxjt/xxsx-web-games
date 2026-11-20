extends RefCounted
## Fixed-step planar tug and free-body recovery pod, presented as a 3D scene.
## Coordinates are metres on x/z; heading zero points north (-Y), positive turns right.

const WORLD_LIMIT := 140.0
const SCAN_RADIUS := 27.0
const SCAN_SPEED := 5.5
const ATTACH_RADIUS := 15.5
const ATTACH_SPEED := 2.9
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
var _collision_at := -3.0
var _danger := false


func _init() -> void:
	reset()


func reset(id: String = "black-tide") -> void:
	contract_id = id if CONTRACTS.has(id) else "black-tide"
	contract = CONTRACTS[contract_id]
	phase = "approach"
	position = contract.start
	velocity = Vector2.ZERO
	heading = 0.0
	cargo_position = contract.target
	cargo_velocity = Vector2.ZERO
	wind = Vector2.ZERO
	storm_intensity = float(contract.severity)
	hull = 100.0
	cargo_integrity = 100.0
	battery = 100.0
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
	_collision_at = -3.0
	_danger = false


func set_power_profile(value: int) -> void:
	power_profile = clampi(value, 0, PROFILES.size() - 1)


func step(delta: float, input: Dictionary = {}) -> Dictionary:
	if phase in ["success", "failed"] or not is_finite(delta) or delta <= 0.0:
		return snapshot()
	# Prevent a stalled frame from advancing physics past the fixed simulation cadence.
	var dt := minf(delta, 1.0 / 30.0)
	mission_time += dt
	if input.has("power"):
		set_power_profile(int(input.power))
	var profile: Dictionary = PROFILES[power_profile]
	var steer := clampf(float(input.get("steer", 0.0)), -1.0, 1.0)
	throttle = clampf(float(input.get("throttle", 0.0)), -1.0, 1.0)
	speed_mode = bool(input.get("slow", false))
	var scanning := bool(input.get("scan", false)) and not scanned
	_update_weather()
	var forward := Vector2(sin(heading), -cos(heading))
	var right := Vector2(-forward.y, forward.x)
	var initial_speed := velocity.length()
	var yaw_rate: float = float(profile.yaw) / (1.0 + initial_speed * 0.065)
	if tow_attached:
		yaw_rate *= 0.83
	heading = wrapf(heading + steer * yaw_rate * dt, -PI, PI)
	forward = Vector2(sin(heading), -cos(heading))
	right = Vector2(-forward.y, forward.x)
	var drive: float = float(profile.thrust) * throttle * (0.74 if throttle < 0.0 else 1.0)
	if speed_mode:
		# The governor brakes in-world; it does not teleport a fast vessel to a lower speed.
		drive = clampf((throttle * 2.9 - velocity.dot(forward)) * 2.5, -6.2, 5.0)
	elif is_zero_approx(throttle):
		drive = -velocity.dot(forward) * (0.24 if tow_attached else 0.66)
	var tug_flow := _flow(position)
	var pod_flow := _flow(cargo_position)
	var relative := velocity - tug_flow
	var tug_accel: Vector2 = forward * (drive - relative.dot(forward) * 0.67)
	tug_accel -= right * relative.dot(right) * 1.28 * float(profile.stability)
	tug_accel += wind * (0.21 if power_profile == 2 else 0.31)
	var cargo_accel: Vector2 = (pod_flow - cargo_velocity) * 0.56 + wind * 0.38
	if not tow_attached:
		cargo_accel += (Vector2(contract.target) - cargo_position) * 0.50
	if scanning and position.distance_to(cargo_position) <= SCAN_RADIUS and initial_speed < SCAN_SPEED:
		scan_progress = minf(1.0, scan_progress + dt * (0.23 + float(profile.sensors) * 0.49))
		if scan_progress >= 1.0:
			scanned = true
			_emit("scan_locked", "声纳锁定。降到 2.9 m/s 以下，靠近后按空格挂索。")
	elif not scanned:
		scan_progress = maxf(0.0, scan_progress - dt * 0.07)
	if bool(input.get("tow_pressed", false)):
		_attach(forward)
	if tow_attached:
		var reel := clampf(float(input.get("reel", 0.0)), -1.0, 1.0)
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
	velocity = (velocity + tug_accel * dt).limit_length(18.5)
	cargo_velocity = (cargo_velocity + cargo_accel * dt).limit_length(17.0)
	position = _clamp_world(position + velocity * dt)
	cargo_position = _clamp_world(cargo_position + cargo_velocity * dt)
	_apply_reefs(dt)
	var energy_draw := 0.13 + absf(throttle) * (0.40 if power_profile == 0 else 0.30)
	if scanning:
		energy_draw += 0.20 + float(profile.sensors) * 0.22
	if tow_attached:
		energy_draw += 0.08 + absf(float(input.get("reel", 0.0))) * 0.19
	battery = maxf(0.0, battery - energy_draw * dt)
	if hull <= 0.0:
		_fail("船体耐久归零，拖船失去动力。", "collision")
	elif cargo_integrity <= 0.0:
		_fail("回收舱破损，任务终止。", "collision")
	elif battery <= 0.0:
		_fail("电量耗尽，任务终止。", "power_lost")
	elif mission_time >= float(contract.deadline):
		_fail("风暴窗口关闭，拖船必须撤离。", "timeout")
	if phase == "return":
		_update_docking(dt)
	return snapshot()


func _stern_position(forward: Vector2) -> Vector2:
	return position - forward * 2.2


func _attach(forward: Vector2) -> void:
	if phase != "approach":
		return
	if not scanned:
		_emit("denied", "目标尚未锁定。靠近信号区域后按住 E 扫描。")
	elif position.distance_to(cargo_position) > ATTACH_RADIUS:
		_emit("denied", "挂索距离过远：靠近到 15.5 米以内。")
	elif velocity.length() > ATTACH_SPEED or (velocity - cargo_velocity).length() > 4.2:
		_emit("denied", "相对速度过高。松油门或倒车修正，稳住再挂索。")
	else:
		phase = "return"
		tow_attached = true
		rope_length = clampf(_stern_position(forward).distance_to(cargo_position) + 0.7, 9.0, ROPE_MAX)
		_emit("tow_attached", "挂索成功。切到 3 稳索返航，注意舱体切弯与缆绳张力。")


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
			result += (tangent * (0.82 + storm_intensity) + Vector2(0.24, -0.57)) * falloff * 3.2
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
			if mission_time - _collision_at > 0.54 and inbound_speed > 0.6:
				_collision_at = mission_time
				hull = maxf(0.0, hull - inbound_speed * 4.3)
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
			if mission_time - _collision_at > 0.54 and inbound_speed > 0.6:
				_collision_at = mission_time
				cargo_integrity = maxf(0.0, cargo_integrity - inbound_speed * 6.0)
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
	if scanned:
		return "减速到 2.9 m/s 以下，15.5 米内按空格挂索。"
	return "追踪橙色信号；保持低速，按住 E 扫描。"


func snapshot() -> Dictionary:
	var visible := scanned and (tow_attached or position.distance_to(cargo_position) < 51.0)
	return {
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
