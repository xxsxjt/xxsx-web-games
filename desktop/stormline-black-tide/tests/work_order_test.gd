extends SceneTree
## Pure-rule fixtures, not a driving or human balance test.
const State = preload("res://src/expedition_state.gd")
var checks := 0
var failures := 0

func _init() -> void:
	for damage: bool in [false, true]:
		var s := State.new_campaign(damage)
		s.hull = 45.0
		s.battery = 30.0
		if damage:
			s.damage_control.breach = 1.4
		var original := s.duplicate(true)
		var steps := [_step("repair"), _step("recharge"), _step("buy", "drive"), _step("equip", "drive"), _step("buy", "sonar"), _step("equip", "sonar")]
		if damage:
			steps.append(_step("prepare_kit"))
		var preview := State.preview_work_order(s, steps)
		_check(preview.ok and s == original, "read-only projection")
		var serial := s.duplicate(true)
		for step: Dictionary in steps:
			serial = State.act(serial, step.action, step.payload).state
		serial.revision = int(s.revision) + 1
		_check(preview.state == serial, "identical sequential resources, history and single revision")
		_check(State.act(s, "work_order", {"steps": steps}).state == preview.state, "commit and preview same rules")
		_check(State.validate(preview.state) and preview.state.has("damage_control") == damage, "old schema unchanged")
		_check(preview.state.history.size() == steps.size() and preview.state.pressure == 2, "individual events and pressure retained")
		for bad: Array in [[_step("repair"), _step("buy", "tow"), _step("buy", "drive"), _step("buy", "sonar")],
				[_step("equip", "drive")], [_step("launch")], [_step("enable_damage")],
				[{"action": "repair", "payload": {}, "extra": 1}], [_step("repair"), _step("retreat")]]:
			var rejected := State.preview_work_order(s, bad)
			_check(not rejected.ok and rejected.state == s, "invalid order returns original state")
		var long_order: Array = []
		for i in 13:
			long_order.append(_step("repair"))
		_check(not State.preview_work_order(s, long_order).ok, "bounded step count")
		_check(not State.act(s, "work_order", {"steps": []}).ok, "empty commit rejected")
		_check(State.preview_work_order(s, []).state == s, "empty preview is unchanged")
		s.revision = 999999
		_check(State.preview_work_order(s, steps).state.revision == 1000000, "multi-step order at penultimate revision")
		s.revision = 1000000
		_check(not State.preview_work_order(s, steps).ok, "revision cap fails closed")
		s = original.duplicate(true)
		var active: Dictionary = State.act(s, "launch", {"offer_id": State.offers(s)[0].id}).state
		_check(not State.preview_work_order(active, steps).ok, "no in-flight outfitting")
		for i in 30:
			s = State.act(s, "buy", {"module_id": "sonar"}).state if i == 0 else State.act(s, "equip" if i % 2 == 1 else "unequip", {"module_id": "sonar"}).state
		var bounded := State.preview_work_order(s, [_step("repair"), _step("recharge")])
		_check(bounded.ok and bounded.state.history.size() == State.HISTORY_LIMIT, "history remains bounded")
	var kits := State.new_campaign(true)
	kits.parts = 0
	kits.damage_control.kits = 1
	kits.damage_control.breach = 1.0
	var ordered := State.preview_work_order(kits, [_step("unload_kit"), _step("repair")])
	_check(ordered.ok and ordered.state.parts == 0 and ordered.state.damage_control.kits == 0 and ordered.state.damage_control.breach == 0, "unload pays for subsequent structural repair")
	_check(not State.preview_work_order(kits, [_step("repair"), _step("unload_kit")]).ok, "cannot spend future returned materials")
	var funds := State.new_campaign()
	funds.credits = 20
	funds.battery = 30.0
	var service := State.preview_work_order(funds, [_step("recharge")])
	_check(service.ok and not State.act(service.state, "launch", {"offer_id": State.offers(service.state)[0].id}).ok, "valid order can leave insufficient launch funds: preview must not promise voyage")
	print("Stormline work order rules: %d checks, %d failures; rule fixtures only." % [checks, failures])
	quit(0 if failures == 0 else 1)

func _step(action: String, id: String = "") -> Dictionary:
	return {"action": action, "payload": {"module_id": id} if action in ["buy", "equip", "unequip"] else {}}

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + label)
