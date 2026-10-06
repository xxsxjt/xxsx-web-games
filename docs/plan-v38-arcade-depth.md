# v38 — Four Arcade Games: Depth and Replayability

## Why this work exists

The four games outside the roguelite shooter had independent routes, but their play loops were too small and too repeatable. A separate page alone did not make them feel like separate games. This update gives each one its own verb, changing run content, decisions, and a result that feeds the commander archive.

## Design and acceptance targets

| Game | Core verb | Run variation and choices | Completion signal |
|---|---|---|---|
| Signal Relay | Identify and intercept | Three accelerating channels; signal, cache, and decoy targets; two protocol drafts per run | Score, accuracy, streak, and selected protocols recorded |
| Echo Lab | Observe, transform, recall | 120-second survival; four input rules shuffled per run; longer sequences, decoys, larger board, and one cognitive protocol choice every three solved rounds | Highest score, solved rounds, errors, rule order, and perks recorded |
| Deep Salvage | Explore, collect, extract | Five contracts; seed-generated loot and hazards; 5×5, 6×6, and 7×7 decks; extract or descend at beacons | Cargo, data, relics, contract result, heat, and depth recorded |
| Blackbox Decoder | Trace and rotate | Seven stages; 5×5 through 7×7 boards; generated routes and decoys; input/output edges rotate; module choice after each solved layer | Layers, hints, modules, score, and seed recorded |

## Shared station loop

- Preserve five separate game routes and clean up each mode's timers when leaving it.
- Keep each game's own record and best score.
- Continue routing resources, station contracts, unlockable equipment blueprints, and the chronicle through the same local commander profile.
- Preserve existing archives and add the new run details without discarding earlier progress.
- Keep gameplay usable on narrow touch screens and desktop pointers.

## Verification gates

1. Build the static site and run core, regression, and artifact validation tests.
2. Verify generated blackbox puzzles are solvable with their actual terminal edges and do not start solved.
3. Verify contract-specific salvage layouts contain enough required items and one beacon.
4. Exercise each game through its real page controls, including a mid-run choice and navigation cleanup.
5. Check phone-width and landscape layouts for overflow and readable controls.
6. Publish only the exact committed build and verify the public site and assets.

## Remaining design boundary

These are four different arcade games with distinct rules and campaign loops; their session length is intentionally shorter than the primary shooter. This release does not claim equal content volume or full hardware testing on physical iOS/Android devices. Future work should add unique audiovisual signatures and mode-specific mastery rewards based on player feedback, rather than extending the games with a shared generic upgrade layer.
