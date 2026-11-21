extends SceneTree
## Headless scene-state checks for tow labels and lights; no rendering or gameplay.

const World = preload("res://src/storm_world.gd")
const Sim = preload("res://src/storm_sim.gd")

var _checks := 0
var _failures := 0
var _world: Node3D


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("towline_visual_feedback_test.gd requires --headless")
		quit(1)
		return
	_world = World.new()
	_world.configure(Sim.CONTRACTS["needle-bank"])
	root.add_child(_world)
	await process_frame
	var sim := Sim.new()
	for id: String in ["black-tide", "needle-bank"]:
		sim.reset(id)
		_world.configure(sim.contract)
		await process_frame
		var base := sim.snapshot()
		base.screen = "running"
		base.scanned = true
		base.tow_attached = true
		base.phase = "return"
		base.position = base.harbor
		base.cargo_position = base.harbor + Vector2(12.0, 0.0)
		for fixture: Array in [
			[0.40, 0.0, "", false],
			[0.72, 0.0, "TOW LOAD   72.0%   /   MONITOR", true],
			[0.9999, 0.25, "TOW LOAD   <100%   /   RISK FALLING 25.0%", true],
			[1.0, 0.01, "TOW LOAD   100.0%   /   OVERLOAD / RISK ACCUM 1.0%", true],
			[1.35, 0.58, "TOW LOAD   135.0%   /   OVERLOAD / RISK ACCUM 58.0%", true],
			[1.5, 0.9999, "TOW LOAD   ≥150%   /   OVERLOAD / RISK ACCUM <100%", true],
			[0.48, 0.48, "TOW LOAD   48.0%   /   RISK FALLING 48.0%", true],
			[0.28, 0.0001, "TOW LOAD   28.0%   /   RISK FALLING <0.1%", true],
			[0.28, 0.0, "", false],
		]:
			base.tension = fixture[0]
			base.overload = fixture[1]
			var before := base.duplicate(true)
			_world.present(base, 0.0, true)
			var label: Label3D = _world.get("_tow_label")
			var material: StandardMaterial3D = _world.get("_towline_material")
			var light: OmniLight3D = _world.get("_cable_light")
			var name := "%s/load=%.4f/risk=%.4f" % [id, base.tension, base.overload]
			_check(label.visible == fixture[3] and label.text == fixture[2], name + " exact scene-node state matches snapshot")
			_check(base == before, name + " scene presentation does not mutate the caller snapshot")
			_check((material.albedo_color == Color("ff684f")) == (base.tension >= 1.0),
				name + " physical cable color marks only live rated-load exceedance")
			var normal_energy := maxf(base.tension - 0.58, 0.0) * 1.1
			_check(is_equal_approx(light.light_energy, normal_energy) if base.tension < 1.0 else light.light_energy > normal_energy,
				name + " overload beacon follows current load, not residual historical risk")
			if base.tension < 1.0 and base.overload > 0.0:
				_check(label.modulate == Color("d8c5ff"), name + " recovery label uses its own state color")
			_check(not label.text.contains("ETA") and not label.text.contains("SEC"),
				name + " never invents a snap countdown")
		base.tow_attached = false
		base.tension = 1.5
		base.overload = 0.8
		_world.present(base, 0.0, true)
		_check(not _world.get("_tow_label").visible and _world.get("_cable_light").light_energy == 0.0,
			id + " detached tow clears cable warnings despite retained terminal snapshot")
	_world.queue_free()
	await process_frame
	print("Stormline towline visual feedback: %d checks, %d failures; two contract snapshots, headless scene-node state only; no rendering or gameplay." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
