# v39 — Verification Record

## Automated checks

- `npm run build` — passed.
- `npm test` — passed: core scenarios, the full regression suite, and static source/build validation.
- `git diff --check` — passed.
- Added regression coverage for legacy profile migration, stale mastery selection, mastery effects, and selection locking in all four short games.

## Local Chrome preview

- Migrated a profile with 12 existing relay hits; the earned `宽频捕获` mastery remained equipped.
- Started Signal Relay and confirmed its equipped mastery and standard configuration both disabled immediately. Selection attempts during a run were rejected; stopping restored the controls.
- Started Echo Lab, Deep Salvage, and Blackbox Decoder; each showed the standard configuration enabled before play and disabled while its run was active.
- Played the four short games in the local preview earlier in this v39 pass: relay target capture and protocol drafts, Echo Lab node input and error response, salvage grid exploration, and Blackbox hint-guided route solving with a module draft.
- Confirmed 320×568, 390×844, and 844×390 layouts have no page-level horizontal overflow in the local preview.
- Browser console contained no application-origin errors. Captured errors were emitted by the browser extension.

## Self-review fixes

- Mastery controls now rerender on start, finish, and stop so their disabled state matches the live run state.
- A saved mastery that no longer meets its threshold is cleared during profile normalization; cumulative commander progress is retained.
- Removed a duplicate `blackboxBoard` UI reference and updated the announcement hero to v39.

## Scope

The checks used a desktop Chrome preview and responsive viewports. Physical iOS/Android devices and long-term balance across all five games were not tested.
