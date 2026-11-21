extends SceneTree
## Exercise actual HUD guidance around the model's strict/inclusive boundaries.
const Sim = preload("res://src/storm_sim.gd")
const HUD = preload("res://src/storm_hud.gd")
const DT := 1.0 / 60.0
var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var source := FileAccess.get_file_as_string("res://src/storm_hud.gd")
	for gate: String in ["speed < Sim.SCAN_SPEED", "distance > Sim.ATTACH_RADIUS",
		"speed > Sim.ATTACH_SPEED", "relative_speed > ATTACH_RELATIVE_SPEED",
		"velocity.length() <= Sim.DOCK_SPEED", "tension < Sim.DOCK_TENSION"]:
		_check(source.contains(gate), "HUD gate comparison remains anchored to the production model: " + gate)
	_check(Sim.SCAN_SPEED == 5.5 and Sim.ATTACH_RADIUS == 15.5 and Sim.ATTACH_SPEED == 2.9
		and Sim.DOCK_SPEED == 2.6 and Sim.DOCK_TENSION == 0.68,
		"player-facing boundary suite is bound to current model constants")
	var hud := HUD.new()
	root.add_child(hud)
	await process_frame
	for speed: float in [5.499, 5.5, 5.501]:
		var scan := {"phase":"approach", "scanned":false, "scan":0.0,
			"velocity":Vector2(speed, 0.0), "target_distance":1.0}
		var hint: String = hud._interaction_guidance(scan, {})
		var eligible := speed < Sim.SCAN_SPEED
		_check(hint.contains("按住 E 扫描") == eligible and hint.contains("先减速") != eligible,
			"actual sonar guidance matches its strict 5.5 m/s gate at %.3f" % speed)
		if speed < Sim.SCAN_SPEED:
			_check(hint.contains("<5.5"), "sonar readout marks a rounded-under boundary")
		elif speed == Sim.SCAN_SPEED:
			_check(hint.contains("≥5.5"), "sonar readout exposes strict equality as not yet eligible")
		else:
			_check(hint.contains(">5.5"), "sonar readout exposes rounded-over speed")
	for distance: float in [15.499, 15.5, 15.501]:
		var attach := {"phase":"approach", "scanned":true, "target_distance":distance,
			"velocity":Vector2(2.0, 0.0), "cargo_velocity":Vector2.ZERO}
		var hint: String = hud._interaction_guidance(attach, {})
		_check(hint.contains("继续靠近回收舱") == (distance > Sim.ATTACH_RADIUS),
			"actual tow-distance guidance matches inclusive 15.5 m edge at %.3f" % distance)
		if is_equal_approx(distance, Sim.ATTACH_RADIUS):
			_check(hint.contains("15.5/≤15.5") and hint.contains("可按 Space 挂索"),
				"exact maximum attach radius is eligible and not falsely marked over-limit")
		elif distance < Sim.ATTACH_RADIUS:
			_check(hint.contains("<15.5"), "rounded-under attach radius is explicit")
		else:
			_check(hint.contains(">15.5"), "rounded-over attach radius is explicit")
	for speed: float in [2.899, 2.9, 2.901]:
		var attach := {"phase":"approach", "scanned":true, "target_distance":10.0,
			"velocity":Vector2(speed, 0.0), "cargo_velocity":Vector2.ZERO}
		var hint: String = hud._interaction_guidance(attach, {})
		var measured_speed: float = attach.velocity.length()
		var speed_over_limit := measured_speed > Sim.ATTACH_SPEED
		_check(hint.contains("船速过高") == speed_over_limit,
			"actual tow-speed guidance matches inclusive 2.9 m/s edge at %.3f" % speed)
	var dock: Dictionary = {"phase":"return"}
	var contract := {"harbor":Vector2.ZERO, "harbor_radius":18.0}
	var expected := "入港条件：船、舱均在港圈内\n速度 ≤2.6 m/s · 缆张 <68% · 稳定 1 秒"
	_check(hud._interaction_guidance(dock, contract) == expected,
		"dock instruction distinguishes inclusive speed from strict tension and matches their limits")
	for speed: float in [2.599, 2.6, 2.601]:
		var eligible := _model_docks({"tug_speed":speed,"cargo_speed":0.0,"tension":0.0})
		_check(eligible == (speed <= Sim.DOCK_SPEED), "model docking-speed boundary %s" % speed)
	for tension: float in [0.679, 0.68, 0.681]:
		var eligible := _model_docks({"tug_speed":0.0,"cargo_speed":0.0,"tension":tension})
		_check(eligible == (tension < Sim.DOCK_TENSION), "model docking-tension boundary %s" % tension)
	hud.queue_free()
	await process_frame
	print("Rule threshold language: %d checks, %d failures; no simulation value changes." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _model_docks(values: Dictionary) -> bool:
	var sim := Sim.new()
	sim.reset("black-tide")
	var harbor: Vector2 = sim.contract.harbor
	sim.phase = "return"
	sim.tow_attached = true
	sim.position = harbor
	sim.cargo_position = harbor
	sim.velocity = Vector2(0.0, -float(values.tug_speed))
	sim.cargo_velocity = Vector2(0.0, -float(values.cargo_speed))
	sim.cable_tension = float(values.tension)
	sim._update_docking(1.0)
	return sim.phase == "success" and sim.dock >= 1.0


func _check(ok: bool, label: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + label)
