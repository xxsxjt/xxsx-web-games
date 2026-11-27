extends "res://tests/expedition_app_test.gd"
## Legal-input main voyages and actual isolated Store paths, separate from pure fixtures.


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/reference-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	_check(DirAccess.make_dir_recursive_absolute(_folder) == OK, "isolated fixtures")
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	for id: String in Sim.CONTRACTS:
		for score: int in [9800, 10000]:
			_check(records.record(id, {"score": score, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}) == Records.NEW_BEST, "isolated superior primary/backup scores")
	_original_records = _record_bytes()
	await _loop(_folder.path_join("loop.json"))
	await _conflict(_folder.path_join("conflict.json"))
	await _legacy(_folder.path_join("legacy.json"))
	_check(_record_bytes() == _original_records and Keys.all_released(), "four score/sidecar bytes unchanged and keys released")
	_clean_fixtures()
	print("Stormline voyage reference app: %d checks, %d failures; legal Pilot, actual paid saves and native controls; NOT GUI/human play." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _loop(path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_press(app, "launch")
	var initial := _bytes(path)
	var sim_start: Dictionary = app.get("sim").snapshot()
	_block_backup(path)
	_press(app, "confirm")
	_check(app.get("screen") == "dock" and app.get("sim").snapshot() == sim_start and _ref(app).reference.is_empty() and app.get("voyage_reference").get("_identity").is_empty() and FileAccess.get_file_as_bytes(path) == initial[""], "actual launch save failure never starts whole accumulator")
	_unblock_backup(path)
	_check(_launch(app, path, "black-tide-survey-safe"), "actual paid initialized first voyage")
	var departure := _state(app).duplicate(true)
	var measured := await _drive(app, true, true)
	_check(measured.view.phase == "success" and _state(app).revision == departure.revision + 1 and app.get("_pending").is_empty(), "genuine natural first success persisted once")
	var first := _ref(app)
	_verify_measurement(first, measured)
	_check(first.reference.segments.size() == 6 and first.reference.segments.front().number == 3 and first.reference.segments.back().number == 8, "six FIFO existing manual records deep-copied at real terminal")
	_check(_same_resources(_state(app), State.act(departure, "settle", {"token": measured.view.expedition_token, "snapshot": measured.view}).state), "settlement economics/history unchanged State authority")
	var terminal_bytes := _bytes(path)
	for index in range(3):
		app.call("_present_expedition")
		app.call("_publish", 5.0)
		Keys.edge(app.get_viewport(), KEY_V)
	_check(_ref(app) == first and _bytes(path) == terminal_bytes and _segments(app).records.size() == 6, "V/repeated terminal presentation never duplicate or replace reference/manual records/save")
	_press(app, "dock")
	_check(_segments(app).records.is_empty() and _ref(app) == first, "Stage34 actual return-to-dock clears while distinct settled reference survives")
	_press(app, "tab_work_order")
	await _reference_actions(app, path, first)
	# Both existing services and preview remain the sole economic authority.
	_press(app, "queue_recharge")
	var draft: Array = app.get("_work_order").duplicate(true)
	var before := _state(app).duplicate(true)
	var bytes := _bytes(path)
	var expected := State.preview_work_order(before, draft)
	var order: Dictionary = app.call("_work_order_view", _offer(app, "black-tide-recovery-safe"))
	_check(order.state == expected.state and order.offer == app.call("_find_offer", State.offers(expected.state), "black-tide-recovery-safe") and order.launch == State.act(expected.state, "launch", {"offer_id": "black-tide-recovery-safe"}), "real current/projected resources, selected offer and affordability exactly original State authority")
	_press(app, "queue_prepare_kit")
	_press(app, "undo_work_order")
	_check(app.get("_work_order") == draft and _state(app) == before and _bytes(path) == bytes, "native queue/undo has no persistent economic effect")
	await _reference_actions(app, path, _ref(app))
	for index in range(5):
		_press(app, "queue_prepare_kit")
		_press(app, "queue_unload_kit")
	_press(app, "queue_prepare_kit")
	_check(app.get("_work_order").size() == 12 and _bytes(path) == bytes, "real twelve-item maximum draft alongside six retained records remains unpaid")
	await _selector_context(app)
	await _preparation_geometry(app, "real six-record different-offer reference beside active recharge draft")
	# Synthetic presentation fixture only: no live/saved ship or reference modified.
	var fixture: Dictionary = _desk(app).get("_view").duplicate(true)
	fixture.reference.reference.name = "上航长合同名称与旧条件说明 ".repeat(8)
	for record: Dictionary in fixture.reference.reference.segments:
		record.energy_spent_points = null
	fixture.reference.selected.energy_spent_points = null
	_desk(app).present(fixture)
	await _preparation_geometry(app, "synthetic long-name six-record missing-energy presentation with actual draft")
	app.call("_present_expedition")
	for index in range(11):
		_press(app, "undo_work_order")
	_check(app.get("_work_order") == draft and _bytes(path) == bytes, "native undo returns from twelve-item fixture to exact original draft without persistence")
	_press(app, "commit_work_order")
	await _geometry(app, "real work-order confirmation overlay from populated preparation")
	var ref_before := _ref(app)
	app.call("_on_expedition_action", "reference_clear", "")
	_check(_ref(app) == ref_before and app.get("_work_order") == draft and _bytes(path) == bytes, "confirmation context guards reference actions")
	_press(app, "cancel")
	_check(app.get("_work_order") == draft and _bytes(path) == bytes, "native cancel confirmation retains draft and reference")
	_press(app, "commit_work_order")
	_press(app, "confirm")
	_check(_same_resources(_state(app), expected.state) and _state(app).revision == before.revision + 1 and app.get("_work_order").is_empty() and _saved(path) == _state(app) and _ref(app) == ref_before, "native commit saves original order once with unchanged history/revision semantics and reference")
	var prepared := _state(app).duplicate(true)
	_check(_launch(app, path, "black-tide-recovery-safe"), "next real paid departure after work-order commit")
	var next_spec := State.launch_spec(_state(app))
	var expected_launch := State.act(prepared, "launch", {"offer_id": "black-tide-recovery-safe"})
	_check(_same_resources(_state(app), expected_launch.state) and next_spec.hull == prepared.hull and next_spec.battery == prepared.battery and next_spec.loadout == prepared.equipped and _ref(app) == ref_before, "next paid saved active spec identical to unchanged State, retains old reference but not telemetry")
	for action: String in ["reference_clear", "reference_hide", "reference_select"]:
		app.call("_on_expedition_action", action, "segment:3")
	_check(_ref(app) == ref_before and not app.get("expedition_hud").visible, "running mode context rejects dock reference controls and hides dock page")
	var active := _state(app).duplicate(true)
	_block_backup(path)
	var failed := await _drive(app, false, false)
	_check(failed.view.phase == "failed" and not app.get("_pending").is_empty() and _state(app) == active and _ref(app) == ref_before and _button(app, "dock") == null, "actual filesystem-obstructed natural failure retains previous settled reference while exact result pending")
	var pending: Dictionary = app.get("voyage_reference").get("_candidate").duplicate(true)
	for index in range(2):
		Keys.edge(app.get_viewport(), KEY_V)
		app.call("_present_expedition")
		_press(app, "retry_save")
		app.call("_on_expedition_action", "reference_clear", "")
	_check(app.get("voyage_reference").get("_candidate") == pending and _ref(app) == ref_before and _state(app) == active, "actual repeated failed retries/V/render preserve original immutable pending and prior reference")
	await _geometry(app, "actual obstructed settlement pending overlay and original V review")
	_unblock_backup(path)
	_press(app, "retry_save")
	var second := _ref(app)
	_verify_measurement(second, failed)
	_check(second.reference.token != first.reference.token and second.reference.outcome == "failed" and second.choice == "whole" and second.reference.segments.is_empty() and _state(app).revision == active.revision + 1 and app.get("voyage_reference").get("_candidate").is_empty(), "successful retry promotes original real failed candidate once, zero manual records valid, default whole")
	app.call("_present_expedition")
	app.call("_on_expedition_action", "retry_save", "")
	_check(_ref(app) == second and _saved(path) == _state(app), "repeat retry after promotion cannot replace again")
	_press(app, "dock")
	_press(app, "tab_work_order")
	_check(_texts(_desk(app)).contains("上航无手动完成段") and _texts(_desk(app)).contains("整航实测"), "no manual records visibly distinct from no valid whole reference")
	# A paid launch followed by real abandonment never replaces a settled result.
	if _state(app).battery < 60.0:
		_service(app, path, "recharge")
	_check(_launch(app, path, "black-tide-recovery-safe"), "real departure for abandonment")
	for tick in range(120):
		app.call("_advance_simulation", DT, {"throttle": 1.0, "power": 1})
	app.call("_on_pause_requested")
	_press(app, "abandon")
	_block_backup(path)
	_press(app, "confirm")
	_check(app.get("screen") == "paused" and not app.get("_pending").is_empty() and _ref(app) == second, "actual blocked abandonment cannot create a terminal reference")
	_press(app, "retry_save")
	_check(_ref(app) == second, "actual failed abandonment retry preserves prior reference")
	_unblock_backup(path)
	_press(app, "retry_save")
	_check(app.get("screen") == "dock" and _ref(app) == second and app.get("voyage_reference").get("_identity").is_empty(), "actual saved abandonment discards in-flight measure, retains previous settled reference")
	_press(app, "retreat")
	_press(app, "confirm")
	_press(app, "restart")
	_press(app, "cancel")
	_check(_ref(app) == second, "cancel restart retains old reference")
	_press(app, "restart")
	_block_backup(path)
	_press(app, "confirm")
	_check(_ref(app) == second and _state(app).status == "retreated", "failed actual restart save does not clear prior reference")
	_unblock_backup(path)
	_press(app, "restart")
	_press(app, "confirm")
	_check(_ref(app).reference.is_empty(), "successful actual campaign restart clears reference")
	await _close(app)


func _reference_actions(app: Node, path: String, baseline: Dictionary) -> void:
	var state := _state(app).duplicate(true)
	var sim: Dictionary = app.get("sim").snapshot().duplicate(true)
	var bytes := _bytes(path)
	var draft: Array = app.get("_work_order").duplicate(true)
	var reference = app.get("voyage_reference")
	var copy := _ref(app)
	copy.reference.whole.start.time = 999
	_check(_ref(app) == baseline, "main exported nested reference view deep copy")
	_press(app, "reference_select_segment:8")
	_check(_ref(app).choice == "segment:8" and _ref(app).selected == baseline.reference.segments.back(), "actual connected native segment selection is prior immutable record")
	await _preparation_geometry(app, "selected prior retained segment beside current draft")
	_press(app, "reference_hide")
	await _preparation_geometry(app, "hidden reference retains current preparation")
	_check(not _texts(_desk(app)).contains("上航段 #8"), "native hide actually hides old measurements")
	_press(app, "reference_show")
	for id: String in ["segment:0", "segment:999", "segment:-1", "whole "]:
		app.call("_on_expedition_action", "reference_select", id)
	_check(_ref(app).choice == "segment:8", "invalid native-action IDs cannot retarget later/current records")
	_press(app, "reference_select_whole")
	_check(_state(app) == state and app.get("sim").snapshot() == sim and _bytes(path) == bytes and _record_bytes() == _original_records and app.get("_work_order") == draft, "native show/select/hide are entirely read-only to full Sim/gameplay/draft/campaign primary+backup and scores")
	# Clear is verified here then restore ONLY by the next genuine result in separate cases.
	_check(reference.view().reference == baseline.reference, "native actions leave immutable saved payload unchanged")


func _selector_context(app: Node) -> void:
	var viewport := app.get_viewport() as SubViewport
	for dimensions: Vector2i in VIEWPORTS:
		viewport.size = dimensions
		app.call("_present_expedition")
		for frame in range(7):
			await process_frame
		for id: String in ["reference_select_segment:8", "reference_select_whole"]:
			var button := _button(app, id)
			button.grab_focus()
			for frame in range(7):
				await process_frame
			var before: int = _desk(app).get("_scroll").scroll_vertical
			button.pressed.emit()
			for frame in range(7):
				await process_frame
			for redraw in range(2):
				if redraw == 1:
					app.call("_present_expedition")
					for frame in range(7):
						await process_frame
				var scroll: ScrollContainer = _desk(app).get("_scroll")
				var expected := mini(before, maxi(0, int(scroll.get_v_scroll_bar().max_value - scroll.get_v_scroll_bar().page)))
				var focus := viewport.gui_get_focus_owner()
				var note := "settled selector context %s %s redraw=%d" % [dimensions, id, redraw]
				_check(absi(scroll.scroll_vertical - expected) <= 1, note + " preserves saved scroll after deferred native follow_focus")
				_check(focus == _button(app, id), note + " restores same original serial/whole control")
				_check(is_instance_valid(focus) and _rect(scroll).grow(2).encloses(_rect(focus)), note + " focused selector stays visible")
	viewport.size = Vector2i(1280, 720)


func _conflict(path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_launch(app, path, "black-tide-survey-safe")
	await _drive(app, true, false)
	_press(app, "dock")
	var prior := _ref(app)
	_launch(app, path, "black-tide-recovery-safe")
	var competitor := Store.new(path)
	var loaded := competitor.load_state()
	var recovered := State.act(loaded.state, "recover_interrupted")
	_check(loaded.ok and recovered.ok and competitor.save_state(recovered.state, int(loaded.state.revision)).ok, "actual independent Store competing revision wins without touching app snapshot")
	var winner := _bytes(path)
	await _drive(app, false, false)
	_check(app.get("_expedition_conflict") and not app.get("_pending").is_empty() and _ref(app) == prior and _button(app, "retry_save") == null, "genuine natural result with actual competing revision never promotes or overwrites prior")
	_press(app, "reload")
	_press(app, "cancel")
	_check(_ref(app) == prior and _bytes(path) == winner, "cancel conflict discard preserves old reference and competing bytes")
	_press(app, "reload")
	_press(app, "confirm")
	_check(app.get("screen") == "archive" and _ref(app).reference.is_empty() and _bytes(path) == winner and _state(app) == _saved(path), "actual discard+reload clears stale memory and never overwrites winner")
	_press(app, "continue")
	_check(_ref(app).reference.is_empty(), "archive history never rehydrates reference")
	await _close(app)


func _legacy(path: String) -> void:
	_check(Store.new(path).save_state(State.new_campaign(), -1).ok, "valid legacy no-damage archive fixture")
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_launch(app, path, "black-tide-survey-safe")
	var measured := await _drive(app, true, false)
	_verify_measurement(_ref(app), measured)
	_check(not measured.start.has("energy_budget") and _ref(app).selected.energy_spent_points == null and not _state(app).has("damage_control"), "real old-compatible voyage missing energy remains unavailable with no archive extension")
	_press(app, "dock")
	_press(app, "tab_work_order")
	await _preparation_geometry(app, "actual old-compatible no-energy whole-reference preparation")
	var bytes := _bytes(path)
	var sim: Dictionary = app.get("sim").snapshot().duplicate(true)
	var before := _state(app).duplicate(true)
	_press(app, "queue_recharge")
	var draft: Array = app.get("_work_order").duplicate(true)
	_press(app, "reference_clear")
	_check(_ref(app).reference.is_empty() and _bytes(path) == bytes and _state(app) == before and app.get("sim").snapshot() == sim and app.get("_work_order") == draft, "actual native explicit clear never clears/changes work-order draft, state or files")
	await _preparation_geometry(app, "cleared reference leaves real unpaid draft and native fallback focus")
	_press(app, "clear_work_order")
	_launch(app, path, "black-tide-recovery-safe")
	await _drive(app, false, false)
	_press(app, "dock")
	_check(not _ref(app).reference.is_empty(), "new genuine result after explicit clear creates reference")
	app.call("_on_expedition_action", "reload", "")
	_check(_ref(app).reference.is_empty(), "explicit actual archive reread clears")
	_press(app, "continue")
	if _state(app).battery < 55.0:
		_service(app, path, "recharge")
	_launch(app, path, "black-tide-recovery-safe")
	await _drive(app, false, false)
	_press(app, "dock")
	_press(app, "desk")
	_check(app.get("mode") == "quick" and _ref(app).reference.is_empty(), "actual switch quickplay clears reference")
	await _close(app)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_check(_ref(app).reference.is_empty(), "real new main instance loses memory, never recovers archive history")
	await _close(app)


func _drive(app: Node, navigate: bool, manual: bool) -> Dictionary:
	var sim = app.get("sim")
	var start: Dictionary = sim.snapshot().duplicate(true)
	var oracle := Sim.new()
	_check(oracle.reset_expedition(State.launch_spec(_state(app))), "independent unchanged Sim actual saved launch spec")
	var view := start
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var travel := 0.0
	var equal := true
	var ticks := 0
	for tick in range(1, ceili(float(start.deadline) / DT) + 5):
		if manual and tick <= 8:
			app.get("hud").get("_segment_buttons")["start"].pressed.emit()
		var controls := _pilot_controls(sim, view, cursor) if navigate else {"power": 1}
		var before: Vector2 = view.position
		app.call("_advance_simulation", DT, controls)
		var expected := oracle.step(DT, controls)
		view = sim.snapshot()
		equal = equal and expected == view
		var dx: float = view.position.x - before.x
		var dy: float = view.position.y - before.y
		travel += sqrt(dx * dx + dy * dy)
		ticks = tick
		if manual and tick <= 8:
			app.get("hud").get("_segment_buttons")["finish"].pressed.emit()
		if app.get("screen") != "running":
			break
		if tick % 900 == 0:
			await process_frame
	_check(equal and view.phase in ["success", "failed"] and _record_bytes() == _original_records, "every natural input tick full public snapshot identical to independent unchanged Sim, scores untouched")
	print("APP REFERENCE NATURAL offer=%s phase=%s ticks=%d seconds=%.6f travel=%.6f displacement=%.6f equal=%s" % [start.offer_id, view.phase, ticks, view.time, travel, start.position.distance_to(view.position), equal])
	return {"start": start, "view": view, "travel": travel, "ticks": ticks}


func _verify_measurement(reference: Dictionary, measured: Dictionary) -> void:
	var whole: Dictionary = reference.reference.whole
	var start: Dictionary = measured.start
	var end: Dictionary = measured.view
	_check(reference.reference.token == start.expedition_token and reference.reference.offer_id == start.offer_id and reference.reference.base_contract == start.contract_id and whole.start.time == start.time and whole.end.time == end.time and whole.elapsed_s == end.time - start.time and absf(whole.distance_m - measured.travel) < 0.000001, "real complete whole-voyage identity/time/per-step distance include terminal last step, not summed manual records")
	_check(whole.hull_delta_pp == end.hull - start.hull and whole.battery_delta_pp == end.battery - start.battery and whole.start.wind == start.wind and whole.end.wind == end.wind and whole.start.storm == start.storm and whole.end.storm == end.storm, "actual signed hull/battery pp and endpoint public wind/storm")
	if start.has("energy_budget"):
		_check(absf(whole.energy_spent_points - (end.energy_budget.spent.total - start.energy_budget.spent.total)) < 1e-9, "optional actual continuous spent points independent of battery delta")


func _preparation_geometry(app: Node, note: String) -> void:
	await _geometry(app, note)
	var viewport := app.get_viewport() as SubViewport
	for dimensions: Vector2i in VIEWPORTS:
		viewport.size = dimensions
		for frame in range(4):
			await process_frame
		var comparison: Control = _desk(app).find_child("PreparationComparison", true, false)
		var current: Control = _desk(app).find_child("CurrentPreparation", true, false)
		var prior: Control = _desk(app).find_child("LastVoyageReference", true, false)
		_check(comparison != null and current != null and prior != null and not _rect(current).intersects(_rect(prior)) and _rect(comparison).grow(1).encloses(_rect(current)) and _rect(comparison).grow(1).encloses(_rect(prior)), note + str(dimensions) + " actual simultaneous comparison parents separate and enclosed")
		for panel: Control in [current, prior]:
			for child: Control in panel.find_children("*", "Control", true, false):
				if child.is_visible_in_tree():
					_check(_rect(panel).grow(1).encloses(_rect(child)), note + str(dimensions) + " nested child fits " + child.get_class())
	viewport.size = Vector2i(1280, 720)


func _ref(app: Node) -> Dictionary:
	return app.get("voyage_reference").view()


func _segments(app: Node) -> Dictionary:
	return app.get("segments").view()


func _bytes(path: String) -> Dictionary:
	var result := {}
	for suffix: String in ["", ".bak"]:
		if FileAccess.file_exists(path + suffix):
			result[suffix] = FileAccess.get_file_as_bytes(path + suffix)
	return result
