extends SceneTree

const RecordsStore = preload("res://src/storm_records.gd")
const BLACK_TIDE := "black-tide"
const NEEDLE_BANK := "needle-bank"
const CROSS_CURRENT := "cross-current"

var _root: String
var _failures := 0


func _init() -> void:
	_root = ProjectSettings.globalize_path("res://.testdata/records-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_recursive_absolute(_root) != OK:
		push_error("Cannot create isolated records test directory")
		quit(1)
		return
	_test_ranking_and_roundtrip()
	_test_invalid_reports()
	_test_malformed_files()
	_test_backup_recovery()
	_test_storage_failure()
	_test_expansion_isolation()
	for name in DirAccess.get_files_at(_root):
		_check(DirAccess.remove_absolute(_root.path_join(name)) == OK, "remove test fixture " + name)
	_check(DirAccess.remove_absolute(_root) == OK, "remove isolated records test directory")
	if _failures == 0:
		print("PASS stormline records: validation, roundtrip, ranking, recovery and storage failure")
	quit(0 if _failures == 0 else 1)


func _test_ranking_and_roundtrip() -> void:
	var path := _root.path_join("ranking.json")
	var store := RecordsStore.new(path)
	var stale := RecordsStore.new(path)
	_check(store.records.is_empty(), "missing store loads empty")
	var first := _report(8400, 85.123456789)
	var with_metadata := first.duplicate()
	with_metadata["extra"] = {"drop": true}
	_check(store.record(BLACK_TIDE, with_metadata) == RecordsStore.NEW_BEST, "first best saves")
	with_metadata["score"] = 1
	var reloaded := RecordsStore.new(path)
	_check(reloaded.records.get(BLACK_TIDE, {}) == first, "roundtrip preserves all and only approved fields")
	_check(reloaded.records.get(BLACK_TIDE, {}).get("score") is int, "score reloads as int")
	_check(reloaded.records.get(BLACK_TIDE, {}).get("time") is float, "time reloads as float")
	var bytes_before := FileAccess.get_file_as_bytes(path)
	_check(store.record(BLACK_TIDE, _report(8399, 20.0)) == RecordsStore.EXISTING_BEST, "faster lower score cannot downgrade")
	_check(stale.record(BLACK_TIDE, _report(7000, 20.0)) == RecordsStore.EXISTING_BEST, "stale store cannot downgrade")
	_check(reloaded.record(BLACK_TIDE, first) == RecordsStore.EXISTING_BEST, "identical score and time do not rewrite")
	_check(store.record(BLACK_TIDE, _report(8400, 100.0)) == RecordsStore.EXISTING_BEST, "slower tied score does not replace")
	_check(FileAccess.get_file_as_bytes(path) == bytes_before, "non-improvements do not write to disk")
	var faster := _report(8400, 84.5)
	_check(store.record(BLACK_TIDE, faster) == RecordsStore.NEW_BEST, "faster tied score replaces")
	_check(RecordsStore.new(path).records.get(BLACK_TIDE, {}) == faster, "faster tie persists")
	var higher := _report(10000, 220.0)
	var needle := {"score": 0, "time": 110.0, "hull": 0.0, "peak_tension": 1.5, "grade": "C"}
	_check(store.record(BLACK_TIDE, higher) == RecordsStore.NEW_BEST, "higher score replaces even if slower")
	_check(stale.record(NEEDLE_BANK, needle) == RecordsStore.NEW_BEST, "second supported contract saves independently")
	_check(RecordsStore.new(path).records == {BLACK_TIDE: higher, NEEDLE_BANK: needle}, "both contracts survive reload")


func _test_invalid_reports() -> void:
	var path := _root.path_join("reports.json")
	var store := RecordsStore.new(path)
	_check(store.record("unknown", _report(6000, 50.0)) == RecordsStore.CANNOT_SAVE, "unknown contract rejected")
	var invalid := {
		"score": [-1, 10001, 12.0, true, "6000", null],
		"time": [0.0, -0.1, 220.001, 12, INF, NAN],
		"hull": [-0.01, 100.01, 30, -INF, NAN],
		"peak_tension": [-0.01, 1.51, 1, INF, NAN],
		"grade": ["D", "s", 1, null],
	}
	for field: String in invalid:
		var missing := _report(6000, 50.0)
		missing.erase(field)
		_check(store.record(BLACK_TIDE, missing) == RecordsStore.CANNOT_SAVE, "missing " + field + " rejected")
		for value: Variant in invalid[field]:
			var bad := _report(6000, 50.0)
			bad[field] = value
			_check(store.record(BLACK_TIDE, bad) == RecordsStore.CANNOT_SAVE, "invalid %s (%s) rejected" % [field, value])
	_check(store.records.is_empty() and not FileAccess.file_exists(path), "invalid reports leave memory and disk unchanged")


func _test_malformed_files() -> void:
	var path := _root.path_join("invalid.json")
	var sample := JSON.stringify(_report(6000, 50.0))
	var bad_files := {
		"truncated": "{\"version\":1,\"records\":",
		"wrong version": '{"version":2,"records":{"black-tide":%s}}' % sample,
		"string version": '{"version":"1","records":{"black-tide":%s}}' % sample,
		"trailing comma": '{"version":1,"records":{"black-tide":%s},}' % sample,
		"trailing data": '{"version":1,"records":{"black-tide":%s}} {}' % sample,
		"leading zero": '{"version":01,"records":{"black-tide":%s}}' % sample,
		"oversized": ('{"version":1,"records":{"black-tide":%s}}' % sample) + " ".repeat(4096),
		"fractional score": '{"version":1,"records":{"black-tide":%s}}' % sample.replace("6000", "6000.5"),
		"nonfinite time": '{"version":1,"records":{"black-tide":%s}}' % sample.replace("50", "1e309"),
		"unknown id": '{"version":1,"records":{"other":%s}}' % sample,
		"invalid entry alongside valid one": '{"version":1,"records":{"black-tide":%s,"needle-bank":{}}}' % sample,
	}
	for scenario: String in bad_files:
		var content: String = bad_files[scenario]
		_check(_write(path, content), "write " + scenario + " fixture")
		_check(RecordsStore.new(path).records.is_empty(), "reject " + scenario)
		_check(FileAccess.get_file_as_string(path) == content, "reading leaves " + scenario + " unchanged")
	var corrupt := "{broken file"
	_check(_write(path, corrupt), "write damaged primary")
	var store := RecordsStore.new(path)
	var first := _report(6000, 50.0)
	_check(store.record(BLACK_TIDE, first) == RecordsStore.NEW_BEST, "write recovers from corrupt primary")
	_check(RecordsStore.new(path).records.get(BLACK_TIDE, {}) == first, "recovered primary reloads")
	var archived := DirAccess.get_files_at(_root)
	var preserved := false
	for name in archived:
		if name.begins_with("invalid.json.corrupt-"):
			preserved = FileAccess.get_file_as_string(_root.path_join(name)) == corrupt
	_check(preserved, "preserve original corrupt contents")


func _test_backup_recovery() -> void:
	var path := _root.path_join("backup.json")
	var store := RecordsStore.new(path)
	var older := _report(6000, 50.0)
	_check(store.record(BLACK_TIDE, older) == RecordsStore.NEW_BEST, "write initial backup-test result")
	_check(store.record(BLACK_TIDE, _report(7000, 50.0)) == RecordsStore.NEW_BEST, "rotate previous verified file into backup")
	var backup_bytes := FileAccess.get_file_as_bytes(path + ".bak")
	_check(not backup_bytes.is_empty(), "verified backup exists")
	_check(_write(path, "["), "damage primary without touching backup")
	var recovered := RecordsStore.new(path)
	_check(recovered.records.get(BLACK_TIDE, {}) == older, "load verified backup when primary is corrupt")
	_check(recovered.record(BLACK_TIDE, _report(5900, 45.0)) == RecordsStore.EXISTING_BEST, "cannot downgrade a recovered result")
	_check(recovered.record(NEEDLE_BANK, _report(5500, 75.0)) == RecordsStore.NEW_BEST, "save another contract alongside recovered result")
	_check(RecordsStore.new(path).records.get(BLACK_TIDE, {}) == older, "recovered result persists again")
	_check(FileAccess.get_file_as_bytes(path + ".bak") == backup_bytes, "recovery does not overwrite verified backup with corrupt input")


func _test_storage_failure() -> void:
	var unavailable := _root.path_join("missing-parent/best.json")
	var blocked := RecordsStore.new(unavailable)
	_check(blocked.record(BLACK_TIDE, _report(6000, 50.0)) == RecordsStore.CANNOT_SAVE, "cannot stage in a missing parent directory")
	_check(blocked.records.is_empty() and not FileAccess.file_exists(unavailable), "failed first write leaves no record")
	var path := _root.path_join("blocked-rotation.json")
	var store := RecordsStore.new(path)
	var older := _report(6000, 50.0)
	_check(store.record(BLACK_TIDE, older) == RecordsStore.NEW_BEST, "seed result before storage failure")
	var original := FileAccess.get_file_as_bytes(path)
	_check(DirAccess.make_dir_absolute(path + ".bak") == OK, "block backup rotation with a directory")
	_check(store.record(BLACK_TIDE, _report(7000, 50.0)) == RecordsStore.CANNOT_SAVE, "failed rotation reports cannot save")
	_check(store.records.get(BLACK_TIDE, {}) == older, "failed replacement leaves memory unchanged")
	_check(FileAccess.get_file_as_bytes(path) == original, "failed replacement preserves bytes of previous verified record")
	_check(RecordsStore.new(path).records.get(BLACK_TIDE, {}) == older, "previous best reloads after failure")
	_check(DirAccess.remove_absolute(path + ".bak") == OK, "remove rotation blocker")


func _test_expansion_isolation() -> void:
	var path := _root.path_join("v1.json")
	var expansion := path + ".expansion.json"
	# Pre-expansion envelope as written/read by the v0.1.1 game.
	var first := _report(8400, 85.5)
	var second := _report(7200, 122.0)
	var prior := JSON.stringify({"version": 1, "records": {BLACK_TIDE: first, NEEDLE_BANK: second}})
	_check(_write(path, prior), "seed two-route v1 store")
	_check(_write(path + ".bak", prior), "seed original verified backup")
	var store := RecordsStore.new(path)
	var stale := RecordsStore.new(path)
	_check(store.records == {BLACK_TIDE: first, NEEDLE_BANK: second}, "two existing records load unchanged")
	var third := _report(7550, 153.5)
	_check(store.record(CROSS_CURRENT, third) == RecordsStore.NEW_BEST, "expansion record saves")
	_check(FileAccess.get_file_as_string(path) == prior and FileAccess.get_file_as_string(path + ".bak") == prior,
		"expansion save never rewrites either original v1 file")
	_check(RecordsStore.new(path).records == {BLACK_TIDE: first, NEEDLE_BANK: second, CROSS_CURRENT: third},
		"original and expansion results reload together")
	_check(stale.record(CROSS_CURRENT, _report(4000, 50.0)) == RecordsStore.EXISTING_BEST,
		"stale writer cannot downgrade an expansion best")
	var faster := _report(7550, 151.0)
	_check(store.record(CROSS_CURRENT, faster) == RecordsStore.NEW_BEST, "expansion tie breaks by time")
	var expansion_bytes := FileAccess.get_file_as_bytes(expansion)
	var improved := _report(8500, 93.5)
	_check(store.record(BLACK_TIDE, improved) == RecordsStore.NEW_BEST, "v1 contract still writes normally")
	var legacy_envelope: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	_check(legacy_envelope.version == 1 and legacy_envelope.records.size() == 2
		and not legacy_envelope.records.has(CROSS_CURRENT), "old readers still see a two-id v1 envelope")
	_check(FileAccess.get_file_as_bytes(expansion) == expansion_bytes, "v1 update cannot rewrite expansion")
	_check(_write(expansion, "{"), "damage only the expansion primary")
	_check(RecordsStore.new(path).records == {BLACK_TIDE: improved, NEEDLE_BANK: second, CROSS_CURRENT: third},
		"expansion backup recovery leaves original bests intact")


func _report(score: int, elapsed: float) -> Dictionary:
	return {"score": score, "time": elapsed, "hull": 100.0, "peak_tension": 0.75, "grade": "A"}


func _write(path: String, text: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(text)
	file.close()
	return true


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures += 1
		push_error("FAIL: " + message)
