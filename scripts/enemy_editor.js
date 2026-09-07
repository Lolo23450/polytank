/**
 * Sector 7 Tactical Unit Laboratory & EnemyAPI Studio (Native Graphics & Spawner Fixed)
 * 
 * - Full Native API Visual Fidelity: Preserves intricate custom onDraw renderers (Hive silos, Bosses, Carriers)
 * - Persistent Spawner Pipeline: Spawned drones & minions properly register, update, and draw in sandbox
 * - Full onSpawn / Init Function Support: View, edit, and export unit spawn initializers
 * - Infallible Export & Copy: Modern Clipboard API + execCommand + interactive code modal fallback
 * - Multi-Weapon Concurrency: Independent cooldown channels per combat block (_cd_N)
 * - Configurable Bullet Speed across EVERY combat block
 * - Moving Target Drone: Default 0.5 velocity with holographic reconstitution
 */
const EnemyEditor = (() => {
    let overlay = null;
    let canvas = null;
    let ctx = null;
    let activeEnemyId = 'basic';
    let currentTab = 'blocks-update'; // 'chassis', 'blocks-update', 'blocks-draw', 'target', 'code'

    // Pristine factory definitions cache (captures initial script definitions before any edits)
    const originalDefCache = new Map();
    const coreIds = ['basic', 'rammer', 'sniper', 'shotgun', 'trapper', 'hive', 'swarm_drone', 'hexagon', 'final', 'shield_carrier', 'prism_warden'];

    // Viewport camera & interaction
    let zoom = 1.0;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Simulation runtime state & clock sync
    let simTimer = 0;
    let simInstance = null;
    let simSpeed = 1.0;
    let simPaused = false;
    let lastSimTime = 0;
    let simAccumulator = 0;
    const SIM_TICK_MS = 1000 / 60; // Exact 60 FPS game tick

    let simBullets = [];
    let simParticles = [];
    let simTexts = [];
    let isDraggingTarget = false;
    let isDraggingEnemy = false;
    let dragBlockType = null;
    let dragBlockIndex = -1;

    const sandboxKeys = {};

    // ── CONFIGURABLE MOVING TARGET DRONE RUNTIME STATE ──
    const simPlayer = {
        x: 320,
        y: 0,
        baseX: 320,
        baseY: 0,
        vx: 0,
        vy: 0,
        r: 22,
        hp: 120,
        maxHp: 120,
        dead: false,
        respawnTimer: 0,
        maxRespawnDelay: 90,
        reconstituteProgress: 0,
        reload: 0,
        fireRate: 28,
        bulletDmg: 15,
        bulletSpd: 8.5,
        bulletSize: 6,
        color: '#00d2d3',
        fireBack: true,
        weaponType: 'cannon',
        invulnerable: false,
        moveMode: 'figure8',
        moveSpeed: 0.5,
        patrolRange: 220,
        patrolDir: 1,
        orbitAngle: 0,
        headingAngle: 0
    };

    // ── ACTIVE LIVE TUNING PROFILE ──
    const liveTuning = {
        id: 'basic',
        name: 'Patrol Unit',
        color: '#f14e54',
        radius: 22,
        hp: 115,
        bodyShape: 'circle',
        xpReward: 30,
        scoreValue: 20,
        isBoss: false,

        updateBlocks: [],
        drawBlocks: [],

        useRawCodeOverride: false,
        rawInitCode: '',
        rawUpdateCode: '',
        rawDrawCode: ''
    };

    // ── PERSISTENT SANDBOXED GAME CONTEXT ──
    const sandboxGameCtx = {
        get player() { return simPlayer; },
        enemies: [], // Real persistent array so api.spawnEnemy().push works!
        get bullets() { return simBullets; },
        get state() { return { mapSize: 1100, frame: simTimer, cam: { shake: 0 }, bullets: simBullets }; },
        spawnEnemy(type, x, y) {
            if (typeof EnemyAPI !== 'undefined') {
                const child = EnemyAPI.spawn(type, x, y, sandboxGameCtx);
                if (child) {
                    sandboxGameCtx.enemies.push(child);
                    sandboxGameCtx.spawnParticles(x, y, child.color || '#ff4757', 10, 'spark');
                }
                return child;
            }
            return null;
        },
        spawnParticles(x, y, color, count, type, params = {}) {
            for (let i = 0; i < count; i++) {
                const a = params.angle !== undefined ? params.angle : Math.random() * Math.PI * 2;
                const spd = params.speed || (Math.random() * 3.5 + 1.2);
                simParticles.push({
                    x, y,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd,
                    life: params.life || 24,
                    maxLife: params.life || 24,
                    color: color || '#ffffff',
                    type: type || 'spark'
                });
            }
        },
        spawnText(x, y, str, color) {
            simTexts.push({ x, y, str, color: color || '#ffffff', life: 45, maxLife: 45 });
        },
        checkObj() {}
    };

    // ── SCRATCH VISUAL BLOCK PALETTE ──
    const BLOCK_PALETTE = {
        update: [
            // ── SPAWNER BLOCKS ──
            {
                type: 'spawn_minion_drone',
                category: 'spawn',
                name: 'Spawn Reinforcement Unit',
                color: '#E17055',
                desc: 'Spawns an allied combat unit or drone into combat when cooldown elapses.',
                params: {
                    unitType: { label: 'Unit Type ID', type: 'select', options: ['swarm_drone', 'basic', 'rammer', 'sniper'], value: 'swarm_drone' },
                    offsetDist: { label: 'Offset Distance', type: 'number', min: 10, max: 200, value: 45 },
                    reloadFrames: { label: 'Cooldown (Frames)', type: 'number', min: 30, max: 600, value: 180 },
                    maxAlive: { label: 'Max Active Cap', type: 'number', min: 1, max: 12, value: 4 }
                },
                compile: (p, bId) => `
                    self.state._spawn_minions = self.state._spawn_minions || [];
                    self.state._spawn_minions = self.state._spawn_minions.filter(m => !m.dead);
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : ${p.reloadFrames};
                    if (self.state._cd_${bId} <= 0) {
                        if (self.state._spawn_minions.length < ${p.maxAlive}) {
                            const _a = self.angle + Math.PI + (Math.random() - 0.5);
                            const _mx = self.x + Math.cos(_a) * ${p.offsetDist};
                            const _my = self.y + Math.sin(_a) * ${p.offsetDist};
                            const _spawned = api.spawnEnemy('${p.unitType}', _mx, _my);
                            if (_spawned) self.state._spawn_minions.push(_spawned);
                        }
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'spawn_ring_burst',
                category: 'spawn',
                name: 'Spawn Ring of Swarm Drones',
                color: '#E17055',
                desc: 'Discharges an omnidirectional radial ring of minions around the chassis.',
                params: {
                    count: { label: 'Drone Count', type: 'number', min: 2, max: 8, value: 4 },
                    radius: { label: 'Ring Radius (px)', type: 'number', min: 20, max: 160, value: 65 },
                    reloadFrames: { label: 'Spawn Cadence', type: 'number', min: 60, max: 900, value: 300 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : ${p.reloadFrames};
                    if (self.state._cd_${bId} <= 0) {
                        const _cnt = ${p.count};
                        for (let _i = 0; _i < _cnt; _i++) {
                            const _a = (_i / _cnt) * Math.PI * 2;
                            const _sx = self.x + Math.cos(_a) * ${p.radius};
                            const _sy = self.y + Math.sin(_a) * ${p.radius};
                            api.spawnEnemy('swarm_drone', _sx, _sy);
                        }
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },

            // ── MOTION BLOCKS ──
            {
                type: 'motion_turn_to_player',
                category: 'motion',
                name: 'Steer Heading Toward Target',
                color: '#4C97FF',
                desc: 'Smoothly turns chassis angle toward target using angular interpolation.',
                params: {
                    steerRate: { label: 'Steer Cadence', type: 'slider', min: 0.02, max: 0.5, step: 0.02, value: 0.16 }
                },
                compile: (p) => `
                    const _aim = Math.atan2(player.y - self.y, player.x - self.x);
                    const _diff = Math.atan2(Math.sin(_aim - self.angle), Math.cos(_aim - self.angle));
                    self.angle += _diff * ${p.steerRate};
                `
            },
            {
                type: 'motion_turn_away_from_player',
                category: 'motion',
                name: 'Steer Heading Away (Evade Aim)',
                color: '#4C97FF',
                desc: 'Rotates chassis away from target to face escape vector.',
                params: {
                    steerRate: { label: 'Turn Rate', type: 'slider', min: 0.02, max: 0.5, step: 0.02, value: 0.14 }
                },
                compile: (p) => `
                    const _flee = Math.atan2(self.y - player.y, self.x - player.x);
                    const _diff = Math.atan2(Math.sin(_flee - self.angle), Math.cos(_flee - self.angle));
                    self.angle += _diff * ${p.steerRate};
                `
            },
            {
                type: 'motion_spin_continuous',
                category: 'motion',
                name: 'Spin Chassis Continuous',
                color: '#4C97FF',
                desc: 'Applies constant rotational angular velocity.',
                params: {
                    speed: { label: 'Rotation Speed', type: 'slider', min: -0.2, max: 0.2, step: 0.01, value: 0.05 }
                },
                compile: (p) => `
                    self.angle += ${p.speed};
                `
            },
            {
                type: 'motion_thrust_forward',
                category: 'motion',
                name: 'Thrust Forward Along Heading',
                color: '#4C97FF',
                desc: 'Discharges thruster along heading direction with terminal velocity limiter.',
                params: {
                    force: { label: 'Acceleration', type: 'slider', min: 0.05, max: 2.0, step: 0.05, value: 0.25 },
                    maxSpeed: { label: 'Max Velocity', type: 'number', min: 1, max: 18, value: 4.8 }
                },
                compile: (p) => `
                    self.vx += Math.cos(self.angle) * ${p.force};
                    self.vy += Math.sin(self.angle) * ${p.force};
                    const _spd = Math.hypot(self.vx, self.vy);
                    if (_spd > ${p.maxSpeed}) {
                        self.vx = (self.vx / _spd) * ${p.maxSpeed};
                        self.vy = (self.vy / _spd) * ${p.maxSpeed};
                    }
                `
            },
            {
                type: 'motion_maintain_distance',
                category: 'motion',
                name: 'Tactical Standoff (Kite & Strafe)',
                color: '#4C97FF',
                desc: 'Maintains engagement distance with lateral strafe and reaction force (-1 to 1).',
                params: {
                    targetDist: { label: 'Target Distance', type: 'number', min: 40, max: 700, value: 280 },
                    thrust: { label: 'Reaction Force (-1 to 1)', type: 'slider', min: -1.0, max: 1.0, step: 0.05, value: 0.25 }
                },
                compile: (p) => `
                    const _dx = player.x - self.x;
                    const _dy = player.y - self.y;
                    const _d = Math.hypot(_dx, _dy) || 1;
                    const _a = Math.atan2(_dy, _dx);
                    const _f = ${p.thrust};
                    if (_d > ${p.targetDist} + 35) {
                        self.vx += Math.cos(_a) * _f;
                        self.vy += Math.sin(_a) * _f;
                    } else if (_d < ${p.targetDist} - 35) {
                        self.vx -= Math.cos(_a) * (_f * 1.35);
                        self.vy -= Math.sin(_a) * (_f * 1.35);
                    } else {
                        self.vx += -Math.sin(_a) * (_f * 0.95);
                        self.vy += Math.cos(_a) * (_f * 0.95);
                    }
                `
            },
            {
                type: 'motion_orbit_target',
                category: 'motion',
                name: 'Perimeter Orbiting Sweep',
                color: '#4C97FF',
                desc: 'Circles smoothly around target at fixed radial distance.',
                params: {
                    orbitRadius: { label: 'Orbit Radius', type: 'number', min: 80, max: 600, value: 240 },
                    angularSpeed: { label: 'Angular Speed', type: 'slider', min: 0.01, max: 0.08, step: 0.005, value: 0.025 }
                },
                compile: (p) => `
                    self.state._orbitAng = (self.state._orbitAng || 0) + ${p.angularSpeed};
                    const _tx = player.x + Math.cos(self.state._orbitAng) * ${p.orbitRadius};
                    const _ty = player.y + Math.sin(self.state._orbitAng) * ${p.orbitRadius};
                    self.vx += (_tx - self.x) * 0.05;
                    self.vy += (_ty - self.y) * 0.05;
                `
            },
            {
                type: 'motion_zigzag_strafe',
                category: 'motion',
                name: 'Serpentine Weave Strafe',
                color: '#4C97FF',
                desc: 'Oscillates laterally across engagement path while advancing.',
                params: {
                    frequency: { label: 'Weave Frequency', type: 'slider', min: 0.02, max: 0.2, step: 0.01, value: 0.08 },
                    amplitude: { label: 'Swerve Force', type: 'slider', min: 0.1, max: 1.5, step: 0.05, value: 0.45 }
                },
                compile: (p) => `
                    self.state._weaveTimer = (self.state._weaveTimer || 0) + ${p.frequency};
                    const _side = Math.sin(self.state._weaveTimer) * ${p.amplitude};
                    self.vx += -Math.sin(self.angle) * _side;
                    self.vy += Math.cos(self.angle) * _side;
                `
            },
            {
                type: 'motion_rammer_charge',
                category: 'motion',
                name: 'Kinetic Rammer Dash Burst',
                color: '#4C97FF',
                desc: 'Charges kinetic capacitor and dashes at high speed when closing in.',
                params: {
                    triggerDist: { label: 'Trigger Distance', type: 'number', min: 80, max: 500, value: 260 },
                    burstSpeed: { label: 'Dash Velocity', type: 'slider', min: 4.0, max: 20.0, step: 0.5, value: 11.0 }
                },
                compile: (p) => `
                    self.state.dashTimer = self.state.dashTimer || 0;
                    const _d = Math.hypot(player.x - self.x, player.y - self.y);
                    if (self.state.dashTimer <= 0) {
                        const _a = Math.atan2(player.y - self.y, player.x - self.x);
                        self.angle = _a;
                        self.vx += Math.cos(_a) * 0.16;
                        self.vy += Math.sin(_a) * 0.16;
                        if (_d < ${p.triggerDist}) {
                            self.state.dashTimer = 90;
                        }
                    } else {
                        self.state.dashTimer--;
                        if (self.state.dashTimer === 50) {
                            self.vx = Math.cos(self.angle) * ${p.burstSpeed};
                            self.vy = Math.sin(self.angle) * ${p.burstSpeed};
                        }
                    }
                `
            },
            {
                type: 'motion_repel_bullets',
                category: 'motion',
                name: 'Kinetic Bullet Repulsor Field',
                color: '#4C97FF',
                desc: 'Deflects incoming player bullets away from the chassis within radius.',
                params: {
                    radius: { label: 'Repulsor Field (px)', type: 'number', min: 50, max: 300, value: 140 },
                    force: { label: 'Deflection Force', type: 'slider', min: 0.2, max: 3.0, step: 0.2, value: 1.2 }
                },
                compile: (p) => `
                    if (api.state && api.state.bullets) {
                        const _rSq = ${p.radius} * ${p.radius};
                        api.state.bullets.forEach(_b => {
                            if (_b.pShot && !_b.dead) {
                                const _dx = _b.x - self.x;
                                const _dy = _b.y - self.y;
                                const _dSq = _dx * _dx + _dy * _dy;
                                if (_dSq < _rSq) {
                                    const _dist = Math.sqrt(_dSq) || 1;
                                    _b.vx += (_dx / _dist) * ${p.force};
                                    _b.vy += (_dy / _dist) * ${p.force};
                                }
                            }
                        });
                    }
                `
            },
            {
                type: 'motion_teleport_step',
                category: 'motion',
                name: 'Phase Shift Quantum Blink',
                color: '#4C97FF',
                desc: 'Teleports unit to a flanking offset position on cooldown.',
                params: {
                    distance: { label: 'Blink Distance', type: 'number', min: 80, max: 400, value: 200 },
                    reloadFrames: { label: 'Blink Cadence', type: 'number', min: 60, max: 600, value: 180 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : ${p.reloadFrames};
                    if (self.state._cd_${bId} <= 0) {
                        const _blinkA = Math.random() * Math.PI * 2;
                        self.x += Math.cos(_blinkA) * ${p.distance};
                        self.y += Math.sin(_blinkA) * ${p.distance};
                        self.vx = 0; self.vy = 0;
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'motion_apply_friction',
                category: 'motion',
                name: 'Dampen Velocity (Braking)',
                color: '#4C97FF',
                desc: 'Applies simulated inertia drag to prevent infinite drift.',
                params: {
                    friction: { label: 'Inertia Retention', type: 'slider', min: 0.80, max: 0.98, step: 0.01, value: 0.92 }
                },
                compile: (p) => `
                    self.vx *= ${p.friction};
                    self.vy *= ${p.friction};
                `
            },

            // ── COMBAT & MULTI-WEAPON BLOCKS (RED) ──
            {
                type: 'combat_shoot_standard',
                category: 'combat',
                name: 'Fire Primary Kinetic Cannon',
                color: '#FF4757',
                desc: 'Fires kinetic shell forward along chassis heading (independent cooldown).',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 30, value: 7.0 },
                    damage: { label: 'Damage', type: 'number', min: 1, max: 150, value: 14 },
                    bulletSize: { label: 'Caliber Size', type: 'number', min: 4, max: 28, value: 8 },
                    reloadFrames: { label: 'Reload Cadence', type: 'number', min: 6, max: 240, value: 45 },
                    bulletColor: { label: 'Tracer Tint', type: 'color', value: '#ff4757' }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        api.shoot(self, self.angle, {
                            speed: ${p.speed},
                            damage: ${p.damage},
                            size: ${p.bulletSize},
                            color: '${p.bulletColor}',
                            life: 110
                        });
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_shoot_scattergun',
                category: 'combat',
                name: 'Fire Scattergun Blast (Cone)',
                color: '#FF4757',
                desc: 'Discharges multi-pellet conical buckshot spread with customizable recoil.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 25, value: 8.0 },
                    pelletCount: { label: 'Pellet Quantity', type: 'number', min: 2, max: 18, value: 6 },
                    spreadDeg: { label: 'Cone Spread (°)', type: 'number', min: 10, max: 90, value: 36 },
                    damage: { label: 'Damage / Pellet', type: 'number', min: 1, max: 60, value: 9 },
                    recoilPush: { label: 'Recoil Pushback', type: 'slider', min: 0, max: 5.0, step: 0.2, value: 2.2 },
                    reloadFrames: { label: 'Reload Cadence', type: 'number', min: 15, max: 240, value: 75 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        const _arcRad = (${p.spreadDeg} * Math.PI) / 180;
                        const _cnt = ${p.pelletCount};
                        for (let _i = 0; _i < _cnt; _i++) {
                            const _offset = -_arcRad / 2 + (_i / (_cnt - 1)) * _arcRad;
                            api.shoot(self, self.angle + _offset, {
                                speed: ${p.speed} * (0.85 + Math.random() * 0.3),
                                damage: ${p.damage},
                                size: 6,
                                life: 60,
                                color: self.color
                            });
                        }
                        self.vx -= Math.cos(self.angle) * ${p.recoilPush};
                        self.vy -= Math.sin(self.angle) * ${p.recoilPush};
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_burst_salvo',
                category: 'combat',
                name: 'Discharge Rapid Salvo',
                color: '#FF4757',
                desc: 'Fires high-velocity stream of rounds before pausing for a magazine reload.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 30, value: 9.0 },
                    burstCount: { label: 'Shots in Salvo', type: 'number', min: 2, max: 10, value: 4 },
                    gapFrames: { label: 'Inter-Shot Gap', type: 'number', min: 2, max: 20, value: 5 },
                    damage: { label: 'Damage', type: 'number', min: 1, max: 80, value: 13 },
                    reloadFrames: { label: 'Magazine Cooldown', type: 'number', min: 30, max: 360, value: 95 }
                },
                compile: (p, bId) => `
                    self.state._burst_${bId} = self.state._burst_${bId} || 0;
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        api.shoot(self, self.angle + (Math.random() - 0.5) * 0.1, {
                            speed: ${p.speed},
                            damage: ${p.damage},
                            size: 7,
                            life: 95,
                            color: '#ffd700'
                        });
                        self.state._burst_${bId}++;
                        if (self.state._burst_${bId} >= ${p.burstCount}) {
                            self.state._burst_${bId} = 0;
                            self.state._cd_${bId} = ${p.reloadFrames};
                        } else {
                            self.state._cd_${bId} = ${p.gapFrames};
                        }
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_sniper_beam',
                category: 'combat',
                name: 'Precision Railgun Lance',
                color: '#FF4757',
                desc: 'Fires high-damage, ultra-high-velocity projectile along target bearing.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 5, max: 40, value: 16 },
                    damage: { label: 'Piercing Damage', type: 'number', min: 10, max: 200, value: 35 },
                    bulletSize: { label: 'Beam Caliber', type: 'number', min: 4, max: 20, value: 10 },
                    reloadFrames: { label: 'Recharge Cadence', type: 'number', min: 30, max: 300, value: 110 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        api.shoot(self, self.angle, {
                            speed: ${p.speed},
                            damage: ${p.damage},
                            size: ${p.bulletSize},
                            color: '#ff3838',
                            life: 140
                        });
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_radial_nova',
                category: 'combat',
                name: '360° Radial Nova Ring',
                color: '#FF4757',
                desc: 'Discharges an expanding 360-degree radial ring barrage in all directions.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 25, value: 5.5 },
                    rays: { label: 'Ray Count', type: 'number', min: 4, max: 24, value: 8 },
                    damage: { label: 'Ray Damage', type: 'number', min: 1, max: 60, value: 11 },
                    reloadFrames: { label: 'Nova Cadence', type: 'number', min: 30, max: 300, value: 115 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        const _rays = ${p.rays};
                        for (let _i = 0; _i < _rays; _i++) {
                            const _a = (_i / _rays) * Math.PI * 2;
                            api.shoot(self, _a, {
                                speed: ${p.speed},
                                damage: ${p.damage},
                                size: 7,
                                life: 85,
                                color: '#a55eea'
                            });
                        }
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_spiral_stream',
                category: 'combat',
                name: 'Continuous Spiral Bullet Hell',
                color: '#FF4757',
                desc: 'Emits a revolving pinwheel stream of projectiles.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 25, value: 5.0 },
                    rotStepDeg: { label: 'Step Angle (°)', type: 'number', min: 5, max: 45, value: 18 },
                    damage: { label: 'Damage', type: 'number', min: 1, max: 30, value: 7 },
                    gapFrames: { label: 'Cadence (Frames)', type: 'number', min: 1, max: 15, value: 3 }
                },
                compile: (p, bId) => `
                    self.state._spiralA_${bId} = (self.state._spiralA_${bId} || 0) + (${p.rotStepDeg} * Math.PI / 180);
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        api.shoot(self, self.state._spiralA_${bId}, {
                            speed: ${p.speed},
                            damage: ${p.damage},
                            size: 6,
                            life: 100,
                            color: '#00d2d3'
                        });
                        self.state._cd_${bId} = ${p.gapFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_rear_flak',
                category: 'combat',
                name: 'Deploy Rear Defense Flak',
                color: '#FF4757',
                desc: 'Fires defensive spread out the back of the tank to counter tailing chasers.',
                params: {
                    speed: { label: 'Bullet Speed', type: 'number', min: 1, max: 25, value: 6.5 },
                    pelletCount: { label: 'Pellets', type: 'number', min: 2, max: 8, value: 3 },
                    damage: { label: 'Flak Damage', type: 'number', min: 1, max: 50, value: 12 },
                    reloadFrames: { label: 'Cadence', type: 'number', min: 10, max: 180, value: 50 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        const _rear = self.angle + Math.PI;
                        for (let _i = -1; _i <= 1; _i++) {
                            api.shoot(self, _rear + _i * 0.22, {
                                speed: ${p.speed},
                                damage: ${p.damage},
                                size: 6,
                                life: 55,
                                color: '#fc7677'
                            });
                        }
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },
            {
                type: 'combat_drop_mine',
                category: 'combat',
                name: 'Deploy Proximity Spike Mine',
                color: '#FF4757',
                desc: 'Anchors a spiked proximity explosive mine onto the field.',
                params: {
                    speed: { label: 'Bullet Speed (Chute)', type: 'number', min: 0, max: 10, step: 0.1, value: 0.8 },
                    damage: { label: 'Mine Damage', type: 'number', min: 10, max: 150, value: 50 },
                    reloadFrames: { label: 'Chute Cadence', type: 'number', min: 30, max: 360, value: 120 }
                },
                compile: (p, bId) => `
                    self.state._cd_${bId} = self.state._cd_${bId} !== undefined ? self.state._cd_${bId} : 0;
                    if (self.state._cd_${bId} <= 0) {
                        api.shoot(self, self.angle + Math.PI, {
                            speed: ${p.speed},
                            damage: ${p.damage},
                            size: 16,
                            life: 750,
                            color: '#ff4757',
                            isMine: true
                        });
                        self.state._cd_${bId} = ${p.reloadFrames};
                    }
                    if (self.state._cd_${bId} > 0) self.state._cd_${bId}--;
                `
            },

            // ── DEFENSE & CONTROL LOGIC ──
            {
                type: 'defense_energy_shield',
                category: 'control',
                name: 'Recharge Energy Shield Barrier',
                color: '#FFAB19',
                desc: 'Generates personal absorbing shield that mitigates incoming damage.',
                params: {
                    maxShield: { label: 'Shield Capacity', type: 'number', min: 20, max: 500, value: 100 },
                    rechargeRate: { label: 'Regen / Tick', type: 'slider', min: 0.05, max: 1.0, step: 0.05, value: 0.2 }
                },
                compile: (p) => `
                    self.state.shieldHp = self.state.shieldHp !== undefined ? self.state.shieldHp : ${p.maxShield};
                    if (self.state.shieldHp < ${p.maxShield}) {
                        self.state.shieldHp = Math.min(${p.maxShield}, self.state.shieldHp + ${p.rechargeRate});
                    }
                `
            },
            {
                type: 'control_enrage_low_hp',
                category: 'control',
                name: 'Overdrive Rage (Low Health)',
                color: '#FFAB19',
                desc: 'Boosts movement speed and fire rate when hull drops below threshold.',
                params: {
                    hpPercent: { label: 'HP Trigger %', type: 'slider', min: 10, max: 60, step: 5, value: 40 },
                    speedBoost: { label: 'Speed Multiplier', type: 'slider', min: 1.1, max: 2.0, step: 0.1, value: 1.35 }
                },
                compile: (p) => `
                    if (self.hp < self.maxHp * (${p.hpPercent} / 100)) {
                        self.vx *= ${p.speedBoost};
                        self.vy *= ${p.speedBoost};
                    }
                `
            }
        ],

        draw: [
            // ── RENDERING / LOOKS BLOCKS (PURPLE) ──
            {
                type: 'render_draw_body_hull',
                category: 'render',
                name: 'Render Primary Hull Geometry',
                color: '#9966FF',
                desc: 'Draws the main geometric armored hull.',
                params: {
                    shape: { label: 'Hull Geometry', type: 'select', options: ['circle', 'triangle', 'square', 'hexagon'], value: 'circle' },
                    borderWidth: { label: 'Outline Width', type: 'slider', min: 1, max: 8, step: 0.5, value: 3.5 },
                    borderColor: { label: 'Outline Color', type: 'color', value: '#1e293b' }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.lineWidth = ${p.borderWidth};
                    ctx.strokeStyle = '${p.borderColor}';
                    ctx.fillStyle = self.color;
                    ctx.lineJoin = 'round';

                    const _r = self.r;
                    ctx.beginPath();
                    if ('${p.shape}' === 'triangle') {
                        for (let _i = 0; _i < 3; _i++) {
                            const _a = _i * 2.094 + Math.PI;
                            ctx.lineTo(_r * 1.25 * Math.cos(_a), _r * 1.25 * Math.sin(_a));
                        }
                    } else if ('${p.shape}' === 'square') {
                        ctx.rect(-_r, -_r, _r * 2, _r * 2);
                    } else if ('${p.shape}' === 'hexagon') {
                        for (let _i = 0; _i < 6; _i++) {
                            const _a = (_i * Math.PI) / 3;
                            ctx.lineTo(_r * 1.15 * Math.cos(_a), _r * 1.15 * Math.sin(_a));
                        }
                    } else {
                        ctx.arc(0, 0, _r, 0, Math.PI * 2);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
                    ctx.beginPath();
                    ctx.arc(-_r * 0.25, -_r * 0.25, _r * 0.65, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                `
            },
            {
                type: 'render_draw_cannon_barrel',
                category: 'render',
                name: 'Render Single Cannon Barrel',
                color: '#9966FF',
                desc: 'Renders heavy articulated cannon barrel.',
                params: {
                    lengthMult: { label: 'Length Scale', type: 'slider', min: 1.0, max: 3.5, step: 0.1, value: 2.2 },
                    widthMult: { label: 'Bore Width', type: 'slider', min: 0.2, max: 1.2, step: 0.05, value: 0.65 },
                    barrelColor: { label: 'Alloy Tint', type: 'color', value: '#64748b' }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    const _blen = self.r * ${p.lengthMult};
                    const _bwid = self.r * ${p.widthMult};
                    ctx.fillStyle = '${p.barrelColor}';
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2.5;
                    ctx.fillRect(0, -_bwid / 2, _blen, _bwid);
                    ctx.strokeRect(0, -_bwid / 2, _blen, _bwid);

                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(_blen - 6, -_bwid * 0.65, 6, _bwid * 1.3);
                    ctx.strokeRect(_blen - 6, -_bwid * 0.65, 6, _bwid * 1.3);
                    ctx.restore();
                `
            },
            {
                type: 'render_draw_twin_barrels',
                category: 'render',
                name: 'Render Twin Dual Barrels',
                color: '#9966FF',
                desc: 'Renders parallel twin autocannon barrels.',
                params: {
                    lengthMult: { label: 'Length Scale', type: 'slider', min: 1.0, max: 3.0, step: 0.1, value: 2.0 },
                    spacing: { label: 'Spacing (px)', type: 'number', min: 4, max: 24, value: 12 },
                    barrelColor: { label: 'Barrel Alloy', type: 'color', value: '#475569' }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    const _len = self.r * ${p.lengthMult};
                    const _sp = ${p.spacing} / 2;
                    ctx.fillStyle = '${p.barrelColor}';
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2;
                    ctx.fillRect(0, -_sp - 4, _len, 8);
                    ctx.strokeRect(0, -_sp - 4, _len, 8);
                    ctx.fillRect(0, _sp - 4, _len, 8);
                    ctx.strokeRect(0, _sp - 4, _len, 8);
                    ctx.restore();
                `
            },
            {
                type: 'render_draw_quad_cannons',
                category: 'render',
                name: 'Render Quad Cross Cannons (90°)',
                color: '#9966FF',
                desc: 'Renders 4 heavy batteries at 90-degree intervals.',
                params: {
                    lengthMult: { label: 'Length Scale', type: 'slider', min: 1.0, max: 2.5, step: 0.1, value: 1.7 },
                    barrelColor: { label: 'Alloy Tint', type: 'color', value: '#334155' }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    for (let _i = 0; _i < 4; _i++) {
                        ctx.save();
                        ctx.rotate(self.angle + (_i * Math.PI / 2));
                        const _len = self.r * ${p.lengthMult};
                        ctx.fillStyle = '${p.barrelColor}';
                        ctx.strokeStyle = '#0f172a';
                        ctx.lineWidth = 2;
                        ctx.fillRect(0, -5, _len, 10);
                        ctx.strokeRect(0, -5, _len, 10);
                        ctx.restore();
                    }
                    ctx.restore();
                `
            },
            {
                type: 'render_glowing_reactor',
                category: 'render',
                name: 'Pulsating Plasma Core',
                color: '#9966FF',
                desc: 'Renders harmonic glowing energy core well in chassis center.',
                params: {
                    coreColor: { label: 'Plasma Tint', type: 'color', value: '#00d2d3' },
                    radiusFraction: { label: 'Radius %', type: 'slider', min: 0.15, max: 0.65, step: 0.05, value: 0.35 }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    const _pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
                    const _crad = self.r * ${p.radiusFraction} * (0.85 + 0.3 * _pulse);

                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r * ${p.radiusFraction} * 1.25, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = '${p.coreColor}';
                    ctx.beginPath();
                    ctx.arc(0, 0, _crad, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(0, 0, _crad * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                `
            },
            {
                type: 'render_laser_sight',
                category: 'render',
                name: 'Laser Aiming Telegraph Line',
                color: '#9966FF',
                desc: 'Projects targeting laser sightline along chassis heading.',
                params: {
                    beamColor: { label: 'Laser Tint', type: 'color', value: '#ff4757' },
                    length: { label: 'Sight Range', type: 'number', min: 100, max: 900, value: 450 }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.strokeStyle = '${p.beamColor}';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([8, 6]);
                    ctx.beginPath();
                    ctx.moveTo(self.r, 0);
                    ctx.lineTo(self.r + ${p.length}, 0);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                `
            },
            {
                type: 'render_rotating_shield',
                category: 'render',
                name: 'Rotating Hex Barrier Ring',
                color: '#9966FF',
                desc: 'Renders rotating energy barrier arc around unit perimeter.',
                params: {
                    shieldColor: { label: 'Barrier Tint', type: 'color', value: '#00d2d3' },
                    radiusOffset: { label: 'Radius Offset', type: 'number', min: 6, max: 35, value: 14 }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    const _rot = (Date.now() * 0.002) % (Math.PI * 2);
                    ctx.rotate(_rot);
                    ctx.strokeStyle = '${p.shieldColor}';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([12, 8]);
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r + ${p.radiusOffset}, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                `
            },
            {
                type: 'render_segmented_plates',
                category: 'render',
                name: 'Reinforced Armor Plating',
                color: '#9966FF',
                desc: 'Renders exterior reinforced ceramic armor plates.',
                params: {
                    plateColor: { label: 'Plate Alloy', type: 'color', value: '#1e293b' },
                    thickness: { label: 'Plate Width', type: 'slider', min: 2, max: 10, step: 1, value: 5 }
                },
                compile: (p) => `
                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.strokeStyle = '${p.plateColor}';
                    ctx.lineWidth = ${p.thickness};
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 0.3, Math.PI * 0.7);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 1.3, Math.PI * 1.7);
                    ctx.stroke();
                    ctx.restore();
                `
            }
        ]
    };

    function injectStyles() {
        if (document.getElementById('ee-native-styles')) return;
        const style = document.createElement('style');
        style.id = 'ee-native-styles';
        style.textContent = `
            #enemy-editor-screen {
                position: fixed; inset: 0;
                background: #050811; color: #cbd5e1;
                font-family: 'Ubuntu', sans-serif;
                z-index: 650; display: none; flex-direction: row;
                box-sizing: border-box; overflow: hidden;
            }

            .ee-sidebar {
                width: 500px; background: #0a0f1d;
                border-right: 1px solid #1e293b;
                display: flex; flex-direction: column; flex-shrink: 0;
            }

            .ee-main {
                flex: 1; background: #03060c;
                display: flex; flex-direction: column;
                min-width: 0; position: relative;
            }

            .ee-bar {
                padding: 8px 14px; background: #070c18;
                border-bottom: 1px solid #1e293b;
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
            }

            .ee-tabs-bar {
                display: flex; background: #040813;
                border-bottom: 1px solid #1e293b;
            }

            .ee-tab-btn {
                flex: 1; padding: 10px 4px; text-align: center;
                background: transparent; border: none; border-bottom: 2px solid transparent;
                color: #64748b; font-size: 10.5px; font-weight: 700;
                letter-spacing: 0.5px; cursor: pointer; transition: all 0.12s;
            }

            .ee-tab-btn:hover { color: #cbd5e1; background: rgba(255,255,255,0.03); }
            .ee-tab-btn.active {
                color: #00d2d3; border-bottom-color: #00d2d3;
                background: #0a0f1d;
            }

            .ee-scroll {
                flex: 1; overflow-y: auto; padding: 12px;
                display: flex; flex-direction: column; gap: 10px;
            }

            .ee-card {
                background: #0f172a; border: 1px solid #1e293b;
                border-radius: 8px; padding: 10px; display: flex;
                flex-direction: column; gap: 8px;
            }

            .ee-card-title {
                font-size: 10.5px; font-weight: 700; color: #00d2d3;
                text-transform: uppercase; letter-spacing: 0.5px; margin: 0;
                border-bottom: 1px solid #1e293b; padding-bottom: 5px;
                display: flex; justify-content: space-between; align-items: center;
            }

            .ee-field-row {
                display: flex; flex-direction: column; gap: 3px;
            }

            .ee-field-row label {
                font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase;
                display: flex; justify-content: space-between;
            }

            .ee-grid-2 {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
            }

            .ee-input, .ee-select, .ee-textarea {
                background: #070a12; border: 1px solid #334155;
                border-radius: 5px; padding: 5px 8px; color: #ffffff;
                font-family: inherit; font-size: 10.5px; box-sizing: border-box; width: 100%;
            }

            .ee-textarea {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 10.5px; line-height: 1.4;
                resize: vertical; min-height: 120px;
                white-space: pre; tab-size: 4;
            }

            .ee-input:focus, .ee-select:focus, .ee-textarea:focus {
                outline: none; border-color: #00d2d3;
            }

            .ee-slider-group {
                display: flex; align-items: center; gap: 8px;
            }

            .ee-slider {
                flex: 1; accent-color: #00d2d3; cursor: pointer;
            }

            .ee-btn {
                background: #1e293b; border: 1px solid #334155;
                color: #ffffff; padding: 5px 10px; border-radius: 5px;
                font-size: 10.5px; font-weight: 700; cursor: pointer;
                transition: all 0.12s; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
            }

            .ee-btn:hover { background: #334155; }
            .ee-btn.primary { background: #00d2d3; color: #091322; border-color: #00d2d3; }
            .ee-btn.primary:hover { background: #38efef; }
            .ee-btn.success { background: #2ed573; color: #091322; border-color: #2ed573; }
            .ee-btn.danger { color: #ff4757; border-color: rgba(255, 71, 87, 0.4); }
            .ee-btn.danger:hover { background: #ff4757; color: #fff; }

            .ee-btn-group {
                display: flex; gap: 5px; flex-wrap: wrap;
            }

            /* ── COMPACT SCRATCH PUZZLE BLOCKS & SCROLLING ── */
            .scratch-workspace {
                display: flex; flex-direction: column; gap: 4px; padding: 4px 0;
                max-height: 520px; overflow-y: auto; overflow-x: hidden;
                padding-right: 4px;
            }

            .scratch-workspace::-webkit-scrollbar { width: 6px; }
            .scratch-workspace::-webkit-scrollbar-track { background: #070a14; border-radius: 3px; }
            .scratch-workspace::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
            .scratch-workspace::-webkit-scrollbar-thumb:hover { background: #334155; }

            .scratch-block {
                position: relative; border-radius: 5px; padding: 6px 10px 8px 12px;
                color: #ffffff; font-size: 10px; font-weight: 700;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
                display: flex; flex-direction: column; gap: 5px;
                transition: transform 0.1s ease, filter 0.1s;
                border: 1px solid rgba(255, 255, 255, 0.18);
            }

            .scratch-block::before {
                content: ''; position: absolute; top: -3px; left: 20px;
                width: 14px; height: 4px; background: inherit;
                border-top: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 2px 2px 0 0;
            }

            .scratch-block::after {
                content: ''; position: absolute; bottom: -4px; left: 20px;
                width: 14px; height: 4px; background: #0a0f1d;
                border-bottom: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 0 0 2px 2px;
            }

            .scratch-block:hover { filter: brightness(1.1); transform: translateX(2px); }
            .scratch-block.is-dragging { opacity: 0.35; transform: scale(0.98); }

            .scratch-header {
                display: flex; align-items: center; justify-content: space-between; gap: 6px;
            }

            .scratch-title {
                display: flex; align-items: center; gap: 5px; font-size: 10px;
                letter-spacing: 0.2px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            }

            .scratch-controls { display: flex; gap: 3px; }

            .scratch-mini-btn {
                background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.2);
                color: #ffffff; width: 18px; height: 18px; border-radius: 3px;
                font-size: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center;
            }

            .scratch-mini-btn:hover { background: rgba(255, 255, 255, 0.3); }

            .scratch-capsule-grid {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px;
                background: rgba(0, 0, 0, 0.25); padding: 5px 7px; border-radius: 4px;
            }

            .scratch-bubble-field { display: flex; flex-direction: column; gap: 2px; }
            .scratch-bubble-label {
                font-size: 8px; color: rgba(255, 255, 255, 0.85); font-weight: 700; text-transform: uppercase;
            }

            .scratch-bubble-input {
                background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 10px; padding: 2px 6px; color: #ffffff; font-size: 9.5px;
                font-weight: 700; width: 100%; box-sizing: border-box; outline: none;
            }

            .ee-canvas-container {
                flex: 1; display: flex; align-items: center; justify-content: center;
                position: relative; overflow: hidden;
            }

            #ee-viewport-canvas {
                background: radial-gradient(circle at center, #0e1828 0%, #030509 100%);
                cursor: crosshair;
            }

            .ee-telemetry-box {
                position: absolute; top: 14px; left: 16px; pointer-events: none;
                font-size: 9.5px; font-weight: 700; color: #94a3b8; line-height: 1.55;
                text-shadow: 1px 1px 2px #000;
                background: rgba(10, 15, 29, 0.88); padding: 8px 12px; border-radius: 6px;
                border: 1px solid rgba(51, 65, 85, 0.5); backdrop-filter: blur(4px);
            }

            .ee-error-banner {
                background: rgba(255, 71, 87, 0.15); border: 1px solid #ff4757;
                color: #ff6b81; font-size: 10.5px; padding: 7px 10px; border-radius: 5px;
                display: none; line-height: 1.35;
            }

            /* Modal for manual copy fallback */
            #ee-export-modal {
                position: fixed; inset: 0; background: rgba(0,0,0,0.8);
                display: none; align-items: center; justify-content: center;
                z-index: 700;
            }
            #ee-export-card {
                background: #0f172a; border: 2px solid #00d2d3; border-radius: 10px;
                width: 600px; max-width: 90vw; padding: 20px; display: flex;
                flex-direction: column; gap: 12px; box-shadow: 0 0 50px rgba(0, 210, 211, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        // Cache pristine factory definitions before any storage loads or edits
        if (typeof EnemyAPI !== 'undefined') {
            EnemyAPI.list().forEach(id => {
                const d = EnemyAPI.get(id);
                if (d) {
                    originalDefCache.set(id, {
                        onDraw: d.onDraw,
                        onUpdate: d.onUpdate,
                        onSpawn: d.onSpawn,
                        onDie: d.onDie,
                        name: d.name,
                        color: d.color,
                        radius: d.radius,
                        hp: d.hp,
                        bodyShape: d.bodyShape,
                        xpReward: d.xpReward,
                        scoreValue: d.scoreValue,
                        isBoss: d.isBoss
                    });
                }
            });
        }

        injectStyles();
        buildDOM();
        loadCustomEnemiesFromStorage();
    }

    function buildDOM() {
        overlay = document.createElement('div');
        overlay.id = 'enemy-editor-screen';
        overlay.innerHTML = `
            <div class="ee-sidebar">
                <div class="ee-bar">
                    <span style="font-size:11.5px; font-weight:700; color:#00d2d3; letter-spacing:1px;">ENEMYAPI SCRATCH LAB</span>
                    <div style="display:flex; gap:6px;">
                        <button class="ee-btn success" onclick="EnemyEditor.saveAndApply()">Save & Deploy</button>
                    </div>
                </div>

                <div style="padding:8px 12px 0 12px; background:#080d1a;">
                    <div style="display:flex; gap:6px; margin-bottom:6px;">
                        <select class="ee-select" id="ee-unit-select" onchange="EnemyEditor.selectUnit(this.value)"></select>
                    </div>
                    <div class="ee-btn-group" style="margin-bottom:6px;">
                        <button class="ee-btn" onclick="EnemyEditor.createNewUnit()">+ New</button>
                        <button class="ee-btn" onclick="EnemyEditor.cloneCurrentUnit()">Clone</button>
                        <button class="ee-btn" onclick="EnemyEditor.resetToFactoryDefaults()">Reset Unit</button>
                        <button class="ee-btn danger" onclick="EnemyEditor.deleteCurrentUnit()">Delete</button>
                        <button class="ee-btn" onclick="EnemyEditor.exportUnitCode()">Export JS</button>
                    </div>
                </div>

                <div class="ee-tabs-bar">
                    <button class="ee-tab-btn" id="tab-btn-chassis" onclick="EnemyEditor.switchTab('chassis')">CHASSIS</button>
                    <button class="ee-tab-btn active" id="tab-btn-blocks-update" onclick="EnemyEditor.switchTab('blocks-update')">UPDATE BLOCKS</button>
                    <button class="ee-tab-btn" id="tab-btn-blocks-draw" onclick="EnemyEditor.switchTab('blocks-draw')">DRAW BLOCKS</button>
                    <button class="ee-tab-btn" id="tab-btn-target" onclick="EnemyEditor.switchTab('target')">TARGET DRONE</button>
                    <button class="ee-tab-btn" id="tab-btn-code" onclick="EnemyEditor.switchTab('code')">RAW JS</button>
                </div>

                <div class="ee-scroll">
                    <div id="ee-error-box" class="ee-error-banner"></div>

                    <!-- TAB 1: CHASSIS & STATS -->
                    <div id="tab-pane-chassis" style="display:none; flex-direction:column; gap:10px;">
                        <div class="ee-card">
                            <span class="ee-card-title">Chassis Specifications</span>
                            <div class="ee-grid-2">
                                <div class="ee-field-row">
                                    <label>Unit Identifier</label>
                                    <input type="text" class="ee-input" id="ee-id" onchange="EnemyEditor.updateUnitId(this.value)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Display Name</label>
                                    <input type="text" class="ee-input" id="ee-name" oninput="EnemyEditor.onNameInput(this.value)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Hull Geometry</label>
                                    <select class="ee-select" id="ee-shape" onchange="EnemyEditor.onShapeInput(this.value)">
                                        <option value="circle">Circle (Scout/Light)</option>
                                        <option value="triangle">Triangle (Rammer/Striker)</option>
                                        <option value="square">Square (Fort/Breacher)</option>
                                        <option value="hexagon">Hexagon (Dreadnought/Boss)</option>
                                    </select>
                                </div>
                                <div class="ee-field-row">
                                    <label>Hull Radius (px)</label>
                                    <input type="number" class="ee-input" id="ee-radius" min="10" max="150" oninput="EnemyEditor.onRadiusInput(this.value)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Max Integrity HP</label>
                                    <input type="number" class="ee-input" id="ee-hp" min="1" max="15000" oninput="EnemyEditor.onHpInput(this.value)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Hull Color</label>
                                    <input type="color" class="ee-input" id="ee-color" style="height:26px; padding:2px;" oninput="EnemyEditor.onColorInput(this.value)">
                                </div>
                            </div>
                        </div>

                        <div class="ee-card">
                            <span class="ee-card-title">Bounty & Boss Protocol</span>
                            <div class="ee-grid-2">
                                <div class="ee-field-row">
                                    <label>XP Bounty</label>
                                    <input type="number" class="ee-input" id="ee-xp" min="0" oninput="EnemyEditor.onXpInput(this.value)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Score Points</label>
                                    <input type="number" class="ee-input" id="ee-score" min="0" oninput="EnemyEditor.onScoreInput(this.value)">
                                </div>
                            </div>
                            <div class="ee-field-row" style="margin-top:4px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; text-transform:none;">
                                    <input type="checkbox" id="ee-is-boss" onchange="EnemyEditor.onBossInput(this.checked)">
                                    <span style="color:#ffffff; font-weight:700; font-size:10.5px;">Dreadnought Boss Flag (HUD Bar & Death FX)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: UPDATE VISUAL SCRATCH BLOCKS -->
                    <div id="tab-pane-blocks-update" style="display:flex; flex-direction:column; gap:8px;">
                        <div class="ee-card">
                            <span class="ee-card-title">
                                <span>Behavior Blocks (onUpdate)</span>
                                <span style="font-size:8.5px; color:#64748b;">MULTI-WEAPON CONCURRENT</span>
                            </span>
                            <div style="display:flex; gap:6px;">
                                <select class="ee-select" id="ee-add-update-palette">
                                    <option value="">-- Add Action Block --</option>
                                </select>
                                <button class="ee-btn primary" onclick="EnemyEditor.addBlock('update')">+ Add</button>
                            </div>
                        </div>
                        <div class="scratch-workspace" id="ee-update-blocks-container"></div>
                    </div>

                    <!-- TAB 3: DRAW VISUAL SCRATCH BLOCKS -->
                    <div id="tab-pane-blocks-draw" style="display:none; flex-direction:column; gap:8px;">
                        <div class="ee-card">
                            <span class="ee-card-title">
                                <span>Rendering Pipeline Blocks (onDraw)</span>
                                <span style="font-size:8.5px; color:#64748b;">CUSTOM CANVAS OVERLAY</span>
                            </span>
                            <div style="font-size:9.5px; color:#94a3b8; line-height:1.4;">
                                Note: If no draw blocks are added, the editor automatically renders the native <b>EnemyAPI</b> visual definition (Hive silos, Rammer thrusters, Hexagon shields, etc.).
                            </div>
                            <div style="display:flex; gap:6px;">
                                <select class="ee-select" id="ee-add-draw-palette">
                                    <option value="">-- Add Render Block --</option>
                                </select>
                                <button class="ee-btn primary" onclick="EnemyEditor.addBlock('draw')">+ Add</button>
                            </div>
                        </div>
                        <div class="scratch-workspace" id="ee-draw-blocks-container"></div>
                    </div>

                    <!-- TAB 4: ADVANCED TARGET DRONE CONFIGURATION -->
                    <div id="tab-pane-target" style="display:none; flex-direction:column; gap:10px;">
                        <div class="ee-card">
                            <span class="ee-card-title">Target Drone Flight AI</span>
                            <div class="ee-field-row">
                                <label>Kinematic Flight Mode</label>
                                <select class="ee-select" id="ee-target-mode" onchange="EnemyEditor.onTargetConfigChange('moveMode', this.value)">
                                    <option value="figure8">Lissajous Figure-8 Flight</option>
                                    <option value="patrol_h">Horizontal Strafe Patrol</option>
                                    <option value="patrol_v">Vertical Lane Patrol</option>
                                    <option value="orbit">Perimeter Orbit Sweep</option>
                                    <option value="evasive">Reactive Bullet-Evasion AI</option>
                                    <option value="manual_wasd">Manual Pilot (WASD Keys)</option>
                                    <option value="static">Stationary Anchor</option>
                                </select>
                            </div>
                            <div class="ee-field-row">
                                <label><span>Cruising Velocity</span><span id="lbl-tgt-spd">0.5</span></label>
                                <div class="ee-slider-group">
                                    <input type="range" class="ee-slider" min="0.0" max="1.0" step="0.05" id="slider-tgt-spd" value="0.5"
                                           oninput="EnemyEditor.onTargetConfigChange('moveSpeed', parseFloat(this.value)); document.getElementById('lbl-tgt-spd').innerText = this.value;">
                                </div>
                            </div>
                            <div class="ee-field-row">
                                <label><span>Patrol Sweep Radius</span><span id="lbl-tgt-range">220px</span></label>
                                <div class="ee-slider-group">
                                    <input type="range" class="ee-slider" min="60" max="440" step="10" id="slider-tgt-range" value="220"
                                           oninput="EnemyEditor.onTargetConfigChange('patrolRange', parseInt(this.value)); document.getElementById('lbl-tgt-range').innerText = this.value + 'px';">
                                </div>
                            </div>
                        </div>

                        <div class="ee-card">
                            <span class="ee-card-title">Target Armor & Return-Fire Defense</span>
                            <div class="ee-grid-2">
                                <div class="ee-field-row">
                                    <label>Hull Integrity (HP)</label>
                                    <input type="number" class="ee-input" id="ee-tgt-hp" min="10" max="5000" value="120"
                                           oninput="EnemyEditor.onTargetConfigChange('maxHp', parseInt(this.value) || 100)">
                                </div>
                                <div class="ee-field-row">
                                    <label>Respawn Delay (Frames)</label>
                                    <input type="number" class="ee-input" id="ee-tgt-respawn" min="20" max="300" value="90"
                                           oninput="EnemyEditor.onTargetConfigChange('maxRespawnDelay', parseInt(this.value) || 90)">
                                </div>
                            </div>
                            <div class="ee-field-row" style="margin-top:4px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; text-transform:none;">
                                    <input type="checkbox" id="chk-tgt-invuln" onchange="EnemyEditor.onTargetConfigChange('invulnerable', this.checked)">
                                    <span style="color:#ffffff; font-weight:700;">Invulnerability Energy Barrier</span>
                                </label>
                            </div>
                            <div class="ee-field-row">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; text-transform:none;">
                                    <input type="checkbox" id="chk-tgt-fire" checked onchange="EnemyEditor.onTargetConfigChange('fireBack', this.checked)">
                                    <span style="color:#2ed573; font-weight:700;">Live Return-Fire (Test Enemy Defenses)</span>
                                </label>
                            </div>
                            <div class="ee-grid-2">
                                <div class="ee-field-row">
                                    <label>Weapon System</label>
                                    <select class="ee-select" id="ee-tgt-weap" onchange="EnemyEditor.onTargetConfigChange('weaponType', this.value)">
                                        <option value="cannon">Kinetic Autocannon</option>
                                        <option value="scatter">Twin Scattergun</option>
                                    </select>
                                </div>
                                <div class="ee-field-row">
                                    <label>Cannon Damage</label>
                                    <input type="number" class="ee-input" id="ee-tgt-dmg" min="1" max="150" value="15"
                                           oninput="EnemyEditor.onTargetConfigChange('bulletDmg', parseInt(this.value) || 15)">
                                </div>
                            </div>
                            <div class="ee-field-row">
                                <label>Firing Cadence (Frames)</label>
                                <input type="number" class="ee-input" id="ee-tgt-cadence" min="6" max="120" value="28"
                                       oninput="EnemyEditor.onTargetConfigChange('fireRate', parseInt(this.value) || 28)">
                            </div>
                            <button class="ee-btn primary" onclick="EnemyEditor.reconstituteTarget()">Force Target Reconstitution</button>
                        </div>
                    </div>

                    <!-- TAB 5: RAW JAVASCRIPT CODE INSPECTOR -->
                    <div id="tab-pane-code" style="display:none; flex-direction:column; gap:10px;">
                        <div class="ee-card">
                            <span class="ee-card-title">Live JavaScript Code</span>
                            <div class="ee-field-row">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; text-transform:none;">
                                    <input type="checkbox" id="ee-raw-override" onchange="EnemyEditor.onRawOverrideToggle(this.checked)">
                                    <span style="color:#ffd700; font-weight:700;">Override Scratch Blocks with Raw Code</span>
                                </label>
                            </div>
                            <div class="ee-field-row">
                                <label>onSpawn(self, api) [Unit Init Function]</label>
                                <textarea class="ee-textarea" id="ee-raw-init" spellcheck="false" style="min-height:75px;" oninput="liveTuning.rawInitCode = this.value;"></textarea>
                            </div>
                            <div class="ee-field-row">
                                <label>onUpdate(self, player, api)</label>
                                <textarea class="ee-textarea" id="ee-raw-update" spellcheck="false" oninput="liveTuning.rawUpdateCode = this.value;"></textarea>
                            </div>
                            <div class="ee-field-row">
                                <label>onDraw(self, ctx)</label>
                                <textarea class="ee-textarea" id="ee-raw-draw" spellcheck="false" style="min-height:85px;" oninput="liveTuning.rawDrawCode = this.value;"></textarea>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button class="ee-btn primary" onclick="EnemyEditor.compileRawScript()">Compile Raw Scripts</button>
                                <button class="ee-btn success" onclick="EnemyEditor.parseRawCode()">⚡ Parse JS to Scratch Blocks</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT PANEL: SIMULATION CANVAS -->
            <div class="ee-main">
                <div class="ee-bar">
                    <div style="display:flex; gap:6px;">
                        <button class="ee-btn" onclick="EnemyEditor.adjustZoom(0.15)">Zoom In (+)</button>
                        <button class="ee-btn" onclick="EnemyEditor.adjustZoom(-0.15)">Zoom Out (-)</button>
                        <button class="ee-btn" onclick="EnemyEditor.resetView()">Center View</button>
                        <button class="ee-btn" id="btn-sim-pause" onclick="EnemyEditor.togglePause()">Pause</button>
                        <button class="ee-btn" onclick="EnemyEditor.toggleSpeed()">Speed: <span id="lbl-sim-spd">1.0x</span></button>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="ee-btn" onclick="EnemyEditor.resetSandbox()">Reset Field</button>
                        <button class="ee-btn success" onclick="EnemyEditor.spawnInLiveGame()">Spawn In Game</button>
                        <button class="ee-btn danger" onclick="EnemyEditor.close()">Close</button>
                    </div>
                </div>

                <div class="ee-canvas-container">
                    <canvas id="ee-viewport-canvas" width="880" height="660"></canvas>
                    <div class="ee-telemetry-box">
                        <div>REGISTERED UNIT: <span id="tel-unit" style="color:#00d2d3;">BASIC</span></div>
                        <div>DISTANCE: <span id="tel-dist" style="color:#ffd700;">0 px</span></div>
                        <div>HEADING: <span id="tel-angle" style="color:#2ed573;">0°</span></div>
                        <div>HULL INTEGRITY: <span id="tel-hp" style="color:#ff4757;">100 / 100</span></div>
                        <div>TARGET STATUS: <span id="tel-target-status" style="color:#2ed573;">ACTIVE</span></div>
                    </div>
                </div>
            </div>

            <!-- BULLETPROOF COPY FALLBACK MODAL -->
            <div id="ee-export-modal" onclick="if(event.target===this) this.style.display='none';">
                <div id="ee-export-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#00d2d3; font-weight:700; font-size:13px;">EXPORTED ENEMYAPI JAVASCRIPT</span>
                        <button class="ee-btn" onclick="document.getElementById('ee-export-modal').style.display='none';">✕</button>
                    </div>
                    <textarea id="ee-export-text" class="ee-textarea" style="min-height:260px;" readonly></textarea>
                    <button class="ee-btn success" onclick="EnemyEditor.selectAndCopyModalText()">Copy All Text to Clipboard</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        canvas = document.getElementById('ee-viewport-canvas');
        ctx = canvas.getContext('2d');

        populateBlockPalettes();
        wireInteractions();
    }

    function wireInteractions() {
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseWorldX = (e.clientX - rect.left - canvas.width / 2 - panX) / zoom;
            const mouseWorldY = (e.clientY - rect.top - canvas.height / 2 - panY) / zoom;

            if (Math.hypot(mouseWorldX - simPlayer.x, mouseWorldY - simPlayer.y) < simPlayer.r + 20) {
                isDraggingTarget = true;
                return;
            }

            if (simInstance && Math.hypot(mouseWorldX - simInstance.x, mouseWorldY - simInstance.y) < simInstance.r + 20) {
                isDraggingEnemy = true;
                return;
            }

            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (overlay.style.display !== 'flex') return;

            if (isDraggingTarget) {
                const rect = canvas.getBoundingClientRect();
                simPlayer.x = (e.clientX - rect.left - canvas.width / 2 - panX) / zoom;
                simPlayer.y = (e.clientY - rect.top - canvas.height / 2 - panY) / zoom;
                simPlayer.baseX = simPlayer.x;
                simPlayer.baseY = simPlayer.y;
            } else if (isDraggingEnemy && simInstance) {
                const rect = canvas.getBoundingClientRect();
                simInstance.x = (e.clientX - rect.left - canvas.width / 2 - panX) / zoom;
                simInstance.y = (e.clientY - rect.top - canvas.height / 2 - panY) / zoom;
                simInstance.vx = 0;
                simInstance.vy = 0;
            } else if (isPanning) {
                panX += (e.clientX - lastMouseX);
                panY += (e.clientY - lastMouseY);
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingTarget = false;
            isDraggingEnemy = false;
            isPanning = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            adjustZoom(e.deltaY < 0 ? 0.15 : -0.15);
        });

        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            sandboxKeys[k] = true;
            if (e.key === 'F3') {
                e.preventDefault();
                if (overlay.style.display === 'flex') close();
                else open();
            }
        });

        window.addEventListener('keyup', (e) => {
            sandboxKeys[e.key.toLowerCase()] = false;
        });
    }

    function populateBlockPalettes() {
        const uSel = document.getElementById('ee-add-update-palette');
        const dSel = document.getElementById('ee-add-draw-palette');
        if (!uSel || !dSel) return;
        uSel.innerHTML = '<option value="">-- Add Action Block --</option>';
        dSel.innerHTML = '<option value="">-- Add Render Block --</option>';

        BLOCK_PALETTE.update.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.type;
            opt.innerText = `[${b.category.toUpperCase()}] ${b.name}`;
            uSel.appendChild(opt);
        });

        BLOCK_PALETTE.draw.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.type;
            opt.innerText = `[${b.category.toUpperCase()}] ${b.name}`;
            dSel.appendChild(opt);
        });
    }

    function switchTab(tabId) {
        currentTab = tabId;
        ['chassis', 'blocks-update', 'blocks-draw', 'target', 'code'].forEach(t => {
            const btn = document.getElementById(`tab-btn-${t}`);
            const pane = document.getElementById(`tab-pane-${t}`);
            if (btn) btn.className = `ee-tab-btn ${t === tabId ? 'active' : ''}`;
            if (pane) pane.style.display = t === tabId ? 'flex' : 'none';
        });
        if (tabId === 'code') {
            updateRawCodeDisplays();
        }
    }

    function open() {
        if (typeof state !== 'undefined' && state) state.active = false;
        overlay.style.display = 'flex';
        populateUnitDropdown();
        selectUnit(activeEnemyId || (typeof EnemyAPI !== 'undefined' ? EnemyAPI.list()[0] : 'basic'));
        lastSimTime = performance.now();
        simAccumulator = 0;
        startSandboxLoop();
    }

    function close() {
        overlay.style.display = 'none';
        const menu = document.getElementById('menu-overlay');
        if (menu && (typeof state === 'undefined' || !state.level)) {
            menu.style.display = 'flex';
        }
    }

    function populateUnitDropdown() {
        const sel = document.getElementById('ee-unit-select');
        if (!sel || typeof EnemyAPI === 'undefined') return;
        sel.innerHTML = '';
        EnemyAPI.list().forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = id.toUpperCase();
            if (id === activeEnemyId) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function selectUnit(id) {
        if (!id || typeof EnemyAPI === 'undefined') return;
        activeEnemyId = id;
        const def = EnemyAPI.get(id);
        if (!def) return;

        // Auto-heal / restore pristine native methods if a core unit was corrupted by previous local storage
        if (coreIds.includes(id)) {
            const orig = originalDefCache.get(id);
            if (orig) {
                if (!def._scratchData || !def._scratchData.useRawCodeOverride) {
                    if (orig.onDraw) def.onDraw = orig.onDraw;
                    if (orig.onSpawn) def.onSpawn = orig.onSpawn;
                    if (orig.onUpdate) def.onUpdate = orig.onUpdate;
                }
            }
        }

        liveTuning.id = def.id;
        liveTuning.name = def.name || def.id;
        liveTuning.color = def.color || '#f14e54';
        liveTuning.radius = def.radius || 22;
        liveTuning.hp = def.hp || 100;
        liveTuning.bodyShape = def.bodyShape || 'circle';
        liveTuning.xpReward = def.xpReward || 30;
        liveTuning.scoreValue = def.scoreValue || 20;
        liveTuning.isBoss = Boolean(def.isBoss);

        liveTuning.rawInitCode = def.onSpawn ? def.onSpawn.toString() : '';
        liveTuning.rawUpdateCode = def.onUpdate ? def.onUpdate.toString() : '';
        liveTuning.rawDrawCode = def.onDraw ? def.onDraw.toString() : '';

        // 1. If explicit scratch data exists, load it
        if (def._scratchData) {
            liveTuning.updateBlocks = JSON.parse(JSON.stringify(def._scratchData.updateBlocks || []));
            liveTuning.drawBlocks = coreIds.includes(id) ? [] : JSON.parse(JSON.stringify(def._scratchData.drawBlocks || []));
            liveTuning.useRawCodeOverride = Boolean(def._scratchData.useRawCodeOverride);
        } else {
            // 2. Otherwise run the parser (parses update, preserves native onDraw if no markers exist)
            const parsedUpdate = parseCodeToBlocks(liveTuning.rawUpdateCode, 'update');
            const parsedDraw = parseCodeToBlocks(liveTuning.rawDrawCode, 'draw');

            liveTuning.updateBlocks = parsedUpdate;
            liveTuning.drawBlocks = parsedDraw; // Keeps clean empty array for Hive, which keeps Hive's onDraw intact!
            liveTuning.useRawCodeOverride = false;
        }

        document.getElementById('ee-id').value = liveTuning.id;
        document.getElementById('ee-name').value = liveTuning.name;
        document.getElementById('ee-shape').value = liveTuning.bodyShape;
        document.getElementById('ee-radius').value = liveTuning.radius;
        document.getElementById('ee-hp').value = liveTuning.hp;
        document.getElementById('ee-color').value = liveTuning.color;
        document.getElementById('ee-xp').value = liveTuning.xpReward;
        document.getElementById('ee-score').value = liveTuning.scoreValue;
        document.getElementById('ee-is-boss').checked = liveTuning.isBoss;
        document.getElementById('ee-raw-override').checked = liveTuning.useRawCodeOverride;

        renderBlockStacks();
        resetSandbox();
    }

// ── DECOMPILER / PARSER FOR SCRATCH GENERATED CODE ──
    function parseCodeToBlocks(codeStr, category = 'update') {
        if (!codeStr || typeof codeStr !== 'string') return [];
        const blocks = [];
        const palette = category === 'update' ? BLOCK_PALETTE.update : BLOCK_PALETTE.draw;

        // 1. Check for structured block comment signatures: /* [BLOCK:type] {params} */
        const structuredPattern = /\/\*\s*\[BLOCK:([a-zA-Z0-9_]+)\]\s*(\{.*?\})\s*\*\//g;
        let match;
        let foundStructured = false;

        while ((match = structuredPattern.exec(codeStr)) !== null) {
            foundStructured = true;
            const bType = match[1];
            try {
                const parsedParams = JSON.parse(match[2]);
                const blockDef = palette.find(b => b.type === bType);
                if (blockDef) {
                    const cleanParams = {};
                    for (const k in blockDef.params) {
                        cleanParams[k] = parsedParams[k] !== undefined ? parsedParams[k] : blockDef.params[k].value;
                    }
                    blocks.push({ type: bType, params: cleanParams });
                }
            } catch (e) {
                console.warn('[EnemyEditor Parser] Failed to parse block JSON:', match[2]);
            }
        }

        if (foundStructured && blocks.length > 0) {
            return blocks;
        }

        // 2. Intelligent Regex Heuristic Fallback (ONLY for update blocks - preserves native onDraw visuals!)
        if (category === 'update') {
            if (/Math\.atan2\(player\.y\s*-\s*self\.y/.test(codeStr) && /self\.angle\s*\+=/.test(codeStr)) {
                const steerMatch = codeStr.match(/_diff\s*\*\s*([\d\.]+)/);
                blocks.push({
                    type: 'motion_turn_to_player',
                    params: { steerRate: steerMatch ? parseFloat(steerMatch[1]) : 0.16 }
                });
            }
            if (/self\.vx\s*\+=\s*Math\.cos\(self\.angle\)/.test(codeStr)) {
                const forceMatch = codeStr.match(/Math\.cos\(self\.angle\)\s*\*\s*([\d\.]+)/);
                const maxSpdMatch = codeStr.match(/_spd\s*>\s*([\d\.]+)/);
                blocks.push({
                    type: 'motion_thrust_forward',
                    params: {
                        force: forceMatch ? parseFloat(forceMatch[1]) : 0.25,
                        maxSpeed: maxSpdMatch ? parseFloat(maxSpdMatch[1]) : 4.8
                    }
                });
            }
            if (/targetDist|_d\s*>\s*\d+/.test(codeStr) && /-Math\.sin\(_a\)/.test(codeStr)) {
                const distMatch = codeStr.match(/_d\s*>\s*(\d+)/);
                blocks.push({
                    type: 'motion_maintain_distance',
                    params: {
                        targetDist: distMatch ? parseInt(distMatch[1]) : 280,
                        thrust: 0.25
                    }
                });
            }
            if (/dashTimer/.test(codeStr)) {
                const distMatch = codeStr.match(/_d\s*<\s*(\d+)/);
                const spdMatch = codeStr.match(/Math\.cos\(self\.angle\)\s*\*\s*([\d\.]+)/);
                blocks.push({
                    type: 'motion_rammer_charge',
                    params: {
                        triggerDist: distMatch ? parseInt(distMatch[1]) : 260,
                        burstSpeed: spdMatch ? parseFloat(spdMatch[1]) : 11.0
                    }
                });
            }
            if (/self\.vx\s*\*=\s*([\d\.]+)/.test(codeStr)) {
                const fMatch = codeStr.match(/self\.vx\s*\*=\s*([\d\.]+)/);
                blocks.push({
                    type: 'motion_apply_friction',
                    params: { friction: fMatch ? parseFloat(fMatch[1]) : 0.92 }
                });
            }
            if (/api\.spawnEnemy\s*\(\s*['"]([^'"]+)['"]/.test(codeStr)) {
                const spMatch = codeStr.match(/api\.spawnEnemy\s*\(\s*['"]([^'"]+)['"]/);
                blocks.push({
                    type: 'spawn_minion_drone',
                    params: {
                        unitType: spMatch ? spMatch[1] : 'swarm_drone',
                        offsetDist: 45,
                        reloadFrames: 180,
                        maxAlive: 4
                    }
                });
            }
            if (/_arcRad|spreadDeg/.test(codeStr)) {
                const speedMatch = codeStr.match(/speed:\s*([\d\.]+)/);
                const countMatch = codeStr.match(/_cnt\s*=\s*(\d+)/);
                const dmgMatch = codeStr.match(/damage:\s*(\d+)/);
                blocks.push({
                    type: 'combat_shoot_scattergun',
                    params: {
                        speed: speedMatch ? parseFloat(speedMatch[1]) : 8.0,
                        pelletCount: countMatch ? parseInt(countMatch[1]) : 6,
                        spreadDeg: 36,
                        damage: dmgMatch ? parseInt(dmgMatch[1]) : 9,
                        recoilPush: 2.2,
                        reloadFrames: 75
                    }
                });
            }
            if (/_rays/.test(codeStr)) {
                const raysMatch = codeStr.match(/_rays\s*=\s*(\d+)/);
                const dmgMatch = codeStr.match(/damage:\s*(\d+)/);
                const spdMatch = codeStr.match(/speed:\s*([\d\.]+)/);
                blocks.push({
                    type: 'combat_radial_nova',
                    params: {
                        speed: spdMatch ? parseFloat(spdMatch[1]) : 5.5,
                        rays: raysMatch ? parseInt(raysMatch[1]) : 8,
                        damage: dmgMatch ? parseInt(dmgMatch[1]) : 11,
                        reloadFrames: 115
                    }
                });
            }
            if (/isMine:\s*true/.test(codeStr)) {
                const dmgMatch = codeStr.match(/damage:\s*(\d+)/);
                const spdMatch = codeStr.match(/speed:\s*([\d\.]+)/);
                blocks.push({
                    type: 'combat_drop_mine',
                    params: {
                        speed: spdMatch ? parseFloat(spdMatch[1]) : 0.8,
                        damage: dmgMatch ? parseInt(dmgMatch[1]) : 50,
                        reloadFrames: 120
                    }
                });
            }
            if (/api\.shoot\s*\(self,\s*self\.angle/.test(codeStr) && !/_arcRad/.test(codeStr)) {
                const spdMatch = codeStr.match(/speed:\s*([\d\.]+)/);
                const dmgMatch = codeStr.match(/damage:\s*(\d+)/);
                const szMatch = codeStr.match(/size:\s*(\d+)/);
                blocks.push({
                    type: 'combat_shoot_standard',
                    params: {
                        speed: spdMatch ? parseFloat(spdMatch[1]) : 7.0,
                        damage: dmgMatch ? parseInt(dmgMatch[1]) : 14,
                        bulletSize: szMatch ? parseInt(szMatch[1]) : 8,
                        reloadFrames: 45,
                        bulletColor: '#ff4757'
                    }
                });
            }
        }

        // Return empty array for draw if no structured [BLOCK:...] markers exist, keeping native onDraw intact
        return blocks;
    }

    function renderBlockStacks() {
        renderBlockStackCategory('update');
        renderBlockStackCategory('draw');
    }

    function renderBlockStackCategory(type) {
        const container = document.getElementById(type === 'update' ? 'ee-update-blocks-container' : 'ee-draw-blocks-container');
        if (!container) return;
        container.innerHTML = '';

        const blocks = type === 'update' ? liveTuning.updateBlocks : liveTuning.drawBlocks;

        if (blocks.length === 0) {
            container.innerHTML = `
                <div style="border: 2px dashed #334155; border-radius:8px; padding:18px; text-align:center; color:#64748b; font-size:10px;">
                    Using native <b>EnemyAPI</b> ${type} definition.<br>
                    Select an action block above and click "+ Add" to add visual scripting blocks.
                </div>
            `;
            return;
        }

        blocks.forEach((blockInstance, index) => {
            const blockDef = (type === 'update' ? BLOCK_PALETTE.update : BLOCK_PALETTE.draw).find(b => b.type === blockInstance.type);
            if (!blockDef) return;

            const blockEl = document.createElement('div');
            blockEl.className = 'scratch-block';
            blockEl.style.backgroundColor = blockDef.color;

            blockEl.draggable = true;
            blockEl.ondragstart = (e) => {
                dragBlockType = type;
                dragBlockIndex = index;
                blockEl.classList.add('is-dragging');
                e.dataTransfer.setData('text/plain', index);
            };
            blockEl.ondragend = () => blockEl.classList.remove('is-dragging');
            blockEl.ondragover = (e) => e.preventDefault();
            blockEl.ondrop = (e) => {
                e.preventDefault();
                if (dragBlockType === type && dragBlockIndex !== -1 && dragBlockIndex !== index) {
                    const movingBlock = blocks.splice(dragBlockIndex, 1)[0];
                    blocks.splice(index, 0, movingBlock);
                    renderBlockStackCategory(type);
                    compileVisualBlocks();
                }
            };

            let headerHtml = `
                <div class="scratch-header">
                    <div class="scratch-title">
                        <span style="background:rgba(0,0,0,0.25); padding:1px 5px; border-radius:3px; font-size:9px;">#${index + 1}</span>
                        <span>${blockDef.name}</span>
                    </div>
                    <div class="scratch-controls">
                        <button class="scratch-mini-btn" title="Move Up" onclick="EnemyEditor.moveBlock('${type}', ${index}, -1)">▲</button>
                        <button class="scratch-mini-btn" title="Move Down" onclick="EnemyEditor.moveBlock('${type}', ${index}, 1)">▼</button>
                        <button class="scratch-mini-btn" title="Duplicate Block" onclick="EnemyEditor.duplicateBlock('${type}', ${index})">⧉</button>
                        <button class="scratch-mini-btn" style="color:#ff6b81;" title="Remove" onclick="EnemyEditor.removeBlock('${type}', ${index})">✕</button>
                    </div>
                </div>
            `;

            let paramsHtml = '<div class="scratch-capsule-grid">';
            for (const paramKey in blockDef.params) {
                const schema = blockDef.params[paramKey];
                const currentVal = blockInstance.params[paramKey] !== undefined ? blockInstance.params[paramKey] : schema.value;

                paramsHtml += `<div class="scratch-bubble-field">
                    <span class="scratch-bubble-label">${schema.label}</span>`;

                if (schema.type === 'slider') {
                    paramsHtml += `
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="range" class="ee-slider" min="${schema.min}" max="${schema.max}" step="${schema.step}" value="${currentVal}"
                                   oninput="EnemyEditor.updateBlockParam('${type}', ${index}, '${paramKey}', parseFloat(this.value)); this.nextElementSibling.innerText = this.value;">
                            <span style="font-size:9.5px; color:#ffffff; font-weight:700; width:24px;">${currentVal}</span>
                        </div>
                    `;
                } else if (schema.type === 'number') {
                    paramsHtml += `
                        <input type="number" class="scratch-bubble-input" min="${schema.min}" max="${schema.max}" value="${currentVal}"
                               oninput="EnemyEditor.updateBlockParam('${type}', ${index}, '${paramKey}', parseFloat(this.value) || 0)">
                    `;
                } else if (schema.type === 'color') {
                    paramsHtml += `
                        <input type="color" class="scratch-bubble-input" style="height:22px; padding:1px; cursor:pointer;" value="${currentVal}"
                               oninput="EnemyEditor.updateBlockParam('${type}', ${index}, '${paramKey}', this.value)">
                    `;
                } else if (schema.type === 'select') {
                    paramsHtml += `<select class="scratch-bubble-input" onchange="EnemyEditor.updateBlockParam('${type}', ${index}, '${paramKey}', this.value)">`;
                    schema.options.forEach(optVal => {
                        paramsHtml += `<option value="${optVal}" ${optVal === currentVal ? 'selected' : ''} style="background:#0a0f1d; color:#fff;">${optVal}</option>`;
                    });
                    paramsHtml += `</select>`;
                } else {
                    paramsHtml += `
                        <input type="text" class="scratch-bubble-input" value="${currentVal}"
                               oninput="EnemyEditor.updateBlockParam('${type}', ${index}, '${paramKey}', this.value)">
                    `;
                }
                paramsHtml += `</div>`;
            }
            paramsHtml += '</div>';

            blockEl.innerHTML = headerHtml + paramsHtml;
            container.appendChild(blockEl);
        });
    }

    function addBlock(type) {
        const sel = document.getElementById(type === 'update' ? 'ee-add-update-palette' : 'ee-add-draw-palette');
        const blockType = sel.value;
        if (!blockType) return;

        const blockDef = (type === 'update' ? BLOCK_PALETTE.update : BLOCK_PALETTE.draw).find(b => b.type === blockType);
        if (!blockDef) return;

        const initialParams = {};
        for (const k in blockDef.params) {
            initialParams[k] = blockDef.params[k].value;
        }

        const newBlock = { type: blockType, params: initialParams };
        if (type === 'update') liveTuning.updateBlocks.push(newBlock);
        else liveTuning.drawBlocks.push(newBlock);

        renderBlockStackCategory(type);
        compileVisualBlocks();
    }

    function duplicateBlock(type, index) {
        const blocks = type === 'update' ? liveTuning.updateBlocks : liveTuning.drawBlocks;
        if (blocks[index]) {
            const clone = JSON.parse(JSON.stringify(blocks[index]));
            blocks.splice(index + 1, 0, clone);
            renderBlockStackCategory(type);
            compileVisualBlocks();
        }
    }

    function removeBlock(type, index) {
        const blocks = type === 'update' ? liveTuning.updateBlocks : liveTuning.drawBlocks;
        blocks.splice(index, 1);
        renderBlockStackCategory(type);
        compileVisualBlocks();
    }

    function moveBlock(type, index, delta) {
        const blocks = type === 'update' ? liveTuning.updateBlocks : liveTuning.drawBlocks;
        const targetIdx = index + delta;
        if (targetIdx < 0 || targetIdx >= blocks.length) return;
        const temp = blocks[index];
        blocks[index] = blocks[targetIdx];
        blocks[targetIdx] = temp;
        renderBlockStackCategory(type);
        compileVisualBlocks();
    }

    function updateBlockParam(type, blockIdx, paramKey, val) {
        const blocks = type === 'update' ? liveTuning.updateBlocks : liveTuning.drawBlocks;
        if (blocks[blockIdx] && blocks[blockIdx].params) {
            blocks[blockIdx].params[paramKey] = val;
            compileVisualBlocks();
        }
    }

    // ── LIVE JIT SCRATCH COMPILER ENGINE WITH NATIVE RESTORATION ──
    function compileVisualBlocks() {
        if (liveTuning.useRawCodeOverride) return;

        const def = EnemyAPI.get(activeEnemyId);
        if (!def) return;
        const original = originalDefCache.get(activeEnemyId);

        // 1. Update blocks compilation
        if (liveTuning.updateBlocks.length > 0) {
            let updateSrc = `// Compiled by Sector 7 Scratch JIT Engine\n`;
            liveTuning.updateBlocks.forEach((b, idx) => {
                const pDef = BLOCK_PALETTE.update.find(p => p.type === b.type);
                if (pDef && pDef.compile) {
                    updateSrc += `/* [BLOCK:${b.type}] ${JSON.stringify(b.params)} */\n`;
                    updateSrc += pDef.compile(b.params, idx) + `\n`;
                }
            });
            liveTuning.rawUpdateCode = updateSrc;
            try {
                def.onUpdate = new Function('self', 'player', 'api', updateSrc);
            } catch (err) {
                showError(`Update Compile Error: ${err.message}`);
            }
        } else if (original && original.onUpdate) {
            def.onUpdate = original.onUpdate;
            liveTuning.rawUpdateCode = original.onUpdate.toString();
        }

        // 2. Draw blocks compilation (strictly restores native onDraw if draw stack is empty - keeps Hive intact!)
        if (liveTuning.drawBlocks.length > 0) {
            let drawSrc = `// Compiled by Sector 7 Scratch JIT Engine\n`;
            liveTuning.drawBlocks.forEach((b, idx) => {
                const pDef = BLOCK_PALETTE.draw.find(p => p.type === b.type);
                if (pDef && pDef.compile) {
                    drawSrc += `/* [BLOCK:${b.type}] ${JSON.stringify(b.params)} */\n`;
                    drawSrc += pDef.compile(b.params, idx) + `\n`;
                }
            });
            liveTuning.rawDrawCode = drawSrc;
            try {
                def.onDraw = new Function('self', 'ctx', drawSrc);
            } catch (err) {
                showError(`Draw Compile Error: ${err.message}`);
            }
        } else if (original) {
            def.onDraw = original.onDraw;
            liveTuning.rawDrawCode = original.onDraw ? original.onDraw.toString() : '';
        }

        def._scratchData = {
            updateBlocks: liveTuning.updateBlocks,
            drawBlocks: liveTuning.drawBlocks,
            useRawCodeOverride: false
        };

        clearError();
        resetSandbox();
    }

    function compileRawScript() {
        const initStr = document.getElementById('ee-raw-init').value;
        const updateStr = document.getElementById('ee-raw-update').value;
        const drawStr = document.getElementById('ee-raw-draw').value;

        try {
            const compiledInit = initStr.trim().length > 0 ? new Function('self', 'api', initStr) : undefined;
            const compiledUpdate = new Function('self', 'player', 'api', updateStr);
            const compiledDraw = drawStr.trim().length > 0 ? new Function('self', 'ctx', drawStr) : undefined;

            const def = EnemyAPI.get(activeEnemyId);
            if (def) {
                if (compiledInit) def.onSpawn = compiledInit;
                def.onUpdate = compiledUpdate;
                def.onDraw = compiledDraw;
                def._scratchData = {
                    updateBlocks: liveTuning.updateBlocks,
                    drawBlocks: liveTuning.drawBlocks,
                    useRawCodeOverride: true
                };
            }
            liveTuning.useRawCodeOverride = true;
            document.getElementById('ee-raw-override').checked = true;
            clearError();
            resetSandbox();
            alert('Handcrafted scripts compiled and bound to active unit!');
        } catch (err) {
            showError(`Script Syntax Error: ${err.message}`);
        }
    }

    function parseRawCode() {
        const updateStr = document.getElementById('ee-raw-update').value;
        const drawStr = document.getElementById('ee-raw-draw').value;

        const parsedUpdate = parseCodeToBlocks(updateStr, 'update');
        const parsedDraw = parseCodeToBlocks(drawStr, 'draw');

        if (parsedUpdate.length === 0 && parsedDraw.length === 0) {
            alert('Could not detect any recognizable Scratch block patterns in the current JS code.');
            return;
        }

        liveTuning.updateBlocks = parsedUpdate;
        liveTuning.drawBlocks = parsedDraw;
        liveTuning.useRawCodeOverride = false;
        document.getElementById('ee-raw-override').checked = false;

        renderBlockStacks();
        compileVisualBlocks();
        switchTab('blocks-update');
        alert(`Successfully parsed ${parsedUpdate.length} update block(s) and ${parsedDraw.length} draw block(s)!`);
    }

    function updateRawCodeDisplays() {
        const def = EnemyAPI.get(activeEnemyId);
        document.getElementById('ee-raw-init').value = liveTuning.rawInitCode || (def && def.onSpawn ? def.onSpawn.toString() : 'function(self) {}');
        document.getElementById('ee-raw-update').value = liveTuning.rawUpdateCode || (def && def.onUpdate ? def.onUpdate.toString() : '');
        document.getElementById('ee-raw-draw').value = liveTuning.rawDrawCode || (def && def.onDraw ? def.onDraw.toString() : '');
    }

    function showError(msg) {
        const box = document.getElementById('ee-error-box');
        if (box) {
            box.innerText = msg;
            box.style.display = 'block';
        }
    }

    function clearError() {
        const box = document.getElementById('ee-error-box');
        if (box) {
            box.style.display = 'none';
            box.innerText = '';
        }
    }

    function markDirty() {
        const def = EnemyAPI.get(activeEnemyId);
        if (def) {
            def.name = liveTuning.name;
            def.color = liveTuning.color;
            def.radius = liveTuning.radius;
            def.hp = liveTuning.hp;
            def.bodyShape = liveTuning.bodyShape;
            def.xpReward = liveTuning.xpReward;
            def.scoreValue = liveTuning.scoreValue;
            def.isBoss = liveTuning.isBoss;
        }
        if (simInstance) {
            simInstance.r = liveTuning.radius;
            simInstance.color = liveTuning.color;
            simInstance.maxHp = liveTuning.hp;
            simInstance.hp = Math.min(simInstance.hp, liveTuning.hp);
        }
    }

    function onNameInput(val) { liveTuning.name = val; markDirty(); }
    function onShapeInput(val) { liveTuning.bodyShape = val; markDirty(); }
    function onRadiusInput(val) { liveTuning.radius = parseInt(val) || 20; markDirty(); }
    function onHpInput(val) { liveTuning.hp = parseInt(val) || 100; markDirty(); }
    function onColorInput(val) { liveTuning.color = val; markDirty(); }
    function onXpInput(val) { liveTuning.xpReward = parseInt(val) || 0; }
    function onScoreInput(val) { liveTuning.scoreValue = parseInt(val) || 0; }
    function onBossInput(val) { liveTuning.isBoss = val; markDirty(); }
    function onRawOverrideToggle(val) { liveTuning.useRawCodeOverride = val; markDirty(); }

    function onTargetConfigChange(prop, val) {
        simPlayer[prop] = val;
        if (prop === 'maxHp') {
            simPlayer.hp = Math.min(simPlayer.hp, val);
        }
    }

    // ── TARGET DRONE SIMULATION & KINEMATICS ENGINE ──
    function updateTargetDrone() {
        if (simPlayer.dead) {
            simPlayer.respawnTimer--;
            simPlayer.reconstituteProgress = 1.0 - (simPlayer.respawnTimer / simPlayer.maxRespawnDelay);

            if (simPlayer.respawnTimer % 3 === 0) {
                const a = Math.random() * Math.PI * 2;
                const dist = Math.random() * 55 + 15;
                simParticles.push({
                    x: simPlayer.baseX + Math.cos(a) * dist,
                    y: simPlayer.baseY + Math.sin(a) * dist,
                    vx: -Math.cos(a) * 2.5,
                    vy: -Math.sin(a) * 2.5,
                    life: 18,
                    maxLife: 18,
                    color: '#00d2d3',
                    type: 'spark'
                });
            }

            if (simPlayer.respawnTimer <= 0) {
                reconstituteTarget();
            }
            return;
        }

        const spd = simPlayer.moveSpeed;
        if (simPlayer.moveMode === 'figure8') {
            simPlayer.orbitAngle += spd * 0.035;
            simPlayer.x = simPlayer.baseX + Math.sin(simPlayer.orbitAngle) * simPlayer.patrolRange;
            simPlayer.y = simPlayer.baseY + Math.sin(simPlayer.orbitAngle * 2) * (simPlayer.patrolRange * 0.45);
        } else if (simPlayer.moveMode === 'patrol_h') {
            simPlayer.x += simPlayer.patrolDir * spd * 2.2;
            if (Math.abs(simPlayer.x - simPlayer.baseX) > simPlayer.patrolRange) {
                simPlayer.patrolDir *= -1;
            }
            simPlayer.y += (simPlayer.baseY - simPlayer.y) * 0.05;
        } else if (simPlayer.moveMode === 'patrol_v') {
            simPlayer.y += simPlayer.patrolDir * spd * 2.2;
            if (Math.abs(simPlayer.y - simPlayer.baseY) > simPlayer.patrolRange) {
                simPlayer.patrolDir *= -1;
            }
            simPlayer.x += (simPlayer.baseX - simPlayer.x) * 0.05;
        } else if (simPlayer.moveMode === 'orbit') {
            simPlayer.orbitAngle += spd * 0.04;
            simPlayer.x = simPlayer.baseX + Math.cos(simPlayer.orbitAngle) * simPlayer.patrolRange;
            simPlayer.y = simPlayer.baseY + Math.sin(simPlayer.orbitAngle) * (simPlayer.patrolRange * 0.75);
        } else if (simPlayer.moveMode === 'evasive') {
            let dodgeX = 0;
            let dodgeY = 0;
            for (let i = 0; i < simBullets.length; i++) {
                const b = simBullets[i];
                if (!b.pShot) {
                    const d = Math.hypot(b.x - simPlayer.x, b.y - simPlayer.y);
                    if (d < 200) {
                        const perpA = Math.atan2(b.vy, b.vx) + Math.PI / 2;
                        dodgeX += Math.cos(perpA) * (spd * 3.5);
                        dodgeY += Math.sin(perpA) * (spd * 3.5);
                    }
                }
            }
            simPlayer.x += dodgeX + (simPlayer.baseX - simPlayer.x) * 0.035;
            simPlayer.y += dodgeY + (simPlayer.baseY - simPlayer.y) * 0.035;
        } else if (simPlayer.moveMode === 'manual_wasd') {
            const manualSpd = Math.max(1.8, spd * 4.0);
            if (sandboxKeys['w']) simPlayer.y -= manualSpd;
            if (sandboxKeys['s']) simPlayer.y += manualSpd;
            if (sandboxKeys['a']) simPlayer.x -= manualSpd;
            if (sandboxKeys['d']) simPlayer.x += manualSpd;
        }

        simPlayer.x = Math.max(-500, Math.min(500, simPlayer.x));
        simPlayer.y = Math.max(-370, Math.min(370, simPlayer.y));

        if (simPlayer.fireBack && simInstance && !simInstance.dead) {
            const aim = Math.atan2(simInstance.y - simPlayer.y, simInstance.x - simPlayer.x);
            simPlayer.headingAngle = aim;

            if (simPlayer.reload <= 0) {
                if (simPlayer.weaponType === 'scatter') {
                    for (let s = -1; s <= 1; s += 2) {
                        simBullets.push({
                            x: simPlayer.x + Math.cos(aim) * (simPlayer.r * 1.2),
                            y: simPlayer.y + Math.sin(aim) * (simPlayer.r * 1.2),
                            vx: Math.cos(aim + s * 0.14) * simPlayer.bulletSpd,
                            vy: Math.sin(aim + s * 0.14) * simPlayer.bulletSpd,
                            dmg: Math.round(simPlayer.bulletDmg * 0.65),
                            r: simPlayer.bulletSize,
                            life: 75,
                            color: '#00d2d3',
                            pShot: true
                        });
                    }
                } else {
                    simBullets.push({
                        x: simPlayer.x + Math.cos(aim) * (simPlayer.r * 1.3),
                        y: simPlayer.y + Math.sin(aim) * (simPlayer.r * 1.3),
                        vx: Math.cos(aim) * simPlayer.bulletSpd,
                        vy: Math.sin(aim) * simPlayer.bulletSpd,
                        dmg: simPlayer.bulletDmg,
                        r: simPlayer.bulletSize,
                        life: 85,
                        color: '#00d2d3',
                        pShot: true
                    });
                }
                simPlayer.reload = simPlayer.fireRate;
            }
        }
        if (simPlayer.reload > 0) simPlayer.reload--;
    }

    function reconstituteTarget() {
        simPlayer.dead = false;
        simPlayer.hp = simPlayer.maxHp;
        simPlayer.respawnTimer = 0;
        simPlayer.reconstituteProgress = 0;
        simPlayer.x = simPlayer.baseX;
        simPlayer.y = simPlayer.baseY;
        sandboxGameCtx.spawnParticles(simPlayer.x, simPlayer.y, '#00ff88', 22, 'spark');
        sandboxGameCtx.spawnText(simPlayer.x, simPlayer.y - 35, 'DRONE RECONSTITUTED', '#00ff88');
    }

    function resetSandbox() {
        simTimer = 0;
        simBullets = [];
        simParticles = [];
        simTexts = [];
        sandboxGameCtx.enemies.length = 0; // Clear persistent enemy list
        simPlayer.x = 320;
        simPlayer.y = 0;
        simPlayer.baseX = 320;
        simPlayer.baseY = 0;
        simPlayer.hp = simPlayer.maxHp;
        simPlayer.dead = false;
        simPlayer.respawnTimer = 0;

        if (typeof EnemyAPI !== 'undefined') {
            simInstance = EnemyAPI.spawn(activeEnemyId, -220, 0, sandboxGameCtx);
            if (simInstance) {
                simInstance.hp = liveTuning.hp;
                simInstance.maxHp = liveTuning.hp;
                simInstance.r = liveTuning.radius;
                simInstance.color = liveTuning.color;
                sandboxGameCtx.enemies.push(simInstance);
            }
        }
    }

    // ── FIXED 60HZ TIMESTEP SIMULATION LOOP ──
    function startSandboxLoop() {
        function tick(currentTime = 0) {
            if (overlay.style.display !== 'flex') return;

            if (!lastSimTime) lastSimTime = currentTime;
            let delta = currentTime - lastSimTime;
            if (delta > 100) delta = 100;
            lastSimTime = currentTime;

            if (!simPaused) {
                simAccumulator += delta * simSpeed;
                while (simAccumulator >= SIM_TICK_MS) {
                    simStep();
                    simAccumulator -= SIM_TICK_MS;
                }
            } else {
                simAccumulator = 0;
            }

            drawSandbox();
            updateTelemetry();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function simStep() {
        simTimer++;

        updateTargetDrone();

        // Update all active units in sandboxGameCtx.enemies (Unit + spawned Swarm Drones)
        for (let i = sandboxGameCtx.enemies.length - 1; i >= 0; i--) {
            const ent = sandboxGameCtx.enemies[i];
            if (!ent.dead) {
                try {
                    ent.update();
                } catch (err) {
                    showError(`Behavior Runtime Error: ${err.message}`);
                }
            } else {
                if (ent !== simInstance) {
                    sandboxGameCtx.enemies.splice(i, 1);
                }
            }
        }

        if (simInstance && simInstance.dead && simTimer % 120 === 0) {
            resetSandbox();
        }

        // Projectiles
        for (let i = simBullets.length - 1; i >= 0; i--) {
            const b = simBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;

            if (b.pShot) {
                for (let target of sandboxGameCtx.enemies) {
                    if (!target.dead) {
                        const dist = Math.hypot(b.x - target.x, b.y - target.y);
                        if (dist < target.r + (b.r || 4)) {
                            target.takeDmg(b.dmg);
                            sandboxGameCtx.spawnParticles(b.x, b.y, '#00d2d3', 6, 'spark');
                            sandboxGameCtx.spawnText(b.x, b.y - 15, `-${b.dmg}`, '#00d2d3');
                            b.life = 0;
                            break;
                        }
                    }
                }
            } else {
                if (!simPlayer.dead) {
                    const dist = Math.hypot(b.x - simPlayer.x, b.y - simPlayer.y);
                    if (dist < simPlayer.r + (b.r || 4)) {
                        if (!simPlayer.invulnerable) {
                            simPlayer.hp = Math.max(0, simPlayer.hp - (b.dmg || 10));
                            if (simPlayer.hp <= 0) {
                                simPlayer.dead = true;
                                simPlayer.respawnTimer = simPlayer.maxRespawnDelay;
                                sandboxGameCtx.spawnParticles(simPlayer.x, simPlayer.y, '#ff4757', 24, 'explosion');
                                sandboxGameCtx.spawnText(simPlayer.x, simPlayer.y - 30, 'TARGET DESTROYED', '#ff4757');
                            }
                        }
                        sandboxGameCtx.spawnParticles(b.x, b.y, b.color || '#ff4757', 6, 'spark');
                        sandboxGameCtx.spawnText(b.x, b.y - 15, `-${b.dmg || 10}`, '#ff4757');
                        b.life = 0;
                    }
                }
            }

            if (b.life <= 0) simBullets.splice(i, 1);
        }

        for (let i = simParticles.length - 1; i >= 0; i--) {
            const p = simParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) simParticles.splice(i, 1);
        }

        for (let i = simTexts.length - 1; i >= 0; i--) {
            const t = simTexts[i];
            t.y -= 0.6;
            t.life--;
            if (t.life <= 0) simTexts.splice(i, 1);
        }
    }

    function drawSandbox() {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w / 2 + panX, h / 2 + panY);
        ctx.scale(zoom, zoom);

        // Expanded Grid
        ctx.strokeStyle = '#172233';
        ctx.lineWidth = 1 / zoom;
        for (let x = -1000; x <= 1000; x += 40) { ctx.moveTo(x, -1000); ctx.lineTo(x, 1000); }
        for (let y = -1000; y <= 1000; y += 40) { ctx.moveTo(-1000, y); ctx.lineTo(1000, y); }
        ctx.stroke();

        // Arena Boundaries
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.5 / zoom;
        ctx.strokeRect(-520, -390, 1040, 780);

        if (simPlayer.moveMode === 'patrol_h') {
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(simPlayer.baseX - simPlayer.patrolRange, simPlayer.baseY);
            ctx.lineTo(simPlayer.baseX + simPlayer.patrolRange, simPlayer.baseY);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (simPlayer.moveMode === 'patrol_v') {
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(simPlayer.baseX, simPlayer.baseY - simPlayer.patrolRange);
            ctx.lineTo(simPlayer.baseX, simPlayer.baseY + simPlayer.patrolRange);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (simPlayer.moveMode === 'orbit') {
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.18)';
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(simPlayer.baseX, simPlayer.baseY, simPlayer.patrolRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (simPlayer.moveMode === 'figure8') {
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.18)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            for (let t = 0; t <= Math.PI * 2; t += 0.1) {
                const gx = simPlayer.baseX + Math.sin(t) * simPlayer.patrolRange;
                const gy = simPlayer.baseY + Math.sin(t * 2) * (simPlayer.patrolRange * 0.45);
                if (t === 0) ctx.moveTo(gx, gy);
                else ctx.lineTo(gx, gy);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        simBullets.forEach(b => {
            ctx.fillStyle = b.color || '#ff4757';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r || 5, 0, Math.PI * 2);
            ctx.fill();
        });

        simParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        simTexts.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.font = 'bold 12px Ubuntu';
            ctx.textAlign = 'center';
            ctx.globalAlpha = t.life / t.maxLife;
            ctx.fillText(t.str, t.x, t.y);
            ctx.globalAlpha = 1.0;
        });

        // Target drone render
        if (simPlayer.dead) {
            const p = 0.5 + 0.5 * Math.sin(Date.now() * 0.012);
            ctx.save();
            ctx.translate(simPlayer.baseX, simPlayer.baseY);

            ctx.strokeStyle = `rgba(0, 210, 211, ${0.4 + 0.5 * p})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, simPlayer.r + 8 + p * 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.arc(0, 0, simPlayer.r + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * simPlayer.reconstituteProgress));
            ctx.stroke();

            ctx.fillStyle = 'rgba(0, 210, 211, 0.14)';
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, simPlayer.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00d2d3';
            ctx.font = 'bold 10px Ubuntu';
            ctx.textAlign = 'center';
            const secsLeft = (simPlayer.respawnTimer / 60).toFixed(1);
            ctx.fillText(`RECONSTITUTING (${secsLeft}s)`, 0, -simPlayer.r - 18);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(simPlayer.x, simPlayer.y);
            ctx.rotate(simPlayer.headingAngle);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, -3.5, simPlayer.r * 1.45, 7);

            ctx.fillStyle = simPlayer.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5 / zoom;
            ctx.beginPath();
            ctx.arc(0, 0, simPlayer.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.beginPath();
            ctx.arc(-simPlayer.r * 0.25, -simPlayer.r * 0.25, simPlayer.r * 0.65, 0, Math.PI * 2);
            ctx.fill();

            if (simPlayer.invulnerable) {
                ctx.strokeStyle = 'rgba(0, 255, 230, 0.85)';
                ctx.lineWidth = 3.0;
                ctx.beginPath();
                ctx.arc(0, 0, simPlayer.r + 6, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.fillStyle = '#090e17';
            ctx.font = 'bold 9px Ubuntu';
            ctx.textAlign = 'center';
            ctx.fillText('TARGET', 0, 3);
            ctx.restore();

            ctx.save();
            ctx.translate(simPlayer.x, simPlayer.y);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-22, simPlayer.r + 8, 44, 5);
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(-22, simPlayer.r + 8, 44 * Math.max(0, simPlayer.hp / simPlayer.maxHp), 5);
            ctx.restore();
        }

        // Draw all active enemies in sandbox (Unit + native spawned Swarm Drones)
        for (let i = 0; i < sandboxGameCtx.enemies.length; i++) {
            const ent = sandboxGameCtx.enemies[i];
            if (!ent.dead) {
                try {
                    ent.draw(ctx);
                } catch (err) {
                    showError(`Render Pipeline Error: ${err.message}`);
                }
            }
        }

        ctx.restore();
    }

    function updateTelemetry() {
        const d = simInstance ? Math.hypot(simPlayer.x - simInstance.x, simPlayer.y - simInstance.y) : 0;
        const deg = simInstance ? Math.round(simInstance.angle * (180 / Math.PI)) : 0;

        document.getElementById('tel-unit').innerText = activeEnemyId.toUpperCase();
        document.getElementById('tel-dist').innerText = `${Math.round(d)} px`;
        document.getElementById('tel-angle').innerText = `${deg}°`;
        if (simInstance) {
            document.getElementById('tel-hp').innerText = `${Math.ceil(simInstance.hp)} / ${simInstance.maxHp}`;
        }
        const tgtStatusEl = document.getElementById('tel-target-status');
        if (tgtStatusEl) {
            if (simPlayer.dead) {
                tgtStatusEl.innerText = `RESPAWNING (${(simPlayer.respawnTimer / 60).toFixed(1)}s)`;
                tgtStatusEl.style.color = '#ffd700';
            } else {
                tgtStatusEl.innerText = `ACTIVE (${simPlayer.moveMode.toUpperCase()})`;
                tgtStatusEl.style.color = '#2ed573';
            }
        }
    }

    function adjustZoom(delta) {
        zoom = Math.max(0.35, Math.min(3.0, zoom + delta));
    }

    function resetView() {
        zoom = 1.0;
        panX = 0;
        panY = 0;
    }

    function togglePause() {
        simPaused = !simPaused;
        document.getElementById('btn-sim-pause').innerText = simPaused ? 'Resume' : 'Pause';
    }

    function toggleSpeed() {
        if (simSpeed === 1.0) simSpeed = 1.5;
        else if (simSpeed === 1.5) simSpeed = 0.5;
        else simSpeed = 1.0;
        document.getElementById('lbl-sim-spd').innerText = `${simSpeed.toFixed(1)}x`;
    }

    function saveAndApply() {
        const def = EnemyAPI.get(activeEnemyId);
        if (!def) return;

        def.name = liveTuning.name;
        def.color = liveTuning.color;
        def.radius = liveTuning.radius;
        def.hp = liveTuning.hp;
        def.bodyShape = liveTuning.bodyShape;
        def.xpReward = liveTuning.xpReward;
        def.scoreValue = liveTuning.scoreValue;
        def.isBoss = liveTuning.isBoss;

        if (liveTuning.useRawCodeOverride) {
            compileRawScript();
        } else {
            compileVisualBlocks();
        }

        if (typeof ENEMY_DATABASE !== 'undefined') {
            const entry = ENEMY_DATABASE.find(e => e.id === activeEnemyId);
            if (entry) {
                entry.name = liveTuning.name;
                entry.threat = liveTuning.isBoss ? 'boss' : (liveTuning.hp > 250 ? 'high' : 'med');
                entry.chassisClass = `${liveTuning.bodyShape.toUpperCase()} (R${liveTuning.radius})`;
            }
        }

        saveCustomEnemiesToStorage();
        alert(`[EnemyAPI] Unit "${activeEnemyId}" successfully tuned, compiled, and saved!`);
    }

    function saveCustomEnemiesToStorage() {
        const customDefs = {};
        EnemyAPI.list().forEach(id => {
            const def = EnemyAPI.get(id);
            if (def && def._scratchData && (def._scratchData.useRawCodeOverride || def._scratchData.updateBlocks.length > 0 || def._scratchData.drawBlocks.length > 0)) {
                customDefs[id] = {
                    def: {
                        id: def.id,
                        name: def.name,
                        color: def.color,
                        radius: def.radius,
                        hp: def.hp,
                        bodyShape: def.bodyShape,
                        xpReward: def.xpReward,
                        scoreValue: def.scoreValue,
                        isBoss: def.isBoss
                    },
                    scratchData: def._scratchData
                };
            }
        });
        localStorage.setItem('polytank_custom_enemies', JSON.stringify(customDefs));
    }

    function loadCustomEnemiesFromStorage() {
        const dataStr = localStorage.getItem('polytank_custom_enemies');
        if (!dataStr) return;
        try {
            const customDefs = JSON.parse(dataStr);
            for (const id in customDefs) {
                const item = customDefs[id];

                // Core campaign units (Hive, Rammer, etc.) must NEVER be overwritten by empty storage stubs!
                if (coreIds.includes(id)) {
                    const liveDef = EnemyAPI.get(id);
                    const orig = originalDefCache.get(id);
                    if (liveDef && orig) {
                        // Restore pristine functions directly from scripts/enemies/*.js
                        liveDef.onDraw = orig.onDraw;
                        liveDef.onUpdate = orig.onUpdate;
                        liveDef.onSpawn = orig.onSpawn;
                        liveDef.onDie = orig.onDie;
                    }
                    continue;
                }

                const registered = EnemyAPI.register(item.def);
                if (registered) {
                    registered._scratchData = item.scratchData;
                }
            }
        } catch (e) {
            console.warn('[EnemyEditor] Failed to load custom enemies from storage:', e);
        }
    }

    function resetToFactoryDefaults() {
        const original = originalDefCache.get(activeEnemyId);
        if (!original) {
            alert(`No factory defaults recorded for "${activeEnemyId}".`);
            return;
        }

        if (!confirm(`Restore "${activeEnemyId}" back to original native code & graphics?`)) return;

        const def = EnemyAPI.get(activeEnemyId);
        if (def) {
            def.name = original.name;
            def.color = original.color;
            def.radius = original.radius;
            def.hp = original.hp;
            def.bodyShape = original.bodyShape;
            def.xpReward = original.xpReward;
            def.scoreValue = original.scoreValue;
            def.isBoss = original.isBoss;
            def.onUpdate = original.onUpdate;
            def.onDraw = original.onDraw;
            def.onSpawn = original.onSpawn;
            def.onDie = original.onDie;
            delete def._scratchData;
        }

        const dataStr = localStorage.getItem('polytank_custom_enemies');
        if (dataStr) {
            try {
                const customDefs = JSON.parse(dataStr);
                delete customDefs[activeEnemyId];
                localStorage.setItem('polytank_custom_enemies', JSON.stringify(customDefs));
            } catch (e) {}
        }

        selectUnit(activeEnemyId);
        alert(`[EnemyAPI] "${activeEnemyId}" restored to factory specifications!`);
    }

    function createNewUnit() {
        const newId = prompt('Enter identifier for the new unit (e.g. "phantom_striker"):');
        if (!newId) return;
        const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!cleanId) return;

        if (EnemyAPI.get(cleanId)) {
            alert(`Unit ID "${cleanId}" already exists!`);
            return;
        }

        const newDef = {
            id: cleanId,
            name: cleanId.replace(/_/g, ' ').toUpperCase(),
            color: '#00d2d3',
            radius: 22,
            hp: 120,
            xpReward: 35,
            scoreValue: 25,
            bodyShape: 'circle',
            isBoss: false
        };

        EnemyAPI.register(newDef);
        saveCustomEnemiesToStorage();
        populateUnitDropdown();
        selectUnit(cleanId);
    }

    function cloneCurrentUnit() {
        const newId = prompt(`Clone "${activeEnemyId}" into new identifier:`, `${activeEnemyId}_variant`);
        if (!newId) return;
        const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!cleanId) return;

        const currentDef = EnemyAPI.get(activeEnemyId);
        if (!currentDef) return;

        const clonedDef = Object.assign({}, currentDef, {
            id: cleanId,
            name: `${liveTuning.name} (Copy)`
        });

        EnemyAPI.register(clonedDef);
        saveCustomEnemiesToStorage();
        populateUnitDropdown();
        selectUnit(cleanId);
    }

    function deleteCurrentUnit() {
        if (coreIds.includes(activeEnemyId)) {
            alert(`"${activeEnemyId}" is an essential campaign unit and cannot be deleted.`);
            return;
        }

        if (!confirm(`Delete unit "${activeEnemyId}" from registry?`)) return;

        EnemyAPI.remove(activeEnemyId);
        saveCustomEnemiesToStorage();
        populateUnitDropdown();
        selectUnit(EnemyAPI.list()[0] || 'basic');
    }

    function updateUnitId(newIdVal) {
        const cleanId = newIdVal.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!cleanId || cleanId === activeEnemyId) return;

        if (EnemyAPI.get(cleanId)) {
            alert(`Unit ID "${cleanId}" is already taken!`);
            document.getElementById('ee-id').value = activeEnemyId;
            return;
        }

        const oldDef = EnemyAPI.get(activeEnemyId);
        if (oldDef) {
            EnemyAPI.remove(activeEnemyId);
            oldDef.id = cleanId;
            EnemyAPI.register(oldDef);
            activeEnemyId = cleanId;
            saveCustomEnemiesToStorage();
            populateUnitDropdown();
            selectUnit(cleanId);
        }
    }

    // ── 3-TIER INLINE CLIPBOARD SYSTEM ──
    function safeCopyToClipboard(textToCopy) {
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).catch(() => {});
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (e) {
            copied = false;
        }
        return copied;
    }

    function exportUnitCode() {
        const def = EnemyAPI.get(activeEnemyId);
        if (!def) return;

        const initStr = def.onSpawn ? def.onSpawn.toString() : 'function(self) {}';
        const updateStr = def.onUpdate ? def.onUpdate.toString() : 'function() {}';
        const drawStr = def.onDraw ? def.onDraw.toString() : 'undefined';

        const code = `// Sector 7 Enemy Unit: ${activeEnemyId}\nEnemyAPI.register({\n    id: ${JSON.stringify(def.id)},\n    name: ${JSON.stringify(def.name)},\n    color: ${JSON.stringify(def.color)},\n    radius: ${def.radius},\n    hp: ${def.hp},\n    bodyShape: ${JSON.stringify(def.bodyShape)},\n    xpReward: ${def.xpReward},\n    scoreValue: ${def.scoreValue},\n    isBoss: ${def.isBoss},\n    onSpawn: ${initStr},\n    onUpdate: ${updateStr},\n    onDraw: ${drawStr}\n});\n`;

        const didCopy = safeCopyToClipboard(code);

        // Always display the modal with pre-selected code as infallible fallback
        const modal = document.getElementById('ee-export-modal');
        const txt = document.getElementById('ee-export-text');
        txt.value = code;
        modal.style.display = 'flex';
        txt.focus();
        txt.select();

        if (didCopy) {
            sandboxGameCtx.spawnText(simPlayer.x, simPlayer.y - 45, 'CODE COPIED TO CLIPBOARD', '#00ff88');
        }
    }

    function selectAndCopyModalText() {
        const txt = document.getElementById('ee-export-text');
        txt.focus();
        txt.select();
        try {
            document.execCommand('copy');
            alert('Code successfully copied to clipboard!');
        } catch (e) {
            alert('Press Ctrl+C to copy the highlighted code.');
        }
    }

    function spawnInLiveGame() {
        saveAndApply();
        close();
        if (typeof spawnEnemy === 'function' && typeof player !== 'undefined' && player) {
            spawnEnemy(activeEnemyId, player.x + 240, player.y);
            if (typeof spawnText === 'function') {
                spawnText(player.x + 240, player.y - 40, `SPAWNED ${activeEnemyId.toUpperCase()}`, '#00d2d3');
            }
        }
    }

    return {
        init,
        open,
        close,
        selectUnit,
        switchTab,
        markDirty,
        addBlock,
        removeBlock,
        moveBlock,
        duplicateBlock,
        updateBlockParam,
        compileVisualBlocks,
        compileRawScript,
        parseRawCode,
        resetToFactoryDefaults,
        reconstituteTarget,
        createNewUnit,
        cloneCurrentUnit,
        deleteCurrentUnit,
        updateUnitId,
        saveAndApply,
        exportUnitCode,
        selectAndCopyModalText,
        spawnInLiveGame,
        resetSandbox,
        adjustZoom,
        resetView,
        togglePause,
        toggleSpeed,
        onNameInput,
        onShapeInput,
        onRadiusInput,
        onHpInput,
        onColorInput,
        onXpInput,
        onScoreInput,
        onBossInput,
        onRawOverrideToggle,
        onTargetConfigChange
    };
})();

// Safely initializes whether loaded before or after DOMContentLoaded
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => EnemyEditor.init());
} else {
    EnemyEditor.init();
}