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

## Theme: biology in a chemical space (decided 2026-11-02)

The field is chemistry: gas, heat, fuel, smoke, melting, frost, soot. None of it wants anything. It happens because of concentration, temperature and pressure. You are the biological part: the one thing in the field that behaves because of what it wants, and your past lives are biology that has lost its wanting but not its habits. The organism is biology without a self.

Every verb you have should be something a living thing in a fluid actually does, never a thruster:

- **Spread and tighten.** Open up to be carried, close up to coast across the streams. (The `ride` branch makes this the only means of travel.)
- **Stick.** Cling to a wall or a grate with part of yourself and let the current swing the rest.
- **Eat.** Take in what is near you in the fluid: fuel, condensable gas, the organism. Mass is the only score.
- **Burn and breathe.** Fire and heat are chemistry you can trigger, not a weapon: a spark makes an updraft to ride.

The structure is a chemical plant, but it reads as a body: fans as hearts, vents as breath, the organism as tissue, cold pockets as the places where you can condense again.
