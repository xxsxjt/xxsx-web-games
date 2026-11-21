extends SceneTree
## Byte-checked Stage26 oracles remain test-only in .testdata, excluded from export.
const Catalog = preload("res://src/expedition_catalog.gd")
const State = preload("res://src/expedition_state.gd")
const Store = preload("res://src/expedition_store.gd")
const ROOT := "res://.testdata/legacy-stage26/"
const HASHES := {
	"expedition_catalog.gd": "8ef9a5ecdadcb683285fbeaf48e7791e672a75ee0757399defdf3775f7667179",
	"expedition_state.gd": "3b9b4c40be7c13bc0ccb6f11e6e583843ecb3ef6081805a50de5d5042d3bfd3b",
	"expedition_store.gd": "df163741c96f424a8ec2c0c63980a6e8dd1b88f9341a4f3227cb45efe2fddb17",
}
var checks := 0
var failures := 0
var old_catalog: Script
var old_state: Script
var old_store: Script


func _init() -> void:
	if DisplayServer.get_name() != "headless":
		quit(1)
		return
	for name: String in HASHES:
		if not _check(FileAccess.file_exists(ROOT + name) and FileAccess.get_sha256(ROOT + name) == HASHES[name],
				"Stage26 oracle SHA-256 including explicitly remapped local preloads: " + name):
			quit(1)
			return
	old_catalog = load(ROOT + "expedition_catalog.gd")
	old_state = load(ROOT + "expedition_state.gd")
	old_store = load(ROOT + "expedition_store.gd")
	_check(Catalog.modules() == old_catalog.modules(), "all three original module prices and effect bodies unchanged")
	_walk_old_prefix([])
	_old_archive_io()
	print("Tide compatibility: %d checks, %d failures; Stage26 catalog/rule/save fixtures, not natural driving." % [checks, failures])
	quit(0 if failures == 0 else 1)


func _walk_old_prefix(path: Array) -> void:
	if path.size() == 6:
		return
	var sector := (path.size() >> 1) + 1
	var leg := path.size() % 2
	for pressure: int in [0, 7, 12, 99]:
		var before := path.duplicate(true)
		var prior: Array = old_catalog.offers(sector, leg, path, pressure)
		var now: Array = Catalog.offers(sector, leg, path, pressure)
		var legacy_only: Array = now.filter(func(offer: Dictionary) -> bool: return offer.branch != "chart")
		_check(prior == legacy_only and path == before, "all old offers remain exactly equal at prefix=%s pressure=%d" % [path, pressure])
		for offer: Dictionary in prior:
			_check(Catalog.build_contract(offer.id, pressure, path) == old_catalog.build_contract(offer.id, pressure, path),
				"unchanged launch envelope " + String(offer.id))
	for offer: Dictionary in old_catalog.offers(sector, leg, path, 0):
		var next := path.duplicate()
		next.append(offer.id)
		_walk_old_prefix(next)


func _old_archive_io() -> void:
	var directory := ProjectSettings.globalize_path("res://.testdata/tide-compat-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()])
	_check(DirAccess.make_dir_recursive_absolute(directory) == OK, "isolated compatibility fixture root")
	var path := directory.path_join("old-v1.json")
	var old: Dictionary = old_state.new_campaign()
	var old_disk = old_store.new(path)
	_check(old_disk.save_state(old, -1).ok, "Stage26 itself serializes a real v1 archive")
	var reader := Store.new(path)
	var original := FileAccess.get_file_as_bytes(path)
	var opened := reader.load_state()
	_check(opened.ok and opened.state == old and State.validate(opened.state), "new Store reads actual old v1 bytes without migration")
	_check(FileAccess.get_file_as_bytes(path) == original, "read-only old-archive load does not rewrite bytes")
	var prior: Dictionary = old_state.act(old, "launch", {"offer_id": "black-tide-survey-safe"})
	_check(prior.ok and old_disk.save_state(prior.state, old.revision).ok, "old active-deployment v1 fixture written by original Store")
	opened = reader.load_state()
	_check(opened.ok and opened.state == prior.state and State.launch_spec(opened.state) == old_state.launch_spec(prior.state),
		"old active token, profile, route and quote load without reinterpretation")
	var recover := State.act(opened.state, "recover_interrupted")
	var old_recover: Dictionary = old_state.act(prior.state, "recover_interrupted")
	_check(recover.ok and recover.state == old_recover.state, "old interrupted recovery uses identical resource and revision rules")
	_check(reader.save_state(recover.state, opened.state.revision).ok, "new Store may continue old v1 with exact resource rules")
	_check(old_disk.load_state().ok, "old-only IDs remain readable by Stage26 after new code saves")
	var launch := State.act(recover.state, "launch", {"offer_id": "black-tide-chart-safe"})
	_check(launch.ok and reader.save_state(launch.state, recover.state.revision).ok, "new chart uses same v1 schema with new branch ID")
	_check(not old_disk.load_state().ok and Store.new(path).load_state().ok,
		"downgrade limitation measured: old code rejects new IDs while current code reads them")
	for name: String in DirAccess.get_files_at(directory):
		_check(DirAccess.remove_absolute(directory.path_join(name)) == OK, "remove only this compatibility test's own fixture")
	_check(DirAccess.remove_absolute(directory) == OK, "remove only own empty fixture directory")


func _check(ok: bool, message: String) -> bool:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: " + message)
	return ok
