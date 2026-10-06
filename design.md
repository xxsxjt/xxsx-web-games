# Design — Neon Drift / 新伊甸游戏厅

This is the locked visual system for the public Neon Drift game station. The
site is an offline-first playable app, so the interface must keep the game and
the next useful action visible before decorative framing.

## Genre

Atmospheric technical. The station should feel like a readable flight console:
quiet dark surfaces, one active signal colour, thin rules, compact telemetry,
and restrained motion.

## Macrostructure family

- Arcade index: Catalogue / index-first. Six modes are grouped by play intent,
  with one clear route action per card.
- Station app pages: Workbench. The navigation rail and the current work area
  stay stable while each view changes its working surface.
- Game pages: Tactical console. The playable board, controls, and state readout
  lead; prose is secondary.
- Content pages: Long Document with catalogue filters. Codex, guides, dispatch,
  archive, and chronicle use readable sections instead of marketing cards.

## Theme

```css
--color-paper:      #070b18;
--color-paper-2:    #0d1425;
--color-paper-3:    #141e33;
--color-ink:        #eaf6ff;
--color-ink-2:      #a7b8ce;
--color-rule:       rgba(166, 196, 220, .18);
--color-accent:     #79e7ee;
--color-accent-ink: #06141a;
--color-signal:     #ffc867;
--color-danger:     #ff7e8e;
--color-good:       #85edbc;
--color-violet:     #bb9bff;
--color-focus:      #fff3a8;
```

The cyan accent marks the next action and current selection. Amber is reserved
for rewards and route risk; violet is reserved for research and experiments;
red is reserved for danger. Accent usage stays local to controls, rules, and
small readouts.

## Typography

- Display: `Arial Narrow`, `Avenir Next Condensed`, `ui-sans-serif`, roman,
  750–900.
- Body: `system-ui`, `-apple-system`, `"Segoe UI"`, `"Noto Sans SC"`, 400–650.
- Outlier: `ui-monospace`, `SFMono-Regular`, `Menlo`, used only for wordmarks,
  route codes, and compact telemetry.
- Display tracking is tight (`.015em` to `.04em`); body line-height stays near
  1.55 for Chinese copy.

## Spacing and shape

Use the 4-point scale from `--space-1` through `--space-8`. Cards use one
containment layer, 12–18px corners, and a 1px rule. Elevation comes from a
slightly lighter surface or a quiet dark shadow; coloured halos are reserved
for live game feedback.

## Motion

Use one short fade/translate entrance for view changes and direct feedback for
game actions. Hover movement is limited to a 2px lift on fine pointers. Reduced
motion removes transforms and animation while keeping state changes visible.

## Interaction contract

- Every control remains touch-sized (44px minimum) and keeps its label on one
  line.
- Every route has a direct back action and can be restored from the URL hash.
- Focus uses an outline, never a border-width change.
- Local-only status is stated plainly; no fabricated online metrics or social
  proof are introduced.

## Hallmark pre-emit critique

Philosophy 5 · Hierarchy 4 · Execution 4 · Specificity 5 · Restraint 4 ·
Variety 4. The main risk is the existing game's dense legacy CSS; the V44 layer
centralises tokens and removes the strongest repeated glow/card patterns without
touching game mechanics.
