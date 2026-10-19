'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The game ships as a single HTML file. Pull its logic <script> out into a real .js file so Node can
// load it and measure coverage. Leading blank lines keep line numbers matching index.html.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const open = '<script id="logic">';
const startAt = html.indexOf(open) + open.length;
const source = html.slice(startAt, html.indexOf('</script>', startAt));
const padding = '\n'.repeat(html.slice(0, startAt).split('\n').length - 1);
const extracted = path.join(__dirname, '.extracted', 'maze-logic.js');
fs.mkdirSync(path.dirname(extracted), { recursive: true });
fs.writeFileSync(extracted, padding + source);
const L = require(extracted);

const DIFFS = Object.keys(L.DIFFICULTY);
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const key = (g, x, y) => y * g.width + x;

function dirBetween(a, b) {
  return Object.keys(L.DIRS).find((d) => a.x + L.DIRS[d][0] === b.x && a.y + L.DIRS[d][1] === b.y);
}

function corridorCells(g, c) {
  const cells = new Set();
  for (let i = c.lo; i <= c.hi; i++) cells.add(key(g, g.mainPath[i].x, g.mainPath[i].y));
  return cells;
}

// Proves a maze is winnable fairly: Alice never passes a creature without already holding its tool.
function solve(g) {
  const cleared = new Set(), held = new Set();
  for (;;) {
    const blocked = new Set();
    for (const c of g.creatures) if (!cleared.has(c.id)) for (const k of corridorCells(g, c)) blocked.add(k);
    const prev = L.bfs(g, g.start.x, g.start.y, (x, y) => blocked.has(key(g, x, y)));
    const reach = (p) => prev[key(g, p.x, p.y)] !== -1;
    for (const item of g.items) if (reach(item)) held.add(item.tool);
    if (reach(g.exit)) return true;
    const next = g.creatures.find((c) => !cleared.has(c.id) && held.has(L.CREATURES[c.type].tool) && reach(g.mainPath[c.lo - 1]));
    if (!next) return false;
    cleared.add(next.id);
  }
}

// Plays a whole game through the public move()/tick() API, like a careful player would.
function autoplay(g, maxMoves = 6000) {
  for (let moves = 0; g.status === 'playing' && moves < maxMoves; moves++) {
    const blocked = new Set();
    for (const c of g.creatures) {
      // Tea Party friends never block the way: Alice just walks up and answers their riddle.
      if (!g.tea && !c.cleared && !g.inventory.includes(L.CREATURES[c.type].tool)) for (const k of corridorCells(g, c)) blocked.add(k);
    }
    if (g.tea) for (const p of [g.table, ...g.props]) blocked.add(key(g, p.x, p.y));   // round the tea table and its guests
    const prev = L.bfs(g, g.alice.x, g.alice.y, (x, y) => blocked.has(key(g, x, y)));
    const goals = g.small ? [g.caterpillar] : [   // Map 2.0: tiny Alice heads for the mushroom first
      ...g.items.filter((i) => !i.taken),
      ...g.creatures.filter((c) => !c.cleared && (g.tea || g.inventory.includes(L.CREATURES[c.type].tool))),
      ...(g.tea && !g.key ? [g.seat] : []),   // then to her chair at the tea party
      ...(g.key ? [g.exit] : []),
    ];
    const route = goals.map((p) => L.pathTo(g, prev, p.x, p.y)).find((r) => r && r.length > 1);
    assert.ok(route, `stuck at ${JSON.stringify(g.alice)} (seed ${g.seed})`);
    const events = L.move(g, dirBetween(g.alice, route[1]));
    if (events.some((e) => e.type === 'riddle')) L.answer(g, true);
    if (events.some((e) => e.type === 'sit')) { L.answer(g, true); L.standUp(g); }
    if (moves % 2) L.tick(g);
  }
  return g;
}

function adjacentTo(g, target) {
  const [x, y] = Object.values(L.DIRS).map(([dx, dy]) => [target.x + dx, target.y + dy])
    .find(([nx, ny]) => L.isOpen(g, nx, ny));
  return { x, y };
}

// ---------- Maze generation ----------

test('mazes are perfect: every floor tile connected, no loops', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty });
      let floor = 0, edges = 0;
      for (let y = 0; y < g.height; y++) {
        for (let x = 0; x < g.width; x++) {
          if (!L.isOpen(g, x, y)) continue;
          floor++;
          if (L.isOpen(g, x + 1, y)) edges++;
          if (L.isOpen(g, x, y + 1)) edges++;
        }
      }
      const prev = L.bfs(g, 1, 1);
      assert.equal(prev.filter((p) => p !== -1).length, floor, 'all floor reachable');
      assert.equal(edges, floor - 1, 'tree: no loops');
      for (let x = 0; x < g.width; x++) {
        assert.ok(!L.isOpen(g, x, 0) && !L.isOpen(g, x, g.height - 1), 'top and bottom walls');
      }
      for (let y = 0; y < g.height; y++) {
        assert.ok(!L.isOpen(g, 0, y) && !L.isOpen(g, g.width - 1, y), 'left and right walls');
      }
      assert.ok(L.isOpen(g, g.exit.x, g.exit.y), 'exit in the bottom-right corner is open');
    }
  }
});

test('same seed rebuilds the same maze; different seeds differ', () => {
  const snapshot = (g) => JSON.stringify([Array.from(g.grid), g.creatures, g.items]);
  assert.equal(snapshot(L.createGame({ seed: 42, difficulty: 'hard' })), snapshot(L.createGame({ seed: 42, difficulty: 'hard' })));
  assert.notEqual(snapshot(L.createGame({ seed: 42, difficulty: 'hard' })), snapshot(L.createGame({ seed: 43, difficulty: 'hard' })));
  assert.ok(Number.isInteger(L.createGame().seed), 'random seed when none given');
});

// ---------- Acceptance criterion 3: every maze is fairly winnable ----------

test('200 random mazes per difficulty: winnable, each tool reachable before its creature', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty });
      assert.ok(solve(g), `${difficulty} seed ${seed} not solvable`);
      const spots = new Set(g.items.map((i) => key(g, i.x, i.y)));
      assert.equal(spots.size, g.items.length, 'tools never share a tile');
      for (const item of g.items) {
        assert.ok(L.isOpen(g, item.x, item.y), 'tool on floor');
        assert.ok(!(item.x === g.start.x && item.y === g.start.y), 'tool not on start');
        assert.ok(!g.creatures.some((c) => corridorCells(g, c).has(key(g, item.x, item.y))), 'tool not under a creature');
      }
    }
  }
});

test('tools hide off the main route, so Alice has to explore', () => {
  for (const difficulty of DIFFS) {
    let onRoute = 0, total = 0;
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty });
      const route = new Set(g.mainPath.map((p) => key(g, p.x, p.y)));
      total += g.items.length;
      onRoute += g.items.filter((i) => route.has(key(g, i.x, i.y))).length;
    }
    // Tiny Easy mazes occasionally have no side turnings left; allow at most 1% there.
    assert.ok(onRoute <= (difficulty === 'easy' ? total * 0.01 : 0), `${difficulty}: ${onRoute}/${total} tools on the route`);
  }
});

test('creatures really block the way: exit unreachable while they all stand', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty });
      const blocked = new Set(g.creatures.flatMap((c) => [...corridorCells(g, c)]));
      const prev = L.bfs(g, 1, 1, (x, y) => blocked.has(key(g, x, y)));
      assert.equal(prev[key(g, g.exit.x, g.exit.y)], -1);
    }
  }
});

// ---------- Acceptance criterion 6: difficulty table ----------

test('difficulty settings match the agreed table', () => {
  const expected = {
    // Landscape: about twice the original 11/17/23 width and 10% more height, kept odd.
    // Fog radius raised 40% from the original 3 / 2.5 / 2.
    easy: { width: 23, height: 13, creatures: 3, wanderers: 0, hearts: null, fog: 4.2 },
    medium: { width: 35, height: 19, creatures: 4, wanderers: 2, hearts: 3, fog: 3.5 },
    hard: { width: 45, height: 25, creatures: 5, wanderers: 3, hearts: 3, fog: 2.8 },
  };
  for (const [difficulty, want] of Object.entries(expected)) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty });
      assert.equal(g.width, want.width);
      assert.equal(g.height, want.height);
      assert.equal(g.grid.length, want.width * want.height);
      assert.equal(g.creatures.length, want.creatures);
      assert.equal(new Set(g.creatures.map((c) => c.type)).size, want.creatures, 'one of each creature type');
      assert.equal(g.creatures.filter((c) => c.wander).length, want.wanderers, `${difficulty} seed ${seed} wanderers`);
      assert.equal(g.hearts, want.hearts);
      assert.equal(g.cfg.fogRadius, want.fog);
      for (const c of g.creatures) {
        if (c.wander) assert.ok(L.CREATURES[c.type].canWander, `${c.type} must never wander`);
      }
    }
  }
});

test('creature list is the agreed five, each with its own tool', () => {
  const pairs = Object.fromEntries(Object.entries(L.CREATURES).map(([k, v]) => [k, v.tool]));
  assert.deepEqual(pairs, { dog: 'bone', hatter: 'teacup', cat: 'snack', rabbit: 'watch', queen: 'paint' });
  assert.deepEqual(Object.keys(L.TOOLS).sort(), ['bone', 'paint', 'snack', 'teacup', 'watch'], 'no tool left over');
  for (const tool of Object.values(pairs)) assert.ok(L.TOOLS[tool], `${tool} defined`);
  assert.equal(L.CREATURES.hatter.canWander, false);
  assert.equal(L.CREATURES.cat.canWander, false);
});

// ---------- Acceptance criteria 2 & 4: moving, tools, creatures ----------

test('walls block movement', () => {
  const g = L.createGame({ seed: 7 });
  const events = L.move(g, 'up');   // (1,0) is the border wall
  assert.deepEqual(events, [{ type: 'wall' }]);
  assert.deepEqual(g.alice, { x: 1, y: 1 });
  assert.equal(g.steps, 0);
});

test('walking onto a tool picks it up', () => {
  const g = L.createGame({ seed: 11, difficulty: 'medium' });
  const item = g.items[0];
  g.alice = adjacentTo(g, item);
  const events = L.move(g, dirBetween(g.alice, item));
  const pickup = events.find((e) => e.type === 'pickup');
  assert.equal(pickup.tool, item.tool);
  const info = L.TOOLS[item.tool];
  assert.equal(pickup.text, `Item Collected: ${info.name} ${info.emoji}`);
  assert.equal(pickup.tip, info.tip);
  assert.ok(item.taken);
  assert.deepEqual(g.inventory, [item.tool]);
  assert.equal(g.steps, 1);
});

test('holding an arrow walks at a steady pace; a long press is 30% faster', () => {
  const { stepMs, longPressMs, firstRepeatMs } = L.WALK;
  assert.equal(L.stepInterval(0), stepMs);
  assert.equal(L.stepInterval(longPressMs - 1), stepMs, 'normal pace until the long press kicks in');
  const stepsPerSecond = (ms) => 1000 / L.stepInterval(ms);
  assert.ok(Math.abs(stepsPerSecond(longPressMs) / stepsPerSecond(0) - 1.3) < 1e-9, 'exactly 30% more steps per second');
  assert.equal(L.stepInterval(10000), L.stepInterval(longPressMs), 'stays at the boosted pace while held');
  assert.ok(firstRepeatMs > stepMs, 'a quick tap is one step: the first repeat waits a little longer');
});

test('a creature blocks Alice and gives a hint when she lacks its tool', () => {
  const g = L.createGame({ seed: 5, difficulty: 'easy' });
  const c = g.creatures[0];
  g.alice = { ...g.mainPath[c.pathIndex - 1] };
  const before = { ...g.alice };
  const events = L.move(g, dirBetween(g.alice, c));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'blocked');
  assert.equal(events[0].text, L.CREATURES[c.type].hint);
  assert.deepEqual(g.alice, before);
  assert.equal(g.hearts, null, 'easy never loses hearts');
});

test('carrying the right tool clears the creature, then the way is open', () => {
  const g = L.createGame({ seed: 5, difficulty: 'easy' });
  const c = g.creatures[0];
  const tool = L.CREATURES[c.type].tool;
  g.alice = { ...g.mainPath[c.pathIndex - 1] };
  g.inventory = ['bone', tool].filter((t, i, a) => a.indexOf(t) === i);
  const events = L.move(g, dirBetween(g.alice, c));
  assert.equal(events[0].type, 'cleared');
  assert.equal(events[0].text, L.CREATURES[c.type].cleared);
  assert.ok(c.cleared);
  assert.ok(!g.inventory.includes(tool));
  assert.deepEqual(g.used, [tool]);
  L.move(g, dirBetween(g.alice, c));
  assert.deepEqual(g.alice, { x: c.x, y: c.y }, 'Alice can now step where the creature was');
});

test('reaching the exit wins and freezes the game', () => {
  const g = L.createGame({ seed: 9, difficulty: 'hard' });
  g.alice = { ...g.mainPath[g.mainPath.length - 2] };
  const events = L.move(g, dirBetween(g.alice, g.exit));
  assert.deepEqual(events.map((e) => e.type), ['moved', 'won']);
  assert.equal(g.status, 'won');
  assert.deepEqual(L.move(g, 'up'), []);
  assert.deepEqual(L.tick(g), []);
});

// ---------- Acceptance criterion 6: wanderers, hearts, losing ----------

test('wanderers patrol only their own corridor; stay-put creatures never move', () => {
  const g = L.createGame({ seed: 3, difficulty: 'hard' });
  const homes = g.creatures.map((c) => ({ ...c }));
  const visited = new Map(g.creatures.map((c) => [c.id, new Set()]));
  for (let i = 0; i < 200; i++) {
    L.tick(g);
    for (const c of g.creatures) {
      assert.ok(corridorCells(g, homes[c.id]).has(key(g, c.x, c.y)), `${c.type} left its corridor`);
      visited.get(c.id).add(key(g, c.x, c.y));
    }
  }
  for (const c of g.creatures) {
    if (c.wander) assert.ok(visited.get(c.id).size > 1, `${c.type} should move`);
    else assert.equal(visited.get(c.id).size, 1, `${c.type} should stay put`);
  }
});

function wandererSetup(seed = 21) {
  const g = L.createGame({ seed, difficulty: 'medium' });
  const c = g.creatures.find((x) => x.wander && x.lo >= 5);
  // The wanderer is at the near end of its corridor; Alice walked up the route and stands just outside it.
  c.pathIndex = c.lo; c.x = g.mainPath[c.lo].x; c.y = g.mainPath[c.lo].y;
  const at = c.lo - 1;
  g.alice = { ...g.mainPath[at] };
  return { g, c, at };
}

test('bumping a wanderer without its tool costs a heart and sends Alice back to the start', () => {
  const { g, c } = wandererSetup();
  g.inventory = ['watch'].filter((t) => t !== L.CREATURES[c.type].tool);
  const held = [...g.inventory], cleared = g.creatures.map((x) => x.cleared);
  const events = L.move(g, dirBetween(g.alice, c));
  assert.equal(events[0].type, 'hurt');
  assert.equal(g.hearts, 2);
  assert.deepEqual(g.alice, g.start);
  assert.ok(g.invuln > 0);
  assert.deepEqual(g.inventory, held, 'she keeps the tools she holds');
  assert.deepEqual(g.creatures.map((x) => x.cleared), cleared, 'creatures stay as they were');
});

test('on modes with hearts a stay-put creature frightens Alice too; on Easy it only blocks', () => {
  const g = L.createGame({ seed: 21, difficulty: 'medium' });
  const c = g.creatures.find((x) => !x.wander);
  g.alice = { ...g.mainPath[c.pathIndex - 1] };
  const events = L.move(g, dirBetween(g.alice, c));
  assert.equal(events[0].type, 'hurt');
  assert.equal(g.hearts, 2);
  assert.deepEqual(g.alice, g.start);
});

test('a wanderer stepping onto Alice also frightens her, but not while she is recovering', () => {
  const { g, c } = wandererSetup(33);
  c.dir = -1;
  c.pathIndex = c.lo + 1; c.x = g.mainPath[c.lo + 1].x; c.y = g.mainPath[c.lo + 1].y;
  g.alice = { ...g.mainPath[c.lo] };
  g.invuln = 2;
  assert.deepEqual(L.tick(g), [], 'no harm while recovering');
  assert.equal(g.hearts, 3);
  c.dir = -1;
  g.invuln = 0;
  const events = L.tick(g);
  assert.equal(events[0].type, 'hurt');
  assert.equal(g.hearts, 2);
});

test('a wanderer that walks into Alice while she holds its tool is cleared', () => {
  const { g, c } = wandererSetup(44);
  c.dir = -1;
  c.pathIndex = c.lo + 1; c.x = g.mainPath[c.lo + 1].x; c.y = g.mainPath[c.lo + 1].y;
  g.alice = { ...g.mainPath[c.lo] };
  g.inventory = [L.CREATURES[c.type].tool];
  const events = L.tick(g);
  assert.equal(events[0].type, 'cleared');
  assert.ok(c.cleared);
});

test('losing every heart ends the game as lost', () => {
  const { g, c } = wandererSetup();
  g.hearts = 1;
  const events = L.move(g, dirBetween(g.alice, c));
  assert.deepEqual(events.map((e) => e.type), ['hurt', 'lost']);
  assert.equal(g.status, 'lost');
});

// ---------- Acceptance criterion 5: fog ----------

test('fog: only nearby tiles visible, explored tiles remembered, fog off shows all', () => {
  const g = L.createGame({ seed: 12, difficulty: 'medium', fog: true });
  const R = g.cfg.fogRadius;
  assert.ok(L.isVisible(g, 1, 1));
  assert.ok(L.isVisible(g, 1 + Math.floor(R), 1));
  assert.ok(!L.isVisible(g, 1 + Math.ceil(R) + 1, 1));
  assert.ok(!L.isVisible(g, g.exit.x, g.exit.y));
  assert.equal(g.seen[key(g, 1, 1)], 1);
  assert.equal(g.seen[key(g, g.exit.x, g.exit.y)], 0);

  // Walk 12 tiles up the route; the start stays remembered but drops out of sight.
  for (const c of g.creatures) c.cleared = true;
  for (let i = 1; i <= 12; i++) L.move(g, dirBetween(g.alice, g.mainPath[i]));
  assert.deepEqual(g.alice, g.mainPath[12]);
  assert.ok(!L.inSight(g, 1, 1));
  assert.equal(g.seen[key(g, 1, 1)], 1);

  g.fog = false;
  assert.ok(L.isVisible(g, g.exit.x, g.exit.y));
});

// ---------- 3D view: facing and ray casting ----------

test('turning: right is clockwise, left undoes right, four turns come back round', () => {
  assert.equal(L.turn('up', 'right'), 'right');
  assert.equal(L.turn('up', 'left'), 'left');
  for (const f of L.FACINGS) {
    assert.equal(L.turn(L.turn(f, 'right'), 'left'), f);
    assert.equal(L.turn(L.turn(L.turn(L.turn(f, 'right'), 'right'), 'right'), 'right'), f);
    assert.equal(L.opposite(L.opposite(f)), f);
    assert.notEqual(L.opposite(f), f);
  }
  assert.equal(L.opposite('up'), 'down');
  assert.equal(L.opposite('left'), 'right');
});

test('walking on in 3D follows a single bend, but stops at junctions and dead ends', () => {
  // # = hedge. Alice stands at the marked tile in each little maze.
  const maze = (...rows) => ({
    width: rows[0].length, height: rows.length, grid: rows.join('').split('').map((ch) => (ch === '#' ? 1 : 0)),
  });
  const bend = maze(
    '#####',
    '#A..#',   // corridor turns down at the end
    '###.#',
    '#####');
  assert.equal(L.followCorridor(bend, 1, 1, 'right'), 'right', 'way ahead open: keep going');
  assert.equal(L.followCorridor(bend, 3, 1, 'right'), 'down', 'hedge ahead, one bend: follow it');
  assert.equal(L.followCorridor(bend, 3, 2, 'up'), 'up', 'came back up: open ahead');
  assert.equal(L.followCorridor(bend, 3, 1, 'up'), 'left', 'the bend works whichever way round');
  const tee = maze(
    '#####',
    '#...#',
    '##.##',   // reaching the top of the T: left or right is the player's choice
    '#####');
  assert.equal(L.followCorridor(tee, 2, 1, 'up'), 'up');
  const deadEnd = maze(
    '####',
    '#..#',
    '####');
  assert.equal(L.followCorridor(deadEnd, 2, 1, 'right'), 'right');
  // A real maze: every result is a direction Alice can walk, or her old facing.
  const g = L.createGame({ seed: 9, difficulty: 'hard' });
  for (let y = 1; y < g.height - 1; y++) {
    for (let x = 1; x < g.width - 1; x++) {
      if (!L.isOpen(g, x, y)) continue;
      for (const f of L.FACINGS) {
        const way = L.followCorridor(g, x, y, f);
        assert.ok(way === f || L.isOpen(g, x + L.DIRS[way][0], y + L.DIRS[way][1]));
        assert.notEqual(way, L.opposite(f), 'never turns Alice right round');
      }
    }
  }
});

test('ray casting finds the nearest wall in each direction from a tile centre', () => {
  const g = L.createGame({ seed: 4, difficulty: 'medium' });
  // Straight up from the start: the border wall is half a tile away.
  const up = L.castRay(g, 1.5, 1.5, 0, -1);
  assert.equal(up.dist, 0.5);
  assert.equal(up.side, 1);
  assert.deepEqual([up.x, up.y], [1, 0]);
  // Along each axis, the hit must be the first wall tile when walking tile by tile.
  for (const [dx, dy] of Object.values(L.DIRS)) {
    let x = 1, y = 1;
    while (L.isOpen(g, x + dx, y + dy)) { x += dx; y += dy; }
    const ray = L.castRay(g, 1.5, 1.5, dx, dy);
    assert.deepEqual([ray.x, ray.y], [x + dx, y + dy]);
    assert.equal(ray.dist, Math.abs(x - 1) + Math.abs(y - 1) + 0.5);
  }
  // Diagonal rays stop at a wall and report a hit position on its face.
  for (let a = 0; a < Math.PI * 2; a += 0.37) {
    const ray = L.castRay(g, 1.5, 1.5, Math.cos(a), Math.sin(a));
    assert.ok(!L.isOpen(g, ray.x, ray.y), 'ray ends in a wall');
    assert.ok(ray.dist > 0 && ray.hit >= 0 && ray.hit < 1);
  }
});

test('line of sight: a ray aimed at a point stops short of it (dist < 1) exactly when a hedge stands in between', () => {
  // The 3D view asks this to know whether a creature, tool or effect is hidden behind a hedge. Reference: clip the
  // straight line against every hedge tile near it (Liang–Barsky), which is exact.
  const g = L.createGame({ seed: 9, difficulty: 'medium' });
  const crosses = (x0, y0, x1, y1, mx, my) => {
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[x0 - x1, x0 - mx], [x1 - x0, mx + 1 - x0], [y0 - y1, y0 - my], [y1 - y0, my + 1 - y0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      if (p < 0) t0 = Math.max(t0, q / p); else t1 = Math.min(t1, q / p);
    }
    return t0 < t1;
  };
  let hidden = 0, seen = 0;
  for (let ay = 1; ay < g.height - 1; ay++) {
    for (let ax = 1; ax < g.width - 1; ax++) {
      if (!L.isOpen(g, ax, ay)) continue;
      const x0 = ax + 0.637, y0 = ay + 0.289;   // off-centre, as the camera usually is, and never on a tile corner's line
      for (let by = ay - 4; by <= ay + 4; by++) {
        for (let bx = ax - 4; bx <= ax + 4; bx++) {
          if ((bx === ax && by === ay) || !L.isOpen(g, bx, by)) continue;
          const x1 = bx + 0.5, y1 = by + 0.5;
          let blocked = false;
          for (let my = Math.min(ay, by); my <= Math.max(ay, by) && !blocked; my++) {
            for (let mx = Math.min(ax, bx); mx <= Math.max(ax, bx); mx++) {
              if (!L.isOpen(g, mx, my) && crosses(x0, y0, x1, y1, mx, my)) { blocked = true; break; }
            }
          }
          assert.equal(L.castRay(g, x0, y0, x1 - x0, y1 - y0).dist < 1, blocked, `from ${x0},${y0} to ${x1},${y1}`);
          if (blocked) hidden++; else seen++;
        }
      }
    }
  }
  assert.ok(hidden > 1000 && seen > 1000, `both cases checked (${hidden} hidden, ${seen} in view)`);
});

// '#' = hedge: an east–west corridor 7 tiles long.
const CORRIDOR = { width: 9, height: 3, grid: ['#########', '#.......#', '#########'].join('').split('').map((ch) => (ch === '#' ? 1 : 0)) };

test('follow camera: the full distance behind Alice down an open corridor', () => {
  assert.deepEqual(L.followCamera(CORRIDOR, 5.5, 1.5, 1, 0, 1.5), { x: 4, y: 1.5, dist: 1.5 }, 'facing east');
  assert.deepEqual(L.followCamera(CORRIDOR, 5.5, 1.5, -1, 0, 0.65), { x: 6.15, y: 1.5, dist: 0.65 }, 'facing west');
});

test('camera button: behind Alice, then over her shoulder, then through her eyes, then round again', () => {
  assert.deepEqual(L.CAMERAS, ['follow', 'shoulder', 'eyes']);
  assert.equal(L.nextCamera('follow'), 'shoulder');
  assert.equal(L.nextCamera('shoulder'), 'eyes');
  assert.equal(L.nextCamera('eyes'), 'follow');
  assert.equal(L.nextCamera('something old'), 'follow', 'an unknown saved camera starts the round again');
});

test('shoulder camera: out to Alice’s right and a little behind, kept clear of the hedges', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  const east = L.shoulderCamera(CORRIDOR, 5.5, 1.5, 1, 0, 0.55, 0.24);   // facing east, her right is south
  assert.ok(near(east.x, 4.95) && near(east.y, 1.74) && near(east.dist, 0.55) && near(east.side, 0.24));
  const west = L.shoulderCamera(CORRIDOR, 5.5, 1.5, -1, 0, 0.55, 0.24);   // facing west, her right is north
  assert.ok(near(west.x, 6.05) && near(west.y, 1.26));
  const wide = L.shoulderCamera(CORRIDOR, 5.5, 1.5, 1, 0, 0.55, 0.8);   // too far out: the side hedge stops it
  assert.ok(near(wide.side, 0.5 - L.CAMERA_GAP) && near(wide.y, 2 - L.CAMERA_GAP));
  const deadEnd = L.shoulderCamera(CORRIDOR, 1.5, 1.5, 1, 0, 0.55, 0.24);   // her back to a hedge: pulled in like the follow camera
  assert.ok(near(deadEnd.dist, 0.5 - L.CAMERA_GAP));
  for (const difficulty of DIFFS) {   // in real mazes it always stands on open floor
    for (const seed of SEEDS.slice(0, 20)) {
      const g = L.createGame({ seed, difficulty });
      for (let y = 0; y < g.height; y++) {
        for (let x = 0; x < g.width; x++) {
          if (!L.isOpen(g, x, y)) continue;
          for (const [dx, dy] of Object.values(L.DIRS)) {
            const cam = L.shoulderCamera(g, x + 0.5, y + 0.5, dx, dy, 0.55, 0.24);
            assert.ok(L.isOpen(g, Math.floor(cam.x), Math.floor(cam.y)), `${difficulty} ${seed}: camera in a hedge at ${cam.x}, ${cam.y}`);
          }
        }
      }
    }
  }
});

test('camera zoom: pulled back down a long corridor while Alice walks, in close when she stands beside someone', () => {
  assert.equal(L.openAhead(CORRIDOR, 1, 1, 1, 0), 6, 'six open tiles east of the west end');
  assert.equal(L.openAhead(CORRIDOR, 1, 1, 0, 1), 0, 'a hedge right beside her');
  const g = L.createGame({ seed: 12, difficulty: 'easy', chase: true }), way = g.garden.way;
  g.alice = { x: 2, y: way };   // on the lawn, the way into the maze straight ahead
  assert.ok(L.openAhead(g, 2, way, 1, 0) >= L.LONG_CORRIDOR);
  assert.equal(L.cameraZoom(g, 'right', true), 1, 'walking down a long way: pulled back');
  assert.equal(L.cameraZoom(g, 'left', true), 0, 'walking at a hedge: as usual');
  assert.equal(L.cameraZoom(g, 'right', false), -1, 'standing by her sister and Dinah: in close');
  g.alice = { x: 6, y: g.garden.y1 };   // the bottom of the lawn, nobody near
  assert.equal(L.besideSomeone(g), false);
  assert.equal(L.cameraZoom(g, 'right', false), 0);
  const r = Object.assign(g.rabbit, { x: 7, y: g.garden.y1 });   // the Rabbit at the bottom of the lawn, away from the others
  g.alice = { x: 6, y: g.garden.y1 - 1 };   // a step from him, corner to corner counts
  assert.equal(L.besideSomeone(g), true);
  r.gone = true;
  assert.equal(L.besideSomeone(g), false, 'not once he’s gone down the hole');
  const tea = L.createGame({ seed: 12, difficulty: 'easy', story: true });
  tea.alice = { ...tea.table };
  assert.equal(L.besideSomeone(tea), true, 'the tea table');
  tea.alice = { x: tea.caterpillar.x, y: tea.caterpillar.y + 1 };
  assert.equal(L.besideSomeone(tea), true, 'the Caterpillar');
  const c = tea.creatures[0];
  tea.alice = { x: c.x + 1, y: c.y };
  assert.equal(L.besideSomeone(tea), true, 'a friend');
});

test('follow camera: a hedge close behind Alice pulls it in, but never past her', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  const deadEnd = L.followCamera(CORRIDOR, 1.5, 1.5, 1, 0, 1.5);   // her back to the west end, half a tile away
  assert.ok(near(deadEnd.dist, 0.5 - L.CAMERA_GAP) && near(deadEnd.x, 1 + L.CAMERA_GAP) && deadEnd.y === 1.5);
  const walking = L.followCamera(CORRIDOR, 2.2, 1.5, 1, 0, 1.5);   // stepping away from it, the camera backs out too
  assert.ok(near(walking.dist, 1.2 - L.CAMERA_GAP));
  const side = L.followCamera(CORRIDOR, 5.5, 1.5, 0, -1, 1.5);   // turned to face a side hedge: one's behind her too
  assert.ok(near(side.dist, 0.5 - L.CAMERA_GAP) && near(side.y, 2 - L.CAMERA_GAP));
  const squeezed = L.followCamera(CORRIDOR, 1.1, 1.5, 1, 0, 1.5);   // nearer than the gap: the camera stays on Alice
  assert.deepEqual(squeezed, { x: 1.1, y: 1.5, dist: 0 });
});

test('follow camera: in real mazes it always stands on open floor, clear of the hedge behind it', () => {
  for (const [seed, difficulty] of [[4, 'easy'], [9, 'medium'], [42, 'hard']]) {
    const g = L.createGame({ seed, difficulty });
    let clamped = 0, checked = 0;
    for (let y = 1; y < g.height - 1; y++) {
      for (let x = 1; x < g.width - 1; x++) {
        if (!L.isOpen(g, x, y)) continue;
        // Alice at the tile's centre, or part way into an open neighbour (as she's drawn mid-step). Not exactly
        // on the tile edge: a camera looking straight along that line would sit on the hedge's very surface.
        const spots = [[x + 0.5, y + 0.5]];
        for (const [dx, dy] of Object.values(L.DIRS)) {
          if (L.isOpen(g, x + dx, y + dy)) for (const t of [0.2, 0.45, 0.7]) spots.push([x + 0.5 + dx * t, y + 0.5 + dy * t]);
        }
        for (const [ax, ay] of spots) {
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {   // every facing, and the angles in between mid-turn
            const dx = Math.cos(a), dy = Math.sin(a);
            const cam = L.followCamera(g, ax, ay, dx, dy, 1.5);
            assert.ok(L.isOpen(g, Math.floor(cam.x), Math.floor(cam.y)), `camera in a hedge at ${cam.x}, ${cam.y}`);
            assert.ok(cam.dist >= 0 && cam.dist <= 1.5);
            assert.ok(Math.abs(Math.hypot(ax - cam.x, ay - cam.y) - cam.dist) < 1e-9, 'straight behind her');
            const behind = L.castRay(g, cam.x, cam.y, -dx, -dy).dist;
            if (cam.dist < 1.5) {
              clamped++;
              assert.ok(behind >= L.CAMERA_GAP - 1e-9, `only ${behind} from the hedge behind`);
            }
            checked++;
          }
        }
      }
    }
    assert.ok(clamped > checked * 0.1 && clamped < checked, `${difficulty}: some views clamped (${clamped}/${checked})`);
  }
});

// ---------- Functional: full games played through the public API ----------

test('simulated playthroughs win every difficulty without losing a heart', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 40)) {
      const g = autoplay(L.createGame({ seed, difficulty, fog: true }));
      assert.equal(g.status, 'won', `${difficulty} seed ${seed}`);
      assert.equal(g.hearts, L.DIFFICULTY[difficulty].hearts);
      assert.equal(g.creatures.filter((c) => !c.cleared).length, 0, 'every creature sent away');
      assert.equal(g.used.length, g.creatures.length);
    }
  }
});

// ---------- Map 2.0: tiny Alice and the Caterpillar ----------

test('Map 2.0: Alice starts tiny and the Caterpillar can always be reached before any creature', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.equal(g.small, true);
      const cat = g.caterpillar;
      assert.ok(cat && !cat.gone, 'a Caterpillar');
      assert.ok(!(cat.x === g.start.x && cat.y === g.start.y), 'not on the start');
      assert.ok(!g.items.some((i) => i.x === cat.x && i.y === cat.y), 'no tool under him');
      const blocked = new Set();
      for (const c of g.creatures) for (const k of corridorCells(g, c)) blocked.add(k);
      const prev = L.bfs(g, g.start.x, g.start.y, (x, y) => blocked.has(key(g, x, y)));
      assert.notEqual(prev[key(g, cat.x, cat.y)], -1, `${difficulty} seed ${seed}: Caterpillar reachable past no creature`);
      assert.ok(g.creatures.length > 0, 'friends to meet');
    }
  }
});

test('Map 2.0 off: Home and Wonderland play exactly as before', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const plain = L.createGame({ seed, difficulty: 'medium' });
    assert.equal(plain.small, false);
    assert.equal(plain.caterpillar, null);
  }
});

test('Tea Party has no tools and nobody can hurt Alice: no items, no hearts', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.deepEqual(g.items, []);
      assert.equal(g.hearts, null);
      assert.equal(g.riddle, null);
    }
  }
});

test('Home and Wonderland still have tools and hearts', () => {
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 12, difficulty });
    assert.ok(g.items.length > 0, `${difficulty}: tools to find`);
    assert.equal(g.hearts, L.DIFFICULTY[difficulty].hearts);
  }
});

test('tiny Alice is only blocked by creatures, never asked a riddle, even by a wanderer walking into her', () => {
  for (const difficulty of ['medium', 'hard']) {
    const g = L.createGame({ seed: 21, difficulty, story: true });
    const c = g.creatures[0];
    g.alice = { ...g.mainPath[c.pathIndex - 1] };
    const events = L.move(g, dirBetween(g.alice, c));
    assert.equal(events[0].type, 'tooSmall');
    assert.equal(g.riddle, null, 'no riddle while tiny');
    assert.equal(c.cleared, false);
    const w = g.creatures.find((x) => x.wander);
    w.pathIndex = w.lo; w.x = g.mainPath[w.lo].x; w.y = g.mainPath[w.lo].y; w.dir = 1;
    g.alice = { ...g.mainPath[w.lo + 1] };
    for (let i = 0; i < 4; i++) L.tick(g);
    assert.equal(g.riddle, null, 'no riddle while tiny');
    assert.notDeepEqual([w.x, w.y], [g.alice.x, g.alice.y], 'the wanderer turned back');
  }
});

test('walking into the Caterpillar: Alice grows, he leaves, and then friends ask their riddles', () => {
  const g = L.createGame({ seed: 9, difficulty: 'medium', story: true });
  const cat = g.caterpillar;
  g.alice = adjacentTo(g, cat);
  const events = L.move(g, dirBetween(g.alice, cat));
  assert.equal(events[0].type, 'grow');
  assert.equal(g.small, false);
  assert.equal(cat.gone, true);
  assert.equal(L.caterpillarAt(g, cat.x, cat.y), false);
  L.move(g, dirBetween(g.alice, cat));
  assert.deepEqual([g.alice.x, g.alice.y], [cat.x, cat.y], 'his tile is free now');
  const c = g.creatures[0];
  g.alice = { ...g.mainPath[c.pathIndex - 1] };
  assert.equal(L.move(g, dirBetween(g.alice, c))[0].type, 'riddle');
});

test('simulated playthroughs win Map 2.0 at every difficulty, answering every riddle', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 40)) {
      const g = autoplay(L.createGame({ seed, difficulty, fog: true, story: true }));
      assert.equal(g.status, 'won', `${difficulty} seed ${seed}`);
      assert.equal(g.small, false);
      assert.equal(g.hearts, null);
      assert.equal(g.key, true, 'won with the golden key');
      assert.equal(g.greeted, true, 'by way of the tea party');
    }
  }
});

// ---------- Map 2.0: letters, the Queen's table, the golden key and the garden gate ----------

test('Tea Party: a maze 25% bigger than the others, with only the friends who aren’t at the table', () => {
  for (const difficulty of DIFFS) {
    const { width, height, creatures } = L.DIFFICULTY[difficulty];
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.deepEqual([g.width, g.height], L.TEA.size[difficulty]);
      assert.ok(g.width >= width * 1.2 && g.height >= height * 1.2, `${difficulty}: about 25% bigger`);
      assert.equal(g.creatures.length, Math.min(creatures, 3));
      for (const c of g.creatures) assert.ok(L.TEA.friends.includes(c.type), `${c.type} is not at the table`);
      assert.equal(g.key, false);
      assert.equal(g.tea, true);
    }
  }
  const plain = L.createGame({ seed: 3 });
  assert.equal(plain.tea, false);
  assert.equal(plain.table, null);
  assert.equal(plain.room, null);
  assert.equal(plain.key, true, 'Home and Wonderland have no gate to unlock');
});

test('Tea Party: the table stands in an open clearing in the middle, with one way in, off the route', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), r = g.room, th = g.table;
      assert.deepEqual([th.x, th.y], [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], 'table in the middle of the clearing');
      assert.ok(Math.abs(th.x - g.width / 2) < 2 && Math.abs(th.y - g.height / 2) < 2, 'clearing in the middle of the maze');
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) assert.ok(L.isOpen(g, x, y), 'no hedges inside');
      let gaps = 0;
      for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (!L.inRoom(g, x, y) && L.isOpen(g, x, y)) gaps++;
      }
      assert.equal(gaps, 1, `${difficulty} seed ${seed}: one way in`);
      assert.ok(!g.mainPath.some((p) => L.inRoom(g, p.x, p.y)), 'off the route');
      assert.ok(!g.creatures.some((c) => L.inRoom(g, c.x, c.y)), 'no friend in the clearing');
      assert.ok(!L.inRoom(g, g.caterpillar.x, g.caterpillar.y), 'nor the Caterpillar');
      assert.deepEqual([g.seat.x, g.seat.y], [th.x, th.y + 1], 'Alice’s chair on the near side');
      assert.deepEqual(g.props.map((p) => p.kind), ['hatter', 'marchhare', 'queen']);
      for (const p of g.props) assert.equal(Math.abs(p.x - th.x) + Math.abs(p.y - th.y), 1, `${p.kind} at the table`);
      const prev = L.bfs(g, g.start.x, g.start.y, (x, y) => x === g.exit.x && y === g.exit.y);
      assert.notEqual(prev[key(g, g.seat.x, g.seat.y)], -1, 'the chair reachable with the gate shut');
    }
  }
});

// Puts grown-up Alice just outside creature 0 and walks into it, so a riddle is pending.
function askRiddle(seed = 4, difficulty = 'medium') {
  const g = L.createGame({ seed, difficulty, story: true });
  g.small = false;
  const c = g.creatures[0];
  g.alice = { ...g.mainPath[c.pathIndex - 1] };
  const events = L.move(g, dirBetween(g.alice, c));
  return { g, c, events };
}

test('helping a friend in the Tea Party: they step aside, with no letter', () => {
  const { g, c } = askRiddle();
  const events = L.answer(g, true);
  assert.deepEqual(events.map((e) => e.type), ['cleared']);
  assert.equal(c.cleared, true);
  assert.equal(g.riddle, null);
});

test('walking into a friend as grown-up Alice asks a riddle and she stays put', () => {
  const { g, c, events } = askRiddle();
  assert.deepEqual(events.map((e) => e.type), ['riddle']);
  assert.deepEqual(g.riddle, { id: c.id, wrong: 0 });
  assert.deepEqual([g.alice.x, g.alice.y], [g.mainPath[c.pathIndex - 1].x, g.mainPath[c.pathIndex - 1].y]);
  assert.equal(c.cleared, false);
});

test('no walking while a riddle waits for its answer, and walking works again afterwards', () => {
  const { g, c } = askRiddle();
  const at = { ...g.alice };
  for (const d of Object.keys(L.DIRS)) assert.deepEqual(L.move(g, d), []);
  assert.deepEqual(g.alice, at);
  L.answer(g, true);
  L.move(g, dirBetween(g.alice, c));
  assert.deepEqual([g.alice.x, g.alice.y], [c.x, c.y], 'the friend has stepped aside');
});

test('a wanderer bumping into grown-up Alice just turns back: no riddle', () => {
  const g = L.createGame({ seed: 21, difficulty: 'medium', story: true });
  g.small = false;
  const w = g.creatures.find((x) => x.wander);
  w.pathIndex = w.lo; w.x = g.mainPath[w.lo].x; w.y = g.mainPath[w.lo].y; w.dir = 1;
  g.alice = { ...g.mainPath[w.lo + 1] };
  for (let i = 0; i < 4; i++) L.tick(g);
  assert.equal(g.riddle, null);
  assert.equal(w.cleared, false);
});

test('wrong answers: two give another riddle with tries left, the third sends Alice back to the start', () => {
  const { g } = askRiddle();
  g.creatures[1].cleared = true;   // a friend already helped earlier
  let events = L.answer(g, false);
  assert.deepEqual(events.map((e) => [e.type, e.triesLeft]), [['wrongAnswer', 2]]);
  assert.ok(g.riddle);
  events = L.answer(g, false);
  assert.deepEqual(events.map((e) => [e.type, e.triesLeft]), [['wrongAnswer', 1]]);
  assert.equal(g.riddle.wrong, 2);
  events = L.answer(g, false);
  assert.deepEqual(events.map((e) => e.type), ['sentBack']);
  assert.equal(g.riddle, null);
  assert.deepEqual(g.alice, g.start);
  assert.equal(g.creatures[0].cleared, false, 'this friend asks again next time');
  assert.equal(g.creatures[1].cleared, true, 'friends already helped stay helped');
  assert.equal(L.RIDDLE_TRIES, 3);
});

test('a right answer after a wrong one still clears the friend', () => {
  const { g, c } = askRiddle();
  L.answer(g, false);
  assert.deepEqual(L.answer(g, true).map((e) => e.type), ['cleared']);
  assert.equal(c.cleared, true);
});

test('answer() with no riddle pending does nothing', () => {
  const g = L.createGame({ seed: 4, difficulty: 'easy', story: true });
  assert.deepEqual(L.answer(g, true), []);
  assert.deepEqual(L.answer(g, false), []);
  assert.equal(g.key, false);
});

// Grown-up Alice just outside the tea party's clearing, at its one way in.
function atTheParty(seed = 4, difficulty = 'easy') {
  const g = L.createGame({ seed, difficulty, story: true });
  g.small = false;
  const r = g.room;
  for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
    if (!L.inRoom(g, x, y) && L.isOpen(g, x, y)) g.alice = { x, y };
  }
  return g;
}

// Walks Alice by the shortest way to a tile next to `target` (the guests, table and chair count as in the way).
function walkUpTo(g, target) {
  const solid = [g.table, g.seat, ...g.props].filter((p) => p !== target);
  const prev = L.bfs(g, g.alice.x, g.alice.y, (x, y) => solid.some((p) => p.x === x && p.y === y));
  const near = Object.values(L.DIRS).map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))
    .map((p) => L.pathTo(g, prev, p.x, p.y)).filter(Boolean).sort((a, b) => a.length - b.length)[0];
  for (const step of near.slice(1)) L.move(g, dirBetween(g.alice, step));
}

test('into the clearing: “No room! No room!”, once', () => {
  const g = atTheParty();
  const into = Object.keys(L.DIRS).find((d) => L.inRoom(g, g.alice.x + L.DIRS[d][0], g.alice.y + L.DIRS[d][1]));
  const events = L.move(g, into);
  assert.deepEqual(events.map((e) => e.type), ['moved', 'noRoom']);
  assert.equal(g.greeted, true);
  L.move(g, L.opposite(into));
  assert.deepEqual(L.move(g, into).map((e) => e.type), ['moved'], 'only the first time');
});

test('the guests block their tiles and answer; tiny Alice can’t climb into the chair', () => {
  const g = atTheParty();
  let events;
  for (const guest of g.props) {
    walkUpTo(g, guest);
    events = L.move(g, dirBetween(g.alice, guest));
    assert.deepEqual(events.map((e) => e.type), ['prop'], guest.kind);
    assert.equal(events[0].text, L.PROP_SAYS[guest.kind]);
  }
  walkUpTo(g, g.seat);
  g.small = true;
  events = L.move(g, dirBetween(g.alice, g.seat));
  assert.equal(events[0].type, 'tooSmall');
  assert.equal(g.seated, false);
});

test('Alice sits in her chair: no walking until the Hatter’s riddle is answered and she stands', () => {
  const g = atTheParty();
  walkUpTo(g, g.seat);
  let events = L.move(g, dirBetween(g.alice, g.seat));
  assert.deepEqual(events.map((e) => e.type), ['moved', 'sit']);
  assert.deepEqual([g.alice.x, g.alice.y], [g.seat.x, g.seat.y]);
  assert.equal(g.seated, true);
  assert.deepEqual(g.riddle, { table: true, wrong: 0 });
  for (const d of Object.keys(L.DIRS)) assert.deepEqual(L.move(g, d), [], 'seated');
  for (let i = 0; i < 5; i++) {   // wrong answers: just another riddle, never sent back
    events = L.answer(g, false);
    assert.deepEqual(events.map((e) => [e.type, e.triesLeft]), [['wrongAnswer', null]]);
  }
  assert.equal(g.riddle.wrong, 5);
  assert.deepEqual([g.alice.x, g.alice.y], [g.seat.x, g.seat.y], 'still at the table');
  events = L.answer(g, true);
  assert.deepEqual(events.map((e) => e.type), ['key']);
  assert.equal(g.key, true);
  assert.equal(g.riddle, null);
  assert.deepEqual(L.move(g, 'up'), [], 'still seated until she stands');
  L.standUp(g);
  assert.equal(g.seated, false);
  assert.equal(L.move(g, 'down')[0].type, 'moved');
  assert.equal(L.move(g, 'up')[0].type, 'moved', 'with the key, her chair is just a tile');
  events = L.move(g, 'up');
  assert.equal(events[0].type, 'table', 'the table blocks its tile');
  assert.match(events[0].text, /garden gate/, 'afterwards the Queen waves her off');
  assert.deepEqual([g.alice.x, g.alice.y], [g.seat.x, g.seat.y]);
});

test('the garden gate stays locked without the golden key, and opens with it', () => {
  const g = L.createGame({ seed: 8, difficulty: 'easy', story: true });
  g.small = false;
  g.alice = adjacentTo(g, g.exit);
  let events = L.move(g, dirBetween(g.alice, g.exit));
  assert.equal(events[0].type, 'locked');
  assert.equal(g.status, 'playing');
  g.key = true;
  events = L.move(g, dirBetween(g.alice, g.exit));
  assert.equal(g.status, 'won');
});

test('Tea Party: the Caterpillar waits a short walk from the start, two turns in', () => {
  const turnsTo = (g, target) => {
    const p = L.pathTo(g, L.bfs(g, g.start.x, g.start.y), target.x, target.y);
    let turns = 0;
    for (let k = 2; k < p.length; k++) {
      if (p[k].x - p[k - 1].x !== p[k - 1].x - p[k - 2].x || p[k].y - p[k - 1].y !== p[k - 1].y - p[k - 2].y) turns++;
    }
    return { turns, steps: p.length - 1 };
  };
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true });
      const { turns, steps } = turnsTo(g, g.caterpillar);
      assert.equal(turns, 2, `${difficulty} seed ${seed}: ${turns} turns`);
      assert.ok(steps >= 3 && steps <= 30, `${difficulty} seed ${seed}: ${steps} steps`);
    }
  }
});

// ---------- Follow the White Rabbit: the White Rabbit chase, the DRINK ME bottle and the rabbit hole ----------

// Follows the White Rabbit like a child would: always towards him, then the bottle, then the hole.
function chase(g, maxMoves = 4000) {
  for (let moves = 0; g.status === 'playing' && moves < maxMoves; moves++) {
    const r = g.rabbit, b = g.bottle;
    const goal = !r.gone ? r : b && !b.taken ? b : g.exit;
    const route = L.pathTo(g, L.bfs(g, g.alice.x, g.alice.y), goal.x, goal.y);
    if (route.length > 1) L.move(g, dirBetween(g.alice, route[1]));
    L.tick(g);
    if (!r.gone) {
      const at = g.mainPath.findIndex((p) => p.x === g.alice.x && p.y === g.alice.y);
      assert.ok(r.pathIndex > at, `seed ${g.seed}: the Rabbit stays ahead of Alice`);
    }
  }
  return g;
}

test('Follow the White Rabbit: no creatures, no tools, no hearts; the Rabbit starts a few hops ahead', () => {
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 12, difficulty, chase: true });
    assert.equal(g.creatures.length, 0);
    assert.equal(g.items.length, 0);
    assert.equal(g.hearts, null);
    assert.equal(g.rabbit.pathIndex, L.RABBIT_LEAD);
    assert.equal(g.small, false);
  }
});

test('the garden: a lawn on the left with the house, Alice’s sister and Dinah; a low maze on the right; no fog', () => {
  const sizes = { easy: [25, 17], medium: [27, 17], hard: [29, 19] };   // 30% bigger than the old maze-only map
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 12, difficulty, fog: true, chase: true });
    assert.deepEqual([g.width, g.height], sizes[difficulty]);
    assert.equal(g.fog, false, 'the Rabbit is always in sight');
    const { x0, y0, x1, y1, way, house } = g.garden;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const inHouse = x >= house.x && x < house.x + house.w && y >= house.y && y < house.y + house.h;
        assert.equal(L.isOpen(g, x, y), !inHouse, `${difficulty} (${x}, ${y})`);
      }
    }
    assert.ok(L.isOpen(g, x1 + 1, way), 'the way into the maze');
    for (let y = 0; y < g.height; y++) if (y !== way) assert.equal(L.isOpen(g, x1 + 1, y), false, 'the lawn’s hedge has just the one gap');
    const lawnPart = g.mainPath.filter((p) => p.x <= x1);
    assert.ok(lawnPart.every((p) => p.y === way), 'straight along the lawn to the way in');
    for (const p of g.props) assert.ok(!g.mainPath.some((q) => q.x === p.x && q.y === p.y), `${p.kind} sits off the route`);
    assert.deepEqual(g.props.map((p) => p.kind), ['sister', 'dinah']);
  }
});

test('bumping into Alice’s sister or Dinah: they answer, and Alice stays put', () => {
  for (const kind of ['sister', 'dinah']) {
    const g = L.createGame({ seed: 12, difficulty: 'easy', chase: true });
    const p = g.props.find((k) => k.kind === kind), from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
      .find((q) => L.isOpen(g, q.x, q.y) && !L.propAt(g, q.x, q.y));
    g.alice = { ...from };
    const events = L.move(g, dirBetween(from, p));
    assert.equal(events[0].type, 'prop');
    assert.equal(events[0].text, L.PROP_SAYS[kind]);
    assert.deepEqual(g.alice, from);
  }
});

test('the Rabbit waits at each corner until Alice is close, then runs on to the next, leaving paw prints', () => {
  const g = L.createGame({ seed: 12, difficulty: 'easy', chase: true }), r = g.rabbit;
  L.tick(g);
  assert.equal(r.waiting, true, 'he waits for Alice to set off');
  assert.equal(r.pathIndex, L.RABBIT_LEAD);
  L.move(g, dirBetween(g.alice, g.mainPath[1]));
  const events = L.tick(g);
  assert.equal(events[0].type, 'rabbitHops');
  assert.equal(r.pathIndex, L.RABBIT_LEAD + 1);
  const stop = r.stops.find((i) => i > L.RABBIT_LEAD);
  for (let i = 0; i < 40 && r.running; i++) L.tick(g);
  assert.equal(r.pathIndex, stop, 'he ran on to the next stop without her');
  assert.equal(stop, g.mainPath.findIndex((p) => p.x === g.garden.x1 + 1), 'the first stop is the way into the maze');
  for (let i = 0; i < 5; i++) L.tick(g);
  assert.equal(r.pathIndex, stop, 'and waits there, tapping his watch');
  assert.equal(r.waiting, true);
  assert.equal(g.prints.length, stop - L.RABBIT_LEAD);
  assert.deepEqual([g.prints[0].dx, g.prints[0].dy], [1, 0], 'the prints point the way he went');
  // Every corner of the route is a stop.
  for (let i = 1; i < g.mainPath.length - 1; i++) {
    const [a, b, c] = [g.mainPath[i - 1], g.mainPath[i], g.mainPath[i + 1]];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) assert.ok(r.stops.includes(i), `corner ${i}`);
  }
  assert.equal(r.stops[r.stops.length - 1], g.mainPath.length - 2, 'and the oak’s foot');
  const behind = g.mainPath[r.pathIndex - 1];
  g.alice = { ...behind };
  assert.equal(L.move(g, dirBetween(g.alice, r))[0].type, 'rabbitAhead', 'she can’t walk into him');
  assert.deepEqual(g.alice, behind);
});

test('the Rabbit drops his gloves and fan on the way; Alice can pick them up, and he thanks her at the oak', () => {
  const g = L.createGame({ seed: 12, difficulty: 'easy', chase: true }), r = g.rabbit;
  assert.deepEqual(g.treats.map((t) => [t.kind, t.dropped]), [['gloves', false], ['fan', false]]);
  const gloves = g.treats[0];
  Object.assign(r, { pathIndex: gloves.pathIndex, ...g.mainPath[gloves.pathIndex], running: true });
  const events = L.tick(g);
  assert.equal(events[0].type, 'dropped');
  assert.equal(gloves.dropped, true);
  g.alice = { ...g.mainPath[gloves.pathIndex - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, gloves)).some((ev) => ev.type === 'treat'));
  assert.equal(gloves.taken, true);
  const last = g.mainPath.length - 1;
  Object.assign(r, { pathIndex: last - 1, ...g.mainPath[last - 1], running: false });
  g.alice = { ...g.mainPath[last - 2] };
  const dive = L.tick(g).find((ev) => ev.type === 'dive');
  assert.match(dive.text, /My gloves… thank you/);
});

test('at the oak the Rabbit dives in and drops DRINK ME; the hole only fits Alice once she’s drunk it', () => {
  const g = L.createGame({ seed: 12, difficulty: 'easy', chase: true });
  const last = g.mainPath.length - 1;
  Object.assign(g.rabbit, { pathIndex: last - 1, ...g.mainPath[last - 1] });
  g.alice = { ...g.mainPath[last - 3] };
  const events = L.tick(g);
  assert.equal(events[0].type, 'dive');
  assert.equal(g.rabbit.gone, true);
  assert.deepEqual([g.bottle.x, g.bottle.y], [g.mainPath[last - 1].x, g.mainPath[last - 1].y]);
  g.alice = { ...g.mainPath[last - 2] };
  L.move(g, dirBetween(g.alice, g.mainPath[last - 1]));
  assert.equal(g.small, true, 'drank it');
  assert.equal(g.bottle.taken, true);
  const big = L.createGame({ seed: 12, difficulty: 'easy', chase: true });
  big.alice = { ...big.mainPath[last - 1] };
  assert.equal(L.move(big, dirBetween(big.alice, big.exit))[0].type, 'tooBig');
  assert.equal(big.status, 'playing');
  assert.equal(L.move(g, dirBetween(g.alice, g.exit))[0].type, 'fall');
  assert.equal(g.status, 'fell');
});

test('200 Follow the White Rabbit mazes per difficulty: following the Rabbit always ends down the rabbit hole', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = chase(L.createGame({ seed, difficulty, chase: true }));
      assert.equal(g.status, 'fell', `${difficulty} seed ${seed}`);
      assert.equal(g.small, true);
      assert.ok(g.treats.every((t) => t.dropped && t.taken), 'the gloves and fan lie on the route, so a follower finds them');
      assert.ok(g.prints.length <= L.PRINTS_KEPT);
    }
  }
});
