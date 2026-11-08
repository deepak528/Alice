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
    if (g.rabbit && !g.rabbit.gone) blocked.add(key(g, g.rabbit.x, g.rabbit.y));   // the Tea Party: he stands on the lawn
    if (g.small) for (const b of g.blocks || []) if (b.kind === 'latch' && !b.open) blocked.add(key(g, b.x, b.y));   // too high for tiny Alice
    if (g.tea && g.alice.x <= g.landing.x1) {   // the landing lawn: eat the mushroom, then through the right little door
      const door = g.doors.find((d) => d.right), front = { x: door.x - 1, y: door.y };
      if (g.small && g.alice.x === front.x && g.alice.y === front.y) {
        const events = L.move(g, 'right');
        assert.deepEqual(events.map((e) => e.type), ['moved', 'throughLittleDoor'], `seed ${g.seed}`);
        continue;
      }
      const to = g.small ? front : g.sizers.find((z) => !z.taken);
      const way = L.pathTo(g, L.bfs(g, g.alice.x, g.alice.y, (x, y) => blocked.has(key(g, x, y))), to.x, to.y);
      assert.ok(way && way.length > 1, `stuck on the lawn at ${JSON.stringify(g.alice)} (seed ${g.seed})`);
      L.move(g, dirBetween(g.alice, way[1]));
      continue;
    }
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
    if (events.some((e) => e.type === 'whoAreYou')) L.introduce(g, 'alice');
    if (events.some((e) => e.type === 'sit')) {   // decorate the cake as the Hatter asks, then his riddle, then up
      const done = g.cake.order.flatMap((t) => L.decorate(g, t)).map((e) => e.type);
      assert.equal(done[done.length - 1], 'cakeDone', `seed ${g.seed}: the cake decorated`);
      L.answer(g, true);
      L.standUp(g);
    }
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

test('Map 2.0: Alice lands full size, and past the little doors the Caterpillar can always be reached before any creature', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.equal(g.small, false, 'she lands full size; the mushroom on the lawn shrinks her');
      const cat = g.caterpillar, from = g.mainPath[0];
      assert.ok(cat && !cat.gone, 'a Caterpillar');
      assert.ok(!(cat.x === from.x && cat.y === from.y), 'not on the start');
      assert.ok(!g.items.some((i) => i.x === cat.x && i.y === cat.y), 'no tool under him');
      const blocked = new Set();
      for (const c of g.creatures) for (const k of corridorCells(g, c)) blocked.add(k);
      const prev = L.bfs(g, from.x, from.y, (x, y) => blocked.has(key(g, x, y)));
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
    g.small = true;   // as if she'd eaten the landing lawn's mushroom
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
  g.small = true;   // shrunk on the landing lawn
  const cat = g.caterpillar;
  g.alice = adjacentTo(g, cat);
  let events = L.move(g, dirBetween(g.alice, cat));
  assert.deepEqual(events.map((e) => e.type), ['whoAreYou'], '“Who… are… YOU?”');
  assert.equal(g.asking, 'caterpillar');
  const at = { ...g.alice };
  for (const d of Object.keys(L.DIRS)) assert.deepEqual(L.move(g, d), [], 'no walking off before answering');
  assert.deepEqual(g.alice, at);
  for (const who of ['rabbit', 'queen']) {
    assert.deepEqual(L.introduce(g, who).map((e) => [e.type, e.who]), [['notMe', who]]);
    assert.equal(g.small, true, 'still tiny');
  }
  events = L.introduce(g, 'alice');
  assert.equal(events[0].type, 'grow');
  assert.equal(g.asking, null);
  assert.deepEqual(L.introduce(g, 'alice'), [], 'asked once');
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
      assert.equal(g.sizers[0].taken, true, 'the landing lawn’s mushroom eaten');
      assert.equal(g.caterpillar.gone, true, 'grown again by the Caterpillar');
      assert.equal(g.blocks[0].open, true, 'through the latch gate');
      assert.equal(g.doorSpoke, false, 'never too big at a little door');
      assert.equal(g.creatures.filter((c) => c.cleared).length, L.TEA.riddlers, 'both friends helped');
      assert.equal(g.cake.placed, g.cake.order.length, 'the cake decorated');
    }
  }
});

// ---------- Map 2.0: letters, the Queen's table, the golden key and the garden gate ----------

test('Tea Party: a maze 25% bigger than the others, then a lawn; the friends always include the Mad Hatter', () => {
  for (const difficulty of DIFFS) {
    const { width, height } = L.DIFFICULTY[difficulty], [mw, mh] = L.TEA.size[difficulty];
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.deepEqual([g.width, g.height], [L.TEA.landing + 4 + mw + L.TEA.lawn + 2, mh], 'landing lawn, door hedge and ways, maze, tea lawn');
      assert.ok(mw >= width * 1.2 && mh >= height * 1.2, `${difficulty}: the maze about 25% bigger`);
      assert.equal(L.TEA.riddlers, 2);
      assert.equal(g.creatures.length, L.TEA.riddlers, 'two friends with riddles, whatever the difficulty');
      assert.ok(g.creatures.some((c) => c.type === 'hatter'), 'the Mad Hatter is always one of them');
      for (const c of g.creatures) {
        assert.ok(L.TEA.friends.includes(c.type), `${c.type} is a Tea Party friend`);
        assert.ok(c.x < g.room.x0, 'friends wait in the maze');
      }
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

test('Tea Party: the maze opens onto a lawn with the tea table; the garden gate is in the hedge at its far side', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), r = g.room, th = g.table;
      assert.deepEqual([r.x0, r.x1 - r.x0 + 1, r.y0, r.y1], [L.TEA.landing + 4 + L.TEA.size[difficulty][0], L.TEA.lawn, 1, g.height - 2], 'the lawn, all the way up');
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) assert.ok(L.isOpen(g, x, y), 'no hedges on the lawn');
      const ways = [];
      for (let y = r.y0; y <= r.y1; y++) for (const x of [r.x0 - 1, r.x1 + 1]) if (L.isOpen(g, x, y)) ways.push({ x, y });
      assert.deepEqual(ways, [{ x: r.x1 + 1, y: g.exit.y }, { x: r.x0 - 1, y: g.height - 2 }].sort((a, b) => a.y - b.y), 'in from the maze, out by the gate');
      assert.deepEqual([g.exit.x, g.exit.y], [r.x1 + 1, ((g.height - 1) / 2) | 1], 'the gate, halfway up the far side');
      assert.ok(L.inRoom(g, th.x, th.y) && th.x === r.x0 + 2, 'the table on the lawn');
      assert.ok(g.mainPath.findIndex((p) => L.inRoom(g, p.x, p.y)) > 0, 'the way out crosses the lawn');
      assert.ok(!g.mainPath.some((p) => p.x > r.x1 && !(p.x === g.exit.x && p.y === g.exit.y)));
      assert.ok(!L.inRoom(g, g.caterpillar.x, g.caterpillar.y), 'the Caterpillar is in the maze');
      assert.deepEqual([g.seat.x, g.seat.y], [th.x, th.y + 1], 'Alice’s chair on the near side');
      assert.deepEqual(g.props.map((p) => p.kind), ['hatter', 'marchhare', 'queen']);
      for (const p of g.props) assert.equal(Math.abs(p.x - th.x) + Math.abs(p.y - th.y), 1, `${p.kind} at the table`);
      const solid = new Set([th, ...g.props].map((p) => key(g, p.x, p.y)));
      const prev = L.bfs(g, g.mainPath[0].x, g.mainPath[0].y, (x, y) => solid.has(key(g, x, y)));   // from past the little doors
      assert.notEqual(prev[key(g, g.exit.x, g.exit.y)], -1, 'round the tea party to the gate');
      assert.notEqual(prev[key(g, g.seat.x, g.seat.y)], -1, 'and to the chair');
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

test('wrong answers: just another riddle, as many as it takes; Alice is never sent back', () => {
  const { g, c } = askRiddle();
  g.creatures[1].cleared = true;   // a friend already helped earlier
  const at = { ...g.alice };
  for (let i = 1; i <= 10; i++) {
    const events = L.answer(g, false);
    assert.deepEqual(events.map((e) => [e.type, e.triesLeft]), [['wrongAnswer', null]], `wrong answer ${i}`);
    assert.equal(events[0].creature, c);
    assert.deepEqual(g.riddle, { id: c.id, wrong: i }, 'still asked');
    assert.deepEqual(g.alice, at, 'she stays where she is');
  }
  assert.equal(c.cleared, false);
  assert.equal(g.creatures[1].cleared, true, 'friends already helped stay helped');
  assert.deepEqual(L.answer(g, true).map((e) => e.type), ['cleared'], 'a right answer then works');
  assert.equal(c.cleared, true);
  assert.equal(g.riddle, null);
  assert.equal('RIDDLE_TRIES' in L, false);
  assert.equal('restart' in g, false);
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

// Grown-up Alice sat in her chair at the tea party.
function seated(difficulty = 'easy') {
  const g = atTheParty(4, difficulty);
  walkUpTo(g, g.seat);
  L.move(g, dirBetween(g.alice, g.seat));
  assert.equal(g.seated, true);
  return g;
}

test('Decorate the cake: the Hatter asks for 2, 3 or 4 different toppings by difficulty, in a seeded order', () => {
  assert.deepEqual(L.TEA.toppings, ['cherry', 'candle', 'star', 'strawberry', 'sweet']);
  assert.deepEqual(L.TEA.cake, { easy: 2, medium: 3, hard: 4 });
  for (const difficulty of DIFFS) {
    const orders = new Set();
    for (const seed of SEEDS.slice(0, 50)) {
      const g = L.createGame({ seed, difficulty, story: true }), { order, placed } = g.cake;
      assert.equal(order.length, L.TEA.cake[difficulty], `${difficulty} seed ${seed}`);
      assert.equal(placed, 0);
      assert.equal(new Set(order).size, order.length, 'all different');
      for (const t of order) assert.ok(L.TEA.toppings.includes(t), t);
      assert.deepEqual(L.createGame({ seed, difficulty, story: true }).cake.order, order, 'the same seed asks the same');
      orders.add(order.join());
    }
    assert.ok(orders.size > 5, `${difficulty}: different games ask for different cakes (${orders.size})`);
  }
  assert.equal(L.createGame({ seed: 3 }).cake, null, 'no cake at Home or in Wonderland');
});

test('Decorate the cake: only at the table; a wrong topping changes nothing; the right ones in turn finish it, once', () => {
  for (const difficulty of DIFFS) {
    const before = atTheParty(4, difficulty), first = before.cake.order[0];
    assert.deepEqual(L.decorate(before, first), [], 'not before she sits');
    assert.equal(before.cake.placed, 0);
    const g = seated(difficulty), { order } = g.cake;
    order.forEach((t, i) => {
      for (const wrong of L.TEA.toppings.filter((x) => x !== t)) {
        assert.deepEqual(L.decorate(g, wrong).map((e) => [e.type, e.topping]), [['notThatOne', wrong]]);
        assert.equal(g.cake.placed, i, 'a wrong topping costs nothing');
      }
      const events = L.decorate(g, t).map((e) => e.type);
      assert.deepEqual(events, i < order.length - 1 ? ['topping'] : ['topping', 'cakeDone'], `${difficulty}: ${t}`);
      assert.equal(g.cake.placed, i + 1);
    });
    for (const t of L.TEA.toppings) assert.deepEqual(L.decorate(g, t), [], 'nothing more once it’s done');
    assert.equal(g.cake.placed, order.length);
  }
  const plain = L.createGame({ seed: 3 });
  plain.seated = true;
  assert.deepEqual(L.decorate(plain, 'cherry'), [], 'no cake, nothing to decorate');
});

// ---------- Round C: the white roses, the Cheshire Cat's guiding grin ----------

test('white rose bushes: three, in dead ends off the route, spread out, never only through the gate', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true });
      assert.equal(g.roses.length, L.ROSES.bushes, `${difficulty} seed ${seed}`);
      const shut = L.bfs(g, g.mainPath[0].x, g.mainPath[0].y, (x, y) => x === g.exit.x && y === g.exit.y);
      for (const r of g.roses) {
        assert.equal(r.painted, 0);
        assert.equal(L.isOpen(g, r.x, r.y), true);
        assert.equal(Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, r.x + dx, r.y + dy)).length, 1, 'a dead end');
        assert.ok(!g.mainPath.some((p) => p.x === r.x && p.y === r.y), 'off the route');
        assert.ok(!L.inRoom(g, r.x, r.y));
        assert.ok(!(r.x === g.caterpillar.x && r.y === g.caterpillar.y));
        assert.notEqual(shut[key(g, r.x, r.y)], -1, 'reachable with the gate shut');
      }
      assert.equal(new Set(g.roses.map((r) => key(g, r.x, r.y))).size, g.roses.length);
    }
  }
});

test('painting the roses: a bush stands in the way; five taps paint it red; all three red earns the Queen’s star', () => {
  const g = L.createGame({ seed: 4, difficulty: 'easy', story: true });
  g.small = false;
  const [first] = g.roses;
  g.alice = adjacentTo(g, first);
  let events = L.move(g, dirBetween(g.alice, first));
  assert.deepEqual(events.map((e) => [e.type, e.bush, e.done]), [['roses', 0, false]]);
  assert.notDeepEqual(g.alice, { x: first.x, y: first.y }, 'the bush stays put');
  g.roses.forEach((bush, i) => {
    for (let k = 1; k <= L.ROSES.roses; k++) {
      events = L.paintRose(g, i);
      const types = events.map((e) => e.type);
      if (k < L.ROSES.roses) assert.deepEqual(types, ['paintedRose']);
      else assert.deepEqual(types, i < g.roses.length - 1 ? ['paintedRose', 'bushRed'] : ['paintedRose', 'bushRed', 'allRoses']);
    }
    assert.equal(bush.painted, L.ROSES.roses);
    if (i < g.roses.length - 1) assert.equal(g.bonus, false);
  });
  assert.equal(g.bonus, true);
  assert.deepEqual(L.paintRose(g, 0), [], 'no more to paint');
  assert.deepEqual(L.paintRose(g, 9), []);
  assert.equal(L.move(g, dirBetween(g.alice, first))[0].done, true, 'red already');
});

test('lost in dead ends: the third in a row calls the Cheshire Cat, whose grin points along the way to go', () => {
  const g = L.createGame({ seed: 4, difficulty: 'medium', story: true });
  g.small = false;
  g.caterpillar.gone = true;
  g.sizers[0].taken = true;   // the landing lawn's mushroom, eaten long ago
  const ends = [], inMaze = L.bfs(g, g.mainPath[0].x, g.mainPath[0].y);   // the maze's dead ends, past the little doors
  for (let y = 1; y < g.height - 1; y++) for (let x = 1; x < g.width - 1; x++) {
    const ways = Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, x + dx, y + dy));
    if (L.isOpen(g, x, y) && inMaze[key(g, x, y)] !== -1 && ways.length === 1 && !g.roses.some((r) => r.x === x && r.y === y)) ends.push({ x, y, from: { x: x + ways[0][0], y: y + ways[0][1] } });
  }
  const seen = ends.slice(0, L.LOST_AFTER).map((e) => {
    g.alice = { ...e.from };
    return L.move(g, dirBetween(e.from, e)).map((ev) => ev.type);
  });
  assert.deepEqual(seen.map((t) => t.includes('lost')), [false, false, true]);
  assert.equal(g.lost, 0, 'counting again');
  for (const goal of ['seat', 'exit']) {
    if (goal === 'exit') g.key = true;
    const to = g[goal], at = L.guide(g);
    assert.ok(at, goal);
    const steps = (x, y) => L.pathTo(g, L.bfs(g, x, y, (bx, by) => !(bx === to.x && by === to.y) && [g.table, ...g.props, ...g.roses].some((p) => p.x === bx && p.y === by)), to.x, to.y).length;
    const [dx, dy] = L.DIRS[at.dir];
    assert.equal(steps(at.x + dx, at.y + dy), steps(at.x, at.y) - 1, `${goal}: the grin points the way there`);
    assert.ok(steps(at.x, at.y) < steps(g.alice.x, g.alice.y), 'ahead of Alice');
  }
  g.alice = { ...g.exit };
  assert.equal(L.guide(g), null, 'nowhere to go');
  const tiny = L.createGame({ seed: 4, difficulty: 'easy', story: true }), mushroom = tiny.sizers[0];
  const lawn = L.guide(tiny), [mx, my] = L.DIRS[lawn.dir];   // just landed, full size: to the mushroom on the lawn
  const toMushroom = (x, y) => L.pathTo(tiny, L.bfs(tiny, x, y), mushroom.x, mushroom.y).length;
  assert.equal(toMushroom(lawn.x + mx, lawn.y + my), toMushroom(lawn.x, lawn.y) - 1, 'full size on the lawn: to the mushroom');
  tiny.small = true;
  mushroom.taken = true;
  tiny.alice = { ...tiny.mainPath[0] };   // through the right little door
  const way = L.guide(tiny), [cx, cy] = L.DIRS[way.dir];
  const to = (x, y) => L.pathTo(tiny, L.bfs(tiny, x, y), tiny.caterpillar.x, tiny.caterpillar.y).length;
  assert.equal(to(way.x + cx, way.y + cy), to(way.x, way.y) - 1, 'tiny Alice: to the Caterpillar');
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

// Turns along a way, counted as the game counts them: a change of direction from one step to the next (none before
// the first step).
function turnsAlong(p) {
  let turns = 0, prev = null;
  for (let k = 1; k < p.length; k++) {
    const d = dirBetween(p[k - 1], p[k]);
    if (prev && d !== prev) turns++;
    prev = d;
  }
  return turns;
}

test('Tea Party: the Caterpillar hides at the end of a side branch, about three turns in, before the latch gate and every friend', () => {
  assert.deepEqual(L.CATERPILLAR, { turns: 3, off: 2 });
  for (const difficulty of DIFFS) {
    let exact = 0;
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), cat = g.caterpillar, s = g.mainPath[0], at = `${difficulty} seed ${seed}`;
      assert.deepEqual(Object.keys(cat).sort(), ['gone', 'x', 'y'], 'only where he is, and whether he’s gone');
      const onRoute = new Set(g.mainPath.map((p) => key(g, p.x, p.y)));
      assert.ok(!onRoute.has(key(g, cat.x, cat.y)), `${at}: off the route`);
      assert.equal(Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, cat.x + dx, cat.y + dy)).length, 1, `${at}: a dead end`);
      const first = Math.min(...g.creatures.map((c) => c.lo)), past = new Set(g.mainPath.slice(first).map((p) => key(g, p.x, p.y)));
      const way = L.pathTo(g, L.bfs(g, s.x, s.y, (x, y) => past.has(key(g, x, y))), cat.x, cat.y);
      assert.ok(way, `${at}: reached without passing the first friend`);
      const latch = g.blocks[0], gate = g.mainPath.findIndex((p) => p.x === latch.x && p.y === latch.y);
      const along = way.map((p) => g.mainPath.findIndex((m) => m.x === p.x && m.y === p.y)).filter((i) => i >= 0);
      assert.ok(Math.max(...along) < gate, `${at}: his way leaves the route before the latch gate`);
      let off = 0;
      while (off < way.length && !onRoute.has(key(g, way[way.length - 1 - off].x, way[way.length - 1 - off].y))) off++;
      assert.ok(off >= L.CATERPILLAR.off, `${at}: ${off} steps off the route`);
      const turns = turnsAlong(way);
      assert.ok(Math.abs(turns - L.CATERPILLAR.turns) <= 1, `${at}: ${turns} turns`);
      if (turns === L.CATERPILLAR.turns) exact++;
      assert.ok(way.length - 1 >= 3 && way.length - 1 <= 40, `${at}: ${way.length - 1} steps, a short walk`);
    }
    assert.ok(exact >= SEEDS.length * 0.95, `${difficulty}: nearly always exactly ${L.CATERPILLAR.turns} turns (${exact}/${SEEDS.length})`);
  }
  assert.equal('CATERPILLAR_TURNS' in L, false);
});

// ---------- The Tea Party's landing lawn: the mushroom, the three little doors and the latch gate ----------

// The tile on the lawn in front of a little door, and the two tiles of the short way behind it.
const doorFront = (d) => ({ x: d.x - 1, y: d.y });
const doorWay = (d) => [{ x: d.x + 1, y: d.y }, { x: d.x + 2, y: d.y }];

test('the landing lawn: Alice lands full size, the White Rabbit beside her; the mushroom is in reach, and eating it shrinks her', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), lawn = g.landing, at = `${difficulty} seed ${seed}`;
      assert.equal(g.small, false, `${at}: full size`);
      assert.deepEqual(lawn, { x0: 1, y0: 1, x1: L.TEA.landing, y1: g.height - 2 }, 'the lawn, on the far left, all the way up');
      assert.deepEqual(g.start, { x: 2, y: ((g.height - 1) / 2) | 1 }, 'she lands halfway down the lawn');
      assert.deepEqual(g.alice, g.start);
      assert.deepEqual([g.rabbit.x, g.rabbit.y, g.rabbit.gone], [g.start.x + 2, g.start.y, false], 'the White Rabbit welcomes her');
      assert.equal(g.sizers.length, 1);
      const m = g.sizers[0];
      assert.deepEqual([m.kind, m.taken], ['mushroom', false]);
      assert.ok([lawn.x0, lawn.x1].includes(m.x) && [lawn.y0, lawn.y1].includes(m.y), `${at}: tucked into a corner of the lawn`);
      assert.equal(Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, m.x + dx, m.y + dy)).length, 1, 'a bush beside it: in by one side only');
      const way = L.pathTo(g, L.bfs(g, g.start.x, g.start.y, (x, y) => L.rabbitAt(g, x, y)), m.x, m.y);
      assert.ok(way, `${at}: the mushroom is in reach from where she lands`);
      for (const p of way) assert.ok(p.x >= lawn.x0 && p.x <= lawn.x1, 'without leaving the lawn');
      let events = [];
      for (const step of way.slice(1)) events = L.move(g, dirBetween(g.alice, step));
      assert.deepEqual(events.map((e) => e.type), ['moved', 'shrink'], `${at}: she nibbles it`);
      assert.deepEqual([g.small, m.taken], [true, true]);
      const back = dirBetween(g.alice, way[way.length - 2]);
      L.move(g, back);
      assert.deepEqual(L.move(g, L.opposite(back)).map((e) => e.type), ['moved'], 'only once');
      assert.equal(g.small, true);
    }
  }
  const plain = L.createGame({ seed: 3 });
  assert.deepEqual([plain.landing, plain.doors, plain.sizers], [null, null, []], 'Home and Wonderland have no landing lawn');
});

test('the Tea Party’s White Rabbit stays put on the lawn: ticks never move him, and he blocks his tile', () => {
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 11, difficulty, story: true }), r = { ...g.rabbit };
    for (let i = 0; i < 20; i++) L.tick(g);
    assert.deepEqual(g.rabbit, r, `${difficulty}: no hopping off along the route`);
    g.alice = { x: r.x - 1, y: r.y };
    const events = L.move(g, 'right');
    assert.ok(!events.some((e) => e.type === 'moved'), 'he stands in her way');
    assert.deepEqual(g.alice, { x: r.x - 1, y: r.y });
  }
});

test('three little doors in the lawn’s hedge; one goes on into the maze (a different one across games), the others to a DEAD END sign', () => {
  for (const difficulty of DIFFS) {
    const rightAt = [0, 0, 0];
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), at = `${difficulty} seed ${seed}`;
      assert.equal(g.doors.length, 3, at);
      assert.equal(g.doors.filter((d) => d.right).length, 1, `${at}: exactly one right door`);
      rightAt[g.doors.findIndex((d) => d.right)]++;
      const lawn = L.bfs(g, g.start.x, g.start.y);
      const s = g.mainPath[0];
      assert.equal(lawn[key(g, s.x, s.y)], -1, `${at}: the doors cut the lawn off from the maze`);
      for (const d of g.doors) {
        assert.equal(d.x, g.landing.x1 + 1, 'in the lawn’s right-hand hedge');
        assert.equal(L.isOpen(g, d.x, d.y), false, 'a door is hedge until she slips through');
        assert.notEqual(lawn[key(g, doorFront(d).x, doorFront(d).y)], -1, 'walked up to from the lawn');
        for (const p of doorWay(d)) assert.ok(L.isOpen(g, p.x, p.y), 'a short way two tiles long behind it');
        const behind = L.bfs(g, d.x + 1, d.y), reached = behind.filter((p) => p !== -1).length;
        if (d.right) {
          assert.equal(d.sign, null);
          assert.ok(reached > 2, 'the right way goes on');
          assert.notEqual(behind[key(g, s.x, s.y)], -1, `${at}: into the maze, to the route’s start`);
          assert.notEqual(behind[key(g, g.exit.x, g.exit.y)], -1, 'and on to the garden gate');
          assert.equal(s.y, d.y, 'the route starts straight on from the right door');
          assert.ok(s.x > d.x + 2, 'just past its short way');
        } else {
          assert.deepEqual(d.sign, doorWay(d)[1], `${at}: the sign at the far end of the way`);
          assert.equal(reached, 2, `${at}: a dead end, no way on`);
          assert.equal(Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, d.sign.x + dx, d.sign.y + dy)).length, 1);
        }
      }
      const middle = ((g.height - 1) / 2) | 1;
      assert.deepEqual(g.doors.map((d) => d.y), [middle - 2, middle, middle + 2], `${at}: side by side, two rows apart, round the middle`);
    }
    for (const [i, n] of rightAt.entries()) assert.ok(n > 0, `${difficulty}: door ${i + 1} is the right one sometimes (${rightAt})`);
  }
});

test('a little door: full size, it gently says she’s too big, once, then just bumps; small, she slips through either way', () => {
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 6, difficulty, story: true });
    const [d, e] = g.doors;
    g.alice = doorFront(d);
    let events = L.move(g, 'right');
    assert.deepEqual(events.map((v) => v.type), ['doorTooBig'], `${difficulty}: the door speaks`);
    assert.equal(events[0].door, d);
    assert.equal(g.doorSpoke, true);
    assert.deepEqual(g.alice, doorFront(d), 'she stays on the lawn');
    assert.deepEqual(L.move(g, 'right').map((v) => v.type), ['wall'], 'after that, just a bump');
    g.alice = doorFront(e);
    assert.deepEqual(L.move(g, 'right').map((v) => v.type), ['wall'], 'every door: it only speaks once');
    g.small = true;
    for (const door of g.doors) {
      g.alice = doorFront(door);
      const steps = g.steps;
      assert.deepEqual(L.move(g, 'right').map((v) => v.type), ['moved', 'throughLittleDoor']);
      assert.deepEqual(g.alice, doorWay(door)[0], 'through to the far side');
      assert.equal(g.steps, steps + 2);
      assert.deepEqual(L.move(g, 'left').map((v) => v.type), ['moved', 'throughLittleDoor']);
      assert.deepEqual(g.alice, doorFront(door), 'and back again');
    }
  }
});

test('stepping onto a wrong door’s sign: DEAD END; the right door’s way has none', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS.slice(0, 30)) {
      const g = L.createGame({ seed, difficulty, story: true });
      g.small = true;
      for (const d of g.doors) {
        g.alice = doorFront(d);
        L.move(g, 'right');
        const events = L.move(g, 'right').map((v) => v.type);
        assert.deepEqual(g.alice, doorWay(d)[1]);
        assert.equal(events.includes('deadEnd'), !d.right, `${difficulty} seed ${seed}: ${d.right ? 'the right way' : 'a sign'}`);
        if (!d.right) assert.deepEqual(L.move(g, 'right').map((v) => v.type), ['wall'], 'no way on');
      }
    }
  }
});

test('the latch gate: across the route past where the way to the Caterpillar leaves it, before the first friend; shut, it closes the way on', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = L.createGame({ seed, difficulty, story: true }), at = `${difficulty} seed ${seed}`, cat = g.caterpillar;
      const latches = g.blocks.filter((b) => b.kind === 'latch');
      assert.equal(latches.length, 1, `${at}: a latch gate`);
      const b = latches[0], i = g.mainPath.findIndex((p) => p.x === b.x && p.y === b.y);
      assert.equal(b.open, false);
      assert.ok(i > 0, `${at}: on the route`);
      assert.ok(i < Math.min(...g.creatures.map((c) => c.lo)), `${at}: before the first friend`);
      const fromCat = L.bfs(g, cat.x, cat.y), catDist = (p) => L.pathTo(g, fromCat, p.x, p.y).length;
      const join = g.mainPath.slice(0, i + 1).reduce((best, p, k) => (catDist(p) < catDist(g.mainPath[best]) ? k : best), 0);
      assert.ok(i > join, `${at}: past where the way to the Caterpillar leaves the route`);
      const [a, c] = [g.mainPath[i - 1], g.mainPath[i + 1]];
      assert.ok(a.x + c.x === 2 * b.x && a.y + c.y === 2 * b.y, 'on a straight bit');
      assert.equal(Object.values(L.DIRS).filter(([dx, dy]) => L.isOpen(g, b.x + dx, b.y + dy)).length, 2, 'across the whole way');
      assert.equal(b.across, L.isOpen(g, b.x - 1, b.y));
      // Shut: the Caterpillar in reach, nothing past the gate.
      const prev = L.bfs(g, g.mainPath[0].x, g.mainPath[0].y, (x, y) => x === b.x && y === b.y);
      const reach = new Set(Array.from(prev).flatMap((v, k) => (v !== -1 ? [k] : [])));
      assert.ok(reach.has(key(g, cat.x, cat.y)), `${at}: the Caterpillar in reach`);
      assert.ok(!reach.has(key(g, g.exit.x, g.exit.y)), `${at}: the garden gate out of reach`);
      assert.ok(!reach.has(key(g, g.seat.x, g.seat.y)), 'the tea party too');
      for (const f of g.creatures) assert.ok(!reach.has(key(g, g.mainPath[f.lo].x, g.mainPath[f.lo].y)), 'and every friend');
    }
  }
});

test('the latch gate: too high for tiny Alice; full size, she lifts the latch and it swings open', () => {
  for (const difficulty of DIFFS) {
    const g = L.createGame({ seed: 13, difficulty, story: true }), b = g.blocks[0];
    const i = g.mainPath.findIndex((p) => p.x === b.x && p.y === b.y), before = { ...g.mainPath[i - 1] };
    const dir = dirBetween(before, b);
    g.small = true;
    g.alice = { ...before };
    assert.deepEqual(L.move(g, dir).map((e) => e.type), ['tooSmallLatch'], difficulty);
    assert.deepEqual(g.alice, before, 'she stays put');
    assert.equal(b.open, false);
    g.small = false;
    assert.deepEqual(L.move(g, dir).map((e) => e.type), ['moved', 'latchOpen']);
    assert.deepEqual(g.alice, { x: b.x, y: b.y });
    assert.equal(b.open, true);
    L.move(g, L.opposite(dir));
    assert.deepEqual(L.move(g, dir).map((e) => e.type), ['moved'], 'open now');
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

// ---------- The Tulgey Wood ----------
const woodGame = (seed = 1, difficulty = 'easy') => L.createGame({ seed, difficulty, wood: true });
const indexOn = (g, t) => g.mainPath.findIndex((p) => p.x === t.x && p.y === t.y);

// Walks Alice along the one way through: answering the Cat's riddle (wrong once, then right) and finding the Cat.
// Walks the way through, a beat of creature time every `every` steps (none if not given): one who keeps walking
// stays ahead of the Jabberwock.
function walkWood(g, every = Infinity) {
  for (let k = 1; k < g.mainPath.length && g.status === 'playing'; k++) {
    if (k % every === 0) L.tick(g);
    const dir = dirBetween(g.alice, g.mainPath[k]);
    let events = L.move(g, dir);
    if (events.some((ev) => ev.type === 'catRiddle')) {
      assert.equal(L.answer(g, false)[0].type, 'wrongAnswer');
      assert.equal(L.answer(g, true)[0].type, 'secretPath');
      events = L.move(g, dir);
    }
    if (events.some((ev) => ev.type === 'cleared')) events = L.move(g, dir);
    assert.deepEqual(g.alice, { x: g.mainPath[k].x, y: g.mainPath[k].y }, `stuck at step ${k}: ${events.map((ev) => ev.type)}`);
  }
  return g;
}

test('the Tulgey Wood: the Tea Party’s size; DRINK ME, roots, EAT ME, thorns, the riddle, and again, in order along the way', () => {
  for (const difficulty of DIFFS) {
    const g = woodGame(3, difficulty);
    assert.deepEqual([g.width, g.height], L.WOOD.size[difficulty]);
    assert.equal(g.small, false, 'she starts at her proper size');
    assert.equal(g.hearts, null);
    const order = [...g.sizers, ...g.blocks, ...g.ghosts.map((t) => ({ ...t, kind: 'ghost' })), { ...g.secret, kind: 'secret' }]
      .sort((a, b) => indexOn(g, a) - indexOn(g, b)).map((t) => t.kind);
    assert.deepEqual(order, L.WOOD.route.map(([kind]) => kind));
    for (const t of [...g.blocks, ...g.ghosts, g.secret]) {   // across a straight bit of corridor, so they block it all
      const i = indexOn(g, t), a = g.mainPath[i - 1], b = g.mainPath[i + 1];
      assert.equal(a.x + b.x, 2 * t.x);
      assert.equal(a.y + b.y, 2 * t.y);
    }
  }
});

test('the Tulgey Wood: the Cat waits one step before the portal, his tree beside him; fake paths and creatures off the way', () => {
  const g = woodGame(5), last = g.mainPath.length - 1, cat = g.creatures[0];
  assert.equal(g.creatures.length, 1);
  assert.equal(cat.type, 'cat');
  assert.deepEqual({ x: cat.x, y: cat.y }, g.mainPath[last - 1]);
  assert.equal(Math.abs(g.catTree.x - cat.x) + Math.abs(g.catTree.y - cat.y), 1);
  assert.equal(L.isOpen(g, g.catTree.x, g.catTree.y), false);
  assert.equal(g.fakes.length, L.WOOD.fakes);
  const onWay = new Set(g.mainPath.map((p) => key(g, p.x, p.y)));
  for (const f of g.fakes) {
    assert.equal(L.isOpen(g, f.x, f.y), false, 'a fake path is really trees');
    assert.ok((L.isOpen(g, f.x - 1, f.y) && L.isOpen(g, f.x + 1, f.y)) || (L.isOpen(g, f.x, f.y - 1) && L.isOpen(g, f.x, f.y + 1)), 'it looks like it joins two paths');
  }
  assert.deepEqual(g.props.map((p) => p.kind), L.WOOD.critters);
  for (const p of g.props) assert.ok(!onWay.has(key(g, p.x, p.y)), 'the creatures never stand in the way');
  g.alice = { x: g.props[0].x, y: g.props[0].y };   // bumping into one: it answers, and Alice stays put
  const next = Object.keys(L.DIRS).find((d) => L.isOpen(g, g.alice.x + L.DIRS[d][0], g.alice.y + L.DIRS[d][1]));
  const by = { x: g.alice.x + L.DIRS[next][0], y: g.alice.y + L.DIRS[next][1] };
  g.alice = by;
  assert.equal(L.move(g, L.opposite(next))[0].type, 'prop');
  assert.deepEqual(g.alice, by);
});

test('the Tulgey Wood: roots only let tiny Alice under, thorns only let full-size Alice over; each item works once', () => {
  const g = woodGame(7), roots = g.blocks.find((b) => b.kind === 'roots'), i = indexOn(g, roots);
  g.alice = { ...g.mainPath[i - 1] };
  assert.equal(L.move(g, dirBetween(g.alice, roots))[0].type, 'tooBigRoots');
  assert.deepEqual(g.alice, g.mainPath[i - 1], 'too big: she stays put');
  const drink = g.sizers.find((z) => z.kind === 'drink');
  g.alice = { ...g.mainPath[indexOn(g, drink) - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, drink)).some((ev) => ev.type === 'woodDrink'));
  assert.equal(g.small, true);
  assert.equal(drink.taken, true);
  g.alice = { ...g.mainPath[i - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, roots)).some((ev) => ev.type === 'underRoots'));
  const thorns = g.blocks.find((b) => b.kind === 'thorns'), j = indexOn(g, thorns);
  g.alice = { ...g.mainPath[j - 1] };
  assert.equal(L.move(g, dirBetween(g.alice, thorns))[0].type, 'tooSmallThorns');
  const eat = g.sizers.find((z) => z.kind === 'eat');
  g.alice = { ...g.mainPath[indexOn(g, eat) - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, eat)).some((ev) => ev.type === 'woodEat'));
  assert.equal(g.small, false);
  const other = g.sizers.find((z) => z.kind === 'eat' && !z.taken);   // already full size: an EAT ME cake waits for later
  g.alice = { ...g.mainPath[indexOn(g, other) - 1] };
  assert.ok(!L.move(g, dirBetween(g.alice, other)).some((ev) => ev.type === 'woodEat'));
  assert.equal(other.taken, false);
  g.alice = { ...g.mainPath[j - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, thorns)).some((ev) => ev.type === 'overThorns'));
});

test('the Tulgey Wood: fake paths are only an illusion; a ghost path is found by walking it; the grin’s riddle opens the hidden path', () => {
  const g = woodGame(9), f = g.fakes[0];
  const from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).find((p) => L.isOpen(g, p.x, p.y));
  g.alice = { ...from };
  const dir = dirBetween(from, f);
  assert.equal(L.facesTile(g, dir, f.x, f.y), true, 'facing it, she sees it’s trees');
  assert.equal(L.facesTile(g, L.opposite(dir), f.x, f.y), false);
  assert.equal(L.move(g, dir)[0].type, 'illusion');
  assert.deepEqual(g.alice, from);
  const ghost = g.ghosts[0], gi = indexOn(g, ghost);
  g.alice = { ...g.mainPath[gi - 1] };
  assert.equal(L.facesTile(g, dirBetween(g.alice, ghost), ghost.x, ghost.y), true, 'facing it, she sees the path');
  assert.equal(L.facesTile(g, L.opposite(dirBetween(g.alice, ghost)), ghost.x, ghost.y), false, 'turned away, it’s trees');
  assert.ok(L.move(g, dirBetween(g.alice, ghost)).some((ev) => ev.type === 'ghostPath'));
  assert.equal(ghost.found, true);
  const si = indexOn(g, g.secret);
  g.alice = { ...g.mainPath[si - 1] };
  assert.equal(L.isOpen(g, g.secret.x, g.secret.y), false, 'trees, until the riddle is answered');
  const sdir = dirBetween(g.alice, g.secret);
  assert.equal(L.move(g, sdir)[0].type, 'catRiddle');
  assert.deepEqual(L.move(g, sdir), [], 'no walking off while asked');
  for (let k = 0; k < 5; k++) assert.equal(L.answer(g, false)[0].triesLeft, null, 'as many tries as she needs');
  assert.deepEqual(g.alice, g.mainPath[si - 1], 'never sent back');
  L.answer(g, true);
  assert.equal(g.secret.open, true);
  assert.equal(L.move(g, sdir)[0].type, 'moved');
});

test('the Tulgey Wood: the grin shows the way to the riddle, then the Cat; found, the Cat opens the portal', () => {
  const g = woodGame(11), si = indexOn(g, g.secret), last = g.mainPath.length - 1;
  const towards = (goal) => {   // the grin's spot and arrow lie along the way to `goal`
    const at = L.guide(g), way = L.pathTo(g, L.bfs(g, at.x, at.y), goal.x, goal.y);
    return way && way.length > 1 && way[1].x === at.x + L.DIRS[at.dir][0] && way[1].y === at.y + L.DIRS[at.dir][1];
  };
  assert.ok(towards(g.mainPath[si - 1]), 'first, the way to the hidden path');
  g.secret.open = true;
  g.grid[key(g, g.secret.x, g.secret.y)] = 0;
  g.alice = { ...g.mainPath[si + 2] };
  assert.ok(towards(g.creatures[0]), 'then the way to the Cat');
  g.alice = { ...g.mainPath[last - 2] };
  const events = L.move(g, dirBetween(g.alice, g.creatures[0]));
  assert.equal(events[0].type, 'cleared');
  assert.match(events[0].text, /You found me/);
  assert.equal(g.catFound, true);
  L.move(g, dirBetween(g.alice, g.mainPath[last - 1]));
  assert.ok(L.move(g, dirBetween(g.alice, g.exit)).some((ev) => ev.type === 'won'));
  assert.equal(g.status, 'won');
});

test('the Tulgey Wood: over the last thorns the Jabberwock bursts out behind Alice, once, a little slower than she walks', () => {
  const g = woodGame(13), j = g.jabberwock, [first, last] = g.blocks.filter((b) => b.kind === 'thorns').sort((a, b) => indexOn(g, a) - indexOn(g, b));
  const ti = indexOn(g, last);
  assert.deepEqual({ x: j.x, y: j.y }, g.mainPath[ti - L.WOOD.jabberwock.behind], 'it waits in the trees behind the last thorns');
  assert.ok(L.WOOD.jabberwock.stepMs > L.WALK.stepMs, 'slower than Alice walks');
  assert.equal(g.cfg.tickMs, L.WOOD.jabberwock.stepMs, 'one step a beat');
  g.alice = { ...g.mainPath[indexOn(g, first) - 1] };
  assert.ok(!L.move(g, dirBetween(g.alice, first)).some((ev) => ev.type === 'jabberwock'), 'not the first thorns');
  assert.equal(j.out, false);
  L.tick(g);
  assert.deepEqual({ x: j.x, y: j.y }, g.mainPath[ti - L.WOOD.jabberwock.behind], 'it stays hidden till then');
  g.alice = { ...g.mainPath[ti - 1] };
  assert.ok(L.move(g, dirBetween(g.alice, last)).some((ev) => ev.type === 'jabberwock'));
  assert.equal(j.out, true);
  L.tick(g);
  assert.deepEqual({ x: j.x, y: j.y }, g.mainPath[ti - L.WOOD.jabberwock.behind + 1], 'one step along the way to her');
  let events = [];
  for (let k = 0; k < 10 && !events.length; k++) events = L.tick(g);   // she stands still: it catches up
  assert.equal(events[0].type, 'jabberwockCaught');
  assert.deepEqual(g.alice, g.mainPath[ti - L.WOOD.jabberwock.back], 'she tumbles back along the way');
  assert.equal(j.gone, true);
  const at = { x: j.x, y: j.y };
  for (let k = 0; k < 5; k++) assert.deepEqual(L.tick(g), [], 'it never comes back');
  assert.deepEqual({ x: j.x, y: j.y }, at);
  g.alice = { ...g.mainPath[ti - 1] };
  assert.ok(!L.move(g, dirBetween(g.alice, last)).some((ev) => ev.type === 'jabberwock'), 'only once');
});

test('the Tulgey Wood: walking into the Jabberwock gets Alice caught, straying too; finding the Cat first sends it off', () => {
  const g = woodGame(17), j = g.jabberwock, last = g.mainPath.length - 1;
  j.out = true;
  g.alice = { ...g.mainPath[last - 6] };
  Object.assign(j, g.mainPath[last - 5]);
  assert.equal(L.move(g, dirBetween(g.alice, j))[0].type, 'jabberwockCaught');
  assert.deepEqual(g.alice, g.mainPath[last - 6 - L.WOOD.jabberwock.back]);
  const onWay = new Set(g.mainPath.map((p) => key(g, p.x, p.y)));   // strayed into a dead end: back from where she left the way
  const off = g.props[0], way = L.pathTo(g, L.bfs(g, off.x, off.y), g.creatures[0].x, g.creatures[0].y);
  const left = way.find((p) => onWay.has(key(g, p.x, p.y))), stray = way[way.indexOf(left) - 1];
  const h = woodGame(17);
  h.jabberwock.out = true;
  h.alice = { ...stray };
  Object.assign(h.jabberwock, left);
  assert.equal(L.tick(h)[0].type, 'jabberwockCaught');
  assert.deepEqual(h.alice, h.mainPath[indexOn(h, left) - L.WOOD.jabberwock.back]);
  const f = woodGame(19), end = f.mainPath.length - 1;
  f.jabberwock.out = true;
  f.alice = { ...f.mainPath[end - 2] };
  Object.assign(f.jabberwock, f.mainPath[end - 8]);
  const events = L.move(f, dirBetween(f.alice, f.creatures[0]));
  assert.equal(f.catFound, true);
  assert.ok(events.some((ev) => ev.type === 'jabberwockGone'));
  assert.equal(f.jabberwock.gone, true);
});

test('the Tulgey Wood: the fireflies show the next few tiles of the way, never past the hidden path until it opens', () => {
  const g = woodGame(23), si = indexOn(g, g.secret);
  assert.deepEqual(L.fireflyTrail(g), g.mainPath.slice(1, 1 + L.WOOD.trail));
  g.alice = { ...g.mainPath[si - 3] };
  assert.deepEqual(L.fireflyTrail(g), g.mainPath.slice(si - 2, si), 'up to the hidden path, not into it');
  g.alice = { ...g.mainPath[si - 1] };
  assert.deepEqual(L.fireflyTrail(g), [], 'there: the grin takes over');
  g.secret.open = true;
  g.grid[key(g, g.secret.x, g.secret.y)] = 0;
  assert.deepEqual(L.fireflyTrail(g), g.mainPath.slice(si, si + L.WOOD.trail), 'then on to the Cat');
});

test('200 Tulgey Wood mazes per difficulty: always winnable along the way, and the same seed gives the same wood', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = walkWood(woodGame(seed, difficulty), 2);
      assert.equal(g.status, 'won', `${difficulty} seed ${seed}`);
      assert.ok(g.ghosts.every((gh) => gh.found));
      assert.ok(g.sizers.every((z) => z.taken), 'every DRINK ME and EAT ME used on the way');
      assert.ok(g.jabberwock.out && g.jabberwock.gone, 'the Jabberwock chased her, and gave up when she found the Cat');
    }
  }
  assert.deepEqual(woodGame(42).fakes, woodGame(42).fakes);
});

// ---------- The Story's chapters ----------
test('the Story’s chapters: in order, each with a name and picture, played by its story step', () => {
  assert.deepEqual(L.CHAPTERS.map((c) => c.id), ['bunny', 'tea', 'wood', 'board']);
  assert.deepEqual(L.CHAPTERS.map((c) => c.name), ['Follow the White Rabbit', 'The Tea Party', 'The Tulgey Wood', 'The Looking-Glass']);
  for (const c of L.CHAPTERS) assert.ok(c.icon);
  assert.ok(L.createGame({ seed: 1, story: true }).tea);
  assert.ok(L.createGame({ seed: 1, wood: true }).wood);
  assert.ok(L.createGame({ seed: 1, board: true }).board);
});

test('the Story’s chapters reached: Chapter 1 always, each once, in story order; a bad save opens only Chapter 1', () => {
  assert.deepEqual(L.chaptersReached([]), ['bunny']);
  assert.deepEqual(L.chaptersReached(['bunny'], 'tea'), ['bunny', 'tea']);
  assert.deepEqual(L.chaptersReached(['wood', 'bunny'], 'wood'), ['bunny', 'wood'], 'entering one already reached adds nothing');
  assert.deepEqual(L.chaptersReached(['wood', 'tea', 'tea']), ['bunny', 'tea', 'wood']);
  for (const bad of [null, undefined, 'tea', 42, {}, ['dragon', 7]]) assert.deepEqual(L.chaptersReached(bad), ['bunny']);
  assert.deepEqual(L.chaptersReached(null, 'nowhere'), ['bunny']);
});

// ---------- The Looking-Glass ----------
const boardGame = (seed, difficulty = 'easy') => L.createGame({ seed, difficulty, board: true });
const N8 = L.BOARD.n;

// Alice stands at the middle of square `sq`.
function standOn(g, sq) {
  g.alice = { ...L.squareMid(sq) };
  g.board.square = sq;
}

// Walks Alice one square on, `dir`: steps until she's crossed into the next square.
function walkSquare(g, dir) {
  const from = L.squareAt(g.alice.x, g.alice.y);
  let events = [];
  for (let k = 0; k < L.BOARD.square && L.squareAt(g.alice.x, g.alice.y) === from && g.status === 'playing'; k++) events = L.move(g, dir);
  return events;
}

// Walks Alice to (x, y) in the guards' two rows, round the guards and the crown, then a step `dir` on.
function walkTo(g, x, y, dir) {
  const guards = new Set(g.guards.map((gd) => key(g, gd.x, gd.y)));
  const way = L.pathTo(g, L.bfs(g, g.alice.x, g.alice.y, (tx, ty) => ty > 2 * L.BOARD.square || guards.has(key(g, tx, ty)) || L.squareAt(tx, ty) === g.board.crown), x, y);
  for (let k = 1; k < way.length; k++) L.move(g, dirBetween(g.alice, way[k]));
  assert.deepEqual(g.alice, { x, y });
  return L.move(g, dir);
}

test('the Looking-Glass: an open 8×8 board of 3-step squares; Alice on the near row, the crown on the far row behind three guards, two flags', () => {
  for (const difficulty of DIFFS) {
    const g = boardGame(3, difficulty), size = N8 * L.BOARD.square + 2, crown = L.BOARD.crown;
    assert.deepEqual([g.width, g.height], [size, size]);
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) assert.ok(L.isOpen(g, x, y), 'open all over, no hedges inside');
    assert.ok(!L.isOpen(g, 0, 5) && !L.isOpen(g, size - 1, 5), 'a low hedge round it');
    assert.equal(L.squareAt(g.alice.x, g.alice.y), (N8 - 1) * N8 + crown, 'Alice starts on the near row, below the crown');
    assert.equal(g.board.crown, crown);
    assert.deepEqual(g.guards.map((gd) => gd.sq), [crown - 1, crown + 1, N8 + crown], 'left of, right of and in front of the crown');
    assert.deepEqual(g.guards.map((gd) => L.squareMid(gd.sq)), g.guards.map(({ x, y }) => ({ x, y })));
    assert.deepEqual(g.board.flags.map((sq) => Math.floor(sq / N8)), L.BOARD.flags);
    assert.equal(g.fog, false);
    assert.equal(g.hearts, null);
    assert.equal(g.cfg.tickMs, L.BOARD.tickMs);
    assert.deepEqual(g.pieces.map((p) => p.kind), L.BOARD.pieces[difficulty]);
    const all = g.pieces.flatMap((p) => p.patrol);
    assert.equal(new Set(all).size, all.length, 'no two patrols share a square');
    for (const p of g.pieces) {
      assert.deepEqual({ x: p.x, y: p.y }, L.squareMid(p.patrol[0]));
      for (const sq of p.patrol) {
        assert.ok(Math.floor(sq / N8) >= L.BOARD.open[0] && Math.floor(sq / N8) <= L.BOARD.open[1], 'in the middle rows');
        assert.ok(!g.board.safe.includes(sq));
      }
      for (let k = 1; k < 3; k++) {
        const dc = Math.abs((p.patrol[k] % N8) - (p.patrol[k - 1] % N8)), dr = Math.abs(Math.floor(p.patrol[k] / N8) - Math.floor(p.patrol[k - 1] / N8));
        assert.deepEqual(p.kind === 'knight' ? [Math.min(dc, dr), Math.max(dc, dr)] : [dc, dr], p.kind === 'knight' ? [1, 2] : [1, 0]);
      }
    }
  }
  assert.deepEqual(boardGame(42, 'hard').pieces, boardGame(42, 'hard').pieces, 'the same seed, the same board');
});

test('the Looking-Glass: a knight takes its L-shaped jumps, a rook 3 squares each way (stopped by a piece); safe squares never', () => {
  const g = boardGame(5);
  g.pieces = [{ kind: 'knight', patrol: [36, 36, 36], phase: 0 }, { kind: 'rook', patrol: [33, 33, 33], phase: 0 }];
  assert.deepEqual([...L.boardThreats(g)].sort((a, b) => a - b),
    [17, 19, 21, 25, 26, 30, 32, 33, 34, 35, 36, 41, 42, 46, 49, 51, 53, 57], 'the rook stops short of the knight; its row 1 square is safe');
  g.pieces = [{ kind: 'knight', patrol: [52, 52, 52], phase: 0 }];   // its jumps would land on the start and a flag
  const threats = L.boardThreats(g);
  for (const sq of g.board.safe) assert.ok(!threats.has(sq));
});

test('the Looking-Glass: the pieces move only when Alice steps into a new square; a square they could take sends her back to the flag', () => {
  const g = boardGame(5), [flagNear, flagFar] = g.board.flags;
  g.pieces = [{ id: 0, kind: 'rook', patrol: [40, 41, 42], phase: 0, ...L.squareMid(40) }];
  L.move(g, 'down');
  assert.deepEqual(L.move(g, 'down'), [{ type: 'wall' }], 'the low hedge round the board');
  L.move(g, 'up');
  assert.ok(!L.move(g, 'left').some((ev) => ev.type === 'pieceMoved'), 'inside her square: nothing moves');
  assert.equal(g.pieces[0].phase, 0);
  assert.ok(walkSquare(g, 'left').some((ev) => ev.type === 'pieceMoved'), 'a new square: every piece moves');
  assert.deepEqual({ x: g.pieces[0].x, y: g.pieces[0].y }, L.squareMid(41));
  const check = walkSquare(g, 'left').find((ev) => ev.type === 'check');   // into 57, under the rook at 41
  assert.match(check.text, /Check!/);
  assert.deepEqual(g.alice, L.squareMid(g.board.start), 'back to the start (no flag yet)');
  assert.equal(g.pieces[0].phase, 0, 'and the pieces back to their places');
  standOn(g, flagNear + N8);
  assert.ok(walkSquare(g, 'up').some((ev) => ev.type === 'flag'));
  assert.deepEqual(g.board.lastFlag, L.squareMid(flagNear));
  standOn(g, flagFar + N8);
  walkSquare(g, 'up');
  standOn(g, flagNear + 1);
  walkSquare(g, 'left');
  assert.deepEqual(g.board.lastFlag, L.squareMid(flagFar), 'the furthest flag passed');
  g.pieces = [{ id: 0, kind: 'rook', patrol: [27, 28, 29], phase: 0, ...L.squareMid(27) }];
  standOn(g, 25);
  walkSquare(g, 'right');   // into 26, beside the rook
  assert.deepEqual(g.alice, L.squareMid(flagFar));
});

test('the Looking-Glass: a lullaby sends a guard to sleep (3, then 4, then 5 notes); the crown’s pikes open only while all three sleep', () => {
  const g = boardGame(7), [left, right, front] = g.guards;
  standOn(g, g.board.crown + N8 + 1);
  assert.equal(walkTo(g, front.x, front.y + 1, 'up')[0].type, 'lullaby');
  assert.equal(L.move(g, 'down').length, 0, 'no walking off mid-song');
  L.lull(g, false);
  assert.equal(g.asking, null, 'given up: he stays awake');
  assert.equal(front.sleep, 0);
  let ev = L.move(g, 'up')[0];
  assert.deepEqual([ev.type, ev.notes], ['lullaby', 3]);
  assert.equal(L.lull(g, true)[0].type, 'guardAsleep');
  assert.equal(front.sleep, L.BOARD.sleep);
  assert.equal(L.move(g, 'up')[0].type, 'guardSnores');
  assert.deepEqual(L.lull(g, true), [], 'only while asked');
  ev = walkTo(g, left.x, left.y + 1, 'up')[0];
  assert.deepEqual([ev.type, ev.notes], ['lullaby', 4]);
  L.lull(g, true);
  assert.equal(walkTo(g, left.x + 1, left.y, 'right')[0].type, 'pikes', 'the crown, behind crossed pikes');
  ev = walkTo(g, right.x, right.y + 1, 'up')[0];
  assert.deepEqual([ev.type, ev.notes], ['lullaby', 5]);
  assert.ok(L.lull(g, true).some((e) => e.type === 'pikesOpen'));
  for (let k = 1; k < L.BOARD.sleep; k++) assert.deepEqual(L.tick(g), []);
  const woke = L.tick(g);
  assert.deepEqual(woke.map((e) => e.type), ['guardWakes', 'guardWakes', 'guardWakes'], `${L.BOARD.sleep} beats, then each wakes`);
  assert.match(woke[0].text, /pikes cross again/);
  assert.ok(g.guards.every((gd) => gd.sleep === 0));
  for (const gd of g.guards) gd.sleep = 5;
  const events = walkTo(g, left.x + 1, left.y, 'right');
  assert.deepEqual(events.map((e) => e.type).slice(-2), ['crowned', 'won']);
  assert.equal(g.status, 'won');
  assert.equal(g.board.crowned, true);
});

// The chessboard played through: the squares from the start to the guards' rows (a search over her square and the
// pieces' phases, never into a square they could take), walked step by step; then every guard sung to sleep, and the crown.
function playBoard(g) {
  const kinds = g.pieces.map((p) => p.kind), patrols = g.pieces.map((p) => p.patrol);
  const threats = (phases) => L.boardThreats({ board: g.board, pieces: kinds.map((kind, i) => ({ kind, patrol: patrols[i], phase: phases[i] })) });
  const next = (phases) => phases.map((p) => (p + 1) % L.PATROL.length);
  const startKey = `${g.board.start}|${g.pieces.map((p) => p.phase)}`, prev = new Map([[startKey, null]]), queue = [[g.board.start, g.pieces.map((p) => p.phase)]];
  let end = null;
  for (let q = 0; q < queue.length && !end; q++) {
    const [a, phases] = queue[q], danger = threats(phases);
    for (const [b, dir] of [[a - N8, 'up'], [a + N8, 'down'], [a % N8 ? a - 1 : -1, 'left'], [a % N8 < N8 - 1 ? a + 1 : -1, 'right']]) {
      if (b < 0 || b >= N8 * N8 || b === g.board.crown || danger.has(b)) continue;
      const ps = next(phases), k = `${b}|${ps}`;
      if (prev.has(k)) continue;
      prev.set(k, [`${a}|${phases}`, dir]);
      queue.push([b, ps]);
      if (Math.floor(b / N8) <= 1) { end = k; break; }
    }
  }
  assert.ok(end, 'a way through');
  const dirs = [];
  for (let k = end; prev.get(k); k = prev.get(k)[0]) dirs.unshift(prev.get(k)[1]);
  for (const dir of dirs) assert.ok(!walkSquare(g, dir).some((ev) => ev.type === 'check'), 'never taken');
  for (const gd of g.guards) {
    const from = [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left']].find(([dx, dy]) => L.isOpen(g, gd.x + dx, gd.y + dy) && L.squareAt(gd.x + dx, gd.y + dy) !== g.board.crown);
    assert.equal(walkTo(g, gd.x + from[0], gd.y + from[1], from[2])[0].type, 'lullaby');
    L.lull(g, true);
  }
  const left = g.guards[0];
  return walkTo(g, left.x + 1, left.y, 'right');
}

test('200 Looking-Glass boards per difficulty: always a way through, from the start and from each flag; 30 played through to the crown', () => {
  for (const difficulty of DIFFS) {
    for (const seed of SEEDS) {
      const g = boardGame(seed, difficulty);
      assert.equal(g.pieces.length, L.BOARD.pieces[difficulty].length, `${difficulty} seed ${seed}`);
      assert.ok(L.boardWinnable(g.board, g.pieces.map((p) => p.kind), g.pieces.map((p) => p.patrol)));
    }
    for (const seed of SEEDS.slice(0, 30)) {
      const g = boardGame(seed, difficulty);
      assert.ok(playBoard(g).some((ev) => ev.type === 'crowned'), `${difficulty} seed ${seed}`);
      assert.equal(g.status, 'won');
    }
  }
  const g = boardGame(1);   // a board no one could get through is turned down
  assert.equal(L.boardWinnable(g.board, ['rook', 'rook'], [[48, 49, 50], [53, 54, 55]]), false);
});
