# PolyTank: Sector 7

PolyTank is a browser-based top-down tactical tank game built with vanilla HTML, CSS, and JavaScript. It combines a scripted campaign, hub outposts, upgrade workshops, enemy dossiers, procedural audio, modular enemies, and an endless anomaly mode.

## Run Locally

`levels.json` is loaded at runtime, so the game must be served over HTTP. Opening `index.html` directly with `file://` will not load the campaign data.

From the project root:

```powershell
python -m http.server 8000
```

Then open http://localhost:8000 in a browser.

No build step or package installation is required. A current desktop or mobile browser with Canvas, Web Audio, Pointer Events, and `localStorage` support is recommended.

## Controls

### Desktop

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Aim | Mouse |
| Fire | Left mouse button or `Space` |
| Abilities | `Q` and `R` |
| Interact | `E` |
| Deploy from a hub | `Enter` |
| Pause | `Esc` |
| EMP ability | Right mouse button |

### Touch

On a phone or tablet, use the left virtual stick to move. Hold `FIRE` to shoot, and use the `Q`, `R`, and `E` buttons for abilities and interactions. Touch controls can be disabled from **Settings**.

## Gameplay

The campaign alternates between combat sectors and outpost hubs.

- Destroy enemies, collect experience, and level up.
- Harvest square, triangle, and pentagon formations as upgrade materials.
- Visit hub NPCs to repair the hull, improve chassis stats, equip abilities, inspect enemy intelligence, and deploy to the next sector.
- Use firing ranges in hubs to test weapon damage and reload speed.
- Defeat bosses and continue into the procedural Sector Infinity anomaly waves.

The game automatically stores a checkpoint when a new sector begins. The menu's **Continue Checkpoint** button restores player stats, upgrades, resources, discoveries, and campaign position.

## Settings

Settings are stored locally in the browser and include:

- Master, music, and SFX volume
- Screen shake toggle
- Touch controls toggle
- Checkpoint reset

Audio is generated procedurally with the Web Audio API; there are no external sound files.

## Project Structure

```text
index.html                 Main game, UI, rendering, input, and progression logic
levels.json                Campaign, hub, cutscene, event, and spawn definitions
scripts/editor.js          Visual level editor and testbed
scripts/enemy_editor.js    Enemy laboratory and export tools
scripts/enemies/api.js     Enemy registry, factory, lifecycle, and API helpers
scripts/enemies/*.js       Built-in enemy and boss definitions
scripts/enemies/prism_warden.js  Act 1 orbiting telegraph enemy
```

## Adding an Enemy

Enemy files register definitions through `EnemyAPI`:

```js
EnemyAPI.register({
    id: 'ghost',
    name: 'Ghost Unit',
    color: '#aaaaff',
    radius: 20,
    hp: 80,
    xpReward: 40,
    scoreValue: 30,
    bodyShape: 'circle',
    onUpdate(self, player, api) {
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;
        self.vx += Math.cos(aim) * 0.2;
        self.vy += Math.sin(aim) * 0.2;
        if (self.reload <= 0) {
            api.shoot(self, aim, { speed: 7, damage: 12, size: 9, life: 100 });
            self.reload = 90;
        }
    }
});
```

Load the file after `scripts/enemies/api.js` and before the main inline game script in `index.html`. Add its ID to a level's `types` array or `initialSpawns` definition in `levels.json`.

Enemy lifecycle hooks are `onSpawn`, `onUpdate`, `onDraw`, and `onDie`. The API provides shooting, child spawning, particles, floating text, and read-only game state access. See `scripts/enemies/api.js` for the complete schema.

## Editing Levels

The level editor is loaded from `scripts/editor.js`. It supports level properties, waves, timelines, story content, and arena testing. The enemy editor in `scripts/enemy_editor.js` provides a sandbox for chassis values, update/draw behavior blocks, simulation, and export.

The canonical campaign source is `levels.json`. After exporting editor data, review the generated JSON before adding it to the campaign.

## Troubleshooting

- **Campaign data failed to load:** start the local HTTP server from the project root and verify that `http://localhost:8000/levels.json` opens.
- **No audio:** click the page once; browsers suspend audio until a user gesture. Check Settings and the browser tab's audio permissions.
- **Touch controls are missing:** use a touch-capable browser or enable the setting on a narrow viewport. Pointer Events must be available.
- **Progress is missing:** checkpoints use browser `localStorage`; clearing site data or private browsing can remove them.

## License

No license file is currently included in this repository.
