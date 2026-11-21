extends SceneTree
## Programmatic Control geometry checks only; no GUI automation or screenshots.

const HUD = preload("res://src/storm_hud.gd")
const Sim = preload("res://src/storm_sim.gd")
var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	var viewport := SubViewport.new()
	viewport.disable_3d = true
	viewport.size = Vector2i(1440, 900)
	root.add_child(viewport)
	var hud := HUD.new()
	viewport.add_child(hud)
	hud.configure(Sim.CONTRACTS, {})
	var sim := Sim.new()
	for id: String in Sim.CONTRACTS:
		sim.reset(id)
		await _check_contract_layout(viewport, hud, sim)
	viewport.queue_free()
	await process_frame
	print("Stormline layout geometry: %d checks, %d failures; programmatic bounds only, no rendered screenshot or real-window test." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check_contract_layout(viewport: SubViewport, hud: CanvasLayer, sim: RefCounted) -> void:
	for dimensions: Vector2i in [Vector2i(1440, 900), Vector2i(1280, 720), Vector2i(960, 600), Vector2i(1920, 1080)]:
		viewport.size = dimensions
		for scenario: String in ["briefing", "running", "dock", "paused", "failed", "success"]:
			var view: Dictionary = sim.snapshot()
			view.screen = scenario
			if scenario == "dock":
				view.screen = "running"
				view.scanned = true
				view.tow_attached = true
				view.phase = "return"
				view.cargo_position = view.harbor
				view.tension = 1.2
			if scenario in ["failed", "success"]:
				view.screen = "debrief"
				view.phase = scenario
				view.fail_reason = "拖缆持续过载后断裂。"
				if scenario == "success":
					view.report = {"score": 10000, "grade": "S", "time": 108.7, "hull": 100.0, "peak_tension": 0.99}
			hud.present(view)
			for frame in range(4):
				await process_frame
			var label := "%s/%dx%d/%s" % [view.contract_id, dimensions.x, dimensions.y, scenario]
			var bounds := Rect2(Vector2.ZERO, Vector2(dimensions))
			if scenario in ["running", "dock"]:
				var panels: Array[Control] = []
				for child in hud.get("_live").get_children():
					if child is Control and child.visible:
						panels.append(child)
				for panel in panels:
					_check(_contains(bounds, _rect(panel)), label + " live panel in bounds: " + str(panel.get_index()))
				for a in range(panels.size()):
					for b in range(a + 1, panels.size()):
						_check(not _rect(panels[a]).intersects(_rect(panels[b])), label + " panels do not overlap: %d/%d" % [a, b])
			else:
				var menu: Control = hud.get("_menus")[view.screen]
				_check(_contains(bounds, _rect(menu)), label + " menu is inside viewport; rect=" + str(_rect(menu)))
				if scenario == "briefing":
					var dossier: Label = hud.get("_brief_copy")
					_check(dossier.text == Sim.CONTRACTS[view.contract_id].briefing and _contains(bounds, _rect(dossier)),
						label + " selected briefing copy remains in bounds")
			for button: Button in hud.find_children("*", "Button", true, false):
				if button.is_visible_in_tree():
					_check(_contains(bounds, _rect(button)), label + " button in bounds: " + button.text)


func _contains(outer: Rect2, inner: Rect2) -> bool:
	return outer.grow(1.0).encloses(inner)


func _rect(control: Control) -> Rect2:
	return control.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, control.size)


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
