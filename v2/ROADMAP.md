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

## Identity experiment 3: commitment — 2026-11-03, branch `ident-3-commitment`

Marcia's identity statuses as local regimes, no identity tag. `q.xy` is the intention a cell has committed to; it moves toward
the proposals it receives (its centre's per-cell drive, and what its neighbours hold) over about a second, a foreclosed cell
four times slower. `q.z` is how long (seconds, capped at 4) its commitment has matched what is asked of it; `q.w` how much it
has changed intention over its life. Diffuse = never held, never changed (cohesion 0.6, speed 0.6); foreclosed = long hold,
little change (rigid, speed 1.45); moratorium = changing after having changed (cohesion 0.75, sway); achieved = held after
having changed (cohesion 1.3). `identDrive` follows the commitment 85 % for committed cells, so you steer what has committed
to you; `identWeight` keeps the nearest-centre split except that a wisp (you, the other) claims a cell when its drive agrees
with the cell's commitment *better* than the nearest centre's does, times proximity over ~5 cells; a past life claims nothing.
Tint: grey diffuse, amber moratorium, blue foreclosed, lilac-white achieved. Scaffold changes on the branch: `uC/uCN/uDirs`
live in `SH.head` so every pass (the reduction included) sees every centre's drive; the body pass hands `identUpdate` the same
per-cell attention drive the velocity pass follows; a `probeQ` pass reads `q` at 64 points for the lab (`qd` in enmesh rows).

A first version used a symmetric soft membership (proximity × agreement for every centre). It merged centres: in `ledge` the
torn part's centre crept into the main body (part distance 19→12→8→0 while the drive was straight up) and the past-life rule
withered the body from 155 to 3. The differential form above fixed that; the numbers below are from it.

`#lab=enmesh&npc=170,60&warm=300&n=900` (push right 4 s, hold 5 s, pull left 6 s; from t≈780 both runs hit the box wall at x=20):

| t | baseline main / other / dist | commitment main / other / dist | centroid moved per 30 ticks, baseline → commitment |
|---|---|---|---|
| 90 | 128 / 193 / 12 | 161 / 160 / 26 | 12.0 → 9.1 (alone, approaching) |
| 150 | 164 / 155 / 24 | 147 / 178 / 11 | 17.0 → 8.2 (entangled) |
| 180 | 163 / 158 / 41 | 183 / 136 / 9 | 15.0 → 9.5 (entangled) |
| 240 | 161 / 160 / 74 | 172 / 149 / 24 | 14.0 → 5.1 |
| 540 | 162 / 157 / 77 | 159 / 160 / 30 | 1.0 → 4.0 (no drive) |
| 720 | 158 / 160 / 44 | 159 / 161 / 118 | 20.0 → 18.0 (pulling away) |
| 750 | 159 / 160 / 64 | 160 / 161 / 134 | 22.0 → 16.3 |
| 900 | 66 / 160 / 145 | 85 / 162 / 144 | both crushed on the wall |

- Overlap: yes. The baseline passes straight through the other wisp during the 4 s push (dist 74 at t=240); with commitment the
  push ends on top of it (dist 24, you just above it): its foreclosed cells adopt your proposal slowly and block the way.
- No taking: at t=750 (before the wall) 160 / 161 against 163 / 160 at the start, as in the baseline (159 / 160). During
  contact the membership accounting swings ±25 cells both ways (147/178 at t=150, 183/136 at t=180); the baseline swings once
  (128/193 at t=90). Neither side kept anything after parting.
- Steerability (centroid moved per 30 ticks under the scripted drive): alone 10.2 / 9.1, entangled 8.2 / 8.2 / 9.5 / 8.1, so
  about 80 % of alone (baseline 15 / 12 alone, 17.5 / 17 / 15 entangled, 100 %). The committed body is slower than the
  baseline everywhere (9 vs 15 approaching, 16–18 vs 20–25 pulling away): the statuses take about 2.5 s to ramp up from
  diffuse and the commitment lags a change of drive by about a second. Not produced: the other wisp's cells not answering your
  drive. They answer it slowly (foreclosed cells at a quarter rate, anchored by their neighbours), which is what blocks you.
- Loss: none (fades 0, both masses flat).
- Learning together: not produced. The mean-q distance between the bodies is 0.85 before contact (t=30: intention 0.69, hold
  and change 0.49) and 3.4 after parting (t=750: intention 1.2, hold and change 3.2), against a centre-to-edge distance within
  one body of 0.04–0.4. `q` records what each body has been asked to do, and the two scripts differ; cells that spent the
  contact next to each other did not converge.
- Oddity: during the 5 s hold with zero drive the pair slides left together at ~4 cells per 30 ticks (baseline ~1), and in
  `ledge` the remainder slides left along the ledge under a straight-up drive. Most likely the return flow of the box carrying
  cells whose status leaves them weak (moratorium, diffuse); not confirmed, the lab's `u` probe reads the jet line, not the player.

`ledge`, `commit`, `hold` (same code; the ROADMAP table above gives the baseline):

| scenario | baseline | commitment |
|---|---|---|
| ledge (testing the waters) | 68 of 162 torn in 2 s, the rest held at the ledge and regrew to 135 | 37 of 155 torn in 1 s; the rest did not hold: it shrank to 30 while sliding 40 cells left along the ledge with a part trailing 9–26 cells behind, climbed past the ledge's end at t≈420 and regrew to 160 above it |
| commit | the whole self carried by the jet (~160 cells at full mass) | not carried as a whole: in the 1.2 s of drive only the lower edge reaches the jet; a 64-cell part is torn, carried 147 cells and fades, the other 70 stay above the jet and regrow to 164 |
| hold (holding is work) | effort 0.3–0.4, stamina 1.0→0.72 in 2.5 s, exhaustion scatters | swept 60 cells downstream in the first 2 s before it could commit upstream (stamina 1.0→0.71), then drifted out of the jet, came back and held within ±10 cells at 158–164 for 8 s, stamina 0.85–1.0, never scattered, never dissociated |

Produced: a body that cannot be walked through, no mass taken either way, no loss at the interface, statuses a player can read
(the whole spawn goes grey, turns amber as it is first steered, settles blue when a direction is held and lilac-white once it
has turned and held again). Not produced: a shared history between cells that were together (q diverges with the scripts),
the other wisp ignoring your drive (it answers slowly instead), and the baseline's tearing and holding outcomes, which the
status ramp (2.5 s from diffuse) and the one-second adoption lag blunt: the self is slower, enters currents late, and loses a
part instead of committing to or anchoring against them. A player who has read the tint would likely call it sluggish.
