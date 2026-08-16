# PolyTank Enemy API

Modular enemy system for PolyTank: Sector 7.
Each enemy type lives in its own file. The main game never needs to be touched to add new ones.

---

## File Structure

```
polytank.html               ← Main game (load enemy scripts in <head>)
enemies/
  _api.js                   ← Registry & factory core (load FIRST)
  basic.js                  ← Patrol Unit
  rammer.js                 ← Rammer (charge + dash)
  sniper.js                 ← Sniper Unit
  shotgun.js                ← Shotgun Unit
  trapper.js                ← Trapper (mine dropper)
  boss_hexagon.js           ← Act 1 Boss
  boss_final.js             ← Act 3 Final Boss (The Destroyer)
  shield_carrier.js         ← Example: Year 2 modded enemy
polytank_integration_patch.js  ← Step-by-step wiring guide
README.md                   ← This file
```

---

## Quick Start — Adding a New Enemy

### 1. Create the file

```js
// enemies/ghost.js

EnemyAPI.register({
    id:         'ghost',
    name:       'Ghost Unit',
    color:      '#aaaaff',
    radius:     20,
    hp:         80,
    xpReward:   40,
    scoreValue: 30,
    bodyShape:  'circle',   // 'circle' | 'triangle' | 'square' | 'hexagon'

    onUpdate(self, player, api) {
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;
        self.vx += Math.cos(aim) * 0.2;
        self.vy += Math.sin(aim) * 0.2;

        if (self.reload <= 0) {
            api.shoot(self, aim, { speed: 7, damage: 12, size: 9, life: 100 });
            self.reload = 90;
        }
    },
});
```

### 2. Load it in polytank.html

```html
<!-- in <head>, AFTER _api.js, BEFORE the main game script -->
<script src="enemies/ghost.js"></script>
```

### 3. Use it in a level

```js
{
    name: "Ghost Field", type: "kill", count: 6,
    spawnRate: 180,
    types: ['ghost'],    // ← that's it
    mapSize: 1800, act: 2,
}
```

---

## EnemyDefinition Schema

All fields are optional except `id`. Omitted fields fall back to sensible defaults.

| Field          | Type       | Default          | Description |
|----------------|------------|------------------|-------------|
| `id`           | `string`   | **required**     | Unique type identifier. Must match what you put in `types[]`. |
| `name`         | `string`   | `'Unknown Unit'` | Display name (used in logs, future UI). |
| `color`        | `string`   | `'#888888'`      | Hex color for body + bullet tint. |
| `radius`       | `number`   | `22`             | Collision and render radius in px. |
| `hp`           | `number`   | `100`            | Starting (and max) HP. |
| `xpReward`     | `number`   | `30`             | XP given to player on death. |
| `scoreValue`   | `number`   | `20`             | Score added on death. |
| `bodyShape`    | `string`   | `'circle'`       | Auto-drawn body: `'circle'`, `'triangle'`, `'square'`, `'hexagon'`. |
| `isBoss`       | `boolean`  | `false`          | Triggers boss death effect and suppresses normal kill objective. |
| `onSpawn`      | `function` | no-op            | Called once when spawned. Use to init `self.state`. |
| `onUpdate`     | `function` | default AI       | Called every frame. AI, movement, shooting go here. |
| `onDraw`       | `function` | `undefined`      | If defined, fully replaces auto body rendering. |
| `onDie`        | `function` | explosion burst  | Called on death. Emit particles, spawn children, etc. |

---

## Lifecycle Callbacks

### `onSpawn(self, gameCtx)`

Called once immediately after the enemy is created. Use it to initialize `self.state`.

```js
onSpawn(self) {
    self.state.phase        = 'idle';
    self.state.phaseTimer   = 120;
    self.state.targetAngle  = 0;
},
```

---

### `onUpdate(self, player, api)`

Called every frame. This is where all AI logic goes.

**Parameters:**
- `self` — the live instance. Mutate freely.
  - `self.x`, `self.y` — position (modified by physics after onUpdate)
  - `self.vx`, `self.vy` — velocity (friction + boundary applied after)
  - `self.angle` — facing angle in radians
  - `self.reload` — counts down each frame; auto-decremented before onUpdate
  - `self.hp`, `self.maxHp` — health
  - `self.state` — your private key/value bag
- `player` — read-only snapshot: `{ x, y, hp, dead }`
- `api` — helper methods (see API Helpers below)

```js
onUpdate(self, player, api) {
    const aim = Math.atan2(player.y - self.y, player.x - self.x);
    self.angle = aim;
    self.vx += Math.cos(aim) * 0.15;
    self.vy += Math.sin(aim) * 0.15;

    if (self.reload <= 0) {
        api.shoot(self, aim);
        self.reload = 100;
    }
},
```

---

### `onDraw(self, ctx)`

Define this to take full control of rendering. If omitted, the API auto-draws
a body based on `bodyShape` plus a standard cannon barrel.

```js
onDraw(self, ctx) {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.rotate(self.angle);

    // draw whatever you want...

    ctx.restore();
},
```

---

### `onDie(self, api)`

Called once on death, after XP and score are awarded. Emit particles, spawn children, play effects.

```js
onDie(self, api) {
    api.particles(self.x, self.y, self.color, 20, 'explosion');
    api.spawnEnemy('basic', self.x + 50, self.y);
},
```

---

## API Helpers

The `api` object is passed to `onUpdate` and `onDie`.

### `api.shoot(from, angle, opts?)`

Fire a bullet from this enemy.

```js
api.shoot(self, aim, {
    speed:  8,        // bullet velocity
    damage: 15,       // damage dealt to player
    size:   10,       // bullet radius
    life:   120,      // frames before bullet expires
    color:  '#ff0000' // defaults to enemy color
});
```

### `api.spawnEnemy(type, x, y)`

Spawn a child enemy and add it to the active enemies array.

```js
// Boss spawns 3 rammers in a ring
for (let i = 0; i < 3; i++) {
    const a = (Math.PI * 2 / 3) * i;
    api.spawnEnemy('rammer', self.x + Math.cos(a) * 80, self.y + Math.sin(a) * 80);
}
```

### `api.particles(x, y, color, count, type?, params?)`

Emit particles at a world position.

Types: `'spark'`, `'explosion'`, `'debris'`, `'smoke'`

```js
api.particles(self.x, self.y, '#ff8800', 15, 'explosion');
```

### `api.text(x, y, string, color?)`

Spawn floating text at a world position.

```js
api.text(self.x, self.y - 60, 'PHASE 2', '#ff3300');
```

### `api.state`

Read-only reference to the global game state. Check `api.state.frame` for timing, `api.state.mapSize` for boundary, etc.

---

## EnemyAPI Registry Methods

These are available globally once `_api.js` is loaded.

```js
EnemyAPI.register(definition)   // Register a new type
EnemyAPI.spawn(type, x, y, gameCtx)  // Instantiate (called by spawnEnemy())
EnemyAPI.list()                 // → ['basic', 'rammer', 'sniper', ...]
EnemyAPI.get('sniper')          // → definition object (read-only)
```

---

## Using `self.state`

Every enemy instance has a `self.state` object — a plain key/value bag that persists across frames. This is where you store phase data, timers, cooldowns, and anything else your enemy needs to remember.

```js
onSpawn(self) {
    self.state.phase      = 'patrol';
    self.state.waypoint   = { x: 200, y: -400 };
    self.state.patience   = 300;
},

onUpdate(self, player, api) {
    if (self.state.phase === 'patrol') {
        // move toward waypoint...
        self.state.patience--;
        if (self.state.patience <= 0) self.state.phase = 'hunt';
    }
    if (self.state.phase === 'hunt') {
        // chase player...
    }
},
```

---

## Boss Enemies

Set `isBoss: true` to:
- Trigger the boss death cinematic (screen shake + slow explosion sequence)
- Award `xpReward` via the boss XP path (not standard kill)
- Suppress the normal `checkObj('kill')` call — boss levels use `bossDeathEffect` instead

```js
EnemyAPI.register({
    id:      'my_boss',
    isBoss:  true,
    hp:      2000,
    xpReward: 800,
    // ...
});
```

---

## Removing or Updating an Enemy

- **Remove**: delete (or don't load) the file. Remove it from `types[]` in any level that uses it.
- **Update**: edit the file. The change takes effect on next page load — no game restart needed during development if you use live-reload.
- **Override a built-in**: call `EnemyAPI.register({ id: 'basic', ... })` again in a later script. The last registration wins (a warning is logged).

---

## Tips

- Keep each file focused on one enemy. If two enemies share a behaviour pattern, extract a helper function at the top of each file rather than creating a shared module — keeps files independently loadable.
- `self.state` is reset on each spawn. Don't store enemy state in the definition object — it's shared across all instances of that type.
- Bullet `life` controls range. A bullet moving at speed 5 with life 120 travels 600 world-units before expiring.
- For multi-phase bosses, use `self.state.phase` and trigger transitions inside `onUpdate` based on `self.hp / self.maxHp`.
