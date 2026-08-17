/**
 * enemies/boss_final.js
 * ACT 3 FINAL BOSS — The Destroyer
 * Armored square fortress with 4/8 heavy naval blast mantlets and Citadel Rage Core.
 */

EnemyAPI.register({
    id:         'final',
    name:       'The Destroyer',
    color:      '#ff8800',
    radius:     60,
    hp:         5000,
    xpReward:   800,
    scoreValue: 500,
    bodyShape:  'square',
    isBoss:     true,

    onSpawn(self) {
        self.reload           = 35;
        self.state.bulletCount = 0;
        self.state.enraged    = false;
        self.state.phase      = 1;
    },

    onUpdate(self, player, api) {
        const enraged = self.hp <= self.maxHp * 0.5;

        if (enraged && !self.state.enraged) {
            self.state.enraged = true;
            self.state.phase   = 2;
            self.color         = '#ff3300';
            api.text(self.x, self.y - 80, 'PHASE 2: OVERDRIVE', '#ff3300');
            api.particles(self.x, self.y, '#ff3300', 30, 'explosion');
        }

        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        const rotRate = enraged ? 0.025 : 0.012;
        const diff = aim - self.angle;
        self.angle += Math.atan2(Math.sin(diff), Math.cos(diff)) * rotRate;

        self.vx += Math.cos(aim) * (enraged ? 0.1 : 0.05);
        self.vy += Math.sin(aim) * (enraged ? 0.1 : 0.05);

        if (self.reload <= 0) {
            const cannons = enraged ? 8 : 4;
            for (let i = 0; i < cannons; i++) {
                const a = self.angle + (Math.PI * 2 / cannons) * i;
                api.shoot(self, a, {
                    speed:  enraged ? 6 : 5,
                    damage: 30,
                    size:   20,
                    life:   220,
                });
            }

            self.state.bulletCount++;

            if (self.state.bulletCount % 16 === 0) {
                for (let i = 0; i < 2; i++) {
                    const angle  = i === 0 ? 0 : Math.PI;
                    const spawnX = self.x + Math.cos(angle) * (self.r + 80);
                    const spawnY = self.y + Math.sin(angle) * (self.r + 80);
                    api.spawnEnemy('rammer', spawnX, spawnY);
                }
            }

            self.reload = enraged ? 22 : 35;
        }
    },

    onDraw(self, ctx) {
        const r = self.r;
        const enraged = self.state.enraged;
        const cannons = enraged ? 8 : 4;

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2d1400';
        ctx.lineJoin = 'round';

        // Heavy Multi-barrel Array
        for (let i = 0; i < cannons; i++) {
            ctx.save();
            ctx.rotate(((Math.PI * 2) / cannons) * i);

            // Cannon Barrel
            ctx.fillStyle = '#4b3832';
            ctx.fillRect(0, -r * 0.32, r * 1.85, r * 0.64);
            ctx.strokeRect(0, -r * 0.32, r * 1.85, r * 0.64);

            // Barrel Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(0, -r * 0.32, r * 1.85, r * 0.25);

            // Muzzle Blast Ring
            ctx.fillStyle = '#1e0d00';
            ctx.fillRect(r * 1.55, -r * 0.4, r * 0.35, r * 0.8);
            ctx.strokeRect(r * 1.55, -r * 0.4, r * 0.35, r * 0.8);

            ctx.restore();
        }

        // Heavy Square Citadel Hull
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.rect(-r, -r, r * 2, r * 2);
        ctx.fill();
        ctx.stroke();

        // Hull Top Highlight Bevel
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.moveTo(-r, -r);
        ctx.lineTo(r, -r);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // 4 Armored Corner Bastions
        ctx.fillStyle = '#2d1400';
        const cr = r * 0.35;
        ctx.fillRect(-r, -r, cr, cr);
        ctx.strokeRect(-r, -r, cr, cr);
        ctx.fillRect(r - cr, -r, cr, cr);
        ctx.strokeRect(r - cr, -r, cr, cr);
        ctx.fillRect(-r, r - cr, cr, cr);
        ctx.strokeRect(-r, r - cr, cr, cr);
        ctx.fillRect(r - cr, r - cr, cr, cr);
        ctx.strokeRect(r - cr, r - cr, cr, cr);

        // Center Command Reactor Hub
        ctx.fillStyle = '#1e0d00';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = enraged ? '#ff3838' : '#ff9f1a';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.08, -r * 0.08, r * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Enraged Warning Ring
        if (enraged) {
            ctx.strokeStyle = '#ff3838';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();

        // Boss HP Bar
        ctx.save();
        ctx.translate(self.x, self.y - self.r - 24);
        ctx.fillStyle = '#1e0d00';
        ctx.fillRect(-62, 0, 124, 12);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.strokeRect(-62, 0, 124, 12);

        const pct = Math.max(0, self.hp / self.maxHp);
        ctx.fillStyle = enraged ? '#ff3838' : '#ff9f1a';
        ctx.fillRect(-59, 2, 118 * pct, 8);
        ctx.restore();
    },

    onDie(self, api) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                api.particles(
                    self.x + (Math.random() - 0.5) * 120,
                    self.y + (Math.random() - 0.5) * 120,
                    '#ff8800', 25, 'explosion'
                );
            }, i * 150);
        }
    },
});