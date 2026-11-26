extends RefCounted
## Pure campaign rules. Catalog owns every mission reward, price and physical modifier.

const Catalog = preload("res://src/expedition_catalog.gd")
const Damage = preload("res://src/damage_control.gd")
const VERSION := 1
const HISTORY_LIMIT := 24
const REPAIR_COST := 14
const REPAIR_PARTS := 1
const REPAIR_AMOUNT := 25.0
const RECHARGE_COST := 10
const RECHARGE_AMOUNT := 40.0
const REPAIR_PRESSURE := 1
const RECHARGE_PRESSURE := 1
const MAX_EQUIPPED_MODULES := Catalog.MAX_SLOTS
const MAX_MODULE_LOAD := Catalog.MAX_LOAD
const INTERRUPTED_HULL_LOSS := 15.0
const INTERRUPTED_BATTERY_LOSS := 20.0
const INTERRUPTED_PRESSURE := 2
const FAILED_HULL_LOSS := 8.0
const FAILED_PRESSURE := 2
const SUCCESS_PRESSURE := 1
const MIN_LAUNCH_HULL := 20.0
const MIN_LAUNCH_BATTERY := 25.0
const WORK_ORDER_LIMIT := 12
const WORK_ORDER_ACTIONS := ["buy", "equip", "unequip", "repair", "recharge", "prepare_kit", "unload_kit"]
const STATE_KEYS := ["version", "revision", "campaign_id", "deployment", "sector", "leg", "credits", "parts", "hull", "battery", "pressure", "owned", "equipped", "path", "active", "history", "status"]
const ACTIVE_KEYS := ["token", "offer_id", "sector", "leg", "pressure", "path", "hull", "battery", "loadout"]
const HISTORY_KEYS := ["event", "offer_id", "token", "outcome", "credits_delta", "parts_delta", "hull", "battery", "pressure"]


static func new_campaign(damage_enabled: bool = false) -> Dictionary:
	var s := {"version": VERSION, "revision": 0, "campaign_id": Crypto.new().generate_random_bytes(12).hex_encode(),
		"deployment": 0, "sector": 1, "leg": 0, "credits": 180, "parts": 6,
		"hull": 100.0, "battery": 100.0, "pressure": 0, "owned": [], "equipped": [],
		"path": [], "active": {}, "history": [], "status": "dock"}
	if damage_enabled:
		s["damage_control"] = Damage.fresh()
	return s


static func validate(data: Variant) -> bool:
	if not data is Dictionary or not _extension_keys(data, STATE_KEYS):
		return false
	var s: Dictionary = data
	if s.has("damage_control") and not Damage.valid_persistent(s.damage_control):
		return false
	if not _integer(s.version, VERSION, VERSION) or not _integer(s.revision, 0, 1000000):
		return false
	if not s.campaign_id is String or s.campaign_id.length() != 24 or not s.campaign_id.is_valid_hex_number(false):
		return false
	for key in ["deployment", "credits", "parts", "pressure", "sector", "leg"]:
		var maximum: int = {"deployment": 9999, "credits": 999999, "parts": 999, "pressure": 99, "sector": 3, "leg": 1}[key]
		if not _integer(s[key], 1 if key == "sector" else 0, maximum):
			return false
	if not _number(s.hull, 0.0, 100.0) or not _number(s.battery, 0.0, 100.0):
		return false
	if not s.status is String or not s.status in ["dock", "active", "completed", "retreated"]:
		return false
	if not _modules_valid(s.owned, false) or not _modules_valid(s.equipped, true):
		return false
	for id in s.equipped:
		if not id in s.owned:
			return false
	if not _path_valid(s.path) or s.deployment < s.path.size():
		return false
	var completed: bool = s.path.size() == 6
	if completed:
		if s.status != "completed" or s.sector != 3 or s.leg != 1:
			return false
	elif s.status == "completed" or s.sector != int(s.path.size() / 2) + 1 or s.leg != s.path.size() % 2:
		return false
	if not s.active is Dictionary:
		return false
	if s.status == "active":
		if not _extension_keys(s.active, ACTIVE_KEYS) or s.deployment < 1:
			return false
		var a: Dictionary = s.active
		if a.has("damage_control") != s.has("damage_control") or (s.has("damage_control") and a.damage_control != s.damage_control):
			return false
		if not a.token is String or not a.offer_id is String or not _integer(a.sector, 1, 3) or not _integer(a.leg, 0, 1) or not _integer(a.pressure, 0, 99):
			return false
		if a.token != _token(s) or a.sector != s.sector or a.leg != s.leg or a.pressure != s.pressure:
			return false
		if a.path != s.path or a.loadout != s.equipped or a.hull != s.hull or a.battery != s.battery:
			return false
		if s.hull < MIN_LAUNCH_HULL or s.battery < MIN_LAUNCH_BATTERY or _offer(s, a.offer_id).is_empty():
			return false
	elif not s.active.is_empty():
		return false
	if not s.history is Array or s.history.size() > HISTORY_LIMIT:
		return false
	for entry in s.history:
		if not entry is Dictionary or not _extension_keys(entry, HISTORY_KEYS):
			return false
		if entry.has("damage_control") and (not s.has("damage_control") or not Damage.valid_persistent(entry.damage_control)):
			return false
		if not entry.event is String or not entry.event in ["buy", "equip", "unequip", "repair", "recharge", "launch", "settle", "recover_interrupted", "abandon", "retreat", "enable_damage", "prepare_kit", "unload_kit"]:
			return false
		if entry.event in ["enable_damage", "prepare_kit", "unload_kit"] and not entry.has("damage_control"):
			return false
		if not entry.offer_id is String or entry.offer_id.length() > 96 or not entry.token is String or entry.token.length() > 40:
			return false
		if not entry.outcome is String or not entry.outcome in ["", "success", "failed", "interrupted", "retreated"]:
			return false
		if not _integer(entry.credits_delta, -999999, 999999) or not _integer(entry.parts_delta, -999, 999):
			return false
		if not _number(entry.hull, 0, 100) or not _number(entry.battery, 0, 100) or not _integer(entry.pressure, 0, 99):
			return false
	return true


static func offers(state: Dictionary) -> Array:
	if not validate(state) or state.status != "dock":
		return []
	return Catalog.offers(int(state.sector), int(state.leg), state.path.duplicate(true), int(state.pressure)).duplicate(true)


static func launch_spec(state: Dictionary) -> Dictionary:
	if not validate(state) or state.status != "active":
		return {}
	var a: Dictionary = state.active
	var spec := {"token": a.token, "offer_id": a.offer_id,
		"contract": Catalog.build_contract(a.offer_id, int(a.pressure), a.path.duplicate(true)),
		"loadout": a.loadout.duplicate(), "hull": a.hull, "battery": a.battery,
		"pressure": int(a.pressure), "path": a.path.duplicate(true)}
	if a.has("damage_control"):
		spec["damage_control"] = a.damage_control.duplicate(true)
	return spec


static func act(state: Dictionary, action: String, payload: Dictionary = {}) -> Dictionary:
	if not validate(state):
		return _result(false, state, "远征档案无效，未作修改。")
	if action == "work_order":
		if not _keys(payload, ["steps"]) or not payload.steps is Array or payload.steps.is_empty():
			return _result(false, state, "整备工单需要至少一项操作。")
		return preview_work_order(state, payload.steps)
	var s: Dictionary = state.duplicate(true)
	if s.revision >= 1000000:
		return _result(false, state, "档案修订号已达上限。")
	if action == "restart":
		if not payload.is_empty() or not s.status in ["completed", "retreated"]:
			return _result(false, state, "先明确终止或完成当前远征，才能新开。")
		var fresh := new_campaign(s.has("damage_control"))
		fresh.revision = int(s.revision) + 1
		return _result(true, fresh, "已新开远征；旧远征不会转移奖励。保存成功后生效。")
	if s.status in ["completed", "retreated"]:
		return _result(false, state, "远征已结束，请新开远征。")
	var before_credits: int = int(s.credits)
	var before_parts: int = int(s.parts)
	var event_offer := ""
	var event_token := ""
	var outcome := ""
	var message := ""
	if action in ["settle", "recover_interrupted", "abandon"]:
		if s.status != "active":
			return _result(false, state, "没有可处理的出航；终态不能重复结算。")
		event_offer = String(s.active.offer_id)
		event_token = String(s.active.token)
		if action in ["recover_interrupted", "abandon"]:
			var return_hull: float = float(s.active.hull)
			var return_battery: float = float(s.active.battery)
			if action == "recover_interrupted":
				if not payload.is_empty():
					return _result(false, state, "中断恢复不接受额外数据。")
			else:
				if not _keys(payload, ["token", "snapshot"]) or payload.token != s.active.token or not _snapshot_valid(s, payload.snapshot, false):
					return _result(false, state, "拒绝放弃：需当前部署令牌及真实非终态快照。")
				return_hull = float(payload.snapshot.hull)
				return_battery = float(payload.snapshot.battery)
			s.hull = maxf(0, return_hull - INTERRUPTED_HULL_LOSS)
			s.battery = maxf(0, return_battery - INTERRUPTED_BATTERY_LOSS)
			if s.has("damage_control"):
				if action == "abandon":
					s.damage_control = Damage.persistent(payload.snapshot.damage_control)
				else:
					s.damage_control = {"breach": minf(Damage.MAX_BREACH, float(s.active.damage_control.breach) + Damage.INTERRUPTED_BREACH), "kits": 0}
			s.pressure = mini(99, int(s.pressure) + INTERRUPTED_PRESSURE)
			s.status = "dock"
			s.active = {}
			outcome = "interrupted"
			message = "主动放弃按实际船体/电池另扣 -15/-20、压力 +2；出航费不退，不发奖励。" if action == "abandon" else "中断返港按出航记录扣船体15、电池20、压力+2；未保存航行帧及途中消耗，不退费或发奖。"
			if s.has("damage_control"):
				message += " 保留实际破口与剩余封堵包，港内排水不等于结构修复。" if action == "abandon" else " 中断救援破口另 +0.35，预装封堵包全部损失；不恢复临时封堵或途中帧。"
		else:
			if not _keys(payload, ["token", "snapshot"]) or payload.token != s.active.token or not _snapshot_valid(s, payload.snapshot):
				return _result(false, state, "拒绝结算：令牌、任务身份、终态或快照字段不合法。")
			var snap: Dictionary = payload.snapshot
			var offer: Dictionary = _offer(s, event_offer)
			s.hull = float(snap.hull)
			s.battery = float(snap.battery)
			if s.has("damage_control"):
				s.damage_control = Damage.persistent(snap.damage_control)
			outcome = String(snap.phase)
			if outcome == "success":
				s.credits = mini(999999, int(s.credits) + floori(float(offer.reward) * float(snap.cargo_integrity) / 100.0))
				s.parts = mini(999, int(s.parts) + int(offer.parts_reward))
				s.path.append(event_offer)
				s.pressure = mini(99, int(s.pressure) + SUCCESS_PRESSURE)
				if s.path.size() == 6:
					s.status = "completed"
					message = "旗舰回收完成，六次部署远征已成功结束。"
				else:
					s.sector = int(s.path.size() / 2) + 1
					s.leg = s.path.size() % 2
					s.status = "dock"
					message = "已按舱体完整度结算，持续船损与电量已保留。"
			else:
				s.hull = maxf(0, float(s.hull) - FAILED_HULL_LOSS)
				s.pressure = mini(99, int(s.pressure) + FAILED_PRESSURE)
				s.status = "dock"
				message = "回收失败：无报酬，保留损伤/余电，救援另扣船体 8、压力 +2；可付费再试或终止。"
			s.active = {}
	else:
		if s.status != "dock":
			return _result(false, state, "航行中不能整备、再次出航或免费重开；放弃须承担中断后果。")
		match action:
			"buy", "equip", "unequip":
				if not _keys(payload, ["module_id"]) or not payload.module_id is String:
					return _result(false, state, "模块操作需要 module_id。")
				var id: String = payload.module_id
				var modules: Dictionary = Catalog.modules()
				if id == "stock" or not modules.has(id):
					return _result(false, state, "未知模块。")
				if action == "buy":
					if id in s.owned or s.credits < int(modules[id].price):
						return _result(false, state, "模块已拥有或资金不足。")
					s.credits = int(s.credits) - int(modules[id].price)
					s.owned.append(id)
				elif action == "equip":
					if not id in s.owned or id in s.equipped:
						return _result(false, state, "请先购买模块，且不能重复装备。")
					var next: Array = s.equipped.duplicate()
					next.append(id)
					if not _modules_valid(next, true):
						return _result(false, state, "最多两件模块，负载预算 3；推进与稳索不能同时装。")
					s.equipped = next
				else:
					if not id in s.equipped:
						return _result(false, state, "该模块未装备。")
					s.equipped.erase(id)
				message = "模块变更成功；下次出航按实际装备生效。"
			"repair":
				var damaged_structure: bool = s.has("damage_control") and float(s.damage_control.breach) > 0.0
				if not payload.is_empty() or (s.hull >= 100.0 and not damaged_structure) or s.credits < REPAIR_COST or s.parts < REPAIR_PARTS:
					return _result(false, state, "维修需受损船体或结构破口、14 资金及 1 材料；每次最多 +25 船体，压力 +1。")
				s.hull = minf(100, float(s.hull) + REPAIR_AMOUNT)
				if s.has("damage_control"):
					s.damage_control.breach = maxf(0.0, float(s.damage_control.breach) - Damage.REPAIR_BREACH)
				s.credits = int(s.credits) - REPAIR_COST
				s.parts = int(s.parts) - REPAIR_PARTS
				s.pressure = mini(99, int(s.pressure) + REPAIR_PRESSURE)
				message = "维修完成：最多 +25 船体，-14 资金、-1 材料、压力 +1。"
				if s.has("damage_control"):
					message += " 同时修复最多 1.0 结构破口；不返还海上耗用的封堵包。"
			"enable_damage":
				if not payload.is_empty() or s.has("damage_control"):
					return _result(false, state, "损管已启用，或操作参数无效。")
				s["damage_control"] = Damage.fresh()
				message = "已明确启用进水损管；从下一次出航起触礁可造成破口，旧损伤不追溯计算。旧程序不能读取扩展档案。"
			"prepare_kit", "unload_kit":
				if not payload.is_empty() or not s.has("damage_control"):
					return _result(false, state, "请先明确启用进水损管；封堵包操作不接受额外数据。")
				if action == "prepare_kit":
					if s.parts < 1 or s.damage_control.kits >= Damage.MAX_KITS:
						return _result(false, state, "预装一包需仓库材料 1；最多携带两包。")
					s.parts = int(s.parts) - 1
					s.damage_control.kits = int(s.damage_control.kits) + 1
					message = "已将 1 仓库材料预装成封堵包；海上完成封堵才耗用，不修复结构破口。"
				else:
					if s.damage_control.kits < 1 or s.parts >= 999:
						return _result(false, state, "没有封堵包可卸回，或仓库已满。")
					s.parts = int(s.parts) + 1
					s.damage_control.kits = int(s.damage_control.kits) - 1
					message = "已将未用封堵包卸回 1 仓库材料；不产生新材料。"
			"recharge":
				if not payload.is_empty() or s.battery >= 100.0 or s.credits < RECHARGE_COST:
					return _result(false, state, "充电需非满电池及 10 资金；每次最多 +40 电量，压力 +1。")
				s.battery = minf(100, float(s.battery) + RECHARGE_AMOUNT)
				s.credits = int(s.credits) - RECHARGE_COST
				s.pressure = mini(99, int(s.pressure) + RECHARGE_PRESSURE)
				message = "充电完成：最多 +40 电量，-10 资金、压力 +1。"
			"launch":
				if not _keys(payload, ["offer_id"]) or not payload.offer_id is String:
					return _result(false, state, "出航需要 offer_id。")
				var offer: Dictionary = _offer(s, payload.offer_id)
				if offer.is_empty() or s.credits < int(offer.launch_cost) or s.hull < MIN_LAUNCH_HULL or s.battery < MIN_LAUNCH_BATTERY or s.deployment >= 9999:
					return _result(false, state, "无法出航：合同不可用、资金不足，或船体低于20/电池低于25；可整备或终止远征。")
				s.credits = int(s.credits) - int(offer.launch_cost)
				s.deployment = int(s.deployment) + 1
				s.active = {"token": _token(s), "offer_id": offer.id, "sector": int(s.sector), "leg": int(s.leg),
					"pressure": int(s.pressure), "path": s.path.duplicate(true), "hull": float(s.hull),
					"battery": float(s.battery), "loadout": s.equipped.duplicate()}
				if s.has("damage_control"):
					s.active["damage_control"] = s.damage_control.duplicate(true)
				s.status = "active"
				event_offer = String(offer.id)
				event_token = String(s.active.token)
				message = "出航费已扣除；仅档案保存成功后才进入驾驶。"
			"retreat":
				if not payload.is_empty():
					return _result(false, state, "终止远征不接受额外数据。")
				s.status = "retreated"
				outcome = "retreated"
				message = "已明确终止远征，不补发资金；可新开一段独立远征。"
			_:
				return _result(false, state, "未知远征操作。")
	s.revision = int(s.revision) + 1
	s.history.append({"event": action, "offer_id": event_offer, "token": event_token, "outcome": outcome,
		"credits_delta": int(s.credits) - before_credits, "parts_delta": int(s.parts) - before_parts,
		"hull": float(s.hull), "battery": float(s.battery), "pressure": int(s.pressure)})
	if s.has("damage_control"):
		s.history.back()["damage_control"] = s.damage_control.duplicate(true)
	while s.history.size() > HISTORY_LIMIT:
		s.history.pop_front()
	if not validate(s):
		return _result(false, state, "操作结果未通过规则验证，未作修改。")
	return _result(true, s, message)


## A bounded, memory-only projection of the SAME dock actions. Each individual
## history event is retained, but the whole order is one Store/CAS revision.
## Any invalid step returns the untouched input; no partial purchase or service.
static func preview_work_order(state: Dictionary, steps: Array) -> Dictionary:
	if not validate(state) or state.status != "dock" or steps.size() > WORK_ORDER_LIMIT:
		return _result(false, state, "工单仅限船坞，最多 %d 项；未作修改。" % WORK_ORDER_LIMIT)
	var projected: Dictionary = state.duplicate(true)
	for index in range(steps.size()):
		var step: Variant = steps[index]
		if not step is Dictionary or not _keys(step, ["action", "payload"]) \
				or not step.action is String or not step.action in WORK_ORDER_ACTIONS or not step.payload is Dictionary:
			return _result(false, state, "工单第 %d 项不是允许的整备操作；整单未提交。" % (index + 1))
		# Reset only the preview revision, never resources/history. Every step uses
		# the real sequential funds, parts, ownership and pressure from act().
		projected.revision = int(state.revision)
		var change := act(projected, step.action, step.payload)
		if not change.ok:
			return _result(false, state, "工单第 %d 项不可执行：%s 整单未提交。" % [index + 1, change.message])
		projected = change.state
	return _result(true, projected, "整备工单已保存：%d 项，资金 %+d、材料 %+d、压力 %+d。" % [steps.size(),
		int(projected.credits) - int(state.credits), int(projected.parts) - int(state.parts), int(projected.pressure) - int(state.pressure)])


static func _snapshot_valid(s: Dictionary, data: Variant, terminal: bool = true) -> bool:
	if not data is Dictionary:
		return false
	var snap: Dictionary = data
	for key in ["expedition_token", "offer_id", "contract_id", "phase", "hull", "battery", "cargo_integrity", "time", "scanned", "tow_attached", "dock", "overload", "fail_reason"]:
		if not snap.has(key):
			return false
	var contract: Dictionary = Catalog.build_contract(s.active.offer_id, int(s.active.pressure), s.active.path)
	if contract.is_empty() or snap.expedition_token != s.active.token or snap.offer_id != s.active.offer_id or snap.contract_id != contract.base_contract:
		return false
	if snap.has("damage_control") != s.active.has("damage_control"):
		return false
	if s.active.has("damage_control") and not Damage.valid_live(snap.damage_control, s.active.damage_control):
		return false
	var flooded: bool = snap.has("damage_control") and float(snap.damage_control.water) >= 100.0
	if not snap.phase is String or not snap.phase in (["success", "failed"] if terminal else ["approach", "return"]):
		return false
	if not _number(snap.hull, 0, float(s.active.hull)) or not _number(snap.battery, 0, float(s.active.battery)):
		return false
	if not _number(snap.cargo_integrity, 0, 100) or not _number(snap.time, 0, float(contract.deadline) + 1.0):
		return false
	if not _number(snap.dock, 0, 1) or not _number(snap.overload, 0, 1) or not snap.scanned is bool or not snap.tow_attached is bool:
		return false
	if not snap.fail_reason is String or snap.fail_reason.length() > 256:
		return false
	if not terminal:
		return not flooded and snap.hull > 0 and snap.battery > 0 and snap.cargo_integrity > 0 and snap.time < float(contract.deadline) and snap.overload < 1 and snap.dock < 1 and snap.fail_reason.is_empty() and (snap.phase != "return" or (snap.scanned and snap.tow_attached))
	if snap.phase == "success":
		if contract.has("tide_stations"):
			var survey: Variant = snap.get("tide_survey")
			if not survey is Dictionary or not _integer(survey.get("completed"), contract.tide_stations.size(), contract.tide_stations.size()):
				return false
		return not flooded and snap.scanned and snap.tow_attached and is_equal_approx(float(snap.dock), 1.0) and snap.hull > 0 and snap.battery > 0 and snap.cargo_integrity > 0 and snap.time < float(contract.deadline) and snap.fail_reason.is_empty()
	return not snap.fail_reason.is_empty() and (flooded or snap.hull <= 0 or snap.battery <= 0 or snap.cargo_integrity <= 0 or snap.time >= float(contract.deadline) or snap.overload >= 1)


static func _path_valid(path: Variant) -> bool:
	if not path is Array or path.size() > 6:
		return false
	var prefix: Array = []
	for index in range(path.size()):
		if not path[index] is String:
			return false
		var found := false
		for offer in Catalog.offers(int(index / 2) + 1, index % 2, prefix.duplicate(), 0):
			if offer.id == path[index]:
				found = true
				break
		if not found:
			return false
		prefix.append(path[index])
	return true


static func _modules_valid(ids: Variant, equipped: bool) -> bool:
	if not ids is Array or ids.size() > (MAX_EQUIPPED_MODULES if equipped else 3):
		return false
	if equipped:
		return not Catalog.loadout_effects(ids).is_empty()
	var seen: Array = []
	var modules: Dictionary = Catalog.modules()
	for id in ids:
		if not id is String or id == "stock" or not modules.has(id) or id in seen:
			return false
		seen.append(id)
	return true


static func _offer(s: Dictionary, id: Variant) -> Dictionary:
	if not id is String:
		return {}
	for offer in Catalog.offers(int(s.sector), int(s.leg), s.path.duplicate(true), int(s.pressure)):
		if offer.id == id:
			return offer.duplicate(true)
	return {}


static func _token(s: Dictionary) -> String:
	return "%s:%d" % [s.campaign_id, int(s.deployment)]


static func _keys(value: Dictionary, expected: Array) -> bool:
	if value.size() != expected.size():
		return false
	for key in expected:
		if not value.has(key):
			return false
	return true


static func _extension_keys(value: Dictionary, base: Array) -> bool:
	var expected := base.duplicate()
	if value.has("damage_control"):
		expected.append("damage_control")
	return _keys(value, expected)


static func _integer(value: Variant, low: int, high: int) -> bool:
	return _number(value, low, high) and float(value) == floor(float(value))


static func _number(value: Variant, low: float, high: float) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) >= low and float(value) <= high


static func _result(ok: bool, state: Dictionary, message: String) -> Dictionary:
	return {"ok": ok, "state": state.duplicate(true), "message": message}
