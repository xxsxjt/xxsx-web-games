extends SceneTree
## Real composition-root transitions and input-only voyages, no rendered/OS input.

const MainScene = preload("res://scenes/main.tscn")
const Sim = preload("res://src/storm_sim.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const Driver = preload("res://tests/needle_keyboard_driver.gd")
const RecordsStore = preload("res://src/storm_records.gd")
const DT := 1.0 / 60.0

var _checks := 0
var _failures := 0
var _first_projection_error := ""
var _record_path := ""
var _saved := PackedByteArray()


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("presentation_lifecycle_test.gd requires --headless")
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/presentation-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		printerr("Cannot create isolated presentation test directory")
		quit(1)
		return
	_record_path = folder.path_join("best.json")
	var app: Node = MainScene.instantiate()
	app.set("records_file", _record_path)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	_check(Driver.all_released(), "starts with no process-local held keys")
	_check(_projection(app), "initial briefing is a complete current projection")
	await _menus(app)
	for mode: String in ["recover", "overload"]:
		await _voyage(app, mode)
	_check(app.get("sound").get("_motor") == null and Driver.all_released(),
		"headless lifecycle creates no audio player and releases all synthetic keys")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		DirAccess.remove_absolute(folder.path_join(name))
	_check(DirAccess.remove_absolute(folder) == OK, "removes only this isolated test record directory")
	print("Stormline presentation lifecycle: %d checks, %d failures; dual-contract menus and two natural polled keyboard voyages; visible HUD/radar/world and terminal first-frame consistency; no rendering or player profiles." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _menus(app: Node) -> void:
	var hud: Node = app.get("hud")
	for id: String in ["needle-bank", "black-tide"]:
		var old_root: Node = app.get("world").get("_world_root")
		hud.emit_signal("contract_selected", id)
		var fresh := Sim.new()
		fresh.reset(id)
		_check(app.get("selected_contract") == id and app.get("sim").snapshot() == fresh.snapshot()
			and _projection(app), id + " briefing selection publishes selected contract atomically")
		_check(not old_root.is_inside_tree() and app.get("world").get_child_count() == 1,
			id + " selection detaches the old world before the new briefing appears")
		await process_frame
		_check(not is_instance_valid(old_root), id + " old world is freed after contract selection")
		var before: Dictionary = app.get("sim").snapshot()
		var root_id: int = app.get("world").get("_world_root").get_instance_id()
		hud.emit_signal("contract_selected", "not-a-contract")
		hud.emit_signal("contract_selected", id)
		_check(app.get("sim").snapshot() == before and app.get("world").get("_world_root").get_instance_id() == root_id
			and _projection(app), id + " invalid and unchanged contract selection cannot rebuild or corrupt presentation")
		hud.emit_signal("start_requested")
		_check(app.get("screen") == "running" and _projection(app), id + " menu launch immediately presents fresh live state")
		hud.emit_signal("contract_selected", "black-tide" if id == "needle-bank" else "needle-bank")
		_check(app.get("selected_contract") == id and app.get("sim").snapshot() == before
			and _projection(app), id + " running contract selection is rejected without mismatched HUD/world")
		_pause(app, false, id + "/fresh")
		Driver.edge(root, KEY_P)
		Driver.edge(root, KEY_R)
		_check(app.get("screen") == "running" and app.get("sim").snapshot() == before
			and _projection(app), id + " running restart immediately publishes clean approach state")
		Driver.edge(root, KEY_ESCAPE)
		hud.emit_signal("briefing_requested")
		_check(app.get("screen") == "briefing" and app.get("sim").snapshot() == before
			and _projection(app) and not FileAccess.file_exists(_record_path),
			id + " abandoning a fresh pause publishes briefing without writing a record")


func _pause(app: Node, focus: bool, label: String) -> void:
	var before: Dictionary = app.get("sim").snapshot().duplicate(true)
	var status: String = app.get("_record_status")
	var saved := _record_bytes()
	Driver.edge(root, KEY_SPACE)
	if focus:
		app.call("_on_focus_exited")
	else:
		Driver.edge(root, KEY_P)
	_check(app.get("screen") == "paused" and not bool(app.get("_tow_queued"))
		and app.get("sim").snapshot() == before and _projection(app), label + " pause publishes unchanged model and clears queued tow input")
	for delta: float in [0.0, DT, 0.75, 60.0]:
		app.call("_physics_process", delta)
		app.call("_process", delta)
		_check(app.get("sim").snapshot() == before and _projection(app)
			and _record_bytes() == saved and String(app.get("_record_status")) == status,
			label + " paused delta %.3f cannot advance the model or stale its visible projection" % delta)
	Driver.edge(root, KEY_M)
	_check(_projection(app), label + " muted pause uses the same current projection")
	Driver.edge(root, KEY_M)
	app.call("_on_focus_exited")
	_check(app.get("screen") == "paused" and _projection(app), label + " repeated focus callback cannot resume or corrupt pause")
	Driver.edge(root, KEY_ESCAPE)
	_check(app.get("screen") == "running" and app.get("sim").snapshot() == before
		and _projection(app), label + " resume immediately restores the same current HUD/world without catch-up")


func _voyage(app: Node, mode: String) -> void:
	var hud: Node = app.get("hud")
	if app.get("screen") == "briefing":
		Driver.edge(root, KEY_2)
		Driver.edge(root, KEY_ENTER)
	else:
		Driver.edge(root, KEY_R)
	var sim: Variant = app.get("sim")
	var model := Sim.new()
	model.reset("needle-bank")
	_check(sim.snapshot() == model.snapshot() and _projection(app), mode + " voyage begins from untouched natural reset")
	var route := Route.new(mode)
	var model_route := Route.new(mode)
	var driver := Driver.new()
	var model_driver := Driver.new()
	var matched := true
	var projected := true
	var samples := 0
	var paused: Dictionary = {}
	var observed := {"scan": false, "attach": false, "collision": false, "overload": false, "dock": false, "notice_expired": false}
	for tick in range(Route.MAX_TICKS):
		var before: Dictionary = sim.snapshot()
		var model_before := model.snapshot()
		var controls := driver.quantize(route.controls(before))
		var expected := model_driver.quantize(model_route.controls(model_before))
		driver.apply(root, controls)
		app.call("_physics_process", DT)
		model.step(DT, expected)
		var after: Dictionary = sim.snapshot()
		route.observe(before, after)
		model_route.observe(model_before, model.snapshot())
		matched = matched and controls == expected and after == model.snapshot()
		observed.scan = observed.scan or (not before.scanned and after.scanned)
		observed.attach = observed.attach or (not before.tow_attached and after.tow_attached)
		observed.collision = observed.collision or (after.event_kind == "collision")
		observed.overload = observed.overload or after.tension >= 1.0
		observed.dock = observed.dock or after.dock > 0.0
		observed.notice_expired = observed.notice_expired or (not String(before.notice).is_empty() and String(after.notice).is_empty())
		if app.get("screen") == "debrief":
			# No render callback here: production must publish the terminal tick itself.
			_check(_projection(app), mode + " terminal first frame is current before any render callback")
			break
		var milestone := ""
		if not before.scanned and after.scanned:
			milestone = "scan"
		elif not before.tow_attached and after.tow_attached:
			milestone = "attach"
		elif route.impact_tick == route.ticks:
			milestone = "collision"
		elif after.dock > 0.0:
			milestone = "dock"
		if not milestone.is_empty() and not paused.has(milestone):
			_pause(app, milestone in ["collision", "dock"], mode + "/" + milestone)
			paused[milestone] = true
		if tick % 30 == 0 or after.event_id != before.event_id or after.notice != before.notice \
				or bool(after.target_visible) != bool(before.target_visible) or not milestone.is_empty():
			app.call("_process", DT)
			projected = _projection(app) and projected and sim.snapshot() == after
			samples += 1
		if tick % 600 == 0:
			await process_frame
	_check(matched and route.ticks == model_route.ticks, mode + " every official polling tick matches the independent same-input model")
	_check(projected and samples > 100 and observed.scan and observed.attach and observed.collision
		and observed.notice_expired, mode + " sampled scan/attach/collision/expiry frames have current read-only visible projection: " + _first_projection_error)
	_check(paused.has("scan") and paused.has("attach") and paused.has("collision"), mode + " natural milestones exercise both manual and focus-driven pauses")
	if mode == "recover":
		_check(sim.phase == "success" and route.ticks == 8231 and paused.has("dock") and observed.dock,
			"natural recovered voyage still delivers at tick 8231 after presentation-only pauses")
		_saved = _record_bytes()
		_check(not _saved.is_empty() and app.get("_record_status") == RecordsStore.NEW_BEST,
			"only actual delivery writes a best score in the isolated directory")
	else:
		_check(sim.phase == "failed" and route.ticks == 4519 and observed.overload and sim.event_kind == "snap",
			"natural unsafe voyage still snaps its cable at tick 4519")
		_check(_record_bytes() == _saved and String(app.get("_record_status")).is_empty(),
			"failure preserves the real prior best and cannot show a stale success-save status")
	var terminal: Dictionary = sim.snapshot().duplicate(true)
	var saved := _record_bytes()
	for delta: float in [0.0, DT, 0.75, 60.0]:
		Driver.edge(root, KEY_SPACE)
		Driver.edge(root, KEY_P)
		app.call("_on_focus_exited")
		app.call("_physics_process", delta)
		app.call("_process", delta)
		_check(sim.snapshot() == terminal and _record_bytes() == saved and _projection(app),
			mode + " repeated terminal delta %.3f preserves report, record and projection" % delta)
	driver.release()
	_check(Driver.all_released(), mode + " releases all synthetic navigation keys")
	if mode == "recover":
		hud.emit_signal("briefing_requested")
		_check(app.get("screen") == "briefing" and _projection(app) and _record_bytes() == saved
			and String(app.get("_record_status")).is_empty(), "successful debrief returns directly to clean briefing with saved best intact")
		Driver.edge(root, KEY_ENTER)
	else:
		Driver.edge(root, KEY_R)
	var fresh := Sim.new()
	fresh.reset("needle-bank")
	_check(sim.snapshot() == fresh.snapshot() and String(app.get("_record_status")).is_empty()
		and _projection(app) and _record_bytes() == saved, mode + " fresh departure after debrief has no prior event, dock, tow, menu or record-status residue")
	hud.emit_signal("pause_requested")
	hud.emit_signal("briefing_requested")
	_check(app.get("screen") == "briefing" and _projection(app), mode + " restarted mission returns cleanly to briefing")
	Driver.edge(root, KEY_1)
	_check(app.get("selected_contract") == "black-tide" and _projection(app)
		and _record_bytes() == saved, mode + " post-voyage contract switch shows only the new briefing/world")
	Driver.edge(root, KEY_2)
	print("APP presentation_lifecycle/%s: %s tickwise_match=%s projection_match=%s samples=%d" % [
		mode, route.metrics(terminal), str(matched), str(projected), samples])


func _projection(app: Node) -> bool:
	var sim: Variant = app.get("sim")
	var before: Dictionary = sim.snapshot().duplicate(true)
	var view := before.duplicate(true)
	view.screen = app.get("screen")
	view.muted = app.get("muted")
	view.record_status = app.get("_record_status")
	var world: Node = app.get("world")
	var hud: Node = app.get("hud")
	if world.get("_view") != view or hud.get("_screen") != view.screen or hud.get("_contract_id") != view.contract_id:
		return _projection_error("published snapshot/screen/contract differs")
	var live: bool = view.screen in ["running", "paused"]
	if hud.get("_live").visible != live or hud.get("_curtain").visible != (view.screen != "running"):
		return _projection_error("live HUD/curtain visibility differs")
	var menus: Dictionary = hud.get("_menus")
	for screen: String in menus:
		if menus[screen].visible != (screen == view.screen):
			return _projection_error("visible menu does not match the application screen")
	for button: Button in hud.get("_mute_buttons"):
		if button.text != ("声音：关闭 [M]" if view.muted else "声音：开启 [M]"):
			return _projection_error("menu audio labels disagree")
	if world.get("_cargo").visible != (view.target_visible or view.tow_attached) \
			or world.get("_target_marker").visible != (view.target_visible and not view.tow_attached and view.phase == "approach") \
			or world.get("_cable").visible != view.tow_attached:
		return _projection_error("world contact/capsule/cable visibility differs")
	var boat_position: Vector3 = world.get("_boat").position
	var cargo_position: Vector3 = world.get("_cargo").position
	if Vector2(boat_position.x, boat_position.z) != view.position or Vector2(cargo_position.x, cargo_position.z) != view.cargo_position:
		return _projection_error("world positions lag behind the published snapshot")
	if not view.tow_attached and (world.get("_tow_label").visible or not String(world.get("_tow_label").text).is_empty()
			or world.get("_cable_light").light_energy != 0.0):
		return _projection_error("detached tow leaves a warning/light behind")
	if view.screen == "briefing":
		if hud.get("_brief_name").text != sim.contract.name or hud.get("_brief_copy").text != sim.contract.briefing:
			return _projection_error("briefing text belongs to another contract")
	elif live:
		if hud.get("_mission").text != sim.contract.name \
				or hud.get("_objective").text != hud.call("_interaction_guidance", view, sim.contract):
			return _projection_error("live mission or interaction guidance is stale")
		var notice: String = "" if view.event_kind == "overload" else view.notice
		if hud.get("_notice").text != notice or hud.get("_notice").visible != (not notice.is_empty() and notice != hud.get("_objective").text):
			return _projection_error("event notification has stale text or visibility")
		var advisory: String = hud.call("_advisory", view.battery,
			minf(view.hull, view.cargo_integrity) if view.scanned else view.hull, float(sim.contract.deadline) - view.time)
		if hud.get("_warning").text != advisory or hud.get("_warning").visible != (not advisory.is_empty()):
			return _projection_error("visible resource/weather advisory is stale")
		var risk_active: bool = view.tow_attached and (view.tension >= 1.0 or view.overload > 0.0)
		if hud.get("_tow_action").visible != risk_active:
			return _projection_error("tow action visibility differs from current load/risk")
		var radar: Dictionary = hud.get("_radar").get("_snapshot")
		if radar.get("position") != view.position or radar.get("heading") != view.heading \
				or radar.get("harbor") != view.harbor or radar.get("scanned") != view.scanned or radar.get("tow_attached") != view.tow_attached:
			return _projection_error("visible radar is not from the current snapshot")
		if view.scanned:
			if radar.get("cargo_position") != view.cargo_position or radar.get("target_visible") != view.target_visible:
				return _projection_error("acquired radar contact differs from world disclosure")
		elif radar.has("cargo_position") or radar.has("target_visible"):
			return _projection_error("unscanned radar receives a hidden target")
		var near: bool = minf(view.position.distance_to(view.harbor), view.cargo_position.distance_to(view.harbor)) <= view.harbor_radius + 18.0
		if hud.get("_dock").visible != (view.tow_attached and view.scanned and near):
			return _projection_error("docking panel belongs to a previous state")
		if hud.get("_dock").visible and not is_equal_approx(hud.get("_dock_meter").value, view.dock):
			return _projection_error("docking progress is not the measured snapshot value")
		if view.screen == "paused" and (not String(hud.get("_pause_summary").text).contains(sim.contract.name)
				or not String(hud.get("_pause_summary").text).contains(hud.get("_phase").text)):
			return _projection_error("pause summary differs from the current live state")
	else:
		var success: bool = view.phase == "success"
		if hud.get("_result_title").text != ("回收完成" if success else "任务失败") \
				or hud.get("_result_subtitle").text != sim.contract.name \
				or hud.get("_result_score").text != (str(int(view.report.score)) if success else "—"):
			return _projection_error("terminal title/contract/score is stale")
		if hud.get("_result_grade").text != String(view.report.get("grade", "—")):
			return _projection_error("terminal grade is stale")
		var stats: Dictionary = hud.get("_result_stats")
		if stats.time.text != hud.call("_time", view.report.get("time", view.time)) \
				or stats.hull.text != "%.0f%%" % float(view.report.get("hull", view.hull)) \
				or stats.cargo.text != "%.0f%%" % float(view.report.get("cargo", view.cargo_integrity)) \
				or stats.battery.text != "%.0f%%" % float(view.report.get("battery", view.battery)) \
				or stats.peak_tension.text != hud.call("_tow_load_percent", view.report.get("peak_tension", view.peak_tension)):
			return _projection_error("terminal statistics reuse an earlier report")
		if success:
			if hud.get("_result_record").text != view.record_status or hud.get("_result_message").text != view.notice:
				return _projection_error("successful report has stale notice or save result")
		elif hud.get("_result_message").text != view.fail_reason \
				or hud.get("_result_record").text != "本航次未完成，不计入最佳纪录。":
			return _projection_error("failed report reuses a success notice/save result")
	return sim.snapshot() == before


func _projection_error(message: String) -> bool:
	if _first_projection_error.is_empty():
		_first_projection_error = message
		printerr("PROJECTION: " + message)
	return false


func _record_bytes() -> PackedByteArray:
	return FileAccess.get_file_as_bytes(_record_path) if FileAccess.file_exists(_record_path) else PackedByteArray()


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message + (" / " + _first_projection_error if not _first_projection_error.is_empty() else ""))
