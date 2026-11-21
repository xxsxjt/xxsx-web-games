extends SceneTree
## Formal main/HUD composition root, real controls and isolated archive I/O.
## Pilot only supplies inputs; no test assigns any sim or campaign state.
const MainScene = preload("res://scenes/main.tscn")
const State = preload("res://src/expedition_state.gd")
const Store = preload("res://src/expedition_store.gd")
const Records = preload("res://src/storm_records.gd")
const Sim = preload("res://src/storm_sim.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const Needle = preload("res://tests/journey_test.gd")
const Keys = preload("res://tests/needle_keyboard_driver.gd")
const DT := 1.0 / 60.0
const FULL_ROUTE := ["black-tide-survey-high", "black-tide-recovery-safe", "needle-bank-survey-safe",
	"needle-bank-recovery-high", "cross-current-survey-safe", "cross-current-recovery-safe"]
const ALT_FIRST := "black-tide-salvage-high"
const VIEWPORTS := [Vector2i(960, 600), Vector2i(1280, 720), Vector2i(1440, 900), Vector2i(1920, 1080)]

var _folder := ""
var _records := ""
var _original_records: Dictionary = {}
var _checks := 0
var _failures := 0
var _delivered := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	_folder = ProjectSettings.globalize_path("res://.testdata/expedition-app-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_folder) != OK:
		printerr("FAIL: cannot create isolated test directory")
		quit(1)
		return
	_records = _folder.path_join("best.json")
	var records := Records.new(_records)
	# Superior scores make even a naturally delivered quick play read-only.
	for id: String in Sim.CONTRACTS:
		var best := {"score": 9800, "time": 2.0, "grade": "S", "hull": 100.0, "peak_tension": 0.0}
		_check(records.record(id, best) == Records.NEW_BEST, "seed isolated record: " + id)
		best.score = 10000
		_check(records.record(id, best) == Records.NEW_BEST, "seed isolated record backup: " + id)
	_original_records = _record_bytes()
	_check(_original_records.size() == 4, "all legacy primary/backup/sidecar bytes captured")
	await _full_campaign(_folder.path_join("full.json"))
	await _alternate_campaign(_folder.path_join("alternate.json"))
	await _settlement_conflict(_folder.path_join("pending-conflict.json"))
	await _interrupted(_folder.path_join("interrupted.json"))
	await _stale_and_corrupt(_folder.path_join("fault.json"))
	_check(_record_bytes() == _original_records, "all four score files retain their original bytes")
	_check(Keys.all_released() and _delivered == 7, "no held key leak; one full plus one alternate first delivery")
	_clean_fixtures()
	print("Stormline expedition app: %d checks, %d failures, %d natural expedition deliveries; no real-window or human playtest." % [_checks, _failures, _delivered])
	quit(0 if _failures == 0 else 1)


func _full_campaign(path: String) -> void:
	var app := _open(path)
	await _quick_lifecycle(app, path)
	app.get("hud").find_child("OpenExpedition", true, false).pressed.emit()
	if not _check(app.get("mode") == "expedition" and app.get("screen") == "archive" and not FileAccess.file_exists(path),
			"expedition button opens read-only archive without creating a save"):
		await _close(app)
		return
	await _geometry(app, "new archive")
	var viewport := app.get_viewport()
	# Use native keyboard activation of the actual focused button for creation.
	var new_button := _button(app, "new")
	new_button.grab_focus()
	Keys.edge(viewport, KEY_ENTER)
	if not _check(app.get("screen") == "dock" and _saved(path) == _state(app) and _state(app).revision == 0,
			"focused new button activated with Enter creates a valid initial archive"):
		await _close(app)
		return
	await _geometry(app, "six-node chart and quotes")
	var chart := _button(app, "tab_chart")
	chart.grab_focus()
	Keys.edge(viewport, KEY_TAB)
	_check(viewport.gui_get_focus_owner() == _button(app, "tab_outfit"), "native Tab navigates from chart to outfitting")
	Keys.edge(viewport, KEY_ENTER)
	_check(_desk(app).get("_tab") == "outfit", "focused tab changes native page")
	if not _build(app, ["drive", "sonar"]):
		await _close(app)
		return
	_check(_button(app, "buy_tow").disabled, "outfit screen prevents a purchase above actual funds")
	await _geometry(app, "outfit tools and meter")
	_press(app, "tab_chart")
	var opening := _saved(path).duplicate(true)
	_press(app, "offer_" + String(FULL_ROUTE[0]))
	_press(app, "launch")
	await _geometry(app, "launch confirmation")
	# Neither opening nor cancelling a confirmation spends anything.
	Keys.edge(viewport, KEY_ESCAPE)
	_check(_saved(path) == opening and app.get("screen") == "dock", "Esc cancels launch without cost or reset")
	_press(app, "launch")
	var before_save: Dictionary = app.get("sim").snapshot()
	_block_backup(path)
	_press(app, "confirm")
	_check(app.get("screen") == "dock" and _saved(path) == opening and app.get("sim").snapshot() == before_save
		and _notice(app).contains("保存失败"), "blocked backup makes paid launch fail closed before any sim reset")
	_unblock_backup(path)
	var worn := false
	var charged := 0
	for index in range(FULL_ROUTE.size()):
		if index == 5:
			_test_module_limit(app)
		var state := _state(app)
		var reserve := 61.0 if state.sector == 1 else 84.0
		while float(_state(app).battery) < reserve:
			if not _service(app, path, "recharge"):
				await _close(app)
				return
			charged += 1
		var id := String(FULL_ROUTE[index])
		if not _launch(app, path, id):
			await _close(app)
			return
		var active := _state(app).duplicate(true)
		worn = worn or float(active.hull) < 100.0 or float(active.battery) < 100.0
		if index in [0, 2, 5]:
			await _geometry(app, "cockpit " + String(active.active.offer_id))
		if index == 0:
			_block_backup(path)
		var metrics := await _sail(app, true, index in [0, 5], path if index == 0 else "")
		var terminal: Dictionary = metrics.view
		var delivered := _delivery(app, metrics, id)
		if index == 0:
			_check(app.get("screen") == "debrief" and _state(app) == active and _saved(path) == active
				and _notice(app).contains("尚未入账") and _button(app, "retry_save") != null and _button(app, "dock") == null,
				"real delivery stays pending and cannot advance when settlement write is blocked")
			await _geometry(app, "pending settlement and retry")
			_redraw(app)
			_press(app, "retry_save")
			_check(_state(app) == active and _saved(path) == active, "repeated save failure does not recalculate or pay result")
			_unblock_backup(path)
			_press(app, "retry_save")
		if not delivered or not _check_saved_delivery(app, path, active, terminal, index + 1):
			await _close(app)
			return
		if index in [0, 5]:
			Keys.edge(viewport, KEY_V)
			_check(bool(_desk(app).get("_review_open")) and _texts(_desk(app)).contains("碰撞通知非全部接触"),
				"V opens original evidence wording and bounded in-memory review")
			await _geometry(app, "actual voyage review")
			_press(app, "review")
			_check(not _desk(app).get("_review_open"), "review button and V toggle the same view")
		_redraw(app)
		_press(app, "dock")
		_check(_state(app).path.size() == index + 1 and _saved(path) == _state(app), "next dock only presents durable progress")
		if index == 2:
			var persisted := _state(app).duplicate(true)
			await _close(app)
			app = _open(path)
			viewport = app.get_viewport()
			Keys.edge(viewport, KEY_X)
			_check(app.get("screen") == "archive" and _state(app) == persisted, "X and fresh main read the same continuing archive")
			_press(app, "continue")
			_check(app.get("screen") == "dock" and _saved(path) == persisted, "continue at dock doesn't alter budget or revision")
	var finished := _state(app).duplicate(true)
	_check(finished.status == "completed" and finished.path == FULL_ROUTE and worn and charged >= 2,
		"paid recharge and a worn departure occur in a full six-deployment campaign")
	_check(_texts(_desk(app)).contains("远征成功") and _texts(_desk(app)).count("已交付 ·") == 6,
		"all six chart nodes delivered and flagship success has a distinct visible title")
	_press(app, "tab_ledger")
	await _geometry(app, "complete expedition ledger")
	var ledger_scroll: ScrollContainer = _desk(app).get("_scroll")
	Keys.edge(app.get_viewport(), KEY_HOME)
	_check(ledger_scroll.scroll_vertical == 0, "Home reaches the start of a long ledger")
	Keys.edge(app.get_viewport(), KEY_PAGEDOWN)
	_check(ledger_scroll.scroll_vertical > 0, "PgDn scrolls a read-only ledger without needing the mouse")
	Keys.edge(app.get_viewport(), KEY_END)
	_check(ledger_scroll.scroll_vertical >= int(ledger_scroll.get_v_scroll_bar().max_value - ledger_scroll.get_v_scroll_bar().page) - 1,
		"End reaches the oldest retained ledger entries")
	var end_y := ledger_scroll.scroll_vertical
	Keys.edge(app.get_viewport(), KEY_PAGEUP)
	_check(ledger_scroll.scroll_vertical < end_y, "PgUp returns toward newer ledger entries")
	_press(app, "desk")
	_check(app.get("mode") == "quick" and app.get("screen") == "briefing" and not app.get("sim").snapshot().has("expedition"),
		"leaving the expedition returns to an uncontaminated quick desk")
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "continue")
	_check(_state(app) == finished and _button(app, "restart") != null, "completed save reloads as its visible ending, not a silent restart")
	_press(app, "restart")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	_check(_saved(path) == finished, "cancelled new expedition preserves the completed archive")
	_press(app, "restart")
	_press(app, "confirm")
	var fresh := _state(app)
	_check(fresh.status == "dock" and fresh.path.is_empty() and fresh.campaign_id != finished.campaign_id
		and fresh.revision == finished.revision + 1 and _saved(path + ".bak") == finished,
		"explicit restart saves a distinct expedition and keeps the old terminal archive in backup")
	await _close(app)


func _alternate_campaign(path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	_press(app, "tab_outfit")
	if not _build(app, ["tow", "sonar"]) or not _launch(app, path, ALT_FIRST):
		await _close(app)
		return
	var active := _state(app).duplicate(true)
	var metrics := await _sail(app)
	if not _delivery(app, metrics, ALT_FIRST) or not _check_saved_delivery(app, path, active, metrics.view, 1):
		await _close(app)
		return
	_press(app, "dock")
	var next := _offer(app, "black-tide-recovery-safe")
	var survey: Array = [FULL_ROUTE[0]]
	var compared := Catalog.build_contract("black-tide-recovery-safe", int(_state(app).pressure), survey)
	_check(next.severity > compared.severity and next.mass > compared.mass and next.deadline < compared.deadline,
		"actual preceding salvage route tightens the next quote relative to same-pressure survey path")
	_press(app, "tab_outfit")
	_press(app, "unequip_sonar")
	_check(_state(app).equipped == ["tow"] and "sonar" in _state(app).owned, "uninstall frees a slot without losing ownership")
	_press(app, "equip_sonar")
	_check(_state(app).equipped == ["tow", "sonar"], "owned module can be re-equipped")
	await _damage_and_withdraw(app, path, String(next.id))


func _test_module_limit(app: Node) -> void:
	_press(app, "tab_outfit")
	var before_unfit := _state(app).duplicate(true)
	_press(app, "buy_tow")
	_check("tow" in _state(app).owned and _state(app).credits == before_unfit.credits - Catalog.modules().tow.price
		and _button(app, "equip_tow").disabled, "owned third module cannot exceed full slots/budget")
	_press(app, "unequip_sonar")
	_check(_button(app, "equip_tow").disabled and _state(app).equipped == ["drive"],
		"free slot alone cannot mount two heavy modules over the load budget")
	_press(app, "equip_sonar")


func _settlement_conflict(path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	if not _launch(app, path, "black-tide-survey-safe"):
		await _close(app)
		return
	var departure := _state(app).duplicate(true)
	var other := _open(path)
	Keys.edge(other.get_viewport(), KEY_X)
	_press(other, "continue")
	_press(other, "confirm")
	var winner := _state(other).duplicate(true)
	var winner_bytes := FileAccess.get_file_as_bytes(path)
	await _close(other)
	var metrics := await _sail(app)
	_check(metrics.view.phase == "success" and app.get("screen") == "debrief"
		and _state(app) == departure and winner == _saved(path) and winner.path.is_empty()
		and _notice(app).contains("尚未入账") and _notice(app).contains("另一会话")
		and _button(app, "retry_save") == null and _button(app, "dock") == null,
		"real terminal is not paid or advanced after another session already recovered its active token")
	_press(app, "reload")
	_check(_texts(_desk(app)).contains("舍弃待保存结果") and _state(app) == departure,
		"pending conflict keeps the result visible until explicit discard")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	_check(app.get("screen") == "debrief" and FileAccess.get_file_as_bytes(path) == winner_bytes,
		"cancelling pending conflict confirmation preserves both local result and newer disk bytes")
	_press(app, "reload")
	_press(app, "confirm")
	_check(app.get("screen") == "archive" and _state(app) == winner and FileAccess.get_file_as_bytes(path) == winner_bytes,
		"discard/reload never overwrites or rewards the newer recovery ledger")
	print("APP EXPEDITION stale settlement: phase=%s %.2fs, recovered disk path=%d, pending discarded without payout" % [metrics.view.phase, metrics.view.time, winner.path.size()])
	await _close(app)


func _damage_and_withdraw(app: Node, path: String, next_id: String) -> void:
	if not _service(app, path, "recharge") or not _launch(app, path, next_id):
		await _close(app)
		return
	var active := _state(app).duplicate(true)
	# Spend >20 points by using the actual sonar/energy path, then steer into a
	# real charted reef. This makes the old 'use departure HP/charge' bug obvious.
	for tick in range(60 * 37):
		app.call("_advance_simulation", DT, {"power": 1, "scan": true})
	var sim = app.get("sim")
	var current: Dictionary = sim.snapshot()
	var reef: Dictionary = sim.contract.hazards.back()
	for tick in range(60 * 22):
		if String(app.get("screen")) != "running" or float(current.hull) < float(active.hull):
			break
		app.call("_advance_simulation", DT, Pilot._pilot(current, reef.position, 9.5, 0))
		current = sim.snapshot()
	if not _check(app.get("screen") == "running" and current.battery < float(active.battery) - State.INTERRUPTED_BATTERY_LOSS
			and current.hull < float(active.hull), "abandon fixture causes real above-penalty energy burn and actual reef damage via inputs"):
		await _close(app)
		return
	Keys.edge(app.get_viewport(), KEY_P)
	_check(_texts(_desk(app)).contains("出航船体  %.1f%%" % float(active.hull))
		and _texts(_desk(app)).contains("船体 %.1f%%" % float(current.hull)),
		"pause distinguishes durable departure health from current damaged ship")
	_press(app, "abandon")
	_check(_texts(_desk(app)).contains("当前真实耗损"), "abandon confirmation explains actual baseline and rescue costs")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	_check(app.get("screen") == "paused" and _saved(path) == active and sim.snapshot() == current, "cancel leaves same active ship, fee and damage")
	_press(app, "abandon")
	_press(app, "confirm")
	var abandoned := _state(app).duplicate(true)
	_check(app.get("screen") == "dock" and _saved(path) == abandoned and abandoned.revision == active.revision + 1
		and is_equal_approx(float(abandoned.hull), maxf(0, float(current.hull) - State.INTERRUPTED_HULL_LOSS))
		and is_equal_approx(float(abandoned.battery), maxf(0, float(current.battery) - State.INTERRUPTED_BATTERY_LOSS))
		and abandoned.credits == active.credits and abandoned.parts == active.parts and abandoned.path == active.path
		and abandoned.history.back().event == "abandon", "active abandon uses measured loss, never restores resources or pays rewards")
	print("APP EXPEDITION abandon at %.2fs: hull %.2f→%.2f, battery %.2f→%.2f; path=%d, funds=%d" % [
		current.time, current.hull, abandoned.hull, current.battery, abandoned.battery, abandoned.path.size(), abandoned.credits])
	if not _service(app, path, "repair") or not _service(app, path, "recharge") or not _launch(app, path, next_id):
		await _close(app)
		return
	active = _state(app).duplicate(true)
	# Unattended legal controls give a real simulator failure, not a fake terminal.
	var metrics := await _sail(app, false)
	var failed: Dictionary = metrics.view
	var failed_state := _state(app).duplicate(true)
	_check(app.get("screen") == "debrief" and failed.phase == "failed" and not String(failed.fail_reason).is_empty()
		and failed_state == _saved(path) and failed_state.revision == active.revision + 1 and failed_state.status == "dock"
		and failed_state.history.back().outcome == "failed" and failed_state.credits == active.credits
		and failed_state.parts == active.parts and failed_state.path == active.path
		and is_equal_approx(float(failed_state.hull), maxf(0, float(failed.hull) - State.FAILED_HULL_LOSS))
		and is_equal_approx(float(failed_state.battery), float(failed.battery)), "natural failure settles once; no reward, prior path remains, battery/damage persist")
	print("APP EXPEDITION natural failure: %s %.2fs event=%s" % [failed.phase, failed.time, failed.event_kind])
	Keys.edge(app.get_viewport(), KEY_V)
	await _geometry(app, "failure voyage review")
	_redraw(app)
	_press(app, "dock")
	_press(app, "retreat")
	_press(app, "confirm")
	_check(_saved(path).status == "retreated" and _saved(path).credits == failed_state.credits and _button(app, "launch") == null
		and _button(app, "restart") != null and _texts(_desk(app)).contains("远征已撤退"), "voluntary retreat ends a damaged expedition and offers explicit new campaign")
	await _geometry(app, "withdrawn expedition ending")
	await _close(app)


func _interrupted(path: String) -> void:
	var app := _open(path, true)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	if not _launch(app, path, "black-tide-survey-safe"):
		await _close(app)
		return
	var active := _state(app).duplicate(true)
	# Small real-key proof in expedition mode; the full routes deliberately use
	# the deterministic continuous-input Pilot at _advance_simulation instead.
	var held := {"throttle": 1.0, "steer": 1.0, "reel": 0.0, "scan": true, "slow": false, "power": 1, "tow_pressed": false}
	var reference := Sim.new()
	if not _check(reference.reset_expedition(State.launch_spec(active)), "actual departure spec also starts the keyboard reference"):
		await _close(app)
		return
	var start := reference.snapshot()
	var driver := Keys.new()
	driver.apply(app.get_viewport(), held)
	for tick in range(120):
		app.call("_physics_process", DT)
		reference.step(DT, held)
	driver.release()
	var live: Dictionary = app.get("sim").snapshot()
	_check(live == reference.snapshot() and live.position.distance_to(start.position) > 1.0
		and live.battery < start.battery and Keys.all_released(),
		"120 real polled W/D/E ticks and the 2 edge match continuous model controls in the formal expedition cockpit")
	# Root quit guard uses the same request as the window close signal; cancel
	# here while simulating abnormal termination by disposing this scene below.
	root.close_requested.emit()
	_check(app.get("screen") == "paused" and _button(app, "confirm").text.contains("退出"), "normal close first freezes the ship and asks for abandonment")
	Keys.edge(app.get_viewport(), KEY_ESCAPE)
	await _close(app)
	app = _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_check(app.get("screen") == "archive" and _state(app) == active and _saved(path) == active
		and not app.get("sim").snapshot().has("expedition") and _texts(_desk(app)).contains("没有逐帧存档"),
		"reopened active shows interruption without advancing, recovering or restoring a physics frame")
	_press(app, "continue")
	_check(_texts(_desk(app)).contains("按出航登记") and _saved(path) == active, "actual interruption shows its distinct departure baseline before confirmation")
	_block_backup(path)
	_press(app, "confirm")
	_check(app.get("screen") == "archive" and _saved(path) == active and _notice(app).contains("保存失败"),
		"interrupted recovery can't continue without saving its penalties")
	_unblock_backup(path)
	_press(app, "continue")
	_press(app, "confirm")
	var recovered := _state(app).duplicate(true)
	_check(app.get("screen") == "dock" and recovered == _saved(path) and recovered.revision == active.revision + 1
		and recovered.history.back().event == "recover_interrupted" and recovered.path == active.path
		and recovered.hull == maxf(0, float(active.hull) - State.INTERRUPTED_HULL_LOSS)
		and recovered.battery == maxf(0, float(active.battery) - State.INTERRUPTED_BATTERY_LOSS),
		"interrupted archive is charged once and durably recovered into dock with no physical continuation")
	print("APP EXPEDITION interrupted archive: departure hull %.2f→%.2f, battery %.2f→%.2f, funds=%d, progress=%d" % [
		active.hull, recovered.hull, active.battery, recovered.battery, recovered.credits, recovered.path.size()])
	await _close(app)


func _stale_and_corrupt(path: String) -> void:
	var app := _open(path)
	Keys.edge(app.get_viewport(), KEY_X)
	_press(app, "new")
	var stale := _state(app).duplicate(true)
	var other := _open(path)
	Keys.edge(other.get_viewport(), KEY_X)
	_press(other, "continue")
	_press(other, "tab_outfit")
	_press(other, "buy_sonar")
	var winner := _state(other).duplicate(true)
	var winner_bytes := FileAccess.get_file_as_bytes(path)
	await _close(other)
	var before: Dictionary = app.get("sim").snapshot()
	_press(app, "launch")
	_press(app, "confirm")
	_check(_state(app) == stale and _saved(path) == winner and app.get("sim").snapshot() == before
		and FileAccess.get_file_as_bytes(path) == winner_bytes
		and app.get("screen") == "dock" and _notice(app).contains("另一会话") and _button(app, "reload") != null,
		"sequential stale CAS cannot spend, overwrite the other save, or enter flight")
	await _geometry(app, "stale archive notice")
	_press(app, "reload")
	_check(_state(app) == winner and app.get("screen") == "archive", "explicit reload sees the other session's saved state")
	await _close(app)
	# This is a storage fault fixture, not a fabricated voyage or ledger entry.
	var corrupt := "{broken isolated fixture\n".to_utf8_buffer()
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not _check(file != null, "isolated corruption fixture opens"):
		return
	file.store_buffer(corrupt)
	file.close()
	_block_backup(path)
	app = _open(path)
	_check(FileAccess.get_file_as_bytes(path) == corrupt and app.get("screen") == "briefing", "app startup doesn't overwrite a bad archive")
	Keys.edge(app.get_viewport(), KEY_X)
	_check(_button(app, "new") == null and _button(app, "restore") == null and _notice(app).contains("无可用备份")
		and _texts(_desk(app)).contains("不会覆盖坏档") and FileAccess.get_file_as_bytes(path) == corrupt,
		"bad primary without usable backup exposes a safe recheck instead of new or restore")
	await _geometry(app, "bad archive without usable backup")
	_unblock_backup(path)
	_press(app, "reload")
	_check(_button(app, "new") == null and _button(app, "restore") != null and _notice(app).contains("损坏")
		and FileAccess.get_file_as_bytes(path) == corrupt, "bad main shows a viable backup but refuses new or automatic restore")
	_press(app, "restore")
	_check(FileAccess.get_file_as_bytes(path) == corrupt, "merely opening restoration confirmation preserves the corrupt file")
	_press(app, "confirm")
	var quarantine := DirAccess.get_files_at(_folder)
	var retained := false
	for name: String in quarantine:
		if name.begins_with(path.get_file() + ".corrupt-"):
			retained = FileAccess.get_file_as_bytes(_folder.path_join(name)) == corrupt
	_check(_saved(path) == stale and retained and app.get("screen") == "archive" and _notice(app).contains("备份"),
		"explicit restore loads actual prior save and quarantines exact bad bytes")
	await _close(app)


func _quick_lifecycle(app: Node, expedition_path: String) -> void:
	var viewport := app.get_viewport()
	var hud: CanvasLayer = app.get("hud")
	var cards: Dictionary = hud.get("_contract_cards")
	var keys := Sim.CONTRACTS.keys()
	for index in keys.size():
		var id := String(keys[index])
		Keys.edge(viewport, KEY_1 + ((index + 1) % keys.size()))
		cards[id].button.pressed.emit()
		_check(app.get("selected_contract") == id and String(hud.get("_brief_name").text) == Sim.CONTRACTS[id].name,
			"old card updates model and quick dossier: " + id)
		Keys.edge(viewport, KEY_1 + ((index + 1) % keys.size()))
		Keys.edge(viewport, KEY_1 + index)
		Keys.edge(viewport, KEY_ENTER)
		_check(app.get("screen") == "running" and app.get("sim").snapshot().contract_id == id,
			"old 1–3 and Enter select/start quick contract: " + id)
		app.call("_advance_simulation", DT, {"throttle": 1.0})
		Keys.edge(viewport, KEY_R)
		_check(app.get("sim").snapshot().time == 0.0 and app.get("sim").snapshot().hull == 100.0, "quick R remains a free clean restart: " + id)
		Keys.edge(viewport, KEY_P)
		Keys.edge(viewport, KEY_ENTER)
		_check(app.get("screen") == "briefing", "quick pause/return stays available")
	Keys.edge(viewport, KEY_1)
	hud.get("_launch").pressed.emit()
	var metrics := await _sail(app)
	Keys.edge(viewport, KEY_V)
	_check(metrics.view.phase == "success" and app.get("screen") == "debrief" and hud.get("_review_panel").visible
		and _record_bytes() == _original_records and not FileAccess.file_exists(expedition_path),
		"natural quick delivery and original V review work; superior scores and absent expedition save stay untouched")
	Keys.edge(viewport, KEY_ENTER)


func _test_pause(app: Node, path: String) -> void:
	var viewport := app.get_viewport()
	var sim = app.get("sim")
	var before: Dictionary = sim.snapshot()
	var durable := _saved(path)
	Keys.edge(viewport, KEY_SPACE)
	app.call("_on_focus_exited")
	Keys.edge(viewport, KEY_R)
	app.get("hud").emit_signal("restart_requested")
	app.get("hud").emit_signal("briefing_requested")
	_redraw(app)
	_check(app.get("screen") == "paused" and sim.snapshot() == before and _saved(path) == durable
		and not app.get("_tow_queued") and _button(app, "abandon") != null, "focus, R, redraw and old signals cannot reset or refund a paused expedition")
	await _geometry(app, "expedition pause")
	Keys.edge(viewport, KEY_ESCAPE)
	_check(app.get("screen") == "running" and sim.snapshot() == before and _saved(path) == durable,
		"keyboard resume does not catch up time or respend launch")
	Keys.edge(viewport, KEY_R)
	_check(sim.snapshot() == before and _saved(path) == durable and app.get("hud").get("_keys_tow").text.contains("禁用 R"), "flight R is disabled with a cockpit explanation")


func _sail(app: Node, navigate: bool = true, dock_geometry: bool = false, pause_path: String = "") -> Dictionary:
	var sim = app.get("sim")
	var view: Dictionary = sim.snapshot()
	var start := view.duplicate(true)
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var scan := 0
	var attach := 0
	var dock := 0
	var tick := 0
	var dock_measured := false
	for step in range(1, ceili(float(start.deadline) / DT) + 5):
		var controls := _pilot_controls(sim, view, cursor) if navigate else {"power": 1}
		if step == 1:
			_check(sim.snapshot() == start, "read-only Pilot does not mutate initial snapshot")
		app.call("_advance_simulation", DT, controls)
		view = sim.snapshot()
		tick = step
		if scan == 0 and view.scanned:
			scan = step
			if not pause_path.is_empty():
				await _test_pause(app, pause_path)
		if attach == 0 and view.tow_attached:
			attach = step
		dock = dock + 1 if view.dock > 0.0 else 0
		if dock_geometry and dock == 1 and not dock_measured:
			dock_measured = true
			app.call("_publish", 0.0)
			await _geometry(app, "actual two-body docking cockpit")
		if app.get("screen") != "running":
			break
		if step % 120 == 0:
			app.call("_publish", DT)
		if step % 900 == 0:
			await process_frame
	return {"view": view, "tick": tick, "scan": scan, "attach": attach, "dock": dock, "start": start}


func _pilot_controls(sim, view: Dictionary, cursor: Dictionary) -> Dictionary:
	# Same immutable Stage25 Pilot and authored harbour routes; expedition tests
	# choose a route by public contract_id, never drive by changing model fields.
	var stage := "return" if view.tow_attached else ("cargo" if view.scanned else "outbound")
	if stage != cursor.stage:
		cursor.stage = stage
		cursor.index = 0
	var controls: Dictionary
	if view.contract_id == "cross-current":
		cursor.index = Pilot.route_index_for(view, stage, cursor.index)
		controls = Pilot.controls_for(sim, stage, cursor.index, cursor.tow)
	else:
		var route: Array = Pilot.ROUTES.safe.get(stage, [])
		controls = Pilot.controls_for(sim, stage, route.size(), cursor.tow)
		if view.contract_id == "needle-bank" and stage in ["outbound", "return"]:
			var goals: Array = Needle.NEEDLE_OUTBOUND if stage == "outbound" else Needle.NEEDLE_RETURN
			while cursor.index < goals.size() and view.position.distance_to(goals[cursor.index]) < Pilot.WAYPOINT_RADIUS:
				cursor.index += 1
			if cursor.index < goals.size():
				controls.merge(Pilot._pilot(view, goals[cursor.index], 8.0 if stage == "outbound" else 5.0, 1 if stage == "outbound" else 2), true)
	cursor.tow = controls.get("tow_pressed", false)
	return controls


func _build(app: Node, modules: Array) -> bool:
	for id: String in modules:
		if not _press(app, "buy_" + id) or not _press(app, "equip_" + id):
			return false
	return _check(_state(app).equipped == modules and _state(app).owned == modules and _texts(_desk(app)).contains("总负载 3/3"),
		"paid construction shown as actual two-slot max load: " + "+".join(modules))


func _service(app: Node, path: String, action: String) -> bool:
	_press(app, "tab_outfit")
	var before := _state(app).duplicate(true)
	var expected := State.act(before, action)
	if not _press(app, action):
		return false
	var after := _state(app)
	print("APP EXPEDITION service %s: %d→%d credits, %d→%d materials, hull %.2f→%.2f, battery %.2f→%.2f, pressure %d→%d" % [
		action, before.credits, after.credits, before.parts, after.parts, before.hull, after.hull, before.battery, after.battery, before.pressure, after.pressure])
	return _check(expected.ok and after == _saved(path) and _same_resources(after, expected.state),
		"service saves the State resource result, with exact currency/material/pressure and numeric health roundtrip")


func _launch(app: Node, path: String, id: String) -> bool:
	if String(_desk(app).get("_tab")) != "chart":
		_press(app, "tab_chart")
	var before := _state(app).duplicate(true)
	var offer := _offer(app, id)
	if not _check(not offer.is_empty(), "published actual contract exists: " + id) or not _press(app, "offer_" + id):
		return false
	if not _press(app, "launch") or not _press(app, "confirm") or not _check(app.get("screen") == "running", "confirmation opens paid driving: " + id):
		return false
	var active := _state(app)
	var sim = app.get("sim")
	var world: Node = app.get("world")
	var hud: CanvasLayer = app.get("hud")
	var view: Dictionary = sim.snapshot()
	var meta: Dictionary = view.expedition
	var spec := State.launch_spec(active)
	var chart: Dictionary = hud.get("_radar").get("_snapshot")
	_check(active.status == "active" and active.revision == before.revision + 1 and active == _saved(path)
		and active.credits == before.credits - offer.launch_cost and active.path == before.path,
		"one launch fee and active token saved before flight: " + id)
	_check(view.expedition_token == active.active.token and view.offer_id == id and meta.token == spec.token and meta.offer_id == spec.offer_id
		and view.hull == before.hull and view.battery == before.battery and meta.loadout == before.equipped,
		"launch_spec, frozen active and snapshot agree on identity, materials and mounted gear")
	_check(sim.contract.id == id and world.get("_contract") == sim.contract and world.get("_view").expedition == meta
		and world.get("_view").position == view.position and chart.position == view.position and chart.hazards == view.hazards
		and sim.contract.severity == offer.severity and sim.contract.mass == offer.mass and view.deadline == offer.deadline
		and hud.get("_mission").text == offer.name and not chart.has("cargo_position"),
		"quote, real world, clock and native radar are the same deployment; unscanned pod is hidden")
	var radius := float(view.tide_survey.radius) if view.has("tide_survey") else float(meta.thresholds.scan_radius)
	_check(String(hud.get("_rig").text).contains("声纳 %.2f" % float(meta.profile.sensors))
		and hud.get("_objective").text.contains("≤%.0f m" % radius), "cockpit uses effective module profile and true objective threshold")
	return true


func _delivery(app: Node, metrics: Dictionary, id: String) -> bool:
	var view: Dictionary = metrics.view
	var start: Dictionary = metrics.start
	print("APP EXPEDITION %s %s phase=%s tick=%d t=%.2f/%.0f scan=%d tow=%d dock=%d hull=%.2f→%.2f battery=%.2f→%.2f cargo=%.2f peak=%.3f reason=%s" % [
		"+".join(start.expedition.loadout), id, view.phase, metrics.tick, view.time, view.deadline, metrics.scan, metrics.attach,
		metrics.dock, start.hull, view.hull, start.battery, view.battery, view.cargo_integrity, view.peak_tension, view.fail_reason])
	var success := _check(app.get("screen") == "debrief" and view.phase == "success" and metrics.scan > 0
		and metrics.attach > metrics.scan and metrics.dock >= 60 and view.dock == 1.0 and view.time < view.deadline
		and view.position.distance_to(view.harbor) <= view.harbor_radius and view.cargo_position.distance_to(view.harbor) <= view.harbor_radius,
		"production controls naturally scan, attach, and dock both bodies: " + id)
	var review: Dictionary = app.get("review").view()
	_check(review.finished and review.elapsed == view.time and review.hull_loss == start.hull - view.hull
		and review.counts.get("scan_locked", 0) == 1 and review.counts.get("tow_attached", 0) == 1 and review.counts.get("docked", 0) == 1,
		"unchanged original review records a real terminal and actual hull loss baseline")
	return success


func _check_saved_delivery(app: Node, path: String, active: Dictionary, terminal: Dictionary, legs: int) -> bool:
	var actual := _state(app).duplicate(true)
	var expected := State.act(active, "settle", {"token": terminal.expedition_token, "snapshot": terminal})
	var raw := FileAccess.get_file_as_bytes(path)
	Keys.edge(app.get_viewport(), KEY_R)
	_redraw(app)
	var same_rule: bool = expected.ok and _same_resources(actual, expected.state)
	var unchanged := actual == _state(app) and actual == _saved(path) and FileAccess.get_file_as_bytes(path) == raw
	var durable := _check(same_rule and unchanged and actual.path.size() == legs
		and is_equal_approx(float(actual.hull), float(terminal.hull)) and is_equal_approx(float(actual.battery), float(terminal.battery))
		and _record_bytes() == _original_records,
		"delivery applies one correct saved payout; R, focus and publish do not settle again (rule=%s, durable=%s, legs=%s)" % [same_rule, unchanged, actual.path.size()])
	if durable:
		_delivered += 1
	return durable


func _same_resources(saved: Dictionary, expected: Dictionary) -> bool:
	# JSON's numeric parser may round the last few binary places of a double.
	# Exact comparison is used for disk bytes, identity, increments and all ints.
	for key: String in ["hull", "battery"]:
		if absf(float(saved[key]) - float(expected[key])) > 1e-9:
			return false
	if saved.history.size() != expected.history.size():
		return false
	var actual := saved.duplicate(true)
	for index in actual.history.size():
		for key: String in ["hull", "battery"]:
			if absf(float(actual.history[index][key]) - float(expected.history[index][key])) > 1e-9:
				return false
			actual.history[index][key] = expected.history[index][key]
		actual.hull = expected.hull
		actual.battery = expected.battery
	return actual == expected


func _redraw(app: Node) -> void:
	for delta: float in [0.0, DT, 2.0, 60.0]:
		app.call("_advance_simulation", delta, {"throttle": 1.0})
		app.call("_publish", delta)
		app.call("_on_focus_exited")


func _geometry(app: Node, note: String) -> void:
	var viewport := app.get_viewport() as SubViewport
	for dimensions: Vector2i in VIEWPORTS:
		viewport.size = dimensions
		for frame in range(4):
			await process_frame
		var bounds := Rect2(Vector2.ZERO, Vector2(dimensions)).grow(1)
		var label := "%s %s" % [note, str(dimensions)]
		if app.get("screen") == "running":
			var panels: Array[Rect2] = []
			for child: Control in app.get("hud").get("_live").get_children():
				if child.is_visible_in_tree():
					var rect := _rect(child)
					_check(bounds.encloses(rect), label + " cockpit panel within viewport: " + str(rect))
					for other: Rect2 in panels:
						_check(not rect.intersects(other), label + " cockpit panels don't overlap")
					panels.append(rect)
			continue
		var desk := _desk(app)
		var page: Control = desk.get("_page")
		var scroll: ScrollContainer = desk.get("_scroll")
		_check(bounds.encloses(_rect(page)) and bounds.encloses(_rect(scroll)) and scroll.size.y >= 210.0,
			label + " page and useful native scroll extent within viewport")
		for button: Button in desk.get("_buttons").values():
			if not scroll.is_ancestor_of(button):
				_check(bounds.encloses(_rect(button)) and not _rect(button).intersects(_rect(scroll)), label + " fixed action in bounds: " + button.text)
			elif not button.disabled:
				button.grab_focus()
				await process_frame
				_check(viewport.gui_get_focus_owner() == button and _rect(scroll).grow(2).encloses(_rect(button)),
					label + " native follow_focus reveals scroll action: %s: %s in %s" % [button.text, _rect(button), _rect(scroll)])
			if not button.disabled:
				var focus := button.get_theme_stylebox("focus") as StyleBoxFlat
				_check(button.get_theme_font_size("font_size") == 18 and button.focus_mode == Control.FOCUS_ALL
					and focus != null and focus.border_width_top >= 2, label + " readable/visibly focusable action")
		var bottom := scroll.get_v_scroll_bar()
		scroll.scroll_vertical = int(bottom.max_value)
		await process_frame
		var last := scroll.find_children("*", "Label", true, false)
		if not last.is_empty():
			_check(_rect(scroll).grow(2).encloses(_rect(last.back())), label + " last text reachable by native scrolling")
	viewport.size = Vector2i(1280, 720)


func _open(path: String, in_root: bool = false) -> Node:
	var viewport: Viewport = root
	if not in_root:
		var sub := SubViewport.new()
		sub.disable_3d = true
		sub.size = Vector2i(1280, 720)
		root.add_child(sub)
		viewport = sub
	var app: Node = MainScene.instantiate()
	app.set("records_file", _records)
	app.set("expedition_file", path)
	viewport.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	return app


func _close(app: Node) -> void:
	if app.get_viewport() == root:
		app.queue_free()
	else:
		app.get_viewport().queue_free()
	await process_frame


func _desk(app: Node) -> CanvasLayer:
	return app.get("expedition_hud")


func _button(app: Node, id: String) -> Button:
	return _desk(app).get("_buttons").get(id) if _desk(app).visible else null


func _press(app: Node, id: String) -> bool:
	var button := _button(app, id)
	if not _check(button != null and button.is_visible_in_tree() and not button.disabled,
			"reachable actual button at screen %s: %s" % [app.get("screen"), id]):
		return false
	button.pressed.emit()
	return true


func _state(app: Node) -> Dictionary:
	return app.get("expedition_state")


func _offer(app: Node, id: String) -> Dictionary:
	for offer: Dictionary in _desk(app).get("_view").get("offers", []):
		if offer.id == id:
			return offer
	return {}


func _saved(path: String) -> Dictionary:
	return Store.new(path).load_state().state


func _notice(app: Node) -> String:
	return _desk(app).find_child("ArchiveNotice", true, false).text


func _texts(parent: Node) -> String:
	var lines := PackedStringArray()
	for label: Label in parent.find_children("*", "Label", true, false):
		if label.is_visible_in_tree():
			lines.append(label.text)
	return "\n".join(lines)


func _rect(control: Control) -> Rect2:
	return control.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, control.size)


func _block_backup(path: String) -> void:
	var bak := path + ".bak"
	if FileAccess.file_exists(bak):
		_check(DirAccess.rename_absolute(bak, path + ".held") == OK, "move only isolated backup out of the way")
	_check(DirAccess.make_dir_absolute(bak) == OK, "block backup replacement with an isolated directory")


func _unblock_backup(path: String) -> void:
	_check(DirAccess.remove_absolute(path + ".bak") == OK, "remove only isolated backup obstruction")
	if FileAccess.file_exists(path + ".held"):
		_check(DirAccess.rename_absolute(path + ".held", path + ".bak") == OK, "restore isolated previous backup")


func _record_bytes() -> Dictionary:
	var bytes := {}
	for suffix: String in ["", ".bak", ".expansion.json", ".expansion.json.bak"]:
		var path := _records + suffix
		if FileAccess.file_exists(path):
			bytes[suffix] = FileAccess.get_file_as_bytes(path)
	return bytes


func _clean_fixtures() -> void:
	for name: String in DirAccess.get_files_at(_folder):
		_check(DirAccess.remove_absolute(_folder.path_join(name)) == OK, "remove only this test's fixture: " + name)
	for name: String in DirAccess.get_directories_at(_folder):
		_check(name.ends_with(".bak") and DirAccess.remove_absolute(_folder.path_join(name)) == OK, "remove only this test's obstruction: " + name)
	_check(DirAccess.remove_absolute(_folder) == OK, "remove this test's isolated fixture directory")


func _check(ok: bool, where: String) -> bool:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + where)
	return ok
