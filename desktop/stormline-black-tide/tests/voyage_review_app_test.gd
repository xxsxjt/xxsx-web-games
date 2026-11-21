extends SceneTree
## Production main/HUD, legal controls, natural terminals, isolated records only.
const MainScene = preload("res://scenes/main.tscn")
const Sim = preload("res://src/storm_sim.gd")
const HUD = preload("res://src/storm_hud.gd")
const Store = preload("res://src/storm_records.gd")
const Review = preload("res://src/voyage_review.gd")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const Route = preload("res://tests/needle_recovery_route.gd")
const Keys = preload("res://tests/needle_keyboard_driver.gd")
const DT := 1.0 / 60.0
var _checks := 0
var _failures := 0
var _saved: Dictionary = {}
var _primary := ""
var _terminal_views: Array[Dictionary] = []


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/review-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		printerr("FAIL: cannot create isolated voyage review record directory")
		quit(1)
		return
	_primary = folder.path_join("best.json")
	var store := Store.new(_primary)
	var high := {"score": 10000, "grade": "S", "time": 1.0, "hull": 100.0, "peak_tension": 0.0}
	var low := high.duplicate()
	low.score = 9000
	for id: String in Sim.CONTRACTS:
		_check(store.record(id, low) == Store.NEW_BEST and store.record(id, high) == Store.NEW_BEST,
			"seed existing superior " + id + " score without any player-profile access")
	_saved = _record_bytes()
	_check(_saved.size() == 4, "isolate primary, backup, expansion and expansion backup")
	var app: Node = MainScene.instantiate()
	app.set("records_file", _primary)
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	_check(not app.get("review").view().active, "task desk has no fabricated voyage baseline")
	for key: Key in [KEY_1, KEY_2, KEY_3]:
		Keys.edge(root, key)
		Keys.edge(root, KEY_ENTER)
		app.call("_advance_simulation", DT, {"tow_pressed": true})
		_pause(app, "clean " + str(key))
		Keys.edge(root, KEY_R)
		_check(app.get("review").view().total_events == 0 and app.get("review").view().elapsed == 0.0
			and app.get("review").view().contract_id == app.get("selected_contract"), "R starts a clean memory ledger for selected contract")
		Keys.edge(root, KEY_P)
		Keys.edge(root, KEY_ENTER)
		_check(not app.get("review").view().active and app.get("review").view().events.is_empty()
			and app.get("hud").get("_review_view").is_empty(), "returning to task desk clears model and HUD review")
	Keys.edge(root, KEY_3)
	Keys.edge(root, KEY_ENTER)
	await _cross_voyage(app)
	await _terminal(app, "cross-current")
	Keys.edge(root, KEY_ENTER)
	Keys.edge(root, KEY_2)
	Keys.edge(root, KEY_ENTER)
	await _needle_voyage(app, "recover")
	await _terminal(app, "needle recover")
	Keys.edge(root, KEY_R)
	await _needle_voyage(app, "unload")
	await _terminal(app, "needle unload")
	Keys.edge(root, KEY_R)
	_check(app.get("review").view().events.is_empty() and not app.get("hud").get("_review_panel").visible,
		"terminal restart clears old expanded review and starts an empty voyage")
	await _needle_voyage(app, "overload")
	await _terminal(app, "needle overload")
	Keys.edge(root, KEY_ENTER)
	Keys.edge(root, KEY_1)
	_check(app.get("selected_contract") == "black-tide" and not app.get("review").view().active
		and app.get("hud").get("_review_view").is_empty() and app.get("hud").get("_review_timeline").text.is_empty(),
		"failure return then other contract clears previous review data and hidden text")
	Keys.edge(root, KEY_ENTER)
	await _cross_voyage(app, "black-tide")
	await _terminal(app, "black-tide")
	_check(_record_bytes() == _saved, "all menu/review/natural voyages preserve every seeded score file byte")
	_check(Keys.all_released() and app.get("sound").get("_motor") == null, "headless tests release local keys and create no audio player")
	app.queue_free()
	await process_frame
	_geometry_stress_view()
	await _geometry()
	for name: String in DirAccess.get_files_at(folder):
		_check(name in _saved and DirAccess.remove_absolute(folder.path_join(name)) == OK, "remove only isolated known record file " + name)
	_check(DirAccess.remove_absolute(folder) == OK, "remove this run's isolated record directory")
	print("Stormline voyage review app: %d checks, %d failures; natural main/HUD journeys, no rendered or real-window playtest." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _cross_voyage(app: Node, id: String = "cross-current") -> void:
	var sim: RefCounted = app.get("sim")
	var model := Sim.new()
	model.reset(id)
	var leg := "outbound"
	var index := 0
	var last_tow := false
	var match_all := true
	var evidence_all := true
	var events := 0
	var tick := 0
	for frame in range(1, 60 * 220):
		var before: Dictionary = sim.snapshot()
		if leg == "outbound" and before.scanned:
			leg = "cargo"
			index = 0
		if leg == "cargo" and before.tow_attached:
			leg = "return"
			index = 0
		if leg != "cargo":
			index = Pilot.route_index_for(before, leg, index, "shortcut")
		var controls := Pilot.controls_for(sim, leg, index, last_tow, "shortcut")
		if id == "black-tide":
			controls = _basic_controls(before, last_tow)
		last_tow = bool(controls.get("tow_pressed", false))
		app.call("_advance_simulation", DT, controls)
		model.step(DT, controls)
		var after: Dictionary = sim.snapshot()
		match_all = match_all and after == model.snapshot()
		var reviewed: Dictionary = app.get("review").view()
		evidence_all = _evidence(reviewed, before, after, events) and evidence_all
		events = int(reviewed.total_events)
		tick = frame
		if after.scanned and not before.scanned:
			_pause(app, "third contract lock")
		if app.get("screen") != "running":
			break
		if frame % 600 == 0:
			await process_frame
	_check(sim.phase == "success" and match_all and evidence_all, id + " natural input succeeds with tickwise public-model and every-event evidence match")
	_check(tick == (4554 if id == "black-tide" else 8064), id + " natural delivery tick remains at its existing baseline")
	_finish_evidence(app, model.snapshot(), tick, id + ("/delivery" if id == "black-tide" else "/shortcut"))


func _basic_controls(state: Dictionary, last_tow: bool) -> Dictionary:
	# Reuse the old public-control policy, not its terminal or resource fixtures.
	var outward: Vector2 = (state.beacon - state.harbor).normalized()
	var controls: Dictionary
	if not state.scanned:
		var scanning: bool = state.position.distance_to(state.beacon) < 24.0
		controls = Pilot._pilot(state, state.beacon - outward * 7.0, 4.0 if scanning else 9.0, 1 if scanning else 0)
		controls.scan = scanning
	elif not state.tow_attached:
		controls = Pilot._pilot(state, state.cargo_position - outward * 9.0, 3.0, 2, true)
		controls.tow_pressed = not last_tow and state.position.distance_to(state.cargo_position) < 11.0 \
			and (state.velocity - state.cargo_velocity).length() < 1.6
	else:
		var both_in: bool = state.position.distance_to(state.harbor) <= state.harbor_radius \
			and state.cargo_position.distance_to(state.harbor) <= state.harbor_radius
		var near: bool = state.position.distance_to(state.harbor) < state.harbor_radius + 12.0
		controls = {"power": 2, "slow": true} if both_in else Pilot._pilot(state,
			state.harbor - outward * state.harbor_radius * 0.45, 3.2 if near else 5.0, 2, near)
		if not both_in:
			controls.reel = -0.5 if state.tension < 0.45 else 0.0
	return controls


func _needle_voyage(app: Node, mode: String) -> void:
	var sim: RefCounted = app.get("sim")
	var model := Sim.new()
	model.reset("needle-bank")
	var route := Route.new("overload" if mode == "unload" else mode)
	var model_route := Route.new("overload" if mode == "unload" else mode)
	var driver := Keys.new()
	var model_driver := Keys.new()
	var matches := true
	var evidence := true
	var events := 0
	var pauses := {}
	for frame in range(Route.MAX_TICKS):
		var before: Dictionary = sim.snapshot()
		var model_before := model.snapshot()
		var controls := driver.quantize(_needle_controls(route, before, mode))
		var expected := model_driver.quantize(_needle_controls(model_route, model_before, mode))
		driver.apply(root, controls)
		app.call("_physics_process", DT)
		model.step(DT, expected)
		var after: Dictionary = sim.snapshot()
		route.observe(before, after)
		model_route.observe(model_before, model.snapshot())
		matches = matches and controls == expected and after == model.snapshot()
		var reviewed: Dictionary = app.get("review").view()
		evidence = _evidence(reviewed, before, after, events) and evidence
		events = int(reviewed.total_events)
		if app.get("screen") != "running":
			break
		var milestone := ""
		if not before.scanned and after.scanned:
			milestone = "lock"
		elif not before.tow_attached and after.tow_attached:
			milestone = "tow"
		elif after.event_kind == "collision" and not pauses.has("collision"):
			milestone = "collision"
		elif after.tension >= 1.0 and before.tension < 1.0:
			milestone = "overload"
		elif after.dock > 0.0:
			milestone = "dock"
		if not milestone.is_empty() and not pauses.has(milestone):
			_pause(app, mode + "/" + milestone)
			pauses[milestone] = true
		if frame % 600 == 0:
			await process_frame
	driver.release()
	_check(matches and evidence and route.scan_tick == 1829 and route.attach_tick == 2869 and route.impact_tick == 4273,
		mode + " formal polled input preserves original scan/tow/impact baselines and every review entry")
	_check((mode == "recover" and sim.phase == "success" and route.ticks == 8231)
		or (mode == "unload" and sim.phase == "success" and route.ticks == 8232)
		or (mode == "overload" and sim.phase == "failed" and route.ticks == 4519 and sim.event_kind == "snap"),
		mode + " natural terminal baseline remains unchanged without terminal/HP injection")
	if mode == "unload":
		var reviewed: Dictionary = app.get("review").view()
		_check(reviewed.counts.get("rated", 0) == 1 and reviewed.counts.get("risk_clear", 0) == 1,
			"natural unloading records both returning below rated tension and cumulative risk clearing")
	_finish_evidence(app, model.snapshot(), route.ticks, "needle-bank/" + mode)


func _needle_controls(route: RefCounted, view: Dictionary, mode: String) -> Dictionary:
	# Same existing input-only unloading policy as tow_risk_feedback; no model edits.
	if mode == "unload" and route.mode == "overload" and view.overload >= 0.18:
		route.mode = "unload"
	if route.mode == "unload":
		if view.overload > 0.0:
			return {"power": 2, "slow": true, "reel": 1.0}
		route.mode = "recover"
	return route.controls(view)


func _evidence(reviewed: Dictionary, before: Dictionary, after: Dictionary, prior_total: int) -> bool:
	var added := int(reviewed.total_events) - prior_total
	var valid: bool = reviewed.elapsed == after.time and added >= 0
	for offset in range(maxi(0, reviewed.events.size() - added), reviewed.events.size()):
		var event: Dictionary = reviewed.events[offset]
		valid = valid and event.time == after.time and event.event_id == after.event_id
		match String(event.kind):
			"scan_locked": valid = valid and not before.scanned and after.scanned
			"tow_attached": valid = valid and not before.tow_attached and after.tow_attached
			"tug_collision", "cargo_collision":
				valid = valid and after.event_id > before.event_id and after.event_kind == "collision" \
					and String(after.event).begins_with("船体碰撞：" if event.kind == "tug_collision" else "舱体擦碰：")
			"overload": valid = valid and after.tow_attached and after.tension >= 1.0 and (not before.tow_attached or before.tension < 1.0)
			"rated": valid = valid and before.tow_attached and after.tow_attached and before.tension >= 1.0 and after.tension < 1.0
			"risk_clear": valid = valid and after.tow_attached and before.overload > 0.0 and after.overload == 0.0
			"docked": valid = valid and after.phase == "success" and after.dock >= 1.0
			"failed": valid = valid and after.phase == "failed" and not String(after.fail_reason).is_empty()
			_: valid = false
		print("REVIEW EVENT %s t=%.9f kind=%s id=%d evidence=%s label=%s" % [after.contract_id, event.time, event.kind, event.event_id, event.evidence, event.label])
	return valid


func _finish_evidence(app: Node, after: Dictionary, tick: int, label: String) -> void:
	var reviewed: Dictionary = app.get("review").view()
	_check(reviewed.finished and reviewed.contract_id == after.contract_id and reviewed.elapsed == after.time
		and reviewed.hull_loss == 100.0 - after.hull and reviewed.cargo_loss == 100.0 - after.cargo_integrity
		and reviewed.peak_tension == after.peak_tension, label + " final measurements reconcile exactly with public snapshot")
	_check(app.get("hud").get("_review_view") == reviewed and app.get("hud").get("_review_summary").text == reviewed.summary_text
		and app.get("hud").get("_review_timeline").text == reviewed.timeline_text, label + " terminal first frame consumes the single production review view")
	var terminal := after.duplicate(true)
	terminal.screen = "debrief"
	terminal.review = reviewed
	_terminal_views.append(terminal)
	print("APP voyage_review/%s: tick=%d t=%.9f hull_loss=%.9f cargo_loss=%.9f peak=%.9f total=%d retained=%d counts=%s tickwise_match=true evidence_match=true" % [
		label, tick, after.time, reviewed.hull_loss, reviewed.cargo_loss, reviewed.peak_tension, reviewed.total_events, reviewed.events.size(), str(reviewed.counts)])


func _pause(app: Node, label: String) -> void:
	var before: Dictionary = app.get("review").view()
	var state: Dictionary = app.get("sim").snapshot()
	app.call("_on_focus_exited")
	for delta: float in [0.0, DT, 0.75, 60.0]:
		app.call("_physics_process", delta)
		app.call("_process", delta)
		app.call("_advance_simulation", delta, {"throttle": 1.0})
	_check(app.get("screen") == "paused" and app.get("review").view() == before
		and app.get("sim").snapshot() == state and _record_bytes() == _saved, label + " focus pause ignores wall time, repeated publishing and controls")
	app.call("_on_focus_exited")
	Keys.edge(root, KEY_P)
	_check(app.get("screen") == "running" and app.get("review").view() == before, label + " resume has no duplicate events or catch-up time")


func _terminal(app: Node, label: String) -> void:
	var before: Dictionary = app.get("review").view()
	Keys.edge(root, KEY_V)
	_check(app.get("hud").get("_review_panel").visible and not app.get("hud").get("_result_overview").visible,
		label + " actual V debrief input opens the native scrollable review")
	for delta: float in [0.0, DT, 0.75, 60.0]:
		app.call("_physics_process", delta)
		app.call("_process", delta)
		app.call("_on_focus_exited")
	_check(app.get("review").view() == before and app.get("hud").get("_review_view") == before
		and _record_bytes() == _saved, label + " debrief redraw/focus cannot duplicate evidence or rewrite scores")
	await process_frame


func _geometry() -> void:
	var viewport := SubViewport.new()
	viewport.disable_3d = true
	root.add_child(viewport)
	var hud := HUD.new()
	viewport.add_child(hud)
	hud.configure(Sim.CONTRACTS, {})
	for dimensions: Vector2i in [Vector2i(1440, 900), Vector2i(1280, 720), Vector2i(960, 600), Vector2i(1920, 1080)]:
		viewport.size = dimensions
		for view: Dictionary in _terminal_views:
			var fresh := Sim.new()
			var briefing := fresh.snapshot()
			briefing.screen = "briefing"
			hud.present(briefing)
			hud.present(view)
			for expanded: bool in [false, true]:
				if expanded:
					hud.toggle_review()
				for frame in range(4):
					await process_frame
				var bounds := Rect2(Vector2.ZERO, Vector2(dimensions))
				var menu: Control = hud.get("_menus").debrief
				var label := "%s/%s/%s" % [view.contract_id, str(dimensions), "review" if expanded else "result"]
				_check(bounds.grow(1.0).encloses(_rect(menu)), label + " native menu remains within viewport")
				for button: Button in hud.find_children("*", "Button", true, false):
					if button.is_visible_in_tree():
						_check(bounds.grow(1.0).encloses(_rect(button)), label + " actionable button in bounds")
				if expanded:
					var panel: Control = hud.get("_review_panel")
					var scroll: ScrollContainer = panel.get_child(0)
					_check(bounds.grow(1.0).encloses(_rect(panel)) and scroll.size.y >= 218.0
						and hud.get("_review_timeline").get_theme_font_size("font_size") == 18,
						label + " bounded scroll panel uses unchanged readable 18-point text")
					var advice: Label = hud.get("_review_advice")
					scroll.scroll_vertical = 100000
					await process_frame
					_check(_rect(scroll).grow(1.0).encloses(_rect(advice))
						and not _rect(panel).intersects(_rect(hud.get("_review_button"))),
						label + " final advice is reachable by native scrolling, without overlap")
	viewport.queue_free()
	await process_frame


func _geometry_stress_view() -> void:
	# UI-only long-history fixture; never injected into any production simulator.
	var sim := Sim.new()
	var view := sim.snapshot()
	var review := Review.new()
	review.begin(view)
	for index in range(1, 101):
		view.time = float(index)
		view.event_id = index * 2
		view.event_kind = "collision"
		view.event = "舱体擦碰：中央针礁。留更大的外弯。"
		review.observe(view)
	view.time = 101.0
	view.phase = "failed"
	view.fail_reason = "回收舱破损，任务终止。"
	view.event_id += 1
	view.event = view.fail_reason
	review.observe(view)
	view.review = review.view()
	view.screen = "debrief"
	_terminal_views.append(view)
	_check(view.review.events.size() == 16 and view.review.total_events == 101 and view.review.notification_gap,
		"long-history UI fixture exposes retained/collected totals, truncation and notification-gap caveat")


func _rect(control: Control) -> Rect2:
	return control.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, control.size)


func _record_bytes() -> Dictionary:
	var result := {}
	for suffix: String in ["", ".bak", ".expansion.json", ".expansion.json.bak"]:
		var path := _primary + suffix
		if FileAccess.file_exists(path):
			result[path.get_file()] = FileAccess.get_file_as_bytes(path)
	return result


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
