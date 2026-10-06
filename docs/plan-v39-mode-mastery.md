# v39 — Mode Mastery and Game-Specific Feedback

## Goal

Make the four independent arcade games reward repeated play with a choice that changes their own rules, while strengthening the feel of each game's core action. Existing commander records must carry forward without reset.

## Mastery design

| Game | Legacy progress source | Unlocks | Effect |
|---|---|---|---|
| Signal Relay | Lifetime valid captures | 12 / 40 captures | +320 ms target window, or +8% cache chance |
| Echo Lab | Lifetime solved rounds | 9 / 28 rounds | +100 ms memory flash, or +1 starting life |
| Deep Salvage | Lifetime cargo, data, and relic samples | 6 / 20 samples | First hazard costs no oxygen, or +12 seconds per deck |
| Blackbox Decoder | Lifetime connected layers | 4 / 15 layers | +3 moves per layer, or one score-free hint per campaign |

Only one mastery effect can be equipped per game. It is selected before starting and locked for that run. Standard rules remain selectable. All progress remains in the existing local commander profile; schema 9 adds the selected mastery ids and derives unlocks from cumulative counters.

## Game-specific feedback

- Relay: bright signal and cache chimes; decoys use a low warning pulse.
- Lab: note pitch follows the recalled node, with a soft ascending success and dissonant error cue.
- Salvage: separate salvage, data, relic, repair, beacon, and hazard cues, with matching board color pulses.
- Blackbox: short rotary ticks, a distinct hint sound, and a circuit completion sweep.
- All motion feedback respects `prefers-reduced-motion`; sound still respects the existing sound toggle.

## Acceptance

1. Existing schema 8 saves upgrade to schema 9 and keep scores, counters, equipment, history, and other progress.
2. Each mastery unlocks at its displayed threshold and cannot be equipped early.
3. Each effect changes only its own game and applies at run start.
4. Mastery choice is recorded with that game's chronicle result.
5. Each game's visual and audio feedback maps to its core interactions and errors.
6. Build, regression tests, browser playthroughs for all four games, narrow-screen checks, and live-site smoke all pass before publish.
