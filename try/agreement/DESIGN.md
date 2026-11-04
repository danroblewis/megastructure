# Megastructure (v2) — what this game is about

*Recorded 2026-11-01, after the first sessions with the body-cloud player.*

## The goal of the game

This game is about the sense of self.

Most games tell you where "you" are. In a platformer or an RPG you identify with one figure on the screen. In a marble run you control the environment, but there is still one marble you are watching, and it gets the sense of self. Pinball occasionally gives you several balls at once, and that forces a real choice: follow one, dart between them, or stare at the middle of the field and play from peripheral vision.

Here, the self is a cloud of gas inside a fluid simulation, and it does not stay one thing:

- When you pick up a core or reach a checkpoint, the self is a firm ball. The feeling of being one thing is strong.
- If you stay still long enough, parts of the self drift into geometric patterns, and some of them fade away.
- When you move, currents pull parts of the self away, and those parts fade.
- When the self is pushed against a wall or barrier it flattens. A flattened self has more distance between its parts. The parts at the far edges may not be aware of each other. They may fade away before they ever knew they were part of the "me" that was being played, but they did matter and they were there.
- An elongated self does not regroup on its own just because you wait. You recover a ball-shaped self by taking another core or checkpoint, or by wiggling and using the currents to regain structure.

This is a beautiful experience, and it is the point. Everything else in the game (the chambers, the fans and vents, the fuel and fire, the cores and the exit) exists to put that self into situations where it is pulled apart, flattened, scattered, and reformed.

## Design consequences

Keep these true when changing the game:

1. **The player is matter in the simulation, never a sprite.** The self is a conserved field advected by the same lattice gas as everything else. Intent is a force applied only where the self is. No special cases that move "the player" directly around the physics.
2. **Shape is state.** Being a ball, a streak, a flattened sheet, or a scatter of fragments must look different, feel different, and have consequences. Cohesion, withering of distant fragments, and reinforcement of close cells are the core rules; tune them, do not replace them with a rigid body.
3. **Reforming is earned.** Cores, checkpoints, deliberate wiggling, and reading the currents are the ways back to a ball. Do not add an automatic "snap back to a ball" that would erase the experience of having been scattered.
4. **The currents are the other character.** Fans, vents, drains, plumes and explosions should keep sculpting the self. The world is never still.
5. **The camera follows the centroid, not a piece.** Where "you" are on screen is the centre of mass of all of you, which is sometimes empty space between fragments. That is intentional.
6. **Interface stays indirect.** You set a target point and watch what the wind does with your intention. No joystick overlay, no direction arrow on the body.

## Open questions worth exploring

- Should fragments that drift beyond the far radius wither, or could a large fragment become a second self you can switch to?
- Could the camera hesitate, or widen, when the self is split, to make the choice of where to look part of play?
- Does damage need a health bar at all, or is the visible size of the self enough?

## Living matter (added 2026-11-02)

There are three kinds of living matter in the structure, and all three are fields under the same rules:

- **You**: the self cloud, driven by your intention wherever your cells are.
- **Past lives**: fragments that were you and are no longer. They keep a fading habit of the last intention you gave them and drift toward cold. They fade unless they rest in a cold, still pocket, where they persist and can be rejoined or re-entered with a tap. If you disperse completely, the largest resting past life becomes you.
- **The organism**: the only other appetite. It creeps up the gradient of self through fuel-rich gas, feeds on you and grows from what it takes, and gives you back when it burns near you.

Every relation between them is an exchange of mass. There are no enemies, no pickups. The resource is the cold, still pockets where matter condenses, and whoever occupies a pocket is condensed there: a past life settled in a good pocket is a chamber you negotiate by waiting, by heating it out with a spark, or by joining it. Dispersal is an ending, slow and quiet, not a reload.

---

## Identity, parts, boundaries — 2026-11-03

Three psychological models are in play, and the cellular automaton fits them because of what it lacks.

**Marcia (identity statuses).** An identity is a stable collection of behaviours and motivations. There is no identity
attribute. A cell is not "me" because it carries a tag; it is me because it has been behaving and wanting as I have,
consistently, for a while. The centroid was never the meaning of identity, only a convenient estimate of stability:
cells near the centre of a mass are likely to persist, the far ones are not. Stability is the thing. Loss of stability
is loss of identity, which the game already calls being dispersed. Cells are parts, or moments in time; what survives a
chamber and its passages is who you are on the other side. Sometimes the passage is easy and you carry baggage through;
that is fine, you live with it, and you are free to address it later.

**Internal Family Systems (parts and Self).** Parts are not interchangeable with another person's parts. A part another
Self created cannot be taken over without harm; in people that is generational trauma. The other wisp has its own parts.

**Boundaries.** Where I end and you begin. Crossing boundaries is as natural as fluid mixing and needs no help; holding a
boundary is an act of will, and it is what people in therapy need help with when the flows around them push in. The
player is the free will of the wisp. Everything else is simulated. The decision to hold is the player's.

What this rules out:
- A per-cell identity tag: the nametag solution. Not a solution.
- Connectedness as merging: becoming one with the other wisp is codependence, the worst outcome of boundary failure.
- A secreted trail: stigmergy, going through the motions, the philosophical zombie. Not tolerated.
- Place as identity: nature over nurture; it tells the player their environment is who they are, when the game is about
  rising above it.
- Shape memory: for blobs, not for parts.

What it points to: identity as stability of behaviour and motivation, propagated through neighbourhoods over cycles.
Coherence, familiarity, commitment, rhythm, shared history, agreement, return, held boundaries, parts with roles, and
the plain statistics of what survives. These are the ten experiments in v2/IDENTITY.md. The hope for the end of the
game: the player remembers the green wisps fondly and the things they got through together, and carries a new
confidence of personhood into their own life, because it mirrored theirs.
