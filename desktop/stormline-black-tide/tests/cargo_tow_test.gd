extends SceneTree
## Deterministic free-body tow / reef boundary checks; no scene or rendered play.

const Sim = preload("res://src/storm_sim.gd")
const DT := 1.0 / 60.0
const COLLISION_DPS := 10.5
const CARGO_IMPACT_DAMAGE := 6.0

var _checks := 0
var _failures := 0


func _init() -> void:
	_run()


func _run() -> void:
	var reef_count := 0
	for contract_id: String in ["black-tide", "needle-bank"]:
		for hazard: Dictionary in Sim.CONTRACTS[contract_id].hazards:
			if hazard.kind != "reef":
				continue
			reef_count += 1
			_test_reef_boundary(contract_id, hazard)
			_test_tail_pod_scrape(contract_id, hazard)
			_test_unattached_pod_is_not_towed_into_reef(contract_id, hazard)
	_check(reef_count == 6, "both routes expose the six expected static reef hazards")
	_test_damaged_pod_ends_the_contract()
	print("Stormline cargo tow / reef cases: %d checks, %d failures across %d reefs; deterministic model checks only, no rendered route play." % [_checks, _failures, reef_count])
	quit(0 if _failures == 0 else 1)


func _fixture(contract_id: String, hazard: Dictionary) -> Sim:
	var sim := Sim.new()
	sim.reset(contract_id)
	sim.phase = "return"
	sim.tow_attached = true
	sim.heading = 0.0
	sim.mission_time = 1.0
	var center: Vector2 = hazard.position
	var cargo_margin := float(hazard.radius) + 1.10
	sim.cargo_position = center + Vector2(cargo_margin - 0.05, 0.0)
	# Keep the tug beyond its own reef margin while the free pod cuts inside.
	sim.position = center + Vector2(0.0, -(cargo_margin + 6.0))
	sim.velocity = Vector2.ZERO
	sim.cargo_velocity = Vector2.ZERO
	sim.cargo_integrity = 100.0
	return sim


func _test_reef_boundary(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var margin := float(hazard.radius) + 1.10
	# Stay a small representable distance outside; adding and subtracting offsets
	# around large world coordinates can round an exact boundary inward.
	sim.cargo_position = center + Vector2(margin + 0.0001, 0.0)
	var before_position: Vector2 = sim.cargo_position
	var before_integrity := sim.cargo_integrity
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(sim.cargo_position == before_position, label + " pod just outside collision radius is not displaced")
	_check(is_equal_approx(sim.cargo_integrity, before_integrity), label + " pod just outside collision radius takes no damage")
	_check(sim.event_kind.is_empty(), label + " pod just outside collision radius emits no event")


func _test_tail_pod_scrape(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var normal := Vector2.RIGHT
	var margin := float(hazard.radius) + 1.10
	sim.cargo_position = center + normal * (margin - 0.05)
	sim.cargo_velocity = -normal * 2.0
	var tug_before: Vector2 = sim.position
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(is_equal_approx(sim.cargo_position.distance_to(center), margin), label + " pod is pushed to its collision-safe radius")
	_check(sim.position == tug_before and sim.hull == 100.0, label + " trailing pod scrape does not damage a clear tug")
	_check(is_equal_approx(sim.cargo_integrity, 100.0 - DT * COLLISION_DPS - 2.0 * CARGO_IMPACT_DAMAGE),
		label + " pod integrity receives gradual and impact damage")
	_check(sim.cargo_velocity.dot(normal) > 0.0, label + " impact response deflects the pod outward")
	_check(sim.tow_attached and sim.phase == "return", label + " survivable scrape keeps the tow and contract active")
	_check(sim.event_kind == "collision" and sim.event_message.contains(String(hazard.name))
		and sim.event_message.contains("舱体擦碰"), label + " reports the specific pod scrape")


func _test_unattached_pod_is_not_towed_into_reef(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	sim.tow_attached = false
	var center: Vector2 = hazard.position
	var before_position: Vector2 = sim.cargo_position
	var before_integrity := sim.cargo_integrity
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(sim.cargo_position == before_position and is_equal_approx(sim.cargo_integrity, before_integrity),
		label + " unattached pod is unaffected by the tow-only reef contact rule")


func _test_damaged_pod_ends_the_contract() -> void:
	var contract_id := "needle-bank"
	var hazard: Dictionary = Sim.CONTRACTS[contract_id].hazards[1]
	var center: Vector2 = hazard.position
	var sim := _fixture(contract_id, hazard)
	var margin := float(hazard.radius) + 1.10
	sim.cargo_integrity = 0.1
	sim.cargo_position = center + Vector2(margin - 1.0, 0.0)
	sim.cargo_velocity = Vector2(-4.0, 0.0)
	sim.position = center + Vector2(0.0, -30.0)
	sim.rope_length = Sim.ROPE_MAX
	sim.step(DT, {"power": 2})
	_check(sim.phase == "failed" and sim.cargo_integrity == 0.0,
		"a fatal pod scrape settles the mission as a cargo failure")
	_check(sim.event_kind == "collision" and sim.fail_reason.contains("回收舱破损"),
		"fatal scrape reports the pod failure reason")
	_check(sim.report.is_empty(), "cargo collision failure does not create a successful score report")


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
