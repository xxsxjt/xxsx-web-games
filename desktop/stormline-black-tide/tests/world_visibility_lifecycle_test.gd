extends SceneTree
## Headless scene-node projection checks for acquired-contact and tow visibility lifecycle.

const World = preload("res://src/storm_world.gd")
const Sim = preload("res://src/storm_sim.gd")

var _checks := 0
var _failures := 0
var _world: Node3D


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("world_visibility_lifecycle_test.gd requires --headless")
		quit(1)
		return
	_world = World.new()
	_world.configure(Sim.CONTRACTS["black-tide"])
	root.add_child(_world)
	await process_frame
	for id: String in ["black-tide", "needle-bank"]:
		await _exercise_contract(id)
	_world.queue_free()
	await process_frame
	_check(not is_instance_valid(_world), "test world releases its scene tree after lifecycle checks")
	print("Stormline world visibility lifecycle: %d checks, %d failures; two real contracts, snapshot-driven headless node states only; no rendering, gameplay, records or desktop play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _exercise_contract(id: String) -> void:
	var sim := Sim.new()
	sim.reset(id)
	_world.configure(sim.contract)
	await process_frame
	var label := id
	var old_root: Node3D = _world.get("_world_root")
	var old_marker: Node3D = _world.get("_target_marker")
	var old_link: MeshInstance3D = _world.get("_cable_links")[0]
	_check(_world.get_child_count() == 1 and old_root.is_inside_tree(), label + " rebuild leaves one current world root")
	_check(old_marker.position == Vector3(sim.contract.target.x, 0.0, sim.contract.target.y),
		label + " acquired-contact marker uses the selected contract location")

	var view: Dictionary = sim.snapshot()
	view["screen"] = "briefing"
	_world.present(view, 0.0, true)
	_check(_projection(false, false, false), label + " fresh briefing conceals unknown capsule and tow system")
	_check(view == sim.snapshot().merged({"screen": "briefing"}), label + " scene presentation does not mutate a fresh model snapshot")

	# A scan lock only reveals the target when its public snapshot permits it.
	sim.scanned = true
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(not bool(view.target_visible) and _projection(false, false, false),
		label + " a scanned but distant contact remains concealed")
	sim.position = sim.cargo_position + Vector2(51.0, 0.0)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(not bool(view.target_visible) and _projection(false, false, false),
		label + " exact 51 metre disclosure boundary remains concealed")
	sim.position = sim.cargo_position + Vector2(50.999, 0.0)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(bool(view.target_visible) and _projection(true, true, false),
		label + " contact becomes visible just inside the snapshot disclosure radius")
	_check(_world.get("_target_label").text == "SONAR LOCK   /   RECOVERY CAPSULE",
		label + " visible contact label agrees with the locked snapshot")
	_check(not bool(_world.get("_tow_label").visible), label + " unattached contact has no stale tow warning")

	# The same contract becomes a disclosed contact directly over its true target.
	sim.position = sim.cargo_position
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(bool(view.target_visible) and _projection(true, true, false),
		label + " acquired contact reveals its exact scene marker and capsule after sonar lock")

	view["screen"] = "paused"
	var paused := view.duplicate(true)
	_world.present(view, 0.0)
	_check(view == paused and _projection(true, true, false),
		label + " pause preserves contact projection without advancing its snapshot")

	# Return uses the known object but retires the approach-only marker.
	sim.phase = "return"
	sim.tow_attached = true
	sim.cable_tension = 0.80
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(_projection(false, true, true), label + " attached return hides approach marker but keeps capsule and cable")
	_check(_all_links_visible(), label + " attached tow activates every cable segment")

	# Cable snap clears tow-only cues; a scanned, still-nearby pod remains a known object.
	sim.phase = "failed"
	sim.tow_attached = false
	sim.cable_tension = 1.5
	sim.overload = 0.8
	view = sim.snapshot()
	view["screen"] = "debrief"
	_world.present(view, 0.0)
	_check(bool(view.target_visible) and _projection(false, true, false),
		label + " post-snap debrief keeps a nearby known capsule but no approach marker or cable")
	_check(not bool(_world.get("_tow_label").visible) and _world.get("_tow_label").text.is_empty()
		and _world.get("_cable_light").light_energy == 0.0 and not _all_links_visible(),
		label + " terminal cable break clears all tow-only visual residue")

	# Restart resets the model-derived presentation, then a second contract replaces old nodes.
	sim.reset(id)
	view = sim.snapshot()
	view["screen"] = "running"
	_world.present(view, 0.0, true)
	_check(_projection(false, false, false), label + " restart hides old acquired-contact and tow state")

	var next_id := "needle-bank" if id == "black-tide" else "black-tide"
	var next_sim := Sim.new()
	next_sim.reset(next_id)
	_world.configure(next_sim.contract)
	_check(_world.get_child_count() == 1 and not old_root.is_inside_tree(),
		label + " contract replacement immediately detaches its former world root")
	await process_frame
	_check(not is_instance_valid(old_root) and not is_instance_valid(old_marker) and not is_instance_valid(old_link),
		label + " contract replacement releases old marker and cable nodes")
	var next_view: Dictionary = next_sim.snapshot()
	var fresh_contract_marker: Node3D = _world.get("_target_marker")
	next_view["screen"] = "briefing"
	_world.present(next_view, 0.0, true)
	_check(_projection(false, false, false), label + " replacement contract begins with all hidden states reset")
	_check(fresh_contract_marker.position == Vector3(next_sim.contract.target.x, 0.0, next_sim.contract.target.y)
		and _world.get("_hazards").size() == next_sim.contract.hazards.size(),
		label + " replacement world owns the new contact and hazard layout")

	# Successful debrief snaps to the contract harbor; this is presentation-only.
	next_sim.scanned = true
	next_sim.tow_attached = true
	next_sim.phase = "success"
	next_sim.position = next_sim.contract.harbor + Vector2(40.0, -18.0)
	next_sim.cargo_position = next_sim.contract.harbor + Vector2(8.0, 3.0)
	var success_view: Dictionary = next_sim.snapshot()
	success_view["screen"] = "debrief"
	var success_before := success_view.duplicate(true)
	var camera_before_terminal: Vector3 = _world.get("_camera").position
	_world.present(success_view, 0.0)
	var pair_focus: Vector2 = next_sim.position.lerp(next_sim.cargo_position, 0.36)
	var expected_focus: Vector2 = pair_focus.lerp(next_sim.contract.harbor, 0.2)
	var expected_camera := Vector3(expected_focus.x, 79.0, expected_focus.y + 41.0)
	_check(_projection(false, true, true) and _all_links_visible(),
		label + " successful debrief retains delivered pair while retiring approach marker")
	_check(_world.get("_camera").position == camera_before_terminal,
		label + " terminal success camera eases instead of snapping on its first frame")
	for _frame in range(180):
		_world.present(success_view, 1.0 / 60.0)
	_check(_world.get("_camera").position.distance_to(expected_camera) < 0.05,
		label + " terminal success camera converges to a harbor-framed view")
	_check(success_view == success_before and next_sim.snapshot()["phase"] == "success",
		label + " terminal camera and visibility projection leave model/result unchanged")


func _projection(marker: bool, capsule: bool, cable: bool) -> bool:
	var actual_marker: bool = _world.get("_target_marker").visible
	var actual_capsule: bool = _world.get("_cargo").visible
	var actual_cable: bool = _world.get("_cable").visible
	_check(actual_marker == marker and actual_capsule == capsule and actual_cable == cable,
		"marker/capsule/cable visibility is %s/%s/%s" % [actual_marker, actual_capsule, actual_cable])
	return actual_marker == marker and actual_capsule == capsule and actual_cable == cable


func _all_links_visible() -> bool:
	var links: Array = _world.get("_cable_links")
	if links.size() != 14:
		return false
	for link: MeshInstance3D in links:
		if not link.visible or not link.is_inside_tree():
			return false
	return true


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
