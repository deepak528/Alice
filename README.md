# Alice in Mazeland

A local-only maze game. Double-click `index.html` to play in Edge or Chrome — no internet, no install. Keep the `vendor` folder next to it: it holds Three.js, which draws the 3D view.

Guide Alice through a hedge maze to **Home** 🏡 or **Wonderland** ✨. Creatures block the way; find the right tool hidden in the maze and walk into the creature to send it off.

**The Story** 📖 plays three parts in order, always from the beginning:

1. **Follow the White Rabbit** 🐰 is an intro, not a puzzle, and it can't be lost.
   - **The garden:** the left of the map is the lawn at home. Alice's house stands at the top, and her sister sits reading on a picnic blanket next to Dinah the kitten, who is asleep.
   - **The opening (about 9 s):** storybook captions tell the scene, and Alice asks "What is the use of a book without pictures?" Then the White Rabbit hops up the lawn: "Oh dear! I shall be late! Follow me, Alice!" A tap, an arrow key, Space or Enter skips it.
   - **The maze:** a small, low hedge maze on the right, with no fog, so the Rabbit always shows over the hedges.
   - **The Rabbit:** he runs to each corner and waits there, tapping his watch, until Alice is close. Speech bubbles call her on ("Hurry, hurry!"), and paw prints show the way he went, fading after a while. On the way he drops his white kid gloves and his fan. Picking them up is optional, and he thanks her for them.
   - **Taps:** in the garden, tapping the sister, Dinah, the flowers, the house, the butterflies or the Rabbit makes them answer.
   - **The end:** he dives into a rabbit hole under a big old oak and drops a little DRINK ME bottle. Alice is too big for the hole until she drinks it and shrinks.
   - **Map size:** the map is 25×17 on Easy, 27×17 on Medium and 29×19 on Hard. There are no creatures, tools or riddles.
2. **The fall**: a slow, dreamy nine-second fall down the rabbit hole, past cupboards, bookshelves, maps, jars and clocks (a tap or any key skips it). In the 2D view it's a "Down, down, down…" card. The White Rabbit loses his watch on the way down.
3. **Tea Party** ☕: the Queen's rose garden, with dark clipped hedges dotted with red and white roses, rosy gravel and golden evening light. Alice lands still tiny (30% of her height), too small for anyone to hear her: friends just block her way. The Caterpillar sits on his red-spotted mushroom a short walk from the start, two turns in, before the first friend. Walking into him gives her a bite: she grows back to her proper size and he waves goodbye. In 3D the camera comes down with her while she's tiny, so the hedges tower overhead.

The Tea Party maze is 25% bigger than the others: 29×17 on Easy, 43×23 on Medium and 57×31 on Hard.

There are no tools in the Tea Party and nobody can hurt Alice. The friends in the maze are the Cheshire Cat, the Dog and the White Rabbit (the Hatter and the Queen are at the table). Walking into a friend brings up a riddle on their theme (the White Rabbit's are about time, the Cat's about grins and vanishing, the Dog's about bones and play), with three picture answers. A wrong answer brings another riddle; three wrong answers send Alice back to the start, though friends she has already helped stay helped. A right answer makes the friend step aside.

**The tea party** ☕ is laid in a round, open clearing on a lawn in the middle of the maze, with one gap in its hedge. A ☕ marker shows it on the map and mini-map, even through the fog.
- **The guests:** the Mad Hatter, the March Hare and the Queen of Hearts stand round a big table laid for tea. The Dormouse is asleep in a teapot on it. There's one empty chair, at the near end.
- **Arriving:** as Alice walks into the clearing, the guests cry "No room! No room!", then the Queen gives in: "…Oh, all right. Take a seat, Alice!" Walking into a guest gets a line from them.
- **Sitting down:** when Alice walks into the chair, the arrows stop working, the chair slides out and she sits. In 3D the camera rises behind her to watch the table.
- **Pour the tea:** "You pour, Alice, but mind whose cup is whose!" A card shows four cups and the four guests. The cups are hearts for the Queen, a top hat for the Hatter, a carrot for the March Hare and a moon for the Dormouse. Tap a cup, then whose it is (or the guest first). The right guest says thank you. Anyone else says "That's not my cup!" and hands it back, with no penalty. Once every cup is full, everyone sips.
- **The raven:** the Hatter asks "Why is a raven like a writing-desk?", Alice gives up, and he hasn't the slightest idea either. This part is just for fun.
- **Change places!** "Clean cup, clean cup! Move down!" A card shows the table from above, with each guest's cup in front of them and Alice's marked with a ⭐. The cups turn plain and slide one place round the table: once on Easy, twice on Medium, three times on Hard. Then tap the cup that's Alice's now. A wrong one shows whose it is, with as many tries as needed.
- **The Hatter's riddle:** "Let's see if you can solve MY riddle!" A riddle pops up with three picture answers. A wrong answer brings another riddle, as many times as it takes, and never sends Alice away.
- **The golden key** 🔑: the right answer earns it from the Queen. Alice holds it up, then gets up from the table and can walk again. The key shows in her hand and in the top bar.
- **Captions:** storybook captions tell each beat. A tap, Space or Enter skips to the next beat (not while a puzzle or the riddle is up). The puzzle cards have big buttons for a finger on an iPad, and work with a mouse, or Tab and Enter, too.
- **The exit** is a garden gate with a golden padlock. It stays locked until Alice has the key, then swings open.

Play it as a **3D walk** through the hedges, with the camera just behind Alice so you watch her walk.
- **Behind camera:** it sits a little to her right and well above her head, looking down along the path. Alice stays in view at the left, and the middle of the screen is clear for what's ahead.
- **Zoom:** the camera eases back and widens down long straight corridors. It comes in close when she stands beside someone, or while a riddle is up.
- **X-ray glow:** anything Alice can pick up (a tool, the DRINK ME potion, the Rabbit's gloves and fan, the Caterpillar's mushroom) glows gold through her whenever she hides it. Characters never glow.
- **Landing:** after the fall Alice drops into the Tea Party, lies dazed for a moment, then slowly gets up. The camera watches from in front of her, then swings round behind her, and only then can she walk.

Press **C** or the camera button to switch to over her shoulder 🧍 (close behind and to her right, at about her head height), then through her own eyes 👀, then back again; a mini-map overlay shows where she is. Or play on a top-down **2D map**.

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

The tests pull the game-rules `<script id="logic">` out of `index.html` and check maze generation, fairness (every tool reachable before its creature, over 200 mazes per difficulty), movement, tools, wanderers, hearts, fog, turning, following corridors, ray casting and line of sight (what a hedge hides in 3D), the follow camera (never inside or against a hedge), the Tea Party (its clearing, the guests, sitting down, pouring the tea, changing places, the Hatter’s riddle and the golden key), and full simulated playthroughs.

## Handy URL options

- `index.html?seed=123` — the first maze uses this seed, so it's repeatable.
- `?debug` — exposes `window.mazelandGame()`, `window.mazelandMusic()`, `window.mazelandView()` and `window.mazelandWorld()` (the Three.js renderer and scene) for browser-console testing (read-only use), plus `window.mazelandDraw()` to draw a frame on demand (handy when the browser slows animation in a background tab). The 3D canvas keeps its last frame, so screenshots can read it.

URL options need the page served over http (`.claude/launch.json` has a tiny Node server on port 8765); opening the file directly works for normal play.

## Third-party

`vendor/three.min.js` is Three.js r159 (MIT licence, `vendor/three.LICENSE`), the last release with a plain-script build, so the game still opens straight from the file. It logs one harmless notice in the console that this build style is deprecated.
