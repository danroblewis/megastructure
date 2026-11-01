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
