# v38 — Verification Record

## Automated checks

- `npm run build` — passed.
- `npm test` — passed: 19 core scenarios, 125 integration/regression scenarios, and static artifact validation.
- `git diff --check` — passed.
- Generated blackbox routes were aligned and solved for all seven campaign stages; terminal directions cover all four board edges across seeded runs.
- Archive migration preserves existing commander progress and stores mode-specific contracts, rule order, selected perks/modules, data, and relics.

## Local Chrome preview

- The arcade landing page rendered all five game cards.
- Signal Relay: clicked a live signal, reached channel 02, saw three protocol choices, selected one, and resumed target play.
- Echo Lab: observed and correctly entered a generated reverse-order sequence; the game advanced to the next round. Draft timing and selection are covered by integration regression tests. The browser automation did not reliably capture all later short flashes, so this is not recorded as a full three-round browser playthrough.
- Deep Salvage: selected the data contract, started a generated 5×5 deck, and explored six adjacent cells while the timer and cargo objective updated.
- Blackbox Decoder: used visible hints to connect a generated 5×5 route, reached the module draft, selected a module, and entered stage 02.
- At the available 1363×936 Chrome viewport, document width matched viewport width. Page-origin JavaScript errors: 0. Remaining console messages came from a browser extension.

## Scope of this verification

The browser check used a desktop Chrome preview; this session did not emulate 320px/390px phones or test physical iOS/Android browsers. Existing automated responsive safeguards passed, but those results are not a substitute for device testing. No claim is made here about long-term balance between the four arcade games and the primary roguelite.
