# Interaction schemes (psychology experiments)

Branch `psych` carries all eight schemes in `v2/schemes.js`. Pick one with the address hash, e.g. `http://localhost:8000/v2/#scheme=breath`. Each `psych-N-<name>` branch is the same code with that scheme as the default, so `git checkout psych-3-breath` and a plain reload gives you that one. `#scheme=target` is the `main` branch behaviour for comparison. Add `&hud=1` to see a scheme's internal numbers.

None of these reads a touch as an instruction. Each reads the pattern of what you do and lets it into the body's rules. Space stands in for "hold" on a keyboard.

| # | branch | model | what you do | what the self does with it |
|---|--------|-------|-------------|-----------------------------|
| 1 | `psych-1-consistency` | Marcia identity statuses | touch where you'd go, as on main | cohesion, drive and regrowth follow the consistency of your touching over the last two minutes: scattered is moratorium, absent is diffusion, consistent is achievement; a goal that can't be reached forecloses |
| 2 | `psych-2-appetites` | emotions processed linearly, three chemical axes | tap to move to the next appetite | no steering; the self chases one chemical at a time: heat, fuel, cold, then flees each, in a fixed order |
| 3 | `psych-3-breath` | rhythm, entrainment | hold to breathe in, release to breathe out | inhale gathers and grows you in cold; exhale puffs gas from the side you touched and carries you off it; a steady rhythm holds you together, a ragged one scatters you |
| 4 | `psych-4-integrate` | integration vs differentiation | pinch open / pinch closed (keys D / I) | divide into two halves that want opposite things and explore apart; merge to keep what each found |
| 5 | `psych-5-attention` | attention span, fatigue | hold a spot to attend to it | the self drifts toward what is attended; attention tires while held and recovers when released; the fewer things you attend to, the tighter you hold together |
| 6 | `psych-6-memory` | layered retention | tap anywhere | every touch is remembered as a direction in short, medium and long traces; the self moves by their sum; pain erases the middle trace; a stable long trace is an identity |
| 7 | `psych-7-presence` | Internal Family Systems | hold anywhere to be present | Self is always here; while you are present, parts unburden and come home; let go and a large part's burden moves the whole |
| 8 | `psych-8-tempo` | Lovheim-style mood from input statistics | touch where you'd go, as on main | tap tempo is arousal, hold length is contentment, spread of your touches is seeking; the three set speed, cohesion, regrowth and appetite |
