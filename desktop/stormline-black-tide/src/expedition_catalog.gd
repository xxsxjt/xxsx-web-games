extends RefCounted
## Single source for expedition quotes and validated mission overlays. Geometry
## and gameplay rules belong to StormSim, never to the catalog or save file.

const MAX_SLOTS := 2
const MAX_LOAD := 3
const MAX_PRESSURE := 99
const EFFECTIVE_PRESSURE_CAP := 12
const TIDE_RADIUS := 13.0
const TIDE_SPEED := 4.0
const TIDE_WORK := 2.5 # Seconds of uninterrupted sampling with the stock Search profile.

# Chart stations are explicit and authored, not save-supplied geometry.
const _TIDE_STATIONS := [
	[Vector2(14, -17), Vector2(39, -55)],
	[Vector2(-59, -12), Vector2(-14, -59)],
	[Vector2(65, -13), Vector2(42, -42)],
]

const _SECTORS := [
	{"base": "black-tide", "name": "黑潮水域", "wind_angle": 0.28,
		"survey": {"name": "防波堤潮标勘测", "severity": 0.40, "mass": 1.75, "deadline": 157.0},
		"salvage": {"name": "失事补给舱打捞", "severity": 0.48, "mass": 2.30, "deadline": 145.0},
		"recovery": {"name": "黑潮航路主回收", "severity": 0.52, "mass": 2.60, "deadline": 151.0}},
	{"base": "needle-bank", "name": "针礁水道", "wind_angle": 2.33,
		"survey": {"name": "针礁流标勘测", "severity": 0.53, "mass": 2.10, "deadline": 191.0},
		"salvage": {"name": "针礁储备舱打捞", "severity": 0.61, "mass": 2.62, "deadline": 188.0},
		"recovery": {"name": "针礁航路主回收", "severity": 0.65, "mass": 2.90, "deadline": 194.0}},
	{"base": "cross-current", "name": "碎潮回廊", "wind_angle": 1.18,
		"survey": {"name": "碎潮交汇区勘测", "severity": 0.57, "mass": 2.22, "deadline": 215.0},
		"salvage": {"name": "外海储备舱打捞", "severity": 0.64, "mass": 2.70, "deadline": 208.0},
		"recovery": {"name": "旗舰回收：风暴线号", "severity": 0.69, "mass": 3.35, "deadline": 215.0}},
]
const _ECONOMY := {
	"survey": {"cost": 18, "reward": 56, "sector_bonus": 15, "parts": 1, "risk_reward": 26},
	"salvage": {"cost": 23, "reward": 68, "sector_bonus": 17, "parts": 2, "risk_reward": 32},
	"chart": {"cost": 30, "reward": 64, "sector_bonus": 15, "parts": 1, "risk_reward": 30},
	"recovery": {"cost": 27, "reward": 86, "sector_bonus": 20, "parts": 2, "risk_reward": 35},
}
const _MODULES := {
	"drive": {"id": "drive", "name": "增压推进器", "price": 96, "load": 2,
		"description": "油门推进更强；整航次耗电更快。慢航限速不变。",
		"effects": {"thrust": 1.15, "energy": 1.16}},
	"tow": {"id": "tow", "name": "稳索配重架", "price": 92, "load": 2,
		"description": "拖缆额定载荷提高，横向漂移更易制止；船更重，响应和转向变慢。",
		"effects": {"rating": 1.25, "stability": 1.14, "mass": 1.09}},
	"sonar": {"id": "sonar", "name": "脉冲声纳", "price": 48, "load": 1,
		"description": "在原扫描距离和限速内更快锁定信号；整航次耗电增加，扫描时额外耗电。",
		"effects": {"sensors": 1.46, "energy": 1.07}},
}
const _RISKS := ["safe", "high"]


static func offers(sector: int, leg: int, path: Array, pressure: int) -> Array:
	if sector < 1 or sector > _SECTORS.size() or leg < 0 or leg > 1 \
			or path.size() != (sector - 1) * 2 + leg or not _valid_path(path) \
			or pressure < 0 or pressure > MAX_PRESSURE:
		return []
	var result: Array = []
	for branch: String in _branches(leg):
		for risk: String in _RISKS:
			result.append(_entry(sector, leg, branch, risk, path, pressure))
	return result


static func build_contract(offer_id: String, pressure: int, path: Array) -> Dictionary:
	if path.size() >= _SECTORS.size() * 2 or offer_id.length() > 64:
		return {}
	# A valid prefix determines the only chapter currently available. A caller
	# cannot reuse another chapter's offer or feed us world coordinates.
	for offer: Dictionary in offers((path.size() >> 1) + 1, path.size() % 2, path, pressure):
		if offer.id == offer_id:
			offer.erase("summary")
			return offer
	return {}


static func modules() -> Dictionary:
	return _MODULES.duplicate(true)


static func sector_name(sector: int) -> String:
	return String(_SECTORS[sector - 1].name) if sector >= 1 and sector <= _SECTORS.size() else ""


## Stock is an empty loadout, not an equipable module. An empty result is invalid.
static func loadout_effects(loadout: Array) -> Dictionary:
	if loadout.size() > MAX_SLOTS:
		return {}
	var effects := {"thrust": 1.0, "energy": 1.0, "rating": 1.0, "sensors": 1.0, "stability": 1.0, "mass": 1.0}
	var seen: Array[String] = []
	var load := 0
	for id: Variant in loadout:
		if not id is String or not _MODULES.has(id) or id in seen:
			return {}
		seen.append(id)
		var module: Dictionary = _MODULES[id]
		load += int(module.load)
		if load > MAX_LOAD:
			return {}
		for effect: String in module.effects:
			effects[effect] = float(effects[effect]) * float(module.effects[effect])
	return effects


static func _branches(leg: int) -> Array:
	return ["survey", "salvage", "chart"] if leg == 0 else ["recovery"]


static func _offer_id(sector: int, branch: String, risk: String) -> String:
	return "%s-%s-%s" % [_SECTORS[sector - 1].base, branch, risk]


static func _valid_path(path: Array) -> bool:
	for index in path.size():
		var id: Variant = path[index]
		if not id is String:
			return false
		var known := false
		for branch: String in _branches(index % 2):
			for risk: String in _RISKS:
				known = known or id == _offer_id((index >> 1) + 1, branch, risk)
		if not known:
			return false
	return true


static func _route_intel(sector: int, path: Array) -> float:
	var intel := 0.0
	# Survey brings back a tide logger: better routing and a drier lift on the
	# next recovery. Salvage supplies the yard, but does not chart the window.
	# Charts carry forward to adjacent waters at reduced weight.
	for index in range(0, path.size(), 2):
		var source_sector := (index >> 1) + 1
		var id: String = path[index]
		var survey := id.contains("-survey-")
		var high := id.ends_with("-high")
		var contribution := (1.25 if high else 1.0) if survey else (-0.50 if high else -0.35)
		if id.contains("-chart-"):
			contribution = 1.60 if high else 1.35
		intel += contribution * (1.0 if source_sector == sector else 0.30)
	return intel


static func _charted_flow_scale(high: bool) -> float:
	return 0.60 if high else 0.70


static func _entry(sector: int, leg: int, branch: String, risk: String, path: Array, pressure: int) -> Dictionary:
	var sea: Dictionary = _SECTORS[sector - 1]
	var mission: Dictionary = sea[branch] if branch != "chart" else {
		"name": "实测制图", "severity": float(sea.survey.severity) + 0.025,
		"mass": float(sea.survey.mass) + 0.12, "deadline": float(sea.survey.deadline) + 8.0,
	}
	var economy: Dictionary = _ECONOMY[branch]
	var high := risk == "high"
	var flagship := sector == _SECTORS.size() and leg == 1
	var intel := _route_intel(sector, path)
	var delay := float(mini(pressure, EFFECTIVE_PRESSURE_CAP))
	var current_scale := 1.0
	if leg == 1 and String(path.back()).contains("-chart-"):
		current_scale = _charted_flow_scale(String(path.back()).ends_with("-high"))
	var task_text: String
	match branch:
		"survey":
			task_text = "扫描并拖回潮标。观测资料会减轻后续回收的海况和吊载，延长窗口。"
		"salvage":
			task_text = "扫描并带回沉重的储备舱，赚取更多资金和材料；缺少潮标资料会收紧后续窗口。"
		"chart":
			task_text = "依次到 A、B 测站：%.0f 米内、低于 %.1f m/s，按住 E（标准搜索档约 %.1f 秒）。松键、越界或超速清零本站进度；已成样本保留。途中松开 E 省电。仍须锁定、挂索并交付；成功令同区主回收的涡流项降至通常值的 %.0f%%。" % [TIDE_RADIUS, TIDE_SPEED, TIDE_WORK, _charted_flow_scale(high) * 100.0]
		_:
			task_text = "扫描并拖回风暴线号的旗舰核心。重载返程需给尾舱留足外弯。" if flagship \
				else "扫描并拖回主回收舱。海况、吊载和窗口受前序航路及整备耽搁影响。"
			if current_scale < 1.0:
				task_text += "实测已锁定缓流时窗：局部涡流强度为当前海况通常值的 %.0f%%；不降低基础漂流。" % (current_scale * 100.0)
	var risk_text := "冒险窗口：海况更强，舱更重，时限更短；成本与报酬均提高。" if high \
		else "保守窗口：海况较平，吊载较轻，留有更多返航时间。"
	var offer := {
		"id": _offer_id(sector, branch, risk), "name": "%s · %s" % [mission.name, "冒险" if high else "保守"],
		"briefing": "%s%s" % [task_text, risk_text], "summary": task_text,
		"base_contract": sea.base, "sector": sector, "sector_name": sector_name(sector), "leg": leg,
		"risk": risk, "branch": "flagship" if flagship else branch, "flagship": flagship,
		"reward": int(economy.reward) + int(economy.sector_bonus) * (sector - 1) + (int(economy.risk_reward) if high else 0),
		"parts_reward": int(economy.parts) + int(high and branch in ["salvage", "recovery"]) + int(flagship),
		"launch_cost": int(economy.cost) + 4 * (sector - 1) + (8 if high else 0),
		# These are the actual initial sea state, tow-body mass, and deadline,
		# not a separate difficulty rating. Per-tick weather is still StormSim's.
		"severity": roundf(clampf(float(mission.severity) + (0.095 if high else 0.0) + delay * 0.009 - intel * 0.055, 0.30, 0.90) * 1000.0) / 1000.0,
		"mass": roundf((float(mission.mass) + (0.39 if high else 0.0) + delay * 0.022 - intel * 0.22) * 100.0) / 100.0,
		"deadline": roundf(float(mission.deadline) - (12.0 if high else 0.0) - delay * 1.35 + intel * 11.0),
		"wind_angle": float(sea.wind_angle) + (0.19 if high else 0.0),
	}
	if branch == "chart":
		offer["tide_stations"] = _TIDE_STATIONS[sector - 1].duplicate()
	if current_scale < 1.0:
		offer["current_scale"] = current_scale
	return offer
