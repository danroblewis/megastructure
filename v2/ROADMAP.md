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
| phase (4) | none that lasts (pair holds while rhythms differ, then locks) | yes | kept | **yes**: rates converge in contact and the shared rate survives parting | learning together produced; a boundary only while the rhythms differ |
| history (5) | lasting overlap: pair stays 15–21 apart through the whole hold instead of passing through (needs differing pasts; with a shared past it is the baseline) | yes (161/156 after) | kept alone; hybrids at the interface answer at half | **yes**: Δq 0.345 → 0.03 after parting, the other's heat-lived rose 0.01 → 0.10 by exchanging matter | the first model to give both overlap-not-passing and learning together; pasts converge in 2.5 s of contact so the boundary does not outlast mixing |
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

## Identity experiment 7: return — 2026-11-04, branch ident-7-return

**The model** (`#ident=return`, uIdent 7; hooks in `v2/shaders.js`, registered in `v2/ident.js`). Identity is what comes back.
`q.x` seconds a cell has been away from home (home = within rnear of its *own* centre; beyond rfar time runs 4x: there is no
return from there). `q.y` bond: a cell that returns after an excursion is kept and strengthened (+0.3·min(1, away/window));
it relaxes toward 0.5 at home over a minute; at home cohesion is ×(0.8+0.5·bond). `q.z` patience: the window (2 s to start),
learned from the cell's own returns (toward twice the excursion it waited through) and averaged with its neighbours at 0.5/s,
so a body learns together how long to wait; it drifts back to 2 s. `q.w` home: the baseline allegiance channel kept, but it no
longer moves by nearness. It is a conserved label carried with the matter: the body pass moves it mass-weighted with the
upwind flux and the 0.03 diffusion (a gated block in the flux loop), it settles toward the body a cell sits in only where no
other body's home overlaps, and it changes otherwise only when a cell has given up on returning (away past 1.6× its window, or
home beyond rfar) while sitting inside another body's home: adopted there, weak (bond 0.2). A cell that gives up anywhere else
fades at 0.985/substep even inside rfar (new hook `identKeep`, 1.0 for the baseline, one line in the body pass), stops
answering its drive (`identDrive`) and lets go (`identCohere`); an excursion starts at 0.6× cohesion and tightens to 1.2× as the
window runs out. Membership (`identWeight`) stays hard by owner. Tint: an excursion darkens toward violet as its window runs
out; what has come back glows gold. Hook signatures unchanged; `uRnear`/`uRfar` moved into `SH.head`. Lab: `SIM.readBQ()` and
`ctx.qstat()` put per-body mean q, per-channel Δq, core-vs-edge Δq and the mass of each body inside the other on every row.

**Why the label travels with the mass.** The first run (label fixed to the cell, nearness never touching it) swapped the two
bodies wholesale: main 155→15 while the other rose to 269 by t=120, then 280 vs 23 by t=360, then dispersal into the jet. The
body pass exchanges mass label-free (upwind flux plus 0.03 symmetric diffusion, ≈0.45 units/substep across a 30-cell interface,
≈120 units in 1.5 s), and the baseline only hides that because nearness relabels the matter as it goes. With a sticky label the
label must be a conserved quantity of the matter, so now it is.

**enmesh2** (`#lab=enmesh2&npc=170,60&warm=300&n=900`): press 2.5 s at 0.7, hold 5 s, pull away 4 s at 0.7, rest.

| t | baseline main/other/dist | return main/other/dist | return: mean (away s, bond, patience s) mine · other | mine in other / other in me |
|---|---|---|---|---|
| 30 | 155/156/30 | 155/156/30 | (0.00,0.40,2.00) · (0.00,0.40,2.00) | 0 / 0 |
| 60 | 115/182/16 | 149/149/15 | (0.00,0.40,1.99) · (0.00,0.40,2.00) | 18 / 0 |
| 90 | 71/197/8 | 119/132/6 | (0.00,0.40,2.00) · (0.00,0.40,2.00) | 30 / 30 |
| 120 | 83/181/12 | 138/93/16 | (0.00,0.40,2.00) · (0.00,0.40,1.99) | 4 / 5 |
| 150 | 133/139/24 | 145/107/30 | (0.00,0.41,1.95) · (0.00,0.40,2.00) | 0 / 0 |
| 180 | 137/140/26 | 148/116/32 | (0.01,0.41,1.95) · (0.01,0.40,2.00) | 0 / 0 |
| 240 | 143/139/28 | 149/123/36 | (0.02,0.41,1.96) · (0.04,0.42,1.92) | 0 / 0 |
| 300 | 143/139/25 | 148/127/33 | (0.01,0.42,1.94) · (0.24,0.42,1.93) | 0 / 0 |
| 360 | 142/137/21 | 148/123/28 | (0.01,0.43,1.87) · (0.49,0.43,1.91) | 0 / 0 |
| 420 | 141/133/20 | 147/103/27 | (0.04,0.46,1.77) · (0.34,0.44,1.89) | 0 / 0 |
| 480 | 139/130/27 | 145/105/19 | (0.02,0.49,1.61) · (0.19,0.45,1.89) | 0 / 0 |
| 540 | 136/128/62 | 143/114/45 | (0.03,0.50,1.57) · (0.14,0.45,1.89) | 0 / 0 |
| 600 | 135/129/106 | 141/120/86 | (0.05,0.49,1.58) · (0.10,0.44,1.90) | 0 / 0 |
| 660 | 100/132/141 | 138/125/130 | (0.04,0.49,1.61) · (0.02,0.44,1.91) | 0 / 0 |
| 690 | 59/137/145 | 98/128/142 | (0.00,0.49,1.60) · (0.03,0.44,1.91) | 0 / 0 |
| 720 | 80/141/143 | 111/132/141 | (0.01,0.46,1.71) · (0.01,0.44,1.90) | 0 / 0 |
| 780 | 118/142/139 | 131/135/139 | (0.02,0.49,1.61) · (0.01,0.44,1.90) | 0 / 0 |
| 840 | 131/141/137 | 136/135/137 | (0.05,0.47,1.69) · (0.02,0.44,1.90) | 0 / 0 |
| 900 | 134/140/135 | 137/136/134 | (0.10,0.46,1.73) · (0.01,0.43,1.91) | 0 / 0 |

(The drop at t=660–690 in both runs is the pull-away ending on the box wall at x≈24; both regrow.)

Against the four criteria:

1. **Overlap is normal — produced.** The centres come within 6 (baseline 8) at t=90 with 30 units of each body inside the
   other; nothing repels. As in the baseline the press carries the player straight through and out the far side (cx 204 vs
   the other at ~170 by t=150), so the 5 s "hold" is spent 26–36 apart: this model gives no spatial boundary.
2. **No taking — produced at the end, with a transient.** After parting 137/136 (baseline 134/140). During the passage the
   other lost 39 while the player gained 19 (t=90→120: 132→93 vs 119→138), i.e. ≈19 units of its matter crossed the interface
   with a mixed label and stayed; the baseline instead swaps 84 symmetrically and reverses it. Steerability is kept: the
   centroid moves 13–17 cells per 30 ticks pressing through the other wisp (baseline 10–15) and 20–22 pulling away alone
   (baseline 20–23); nothing is sluggish.
3. **Loss is allowed — produced.** At the deepest overlap the pair totals 251 (baseline 268) of 311; after the passage the
   other's cells displaced out of its home (mean away 0.49–0.51 s, a quarter of its cells on excursion at t=360–390) fade:
   127→102 over t=330–450 while the player holds 148; it regrows to 136. Reported as loss, not transfer: the player's mass does
   not rise while it happens.
4. **Learning together — not produced.** Patience is identical before contact (2.00 vs 2.00) and diverges after: 1.73 vs 1.91
   at t=900 (Δ 0.18, against a core-vs-edge Δ inside the player of 0.01 at t=900 and 0.23 at t=450). The shared channel only
   averages where the bodies touch, and the contact was a 1.5 s pass-through; the player's shorter window comes from its own
   returns while moving, not from the other. Bond: the player's rose 0.40→0.50 (returns, strengthened), the other's 0.40→0.44.

**Tearing, commitment, holding** (`ledge&warm=900`, `commit`, `hold`), return vs the main outcomes table:

| scenario | return | main outcomes table (2026-11-02) | verdict |
|---|---|---|---|
| ledge (pressed up against the ledge, lowest rows in the jet, 450 ticks) | 109 at t=30, 78 at t=60 (31 torn in 1 s; no past life formed, the torn matter faded), then the pressed body erodes 78→65 over t=60–420 instead of regrowing: its edge cells have mean away 1.0→5.6 s (core-vs-edge Δaway, never returning, fading inside rfar), bond flat at 0.40; when the press ends it regrows to 133 by t=600 | 68 of 162 torn in 2 s, carried 39 away, faded in ~4 s; the rest held and regrew to 135 | testing the waters still produced (a part is torn, the rest holds); the new cost is that a flattened self's far edges fade while it stays pressed |
| commit (move into the jet after a second, then let it carry you) | 137 → 111 at t=120 (a part splits, bond 0.20 = adopted stranger, a past life that fades by t=150) → 147–154; carried from x=83 to x=382 by t=600 at mass 132–154; bond 0.45 after the entry (returns), patience 1.76→2.0 | carried ~160 cells at full mass | commitment produced: the whole self rides the jet ~300 cells at full mass |
| hold (inside the jet, push upstream until tired) | effort 0.98 at t=30, stamina 1.0→0.76 at t=60→0.71 at t=90 while the jet pushes the body out (cy 141→153), then it re-enters and the cycle repeats (effort 0.29–0.40 at t=390–450, stamina 0.78); mass 153→137–142, no scatter, no past lives; bond 0.40→0.46 from the re-entries | effort 0.3–0.4, stamina 1.0→0.72 in 2.5 s, exhaustion scatters | holding is work still produced; exhaustion was not reached because the body is pushed out of the jet before draining |

**What the model does not produce.** No boundary in space: the wisps pass through each other exactly as the baseline, because
return is a rule about time, not about place; it will only matter in a long entanglement, which enmesh2 does not produce. No
learning together: the window is shared only through touching neighbours and the contact is too short. And the "never
returns → fades inside rfar" rule barely fires for the player in this scenario (mean away ≤0.10 s), only for the other wisp's
displaced cells; the gold/violet tint shows bond and excursions but excursions are rare for a body that keeps moving as one.
Smoke test `#test=1&n=60&w=1024&h=512&touch=60,0`: title without `Uncaught`, glerr 0, mass 151 (the other 154).
