extends SceneTree
## Measured load/risk fixtures and natural keyboard unload vs. snap from a clean contract.

const HUD = preload("res://src/storm_hud.gd")
const Sim = preload("res://src/storm_sim.gd")
const MainScene = preload("res://scenes/main.tscn")
const Route = preload("res://tests/needle_recovery_route.gd")
const Driver = preload("res://tests/needle_keyboard_driver.gd")
const Records = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0
const UNLOAD_AT := 0.18

var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("tow_risk_feedback_test.gd requires --headless")
		quit(1)
		return
	var viewport := SubViewport.new()
	viewport.disable_3d = true
	viewport.size = Vector2i(1440, 900)
	root.add_child(viewport)
	var hud := HUD.new()
	viewport.add_child(hud)
	hud.configure(Sim.CONTRACTS, {})
	for id: String in ["black-tide", "needle-bank"]:
		await _rule_fixtures(hud, id)
		for dimensions: Vector2i in [Vector2i(960, 600), Vector2i(1280, 720), Vector2i(1440, 900), Vector2i(1920, 1080)]:
			viewport.size = dimensions
			await _display_fixtures(hud, id, dimensions)
	viewport.queue_free()
	await process_frame
	await _natural_voyages()
	print("Stormline tow risk feedback: %d checks, %d failures; model thresholds, dual-contract layout and two input-only natural keyboard voyages; no rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _rule_fixtures(hud: Node, id: String) -> void:
	for raw: float in [0.9999, 1.0, 1.35, 1.65]:
		var sim := Sim.new()
		sim.reset(id)
		# Isolated rule fixture only: stationary boat/pod, 16 m from stern to pod.
		sim.phase = "return"
		sim.scanned = true
		sim.tow_attached = true
		sim.position = Vector2.ZERO
		sim.cargo_position = Vector2(16, 2.2)
		sim.rope_length = 16.0 - raw * float(Sim.PROFILES[0].rating) / 3.8
		sim.overload = 0.25
		var view := sim.step(DT)
		view.screen = "running"
		hud.present(view)
		var label := "%s/rule-%.4f" % [id, raw]
		var accumulating := float(view.overload) > 0.25
		_check(accumulating == (raw >= 1.0) and is_equal_approx(view.tension, minf(raw, 1.5))
			and (view.tension == 1.0 if raw == 1.0 else true), label + " actual model gates accumulation at inclusive rated load")
		_check(_matches_live(hud, view), label + " display follows actual model movement of accumulated risk")
		if raw == 1.65:
			_check(float(view.overload) - 0.25 > DT * 1.5 / Sim.OVERLOAD_TIME
				and _gauge_text(hud, "tension") == "≥150%", label + " capped tension is only a lower bound, not the accumulation rate")
	await process_frame


func _display_fixtures(hud: Node, id: String, dimensions: Vector2i) -> void:
	var sim := Sim.new()
	sim.reset(id)
	var view := sim.snapshot()
	view.screen = "running"
	view.phase = "return"
	view.scanned = true
	view.tow_attached = true
	view.position = view.harbor
	view.cargo_position = view.harbor + Vector2(3, 0)
	view.battery = 9.0
	var action: Label = hud.get("_tow_action")
	var label := "%s/%dx%d" % [id, dimensions.x, dimensions.y]
	for fixture: Array in [
		[1.0, 0.01, "100.0%", "1.0%", true],
		[1.5, 0.9999, "≥150%", "<100%", true],
		[0.9999, 0.2, "<100%", "20.0%", false],
		[0.0001, 0.0001, "<0.1%", "<0.1%", false],
		[0.42, 0.0, "42.0%", "0.0%", false],
	]:
		view.tension = fixture[0]
		view.overload = fixture[1]
		view.peak_tension = maxf(view.peak_tension, view.tension)
		view.power = 2 if view.tension == 1.5 else 0
		view.rope_length = Sim.ROPE_MAX if view.tension == 1.5 else 12.0
		view.event_kind = "collision" if fixture[4] else "overload"
		view.notice = "舱体擦碰：中央针礁。留更大的外弯。" if fixture[4] else "拖缆过载！松油门、放绳，或切换 3 稳索。"
		var before := view.duplicate(true)
		hud.present(view)
		for frame in range(3):
			await process_frame
		var key := label + "/load=%s/risk=%s" % [view.tension, view.overload]
		_check(_matches_live(hud, view) and view == before, key + " snapshot-driven exact rails and risk state")
		_check(_gauge_text(hud, "tension") == fixture[2] and _gauge_text(hud, "sonar_load") == fixture[3],
			key + " percentage rounding does not imply false safe, full or exact capped readings")
		_check(hud.get("_warning").visible and hud.get("_warning").text.contains("电量告急")
			and hud.get("_notice").visible == fixture[4] and hud.get("_dock").visible,
			key + " low battery and dock stay visible, collision retained and stale overload notice suppressed")
		if fixture[4]:
			_check(action.text.contains("松油门") and action.text.contains("F 放缆") == (view.rope_length < Sim.ROPE_MAX)
				and action.text.contains("3 稳索") == (view.power != 2), key + " suggests only available unload controls")
		_check(_layout_ok(hud, dimensions), key + " concurrent cue, notice, dock and warning fit")
		view.screen = "paused"
		hud.present(view)
		hud.present(view)
		_check(_matches_live(hud, view), key + " repeated paused presentation never integrates risk")
		view.screen = "running"
	view.tow_attached = false
	view.scanned = false
	view.phase = "approach"
	view.scan = 0.32
	hud.present(view)
	var gauges: Dictionary = hud.get("_gauges")
	_check(not action.visible and gauges.tension.bar.value == 0.0 and _gauge_text(hud, "tension") == "未挂索"
		and gauges.sonar_load.caption.text == "声纳锁定" and gauges.sonar_load.bar.value == 32.0,
		label + " no stale tow presentation after returning to scan")


func _natural_voyages() -> void:
	var folder := ProjectSettings.globalize_path("res://.testdata/tow-risk-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "create isolated feedback-voyage score directory")
		return
	var path := folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", path)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	var saved := PackedByteArray()
	var shared_pre_unload: Dictionary = {}
	for rescue: bool in [true, false]:
		if rescue:
			Driver.edge(root, KEY_2)
			Driver.edge(root, KEY_ENTER)
		else:
			Driver.edge(root, KEY_R)
		var label := "unload" if rescue else "snap"
		var sim: Variant = app.get("sim")
		var model := Sim.new()
		model.reset("needle-bank")
		_check(app.get("screen") == "running" and sim.snapshot() == model.snapshot(), label + " starts untouched Needle Bank")
		var route := Route.new("overload")
		var model_route := Route.new("overload")
		var driver := Driver.new()
		var model_driver := Driver.new()
		var matched := true
		var first_mismatch := 0
		var feedback_mismatch := 0
		var load_tick := 0
		var branch_tick := 0
		var decay_tick := 0
		var cleared_tick := 0
		var observed_stale_event := false
		for tick in range(1, Route.MAX_TICKS + 1):
			var before: Dictionary = sim.snapshot()
			var model_before := model.snapshot()
			if branch_tick == 0 and before.overload >= UNLOAD_AT:
				branch_tick = tick
				if rescue:
					shared_pre_unload = before.duplicate(true)
				else:
					_check(before == shared_pre_unload, "snap matches unload snapshot before policies diverge")
			var controls := driver.quantize(_commands(route, before, rescue))
			var expected := model_driver.quantize(_commands(model_route, model_before, rescue))
			driver.apply(root, controls)
			app.call("_physics_process", DT)
			var after: Dictionary = sim.snapshot()
			var expected_after := model.step(DT, expected)
			route.observe(before, after)
			model_route.observe(model_before, expected_after)
			matched = matched and controls == expected and after == expected_after
			if not matched and first_mismatch == 0:
				first_mismatch = tick
			if load_tick == 0 and after.overload > 0.0:
				load_tick = tick
			if decay_tick == 0 and load_tick > 0 and after.overload < before.overload:
				decay_tick = tick
			if cleared_tick == 0 and decay_tick > 0 and after.overload == 0.0:
				cleared_tick = tick
			if app.get("screen") != "running":
				break
			if tick % 30 == 0 or tick in [load_tick, branch_tick, decay_tick, cleared_tick]:
				app.call("_process", 0.0)
				var hud: Node = app.get("hud")
				var stale: bool = after.event_kind == "overload" and not String(after.notice).is_empty() and after.tension < 1.0
				observed_stale_event = observed_stale_event or stale
				if feedback_mismatch == 0 and (not _matches_live(hud, after) or not _matches_world(app.get("world"), after) or sim.snapshot() != after
					or (stale and hud.get("_notice").visible)):
					feedback_mismatch = tick
			if tick % 600 == 0:
				await process_frame
		_check(matched and route.ticks == model_route.ticks, label + " every formal polling tick matches same-input model; first mismatch %d" % first_mismatch)
		_check(feedback_mismatch == 0 and route.scan_tick == 1829 and route.attach_tick == 2869 and route.impact_tick == 4273
			and load_tick > route.impact_tick and branch_tick > load_tick,
			label + " actual scan/attach/reef impact precede read-only live overload feedback; first mismatch %d" % feedback_mismatch)
		var hud: Node = app.get("hud")
		if rescue:
			# Policy is chosen before this tick's step; real decay may start in that same step.
			_check(decay_tick >= branch_tick and decay_tick > 0 and cleared_tick > decay_tick and observed_stale_event
				and route.peak_overload < 1.0, "unload inputs produce actual decay to zero and replace stale live overload cue")
			_check(sim.phase == "success" and app.get("screen") == "debrief" and route.dock_hold >= 60,
				"controlled unloading still leads to actual two-body delivery")
			saved = FileAccess.get_file_as_bytes(path) if FileAccess.file_exists(path) else PackedByteArray()
			_check(not saved.is_empty() and app.get("_record_status") == Records.NEW_BEST, "rescued delivery saves only an isolated test best")
		else:
			_check(sim.phase == "failed" and sim.event_kind == "snap" and route.ticks == 4519
				and sim.overload == 1.0 and not sim.tow_attached and decay_tick == 0,
				"continuing unsafe inputs crosses the original snap terminal at unchanged tick")
			_check(app.get("screen") == "debrief" and not hud.get("_tow_action").is_visible_in_tree()
				and hud.get("_result_message").text.contains("断裂") and hud.get("_result_stats").peak_tension.text == "≥150%",
				"real snap uses debrief rather than live hints and reports capped peak honestly")
			_check(not saved.is_empty() and FileAccess.get_file_as_bytes(path) == saved and sim.report.is_empty(),
				"snap does not touch the rescued voyage's isolated score")
		driver.release()
		_check(Driver.all_released(), label + " releases all process-local inputs")
		print("APP tow_risk_feedback/%s: %s load=%d branch=%d decay=%d clear=%d stale_event=%s match=%s feedback_mismatch=%d" % [
			label, route.metrics(sim.snapshot()), load_tick, branch_tick, decay_tick, cleared_tick, str(observed_stale_event), str(matched), feedback_mismatch])
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "clean only the current isolated score directory")


func _commands(route: Variant, view: Dictionary, rescue: bool) -> Dictionary:
	if rescue and route.mode == "overload" and view.overload >= UNLOAD_AT:
		route.mode = "unload"
	if route.mode == "unload":
		if view.overload > 0.0:
			return {"power": 2, "slow": true, "reel": 1.0}
		route.mode = "recover"
	return route.controls(view)


func _matches_live(hud: Node, view: Dictionary) -> bool:
	var gauges: Dictionary = hud.get("_gauges")
	var action: Label = hud.get("_tow_action")
	if not view.tow_attached:
		return not action.visible and gauges.sonar_load.caption.text == "声纳锁定"
	var active: bool = view.tension >= 1.0
	var falling: bool = not active and view.overload > 0.0
	return is_equal_approx(gauges.tension.bar.value, view.tension * 100.0) \
		and is_equal_approx(gauges.sonar_load.bar.value, view.overload * 100.0) \
		and gauges.tension.caption.text.contains("过载") == active \
		and gauges.sonar_load.caption.text.contains("累积") == active \
		and gauges.sonar_load.caption.text.contains("回落") == falling \
		and gauges.tension.fill.bg_color == (HUD.AMBER if active else HUD.TEAL) \
		and gauges.sonar_load.fill.bg_color == (HUD.AMBER if active else (HUD.LILAC if falling else HUD.TEAL)) \
		and action.visible == (active or falling) and (not falling or action.text.contains("风险仍在回落"))


func _gauge_text(hud: Node, id: String) -> String:
	return hud.get("_gauges")[id].label.text


func _matches_world(world: Node, view: Dictionary) -> bool:
	var label: Label3D = world.get("_tow_label")
	if not view.tow_attached:
		return not world.get("_cable").visible and not label.visible and label.text.is_empty() \
			and world.get("_cable_light").light_energy == 0.0
	var active: bool = view.tension >= 1.0
	var falling: bool = not active and view.overload > 0.0
	return world.get("_cable").visible and label.visible == (view.tension >= 0.72 or falling) \
		and label.text.contains("OVERLOAD") == active \
		and label.text.contains("RISK ACCUM") == active \
		and label.text.contains("RISK FALLING") == falling \
		and (view.tension < 1.5 or label.text.contains("≥150%"))


func _layout_ok(hud: Node, dimensions: Vector2i) -> bool:
	var bounds := Rect2(Vector2.ZERO, Vector2(dimensions)).grow(1.0)
	var panels: Array[Rect2] = []
	for child in hud.get("_live").get_children():
		if child is Control and child.visible:
			var rect := _rect(child)
			if not bounds.encloses(rect):
				return false
			for other in panels:
				if other.intersects(rect):
					return false
			panels.append(rect)
	var gauges: Dictionary = hud.get("_gauges")
	for text: Label in [hud.get("_tow_action"), hud.get("_notice"), hud.get("_warning"), hud.get("_dock_instruction"),
		gauges.tension.caption, gauges.tension.label, gauges.sonar_load.caption, gauges.sonar_load.label]:
		if text.is_visible_in_tree() and (not bounds.encloses(_rect(text))
			or not _rect(text.get_parent()).grow(1.0).encloses(_rect(text))
			or text.get_visible_line_count() < text.get_line_count()):
			return false
	return true


func _rect(control: Control) -> Rect2:
	return control.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, control.size)


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
