extends RefCounted
## Expedition-only structural damage and at-sea damage control. No scene or I/O.
## Temporary seals NEVER repair the persistent breach or restore hull points.

const MAX_BREACH := 3.0
const MAX_KITS := 2
const REPAIR_BREACH := 1.0
const INTERRUPTED_BREACH := 0.35
const PATCH_AMOUNT := 1.0
const PATCH_SECONDS := 5.0
const PATCH_SPEED := 2.2
const PATCH_THROTTLE := 0.05
const PATCH_TENSION := 0.68
const PUMP_RATE := 2.4
const PUMP_DRAW := 0.45
const PERSISTENT_KEYS := ["breach", "kits"]
const LIVE_KEYS := ["breach", "kits", "water", "sealed", "patch_progress", "pump_on", "pump_active", "inflow", "pump_draw", "patches_used"]

var breach := 0.0
var kits := 0
var water := 0.0
var sealed := 0.0
var patch_progress := 0.0
var pump_on := false
var pump_active := false
var inflow := 0.0
var pump_draw := 0.0
var patches_used := 0
var _patch_latched := false
var _hit := false


func _init(initial: Dictionary, initial_storm: float = 0.5) -> void:
	breach = float(initial.breach)
	kits = int(initial.kits)
	inflow = breach * (0.52 + 0.40 * initial_storm)


func add_breach(amount: float) -> void:
	breach = minf(MAX_BREACH, breach + maxf(0.0, amount))
	patch_progress = 0.0
	_hit = true


func step(dt: float, controls: Dictionary, speed: float, throttle: float, tension: float, storm: float) -> bool:
	if bool(controls.get("pump_pressed", false)):
		pump_on = not pump_on
	var patch := bool(controls.get("patch", false))
	if not patch:
		_patch_latched = false
	var completed := false
	if patch and not _patch_latched and not _hit and kits > 0 and breach > sealed \
			and speed < PATCH_SPEED and absf(throttle) <= PATCH_THROTTLE and tension < PATCH_TENSION:
		patch_progress += dt / PATCH_SECONDS
		if patch_progress >= 1.0 - 1e-9:
			sealed = minf(breach, sealed + PATCH_AMOUNT)
			kits -= 1
			patches_used += 1
			patch_progress = 0.0
			_patch_latched = true
			completed = true
	else:
		patch_progress = 0.0
	_hit = false
	inflow = maxf(0.0, breach - sealed) * (0.52 + 0.40 * storm)
	pump_active = pump_on and (water > 0.0 or inflow > 0.0)
	pump_draw = PUMP_DRAW if pump_active else 0.0
	water = clampf(water + (inflow - (PUMP_RATE if pump_active else 0.0)) * dt, 0.0, 100.0)
	return completed


func snapshot() -> Dictionary:
	return {"breach": breach, "kits": kits, "water": water, "sealed": sealed,
		"patch_progress": patch_progress, "pump_on": pump_on, "pump_active": pump_active,
		"inflow": inflow, "pump_draw": pump_draw, "patches_used": patches_used}


static func fresh() -> Dictionary:
	return {"breach": 0.0, "kits": 0}


static func valid_persistent(value: Variant) -> bool:
	return value is Dictionary and _keys(value, PERSISTENT_KEYS) \
		and _number(value.get("breach"), 0.0, MAX_BREACH) and _integer(value.get("kits"), 0, MAX_KITS)


static func valid_live(value: Variant, initial: Dictionary) -> bool:
	if not valid_persistent(initial) or not value is Dictionary or not _keys(value, LIVE_KEYS):
		return false
	if not _number(value.breach, float(initial.breach), MAX_BREACH) or not _integer(value.kits, 0, int(initial.kits)) \
			or not _integer(value.patches_used, 0, int(initial.kits)) or value.patches_used + value.kits != initial.kits:
		return false
	if not _number(value.water, 0, 100) or not _number(value.sealed, 0, minf(float(value.breach), float(value.patches_used) * PATCH_AMOUNT)) \
			or not _number(value.patch_progress, 0, 1) or float(value.patch_progress) >= 1.0:
		return false
	if not value.pump_on is bool or not value.pump_active is bool or not _number(value.inflow, 0, MAX_BREACH) \
			or not _number(value.pump_draw, 0, PUMP_DRAW):
		return false
	if value.pump_active and not value.pump_on:
		return false
	if not value.pump_active and value.pump_on and (float(value.water) > 0 or float(value.inflow) > 0):
		return false
	var open := float(value.breach) - float(value.sealed)
	return _number(value.inflow, open * (0.52 + 0.40 * 0.16) - 1e-9, open * (0.52 + 0.40 * 0.97) + 1e-9) \
		and value.pump_draw == (PUMP_DRAW if value.pump_active else 0.0)


static func persistent(live: Dictionary) -> Dictionary:
	return {"breach": float(live.breach), "kits": int(live.kits)}


static func _keys(value: Dictionary, expected: Array) -> bool:
	return value.size() == expected.size() and value.has_all(expected)


static func _number(value: Variant, low: float, high: float) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) >= low and float(value) <= high


static func _integer(value: Variant, low: int, high: int) -> bool:
	return _number(value, low, high) and float(value) == floor(float(value))
