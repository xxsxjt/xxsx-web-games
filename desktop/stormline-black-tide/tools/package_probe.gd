extends SceneTree
## Tool-only probe: mounts an exported pack, loads resources, never starts the game scene.

const SCRIPT_PATHS := ["main", "radar", "storm_audio", "storm_hud", "storm_records", "storm_sim", "storm_world"]
const CONTRACT_IDS := ["black-tide", "needle-bank", "cross-current"]


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if DisplayServer.get_name() != "headless" or args.size() != 2:
		printerr("FAIL: package probe requires headless mode, a PCK path and a result path")
		quit(1)
		return
	var result := {
		"pack_mounted": ProjectSettings.load_resource_pack(args[0]),
		"loaded_scripts": [], "main_scene_loaded": false,
		"main_scene_instantiated": false, "model_step_valid": false, "passed": false,
		"contract_steps": [], "all_contract_steps_valid": false,
	}
	if result.pack_mounted:
		for stem: String in SCRIPT_PATHS:
			var path := "res://src/%s.gd" % stem
			var script := ResourceLoader.load(path) as Script
			if script != null and script.can_instantiate():
				result.loaded_scripts.append(path)
		var scene := ResourceLoader.load("res://scenes/main.tscn") as PackedScene
		result.main_scene_loaded = scene != null and scene.get_state().get_node_count() > 0
		var simulation := ResourceLoader.load("res://src/storm_sim.gd") as Script
		if simulation != null and simulation.can_instantiate():
			var sim: RefCounted = simulation.new()
			var state: Dictionary = sim.call("step", 1.0 / 60.0, {"throttle": 0.5, "power": 0})
			result.model_step_valid = state.get("phase") == "approach" \
				and state.get("contract_id") == "black-tide" and float(state.get("time", 0.0)) > 0.0
			for contract_id: String in CONTRACT_IDS:
				sim.call("reset", contract_id)
				var contract_state: Dictionary = sim.call("step", 1.0 / 60.0, {"throttle": 0.5, "power": 0})
				var valid: bool = contract_state.get("phase") == "approach" \
					and contract_state.get("contract_id") == contract_id \
					and float(contract_state.get("time", 0.0)) > 0.0
				result.contract_steps.append({"contract_id": contract_id, "valid": valid})
			result.all_contract_steps_valid = result.contract_steps.size() == CONTRACT_IDS.size() \
				and result.contract_steps.all(func(item: Dictionary) -> bool: return item.valid == true)
	result.passed = result.pack_mounted and result.loaded_scripts.size() == SCRIPT_PATHS.size() \
		and result.main_scene_loaded and result.model_step_valid and result.all_contract_steps_valid
	var file := FileAccess.open(args[1], FileAccess.WRITE)
	if file == null:
		printerr("FAIL: cannot write pack probe result")
		quit(1)
		return
	file.store_string(JSON.stringify(result, "  ") + "\n")
	file.close()
	if not result.passed:
		printerr("FAIL: exported pack resource loading incomplete")
	print("Stormline pack resource probe: " + ("PASS" if result.passed else "FAIL") + "; no game EXE or main scene was launched.")
	quit(0 if result.passed else 1)
