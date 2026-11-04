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

## Identity experiment 6: agreement — 2026-11-04, branch `ident-6-agreement`

Bounded-confidence opinion dynamics (Hegselmann–Krause), no identity tag. `q.xy` is a cell's *stance*, a preferred direction
with a magnitude. Each substep a cell averages its stance with the eight neighbours two cells away whose stance is within a
tolerance of its own (0.4 in stance space, four times wider for a cell in its first second of life, so the newly grown take
their bearings from whoever is around them), firm neighbours counting more; and it is pulled toward the drive the wisps it
belongs to give it: fast (~0.3 s) when that drive is roughly what it already holds, slowly (~1 s) when it is not, but only
where another wisp is within reach (its centre within ~25 cells, fading out by 45); alone, a cell adopts any drive in ~0.3 s.
A silent centre leaves the stance to fade over ~10 s, so rest is a stance too. `q.z` is how much of the neighbourhood agrees with the
cell (cohesion scales with it, and cohesion never climbs into matter that disagrees), `q.w` firmness. `identWeight` keeps the
nearest-centre split except that a wisp (you, the other) claims a cell whose definite stance agrees with that wisp's stance
(its cells' measured mean stance, pulled to its drive) *better* than the nearest centre's, times proximity over ~10 cells;
undecided or mixed cells stay with the nearest centre, past lives claim nothing, so the centres cannot merge. `identDrive`
follows the drives of the wisps the cell belongs to, fully when the drive is within (a loose) tolerance of the stance, at 45 %
otherwise, again only where another wisp is within reach. Tint: hue by stance direction, saturation by magnitude. Scaffold changes: `uC/uCN/uDirs`, `uSpot/uFriend` and a new
`uStanceC[3]` live in `SH.head`; a third probe target (`probe3`, async like the other two) reads `q` at the probe points, and
`IDENTS.agreement.tick` turns the 9×7 grid round the player into each live centre's mean stance; the lab rows carry `qd`
(mean-stance distances) and `ox,oy` (the other wisp's position). Based on `2208a79`, before main's allegiance-memory baseline
(`b86fda0`), which also uses `q.w` and moves the same uniforms: merging needs a hand.

Three earlier versions on the way: pulling the stance toward the *nearest* centre's drive converted your cells to the other
wisp's stance when you were deep inside it (113/207 at t=90); pulling toward the membership-weighted drive without gating
claims fed back on itself (97/250); gating claims by stance confidence and adopting out-of-tolerance drives slowly fixed the
accounting but made a body at rest answer a new drive at half speed for a second even with nobody near, so `commit` tore it
in two (72 stayed above the jet, a 90-cell part was carried off and faded). Applying the tolerance to the drive only where
another wisp is within reach gave the numbers below.

`#lab=enmesh2&npc=170,60&warm=300&n=900` (press right 2.5 s, hold inside 5 s, pull left 4 s, rest; the pull ends on the box wall at x≈25 from t≈690):

| t | baseline main / other / dist | agreement main / other / dist | other wisp x, baseline → agreement | centroid moved per 30 ticks, baseline → agreement |
|---|---|---|---|---|
| 30 | 163 / 160 / 30 | 163 / 160 / 30 | 173 → 173 | 15 → 15 (alone, approaching) |
| 90 | 139 / 176 / 8 | 145 / 171 / 8 | 173 → 175 | 12 → 11 (entangled) |
| 150 | 163 / 159 / 35 | 157 / 170 / 30 | 173 → 173 | 17 → 19 (entangled, end of the push) |
| 300 | 162 / 160 / 38 | 163 / 160 / 31 | 166 → 166 | 2 → 2 (no drive, both drift with the box's return flow) |
| 450 | 160 / 156 / 30 | 162 / 156 / 24 | 165 → 165 | 2 → 3 |
| 690 | 128 / 157 / 141 | 133 / 159 / 141 | 165 → 165 | 15 → 16 (on the wall) |
| 900 | 156 / 160 / 130 | 160 / 161 / 135 | 165 → 165 | 3 → 3 (resting) |

Pull-away, cells per 30 ticks from t=450: baseline 18, 21, 21, 21, 22, 23, 23; agreement 11, 18, 21, 20, 22, 22, 23. (The
other wisp's x comes from a second baseline run with the `ox` column; its first run matched it row for row.)

- Overlap: yes, as in the baseline the 2.5 s push carries you through the other wisp (dist 8 at t=90) and out the far side;
  nothing repels.
- No taking: after parting 160 / 161 against 163 / 160 at the start (baseline 156 / 160). While entangled the accounting
  swings *less* than the baseline's (145/171 at t=90, 157/170 at t=150, against 139/176 and 163/159). The other wisp's
  centre moves 173 → 165 over the run in both models: the baseline does not drag it either (its homing drive holds it), so the
  difference the model makes here is in whose cells answer whose drive, not in where the other wisp ends up. Its resting
  cells hold "rest" as a stance, are out of tolerance with your drive, and follow it at most weakly.
- Steerability: alone 15 cells per 30 ticks, entangled 11–19 during the push (baseline 12–17), i.e. the same. The one cost is
  the first second of the pull-away while still inside the other wisp: 11 against the baseline's 18, because your cells' stance
  (still pointing right) is out of tolerance with the new drive and adopts it over ~1 s; from the second half-second on it is
  the baseline's speed (18–23).
- Loss: none in this scenario (fades 0, both masses flat), as in the baseline.
- Learning together: in contact, yes; after parting, no. The mean-stance distance between the bodies is 0.74 before contact
  (t=30; you at (0.74, 0), it at rest), falls through the hold from 0.89 (t=150) to 0.27 (t=450) — within the tolerance, the
  two are enmeshed — and jumps to 1.5 the moment you drive away (your stance flips to (−0.9, 0), its stays (0.55, 0.1), its
  homing drive). At t=900 it is 0.63, against 0.00–0.1 between a body's own centre and its edge. The stance tracks the current
  drive, so what was shared in contact is not retained once the drives differ; `q` records the present, not the past.

`ledge`, `commit`, `hold` (same code; the baseline hold row is a fresh run on this base, the others from the Lab outcomes table above):

| scenario | baseline | agreement |
|---|---|---|
| ledge (testing the waters) | 68 of 162 torn in 2 s, the rest held at the ledge and regrew to 135 | 80 of 162 torn in 1 s (carried off and faded, never tracked as a part); the rest, 82–87, held against the ledge for the whole 7.5 s of drive without regrowing, slid 3 cells, and regrew to 161 within 2.5 s of letting go |
| commit | the whole self carried by the jet (~160 cells at full mass) | the whole self carried (cx 84 → 318 in 5 s at 157–164 cells; a ~15-cell wisp briefly tracked behind it and faded) |
| hold (holding is work) | swept 100 cells downstream in 1.5 s (effort 0.98, stamina 1.0 → 0.71), drifted below the jet, came back into it twice, held with effort 0.2–0.35 at stamina 0.72–1.0, never dissociated | identical row for row (mass, position, stamina, effort all within 1): with no other wisp within reach the model changes nothing a lone body does |

What was produced: a boundary that holds under the push *without* repulsion and without sluggishness. The other wisp's cells
keep "rest" as a stance, are claimed by nobody and follow your drive only weakly; the accounting swings less than the
baseline's while you are inside it; and alone you move exactly as before, which the first three versions did not manage.
Against the baseline the visible difference in this scenario is small (the baseline's other wisp is not dragged either): the
model's work shows in the accounting and the one-second lag of a turn while entangled, not in the masses or positions. What was not produced: cells that learn from each other and keep it.
The stances meet within tolerance during the hold and part the moment the drives differ, because a stance is a disposition
toward the present drive, not a history; and the boundary is still passed straight through, since one `q` per cell cannot
hold two opinions where two bodies share a cell. Loss at the interface did not appear in this scenario at all.
