extends RefCounted
## One memory-only saved reference; separate from manual-observation lifetime.
## Composes the unchanged observer for one paid, initialized whole voyage.
const Observer = preload("res://src/voyage_segments.gd")
const POLICY := "仅本次运行内存 · 已入账上航，非当前遥测；关闭／重读／新远征／快玩清空"
var _whole = Observer.new()
var _identity: Array = []
var _name := ""
var _candidate: Dictionary = {}
var _last: Dictionary = {}
var _choice := "whole"
var _visible := true


func clear() -> void:
	stop()
	_last = {}
	_choice = "whole"
	_visible = true


func stop() -> void:
	_whole.clear()
	_identity = []
	_name = ""
	_candidate = {}


func begin(public: Dictionary, name: String) -> bool:
	stop()
	if name.is_empty() or not _whole.start(public):
		return false
	_identity = [public.expedition_token, public.contract_id, public.offer_id]
	_name = name
	return true


func observe(public: Dictionary) -> void:
	if not _identity.is_empty() and _candidate.is_empty():
		_whole.observe(public)


func capture(public: Dictionary, records: Array, expected: int) -> bool:
	if not _candidate.is_empty() or _identity.is_empty() or expected < 0:
		return false
	if [public.get("expedition_token"), public.get("contract_id"), public.get("offer_id")] != _identity or public.get("phase") not in ["success", "failed"]:
		return false
	var measured: Array = _whole.view().records
	if measured.size() != 1 or measured[0].reason != "terminal" or measured[0].end.time != public.get("time"):
		return false
	var whole := _copy_measurement(measured[0])
	if whole.is_empty():
		return false
	var kept: Array = []
	for index in range(maxi(0, records.size() - Observer.LIMIT), records.size()):
		if not records[index] is Dictionary:
			continue
		var record := _copy_measurement(records[index])
		if not record.is_empty() and record.start.identity == _identity and record.end.time <= whole.end.time and record.start.time >= whole.start.time:
			var number: Variant = records[index].get("number")
			if number is int and number > 0 and (kept.is_empty() or number > kept.back().number):
				record["number"] = number
				kept.append(record)
	_candidate = {"expected": expected, "reference": {"token": _identity[0], "base_contract": _identity[1],
		"offer_id": _identity[2], "name": _name, "outcome": public.phase, "whole": whole, "segments": kept}}
	_whole.clear()
	return true


## Called only after Store succeeds; validate that exact original CAS/result too.
func promote(saved: Dictionary, expected: int) -> bool:
	if _candidate.is_empty() or expected != _candidate.expected or saved.get("revision") != expected + 1:
		return false
	var history: Variant = saved.get("history")
	if not history is Array or history.is_empty() or not history.back() is Dictionary:
		return false
	var event: Dictionary = history.back()
	var reference: Dictionary = _candidate.reference
	if event.get("event") != "settle" or event.get("token") != reference.token or event.get("offer_id") != reference.offer_id or event.get("outcome") != reference.outcome:
		return false
	_last = reference.duplicate(true)
	_choice = "whole"
	_visible = true
	stop()
	return true


func act(action: String, id: String = "") -> bool:
	if _last.is_empty():
		return false
	match action:
		"clear":
			_last = {}
			_choice = "whole"
			_visible = true
		"show": _visible = true
		"hide": _visible = false
		"select":
			if id != "whole":
				var found := false
				for record: Dictionary in _last.segments:
					if id == "segment:%d" % int(record.number):
						found = true
				if not found:
					return false
			_choice = id
		_: return false
	return true


func view() -> Dictionary:
	var selected: Dictionary = _last.get("whole", {})
	for record: Dictionary in _last.get("segments", []):
		if _choice == "segment:%d" % int(record.number):
			selected = record
	return {"reference": _last.duplicate(true), "visible": _visible, "choice": _choice,
		"selected": selected.duplicate(true), "policy": POLICY}


func _copy_measurement(source: Dictionary) -> Dictionary:
	for key: String in ["elapsed_s", "distance_m", "hull_delta_pp", "battery_delta_pp"]:
		if not _number(source.get(key)):
			return {}
	if source.elapsed_s < 0.0 or source.distance_m < 0.0 or source.get("reason") not in ["manual", "terminal"]:
		return {}
	var energy: Variant = source.get("energy_spent_points")
	if energy != null and (not _number(energy) or float(energy) < 0.0):
		return {}
	var points: Dictionary = {}
	for key: String in ["start", "end"]:
		var point: Variant = source.get(key)
		if not point is Dictionary or point.get("identity") != _identity:
			return {}
		for field: String in ["time", "hull", "battery", "storm"]:
			if not _number(point.get(field)):
				return {}
		if not point.get("wind") is Vector2 or not Vector2(point.wind).is_finite():
			return {}
		points[key] = {"identity": _identity.duplicate(), "time": point.time, "hull": point.hull,
			"battery": point.battery, "storm": point.storm, "wind": point.wind}
	if points.end.time < points.start.time or source.elapsed_s != points.end.time - points.start.time:
		return {}
	return {"elapsed_s": source.elapsed_s, "distance_m": source.distance_m,
		"hull_delta_pp": source.hull_delta_pp, "battery_delta_pp": source.battery_delta_pp,
		"energy_spent_points": energy, "start": points.start, "end": points.end, "reason": source.reason}


func _number(value: Variant) -> bool:
	return (value is float or value is int) and is_finite(float(value))
