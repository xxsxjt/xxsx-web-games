extends SceneTree
const Reference = preload("res://src/voyage_reference.gd")
const Segments = preload("res://src/voyage_segments.gd")
var checks := 0
var failures := 0


func _init() -> void:
	var ref := Reference.new()
	_check(not ref.capture(_point(2.0, Vector2.ZERO, 78.0, 48.0, 22.0, "success"), [], 4), "terminal-only cannot fabricate measured voyage")
	_check(ref.begin(_point(0.0, Vector2(-3, -4), 80.0, 50.0, 20.0), "real name"), "begin initialized identity")
	ref.observe(_point(1.0, Vector2.ZERO, 79.0, 49.0, 21.0))
	ref.observe(_point(1.0, Vector2(999, 999), 1.0, 1.0, 99.0))
	ref.observe(_point(2.0, Vector2(-3, -4), 78.0, 48.0, 22.0, "success"))
	var manual := Segments.new()
	for index in range(8):
		manual.start(_point(index * 0.1, Vector2.ZERO, 80.0, 50.0, 20.0))
		manual.finish(_point(index * 0.1 + 0.05, Vector2.ONE, 79.0, 49.0, 21.0))
	var records: Array = manual.view().records
	records.back()["hidden_target"] = Vector2(900, 800)
	records.back().start["trace"] = [1, 2, 3]
	_check(ref.capture(_point(2.0, Vector2(-3, -4), 78.0, 48.0, 22.0, "success"), records, 4), "capture exact terminal once")
	records.back().distance_m = 900.0
	_check(ref.view().reference.is_empty(), "unpersisted candidate not visible")
	_check(not ref.promote(_saved(5, "wrong"), 4) and not ref.promote(_saved(6), 4) and not ref.promote(_saved(5), 3), "wrong identity/revision/CAS cannot promote")
	_check(ref.promote(_saved(5), 4) and not ref.promote(_saved(5), 4), "one exact settlement promotes once")
	var view := ref.view()
	_check(view.choice == "whole" and view.selected.distance_m == 10.0 and view.selected.elapsed_s == 2.0, "independent 3-4-5 return oracle gives10m not zero displacement; duplicate ignored")
	_check(view.selected.hull_delta_pp == -2.0 and view.selected.battery_delta_pp == -2.0 and view.selected.energy_spent_points == 2.0, "signed pp distinct from positive spent points")
	_check(view.reference.segments.size() == 6 and view.reference.segments.front().number == 3 and view.reference.segments.back().number == 8 and view.reference.segments.back().distance_m < 2.0, "six FIFO copied, no borrowed mutation")
	_check(view.reference.keys().size() == 7 and view.selected.keys().size() == 8 and view.selected.start.keys().size() == 6 and not str(view).contains("hidden_target") and not str(view).contains("trace") and not view.selected.start.has("position"), "fixed whitelist no private targets positions or traces")
	view.reference.segments.clear()
	view.selected.start.time = 999
	_check(ref.view().reference.segments.size() == 6 and ref.view().selected.start.time == 0.0, "nested exported view immutable")
	for invalid: String in ["segment:0", "segment:2", "segment:09", "segment:999999999999999999", "-1", "whole "]:
		_check(not ref.act("select", invalid) and ref.view().choice == "whole", "invalid selection harmless: " + invalid)
	_check(ref.act("select", "segment:8") and ref.view().selected.number == 8, "select exact retained number")
	_check(ref.act("hide") and not ref.view().visible and ref.act("show") and ref.view().choice == "segment:8", "hide/show preserve same reference choice")
	var prior := ref.view()
	ref.begin(_point(0.0, Vector2.ZERO, 100.0, 100.0, 0.0, "approach", "next"), "next")
	ref.observe(_point(1.0, Vector2.ONE, 100.0, 99.0, 1.0, "failed", "next"))
	ref.capture(_point(1.0, Vector2.ONE, 100.0, 99.0, 1.0, "failed", "next"), [], 5)
	_check(ref.view() == prior, "newer pending keeps older selection and immutable reference")
	ref.stop()
	_check(ref.view() == prior, "abandon stop preserves old settled reference")
	_energy_cases()
	for field: String in ["expedition_token", "contract_id", "offer_id"]:
		var bad := _point(1.0, Vector2.ONE, 80.0, 50.0, 0.0, "success")
		bad[field] = "other"
		var different := Reference.new()
		different.begin(_point(0.0, Vector2.ZERO, 80.0, 50.0, 0.0), "name")
		different.observe(bad)
		_check(not different.capture(bad, [], 0), "exact deployment identity rejects " + field)
	_check(ref.act("clear") and ref.view().reference.is_empty(), "explicit clear only saved reference")
	ref.clear()
	_check(ref.view().reference.is_empty() and not ref.act("show"), "reset leaves no data not measured zero")
	print("Stormline voyage reference: %d checks, %d failures; analytic fixtures, not natural voyages." % [checks, failures])
	quit(0 if failures == 0 else 1)


func _energy_cases() -> void:
	for values: Array in [[0.0, 0.0, 0.0], [20.0, 21.0, 22.0], [null, 1.0, 2.0], [20.0, null, 22.0], [20.0, 21.0, null], [20.0, 0.0, 21.0], [20.0, NAN, 22.0], [20.0, -1.0, 22.0]]:
		var ref := Reference.new()
		ref.begin(_point(0.0, Vector2.ZERO, 80.0, 50.0, values[0]), "energy")
		ref.observe(_point(1.0, Vector2.ONE, 80.0, 51.0, values[1]))
		ref.observe(_point(2.0, Vector2.ZERO, 80.0, 52.0, values[2], "success"))
		_check(ref.capture(_point(2.0, Vector2.ZERO, 80.0, 52.0, values[2], "success"), [], 4) and ref.promote(_saved(5), 4), "energy boundary still valid measured whole")
		var measured: Dictionary = ref.view().selected
		var expected: Variant = 0.0 if values[0] == 0.0 else (2.0 if values[1] == 21.0 and values[2] == 22.0 else null)
		_check(measured.energy_spent_points == expected and measured.battery_delta_pp == 2.0, "independent zero/missing/reappearing/rollback oracle not net-battery inference")
		_check(ref.view().reference.segments.is_empty(), "no manual records still valid whole")
		ref.act("hide")
		ref.act("select", "whole")
		ref.begin(_point(0.0, Vector2.ZERO, 80.0, 50.0, 0.0, "approach", "next"), "new")
		ref.observe(_point(1.0, Vector2.ONE, 79.0, 49.0, 1.0, "failed", "next"))
		ref.capture(_point(1.0, Vector2.ONE, 79.0, 49.0, 1.0, "failed", "next"), [], 5)
		_check(ref.promote(_saved(6, "next", "failed"), 5) and ref.view().visible and ref.view().choice == "whole" and ref.view().reference.token == "next", "new exact saved failure replaces once and defaults visible whole")


func _point(time: float, position: Vector2, hull: float, battery: float, energy: Variant, phase := "approach", token := "token") -> Dictionary:
	var result := {"time": time, "position": position, "hull": hull, "battery": battery, "wind": Vector2(-2, 3), "storm": 0.5,
		"phase": phase, "expedition_token": token, "contract_id": "black-tide", "offer_id": "black-tide-survey-safe", "hidden_target": Vector2(99, 99)}
	if energy != null:
		result["energy_budget"] = {"spent": {"total": energy}}
	return result


func _saved(revision: int, token := "token", outcome := "success") -> Dictionary:
	return {"revision": revision, "history": [{"event": "settle", "token": token, "offer_id": "black-tide-survey-safe", "outcome": outcome}]}


func _check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + message)
