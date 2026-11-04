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

## Identity experiment 4: phase — 2026-11-04, branch `ident-4-phase`

The model (`#ident=phase`, the default on this branch; `#ident=centroid` is the baseline). Every cell is an oscillator. `q.xy`
is its phase, held as a unit phasor (cos, sin) rather than an angle, because the scaffold carries `q` by mixing it and an angle
cannot be mixed across its wrap; the shrinking of a mixed phasor is itself decoherence. `q.z` is its natural rate (radians a
substep, about 0.021, a beat every 1.7 s), seeded from a hash of the 24-cell block its body's centre was in when it was born
(±20 %) with 3 % per-cell jitter, inherited from the neighbourhood by cells born at a moving edge, and adapting slowly toward
whatever pulls it (frequency adaptation, 1e-5 per unit pull a substep). `q.w` is local coherence. Eight neighbours couple
Kuramoto-style (pull = sin(neighbourhood phase − own) × neighbourhood coherence, gain 0.12 a substep). Each centre's rhythm
(mean phasor × coherence, mean rate) is measured on the CPU from a 21-point probe grid round it (`SH.probeQ`, async, in the
same readback as the other probes) and passed as `uPhaseC[3]`. `identWeight`: the nearest centre holds a cell unless the
other wisp's rhythm agrees with the cell's phase better than the nearest's does, that difference × proximity over ~5 cells
being the claim (the differential form from the commitment branch; a symmetric soft membership merges centres).
`identDrive`: a wisp's intention is answered × (0.25 + 0.75 × agreement with its rhythm), and a cell beating with the other
wisp follows the other wisp's intention instead; while the player holds a direction, the rate of cells in the player's rhythm
is nudged (0.002 a substep) toward one shared beat. `identCohere`: cohesion × agreement with the nearest centre's rhythm
(floor 0.3) × local coherence (floor 0.6). `identTint`: hue by phase, saturation by coherence. Scaffold changes: `uC`, `uCN`,
`uDirs` live in `SH.head`; `q` is now carried by the same upwind fluxes that move `self` (mass-weighted, bulk motion only, not
the symmetric exchange) instead of the whole-cell look-back, which at sub-cell speeds carried nothing, so a body pressing into
another simply took the phase of the texels it entered; the lab rows carry `qd` (phase gap, rate gap, coherence, centre–edge).

`#lab=enmesh2&npc=170,60&warm=300&n=900` (press 2.5 s at 0.7, hold 5 s, pull away 4 s at 0.7, rest), main / other / otherDist:

| t | baseline | phase | phase: gap between the bodies (dphi rad, drate ×1e-3), coherence RA / RB |
|---|---|---|---|
| 30 (apart) | 163 / 160 / 30 | 163 / 160 / 30 | 2.99, 3.48 (22.1 vs 18.6); 1.00 / 1.00 |
| 90 (inside) | 139 / 176 / 8 | 133 / 174 / 8 | 1.20, 0.81; 0.44 / 0.46 |
| 150 (through) | 163 / 159 / 35 | 158 / 162 / 29 | 0.23, 0.04; 0.82 / 0.60 |
| 300 (hold) | 162 / 160 / 38 | 163 / 159 / 31 | 0.75, 0.11; 0.93 / 0.77 |
| 450 | 160 / 156 / 30 | 163 / 159 / 23 | 0.99, 0.27; 0.99 / 0.79 |
| 690 (on the wall) | 128 / 157 / 141 | 101 / 160 / 144 | 0.88, 0.07; 1.00 / 0.85 |
| 900 | 159 / 161 / 134 | 161 / 158 / 136 | 1.10, 0.33 (20.0 vs 20.3); 1.00 / 0.88 |

The gentler press still carries the player straight through the other wisp (otherDist 8 at t=90, 29–35 at t=150) in both
models, so the "hold inside" happens 23–38 cells past it, the pair drifting together on the box's return current; the pull
ends on the box wall at x≈22 (the mass dip at t=690, regrown by t=900) in both.

- Overlap: produced, no repulsion.
- No taking: 163 / 160 before contact; 159 / 160 (phase) against 160 / 156–158 (baseline) at t=600–660, after parting and
  before the wall; the other wisp's cells did not follow the player's drive (its centre moved ≤ 2 cells per 30 ticks except
  while being pushed through, as in the baseline). Steerability, player centroid moved per 30 ticks under the scripted drive:
  pressing alone +15 (baseline +15); entangled (t=90, 120, otherDist 8–20) +11, +17 (baseline +12, +21); pulling away alone
  −18 … −23 (baseline −18 … −23). Nothing is lost in steerability, because nothing of the other wisp's rhythm survives inside
  the player's body for long enough to refuse the drive.
- Loss: fades 0, both masses flat to ±4 through contact and parting. The wall takes more from the phase body (101 against
  128): cohesion scaled by coherence lets go of cells the wall has decohered.
- Learning together: produced, by mixing. Mean |Δq| between the bodies (phasor xy and rate z, rate in 1e-3) 4.01 before
  contact (t=30), 0.25–0.33 right after the pass (t=150–210), 0.75–1.04 after parting (t=600–900), against a body's own
  centre–edge |Δq| of 0.01–0.2 (player) and 0.2–0.9 (other). The rates converged from 17 % apart to 1–2 % (22.1 / 18.6 → 20.0 /
  20.3) and stayed converged; the phase gap settled at 0.8–1.1 rad, because once the rates agree nothing closes it. Both bodies
  were fully coherent again by t=510 (RA 1.00, RB 0.77–0.94), so they came out similar without becoming one.

`ledge`, `commit`, `hold` (baseline from the coherence branch's rerun of the same lab box, 2026-11-03):

| scenario | baseline (centroid) | phase |
|---|---|---|
| `ledge` warm=900 (testing the waters) | 118→81 torn in the first 2 s, no part tracked, held 81–86 for 13 s, regrew to 161 after release | 119→82 torn in the first 2 s, no part tracked, held 82–87 for 13 s (coherence 1.00 throughout), regrew to 160 after release |
| `commit` | the whole self carried x 84→389 at mass 160; one part torn at t=120, faded by t=180 | the whole self carried x 84→387 at mass 157–163; one part torn at t=120 (73 cells off), faded by t=210; a second small part at t=510, faded by t=570 |
| `hold` (holding is work) | carried 36 cells downstream in the first second, stamina 1→0.71 at t=90, pushed out of the band, effort 0.3–0.38 | carried 34 cells downstream in the first second, stamina 1→0.71 at t=90, pushed out of the band, back in it at t=180–270 pushing upstream 3–9 cells per 30 ticks, out again at effort 0.3–0.38, never scattered |

A single body is one rhythm with agreement ~1 everywhere, so every hook reduces to the baseline there; these three are the
baseline to within noise, as they should be. Entangled-pair screenshot: `#test=1&small=1&n=300&spawn=294,118&touch=0,14`
shows the two bodies as one bright blob of one hue: the waiting wisp (294,129, by then `friend`) three cells from the player (292,132) after five seconds inside each other, one rhythm.

What was produced: a rhythm per body that a player can read (one hue sweeping round the wheel; two bodies born apart beat at
different rates and show different hues, and a decohered edge goes grey), decoherence as the visible event of contact (both
bodies' coherence fell to ~0.45 while one was pushed through the other and recovered within two seconds of parting), no mass
taken, and a shared state that survives parting: the two bodies' rates, which differed by 17 % before contact, differ by 1–2 %
after it, while each is a coherent body of its own. What was not: a boundary with any resistance, or one that lasts. Two
rhythms were meant to synchronise only with time in contact; in this scenario the scripted press shoves one body's matter
through the other's texels, the flux carry (correctly) mixes their phasors and rates where the matter mixes, and the pair are
in phase after about one second (dphi 2.87 at t=60, 0.23 at t=120). The steep phase gradient exists only for that second. Rate
seeding by block of birth is also arbitrary: two wisps born in adjacent blocks can beat alike by chance of the hash, and then
this model is the baseline with a tint. The attention beat worked as designed (the player's rate went to the shared 0.0209
under drive) but, with the rates converged, it had nothing to select against.
