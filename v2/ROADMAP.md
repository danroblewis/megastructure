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

## Identity experiment 10: survival — 2026-11-03 (branch `ident-10-survival`)

No new physics for membership: `identWeight` is the baseline nearest-centre rule, and the enmesh rows for `#ident=survival`
and `#ident=centroid` are identical to the integer in every column (main, other, otherDist, cx cy, parts, stamina). What the
branch adds is provenance per cell and a ledger. `q.x` is the chamber the matter was born in (+32 when it was born nearest
the other wisp: a part another self made), stamped from `uRoom` when self rises from nothing with no past carried in;
`q.y` a slow running mix of what it has lived through (heat 1.0, cold 2.0, ore 0.6, charge 0.85, current speed 0.5, each
weighted); `q.z` how many times its self dropped below 0.05 and it lived; `q.w` a weight so the carried mix of two cells
stays an average of their pasts. The tint is hue by chamber of origin (the home chamber keeps the familiar blue, each
later chamber a step round the wheel, other-wisp-born cells under a green cast), washed out by near-deaths. The ledger
(hud, while in any cold room and for ten seconds after one registers; always with `#hud=1` or the bot) is an origins
histogram from the 6x4 probe grid round the body, scaled to the body's mass, and against the previous cold room: what
was lost (and which origin lost most), what was gained, what you carry that was born of the other wisp, net.

**Enmesh** (`#lab=enmesh&npc=170,60&warm=300&n=900`; `q` = a 6x4 grid round each centre: self-weighted mean `q.y`, and the
mass in that grid born of the other wisp):

| t | main | other | dist | main q.y | other q.y | abs diff | other-born in main | player-born in other |
|---|---|---|---|---|---|---|---|---|
| 30 (before contact) | 163 | 160 | 38 | 0.090 | 0.060 | 0.030 | 0 | 0 |
| 90 (pressing in) | 128 | 193 | 12 | 0.180 | 0.182 | 0.002 | 109 | 24 |
| 120 (inside) | 159 | 155 | 11 | 0.187 | 0.193 | 0.006 | 136 | 7 |
| 150 (parting) | 164 | 155 | 24 | 0.112 | 0.219 | 0.107 | 30 | 21 |
| 180 | 163 | 158 | 41 | 0.120 | 0.247 | 0.127 | 0 | 0 |
| 240 (apart) | 161 | 160 | 74 | 0.125 | 0.221 | 0.096 | 0 | 0 |
| 660 (second pass, dist 22) | 160 | 159 | 22 | 0.107 | 0.354 | 0.247 | 0 | 0 |
| 840 | 160 | 161 | 133 | 0.105 | 0.358 | 0.253 | 0 | 0 |
| 900 | 68 | 160 | 145 | 0.239 | 0.361 | 0.122 | 0 | 0 |

Against the four-part boundary: (1) overlap during contact is there and is what the big "other-born in main" numbers at
t=90..120 are: the two grids cover both bodies and nearest-centre assignment hands 35 of the player's mass to the other
centre at t=90 and back at t=120. (2) No taking: 163/160 before, 161/160 at t=240 after parting, 160/161 at t=840; the
drop to 68 at t=870..900 is the baseline body pressed into the left wall of the box (identical in the centroid run).
(3) Loss, not transfer: at parting (t=150) 30 of the player's mass was other-born and 21 of the other's was player-born;
thirty ticks later both are 0 while the masses did not move (163/158), so the exchanged interface cells faded on both sides
or were regrown over by the host's own cells; the ledger reports that as mass that faded, and what is still carried
after a passage as "taken". (4) Learning together is only half there: the histories converge in contact (abs diff 0.03
before, 0.002..0.006 inside) but diverge again after parting (0.10 at t=240, 0.25 at t=840), because a body that moves
turns its cells over, every newborn starts its history at zero, and the resting wisp keeps accumulating; shared history
does not survive separation under the carried-mix scheme. `ledge`, `commit` and `hold` were not rerun: no hook on this branch touches drive, cohesion or membership, and the
enmesh run being bit-identical to the baseline is the evidence that holds for them too.

**Game** (`#test=1&bot=1&small=1&n=1200&trace=400&scheme=attention&nonpc=1`): the smoke run (`#test=1&n=60&w=1024&h=512`)
gives the first ledger entry: `spawn` at frame 156, mass 163, all 153 sampled units born in chamber 1, near-deaths 0,
exposure 0.1. The 1200-tick bot run across to the second cold room was still running (alone, SwiftShader) when this
section was written; its ledger is read from the `ident {...}` field at the end of the test title and is to be added
here: the origins histogram after the second chamber, and the `lost since spawn` / `gained` lines of the `cold room 1`
entry. A first attempt at that run (n=2500, with ~20 other headless runs on the machine) was killed after five hours of
wall time; the probe pass added here is one 64x1 draw and readback per tick, so the slowness is not expected to be
this branch's, but that has not been shown.

Judgement so far: provenance is legible in the lab (the +32 origin makes "a part the other wisp made" a separate row,
and the tint gives it a green cast), and the ledger's fade-versus-taken distinction is real because it is measured, not
inferred. Whether it reads as "baggage you can live with" needs the chambers: in the enmesh box nothing survives a
passage as baggage, the exchanged cells fade within a second of parting, so the honest reading of the lab is "you take
nothing and keep nothing"; the histogram across chambers is where the baggage would show, and that number is pending.
