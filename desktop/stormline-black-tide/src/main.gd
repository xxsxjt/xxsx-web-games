extends Node3D

## Scene-level adapter: controls and screen lifetime in, model snapshot out.
const Sim = preload("res://src/storm_sim.gd")
const Records = preload("res://src/storm_records.gd")
const World = preload("res://src/storm_world.gd")
const HUD = preload("res://src/storm_hud.gd")
const Audio = preload("res://src/storm_audio.gd")

var sim = Sim.new()
var records: RefCounted
var world: Node3D
var hud: CanvasLayer
var sound: Node
var screen := "briefing"
var selected_contract := "black-tide"
var muted := false
var records_file := "user://stormline-best-contracts.json"
var _tow_queued := false
var _record_status := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	records = Records.new(records_file)
	world = World.new()
	world.name = "StormlineWorld"
	world.configure(Sim.CONTRACTS[selected_contract])
	add_child(world)
	hud = HUD.new()
	hud.name = "StormlineHUD"
	add_child(hud)
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
	if sim.phase != prior_phase and sim.phase in ["success", "failed"]:
		if sim.phase == "success":
			_record_status = records.record(sim.contract_id, sim.report)
			hud.configure(Sim.CONTRACTS, records.records)
		screen = "debrief"
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
		hud.present(view)
	if is_instance_valid(sound):
		sound.present(view, delta)


func _reset_mission() -> void:
	sim.reset(selected_contract)
	_tow_queued = false
	_record_status = ""


func _on_contract_selected(id: String) -> void:
	if screen != "briefing" or id == selected_contract or not Sim.CONTRACTS.has(id):
		return
	selected_contract = id
	_reset_mission()
	world.configure(Sim.CONTRACTS[id])
	_record_status = ""
	_publish(0.0, true)


func _on_start_requested() -> void:
	if screen not in ["briefing", "debrief"]:
		return
	_reset_mission()
	screen = "running"
	_publish(0.0, true)


func _on_pause_requested() -> void:
	if screen == "running":
		screen = "paused"
		_tow_queued = false
	elif screen == "paused":
		screen = "running"
	_publish(0.0)


func _on_restart_requested() -> void:
	if screen not in ["running", "paused", "debrief"]:
		return
	_reset_mission()
	screen = "running"
	_publish(0.0, true)


func _on_briefing_requested() -> void:
	if screen not in ["paused", "debrief"]:
		return
	_reset_mission()
	screen = "briefing"
	_record_status = ""
	_publish(0.0, true)


func _on_mute_requested() -> void:
	muted = not muted
	_publish(0.0)


func _on_quit_requested() -> void:
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
	elif screen == "briefing":
		if key == KEY_ENTER or key == KEY_KP_ENTER:
			_on_start_requested()
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
			KEY_R:
				_on_restart_requested()
			KEY_ENTER, KEY_KP_ENTER:
				_on_briefing_requested()
