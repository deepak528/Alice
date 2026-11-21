# Alice in Mazeland: design review for players aged 8–10

*Design agent, 20 Nov 2026, branch `feature/map-2` at `5c70965`. No code was changed.*

**How it was reviewed:** I played the game in the built-in browser at iPad landscape size (1024×768). I played Chapter 1's opening and maze start, the Tulgey Wood's opening and the fish bridge, and the Looking-Glass opening and glowing squares (including a wrong step). I took every puzzle's exact rules, hints and penalties from `index.html`. For the fish bridge I also ran a timing simulation of the real fish movement code to compare careful and random tapping. The Tea Party table scenes, croquet, the soldiers, the Jabberwock, the lullaby guards and the castle are judged from the code and README, not played by hand. They are marked *(code)* below.

> **The task list is out of date.** The brief lists ghost paths, fake openings, DRINK ME / EAT ME in the Wood, and "change places" at the tea table. None of these is in the game now: commit `4ddc89b` removed the Wood ones, and "change places" survives only in a CSS comment. The bridge with the fish is in **the Tulgey Wood**, not the Tea Party, and the Wood also has the card-soldier sneak. This review covers the game as it is.

---

## 1. Top 5 changes (ranked)

| # | Problem | Change | Effort | Impact |
|---|---|---|---|---|
| **1** | **Fish bridge (Tulgey Wood):** this is the hardest timing puzzle in the game, and it is the first thing in the chapter. A careful child has to tap about half a second *before* the fish arrives, because crumbs take 0.45 s to fall. The blue fish is under the gap for only about 0.7 s at a time. The gap has no marker on the water. On iPad the card covers the Rabbit's explaining bubble and the right half of the river. Every miss, even a koi taking the crumbs, sinks a piece the child has already earned. A quick double-tap right after a success sinks that new piece straight away, because the bread stays tappable. My simulation shows that **tapping at random solves it in about 45 s**, faster than playing carefully. So it punishes the careful child and rewards the child who mashes the button. | (a) Draw a glowing ring on the water under the gap, and make a glowing fish sparkle or say "Now!" while it is inside the ring. (b) Turn the bread off for about 1.2 s after each tap (crumbs falling, fish leaping). (c) A koi taking the crumbs costs nothing; only the greedy fish sinks a piece. (d) After 3 misses in a row, the Rabbit says "Wait until a glowing fish is in the ring… now!", and the greedy fish swims off for 20 s. (e) Make the card smaller or move it down, so the river and the Rabbit stay in view. | M | **High** |
| **2** | **Soldier sneak (Wood):** *(code)* When a soldier catches Alice, she is chained and can't move for **20 s**, then sent back to the end of the bush maze. That can happen 3 times before the soldiers slow down, which is a minute of standing still. The brown dry bushes differ from the green ones mostly by colour, which is hard to see for the roughly 1 in 12 boys with red–green colour blindness. | Cut the chain to 8 s and let the child tap the padlock to break it faster ("Wiggle!"). Slow the soldiers after the **2nd** catch, not the 3rd. Give dry bushes a shape cue, such as bare twigs, falling leaves, or the 🍂 shown above them in 3D. | S | High |
| **3** | **Riddles are pitched at 5–6-year-olds.** Most friend and Wood riddles are things like "What sound does a puppy make?" or "I say meow. What am I?", and a wrong answer is often "A sock". An 8–10-year-old finds these babyish. Only the Hatter's table riddles (sponge, egg, footsteps, your age) fit this age. | Use the Hatter's style of riddle everywhere: rewrite or replace about half of each pool with real "What am I?" riddles. On Medium and Hard, offer 4 answers instead of 3. Keep the current riddles for Easy. | S | High |
| **4** | **Long talks at the Rabbit's slow 0.8× pace.** The Rabbit was recorded slowly "so little ones can follow". At 8–10 that feels slow. The Wood's bush talk is 6 lines in a row, and the Looking-Glass opening is about 30 s before anything moves. A child who reads ahead taps to skip and then misses the rules (the yellow V, the dry bushes, the greedy fish). | Re-record the Rabbit at normal (1.0×) pace. Cut the bush talk to 3 lines. Put each rule on screen as a small picture tip on the puzzle card (for example 🟨 "Don't step in the yellow", 🍂 "Dry bushes rustle"), so a child who skipped can still learn it. | M | High |
| **5** | **Hints are uneven.** The Cheshire grin helps in the mazes (after 8 s standing still or 3 dead ends), and the board gives a hint after 2 misses. But the fish, the soldiers, the cake, the pour, the lullaby bells and the flowers have **no stuck hint at all**: a wrong try only repeats the same thing. | Add one shared rule: **2 misses → a spoken tip; 3 misses → the next correct thing glows**. For example: the next bell or flower glows, the right cake topping wiggles, the gold line pulses, the fish ring flashes. | M | Med–High |

Next best after these five: show how long the lullaby guards will sleep (§2, Looking-Glass). Add a hint line to the little door (§2, Tea Party). Fix the leftover Wood caption that says "nothing was quite what it seemed" (§3).

---

## 2. Puzzle by puzzle

Ratings: **Too easy / Right / Hard but fair / Too hard**, for an 8–10-year-old on their own.

### Chapter 1: Follow the White Rabbit

| Puzzle / scene | Rating | Why (what the child sees and hears) | Hint gap | Suggested change |
|---|---|---|---|---|
| Garden opening (~18 s) | Right | Clear captions, the sister's line, and the Rabbit's "Follow me!". A tap skips it. Played: works. | none | none |
| Follow the Rabbit through the maze | Too easy (by design) | The Rabbit waits at every corner, and paw prints show the way. An intro that can't fail is fine. | none | Make the optional gloves and fan feel worth it. They earn only a thank-you; a small "2 of 2 found" or a sparkle in the sticker book would reward an explorer. (S, low) |
| DRINK ME → rabbit hole | Right | Too big for the hole → drink → pulled in → stopwatch sticker. A good first "aha". | none | none |

### The fall
9 s, can't be skipped, and it's lovely. Keep it.

### Chapter 2: The Tea Party

| Puzzle / scene | Rating | Why | Hint gap | Suggested change |
|---|---|---|---|---|
| Landing and Rabbit welcome | Right | Short, warm, and can be skipped. | none | none |
| Three little doors + mushroom | Hard but fair | The door says "you are too big" but gives no clue what to do. The mushroom is tucked behind a bush in a corner. A child may walk round the lawn for a while. The grin points to the mushroom after 8 s standing still, but a child who is *walking around* is not standing still. | The door's line gives no hint | Second bump on a door: "Perhaps something in this garden could make you smaller…" (S, med) |
| Two dead-end doors | Right | Short, with a DEAD END sign. No penalty. | none | none |
| Caterpillar "Who are you?" | Too easy | Three pictures, one of which is Alice. Charming, but there is nothing to work out. | none | Fine as a breather. On Medium and Hard, ask something about her journey: "What did you drink to get so small?" with pictures 🧪 / 🍰 / ☕. (S, low) |
| Latch gate (grow first) | Right | It makes size matter twice. | If tiny Alice is at the gate with no Caterpillar found yet | Tiny Alice bumping the gate: "The latch is too high… maybe someone nearby can help you grow." (S, low) |
| Friends' riddles (×2) | **Too easy** | Picture answers with joke wrong answers ("A sock"). Wrong → another riddle, as many times as needed, so random tapping wins in about 3 taps. | none | See Top-5 #3. |
| Singing flowers (optional) | Too easy | Only 3 notes, by position. | No escalation | Grow it: 3 notes, then a 5-note encore for a bonus star. (S, low) |
| Paint the roses (optional) | Too easy | Tap 5 roses × 3 bushes. Satisfying but no thinking. | none | Fine as optional. The ⭐ is only shown at the end; show it when earned. (S, low) |
| Arriving, "No room!" | Right | Funny, short. | none | none |
| Pour the tea *(code)* | Right | Hold for about 1.7 s, then let go during a 0.7 s window. "A little more!" or spill, then retry. It's a good touch game for iPad. | No help after repeated spills | After 2 spills, the gold line pulses and the teapot pours more slowly. (S, med) |
| Raven riddle | Right | A joke from the book. Short. | none | none |
| Decorate the cake *(code)* | Right (Easy) / Hard but fair (Hard, 4 toppings) | The order is shown as pictures, with the next one ringed, so it's mostly a matching task. | none needed | none |
| Hatter's riddle → golden key | Right | The only riddle pool at the right level. | none | none |
| Croquet *(code)* | Right, and great fun | Aim plus a power bar. The Queen only aims true while she's behind, so Alice always wins. It's lively, physical, and you can't lose. | none needed | none |
| Unbirthday present | Right | Tap to open → teapot sticker. | none | none |
| The table scene as a whole | Pacing issue | From sitting down to standing up is about 8–10 min seated with no walking (pour → raven → cake → riddle → key → croquet → present). | n/a | Let Alice stand up and **walk** to the croquet ground instead of jumping straight to it; that breaks up the sitting. (M, med) |
| Gate → mud slide | Right | 16 s ride with fireflies to catch by leaning. A good reward. | none | Show the fireflies caught on the next screen, e.g. "✨ 4 of 6!" (S, low) |

### Chapter 3: The Tulgey Wood

| Puzzle / scene | Rating | Why | Hint gap | Suggested change |
|---|---|---|---|---|
| Opening (title, caption, 3 Rabbit lines) | Right, a little slow | Played: about 35 s at the Rabbit's slow pace before Alice can walk. | none | Normal-pace Rabbit (Top-5 #4). |
| **Fish bridge** (worked example below) | **Too hard for a careful child; too easy for a masher** | See below. | No stuck hint at all | Top-5 #1 |
| Bush maze | Right | Short, 7 tiles. | none | none |
| Rabbit's bush talk (6 lines) | Too long | A child stops listening by line 3, and the rules are in lines 3–5. | Rules aren't shown again on screen | Cut to 3 lines. Show picture rules in the top bar while sneaking. |
| Sneak past the soldiers *(code)* | Hard but fair → **Too hard after 2 catches** | The yellow cones are a clear "don't be seen" picture. The surprise dry bush and the soldier who turns round add depth. But each catch means 20 s chained, then walking back. | Slowing only after 3 catches | Top-5 #2 |
| Cat's riddle (wall of trees) | Too easy | Same easy riddle pool ("I say meow"). The "walk into the trees" idea is good. | none | Harder riddle (Top-5 #3). |
| Wood creatures | Right | Funny bumps, optional. | none | none |
| Firefly trail | Right | The golden fireflies always mark the next 4 tiles, a gentle permanent guide. | none | none |
| **Jabberwock chase** *(code)* | Right, the most exciting moment | It bursts out 4 tiles behind her and is a little slower than she walks. If it catches her, she goes back 5 tiles and it leaves for good. Scary but fair. | none needed | Shake the screen a little and boom its footsteps louder as it closes in, so the child *feels* the chase. (S, med) |
| Finding the Cat + party | Right | A good payoff, with the 😸 sticker. | none | none |

#### The fish bridge in full (the example the owner asked for)

**What the child sees and hears first.** Walking up the bridge, the Rabbit is across the gap. At the edge, Alice sits down and the camera swings round to look down into the river. *At the same moment* the "Feed the glowing fish" card opens on the right. On a 1024×768 iPad it covers about half the scene, including the Rabbit and his speech bubble. I could only read "But don't feed the greedy grey fish, or a koi. A pi…" before the card covered the rest. The Rabbit's three explaining lines are also heard aloud, so a listening child gets the rule. A child who reads instead of listening, or who has the sound off, sees half a sentence.

**Does the child understand?** "Glowing fish good, grey fish bad" comes across: the glowing fish have a bright halo on the water and the card says so. The hard part is "*just as* it swims under the gap". **The gap is not marked on the water**, and from the camera angle the water under the gap is partly hidden by the bridge and by Alice. The child doesn't know where "under the gap" is, so they tap when a fish looks close.

**The timing (from the real fish code):**
- Of all the moments a child might tap, about 38% would feed a glowing fish, 15% the greedy fish, and **47% a koi**.
- Blue fish: under the gap about 11 times a minute, for **0.7 s** each time. Violet fish: 9 times a minute, about 1.0 s. Gold fish: 7 times a minute, about 1.7 s.
- Crumbs take 0.45 s to land, so a careful child who waits until the fish is right underneath and then taps is often already late for the blue fish.

**When they get it wrong.** A line of text, e.g. "Gulp! A koi snapped up the crumbs.", and **the last piece put back sinks**, even if the miss was a koi. That line is not read aloud. Worse, after a success the bread is still active. A child who double-taps in excitement (very common on iPad) sends the second handful to a koi, because that fish has already been fed, and *the piece they just earned sinks at once*.

**How long it takes.** In the simulation, a child tapping at random about twice a second finishes in **about 45 s** (most within about 1.5 min), because successes and misses come out roughly even. A careful child who taps once per fish visit takes 2–4 min and is told off for every early or late tap. That's backwards: the puzzle rewards mashing and frustrates thinking. **This is the most likely place for a child to give up**, especially a careful one with the sound off.

**Rating:** Too hard for the careful child, too easy for the masher. **Fix:** Top-5 #1 (ring on the water, a "Now!" sparkle, a short pause after each tap, koi misses cost nothing, a hint after 3 misses, a smaller card).

### Chapter 4: Looking-Glass

| Puzzle / scene | Rating | Why | Hint gap | Suggested change |
|---|---|---|---|---|
| Opening (storyteller + Rabbit) | Right, slow | Played: about 30 s before the first squares show. | none | Normal-pace Rabbit. |
| Glowing squares (12, in 3 stretches of 4) | Right / Hard but fair | Played: the squares light up with do-mi-so-do chimes, and a wrong step makes the square wobble red, then the stretch shows again. Remembering 4 squares is about right for this age, and each stretch gets a little quicker. **But** the glow is pale yellow on the ivory squares and a muddy olive on the black squares, both low contrast on an iPad in daylight. | Good: a tip after 2 misses, the kitten mews from the right square, and the squares stay lit after 3 misses | Make the glow a saturated gold with a white outline, plus a little rising sparkle, so it shows on both colours. (S, high) |
| Chess pieces' jokes and tips | Right | Funny and useful. They use the device voice, which sounds unlike the recorded voices. | none | Record them later if budget allows. |
| Lullaby guards (3, then 4, then 5 bells) *(code)* | Hard but fair | A 5-note tune is a fair test of memory at 8–10. But a sleeping guard **wakes after 30 s** of play, and nothing on screen says this, so a child who wanders off between guards loses progress without knowing why. | A wrong bell only replays the tune | Show a shrinking "Zzz" cloud over each sleeping guard, or simply don't wake them on Easy. After 2 wrong tries, the next bell glows. (S, med) |
| Kitten → castle hedge maze | Right | Dinah leads; a dead end just bumps Alice back to the last turn. Calm, nice pacing after the guards. | none | none |
| Queens' feast and wake-up | Right, a lovely ending | The table topples, everything goes white, and Alice wakes at home with the kitten in her lap. It closes the circle with the garden of Chapter 1. | n/a | none |

---

## 3. Chapter pacing notes

Estimated times on Easy, for a child playing on their own:

| Chapter | Estimate | Notes |
|---|---|---|
| 1. Follow the White Rabbit | 3–4 min | Brisk. Good. |
| The fall | 9 s | Keep. |
| 2. Tea Party | 15–22 min (+3 for the optional flowers and roses) | The longest chapter by far, and **about half of it is sitting at the table**. The maze part (doors, mushroom, Caterpillar, gate, 2 riddles) is varied and good. The table part has 7 beats in a row with no walking. Croquet saves it. |
| The mud slide | 16 s | A great breather and reward. |
| 3. Tulgey Wood | 10–16 min | The **difficulty spikes at the very start** (the fish), then the soldiers, then the maze is easy and the Jabberwock is a high point. The leftover opening caption ("where nothing was quite what it seemed…", `index.html:3109`) promises tricks that were removed; change it to something like "…a sunny wood, where the Cheshire Cat was hiding." |
| 4. Looking-Glass | 8–12 min | Well paced: memory, then music, then a calm maze, then the ending. |
| **Total** | **about 40–55 min** | Good for 2–3 sittings. The chapter cards let a child pick up where they left off. |

**Difficulty curve:** easy (Ch 1) → easy, with lots of small tasks (Ch 2) → **sudden spike** (Ch 3: fish, then soldiers) → moderate (Ch 4). The curve is not smooth: the two hardest skill puzzles sit together at the start of Chapter 3, straight after the chapter with no failure at all. Making the fish gentler (Top-5 #1) and shortening the chain (Top-5 #2) smooths it. Chapter 2's riddles could rise a little (Top-5 #3), so the step up is shared out.

**Talky stretches where a child stops listening:** the Wood's bush talk (6 Rabbit lines), the Looking-Glass opening (about 30 s), and the run of table speeches between pour and cake.

**Longest stretch with no reward or surprise:** the Tea Party maze on Medium and Hard (35×19 / 45×25) between the gate and the second friend. There are no collectables on the main path. A few optional "tea-cake crumbs" or a wandering hedgehog would help (see ideas).

**Most fun moment:** the mud slide and croquet in Chapter 2, and the Jabberwock chase in Chapter 3.
**Most likely quit point:** the fish bridge (Ch 3), then being chained by the soldiers for the second or third time.

---

## 4. New ideas (small, in the game's style)

1. **Dinah's paw-print stamp:** after each chapter, the child taps a big paw to "stamp" the sticker book page, with a purr. A tiny ritual this age loves. (S)
2. **Hatter's silly hat shop:** at the unbirthday present, the child picks one of 3 silly hats for Alice (teapot hat, rose hat, chess-crown). She wears it for the rest of the game, including in the ending scene. (M)
3. **Talking-flower gossip:** in the Tea Party maze, a few roses whisper a funny tip as Alice passes ("Psst, the Caterpillar is THAT way… don't tell him I said!"). It rewards exploring and adds surprise on the long stretches. (S)
4. **Jabberwock near-miss slow-motion:** if Alice reaches the Cat with the Jabberwock 1 tile behind, a half-second slow-motion moment and the Cat's "Just in time!" make a story they will tell their parents. (S–M)
5. **The Queen's "Off with their heads!" at croquet:** when Alice scores, the Queen huffs and shouts it at a nearby flamingo or soldier, who runs off comically. It's a famous line from the book, and 8–10-year-olds will find it hilarious. (S)

---

## 5. Questions for the owner (multiple-choice)

1. **Fish bridge, how gentle?**
   a) Everything in Top-5 #1 (ring, "Now!" sparkle, pause after each tap, koi misses free, hint after 3 misses) *(recommended)*
   b) Only the ring and the pause after each tap
   c) Keep the timing and add only a hint after 3 misses

2. **Soldier chain time when caught?**
   a) 8 s, and tapping the padlock breaks it sooner *(recommended)*
   b) 12 s, no tapping
   c) Keep 20 s

3. **Riddle difficulty?**
   a) Harder "What am I?" riddles on Medium and Hard; keep the easy pool on Easy *(recommended)*
   b) Harder riddles on every level
   c) Keep them as they are (simple on purpose)

4. **The White Rabbit's voice pace?**
   a) Re-record at normal pace now that players are 8–10 *(recommended)*
   b) Keep 0.8× but shorten his talks
   c) Keep as is

5. **The lullaby guards waking up?**
   a) Show a shrinking "Zzz" timer over each guard *(recommended)*
   b) Guards never wake on Easy; keep waking on Medium and Hard
   c) Keep as is

6. **The Tea Party table scene?**
   a) Let Alice stand and walk to the croquet ground between cake and croquet *(recommended)*
   b) Drop the raven beat to shorten it
   c) Keep it as one seated scene

---

### Side note for the Testing agent (not a design point)
At 1024×768, the start menu's "Alice in Mazeland" title is cut off at the top of the card. The card scrolls, but the title is half off-screen when the menu first opens.
