class_name StormRadar
extends Control

const GRID := Color(0.33, 0.70, 0.77, 0.24)
const INK := Color("a8c8d6")
const TUG := Color("9ff5f3")
const HARBOR := Color("79e8cc")
const SIGNAL := Color("eeb575")
const CARGO := Color("ff9c63")
const REEF := Color("f58c91")
const CURRENT := Color("a6a4f5")
const SURVEY := Color("b3eaff")
const CONTACT_INSET := 8.0
const NAVIGATION := Color("e6e38d")

var world_radius := 118.0
var _snapshot: Dictionary = {}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true

func set_snapshot(value: Dictionary) -> void:
	_snapshot = value
	queue_redraw()


## Pure presentation helpers: no model, clock, scene or input-dictionary writes.
static func chart_geometry(value: Dictionary, dimensions: Vector2, minimum_extent: float = 118.0) -> Dictionary:
	var radius := minf(dimensions.x * 0.37, (dimensions.y - 48.0) * 0.5)
	var center := Vector2(dimensions.x * 0.46, dimensions.y * 0.5 + 1.0)
	var harbor: Vector2 = value.get("harbor", Vector2.ZERO)
	var beacon: Vector2 = value.get("beacon", harbor)
	var harbor_radius := maxf(0.0, float(value.get("harbor_radius", 0.0)))
	var hazards: Array = value.get("hazards", [])
	var survey: Dictionary = value.get("tide_survey", {})
	# Stable north-up chart: only public chart features contribute to its extent.
	var origin := harbor.lerp(beacon, 0.42)
	var extent := maxf(maxf(minimum_extent, 25.0), origin.distance_to(harbor) + harbor_radius + 8.0)
	extent = maxf(extent, origin.distance_to(beacon) + 23.0)
	for raw in hazards:
		if raw is Dictionary and raw.get("position") is Vector2:
			var point: Vector2 = raw.get("position")
			extent = maxf(extent, origin.distance_to(point) + maxf(0.0, float(raw.get("radius", 0.0))) + 8.0)
	for station: Vector2 in survey.get("stations", []):
		extent = maxf(extent, origin.distance_to(station) + float(survey.radius) + 8.0)
	extent = ceilf(extent / 25.0) * 25.0
	return {"origin": origin, "center": center, "radius": radius, "extent": extent, "scale": radius / extent}


## Range is measured from the supplied PUBLIC world reference, never from pixels.
## Bearing is chart-origin north-up, not the tug's heading or a tug-relative bearing.
static func project_contact(chart: Dictionary, world: Vector2, range_origin: Vector2) -> Dictionary:
	var offset: Vector2 = world - Vector2(chart.origin)
	var pixels: Vector2 = offset * float(chart.scale)
	var limit := maxf(0.0, float(chart.radius) - CONTACT_INSET)
	return {"plotted": Vector2(chart.center) + pixels.limit_length(limit),
		"clipped": float(chart.radius) < 18.0 or pixels.length_squared() > limit * limit,
		"range_m": world.distance_to(range_origin), "chart_range_m": offset.length(),
		"bearing_degrees": fposmod(rad_to_deg(atan2(offset.x, -offset.y)), 360.0),
		"direction": offset.normalized()}


static func project_snapshot(value: Dictionary, dimensions: Vector2, minimum_extent: float = 118.0) -> Dictionary:
	var chart := chart_geometry(value, dimensions, minimum_extent)
	var tug: Dictionary = {}
	var cargo: Dictionary = {}
	var rows: Array[String] = []
	if value.get("position") is Vector2:
		var home: Vector2 = value.get("harbor", chart.origin)
		tug = project_contact(chart, value.position, home)
		if tug.clipped:
			rows.append(_edge_caption("船", tug, "港距" if value.has("harbor") else "图心距"))
	# Even a raw model snapshot may contain the unknown pod. It must not affect
	# extent, contacts, bearings, range text or tow feedback before sonar lock.
	if bool(value.get("scanned", false)) and value.get("cargo_position") is Vector2:
		var reference: Vector2 = value.get("position", chart.origin)
		cargo = project_contact(chart, value.cargo_position, reference)
		cargo["filled"] = bool(value.get("tow_attached", false)) or bool(value.get("target_visible", true))
		if cargo.clipped:
			rows.append(_edge_caption("舱" if cargo.filled else "舱迹", cargo, "船距" if not tug.is_empty() else "图心距"))
	var solid_towline := bool(value.get("tow_attached", false)) and not tug.is_empty() and not cargo.is_empty() \
		and not bool(tug.clipped) and not bool(cargo.clipped)
	var navigation: Dictionary = {}
	var nav: Dictionary = value.get("navigation", {})
	if nav.get("active", false) and nav.get("point") is Vector2:
		navigation = project_contact(chart, nav.point, value.get("position", chart.origin))
		if navigation.clipped:
			rows.append(_edge_caption("航点", navigation, "船距"))
	return {"chart": chart, "tug": tug, "cargo": cargo, "navigation": navigation, "solid_towline": solid_towline, "edge_readouts": rows}


static func _edge_caption(role: String, contact: Dictionary, reference: String) -> String:
	var range_text := "<0.1" if contact.range_m > 0.0 and contact.range_m < 0.1 else "%.1f" % contact.range_m
	return "%s 图外 图心%03d° %s%sm" % [role, int(roundf(contact.bearing_degrees)) % 360, reference, range_text]


func projection() -> Dictionary:
	return project_snapshot(_snapshot, size, world_radius)


func _draw() -> void:
	var view := projection()
	var chart: Dictionary = view.chart
	var radius := float(chart.radius)
	if radius < 18.0:
		return
	var center: Vector2 = chart.center
	var origin: Vector2 = chart.origin
	var scale := float(chart.scale)
	var harbor: Vector2 = _snapshot.get("harbor", Vector2.ZERO)
	var beacon: Vector2 = _snapshot.get("beacon", harbor)
	var harbor_radius := maxf(0.0, float(_snapshot.get("harbor_radius", 0.0)))
	var hazards: Array = _snapshot.get("hazards", [])
	var survey: Dictionary = _snapshot.get("tide_survey", {})
	_draw_grid(center, radius, scale)

	for raw in hazards:
		if raw is Dictionary and raw.get("position") is Vector2:
			var point: Vector2 = raw.get("position")
			_draw_hazard(center + (point - origin) * scale, maxf(5.0, float(raw.get("radius", 0.0)) * scale), String(raw.get("kind", "reef")))
	for landmark: Dictionary in _snapshot.get("current_landmarks", []):
		var point: Vector2 = landmark.get("position", origin)
		var mark := center + (point - origin) * scale
		var label := str(int(landmark.get("number", 0)))
		var font := get_theme_default_font()
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		draw_circle(mark, 9.0, Color("171e3b"))
		draw_string(font, mark + Vector2(-width * 0.5, 5.5), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("f2efff"))
	if _snapshot.has("harbor"):
		var dock := center + (harbor - origin) * scale
		var ring := maxf(5.0, harbor_radius * scale)
		draw_circle(dock, ring, Color(HARBOR, 0.11))
		draw_arc(dock, ring, 0.0, TAU, 36, HARBOR, 1.5, true)
		draw_rect(Rect2(dock - Vector2(3.0, 3.0), Vector2(6.0, 6.0)), HARBOR)

	var tug: Dictionary = view.tug
	var cargo: Dictionary = view.cargo
	if bool(_snapshot.get("scanned", false)):
		if not cargo.is_empty():
			var cargo_mark: Vector2 = cargo.plotted
			if view.solid_towline:
				draw_line(tug.plotted, cargo_mark, Color(CARGO, 0.78), 1.6, true)
			var diamond := PackedVector2Array([cargo_mark + Vector2(0, -6), cargo_mark + Vector2(6, 0), cargo_mark + Vector2(0, 6), cargo_mark + Vector2(-6, 0)])
			if cargo.clipped:
				_draw_edge_contact(cargo, CARGO, 8.0)
			elif cargo.filled:
				draw_colored_polygon(diamond, CARGO)
			else:
				# Hollow trace: locked by sonar, but outside visual range.
				diamond.append(diamond[0])
				draw_polyline(diamond, CARGO, 1.7, true)
	elif _snapshot.has("beacon"):
		var region := center + (beacon - origin) * scale
		var uncertainty := maxf(11.0, 18.0 * scale)
		draw_circle(region, uncertainty, Color(SIGNAL, 0.10))
		_broken_ring(region, uncertainty, SIGNAL)

	if not survey.is_empty():
		_draw_tide_stations(survey, center, origin, scale)
	var nav: Dictionary = view.navigation
	if not nav.is_empty():
		if nav.clipped:
			_draw_edge_contact(nav, NAVIGATION, 11.0)
		else:
			draw_arc(nav.plotted, 11.0, 0, TAU, 24, NAVIGATION, 2.0, true)
			draw_arc(nav.plotted, 14.0, -PI * 0.8, -PI * 0.2, 10, NAVIGATION, 1.0, true)

	if not tug.is_empty() and tug.clipped:
		_draw_edge_contact(tug, TUG, 5.0)
	elif not tug.is_empty():
		var tug_mark: Vector2 = tug.plotted
		var heading := float(_snapshot.get("heading", 0.0))
		var forward := Vector2(sin(heading), -cos(heading))
		var side := Vector2(-forward.y, forward.x)
		var ship := PackedVector2Array([tug_mark + forward * 9.0, tug_mark - forward * 5.0 + side * 5.0, tug_mark - forward * 2.0, tug_mark - forward * 5.0 - side * 5.0])
		draw_colored_polygon(ship, TUG)
	_draw_wind(_snapshot.get("wind", Vector2.ZERO))
	_draw_edge_readouts(view.edge_readouts, center)


func _draw_tide_stations(survey: Dictionary, center: Vector2, origin: Vector2, scale: float) -> void:
	var complete := int(survey.completed)
	var font := get_theme_default_font()
	for i in survey.stations.size():
		var point: Vector2 = survey.stations[i]
		var at := center + (point - origin) * scale
		var radius := maxf(5.0, float(survey.radius) * scale)
		var tint := SURVEY if i == complete else Color(SURVEY, 0.5)
		if i == complete:
			draw_circle(at, radius, Color(SURVEY, 0.17))
		_broken_ring(at, radius, tint)
		if i == complete and float(survey.progress) > 0.0:
			draw_arc(at, radius + 2.0, -PI * 0.5, -PI * 0.5 + TAU * float(survey.progress), 24, SURVEY, 2.0, true)
		var label := ("A" if i == 0 else "B") + ("✓" if i < complete else "")
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		draw_circle(at, 9.0, Color("132b3b"))
		draw_string(font, at + Vector2(-width * 0.5, 5.5), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, tint)

func _draw_grid(center: Vector2, radius: float, scale: float) -> void:
	draw_circle(center, radius + 5.0, Color("132b3b"))
	draw_circle(center, radius, Color("091a29"))
	for circle in [0.33, 0.66, 1.0]:
		draw_arc(center, radius * float(circle), 0.0, TAU, 72, GRID, 1.0, true)
	for axis in [Vector2.RIGHT, Vector2.DOWN]:
		draw_line(center - axis * radius, center + axis * radius, GRID, 1.0, true)
	for i in range(24):
		var tick := Vector2.UP.rotated(i * TAU / 24.0)
		var depth := 8.0 if i % 6 == 0 else 3.0
		draw_line(center + tick * (radius - depth), center + tick * radius, GRID, 1.0, true)
	draw_string(get_theme_default_font(), Vector2(center.x - 5.5, center.y - radius - 8.0), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TUG)
	var scale_origin := Vector2(10, size.y - 10.0)
	draw_line(scale_origin, scale_origin + Vector2(25.0 * scale, 0), INK, 1.0)
	draw_string(get_theme_default_font(), scale_origin + Vector2(0, -5), "25 m", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, INK)

func _draw_hazard(at: Vector2, radius: float, kind: String) -> void:
	if kind == "current":
		draw_circle(at, radius, Color(CURRENT, 0.15))
		_broken_ring(at, radius, Color(CURRENT, 0.86))
		draw_line(at + Vector2(-4, -1), at + Vector2(4, -3), CURRENT, 1.4, true)
		draw_line(at + Vector2(-4, 3), at + Vector2(4, 1), CURRENT, 1.4, true)
	else:
		draw_circle(at, radius, Color(REEF, 0.19))
		draw_arc(at, radius, 0.0, TAU, 32, Color(REEF, 0.86), 1.2, true)
		draw_line(at - Vector2(3, 3), at + Vector2(3, 3), REEF, 1.5, true)
		draw_line(at - Vector2(3, -3), at + Vector2(3, -3), REEF, 1.5, true)

func _broken_ring(at: Vector2, radius: float, color: Color) -> void:
	for i in range(8):
		var start := i * TAU / 8.0
		draw_arc(at, radius, start, start + 0.49, 7, color, 1.6, true)

func _draw_edge_contact(contact: Dictionary, tint: Color, width: float) -> void:
	# Open bearing chevron + crossbar: deliberately neither a heading-shaped
	# ship nor an ordinary cargo diamond. Nested widths distinguish a clipped
	# same-bearing pair; separate role/range rows remain authoritative.
	var at: Vector2 = contact.plotted
	var direction: Vector2 = contact.direction
	var side := Vector2(-direction.y, direction.x)
	draw_polyline(PackedVector2Array([at - direction * 4.0 + side * width,
		at + direction * 5.0, at - direction * 4.0 - side * width]), tint, 2.0, true)
	draw_line(at - direction * 7.0 - side * width, at - direction * 7.0 + side * width, tint, 1.4, true)


func _draw_edge_readouts(rows: Array, center: Vector2) -> void:
	if rows.is_empty():
		return
	# A compact backed overlay inside the chart avoids clipping long range text
	# against an edge (including two contacts collapsed to the same pixel).
	# It does not move/zoom the chart, and leaves north, scale and wind intact.
	var font := get_theme_default_font()
	var at := Vector2(7.0, center.y - 8.0 * float(rows.size() - 1))
	for row: String in rows:
		var width := font.get_string_size(row, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		draw_rect(Rect2(at + Vector2(-3.0, -14.0), Vector2(width + 6.0, 18.0)), Color(0.035, 0.09, 0.14, 0.96))
		draw_string(font, at, row, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, NAVIGATION if row.begins_with("航点") else (TUG if row.begins_with("船") else CARGO))
		at.y += 19.0

func _draw_wind(wind: Vector2) -> void:
	var at := Vector2(size.x - 25.0, size.y - 40.0)
	draw_circle(at, 18.0, Color("132b3b"))
	if wind.length_squared() > 0.0025:
		var direction := wind.normalized()
		var nose := at + direction * 11.0
		var wing := Vector2(-direction.y, direction.x) * 4.0
		draw_line(at - direction * 10.0, nose, INK, 1.6, true)
		draw_colored_polygon(PackedVector2Array([nose, nose - direction * 6.0 + wing, nose - direction * 6.0 - wing]), INK)
	else:
		draw_circle(at, 2.5, INK)
	draw_string(get_theme_default_font(), at + Vector2(-8, 35), "风", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, INK)
