extends SceneTree
const Review = preload("res://src/voyage_review.gd")
var _checks := 0
var _failures := 0


func _init() -> void:
	var review := Review.new()
	_check(not review.view().active and review.view().summary_text.contains("未记录"), "empty ledger never invents measurements")
	var sample := _initial()
	review.begin(sample)
	var initial: Dictionary = review.view()
	for repeat in range(5):
		review.observe(sample)
	_check(review.view() == initial, "repeated initial snapshot has no events or elapsed drift")
	sample.time = 1.0
	sample.scanned = true
	sample.tow_attached = true
	sample.tension = 1.2
	sample.peak_tension = 1.5
	sample.overload = 0.2
	sample.event_id = 4
	sample.event_kind = "collision"
	sample.event = "舱体擦碰：测试礁。留更大的外弯。"
	review.observe(sample)
	_check(_kinds(review.view()) == ["scan_locked", "tow_attached", "cargo_collision", "overload"],
		"same-tick state edges survive overwritten notices with stable presentation order")
	_check(review.view().coverage_text.contains("中间通知细节未记录") and not review.view().coverage_text.contains("3 条"),
		"ID gaps disclose uncertainty, not missing event type/count/cause")
	var once: Dictionary = review.view()
	for repeat in range(20):
		review.observe(sample.duplicate(true))
	_check(review.view() == once, "same event/time snapshot is byte-value idempotent")
	sample.time = 2.0
	sample.tension = 0.7
	sample.overload = 0.1
	review.observe(sample)
	_check(_kinds(review.view()).back() == "rated" and int(review.view().counts.cargo_collision) == 1,
		"later time with stale collision ID adds only measured rated-state recovery")
	sample.time = 3.0
	sample.overload = 0.0
	review.observe(sample)
	_check(_kinds(review.view()).back() == "risk_clear", "risk clearing is separate from returning below rated tension")
	sample.time = 4.0
	sample.tension = 1.1
	sample.overload = 0.2
	sample.event_id = 5
	sample.event_kind = "overload"
	sample.event = "过载"
	review.observe(sample)
	_check(review.view().counts.overload == 2 and review.view().timeline_text.contains("再次过载"), "second tension entry recorded even if a notice could be overwritten")
	sample.time = 5.0
	sample.hull = 42.5
	sample.cargo_integrity = 23.0
	sample.tow_attached = false
	sample.phase = "failed"
	sample.fail_reason = "回收舱破损，任务终止。"
	sample.event_id = 6
	sample.event_kind = "collision"
	sample.event = sample.fail_reason
	review.observe(sample)
	_check(_kinds(review.view()).back() == "failed" and not review.view().counts.has("tug_collision")
		and review.view().counts.cargo_collision == 1 and review.view().counts.rated == 1,
		"terminal collision kind and detachment cannot invent body impact or successful unloading")
	_check(review.view().hull_loss == 57.5 and review.view().cargo_loss == 77.0 and review.view().elapsed == 5.0
		and review.view().summary_text.contains("≥150%"), "elapsed, durability points and capped peak are directly reconcilable")
	var terminal: Dictionary = review.view()
	sample.time = 100.0
	review.observe(sample)
	_check(review.view() == terminal, "terminal ledger freezes independently of repeated presentation")
	var external: Dictionary = review.view()
	external.events.clear()
	external.counts.clear()
	_check(review.view() == terminal, "returned view cannot mutate the private ledger")
	review.begin({"contract_id": "needle-bank", "time": 10.0})
	review.observe({"contract_id": "needle-bank", "time": 11.0, "scanned": true,
		"tow_attached": true, "tension": 1.2, "hull": 20.0, "phase": "approach"})
	_check(review.view().total_events == 0 and review.view().hull_loss == null and review.view().peak_tension == null
		and review.view().coverage_text.contains("锁定 未记录"), "missing baseline fields never invent edges or zero damage/peak")
	var incomplete: Dictionary = review.view()
	review.observe({"contract_id": "black-tide", "time": 12.0, "phase": "success"})
	review.observe({"contract_id": "needle-bank", "time": 9.0, "phase": "success"})
	_check(review.view() == incomplete, "foreign contract and stale time cannot contaminate the ledger")
	review.begin(_initial())
	var loss_only := _initial()
	loss_only.time = 1.0
	loss_only.hull = 80.0
	loss_only.cargo_integrity = 75.0
	loss_only.velocity = Vector2.ZERO
	review.observe(loss_only)
	_check(review.view().total_events == 0 and not review.view().advice_text.contains("曾有碰撞")
		and review.view().hull_loss == 20.0, "durability loss and zero speed do not fabricate a collision or its cause")
	var baseline := _initial()
	baseline.scanned = true
	baseline.tow_attached = true
	baseline.tension = 1.2
	baseline.peak_tension = 1.2
	review.begin(baseline)
	baseline.time = 1.0
	review.observe(baseline)
	_check(review.view().total_events == 0, "already locked/attached/overloaded first sample is a baseline, not an invented transition")
	_bounded(review)
	review.clear()
	_check(not review.view().active and review.view().events.is_empty() and review.view().counts.is_empty(), "clear removes the previous voyage and counters")
	print("Stormline voyage review: %d checks, %d failures; pure bounded snapshot evidence, no files or scene." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _bounded(review: RefCounted) -> void:
	var sample := _initial()
	review.begin(sample)
	for index in range(1, 401):
		sample.time = float(index)
		sample.event_id = index
		sample.event_kind = "collision"
		sample.event = "船体碰撞：" + "礁".repeat(1000)
		review.observe(sample)
	var view: Dictionary = review.view()
	_check(view.total_events == 400 and view.events.size() == Review.MAX_EVENTS
		and view.omitted_events == 400 - Review.MAX_EVENTS and view.counts.tug_collision == 400,
		"bounded first+tail ledger preserves collected total and distinct omitted count")
	_check(view.events[0].time == 1.0 and view.events[3].time == 4.0 and view.events.back().time == 400.0
		and view.timeline_text.contains("已省略"), "retains first milestones and latest tail in chronological order")
	var bounded := true
	for event: Dictionary in view.events:
		bounded = bounded and String(event.label).length() <= 120
	_check(bounded and review.get("_previous").size() <= 7 and view.counts.size() <= Review.KINDS.size(), "label, prior sample and kind counter memory all have fixed bounds")
	sample.time = 401.0
	sample.phase = "success"
	sample.event_id = 401
	sample.event_kind = "docked"
	review.observe(sample)
	_check(review.view().events.back().kind == "docked" and review.view().events.size() == Review.MAX_EVENTS,
		"terminal outcome remains in the bounded latest tail")


func _initial() -> Dictionary:
	return {"contract_id": "black-tide", "time": 0.0, "scanned": false, "tow_attached": false,
		"tension": 0.0, "peak_tension": 0.0, "overload": 0.0, "hull": 100.0, "cargo_integrity": 100.0,
		"event_id": 0, "event_kind": "", "event": "", "phase": "approach"}


func _kinds(view: Dictionary) -> Array:
	var result := []
	for event: Dictionary in view.events:
		result.append(event.kind)
	return result


func _check(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures += 1
		printerr("FAIL: " + message)
