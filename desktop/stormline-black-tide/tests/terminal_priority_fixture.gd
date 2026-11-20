extends RefCounted
## Synthetic final-docking-tick fixtures, never a natural route or production map.

const DT := 1.0 / 60.0
const PRIOR_HOLD_TICKS := 59
const CONTROLS := {"power": 2, "slow": true}
const IDLE_TOW_DRAW := (0.13 + 0.08) * DT
const CASES := [
	{"name": "healthy", "success": true},
	{"name": "battery-reserve", "success": true},
	{"name": "battery-exact", "success": false, "kind": "power_lost", "reason": "电量耗尽"},
	{"name": "battery-short", "success": false, "kind": "power_lost", "reason": "电量耗尽"},
	{"name": "hull-survives", "success": true},
	{"name": "hull-exhausted", "success": false, "kind": "collision", "reason": "船体耐久归零"},
	{"name": "cargo-survives", "success": true},
	{"name": "cargo-exhausted", "success": false, "kind": "collision", "reason": "回收舱破损"},
	{"name": "deadline-before", "success": true},
	{"name": "deadline-exact", "success": false, "kind": "timeout", "reason": "风暴窗口关闭"},
	{"name": "deadline-crossed", "success": false, "kind": "timeout", "reason": "风暴窗口关闭"},
	{"name": "battery-and-deadline", "success": false, "kind": "power_lost", "reason": "电量耗尽"},
	{"name": "cargo-battery-deadline", "success": false, "kind": "collision", "reason": "回收舱破损"},
	{"name": "all-exhausted", "success": false, "kind": "collision", "reason": "船体耐久归零"},
]


static func prepare(sim: Variant, contract_id: String) -> void:
	sim.reset(contract_id)
	# Deep-copy the contract before adding any test-only geometry.
	sim.contract = sim.contract.duplicate(true)
	sim.phase = "return"
	sim.scanned = true
	sim.tow_attached = true
	sim.mission_time = 20.0
	sim.position = sim.contract.harbor
	sim.cargo_position = sim.contract.harbor + Vector2(0.0, 6.0)
	sim.velocity = Vector2.ZERO
	sim.cargo_velocity = Vector2.ZERO
	sim.rope_length = 22.0
	sim.heading = 0.0
	sim.power_profile = 2


static func arm_final_tick(sim: Variant, scenario: Dictionary) -> void:
	var label: String = scenario.name
	if label == "battery-reserve":
		sim.battery = IDLE_TOW_DRAW + 0.001
	elif label == "battery-exact":
		sim.battery = IDLE_TOW_DRAW
	elif label in ["battery-short", "battery-and-deadline", "cargo-battery-deadline", "all-exhausted"]:
		sim.battery = IDLE_TOW_DRAW * 0.5
	if label in ["hull-survives", "hull-exhausted", "all-exhausted"]:
		sim.hull = 1.0 if label == "hull-survives" else 0.05
		_add_contact_reef(sim, sim.position, 1.95)
	if label in ["cargo-survives", "cargo-exhausted", "cargo-battery-deadline", "all-exhausted"]:
		sim.cargo_integrity = 1.0 if label == "cargo-survives" else 0.05
		_add_contact_reef(sim, sim.cargo_position, 1.50)
	if label == "deadline-before":
		sim.mission_time = float(sim.contract.deadline) - 2.0 * DT
	elif label == "deadline-exact":
		sim.mission_time = float(sim.contract.deadline) - DT
	elif label in ["deadline-crossed", "battery-and-deadline", "cargo-battery-deadline", "all-exhausted"]:
		sim.mission_time = float(sim.contract.deadline) - DT * 0.5


static func _add_contact_reef(sim: Variant, body_position: Vector2, center_offset: float) -> void:
	# At rest, this overlap causes only real continuous scrape damage in step().
	# The 0.1 m displacement remains well inside the harbor and clear of the pod/tug.
	sim.contract.hazards.append({"position": body_position + Vector2(center_offset, 0.0),
		"radius": 0.5, "name": "仅测试港内接触", "kind": "reef"})
