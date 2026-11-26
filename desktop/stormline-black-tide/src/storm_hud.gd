extends CanvasLayer
## Snapshot-driven cockpit and menus. Game input, rules and saving live in the caller.

signal contract_selected(id: String)
signal start_requested
signal pause_requested
signal restart_requested
signal briefing_requested
signal mute_requested
signal quit_requested
signal expedition_requested
signal navigation_requested(action: String, value: String)
signal segment_requested(action: String)

const Radar = preload("res://src/radar.gd")
const Sim = preload("res://src/storm_sim.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const Damage = preload("res://src/damage_control.gd")
const Segments = preload("res://src/voyage_segments.gd")
const ATTACH_RELATIVE_SPEED := Sim.ATTACH_RELATIVE_SPEED
# Matches the raw-tension gate and snapshot cap in storm_sim.step().
const TOW_RATED_LOAD := 1.0
const TOW_DISPLAY_LIMIT := 1.5
const POWER_NAMES := ["推进", "搜索", "稳索"]
const TEXT := Color("e9f5fa")
const DIM := Color("a9c4d3")
const TEAL := Color("8bebe0")
const GREEN := Color("9fdfb2")
const AMBER := Color("ffc18a")
const LILAC := Color("c8b6f4")
const PANEL := Color(0.039, 0.089, 0.137, 0.95)
const RULE := Color("315062")
const HUD_EDGE := 24.0
const MIN_DESKTOP_SIZE := Vector2i(960, 600)
const DESIGN_SIZE := Vector2(1440.0, 900.0)
const KEYS_DRIVE := "W/S 或 ↑/↓  油门（前进／倒车）    ·    A/D 或 ←/→  转向    ·    E  长按声纳    ·    Space  挂索"
const KEYS_TOW := "1 推进 / 2 搜索 / 3 稳索    ·    按住 Shift 慢车    ·    Q 收绳 / F 放绳    ·    P/Esc 暂停／继续    ·    R 重开    ·    M 静音"
const KEYS_EXPEDITION := "1/2/3 动力档    ·    Shift 慢车    ·    Q 收 / F 放    ·    P/Esc 暂停／继续    ·    远征禁用 R 重开    ·    M 静音"

var _contracts: Dictionary = {}
var _records: Dictionary = {}
var _contract_id := ""
var _screen := ""
var _muted := false
var _interface_root: Control

var _live: Control
var _curtain: ColorRect
var _menus: Dictionary = {}
var _mute_buttons: Array[Button] = []
var _mission: Label
var _clock: Label
var _phase: Label
var _objective: Label
var _notice: Label
var _warning: Label
var _radar: Radar
var _ranges: Label
var _dock: PanelContainer
var _dock_progress: Label
var _dock_tug: Label
var _dock_cargo: Label
var _dock_meter: ProgressBar
var _dock_instruction: Label
var _gauges: Dictionary = {}
var _speed: Label
var _wind: Label
var _power: Label
var _energy_status: Label
var _rig: Label
var _rope: Label
var _tow_action: Label
var _keys_tow: Label
var _damage_status: Label

var _contract_cards: Dictionary = {}
var _brief_name: Label
var _brief_subtitle: Label
var _brief_copy: Label
var _brief_deadline: Label
var _brief_best: Label
var _launch: Button
var _pause_summary: Label
var _result_title: Label
var _result_subtitle: Label
var _result_message: Label
var _result_score: Label
var _result_grade: Label
var _result_stats: Dictionary = {}
var _result_record: Label
var _result_best: Label
var _result_overview: VBoxContainer
var _review_button: Button
var _review_panel: PanelContainer
var _review_scroll: ScrollContainer
var _review_summary: Label
var _review_coverage: Label
var _review_timeline: Label
var _review_advice: Label
var _review_view: Dictionary = {}
var _navigation_panel: PanelContainer
var _navigation_summary: Label
var _navigation_detail: Label
var _navigation_pick: OptionButton
var _navigation_ids: Array[String] = []
var _segment_panel: PanelContainer
var _segment_status: Label
var _segment_buttons: Dictionary = {}

func _ready() -> void:
	layer = 15
	process_mode = Node.PROCESS_MODE_ALWAYS
	var window := get_window()
	if window == get_tree().root:
		window.min_size = window.min_size.max(MIN_DESKTOP_SIZE)
	var root := Control.new()
	_interface_root = root
	root.name = "StormlineInterface"
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = make_theme()
	add_child(root)
	# Honor the actual logical viewport, including embedding without project stretch.
	get_viewport().size_changed.connect(_fit_interface)
	_fit_interface()

	_live = Control.new()
	_live.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_live)
	_live.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_build_live()

	_curtain = ColorRect.new()
	_curtain.color = Color(0.012, 0.027, 0.048, 0.74)
	_curtain.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(_curtain)
	_curtain.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_curtain.add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_build_briefing(center)
	_build_pause(center)
	_build_debrief(center)
	_refresh_briefing()
	_show_screen("briefing")


func _fit_interface() -> void:
	var dimensions := get_viewport().get_visible_rect().size
	if dimensions.x <= 0.0 or dimensions.y <= 0.0:
		return
	var factor := minf(1.0, minf(dimensions.x / DESIGN_SIZE.x, dimensions.y / DESIGN_SIZE.y))
	_interface_root.scale = Vector2.ONE * factor
	_interface_root.size = dimensions / factor

func configure(contracts: Dictionary, best_records: Dictionary) -> void:
	_contracts = contracts
	_records = best_records
	if not _contracts.has(_contract_id):
		_contract_id = ""
		for id: String in Sim.CONTRACTS:
			if _contracts.has(id):
				_contract_id = id
				break
	if is_node_ready():
		_refresh_briefing()

func present(view: Dictionary) -> void:
	if not is_node_ready():
		return
	var screen := String(view.get("screen", "briefing"))
	if bool(view.get("expedition_ui", false)) and screen != "running":
		_show_screen("expedition")
		_curtain.hide()
		return
	if screen != "running" and not _menus.has(screen):
		screen = "briefing"
	var id := String(view.get("contract_id", _contract_id))
	var selected_changed := _contracts.has(id) and id != _contract_id
	if selected_changed:
		_contract_id = id
	if screen == "briefing" and (selected_changed or screen != _screen):
		_refresh_briefing()
	_show_screen(screen)
	_present_audio(bool(view.get("muted", false)))

	var contract := _dictionary(_contracts.get(_contract_id, {}))
	match screen:
		"running", "paused":
			_present_live(view, contract)
			if screen == "paused":
				_pause_summary.text = "%s   /   %s   /   已用 %s" % [_mission.text, _phase.text, _time(float(view.get("time", 0.0)))]
		"debrief":
			_present_report(view, contract)

func _show_screen(screen: String) -> void:
	if _screen == screen:
		return
	_screen = screen
	if screen != "debrief" and is_instance_valid(_review_button):
		_review_view.clear()
		for label: Label in [_review_summary, _review_coverage, _review_timeline, _review_advice]:
			label.text = ""
		_review_scroll.scroll_vertical = 0
		_review_button.set_pressed_no_signal(false)
		_set_review_open(false)
	_live.visible = screen == "running" or screen == "paused"
	_curtain.visible = screen != "running"
	for id in _menus:
		_menus[id].visible = id == screen

func _present_audio(muted: bool) -> void:
	if muted == _muted:
		return
	_muted = muted
	for button in _mute_buttons:
		button.text = "声音：关闭 [M]" if muted else "声音：开启 [M]"

func _build_live() -> void:
	var port := _column(_live, 12)
	_pin(port, false, false, 378.0, 0.0)
	var mission_box := _column(_panel(port, true), 7)
	_label(mission_box, "STORMLINE  /  航行指令", 16, TEAL)
	_mission = _label(mission_box, "", 27)
	var state := _row(mission_box, 10)
	_phase = _label(state, "", 18, TEAL)
	_phase.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_clock = _label(state, "", 18, DIM)
	_rule(mission_box)
	_objective = _label(mission_box, "", 20, TEXT, true)
	_notice = _label(mission_box, "", 18, DIM, true)
	_warning = _label(mission_box, "", 18, AMBER, true)
	_damage_status = _label(mission_box, "", 17, TEAL, true)
	_damage_status.hide()

	# Center the harbor card in the free column between chart and helm/system
	# cards. Nesting it in the mission stack makes that stack hit the systems at
	# small viewports as soon as the two-body docking card becomes visible.
	_dock = _panel(_live, true)
	_dock.anchor_left = 0.5
	_dock.anchor_right = 0.5
	_dock.anchor_top = 0.5
	_dock.anchor_bottom = 0.5
	_dock.offset_left = -200.0
	_dock.offset_right = 200.0
	_dock.offset_top = -90.0
	_dock.offset_bottom = 90.0
	_dock.custom_minimum_size = Vector2(400.0, 0.0)
	_dock.hide()
	var dock_box := _column(_dock, 5)
	_dock_progress = _label(dock_box, "", 18, TEAL)
	var dock_status := _row(dock_box, 12)
	_dock_tug = _label(dock_status, "", 18)
	_dock_cargo = _label(dock_status, "", 18)
	_dock_meter = _rail(dock_box, 1.0, GREEN, 6)
	_dock_meter.step = 0.0 # Preserve normalized simulation ticks; other rails use percent steps.
	_dock_instruction = _label(dock_box, "", 17, DIM, true)

	var chart := _panel(_live, true)
	_pin(chart, true, false, 324.0, 0.0)
	var chart_box := _column(chart, 6)
	var chart_head := _row(chart_box, 8)
	var chart_name := _label(chart_head, "海图 / 北向上", 20, TEAL)
	chart_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(chart_head, "暂停", func() -> void: pause_requested.emit(), false, Vector2(70, 38))
	_radar = Radar.new()
	_radar.custom_minimum_size = Vector2(0, 238)
	chart_box.add_child(_radar)
	var legend := GridContainer.new()
	legend.columns = 3
	legend.mouse_filter = Control.MOUSE_FILTER_IGNORE
	legend.add_theme_constant_override("h_separation", 11)
	legend.add_theme_constant_override("v_separation", 2)
	chart_box.add_child(legend)
	for item in [["▲ 拖船", Radar.TUG], ["□ 港区", Radar.HARBOR], ["○ 信号区", Radar.SIGNAL], ["◆ 回收舱", Radar.CARGO], ["× 礁区", Radar.REEF], ["≋ 水流", Radar.CURRENT]]:
		_label(legend, item[0], 18, item[1])
	_rule(chart_box)
	_ranges = _label(chart_box, "", 18, TEXT, true)

	var systems := _panel(_live)
	_pin(systems, false, true, 378.0, -76.0)
	var meters := _column(systems, 8)
	_label(meters, "船载状态  /  SYSTEMS", 16, TEAL)
	_add_gauge(meters, "hull", "拖船船体", GREEN)
	_add_gauge(meters, "cargo", "回收舱完整度", GREEN)
	_add_gauge(meters, "battery", "电量", TEAL)
	_add_gauge(meters, "tension", "拖缆张力", AMBER, TOW_DISPLAY_LIMIT * 100.0)
	_add_gauge(meters, "sonar_load", "声纳锁定", LILAC)

	var helm := _panel(_live)
	_pin(helm, true, true, 324.0, -76.0)
	var helm_box := _column(helm, 7)
	_label(helm_box, "驾驶台  /  TELEMETRY", 16, TEAL)
	_speed = _label(helm_box, "", 24)
	_wind = _label(helm_box, "", 18, DIM)
	_rule(helm_box)
	_power = _label(helm_box, "", 19, TEAL)
	_energy_status = _label(helm_box, "", 17, DIM, true)
	_energy_status.hide()
	_rig = _label(helm_box, "", 17, DIM, true)
	_rig.hide()
	_rope = _label(helm_box, "", 18, DIM)
	_tow_action = _label(helm_box, "", 17, AMBER, true)
	_tow_action.hide()
	_mute_button(helm_box, Vector2(0, 37))

	var footer := _panel(_live)
	footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	footer.offset_left = HUD_EDGE
	footer.offset_right = -HUD_EDGE
	footer.offset_top = -84.0
	footer.offset_bottom = -18.0
	footer.grow_vertical = Control.GROW_DIRECTION_BEGIN
	var keys := _column(footer, 4)
	_label(keys, KEYS_DRIVE, 18, TEXT, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_keys_tow = _label(keys, KEYS_TOW, 18, DIM, true)
	_keys_tow.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_navigation_panel = _panel(_live, true)
	_navigation_panel.anchor_left = 0.5
	_navigation_panel.anchor_right = 0.5
	_navigation_panel.offset_left = -200.0
	_navigation_panel.offset_right = 200.0
	_navigation_panel.offset_top = HUD_EDGE
	var nav := _column(_navigation_panel, 4)
	_navigation_summary = _label(nav, "", 18, TEAL, true)
	_navigation_detail = _label(nav, "", 17, DIM, true)
	_navigation_pick = OptionButton.new()
	_navigation_pick.fit_to_longest_item = false
	_navigation_pick.custom_minimum_size = Vector2(0, 36)
	_navigation_pick.focus_mode = Control.FOCUS_NONE
	nav.add_child(_navigation_pick)
	_navigation_pick.item_selected.connect(func(index: int) -> void:
		if index >= 0 and index < _navigation_ids.size():
			navigation_requested.emit("select", _navigation_ids[index]))
	var commands := _row(nav, 6)
	for pair in [["换线 N", "cycle"], ["下一点 B", "advance"], ["清空 C", "clear"]]:
		var button := _button(commands, pair[0], navigation_requested.emit.bind(pair[1], ""), false, Vector2(0, 34))
		button.focus_mode = Control.FOCUS_NONE
	_label(nav, "参考环≠拖缆／安全走廊 · 手动驾驶", 16, DIM, true)
	_segment_panel = _panel(_live, true)
	_segment_panel.anchor_left = 0.5
	_segment_panel.anchor_right = 0.5
	_segment_panel.offset_left = -200.0
	_segment_panel.offset_right = 200.0
	_segment_panel.offset_top = 216.0
	var segment_box := _column(_segment_panel, 2)
	_segment_status = _label(segment_box, "", 17, TEAL, true)
	var segment_commands := _row(segment_box, 6)
	for pair in [["开始 J", "start"], ["完成 K", "finish"], ["取消 L", "cancel"]]:
		var button := _button(segment_commands, pair[0], segment_requested.emit.bind(pair[1]), false, Vector2(0, 34))
		button.name = "Segment" + String(pair[1]).capitalize()
		button.focus_mode = Control.FOCUS_NONE
		_segment_buttons[pair[1]] = button
	_label(segment_box, "仅本航 · 最近6段替旧 · P查看／比较", 16, DIM, true)
	_segment_panel.hide()

func _present_live(view: Dictionary, contract: Dictionary) -> void:
	_present_navigation(view.get("navigation", {}))
	var expedition := _dictionary(view.get("expedition", {}))
	var in_expedition := not expedition.is_empty()
	_present_segments(view, in_expedition)
	var phase := String(view.get("phase", "approach"))
	var scanned := bool(view.get("scanned", false))
	var towing := bool(view.get("tow_attached", false))
	var survey := _dictionary(view.get("tide_survey", {}))
	var sampling: bool = not survey.is_empty() and int(survey.completed) < survey.stations.size()
	var elapsed := maxf(0.0, float(view.get("time", 0.0)))
	var deadline := float(view.get("deadline", contract.get("deadline", 0.0)))
	var tension := clampf(float(view.get("tension", 0.0)), 0.0, TOW_DISPLAY_LIMIT)
	var overload := clampf(float(view.get("overload", 0.0)), 0.0, 1.0)
	var hull := clampf(float(view.get("hull", 100.0)), 0.0, 100.0)
	var cargo := clampf(float(view.get("cargo_integrity", 100.0)), 0.0, 100.0)
	var battery := clampf(float(view.get("battery", 100.0)), 0.0, 100.0)
	var position: Vector2 = view.get("position", Vector2.ZERO)
	var harbor: Vector2 = view.get("harbor", contract.get("harbor", position))
	var wind: Vector2 = view.get("wind", Vector2.ZERO)
	var velocity: Vector2 = view.get("velocity", Vector2.ZERO)
	var home_distance := float(view.get("home_distance", position.distance_to(harbor)))
	var heading := float(view.get("heading", 0.0))
	_mission.text = String(expedition.get("name", contract.get("name", "黑潮回收")))
	var hint := KEYS_EXPEDITION if in_expedition else KEYS_TOW
	if _keys_tow.text != hint:
		_keys_tow.text = hint
	_phase.text = "拖带返航" if towing or phase == "return" else ("航迹已锁定" if scanned else "接近信号区")
	if sampling:
		_phase.text = "实测制图 %d/%d" % [int(survey.completed), survey.stations.size()]
	_clock.text = ("剩余 " + _time(deadline - elapsed)) if deadline > 0.0 else ("已用 " + _time(elapsed))
	_objective.text = _interaction_guidance(view, contract)
	# An old overload event can outlast the actual hazard by several seconds.
	# Live gauges and the helm action replace that event, not other notices.
	_notice.text = "" if String(view.get("event_kind", "")) == "overload" else String(view.get("notice", ""))
	_notice.visible = not _notice.text.is_empty() and _notice.text != _objective.text
	_warning.text = _advisory(battery, minf(hull, cargo) if scanned else hull, deadline - elapsed if deadline > 0.0 else INF)
	_warning.visible = not _warning.text.is_empty()
	_damage_status.visible = view.has("damage_control")
	if _damage_status.visible:
		var d: Dictionary = view.damage_control
		_damage_status.text = "动力响应 %.1f%% · 油门耗电 ×%.2f\n进水 %.1f%% · 入流 %.2f/s · G 泵%s\n破口 %.2f / 临封 %.2f · 包 %d · H 封堵 %s" % [
			float(d.propulsion_response) * 100.0, float(d.propulsion_energy_multiplier), float(d.water),
			float(d.inflow), "运行 -%.2f电/s" % float(d.pump_draw) if d.pump_active else ("待机" if d.pump_on else "关闭"),
			float(d.breach), float(d.sealed), int(d.kits), _progress_percent(float(d.patch_progress))]
		_damage_status.text += "\n连续 %.0fs：速度 <%.1f、油门 ≤%.2f、缆张 <%.0f%%" % [
			Damage.PATCH_SECONDS, Damage.PATCH_SPEED, Damage.PATCH_THROTTLE, Damage.PATCH_TENSION * 100.0]
		_damage_status.text += "\n" + _patch_guidance(view, d)
		_damage_status.add_theme_color_override("font_color", AMBER if float(d.water) >= 40.0 or float(d.breach) > float(d.sealed) else TEAL)

	_set_gauge("hull", hull, AMBER if hull <= 30.0 else GREEN)
	_set_gauge("cargo", cargo if scanned else 0.0, AMBER if cargo <= 30.0 else GREEN, "" if scanned else "未锁定")
	_set_gauge("battery", battery, AMBER if battery <= 25.0 else TEAL)
	var scan := 1.0 if scanned else clampf(float(view.get("scan", 0.0)), 0.0, 1.0)

	var compass := posmod(roundi(rad_to_deg(heading)), 360)
	_speed.text = "%.1f m/s    ·    %03d°" % [velocity.length(), compass]
	_wind.text = "风速 %.1f m/s   ·   风暴 %.0f%%" % [wind.length(), clampf(float(view.get("storm", 0.0)), 0.0, 1.0) * 100.0]
	var profile := clampi(int(view.get("power", 0)), 0, POWER_NAMES.size() - 1)
	var rope_length := float(view.get("rope_length", 0.0))
	_power.text = "[%d] %s   /   %s" % [profile + 1, POWER_NAMES[profile], "慢车" if bool(view.get("speed_mode", false)) else "常速"]
	_energy_status.visible = view.has("energy_budget")
	if _energy_status.visible:
		var rate: Dictionary = view.energy_budget.rate
		_energy_status.text = "上步耗电 %.2f/s\n含进水 +%.2f · 水泵 %.2f" % [float(rate.total), float(rate.flood), float(rate.pump)]
	_rig.visible = in_expedition
	if in_expedition:
		var effective: Dictionary = expedition.profile
		var rig := "%s\n推进 %.2f · 缆额 %.2f · 声纳 %.2f" % [module_names(expedition.loadout),
			float(effective.thrust), float(effective.rating), float(effective.sensors)]
		if _rig.text != rig:
			_rig.text = rig
	_rope.text = "索长 %.1f m   ·   峰值 %s" % [rope_length, _tow_load_percent(float(view.get("peak_tension", 0.0)))] if towing else ("绞盘待命 · Space 挂索" if scanned else "绞盘待命 · 须先锁定")
	_present_tow_risk(towing, tension, overload, scan, rope_length, profile)
	if sampling:
		_gauges["sonar_load"].caption.text = "潮流取样 · %s 站" % _station_letter(int(survey.completed))
		_set_gauge("sonar_load", float(survey.progress) * 100.0, TEAL, _progress_percent(float(survey.progress)))
	var contact := "舱距" if scanned else "距信号区中心"
	if towing:
		contact = "带载返航"
	elif sampling:
		contact = "测站 %s %.0f m" % [_station_letter(int(survey.completed)), position.distance_to(survey.stations[int(survey.completed)])]
	else:
		contact += " %.0f m" % float(view.get("target_distance", 0.0))
	_ranges.text = "%s   /   港距 %.0f m" % [contact, home_distance]
	var cross_current := String(view.get("contract_id", contract.get("id", ""))) == "cross-current"
	# Make room for two live chart rows without shrinking their text or covering
	# the helm below; legacy contracts keep their former chart dimensions.
	_radar.custom_minimum_size.y = 194.0 if cross_current else 238.0

	var radar_view := {"position": position, "heading": heading, "wind": wind, "scanned": scanned, "tow_attached": towing}
	radar_view["navigation"] = view.get("navigation", {})
	if view.has("harbor") or contract.has("harbor"):
		radar_view["harbor"] = harbor
		radar_view["harbor_radius"] = view.get("harbor_radius", contract.get("harbor_radius", 0.0))
	if view.has("beacon") or contract.has("beacon"):
		radar_view["beacon"] = view.get("beacon", contract.get("beacon"))
	radar_view["hazards"] = view.get("hazards", contract.get("hazards", []))
	if not survey.is_empty() and not towing:
		radar_view["tide_survey"] = survey
	if cross_current:
		var current_index := 0
		var current_landmarks: Array[Dictionary] = []
		for hazard: Variant in radar_view.hazards:
			if hazard is Dictionary and String(hazard.get("kind", "")) == "current":
				current_index += 1
				var landmark: Dictionary = hazard.duplicate()
				landmark["number"] = current_index
				current_landmarks.append(landmark)
		radar_view["current_landmarks"] = current_landmarks
		_ranges.text += _cross_current_readout(position,
			view.get("cargo_position", position) as Vector2 if scanned else position,
			scanned, current_landmarks)
	if scanned and view.get("cargo_position") is Vector2:
		radar_view["cargo_position"] = view.get("cargo_position")
		radar_view["target_visible"] = bool(view.get("target_visible", true))
	_radar.set_snapshot(radar_view)
	_present_dock(view, towing and scanned, harbor, float(view.get("harbor_radius", contract.get("harbor_radius", 0.0))), position, velocity)


func _present_navigation(nav: Dictionary) -> void:
	_navigation_summary.text = String(nav.get("summary", "导航未选 · N 换线"))
	_navigation_detail.text = String(nav.get("detail", "仅公开参考；仍须手动驾驶。"))
	var ids: Array[String] = []
	for route: Dictionary in nav.get("routes", []):
		ids.append(String(route.id))
	if ids != _navigation_ids:
		_navigation_ids = ids
		_navigation_pick.clear()
		for route: Dictionary in nav.get("routes", []):
			_navigation_pick.add_item(String(route.label))
	var selected := _navigation_ids.find(String(nav.get("route_id", "")))
	_navigation_pick.select(selected)
	_navigation_pick.tooltip_text = "选择公开路线（不自动驾驶）；N 换线、B 手动下一点、C 清空。"


func _present_segments(view: Dictionary, in_expedition: bool) -> void:
	_segment_panel.visible = in_expedition and view.has("segments")
	if not _segment_panel.visible:
		return
	var observed: Dictionary = view.segments
	var active: Dictionary = observed.active
	_segment_status.text = "航段未开始 · 已留 %d/6" % observed.records.size() if active.is_empty() else "航段观察中 · %s\n逐步行程 %s" % [Segments.reading(float(active.elapsed_s), "秒"), Segments.reading(float(active.distance_m), "米")]
	var running := String(view.get("screen", "")) == "running"
	_segment_buttons.start.disabled = not running or not active.is_empty()
	_segment_buttons.finish.disabled = not running or active.is_empty()
	_segment_buttons.cancel.disabled = not running or active.is_empty()


func _patch_guidance(view: Dictionary, damage: Dictionary) -> String:
	var blocked := PackedStringArray()
	var velocity: Vector2 = view.get("velocity", Vector2.ZERO)
	if String(view.get("screen", "running")) == "paused":
		blocked.append("部署已暂停")
	if velocity.length() >= Damage.PATCH_SPEED:
		blocked.append("速度超限")
	if absf(float(view.get("throttle", 0.0))) > Damage.PATCH_THROTTLE:
		blocked.append("油门超限")
	if float(view.get("tension", 0.0)) >= Damage.PATCH_TENSION:
		blocked.append("缆张超限")
	if int(damage.get("kits", 0)) <= 0:
		blocked.append("无封堵包")
	if float(damage.get("breach", 0.0)) <= float(damage.get("sealed", 0.0)):
		blocked.append("无开放破口")
	var status := "H 暂不可封堵：" + "、".join(blocked) if not blocked.is_empty() else \
		"H 条件满足：按住以继续封堵" + "（" + _progress_percent(float(damage.get("patch_progress", 0.0))) + "）"
	if int(damage.get("patches_used", 0)) > 0 and int(damage.get("kits", 0)) > 0 \
			and float(damage.get("breach", 0.0)) > float(damage.get("sealed", 0.0)):
		status += "；已完成一包，松开 H 再按住开始下一包"
	return status


func _cross_current_readout(tug: Vector2, cargo: Vector2, cargo_known: bool, landmarks: Array[Dictionary]) -> String:
	var lines := PackedStringArray()
	for landmark: Dictionary in landmarks:
		var number := int(landmark.get("number", 0))
		var name := String(landmark.get("name", "水流"))
		var radius := maxf(0.0, float(landmark.get("radius", 0.0)))
		var center: Vector2 = landmark.get("position", Vector2.ZERO)
		var cargo_reading := _current_edge_reading(cargo.distance_to(center), radius) if cargo_known else "未锁定"
		lines.append("%d%s 船%s 舱%s" % [
			number, name, _current_edge_reading(tug.distance_to(center), radius), cargo_reading])
	return "\n" + "\n".join(lines) if not lines.is_empty() else ""


func _current_edge_reading(distance: float, radius: float) -> String:
	var remaining := radius - distance
	if remaining == 0.0:
		return "圈边"
	var side := "圈内" if remaining > 0.0 else "圈外"
	var clearance := absf(remaining)
	# A rounded zero obscures whether the body is in the model's strict flow
	# radius. These are geometric readings, not an all-clear or damage forecast.
	return side + ("<1m" if clearance < 1.0 else "%dm" % roundi(clearance))

func _present_dock(view: Dictionary, towing: bool, harbor: Vector2, radius: float, position: Vector2, velocity: Vector2) -> void:
	var cargo_position: Variant = view.get("cargo_position") if towing else null
	if radius <= 0.0 or not cargo_position is Vector2:
		_dock.hide()
		return
	var tug_distance := position.distance_to(harbor)
	var cargo_distance: float = cargo_position.distance_to(harbor)
	var near := minf(tug_distance, cargo_distance) <= radius + 18.0
	_dock.visible = near
	if not near:
		return
	var tug_in := tug_distance <= radius
	var cargo_in := cargo_distance <= radius
	_dock_tug.text = "船：已入港" if tug_in else "船：港外"
	_dock_cargo.text = "舱：已入港" if cargo_in else "舱：港外"
	_dock_tug.modulate = GREEN if tug_in else AMBER
	_dock_cargo.modulate = GREEN if cargo_in else AMBER
	if view.has("dock"):
		# Mission snapshot supplies the true normalized one-second hold. Do not
		# integrate in the HUD: presentation may be throttled or paused.
		_dock_meter.value = clampf(float(view.get("dock", 0.0)), 0.0, 1.0)
		_dock_progress.text = "靠港   /   稳定 %.2f / %.2f 秒" % [_dock_meter.value * Sim.DOCK_TIME, Sim.DOCK_TIME]
	else:
		var berthed := int(tug_in) + int(cargo_in)
		_dock_meter.value = berthed * 0.5
		_dock_progress.text = "靠港   /   已入港 %d / 2" % berthed
	var cargo_velocity: Vector2 = view.get("cargo_velocity", Vector2.ZERO)
	var tension := float(view.get("tension", 0.0))
	var action := "保持稳定" if tug_in and cargo_in else "船舱均须入圈"
	if velocity.length() > Sim.DOCK_SPEED or cargo_velocity.length() > Sim.DOCK_SPEED:
		action = "船舱继续减速"
	if tension >= Sim.DOCK_TENSION:
		action = "松油门稳索"
	var settled := tug_in and cargo_in and velocity.length() <= Sim.DOCK_SPEED \
		and cargo_velocity.length() <= Sim.DOCK_SPEED and tension < Sim.DOCK_TENSION
	_dock_instruction.text = "船 %s/≤%.1f · 舱 %s/≤%.1f m/s\n缆张 %s / <%.0f%% · %s" % [
		_threshold_reading(velocity.length(), Sim.DOCK_SPEED, true), Sim.DOCK_SPEED,
		_threshold_reading(cargo_velocity.length(), Sim.DOCK_SPEED, true), Sim.DOCK_SPEED,
		_threshold_reading(tension * 100.0, Sim.DOCK_TENSION * 100.0, false) + "%", Sim.DOCK_TENSION * 100.0, action]
	_dock_instruction.add_theme_color_override("font_color", GREEN if settled else AMBER)


func _interaction_guidance(view: Dictionary, contract: Dictionary) -> String:
	var phase := String(view.get("phase", "approach"))
	var velocity: Vector2 = view.get("velocity", Vector2.ZERO)
	var speed := velocity.length()
	# Outfitting changes scan progress and rated force, not the shared scan,
	# attach or docking gates. Use the same constants as both modes in StormSim.
	if phase == "approach":
		var survey: Dictionary = view.get("tide_survey", {})
		if not survey.is_empty() and int(survey.completed) < survey.stations.size():
			var position: Vector2 = view.get("position", Vector2.ZERO)
			var distance := position.distance_to(survey.stations[int(survey.completed)])
			var radius := float(survey.radius)
			var limit := float(survey.speed_limit)
			var action := "持续按 E 取样"
			if distance > radius:
				action = "去 %s 站；途中松 E 省电" % _station_letter(int(survey.completed))
			elif speed >= limit:
				action = "先减速；超速中断取样"
			return "测站距离 %s/≤%.0f m · 船速 %s/<%.1f\n%s（%s）" % [
				_threshold_reading(distance, radius, true), radius, _threshold_reading(speed, limit, false), limit,
				action, _progress_percent(float(survey.progress))]
		if not bool(view.get("scanned", false)):
			var progress := clampf(float(view.get("scan", 0.0)), 0.0, 1.0)
			var action := "按住 E 扫描" if speed < Sim.SCAN_SPEED else "先减速再扫描"
			# target_distance is the signal-centre distance before lock, NOT cargo range.
			# Do not claim scan readiness or expose the hidden pod's exact position.
			return "声纳范围 ≤%.0f m · 船速 <%.1f m/s\n当前 %s m/s · %s（%s）" % [
				Sim.SCAN_RADIUS, Sim.SCAN_SPEED, _threshold_reading(speed, Sim.SCAN_SPEED, false), action, _progress_percent(progress)]
		var distance := float(view.get("target_distance", INF))
		var cargo_velocity: Vector2 = view.get("cargo_velocity", Vector2.ZERO)
		var relative_speed := (velocity - cargo_velocity).length()
		var action := "可按 Space 挂索"
		if distance > Sim.ATTACH_RADIUS:
			action = "继续靠近回收舱"
		elif speed > Sim.ATTACH_SPEED:
			action = "船速过高，继续减速"
		elif relative_speed > ATTACH_RELATIVE_SPEED:
			action = "相对速过高，稳住船舱"
		return "挂索 距离 %s/≤%.1f m · 船速 %s/≤%.1f\n相对速 %s/≤%.1f m/s · %s" % [
			_threshold_reading(distance, Sim.ATTACH_RADIUS, true), Sim.ATTACH_RADIUS,
			_threshold_reading(speed, Sim.ATTACH_SPEED, true), Sim.ATTACH_SPEED,
			_threshold_reading(relative_speed, ATTACH_RELATIVE_SPEED, true), ATTACH_RELATIVE_SPEED, action]
	if phase == "return":
		return "入港条件：船、舱均在港圈内\n速度 ≤%.1f m/s · 缆张 <%.0f%% · 稳定 %.0f 秒" % [
			Sim.DOCK_SPEED, Sim.DOCK_TENSION * 100.0, Sim.DOCK_TIME]
	return String(view.get("objective", contract.get("briefing", "")))


func _station_letter(index: int) -> String:
	return "A" if index == 0 else "B"

func _present_tow_risk(towing: bool, tension: float, overload: float, scan: float, rope_length: float, power: int) -> void:
	if not towing:
		_tow_action.hide()
		_gauges["tension"].caption.text = "拖缆张力"
		_gauges["sonar_load"].caption.text = "声纳锁定"
		_set_gauge("tension", 0.0, TEAL, "未挂索")
		_set_gauge("sonar_load", scan * 100.0, LILAC)
		return
	var overloaded := tension >= TOW_RATED_LOAD
	var recovering := not overloaded and overload > 0.0
	_gauges["tension"].caption.text = "拖缆张力 · 过载" if overloaded else "拖缆张力 · 额定内"
	_gauges["sonar_load"].caption.text = "断索风险 · 累积" if overloaded else ("断索风险 · 回落" if recovering else "断索风险")
	_set_gauge("tension", tension * 100.0, AMBER if overloaded else TEAL, _tow_load_percent(tension))
	_set_gauge("sonar_load", overload * 100.0, AMBER if overloaded else (LILAC if recovering else TEAL), _measured_percent(overload))
	if overloaded:
		var action := "减载：松油门、减小转角"
		if rope_length < Sim.ROPE_MAX:
			action += " · F 放缆"
		if power != 2:
			action += " · 3 稳索"
		_tow_action.text = action
	elif recovering:
		_tow_action.text = "保持低张力 · 风险仍在回落"
	_tow_action.visible = overloaded or recovering


func _tow_load_percent(load_ratio: float) -> String:
	return "≥%.0f%%" % (TOW_DISPLAY_LIMIT * 100.0) if load_ratio >= TOW_DISPLAY_LIMIT else _measured_percent(load_ratio)


func _measured_percent(fraction: float) -> String:
	# Do not round a live risk to a misleading empty/full reading.
	var rounded := "%.1f%%" % (fraction * 100.0)
	if fraction > 0.0 and rounded == "0.0%":
		return "<0.1%"
	if fraction < 1.0 and rounded == "100.0%":
		return "<100%"
	return rounded


func _progress_percent(progress: float) -> String:
	var percent := roundi(clampf(progress, 0.0, 1.0) * 100.0)
	return "<100%" if progress < 1.0 and percent >= 100 else "%d%%" % percent


func _threshold_reading(value: float, limit: float, inclusive_limit: bool) -> String:
	var reading := "%.1f" % value
	var boundary := "%.1f" % limit
	if reading != boundary:
		return reading
	if value > limit:
		return ">%s" % boundary
	if value < limit:
		return "<%s" % boundary
	return reading if inclusive_limit else "≥%s" % boundary


func _advisory(battery: float, integrity: float, remaining: float) -> String:
	if battery <= 12.0:
		return "电量告急 · 避免空扫和全速急转。"
	if remaining <= 20.0:
		return "风暴窗口即将关闭。"
	if integrity <= 25.0:
		return "完整度告急 · 远离礁区，减速稳索。"
	if battery <= 25.0:
		return "电量偏低 · 保留返航余量。"
	return ""

func _build_briefing(center: CenterContainer) -> void:
	var box := _menu(center, "briefing", 1020.0, "STORMLINE  /  RECOVERY OPERATIONS", "黑潮回收")
	_label(box, "低速搜索，挂索返航。船和回收舱均须入港，并稳定 1 秒。", 23, DIM, true)
	var expedition := _row(_panel(box, true), 12)
	var overview := _label(expedition, "主线远征  /  三海区、六部署；持久损伤与整备预算", 20, TEAL, true)
	overview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var door := _button(expedition, "远征 / 继续远征  [X]", func() -> void: expedition_requested.emit(), true, Vector2(0, 44))
	door.name = "OpenExpedition"
	door.focus_mode = Control.FOCUS_ALL
	_rule(box)
	var columns := _row(box, 18)
	var picker := _panel(columns)
	picker.custom_minimum_size.x = 292.0
	var deck := _column(picker, 10)
	_label(deck, "单航次快玩  /  %02d 份合同" % Sim.CONTRACTS.size(), 18, TEAL)
	for id: String in Sim.CONTRACTS:
		var card := _column(deck, 4)
		var button := _button(card, "", _choose_contract.bind(id), false, Vector2(0, 50))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var record := _label(card, "", 18, DIM, true)
		_contract_cards[id] = {"container": card, "button": button, "record": record}
	var dossier := _panel(columns)
	dossier.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var details := _column(dossier, 8)
	_label(details, "作业简报", 18, TEAL)
	_brief_name = _label(details, "", 28, TEXT, true)
	_brief_subtitle = _label(details, "", 19, TEAL, true)
	_brief_copy = _label(details, "", 21, TEXT, true)
	_brief_deadline = _label(details, "", 18, DIM)
	_rule(details)
	_brief_best = _label(details, "", 18, DIM, true)
	_rule(box)
	_label(box, KEYS_DRIVE, 18, TEXT, true)
	_label(box, KEYS_TOW, 18, DIM, true)
	var actions := _row(box, 10)
	_launch = _button(actions, "快玩开航  [Enter]", func() -> void: start_requested.emit(), true, Vector2(220, 50))
	_launch.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_mute_button(actions, Vector2(190, 50))
	_button(actions, "退出", func() -> void: quit_requested.emit(), false, Vector2(110, 50))

func _choose_contract(id: String) -> void:
	if _contracts.has(id):
		contract_selected.emit(id)

func _refresh_briefing() -> void:
	var ids: Array = Sim.CONTRACTS.keys()
	for index in range(ids.size()):
		var id := String(ids[index])
		var card: Dictionary = _contract_cards[id]
		var available := _contracts.has(id)
		card.container.visible = available
		if not available:
			continue
		var route := _dictionary(_contracts.get(id, {}))
		var record := _dictionary(_records.get(id, {}))
		var selected := id == _contract_id
		var status := "暂无完成记录" if record.is_empty() else ("最佳 %d 分 · %s" % [int(record.get("score", 0)), String(record.get("grade", "—"))])
		card.button.text = "%02d  %s" % [index + 1, String(route.get("name", id))]
		card.button.theme_type_variation = &"PrimaryButton" if selected else &""
		card.record.text = ("已选 · " if selected else "") + status
	var contract := _dictionary(_contracts.get(_contract_id, {}))
	_launch.disabled = contract.is_empty()
	_brief_name.text = String(contract.get("name", "未选定航线"))
	_brief_subtitle.text = String(contract.get("subtitle", ""))
	_brief_subtitle.visible = not _brief_subtitle.text.is_empty()
	_brief_copy.text = String(contract.get("briefing", "选择一条航线后开航。"))
	var deadline := float(contract.get("deadline", 0.0))
	_brief_deadline.visible = deadline > 0.0
	_brief_deadline.text = "作业窗口  " + _time(deadline)
	_brief_best.text = _best_text(_contract_id)

func _build_pause(center: CenterContainer) -> void:
	var box := _menu(center, "paused", 640.0, "STORMLINE  /  SYSTEM HOLD", "航行暂停")
	_pause_summary = _label(box, "", 22, DIM, true)
	_rule(box)
	_label(box, "按 P 或 Esc 继续。重新开航会清除本航次进度。", 20, TEXT, true)
	var actions := _row(box, 10)
	var resume := _button(actions, "继续  [P / Esc]", func() -> void: pause_requested.emit(), true, Vector2(230, 50))
	resume.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(actions, "重开  [R]", func() -> void: restart_requested.emit(), false, Vector2(126, 50))
	var nav := _row(box, 10)
	_button(nav, "返回任务简报", func() -> void: briefing_requested.emit(), false, Vector2(160, 44))
	_mute_button(nav, Vector2(168, 44))
	_button(nav, "退出", func() -> void: quit_requested.emit(), false, Vector2(96, 44))

func _build_debrief(center: CenterContainer) -> void:
	var box := _menu(center, "debrief", 824.0, "STORMLINE  /  RECOVERY LOG", "航次结算")
	_result_title = _label(box, "", 32)
	_result_subtitle = _label(box, "", 21, DIM, true)
	_result_message = _label(box, "", 21, TEXT, true)
	_result_overview = _column(box, 11)
	var plaque := _row(_panel(_result_overview), 14)
	var points := _column(plaque, 1)
	points.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_label(points, "结算分数", 17, DIM)
	_result_score = _label(points, "", 48, TEXT)
	var grade := _column(plaque, 1)
	grade.custom_minimum_size.x = 128.0
	_label(grade, "评级", 17, DIM)
	_result_grade = _label(grade, "", 48, TEAL)
	var stats := _row(_result_overview, 8)
	for stat in [["time", "航次用时"], ["hull", "拖船船体"], ["cargo", "舱完整度"], ["battery", "剩余电量"], ["peak_tension", "峰值张力"]]:
		var cell := _panel(stats)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var stack := _column(cell, 4)
		_label(stack, stat[1], 17, DIM)
		_result_stats[stat[0]] = _label(stack, "", 23)
	_result_record = _label(_result_overview, "", 19, TEAL, true)
	_result_best = _label(_result_overview, "", 18, DIM, true)
	_review_button = _button(box, "查看航次复盘  [V]", func() -> void: pass, false, Vector2(0, 44))
	_review_button.toggle_mode = true
	_review_button.toggled.connect(_set_review_open)
	_review_panel = _panel(box)
	_review_scroll = ScrollContainer.new()
	_review_scroll.custom_minimum_size.y = 218.0
	_review_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_review_panel.add_child(_review_scroll)
	var review_box := _column(_review_scroll, 8)
	review_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_review_summary = _label(review_box, "", 18, TEAL, true)
	_review_coverage = _label(review_box, "", 18, DIM, true)
	_review_timeline = _label(review_box, "", 18, TEXT, true)
	_review_advice = _label(review_box, "", 18, AMBER, true)
	_review_panel.hide()
	_rule(box)
	var actions := _row(box, 10)
	var retry := _button(actions, "重新执行  [R]", func() -> void: restart_requested.emit(), true, Vector2(220, 50))
	retry.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(actions, "返回任务简报", func() -> void: briefing_requested.emit(), false, Vector2(168, 50))
	_mute_button(actions, Vector2(166, 50))
	_button(actions, "退出", func() -> void: quit_requested.emit(), false, Vector2(102, 50))

func _present_report(view: Dictionary, contract: Dictionary) -> void:
	var report := _dictionary(view.get("report", {}))
	var success := String(view.get("phase", "failed")) == "success"
	_result_title.text = "回收完成" if success else "任务失败"
	var result_ink := TEAL if success else AMBER
	if _result_title.get_theme_color("font_color") != result_ink:
		_result_title.add_theme_color_override("font_color", result_ink)
	_result_subtitle.text = String(contract.get("name", "作业航线"))
	var reason := String(view.get("notice", "")) if success else String(view.get("fail_reason", ""))
	_result_message.text = reason if not reason.is_empty() else ("拖船与回收舱安全入港。" if success else "未能完成回收。")
	_result_score.text = str(int(report.get("score", 0))) if report.has("score") else "—"
	_result_grade.text = String(report.get("grade", "—"))
	_result_stats["time"].text = _time(float(report.get("time", view.get("time", 0.0))))
	_result_stats["hull"].text = "%.0f%%" % float(report.get("hull", view.get("hull", 0.0)))
	_result_stats["cargo"].text = "%.0f%%" % float(report.get("cargo", view.get("cargo_integrity", 0.0)))
	_result_stats["battery"].text = "%.0f%%" % float(report.get("battery", view.get("battery", 0.0)))
	_result_stats["peak_tension"].text = _tow_load_percent(float(report.get("peak_tension", view.get("peak_tension", 0.0))))
	var status := String(view.get("record_status", ""))
	_result_record.text = status if not status.is_empty() else ("未收到纪录更新" if success else "本航次未完成，不计入最佳纪录。")
	_result_best.text = _best_text(_contract_id)
	_review_view = _dictionary(view.get("review", {})).duplicate(true)
	_review_button.text = _review_button_text(_review_button.button_pressed)
	_review_summary.text = String(_review_view.get("summary_text", "航次数据未记录。"))
	_review_coverage.text = String(_review_view.get("coverage_text", "公开采样未记录。"))
	_review_timeline.text = String(_review_view.get("timeline_text", "关键节点未记录。"))
	_review_advice.text = String(_review_view.get("advice_text", "记录不足，暂不提供针对性建议。"))


func toggle_review() -> void:
	if _screen == "debrief":
		_review_button.button_pressed = not _review_button.button_pressed


func _set_review_open(open: bool) -> void:
	_result_overview.visible = not open
	_review_panel.visible = open
	_review_button.text = _review_button_text(open)


func _review_button_text(open: bool) -> String:
	var events: Array = _review_view.get("events", [])
	return ("收起航次复盘" if open else "查看航次复盘") + "  [V] · 已采集 %d / 保留 %d" % [int(_review_view.get("total_events", 0)), events.size()]

func _best_text(id: String) -> String:
	var record := _dictionary(_records.get(id, {}))
	if record.is_empty():
		return "历史最佳  /  暂无完成记录"
	return "历史最佳  /  %d 分 · %s 级 · %s · 船体 %.0f%% · 峰值张力 %s" % [int(record.get("score", 0)), String(record.get("grade", "—")), _time(float(record.get("time", 0.0))), float(record.get("hull", 0.0)), _tow_load_percent(float(record.get("peak_tension", 0.0)))]

func _add_gauge(parent: Control, id: String, caption: String, ink: Color, maximum := 100.0) -> void:
	var group := _column(parent, 3)
	var pair := _row(group, 8)
	var name_label := _label(pair, caption, 18, DIM)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var value_label := _label(pair, "", 18, TEXT)
	var rail := _rail(group, maximum, ink, 7)
	if id in ["tension", "sonar_load"]:
		rail.step = 0.0
	if id == "tension":
		var notch := ColorRect.new()
		notch.color = AMBER
		notch.mouse_filter = Control.MOUSE_FILTER_IGNORE
		rail.add_child(notch)
		notch.anchor_left = TOW_RATED_LOAD / TOW_DISPLAY_LIMIT
		notch.anchor_right = notch.anchor_left
		notch.anchor_bottom = 1.0
		notch.offset_top = -2.0
		notch.offset_right = 2.0
		notch.offset_bottom = 2.0
	_gauges[id] = {"caption": name_label, "label": value_label, "bar": rail, "fill": rail.get_theme_stylebox("fill")}

func _set_gauge(id: String, value: float, ink: Color, display := "") -> void:
	var gauge: Dictionary = _gauges[id]
	gauge.bar.value = value
	gauge.label.text = ("%.1f%%" % value) if display.is_empty() else display
	if gauge.fill.bg_color != ink:
		gauge.fill.bg_color = ink

func _rail(parent: Control, maximum: float, ink: Color, height: int) -> ProgressBar:
	var rail := ProgressBar.new()
	rail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rail.show_percentage = false
	rail.max_value = maximum
	rail.step = 0.01
	rail.custom_minimum_size.y = height
	rail.add_theme_stylebox_override("background", _block(Color("20394b"), Color.TRANSPARENT, 3, 0, 0))
	rail.add_theme_stylebox_override("fill", _block(ink, Color.TRANSPARENT, 3, 0, 0))
	parent.add_child(rail)
	return rail

func _menu(center: CenterContainer, id: String, width: float, tag: String, title: String) -> VBoxContainer:
	var panel := _panel(center, true)
	panel.custom_minimum_size.x = width
	_menus[id] = panel
	var box := _column(panel, 11)
	_label(box, tag, 17, TEAL)
	_label(box, title, 48 if id == "briefing" else 37)
	return box

func _panel(parent: Control, accent := false) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var skin := _block(PANEL, RULE, 10, 16, 12)
	if accent:
		skin.border_width_top = 2
		skin.border_color = Color("437381")
	panel.add_theme_stylebox_override("panel", skin)
	parent.add_child(panel)
	return panel

func _pin(control: Control, right: bool, bottom: bool, width: float, extra: float) -> void:
	control.anchor_left = 1.0 if right else 0.0
	control.anchor_right = control.anchor_left
	control.anchor_top = 1.0 if bottom else 0.0
	control.anchor_bottom = control.anchor_top
	control.offset_left = -HUD_EDGE - width if right else HUD_EDGE
	control.offset_right = control.offset_left + width
	control.offset_top = -HUD_EDGE + extra if bottom else HUD_EDGE + extra
	control.offset_bottom = control.offset_top
	if bottom:
		control.grow_vertical = Control.GROW_DIRECTION_BEGIN

func _column(parent: Control, gap: int) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", gap)
	parent.add_child(box)
	return box

func _row(parent: Control, gap: int) -> HBoxContainer:
	var box := HBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", gap)
	parent.add_child(box)
	return box

func _rule(parent: Control) -> void:
	var line := ColorRect.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.color = RULE
	line.custom_minimum_size.y = 1.0
	parent.add_child(line)

func _label(parent: Control, text: String, point: int, ink := TEXT, wrap := false) -> Label:
	var label := Label.new()
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.text = text
	label.add_theme_font_size_override("font_size", point)
	label.add_theme_color_override("font_color", ink)
	if wrap:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(label)
	return label

func _button(parent: Control, text: String, callback: Callable, primary: bool, minimum: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.custom_minimum_size = minimum
	button.theme_type_variation = &"PrimaryButton" if primary else &""
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _mute_button(parent: Control, minimum: Vector2) -> void:
	var button := _button(parent, "声音：开启 [M]", func() -> void: mute_requested.emit(), false, minimum)
	_mute_buttons.append(button)

static func make_theme() -> Theme:
	var theme := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "SimHei"])
	theme.default_font = font
	theme.default_font_size = 18
	theme.set_type_variation(&"PrimaryButton", &"Button")
	for type in [&"Button", &"PrimaryButton"]:
		var primary: bool = type == &"PrimaryButton"
		var ink := Color("102934") if primary else TEXT
		for state in [&"font_color", &"font_hover_color", &"font_pressed_color", &"font_focus_color", &"font_hover_pressed_color"]:
			theme.set_color(state, type, ink)
		theme.set_color(&"font_disabled_color", type, DIM)
		theme.set_stylebox(&"normal", type, _block(TEAL if primary else Color("193448"), TEAL if primary else RULE, 6, 12, 6))
		theme.set_stylebox(&"hover", type, _block(Color("b3fff5") if primary else Color("23475b"), TEAL, 6, 12, 6))
		theme.set_stylebox(&"pressed", type, _block(Color("60bfb9") if primary else Color("162b3c"), TEAL, 6, 12, 6))
		theme.set_stylebox(&"disabled", type, _block(Color("1b2c3b"), RULE, 6, 12, 6))
		var focus := _block(Color.TRANSPARENT, AMBER, 6, 0, 0)
		focus.set_border_width_all(3)
		theme.set_stylebox(&"focus", type, focus)
	return theme

static func _block(fill: Color, stroke: Color, corner: int, pad_x: int, pad_y: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = stroke
	box.set_border_width_all(1 if stroke.a > 0.0 else 0)
	box.set_corner_radius_all(corner)
	box.content_margin_left = pad_x
	box.content_margin_right = pad_x
	box.content_margin_top = pad_y
	box.content_margin_bottom = pad_y
	return box

static func module_names(ids: Array) -> String:
	var names := PackedStringArray()
	var modules := Catalog.modules()
	for id: String in ids:
		if modules.has(id):
			names.append(String(modules[id].name))
	return "原装" if names.is_empty() else " + ".join(names)

func _time(seconds: float) -> String:
	var tenths := roundi(maxf(seconds, 0.0) * 10.0)
	return "%02d:%02d.%d" % [floori(float(tenths) / 600.0), floori(float(tenths % 600) / 10.0), tenths % 10]

func _dictionary(value: Variant) -> Dictionary:
	return value if value is Dictionary else {}
