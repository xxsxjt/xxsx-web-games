extends Node3D

## Scene-level adapter: controls and screen lifetime in, model snapshot out.
const Sim = preload("res://src/storm_sim.gd")
const Records = preload("res://src/storm_records.gd")
const World = preload("res://src/storm_world.gd")
const HUD = preload("res://src/storm_hud.gd")
const Audio = preload("res://src/storm_audio.gd")
const Review = preload("res://src/voyage_review.gd")
const ExpeditionHUD = preload("res://src/expedition_hud.gd")
const ExpeditionState = preload("res://src/expedition_state.gd")
const ExpeditionStore = preload("res://src/expedition_store.gd")
const Catalog = preload("res://src/expedition_catalog.gd")

var sim = Sim.new()
var review = Review.new()
var records: RefCounted
var world: Node3D
var hud: CanvasLayer
var sound: Node
var screen := "briefing"
var mode := "quick"
var selected_contract := "black-tide"
var muted := false
var records_file := "user://stormline-best-contracts.json"
@export var expedition_file := "user://stormline-expedition-v1.json"
var expedition_hud: ExpeditionHUD
var expedition_state: Dictionary = {}
var _expedition_store: ExpeditionStore
var _archive: Dictionary = {}
var _offer_id := ""
var _expedition_notice := ""
var _expedition_error := false
var _expedition_conflict := false
var _confirmation := ""
var _terminal: Dictionary = {}
# Only a stopped voyage can have a pending write. Retry this exact candidate
# with its original CAS revision, not a newly calculated settlement.
var _pending: Dictionary = {}
var _tow_queued := false
var _record_status := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	records = Records.new(records_file)
	_expedition_store = ExpeditionStore.new(expedition_file)
	world = World.new()
	world.name = "StormlineWorld"
	world.configure(sim.contract)
	add_child(world)
	hud = HUD.new()
	hud.name = "StormlineHUD"
	add_child(hud)
	expedition_hud = ExpeditionHUD.new()
	expedition_hud.name = "ExpeditionHUD"
	add_child(expedition_hud)
	sound = Audio.new()
	sound.name = "StormlineAudio"
	add_child(sound)
	hud.contract_selected.connect(_on_contract_selected)
	hud.start_requested.connect(_on_start_requested)
	hud.pause_requested.connect(_on_pause_requested)
	hud.restart_requested.connect(_on_restart_requested)
	hud.briefing_requested.connect(_on_briefing_requested)
	hud.mute_requested.connect(_on_mute_requested)
	hud.quit_requested.connect(_on_quit_requested)
	hud.expedition_requested.connect(_on_expedition_requested)
	expedition_hud.requested.connect(_on_expedition_action)
	# The window close button must have the same consequences as the pause menu.
	if get_window() == get_tree().root:
		get_tree().auto_accept_quit = false
		get_window().close_requested.connect(_on_quit_requested)
	get_window().focus_exited.connect(_on_focus_exited)
	hud.configure(Sim.CONTRACTS, records.records)
	_publish(0.0, true)


func _physics_process(delta: float) -> void:
	if screen != "running":
		return
	var throttle := float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)) \
		- float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN))
	var steer := float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) \
		- float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var controls := {
		"throttle": throttle,
		"steer": steer,
		"scan": Input.is_key_pressed(KEY_E),
		"tow_pressed": _tow_queued,
		"power": sim.power_profile,
		"slow": Input.is_key_pressed(KEY_SHIFT),
		"reel": float(Input.is_key_pressed(KEY_F)) - float(Input.is_key_pressed(KEY_Q)),
	}
	_tow_queued = false
	_advance_simulation(delta, controls)


func _process(delta: float) -> void:
	_publish(delta)


## A testable input boundary shared by the real keyboard adapter and headless app tests.
func _advance_simulation(delta: float, controls: Dictionary) -> void:
	if screen != "running":
		return
	var prior_phase: String = String(sim.phase)
	var view: Dictionary = sim.step(delta, controls)
	review.observe(view)
	if sim.phase != prior_phase and sim.phase in ["success", "failed"]:
		screen = "debrief"
		if mode == "expedition":
			_terminal = view.duplicate(true)
			_close_deployment("settle", _terminal)
			_present_expedition()
		elif sim.phase == "success":
			_record_status = records.record(sim.contract_id, sim.report)
			hud.configure(Sim.CONTRACTS, records.records)
		_publish(0.0)
	else:
		# Catch event edges at physics rate; the render frame presents world and HUD.
		view["screen"] = screen
		view["muted"] = muted
		sound.present(view, 0.0)


func _publish(delta: float, snap_camera: bool = false) -> void:
	var view: Dictionary = sim.snapshot()
	view["screen"] = screen
	view["muted"] = muted
	view["record_status"] = _record_status
	if is_instance_valid(world):
		world.present(view, delta, snap_camera)
	if is_instance_valid(hud):
		var hud_view := view
		if mode == "expedition":
			hud_view = view.duplicate()
			hud_view["expedition_ui"] = true
		elif screen == "debrief":
			# Review is a HUD-only memory view; preserve the world's public projection.
			hud_view = view.duplicate()
			hud_view["review"] = review.view()
		hud.present(hud_view)
	if is_instance_valid(sound):
		sound.present(view, delta)


func _reset_mission() -> void:
	sim.reset(selected_contract)
	review.clear()
	_tow_queued = false
	_record_status = ""


func _on_contract_selected(id: String) -> void:
	if mode != "quick" or screen != "briefing" or id == selected_contract or not Sim.CONTRACTS.has(id):
		return
	selected_contract = id
	_reset_mission()
	world.configure(sim.contract)
	_record_status = ""
	_publish(0.0, true)


func _on_start_requested() -> void:
	if mode != "quick" or screen not in ["briefing", "debrief"]:
		return
	_reset_mission()
	screen = "running"
	review.begin(sim.snapshot())
	_publish(0.0, true)


func _on_pause_requested() -> void:
	if screen == "running":
		screen = "paused"
		_tow_queued = false
	elif screen == "paused":
		if mode == "expedition" and (not _pending.is_empty() or not _confirmation.is_empty()):
			return
		screen = "running"
	else:
		return
	if mode == "expedition":
		_present_expedition()
	_publish(0.0)


func _on_restart_requested() -> void:
	if mode != "quick" or screen not in ["running", "paused", "debrief"]:
		return
	_reset_mission()
	screen = "running"
	review.begin(sim.snapshot())
	_publish(0.0, true)


func _on_briefing_requested() -> void:
	if mode != "quick" or screen not in ["paused", "debrief"]:
		return
	_reset_mission()
	screen = "briefing"
	_record_status = ""
	_publish(0.0, true)


func _on_mute_requested() -> void:
	muted = not muted
	if mode == "expedition" and screen != "running":
		_present_expedition()
	_publish(0.0)


func _on_quit_requested() -> void:
	if mode == "expedition":
		if not _pending.is_empty():
			_ask_confirmation("quit_unsaved")
			return
		if screen in ["running", "paused"]:
			_ask_confirmation("abandon_quit")
			return
	get_tree().quit()


func _on_focus_exited() -> void:
	if screen == "running":
		_on_pause_requested()


func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	var key: Key = event.keycode if event.keycode != KEY_NONE else event.physical_keycode
	if key == KEY_M:
		_on_mute_requested()
	elif mode == "expedition" and screen != "running":
		if key == KEY_ESCAPE and not _confirmation.is_empty():
			_on_expedition_action("cancel", "")
		elif key == KEY_ESCAPE and screen in ["archive", "dock"]:
			_on_expedition_action("desk", "")
		elif key in [KEY_P, KEY_ESCAPE] and screen == "paused":
			_on_pause_requested()
		elif key == KEY_V and screen == "debrief" and _confirmation.is_empty():
			expedition_hud.toggle_review()
		elif key in [KEY_PAGEUP, KEY_PAGEDOWN, KEY_HOME, KEY_END]:
			expedition_hud.scroll_with_key(key)
	elif screen == "briefing":
		if key == KEY_ENTER or key == KEY_KP_ENTER:
			_on_start_requested()
		elif key == KEY_X:
			_on_expedition_requested()
		elif key >= KEY_1 and key <= KEY_9:
			var index := int(key) - KEY_1
			var ids: Array = Sim.CONTRACTS.keys()
			if index < ids.size():
				_on_contract_selected(String(ids[index]))
	elif screen == "running":
		match key:
			KEY_SPACE:
				_tow_queued = true
			KEY_1:
				sim.set_power_profile(0)
			KEY_2:
				sim.set_power_profile(1)
			KEY_3:
				sim.set_power_profile(2)
			KEY_P, KEY_ESCAPE:
				_on_pause_requested()
			KEY_R:
				_on_restart_requested()
	elif screen == "paused":
		match key:
			KEY_P, KEY_ESCAPE:
				_on_pause_requested()
			KEY_R:
				_on_restart_requested()
			KEY_ENTER, KEY_KP_ENTER:
				_on_briefing_requested()
	elif screen == "debrief":
		match key:
			KEY_V:
				hud.toggle_review()
			KEY_R:
				_on_restart_requested()
			KEY_ENTER, KEY_KP_ENTER:
				_on_briefing_requested()


func _on_expedition_requested() -> void:
	if mode == "quick" and screen == "briefing":
		mode = "expedition"
		_read_expedition()
		_publish(0.0)


func _read_expedition() -> void:
	_archive = _expedition_store.load_state()
	expedition_state = _archive.state
	_offer_id = ""
	_confirmation = ""
	_pending = {}
	_terminal = {}
	review.clear()
	_expedition_conflict = false
	_feedback(String(_archive.message), not bool(_archive.ok) and bool(_archive.exists))
	screen = "archive"
	_present_expedition()


func _on_expedition_action(action: String, value: String) -> void:
	if mode != "expedition" or screen == "running":
		return
	if action == "mute":
		_on_mute_requested()
		return
	if not _confirmation.is_empty():
		if action == "confirm":
			_accept_confirmation()
		elif action == "cancel":
			_confirmation = ""
			_present_expedition()
		return
	if action == "quit":
		_on_quit_requested()
		return
	if action == "reload":
		if _pending.is_empty() and screen in ["archive", "dock"]:
			_read_expedition()
			_publish(0.0)
		elif not _pending.is_empty() and (_expedition_conflict or not _pending.has("change")):
			_ask_confirmation("discard_pending")
		return
	if not _pending.is_empty():
		if action == "retry_save" and not _expedition_conflict and _pending.has("change"):
			_retry_pending()
			_present_expedition()
			_publish(0.0)
		return
	if action == "desk" and screen in ["archive", "dock"]:
		mode = "quick"
		screen = "briefing"
		_reset_mission()
		world.configure(sim.contract)
		_present_expedition()
		_publish(0.0, true)
		return
	if _expedition_conflict:
		return
	match screen:
		"archive":
			match action:
				"new":
					if not _archive.exists and not _archive.backup_available:
						if _save_expedition(ExpeditionState.new_campaign(), -1, "已创建独立远征档案。"):
							screen = "dock"
				"continue":
					if not expedition_state.is_empty():
						if expedition_state.status == "active":
							_confirmation = "recover_interrupted"
						else:
							screen = "dock"
				"restore":
					if not _archive.ok and _archive.backup_available:
						_confirmation = "restore"
		"dock":
			match action:
				"offer":
					if not _find_offer(ExpeditionState.offers(expedition_state), value).is_empty():
						_offer_id = value
				"launch":
					if not _offer_id.is_empty() and _can_launch().ok:
						_confirmation = "launch"
				"buy", "equip", "unequip":
					_apply_dock_change(action, {"module_id": value})
				"repair", "recharge":
					_apply_dock_change(action)
				"retreat":
					if expedition_state.status == "dock":
						_confirmation = "retreat"
				"restart":
					if expedition_state.status in ["completed", "retreated"]:
						_confirmation = "restart"
		"paused":
			match action:
				"resume":
					_on_pause_requested()
					return
				"abandon":
					_confirmation = "abandon"
		"debrief":
			if action == "dock":
				_enter_dock()
	_present_expedition()
	_publish(0.0)


func _ask_confirmation(action: String) -> void:
	if screen == "running":
		screen = "paused"
		_tow_queued = false
	_confirmation = action
	_present_expedition()
	_publish(0.0)


func _accept_confirmation() -> void:
	var action := _confirmation
	_confirmation = ""
	match action:
		"launch":
			_launch_expedition()
		"abandon", "abandon_quit":
			if not _close_deployment("abandon", sim.snapshot(), action == "abandon_quit"):
				screen = "paused"
		"restore":
			var restored := _expedition_store.restore_backup()
			if restored.ok:
				_archive = restored
				expedition_state = restored.state
			_expedition_conflict = bool(restored.conflict)
			_feedback(String(restored.message), not bool(restored.ok))
		"recover_interrupted", "retreat", "restart":
			if _apply_dock_change(action):
				_enter_dock()
		"discard_pending":
			_read_expedition()
		"quit_unsaved":
			get_tree().quit()
	_present_expedition()
	_publish(0.0)


func _launch_expedition() -> void:
	var change := _can_launch()
	if not change.ok:
		_feedback(String(change.message), true)
		return
	if not _save_expedition(change.state, int(expedition_state.revision), String(change.message)):
		return
	# After persistence, reconstruct only from the saved active record.
	var spec := ExpeditionState.launch_spec(expedition_state)
	if spec.is_empty() or not sim.reset_expedition(spec) or not _deployment_matches(sim.snapshot()):
		screen = "archive"
		_feedback("出航已入档，但驾驶初始化未通过。请继续并按中断规则返港，不能跳过费用重复出航。", true)
		return
	screen = "running"
	_terminal = {}
	_tow_queued = false
	world.configure(sim.contract)
	review.begin(sim.snapshot())
	_publish(0.0, true)


func _can_launch() -> Dictionary:
	return ExpeditionState.act(expedition_state, "launch", {"offer_id": _offer_id})


func _deployment_matches(view: Dictionary) -> bool:
	var active: Dictionary = expedition_state.get("active", {})
	return not active.is_empty() and view.get("expedition_token") == active.token and view.get("offer_id") == active.offer_id


func _close_deployment(action: String, snapshot: Dictionary, quit_after: bool = false) -> bool:
	if not _pending.is_empty():
		return false
	var change := ExpeditionState.act(expedition_state, action, {"token": snapshot.get("expedition_token"), "snapshot": snapshot})
	if not change.ok:
		_pending = {"action": action}
		_feedback("尚未入账；航次身份或状态未通过校验。" + String(change.message), true)
		return false
	_pending = {"action": action, "change": change, "expected": int(expedition_state.revision), "quit_after": quit_after}
	return _retry_pending()


func _retry_pending() -> bool:
	var change: Dictionary = _pending.change
	if not _save_expedition(change.state, int(_pending.expected), String(change.message)):
		_feedback("结果待保存，尚未入账。\n" + _expedition_notice, true)
		return false
	var action := String(_pending.action)
	var quit_after := bool(_pending.quit_after)
	_pending = {}
	if action == "abandon":
		_enter_dock()
		if quit_after:
			get_tree().quit()
	return true


func _apply_dock_change(action: String, payload: Dictionary = {}) -> bool:
	var change := ExpeditionState.act(expedition_state, action, payload)
	if not change.ok:
		_feedback(String(change.message), true)
		return false
	return _save_expedition(change.state, int(expedition_state.revision), String(change.message))


func _save_expedition(next_state: Dictionary, expected: int, message: String) -> bool:
	var saved := _expedition_store.save_state(next_state, expected)
	_expedition_conflict = bool(saved.conflict)
	if not saved.ok:
		_feedback("保存失败；未提交本次变更。" + String(saved.message), true)
		return false
	_archive = saved
	expedition_state = saved.state
	_feedback(message)
	return true


func _enter_dock() -> void:
	screen = "dock"
	_terminal = {}
	_offer_id = ""
	review.clear()


func _feedback(message: String, is_error: bool = false) -> void:
	_expedition_notice = message
	_expedition_error = is_error


func _find_offer(offers: Array, id: String) -> Dictionary:
	for offer: Dictionary in offers:
		if offer.id == id:
			return offer
	return {}


func _present_expedition() -> void:
	if mode != "expedition" or screen == "running":
		expedition_hud.close()
		return
	var offers: Array = []
	var selected: Dictionary = {}
	var launch: Dictionary = {}
	var services: Dictionary = {}
	var module_actions: Dictionary = {}
	if screen == "dock" and expedition_state.status == "dock":
		offers = ExpeditionState.offers(expedition_state)
		selected = _find_offer(offers, _offer_id)
		if selected.is_empty() and not offers.is_empty():
			selected = offers.front()
			_offer_id = String(selected.id)
		launch = _can_launch()
		for action: String in ["repair", "recharge"]:
			services[action] = ExpeditionState.act(expedition_state, action)
		for id: String in Catalog.modules():
			var action := "unequip" if id in expedition_state.equipped else ("equip" if id in expedition_state.owned else "buy")
			module_actions[id] = ExpeditionState.act(expedition_state, action, {"module_id": id})
			module_actions[id]["action"] = action
	expedition_hud.present({"screen": screen, "state": expedition_state, "archive": _archive,
		"file": expedition_file.get_file(), "offer": selected, "offers": offers, "launch": launch,
		"services": services, "module_actions": module_actions,
		"muted": muted, "notice": _expedition_notice, "error": _expedition_error, "conflict": _expedition_conflict,
		"confirmation": _confirmation, "pending": not _pending.is_empty(), "retryable": _pending.has("change"),
		"pending_state": _pending.get("change", {}).get("state", {}),
		"terminal": _terminal, "review": review.view(), "voyage": sim.snapshot() if screen == "paused" else {}})
