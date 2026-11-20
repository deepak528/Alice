# Playtest report: Alice in Mazeland

Branch `claude/playtest-fixes-c67c05` (cut from `feature/map-2` at `5c70965`). Played 2026-11-20 by the Testing agent.
Nothing pushed or merged.

## 1. Summary

- **Chapters played:** all four, start to finish, twice:
  - **From Start**, as one story: Chapter 1 → the fall → Tea Party → mud slide → Tulgey Wood → portal → Looking-Glass → castle → feast → waking up at home, at iPad landscape (1024×768).
  - **From each chapter's card**: Tea Party in portrait (768×1024) and landscape; Tulgey Wood in landscape (three times) plus portrait spot checks; Looking-Glass in portrait and landscape; castle and ending after each Looking-Glass run. Chapter 1's card is the default Start.
  - Desktop spot checks at 1440×900.
- **Bugs found:** 18, plus 1 unconfirmed. **Fixed:** 14 (one commit each). **Left for the owner:** 4, plus the unconfirmed one and a list of things that feel wrong (section 4).
- **The worst bug:** Alice's fall scream started **892 ms before** the narrator had finished "A stopwatch sticker for your book!". It was the one place two characters truly spoke at once. Everywhere else a new line cut the last one off, or followed it with almost no pause.
- **Voices after the fixes:** every scripted hand-off between speakers is **≥ 601 ms** (most are 850–1300 ms). The only gaps under 500 ms left come right after a child's tap: answering a riddle, placing a cake topping, a croquet shot, or the last fish feed. A tap cuts the line playing and the reply follows (see 3.2). Whether replies should wait is your call.
- **Tests:** 132 before, 145 after (13 new). All pass. Coverage of the game logic (`tests/game.test.js`): **99.63 % lines, 97.48 % branches, 98.67 % functions**, the same as before. The fixes are in the page's scene script, which Node can't run, so the new tests read that code as text and check that each wait is in place. They guard against these bugs coming back, but they don't run the scenes. The behaviour was checked in the browser (section 3).
- **Console errors / failed requests:** none in any run (60 resources, all 200; no page errors or unhandled rejections).

### How it was tested

- The built-in browser pane was hidden for this session (the session window wasn't open). A hidden pane stops animation frames, and the game's scenes advance once per frame, so timings measured there would have been wrong. I measured Chapter 1's opening and the fall there (before any fixes). After that I used a **headless Chrome**, driven over the DevTools protocol with Node's built-in WebSocket (no new dependencies), with real audio, the real device voices and 55–60 fps.
- An autopilot walks Alice with real key events (↑ ← → in 3D, as the on-screen arrows do) and taps the cards' own buttons. It deliberately gives wrong answers first, spills the tea, picks the wrong cake topping, feeds a koi and the greedy fish, walks onto wrong squares, rings a wrong bell, takes a dead end in the castle, gets caught by a soldier and by the Jabberwock, opens the menu mid-scene, mashes Space during openings, closes a card ("Done for now") and comes back, and reloads mid-chapter.
- Voice timing was logged by wrapping `AudioBufferSourceNode.start`/`ended` (each recording identified by a hash of its file) and `speechSynthesis.speak` (`start`/`end`/`error`). Gaps run from the end of one line to the start of the next. All this code stayed outside the repo (in the git-ignored `tests/.extracted/`), and the game code has no logging.
- **Not covered:** a real iPad (Safari's speech voices, touch, frame rate). Frame rates below are from headless Chrome with software WebGL. They show nothing is wildly slow, but they aren't iPad numbers. Medium and Hard levels weren't played through in the browser; the unit tests play 200 mazes per level.

## 2. Bugs, most severe first

### Fixed

| # | Chapter | Steps to reproduce | What happened | What should happen | Fix |
|---|---|---|---|---|---|
| 1 | Ch1 → fall | Reach the rabbit hole | The fall began 700 ms after the narrator started "A stopwatch sticker for your book!" (2.0 s long), so Alice's recorded scream played **over** the narrator: 892 ms of overlap, measured. | The scream comes after the line. | `363753d`: the fall starts via `afterSaid`. Measured after: 1090–1234 ms gap. |
| 2 | All | Any scene | `SPEAKER_GAP` was 300 ms, counted from when the **bubble or caption** went, not from when the **voice** stopped. `afterSaid` ran its line the moment the voice stopped (0–150 ms). Measured: March Hare "Have some tea!" → pour instructions, 228 ms. | At least 500 ms of silence between speakers. | `10a7464`: `SPEAKER_GAP` = 600 ms, timed from the real end of the voice (`voiceEndedAt`), in both `lineUp` and `afterSaid`. |
| 3 | All scenes | A run of lines back to back for over 10 s (a riddle's question, "Not quite!", the next question…) | `lineUp`'s safety valve (`LINE_HOLD_MAX`) was timed from the first busy frame, so after 10 s of back-to-back lines it stopped holding. The scene then went on over a voice that was still speaking: the Queen's croquet invitation cut the Hatter's "Quite right!…" at 4.2 s. | Only a really stuck voice is let go. | `4da8e3a`: the valve counts from the latest line's start (`voiceBegunAt`). |
| 4 | Ch2 Tea | Answer the Hatter's riddle | Croquet started a fixed 3.2 s after the key; the Hatter's line runs over 4 s, so it was cut off, with the Queen 244 ms later. | The Queen waits. | `e0b9461` (with #3): croquet also waits for `lineUp`. Measured after: Hatter's line plays in full (5.0 s), then 829 ms. |
| 5 | Ch3 Wood | Mend the bridge | The Rabbit's "Well done, Alice! Now through the bushes…" (5.4 s) starts at 4 s and the narrator's "Thank you, Alice!" caption at 8.2 s, which **hushed the Rabbit about 1.3 s early**. | Each waits for the one before. | `484438f`: both via `afterSaid`. Measured after: 620 ms, then 675 ms. |
| 6 | Mud slide → Ch3 | Ride the mud slide | "Down she slid, round and round…" (no recording; device voice ≈ 5.9 s) starts at 80 % of the 16 s ride, so landing in the Wood (which hushes every voice) cut it off. | It finishes, then the Wood begins. | `d26b578`: the card waits while a voice is speaking (at most `LINE_HOLD_MAX`). Measured after: full 5.9 s line, 1.9–2.5 s gap. |
| 7 | Ch3 → Ch4 | Find the Cat (first time) and step into the portal | The Cat's "A party, for finding me! We're all mad here, you know." was **cut off** when Alice landed on the chessboard. | It finishes first. | `284f851`: every card between chapters waits, not only the slide. Measured after: full 5.4 s line, 1032 ms gap. |
| 8 | Ch4 Board | Walk the path past the chess pieces | A piece's line (10–12.5 s in the device voice) went into the speech queue right behind the last piece's: Bishop → Rook **298 ms**. | The next piece waits. | `0e83c21`: a piece waits for the voice before it. |
| 9 | Ch4 Board | Same | Lines longer than `LINE_HOLD_MAX` (10 s): the pieces' bubbles **faded while they were still talking**, and the next piece stopped waiting at 10 s (Rook still 381 ms after the Bishop). | The bubble stays up while the voice speaks. | `42d1443`: `LINE_HOLD_MAX` 15 s; a piece's wait counts from when the line before began. Measured after: 1047 ms. |
| 10 | Ch2 Tea | Win at croquet | The present opened a fixed 2.6 s after the winning shot: Queen "You win!" → Hatter's present line, 302 ms. | The Hatter waits. | `87c7372`: also waits for `lineUp`. Measured after: 851 ms. |
| 11 | Ch2 Tea | Queen asks "Do you play croquet?" | The croquet card opened (and the narrator began its caption) a fixed 3 s after the Queen started, whatever her device voice was doing. | The narrator waits. | `f838c46`: `afterSaid`. Measured after: 617–693 ms. |
| 12 | Ch2 Tea | Open the unbirthday present | "Now for the garden gate!" came a fixed 3.4 s after the teapot sticker line (device voice): only 539 ms of gap in play, and a cut-off with a slower voice. | The narrator waits. | `5b41bbe`: `afterSaid`. Measured after: 662–691 ms. |
| 13 | Ch2 Tea | Land in the Tea Party | The Rabbit's three welcome lines ran on fixed times (0, 4.25, 8.5 s) with no check that the last had finished. Fine with the recordings (1.1–1.4 s gaps), but a slower device voice (recordings not loaded yet, or offline) would be cut off. | Like every other scene, each line waits for the one before. | `aa51fea`: `playWelcome` holds its clock with `lineUp`. Measured after: 1271–1421 ms. |
| 14 | All (iPad) | Look at the bar's buttons | Restart, sound, music and menu were **40×40 px**, under the 44 px a finger needs. | ≥ 44 px. | `8c31fe7`: 44×44. (The on-screen arrows are 64×56 and all cards' buttons are bigger.) |

### Not fixed

| # | Chapter | Steps | What happens | Why not fixed |
|---|---|---|---|---|
| 15 | Ch2, Ch3 | Tap an answer, a topping, swing at croquet or feed the last fish while a line is being said | The line is hushed and the reply starts 130–335 ms later (table 3.2). For example, the narrator's "The balls were live hedgehogs…" is cut by the Queen's "Splendid!" if the child swings at once, and the Rabbit's fish warning is cut by the mended-bridge line. | The code does this on purpose ("read out, the latest only"), so a child's tap gets an answer at once. Making replies wait would change how the cards feel: a design call. |
| 16 | Ch3 Wood | The fish card is up | **Landscape:** the card covers the White Rabbit on the far side of the gap, and his bubble, while he explains the fish. **Portrait:** it covers the right half of his bubble ("A plank is missing! Sit…"). Desktop is fine. | Card placement is the agreed "cards on the right" rule. It needs a design decision (camera framing or bubble placement). Screenshots on request. |
| 17 | Menu (iPad landscape) | Open the game at 1024×768 | The menu card's content is 809 px tall in a 734 px space. Focusing "Start adventure" scrolls the card down 75 px, so **"Alice in" and the top of "Mazeland" are cut off**. I tried `focus({preventScroll:true})`, but then "Start adventure" falls below the fold, which is worse for a child, so I reverted it. | The menu needs ~75 px less height on iPad landscape (a design/layout choice). |
| 18 | Any | Reload in the middle of a chapter | The menu comes back (fine, nothing is broken) with Chapter 1 selected, so "Start adventure" starts Chapter 1 again. The child has to know to tap their chapter's card. Progress inside the chapter is lost. | Story design: whether Start should resume the last chapter reached. |
| – | Ch3 Wood | Find the Cat when his sticker is already in the book, then step straight into the portal | `catParty` shows the "You found the Cheshire Cat!" end card at 1.6 s while the portal's own card is already up (from 1.4 s), until the landing hides it. Not seen on screen. Found by reading the code; **not confirmed**. | Unconfirmed. Worth a look. |

**No soft-locks found.** Wrong answers on every riddle, the Caterpillar and the cake; spilt and short pours; a koi and the greedy fish; two wrong squares (the Rabbit's hint came on the second); a wrong bell; a dead end in the castle; caught by the soldiers five times (chained, freed, sent back; they slow down as designed); caught by the Jabberwock (tumbles back, it flies off); the menu open for 6 s mid-opening (audio suspends, the scene resumes where it was); 15 Space presses in 1.5 s during an opening (skips cleanly); arrow keys mashed under an open card (Alice doesn't move); closing the fish card and walking back (it reopens); reload mid-chapter. None of these hung the game or left Alice stuck.

## 3. Voices

### 3.1 Every scripted hand-off, measured after the fixes

From headless Chrome, recordings + device voices, 55–60 fps. "Device" means the line has no recording and is said by the device's own voice. Gaps run from the end of the audio buffer to the start of the next, and each recording also has 50–670 ms of silence at its end (see 3.3), so the silence a child hears is longer than these numbers.

Minimum: **601 ms** ("And everything began to spin…" → "…and Alice woke up at home…").

| Scene | Speaker A (line) | Speaker B (line) | Gap (ms) |
|---|---|---|---|
| Ch1 → fall → Tea welcome (story run) | Narrator “One sunny afternoon, Alice sat in …” | Sister (device) “What is the use of a book without …” | 2929 |
| Ch1 → fall → Tea welcome (story run) | Sister (device) “What is the use of a book without …” | Narrator “Suddenly, a White Rabbit with pink…” | 847 |
| Ch1 → fall → Tea welcome (story run) | Narrator “Suddenly, a White Rabbit with pink…” | Rabbit “Oh dear! Oh dear! I shall be late!…” | 1902 |
| Ch1 → fall → Tea welcome (story run) | Rabbit “Oh dear! Oh dear! I shall be late!…” | Rabbit “Follow me, Alice!…” | 874 |
| Ch1 → fall → Tea welcome (story run) | Rabbit “Follow me, Alice!…” | Narrator “Follow the White Rabbit through th…” | 1805 |
| Ch1 → fall → Tea welcome (story run) | Narrator “A stopwatch sticker for your book!…” | Alice (scream) “scream-alice…” | 1234 |
| Ch1 → fall → Tea welcome (story run) | Rabbit “Hello again, Alice, and welcome to…” | Rabbit “It’s a curious place, full of curi…” | 1421 |
| Ch1 → fall → Tea welcome (story run) | Rabbit “It’s a curious place, full of curi…” | Rabbit “I must hurry along now… but look o…” | 1271 |
| Ch2 Tea Party (from card) | Rabbit “Hello again, Alice, and welcome to…” | Rabbit “It’s a curious place, full of curi…” | 1411 |
| Ch2 Tea Party (from card) | Rabbit “It’s a curious place, full of curi…” | Rabbit “I must hurry along now… but look o…” | 1280 |
| Ch2 Tea Party (from card) | Narrator “Alice sat down in a large arm-chai…” | March Hare (device) “Have some tea! Will you pour, Alic…” | 2680 |
| Ch2 Tea Party (from card) | March Hare (device) “Have some tea! Will you pour, Alic…” | Narrator (device) “Hold the teapot to pour. Let go wh…” | 1156 |
| Ch2 Tea Party (from card) | Narrator (device) “Hold the teapot to pour. Let go wh…” | Hatter (device) “Thank you kindly!…” | 1876 |
| Ch2 Tea Party (from card) | Queen (device) “Delightful!…” | Narrator “Everyone took a sip of tea.…” | 1005 |
| Ch2 Tea Party (from card) | Narrator “Everyone took a sip of tea.…” | Queen (device) “Delicious!…” | 2052 |
| Ch2 Tea Party (from card) | Queen (device) “Delicious!…” | Narrator “Then the Hatter opened his eyes ve…” | 841 |
| Ch2 Tea Party (from card) | Narrator “Then the Hatter opened his eyes ve…” | Hatter (device) “Why is a raven like a writing-desk…” | 2054 |
| Ch2 Tea Party (from card) | Hatter (device) “Why is a raven like a writing-desk…” | Alice (device) “I give it up. What’s the answer?…” | 1311 |
| Ch2 Tea Party (from card) | Alice (device) “I give it up. What’s the answer?…” | Hatter (device) “I haven’t the slightest idea!…” | 1168 |
| Ch2 Tea Party (from card) | Hatter (device) “I haven’t the slightest idea!…” | March Hare (device) “Nor I!…” | 1034 |
| Ch2 Tea Party (from card) | March Hare (device) “Nor I!…” | Hatter (device) “It’s an unbirthday party! Let’s de…” | 1023 |
| Ch2 Tea Party (from card) | Hatter (device) “It’s an unbirthday party! Let’s de…” | Hatter (device) “a strawberry, then a candle!…” | 1022 |
| Ch2 Tea Party (from card) | Narrator (device) “Hooray! What a lovely unbirthday c…” | Hatter (device) “Let’s see if you can solve MY ridd…” | 826 |
| Ch2 Tea Party (from card) | Hatter (device) “Let’s see if you can solve MY ridd…” | Hatter (device) “I have to be broken before you can…” | 1129 |
| Ch2 Tea Party (from card) | Hatter (device) “Quite right! The Queen hands Alice…” | Queen (device) “Do you play croquet? Then let’s pl…” | 829 |
| Ch2 Tea Party (from card) | Queen (device) “Do you play croquet? Then let’s pl…” | Narrator “The balls were live hedgehogs, and…” | 673 |
| Ch2 Tea Party (from card) | Queen (device) “Oh, very good!…” | Queen (device) “You win! What a splendid game!…” | 2741 |
| Ch2 Tea Party (from card) | Queen (device) “You win! What a splendid game!…” | Hatter (device) “And here is an unbirthday present …” | 851 (was 302 before fix 87c7372) |
| Ch2 Tea Party (from card) | Narrator (device) “A teapot sticker for your sticker …” | Narrator “Now for the garden gate!…” | 662 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Narrator “The Tulgey Wood…” | Narrator “Through the gate, the path wound i…” | 1123 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Narrator “Through the gate, the path wound i…” | Rabbit “Psst! Alice! Over here!…” | 1111 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Psst! Alice! Over here!…” | Rabbit “The Cheshire Cat is hiding somewhe…” | 1219 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “The Cheshire Cat is hiding somewhe…” | Rabbit “First, cross the bridge over the r…” | 1286 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “A plank is missing! Sit down at th…” | Rabbit “The plank broke into three pieces!…” | 688 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “The plank broke into three pieces!…” | Rabbit “But don’t feed the greedy grey fis…” | 692 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Narrator (device) “The glowing fish push the last pie…” | Rabbit “Well done, Alice! Now through the …” | 620 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Well done, Alice! Now through the …” | Narrator “Thank you, Alice! bubble the fish.…” | 675 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Psst! Alice! In here, in the bush!…” | Rabbit “Just past this bush, the Queen’s c…” | 859 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Just past this bush, the Queen’s c…” | Rabbit “Each soldier sees the yellow patch…” | 866 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Each soldier sees the yellow patch…” | Rabbit “But mind the dry brown bushes : th…” | 867 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “But mind the dry brown bushes : th…” | Rabbit “If they catch you, they’ll chain y…” | 866 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “If they catch you, they’ll chain y…” | Rabbit “Oh my ears and whiskers, look at t…” | 1118 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Cat (device) “A party, for finding me! We’re all…” | Narrator “The Looking-Glass…” | 1032 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Narrator “The Looking-Glass…” | Narrator “Through the looking-glass lay a gr…” | 1230 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Narrator “Through the looking-glass lay a gr…” | Rabbit “Oh dear, oh dear! Alice! Dinah’s k…” | 1524 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “Oh dear, oh dear! Alice! Dinah’s k…” | Rabbit “She is lost on the far side of the…” | 862 |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “She is lost on the far side of the…” | Rabbit “But these squares are tricky. Watc…” | 872 |
| Ch4 Looking-Glass + castle + ending (from card) | Narrator “The Looking-Glass…” | Narrator “Through the looking-glass lay a gr…” | 1204 |
| Ch4 Looking-Glass + castle + ending (from card) | Narrator “Through the looking-glass lay a gr…” | Rabbit “Oh dear, oh dear! Alice! Dinah’s k…” | 1537 |
| Ch4 Looking-Glass + castle + ending (from card) | Rabbit “Oh dear, oh dear! Alice! Dinah’s k…” | Rabbit “She is lost on the far side of the…” | 878 |
| Ch4 Looking-Glass + castle + ending (from card) | Rabbit “She is lost on the far side of the…” | Rabbit “But these squares are tricky. Watc…” | 858 |
| Ch4 Looking-Glass + castle + ending (from card) | Rabbit “But these squares are tricky. Watc…” | Rabbit “Oh my ears and whiskers, I’m late!…” | 849 |
| Ch4 Looking-Glass + castle + ending (from card) | Bishop (device) “Bless me, a little pawn! I only ev…” | Rook (device) “Ho there! I am the Rook. Everyone …” | 1047 |
| Ch4 Looking-Glass + castle + ending (from card) | Narrator “And everything began to spin, roun…” | Narrator “…and Alice woke up at home, on the…” | 601 |
| Ch4 Looking-Glass + castle + ending (from card) | Narrator “…and Alice woke up at home, on the…” | Sister (device) “Wake up, Alice dear! What a long s…” | 682 |
| Ch4 Looking-Glass + castle + ending (from card) | Sister (device) “Wake up, Alice dear! What a long s…” | Alice (device) “Oh, I’ve had such a curious dream!…” | 1103 |

Before the fixes (measured, same set-up): Alice's scream **−892 ms** (overlap) after the narrator; March Hare → pour instructions 228 ms; Hatter "Quite right!" **cut at 4.2 s**, Queen 244 ms later; mended bridge: the Rabbit **cut** by the narrator; mud slide line **cut** on landing; Cat's party line **cut** on landing; Bishop → Rook 298 ms; Queen "You win!" → Hatter 302 ms; narrator caption 640 ms after a hushed Queen line.

### 3.2 Hand-offs under 500 ms that are left: all right after a child's tap

These come right after a tap: the tap hushes the line playing, and the reply follows. Most are the same character ("Not quite!" → their next riddle). Under 500 ms between two *different* speakers happens only twice: narrator → Queen at croquet, and Rabbit → narrator at the bridge. Not fixed (bug 15).

| Scene | Speaker A (line) | Speaker B (line) | Gap (ms) |
|---|---|---|---|
| Ch2 Tea Party (from card) | Friend (device) “I sit on your head, and the Mad Ha…” (cut) | Friend (device) “That’s right! The Mad Hatter beams…” | 183 ⚠ |
| Ch2 Tea Party (from card) | Friend (device) “Throw me and the puppy will fetch …” (cut) | Friend (device) “Not quite! Here’s another one.…” | 164 ⚠ |
| Ch2 Tea Party (from card) | Friend (device) “Not quite! Here’s another one.…” | Friend (device) “I am hard and white, and a puppy l…” | 234 ⚠ |
| Ch2 Tea Party (from card) | Friend (device) “I am hard and white, and a puppy l…” (cut) | Friend (device) “That’s right! The Dog beams and st…” | 249 ⚠ |
| Ch2 Tea Party (from card) | Narrator (device) “Not that one! Look at the pictures…” (cut) | Narrator (device) “On it goes! What’s next?…” | 145 ⚠ |
| Ch2 Tea Party (from card) | Narrator (device) “On it goes! What’s next?…” | Narrator (device) “Hooray! What a lovely unbirthday c…” | 319 ⚠ |
| Ch2 Tea Party (from card) | Hatter (device) “I have to be broken before you can…” (cut) | Hatter (device) “Not quite! laughs the Hatter. Try …” | 231 ⚠ |
| Ch2 Tea Party (from card) | Hatter (device) “Not quite! laughs the Hatter. Try …” | Hatter (device) “I go up and up, but I never come d…” | 283 ⚠ |
| Ch2 Tea Party (from card) | Hatter (device) “I go up and up, but I never come d…” (cut) | Hatter (device) “Not quite! laughs the Hatter. Try …” | 130 ⚠ |
| Ch2 Tea Party (from card) | Hatter (device) “Not quite! laughs the Hatter. Try …” | Hatter (device) “The more you take, the more you le…” | 245 ⚠ |
| Ch2 Tea Party (from card) | Hatter (device) “The more you take, the more you le…” (cut) | Hatter (device) “Quite right! The Queen hands Alice…” | 192 ⚠ |
| Ch2 Tea Party (from card) | Narrator “The balls were live hedgehogs, and…” (cut) | Queen (device) “Splendid!…” | 164 ⚠ |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Rabbit “But don’t feed the greedy grey fis…” (cut) | Narrator (device) “The glowing fish push the last pie…” | 335 ⚠ |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Cat (device) “I am a little bug that glows and b…” (cut) | Cat (device) “Not quite! grins the Cat. Try this…” | 243 ⚠ |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Cat (device) “Not quite! grins the Cat. Try this…” | Cat (device) “I grow tall in the wood, with root…” | 246 ⚠ |
| Ch3 Tulgey Wood + Cat → Ch4 (from card) | Cat (device) “I grow tall in the wood, with root…” (cut) | Cat (device) “Clever girl! grins the Cat. The tr…” | 174 ⚠ |

### 3.3 Speed (words per second) per speaker

Words come from `voices/index.json`'s lines (as `tools/make-voices.js --list` prints them). Durations come from the decoded audio. "Voiced" leaves out the silence before the first and after the last sound (louder than −34 dBFS), which would otherwise make short lines look slow. Outliers are more than 15 % from the speaker's median. Most outliers are short lines, or lines full of "…" and "!" pauses, so the narrator's and the White Queen's pace is steady. **The Rabbit's pace varies the most** (2.1–4.6 words/s): "Oh dear, oh dear! Alice! Dinah's kitten…" is −36 % and "If they catch you…" +42 %.

**Nothing changes `playbackRate` on a voice.** `playbackRate` is only set on the mud slide's noise (1.6) and on Alice's scream (ramps 1 → 0.88). Device voices use a per-character `rate` (0.7–1.2) in `VOICES`, by design.

Medians (words per second of voiced audio): narrator 3.61, rabbit 3.24, whitequeen 2.93

| Recording | Speaker | Words | Length (s) | Voiced (s) | Words/s | vs median | Line |
|---|---|---|---|---|---|---|---|
| narrator-1cf73ec0 | narrator | 2 | 1.21 | 0.88 | 2.27 | -37% **outlier** | The Looking-Glass |
| narrator-2be5c8e3 | narrator | 11 | 3.71 | 3.39 | 3.25 | -10% | Suddenly, a White Rabbit with pink eyes ran close by her! |
| narrator-300f656b | narrator | 16 | 4.88 | 4.50 | 3.56 | -2% | One sunny afternoon, Alice sat in the garden with her sister, who was reading a book… |
| narrator-31459e1f | narrator | 17 | 5.48 | 5.03 | 3.38 | -6% | Through the gate, the path wound into a sunny wood, where nothing was quite what it seemed… |
| narrator-40d6eb22 | narrator | 5 | 1.44 | 1.25 | 4.00 | +11% | Now for the garden gate! |
| narrator-43bffcca | narrator | 13 | 3.53 | 3.19 | 4.08 | +13% | Alice sat down in a large arm-chair at one end of the table. |
| narrator-450bb4d2 | narrator | 6 | 1.67 | 1.44 | 4.18 | +16% **outlier** | A kitten sticker for your book! |
| narrator-4fc7ac80 | narrator | 12 | 4.32 | 3.85 | 3.12 | -14% | Through the looking-glass lay a great chessboard, as wide as a meadow… |
| narrator-5308d0e5 | narrator | 8 | 2.51 | 2.13 | 3.76 | +4% | Then the Hatter opened his eyes very wide… |
| narrator-6e0f09bc | narrator | 14 | 4.18 | 3.81 | 3.67 | +2% | Follow the White Rabbit through the maze, all the way to his rabbit hole! |
| narrator-701e131f | narrator | 6 | 1.72 | 1.32 | 4.53 | +25% **outlier** | Everyone took a sip of tea. |
| narrator-799b8909 | narrator | 3 | 1.30 | 0.95 | 3.14 | -13% | The Tulgey Wood |
| narrator-89055ead | narrator | 15 | 5.29 | 4.86 | 3.09 | -15% | Thank you, Alice! bubble the fish. The Cheshire Cat went that way, past the soldiers! |
| narrator-8a38a19a | narrator | 6 | 2.00 | 1.59 | 3.78 | +5% | A stopwatch sticker for your book! |
| narrator-9fee441e | narrator | 10 | 3.34 | 2.94 | 3.40 | -6% | The balls were live hedgehogs, and the mallets live flamingos! |
| narrator-a307c57c | narrator | 8 | 3.02 | 2.59 | 3.09 | -15% | And everything began to spin, round and round… |
| narrator-b56c1a92 | narrator | 17 | 4.92 | 4.44 | 3.83 | +6% | …and Alice woke up at home, on the picnic blanket, with the kitten purring in her lap. |
| narrator-d76268dd | narrator | 8 | 1.81 | 1.39 | 5.77 | +60% **outlier** | Would you like to sing with us, Alice? |
| rabbit-0c15a155 | rabbit | 12 | 4.60 | 4.19 | 2.87 | -11% | Back again? Over the bridge, past the soldiers, and find the Cat! |
| rabbit-19a53253 | rabbit | 10 | 3.62 | 3.20 | 3.12 | -3% | Oh my ears and whiskers, I’m late! Good luck, Alice! |
| rabbit-1c5ee7ca | rabbit | 13 | 3.90 | 3.33 | 3.90 | +20% **outlier** | The Cheshire Cat is hiding somewhere in this wood. Can you find him? |
| rabbit-2297f0fa | rabbit | 15 | 5.16 | 4.77 | 3.15 | -3% | Find the Cheshire Cat! First cross the bridge: the fish will help you. Follow me! |
| rabbit-2a1e9bb8 | rabbit | 11 | 2.88 | 2.40 | 4.59 | +42% **outlier** | If they catch you, they’ll chain you up for a while! |
| rabbit-2f00f401 | rabbit | 3 | 1.21 | 0.97 | 3.10 | -4% | Follow me, Alice! |
| rabbit-3fcced50 | rabbit | 19 | 6.46 | 5.97 | 3.18 | -2% | Just past this bush, the Queen’s card soldiers march up and down. You must get across without being seen! |
| rabbit-44520fc7 | rabbit | 21 | 6.55 | 6.13 | 3.43 | +6% | She is lost on the far side of the board, mewing for you. Find her, and you can both go home! |
| rabbit-4a165afb | rabbit | 17 | 5.43 | 5.02 | 3.38 | +5% | First, cross the bridge over the river. A plank is missing… but the fish will help you. |
| rabbit-4a500a83 | rabbit | 8 | 3.06 | 2.53 | 3.16 | -2% | It’s a curious place, full of curious things. |
| rabbit-4cc7f27a | rabbit | 18 | 6.83 | 6.42 | 2.81 | -13% | But these squares are tricky. Watch them light up, then walk the same way: one, two, three, four! |
| rabbit-4e6ef2be | rabbit | 15 | 4.78 | 4.25 | 3.53 | +9% | A plank is missing! Sit down at the edge, Alice, and look into the water… |
| rabbit-66d9f830 | rabbit | 21 | 9.38 | 8.68 | 2.42 | -25% **outlier** | But mind the dry brown bushes : they rustle, and a soldier will turn to look! And one soldier sometimes turns round. |
| rabbit-6e70831c | rabbit | 4 | 1.76 | 1.44 | 2.78 | -14% | Psst! Alice! Over here! |
| rabbit-75e9865e | rabbit | 13 | 3.76 | 3.27 | 3.97 | +23% **outlier** | I must hurry along now… but look out for me, we’ll meet again! |
| rabbit-8fd14d4b | rabbit | 7 | 2.37 | 1.99 | 3.51 | +9% | Psst! Alice! In here, in the bush! |
| rabbit-96039364 | rabbit | 15 | 5.11 | 4.52 | 3.32 | +2% | But don’t feed the greedy grey fish, or a koi. A piece will slip back! |
| rabbit-a5b91d45 | rabbit | 22 | 7.15 | 6.68 | 3.29 | +2% | Each soldier sees the yellow patch in front of him. Hide in the bushes , and only creep out when he looks away. |
| rabbit-b3ee2b74 | rabbit | 13 | 4.09 | 3.65 | 3.57 | +10% | Oh my ears and whiskers, look at the time! I’m late, I’m late! |
| rabbit-bb638e7d | rabbit | 23 | 7.25 | 6.69 | 3.44 | +6% | The plank broke into three pieces! Feed each glowing fish just as it swims under the gap, and it brings up a piece. |
| rabbit-bd2ddbea | rabbit | 12 | 5.43 | 5.00 | 2.40 | -26% **outlier** | Well done, Alice! Now through the bushes… quietly. The soldiers are near! |
| rabbit-c2916236 | rabbit | 7 | 2.93 | 2.42 | 2.89 | -11% | Hello again, Alice, and welcome to Wonderland! |
| rabbit-c9d89a8c | rabbit | 8 | 2.32 | 1.84 | 4.34 | +34% **outlier** | Oh dear! Oh dear! I shall be late! |
| rabbit-ce1073e6 | rabbit | 12 | 6.18 | 5.77 | 2.08 | -36% **outlier** | Oh dear, oh dear! Alice! Dinah’s kitten followed you through the looking-glass! |
| rabbit-dd2c5fbc | rabbit | 17 | 5.29 | 4.80 | 3.54 | +9% | Find the kitten on the far side! Watch the squares light up, then walk the same way. |
| rabbit-df1bdb2e | rabbit | 10 | 4.32 | 3.84 | 2.60 | -20% **outlier** | Watch carefully, Alice, and count them: one, two, three, four! |
| whitequeen-11cb2335 | whitequeen | 17 | 5.85 | 5.80 | 2.93 | +0% | Ah, Alice! And you’ve brought Dinah’s kitten. Welcome to my castle! Come and sit at my table. |

Loudness (mean RMS of voiced part): narrator -20.9 dBFS, rabbit -23.7 dBFS, whitequeen -21.2 dBFS

No recording clips (no sample at or above 0.99). Peaks run from −0.2 dBFS (narrator-43bffcca) to −9.9 dBFS. **The Rabbit averages 2.8 dB quieter than the narrator.** **Alice's fall scream (`sounds/alice-fall.mp3`) has an RMS of −11.2 dBFS, about 10 dB hotter than the voices,** and it is played through `SFX_BOOST` on top of that. It is likely much louder than everything around it. Not changed (an audio-level decision).

### 3.4 Lines with no recording (said in the device's own voice)

- **A literal narrator line whose recording is missing:** `narrator-6a1d2648` "Down she slid, round and round, all the way into the Tulgey Wood!" (mud slide). `tools/make-voices.js` would make it. Not run, because it costs money.
- **Narrator lines built in code, which `make-voices.js` can't find** (they're said by the device's narrator voice, which sounds nothing like Lily): "Hold the teapot to pour. Let go when the tea reaches the gold line!" · "A little more! Up to the gold line." · "Oops! It spilt over. Try again!" · "A teapot sticker for your sticker book!" · the cake's "Not that one! Look at the pictures, and try again." / "On it goes! What's next?" / "Hooray! What a lovely unbirthday cake!" · the mended bridge's "The glowing fish push the last piece into place…" · the singing flowers' "Now you: tap the flowers in the same order!" / "Beautiful singing, Alice!".
- **Characters with no recorded voice at all** (all device voices, by design so far): Alice, her sister, the March Hare, the Mad Hatter, the Queen of Hearts, the Cheshire Cat (grin), the Caterpillar, the Tea Party friends reading their riddles, the card soldier ("Halt!"), the White Knight, Bishop and Rook. The pieces' lines run 10–12.5 s each.

### 3.5 Lines to re-record (if you want even pacing)

Only if the owner wants it. The pace differences are audible but not wrong:
- Rabbit, too slow: `rabbit-ce1073e6` "Oh dear, oh dear! Alice! Dinah's kitten followed you…" (−36 %), `rabbit-bd2ddbea` "Well done, Alice! Now through the bushes… quietly…" (−26 %), `rabbit-66d9f830` "But mind the dry brown bushes…" (−25 %; also 9.4 s, the longest Rabbit line), `rabbit-df1bdb2e` "Watch carefully, Alice, and count them…" (−20 %).
- Rabbit, too fast: `rabbit-2a1e9bb8` "If they catch you, they'll chain you up for a while!" (+42 %), `rabbit-c9d89a8c` "Oh dear! Oh dear! I shall be late!" (+34 %), `rabbit-75e9865e` "I must hurry along now…" (+23 %), `rabbit-1c5ee7ca` "The Cheshire Cat is hiding…" (+20 %).
- Narrator: `narrator-d76268dd` "Would you like to sing with us, Alice?" (+60 %, rushed).
- Missing: `narrator-6a1d2648` (above).

### 3.6 Bubbles and captions

- A voiced bubble stays up until its voice finishes (`stillSaying`). Before fix 9 that broke for lines over 10 s (the chess pieces). Captions always outlasted their recordings in every run.
- No two bubbles or a bubble and a caption were seen on screen at once during the scripted scenes, since `lineUp` holds each beat until the last line is gone. The fish card covering the Rabbit's bubble is bug 16.

## 4. Things that work but feel wrong (for the owner and the Design agent; not changed)

1. **Characters reading their own stage directions.** Device voices read third-person narration in the character's voice: the Hatter says "Not quite! *laughs the Hatter*. Try this one…", the Cat says "*Clever girl!* grins the Cat. The trees melt away…", and a friend says "That's right! *The Dog beams and steps aside.*" The Hatter also says "Quite right! *The Queen hands Alice* a little golden key", while the Queen's own bubble says "Here is the golden key, my dear" without a voice.
2. **"Would you like to sing with us, Alice?"** is asked by the singing flowers but said in the narrator's voice (recorded, and 60 % faster than her usual pace).
3. **"“Thank you, Alice!” bubble the fish."** The narrator reads it as "Thank you, Alice! bubble the fish." Without the quote marks that's hard to follow aloud.
4. **Two narrator voices.** The narrator's recorded lines (Lily) and her device-voice lines (3.4) sound like two different storytellers, sometimes one right after the other ("A teapot sticker…" device → "Now for the garden gate!" recorded).
5. **Story order at the bridge.** The fish thank Alice *after* the Rabbit has already said "Well done" and hopped off.
6. **A tap cuts a line off** (bug 15): a child who answers before the riddle has been read never hears the end of it. After a wrong answer, the next riddle's question is queued straight behind "Not quite!…" with no pause (~250 ms, same voice).
7. **The fall scream is very loud** compared with the voices (3.3).
8. **On-screen arrows are all on the right** (bottom-right block, 64×56 px each). A left thumb has nothing to do on an iPad held in two hands. In 3D, ← and → turn rather than step, which a child may not expect.
9. **The 🔊 button looks switched off.** The speaker emoji is drawn pale blue/grey, so it looks dimmed (like the 45 % opacity used for "off") even when sound is on.
10. **The sticker book's last two stickers** (the Cat and the kitten) are both cat faces and look almost the same.
11. **Menu height on iPad landscape** (bug 17) and **Start after a reload** (bug 18).
12. **The Tulgey Wood's soldiers** caught a careful autopilot 4 times on one run before it got across. That may be hard for an 8-year-old, but the slow-down after three catches works as designed.

## 5. Speed and smoothness

- Frame rate (headless Chrome, software WebGL, 1024×768 and 768×1024): **55–60 fps in every chapter**. Worst single frame 18–21 ms; 74 ms once, on starting Chapter 1. Not measured on a real iPad.
- Load (local server): page ready in ~80 ms; **4.6 MB** in 51 requests. `index.html` is 979 KB, `vendor/three.core.js` 1.4 MB and `three.module.js` 643 KB. The local test server sends them uncompressed; check that the real host gzips them. All 45 voice files are fetched at load (~1.5 MB) so they work offline.
- No failed requests and no console errors in any run.

## 6. Tests

- Before: `node --test --experimental-test-coverage tests/game.test.js` gave 132 tests, 132 passed; maze-logic.js 99.63 % lines, 97.48 % branches, 98.67 % functions.
- After: 145 tests, 145 passed; coverage unchanged (99.63 % / 97.48 % / 98.67 %). There are 13 new tests, one per fix (bug 9 extends bug 8's test), under "Voices: one speaker at a time…" and "iPad: the bar's buttons…". They read the scene code as text (see the summary for why).
