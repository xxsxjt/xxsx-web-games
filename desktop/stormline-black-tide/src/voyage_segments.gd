extends RefCounted
## Bounded public-snapshot observer. No scene, input, clock, disk or simulation.
## Required finite fields are authored by StormSim; energy spent is optional.
const LIMIT := 6
const POLICY := "仅本航内存 · 最近6段，第7段替换最旧段；返坞／重读／换航清空"
const METHOD := "逐物理步船位距离之和，非连续弧长；仅观察，不归因／预测续航或保证安全。无环境流读数。"

var _active: Dictionary = {}
var _records: Array = []
var _serial := 0
var _identity: Array = []
var _time := -1.0


func clear() -> void:
	_active = {}
	_records = []
	_serial = 0
	_identity = []
	_time = -1.0


func start(public: Dictionary) -> bool:
	if not _active.is_empty() or not _valid(public) or public.phase in ["success", "failed"]:
		return false
	var point := _point(public)
	if (not _identity.is_empty() and point.identity != _identity) or point.time < _time:
		clear()
	_identity = point.identity.duplicate()
	_time = point.time
	_active = {"start": point, "end": point.duplicate(true), "distance_m": 0.0,
		"energy_available": point.energy_spent != null, "energy_last": point.energy_spent}
	return true


func cancel() -> bool:
	if _active.is_empty():
		return false
	_active = {}
	return true


func observe(public: Dictionary) -> void:
	# A missing required measurement cannot be silently bridged as measured travel.
	if not _valid(public):
		_active = {}
		return
	var point := _point(public)
	if (not _identity.is_empty() and point.identity != _identity) or point.time < _time:
		clear()
		return
	_identity = point.identity.duplicate()
	_time = point.time
	if _active.is_empty():
		return
	var last: Dictionary = _active.end
	if point.identity != last.identity or point.time < last.time:
		clear()
		return
	if point.time == last.time:
		if public.phase in ["success", "failed"]:
			_retain("terminal")
		return # presentation/duplicate samples do not change any reading
	_active.distance_m += Vector2(last.position).distance_to(point.position)
	if point.energy_spent == null or _active.energy_last == null:
		_active.energy_available = false
	elif float(point.energy_spent) < float(_active.energy_last):
		_active.energy_available = false
	_active.energy_last = point.energy_spent
	_active.end = point
	if public.phase in ["success", "failed"]:
		_retain("terminal")


func finish(public: Dictionary) -> bool:
	if _active.is_empty() or not _valid(public):
		return false
	var point := _point(public)
	if point.identity != _active.end.identity or point.time < _active.end.time:
		return false
	observe(public)
	if not _active.is_empty():
		_retain("manual")
	return true


func view() -> Dictionary:
	return {"active": _measurement(_active, "active") if not _active.is_empty() else {},
		"records": _records.duplicate(true), "limit": LIMIT, "policy": POLICY, "method": METHOD}


func _retain(reason: String) -> void:
	_serial += 1
	var record := _measurement(_active, reason)
	record["number"] = _serial
	_records.append(record)
	if _records.size() > LIMIT:
		_records.pop_front()
	_active = {}


func _measurement(segment: Dictionary, reason: String) -> Dictionary:
	var first: Dictionary = segment.start
	var last: Dictionary = segment.end
	return {"elapsed_s": last.time - first.time, "distance_m": segment.distance_m,
		"hull_delta_pp": last.hull - first.hull, "battery_delta_pp": last.battery - first.battery,
		"energy_spent_points": float(last.energy_spent) - float(first.energy_spent) if segment.energy_available else null,
		"start": first.duplicate(true), "end": last.duplicate(true), "reason": reason}


func _point(public: Dictionary) -> Dictionary:
	var energy: Variant = null
	var budget: Variant = public.get("energy_budget")
	if budget is Dictionary and budget.get("spent") is Dictionary:
		var total: Variant = budget.spent.get("total")
		if _number(total) and float(total) >= 0.0:
			energy = float(total)
	return {"identity": [public.expedition_token, public.contract_id, public.offer_id],
		"time": float(public.time), "position": public.position,
		"hull": float(public.hull), "battery": float(public.battery),
		"wind": public.wind, "storm": float(public.storm), "energy_spent": energy}


func _valid(public: Dictionary) -> bool:
	for key: String in ["expedition_token", "contract_id", "offer_id"]:
		if not public.get(key) is String or String(public[key]).is_empty():
			return false
	if public.get("phase") not in ["approach", "return", "success", "failed"]:
		return false
	for key: String in ["position", "wind"]:
		if not public.get(key) is Vector2 or not Vector2(public[key]).is_finite():
			return false
	for key: String in ["time", "hull", "battery", "storm"]:
		if not _number(public.get(key)) or float(public[key]) < 0.0:
			return false
	return float(public.hull) <= 100.0 and float(public.battery) <= 100.0 and float(public.storm) <= 1.0


func _number(value: Variant) -> bool:
	return (value is float or value is int) and is_finite(float(value))


static func reading(value: float, unit: String, signed: bool = false) -> String:
	# Keep the sign of a nonzero subprecision measurement; do not imply zero gain/loss.
	var magnitude := absf(value)
	var prefix := ("+" if value > 0.0 else "−") if signed and value != 0.0 else ""
	return prefix + ("<0.001" if magnitude > 0.0 and magnitude < 0.001 else "%.3f" % magnitude) + " " + unit


static func describe(record: Dictionary) -> String:
	var first: Dictionary = record.start
	var last: Dictionary = record.end
	var energy := "实耗不可用（本段缺失或累计量回退）" if record.energy_spent_points == null else "实耗 " + reading(float(record.energy_spent_points), "电量点")
	var ending := " · 终局收尾" if record.reason == "terminal" else ""
	return "%s · %s%s\n船体 %s · 电池净变 %s\n%s（不同于电池净变）\n风起／止 (东,南)：(%s, %s) → (%s, %s)\n风暴起／止：%s → %s" % [
		reading(float(record.elapsed_s), "模拟秒"), reading(float(record.distance_m), "米"), ending,
		reading(float(record.hull_delta_pp), "百分点", true), reading(float(record.battery_delta_pp), "百分点", true), energy,
		reading(first.wind.x, "m/s", true), reading(first.wind.y, "m/s", true),
		reading(last.wind.x, "m/s", true), reading(last.wind.y, "m/s", true),
		reading(float(first.storm) * 100.0, "%"), reading(float(last.storm) * 100.0, "%")]
