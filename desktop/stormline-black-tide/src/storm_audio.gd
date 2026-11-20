extends Node

## Generate bounded PCM clips once; the per-frame presenter only controls playback.
const MIX_RATE := 22050
const FULL_SPEED := 18.5 # m/s, the simulation's tug speed cap.
const WARNING_TENSION := 0.78
const OVERLOAD_RELEASE := 0.96
const SILENT_DB := -80.0

var _window: Window
var _seen_event := 0
var _motor: AudioStreamPlayer
var _sea: AudioStreamPlayer
var _alarm: AudioStreamPlayer
var _cue: AudioStreamPlayer
var _cues: Dictionary = {}
var _terminal_cue := false
var _alarm_wait := 0.0
var _overloaded := false


func _enter_tree() -> void:
	if DisplayServer.get_name() == "headless":
		return
	process_mode = Node.PROCESS_MODE_PAUSABLE
	_window = get_window()
	_window.focus_exited.connect(_silence)


func _exit_tree() -> void:
	if is_instance_valid(_window):
		_window.focus_exited.disconnect(_silence)
	_window = null
	_silence()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_PAUSED:
		_silence()


func present(view: Dictionary, delta: float) -> void:
	# Advance even when silent, so a muted or background event won't be replayed.
	var event_id := int(view.get("event_id", 0))
	var is_new := event_id > _seen_event
	var restarted := event_id < _seen_event
	_seen_event = event_id
	if _window == null:
		return
	var screen := String(view.get("screen", "briefing"))
	if restarted or bool(view.get("muted", false)) or get_tree().paused or not _window.has_focus():
		_silence()
		return
	if screen != "running" and screen != "debrief":
		_silence()
		return

	var kind := String(view.get("event_kind", "")) if is_new else ""
	var terminal := _is_terminal(kind, String(view.get("phase", "")))
	if screen == "running":
		_ensure_audio()
		_drive(view, clampf(delta, 0.0, 0.1))
	else:
		# Arrival and terminal failures may first appear on the debrief frame.
		_stop_bed()
		if _cue != null and _cue.playing and not _terminal_cue:
			_cue.stop()
		if not terminal:
			return
		_ensure_audio()
	if not kind.is_empty():
		_play_cue(kind, terminal)


func _drive(view: Dictionary, dt: float) -> void:
	var velocity: Vector2 = view.get("velocity", Vector2.ZERO)
	var speed := clampf(velocity.length() / FULL_SPEED, 0.0, 1.0)
	var throttle := clampf(absf(float(view.get("throttle", 0.0))), 0.0, 1.0)
	var storm := clampf(float(view.get("storm", 0.0)), 0.0, 1.0)
	var blend := 1.0 - exp(-8.0 * dt)
	_drive_loop(_motor, 0.94 + 0.87 * speed + 0.17 * throttle, 0.046 + 0.074 * speed + 0.02 * throttle, blend)
	_drive_loop(_sea, lerpf(0.83, 1.18, storm), lerpf(0.08, 0.32, storm), blend)
	_update_alarm(clampf(float(view.get("tension", 0.0)), 0.0, 1.5), dt)


func _drive_loop(player: AudioStreamPlayer, pitch: float, gain: float, blend: float) -> void:
	if not player.playing:
		player.volume_db = SILENT_DB
		player.pitch_scale = pitch
		player.play()
	player.pitch_scale = lerpf(player.pitch_scale, pitch, blend)
	player.volume_db = lerpf(player.volume_db, linear_to_db(gain), blend)


func _update_alarm(tension: float, dt: float) -> void:
	_alarm_wait = maxf(0.0, _alarm_wait - dt)
	if tension >= 1.0 and not _overloaded:
		_overloaded = true
		_alarm_wait = 0.0
	elif tension < OVERLOAD_RELEASE:
		_overloaded = false
	if tension <= WARNING_TENSION or _alarm_wait > 0.0 or _alarm.playing:
		return

	# Escalate pitch and cadence at the limit, with hysteresis on release.
	if _overloaded:
		var excess := clampf((tension - 1.0) / 0.5, 0.0, 1.0)
		_alarm.pitch_scale = lerpf(1.27, 1.53, excess)
		_alarm.volume_db = linear_to_db(lerpf(0.125, 0.16, excess))
		_alarm_wait = lerpf(0.39, 0.25, excess)
	else:
		var near_limit := inverse_lerp(WARNING_TENSION, 1.0, tension)
		_alarm.pitch_scale = lerpf(0.89, 1.03, near_limit)
		_alarm.volume_db = linear_to_db(lerpf(0.054, 0.1, near_limit))
		_alarm_wait = lerpf(0.83, 0.50, near_limit)
	_alarm.play()


func _is_terminal(kind: String, phase: String) -> bool:
	match kind:
		"docked", "snap", "timeout", "hull_lost", "cargo_lost", "power_lost":
			return true
		"collision":
			return phase == "failed"
	return false


func _play_cue(kind: String, terminal: bool) -> void:
	var clip := _cues.get(kind) as AudioStreamWAV
	if clip == null:
		return
	var minor := not terminal and (kind == "collision" or kind == "denied")
	# Scrapes and refused actions won't interrupt a critical mission cue.
	if _cue.playing and (minor or _cue.stream == clip):
		return
	_terminal_cue = terminal
	_cue.stream = clip
	_cue.volume_db = linear_to_db(0.15 if minor else 0.22)
	_cue.play()


func _stop_bed() -> void:
	if _motor != null and _motor.playing:
		_motor.stop()
	if _sea != null and _sea.playing:
		_sea.stop()
	if _alarm != null and _alarm.playing:
		_alarm.stop()
	_alarm_wait = 0.0
	_overloaded = false


func _silence() -> void:
	_stop_bed()
	if _cue != null and _cue.playing:
		_cue.stop()
	_terminal_cue = false


func _ensure_audio() -> void:
	if _motor != null:
		return
	_motor = _make_player("Motor", _make_motor())
	_sea = _make_player("Sea", _make_sea())
	_alarm = _make_player("TowLoadAlarm", _make_notes([Vector3(422, 398, 0.16)], 0.26))
	_cue = _make_player("MissionCues", null)
	# Double sonar ping, weighted latch, sharp cable report, and rising harbor chime.
	_cues = {
		"scan_locked": _make_notes([Vector3(660, 720, 0.105), Vector3(0, 0, 0.040), Vector3(880, 845, 0.19)], 0.12),
		"tow_attached": _make_notes([Vector3(440, 310, 0.068), Vector3(0, 0, 0.024), Vector3(254, 157, 0.22)], 0.36, 0.24),
		"snap": _make_notes([Vector3(1120, 330, 0.115), Vector3(220, 82, 0.28)], 0.47, 0.58),
		"docked": _make_notes([Vector3(523, 523, 0.11), Vector3(659, 659, 0.11), Vector3(784, 784, 0.11), Vector3(1047, 1047, 0.28)], 0.15),
		"collision": _make_notes([Vector3(196, 55, 0.23)], 0.33, 0.46),
		"denied": _make_notes([Vector3(341, 326, 0.085), Vector3(0, 0, 0.037), Vector3(252, 230, 0.14)], 0.31),
		"timeout": _make_notes([Vector3(294, 294, 0.16), Vector3(220, 220, 0.22)], 0.17),
		"power_lost": _make_notes([Vector3(277, 138, 0.38)], 0.30),
	}
	# Alternate model labels for structural losses use the same impact cue.
	_cues["hull_lost"] = _cues["collision"]
	_cues["cargo_lost"] = _cues["collision"]


func _make_player(player_name: String, clip: AudioStreamWAV) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.name = player_name
	player.stream = clip
	player.volume_db = SILENT_DB
	add_child(player)
	return player


func _make_motor() -> AudioStreamWAV:
	# Integral oscillator and flutter cycles make this loop phase-continuous.
	var frames := MIX_RATE >> 1
	var pcm := PackedByteArray()
	pcm.resize(frames * 2)
	for i in range(frames):
		var turn := TAU * float(i) / float(frames)
		var angle := turn * 24.0
		var hum := sin(angle) * 0.52 + sin(angle * 2.0) * 0.25 + sin(angle * 3.0) * 0.16 + sin(angle * 5.0) * 0.07
		var flutter := 0.83 + 0.17 * sin(turn * 6.0)
		pcm.encode_s16(i * 2, roundi(hum * flutter * 32767.0))
	return _make_wav(pcm, true)


func _make_sea() -> AudioStreamWAV:
	var frames := 3 * MIX_RATE
	var seam := MIX_RATE >> 4
	var pcm := PackedByteArray()
	pcm.resize((frames + seam) * 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7391
	var low := 0.0
	var mid := 0.0
	for i in range(frames + seam):
		var noise := rng.randf_range(-1.0, 1.0)
		low = lerpf(low, noise, 0.034)
		mid = lerpf(mid, noise, 0.25)
		var angle := TAU * float(i) / float(frames)
		var swell := 0.59 + 0.23 * sin(angle) + 0.12 * sin(2.0 * angle + 1.1)
		var hiss := 0.7 * mid + 0.3 * noise - low
		var wash := 0.75 * low * swell + (0.14 + 0.23 * swell) * hiss
		pcm.encode_s16(i * 2, roundi(wash * 32767.0))
	# Blend extra tail samples into the head to make the noise loop seamless.
	for i in range(seam):
		var weight := smoothstep(0.0, float(seam - 1), float(i))
		var sample := lerpf(pcm.decode_s16((frames + i) * 2), pcm.decode_s16(i * 2), weight)
		pcm.encode_s16(i * 2, roundi(sample))
	pcm.resize(frames * 2)
	return _make_wav(pcm, true)


func _make_notes(notes: Array[Vector3], harmonics: float, grit: float = 0.0) -> AudioStreamWAV:
	# Each note is (start Hz, end Hz, duration seconds); zero Hz is a rest.
	var frames := 0
	for note in notes:
		frames += roundi(note.z * MIX_RATE)
	var pcm := PackedByteArray()
	pcm.resize(frames * 2)
	pcm.fill(0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 22839
	var cursor := 0
	for note in notes:
		var count := roundi(note.z * MIX_RATE)
		if note.x > 0.0:
			var angle := 0.0
			var noise_body := 0.0
			for i in range(count):
				var progress := float(i) / float(count - 1)
				var tail := 1.0 - progress
				angle += TAU * lerpf(note.x, note.y, progress) / MIX_RATE
				var overtone := 0.72 * sin(angle * 2.0) + 0.28 * sin(angle * 3.0)
				var tone := lerpf(sin(angle), overtone, harmonics)
				if grit > 0.0:
					var noise := rng.randf_range(-1.0, 1.0)
					noise_body = lerpf(noise_body, noise, 0.27)
					tone = lerpf(tone, noise_body * 0.7 + noise * 0.3, grit * tail)
				var envelope := smoothstep(0.0, 0.08, progress) * tail * tail
				pcm.encode_s16((cursor + i) * 2, roundi(tone * envelope * 32767.0))
		cursor += count
	return _make_wav(pcm)


func _make_wav(pcm: PackedByteArray, looped: bool = false) -> AudioStreamWAV:
	var clip := AudioStreamWAV.new()
	clip.format = AudioStreamWAV.FORMAT_16_BITS
	clip.mix_rate = MIX_RATE
	clip.data = pcm
	if looped:
		clip.loop_mode = AudioStreamWAV.LOOP_FORWARD
		clip.loop_end = pcm.size() >> 1
	return clip
