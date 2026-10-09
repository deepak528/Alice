# Alice in Mazeland

A local-only maze game in a single file. Double-click `index.html` to play in Edge or Chrome — no internet, no install.

Guide Alice through a hedge maze to **Home** 🏡 or **Magic World** ✨. Creatures block the way; find the right tool hidden in the maze and walk into the creature to send it off.

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
- **Difficulty** — Easy (23×13, 3 creatures that stay put, can't lose) · Medium (35×19, 5 creatures, 2 wander, 3 hearts) · Hard (45×25, all 6, 4 wander, 3 hearts, thicker fog). Mazes are landscape and the board grows to fill a desktop/laptop window.
- **Fog mode** — only see what's near Alice; explored paths stay dimly visible.
- **Sound** — simple generated sound effects.

Settings are remembered between visits.

## Controls

Arrow keys or WASD to move · **F** fog · **M** sound · **R** restart this maze · **Esc** menu. On touch screens, on-screen arrows appear below the maze.

Bumping a wandering creature without its tool costs a heart and pushes Alice back 3 steps. Lose all hearts and you can retry the same maze.

## Tests

Needs Node 20+ (no packages to install):

```bash
node --test --experimental-test-coverage --test-coverage-include="tests/.extracted/**" tests/game.test.js
```

The tests pull the game-rules `<script id="logic">` out of `index.html` and check maze generation, fairness (every tool reachable before its creature, over 200 mazes per difficulty), movement, tools, wanderers, hearts, fog, and full simulated playthroughs.

## Handy URL options

- `index.html?seed=123` — the first maze uses this seed, so it's repeatable.
- `?debug` — exposes `window.mazelandGame()` for browser-console testing (read-only use).

URL options need the page served over http (`.claude/launch.json` has a tiny Node server on port 8765); opening the file directly works for normal play.
