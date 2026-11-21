extends SceneTree
## Reproduces the third-route map/readout mismatch and verifies the live fix.
const HUD = preload("res://src/storm_hud.gd")
const Sim = preload("res://src/storm_sim.gd")
const MainScene = preload("res://scenes/main.tscn")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const Keys = preload("res://tests/needle_keyboard_driver.gd")
const Store = preload("res://src/storm_records.gd")
const ID := "cross-current"
const DT := 1.0 / 60.0
const MAX_TICKS := 60 * 220

var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("cross_current_route_feedback_test.gd requires --headless")
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
	sim.reset("cross-current")
	var view := sim.snapshot()
	view.screen = "running"
	view.scanned = true
	view.tow_attached = true
	view.target_visible = true
	# Put the tug in East Cross-Current and the towed capsule in West Fold-Vortex.
	view.position = Vector2(22.0, -38.0)
	view.cargo_position = Vector2(-27.0, -45.0)
	hud.present(view)
	await process_frame
	var radar: Dictionary = hud.get("_radar").get("_snapshot")
	var map_landmarks: Array = radar.get("current_landmarks", [])
	_check(map_landmarks.size() == 2,
		"third-route radar identifies both current zones so names/readings map to visible chart markers")
	var readout: String = hud.get("_ranges").text
	_check(readout.contains("1西折涡") and readout.contains("2东横流"),
		"third-route live chart legend names the two numbered cross-current landmarks")
	_check(readout.contains("2东横流 船圈内27m 舱圈外22m")
		and readout.contains("1西折涡 船圈外25m 舱圈内24m"),
		"live tug and capsule exposure is independently measured from each named current edge")

	# Same presentation path must refresh at the chart boundary without touching model state.
	var old_readout := readout
	view.position = Vector2(70.0, -38.0)
	view.cargo_position = Vector2(-60.0, -45.0)
	var second_view := view.duplicate(true)
	hud.present(second_view)
	await process_frame
	var refreshed: String = hud.get("_ranges").text
	_check(refreshed != old_readout and refreshed.contains("船圈外21m")
		and refreshed.contains("舱圈外9m"),
		"chart exposure refreshes from both current world positions as the tow moves clear")

	var scanned_view := second_view.duplicate(true)
	scanned_view.position = Vector2(22.0, -38.0)
	scanned_view.cargo_position = Vector2(-27.0, -45.0)
	scanned_view.tow_attached = false
	hud.present(scanned_view)
	await process_frame
	var unattached_readout: String = hud.get("_ranges").text
	_check(unattached_readout.contains("船圈内27m 舱圈外22m")
		and unattached_readout.contains("船圈外25m 舱圈内24m"),
		"sonar-locked free-drifting capsule gets its own current exposure before tow attachment")

	var hidden_view := scanned_view.duplicate(true)
	hidden_view.scanned = false
	hud.present(hidden_view)
	await process_frame
	_check(String(hud.get("_ranges").text).contains("舱未锁定")
		and not String(hud.get("_ranges").text).contains("舱圈内")
		and not String(hud.get("_ranges").text).contains("舱圈外"),
		"before sonar lock the chart never leaks the hidden capsule's location")
	var hidden_text: String = hud.get("_ranges").text
	hidden_view.cargo_position = Vector2(130.0, 130.0)
	hidden_view.cargo_velocity = Vector2(17.0, 0.0)
	hud.present(hidden_view)
	_check(hud.get("_ranges").text == hidden_text
		and not hud.get("_radar").get("_snapshot").has("cargo_position"),
		"changing all hidden capsule inputs cannot affect the pre-lock readout or radar")
	for radius: float in [24.0, 27.0]:
		for offset: float in [-0.001, 0.0, 0.001, -0.9, 0.9, -1.0, 1.0]:
			var reading: String = hud.call("_current_edge_reading", radius + offset, radius)
			_check(reading == _edge_text(radius + offset, radius),
				"flow-edge reading distinguishes exact boundary/inside/outside at r=%.0f offset=%.3f" % [radius, offset])
	await _geometry(viewport, hud, view)

	# Existing routes retain their former unlabeled-current chart/readout contract.
	sim.reset("black-tide")
	var old_view := sim.snapshot()
	old_view.screen = "running"
	hud.present(old_view)
	await process_frame
	var old_radar: Dictionary = hud.get("_radar").get("_snapshot")
	_check(not old_radar.has("current_landmarks")
		and String(hud.get("_ranges").text) == "距信号区中心 %.0f m   /   港距 %.0f m" % [old_view.target_distance, old_view.home_distance]
		and hud.get("_radar").custom_minimum_size.y == 238.0,
		"legacy contract chart/readout remains unchanged")
	viewport.queue_free()
	await process_frame
	await _app_voyages()
	print("Stormline Cross Current route feedback: %d checks, %d failures; boundary/geometry fixtures plus two input-only app voyages and pause/focus/debrief/restart; no rendering or desktop play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _edge_text(distance: float, radius: float) -> String:
	if distance == radius:
		return "圈边"
	var prefix := "圈内" if distance < radius else "圈外"
	var gap := absf(distance - radius)
	return prefix + ("<1m" if gap < 1.0 else "%dm" % roundi(gap))


func _geometry(viewport: SubViewport, hud: Node, initial: Dictionary) -> void:
	for dimensions: Vector2i in [Vector2i(1440, 900), Vector2i(1280, 720), Vector2i(960, 600), Vector2i(1920, 1080)]:
		viewport.size = dimensions
		for towing: bool in [false, true]:
			var view := initial.duplicate(true)
			view.phase = "return" if towing else "approach"
			view.scanned = towing
			view.tow_attached = towing
			view.position = Vector2(140.0, 140.0)
			view.cargo_position = Vector2(-140.0, 140.0)
			view.battery = 10.0
			view.tension = 1.2
			view.overload = 0.5
			view.notice = "舱体擦碰：断桅礁。留更大的外弯。"
			hud.present(view)
			for frame in range(4):
				await process_frame
			var label := "%dx%d/%s" % [dimensions.x, dimensions.y, "tow" if towing else "search"]
			_check(hud.get("_ranges").get_line_count() == 3,
				label + " longest three-digit edge readings fit on exactly three chart lines at the original 18pt size")
			var panels: Array[Control] = []
			for child in hud.get("_live").get_children():
				if child is Control and child.visible:
					panels.append(child)
			var inside := true
			var separate := true
			var bounds := Rect2(Vector2.ZERO, Vector2(dimensions))
			for a in range(panels.size()):
				var rect_a: Rect2 = panels[a].get_global_transform_with_canvas() * Rect2(Vector2.ZERO, panels[a].size)
				inside = inside and bounds.grow(1.0).encloses(rect_a)
				for b in range(a + 1, panels.size()):
					var rect_b: Rect2 = panels[b].get_global_transform_with_canvas() * Rect2(Vector2.ZERO, panels[b].size)
					separate = separate and not rect_a.intersects(rect_b)
			_check(inside and separate, label + " chart and full warning/helm panels stay in bounds without overlap")


func _chart_ok(hud: Node, view: Dictionary) -> bool:
	var radar: Dictionary = hud.get("_radar").get("_snapshot")
	var landmarks: Array = radar.get("current_landmarks", [])
	if landmarks.size() != 2 or radar.get("position") != view.position:
		return false
	var expected := ""
	var number := 0
	for hazard: Dictionary in Sim.CONTRACTS[ID].hazards:
		if hazard.kind != "current":
			continue
		number += 1
		var actual: Dictionary = landmarks[number - 1]
		if actual.get("number") != number or actual.get("name") != hazard.name \
				or actual.get("position") != hazard.position or actual.get("radius") != hazard.radius:
			return false
		var cargo := _edge_text(view.cargo_position.distance_to(hazard.position), hazard.radius) if view.scanned else "未锁定"
		expected += "\n%d%s 船%s 舱%s" % [number, hazard.name, _edge_text(view.position.distance_to(hazard.position), hazard.radius), cargo]
	if not String(hud.get("_ranges").text).ends_with(expected):
		return false
	return (radar.get("cargo_position") == view.cargo_position) if view.scanned else not radar.has("cargo_position")


func _pause_readout(app: Node, focus: bool, label: String) -> void:
	var sim: Sim = app.get("sim")
	var hud: Node = app.get("hud")
	var before := sim.snapshot().duplicate(true)
	app.call("_process", 0.0)
	var text: String = hud.get("_ranges").text
	Keys.edge(root, KEY_SPACE)
	if focus:
		app.call("_on_focus_exited")
	else:
		Keys.edge(root, KEY_P)
	var unchanged: bool = app.get("screen") == "paused" and not app.get("_tow_queued")
	for delta: float in [DT, 0.75, 60.0]:
		app.call("_physics_process", delta)
		app.call("_process", delta)
		unchanged = unchanged and sim.snapshot() == before and hud.get("_ranges").text == text and _chart_ok(hud, before)
	Keys.edge(root, KEY_ESCAPE)
	_check(unchanged and app.get("screen") == "running" and sim.snapshot() == before and _chart_ok(hud, before),
		label + " pause/focus keeps the exact measured readout and resumes without catch-up or queued tow")


func _app_voyages() -> void:
	var folder := ProjectSettings.globalize_path("res://.testdata/cross-chart-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		_check(false, "make isolated chart lifecycle score folder")
		return
	var path := folder.path_join("best.json")
	var store := Store.new(path)
	var fixture := {"score": 7200, "time": 95.0, "grade": "A", "hull": 98.0, "peak_tension": 0.48}
	_check(store.record("black-tide", fixture) == Store.NEW_BEST
		and store.record("needle-bank", fixture) == Store.NEW_BEST, "seed both legacy scores in a fresh isolated folder")
	var primary_bytes := FileAccess.get_file_as_bytes(path)
	var backup_bytes := FileAccess.get_file_as_bytes(path + ".bak")
	var app := MainScene.instantiate()
	app.set("records_file", path)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	var sim: Sim = app.get("sim")
	var hud: Node = app.get("hud")
	Keys.edge(root, KEY_3)
	_check(app.get("screen") == "briefing" and app.get("selected_contract") == ID
		and hud.get("_brief_name").text == Sim.CONTRACTS[ID].name, "task-board key 3 selects the existing third contract")
	for route: String in ["safe", "shortcut"]:
		Keys.edge(root, KEY_ENTER)
		var model := Sim.new()
		model.reset(ID)
		var leg := "outbound"
		var route_index := 0
		var last_tow_input := false
		var samples := 0
		var cargo_only_samples := 0
		var current_samples := 0
		var matching := true
		var chart_current := true
		var paused := {}
		var ticks := 0
		_check(app.get("screen") == "running" and sim.snapshot() == model.snapshot()
			and _chart_ok(hud, model.snapshot()), route + " launch has fresh unscanned measured chart")
		for tick in range(1, MAX_TICKS + 1):
			var before := sim.snapshot()
			if leg == "outbound" and sim.scanned:
				leg = "cargo"
				route_index = 0
			if leg == "cargo" and sim.tow_attached:
				leg = "return"
				route_index = 0
			if leg != "cargo":
				route_index = Pilot.route_index_for(before, leg, route_index, route)
			var controls := Pilot.controls_for(sim, leg, route_index, last_tow_input, route)
			last_tow_input = bool(controls.get("tow_pressed", false))
			# Feed the actual natural steering controls through the exact production
			# post-keyboard input boundary; no simulator state is injected/teleported.
			app.call("_advance_simulation", DT, controls)
			model.step(DT, controls)
			var after := sim.snapshot()
			matching = matching and after == model.snapshot()
			ticks = tick
			if app.get("screen") != "running":
				break
			var in_current := false
			for hazard: Dictionary in Sim.CONTRACTS[ID].hazards:
				if hazard.kind == "current" and (after.position.distance_to(hazard.position) < hazard.radius \
						or (after.scanned and after.cargo_position.distance_to(hazard.position) < hazard.radius)):
					in_current = true
			var milestone := ""
			if not before.scanned and after.scanned:
				milestone = "scan"
			elif after.tow_attached and in_current:
				milestone = "current"
			elif after.dock > 0.0:
				milestone = "dock"
			if not milestone.is_empty() and not paused.has(milestone):
				_pause_readout(app, milestone in ["current", "dock"], route + "/" + milestone)
				paused[milestone] = true
			if tick % 30 == 0 or before.scanned != after.scanned or before.tow_attached != after.tow_attached or after.dock > 0.0:
				app.call("_process", DT)
				chart_current = chart_current and _chart_ok(hud, after) and sim.snapshot() == after
				samples += 1
				cargo_only_samples += int(after.scanned and not after.tow_attached)
				current_samples += int(in_current and after.tow_attached)
			if tick % 600 == 0:
				await process_frame
		_check(matching and sim.phase == "success" and ticks == (9204 if route == "safe" else 8064),
			route + " natural production-input voyage matches every independent model tick and unchanged delivery baseline")
		_check(chart_current and samples > 200 and cargo_only_samples > 20
			and paused.has("scan") and paused.has("dock") and (current_samples > 0 and paused.has("current") if route == "shortcut" else current_samples == 0),
			route + " live ship/capsule measurements track scan, free drift, current exposure and docking without writing model state")
		_check(app.get("screen") == "debrief" and hud.get("_screen") == "debrief" and not hud.get("_live").visible
			and hud.get("_result_score").text == str(sim.report.get("score", 0) if sim.phase == "success" else "—")
			and app.get("world").get("_view").phase == sim.phase,
			route + " terminal tick hides the live chart and already presents actual score/current world before a render callback")
		var saved := FileAccess.get_file_as_bytes(path + ".expansion.json")
		var terminal := sim.snapshot().duplicate(true)
		app.call("_physics_process", 60.0)
		app.call("_process", 60.0)
		_check(sim.snapshot() == terminal and FileAccess.get_file_as_bytes(path + ".expansion.json") == saved,
			route + " terminal callbacks preserve the report and saved score")
		print("APP cross_current/chart/%s: ticks=%d time=%.2f samples=%d cargo_only=%d tow_current=%d tickwise_match=%s readout_match=%s" % [
			route, ticks, sim.mission_time, samples, cargo_only_samples, current_samples, matching, chart_current])
		Keys.edge(root, KEY_R)
		var fresh := Sim.new()
		fresh.reset(ID)
		_check(sim.snapshot() == fresh.snapshot() and _chart_ok(hud, fresh.snapshot())
			and String(hud.get("_ranges").text).contains("舱未锁定") and app.get("_record_status") == "",
			route + " result restart immediately replaces old cargo exposure with a fresh unknown-capsule chart")
		Keys.edge(root, KEY_P)
		Keys.edge(root, KEY_ENTER)
		Keys.edge(root, KEY_1)
		Keys.edge(root, KEY_ENTER)
		_check(not hud.get("_radar").get("_snapshot").has("current_landmarks")
			and not String(hud.get("_ranges").text).contains("西折涡") and hud.get("_radar").custom_minimum_size.y == 238.0,
			route + " returning through briefing to a legacy mission removes all third-route chart labels and sizing")
		Keys.edge(root, KEY_P)
		Keys.edge(root, KEY_ENTER)
		Keys.edge(root, KEY_3)
	var saved_best := FileAccess.get_file_as_bytes(path + ".expansion.json")
	Keys.edge(root, KEY_ENTER)
	for tick in range(MAX_TICKS):
		app.call("_advance_simulation", DT, {})
		if app.get("screen") != "running":
			break
	_check(sim.phase == "failed" and sim.event_kind == "timeout" and sim.report.is_empty()
		and not hud.get("_live").visible and hud.get("_result_score").text == "—",
		"natural unattended retry fails at the real deadline with no score or exposed live chart")
	_check(FileAccess.get_file_as_bytes(path) == primary_bytes and FileAccess.get_file_as_bytes(path + ".bak") == backup_bytes
		and FileAccess.get_file_as_bytes(path + ".expansion.json") == saved_best,
		"successful third-route writes preserve both v1 files and failed retries preserve the expansion best")
	Keys.edge(root, KEY_R)
	_check(sim.mission_time == 0.0 and _chart_ok(hud, sim.snapshot()) and sim.report.is_empty()
		and String(hud.get("_ranges").text).contains("舱未锁定"), "failure restart also immediately clears prior exposure/report state")
	app.queue_free()
	await process_frame
	for name in DirAccess.get_files_at(folder):
		_check(DirAccess.remove_absolute(folder.path_join(name)) == OK, "remove isolated chart fixture " + name)
	_check(DirAccess.remove_absolute(folder) == OK, "remove this suite's isolated chart lifecycle folder")


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
