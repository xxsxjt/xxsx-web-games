extends SceneTree
## Deliberate pure-rule and model fixtures, NOT navigation or human play evidence.
const Damage = preload("res://src/damage_control.gd")
const State = preload("res://src/expedition_state.gd")
const Sim = preload("res://src/storm_sim.gd")
const Fixture = preload("res://tests/expedition_state_test.gd")
const Pilot = preload("res://tests/breakwater_journey_test.gd")
const DT := 1.0 / 60.0
var checks := 0
var failures := 0


func _init() -> void:
	_validation()
	_controls()
	_rules()
	_model()
	if "--compare-stage27" in OS.get_cmdline_user_args():
		_legacy_oracle()
	print("Stormline damage-control RULE/MODEL FIXTURES: %d checks, %d failures; not natural driving." % [checks, failures])
	quit(0 if failures == 0 else 1)


func _validation() -> void:
	_expect(Damage.valid_persistent(Damage.fresh()), "empty intact damage extension")
	for key: String in ["breach", "kits"]:
		var missing := Damage.fresh()
		missing.erase(key)
		_expect(not Damage.valid_persistent(missing), "missing " + key)
		for bad: Variant in [NAN, INF, -1, true, "0", [], {}]:
			var data := Damage.fresh()
			data[key] = bad
			_expect(not Damage.valid_persistent(data), "strict number: " + key)
	for bad: Variant in [0.1, 3, 100]:
		_expect(not Damage.valid_persistent({"breach": 0.0, "kits": bad}), "integral bounded kits")
	_expect(not Damage.valid_persistent({"breach": 3.01, "kits": 0}), "breach capped")
	var new := State.new_campaign(true)
	for location: String in ["damage_control", "active"]:
		var data := new.duplicate(true)
		data[location]["unknown"] = 0
		_expect(not State.validate(data), "reject unknown nested " + location)
	var legacy := State.new_campaign()
	_expect(State.validate(legacy) and not legacy.has("damage_control"), "legacy remains exact old shape")
	var enabled := State.act(legacy, "enable_damage")
	_expect(enabled.ok and not legacy.has("damage_control") and enabled.state.damage_control == Damage.fresh(), "explicit immutable enable")
	_expect(not State.act(enabled.state, "enable_damage").ok, "no duplicate enable")


func _controls() -> void:
	var initial := {"breach": 2.0, "kits": 2}
	var d := Damage.new(initial)
	for tick in range(60):
		d.step(DT, {}, 0.0, 0.0, 0.0, 0.5)
	_expect(is_equal_approx(d.water, 1.44), "uncontrolled breach produces measured inflow")
	_expect(not d.pump_active and d.pump_draw == 0, "pump is not free/default active")
	d.step(DT, {"pump_pressed": true}, 0, 0, 0, 0.5)
	var wet: float = d.water
	for tick in range(30):
		d.step(DT, {}, 0, 0, 0, 0.5)
	_expect(d.water < wet and d.pump_on and d.pump_draw == Damage.PUMP_DRAW, "edge latched pumping costs energy")
	for tick in range(299):
		d.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	_expect(d.kits == 2 and d.patch_progress < 1, "cannot finish early")
	d.step(DT, {}, 0, 0, 0, 0.5)
	_expect(d.patch_progress == 0 and d.kits == 2, "release resets current work without consumption")
	for gate in ["speed", "throttle", "tension"]:
		for tick in range(30):
			d.step(DT, {"patch": true}, 0, 0, 0, 0.5)
		d.step(DT, {"patch": true}, Damage.PATCH_SPEED if gate == "speed" else 0.0,
			0.051 if gate == "throttle" else 0.0, 0.68 if gate == "tension" else 0.0, 0.5)
		_expect(d.patch_progress == 0 and d.kits == 2, "interrupted by strict " + gate)
	for tick in range(300):
		d.step(DT, {"patch": true}, 2.199, 0.05, 0.679, 0.5)
	_expect(d.kits == 1 and d.patches_used == 1 and d.sealed == 1 and d.breach == 2, "complete patch consumes once; no structural healing")
	for tick in range(600):
		d.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	_expect(d.kits == 1 and d.sealed == 1, "held H cannot spend another kit until released")
	d.step(DT, {}, 0, 0, 0, 0.5)
	for tick in range(300):
		d.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	_expect(d.kits == 0 and d.sealed == 2 and d.breach == 2 and d.inflow == 0, "second fresh hold seals leak, keeps persistent breach")
	_expect(Damage.valid_live(d.snapshot(), initial), "completed control state validates")
	for key: String in Damage.LIVE_KEYS:
		var missing := d.snapshot()
		missing.erase(key)
		_expect(not Damage.valid_live(missing, initial), "missing live field: " + key)
	for key: String in ["water", "breach", "sealed", "patch_progress", "inflow", "pump_draw", "kits", "patches_used"]:
		for bad: Variant in [NAN, INF, -1, "0", true]:
			var forged := d.snapshot()
			forged[key] = bad
			_expect(not Damage.valid_live(forged, initial), "malformed live number: " + key)
	var forged := d.snapshot()
	forged.kits = 2
	_expect(not Damage.valid_live(forged, initial), "cannot refund consumed kit")
	forged = d.snapshot()
	forged.breach = 1.99
	_expect(not Damage.valid_live(forged, initial), "cannot repair structure at sea")
	var dry := Damage.new(Damage.fresh())
	dry.step(DT, {"pump_pressed": true}, 0, 0, 0, 0.5)
	_expect(dry.pump_on and not dry.pump_active and dry.pump_draw == 0, "dry intact pump is visibly standby without phantom charge")
	dry.add_breach(500)
	dry.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	_expect(dry.breach == 3 and dry.patch_progress == 0, "collision capped and resets patch")
	var on_edge := Damage.new(initial)
	for tick in 299:
		on_edge.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	on_edge.add_breach(0.01)
	on_edge.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	_expect(on_edge.kits == 2 and on_edge.patch_progress == 0 and on_edge.sealed == 0, "contact on final work tick interrupts before consuming a kit")


func _rules() -> void:
	var s := State.new_campaign(true)
	var before := s.duplicate(true)
	s = _act(s, "prepare_kit")
	_expect(s.parts == before.parts - 1 and s.damage_control.kits == 1 and s.pressure == before.pressure, "preparation transfers one real material")
	s = _act(s, "prepare_kit")
	_expect(not State.act(s, "prepare_kit").ok, "two kit ceiling")
	s = _act(s, "unload_kit")
	s = _act(s, "unload_kit")
	_expect(s.parts == before.parts and s.damage_control.kits == 0 and not State.act(s, "unload_kit").ok, "roundtrip conserves materials")
	s = _act(s, "prepare_kit")
	s.damage_control.breach = 1.5 # Explicit pure-rule fixture, not a voyage.
	var launched := _act(s, "launch", {"offer_id": "black-tide-survey-safe"})
	_expect(launched.damage_control == launched.active.damage_control and State.launch_spec(launched).damage_control == s.damage_control, "bound departure extension")
	for action: String in ["enable_damage", "prepare_kit", "unload_kit", "repair"]:
		_expect(not State.act(launched, action).ok, "no mid-flight service " + action)
	var snap := Fixture.terminal_fixture(launched, "success", 80, 60)
	var d := Damage.new(launched.active.damage_control)
	var abort := Fixture.terminal_fixture(launched, "success", launched.hull, launched.battery)
	abort.phase = "approach"
	abort.dock = 0.0
	abort["damage_control"] = d.snapshot()
	_expect(State.act(launched, "abandon", {"token": launched.active.token, "snapshot": abort}).ok, "immediate damaged departure is valid for explicit abandonment")
	for tick in 300:
		d.step(DT, {"patch": true}, 0, 0, 0, 0.5)
	snap["damage_control"] = d.snapshot()
	var settled := _act(launched, "settle", {"token": launched.active.token, "snapshot": snap})
	_expect(settled.damage_control.breach == 1.5 and settled.damage_control.kits == 0 and settled.hull == 80, "temporary seal not persisted as structural repair")
	_expect(not State.act(settled, "settle", {"token": launched.active.token, "snapshot": snap}).ok, "one-time settlement")
	var repaired := _act(settled, "repair")
	_expect(repaired.damage_control.breach == 0.5 and repaired.hull == 100 and repaired.parts == settled.parts - 1
		and repaired.credits == settled.credits - State.REPAIR_COST and repaired.pressure == settled.pressure + 1, "coupled paid structural repair")
	var finished := _act(repaired, "repair")
	_expect(finished.hull == 100 and finished.damage_control.breach == 0 and not State.act(finished, "repair").ok, "full hull still allows needed structural repair; no paid no-op")
	var missing := snap.duplicate(true)
	missing.erase("damage_control")
	_expect(not State.act(launched, "settle", {"token": launched.active.token, "snapshot": missing}).ok, "damage result cannot be omitted")
	var impossible := snap.duplicate(true)
	impossible.damage_control.water = 100.0
	_expect(not State.act(launched, "settle", {"token": launched.active.token, "snapshot": impossible}).ok, "cannot deliver flooded ship")
	impossible.phase = "failed"
	impossible.dock = 0.0
	impossible.fail_reason = "舱底进水达到 100%"
	_expect(State.act(launched, "settle", {"token": launched.active.token, "snapshot": impossible}).ok, "new physical flood threshold can settle failure")
	var interrupted := _act(launched, "recover_interrupted")
	_expect(interrupted.damage_control.kits == 0 and is_equal_approx(interrupted.damage_control.breach, 1.85)
		and interrupted.parts == launched.parts and interrupted.path.is_empty(), "interruption loses registered kits, adds bounded breach, no reward")
	var stale := launched.duplicate(true)
	stale.active.damage_control.kits = 0
	_expect(not State.validate(stale), "unbound departure extension rejected")


func _model() -> void:
	var old := State.new_campaign()
	old = _act(old, "launch", {"offer_id": "black-tide-survey-safe"})
	var spec := State.launch_spec(old)
	var plain := Sim.new()
	var extended := Sim.new()
	_expect(plain.reset_expedition(spec), "old exact launch spec accepted")
	var next := spec.duplicate(true)
	next["damage_control"] = Damage.fresh()
	_expect(extended.reset_expedition(next), "new intact spec accepted")
	var same := true
	var cursor := {"stage": "outbound", "index": 0, "tow": false}
	for tick in 8000:
		var view := plain.snapshot()
		var stage := "return" if view.tow_attached else ("cargo" if view.scanned else "outbound")
		var controls := Pilot.controls_for(plain, stage, Pilot.ROUTES.safe.get(stage, []).size(), cursor.tow)
		cursor.tow = controls.get("tow_pressed", false)
		var a := plain.step(DT, controls)
		var b := extended.step(DT, controls)
		b.erase("damage_control")
		same = same and a == b
		if a.phase in ["success", "failed"]:
			break
	_expect(same and plain.phase == "success", "intact dry extension matches full old-physics delivery tickwise")
	var before := extended.snapshot()
	var public := extended.snapshot()
	public.damage_control.breach = 0.0
	public.damage_control.kits = 2
	_expect(extended.snapshot() == before, "public damage projection cannot mutate physical model")
	for bad: Variant in [{}, {"breach": -1, "kits": 0}, {"breach": 0, "kits": 3}, {"breach": NAN, "kits": 1}]:
		var invalid := next.duplicate(true)
		invalid.damage_control = bad
		_expect(not extended.reset_expedition(invalid) and extended.snapshot() == before, "malformed extension reset atomic")
	var leak := next.duplicate(true)
	leak.damage_control = {"breach": 3.0, "kits": 0}
	var unpumped := Sim.new()
	var pumped := Sim.new()
	_expect(unpumped.reset_expedition(leak) and pumped.reset_expedition(leak), "structurally damaged models deploy")
	for tick in 12000:
		unpumped.step(DT, {"power": 1})
		pumped.step(DT, {"power": 1, "pump_pressed": tick == 0})
		if unpumped.phase == "failed":
			break
	_expect(unpumped.event_kind == "flooded" and unpumped.battery > 0 and unpumped.hull > 0 and pumped.phase == "approach"
		and pumped.snapshot().damage_control.water < 3.0 and pumped.battery < unpumped.battery, "real flooding failure vs paid pumping with same original deadline")
	var flood_snap := unpumped.snapshot()
	_expect(Damage.valid_live(flood_snap.damage_control, leak.damage_control), "natural model flooded snapshot passes extension validation")
	unpumped.reset_expedition(leak)
	pumped.reset_expedition(leak)
	for tick in 600:
		var controls := {"power": 1, "throttle": 0.65, "steer": 0.2}
		unpumped.step(DT, controls)
		controls["pump_pressed"] = tick == 0
		pumped.step(DT, controls)
	_expect(unpumped.velocity.length() < pumped.velocity.length() and absf(unpumped.heading) < absf(pumped.heading)
		and unpumped.snapshot().damage_control.water > pumped.snapshot().damage_control.water, "accumulated flood impairs actual thrust and steering on matched controls")
	extended.reset("black-tide")
	_expect(not extended.snapshot().has("damage_control"), "quick reset removes all damage-control state")


func _act(s: Dictionary, action: String, payload: Dictionary = {}) -> Dictionary:
	var copy := s.duplicate(true)
	var result := State.act(s, action, payload)
	_expect(result.ok and s == copy, "immutable rule " + action + ": " + String(result.message))
	return result.state


func _legacy_oracle() -> void:
	# Optional external fixture, never bundled or needed for ordinary checkouts.
	var path := "res://.testdata/stage27-oracle/storm_sim.gd"
	if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != "44bee60f8957b8c8a16f19241f84b008e59fa5e1c2cde4e322d76637c94a5b10":
		_expect(false, "external Stage27 oracle hash verified before execution")
		return
	var script := load(path) as Script
	for id: String in Sim.CONTRACTS:
		var now := Sim.new()
		var old: RefCounted = script.new()
		now.reset(id)
		old.reset(id)
		var identical: bool = now.snapshot() == old.snapshot()
		for tick in 4200:
			var controls := {"power": (tick / 180) % 3, "throttle": 0.7, "steer": 0.5 if tick % 360 < 180 else -0.3, "scan": tick % 91 < 45}
			identical = identical and now.step(DT, controls) == old.step(DT, controls)
		_expect(identical, "Stage27 original quickplay every tick: " + id)
	for modules: Array in [[], ["drive", "sonar"], ["tow", "sonar"]]:
		var s := State.new_campaign()
		for id: String in modules:
			s = _act(s, "buy", {"module_id": id})
			s = _act(s, "equip", {"module_id": id})
		s = _act(s, "launch", {"offer_id": "black-tide-chart-safe"})
		var now := Sim.new()
		var old: RefCounted = script.new()
		var spec := State.launch_spec(s)
		_expect(now.reset_expedition(spec) and old.reset_expedition(spec), "legacy exact spec accepted by both versions")
		var identical: bool = now.snapshot() == old.snapshot()
		var cursor := {"stage": "outbound", "index": 0, "tow": false}
		var navigator := load("res://tests/tide_survey_driver.gd") as Script
		for tick in 12000:
			var controls: Dictionary = navigator.controls(now, now.snapshot(), cursor)
			identical = identical and now.step(DT, controls) == old.step(DT, controls)
			if now.phase in ["failed", "success"]:
				break
		_expect(identical and now.phase == "success", "Stage27 legacy expedition full natural chart delivery: " + "+".join(modules))


func _expect(ok: bool, text: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + text)
