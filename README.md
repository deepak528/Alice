# Alice in Mazeland

A local-only maze game. Double-click `index.html` to play in Edge or Chrome — no internet, no install. Keep the `vendor` folder next to it: it holds Three.js, which draws the 3D view.

Guide Alice through a hedge maze to **Home** 🏡 or **Wonderland** ✨. Creatures block the way; find the right tool hidden in the maze and walk into the creature to send it off.

**The Story** 📖 plays three parts in order, always from the beginning:

1. **Find the Bunny** 🐰: Alice is at home when the White Rabbit hurries by with his pocket watch. There are no creatures or tools. He stays a few hops ahead along the way to the exit, and stops to check his watch whenever she falls behind. At the end of the maze he dives into a rabbit hole under a big old oak and drops a little DRINK ME bottle. Alice is too big for the hole until she drinks it and shrinks.
2. **The fall**: a slow, dreamy six-second fall down the rabbit hole, past cupboards, bookshelves, maps, jars and clocks (a tap or any key skips it). In the 2D view it's a "Down, down, down…" card. The White Rabbit loses his watch on the way down.
3. **Tea Party** ☕: the Queen's rose garden, with dark clipped hedges dotted with red and white roses, rosy gravel and golden evening light. Alice lands still tiny (30% of her height), too small for anyone to hear her: friends just block her way. The Caterpillar sits on his red-spotted mushroom a short walk from the start, two turns in, before the first friend. Walking into him gives her a bite: she grows back to her proper size and he waves goodbye. In 3D the camera comes down with her while she's tiny, so the hedges tower overhead.

There are no tools in the Tea Party and nobody can hurt Alice. Walking into a friend brings up a riddle on their theme (the White Rabbit's are about time, the Queen's about roses and hearts, the Hatter's about hats and tea, the Cat's about grins and vanishing, the Dog's about bones and play), with three picture answers. A wrong answer brings another riddle; three wrong answers send Alice back to the start, though friends she has already helped stay helped. A right answer makes the friend step aside and give her one letter of a magic word: an easy word picked at random each game, one letter per friend (3 on Easy, 4 on Medium, 5 on Hard). The letters come in a jumbled order and fill a row at the top of the screen. The Mad Hatter and the Queen of Hearts host a tea party at a table laid with a spotted teapot, cups and cakes, in the dead end nearest the middle of the maze. If either is a friend in the maze, they hurry back to the table once Alice has answered their riddle. With every letter, Alice walks up to the table and the child taps the letters into the right order. The right word earns the golden key 🔑. The exit is a garden gate with a golden padlock: it stays locked until Alice has the key, then swings open.

Play it as a **3D walk** through the hedges, with the camera just behind Alice so you watch her walk (or, press **C**, through her own eyes); a mini-map overlay shows where she is. Or play on a top-down **2D map**.

The 3D walk is a real 3D scene ([Three.js](https://threejs.org) r159): leafy, lumpy hedges, growing in patches of slightly different greens, with woody branches inside showing through gaps in the leaves, flowers on their sides and tops, red-and-white toadstools at some roots, grass along their feet and fallen leaves on the gravel path under an evening sky, a low sun (the moon in Wonderland) casting shadows down the corridors and a light haze far off. The exit is a swirling portal in a ring of glowing stones (Wonderland) or a little cottage with lit windows and fireflies (Home). Alice is a 3D figure after John Tenniel's drawings (long fair hair and a black band, blue dress, white pinafore tied in a bow at the back) who walks, turns and casts her shadow. Creatures and tools are modelled in 3D after their paintings, lit and shadowed like everything else, and float a little above the path so they are easy to spot: wanderers trot, hop, march or scurry from tile to tile, the others turn to watch Alice, and each acts out being sent off (the Cheshire Cat’s grin lingers; the White Rabbit checks his watch and dives down a rabbit hole; the Mad Hatter dashes off and leaves his hat spinning; the Queen of Hearts twirls with the red paint and hurries off to paint her toes). The 2D map, mini-map and inventory keep the paintings. Without WebGL (or with `vendor/` missing) the game says so and plays on the 2D map.

| Creature | Tool |
|---|---|
| 🐕 Dog | 🦴 Bone |
| 🎩 Mad Hatter | ☕ Teacup |
| 😸 Cheshire Cat | 🍰 EAT ME cake |
| 🐰 White Rabbit | ⏱️ Pocket Watch (he’s lost it) |
| 👑 Queen of Hearts | 🖌️ Red paint (for her toes) |

## Settings (start menu)

- **Map** (a drop-down) — Home, Wonderland or The Story. Home and Wonderland change the colours, the exit and the ending; The Story is the three-part adventure above.
- **View** — 🧭 3D walk (default) or 🗺️ 2D map. Switch any time with **V** or the 3D/2D button; the maze and progress carry over.
- **Difficulty** — Easy (23×13, 3 creatures that stay put, can't lose) · Medium (35×19, 4 creatures, 2 wander, 3 hearts) · Hard (45×25, all 5, 3 wander, 3 hearts, thicker fog). Mazes are landscape and the board grows to fill a desktop/laptop window.
- **Hedge height** (3D) — Lowest · Very low · Low · Medium · Tall. Starts at Lowest; changing the difficulty leaves it as it is. Tall hedges hide everything beyond; Low ones come just above Alice's head, so from behind her you catch the tops of hedges further off; Very low ones reach her shoulders and the Lowest her waist, and you can see across the maze. Changes straight away, even mid-maze.
- **Fog mode** — only see what's near Alice (about 4 tiles on Easy, 3½ on Medium, 3 on Hard); explored paths stay dimly visible. The fog drifts slowly. In the 3D walk the fog covers only the mini-map; the scene itself stays clear.
- **Fog transparency** — 0–50% (default 2%): how much of the unexplored maze shows through the fog (in 3D, on the mini-map). Creatures and tools stay hidden until Alice has been near them.
- **Sound effects** and **Music** — separate switches. Sound effects include soft footsteps on the gravel and the garden's ambience: a breeze in the hedges, with birdsong at Home and wind-chimes in Wonderland. The music is a generated music-box waltz (no files needed).

Fog mode, hedge height and fog transparency are folded away under the ▸ **Fog and hedge height** arrow. Settings are remembered between visits.

## Controls

Arrow keys or WASD — tap for one step, hold to keep walking, and keep holding (0.6 s) to run 30% faster.

- **3D walk:** ↑ walks forward, ↓ steps back, ← → turn 90°. Holding ↑ follows the corridor round bends where there's only one way on, and stops at junctions so you choose. **Tab** shows or hides the mini-map (top-right; it fills in as Alice explores). **C** switches the camera between just behind Alice (the default: it swings round her as she turns, and moves in when a hedge is close behind her; she turns see-through while she'd hide a creature, tool or the exit, and fades away when the camera is too close to fit her in) and through her own eyes, where the view bobs gently as she walks (not if your system is set to reduce motion). The camera choice is remembered.
- **2D map:** the arrows move Alice in that direction.

**V** 2D/3D · **C** 3D camera · **F** fog · **M** sound effects · **B** music · **R** restart this maze · **Esc** menu. On a touch screen (iPad or phone), on-screen arrows float over the bottom-right corner of the maze.

**iPad / iPhone:** open the game in Safari, then Share → **Add to Home Screen**. It then opens full screen like an app, with its own Alice icon (`manifest.webmanifest`, `icons/`). This needs the game served from a web address the iPad can reach; a file opened straight from disk can't be added. Once opened, the game saves itself on the device (`sw.js`) and then plays without wifi; when online it picks up any new version.

On Medium and Hard, running into any creature without its tool costs a heart and sends Alice back to the start; the tools she holds and the creatures already sent off stay as they are. On Easy a creature just blocks the way. Lose all hearts and you can retry the same maze.

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
