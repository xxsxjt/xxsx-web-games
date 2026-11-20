extends SceneTree
## Native event-handler/polling regression; no OS input or GUI automation.

const MainScene = preload("res://scenes/main.tscn")
const DT := 1.0 / 60.0
var _checks := 0
var _failures := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	var folder := ProjectSettings.globalize_path("res://.testdata/input-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		printerr("Cannot create isolated input test directory")
		quit(1)
		return
	var app: Node = MainScene.instantiate()
	app.set("records_file", folder.path_join("best.json"))
	root.add_child(app)
	app.set_process(false)
	app.set_physics_process(false)
	_key(KEY_ENTER, false)
	_check(app.get("screen") == "briefing", "key release cannot launch")
	_key(KEY_ENTER, true, true)
	_check(app.get("screen") == "briefing", "key-repeat echo cannot launch")
	_key(KEY_2)
	_check(app.get("selected_contract") == "needle-bank", "briefing 2 selects second route")
	_key(KEY_1)
	_check(app.get("selected_contract") == "black-tide", "briefing 1 selects first route")
	_key(KEY_KP_ENTER)
	_check(app.get("screen") == "running", "keypad Enter launches")
	_key(KEY_2)
	_check(app.get("sim").power_profile == 1 and app.get("selected_contract") == "black-tide", "running 2 changes power, not mission")
	_key(KEY_3)
	_check(app.get("sim").power_profile == 2, "3 selects tow power")
	_key(KEY_1)
	_check(app.get("sim").power_profile == 0, "1 selects propulsion")
	# Exercise the same Input singleton polling as the real physics adapter.
	_poll_key(KEY_W, true)
	_check(Input.is_key_pressed(KEY_W), "synthetic in-process W reaches key polling")
	app.call("_physics_process", DT)
	_check(app.get("sim").throttle > 0.9 and app.get("sim").mission_time > 0.0, "physics adapter polls forward drive")
	_poll_key(KEY_DOWN, true)
	app.call("_physics_process", DT)
	_check(is_zero_approx(app.get("sim").throttle), "opposed W and down arrow cancel")
	_poll_key(KEY_W, false)
	_check(not Input.is_key_pressed(KEY_W), "release clears polled key state")
	app.call("_physics_process", DT)
	_check(app.get("sim").throttle < -0.9, "physics adapter polls the arrow-key reverse alias")
	_poll_key(KEY_DOWN, false)
	_key(KEY_SPACE)
	_check(app.get("_tow_queued"), "space queues a single tow request")
	app.call("_physics_process", DT)
	_check(not app.get("_tow_queued") and app.get("sim").event_kind == "denied", "one tick consumes tow edge and rules reject unscanned target")
	_key(KEY_SPACE, true, true)
	_check(not app.get("_tow_queued"), "held-space key repeat cannot retrigger tow")
	_key(KEY_P)
	_check(app.get("screen") == "paused", "P pauses")
	var before: float = app.get("sim").mission_time
	app.call("_physics_process", DT)
	_check(app.get("sim").mission_time == before, "paused physics adapter does not advance")
	_key(KEY_ESCAPE)
	_check(app.get("screen") == "running", "Esc resumes")
	_key(KEY_R)
	_check(app.get("sim").mission_time == 0.0 and app.get("screen") == "running", "R cleanly restarts active run")
	_key(KEY_SPACE)
	_key(KEY_ESCAPE)
	_check(not app.get("_tow_queued"), "pause discards a pending tow edge")
	_key(KEY_ENTER)
	_check(app.get("screen") == "briefing", "paused Enter returns to briefing")
	_key(KEY_M)
	_check(app.get("muted") and app.get("hud").get("_muted"), "M updates actual menu audio indicator")
	_key(KEY_M, true, true)
	_check(app.get("muted"), "M echo does not double toggle")
	var physical := InputEventKey.new()
	physical.physical_keycode = KEY_M
	physical.pressed = true
	root.push_input(physical)
	_check(not app.get("muted"), "physical-key-only event uses fallback")
	_check(DirAccess.get_files_at(folder).is_empty(), "keyboard restarts and refused tow never write player scores")
	app.queue_free()
	await process_frame
	_check(DirAccess.remove_absolute(folder) == OK, "remove isolated input folder")
	print("Stormline keyboard adapter: %d checks, %d failures; synthetic engine events only, no real keyboard or window." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _key(key: Key, pressed := true, echo := false) -> void:
	# Route edges through the engine's viewport (including GUI consumption), not directly to the handler.
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = pressed
	event.echo = echo
	root.push_input(event)


func _poll_key(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)
	# Accumulated input otherwise may not be visible until the next frame.
	Input.flush_buffered_events()


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
