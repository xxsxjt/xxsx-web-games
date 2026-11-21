extends RefCounted
## Memory-only evidence ledger. No scene, input, disk, model mutation or wall clock.
const MAX_EVENTS := 16
const KEEP_FIRST := 4
const KINDS := ["scan_locked", "tow_attached", "tug_collision", "cargo_collision", "overload", "rated", "risk_clear", "docked", "failed"]

var _active := false
var _contract_id := ""
var _previous: Dictionary = {}
var _events: Array[Dictionary] = []
var _counts: Dictionary = {}
var _total := 0
var _notification_gap := false
var _last_event_id := 0
var _start_hull: Variant = null
var _start_cargo: Variant = null
var _start_time: Variant = null
var _peak: Variant = null
var _finished := false


func clear() -> void:
	_active = false
	_contract_id = ""
	_previous = {}
	_events.clear()
	_counts.clear()
	_total = 0
	_notification_gap = false
	_last_event_id = 0
	_start_hull = null
	_start_cargo = null
	_start_time = null
	_peak = null
	_finished = false


func begin(snapshot: Dictionary) -> void:
	clear()
	if String(snapshot.get("contract_id", "")).is_empty() or not _number(snapshot, "time"):
		return
	_active = true
	_contract_id = String(snapshot.contract_id)
	_previous = _sample(snapshot)
	_start_time = snapshot.time
	_start_hull = snapshot.hull if _number(snapshot, "hull") else null
	_start_cargo = snapshot.cargo_integrity if _number(snapshot, "cargo_integrity") else null
	_last_event_id = maxi(0, int(snapshot.get("event_id", 0)))
	_update_peak(snapshot)


func observe(snapshot: Dictionary) -> void:
	if not _active or _finished or String(snapshot.get("contract_id", "")) != _contract_id \
			or not _number(snapshot, "time") or float(snapshot.time) <= float(_previous.time):
		return
	var time := float(snapshot.time)
	var event_id := maxi(0, int(snapshot.get("event_id", _last_event_id)))
	var fresh_event := event_id > _last_event_id
	if fresh_event:
		_notification_gap = _notification_gap or event_id > _last_event_id + 1
		_last_event_id = event_id
	# Stable within-tick order is a presentation order, not sub-tick chronology.
	if _rising(snapshot, "scanned"):
		_add("scan_locked", time, "声纳锁定", "scanned", event_id)
	if _rising(snapshot, "tow_attached"):
		_add("tow_attached", time, "挂索成功", "tow_attached", event_id)
	var message := String(snapshot.get("event", ""))
	if fresh_event and String(snapshot.get("event_kind", "")) == "collision":
		if message.begins_with("船体碰撞："):
			_add("tug_collision", time, message, "event_id", event_id)
		elif message.begins_with("舱体擦碰："):
			_add("cargo_collision", time, message, "event_id", event_id)
	var towing := snapshot.has("tow_attached") and bool(snapshot.tow_attached)
	var prior_towing := _previous.has("tow_attached") and bool(_previous.tow_attached)
	if towing and _number(snapshot, "tension"):
		var high := float(snapshot.tension) >= 1.0
		var prior_known := _number(_previous, "tension") and _previous.has("tow_attached")
		var prior_high := prior_towing and prior_known and float(_previous.tension) >= 1.0
		if high and prior_known and not prior_high:
			var label := "首次过载（张力 ≥100%）" if int(_counts.get("overload", 0)) == 0 else "再次过载（张力 ≥100%）"
			_add("overload", time, label, "tension", event_id)
		elif not high and prior_high:
			_add("rated", time, "张力回到额定内（累计风险另计）", "tension", event_id)
	if towing and prior_towing and _number(snapshot, "overload") and _number(_previous, "overload") \
			and float(_previous.overload) > 0.0 and float(snapshot.overload) == 0.0:
		_add("risk_clear", time, "累计断索风险已回落至零", "overload", event_id)
	_update_peak(snapshot)
	var phase := String(snapshot.get("phase", ""))
	if phase in ["success", "failed"]:
		_finished = true
		if phase == "success":
			_add("docked", time, "船舱稳定靠港 · 回收完成", "phase", event_id)
		else:
			var reason := String(snapshot.get("fail_reason", ""))
			_add("failed", time, "失败 · " + (reason if not reason.is_empty() else "原因未记录"), "phase", event_id)
	_previous = _sample(snapshot)


func view() -> Dictionary:
	var elapsed: Variant = float(_previous.time) - float(_start_time) if _active else null
	var hull_loss: Variant = _loss(_start_hull, "hull")
	var cargo_loss: Variant = _loss(_start_cargo, "cargo_integrity")
	var lines := PackedStringArray()
	for index in range(_events.size()):
		if _total > MAX_EVENTS and index == KEEP_FIRST:
			lines.append("… 中间 %d 个节点已省略 …" % (_total - _events.size()))
		var item: Dictionary = _events[index]
		lines.append("%s  %s" % [_time(item.time), item.label])
	var summary := "用时 %s · 船损 %s · 舱损 %s · 峰张 %s" % [
		_time(elapsed) if elapsed != null else "未记录", _points(hull_loss), _points(cargo_loss), _load(_peak)]
	var coverage := "锁定 %s · 挂索 %s · 已收碰撞通知 船%d/舱%d · 过载%d次" % [
		"已记录" if _counts.has("scan_locked") else "未记录", "已记录" if _counts.has("tow_attached") else "未记录",
		int(_counts.get("tug_collision", 0)), int(_counts.get("cargo_collision", 0)), int(_counts.get("overload", 0))]
	coverage += "\n仅记录公开采样/通知，碰撞通知非全部接触；同刻不分先后。"
	if _notification_gap:
		coverage += "\n通知编号曾跳号：中间通知细节未记录。"
	return {"active": _active, "finished": _finished, "contract_id": _contract_id,
		"elapsed": elapsed, "hull_loss": hull_loss, "cargo_loss": cargo_loss, "peak_tension": _peak,
		"events": _events.duplicate(true), "counts": _counts.duplicate(), "total_events": _total,
		"omitted_events": _total - _events.size(), "notification_gap": _notification_gap,
		"summary_text": summary, "coverage_text": coverage,
		"timeline_text": "\n".join(lines) if not lines.is_empty() else "关键节点未记录。",
		"advice_text": _advice()}


func _advice() -> String:
	if not _active:
		return "下次：记录不足，暂不提供针对性建议。"
	var actions := PackedStringArray()
	if _counts.has("tug_collision"):
		actions.append("船体曾有碰撞通知：接近礁圈前减速并留外侧余量")
	if _counts.has("cargo_collision"):
		actions.append("舱体曾有擦碰通知：转弯给尾舱更大外弯")
	if _counts.has("overload"):
		actions.append("曾达到过载门槛：提早松油门、减小转角，必要时 F 放缆 / 3 稳索")
	if actions.is_empty():
		return "下次：继续核对船舱速度与张力后靠港；本记录不能证明最短或最佳航路。"
	return "下次可试（非失败归因）：" + "；".join(actions) + "。"


func _add(kind: String, time: float, label: String, evidence: String, event_id: int) -> void:
	assert(kind in KINDS)
	_total += 1
	_counts[kind] = int(_counts.get(kind, 0)) + 1
	_events.append({"kind": kind, "time": time, "label": label.left(120), "evidence": evidence, "event_id": event_id})
	if _events.size() > MAX_EVENTS:
		_events.remove_at(KEEP_FIRST)


func _sample(snapshot: Dictionary) -> Dictionary:
	# Retain only fixed scalar fields, never growing notices, positions or reports.
	var result := {}
	for key: String in ["time", "scanned", "tow_attached", "tension", "overload", "hull", "cargo_integrity"]:
		if snapshot.has(key) and (snapshot[key] is bool or _number(snapshot, key)):
			result[key] = snapshot[key]
	return result


func _rising(snapshot: Dictionary, key: String) -> bool:
	return _previous.has(key) and snapshot.has(key) and not bool(_previous[key]) and bool(snapshot[key])


func _update_peak(snapshot: Dictionary) -> void:
	if _number(snapshot, "peak_tension"):
		_peak = maxf(float(_peak) if _peak != null else 0.0, float(snapshot.peak_tension))


func _loss(start: Variant, key: String) -> Variant:
	return maxf(0.0, float(start) - float(_previous[key])) if start != null and _number(_previous, key) else null


func _number(snapshot: Dictionary, key: String) -> bool:
	return snapshot.has(key) and (snapshot[key] is int or snapshot[key] is float) and is_finite(float(snapshot[key]))


func _points(value: Variant) -> String:
	return "未记录" if value == null else "%.1f 点" % float(value)


func _load(value: Variant) -> String:
	return "未记录" if value == null else ("≥150%" if float(value) >= 1.5 else "%.1f%%" % (float(value) * 100.0))


func _time(value: float) -> String:
	var tenths := roundi(maxf(value, 0.0) * 10.0)
	return "%02d:%02d.%d" % [floori(float(tenths) / 600.0), floori(float(tenths % 600) / 10.0), tenths % 10]
