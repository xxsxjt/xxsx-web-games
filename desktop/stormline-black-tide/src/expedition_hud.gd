extends CanvasLayer
## Native outfit desk and voyage log. Only reads the app's saved projection,
## catalog and rules; all actions go through the single requested signal.

signal requested(action: String, value: String)

const Catalog = preload("res://src/expedition_catalog.gd")
const State = preload("res://src/expedition_state.gd")
const Damage = preload("res://src/damage_control.gd")
const Cockpit = preload("res://src/storm_hud.gd")
const Segments = preload("res://src/voyage_segments.gd")
const INK := Color("e9f5fa")
const MUTED := Color("a9c4d3")
const TEAL := Color("8bebe0")
const AMBER := Color("ffc18a")
const GREEN := Color("9fdfb2")
const LEDGER_NAMES := {
	"buy": "采购模块", "equip": "安装模块", "unequip": "卸下模块", "repair": "维修船体",
	"recharge": "补充电池", "launch": "支付出航费", "settle": "部署结算",
	"abandon": "主动放弃", "recover_interrupted": "中断返港", "retreat": "结束远征",
	"enable_damage": "明确启用损管", "prepare_kit": "预装封堵包", "unload_kit": "卸回封堵包",
}
const OUTCOME_NAMES := {"success": "已交付", "failed": "失败／无报酬", "interrupted": "已撤回／无报酬", "retreated": "已撤退"}
const EFFECT_NAMES := {"thrust": "推进力", "energy": "耗电", "rating": "拖缆额定", "sensors": "声纳效率", "stability": "抗漂移", "mass": "船重"}

var _root: MarginContainer
var _page: VBoxContainer
var _scroll: ScrollContainer
var _screen := ""
var _tab := "chart"
var _review_open := false
var _view: Dictionary = {}
var _buttons: Dictionary = {}
var _focus_first := ""
var _draw_serial := 0


func _ready() -> void:
	layer = 16
	_root = MarginContainer.new()
	_root.name = "ExpeditionInterface"
	_root.theme = Cockpit.make_theme()
	for side: String in ["left", "right", "top", "bottom"]:
		_root.add_theme_constant_override("margin_" + side, 18 if side in ["left", "right"] else 12)
	var background := ColorRect.new()
	background.color = Color(0.021, 0.054, 0.089, 0.97)
	add_child(background)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.add_child(_root)
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	close()


func close() -> void:
	hide()
	_screen = ""
	_view = {}
	_review_open = false
	_tab = "chart"


func present(view: Dictionary) -> void:
	var next := String(view.screen)
	var same_page: bool = _screen == next and _view.get("confirmation", "") == view.confirmation
	if _screen != next:
		_review_open = false
		_tab = "chart"
	_view = view
	_screen = next
	show()
	_rebuild(same_page)


func toggle_review() -> void:
	if _screen == "debrief" and String(_view.confirmation).is_empty():
		_review_open = not _review_open
		_rebuild(false)


func scroll_with_key(key: Key) -> void:
	if not visible or not is_instance_valid(_scroll):
		return
	var bar := _scroll.get_v_scroll_bar()
	var amount := maxi(1, roundi(_scroll.size.y - 36.0))
	match key:
		KEY_PAGEUP: _scroll.scroll_vertical -= amount
		KEY_PAGEDOWN: _scroll.scroll_vertical += amount
		KEY_HOME: _scroll.scroll_vertical = 0
		KEY_END: _scroll.scroll_vertical = roundi(bar.max_value)


func _rebuild(preserve_context: bool) -> void:
	var owner := get_viewport().gui_get_focus_owner()
	var focus_id := ""
	if preserve_context and owner != null and owner.has_meta("expedition_button"):
		focus_id = String(owner.get_meta("expedition_button"))
	var scroll_y := _scroll.scroll_vertical if preserve_context and is_instance_valid(_scroll) else 0
	if is_instance_valid(_page):
		_root.remove_child(_page)
		_page.queue_free()
	_buttons.clear()
	_focus_first = ""
	_page = _column(_root, 7)
	var state: Dictionary = _view.state
	var terminal: Dictionary = _view.terminal
	var title := "远征档案"
	var strap := "STORMLINE  /  远征指挥台"
	match _screen:
		"dock":
			match String(state.status):
				"completed": title = "旗舰已回收  /  远征成功"
				"retreated": title = "远征已撤退"
				_: title = "远征船坞"
		"paused": title = "部署暂停"
		"debrief":
			title = "回收失败" if terminal.get("phase") != "success" else ("旗舰回收完成" if terminal.get("expedition", {}).get("flagship", false) else "回收完成")
			strap = "STORMLINE  /  部署复盘与账本"
	var header := _row(_page, 12)
	var headline := _label(header, strap, 16, TEAL)
	headline.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_label(header, "3 海区   /   6 次部署", 16, MUTED).autowrap_mode = TextServer.AUTOWRAP_OFF
	_label(_page, title, 32, AMBER if terminal.get("phase") == "failed" else INK)
	if not state.is_empty():
		_resource_strip(_page, state)
	var notice := _label(_page, String(_view.notice), 17, AMBER if _view.error else TEAL)
	notice.name = "ArchiveNotice"
	notice.visible = not notice.text.is_empty()
	var confirmation := String(_view.confirmation)
	if confirmation.is_empty() and _screen == "dock":
		_build_tabs(state.status != "dock")
		if not _view.offer.is_empty():
			_label(_page, "拟出航：%s   ·   %d 资金" % [_view.offer.name, int(_view.offer.launch_cost)], 17, TEAL)
	if confirmation.is_empty() and _screen == "debrief":
		var row := _row(_page, 8)
		_button(row, "切回结算  [V]" if _review_open else "航次复盘  [V]", "review", false, toggle_review)
		_label(row, "复盘仅在本次结算保留；远征账本随档案保存。", 16, MUTED).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll = ScrollContainer.new()
	_scroll.name = "ExpeditionScroll"
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.follow_focus = true
	_page.add_child(_scroll)
	var body := _column(_scroll, 8)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var actions := _row(_page, 8)
	if not confirmation.is_empty():
		_build_confirmation(body, actions, confirmation)
	else:
		match _screen:
			"archive": _build_archive(body, actions)
			"dock": _build_dock(body, actions)
			"paused": _build_paused(body, actions)
			"debrief": _build_result(body, actions)
		if _view.pending:
			_add_pending_actions(actions)
		elif _view.conflict:
			_action(actions, "重读磁盘档案", "reload", true)
	_action(actions, "声音：关闭 [M]" if _view.muted else "声音：开启 [M]", "mute", false)
	if confirmation.is_empty():
		_action(actions, "退出", "quit", false)
	_label(_page, "Tab 选控件 · Enter 确认 · 滚轮 / PgUp / PgDn 浏览", 15, MUTED)
	_draw_serial += 1
	_restore_focus.call_deferred(_draw_serial, focus_id, scroll_y)


func _restore_focus(serial: int, id: String, scroll_y: int) -> void:
	if serial != _draw_serial or not visible:
		return
	_scroll.scroll_vertical = scroll_y
	var button: Button = _buttons.get(id, _buttons.get(_focus_first))
	if is_instance_valid(button) and not button.disabled and button.is_visible_in_tree():
		button.grab_focus()
	else:
		for other: Button in _buttons.values():
			if not other.disabled and other.is_visible_in_tree():
				other.grab_focus()
				break


func _build_archive(body: VBoxContainer, actions: HBoxContainer) -> void:
	var archive: Dictionary = _view.archive
	var state: Dictionary = _view.state
	var panel := _card(body, "独立档案  /  %s" % _view.file)
	_label(panel, "六次连续部署；船损、余电、资金、材料与压力会跨航次保留。快玩的历史最佳完全独立。", 19)
	if not archive.ok:
		if archive.backup_available:
			_label(panel, "发现可验证的上一份备份。不会自动回滚；恢复后，请检查其航程，再选择继续。", 18, AMBER)
			if not _view.conflict:
				_action(actions, "恢复备份…", "restore", true)
		elif not archive.exists and not _view.conflict:
			_label(panel, "尚未建立远征。只有按下新建才会写入独立档案。", 18, MUTED)
			_label(panel, "新远征启用进水损管：触礁留下跨航次破口，排水耗电，临时封堵消耗预装材料。旧档案不会自动启用。", 18, TEAL)
			_action(actions, "新建损管远征", "new", true)
		else:
			_label(panel, "不会覆盖坏档。请在游戏外先保留主档；排除路径或版本问题后，再用“重查档案”。", 18, AMBER)
	elif not state.is_empty():
		_label(panel, "已交付 %d / 6  ·  出航 %d 次  ·  档案修订 %d" % [state.path.size(), int(state.deployment), int(state.revision)], 19, TEAL)
		match String(state.status):
			"active":
				var active: Dictionary = state.active
				var contract := Catalog.build_contract(active.offer_id, int(active.pressure), active.path)
				_label(panel, "航行中断：%s。只有出航登记，没有逐帧存档；不能接续驾驶或恢复最后一帧消耗。" % contract.get("name", active.offer_id), 18, AMBER)
				if not _view.conflict:
					_action(actions, "处理中断部署…", "continue", true)
			"completed", "retreated":
				_label(panel, "该远征已结束。可查看终局与账本，再决定是否另起远征。", 18, MUTED)
				if not _view.conflict:
					_action(actions, "查看远征终局", "continue", true)
			_:
				_label(panel, "下一站：%s · %s" % [Catalog.sector_name(int(state.sector)), _leg_name(int(state.sector), int(state.leg))], 18, MUTED)
				if not _view.conflict:
					_action(actions, "继续远征", "continue", true)
	if not _view.conflict:
		_action(actions, "重查档案", "reload", false)
	_action(actions, "返回任务台 [Esc]", "desk", false)


func _build_tabs(ended: bool) -> void:
	var bar := _row(_page, 8)
	for pair: Array in [["chart", "六部署航图" if ended else "航图与合同"], ["outfit", "船厂整备"], ["work_order", "整备工单"], ["navigation", "公开航路"], ["ledger", "远征账本"]]:
		if ended and pair[0] in ["outfit", "work_order", "navigation"]:
			continue
		_button(bar, String(pair[1]), "tab_" + String(pair[0]), _tab == pair[0], _switch_tab.bind(String(pair[0])))
	_focus_first = "tab_" + _tab


func _switch_tab(tab: String) -> void:
	if tab == _tab:
		return
	_tab = tab
	_rebuild(false)


func _build_dock(body: VBoxContainer, actions: HBoxContainer) -> void:
	var state: Dictionary = _view.state
	if state.status == "dock":
		match _tab:
			"outfit": _build_outfit(body, state)
			"work_order": _build_work_order(body, state)
			"navigation": _build_navigation(body)
			"ledger": _build_ledger(body, state.history)
			_: _build_chart(body, state, _view.offers)
		if not _view.conflict:
			var launch: Dictionary = _view.launch
			var button := _action(actions, "确认出航…", "launch", true, not bool(launch.get("ok", false)))
			button.tooltip_text = String(_view.offer.get("name", "")) if not button.disabled else String(launch.get("message", ""))
			_action(actions, "撤退…", "retreat", false)
	else:
		if _tab == "ledger":
			_build_ledger(body, state.history)
		else:
			var ending := _card(body, "远征终局")
			_label(ending, "旗舰核心已稳定入港，六次部署全部交付。" if state.status == "completed" else "远征已主动终止。没有补发资金或奖励，保留结算时的资源和账本。", 20, GREEN if state.status == "completed" else AMBER)
			_build_chart(body, state, [])
		if not _view.conflict:
			_action(actions, "另起远征…", "restart", true)
	_action(actions, "返回任务台 [Esc]", "desk", false)


func _build_work_order(body: VBoxContainer, saved: Dictionary) -> void:
	var order: Dictionary = _view.work_order
	var projected: Dictionary = order.state
	var steps: Array = order.steps
	var blocked: bool = bool(_view.conflict) or steps.size() >= State.WORK_ORDER_LIMIT
	var summary := _card(body, "整备草案  /  %d / %d 项 · 尚未入账" % [steps.size(), State.WORK_ORDER_LIMIT])
	_label(summary, "先组合、再比较、最后一次保存。下方增加草案，不会即时扣费；原船厂页仍可单项整备，但有草案时须先提交或清空。草案不跨退出／重载保存。", 17, MUTED)
	_label(summary, "资金 %d → %d（%+d） · 材料 %d → %d（%+d） · 压力 %d → %d\n船体 %.1f → %.1f%% · 电量 %.1f → %.1f%%\n装备：%s → %s" % [
		int(saved.credits), int(projected.credits), int(projected.credits) - int(saved.credits), int(saved.parts), int(projected.parts), int(projected.parts) - int(saved.parts),
		int(saved.pressure), int(projected.pressure), float(saved.hull), float(projected.hull), float(saved.battery), float(projected.battery), module_names(saved.equipped), module_names(projected.equipped)], 18, TEAL)
	if saved.has("damage_control"):
		_label(summary, "结构破口 %.2f → %.2f · 封堵包 %d → %d" % [float(saved.damage_control.breach), float(projected.damage_control.breach), int(saved.damage_control.kits), int(projected.damage_control.kits)], 18, TEAL)
	var offer: Dictionary = order.offer
	if not offer.is_empty():
		_label(summary, "所选合同整备后实参：%s\n%s" % [offer.name, _quote(offer)], 17)
		var before: Dictionary = _view.offer
		_label(summary, "整备代价对照：海况 %.3f → %.3f · 舱重 %.2f → %.2f\n窗口 %.0f → %.0f 秒（压力实参至 %d 饱和）" % [float(before.severity), float(offer.severity), float(before.mass), float(offer.mass), float(before.deadline), float(offer.deadline), Catalog.EFFECTIVE_PRESSURE_CAP], 17, MUTED)
		_label(summary, "整备后可支付出航费，余额 %d；不代表能完成航程。" % int(order.launch.state.credits) if order.launch.ok else "整备后仍不能出航：" + String(order.launch.message), 17, TEAL if order.launch.ok else AMBER)
	for index in range(steps.size()):
		var step: Dictionary = steps[index]
		var mod := String(step.payload.get("module_id", ""))
		_label(summary, "%02d  %s%s" % [index + 1, LEDGER_NAMES.get(step.action, step.action), " · " + module_names([mod]) if not mod.is_empty() else ""], 17)
	var commands := _row(summary, 8)
	_action(commands, "撤销末项", "undo_work_order", false, steps.is_empty() or bool(_view.conflict))
	_action(commands, "清空草案", "clear_work_order", false, steps.is_empty() or bool(_view.conflict))
	_action(commands, "确认整单…", "commit_work_order", true, steps.is_empty() or not order.ok or bool(_view.conflict))
	var services := _card(body, "加入服务／材料操作  /  按草案当前资源判断")
	var row := _row(services, 8)
	for pair: Array in [["repair", "维修 · 14资金/1材料"], ["recharge", "充电 · 10资金"], ["prepare_kit", "预装包 · 1材料"], ["unload_kit", "卸包 · 退1材料"]]:
		var action := String(pair[0])
		var change: Dictionary = order.services[action]
		var button := _action(row, String(pair[1]), "queue_" + action, false, blocked or not change.ok)
		button.tooltip_text = String(change.message)
	var mods := _row(body, 8)
	for id: String in Catalog.modules():
		var mod: Dictionary = Catalog.modules()[id]
		var card := _card(mods, String(mod.name))
		var change: Dictionary = order.module_actions[id]
		var action := String(change.action)
		_label(card, effect_text(mod.effects), 17, MUTED)
		var caption := "卸下" if action == "unequip" else ("安装" if action == "equip" else "购买 · %d 资金" % int(mod.price))
		var button := _action(card, "草案：" + caption, "queue_" + action, false, blocked or not change.ok, id)
		button.tooltip_text = String(change.message)
	_label(body, "按顺序使用实际资金／材料和负载规则；不能用后一步的退款支付前一步。最多12项。确认前可撤销；写盘失败或陈旧档整单不入账，不会半单扣费。维修／充电提高压力，所选合同也随之变化；并非自动推荐或续航保证。", 17, MUTED)


func _build_navigation(body: VBoxContainer) -> void:
	var nav: Dictionary = _view.navigation
	var panel := _card(body, "公开航路 · 仅本次内存草案")
	_label(panel, String(nav.summary), 19, TEAL)
	_label(panel, "随所选合同出航；换报价、回坞或终局清空。绕礁点仅为具名礁圈东西侧外18米参考，连途未检查，不保证船舱净空。搜索中心不是舱位，到点不完成目标。导航不会提交工单、扣费或出航。", 17, MUTED)
	_action(panel, "清空航路", "nav_clear", false, false)
	for route: Dictionary in nav.routes:
		_action(panel, String(route.label), "nav_select", route.id == nav.route_id, bool(_view.conflict), String(route.id))
	_label(panel, "出航后 N 换线 · B 手动下一点 · C 清空；近点仅提示，仍须自行扫描／取样／靠港。", 17, MUTED)


func _build_chart(body: VBoxContainer, state: Dictionary, offers: Array) -> void:
	var route := _row(body, 8)
	var done: Array = state.path
	for sector in range(1, 4):
		var sea := _card(route, "%02d  %s" % [sector, Catalog.sector_name(sector)])
		for leg in range(2):
			var step := (sector - 1) * 2 + leg
			var name := _leg_name(sector, leg)
			var marker := "未解锁"
			var ink := MUTED
			if step < done.size():
				name = String(Catalog.build_contract(done[step], 0, done.slice(0, step)).get("name", name))
				marker = "已交付"
				ink = GREEN
			elif step == done.size():
				marker = "当前" if state.status == "dock" else "止于此"
				ink = TEAL if state.status == "dock" else AMBER
			var node := _label(sea, "%02d  %s · %s" % [step + 1, marker, name], 17, ink)
			node.name = "Deployment%d" % (step + 1)
	if offers.is_empty():
		return
	var selected: Dictionary = _view.offer
	_label(body, "合同报价  /  实际出航参数", 23, TEAL)
	if not _view.launch.get("ok", false):
		_label(body, String(_view.launch.get("message", "")), 17, AMBER)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	body.add_child(grid)
	for offer: Dictionary in offers:
		var picked: bool = offer.id == selected.get("id")
		var card := _card(grid, String(offer.name), TEAL if picked else (AMBER if offer.risk == "high" else INK))
		_label(card, _quote(offer), 17, INK)
		_label(card, String(offer.briefing), 17, MUTED)
		_action(card, "已选此合同" if picked else "选择此合同", "offer", picked, false, String(offer.id))
	_label(body, "报酬为舱体完好时的上限；受损按完整度结算。压力影响海况、负重和时限（实参至压力 %d 饱和）。" % Catalog.EFFECTIVE_PRESSURE_CAP, 17, MUTED)


func _build_outfit(body: VBoxContainer, state: Dictionary) -> void:
	var modules := Catalog.modules()
	var load := 0
	for id: String in state.equipped:
		load += int(modules[id].load)
	var rig := _card(body, "改装甲板  /  槽位 %d/%d  ·  总负载 %d/%d" % [state.equipped.size(), State.MAX_EQUIPPED_MODULES, load, State.MAX_MODULE_LOAD])
	_label(rig, "当前装备：%s" % module_names(state.equipped), 18, TEAL)
	_label(rig, "合计倍率：%s。推进与稳索负载过高，无法同时装备；购买不等于安装。" % effect_text(Catalog.loadout_effects(state.equipped)), 17, MUTED)
	var row := _row(body, 8)
	for id: String in modules:
		var mod: Dictionary = modules[id]
		var card := _card(row, String(mod.name))
		var change: Dictionary = _view.module_actions[id]
		var action := String(change.action)
		var caption := "卸下" if action == "unequip" else ("装备" if action == "equip" else "购买 · %d 资金" % int(mod.price))
		var status := "已装备" if action == "unequip" else ("已购，未装备" if action == "equip" else "未购买 · %d 资金" % int(mod.price))
		_label(card, "%s  /  负载 %d" % [status, int(mod.load)], 17, TEAL)
		_label(card, effect_text(mod.effects), 17, INK)
		_label(card, String(mod.description), 17, MUTED)
		var button := _action(card, caption, action, false, not bool(change.ok) or bool(_view.conflict), id)
		if not change.ok:
			button.tooltip_text = String(change.message)
			_label(card, "资金不足" if action == "buy" else "槽位或负载不足；先卸下其他模块。", 16, AMBER)
	var services := _row(body, 8)
	_service(services, state, "repair", "维修船体", "hull", State.REPAIR_AMOUNT, State.REPAIR_COST, State.REPAIR_PARTS, State.REPAIR_PRESSURE)
	_service(services, state, "recharge", "补充电池", "battery", State.RECHARGE_AMOUNT, State.RECHARGE_COST, 0, State.RECHARGE_PRESSURE)
	_build_damage_outfit(body, state)
	_label(body, "整备耗用风暴窗口。也可带伤继续：船体至少 %d%%、电量至少 %d%%，并能支付出航费。" % [int(State.MIN_LAUNCH_HULL), int(State.MIN_LAUNCH_BATTERY)], 17, MUTED)


func _service(parent: Control, state: Dictionary, action: String, title: String, field: String, amount: float, cost: int, parts: int, pressure: int) -> void:
	var card := _card(parent, title)
	var change: Dictionary = _view.services[action]
	var next: Dictionary = change.state
	var materials := " · %d 材料" % parts if parts > 0 else ""
	_label(card, "%d 资金%s · 压力最多 +%d · 最多 +%.0f 点" % [cost, materials, pressure, amount], 17, INK)
	if change.ok:
		_label(card, "预计 %.1f%% → %.1f%%；压力 %d → %d" % [float(state[field]), float(next[field]), int(state.pressure), int(next.pressure)], 17, TEAL)
	else:
		_label(card, String(change.message), 17, MUTED)
	_action(card, title, action, false, not bool(change.ok) or bool(_view.conflict))
	if action == "repair" and state.has("damage_control"):
		_label(card, "同时修复结构破口最多 %.1f；不返还用掉的封堵包。" % Damage.REPAIR_BREACH, 17, MUTED)


func _build_damage_outfit(body: VBoxContainer, state: Dictionary) -> void:
	var panel := _card(body, "进水损管  /  结构修复与海上应急")
	if not state.has("damage_control"):
		_label(panel, "此为旧规则远征，读取不会改变物理。可明确启用损管扩展；不可用旧程序读回扩展档案。既有船损不追溯生成破口。", 18, MUTED)
		_action(panel, "明确启用损管…", "enable_damage", false, bool(_view.conflict))
		return
	_label(panel, "结构破口 %.2f / %.0f  ·  预装封堵包 %d / %d" % [float(state.damage_control.breach), Damage.MAX_BREACH, int(state.damage_control.kits), Damage.MAX_KITS], 19, TEAL)
	_label(panel, "仓库材料与预装包一比一转移；最多携两包。G 切换排水泵，实际排水每秒耗电 %.2f。H 连续封堵 %.0f 秒：船速 <%.1f、油门 ≤%.2f、缆张 <68%%；松键或超限中断，完成才耗一包。若仍有破口，完成后先松开 H 再按住，才开始下一包。每包暂封最多 %.1f，结构仍须返港付费维修。" % [Damage.PUMP_DRAW, Damage.PATCH_SECONDS, Damage.PATCH_SPEED, Damage.PATCH_THROTTLE, Damage.PATCH_AMOUNT], 17, MUTED)
	var row := _row(panel, 8)
	for pair: Array in [["prepare_kit", "预装一包 · 1 材料"], ["unload_kit", "卸回一包 · +1 材料"]]:
		var action := String(pair[0])
		var result: Dictionary = _view.services[action]
		var button := _action(row, String(pair[1]), action, false, not bool(result.ok) or bool(_view.conflict))
		button.tooltip_text = String(result.message)
	_label(panel, "带破口出航会从干舱重新进水；港内排干与临时封堵不修结构。失联中断会损失全部预装包并另增 0.35 破口。", 17, AMBER)


func _build_paused(body: VBoxContainer, actions: HBoxContainer) -> void:
	var voyage: Dictionary = _view.voyage
	var meta: Dictionary = voyage.get("expedition", {})
	var panel := _card(body, String(meta.get("name", "远征部署")))
	_label(panel, "已用 %s   ·   船体 %.1f%%   ·   电量 %.1f%%" % [_time(float(voyage.time)), float(voyage.hull), float(voyage.battery)], 20, TEAL)
	_label(panel, "当前构筑：%s  /  %s" % [module_names(meta.get("loadout", [])), effect_text(meta.get("effects", {}))], 18)
	_label(panel, "远征禁用 R 重开。可继续驾驶；放弃或正常退出会按当前损耗办理救援，无交付报酬。", 18, AMBER)
	_damage_summary(panel, voyage)
	_energy_summary(panel, voyage, true)
	_build_segments(body)
	if not _view.pending:
		_action(actions, "继续驾驶 [P / Esc]", "resume", true)
		_action(actions, "放弃本次部署…", "abandon", false)
	else:
		_pending_summary(body)


func _build_result(body: VBoxContainer, actions: HBoxContainer) -> void:
	var voyage: Dictionary = _view.terminal
	var meta: Dictionary = voyage.get("expedition", {})
	var result := _card(body, String(meta.get("name", "远征部署")))
	_label(result, String(voyage.notice if voyage.phase == "success" else voyage.fail_reason), 20, TEAL if voyage.phase == "success" else AMBER)
	_label(result, "用时 %s  ·  船体 %.1f%%  ·  舱体 %.1f%%  ·  余电 %.1f%%  ·  峰张 %s" % [
		_time(float(voyage.time)), float(voyage.hull), float(voyage.cargo_integrity), float(voyage.battery),
		"≥150%" if float(voyage.peak_tension) >= Cockpit.TOW_DISPLAY_LIMIT else "%.1f%%" % (float(voyage.peak_tension) * 100.0)], 18)
	if voyage.has("tide_survey"):
		var survey: Dictionary = voyage.tide_survey
		var logged: bool = voyage.phase == "success" and not bool(_view.pending)
		_label(result, "潮流取样 %d / %d · %s" % [int(survey.completed), survey.stations.size(),
			"缓流时窗已入档，可用于同区主回收。" if logged else "缓流时窗未入档。"], 18, TEAL if logged else AMBER)
	_damage_summary(result, voyage)
	_energy_summary(result, voyage, false)
	_build_segments(body)
	_label(result, "本部署不计入三合同快玩历史最佳。远征不能按 R 免费重开。", 17, MUTED)
	if _view.pending:
		_pending_summary(body)
	else:
		var history: Array = _view.state.history
		if not history.is_empty():
			var entry: Dictionary = history.back()
			_label(result, "已入账：资金 %+d  ·  材料 %+d  ·  已交付 %d / 6" % [int(entry.credits_delta), int(entry.parts_delta), _view.state.path.size()], 18, TEAL)
		var next := "返回船坞 · 下一部署" if voyage.phase == "success" else "返回船坞 · 整备或撤退"
		_action(actions, "查看远征终局" if _view.state.status == "completed" else next, "dock", true)
	if _review_open:
		var review: Dictionary = _view.review
		var card := _card(body, "航次复盘  /  已采集 %d · 保留 %d" % [int(review.get("total_events", 0)), review.get("events", []).size()])
		for key: String in ["summary_text", "coverage_text", "timeline_text", "advice_text"]:
			var label := _label(card, String(review.get(key, "未记录")), 18, MUTED if key == "coverage_text" else INK)
			label.name = key
	else:
		_build_ledger(body, _view.state.history)


func _pending_summary(body: VBoxContainer) -> void:
	var next: Dictionary = _view.pending_state
	var card := _card(body, "待保存结果  /  尚未入账", AMBER)
	if next.is_empty():
		_label(card, "当前航次结果未通过规则验证，不能作为已保存进度。可明确放弃本机结果并重读档案。", 18, AMBER)
	else:
		var entry: Dictionary = next.history.back()
		_label(card, "待提交：资金 %+d · 材料 %+d · 船体 %.1f%% · 余电 %.1f%% · 压力 %d" % [
			int(entry.credits_delta), int(entry.parts_delta), float(next.hull), float(next.battery), int(next.pressure)], 18, AMBER)
		var guidance := "磁盘已有不同进度。重读前需明确舍弃本机未提交的结果；不会覆盖或合并档案。" if _view.conflict else \
			"修复写入问题后可重试保存同一结果；不会重新计算报酬。"
		_label(card, guidance, 17, MUTED)


func _build_segments(body: VBoxContainer) -> void:
	var observed: Dictionary = _view.get("segments", {})
	if observed.is_empty():
		return
	var card := _card(body, "手动航段观察  /  保留 %d / 6" % observed.records.size())
	_label(card, String(observed.policy), 17, MUTED).name = "SegmentPolicy"
	_label(card, String(observed.method), 17, MUTED)
	if not observed.active.is_empty():
		_label(card, "活动航段（暂停冻结；恢复后K完成／L取消）\n" + Segments.describe(observed.active), 18, TEAL).name = "SegmentActive"
	if observed.records.is_empty():
		_label(card, "暂无完成航段。驾驶中 J 开始、K 完成、L 取消；取消不留记录。", 18, MUTED)
	for record: Dictionary in observed.records:
		_label(card, "航段 #%d\n%s" % [int(record.number), Segments.describe(record)], 18).name = "SegmentRecord%d" % int(record.number)


func _add_pending_actions(actions: HBoxContainer) -> void:
	if _view.retryable and not _view.conflict:
		_action(actions, "重试保存结果", "retry_save", true)
	else:
		_action(actions, "重读档案…", "reload", true)


func _build_ledger(body: VBoxContainer, history: Array) -> void:
	var card := _card(body, "远征账本  /  最近 %d 条" % history.size())
	if history.is_empty():
		_label(card, "暂无变更。出航先记费用，交付才计报酬。", 18, MUTED)
	for index in range(history.size() - 1, -1, -1):
		var entry: Dictionary = history[index]
		var outcome := String(OUTCOME_NAMES.get(entry.outcome, ""))
		var voyage := String(entry.offer_id)
		var text := String(LEDGER_NAMES.get(entry.event, entry.event))
		if not outcome.is_empty():
			text += " · " + outcome
		if not voyage.is_empty():
			text += "  /  " + _ledger_contract(voyage)
		var row := _column(card, 2)
		_label(row, text, 18, TEAL if entry.event == "settle" and entry.outcome == "success" else INK)
		_label(row, "资金 %+d · 材料 %+d   |   船体 %.1f%% · 电量 %.1f%% · 压力 %d" % [
			int(entry.credits_delta), int(entry.parts_delta), float(entry.hull), float(entry.battery), int(entry.pressure)], 17, MUTED)
		if entry.has("damage_control"):
			_label(row, "结构破口 %.2f · 剩余封堵包 %d" % [float(entry.damage_control.breach), int(entry.damage_control.kits)], 17, MUTED)


func _damage_summary(parent: Control, voyage: Dictionary) -> void:
	if not voyage.has("damage_control"):
		return
	var d: Dictionary = voyage.damage_control
	_label(parent, "舱底进水 %.1f%% · 结构破口 %.2f · 临时封堵 %.2f · 耗包 %d / 剩余 %d" % [float(d.water), float(d.breach), float(d.sealed), int(d.patches_used), int(d.kits)], 18, AMBER if d.water >= 40 else TEAL)
	_label(parent, "入港只排干积水，临时封堵不跨航次；结构破口与未用封堵包按实际结果入账。", 17, MUTED)


func _energy_summary(parent: Control, voyage: Dictionary, show_rate: bool) -> void:
	if not voyage.has("energy_budget"):
		return
	var budget: Dictionary = voyage.energy_budget
	if show_rate:
		var rate: Dictionary = budget.rate
		_label(parent, "上一步耗电 %.3f 点/秒（非续航预测）\n待机 %.3f · 油门 %.3f · 进水附加 %.3f\n声纳 %.3f · 拖带/绞盘 %.3f · 水泵 %.3f" % [
			float(rate.total), float(rate.idle), float(rate.propulsion), float(rate.flood),
			float(rate.sonar), float(rate.tow), float(rate.pump)], 18, TEAL)
	var spent: Dictionary = budget.spent
	_label(parent, "本航实耗 %.3f 电量点\n待机 %.3f · 油门 %.3f · 进水附加 %.3f\n声纳 %.3f · 拖带/绞盘 %.3f · 水泵 %.3f" % [
		float(spent.total), float(spent.idle), float(spent.propulsion), float(spent.flood),
		float(spent.sonar), float(spent.tow), float(spent.pump)], 18)
	_label(parent, "已含改装耗电；进水项只加在油门，泵费独立。暂停不耗电；读数不是回港电量保证。", 17, MUTED)


func _ledger_contract(id: String) -> String:
	var path: Array = _view.state.path
	# Current and earlier nodes, including alternate/failed attempts, share the
	# same validated prefix. Names are catalog names, not invented from the ID.
	for step in range(mini(path.size() + 1, 6)):
		var contract := Catalog.build_contract(id, 0, path.slice(0, step))
		if not contract.is_empty():
			return String(contract.name)
	return id


func _build_confirmation(body: VBoxContainer, actions: HBoxContainer, kind: String) -> void:
	var offer: Dictionary = _view.offer
	var state: Dictionary = _view.state
	var voyage: Dictionary = _view.voyage
	var title := "确认操作"
	var text := ""
	var accept := "确认"
	match kind:
		"work_order":
			title = "确认整备工单"
			var order: Dictionary = _view.work_order
			var next: Dictionary = order.state
			text = "%d 项整备一次保存，档案修订只增加一次；每项仍按原规则记入账本。\n资金 %d → %d · 材料 %d → %d · 压力 %d → %d\n船体 %.1f → %.1f%% · 电量 %.1f → %.1f%%\n装备：%s\n取消不会收费。保存失败保留草案但不部分扣费；冲突需重读，不能覆盖磁盘进度。" % [order.steps.size(), int(state.credits), int(next.credits), int(state.parts), int(next.parts), int(state.pressure), int(next.pressure), float(state.hull), float(next.hull), float(state.battery), float(next.battery), module_names(next.equipped)]
			accept = "保存整单"
		"discard_work_order", "discard_work_order_quit":
			title = "舍弃未提交整备草案"
			text = "工单尚未扣费或入账。返回任务台／退出会丢弃这份内存草案；已保存档案不变。"
			accept = "舍弃并退出" if kind == "discard_work_order_quit" else "舍弃并返回"
		"launch":
			title = "出航确认  /  " + String(offer.get("name", ""))
			text = "%s\n\n船体 %.1f%% · 电量 %.1f%% · 构筑：%s\n将支付 %d 资金，剩余 %d。只有保存成功才进入真实驾驶。" % [
				_quote(offer), float(state.hull), float(state.battery), module_names(state.equipped), int(offer.launch_cost), int(_view.launch.state.credits)]
			if offer.has("tide_stations"):
				text += "\n\n" + String(offer.briefing)
			if state.has("damage_control"):
				text += "\n\n结构破口 %.2f · 封堵包 %d。破口会持续进水；G 排水耗电，H 低速连续封堵，临封不能替代返港维修。" % [float(state.damage_control.breach), int(state.damage_control.kits)]
			accept = "支付并出航"
		"abandon", "abandon_quit", "recover_interrupted":
			var loading := kind == "recover_interrupted"
			title = "中断返港" if loading else "放弃本次部署"
			var baseline := "按出航登记（船体 %.1f%%、电量 %.1f%%）；不恢复航行末帧。" % [float(state.hull), float(state.battery)] if loading else \
				"按当前真实耗损（船体 %.1f%%、电量 %.1f%%），不会回补。" % [float(voyage.hull), float(voyage.battery)]
			text = "%s\n救援再扣船体 %.0f 点、电量 %.0f 点，压力最多 +%d；不退航费、不发奖、不推进航图。" % [baseline, State.INTERRUPTED_HULL_LOSS, State.INTERRUPTED_BATTERY_LOSS, State.INTERRUPTED_PRESSURE]
			if state.has("damage_control"):
				text += "\n中断按出航破口另 +0.35，并损失全部预装封堵包；无末帧恢复。" if loading else "\n保留当前真实破口和未用封堵包；临封不代替结构修复。"
			accept = "结算放弃并退出" if kind == "abandon_quit" else "确认返港"
		"restore":
			title = "恢复上一份有效备份"
			text = "若存在坏主档，先另存坏主档，再恢复验证通过的备份；进度可能比主档旧。有中断部署仍需救援返港。"
			accept = "确认恢复"
		"retreat":
			title = "终止整段远征"
			text = "保留当前资金、材料和账本，进入撤退终局。不会补发任何报酬，也不能在这份终局上继续部署。"
			accept = "确认撤退"
		"restart":
			title = "另起独立远征"
			text = "将新建六部署航图，不继承本次奖励。上一份终局会进入同档 .bak；后续提交会轮换该备份。"
			accept = "确认新建"
		"enable_damage":
			title = "明确启用进水损管扩展"
			text = "保留当前远征资金、材料、航图与原损伤；不追溯新增破口。自下一次出航起，触礁可造成跨航次结构破口与进水；需在耗电排水、预装材料封堵、船坞维修之间权衡。读取本身不升级，确认保存成功后才生效。扩展档案不能用旧程序读取；不影响三合同快玩。"
			accept = "启用并保存"
		"discard_pending":
			title = "舍弃待保存结果"
			text = "重读磁盘将舍弃本机会话未提交的结果。不会合并或覆盖其他会话；若磁盘仍登记出航，需要按中断规则返港。"
			accept = "舍弃并重读"
		"quit_unsaved":
			title = "退出但不保存结果"
			text = "尚未入账的航次结果会丢失。下次只读磁盘已有档案；若仍登记出航，则必须按中断规则返港。"
			accept = "仍然退出"
	var card := _card(body, title, AMBER)
	_label(card, text, 20)
	_action(actions, "取消 [Esc]", "cancel", false)
	_action(actions, accept, "confirm", true)
	_focus_first = "cancel"


func _resource_strip(parent: Control, state: Dictionary) -> void:
	var row := _row(parent, 5)
	# During an active deployment these are the durable departure readings, not
	# the live values shown on the paused voyage (or unsaved terminal) card.
	var origin := "出航" if state.status == "active" else ""
	for pair: Array in [["资金", "%d" % int(state.credits)], ["材料", "%d" % int(state.parts)],
			[origin + "船体", "%.1f%%" % float(state.hull)], [origin + "电量", "%.1f%%" % float(state.battery)],
			["压力", "%d" % int(state.pressure)]]:
		var cell := _card(row, "")
		var label := _label(cell, "%s  %s" % [pair[0], pair[1]], 18, TEAL)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if state.has("damage_control"):
		_label(parent, "%s结构破口 %.2f / %.0f · %s封堵包 %d / %d（港内排水不修结构）" % [origin, float(state.damage_control.breach), Damage.MAX_BREACH, origin, int(state.damage_control.kits), Damage.MAX_KITS], 16, MUTED)


func _quote(offer: Dictionary) -> String:
	var text := "海况基准 %.1f%% · 舱重 %.2f · 窗口 %s\n航费 %d · 报酬上限 %d · 交付材料 +%d" % [
		float(offer.severity) * 100.0, float(offer.mass), _time(float(offer.deadline)),
		int(offer.launch_cost), int(offer.reward), int(offer.parts_reward)]
	if offer.has("current_scale"):
		text += "\n已测缓流时窗 · 局部涡流 ×%.2f" % float(offer.current_scale)
	return text


func _leg_name(sector: int, leg: int) -> String:
	return "潮标／打捞／制图" if leg == 0 else ("旗舰回收" if sector == 3 else "主回收")


static func module_names(ids: Array) -> String:
	return Cockpit.module_names(ids)


static func effect_text(effects: Dictionary) -> String:
	var parts := PackedStringArray()
	for key: String in EFFECT_NAMES:
		if effects.has(key) and not is_equal_approx(float(effects[key]), 1.0):
			parts.append("%s ×%.3f" % [EFFECT_NAMES[key], float(effects[key])])
	return "原装倍率" if parts.is_empty() else " · ".join(parts)


func _card(parent: Control, title: String, ink: Color = TEAL) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var skin := StyleBoxFlat.new()
	skin.bg_color = Color("122637")
	skin.border_color = Color("315062")
	skin.set_border_width_all(1)
	skin.set_corner_radius_all(6)
	skin.content_margin_left = 12
	skin.content_margin_right = 12
	skin.content_margin_top = 7
	skin.content_margin_bottom = 7
	panel.add_theme_stylebox_override("panel", skin)
	parent.add_child(panel)
	var box := _column(panel, 5)
	if not title.is_empty():
		_label(box, title, 20, ink)
	return box


func _column(parent: Control, separation: int) -> VBoxContainer:
	var node := VBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	parent.add_child(node)
	return node


func _row(parent: Control, separation: int) -> HBoxContainer:
	var node := HBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	parent.add_child(node)
	return node


func _label(parent: Control, text: String, point: int, ink: Color = INK) -> Label:
	var label := Label.new()
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.text = text
	label.add_theme_color_override("font_color", ink)
	label.add_theme_font_size_override("font_size", point)
	parent.add_child(label)
	return label


func _action(parent: Control, text: String, action: String, primary: bool, disabled := false, value := "") -> Button:
	var id := action if value.is_empty() else action + "_" + value
	var button := _button(parent, text, id, primary, requested.emit.bind(action, value))
	button.disabled = disabled
	if not disabled and primary and _focus_first.is_empty():
		_focus_first = id
	return button


func _button(parent: Control, text: String, id: String, primary: bool, callback: Callable) -> Button:
	var button := Button.new()
	button.name = id.capitalize().replace(" ", "")
	button.set_meta("expedition_button", id)
	button.text = text
	button.focus_mode = Control.FOCUS_ALL
	button.custom_minimum_size.y = 40
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.theme_type_variation = &"PrimaryButton" if primary else &""
	button.pressed.connect(callback)
	parent.add_child(button)
	_buttons[id] = button
	return button


func _time(seconds: float) -> String:
	var tenths := roundi(maxf(0, seconds) * 10.0)
	return "%02d:%02d.%d" % [floori(tenths / 600.0), floori((tenths % 600) / 10.0), tenths % 10]
