extends SceneTree
## RULE FIXTURES: terminal dictionaries below are deliberate rules input, not driving.

const State = preload("res://src/expedition_state.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
var _failures: Array = []
var _checks := 0


func _init() -> void:
	var fresh := State.new_campaign()
	_check(State.validate(fresh), "new campaign validates")
	_check(not State.validate({}), "empty archive rejected")
	for key in fresh:
		var missing := fresh.duplicate(true)
		missing.erase(key)
		_check(not State.validate(missing), "missing %s rejected" % key)
	for value in [NAN, INF, -1, 100.01, "100", true]:
		var bad := fresh.duplicate(true)
		bad.hull = value
		_check(not State.validate(bad), "bad hull rejected")
	var extra := fresh.duplicate(true)
	extra.untrusted = 1
	_check(not State.validate(extra), "unknown state key rejected")
	var before := fresh.duplicate(true)
	var bought := State.act(fresh, "buy", {"module_id": "drive"})
	_check(bought.ok and fresh == before, "buy leaves input deeply immutable")
	bought.state.owned.append("sonar")
	_check(fresh == before, "result cannot alias original")
	_check(not State.act(fresh, "equip", {"module_id": "drive"}).ok, "unowned equip denied")
	_check(not State.act(fresh, "buy", {"module_id": "stock"}).ok, "stock not purchasable")
	_check(not State.act(fresh, "repair").ok and not State.act(fresh, "recharge").ok, "no paid full repairs")
	var forged := fresh.duplicate(true)
	forged.path = ["cross-current-recovery-safe"]
	_check(not State.validate(forged), "wrong sequence path rejected")
	for build in [["drive", "sonar"], ["tow", "sonar"]]:
		_full_rule_journey(build)
	_failure_and_interruption()
	_branch_pressure()
	if _failures.is_empty():
		print("PASS expedition_state RULE FIXTURES checks=%d (not natural driving)" % _checks)
		quit(0)
	else:
		for failure in _failures:
			print("FAIL expedition_state: " + failure)
		quit(1)


func _full_rule_journey(build: Array) -> void:
	var s := State.new_campaign()
	for id in build:
		s = _apply(s, "buy", {"module_id": id})
		s = _apply(s, "equip", {"module_id": id})
	_check(s.credits >= int(State.offers(s)[0].launch_cost), "complete build retains first launch fee")
	var other: String = "tow" if "drive" in build else "drive"
	var loaded := s.duplicate(true)
	loaded.owned.append(other)
	_check(not State.act(loaded, "equip", {"module_id": other}).ok, "slot/load ceiling")
	var previous_token := ""
	for deployment in range(6):
		if s.battery < 80:
			s = _apply(s, "recharge")
		if s.hull < 80:
			s = _apply(s, "repair")
		var choices := State.offers(s)
		_check(not choices.is_empty(), "next leg offers available")
		if choices.is_empty():
			return
		var chosen: Dictionary = choices[0 if "drive" in build else mini(2, choices.size() - 1)]
		s = _apply(s, "launch", {"offer_id": chosen.id})
		var spec := State.launch_spec(s)
		_check(spec.token != previous_token and spec.path == s.path and spec.loadout == s.equipped, "unique bound spec")
		previous_token = spec.token
		_check(spec.contract == Catalog.build_contract(chosen.id, s.pressure, s.path), "contract rebuilt by catalog")
		_check(not State.act(s, "repair").ok and not State.act(s, "launch", {"offer_id": chosen.id}).ok, "active state locked")
		var snap := terminal_fixture(s, "success", maxf(1, s.hull - 7), maxf(1, s.battery - 36), 88)
		var wrong := snap.duplicate(true)
		wrong.expedition_token = "other:1"
		_check(not State.act(s, "settle", {"token": spec.token, "snapshot": wrong}).ok, "foreign snapshot token denied")
		wrong = snap.duplicate(true)
		wrong.offer_id = "other-offer"
		_check(not State.act(s, "settle", {"token": spec.token, "snapshot": wrong}).ok, "cross-mission denied")
		wrong = snap.duplicate(true)
		wrong.phase = "return"
		_check(not State.act(s, "settle", {"token": spec.token, "snapshot": wrong}).ok, "nonterminal denied")
		var old := s.duplicate(true)
		var paid := State.act(s, "settle", {"token": spec.token, "snapshot": snap})
		_check(paid.ok and s == old, "settle immutable")
		if not paid.ok:
			return
		s = paid.state
		_check(s.credits == int(old.credits) + floori(float(chosen.reward) * 0.88), "integrity scales reward once")
		_check(s.path.size() == deployment + 1 and s.hull == snap.hull and s.battery == snap.battery, "path and damage persisted")
		_check(not State.act(s, "settle", {"token": spec.token, "snapshot": snap}).ok, "duplicate settlement denied")
	_check(s.status == "completed" and s.path.size() == 6 and State.offers(s).is_empty(), "six rule fixture deliveries end flagship")
	var restart := State.act(s, "restart")
	_check(restart.ok and restart.state.revision == s.revision + 1 and restart.state.campaign_id != s.campaign_id and restart.state.credits == 180, "ended campaign explicit fresh identity")
	_check(s.history.size() <= State.HISTORY_LIMIT, "bounded history")


func _failure_and_interruption() -> void:
	var s := State.new_campaign()
	var first: Dictionary = State.offers(s)[0]
	s = _apply(s, "launch", {"offer_id": first.id})
	var token: String = s.active.token
	var snap := terminal_fixture(s, "failed", 59, 31, 80)
	var before := s.duplicate(true)
	s = _apply(s, "settle", {"token": token, "snapshot": snap})
	_check(s.credits == before.credits and s.hull == 51 and s.battery == 31 and s.pressure == 2 and s.path.is_empty(), "failure keeps loss, no cash or progress")
	s = _apply(s, "repair")
	_check(s.hull == 76 and s.credits == int(before.credits) - 14 and s.parts == 5 and s.pressure == 3, "repair coupled cost")
	s = _apply(s, "recharge")
	_check(s.battery == 71 and s.pressure == 4, "recharge coupled pressure")
	s = _apply(s, "launch", {"offer_id": first.id})
	_check(s.active.token != token, "paid retry creates distinct token")
	_check(not State.act(s, "settle", {"token": token, "snapshot": snap}).ok, "out-of-order old settlement denied")
	before = s.duplicate(true)
	s = _apply(s, "recover_interrupted")
	_check(s.hull == before.hull - 15 and s.battery == before.battery - 20 and s.pressure == before.pressure + 2 and s.credits == before.credits, "interruption charges explicit resource losses")
	_check(not State.act(s, "recover_interrupted").ok, "interruption cannot double apply")
	var abandoned := _apply(s, "launch", {"offer_id": first.id})
	var underway := terminal_fixture(abandoned, "success", 12, 9, 70)
	underway.phase = "return"
	underway.dock = 0.0
	var returned := _apply(abandoned, "abandon", {"token": abandoned.active.token, "snapshot": underway})
	_check(returned.hull == 0 and returned.battery == 0 and returned.credits == abandoned.credits and returned.pressure == abandoned.pressure + 2, "real depleted abandonment never restores resources")
	_check(not State.act(returned, "abandon", {"token": abandoned.active.token, "snapshot": underway}).ok, "abandon once only")
	underway.expedition_token = token
	_check(not State.act(abandoned, "abandon", {"token": abandoned.active.token, "snapshot": underway}).ok, "stale snapshot abandonment denied")
	_check(not State.act(abandoned, "abandon", {}).ok, "manual abandon requires live snapshot")
	_check(not State.act(s, "restart").ok, "cannot free restart live campaign")
	var poor := State.new_campaign()
	poor.credits = 0
	poor.parts = 0
	poor.hull = 0
	poor.battery = 0
	_check(not State.act(poor, "launch", {"offer_id": first.id}).ok and not State.act(poor, "repair").ok, "bankrupt cannot get hidden subsidies")
	poor = _apply(poor, "retreat")
	poor = _apply(poor, "restart")
	_check(poor.status == "dock" and poor.credits == 180, "poor explicit termination permits independent new expedition")
	for i in range(40):
		poor = _apply(poor, "buy", {"module_id": "sonar"}) if i == 0 else poor
		poor = _apply(poor, "equip" if i % 2 == 0 else "unequip", {"module_id": "sonar"})
	_check(poor.history.size() == State.HISTORY_LIMIT, "history evicts oldest entries")
	var invalid := terminal_fixture(before, "failed", before.hull, before.battery, 100)
	invalid.overload = 0
	_check(not State.act(before, "settle", {"token": before.active.token, "snapshot": invalid}).ok, "unexplained fake failed snapshot rejected")
	for reason in ["hull", "battery", "cargo_integrity", "time", "overload"]:
		var failure := terminal_fixture(before, "failed", before.hull, before.battery, 80)
		failure.overload = 0
		failure[reason] = State.launch_spec(before).contract.deadline if reason == "time" else (1.0 if reason == "overload" else 0.0)
		_check(State.act(before, "settle", {"token": before.active.token, "snapshot": failure}).ok, "physical failed threshold accepted: " + reason)
	for key in ["hull", "battery", "cargo_integrity", "time", "dock", "overload"]:
		var invalid_number := terminal_fixture(before, "success", before.hull, before.battery, 80)
		invalid_number[key] = NAN
		_check(not State.act(before, "settle", {"token": before.active.token, "snapshot": invalid_number}).ok, "snapshot nonfinite rejected: " + key)
	var healing := terminal_fixture(before, "success", minf(100, before.hull + 1), before.battery, 80)
	_check(not State.act(before, "settle", {"token": before.active.token, "snapshot": healing}).ok, "snapshot cannot heal beyond departure")


func _branch_pressure() -> void:
	var initial := State.new_campaign()
	var choices := State.offers(initial)
	_check(choices.size() >= 4, "survey/salvage and risk choices")
	var paths: Array = []
	for choice_index in [0, 2]:
		var s := _apply(initial, "launch", {"offer_id": choices[choice_index].id})
		s = _apply(s, "settle", {"token": s.active.token, "snapshot": terminal_fixture(s)})
		paths.append(s)
	var left_offer: Dictionary = State.offers(paths[0])[0]
	var right_offer: Dictionary = State.offers(paths[1])[0]
	var left := Catalog.build_contract(left_offer.id, paths[0].pressure, paths[0].path)
	var right := Catalog.build_contract(right_offer.id, paths[1].pressure, paths[1].path)
	_check(left.severity != right.severity or left.deadline != right.deadline or left.mass != right.mass, "successful branch changes actual next contract")
	var pressure_contract := Catalog.build_contract(left_offer.id, int(paths[0].pressure) + 5, paths[0].path)
	_check(left.severity != pressure_contract.severity or left.deadline != pressure_contract.deadline, "pressure changes real sea/weather contract")


static func terminal_fixture(s: Dictionary, phase: String = "success", hull_value: float = 90, battery_value: float = 60, cargo: float = 95) -> Dictionary:
	var spec := State.launch_spec(s)
	return {"expedition_token": spec.token, "offer_id": spec.offer_id, "contract_id": spec.contract.base_contract,
		"phase": phase, "hull": hull_value, "battery": battery_value, "cargo_integrity": cargo,
		"time": 45.0, "scanned": true, "tow_attached": phase == "success", "dock": 1.0 if phase == "success" else 0.0,
		"overload": 0.0 if phase == "success" else 1.0, "fail_reason": "" if phase == "success" else "拖缆持续过载后断裂。"}


func _apply(s: Dictionary, action: String, payload: Dictionary = {}) -> Dictionary:
	var before := s.duplicate(true)
	var result := State.act(s, action, payload)
	_check(result.ok, "%s: %s" % [action, result.message])
	_check(s == before, action + " immutable input")
	return result.state


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
