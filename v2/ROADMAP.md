# Roadmap — serving the sense of self

Every item below is judged by one question: does it make the self's dissolution, flattening and reformation more felt? See `DESIGN.md` for the goal. Items are in build order. Each has a rationale, the mechanics, implementation notes against the current engine, and what "done" looks like.

---

## 0. Strip the harness — done 2026-11-02

**Why.** Health bar, counters and legends assert a conventional "you". The visible size of the self is the health bar. The game should look like the simulation and nothing else.

**Done when.** No HUD except the target throbber and the guide arrow (kept until navigation is readable without it), plus the brief intro line.

---

## 1. Phase-field walls with residue — done 2026-11-02

**Why.** A fixed stage makes the self the only thing that changes. If the structure softens, melts, frosts, grows and remembers, then dissolution is the world's condition too, and the places where you lost pieces of yourself stay marked.

**Mechanics.**
- Every cell carries a *solidity* value from 0 (open gas) to 1 (solid). Walls are cells with solidity at or above one half; below that they are porous and drag the gas.
- *Melting*: sustained heat above a threshold lowers solidity slowly. Furnaces eat their own chambers over minutes.
- *Erosion*: fast flow wears down weak (already porous) walls.
- *Frost*: cold plus condensable gas (smoke, fuel) grows new solid. Coolers grow crusts.
- *Biofilm*: where the organism lives long enough it deposits solid tissue; heat burns tissue back far faster than metal.
- *Soot and scorch*: smoke deposits on wall faces, heat scorches them. Both fade over a very long time.
- *Residue*: cells of the self that wither (the far fragments) leave a faint luminous trace that fades over minutes. The world records every self you lost.

**Implementation.** New ping-pong field `Wf` (RGBA16F): solidity, soot, residue, grown-kind (0 original metal, 1 grown frost or tissue). Initialised from the static mask. A `walls` pass updates it from heat, smoke, life, velocity and the body's withering output (the body pass writes the amount it withered this step into its green channel). All passes replace "is this mask type solid" with "mask type is a machine or source, or solidity ≥ 0.5". Partial solidity damps the lattice velocity. The renderer draws walls from solidity and tints by soot, scorch, kind and residue, with eroded edges where solidity is between one half and one.

**Done when.** A burner visibly hollows its surroundings over minutes, a cooler grows crust, the organism builds tissue that fire clears, smoke leaves soot, and a withered fragment leaves a glow that outlasts it.

---

## 2. Self as light — done 2026-11-02 (diffused light grid at quarter resolution rather than ray marching)

**Why.** If the self is the only light, then a flattened self lights a wall as a smear, a lost fragment is a light going out in the distance, and the dark between fragments is literal.

**Mechanics.** Your matter emits light. Walls cast shadows. Heat glows too, but dimmer and warmer. Everything else is dark.

**Implementation.** A low-resolution light pass: for each screen pixel, march toward the centroid and toward a few sampled points of the body (the reduction can also output the brightest fragments) through the solidity field, accumulating occlusion. Cheap at quarter resolution with 16 to 24 steps. Composite in the renderer with a bloom blur of self and heat.

**Done when.** A room is dark until you enter it; a drifting fragment is a visible dimming ember; walls near you show their texture, far walls do not.

---

## 3. Streaklines and glow — done 2026-11-02

**Why.** The wind is the other character. It should read as continuous ink, not scattered dots.

**Implementation.** Replace seeded dye with an advected noise texture regenerated on a slow cycle (two phases cross-faded so the pattern never pops). Half-resolution blur for bloom on heat and self.

**Done when.** Currents read as streaks at a glance in every chamber, and reformation looks like light gathering.

---

## 4. Organic geometry and ageing — done 2026-11-02 (noise-displaced chamber walls, pre-aged soot and wear; ducts still straight)

**Why.** Boxes assert a designed, permanent place. Swollen, pinched, eroded forms assert a place that has been lived in.

**Implementation.** Keep the room graph. Carve each chamber as a union of noisy distance fields rather than rectangles; ducts as tapered tubes with bulges. Seed the phase field with pre-aged soot, frost and erosion so the structure has a history on arrival.

---

## 5. Sound as a sense of self — done 2026-11-02

**Why.** You should hear yourself come apart before you see it.

**Implementation.** The reduction already computes mass and centroid; add second moments (spread in x and y). A body tone whose stereo width follows the spread, a second detuned voice when the spread is bimodal, and the wind noise panned by where your mass sits on screen.

---

## 6. Multiple selves — done 2026-11-02

**Why.** The centroid can sit in empty space between two halves. That is honest but it hides the choice. Pinball makes you choose a ball; this should make you choose a fragment.

**Implementation.** A GPU estimate of the two or three largest connected fragments (a few iterations of label propagation at low resolution, or k-means from the previous frame's centres). Camera and target belong to the largest. Others persist as ghosts: they wither on the same rule, can be reeled back, or can be adopted with a tap, which swaps which one is "you".

**Done when.** When a fan cuts you in two, you can watch both halves and pick one.

---

## 7. Reformation as a place — done 2026-11-02

**Why.** Reforming should be found, not awarded. A checkpoint is a reward; a cold still pocket where you condense is a mirror.

**Implementation.** Condensation pockets: cold, low-flow cells raise cohesion and growth for the self inside them. Checkpoints become such pockets, and some pockets are unmarked.

---

## 8. The organism as the other self — done 2026-11-02

**Why.** A second kind of self that lives differently makes the first one's nature visible.

**Implementation.** Self lingering inside dense organism converts to organism; burning organism near you yields self. Both are conserved fields, so the exchange is a rule in the species and body passes.

---

## 9. Theme

Decide after items 1 and 2 are in. The two fits are a corroding machine or a breathing body. The phase field makes either possible; which one wins should be decided by looking at the aged, lit structure, not in the abstract.

---

## 10. Past lives and the single appetite — done 2026-11-02

Cores and drones retired. The organism hunts by climbing the self gradient. Past lives keep a habit and seek cold, fade outside pockets, persist inside them. Pockets are the resource. Dispersal is slow.

---

## Lab outcomes (2026-11-02, branch `psych`)

Measured in `v2/lab.js` (`#lab=<scenario>&warm=900`), a warmed box with one jet and a ledge above it.

| outcome | status | evidence |
|---|---|---|
| testing the waters | produced | `ledge`: anchored against the ledge with its lowest third in the jet, 68 of 162 cells torn off in 2 s, carried 39 away, faded in ~4 s; the rest held and regrew to 135 |
| commitment | produced | `ledgeR`, `edge`: beside a jet with no anchor the whole self is carried ~160 cells at full mass |
| rescue | produced, timing-sensitive | reunion observed in `rescue`/`commit`; a taken piece fades ~3 s after separation, so the window to go after it is about that long |
| holding is work | produced | `hold`: effort 0.3–0.4, stamina 1.0→0.72 in 2.5 s, exhaustion scatters |
| calm is free | produced | `calm2`: 67 cells in 5 s at steady mass; near the cold corner a return current slows it |
| exiles leave traces | produced | residue written by withering cells |

Rules that produced them: the self swims through the gas and does not push it; cohesion capped below swim speed; cohesion halves under jet shear; torn cells wither at 0.988/substep; stamina drains only against real currents (> 0.07) with 2.5 s dissociation; stick (press into a wall, touching cells hold).

---

## Shipped 2026-11-02 (evening), branch `main` (was `psych`)

- **Music played by the simulation.** Chamber keys a fifth apart; a plucked pentatonic walk clocked by the gas speed at the body, climbing in rising current; vents, drains, cold rooms and burners speak in short notes (a sustained pipe sine was heard as a stuck tone); the self's two voices sit on a musical interval and fade to a tenth when idle. Music and sound toggles in the ≡ menu, remembered.
- **Self-healing audio.** Every value clamped and checked; master through a 3 kHz lowpass and compressor; a panic routine silences all voices on any error, on a stale frame loop, or when the speaker holds one loud pitch for 5 s; no frames means no sound.
- **One self you stick to.** No tap-to-adopt; a left-behind part takes over only after 45 ticks below the living threshold and locks for 4 s; parts spawn and die with hysteresis; the camera glides and cuts on respawn.
- **Body scaled to the world's resolution**; **no homing through walls**; **the required route is widened** (radius 8) so the body fits; static completability holds at body radius on both resolutions.
- **Fixed simulation rate** (120 substeps/s phone, 180 desktop, capped per frame); viewport in CSS px per cell sized to the window; half detail by default.
- **Display**: bilinear field sampling, smooth wall contours, everything under the light map.
- **PWA** (manifest, service worker, offline verified), **GitHub Pages** at danroblewis.github.io/megastructure/v2/, **ten maps** in sequence with a real win.
- **Remote debugging**: `tools/devserver.py` + `v2/report.js` (+ `tools/rjs.sh`) run JavaScript on the phone and record errors with state snapshots.
- **Bot**: chained route between cold rooms, line-of-sight steering with a breadth-first detour.

---

## 11. Carried resource and repair — done 2026-11-03

Some alcoves are dead: their coolers dark, no cold, no checkpoint. Elsewhere there is a resource (a mineral, an ash) that
body cells pick up when they pass over it. The payload lives in the body texture's spare channel, per cell: it travels
with the cells that carry it, cannot spread across the self, and dies with them. Deposit enough inside a dead alcove and
it comes alive: cold flows, the checkpoint works. Repair as reciprocity. This gives tearing, stamina, walls and currents a
reason: you must bring particular cells through. Mechanism: payload channel in SH.body (pickup from a baked source, kept
through transport, cleared when the cell dies); a probe/reduction of payload inside each alcove rect; alcove state in the
walls field (frost grows as it heals). Order of work: first.

## 12. Pickups that power some of your cells — done 2026-11-03

Same channel, another payload kind: cells that touch a pickup gain a property (extra swim, immunity to carry, heat
tolerance). Only those cells have it, so the body stretches as the powered cells pull ahead; the player decides whether
to let them lead or hold the self together. Nearly free once 11 exists. Order: second.

## 13. Other wisps — first version done 2026-11-03

NPC wisps with simple drives (head for the next alcove; stall against a current; hide in calm). The reduction already
tracks three centres with habits. Helping them: the self does not push gas, so help is bringing payload to repair a dead
vent that would carry them, or sheltering them in your calm, or towing a part of them. The most on-theme idea (helping
another through a tight spot) and the most work. Order: third, once payload exists to give them something to need.

Shipped 2026-11-03: payload channel (ore gold / charge bright, per cell, dies with the cell); every third cold room dead,
ore in the chamber before it, 60 units (scaled) to repair; orbs every ~700 route cells charging the cells that touch
them (2.6x swim, 30% carry, ~10 s); one other wisp waiting before the first dead alcove, travelling the route after the
repair, resting in live cold rooms, leaving at the exit. Verified headless: pickup (~50 units in 300 ticks pressed into
ore), repair (<400 ticks with a loaded body), orb charge, wisp release and travel (route index 1310 in 1000 ticks).
Open: the wisp and you exchange cells when you overlap (nearest-centre assignment); whether that reads as integration or
as theft needs play. Helping the wisp beyond the repair (towing, sheltering) is not built.

---

## Identity experiments, wave 1 — results 2026-11-04 (branches ident-N-<name>; sections with full tables are on each branch)

Scenario: `enmesh` (press into the other wisp 4 s, hold 5 s, pull away 6 s). The baseline passes straight through the other
wisp (dist 12 at t=90, 74 by t=240), exchanges ~35 cells symmetrically at contact which reverse, and ends crushed on the box
wall; `enmesh2` (gentler) is used from wave 2. Criteria: overlap normal; no taking; loss allowed; learning together.

| model | boundary | no taking | steerability | learning together | verdict |
|---|---|---|---|---|---|
| coherence (1) | none beyond distance | yes | kept (100%) | no (q is habit, not history) | baseline in disguise; a stronger soft-membership version merged centres and dragged the other wisp 190 cells (codependence) |
| familiarity (2) | lasting entanglement (pair stays ~20 apart for the hold), but q says how settled a cell is, not whose | yes (both ~160 after) | 2/3–4/5 alone, 2/3 of that entangled | no | fresh matter is fragile by design, and every spawn is fresh: a fresh body in a current is lost |
| commitment (3) | yes: the push ends on top of the other wisp, not through it | yes (160/161) | 80% entangled, ~60% everywhere (1 s adoption, 2.5 s status ramp) | no (q diverges after parting) | a boundary at the price of sluggishness; tearing/holding outcomes blunted by the same lag |
| held (8) | pending | | | | |
| survival (10) | no new physics (identical to baseline) | measured: ~30 of its cells leave with you, ~20 of yours stay, all fade within 30 ticks | 100% | histories converge in contact, diverge after | provenance legible; ledger distinguishes faded from taken; chamber ledger pending |

Take-aways so far: distance alone already gives "no taking" (exchanged cells fade); what the models add is *not passing
through* (commitment, familiarity) at a cost in responsiveness; none yet produces learning-together; soft membership that
can merge centres must be ruled out in the reduction (it is codependence by the numbers).

---

## 14. The friend's story — idea 2026-11-04

Enmeshment with the green wisp, as it stands, slows you and blurs who is who; the user's reading: if that is meant to be
bad boundaries it "kind of works", but it needs a story. Codependency, properly: someone with a problem they are capable
of working through on their own (the father's drinking; the son buying the bottle, the wife phoning in sick for him),
and the lesson that without your own boundaries you cannot help, because your boundaries enmesh and you both end up
with the same problem. So the friend needs a problem of its own that it can overcome, text on screen that tells the
story as it happens, and a way for the player to help that is not doing it for them. Never a lesson that leaving a bad
entanglement kills the other: the friend now regrows and returns. Experiments 3 (commitment, rejected as prescriptive)
and 11 (statuses: diffusion, moratorium, achievement, negative identity as emergent stability) are the Marcia side.

---

## Identity experiment 11: statuses — 2026-11-04, branch `ident-11-statuses`

Marcia without commitment. The status is a property of the **whole body over time**, decided on the CPU each tick
(`IDENTS.statuses.tick` in `v2/ident.js`) from what the reduction and the selves already give, never a per-cell intention
and never a choice. A fast view (8 ticks) and a slow view (45 ticks) are kept of spread, elongation, mass and the centroid's
motion relative to the gas at the body; their normalised difference is the rate of change of the configuration (`flux`).
Diffusion: dead, dissociated, mass under the death threshold, two or more parts, or mass under 30 % and falling.
Moratorium: a part exists, a fresh spawn, or `flux` above the band (0.28). Achievement: `flux` inside the band for 75 ticks
with no part; it is lost when `flux` exceeds 0.45 for 8 ticks or a part appears. Negative identity: achievement while a
slow harm measure (2 s window: heat at the body, burning cells, the organism in or round the body, stamina under 0.35, no
live cold room within 420 cells) is above 0.35; it turns back into achievement when the harm drops below 0.25. The model
knows no shapes: a ball, a streak pinned on a ledge with its lowest rows in a jet, or a body embedded in the other wisp all
count as achieved once their rates of change are low. Effects, your cells only (`ki==0` / `q.w>0.5`): diffusion cohesion
−45 %, steering −45 %, regrowth −50 %; moratorium cohesion −25 % with a slow breathing pulse (an earlier drive *sway* fed
back into the stability measure, so the body never settled: removed); achievement and negative identity alike cohesion
+35 %, regrowth +60 %, full steering. Strength `statusK` ramps in over a second. Ownership (`identWeight`, `identUpdate`)
stays the baseline's allegiance with memory. `bd.status` → `uStatus`, `bd.statusK` → `uStatusK`. Tint: grey (diffusion),
amber with a slow pulse (moratorium), warm white (achievement), warm white with a dark crimson pulse veined by cell age
(negative identity). HUD: the status word bottom-left, small, with a pulsing red underline for negative identity; a
one-line caption when it changes (`negative identity · stable, and it hurts · leaving costs the stability for a while`).
Lab: `settle` (calm gas, 5 s still, 5 s straight line, 5 s still); rows carry `status`, `sk`, `ist` (flux, stable ticks,
harm, parts, the four components); the title carries `transitions` in lab ticks. Lab fix on the branch: `measure()`
(every 30 ticks) left the jet-line probe in the buffer, so the next tick read the jet as the flow at the body; it now puts
the body's probe back (this also removes a 1-in-30 glitch in the stamina effort of every earlier lab run).

`#lab=settle&n=900` (calm gas, 5 s still, drive [1,0] from t=300 to 600, 5 s still; three runs of the final code agree to the tick):

| t | status (sk) | mass | cx cy | elong | vx / gas | flux | parts |
|---|---|---|---|---|---|---|---|
| 30 | moratorium (0.58) | 163 | 302 59 | 1.1 | +0.03 / +0.02 | 0.1 | 0 |
| 60 | moratorium (0.6) | 163 | 302 58 | 1.1 | -0.02 / -0.02 | 0.11 | 0 |
| 90 | moratorium (0.62) | 164 | 300 56 | 1.1 | -0.04 / -0.04 | 0.1 | 0 |
| 120 | achievement (0.27) | 165 | 298 55 | 1.3 | -0.07 / -0.06 | 0.13 | 0 |
| 180 | achievement (1) | 166 | 294 53 | 1.4 | -0.10 / -0.08 | 0.15 | 0 |
| 240 | achievement (1) | 166 | 289 51 | 2.0 | -0.12 / -0.12 | 0.26 | 0 |
| 300 | achievement (1) | 166 | 281 49 | 2.9 | -0.14 / -0.13 | 0.34 | 0 |
| 330 | achievement (1) | 164 | 290 48 | 4.0 | +0.34 / -0.13 | 0.45 | 0 |
| 360 | moratorium (0.86) | 162 | 300 47 | 3.8 | +0.33 / -0.11 | 0.66 | 0 |
| 420 | moratorium (1) | 159 | 323 44 | 4.3 | +0.42 / -0.05 | 0.86 | 0 |
| 480 | moratorium (1) | 158 | 349 42 | 6.5 | +0.45 / -0.04 | 0.32 | 0 |
| 540 | moratorium (0.72) | 157 | 377 41 | 6.7 | +0.44 / -0.05 | 0.12 | 0 |
| 570 | moratorium (0.58) | 157 | 389 41 | 6.6 | +0.40 / -0.06 | 0.07 | 0 |
| 600 | achievement (0.48) | 159 | 402 42 | 6.9 | +0.46 / -0.04 | 0.1 | 0 |
| 630 | achievement (0.98) | 162 | 402 41 | 6.2 | -0.06 / -0.03 | 0.36 | 0 |
| 660 | moratorium (0.79) | 141 | 396 41 | 3.4 | -0.07 / -0.05 | 0.64 | 1 |
| 720 | moratorium (1) | 151 | 388 38 | 2.2 | -0.62 / -0.09 | 0.85 | 1 |
| 780 | moratorium (1) | 141 | 376 36 | 2.0 | -0.21 / -0.12 | 0.48 | 0 |
| 840 | moratorium (1) | 141 | 362 35 | 1.8 | -0.18 / -0.14 | 0.32 | 0 |
| 870 | moratorium (0.8) | 146 | 355 34 | 1.7 | -0.14 / -0.14 | 0.13 | 0 |
| 900 | moratorium (0.65) | 151 | 348 34 | 1.8 | -0.16 / -0.17 | 0.16 | 0 |

Transitions: moratorium → achievement at t=105 → moratorium at t=342 → achievement at t=572 → moratorium at t=646. Achievement 1.75 s after spawn; lost 0.7 s after the drive starts (the body stretches
from elongation 1.1 to 4 and accelerates to 0.45 cells/tick); achieved again 4.5 s into the run while still a streak of
elongation 6–7 moving at 0.44 (the gas at the body reads −0.04, so the motion term is the swim itself, steady); lost
0.8 s after the stop. The fourth achievement did not arrive in the last 5 s: stopping from the streak tore its tail (162 →
141, a part 26 cells away that faded in 3 s), two more far cells were seeded as parts and faded, and the body was still
contracting (flux 0.3 at t=840, 0.16 at 900, 52 ticks into the band when the run ended: achievement would have followed at about t=925). The times to settle are then about
1.75 s for a fresh ball at rest, 4.5 s for a run from rest, and more than 5 s after a stop from speed when the stop costs
cells.

`#lab=ledge&warm=900` (pressed up against the ledge, lower edge in the jet, drive straight up for 7.5 s, then nothing) and
`#lab=hold` (inside the jet, pushing upstream and correcting to stay in it for 15 s), both against the baseline run on this
branch (`#ident=centroid`, with the `measure()` fix):

| t | ledge: status (sk) | ledge: statuses mass | ledge: baseline mass | hold: status | hold: statuses mass / stamina / inJet | hold: baseline mass / stamina / inJet |
|---|---|---|---|---|---|---|
| 30 | moratorium (0.93) | 119 | 118 | moratorium | 164 / 0.87 / 116 | 164 / 0.87 / 120 |
| 60 | moratorium | 83 (36 torn) | 81 (37 torn) | moratorium | 163 / 0.76 / 0 | 163 / 0.76 / 0 |
| 120 | moratorium | 84 | 82 | moratorium | 160 / 0.76 / 123 | 160 / 0.77 / 31 |
| 180 | moratorium (0.61) | 85 | 85 | moratorium | 161 / 1.0 / 112 | 161 / 1.0 / 90 |
| 210 | achievement (0.15) | 86 | 86 | moratorium | 160 / 1.0 / 196 | 160 / 1.0 / 205 |
| 300 | achievement (1) | 87 | 86 | moratorium | 160 / 0.99 / 14 | 160 / 0.98 / 45 |
| 420 | achievement | 87 | 84 | moratorium | 161 / 0.86 / 115 | 162 / 0.83 / 36 |
| 450 | achievement | 87 | 84 | moratorium | 161 / 0.81 / 1 | 161 / 0.78 / 0 |
| 480 | moratorium (0.19) | 135 | 136 | moratorium | 161 / 0.76 / 0 | 161 / 0.74 / 0 |
| 540 | moratorium | 158 | 155 | moratorium | 161 / 0.83 / 0 | 161 / 0.95 / 0 |
| 600 | moratorium (0.81) | 160 | 160 | moratorium | 162 / 1.0 / 0 | 163 / 0.98 / 0 |

Ledge transitions: moratorium → achievement at t=202, → moratorium at 479. The tear (36 of 119 cells in the first second,
37 in the baseline) is moratorium, not diffusion: the torn piece is carried off and fades before the far-cell rule can make
it a part, and the remainder is 70 % of the body, above the 30 %-and-falling line. The remainder pinned on the ledge with its
lowest rows in the jet is **achieved after 3.4 s** and holds at 87 (baseline 84–86) with the +35 % cohesion until the drive
stops; regrowth then changes the configuration (moratorium) and both reach 160 by t=600. The status model neither helps nor
harms the tear: the outcome is the baseline's to within two cells. Hold: no exhaustion on this branch for either model
(stamina 0.87 → 0.71 in the first 1.5 s, then the body is swept out of the jet and recovers; the stay-in correction drives
it back in and out again, inJet 0 → 200 → 0), so the "exhaustion scatters" outcome in the lab table above no longer
reproduces on main and `hold` demonstrates neither diffusion nor a model difference. Diffusion was produced in `settle`
only transiently (the spawn's first ticks) and in `burn` (below).

`#lab=enmesh2&npc=170,60&warm=300&n=900` (press 2.5 s at 0.7, hold inside 5 s, pull away 4 s, rest):

| t | status (sk) | main / other / dist | cx | flux |
|---|---|---|---|---|
| 30 | moratorium (0.91) | 163 / 174 / 30 | 143 | 0.44 |
| 90 | moratorium | 90 / 223 / 9 | 165 | 0.72 |
| 150 | moratorium | 171 / 168 / 21 | 193 | 0.77 |
| 300 | moratorium | 161 / 161 / 21 | 178 | 0.62 |
| 420 | achievement (0.03) | 161 / 158 / 22 | 158 | 0.16 |
| 480 | achievement (1) | 163 / 155 / 38 | 133 | 0.42 |
| 540 | moratorium | 159 / 155 / 76 | 93 | 0.79 |
| 600 | moratorium | 159 / 156 / 121 | 47 | 0.81 |
| 690 | moratorium | 71 / 157 / 145 | 21 | 1.06 |
| 810 | moratorium | 157 / 159 / 138 | 28 | 0.30 |
| 900 | achievement (0.17) | 159 / 160 / 135 | 34 | 0.24 |

Transitions: moratorium → achievement at t=419, → moratorium at 491, → achievement at 891. The press and the hold are
moratorium: the membership accounting swings as pressed cells change allegiance and back (163 → 90 → 171 while the other
reads 174 → 223 → 168), which the mass term reads as change. Then, 2.7 s into the hold, **achievement while embedded in the
other wisp** (dist 20–22): the entangled pair is itself a stable configuration, and the model, knowing no shapes, rewards
it. That is the codependence reading in one number: enmeshment can be an achieved identity. Pulling away is moratorium
(centroid 20–22 cells per 30 ticks, as the baseline), the pull ends crushed on the box wall at x≈21 (159 → 71, as in every
run of this scenario), the body regrows and is achieved again at rest. No taking: 159 / 160 at the end against 163 / 174
at the start. Harm stayed 0: the friend is not harm, so there is no negative identity here; the trap would need the
friend's problem (section 14) to be a harm the measure can see.

`#lab=burn&n=600` (spawn 20 cells above the lab burner, no drive; added on this branch to test the trap directly):

| t | status (sk) | mass | cx cy | harm | flux | parts |
|---|---|---|---|---|---|---|
| 30 | moratorium (0.89) | 163 | 457 214 | 0 | 0.28 | 0 |
| 120 | moratorium | 160 | 475 212 | 0.16 | 0.64 | 0 |
| 210 | moratorium | 127 | 484 205 | 0.39 | 0.35 | 1 (dist 60) |
| 300 | moratorium | 114 | 489 218 | 0.50 | 0.39 | 1 (dist 67) |
| 390 | moratorium | 131 | 485 230 | 0.55 | 0.70 | 0 (faded) |
| 480 | moratorium (0.67) | 129 | 484 231 | 0.58 | 0.14 | 0 |
| 510 | **negative identity** (0.05) | 131 | 485 231 | 0.58 | 0.16 | 0 |
| 570 | negative identity (1) | 151 | 485 231 | 0.59 | 0.19 | 0 |
| 600 | negative identity | 154 | 484 231 | 0.59 | 0.16 | 0 |

Transition: moratorium → negative identity at t=508. The plume carries the body into the corner and down onto the burner
row (cy 214 → 231); a third of it is torn off, tracked as a part 60–67 cells away and fades; what is left lies on the heat,
the harm measure climbs to 0.58, and once the configuration stops changing (5 s after it stopped losing cells) the model
calls it achieved-in-a-bad-place: the tint is the achievement white with the crimson pulse, the HUD says `negative
identity` with the red underline, and the caption says leaving will cost the stability. The body then regrows from 127 to
154 on the +60 % regrowth bonus while the heat keeps eating it: the trap is exactly that the bad place is where it is
easiest to be whole. Not produced here: diffusion (mass never fell under 30 %; the lowest was 114 of 170); it was seen only
in the spawn's first ticks and would need the body actually scattered (two parts, or dissociation).

**Judgement.** Achievement feels earned in the sense the brief asked for: it is never granted for a shape, only for
holding one, and it arrived in 1.75 s for a resting ball, 3.4 s for a streak pinned on a ledge, 2.7 s for a body embedded
in the other wisp and 4.5 s into a straight run, and was lost within a second of any real change (a drive starting or
stopping, a tear). Negative identity is legible: the same white with a dark pulse through it, the word on the HUD, and a
body lying on the burner visibly whole and visibly hurt; whether a player reads "stable and wrong" rather than "damaged"
is untested on a phone. What is missing: a stop from a fast run tears the tail and the far-cell rule makes it a part,
so the fourth status in `settle` is late or absent and the player is told "moratorium" for something that feels like
arrival; diffusion has no scenario that produces it (the `hold` exhaustion no longer reproduces on main); the harm
measure does not see the friend, so the enmeshed pair reads as plain achievement, which is right for Marcia and wrong for
the codependence story until the friend has a problem of its own (section 14); and the status is still the body's, not a
region's, so a body with one lobe in the heat and one in the cold gets a single verdict.
