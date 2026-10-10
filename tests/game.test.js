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
      if (!c.cleared && !g.inventory.includes(L.CREATURES[c.type].tool)) for (const k of corridorCells(g, c)) blocked.add(k);
    }
    const prev = L.bfs(g, g.alice.x, g.alice.y, (x, y) => blocked.has(key(g, x, y)));
    const goals = [
      ...g.items.filter((i) => !i.taken),
      ...g.creatures.filter((c) => !c.cleared && g.inventory.includes(L.CREATURES[c.type].tool)),
      g.exit,
    ];
    const route = goals.map((p) => L.pathTo(g, prev, p.x, p.y)).find((r) => r && r.length > 1);
    assert.ok(route, `stuck at ${JSON.stringify(g.alice)} (seed ${g.seed})`);
    L.move(g, dirBetween(g.alice, route[1]));
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
    medium: { width: 35, height: 19, creatures: 5, wanderers: 2, hearts: 3, fog: 3.5 },
    hard: { width: 45, height: 25, creatures: 6, wanderers: 4, hearts: 3, fog: 2.8 },
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

test('creature list is the agreed six, each with its own tool', () => {
  const pairs = Object.fromEntries(Object.entries(L.CREATURES).map(([k, v]) => [k, v.tool]));
  assert.deepEqual(pairs, { ghost: 'lantern', dog: 'bone', spider: 'broom', pumpkin: 'bucket', cat: 'snack', bunny: 'carrot' });
  for (const tool of Object.values(pairs)) assert.ok(L.TOOLS[tool], `${tool} defined`);
  assert.equal(L.CREATURES.pumpkin.canWander, false);
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
  g.trail = [at - 3, at - 2, at - 1].map((i) => ({ ...g.mainPath[i] }));
  g.alice = { ...g.mainPath[at] };
  return { g, c, at };
}

test('bumping a wanderer without its tool costs a heart and pushes Alice back 3 steps', () => {
  const { g, c, at } = wandererSetup();
  const events = L.move(g, dirBetween(g.alice, c));
  assert.equal(events[0].type, 'hurt');
  assert.equal(g.hearts, 2);
  assert.deepEqual(g.alice, g.mainPath[at - 3]);
  assert.ok(g.invuln > 0);
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
