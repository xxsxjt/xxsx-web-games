extends RefCounted
## Explicit-path single campaign store. Byte CAS is not a cross-process lock.

const State = preload("res://src/expedition_state.gd")
const MAX_BYTES := 98304
const FORMAT := "stormline-expedition"
const VERSION := 1

var _path: String
var _observed := false
var _exists := false
var _digest := ""


func _init(path: String) -> void:
	_path = path


func load_state() -> Dictionary:
	var read := _read(_path)
	_observe(read)
	var backup := _read(_path + ".bak")
	if not read.exists:
		return _result(false, {}, "没有远征档案；可明确新建，不能假称已读取。", false, false, bool(backup.ok))
	if not read.ok:
		return _result(false, {}, read.message + (" 可明确恢复已验证备份；坏主档不会自动覆盖。" if backup.ok else " 无可用备份。"), true, false, bool(backup.ok))
	return _result(true, read.state, "已读取远征档案。", true, false, bool(backup.ok))


func save_state(state: Dictionary, expected_revision: int) -> Dictionary:
	if not State.validate(state):
		return _result(false, {}, "拒绝保存：远征状态无效。")
	var current := _read(_path)
	if not _observed:
		_observe(current)
	if not _same_observation(current):
		return _result(false, {}, "档案实际字节已改变，请重新读取；不会覆盖另一会话。", bool(current.exists), true)
	if current.exists:
		if not current.ok:
			return _result(false, {}, "主档损坏或不可读，禁止覆盖；请明确恢复备份。", true)
		if expected_revision != int(current.state.revision) or int(state.revision) != expected_revision + 1:
			return _result(false, {}, "修订号冲突：必须基于当前档案且恰好增加 1。", true, true)
	else:
		if expected_revision != -1 or state.revision != 0:
			return _result(false, {}, "无档只能以 expected_revision=-1 保存 revision=0 初始远征。", false, true)
		var initial := State.new_campaign(state.has("damage_control"))
		initial.campaign_id = state.campaign_id
		if state != initial:
			return _result(false, {}, "无档只允许创建未出航的新远征。")
	var bytes := _encode(state)
	if bytes.size() > MAX_BYTES:
		return _result(false, {}, "档案超过大小限制。", bool(current.exists))
	var temp := _path + ".tmp-" + Crypto.new().generate_random_bytes(6).hex_encode()
	var error := _write_checked(temp, bytes)
	if not error.is_empty():
		_remove(temp)
		return _result(false, {}, error, bool(current.exists))
	var staged := _read(temp)
	if not staged.ok or staged.digest != _hash(bytes):
		_remove(temp)
		return _result(false, {}, "临时档案读回验证失败；主档未替换。", bool(current.exists))
	if not _same_observation(_read(_path)):
		_remove(temp)
		return _result(false, {}, "写入期间检测到档案变化，已停止替换。", bool(current.exists), true)
	if current.exists:
		var backup_error := _replace_bytes(_path + ".bak", current.bytes)
		if not backup_error.is_empty():
			_remove(temp)
			return _result(false, {}, "无法保留上一份有效档案：" + backup_error, true)
	# Recheck after backup I/O too. A narrow race remains without an OS process lock.
	if not _same_observation(_read(_path)):
		_remove(temp)
		return _result(false, {}, "备份期间档案已变化，已停止替换。", bool(current.exists), true)
	var renamed := DirAccess.rename_absolute(_absolute(temp), _absolute(_path))
	if renamed != OK:
		_remove(temp)
		return _result(false, {}, "主档替换失败（错误 %d），未报告保存成功。" % renamed, bool(current.exists))
	var verified := _read(_path)
	if not verified.ok or verified.digest != staged.digest:
		return _result(false, {}, "主档写后读回不一致，请重新载入；未报告保存成功。", bool(verified.exists), true)
	_observe(verified)
	return _result(true, verified.state, "远征已保存。", true, false, FileAccess.file_exists(_path + ".bak"))


func restore_backup() -> Dictionary:
	var current := _read(_path)
	if not _observed:
		_observe(current)
	if not _same_observation(current):
		return _result(false, {}, "主档已变化，请重新读取后再决定恢复。", bool(current.exists), true)
	if current.ok:
		return _result(false, {}, "主档有效，无需回滚；不会用旧备份覆盖有效进度。", true)
	var backup := _read(_path + ".bak")
	if not backup.ok:
		return _result(false, {}, "没有可验证的远征备份。", bool(current.exists))
	if current.exists:
		if not current.get("raw_read", false):
			return _result(false, {}, "坏主档不能完整读取以便保留，已停止恢复。", true, false, true)
		var archive := _path + ".corrupt-" + String(current.digest).substr(0, 12)
		var archive_error := _replace_bytes(archive, current.bytes)
		if not archive_error.is_empty():
			return _result(false, {}, "不能保留坏主档：" + archive_error, true, false, true)
	if not _same_observation(_read(_path)) or _read(_path + ".bak").digest != backup.digest:
		return _result(false, {}, "恢复期间主档或备份改变，未替换。", bool(current.exists), true, true)
	var error := _replace_bytes(_path, backup.bytes)
	if not error.is_empty():
		return _result(false, {}, "恢复失败：" + error, bool(current.exists), false, true)
	var restored := _read(_path)
	if not restored.ok or restored.digest != backup.digest:
		return _result(false, {}, "恢复后读回失败，请重新读取。", bool(restored.exists), true, true)
	_observe(restored)
	return _result(true, restored.state, "已明确恢复上一份有效备份；坏主档已另存 .corrupt-摘要。若备份含航行记录，仍须承担中断返港后果。", true, false, true)


func _read(path: String) -> Dictionary:
	var absent := {"ok": false, "state": {}, "exists": false, "digest": "", "bytes": PackedByteArray(), "message": "档案不存在。"}
	if path.is_empty():
		absent.message = "档案路径为空。"
		return absent
	if not FileAccess.file_exists(path):
		# A directory at the exact target is not a missing writable archive.
		if DirAccess.dir_exists_absolute(_absolute(path)):
			absent.exists = true
			absent.message = "档案路径指向目录，不能读取或覆盖。"
		return absent
	var result := {"ok": false, "state": {}, "exists": true, "digest": "", "bytes": PackedByteArray(), "raw_read": false, "message": "档案读取失败。"}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return result
	var size := file.get_length()
	if size > MAX_BYTES:
		file.close()
		result.message = "档案为空或超过 %d 字节限制。" % MAX_BYTES
		return result
	var bytes := file.get_buffer(size)
	var read_error := file.get_error()
	file.close()
	if bytes.size() != size or not read_error in [OK, ERR_FILE_EOF]:
		return result
	result.bytes = bytes
	result.raw_read = true
	result.digest = _hash(bytes)
	if size == 0:
		result.message = "档案为空。"
		return result
	if not _utf8(bytes):
		result.message = "档案不是严格 UTF-8。"
		return result
	var parser := JSON.new()
	if parser.parse(bytes.get_string_from_utf8()) != OK:
		result.message = "档案 JSON 损坏。"
		return result
	var envelope: Variant = parser.data
	if not envelope is Dictionary or envelope.size() != 3 or envelope.get("format") != FORMAT or not State._integer(envelope.get("version"), VERSION, VERSION):
		result.message = "不是受支持的独立远征档案版本。"
		return result
	if not State.validate(envelope.get("state")):
		result.message = "远征档案字段或状态机不合法。"
		return result
	result.ok = true
	var canonical: Dictionary = envelope.state.duplicate(true)
	for key in ["version", "revision", "deployment", "sector", "leg", "credits", "parts", "pressure"]:
		canonical[key] = int(canonical[key])
	for key in ["hull", "battery"]:
		canonical[key] = float(canonical[key])
	if not canonical.active.is_empty():
		for key in ["sector", "leg", "pressure"]:
			canonical.active[key] = int(canonical.active[key])
		for key in ["hull", "battery"]:
			canonical.active[key] = float(canonical.active[key])
	for entry in canonical.history:
		for key in ["credits_delta", "parts_delta", "pressure"]:
			entry[key] = int(entry[key])
		for key in ["hull", "battery"]:
			entry[key] = float(entry[key])
	for data: Dictionary in [canonical, canonical.active] + canonical.history:
		if data.has("damage_control"):
			data.damage_control.breach = float(data.damage_control.breach)
			data.damage_control.kits = int(data.damage_control.kits)
	result.state = canonical
	result.message = "有效远征档案。"
	return result


func _encode(state: Dictionary) -> PackedByteArray:
	return (JSON.stringify({"format": FORMAT, "version": VERSION, "state": state}, "\t", true, true) + "\n").to_utf8_buffer()


func _write_checked(path: String, bytes: PackedByteArray) -> String:
	if _path.is_empty():
		return "档案路径为空。"
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return "无法打开写入路径（错误 %d）。" % FileAccess.get_open_error()
	file.store_buffer(bytes)
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK:
		return "档案写入失败（错误 %d）。" % error
	var check := FileAccess.open(path, FileAccess.READ)
	if check == null:
		return "档案写入后不可读。"
	var equal := check.get_length() == bytes.size() and check.get_buffer(bytes.size()) == bytes
	check.close()
	return "" if equal else "档案写入后字节核验失败。"


func _replace_bytes(path: String, bytes: PackedByteArray) -> String:
	var temp := path + ".tmp-" + Crypto.new().generate_random_bytes(6).hex_encode()
	var error := _write_checked(temp, bytes)
	if not error.is_empty():
		_remove(temp)
		return error
	var renamed := DirAccess.rename_absolute(_absolute(temp), _absolute(path))
	if renamed != OK:
		_remove(temp)
		return "文件替换失败（错误 %d）。" % renamed
	return ""


func _observe(read: Dictionary) -> void:
	_observed = true
	_exists = bool(read.exists)
	_digest = String(read.digest)


func _same_observation(read: Dictionary) -> bool:
	return bool(read.exists) == _exists and String(read.digest) == _digest


func _result(ok: bool, state: Dictionary, message: String, exists: bool = false, conflict: bool = false, backup_available: bool = false) -> Dictionary:
	var actual_exists := not _path.is_empty() and (FileAccess.file_exists(_path) or DirAccess.dir_exists_absolute(_absolute(_path)))
	return {"ok": ok, "state": state.duplicate(true), "message": message, "exists": exists or actual_exists, "conflict": conflict, "backup_available": backup_available}


func _absolute(path: String) -> String:
	return ProjectSettings.globalize_path(path)


func _remove(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(_absolute(path))


static func _utf8(bytes: PackedByteArray) -> bool:
	var i := 0
	while i < bytes.size():
		var first := int(bytes[i])
		if first == 0:
			return false
		if first < 0x80:
			i += 1
			continue
		var count := 0
		var value := 0
		var minimum := 0
		if first >= 0xC2 and first <= 0xDF:
			count = 1
			value = first & 0x1F
			minimum = 0x80
		elif first >= 0xE0 and first <= 0xEF:
			count = 2
			value = first & 0x0F
			minimum = 0x800
		elif first >= 0xF0 and first <= 0xF4:
			count = 3
			value = first & 0x07
			minimum = 0x10000
		else:
			return false
		if i + count >= bytes.size():
			return false
		for j in range(1, count + 1):
			var next := int(bytes[i + j])
			if next < 0x80 or next > 0xBF:
				return false
			value = (value << 6) | (next & 0x3F)
		if value < minimum or value > 0x10FFFF or (value >= 0xD800 and value <= 0xDFFF):
			return false
		i += count + 1
	return true


static func _hash(bytes: PackedByteArray) -> String:
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	if not bytes.is_empty():
		hashing.update(bytes)
	return hashing.finish().hex_encode()
