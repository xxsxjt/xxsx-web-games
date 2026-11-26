extends SceneTree
const Nav = preload("res://src/public_navigation.gd")
const Sim = preload("res://src/storm_sim.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const Radar = preload("res://src/radar.gd")
var checks := 0
var failures := 0

func _init() -> void:
	for id: String in Sim.CONTRACTS:
		var sim := Sim.new()
		sim.reset(id)
		var view := sim.snapshot().duplicate(true)
		var before := view.duplicate(true)
		var options := Nav.routes(view)
		_check(options.size() <= Nav.LIMIT and options.size() >= 4, "bounded public choices " + id)
		for option: Dictionary in options:
			_check(option.points.size() <= 3 and not option.points.is_empty(), "bounded route")
			var projected := Nav.project(view, option.id, 0)
			_check(projected.active and projected.distance_m == view.position.distance_to(projected.point), "ship-based range")
		view.cargo_position = Vector2(99999, -99999)
		view["target"] = Vector2(-12345, 98765)
		view.scanned = true
		_check(Nav.routes(view) == options, "hidden or locked cargo never selects navigation")
		view = before.duplicate(true)
		Nav.project(view, "search", 0)
		_check(view == before, "projection preserves input")
	var fixture := {"harbor": Vector2(-20, -40), "beacon": Vector2(-20, -50), "position": Vector2(-20, -40)}
	_check(Nav.project(fixture, "search", 0).bearing_degrees == 0.0, "north zero")
	fixture.beacon = Vector2(-10, -40)
	_check(Nav.project(fixture, "search", 0).bearing_degrees == 90.0, "east ninety")
	fixture.beacon = Vector2(-20, -30)
	_check(Nav.project(fixture, "search", 0).bearing_degrees == 180.0, "south 180")
	fixture.beacon = Vector2(-30, -40)
	_check(Nav.project(fixture, "search", 0).bearing_degrees == 270.0, "west 270")
	fixture.beacon = fixture.position
	_check(Nav.project(fixture, "search", 0).detail.contains("无方位"), "coincident no invented bearing")
	fixture.beacon += Vector2(0.001, 0)
	_check(Nav.project(fixture, "search", 0).detail.contains("<0.1"), "positive sub-decimeter never zero")
	fixture.beacon = Vector2(-20.0001, -100)
	_check(Nav.project(fixture, "search", 0).detail.contains("000°"), "bearing wraps rounded 360")
	_check(not Nav.project(fixture, "search", 1).active and not Nav.project(fixture, "missing", 0).active, "manual end and unavailable route")
	var chart_before := Radar.chart_geometry(fixture, Vector2(290, 238))
	fixture["navigation"] = {"active": true, "point": Vector2(9000, -9000)}
	var chart := Radar.project_snapshot(fixture, Vector2(290, 238))
	_check(chart.chart == chart_before and chart.navigation.clipped and chart.cargo.is_empty(), "navigation cannot zoom chart or disclose unknown pod")
	_check(Vector2(chart.navigation.plotted).distance_to(chart.chart.center) <= chart.chart.radius, "marker clipped in chart bounds")
	_check(chart.navigation.range_m == fixture.position.distance_to(fixture.navigation.point), "clipped range still world distance")
	var path: Array = []
	for step in range(6):
		var offers := Catalog.offers((step >> 1) + 1, step % 2, path, 0)
		for offer: Dictionary in offers:
			var public: Dictionary = Sim.CONTRACTS[offer.base_contract].duplicate(true)
			var original := public.duplicate(true)
			_check(not Nav.project(public, "tide-0", 0).active, "non-chart public geometry has no tide destination")
			if offer.has("tide_stations"):
				public["tide_survey"] = {"stations": offer.tide_stations, "completed": 0}
				var first := Nav.project(public, "tide-0", 0)
				_check(first.active and first.point == offer.tide_stations[0], "available A public " + offer.id)
				public.tide_survey.completed = 1
				_check(not Nav.project(public, "tide-0", 0).active and Nav.project(public, "tide-1", 0).active, "no stale current station")
				public.tide_survey.completed = 2
				_check(not Nav.project(public, "tide-1", 0).active, "completed sample navigation removed")
			_check(Nav.routes(public).size() <= Nav.LIMIT, "every offer bounded " + offer.id)
			public["cargo_position"] = Vector2(50000, -60000)
			public["target_visible"] = true
			public["scanned"] = true
			var known := Nav.routes(public)
			public.cargo_position = Vector2(-70000, 80000)
			public.target = Vector2(12345, -67890)
			_check(Nav.routes(public) == known and Sim.CONTRACTS[offer.base_contract] == original, "all branch locked disclosure/purity " + offer.id)
		path.append(offers[0].id)
	print("Stormline public navigation rules: %d checks, %d failures; synthetic public fixtures." % [checks, failures])
	quit(0 if failures == 0 else 1)

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + label)
