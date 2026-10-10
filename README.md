# Alice in Mazeland

A local-only maze game. Double-click `index.html` to play in Edge or Chrome — no internet, no install. Keep the `vendor` folder next to it: it holds Three.js, which draws the 3D view.

Guide Alice through a hedge maze to **Home** 🏡 or **Magic World** ✨. Creatures block the way; find the right tool hidden in the maze and walk into the creature to send it off.

Play it as a **3D walk** through the hedges, with the camera just behind Alice so you watch her walk (or, press **C**, through her own eyes); a mini-map overlay shows where she is. Or play on a top-down **2D map**.

The 3D walk is a real 3D scene ([Three.js](https://threejs.org) r159): leafy, lumpy hedges on a gravel path under an evening sky, a low sun (the moon in Magic World) casting shadows down the corridors, fog that closes in round Alice, and a lantern that lights the hedges around it. The exit is a swirling portal in a ring of glowing stones (Magic World) or a little cottage with lit windows and fireflies (Home). Alice is a 3D figure after John Tenniel's drawings (long fair hair and a black band, blue dress, white pinafore tied in a bow at the back) who walks, turns and casts her shadow. Creatures and tools are the same storybook paintings as the 2D map, standing in the scene. Without WebGL (or with `vendor/` missing) the game says so and plays on the 2D map.

| Creature | Tool |
|---|---|
| 👻 Ghost | 🏮 Lantern |
| 🐕 Dog | 🦴 Bone |
| 🕷️ Spider | 🧹 Broom |
| 🎃 Pumpkin-head | 🪣 Water bucket |
| 😸 Cheshire Cat | 🍪 Snack |
| 🐰 Bunny | 🥕 Carrot |

## Settings (start menu)

- **Destination** — Home or Magic World: changes colours, the exit, and the ending.
- **View** — 🧭 3D walk (default) or 🗺️ 2D map. Switch any time with **V** or the 3D/2D button; the maze and progress carry over.
- **Difficulty** — Easy (23×13, 3 creatures that stay put, can't lose) · Medium (35×19, 5 creatures, 2 wander, 3 hearts) · Hard (45×25, all 6, 4 wander, 3 hearts, thicker fog). Mazes are landscape and the board grows to fill a desktop/laptop window.
- **Fog mode** — only see what's near Alice (about 4 tiles on Easy, 3½ on Medium, 3 on Hard); explored paths stay dimly visible. The fog drifts slowly.
- **Fog transparency** — 0–50% (default 2%): how much of the unexplored maze shows through the fog. Creatures and tools stay hidden until Alice has been near them.
- **Sound effects** and **Music** — separate switches. The music is a generated music-box waltz (no files needed).

Settings are remembered between visits.

## Controls

Arrow keys or WASD — tap for one step, hold to keep walking, and keep holding (0.6 s) to run 30% faster.

- **3D walk:** ↑ walks forward, ↓ steps back, ← → turn 90°. Holding ↑ follows the corridor round bends where there's only one way on, and stops at junctions so you choose. **Tab** shows or hides the mini-map (top-right; it fills in as Alice explores). **C** switches the camera between just behind Alice (the default: it swings round her as she turns, and moves in when a hedge is close behind her; she turns see-through while she'd hide a creature, tool or the exit, and fades away when the camera is too close to fit her in) and through her own eyes, where the view bobs gently as she walks (not if your system is set to reduce motion). The camera choice is remembered.
- **2D map:** the arrows move Alice in that direction.

**V** 2D/3D · **C** 3D camera · **F** fog · **M** sound effects · **B** music · **R** restart this maze · **Esc** menu. On touch screens, on-screen arrows appear below the maze.

Bumping a wandering creature without its tool costs a heart and pushes Alice back 3 steps. Lose all hearts and you can retry the same maze.

## Tests

Needs Node 20+ (no packages to install):

```bash
node --test --experimental-test-coverage --test-coverage-include="tests/.extracted/**" tests/game.test.js
```

The tests pull the game-rules `<script id="logic">` out of `index.html` and check maze generation, fairness (every tool reachable before its creature, over 200 mazes per difficulty), movement, tools, wanderers, hearts, fog, turning, following corridors, ray casting and line of sight (what a hedge hides in 3D), the follow camera (never inside or against a hedge), and full simulated playthroughs.

## Handy URL options

- `index.html?seed=123` — the first maze uses this seed, so it's repeatable.
- `?debug` — exposes `window.mazelandGame()`, `window.mazelandMusic()`, `window.mazelandView()` and `window.mazelandWorld()` (the Three.js renderer and scene) for browser-console testing (read-only use), plus `window.mazelandDraw()` to draw a frame on demand (handy when the browser slows animation in a background tab). The 3D canvas keeps its last frame, so screenshots can read it.

URL options need the page served over http (`.claude/launch.json` has a tiny Node server on port 8765); opening the file directly works for normal play.

## Third-party

`vendor/three.min.js` is Three.js r159 (MIT licence, `vendor/three.LICENSE`), the last release with a plain-script build, so the game still opens straight from the file. It logs one harmless notice in the console that this build style is deprecated.
