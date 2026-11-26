extends RefCounted
## Bounded, memory-only navigation projection. Never reads target/cargo state.
const LIMIT := 12
const NEAR_METERS := 8.0


static func routes(public: Dictionary) -> Array:
	var result: Array = []
	if public.get("harbor") is Vector2:
		result.append(_route("harbor", "港心", [_point("港心（非交付判定）", public.harbor)]))
	if public.get("beacon") is Vector2:
		result.append(_route("search", "搜索区中心（非舱位）", [_point("搜索区中心（非舱位）", public.beacon)]))
	var survey: Dictionary = public.get("tide_survey", {})
	var stations: Array = survey.get("stations", [])
	var current := int(survey.get("completed", 0))
	if current >= 0 and current < stations.size() and stations[current] is Vector2:
		var label := "潮站 %s（仍须 E 取样）" % ("A" if current == 0 else "B")
		result.append(_route("tide-%d" % current, label, [_point(label, stations[current])]))
	for index in range(mini(public.get("hazards", []).size(), 8)):
		var hazard: Dictionary = public.hazards[index]
		if hazard.get("kind") != "reef" or not hazard.get("position") is Vector2:
			continue
		for side in [-1, 1]:
			if result.size() >= LIMIT:
				break
			var label := String(hazard.get("name", "公开礁")) + ("西侧参考" if side == -1 else "东侧参考")
			var point: Vector2 = hazard.position + Vector2(side * (maxf(0.0, float(hazard.get("radius", 0.0))) + 18.0), 0)
			var points := [_point(label, point)]
			if public.get("beacon") is Vector2:
				points.append(_point("搜索区中心（非舱位）", public.beacon))
			if public.get("harbor") is Vector2:
				points.append(_point("港心（非交付判定）", public.harbor))
			result.append(_route("reef-%d-%d" % [index, side], label + "→搜索→港", points))
	return result


static func project(public: Dictionary, route_id: String, index: int) -> Dictionary:
	var options := routes(public)
	var route: Dictionary = {}
	for option: Dictionary in options:
		if option.id == route_id:
			route = option
	var view := {"routes": options, "route_id": route_id, "index": index, "active": false,
		"summary": "导航未选 · N 换线 / B 下一点 / C 清空", "detail": "仅公开参考；不自动驾驶或保证避礁。"}
	if route_id.is_empty():
		return view
	if route.is_empty():
		view.summary = "航点已不可用 · N 换线 / C 清空"
		return view
	if index < 0 or index >= route.points.size():
		view.summary = "路线已手动走完 · N 换线 / C 清空"
		return view
	var point: Dictionary = route.points[index]
	view.merge({"active": true, "point": point.position, "label": point.label, "count": route.points.size()}, true)
	view.summary = "%d/%d %s" % [index + 1, route.points.size(), point.label]
	if public.get("position") is Vector2:
		var offset: Vector2 = point.position - Vector2(public.position)
		var distance := offset.length()
		var bearing := fposmod(rad_to_deg(atan2(offset.x, -offset.y)), 360.0)
		var range_text := "<0.1" if distance > 0.0 and distance < 0.1 else "%.1f" % distance
		view.merge({"distance_m": distance, "bearing_degrees": bearing, "coincident": distance == 0.0, "near": distance <= NEAR_METERS})
		view.detail = "船距 %sm · %s%s" % [range_text, "同点／无方位" if distance == 0.0 else "北基准 %03d°" % (roundi(bearing) % 360), " · 近点，仍须手动 B" if distance <= NEAR_METERS else ""]
	return view


static func _point(label: String, position: Vector2) -> Dictionary:
	return {"label": label, "position": position}


static func _route(id: String, label: String, points: Array) -> Dictionary:
	return {"id": id, "label": label, "points": points}
