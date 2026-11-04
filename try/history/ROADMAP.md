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

## Identity experiment 5: history — 2026-11-04, branch `ident-5-history`

The model (`#ident=history`, the default on this branch; `#ident=centroid` is the baseline): `q` is what the matter has lived
through. `q.x` heat lived (species heat and the body's exposure channel), `q.y` cold lived, `q.z` current lived (gas speed at
the cell), `q.w` ore (+) or charge (−) carried, each a running mix per substep that takes experience in quickly (0.012, about
half a second) and forgets slowly (0.0005, about ten seconds), so recent experience counts most and the past is kept. Affinity
is similarity of pasts: `identCohere` scales the cohesion a cell feels by `0.25+0.75/(1+4|q−q̄|)` against the self-weighted
mean past of its four neighbours; `identWeight` gives a cell to its nearest centre unless the other wisp's mean past fits
clearly better (by more than a third of the gap between the two wisps' pasts, never less than 0.12) and that wisp is within
20 cells of being nearest, hard either way, so centres cannot merge (soft membership drags the other wisp along: the
codependence failure of experiment 1); `identDrive` makes a cell the past gives to the other wisp follow that wisp's intention,
and scales any wisp's attention by how clearly the cell's past matches that wisp's over the other's (floor a quarter); when the
two wisps' mean pasts differ by less than 0.1 all of this falls back to distance. `identTint`: red for heat lived, blue for
cold, pale for current, gold for ore, cyan for a charge. Each wisp's mean past is measured on the CPU (`IDENTS.history.tick`)
from a new q probe (`SH.probe3`, a 6×5 grid five cells apart round each wisp, slots 0..29 you, 30..59 the other), over the
cells the model itself gives that wisp, and handed to the shaders as `uHistC[3]`/`uHistN[3]`; `uC/uCN/uDirs` moved into
`SH.head` so the hooks see every centre. Lab additions: rows carry `q` (mean past of each body, the difference `d` between
them, each body's core-to-edge difference `e0`/`en`, the other wisp's mass in your grid `othIn` and yours in its `mineIn`);
`#pex=` gives the player's spawn a heat past (exposure stamped into the injected cells, a test hook like `#pay`) and `#ppay=`
gives only the player's spawn ore, so the two wisps can start with different pasts in a box where nothing else happens to them.

A scaffold finding that cost most of the day: the body moves by an upwind flux below half a cell a substep, so the Q
texture's semi-Lagrangian look-back never moves `q` off its texel; a moving body walks into its own low-density halo, whose
texels hold stale `q`, and loses its past in about a body length (a stamped heat past of 0.5 was at 0.02 after 60 ticks of
motion; the same stamp on a resting body held). Exposure (`uB.z`) has the same flaw. On this branch the history model carries
`q` with the matter's own flux: what stays keeps its past, what arrives brings its own, mixed by mass; the numerical exchange
that smooths the body is left out, so pasts do not blend across an interface at rest, only where matter actually flows across
it. With that, a body drifting at 9 cells per 30 ticks holds a past of 0.46 at 0.38 after 2 s, and one travelling at 15 cells
per 30 ticks is diluted by its halo to 0.11 (a first version that followed the smoothing exchange too made the two bodies' pasts
converge in 2.5 s of contact: the medium mixes, so a boundary by history can only last as long as matter takes to mix).

`#lab=enmesh2&npc=170,60&warm=300&n=900` (press 2.5 s at 0.7, hold inside 5 s, pull away 4 s at 0.7, rest): the two wisps
spawn in the same still gas, so with no hook their pasts are the same and the model has nothing to work with; the `pex=1`
column gives the player a heat past, the `ppay=0.7` column ore. The baseline is bit-identical with or without either hook
(neither has physics outside the history hooks). main / other / otherDist:

| t | baseline | history (same pasts) | history, heat past (`pex=1`) | history, ore (`ppay=0.7`) |
|---|---|---|---|---|
| 90 | 139 / 176 / 8 | 135 / 177 / 8 | 122 / 201 / 7 | 150 / 142 / 7 |
| 150 | 163 / 159 / 35 | 162 / 158 / 36 | 180 / 149 / 18 | 171 / 140 / 29 |
| 300 | 162 / 160 / 38 | 163 / 161 / 38 | 168 / 158 / 16 | 162 / 160 / 31 |
| 450 | 160 / 156 / 30 | 161 / 158 / 33 | 162 / 156 / 25 | 160 / 154 / 24 |
| 690 | 128 / 157 / 141 | 142 / 157 / 139 | 71 / 160 / 145 | 106 / 159 / 143 |
| 900 | 159 / 161 / 134 | 161 / 160 / 131 | 161 / 161 / 136 | 159 / 161 / 135 |

Masses are the reduction's centre weights (the swing at t=90 is assignment while the bodies overlap, not cells moving); the
drop at t=690 is the box's left wall at x=20 in every run, and the heat-past body reaches it 60 ticks sooner because its
pull-away starts 40 cells nearer the wall (from x=149 instead of 189), so it is crushed longer.

Against the four criteria, for the heat-past run (the same-pasts run is the baseline to within two cells in every column):
1. *Overlap, no repulsion.* The player reaches the other wisp's centre (otherDist 7 at t=90, 5 at t=120) and, instead of the
   baseline's pass straight through (35 by t=150), stays inside it: the press ends at 18 and the pair stays entangled at 15–21
   cells for the whole 5 s hold, with 46–60 of the other's mass in the player's grid and 9–65 of the player's in its. The ore
   run passes to 29 and holds at 24–31.
2. *No taking.* After parting 161 / 156 (t=480–600) against 162 / 161 before contact (baseline 160 / 157); ore run 159 / 161.
   While entangled the other wisp's centre moved 1–3 cells per 30 ticks, as in the baseline. Steerability (player centroid per
   30 ticks under the scripted drive): alone, pressing +15/+12 and pulling −20…−24 in every run; entangled on the press
   (t=120, 150) baseline +21/+17, history same pasts +21/+17, heat past +9/+13, ore +15/+15. The attention of the heat-past
   body is answered at about half while it is inside the other wisp: its cells that have flowed through the other's texels
   have hybrid pasts and answer weakly, and the other's cells near its centre answer the other's (zero) intention, not yours.
3. *Loss.* Fades 0 in every run, no mass lost at the interface (both bodies flat at 156–168 through the hold); the only loss is
   the wall.
4. *Learning together.* Mean |Δq| between the bodies: heat past 0.345 before contact (t=30), 0.34 at first contact (t=90),
   0.054 inside (t=150), 0.03–0.08 through the hold, 0.03 after parting (t=480–600), against a body's own core-to-edge
   difference of 0.001–0.03 (player) and 0.003–0.04 (other) at those times: after parting the two bodies are as alike as a
   body's core is to its own edge, and they got there by exchanging matter (the other's mean heat lived rose 0.01 → 0.10 while
   the player's fell 0.35 → 0.15), not by both forgetting. Then the box separates them again: the player ends in the cold corner
   (cold lived 0.27, current 0.40) and the difference is 0.31 at t=900. Ore: 0.42 → 0.24 at t=150 → 0.20 through the hold →
   0.27 at the end, the other wisp keeping ore lived 0.13–0.24 because the ore itself diffused into it.

`ledge`, `commit`, `hold` (no other wisp, so only the cohesion rule and the carried past act):

| scenario | baseline | history |
|---|---|---|
| `ledge` warm=900 (testing the waters) | 118→81 torn in the first 2 s, held 81–86 for 13 s, regrew to 161 after release | identical: 118→81 torn in the first 2 s, held 81–86 for 13 s, no part tracked, regrew to 161 after release |
| `commit` (commitment) | the whole self carried by the jet, x 84→389 at mass 160; one part torn at t=120, faded by t=180 | the whole self carried, x 84→390 at mass 156–163; one part torn at t=120 (73 cells away) faded by t=180, and a second small one at t=480–510 (26–28 away) faded by t=540 |
| `hold` (holding is work) | carried 36 cells downstream in the first second, stamina 1→0.71 at t=90, pushed out of the band, effort 0.3–0.38 | identical to within a cell: carried 36 cells downstream in the first second (x 160→196→230), stamina 1→0.71 at t=90, pushed out of the band, effort 0.3–0.4 when it pushes again at t=390–450, never dissociated |

What was produced: a past that travels with the matter and can be read (gold, red, blue, pale), an entanglement that lasts
when the pasts differ (the pair stays inside each other for the whole hold instead of passing through), no taking either way,
no loss at the interface, attention answered at half by matter whose past is hybrid, and a shared history that is really
shared: after a contact the bodies are as alike as core and edge, because matter was exchanged. What was not: a boundary that
outlasts the mixing. In this medium matter flows across an interface in a second or two and the past goes with it, so two
pasts that differ by 0.35 are 0.05 apart after 2.5 s inside each other and the model is back to distance for the rest of the
hold; a hybrid interface that belongs to neither and thins was not seen (no fades), and with no hook the lab's two wisps have the
same past and the model is the baseline. The experiment's premise holds in the game only where the structure gives wisps
different lives (the player comes through fire and current, the waiting wisp has sat in its chamber), which the enmesh box
does not; and the heat-past body paid for its difference at the wall, since a body whose parts have lived differently is
held together less.
