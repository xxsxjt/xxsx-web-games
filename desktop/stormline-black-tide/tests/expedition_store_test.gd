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
	_oversized_recovery()
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
	_check(_bytes(_root + "/restore-cas.json") == "different bad".to_utf8_buffer(), "stale restore leaves changed primary untouched")


func _oversized_recovery() -> void:
	var path := _root + "/oversized.json"
	var legacy_store := Store.new(path)
	var legacy := State.new_campaign()
	var initialized := legacy_store.save_state(legacy, -1)
	var offer_id: String = State.offers(legacy)[0].id
	var active: Dictionary = State.act(legacy, "launch", {"offer_id": offer_id}).state
	var departed := legacy_store.save_state(active, 0)
	var safely_rescued: Dictionary = State.act(active, "recover_interrupted").state
	var returned := legacy_store.save_state(safely_rescued, 1)
	_check(initialized.ok and departed.ok and returned.ok and not active.has("damage_control"),
		"oversized recovery fixture has legacy active backup after a real interrupted return")
	var backup := _bytes(path + ".bak")
	var oversized := PackedByteArray()
	oversized.resize(Store.MAX_BYTES + 1)
	oversized.fill(0xFF)
	_write(path, oversized)
	var store := Store.new(path)
	var loaded := store.load_state()
	_check(not loaded.ok and loaded.exists and loaded.backup_available, "bounded oversized primary reports recoverable backup")
	var restored := store.restore_backup()
	var archive := path + ".corrupt-" + Store._hash(oversized).substr(0, 12)
	_check(restored.ok and restored.state == active and not restored.state.has("damage_control"),
		"explicit oversized recovery restores exact legacy-shaped active backup")
	_check(_bytes(archive) == oversized and _bytes(path) == backup and _bytes(path + ".bak") == backup,
		"oversized invalid primary quarantined exactly and backup restored byte-for-byte")
	var rescue := State.act(restored.state, "recover_interrupted")
	_check(rescue.ok and rescue.state.revision == restored.state.revision + 1
		and rescue.state.hull == restored.state.active.hull - State.INTERRUPTED_HULL_LOSS
		and rescue.state.battery == restored.state.active.battery - State.INTERRUPTED_BATTERY_LOSS
		and rescue.state.pressure == restored.state.pressure + State.INTERRUPTED_PRESSURE
		and rescue.state.credits == restored.state.credits and not rescue.state.has("damage_control"),
		"restored active legacy voyage retains one-time interruption rescue costs, no refund or extension")
	_check(not Store.new(path).restore_backup().ok, "oversized recovery obeys valid-main no-rollback rule")

	var stale_path := _root + "/oversized-stale.json"
	var stale_store := Store.new(stale_path)
	var stale_initial := State.new_campaign()
	var stale_next: Dictionary = State.act(stale_initial, "buy", {"module_id": "sonar"}).state
	_check(stale_store.save_state(stale_initial, -1).ok and stale_store.save_state(stale_next, 0).ok,
		"oversized stale CAS fixture has valid backup")
	var stale_bytes := PackedByteArray()
	stale_bytes.resize(Store.MAX_BYTES + 7)
	stale_bytes.fill(0xFE)
	_write(stale_path, stale_bytes)
	var stale_reader := Store.new(stale_path)
	_check(not stale_reader.load_state().ok, "oversized stale CAS snapshot observed")
	var changed_bytes := stale_bytes.duplicate()
	changed_bytes[changed_bytes.size() - 1] = 0xFD
	_write(stale_path, changed_bytes)
	var stale_backup := _bytes(stale_path + ".bak")
	var conflict := stale_reader.restore_backup()
	_check(not conflict.ok and conflict.conflict, "digest CAS rejects changed oversized primary")
	_check(_bytes(stale_path) == changed_bytes and _bytes(stale_path + ".bak") == stale_backup
		and not FileAccess.file_exists(stale_path + ".corrupt-" + Store._hash(stale_bytes).substr(0, 12)),
		"stale oversized conflict performs no archive, primary, or backup writes")

	var archive_failure_path := _root + "/oversized-archive-failure.json"
	var archive_failure_store := Store.new(archive_failure_path)
	var archive_failure_initial := State.new_campaign()
	var archive_failure_next: Dictionary = State.act(archive_failure_initial, "buy", {"module_id": "sonar"}).state
	_check(archive_failure_store.save_state(archive_failure_initial, -1).ok
		and archive_failure_store.save_state(archive_failure_next, 0).ok, "archive failure fixture has valid backup")
	var archive_failure_bytes := PackedByteArray()
	archive_failure_bytes.resize(Store.MAX_BYTES + 3)
	archive_failure_bytes.fill(0xFC)
	_write(archive_failure_path, archive_failure_bytes)
	var archive_failure_store_read := Store.new(archive_failure_path)
	archive_failure_store_read.load_state()
	var blocked_archive := archive_failure_path + ".corrupt-" + Store._hash(archive_failure_bytes).substr(0, 12)
	DirAccess.make_dir_absolute(ProjectSettings.globalize_path(blocked_archive))
	var backup_before_failure := _bytes(archive_failure_path + ".bak")
	var failed_archive_restore := archive_failure_store_read.restore_backup()
	_check(not failed_archive_restore.ok and _bytes(archive_failure_path) == archive_failure_bytes
		and _bytes(archive_failure_path + ".bak") == backup_before_failure,
		"archive write failure keeps oversized primary and backup unchanged")
	_check(DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(blocked_archive)), "archive obstruction remains untouched")

	var above_cap_path := _root + "/above-recovery-cap.json"
	var above_cap_store := Store.new(above_cap_path)
	var above_cap_initial := State.new_campaign()
	var above_cap_next: Dictionary = State.act(above_cap_initial, "buy", {"module_id": "sonar"}).state
	_check(above_cap_store.save_state(above_cap_initial, -1).ok
		and above_cap_store.save_state(above_cap_next, 0).ok, "above-cap fixture has valid backup")
	var above_cap := PackedByteArray()
	above_cap.resize(Store.RECOVERY_MAX_BYTES + 1)
	above_cap.fill(0xFB)
	_write(above_cap_path, above_cap)
	var above_cap_reader := Store.new(above_cap_path)
	var above_cap_load := above_cap_reader.load_state()
	var above_cap_restore := above_cap_reader.restore_backup()
	_check(not above_cap_load.ok and above_cap_load.backup_available and not above_cap_restore.ok,
		"primary above recovery cap fails closed despite valid backup")
	_check(_bytes(above_cap_path) == above_cap and _bytes(above_cap_path + ".bak").size() > 0
		and not FileAccess.file_exists(above_cap_path + ".corrupt-" + Store._hash(above_cap).substr(0, 12)),
		"above-cap restore performs no primary, backup, or quarantine writes")


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
