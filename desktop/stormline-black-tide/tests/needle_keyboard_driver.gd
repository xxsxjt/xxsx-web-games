extends RefCounted
## Test-only 100 ms digital control sampler and in-process Godot key adapter.
## Never receives a simulator and never sends Windows keyboard or mouse input.

const HOLD_TICKS := 6
const CHANNELS := ["throttle", "steer", "reel"]
const POLLED_KEYS := [KEY_W, KEY_S, KEY_A, KEY_D, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
	KEY_E, KEY_SHIFT, KEY_Q, KEY_F]

var ticks := 0
var key_edges := 0
var tow_edges := 0
var power_edges := 0
var _samples := {"throttle": 0.0, "steer": 0.0, "reel": 0.0}
var _residual := {"throttle": 0.0, "steer": 0.0, "reel": 0.0}
var _pressed: Dictionary = {}
var _power := -1


func quantize(requested: Dictionary) -> Dictionary:
	if ticks % HOLD_TICKS == 0:
		for channel: String in CHANNELS:
			var value := clampf(float(requested.get(channel, 0.0)), -1.0, 1.0)
			if is_zero_approx(value):
				_samples[channel] = 0.0
				_residual[channel] = 0.0
			else:
				_residual[channel] += absf(value)
				_samples[channel] = signf(value) if _residual[channel] >= 1.0 else 0.0
				if not is_zero_approx(float(_samples[channel])):
					_residual[channel] -= 1.0
	ticks += 1
	return {"throttle": _samples.throttle, "steer": _samples.steer, "reel": _samples.reel,
		"power": int(requested.get("power", 0)), "slow": bool(requested.get("slow", false)),
		"scan": bool(requested.get("scan", false)), "tow_pressed": bool(requested.get("tow_pressed", false))}


func apply(viewport: Viewport, digital: Dictionary, arrows: bool = false) -> void:
	var desired := {
		(KEY_UP if arrows else KEY_W): digital.throttle > 0.0,
		(KEY_DOWN if arrows else KEY_S): digital.throttle < 0.0,
		(KEY_LEFT if arrows else KEY_A): digital.steer < 0.0,
		(KEY_RIGHT if arrows else KEY_D): digital.steer > 0.0,
		KEY_Q: digital.reel < 0.0, KEY_F: digital.reel > 0.0,
		KEY_E: digital.scan, KEY_SHIFT: digital.slow,
	}
	for keycode: int in POLLED_KEYS:
		var pressed: bool = desired.get(keycode, false)
		if pressed != bool(_pressed.get(keycode, false)):
			var event := InputEventKey.new()
			event.keycode = keycode
			event.pressed = pressed
			Input.parse_input_event(event)
			_pressed[keycode] = pressed
			key_edges += 1
	Input.flush_buffered_events()
	if digital.power != _power:
		_power = digital.power
		edge(viewport, [KEY_1, KEY_2, KEY_3][_power])
		power_edges += 1
	if digital.tow_pressed:
		edge(viewport, KEY_SPACE)
		tow_edges += 1


func release() -> void:
	for keycode: int in POLLED_KEYS:
		if bool(_pressed.get(keycode, false)):
			var event := InputEventKey.new()
			event.keycode = keycode
			event.pressed = false
			Input.parse_input_event(event)
			_pressed[keycode] = false
	Input.flush_buffered_events()


static func edge(viewport: Viewport, keycode: int) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.keycode = keycode
		event.pressed = pressed
		viewport.push_input(event)


static func all_released() -> bool:
	for keycode: int in POLLED_KEYS:
		if Input.is_key_pressed(keycode):
			return false
	return true
