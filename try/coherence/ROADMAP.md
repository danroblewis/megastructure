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

## Identity experiment 1: coherence — 2026-11-03, branch `ident-1-coherence`

The model (`#ident=coherence`, the default on this branch; `#ident=centroid` is the baseline): `q.xy` is a slow habit of the
cell's own motion (velocity x6, mixed at 0.012 per substep, about half a second), `q.zw` a quarter-second memory of the drive
its centre gave it. Cohesion is scaled by agreement between the cell's habit and the habit of what it climbs toward (a still cell
and a moving one disagree; floor 0.3) and by agreement with its centre's drive (overall floor 0.2). Membership in a centre: a
resting cell belongs to its nearest centre as in the baseline; a moving cell belongs to the centres whose drive it has been moving
with (a centre asking for rest disagrees with a moving cell), within a band 4..20 cells past the nearest centre, normalised.
Steerability is 40%..100% of the drive by agreement between habit and drive. Tint: hue by habit direction (right red, down
yellow-green, left cyan, up violet), saturation by habit strength. Scaffold changes: `uC/uCN/uDirs` moved into `SH.head` so
`identWeight` can see the drives; `SH.probeQ` / `SIM.probeQ` / lab `qstat` sample q at t=30, 540, 900; rows carry `ox,oy`.

Enmesh (`#lab=enmesh&npc=170,60&warm=300&n=900`), main / other / otherDist:

| t | baseline | coherence |
|---|---|---|
| 90 | 128 / 193 / 12 | 132 / 188 / 12 |
| 240 | 161 / 160 / 74 | 162 / 160 / 73 |
| 540 | 162 / 157 / 77 | 162 / 157 / 75 |
| 720 | 158 / 160 / 44 | 160 / 159 / 46 |
| 900 | 66 / 160 / 145 | 72 / 160 / 145 |

The scripted 4 s press passes clean through the other wisp in about 2 s (t≈75–140) and the 5 s "hold inside" happens 73 cells past
it; the pull-away crosses it again (t≈630–690); the mass loss at t=900 is the box's left wall at x=20 in both runs. The swap at
t=90 (132/188) is the reduction's assignment while the bodies overlap, not cells moving.

- Overlap: produced, no repulsion (both pass through).
- No taking: masses after parting 162/160 against 163/160 before contact (baseline 161/160). The other wisp's centroid moves
  0.0/3.2/4.0/3.2 cells per 30 ticks during the first contact (baseline 1.0/4.1/4.0/3.2) and 0–1 during the second pass (both).
- Steerability (player centroid displacement per 30 ticks under the scripted drive): alone 14.0–15.1 for both; entangled on the
  first pass (t=90/120/150) baseline 12.0/17.5/17.0, coherence 12.0/15.3/19.1; second pass 19–20 for both.
- Loss: none measurable outside the wall.
- Learning together (self-weighted mean q over a 3x3 core and a 12-point ring at r=8 of each body; |Δq| over four channels, habit
  xy alone in brackets, against the core–edge difference within a body): before contact t=30: 1.09 (0.46) vs 0.09/0.19; resting
  apart t=540: 0.31 (0.18) vs 0.22/0.07; after parting t=900: 1.44 (0.12) vs 0.07/0.08. The habit difference after parting is down
  at a body's own core–edge level, but because both bodies are near rest then, not because of the contact; `q.zw` differs by
  construction (what each centre asks). This q carries no shared history. Baseline q (scaffold example): 1.02 / 0.23 / 0.44.

Ledge, commit, hold, both models rerun on this code (the 2026-11-02 table predates payload and other wisps):

| scenario | baseline (centroid) | coherence |
|---|---|---|
| `ledge` warm=900 | 118→81 torn in the first 2 s, no part tracked, held 81–86 for 13 s, regrew to 161 after release | 118→84, held 84–87, regrew to 160 |
| `commit` | carried x 84→389 at mass 160, one part torn at t=120 faded by t=180 | identical |
| `hold` | carried 36 cells downstream in the first second, stamina 1→0.71 at t=90, pushed out of the band, effort 0.3–0.38 | identical to within 1 cell / 0.01 |

What was produced and what was not. A first version with soft membership (50/50 when habit and drive said nothing) collapsed both
centres onto one point at t=270, after which every cell was "nearest" to centre 0 and the other wisp was dragged 190 cells along
with the player, equal masses, both moving 22 cells per 30 ticks: the codependence failure, and a hazard of any soft membership in
the centre reduction. The delivered version (rest → nearest centre; motion → agreement with the drive; still against moving counts
as disagreement) is indistinguishable from the baseline in all four scenarios to within noise: no boundary beyond what distance
already gives, no taking but none in the baseline either, steerability kept because it was never reduced where it mattered; the
habit tint is the one visible product. The reason is that the habit only registers for cells that swim or are carried, the drive
is the same for every cell of a body, so habit agreement carries no more information than nearest-centre does, and the still/moving
disagreement at the interface lasts only the two seconds a pass-through takes. The experiment's claim (parting wisps leave averaged
habits that belong to neither) needs a scenario where the wisps actually stay inside each other, which this enmesh script does not
produce, and a cohesion cut strong enough to matter, which the first version showed costs the centres their separation.
