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

## Identity experiment 9: parts — 2026-11-04, branch ident-9-parts

**The model** (`#ident=parts`, `uIdent==9`; hooks in `v2/shaders.js`, CPU half in `v2/ident.js`). `q.xyz` is a role grown
from what the cell lived through, never assigned: **protector** `q.x` grows while the cell's exposure (`uB.z`, the heat it
has lived through) is high (~2 s of real burning makes one, it fades over a minute); **manager** `q.y` grows while the cell
is calm (its own velocity below swimming speed, no heat, inside its body: ~3 s to form, undone by agitation over ~10 s);
**exile** `q.z` grows while the cell is being lost (withering far out, burning, eaten: `uB.y/uB.x`, metabolism does not
count) and stays if the cell survives. Parts act: protectors take 60% less heat damage and swim toward heat that is near
(stopping short of the flame); managers cohere 1.6x and swim 30% slower; exiles are reinforced 1.6x inside the body and
fade at 0.6%/substep when their neighbourhood is thin. The baseline `q.w` allegiance channel is **kept**, with one change:
its relaxation rate is scaled by `1-0.98*smoothstep(0.15,0.5,max(q.xyz))`, so roleless matter changes hands as in the
baseline (a third of a second) and a part hardly does (~15 s). A part of the other wisp inside you therefore keeps its
allegiance, follows their drive and not your attention, and the CPU counts it as a burden (cells in the 6x5 grid round
your centre whose allegiance is not yours) that drains stamina at 0.0001/cell/tick. `identTint` shows protector ember,
manager indigo, exile rose, muted on the other wisp's cells. `identWeight` stays hard (no soft membership). New plumbing:
`uBq`/`uSq`/`uRfarQ` in `SH.head` for the hooks, a `probe3` q grid round each body (`SIM.probeBuf3`), `measureQ` rows in
the lab (`q.d` mean |Δq.xyz| between bodies, `e0/en` core vs edge, `othIn/mineIn`, `role0/rolen` fractions by dominant role
> 0.3, `burden`).

**enmesh2** (`#lab=enmesh2&npc=170,60&warm=300&n=900`): t, main / other / otherDist, baseline (`#ident=centroid`) vs parts.

| t | baseline main/other/dist | parts main/other/dist | parts: burden, stamina | parts: other's manager fraction | mean Δq.xyz between bodies |
|---|---|---|---|---|---|
| 30 | 155/156/30 | 155/156/30 | 0, 1.00 | 0.00 | 0.11 |
| 90 | 71/197/8 | 66/215/8 | 162, 0.96 | 0.17 | 0.20 |
| 150 | 133/139/24 | 129/153/21 | 61, 0.90 | 0.81 | 0.37 |
| 210 | 141/140/28 | 139/147/24 | 16, 1.00 | 0.39 | 0.09 |
| 330 | 143/138/22 | 143/141/19 | 6, 1.00 | 0.86 | 0.23 |
| 450 | 140/131/20 | 140/133/21 | 0, 1.00 | 0.99 | 0.38 |
| 510 | 138/128/43 | 139/133/50 | 0, 1.00 | 0.90 | 0.52 |
| 630 | 132/130/128 | 132/134/135 | 0, 1.00 | 0.59 | 0.47 |
| 690 | 59/137/145 | 59/142/145 | 0, 1.00 | 0.84 | — |
| 900 | 134/140/135 | 133/143/138 | 0, 1.00 | 0.93 | 0.40 |

(The drop to 59 at t=690 is the pull-away carrying the player into the box wall at x=21 in both runs, not the interface.)
Centroid displacement per 30 ticks under the scripted drive: press 14/9/12/15 (parts) vs 14/10/14/15 (baseline); pull-away
−19…−24 in both. Mean manager role of the player's cells peaked at 0.20 during the hold (the pair drifts left with the
return flow at 3–5 cells per 30 ticks, so its cells are never calm by the model's measure) against 0.58 for the other wisp,
which swims against the drift to hold its place and so becomes a manager body (0.99 of its cells by t=450).

**The four criteria.**
1. Overlap is normal — **produced**: the bodies interpenetrate to 8 cells apart at t=90 in both runs; nothing repels.
2. No taking — **produced, but by the baseline**: after parting 133/143 (parts) vs 134/140 (baseline), both within noise
   of the 155/156 start. While entangled the other's cells did not answer the player's attention (steerability 14/9/12/15 vs
   14/10/14/15 per 30 ticks, the same as alone-and-pressing in the baseline); what the model adds is that the other's
   manager parts kept their allegiance ~4 s longer (other = 153 at t=150 vs 139 baseline, 147 vs 140 at t=210), and the
   player paid for carrying them: stamina 1.00 → 0.90 by t=150 (baseline stays at 1.00), back to 1.00 by t=210.
3. Loss allowed — **produced (none at the interface)**: `fades` 0 in both runs; the 155 → 66 at t=90 is allegiance of
   roleless matter flipping to the nearest centre, as in the baseline (71), and it reverses by t=150.
4. Learning together — **not produced**: mean |Δq.xyz| between the bodies 0.11 at t=30 and 0.40 at t=900, against a
   core-vs-edge difference of 0.00–0.13 in the player and 0.02–0.32 in the other. Roles are made by how a body lives (one
   held its place and became managers, the other drifted and swam), so contact drives them apart, not together.

**Roles in a normal run.** `#lab=ledge&warm=900` (parts): 109 → 78 cells by t=60 (31 torn into the jet and faded), held at
78–85 against the ledge for 450 ticks, regrew to 130 by t=600. Role fractions (dominant role > 0.3) of the player's cells:
t=90 manager 0.68 / none 0.32; t=120–450 manager 1.00 (pressed against the ledge the cells do not move, so the whole body
becomes managers); t=480–540, after the drive stops and the body regrows, none 1.00 (the managers dissolve as the body
moves and regrown matter has no history); t=600 manager 0.82 / none 0.18. Protector 0 and exile 0 throughout: there is no
heat at the ledge, and torn matter dies rather than returning, so no cell survives being lost.
`#lab=commit` (parts): the whole self is carried 83 → 384 cells in x at 137–141 mass through t=270 and 128 at t=480;
a piece torn at t=120 (88 + a part) rejoined by t=150 and its survivors showed as the run's only exiles (0.55 of the cells
in the grid at t=120, diluted below the 0.3 threshold after rejoining); a second part split at t=510–600 (120 → 71 → 96).
`#lab=hold` (parts): effort 0.98 → 0.2 as the jet carries the body out of the band (x 196 → 273, inJet 113 → 0 by t=60),
stamina 1.00 → 0.71 by t=90, back to 1.00 by t=180, 0.69 at t=540; mass 153 → 140–145 throughout, no scatter; the baseline run of the same scenario (`#ident=centroid`) gives 153 → 140–143 and stamina
0.87/0.76/0.71/0.76/0.90 at t=30–150 and 0.68 at t=540, the same within 1–2 cells and 0.01 at every row. Tearing,
commitment and holding are unchanged, which is expected: a body that is swimming grows no parts in these scenarios (role
fractions none 1.00 through nearly all of commit and hold; manager 0.30 at one row of hold and 0.25–0.39 once the drive
stops).
`#lab=burn&warm=900` (new scenario, parts only: spawn on the burner, leave, come back): the fire makes roles and kills the
body in the same second. Survivors at t=30 (39 cells) had mean protector 0.16 and exile 0.60 (0.94 of cells exile-dominant:
burning registers as being lost), at t=60 (2 cells) protector 0.32 and exile 0.82; by t=90 nothing was left, and the body
that respawned at t=330 had no history (none 1.00). An earlier spawn 30 cells above the burner never saw heat (mass
153 → 135, exposure 0). The lab box has no survivable heat, so protectors leading toward fire and resisting it is
implemented but unverified by numbers.

**What the model does not produce.** A boundary during the press: the bodies pass into each other exactly as in the
baseline (dist 8 at t=90, masses within 5 cells of the baseline at every row), because a body that is swimming has no
parts yet and roleless matter mixes like fluid; the parts only hold what calm, fire or survival have already made. Nor
learning together. Protectors and exiles do not appear in the four standard scenarios (no heat, no survivors of loss), so
the only part the lab exercises is the manager; the stamina burden is real but small (0.10 over 2 s of full enmeshment).
