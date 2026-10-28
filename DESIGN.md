# NextStop design system

One system for the NextStop web app. It was built by comparing the 84 brand systems in the
`awesome-design-md` library, keeping the choices most of them agree on, and taking the rest from
the brands closest to this product (Uber for transit, Apple and Airbnb for consumer phone use,
Linear and Vercel for tool screens). The taste-skill "achromatic ledger" app style supplied the
colour budget.

## How the comparison was done

A script read the frontmatter of every `DESIGN.md` in the library and pulled out primary colour,
canvas, ink, typefaces, radius scale, type sizes and button height. 74 of the 84 files had a
usable radius scale and 64 had a body size.

| Question | What the 84 brands do | NextStop takes |
|---|---|---|
| Control shape | 72 of 74 radius scales include a full pill (999px or 9999px) | Pill for every button, chip, tab and segmented control |
| Card radius | Most scales step 4, 6, 8, 12, 16, 24; transit and consumer brands use 12-20 on cards (Uber 16, Apple 18, Airbnb 14-20) | 16px cards, 10-12px inner wells, so the radius is "soft" with pill controls, never the in-between 11-12 |
| Body size | Median 16px; only 4 brands go to 14px | 16px body, 14px meta, 12px small |
| Smallest text | Median 12px | 12px floor |
| Button height | Median 40px overall; 48px on Uber-like consumer and mobility brands (Airbnb, BMW, Ferrari, PlayStation, Renault) | 48px for the main action, 40px for the rest (Fitts) |
| Primary colour | About a quarter use black or near-black as the primary; most others put one brand hue on the action | Near-black primary (#111, inverted white in dark), because the line colours must be the only hues |
| Canvas | Half use pure white | White cards on a pale blue-grey ground (#f2f4f7), one step off white, so cards separate without shadows |
| Typefaces | Almost every brand uses one grotesk with at most a second face for one job | One face: Mukta |
| Largest type | Median 64px on marketing pages | Not used. App screens stay at 18-32px; the trip time is the largest figure at 32px |

## Colour

The chrome holds no colour. The only hues on screen are the metro line colours, and they appear
on the route itself: the leg track, the line chip, the change marker. That makes the route the
first thing the eye finds (Von Restorff) and keeps "which line" readable at a glance.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | #f2f4f7 | #000000 | page |
| `--surface` | #ffffff | #111111 | cards, panels |
| `--raised` | #eceef2 | #1d1d1d | wells, secondary buttons, segmented track |
| `--border` | #e1e4e9 | #232323 | card edges |
| `--text` | #0a0a0a | #ffffff | primary text |
| `--muted` | #555c68 | #b4b4b4 | secondary text, 4.5:1 or better on every surface |
| `--primary` | #111111 | #ffffff | the one filled button per screen |
| `--focus` | #1d5fbf | #7fb0ff | focus ring, caret |

Line colours each carry an ink colour picked for 4.5:1 on the fill (`--yellow-ink` is near-black,
`--blue-ink` is white). A line is always named in text on its chip, never by colour alone.

## Type

Mukta, self-hosted (400, 500, 600, 700, latin subset, about 84 KB in all) so it works offline.
Chosen over the dealt Geist because Geist and Inter are the default face of generated interfaces,
and because Mukta comes from Ek Type, an Indian foundry, with a matching Devanagari design for the
Hindi station names on the roadmap. Its tabular figures were checked in the browser: with
`tabular-nums`, "1111" and "0000" render at the same width.

| Role | Size / weight |
|---|---|
| Trip time figure | 32 / 600 |
| Screen title | 24 / 700, tracking -0.02em |
| Section title | 16 / 600 |
| Body | 16 / 400 |
| Meta, labels | 14 / 500 |
| Small, notes | 12 / 400 |

Every number uses tabular figures.

## Shape, space, depth

- Radius: cards 16, inner wells 10, inputs 12, controls and chips pill.
- Spacing on a 4px base; one 16px gutter between panels; 20px card padding.
- No shadows on anything at rest. Only the suggestion menu and the toast float, and only they cast
  a shadow. Surfaces separate by a 1px border or one tone step.
- No gradients. The line-change marker is a disc split into the two line colours with borders, not
  a gradient.

## Layout

- Desktop (840px and up): a 384px sticky search column and a fluid answer column, centred at
  1120px. Navigation sits in a plain top bar: mark, name, Plan, Lines, Saved.
- Phone: a bottom tab bar in the thumb zone; the search folds into a one-line trip header once a
  route is shown; the main action is a full-width 48px button.

## Motion

Feedback only: press scale on buttons, the swap button turns, a route that arrives rises 8px over
320ms, the arrival tick draws itself. All of it switches off under `prefers-reduced-motion`.
