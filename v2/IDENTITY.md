# Identity experiments — what makes a wisp a wisp

Read `v2/DESIGN.md` ("Identity, parts, boundaries") first. The question: without any identity attribute on a cell, how does
a body hold together as one self, keep a boundary where it meets another wisp, and lose parts the way people lose
parts? The answer must be stability of behaviour and motivation, propagated through neighbourhoods over cycles. The
player is the wisp's free will; everything else is simulated.

## The scaffold (branch `main`)

- **Q texture** (`uQ`, RGBA16F, one texel per cell, ping-pong with the body texture). Written by the body pass through
  `identUpdate`, carried with the matter like exposure (semi-Lagrangian mix along the cell's velocity), zeroed when the
  cell dies. Its four channels mean whatever the model says they mean.
- **Hooks** in `v2/shaders.js` (just after the `uIdent` uniform in `SH.head`), overridden on a branch, signatures fixed:
  - `vec4 identUpdate(vec4 q, float self, vec2 vel, float dc, int kk, vec4 sp, vec2 drive, ivec2 p)` once per substep.
    `vel` the cell's own velocity, `dc` distance to its nearest centre, `kk` that centre (0 you, others past lives or the
    other wisp; `uNpcK` says which), `sp` species at the cell (x fuel, y heat, z smoke, w organism), `drive` the intention
    that centre gave this substep (`uDirs[kk]`).
  - `float identWeight(int k, int nearestK, vec4 q, vec2 pp)` membership of the cell in centre k, 0..1, used by the
    reduction that computes each centre's mass and position (soft membership is allowed; it is what makes "who I am" come
    from the model instead of from distance).
  - `vec2 identDrive(int ki, vec4 q, vec2 drive, float self)` the drive the cell follows given its centre's drive (`ki` is
    its nearest centre; the attention point drive is already in `drive` for your cells).
  - `vec2 identCohere(vec4 q, vec2 coh, float self)` the cohesion it feels (gradient climb plus homing).
  - `vec3 identTint(vec4 q, vec3 bc, float self)` display colour: show the state, a player must be able to read it.
- **`uIdent`** selects the model at runtime; `v2/ident.js` registers models by name with `id`, `blurb`, optional
  `tick(ctx)` and `hud(ctx,c)` on the CPU. `#ident=<name>` picks one. A branch may simply override the hook bodies and
  register its name with `id:1`; `uIdent` lets a branch keep the baseline reachable for comparison.
- Existing per-cell state you may use: body texture `uB` = (self, lost, exposure = heat history, payload = ore + / charge −).
- **Lab**: `index.html#lab=enmesh&npc=170,60&warm=300&n=900` runs a scripted enmeshment in the lab box: the player presses
  into the other wisp for 4 s, holds inside it for 5 s, pulls away for 6 s. Rows every 30 ticks carry `main` (your mass),
  `other` (its mass), `otherDist`, `cx cy`, `stamina`, `effort`. Also run `#lab=ledge&warm=900`, `#lab=commit` and
  `#lab=hold` to make sure tearing, commitment and holding still behave (outcomes table in `v2/ROADMAP.md`). Headless:
  `chrome-headless-shell --headless --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=1800000
  --window-size=800,500 --dump-dom "file:///…/v2/index.html#lab=enmesh&npc=170,60&warm=300&n=900"` and read the
  `<title>` (`LAB {json}`). Headless runs take minutes; run them in the background. Game smoke test:
  `#test=1&n=60&w=1024&h=512&touch=60,0` must print a title with no `Uncaught`.

## What a boundary means here (judge the enmesh scenario against this, not against "no mixing")

1. **Overlap is normal.** The two bodies may interpenetrate during contact; a model that repels them fails.
2. **No taking.** After parting, neither wisp has gained mass at the other's expense beyond noise, and while entangled the
   other wisp's cells do not answer the player's attention. Report steerability: how far the player's centroid moves per
   30 ticks under the scripted drive while entangled, against the same drive alone.
3. **Loss is allowed.** Interface cells may drift too far from their own body and fade, on either side. Report it as loss,
   not as transfer.
4. **Learning together.** Cells that spent the contact near each other should come out with similar identity state
   (whatever q carries) without becoming the same body. Measure the mean |q| difference between the two bodies before
   contact (t≈30) and after parting (t≈900), against the difference between a body's own centre and its edge.

## The ten experiments (one branch each: `ident-N-<name>`)

1. **coherence** — `q.xy` a slow habit of the cell's motion. Cohesion acts only between neighbours whose habits agree;
   `identWeight` by habit agreement with each centre's drive; steerability scales with agreement with your drive. Parting
   wisps have averaged habits at the interface: those cells belong to neither and thin out.
2. **familiarity** — `q.z` accumulates while the cell's neighbourhood (self density pattern) stays the same and decays
   when it changes. Cohesion and steerability scale with it; a fresh cluster is fragile; the interface of two entangled
   bodies never stabilises and goes first when they part. Dispersal is familiarity lost.
3. **commitment** — `q.xy` the intention the cell has committed to, moving slowly toward the drive it receives; `q.z`
   how long it has held it. Marcia's statuses as local regimes: foreclosed (held long, never changed) rigid and fast,
   diffuse (no intention) falling away, moratorium (changing) wobbling, achieved (held after changing) cohering best.
   You steer what has committed to you; the other wisp's proposals compete at the same cells.
4. **phase** — `q.x` a phase, `q.y` its rate; neighbours couple (Kuramoto). One self is one coherent rhythm; two rhythms
   synchronise only with time in contact; the boundary is where the phase gradient is steep; dispersal is decoherence.
   Attention could carry a beat (`q.y` of your cells follows a rhythm) and only cells in phase answer it.
5. **history** — affinity by shared experience: `q` holds what the matter has lived through (heat from exposure, cold,
   ore, charge, current) and cohesion/mixing depend on similarity of histories. Different pasts keep a boundary until the
   wisps go through things together; a hybrid history belongs to neither when they part.
6. **agreement** — `q.xy` a stance (preferred direction) averaged only with neighbours within a tolerance (bounded
   confidence). Distinct groups form and polarise without labels; enmeshment is stances within tolerance; attention nudges
   only cells that roughly agree with you already.
7. **return** — cells that leave the body's neighbourhood and come back within a window are kept and strengthened
   (`q.z` records excursion time and returns); cells that never return fade even inside rfar; identity is what comes back.
   Excursions become allowed and meaningful; the other wisp's cells that wander into you and leave again were never yours.
8. **held** — the boundary as an act of will. By default the edges of two wisps mix like fluids. While the player holds
   (a second finger, or the space bar; `ctx.touches.size>1` / `ctx.keys.Space`), `q.w` at the edge of your body rises and
   edge cells refuse exchange with cells not yours and are not carried by the other wisp's drive; holding costs stamina
   (bd.swim already scales with stamina; drain it through `ctx.player.stamina`). Without holding, you enmesh.
9. **parts** — IFS. `q.xyz` is a role that grows from history: burned cells become protectors (resist heat, lead when
   heat is near), long-calm cells managers (cohere, slow), lost-and-regrown cells exiles (fade when alone, strong in the
   centre). Parts are regions of similar role with small drives of their own that bias the attention. A part of the other
   wisp that ends up in you does not answer your attention and costs stamina to carry: the burden of a part you did not
   make.
10. **survival** — no new physics for membership; identity is the statistics of what survives passages. `q` records the
    cell's provenance (chamber it was born in `q.x`, what it was exposed to `q.y`, how many times it nearly died `q.z`).
    At each cold room a ledger is shown (hud): what came through, what was lost in the last passage, what was gained; the
    tint shows provenance so baggage is visible. The point is awareness, not control.

## What to deliver on a branch

- The hook bodies and any CPU glue, registered in `v2/ident.js`; `#ident=<name>` selects it; the baseline stays `id:0`.
- Numbers: the `enmesh` rows (baseline vs yours) and the `ledge`, `commit`, `hold` rows, in `v2/ROADMAP.md` under a new
  heading `Identity experiment N: <name>`, with three or four sentences on what was produced and what was not.
- A screenshot of the entangled pair (`--screenshot=…` on a `#test=1&small=1&n=300&spawn=294,118&touch=0,14` run shows you
  pressing into the waiting wisp on map 1).
- Bump the `?v=` of each script you change in `v2/index.html`. Keep the headless game smoke test passing. Commit on the
  branch with a message that says what the model is and what the numbers showed.
