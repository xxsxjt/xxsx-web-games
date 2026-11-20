extends SceneTree
## Exercise PCM synthesis as data only: no players, speakers or desktop window.

const Audio = preload("res://src/storm_audio.gd")
var _checks := 0
var _failures := 0


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	var audio := Audio.new()
	var motor: AudioStreamWAV = audio._make_motor()
	var sea: AudioStreamWAV = audio._make_sea()
	_check_clip(motor, true, "motor")
	_check_clip(sea, true, "sea")
	_check(motor.data.size() == 22050, "engine loop lasts half a second")
	_check(sea.data.size() == 132300, "sea loop lasts three seconds")
	_check(sea.data == audio._make_sea().data, "sea synthesis is reproducible")
	var notes: Array[Vector3] = [Vector3(660, 720, 0.105), Vector3(0, 0, 0.04), Vector3(880, 845, 0.19)]
	var cue: AudioStreamWAV = audio._make_notes(notes, 0.12)
	_check_clip(cue, false, "sonar cue")
	var silence_start := roundi(notes[0].z * Audio.MIX_RATE) * 2
	var silence_end := silence_start + roundi(notes[1].z * Audio.MIX_RATE) * 2
	var rest_is_silent := true
	for offset in range(silence_start, silence_end, 2):
		rest_is_silent = rest_is_silent and cue.data.decode_s16(offset) == 0
	_check(rest_is_silent, "note rests contain zero PCM samples")
	notes = [Vector3(1120, 330, 0.115), Vector3(220, 82, 0.28)]
	_check_clip(audio._make_notes(notes, 0.47, 0.58), false, "cable snap cue")
	_check(audio.get_child_count() == 0, "PCM generation never allocates audio players")
	audio.free()
	print("Stormline PCM synthesis: %d checks, %d failures; no audio playback or listening test." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check_clip(clip: AudioStreamWAV, looped: bool, label: String) -> void:
	_check(clip.format == AudioStreamWAV.FORMAT_16_BITS and clip.mix_rate == 22050 and not clip.stereo, label + " has expected PCM format")
	_check(clip.data.size() > 0 and clip.data.size() % 2 == 0, label + " contains complete samples")
	var peak := 0
	for offset in range(0, clip.data.size(), 2):
		peak = maxi(peak, absi(clip.data.decode_s16(offset)))
	_check(peak > 100 and peak < 32767, label + " is nonempty without hard-clipped PCM")
	_check(clip.loop_mode == (AudioStreamWAV.LOOP_FORWARD if looped else AudioStreamWAV.LOOP_DISABLED), label + " loop mode is correct")
	if looped:
		_check(clip.loop_end * 2 == clip.data.size(), label + " loop boundary covers the complete PCM")


func _check(ok: bool, label: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + label)
