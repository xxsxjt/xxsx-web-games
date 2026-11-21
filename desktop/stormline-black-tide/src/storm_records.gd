extends RefCounted

const VERSION := 1
const MAX_FILE_BYTES := 4096
const Sim = preload("res://src/storm_sim.gd")
# Keep the original v1 file readable by builds that reject unknown contract ids.
const ORIGINAL_IDS := ["black-tide", "needle-bank"]
const NEW_BEST := "已保存新的本机最佳成绩"
const EXISTING_BEST := "保留原有本机最佳成绩"
const CANNOT_SAVE := "无法保存本机最佳成绩"

# Godot's JSON parser accepts some non-JSON spellings, including trailing commas.
# Check tokens here and leave object/array syntax and conversion to JSON.parse().
const JSON_TOKENS := (
	r"\A(?:[ \t\r\n{}\[\]:]|,(?![ \t\r\n]*[}\]])"
	+ r'|"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"'
	+ r"|(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)"
	+ r"(?=[ \t\r\n,}\]]|\z))*\z"
)

var records: Dictionary = {}
var _path: String
var _expansion_path: String
var _json_tokens := RegEx.create_from_string(JSON_TOKENS)


func _init(file_path: String = "user://best-contracts.json") -> void:
	_path = ProjectSettings.globalize_path(file_path)
	if _path.is_empty():
		return
	_expansion_path = _path + ".expansion.json"
	for original: bool in [true, false]:
		var path := _path if original else _expansion_path
		var loaded: Variant = _read_records(path, original)
		_merge_loaded(loaded if loaded != null else _read_records(path + ".bak", original))


# Call only for successfully delivered contracts. The game uses one writer.
func record(contract_id: String, report: Dictionary) -> String:
	if not Sim.CONTRACTS.has(contract_id):
		return CANNOT_SAVE
	var candidate := _validated_report(report, false)
	if candidate.is_empty():
		return CANNOT_SAVE

	# Refresh before ranking so a stale instance cannot replace a newer result.
	var original := contract_id in ORIGINAL_IDS
	var path := _path if original else _expansion_path
	if path.is_empty():
		return CANNOT_SAVE
	var primary: Variant = _read_records(path, original)
	_merge_loaded(primary if primary != null else _read_records(path + ".bak", original))
	if records.has(contract_id) and not _is_better(candidate, records[contract_id]):
		return EXISTING_BEST

	var next := {}
	for id: String in records:
		if _accepts_id(id, original):
			next[id] = records[id]
	next[contract_id] = candidate
	if not _save(path, next, original, primary != null):
		return CANNOT_SAVE
	records[contract_id] = candidate
	return NEW_BEST


static func _is_better(candidate: Dictionary, prior: Dictionary) -> bool:
	return candidate.score > prior.score or (candidate.score == prior.score and candidate.time < prior.time)


func _merge_loaded(loaded: Variant) -> void:
	if loaded == null:
		return
	for id: String in loaded:
		if not records.has(id) or _is_better(loaded[id], records[id]):
			records[id] = loaded[id]


static func _validated_report(report: Dictionary, from_json: bool) -> Dictionary:
	var score: Variant = report.get("score")
	var elapsed: Variant = report.get("time")
	var hull: Variant = report.get("hull")
	var tension: Variant = report.get("peak_tension")
	var grade: Variant = report.get("grade")
	# JSON numbers come back as floats even when written as integers.
	if not (score is int or (from_json and score is float and is_finite(score) and score == floor(score))):
		return {}
	if score < 0 or score > 10000:
		return {}
	if not _bounded_float(elapsed, 0.0, 220.0) or elapsed <= 0.0:
		return {}
	if not _bounded_float(hull, 0.0, 100.0) or not _bounded_float(tension, 0.0, 1.5):
		return {}
	if not grade is String or grade not in ["S", "A", "B", "C"]:
		return {}
	return {"score": int(score), "time": elapsed, "hull": hull, "peak_tension": tension, "grade": grade}


static func _bounded_float(value: Variant, minimum: float, maximum: float) -> bool:
	return value is float and is_finite(value) and value >= minimum and value <= maximum


static func _accepts_id(id: String, original: bool) -> bool:
	return Sim.CONTRACTS.has(id) and (id in ORIGINAL_IDS) == original


# Null means missing or unverified; an empty dictionary is a valid store.
func _read_records(path: String, original: bool, expected: PackedByteArray = PackedByteArray()) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var length := file.get_length()
	if length <= 0 or length > MAX_FILE_BYTES:
		return null
	var bytes := file.get_buffer(length)
	if bytes.size() != length or (not expected.is_empty() and bytes != expected):
		return null
	var text := bytes.get_string_from_utf8()
	if text.to_utf8_buffer() != bytes or _json_tokens.search(text) == null:
		return null
	var json := JSON.new()
	if json.parse(text) != OK or not json.data is Dictionary:
		return null
	var envelope: Dictionary = json.data
	var version: Variant = envelope.get("version")
	var entries: Variant = envelope.get("records")
	if envelope.size() != 2 or not (version is float or version is int) or version != VERSION or not entries is Dictionary:
		return null

	var loaded := {}
	for id: String in entries:
		var entry: Variant = entries[id]
		if not _accepts_id(id, original) or not entry is Dictionary or entry.size() != 5:
			return null
		var clean := _validated_report(entry, true)
		if clean.is_empty():
			return null
		loaded[id] = clean
	return loaded


func _save(path: String, next: Dictionary, original: bool, verified_primary: bool) -> bool:
	if path.is_empty() or DirAccess.dir_exists_absolute(path):
		return false
	var stage := "%s.%s.tmp" % [path, _file_suffix()]
	var bytes := JSON.stringify({"version": VERSION, "records": next}, "", true, true).to_utf8_buffer()
	var file := FileAccess.open(stage, FileAccess.WRITE)
	if file == null:
		return false
	file.store_buffer(bytes)
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK or _read_records(stage, original, bytes) == null:
		DirAccess.remove_absolute(stage)
		return false

	# Never replace the verified backup with corrupt input. Archive that input instead.
	var moved_to := ""
	if FileAccess.file_exists(path):
		if verified_primary:
			moved_to = path + ".bak"
		else:
			moved_to = path + ".corrupt-" + _file_suffix()
		if DirAccess.rename_absolute(path, moved_to) != OK:
			DirAccess.remove_absolute(stage)
			return false

	if DirAccess.rename_absolute(stage, path) == OK:
		return true
	# If restoring also fails, the older verified data still lives at .bak.
	if not moved_to.is_empty() and not FileAccess.file_exists(path):
		DirAccess.rename_absolute(moved_to, path)
	DirAccess.remove_absolute(stage)
	return false


static func _file_suffix() -> String:
	return "%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
