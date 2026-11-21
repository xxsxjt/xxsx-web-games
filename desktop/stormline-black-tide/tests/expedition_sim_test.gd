extends SceneTree
## Headless only. Voyages operate the original Pilot over real resets and step inputs.

const Sim = preload("res://src/storm_sim.gd")
const Catalog = preload("res://src/expedition_catalog.gd")
const State = preload("res://src/expedition_state.gd")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const Needle = preload("res://tests/journey_test.gd")
const DT := 1.0 / 60.0
const LOCKED_SIM := "res://.testdata/expedition-sim-stage25/storm_sim.gd"
const LOCKED_SHA256 := "7d9565221f51cb3b6a0620aa29b20819a57f41b900483776c320d11602cf1b66"
const SURVEY := "black-tide-survey-safe"
const SALVAGE := "black-tide-salvage-safe"
const RECOVERY := "black-tide-recovery-safe"
const GEOMETRY := ["start", "harbor", "harbor_radius", "beacon", "target", "hazards"]

var _checks := 0
var _failures := 0


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		printerr("expedition_sim_test.gd requires --headless")
		quit(1)
		return
	_test_catalog()
	_test_atomic_reset()
	_test_weather()
	_test_builds()
	_test_stock_parity()
	_test_campaign(["drive", "sonar"], ["black-tide-survey-high", RECOVERY,
		"needle-bank-survey-safe", "needle-bank-recovery-high", "cross-current-survey-safe", "cross-current-recovery-safe"])
	_test_campaign(["tow", "sonar"], ["black-tide-salvage-high", "black-tide-recovery-high",
		"needle-bank-salvage-high", "needle-bank-recovery-high", "cross-current-salvage-high", "cross-current-recovery-high"], "shortcut")
	if "--compare-stage25" in OS.get_cmdline_user_args():
		_test_locked_baseline()
	else:
		print("Stage25 external oracle not requested; use -- --compare-stage25 with the verified .testdata fixture.")
	print("Expedition simulation: %d checks, %d failures; official headless input only, desktop play untested." % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _test_catalog() -> void:
	var prefix := []
	for sector in range(1, 4):
		for leg in range(2):
			var quotes := Catalog.offers(sector, leg, prefix, 3)
			if not _expect(quotes.size() == (6 if leg == 0 else 2), "both risks offered on each branch, including charting"):
				return
			_expect(not Catalog.sector_name(sector).is_empty() and quotes[0].sector_name == Catalog.sector_name(sector),
				"available quote and pre-unlock sector name come from the same source")
			for index in range(0, quotes.size(), 2):
				var safe: Dictionary = quotes[index]
				var high: Dictionary = quotes[index + 1]
				_expect(safe.branch == high.branch and safe.risk == "safe" and high.risk == "high"
					and high.launch_cost > safe.launch_cost and high.reward - high.launch_cost > safe.reward - safe.launch_cost
					and high.severity > safe.severity and high.mass > safe.mass and high.deadline < safe.deadline,
					"hazard, duration, cost and profit change together on the same branch")
			for quote: Dictionary in quotes:
				var sim := Sim.new()
				var spec := _spec(quote.id, [], 3, prefix)
				if not _expect(sim.reset_expedition(spec), "legal preview resets: " + String(quote.id)):
					continue
				var matching := true
				var view := sim.snapshot()
				for key: String in spec.contract:
					matching = matching and sim.contract[key] == quote[key] and view.expedition[key] == quote[key]
				_expect(matching and view.contract_id == quote.base_contract and view.storm == quote.severity
					and view.deadline == quote.deadline and view.expedition.flagship == (sector == 3 and leg == 1),
					"preview, effective contract and metadata share exact values: " + String(quote.id))
				var base: Dictionary = Sim.CONTRACTS[view.contract_id]
				for key: String in GEOMETRY:
					_expect(sim.contract[key] == base[key], "original geometry retained: " + key)
			if leg == 0:
				_expect(quotes[0].branch == "survey" and quotes[2].branch == "salvage" and quotes[4].branch == "chart"
					and quotes[2].parts_reward > quotes[0].parts_reward and quotes[4].launch_cost > quotes[0].launch_cost,
					"original tide logger and salvage remain alongside the more costly physical chart route")
			prefix.append(quotes[0].id)
	_expect(Catalog.offers(3, 1, [], 0).is_empty() and Catalog.offers(0, 0, [], 0).is_empty()
		and Catalog.build_contract(RECOVERY, 0, [RECOVERY]).is_empty()
		and Catalog.build_contract(RECOVERY, 0, [SURVEY, RECOVERY]).is_empty(), "cannot skip or reorder deployments")
	_expect(Catalog.build_contract(RECOVERY, 99, [SURVEY]) == Catalog.build_contract(RECOVERY, Catalog.EFFECTIVE_PRESSURE_CAP, [SURVEY]),
		"late retries cannot drive the physical pressure past the disclosed ceiling")
	var modules := Catalog.modules()
	_expect(modules.size() == 3 and not modules.has("stock") and modules.drive.load == 2
		and modules.tow.load == 2 and modules.sonar.load == 1 and Catalog.MAX_SLOTS == 2 and Catalog.MAX_LOAD == 3,
		"empty stock, two slots, budget three, three actual modules")
	modules.drive.effects.thrust = 900.0
	_expect(Catalog.modules().drive.effects.thrust < 2.0, "directory callers cannot change module definitions")


func _test_atomic_reset() -> void:
	var sim := Sim.new()
	var reference := Sim.new()
	var spec := _spec(RECOVERY, ["drive", "sonar"], 3, [SURVEY], 62.5, 48.25)
	if not _expect(sim.reset_expedition(spec) and reference.reset_expedition(spec), "valid worn vessel deploys"):
		return
	var view := sim.snapshot()
	_expect(view.hull == 62.5 and view.battery == 48.25 and view.expedition.initial_hull == view.hull
		and view.expedition.initial_battery == view.battery and view.time == 0.0,
		"persisted resources are the actual physical start, not presentation only")
	var controls := {"power": 0, "throttle": 0.73, "steer": 0.32}
	for tick in range(60):
		sim.step(DT, controls)
		reference.step(DT, controls)
	var before := sim.snapshot()
	var prior_contract := sim.contract.duplicate(true)
	var invalid_values := {
		"token": ["", "has space", "bad\nkey", "a".repeat(41), 25], "offer_id": [SALVAGE, "not-an-offer", []],
		"loadout": [["stock"], ["drive", "tow"], ["drive", "tow", "sonar"], ["tow", "tow"], ["foreign"], [42], {}],
		"pressure": [-1, 100, 3.0, 8], "path": [[], [SALVAGE], [RECOVERY], [SURVEY, RECOVERY], {}],
		"hull": [0.0, -1.0, 100.01, INF, true], "battery": [0.0, -1, 100.01, NAN, "48.25"],
		"contract": [[], {}, {"id": RECOVERY}],
	}
	for key: String in invalid_values:
		for bad: Variant in invalid_values[key]:
			var invalid := spec.duplicate(true)
			invalid[key] = bad
			_expect(not sim.reset_expedition(invalid) and sim.snapshot() == before and sim.contract == prior_contract,
				"invalid %s is rejected atomically: %s" % [key, str(bad)])
	for key: String in ["id", "severity", "mass", "deadline", "reward", "target", "hazards"]:
		var forged := spec.duplicate(true)
		forged.contract[key] = 1.0
		_expect(not sim.reset_expedition(forged) and sim.snapshot() == before, "untrusted contract field rejected: " + key)
	var missing := spec.duplicate(true)
	missing.erase("loadout")
	_expect(not sim.reset_expedition(missing) and sim.snapshot() == before, "missing loadout is not stock by default")
	view = sim.snapshot()
	view.expedition.effects.thrust = 900.0
	view.expedition.loadout.clear()
	view.expedition.profile.thrust = 900.0
	view.expedition.thresholds.dock_speed = 900.0
	view.hazards[0].radius = 999.0
	spec.loadout.clear()
	spec.path.clear()
	spec.contract.name = "forged"
	_expect(sim.snapshot() == before and sim.step(DT, controls) == reference.step(DT, controls),
		"public metadata and launch envelope cannot mutate an accepted voyage")
	sim.reset("needle-bank")
	reference = Sim.new()
	reference.reset("needle-bank")
	_expect(sim.snapshot() == reference.snapshot() and not sim.snapshot().has("expedition")
		and not sim.snapshot().has("expedition_token") and not sim.snapshot().has("offer_id"), "back to quickplay removes all expedition metadata")
	var matching := true
	for tick in range(600):
		matching = matching and sim.step(DT, controls) == reference.step(DT, controls)
	_expect(matching, "return to quickplay also removes thrust/energy and persistent resources")


func _test_weather() -> void:
	var chart := _deployed(_spec(RECOVERY, [], 0, [SURVEY]))
	var salvage := _deployed(_spec(RECOVERY, [], 0, [SALVAGE]))
	var late := _deployed(_spec(RECOVERY, [], 9, [SURVEY]))
	if chart == null or salvage == null or late == null:
		return
	_expect(chart.contract.mass < salvage.contract.mass and chart.contract.mass < late.contract.mass,
		"charted lift and less exposure keep actual cargo mass lower")
	var chart_frame := chart.step(DT, {})
	var salvage_frame := salvage.step(DT, {})
	var late_frame := late.step(DT, {})
	_expect(chart_frame.wind.length() < salvage_frame.wind.length() and chart_frame.wind.length() < late_frame.wind.length()
		and chart_frame.cargo_velocity != salvage_frame.cargo_velocity and chart_frame.cargo_velocity != late_frame.cargo_velocity,
		"branch and pressure change live storm force and free-pod motion on identical inputs")
	for sim: Sim in [chart, salvage, late]:
		for tick in range(60 * 180):
			if sim.phase == "failed":
				break
			sim.step(DT, {})
		_expect(sim.phase == "failed" and sim.event_kind == "timeout" and sim.battery > 0.0
			and sim.mission_time >= sim.contract.deadline and sim.mission_time <= sim.contract.deadline + DT,
			"untouched vessel expires at the quoted real storm window")
	_expect(chart.mission_time > salvage.mission_time and chart.mission_time > late.mission_time,
		"route and delay change the tick on which the original deadline rule fails")
	print("SEA expiry chart=%.2fs salvage=%.2fs delayed_chart=%.2fs; first winds=%.3f/%.3f/%.3f" % [
		chart.mission_time, salvage.mission_time, late.mission_time,
		chart_frame.wind.length(), salvage_frame.wind.length(), late_frame.wind.length()])
	_test_cargo_load()


func _test_cargo_load() -> void:
	var light := _deployed(_spec(RECOVERY, [], 0, [SURVEY]))
	var heavy := _deployed(_spec(RECOVERY, [], 9, [SALVAGE]))
	if light == null or heavy == null or not _expect(_shared_attachment(light, heavy), "two active contracts reach towing through common controls"):
		return
	var light_response := 0.0
	var heavy_response := 0.0
	for tick in range(360):
		var controls := _shared_return_input(light)
		light_response = maxf(light_response, _cargo_response(light, controls))
		heavy_response = maxf(heavy_response, _cargo_response(heavy, controls))
		if light_response > 0.0 and heavy_response > 0.0:
			break
	_expect(light_response > heavy_response and heavy_response > 0.0,
		"on the same tow input the heavier weather-exposed pod accelerates less per unit of actual cable force")
	print("SEA tow response light %.2f mass → %.4f; heavy %.2f mass → %.4f (acceleration/force)" % [
		light.contract.mass, light_response, heavy.contract.mass, heavy_response])


func _cargo_response(sim: Sim, controls: Dictionary) -> float:
	var before := sim.snapshot()
	var after := sim.step(DT, controls)
	if not after.tow_attached or after.tension < 0.20 or after.tension >= 1.5:
		return 0.0
	# Remove the live free-pod acceleration to observe cable response, not a
	# comparison of two different winds. No position or resources are injected.
	var free_acceleration: Vector2 = (sim._flow(before.cargo_position) - before.cargo_velocity) * 0.56 + after.wind * 0.38
	var cable_acceleration: Vector2 = (after.cargo_velocity - before.cargo_velocity) / DT - free_acceleration
	return cable_acceleration.length() / (after.tension * after.expedition.profile.rating)


func _test_builds() -> void:
	var stock := _deployed(_spec(SALVAGE))
	var drive := _deployed(_spec(SALVAGE, ["drive"]))
	var tow := _deployed(_spec(SALVAGE, ["tow"]))
	var sonar := _deployed(_spec(SALVAGE, ["sonar"]))
	if stock == null or drive == null or tow == null or sonar == null:
		return
	var controls := {"power": 0, "throttle": 0.85, "steer": 0.25}
	for tick in range(90):
		stock.step(DT, controls)
		drive.step(DT, controls)
		tow.step(DT, controls)
	_expect(drive.velocity.length() > stock.velocity.length() and drive.battery < stock.battery,
		"drive uses more reserve for more propulsion on identical controls")
	_expect(tow.velocity.length() < stock.velocity.length() and absf(tow.heading) < absf(stock.heading)
		and tow.snapshot().expedition.profile.stability > stock.snapshot().expedition.profile.stability,
		"tow's heavier tug responds to both throttle and helm more slowly and has more lateral damping")
	print("BUILD same propulsion input: stock=%.3fm/s/%.3f%% drive=%.3fm/s/%.3f%% tow=%.3fm/s/%.3f%%" % [
		stock.velocity.length(), stock.battery, drive.velocity.length(), drive.battery, tow.velocity.length(), tow.battery])
	stock.reset_expedition(_spec(SALVAGE))
	drive.reset_expedition(_spec(SALVAGE, ["drive"]))
	var slow_stock := stock.step(DT, {"throttle": 1.0, "slow": true})
	var slow_drive := drive.step(DT, {"throttle": 1.0, "slow": true})
	_expect(slow_stock.velocity == slow_drive.velocity and slow_drive.battery < slow_stock.battery,
		"drive does not circumvent the old governed slow mode")
	stock.reset_expedition(_spec(SALVAGE))
	var stock_lock := 0
	var sonar_lock := 0
	for tick in range(1, 3601):
		var input := Pilot.controls_for(stock, "outbound", Pilot.ROUTES.safe.outbound.size())
		stock.step(DT, input)
		sonar.step(DT, input)
		if stock.scanned and stock_lock == 0:
			stock_lock = tick
		if sonar.scanned and sonar_lock == 0:
			sonar_lock = tick
		if stock_lock > 0 and sonar_lock > 0:
			break
	_expect(sonar_lock > 0 and stock_lock > sonar_lock and sonar.battery < stock.battery
		and sonar.position == stock.position and sonar.cargo_position == stock.cargo_position,
		"only sonar lock time and battery change under the exact same piloting and scan controls")
	print("BUILD sonar lock stock=%d sonar=%d, reserve %.3f%% vs %.3f%%" % [stock_lock, sonar_lock, stock.battery, sonar.battery])
	_test_tow_cable()


func _test_tow_cable() -> void:
	var stock := _deployed(_spec(SALVAGE))
	var tow := _deployed(_spec(SALVAGE, ["tow"]))
	if stock == null or tow == null:
		return
	if not _expect(_shared_attachment(stock, tow), "same attach edge produces two real tows"):
		return
	var peak_stock := 0.0
	var peak_tow := 0.0
	for tick in range(360):
		var input := _shared_return_input(stock)
		var a := stock.step(DT, input)
		var b := tow.step(DT, input)
		peak_stock = maxf(peak_stock, a.tension)
		peak_tow = maxf(peak_tow, b.tension)
	_expect(tow.snapshot().expedition.profile.rating > stock.snapshot().expedition.profile.rating
		and peak_tow > 0.02 and peak_stock > peak_tow, "reinforced cable bears lower rated-load fraction under common real towing inputs")
	print("BUILD same first return/reel: stock tension %.3f, tow tension %.3f" % [peak_stock, peak_tow])


func _shared_return_input(lead: Sim) -> Dictionary:
	return Pilot.controls_for(lead, "return", Pilot.ROUTES.safe.return.size())


func _shared_attachment(a: Sim, b: Sim) -> bool:
	# Continue broadcasting sonar until both moving boats have locked; the
	# slower ship can reach the scan band a little after the lead ship.
	for tick in range(3600):
		var va := a.snapshot()
		var vb := b.snapshot()
		var stage := "cargo" if va.scanned and vb.scanned else "outbound"
		var input := Pilot.controls_for(a, stage, Pilot.ROUTES.safe.outbound.size())
		input.tow_pressed = stage == "cargo" and _attachable(va) and _attachable(vb)
		a.step(DT, input)
		b.step(DT, input)
		if a.tow_attached or b.tow_attached:
			return a.tow_attached and b.tow_attached
	return false


func _attachable(view: Dictionary) -> bool:
	return view.position.distance_to(view.cargo_position) < Sim.ATTACH_RADIUS \
		and view.velocity.length() < Sim.ATTACH_SPEED \
		and (view.velocity - view.cargo_velocity).length() < Sim.ATTACH_RELATIVE_SPEED


func _test_stock_parity() -> void:
	var stock := _deployed(_spec(SALVAGE))
	if stock == null:
		return
	var plain := Sim.new()
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var same := true
	var view := stock.snapshot()
	var ticks := 0
	while ticks < 60 * 145:
		var projected := view.duplicate()
		for key: String in ["expedition", "expedition_token", "offer_id"]:
			projected.erase(key)
		if projected != plain.snapshot():
			same = false
			break
		if view.phase in ["success", "failed"]:
			break
		var input := _controls(plain, projected, cursor)
		view = stock.step(DT, input)
		plain.step(DT, input)
		ticks += 1
	_expect(same and view.phase == "success", "stock/full/no sea override differences match quickplay until real delivery")
	print("STOCK matching physical projection ticks=%d phase=%s" % [ticks, view.phase])


func _test_campaign(build: Array, offers: Array, cross_route: String = "safe") -> void:
	var expedition := State.new_campaign()
	for id: String in build:
		for action: String in ["buy", "equip"]:
			var applied := State.act(expedition, action, {"module_id": id})
			if not _expect(applied.ok, "new campaign legitimately acquires %s: %s" % [id, applied.message]):
				return
			expedition = applied.state
	var worn_start := false
	for id: String in offers:
		# A light reserve is acceptable in Black Tide; longer outer waters require a charge.
		var reserve := 61.0 if expedition.sector == 1 else 84.0
		while expedition.battery < reserve:
			var recharge := State.act(expedition, "recharge")
			if not _expect(recharge.ok, "affordable charge before offshore deployment: " + recharge.message):
				return
			expedition = recharge.state
		if expedition.hull < 60.0:
			var repair := State.act(expedition, "repair")
			if not _expect(repair.ok, "affordable hull repair before redeployment: " + repair.message):
				return
			expedition = repair.state
		var launch := State.act(expedition, "launch", {"offer_id": id})
		if not _expect(launch.ok, "campaign pays and prepares " + id + ": " + launch.message):
			return
		var spec := State.launch_spec(launch.state)
		var sim := _deployed(spec)
		if sim == null:
			return
		worn_start = worn_start or spec.hull < 100.0 or spec.battery < 100.0
		var outcome := _sail(sim, null, cross_route)
		var view: Dictionary = outcome.view
		print("EXPEDITION %s %s pressure=%d %.2fs/%.0fs phase=%s scan=%d attach=%d hold=%d hull=%.1f→%.1f battery=%.1f→%.1f cargo=%.1f peak=%.3f reason=%s" % [
			"+".join(build), id, spec.pressure, view.time, view.deadline, view.phase, outcome.scan, outcome.attach, outcome.hold,
			spec.hull, view.hull, spec.battery, view.battery, view.cargo_integrity, view.peak_tension, view.fail_reason])
		if not _expect(view.phase == "success" and outcome.scan > 0 and outcome.attach > outcome.scan
				and outcome.hold >= 60 and view.time < view.deadline, "natural scan, tow and stable delivery: " + id):
			return
		var settled := State.act(launch.state, "settle", {"token": spec.token, "snapshot": view})
		if not _expect(settled.ok and settled.state.hull == view.hull and settled.state.battery == view.battery,
				"actual terminal and resources settle into campaign: " + settled.message):
			return
		expedition = settled.state
	_expect(expedition.path == offers and (offers.size() != 6 or (expedition.status == "completed" and worn_start)),
		"campaign advances only delivered offers and flagship ends a sustained six-leg expedition")


func _test_locked_baseline() -> void:
	if not _expect(FileAccess.file_exists(LOCKED_SIM) and FileAccess.get_sha256(LOCKED_SIM) == LOCKED_SHA256,
			"external baseline is the byte-verified Stage25 storm_sim.gd"):
		return
	var oracle := load(LOCKED_SIM) as Script
	if not _expect(oracle != null and oracle.can_instantiate(), "verified Stage25 simulator can be loaded"):
		return
	for id: String in Sim.CONTRACTS:
		var sim := Sim.new()
		var old: RefCounted = oracle.new()
		sim.reset(id)
		old.reset(id)
		_expect(sim.contract == old.contract and sim.snapshot() == old.snapshot(), "exact Stage25 reset and contract: " + id)
		var outcome := _sail(sim, old)
		_expect(outcome.difference == -1 and outcome.view.phase == "success",
			"unmodified Stage25 oracle matches each natural delivery tick: %s divergence=%d" % [id, outcome.difference])
		print("LOCKED %s exact through %d ticks incl. terminal=%s" % [id, outcome.ticks, outcome.view.phase])


func _sail(sim: Sim, oracle: RefCounted = null, cross_route: String = "safe") -> Dictionary:
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	var view := sim.snapshot()
	var scan := 0
	var attach := 0
	var hold := 0
	var ticks := 0
	var difference := -1
	for tick in range(1, ceili(float(view.deadline) * 60.0) + 2):
		var input := _controls(sim, view, cursor, cross_route)
		view = sim.step(DT, input)
		ticks = tick
		if oracle != null and view != oracle.step(DT, input):
			difference = tick
			break
		if scan == 0 and view.scanned:
			scan = tick
		if attach == 0 and view.tow_attached:
			attach = tick
		hold = (hold + 1) if view.dock > 0.0 else 0
		if view.phase in ["success", "failed"]:
			break
	return {"view": view, "scan": scan, "attach": attach, "hold": hold, "ticks": ticks, "difference": difference}


func _controls(sim: Sim, view: Dictionary, cursor: Dictionary, cross_route: String = "safe") -> Dictionary:
	var stage := "return" if view.tow_attached else ("cargo" if view.scanned else "outbound")
	if stage != cursor.stage:
		cursor.stage = stage
		cursor.index = 0
	var route: Array = Pilot.ROUTES.safe.get(stage, [])
	var input: Dictionary
	if view.contract_id == "cross-current":
		cursor.index = Pilot.route_index_for(view, stage, cursor.index, cross_route)
		input = Pilot.controls_for(sim, stage, cursor.index, cursor.tow, cross_route)
	else:
		# Black Tide is a direct bearing; Needle uses the pre-existing reef detour goals.
		input = Pilot.controls_for(sim, stage, route.size(), cursor.tow)
		if view.contract_id == "needle-bank" and stage in ["outbound", "return"]:
			var goals := Needle.NEEDLE_OUTBOUND if stage == "outbound" else Needle.NEEDLE_RETURN
			while cursor.index < goals.size() and view.position.distance_to(goals[cursor.index]) < Pilot.WAYPOINT_RADIUS:
				cursor.index += 1
			if cursor.index < goals.size():
				var helm := Pilot._pilot(view, goals[cursor.index], 8.0 if stage == "outbound" else 5.0,
					1 if stage == "outbound" else 2)
				input.merge(helm, true)
	cursor.tow = input.get("tow_pressed", false)
	return input


func _spec(id: String, loadout: Array = [], pressure: int = 0, path: Array = [], hull: float = 100.0, battery: float = 100.0) -> Dictionary:
	return {"token": "sim-fixture:1", "offer_id": id, "contract": Catalog.build_contract(id, pressure, path),
		"loadout": loadout.duplicate(), "pressure": pressure, "path": path.duplicate(), "hull": hull, "battery": battery}


func _deployed(spec: Dictionary) -> Sim:
	var sim := Sim.new()
	return sim if _expect(sim.reset_expedition(spec), "expedition starts legally: " + String(spec.offer_id)) else null


func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures += 1
		printerr("FAIL: " + message)
	return condition
