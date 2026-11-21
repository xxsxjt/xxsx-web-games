extends SceneTree
## Real file I/O fixtures ONLY beneath candidate .testdata; no user:// or old scores.

const State = preload("res://src/expedition_state.gd")
const Store = preload("res://src/expedition_store.gd")
var _checks := 0
var _failures: Array = []
var _root := ""


func _init() -> void:
	_root = "res://.testdata/expedition-state-" + Crypto.new().generate_random_bytes(8).hex_encode()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_root))
	var path := _root + "/campaign.json"
	var store := Store.new(path)
	var empty := store.load_state()
	_check(not empty.ok and not empty.exists and not empty.conflict, "missing explicit, no auto create")
	var s := State.new_campaign()
	_check(not store.save_state(s, 0).ok, "initial expected -1 required")
	var saved := store.save_state(s, -1)
	_check(saved.ok and saved.state == s, "initial save and readback")
	_check(not store.save_state(s, -1).ok and not store.save_state(s, 0).ok, "repeat revision cannot overwrite")
	var reader := Store.new(path)
	_check(reader.load_state().state == s, "separate reader exact state")
	var buy := State.act(s, "buy", {"module_id": "sonar"})
	saved = store.save_state(buy.state, 0)
	_check(saved.ok and saved.state.revision == 1, "revision exactly +1 save")
	_check(FileAccess.file_exists(path + ".bak"), "previous valid bytes retained")
	var stale := reader.save_state(buy.state, 0)
	_check(not stale.ok and stale.conflict, "stale instance cannot overwrite actual newer bytes")
	var same_revision := _bytes(path)
	var altered: Dictionary = JSON.parse_string(same_revision.get_string_from_utf8())
	altered.state.credits = int(altered.state.credits) + 1
	_write(path, JSON.stringify(altered).to_utf8_buffer())
	var equipped := State.act(buy.state, "equip", {"module_id": "sonar"})
	_check(not store.save_state(equipped.state, 1).ok, "same revision different byte snapshot rejected")
	_write(path, same_revision)
	_check(store.load_state().ok, "read acknowledges restored actual bytes")
	var bad := PackedByteArray([0xFF, 0xFE, 0xC0, 0xAF])
	_write(path, bad)
	var corrupt := store.load_state()
	_check(not corrupt.ok and corrupt.exists and corrupt.backup_available, "strict UTF8 broken main reports valid backup")
	_check(not store.save_state(equipped.state, 1).ok and _bytes(path) == bad, "save refuses silently overwrite corrupt main")
	var recovered := store.restore_backup()
	_check(recovered.ok and recovered.state.revision == 0 and _bytes(path + ".bak") == _bytes(path), "explicit previous backup recovery")
	var archive_path := path + ".corrupt-" + Store._hash(bad).substr(0, 12)
	_check(FileAccess.file_exists(archive_path) and _bytes(archive_path) == bad, "bad main preserved verbatim")
	_check(not store.restore_backup().ok, "valid main cannot silently roll back")
	_bounded_and_invalid()
	_interrupted_and_restart()
	_write_failure()
	if _failures.is_empty():
		print("PASS expedition_store checks=%d fixture_root=%s" % [_checks, _root])
		quit(0)
	else:
		for failure in _failures:
			print("FAIL expedition_store: " + failure)
		quit(1)


func _bounded_and_invalid() -> void:
	var path := _root + "/invalid.json"
	var envelope := {"format": Store.FORMAT, "version": Store.VERSION, "state": State.new_campaign()}
	var cases: Array = ["{", "{}", "null", "[]", "{\"format\":\"other\",\"version\":1,\"state\":{}}"]
	for text in cases:
		_write(path, String(text).to_utf8_buffer())
		_check(not Store.new(path).load_state().ok, "bad json/envelope rejected")
	for mutation in ["version", "hull", "credits", "history", "path", "active"]:
		var value := envelope.duplicate(true)
		match mutation:
			"version": value.version = 99
			"hull": value.state.hull = -1
			"credits": value.state.credits = 1.5
			"history": value.state.history = [{"reward": 999}]
			"path": value.state.path = ["cross-current-recovery-high"]
			"active": value.state.active = {"token": "forged"}
		_write(path, JSON.stringify(value).to_utf8_buffer())
		_check(not Store.new(path).load_state().ok, "field boundary rejected: " + mutation)
	var bytes := PackedByteArray()
	bytes.resize(Store.MAX_BYTES + 1)
	bytes.fill(32)
	_write(path, bytes)
	_check(not Store.new(path).load_state().ok, "oversize bounded read rejected")
	_write(path, PackedByteArray())
	_check(not Store.new(path).load_state().ok, "empty archive rejected")
	for invalid in [PackedByteArray([0xED, 0xA0, 0x80]), PackedByteArray([0xF4, 0x90, 0x80, 0x80]), PackedByteArray([0xE2, 0x82])]:
		_write(path, invalid)
		_check(not Store.new(path).load_state().ok, "surrogate/out of range/truncated UTF8 rejected")
	_check(Store._utf8("中文远征".to_utf8_buffer()), "valid Chinese UTF8 accepted")
	var backup_stale := Store.new(_root + "/restore-cas.json")
	var first := State.new_campaign()
	_check(backup_stale.save_state(first, -1).ok, "recovery CAS fixture initial")
	var second: Dictionary = State.act(first, "buy", {"module_id": "sonar"}).state
	_check(backup_stale.save_state(second, 0).ok, "recovery CAS fixture backup")
	_write(_root + "/restore-cas.json", "bad".to_utf8_buffer())
	backup_stale.load_state()
	_write(_root + "/restore-cas.json", "different bad".to_utf8_buffer())
	_check(backup_stale.restore_backup().conflict, "stale bad-main restore rejected")


func _interrupted_and_restart() -> void:
	var path := _root + "/interrupted.json"
	var store := Store.new(path)
	var s := State.new_campaign()
	_check(store.save_state(s, -1).ok, "interrupted fixture init")
	s = State.act(s, "launch", {"offer_id": State.offers(s)[0].id}).state
	_check(store.save_state(s, 0).ok, "active paid deployment persisted before driving")
	var reopened := Store.new(path)
	var loaded := reopened.load_state()
	_check(loaded.ok and loaded.state.status == "active" and loaded.state.credits == s.credits, "reload does not refund launch")
	var recovered := State.act(loaded.state, "recover_interrupted")
	_check(recovered.ok and reopened.save_state(recovered.state, 1).ok, "interrupted return saved once")
	var again := Store.new(path).load_state()
	_check(again.ok and again.state.hull == 85 and again.state.battery == 80 and not State.act(again.state, "recover_interrupted").ok, "second startup no double damage or reward")
	var ended: Dictionary = State.act(again.state, "retreat").state
	_check(reopened.save_state(ended, 2).ok, "ended archive preserved")
	var fresh: Dictionary = State.act(ended, "restart").state
	_check(reopened.save_state(fresh, 3).ok, "restart same file CAS monotonic revision")
	var backup: Dictionary = JSON.parse_string(_bytes(path + ".bak").get_string_from_utf8())
	_check(backup.state.status == "retreated" and backup.state.campaign_id == ended.campaign_id and fresh.campaign_id != ended.campaign_id, "restart retains previous ended archive backup")


func _write_failure() -> void:
	var missing := Store.new(_root + "/nonexistent-parent/archive.json")
	_check(not missing.save_state(State.new_campaign(), -1).ok, "missing parent write failure not success")
	var directory_path := _root + "/is-directory"
	DirAccess.make_dir_absolute(ProjectSettings.globalize_path(directory_path))
	_check(not Store.new(directory_path).save_state(State.new_campaign(), -1).ok, "directory cannot masquerade as file")
	var path := _root + "/backup-obstructed.json"
	var store := Store.new(path)
	var s := State.new_campaign()
	_check(store.save_state(s, -1).ok, "obstructed backup initial fixture")
	var original := _bytes(path)
	DirAccess.make_dir_absolute(ProjectSettings.globalize_path(path + ".bak"))
	var next: Dictionary = State.act(s, "buy", {"module_id": "sonar"}).state
	_check(not store.save_state(next, 0).ok and _bytes(path) == original, "backup replacement failure preserves main, not fake success")


func _bytes(path: String) -> PackedByteArray:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return PackedByteArray()
	var result := file.get_buffer(file.get_length())
	file.close()
	return result


func _write(path: String, bytes: PackedByteArray) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		_check(false, "fixture write opened: " + path)
		return
	file.store_buffer(bytes)
	file.close()


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
