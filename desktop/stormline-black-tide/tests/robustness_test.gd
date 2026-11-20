extends SceneTree
## Extreme input and fixed-step safeguards; deterministic, headless model only.

const Sim = preload("res://src/storm_sim.gd")
const EXPECTED_DT := 1.0 / 30.0

var _checks := 0
var _failures := 0


func _init() -> void:
	_run()


func _run() -> void:
	var sim := Sim.new()
	sim.step(3600.0, {"throttle": 1000000.0, "steer": -1000000.0, "reel": INF, "power": 99})
	_check(is_equal_approx(sim.mission_time, EXPECTED_DT), "one-hour frame stall advances by at most 1/30 second")
	_check(sim.throttle == 1.0 and sim.power_profile == 2, "finite excessive drive and power inputs stay within supported limits")
	_check(_finite_snapshot(sim.snapshot()), "bounded extreme controls preserve finite model state")

	var invalid := Sim.new()
	invalid.tow_attached = true
	invalid.phase = "return"
	invalid.scanned = true
	invalid.position = Vector2(0.0, 0.0)
	invalid.cargo_position = Vector2(10.0, 0.0)
	invalid.velocity = Vector2.ZERO
	invalid.cargo_velocity = Vector2.ZERO
	invalid.step(1.0 / 60.0, {"throttle": INF, "steer": NAN, "reel": -INF, "power": 2})
	_check(_finite_snapshot(invalid.snapshot()), "NaN and infinity in analog controls are neutralized before physics")
	_check(is_zero_approx(invalid.throttle), "invalid throttle falls back to neutral")
	_check(invalid.power_profile == 2 and is_finite(invalid.rope_length), "invalid steering/reel values do not poison rope or power")
	invalid.step(1.0 / 60.0, {"throttle": "full", "steer": null, "reel": Vector2.ONE, "power": "tow"})
	_check(_finite_snapshot(invalid.snapshot()) and is_zero_approx(invalid.throttle), "wrong input types are safely treated as neutral")
	_check(invalid.power_profile == 2, "wrong type does not change the selected power profile")
	invalid.step(1.0 / 60.0, {"power": 1e300, "throttle": 0.5})
	_check(invalid.power_profile == 2 and is_finite(invalid.throttle), "huge finite power requests clamp without integer overflow")
	for reel_value: Variant in [NAN, INF, -INF, "full", null, Vector2.ONE, 1000000.0, -1000000.0]:
		var actual := _tow_fixture()
		var expected := _tow_fixture()
		var safe_reel := 0.0
		if reel_value is float and is_finite(float(reel_value)):
			safe_reel = clampf(float(reel_value), -1.0, 1.0)
		actual.step(1.0 / 60.0, {"power": 2, "reel": reel_value})
		expected.step(1.0 / 60.0, {"power": 2, "reel": safe_reel})
		_check(actual.phase == "return" and actual.battery > 99.9,
			"malformed/excessive reel input cannot cause instant power loss: " + str(reel_value))
		_check(is_equal_approx(actual.battery, expected.battery)
			and is_equal_approx(actual.rope_length, expected.rope_length),
			"winch force and energy use the same sanitized control: " + str(reel_value))

	var invalid_delta := Sim.new()
	var before: Dictionary = invalid_delta.snapshot()
	invalid_delta.step(INF, {"throttle": 1.0})
	_check(invalid_delta.snapshot() == before, "non-finite frame duration is ignored without partial mutation")
	invalid_delta.step(NAN, {"throttle": 1.0})
	_check(invalid_delta.snapshot() == before, "NaN frame duration is ignored")

	var rng := RandomNumberGenerator.new()
	rng.seed = 0x53544F524D
	for contract_id: String in ["black-tide", "needle-bank"]:
		var stressed := Sim.new()
		stressed.reset(contract_id)
		stressed.scanned = true
		stressed.phase = "return"
		stressed.tow_attached = true
		for tick in range(5000):
			if stressed.phase in ["success", "failed"]:
				stressed.reset(contract_id)
				stressed.scanned = true
				stressed.phase = "return"
				stressed.tow_attached = true
			var controls := {
				"throttle": rng.randf_range(-1.0, 1.0),
				"steer": rng.randf_range(-1.0, 1.0),
				"reel": rng.randf_range(-1.0, 1.0),
				"power": rng.randi_range(-20, 20),
				"slow": rng.randf() < 0.2,
			}
			stressed.step(rng.randf_range(1.0 / 240.0, 0.1), controls)
			_check_finite_sim(stressed, contract_id + " tick " + str(tick))

	print("Stormline simulation robustness: %d checks, %d failures; fixed-step, malformed control and seeded 10000-tick dual-contract stress tests only." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _finite_snapshot(snapshot: Dictionary) -> bool:
	for field in ["position", "velocity", "cargo_position", "cargo_velocity"]:
		var value: Vector2 = snapshot[field]
		if not is_finite(value.x) or not is_finite(value.y):
			return false
	for field in ["heading", "time", "throttle", "hull", "cargo_integrity", "battery", "scan", "tension", "rope_length"]:
		if not is_finite(float(snapshot[field])):
			return false
	return true


func _tow_fixture() -> Sim:
	var sim := Sim.new()
	sim.scanned = true
	sim.phase = "return"
	sim.tow_attached = true
	sim.position = Vector2.ZERO
	sim.cargo_position = Vector2(0.0, 10.0)
	return sim


func _check_finite_sim(sim: Variant, label: String) -> void:
	var snapshot: Dictionary = sim.snapshot()
	var valid := _finite_snapshot(snapshot)
	valid = valid and sim.position.x >= -Sim.WORLD_LIMIT and sim.position.x <= Sim.WORLD_LIMIT
	valid = valid and sim.position.y >= -Sim.WORLD_LIMIT and sim.position.y <= Sim.WORLD_LIMIT
	valid = valid and sim.cargo_position.x >= -Sim.WORLD_LIMIT and sim.cargo_position.x <= Sim.WORLD_LIMIT
	valid = valid and sim.cargo_position.y >= -Sim.WORLD_LIMIT and sim.cargo_position.y <= Sim.WORLD_LIMIT
	valid = valid and sim.hull >= 0.0 and sim.hull <= 100.0
	valid = valid and sim.cargo_integrity >= 0.0 and sim.cargo_integrity <= 100.0
	valid = valid and sim.battery >= 0.0 and sim.battery <= 100.0
	valid = valid and sim.power_profile >= 0 and sim.power_profile < Sim.PROFILES.size()
	_check(valid, label + " retains finite, bounded world and resource state")


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
