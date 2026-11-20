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
			_test_simultaneous_tug_and_pod_impact(contract_id, hazard)
			_test_impact_cooldowns_do_not_repeat_within_window(contract_id, hazard)
			_test_slow_contact_causes_no_impact_hit(contract_id, hazard)
			_test_impact_damage_cooldown_expires(contract_id, hazard)
			_test_reset_clears_impact_cooldowns(contract_id, hazard)
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


func _test_simultaneous_tug_and_pod_impact(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var normal := Vector2.RIGHT
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + normal * (tug_margin - 0.05)
	sim.cargo_position = center + normal * (cargo_margin - 0.05)
	sim.velocity = -normal * 2.0
	sim.cargo_velocity = -normal * 2.0
	var event_before := sim.event_id
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(is_equal_approx(sim.hull, 100.0 - DT * 7.0 - 2.0 * 4.3),
		label + " simultaneous tug impact receives its own hull damage")
	_check(is_equal_approx(sim.cargo_integrity, 100.0 - DT * COLLISION_DPS - 2.0 * CARGO_IMPACT_DAMAGE),
		label + " simultaneous pod impact receives its own impact damage")
	_check(sim.position.distance_to(center) >= tug_margin - 0.0001
		and sim.cargo_position.distance_to(center) >= cargo_margin - 0.0001,
		label + " both bodies are independently displaced outside the reef")
	_check(sim.velocity.dot(normal) > 0.0 and sim.cargo_velocity.dot(normal) > 0.0,
		label + " both impacts independently deflect the bodies outward")
	_check(sim.event_id == event_before + 1 and sim.event_kind == "collision"
		and sim.event_message.contains("船体碰撞"),
		label + " simultaneous contacts keep a single debounced collision notice")


func _test_impact_cooldowns_do_not_repeat_within_window(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	var hull_after_impact := sim.hull
	var cargo_after_impact := sim.cargo_integrity
	var event_after_impact := sim.event_id
	# Re-enter both collision radii before the per-body 0.54-second impact window expires.
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(is_equal_approx(hull_after_impact - sim.hull, DT * 7.0),
		label + " repeat tug contact before cooldown adds gradual damage without a second impact hit")
	_check(is_equal_approx(cargo_after_impact - sim.cargo_integrity, DT * COLLISION_DPS),
		label + " repeat pod contact before cooldown adds gradual damage without a second impact hit")
	_check(sim.event_id == event_after_impact,
		label + " repeated contacts keep collision feedback debounced")


func _test_slow_contact_causes_no_impact_hit(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	# Inward speed below the 0.6 m/s impact threshold still applies ongoing contact damage.
	sim.velocity = Vector2.LEFT * 0.3
	sim.cargo_velocity = Vector2.LEFT * 0.3
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(is_equal_approx(sim.hull, 100.0 - DT * 7.0),
		label + " sub-threshold tug contact receives gradual damage but no impact hit")
	_check(is_equal_approx(sim.cargo_integrity, 100.0 - DT * COLLISION_DPS),
		label + " sub-threshold pod contact receives gradual damage but no impact hit")
	_check(sim.event_id == 0 and sim.event_kind.is_empty(),
		label + " sub-threshold contact does not show a misleading impact notice")


func _test_impact_damage_cooldown_expires(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	var hull_after_first := sim.hull
	var cargo_after_first := sim.cargo_integrity
	var event_after_first := sim.event_id
	# Advance real fixed model ticks away from all reefs beyond the per-body cooldown.
	sim.phase = "approach"
	sim.tow_attached = false
	sim.position = Vector2(-100.0, 120.0)
	sim.velocity = Vector2.ZERO
	sim.cargo_position = Vector2(100.0, 120.0)
	sim.cargo_velocity = Vector2.ZERO
	for _tick in range(40):
		sim.step(DT, {"power": 2})
	sim.phase = "return"
	sim.tow_attached = true
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(hull_after_first - sim.hull > DT * 7.0,
		label + " tug impact damage becomes available again after its cooldown")
	_check(cargo_after_first - sim.cargo_integrity > DT * COLLISION_DPS,
		label + " pod impact damage becomes available again after its cooldown")
	_check(sim.event_id == event_after_first + 1,
		label + " collision feedback becomes available again after its cooldown")
	_check(sim.mission_time > 1.5,
		label + " elapsed-cooldown setup advances through real fixed model time")


func _test_reset_clears_impact_cooldowns(contract_id: String, hazard: Dictionary) -> void:
	var sim := _fixture(contract_id, hazard)
	var center: Vector2 = hazard.position
	var tug_margin := float(hazard.radius) + 1.55
	var cargo_margin := float(hazard.radius) + 1.10
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	sim.reset(contract_id)
	sim.phase = "return"
	sim.tow_attached = true
	sim.mission_time = 1.0
	sim.position = center + Vector2.RIGHT * (tug_margin - 0.05)
	sim.cargo_position = center + Vector2.RIGHT * (cargo_margin - 0.05)
	sim.velocity = Vector2.LEFT * 2.0
	sim.cargo_velocity = Vector2.LEFT * 2.0
	sim._apply_reefs(DT)
	var label := contract_id + "/" + String(hazard.name)
	_check(sim.hull < 100.0 and sim.cargo_integrity < 100.0,
		label + " a fresh contract resets both per-body impact cooldowns")
	_check(sim.event_id == 1 and sim.event_kind == "collision",
		label + " a fresh contract resets collision-notice debounce state")


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
