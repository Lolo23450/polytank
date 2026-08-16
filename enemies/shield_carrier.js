/**
 * enemies/shield_carrier.js
 * ─────────────────────────────────────────────────────────────────────
 * Vanguard escort unit with a destructible frontal energy barrier.
 * Bodyguard AI: actively intercepts fire to protect nearby allies.
 * ─────────────────────────────────────────────────────────────────────
 */

EnemyAPI.register({
    id:         'shield_carrier',
    name:       'Shield Carrier',
    color:      '#4488ff',
    radius:     25,
    hp:         200,
    xpReward:   85,
    scoreValue: 70,
    bodyShape:  'circle',

    onSpawn(self) {
        self.state.shieldHp       = 200;
        self.state.maxShieldHp    = 200;
        self.state.shieldUp       = true;
        self.state.shieldCooldown = 0;
        self.state.shieldArc      = Math.PI * 0.45;
        self.reload               = 110;
    },

    onUpdate(self, player, api) {
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;

        // Shield Recharge Logic
        if (!self.state.shieldUp) {
            self.state.shieldCooldown--;
            if (self.state.shieldCooldown <= 0) {
                self.state.shieldUp = true;
                self.state.shieldHp = self.state.maxShieldHp;
                api.particles(self.x, self.y, '#00d2d3', 12, 'spark');
            }
        }

        // Bodyguard AI: Find closest non-shield ally to defend
        let defendTarget = null;
        let closestAllyDist = Infinity;
        if (api.state && gameCtx.enemies) {
            for (let e of gameCtx.enemies) {
                if (e !== self && !e.dead && e.type !== 'shield_carrier') {
                    const dAlly = Math.hypot(e.x - self.x, e.y - self.y);
                    if (dAlly < closestAllyDist) {
                        closestAllyDist = dAlly;
                        defendTarget = e;
                    }
                }
            }
        }

        if (defendTarget && closestAllyDist < 700) {
            // Position between player and ally
            const allyAim = Math.atan2(player.y - defendTarget.y, player.x - defendTarget.x);
            const targetX = defendTarget.x + Math.cos(allyAim) * 75;
            const targetY = defendTarget.y + Math.sin(allyAim) * 75;
            const moveAim = Math.atan2(targetY - self.y, targetX - self.x);
            self.vx += Math.cos(moveAim) * 0.16;
            self.vy += Math.sin(moveAim) * 0.16;
        } else {
            // Standard patrol positioning
            const d = Math.hypot(player.x - self.x, player.y - self.y);
            if (d < 350) {
                self.vx -= Math.cos(aim) * 0.1;
                self.vy -= Math.sin(aim) * 0.1;
            } else {
                self.vx += Math.cos(aim) * 0.12;
                self.vy += Math.sin(aim) * 0.12;
            }
        }

        // Bullet Interception on Frontal Shield
        if (self.state.shieldUp && gameCtx.bullets) {
            for (let b of gameCtx.bullets) {
                if (b.pShot && !b.dead) {
                    const dBullet = Math.hypot(b.x - self.x, b.y - self.y);
                    if (dBullet < self.r + 20) {
                        const hitAngle = Math.atan2(b.y - self.y, b.x - self.x);
                        let diff = hitAngle - self.angle;
                        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

                        if (Math.abs(diff) <= self.state.shieldArc) {
                            // Shield absorbs damage
                            b.dead = true;
                            self.state.shieldHp -= b.dmg;
                            api.particles(b.x, b.y, '#00d2d3', 4, 'spark');

                            if (self.state.shieldHp <= 0) {
                                self.state.shieldUp = false;
                                self.state.shieldCooldown = 180;
                                api.particles(self.x, self.y, '#00d2d3', 20, 'explosion');
                                api.text(self.x, self.y - 45, 'SHIELD BROKEN', '#ff4757');
                            }
                        }
                    }
                }
            }
        }

        if (self.reload <= 0) {
            api.shoot(self, aim, { speed: 6, damage: 14, size: 11, life: 130 });
            self.reload = 110;
        }
    },

    onDraw(self, ctx) {
        const r = self.r;

        // Frontal Energy Shield Arc (with live health indicator)
        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);

        if (self.state.shieldUp) {
            const shieldPct = Math.max(0.1, self.state.shieldHp / self.state.maxShieldHp);
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = shieldPct > 0.4 ? '#00d2d3' : '#ff9f43';
            ctx.beginPath();
            ctx.arc(0, 0, r + 14, -self.state.shieldArc, self.state.shieldArc);
            ctx.stroke();

            // Energy node brackets
            ctx.fillStyle = '#ffffff';
            const arcL = self.state.shieldArc;
            ctx.fillRect(Math.cos(-arcL) * (r + 14) - 3, Math.sin(-arcL) * (r + 14) - 3, 6, 6);
            ctx.fillRect(Math.cos( arcL) * (r + 14) - 3, Math.sin( arcL) * (r + 14) - 3, 6, 6);
            ctx.fillRect(r + 11, -3, 6, 6);
        } else {
            const frac = self.state.shieldCooldown / 180;
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(0, 210, 211, ${frac * 0.35})`;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, r + 14, -self.state.shieldArc, self.state.shieldArc);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1e3799';
        ctx.lineJoin = 'round';

        // Dual Emitter Horns on flanks
        ctx.fillStyle = '#0c2461';
        ctx.fillRect(r * 0.3, -r * 0.95, r * 0.65, r * 0.35);
        ctx.strokeRect(r * 0.3, -r * 0.95, r * 0.65, r * 0.35);
        ctx.fillRect(r * 0.3,  r * 0.60, r * 0.65, r * 0.35);
        ctx.strokeRect(r * 0.3,  r * 0.60, r * 0.65, r * 0.35);

        // Center Cannon Barrel
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(0, -r * 0.35, r * 2.1, r * 0.7);
        ctx.strokeRect(0, -r * 0.35, r * 2.1, r * 0.7);

        // Barrel Top Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, -r * 0.35, r * 2.1, r * 0.28);

        // Hull
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hull Bevel
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.2, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Core Shield Reactor
        ctx.fillStyle = '#0c2461';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = self.state.shieldUp ? '#00d2d3' : '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, '#4488ff', 15, 'explosion');
        api.particles(self.x, self.y, '#ffffff', 8,  'spark');
    },
});