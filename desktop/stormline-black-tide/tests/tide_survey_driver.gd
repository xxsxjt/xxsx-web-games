extends RefCounted
## Read-only input navigator. Never assigns simulator or campaign fields.
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const Needle = preload("res://tests/journey_test.gd")


static func controls(sim, view: Dictionary, cursor: Dictionary) -> Dictionary:
	var survey: Dictionary = view.get("tide_survey", {})
	if not survey.is_empty() and int(survey.completed) < survey.stations.size():
		var station: Vector2 = survey.stations[int(survey.completed)]
		var near: bool = view.position.distance_to(station) <= float(survey.radius) + 6.0
		var input := Pilot._pilot(view, station, 2.7 if near else 8.0, 1, near)
		input.scan = view.position.distance_to(station) <= float(survey.radius)
		return input
	var stage := "return" if view.tow_attached else ("cargo" if view.scanned else "outbound")
	if stage != cursor.stage:
		cursor.stage = stage
		cursor.index = 0
	var input: Dictionary
	if not survey.is_empty() and stage == "outbound":
		# Both stations are already on the far side of the departure reefs.
		var beacon: Vector2 = view.beacon
		var near: bool = view.position.distance_to(beacon) < 24.0
		input = Pilot._pilot(view, beacon - (beacon - view.harbor).normalized() * 7.0, 3.8 if near else 8.0, 1)
		input.scan = near
	elif view.contract_id == "cross-current":
		cursor.index = Pilot.route_index_for(view, stage, cursor.index)
		input = Pilot.controls_for(sim, stage, cursor.index, cursor.tow)
	else:
		var route: Array = Pilot.ROUTES.safe.get(stage, [])
		input = Pilot.controls_for(sim, stage, route.size(), cursor.tow)
		if view.contract_id == "needle-bank" and stage in ["outbound", "return"]:
			var goals: Array = Needle.NEEDLE_OUTBOUND if stage == "outbound" else Needle.NEEDLE_RETURN
			while cursor.index < goals.size() and view.position.distance_to(goals[cursor.index]) < Pilot.WAYPOINT_RADIUS:
				cursor.index += 1
			if cursor.index < goals.size():
				input.merge(Pilot._pilot(view, goals[cursor.index], 8.0 if stage == "outbound" else 5.0,
					1 if stage == "outbound" else 2), true)
	cursor.tow = input.get("tow_pressed", false)
	return input
