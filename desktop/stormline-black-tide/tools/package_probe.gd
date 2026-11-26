extends SceneTree
## Tool-only probe: mounts an exported pack, loads resources, never starts the game scene.

const SCRIPT_PATHS := ["main", "radar", "storm_audio", "storm_hud", "storm_records", "storm_sim", "storm_world", "voyage_review", "expedition_catalog", "expedition_state", "expedition_store", "expedition_hud", "damage_control", "public_navigation", "voyage_segments"]
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
		"main_scene_instantiated": false, "contract_ids_valid": false, "passed": false,
	}
	if result.pack_mounted:
		for stem: String in SCRIPT_PATHS:
			var path := "res://src/%s.gd" % stem
			var script := ResourceLoader.load(path) as Script
			if script != null and script.can_instantiate():
				result.loaded_scripts.append(path)
				if stem == "storm_sim":
					# Inspect the shipped constants without constructing or stepping a simulator.
					var contracts: Dictionary = script.get_script_constant_map().get("CONTRACTS", {})
					result.contract_ids_valid = contracts.size() == CONTRACT_IDS.size() \
						and CONTRACT_IDS.all(func(id: String) -> bool: return contracts.has(id))
		var scene := ResourceLoader.load("res://scenes/main.tscn") as PackedScene
		result.main_scene_loaded = scene != null and scene.get_state().get_node_count() > 0
	result.passed = result.pack_mounted and result.loaded_scripts.size() == SCRIPT_PATHS.size() \
		and result.main_scene_loaded and result.contract_ids_valid
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
