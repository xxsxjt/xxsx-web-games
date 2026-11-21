extends SceneTree
## Synthetic HUD/rule boundary fixtures, followed by input-only natural voyages.
## Headless geometry only: no rendering, screenshots, OS input or player profiles.

const HUD = preload("res://src/storm_hud.gd")
const Sim = preload("res://src/storm_sim.gd")
const MainScene = preload("res://scenes/main.tscn")
const Route = preload("res://tests/needle_recovery_route.gd")
const Driver = preload("res://tests/needle_keyboard_driver.gd")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0

var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("interaction_feedback_test.gd requires --headless")
		quit(1)
		return
	for dimensions: Vector2i in [Vector2i(960, 600), Vector2i(1280, 720), Vector2i(1440, 900), Vector2i(1920, 1080)]:
		var viewport := SubViewport.new()
		viewport.disable_3d = true
		viewport.size = dimensions
		root.add_child(viewport)
		var hud := HUD.new()
		viewport.add_child(hud)
		hud.configure(Sim.CONTRACTS, {})
		for id: String in ["black-tide", "needle-bank"]:
			await _fixtures(hud, dimensions, id)
		viewport.queue_free()
		await process_frame
	await _natural_voyages()
	print("Stormline interaction feedback: %d checks, %d failures; two contracts at four viewport sizes, model-gated fixtures and two input-only natural keyboard voyages; no rendered/manual play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _fixtures(hud: Node, dimensions: Vector2i, id: String) -> void:
	var label := "%s/%dx%d" % [id, dimensions.x, dimensions.y]
	var sim := Sim.new()
	sim.reset(id)
	var view := sim.snapshot()
	view.screen = "running"
	view.velocity = Vector2(6.0, 0.0)
	view.scan = 0.42
	view.notice = "目标尚未锁定。靠近信号区域后按住 E 扫描。"
	hud.present(view)
	await _settle()
	var objective: String = hud.get("_objective").text
	_check(objective.contains("≤%.0f" % Sim.SCAN_RADIUS)
		and objective.contains("<%.1f" % Sim.SCAN_SPEED) and objective.contains("6.0 m/s")
		and objective.contains("减速") and objective.contains("42%"), label + " blocked scan reports true limits and current values")
	_check(_layout_ok(hud, dimensions), label + " blocked scan and full denial notice fit")
	var hidden := view.duplicate(true)
	hidden.cargo_position += Vector2(100, 100)
	hidden.cargo_velocity = Vector2(17, 0)
	_check(hud.call("_interaction_guidance", hidden, sim.contract) == objective,
		label + " unlocked guidance never exposes hidden cargo range/velocity")
	for speed: float in [Sim.SCAN_SPEED, Sim.SCAN_SPEED - 0.01]:
		view.velocity = Vector2(speed, 0.0)
		hud.present(view)
		await _settle()
		var actual: Vector2 = view.velocity
		_check(hud.get("_objective").text.contains("按住 E") == (actual.length() < Sim.SCAN_SPEED),
			label + " strict scan-speed limit matches representable velocity %.9f" % actual.length())
	# The pre-lock range in snapshot is to the beacon, not the hidden pod.
	for inside: bool in [false, true]:
		var scan_sim := Sim.new()
		scan_sim.reset(id)
		scan_sim.position = scan_sim.cargo_position + Vector2(Sim.SCAN_RADIUS + (0.01 if not inside else 0.0), 0)
		scan_sim.velocity = Vector2.ZERO
		var prior := scan_sim.scan_progress
		scan_sim.step(DT, {"scan": true})
		_check((scan_sim.scan_progress > prior) == inside, label + " model scan-radius gate remains unchanged")

	var attach_cases := [
		["distance-edge", true, Sim.ATTACH_RADIUS, Vector2(2.8, 0), Vector2.ZERO, "可按 Space"],
		["distance-out", true, Sim.ATTACH_RADIUS + 0.001, Vector2.ZERO, Vector2.ZERO, "继续靠近"],
		["speed-decimal", true, 15.0, Vector2(Sim.ATTACH_SPEED, 0), Vector2.ZERO, ""],
		["speed-out", true, 15.0, Vector2(2.901, 0), Vector2.ZERO, "船速过高"],
		["relative-in", true, 15.0, Vector2(2.0, 0), Vector2(-2.19, 0), "可按 Space"],
		["relative-decimal", true, 15.0, Vector2.ZERO, Vector2(4.2, 0), ""],
		["relative-out", true, 15.0, Vector2(2.0, 0), Vector2(-2.21, 0), "相对速过高"],
		["all-blocked", true, 20.0, Vector2(3.3, 0), Vector2(-1.7, 0), "继续靠近"],
		["not-locked", false, 10.0, Vector2.ZERO, Vector2.ZERO, "按住 E"],
	]
	for fixture: Array in attach_cases:
		var probe := Sim.new()
		probe.reset(id)
		probe.scanned = fixture[1]
		probe.position = Vector2.ZERO
		probe.cargo_position = Vector2(fixture[2], 0)
		probe.velocity = fixture[3]
		probe.cargo_velocity = fixture[4]
		view = probe.snapshot()
		view.screen = "running"
		view.battery = 10.0
		view.notice = "相对速度过高。松油门或倒车修正，稳住再挂索。"
		hud.present(view)
		await _settle()
		objective = hud.get("_objective").text
		# Oracle is the actual model operation, not a duplicate predicate in the test.
		probe._attach(Vector2.UP)
		_check(objective.contains("可按 Space 挂索") == probe.tow_attached,
			label + "/" + String(fixture[0]) + " readiness matches real _attach including float boundaries")
		_check(String(fixture[5]).is_empty() or objective.contains(fixture[5]),
			label + "/" + String(fixture[0]) + " names the first actionable blocker")
		_check(_layout_ok(hud, dimensions), label + "/" + String(fixture[0]) + " feedback, notice and low-battery warning fit")

	var dock_cases := [
		["both-ready", 2.0, 2.0, 2.5, Sim.DOCK_SPEED, Sim.DOCK_TENSION - 0.001],
		["radius-edge", float(sim.contract.harbor_radius), 2.0, 0.0, 0.0, 0.0],
		["tug-out", float(sim.contract.harbor_radius) + 0.001, 2.0, 0.0, 0.0, 0.0],
		["cargo-out", 2.0, float(sim.contract.harbor_radius) + 0.001, 0.0, 0.0, 0.0],
		["tug-fast", 2.0, 2.0, Sim.DOCK_SPEED + 0.001, 0.0, 0.0],
		["cargo-fast", 2.0, 2.0, 0.0, Sim.DOCK_SPEED + 0.001, 0.0],
		["tension-edge", 2.0, 2.0, 0.0, 0.0, Sim.DOCK_TENSION],
		["tension-out", 2.0, 2.0, 0.0, 0.0, Sim.DOCK_TENSION + 0.001],
		["overload", 2.0, 2.0, 3.0, 3.0, 1.2],
	]
	for fixture: Array in dock_cases:
		var probe := Sim.new()
		probe.reset(id)
		probe.phase = "return"
		probe.scanned = true
		probe.tow_attached = true
		probe.position = probe.contract.harbor + Vector2(fixture[1], 0)
		probe.cargo_position = probe.contract.harbor + Vector2(0, fixture[2])
		probe.velocity = Vector2(fixture[3], 0)
		probe.cargo_velocity = Vector2(fixture[4], 0)
		probe.cable_tension = fixture[5]
		probe.dock = 0.75
		view = probe.snapshot()
		view.screen = "running"
		view.notice = "舱体擦碰：中央针礁。留更大的外弯。"
		view.battery = 10.0
		hud.present(view)
		await _settle()
		probe._update_docking(DT)
		var ready := probe.dock > 0.75
		_check(hud.get("_dock").visible
			and (hud.get("_dock_instruction").get_theme_color("font_color") == HUD.GREEN) == ready,
			label + "/" + String(fixture[0]) + " docking state matches actual _update_docking")
		_check(hud.get("_dock_progress").text.contains("0.75 / 1.00 秒")
			and is_equal_approx(hud.get("_dock_meter").value, view.dock),
			label + "/" + String(fixture[0]) + " progress consumes snapshot, never predicts or integrates")
		_check(hud.get("_objective").text.contains("≤%.1f" % Sim.DOCK_SPEED)
			and hud.get("_dock_instruction").text.contains("<%.0f%%" % (Sim.DOCK_TENSION * 100.0)),
			label + "/" + String(fixture[0]) + " uses the actual inclusive speed and exclusive tension limits")
		_check(_layout_ok(hud, dimensions), label + "/" + String(fixture[0]) + " dock, collision notice and warning fit")
		var instruction: String = hud.get("_dock_instruction").text
		view.screen = "paused"
		hud.present(view)
		hud.present(view)
		_check(hud.get("_dock_instruction").text == instruction and is_equal_approx(hud.get("_dock_meter").value, 0.75),
			label + "/" + String(fixture[0]) + " paused presentation preserves exact measured state")
	view.screen = "running"
	view.tow_attached = false
	hud.present(view)
	_check(not hud.get("_dock").visible, label + " unattached tow never presents docking readiness")


func _natural_voyages() -> void:
	var folder := ProjectSettings.globalize_path("res://.testdata/feedback-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "create isolated natural-feedback record directory")
		return
	var record_path := folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", record_path)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	var saved := PackedByteArray()
	for mode: String in ["recover", "overload"]:
		if mode == "recover":
			Driver.edge(root, KEY_2)
			Driver.edge(root, KEY_ENTER)
		else:
			Driver.edge(root, KEY_R)
		var sim: Variant = app.get("sim")
		var model := Sim.new()
		model.reset("needle-bank")
		_check(app.get("screen") == "running" and sim.snapshot() == model.snapshot(), mode + " starts an untouched natural contract")
		var route := Route.new(mode)
		var model_route := Route.new(mode)
		var driver := Driver.new()
		var model_driver := Driver.new()
		var matched := true
		var feedback_valid := true
		var presentation_read_only := true
		var observed := {"scan": false, "attach": false, "return": false, "dock": false, "hold": false, "overload": false}
		for tick in range(Route.MAX_TICKS):
			var before: Dictionary = sim.snapshot()
			var model_before := model.snapshot()
			var controls: Dictionary = driver.quantize(route.controls(before))
			var model_controls: Dictionary = model_driver.quantize(model_route.controls(model_before))
			if tick % 30 == 0 or controls.tow_pressed:
				var was_valid := feedback_valid
				app.call("_process", 0.0)
				presentation_read_only = presentation_read_only and sim.snapshot() == before
				var hud: Node = app.get("hud")
				var text: String = hud.get("_objective").text
				if not before.scanned:
					observed.scan = observed.scan or before.scan > 0.0
					feedback_valid = feedback_valid and text.contains("声纳范围") and text.contains("%.0f%%" % (before.scan * 100.0))
				elif not before.tow_attached:
					observed.attach = true
					feedback_valid = feedback_valid and text.contains("挂索 距离 %.1f" % before.target_distance)
					if controls.tow_pressed:
						feedback_valid = feedback_valid and text.contains("可按 Space 挂索")
				else:
					observed["return"] = true
					observed.overload = observed.overload or before.tension > 1.0
					feedback_valid = feedback_valid and text.contains("入港条件")
					if hud.get("_dock").visible:
						observed.dock = true
						observed.hold = observed.hold or before.dock > 0.0
						var eligible: bool = before.position.distance_to(before.harbor) <= before.harbor_radius \
							and before.cargo_position.distance_to(before.harbor) <= before.harbor_radius \
							and before.velocity.length() <= Sim.DOCK_SPEED and before.cargo_velocity.length() <= Sim.DOCK_SPEED \
							and before.tension < Sim.DOCK_TENSION
						feedback_valid = feedback_valid and (hud.get("_dock_instruction").get_theme_color("font_color") == HUD.GREEN) == eligible \
							and is_equal_approx(hud.get("_dock_meter").value, before.dock) \
							and hud.get("_dock_progress").text.contains("%.2f / %.2f 秒" % [before.dock * Sim.DOCK_TIME, Sim.DOCK_TIME])
				if was_valid and not feedback_valid:
					print("FEEDBACK mismatch tick=%d phase=%s dock=%.9f meter=%.9f text=%s" % [
						tick, before.phase, before.dock, hud.get("_dock_meter").value, text.replace("\n", " / ")])
			driver.apply(root, controls)
			app.call("_physics_process", DT)
			model.step(DT, model_controls)
			route.observe(before, sim.snapshot())
			model_route.observe(model_before, model.snapshot())
			matched = matched and controls == model_controls and sim.snapshot() == model.snapshot()
			if app.get("screen") != "running":
				break
			if tick % 600 == 0:
				await process_frame
		_check(matched and route.ticks == model_route.ticks, mode + " every production polling tick matches same-input model")
		_check(feedback_valid and presentation_read_only and observed.scan and observed.attach and observed["return"],
			mode + " natural scan, attachment and return feedback is current and read-only")
		_check(route.scan_tick == 1829 and route.attach_tick == 2869 and route.impact_tick == 4273,
			mode + " unchanged digital-input baseline scans, attaches and actually hits the central reef")
		if mode == "recover":
			_check(sim.phase == "success" and route.ticks == 8231 and observed.dock and observed.hold and route.dock_hold >= 60,
				"natural feedback covers actual damaged two-body delivery and continuous measured hold")
			saved = FileAccess.get_file_as_bytes(record_path)
			_check(not saved.is_empty() and app.get("_record_status") == RecordsStore.NEW_BEST, "natural delivery saves isolated real score")
		else:
			_check(sim.phase == "failed" and route.ticks == 4519 and sim.event_kind == "snap" and observed.overload,
				"natural feedback covers real overload before failed tow")
			_check(FileAccess.get_file_as_bytes(record_path) == saved and sim.report.is_empty(), "failed feedback voyage preserves prior score bytes")
		driver.release()
		_check(Driver.all_released(), mode + " releases all process-local navigation keys")
		print("APP interaction_feedback/%s: %s tickwise_match=%s feedback_valid=%s" % [
			mode, route.metrics(sim.snapshot()), str(matched), str(feedback_valid and presentation_read_only)])
	_check(app.get("sound").get("_motor") == null, "headless feedback voyages create no audio playback")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "remove only this isolated feedback directory")


func _settle() -> void:
	# Nested containers can queue another layout after a wrapping label changes.
	for frame in range(3):
		await process_frame


func _layout_ok(hud: Node, dimensions: Vector2i) -> bool:
	var bounds := Rect2(Vector2.ZERO, Vector2(dimensions)).grow(1.0)
	var panels: Array[Control] = []
	for child in hud.get("_live").get_children():
		if child is Control and child.visible:
			panels.append(child)
	for panel in panels:
		if not bounds.encloses(_rect(panel)):
			printerr("LAYOUT panel out of viewport: " + str(_rect(panel)))
			return false
	for a in range(panels.size()):
		for b in range(a + 1, panels.size()):
			if _rect(panels[a]).intersects(_rect(panels[b])):
				printerr("LAYOUT overlapping live panels: %d/%d %s %s" % [a, b, str(_rect(panels[a])), str(_rect(panels[b]))])
				return false
	for field: String in ["_objective", "_notice", "_warning", "_dock_instruction", "_dock_progress"]:
		var text: Label = hud.get(field)
		if text.is_visible_in_tree() and (not bounds.encloses(_rect(text))
			or not _rect(text.get_parent()).grow(1.0).encloses(_rect(text))
			or text.get_visible_line_count() < text.get_line_count()):
			printerr("LAYOUT truncated feedback: " + field + " " + text.text)
			return false
	return true


func _rect(control: Control) -> Rect2:
	return control.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, control.size)


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
