# Harder riddles for Medium and Hard (draft)

Owner's choice from the design review (reports/design-review.md, section 1 item #3, answer 3a): Medium and Hard get real
"What am I?" riddles with **4 answers**; Easy keeps today's riddles with 3 answers, unchanged.

Nothing in `index.html` has been changed. Everything below is ready to paste.

## Where the riddles live today

All the pools are in one object, `const RIDDLES = { … }`, at **index.html:2558–2616**, in the UI script (the second
`<script>`, from line 2522), **not** in the logic script (`<script id="logic">`, 543–2512). The tests and
`tools/make-voices.js` load only the logic script, so they never see `RIDDLES`.

Format of every entry: `{ q: '…', answers: [[emoji, label], [emoji, label], [emoji, label]], right: <index> }`.
Strings are single-quoted and use curly apostrophes (’), so nothing needs escaping.

| Pool key | Lines | Who asks it | Theme | Riddles now | Actually asked today? |
|---|---|---|---|---|---|
| `rabbit` | 2559–2566 | White Rabbit (Tea Party friend) | time, clocks | 6 | Yes (`TEA.friends`) |
| `queen` | 2567–2574 | Queen of Hearts | roses, crown, cards, tarts | 6 | **No**: `TEA.friends` (index.html:583) is `['hatter', 'cat', 'dog', 'rabbit']`; the Queen is only a table guest. Pool looks unused. |
| `hatter` | 2575–2582 | Mad Hatter, as a friend in the maze (always one of the two) | tea, hats, party | 6 | Yes |
| `table` | 2583–2591 | Mad Hatter at the tea table (`TABLE_RIDDLER`); a right answer wins the golden key | classic riddles (already the target level) | 6 | Yes |
| `wood` | 2592–2599 | Cheshire Cat's grin, Tulgey Wood (`WOOD_RIDDLER`); a right answer opens the hidden path | the wood, Wonderland | **5** | Yes |
| `cat` | 2600–2607 | Cheshire Cat (Tea Party friend) | cats, grin, vanishing | 6 | Yes |
| `dog` | 2608–2615 | Puppy (Tea Party friend) | puppies | 6 | Yes |

Picker: `openRiddle(c)` at **index.html:4616–4640**. It chooses the set (`c.table ? 'table' : c.wood ? 'wood' : c.type`),
draws a riddle not yet asked this game (`asked` map, cleared at 2970), shows the buttons and reads the riddle aloud.

## The new pools

Suggested name: `HARD_RIDDLES`, same keys as `RIDDLES`, placed straight after it (after index.html:2616). Each pool has
6 riddles (the `wood` pool goes from 5 to 6). In every pool `right` covers 0, 1, 2 and 3.

```js
  // Medium and Hard: real riddles, four answers each, one right (index in `right`). Easy keeps RIDDLES above.
  const HARD_RIDDLES = {
    rabbit: [
      { q: 'I have twelve months, but I’m never more than one year old. What am I?', answers: [['👶', 'A baby'], ['📅', 'A calendar'], ['🎂', 'A birthday cake'], ['🕰️', 'A clock']], right: 1 },
      { q: 'What comes once in a minute, twice in a moment, but never in a thousand years?', answers: [['⏱️', 'A second'], ['😉', 'A blink'], ['💓', 'A heartbeat'], ['Ⓜ️', 'The letter M']], right: 3 },
      { q: 'I’m always coming, but I never arrive. When I get here, I’m called today. What am I?', answers: [['🌅', 'Tomorrow'], ['📬', 'The post'], ['🚂', 'A late train'], ['🎂', 'Your birthday']], right: 0 },
      { q: 'I fly when you’re having fun, but I have no wings. The Rabbit never has enough of me. What am I?', answers: [['🦋', 'A butterfly'], ['🎈', 'A balloon'], ['🐝', 'A bee'], ['⏳', 'Time']], right: 3 },
      { q: 'Thirty days has September… but how many months have twenty-eight days?', answers: [['❄️', 'Only February'], ['🌗', 'Half of them'], ['📅', 'All twelve'], ['🔟', 'Ten']], right: 2 },
      { q: 'I’m tall when I’m young and short when I’m old, and I glow as the hours pass. What am I?', answers: [['🌳', 'A tree'], ['🕯️', 'A candle'], ['🦒', 'A giraffe'], ['🌙', 'The moon']], right: 1 },
    ],
    queen: [
      { q: 'I have thirteen hearts, but not one of them beats. What am I?', answers: [['💌', 'A love letter'], ['🌹', 'A rosebush'], ['🍓', 'A strawberry'], ['🃏', 'A pack of cards']], right: 3 },
      { q: 'I can prick your finger, yet I smell sweet, and the Queen wants me red. What am I?', answers: [['🌵', 'A cactus'], ['🌹', 'A rose'], ['🦔', 'A hedgehog'], ['🌷', 'A tulip']], right: 1 },
      { q: 'The Knave of Hearts stole them, all on a summer’s day. What did he steal?', answers: [['🍪', 'Biscuits'], ['🍰', 'A cake'], ['🥧', 'Tarts'], ['🍩', 'Doughnuts']], right: 2 },
      { q: 'At the Queen’s croquet game, the mallets are tall pink birds. What are they?', answers: [['🦩', 'Flamingos'], ['🦢', 'Swans'], ['🦜', 'Parrots'], ['🦆', 'Ducks']], right: 0 },
      { q: 'I wear a crown, but I’m not a queen. I’m prickly outside and sweet inside. What am I?', answers: [['👸', 'A princess'], ['🌰', 'A chestnut'], ['🦔', 'A hedgehog'], ['🍍', 'A pineapple']], right: 3 },
      { q: 'In the Queen’s croquet, the balls curl up tight, then unroll and wander off! What are they?', answers: [['🐢', 'Tortoises'], ['🦔', 'Hedgehogs'], ['🐌', 'Snails'], ['🐞', 'Ladybirds']], right: 1 },
    ],
    hatter: [
      { q: 'I start with T, I end with T, and I’m full of tea. What am I?', answers: [['⛺', 'A tent'], ['🎟️', 'A ticket'], ['🫖', 'A teapot'], ['🍞', 'Toast']], right: 2 },
      { q: 'Which cup can never hold a drop of tea?', answers: [['🌼', 'A buttercup'], ['☕', 'A teacup'], ['🥤', 'A paper cup'], ['🍵', 'A tea bowl']], right: 0 },
      { q: 'I have a brim but no water, and a band but no music. What am I?', answers: [['🥣', 'A bowl'], ['🥁', 'A drum'], ['🌊', 'A river'], ['🎩', 'A hat']], right: 3 },
      { q: 'Drop me in your tea and I vanish, yet the tea tastes sweeter. What am I?', answers: [['🧊', 'Ice'], ['🍬', 'Sugar'], ['🍋', 'Lemon'], ['🥛', 'Milk']], right: 1 },
      { q: 'I have a head and a tail, but no body. The Hatter pays for hats with me. What am I?', answers: [['🪙', 'A coin'], ['🐍', 'A snake'], ['🐟', 'A fish'], ['🎀', 'A ribbon']], right: 0 },
      { q: 'I have four legs and a back, but I never walk. At the Hatter’s party, everyone moves to a new one!', answers: [['🐕', 'A dog'], ['🐴', 'A horse'], ['🪑', 'A chair'], ['🐢', 'A tortoise']], right: 2 },
    ],
    // The Mad Hatter's own, at the tea table: any right answer wins the golden key.
    table: [
      { q: 'I have lots of keys, but I can’t open a single lock. What am I?', answers: [['🚪', 'A door'], ['📦', 'A box'], ['🎹', 'A piano'], ['🔐', 'A padlock']], right: 2 },
      { q: 'I have one eye, but I can’t see a thing. The Hatter sews hats with me. What am I?', answers: [['🪡', 'A needle'], ['🦉', 'An owl'], ['🧵', 'Thread'], ['🔭', 'A telescope']], right: 0 },
      { q: 'What can you catch, but never throw?', answers: [['⚽', 'A ball'], ['🎣', 'A fish'], ['🥏', 'A frisbee'], ['🤧', 'A cold']], right: 3 },
      { q: 'The more you take away from me, the bigger I get. What am I?', answers: [['🍰', 'A cake'], ['🕳️', 'A hole'], ['🏔️', 'A mountain'], ['🧶', 'A ball of wool']], right: 1 },
      { q: 'It belongs to you, but your friends use it far more than you do. What is it?', answers: [['🎒', 'Your bag'], ['🧸', 'Your teddy'], ['🏷️', 'Your name'], ['🚲', 'Your bike']], right: 2 },
      { q: 'I’m so delicate that if you say my name, I break. What am I?', answers: [['🤫', 'Silence'], ['🥚', 'An egg'], ['❄️', 'A snowflake'], ['🪞', 'A mirror']], right: 0 },
    ],
    // The Cheshire Cat's, in the Tulgey Wood: a right answer shows Alice the hidden path.
    wood: [
      { q: 'I run through the wood but never walk. I have a mouth but never talk. What am I?', answers: [['🐇', 'A rabbit'], ['🏞️', 'A river'], ['🌬️', 'The wind'], ['🐸', 'A frog']], right: 1 },
      { q: 'The more of me there is, the less you can see. What am I?', answers: [['🔦', 'A torch'], ['🌞', 'Sunshine'], ['🦉', 'An owl'], ['🌑', 'The dark']], right: 3 },
      { q: 'I follow you all day through the wood, but I vanish when the sun goes in. What am I?', answers: [['👤', 'Your shadow'], ['🐈', 'A cat'], ['🐝', 'A bee'], ['🦋', 'A butterfly']], right: 0 },
      { q: 'Which tree can you hold in your hand?', answers: [['🌲', 'A pine tree'], ['🎄', 'A Christmas tree'], ['🌴', 'A palm tree'], ['🌳', 'An oak tree']], right: 2 },
      { q: 'Give me wood and I grow. Give me water and I’m gone. What am I?', answers: [['🌱', 'A seedling'], ['🔥', 'A fire'], ['🦫', 'A beaver'], ['🌵', 'A cactus']], right: 1 },
      { q: 'I say “who, who”, but I never ask a question, and I sleep all day. What am I?', answers: [['🐛', 'The Caterpillar'], ['🦇', 'A bat'], ['🦊', 'A fox'], ['🦉', 'An owl']], right: 3 },
    ],
    cat: [
      { q: 'My name starts with “cat”, but I have no fur and lots of legs. What am I?', answers: [['🐈', 'A kitten'], ['🐛', 'A caterpillar'], ['🐜', 'An ant'], ['🐙', 'An octopus']], right: 1 },
      { q: 'What do cats have that no other animal has?', answers: [['🐾', 'Paws'], ['👂', 'Pointy ears'], ['👅', 'Rough tongues'], ['🐈', 'Kittens']], right: 3 },
      { q: 'Dinah’s mother had three kittens: Sooty, Tibbles and… who?', answers: [['🐈', 'Dinah'], ['❄️', 'Snowball'], ['☁️', 'Fluffy'], ['🧦', 'Socks']], right: 0 },
      { q: 'The more Dinah plays with me, the longer and thinner I get. What am I?', answers: [['🐭', 'A mouse'], ['🎈', 'A balloon'], ['🧶', 'A ball of wool'], ['🪀', 'A yo-yo']], right: 2 },
      { q: 'Dinah curls up on me, but I vanish the moment you stand up. What am I?', answers: [['🪑', 'A chair'], ['🧺', 'A basket'], ['🛏️', 'A bed'], ['🦵', 'Your lap']], right: 3 },
      { q: 'What is a happy cat’s favourite colour?', answers: [['🔴', 'Red'], ['🟣', 'Purr-ple'], ['🟢', 'Green'], ['🔵', 'Blue']], right: 1 },
    ],
    dog: [
      { q: 'A puppy chases me round and round, but never catches me. What am I?', answers: [['🦋', 'A butterfly'], ['🐈', 'A cat'], ['🐕', 'His own tail'], ['⚽', 'A ball']], right: 2 },
      { q: 'I have a bark, but no fur and no voice. What am I?', answers: [['🌳', 'A tree'], ['🐶', 'A puppy'], ['🦊', 'A fox'], ['🐸', 'A frog']], right: 0 },
      { q: 'Which dog can’t bark or wag its tail, but tastes good in a bun?', answers: [['🐕', 'A sausage dog'], ['🍔', 'A burger'], ['🥪', 'A sandwich'], ['🌭', 'A hot dog']], right: 3 },
      { q: 'Which dog always knows what time it is?', answers: [['🐩', 'A poodle'], ['⌚', 'A watchdog'], ['🥊', 'A boxer'], ['🐑', 'A sheepdog']], right: 1 },
      { q: 'I’m a little house with no stairs and no kitchen, and a puppy sleeps inside me. What am I?', answers: [['🛖', 'A kennel'], ['⛺', 'A tent'], ['🏰', 'A castle'], ['🏡', 'A cottage']], right: 0 },
      { q: 'A puppy buries me in the garden, but I’ll never grow. What am I?', answers: [['🌱', 'A seed'], ['🌷', 'A bulb'], ['🦴', 'A bone'], ['🥕', 'A carrot']], right: 2 },
    ],
  };
```

## Answers, for review

### rabbit (time) — replaces index.html:2559–2566 on Medium/Hard
1. **A calendar**: it has twelve months, and a new one is bought every year.
2. **The letter M**: the word "minute" has one M, "moment" has two, "thousand years" none. (Works best read on the card; heard aloud it is a little harder.)
3. **Tomorrow**: it is always on its way, and once it comes it is today.
4. **Time**: "time flies when you're having fun"; the Rabbit is always late.
5. **All twelve**: every month has at least 28 days. Uses the old rhyme "Thirty days hath September" (traditional).
6. **A candle**: it burns shorter as the hours pass (candle clocks once told the time).

### queen (hearts, roses, croquet) — index.html:2567–2574 (pool not asked today, see table above)
1. **A pack of cards**: the suit of hearts has thirteen cards.
2. **A rose**: thorns prick, it smells sweet, and the Queen wants her roses red. A cactus and a hedgehog prick but don't smell sweet; a tulip smells but doesn't prick.
3. **Tarts**: the traditional nursery rhyme, used in the book's trial scene.
4. **Flamingos**: the Queen's croquet mallets in the book.
5. **A pineapple**: it has a leafy crown, a prickly skin and sweet fruit. A princess has a crown but isn't prickly; a chestnut and a hedgehog are prickly but have no crown.
6. **Hedgehogs**: the croquet balls in the book (and in the game's own croquet), which curl up and walk off.

### hatter (tea, hats, party) — replaces index.html:2575–2582 on Medium/Hard
1. **A teapot**: T-eapo-T, full of tea. A tent, a ticket and toast also start and end with T, but hold no tea.
2. **A buttercup**: a flower, not a cup.
3. **A hat**: it has a brim and a hatband. A bowl has a brim and holds water; a drum is in a band.
4. **Sugar**: it dissolves and makes tea sweeter. Ice melts but doesn't sweeten; lemon and milk don't vanish.
5. **A coin**: heads and tails, no body. The Hatter's hat price tag says "10/6".
6. **A chair**: four legs and a back; at the Mad Tea Party everyone moves round to the next chair.

### table (the Hatter's golden-key riddles) — replaces index.html:2584–2591 on Medium/Hard
1. **A piano**: piano keys open no locks.
2. **A needle**: the eye of a needle; the Hatter makes hats.
3. **A cold**: you catch a cold, but you can't throw one.
4. **A hole**: dig more out and it grows.
5. **Your name**: other people say your name far more than you do.
6. **Silence**: saying "silence" breaks it.

### wood (Cheshire Cat, Tulgey Wood) — replaces index.html:2593–2599 on Medium/Hard (5 riddles today, 6 here)
1. **A river**: rivers "run" and have a mouth where they meet the sea.
2. **The dark**: the more darkness, the less you see.
3. **Your shadow**: it follows you and fades when the sun goes behind a cloud.
4. **A palm tree**: your hand has a palm.
5. **A fire**: wood feeds it, water puts it out. (A gentle campfire; no danger in the wording.)
6. **An owl**: owls hoot "who, who" and sleep by day. The Caterpillar really does ask "Who are you?", and a bat sleeps by day but doesn't hoot.

### cat (Cheshire Cat as a friend) — replaces index.html:2601–2606 on Medium/Hard
1. **A caterpillar**: CAT-erpillar, no fur, lots of legs.
2. **Kittens**: only cats have kittens; lots of animals have paws, pointy ears or rough tongues.
3. **Dinah**: Dinah's mother's third kitten is Dinah herself (Dinah is Alice's cat).
4. **A ball of wool**: it unwinds as the cat bats it. (A yo-yo's string unwinds too, but winds back.)
5. **Your lap**: a cat sits on it, and when you stand up it's gone (a good Cheshire-Cat vanishing).
6. **Purr-ple**: a pun on a cat's purr.

### dog (puppy) — replaces index.html:2609–2614 on Medium/Hard
1. **His own tail**: puppies chase their tails round and round and can never catch them.
2. **A tree**: trees have bark but no fur and no voice.
3. **A hot dog**: a sausage in a bun. (A sausage dog is a real dog, so it can bark.)
4. **A watchdog**: a pun on a watch.
5. **A kennel**: a dog's little house.
6. **A bone**: dogs bury bones, but bones don't grow. A seed, a bulb and a carrot top are all planted.

### Checks made on every riddle
- Questions are about 20 words at most (the two longest, rabbit #4 and hatter #6, are 21).
- Every emoji is Unicode 13 or older and a single glyph (no flags, no ZWJ sequences). The newest used are 🫖 🪙 🪡 🦫 🛖 🪞 (all Unicode 13). Ⓜ️, 🕰️, 🕯️, 🎟️, 🏷️, 🕳️, 🏔️, 🏞️, 🌬️, 🛏️ carry the U+FE0F emoji selector, as the existing pools already do (e.g. 🖌️, 🛏️).
- British spelling (colour, favourite, torch, biscuits, ladybirds); nothing scary (no Jabberwock, no "off with their heads").
- `right` in each pool covers 0, 1, 2 and 3.

## Code that assumes 3 answers

None of these break with 4 answers; the work is choosing the pool by difficulty plus a few comments and one layout check.

| Where | What it assumes | Change for 4 answers |
|---|---|---|
| index.html:4618 (`openRiddle`) | Always reads `RIDDLES[set]`. | Pick the pool by level: `pool = (game.difficulty === 'easy' ? RIDDLES : HARD_RIDDLES)[set]`. `asked` is keyed by `set` and cleared on each new game (index.html:2970); a level change restarts the chapter (index.html:4669), so indexes from the two pools never mix. Check that the restart goes through that clear. |
| index.html:4630 | Voice line `"<q> Is it A, B, or C?"`, built from `slice(0, -1).join(', ')` | Works for any count ("A, B, C, or D?"). It is 1–2 s longer. These lines are template strings, so `tools/make-voices.js` never records them and they are read in the device voice; no new recordings are needed. |
| index.html:4632–4639 | Buttons built with `.map` and the first one focused. | Works for any count. No aria labels depend on the count (each button's name is its emoji plus label). |
| index.html:255–256 | Comment "three big picture answers"; `#riddle-answers` is a one-column grid. | Comment only. The 4th button adds one row (about 55 px) to the card. |
| index.html:381–389 | The right-side card: `max-width: 352px`, buttons with 8 px gaps and 1.6 rem emoji. | Card goes from about 400 px to about 455 px tall with a 3-line question. Check on iPad landscape with the toolbar showing; if it is tight, use a 2×2 grid for 4 answers (`#riddle-answers:has(> :nth-child(4)) { grid-template-columns: 1fr 1fr; }`). Labels like "A pack of cards" or "The Caterpillar" then need about 150 px per button, so check they wrap cleanly. |
| index.html:396 | Phone (≤ 560 px) layout centres the card. | Check that 4 rows still fit a phone in landscape. |
| index.html:2557 | Comment "Three answers each, one right". | Say "Easy: three answers"; the new pool has its own comment. |
| index.html:4611 | Comment "with three picture answers". | "three picture answers (four on Medium and Hard)". |
| index.html:3576–3608 | The Caterpillar's "Who are YOU?" uses the same card with a fixed list of 3. | Not a riddle pool; leave as is. |
| tests/game.test.js | No test reads `RIDDLES` or counts answers. Tests answer with `L.answer(g, true/false)` (e.g. lines 83, 878–893, 958–976), which doesn't care how many buttons there are. | Nothing breaks. `RIDDLES` is in the UI script, so a test of the new pools (4 answers each, `right` in 0–3, emoji present) would have to parse it out of index.html, as `tools/make-voices.js` does for the logic script. |

Side effect worth knowing: wrong answers just bring another riddle (design review, section 2), so guessing at random now
takes about 4 taps on average instead of 3.
