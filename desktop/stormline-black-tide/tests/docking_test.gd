extends SceneTree
## Isolated docking-rule boundary checks; no vessel is moved or auto-piloted.

const Sim = preload("res://src/storm_sim.gd")
const DT := 1.0 / 60.0
const SPEED_LIMIT := 2.6
const TENSION_LIMIT := 0.68

var _checks := 0
var _failures := 0


func _init() -> void:
	_run()


func _run() -> void:
	_check_progress(false, true, true, true, true, false, "tow must be attached")
	_check_progress(true, false, true, true, true, false, "tug must be within the harbor radius")
	_check_progress(true, true, false, true, true, false, "cargo must be within the harbor radius")
	_check_progress(true, true, true, false, true, false, "tug speed above limit rejected")
	_check_progress(true, true, true, true, false, false, "cargo speed above limit rejected")
	_check_progress(true, true, true, true, true, false, "tension at exclusive limit rejected", TENSION_LIMIT)
	_check_progress(true, true, true, true, true, true, "strictly safe tension advances")

	for contract_id: String in ["black-tide", "needle-bank"]:
		var edge := Sim.new()
		_prepare(edge, contract_id)
		var harbor: Vector2 = edge.contract.harbor
		var radius := float(edge.contract.harbor_radius)
		edge.position = harbor + Vector2(radius, 0.0)
		edge.cargo_position = harbor + Vector2(0.0, -radius)
		edge.velocity = Vector2(SPEED_LIMIT, 0.0)
		edge.cargo_velocity = Vector2(-SPEED_LIMIT, 0.0)
		edge.cable_tension = TENSION_LIMIT - 0.0001
		edge._update_docking(DT)
		_check(is_equal_approx(edge.dock, DT), contract_id + " accepts exact harbor/speed radius and strict tension margin")

		var hold := Sim.new()
		_park(hold, contract_id)
		for tick in range(59):
			hold._update_docking(DT)
		_check(hold.phase == "return" and hold.dock < 1.0, contract_id + " does not complete before one full second")
		hold._update_docking(DT)
		_check(hold.phase == "success" and hold.dock == 1.0, contract_id + " completes after one continuous second")
		_check(hold.report.get("score", 0) > 0 and hold.report.get("grade", "").length() == 1, contract_id + " boundary delivery produces a valid score report")

		var interrupted := Sim.new()
		_park(interrupted, contract_id)
		interrupted.dock = 0.5
		interrupted.velocity = Vector2(SPEED_LIMIT + 0.001, 0.0)
		interrupted._update_docking(DT)
		_check(is_zero_approx(interrupted.dock), contract_id + " a brief speed breach resets rather than pauses the hold")

		var exact_tension := Sim.new()
		_park(exact_tension, contract_id)
		exact_tension.cable_tension = TENSION_LIMIT
		exact_tension.dock = 0.5
		exact_tension._update_docking(DT)
		_check(is_zero_approx(exact_tension.dock), contract_id + " reaching the exclusive tension limit resets the hold")
	print("Stormline docking rule boundaries: %d checks, %d failures; direct deterministic rule checks only, no physical navigation or rendered play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _park(sim: Sim, contract_id: String) -> void:
	_prepare(sim, contract_id)
	var harbor: Vector2 = sim.contract.harbor
	sim.position = harbor
	sim.cargo_position = harbor
	sim.velocity = Vector2.ZERO
	sim.cargo_velocity = Vector2.ZERO


func _prepare(sim: Sim, contract_id: String) -> void:
	sim.reset(contract_id)
	sim.phase = "return"
	sim.tow_attached = true
	sim.cable_tension = TENSION_LIMIT - 0.01


func _check_progress(attached: bool, tug_inside: bool, cargo_inside: bool, tug_slow: bool,
		cargo_slow: bool, expected: bool, message: String, tension := TENSION_LIMIT - 0.01) -> void:
	var sim := Sim.new()
	_park(sim, "black-tide")
	sim.tow_attached = attached
	sim.cable_tension = tension
	var harbor: Vector2 = sim.contract.harbor
	var radius := float(sim.contract.harbor_radius)
	if not tug_inside:
		sim.position = harbor + Vector2(radius + 0.01, 0.0)
	if not cargo_inside:
		sim.cargo_position = harbor + Vector2(0.0, radius + 0.01)
	if not tug_slow:
		sim.velocity = Vector2(SPEED_LIMIT + 0.01, 0.0)
	if not cargo_slow:
		sim.cargo_velocity = Vector2(0.0, SPEED_LIMIT + 0.01)
	sim._update_docking(DT)
	_check((sim.dock > 0.0) == expected, message)


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
