extends SceneTree
const Segments = preload("res://src/voyage_segments.gd")
var _checks := 0
var _failures := 0

func _init() -> void:
	var observer := Segments.new()
	var first := _sample(0.0, Vector2(-3, -4))
	var original := first.duplicate(true)
	_check(not observer.finish(first) and not observer.cancel(), "inactive actions rejected without records")
	_check(observer.start(first), "explicit finite running start")
	var active := observer.view()
	_check(not observer.start(first) and observer.view() == active, "repeated start nonmutating")
	observer.observe(_sample(1.0, Vector2.ZERO, 98.0, 96.0, 4.0))
	observer.observe(_sample(1.0, Vector2(100, 100), 20.0, 20.0, 50.0))
	_check(observer.view().active.distance_m == 5.0 and observer.view().active.elapsed_s == 1.0, "3-4-5 leg and same-time altered sample ignored")
	var last := _sample(2.0, Vector2(-3, -4), 97.0, 95.0, 5.0)
	last.wind = Vector2(-1, 2)
	last.storm = 0.75
	_check(observer.finish(last), "manual finish adds last forward sample")
	var record: Dictionary = observer.view().records[0]
	_check(record.elapsed_s == 2.0 and record.distance_m == 10.0 and record.start.position == record.end.position, "out-and-back distance is ten, endpoint displacement zero")
	_check(record.hull_delta_pp == -3.0 and record.battery_delta_pp == -5.0 and record.energy_spent_points == 5.0, "signed percentage points and independent expenditure")
	_check(record.start.wind == Vector2(1, -2) and record.end.wind == Vector2(-1, 2) and record.end.storm == 0.75, "actual endpoint wind and storm retained")
	_check(first == original, "input and nested optional dictionaries unchanged")
	var exported := observer.view()
	exported.records[0].start.identity[0] = "external mutation"
	exported.records.clear()
	_check(observer.view().records.size() == 1 and observer.view().records[0].start.identity[0] == "voyage-1", "deep immutable exported state")
	_check(observer.start(last) and observer.cancel() and not observer.cancel() and observer.view().records.size() == 1, "cancel discards only active segment")
	_check(observer.start(last) and observer.finish(last), "zero duration honestly permitted")
	record = observer.view().records.back()
	_check(record.elapsed_s == 0.0 and record.distance_m == 0.0 and record.battery_delta_pp == 0.0, "zero duration invents no progression")
	for index in range(7):
		observer.start(last)
		observer.finish(last)
	_check(observer.view().records.size() == 6 and observer.view().records.front().number == 4 and observer.view().records.back().number == 9, "latest six bounded; seventh evicts oldest, monotonic numbering")
	_check(observer.view().policy.contains("6") and observer.view().policy.contains("替换"), "visible bounded retention policy")
	observer.start(last)
	var before := observer.view()
	_check(not observer.finish(first) and observer.view() == before, "decreasing-time manual finish accurately rejected, unchanged")
	observer.observe(first)
	_check(observer.view().active.is_empty() and observer.view().records.is_empty(), "forward observer detects time reset and clears without connecting positions")
	observer.start(first)
	var reset := last.duplicate(true)
	reset.expedition_token = "voyage-2"
	_check(not observer.finish(reset) and not observer.view().active.is_empty(), "foreign finish rejected without mutating current segment")
	observer.observe(reset)
	_check(observer.view().records.is_empty() and observer.view().active.is_empty(), "foreign token clears on actual stream")
	for identity: String in ["contract_id", "offer_id"]:
		observer.start(first)
		reset = last.duplicate(true)
		reset[identity] = "changed"
		observer.observe(reset)
		_check(observer.view().active.is_empty(), "no cross-contract bridge: " + identity)
	_energy_cases()
	for field: String in ["time", "position", "hull", "battery", "wind", "storm", "expedition_token", "contract_id", "offer_id", "phase"]:
		var bad := first.duplicate(true)
		bad.erase(field)
		var fresh := Segments.new()
		_check(not fresh.start(bad) and fresh.view().active.is_empty(), "missing required public field rejected: " + field)
	for field: String in ["time", "hull", "battery", "storm"]:
		for value: float in [NAN, INF, -1.0]:
			var bad := first.duplicate(true)
			bad[field] = value
			_check(not Segments.new().start(bad), "nonfinite/negative rejected: " + field)
	for field: String in ["position", "wind"]:
		var bad := first.duplicate(true)
		bad[field] = Vector2(INF, 0)
		_check(not Segments.new().start(bad), "nonfinite vector rejected: " + field)
	var terminal := last.duplicate(true)
	terminal.phase = "failed"
	observer.clear()
	_check(not observer.start(terminal), "terminal cannot start")
	observer.start(first)
	observer.observe(terminal)
	for index in range(3):
		observer.observe(terminal)
	_check(observer.view().records.size() == 1 and observer.view().records[0].reason == "terminal" and not observer.finish(terminal), "terminal at actual end closes at most once")
	observer.clear()
	observer.start(first)
	terminal = first.duplicate(true)
	terminal.phase = "success"
	observer.observe(terminal)
	_check(observer.view().records.size() == 1 and observer.view().records[0].elapsed_s == 0.0, "same-time terminal closes honest zero-duration once")
	observer.start(last)
	var invalid := last.duplicate(true)
	invalid.erase("position")
	observer.observe(invalid)
	_check(observer.view().active.is_empty(), "invalid actual measurement cancels active rather than bridging missing distance")
	_check(Segments.reading(-0.00001, "百分点", true) == "−<0.001 百分点" and Segments.reading(0.00001, "米") == "<0.001 米", "tiny readings retain nonzero/sign")
	print("Stormline voyage segments: %d checks, %d failures; synthetic public fixtures, no simulation decisions." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)

func _energy_cases() -> void:
	for kind: String in ["absent", "disappears", "reappears", "decreases", "nonfinite", "negative", "present"]:
		var observer := Segments.new()
		var first := _sample(0.0, Vector2.ZERO, 100, 80, 10)
		var middle := _sample(1.0, Vector2(3, 4), 100, 81, 12)
		var last := _sample(2.0, Vector2.ZERO, 100, 82, 15)
		match kind:
			"absent":
				first.erase("energy_budget")
				middle.erase("energy_budget")
				last.erase("energy_budget")
			"disappears": last.erase("energy_budget")
			"reappears": middle.erase("energy_budget")
			"decreases": middle.energy_budget.spent.total = 9.0
			"nonfinite": middle.energy_budget.spent.total = NAN
			"negative": middle.energy_budget.spent.total = -1.0
		observer.start(first)
		observer.observe(middle)
		observer.finish(last)
		var record: Dictionary = observer.view().records[0]
		_check(record.energy_spent_points == (5.0 if kind == "present" else null), "whole-segment optional energy availability: " + kind)
		_check(record.battery_delta_pp == 2.0 and record.distance_m == 10.0, "battery increase and distance not replaced by optional expenditure: " + kind)

func _sample(time: float, position: Vector2, hull := 100.0, battery := 100.0, spent := 0.0) -> Dictionary:
	return {"time": time, "position": position, "hull": hull, "battery": battery,
		"wind": Vector2(1, -2), "storm": 0.5, "phase": "approach",
		"expedition_token": "voyage-1", "contract_id": "black-tide", "offer_id": "chart-safe",
		"energy_budget": {"spent": {"total": spent}}}

func _check(ok: bool, note: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + note)
