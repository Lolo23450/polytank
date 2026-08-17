/**
 * enemies/hive.js
 * Hexagonal Swarm Carrier with 6 drone bays and dynamic endgame scaling.
 */

EnemyAPI.register({
    id:         'hive',
    name:       'Hive Carrier',
    color:      '#d9a441',
    radius:     34,
    hp:         200,
    xpReward:   120,
    scoreValue: 75,
    bodyShape:  'hexagon',

    onSpawn(self) {
        self.reload = 200 + Math.random() * 50;
        self.state.spawnPulse = 0;
    },

    onUpdate(self, player, api) {
        const d = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;

        if (d < 500) {
            self.vx -= Math.cos(aim) * 0.09;
            self.vy -= Math.sin(aim) * 0.09;
        } else {
            self.vx += Math.cos(aim) * 0.07;
            self.vy += Math.sin(aim) * 0.07;
        }

        if (self.state.spawnPulse > 0) self.state.spawnPulse--;

        if (self.reload <= 0 && d < 1400) {
            // Progressive endgame swarm scaling
            let baseCount = 6 + Math.floor(Math.random() * 3);
            if (api.state) {
                const currentLevel = (typeof LEVELS !== 'undefined' && LEVELS[api.state.level]) ? LEVELS[api.state.level] : null;
                const act = currentLevel ? (currentLevel.act || 1) : 1;
                if (act === 2) {
                    baseCount = 5 + Math.floor(Math.random() * 3); // Act 2: 10-13 drones
                } else if (act === 3) {
                    baseCount = 7 + Math.floor(Math.random() * 4); // Act 3: 14-18 drones
                }
            }

            for (let i = 0; i < baseCount; i++) {
                const a = (i / baseCount) * Math.PI * 2 + Math.random() * 0.35;
                const r = 44 + Math.random() * 36;
                const child = api.spawnEnemy('swarm_drone', self.x + Math.cos(a) * r, self.y + Math.sin(a) * r);
                if (child) {
                    child.vx = Math.cos(a) * (2.4 + Math.random() * 2.5);
                    child.vy = Math.sin(a) * (2.4 + Math.random() * 2.5);
                }
            }

            api.particles(self.x, self.y, '#ffd34d', 26, 'spark');
            api.text(self.x, self.y - 52, `SWARM (${baseCount})`, '#ffd34d');
            self.state.spawnPulse = 24;
            self.reload = 190 + Math.random() * 80;
        }
    },

    onDraw(self, ctx) {
        const pulse = self.state.spawnPulse > 0 ? self.state.spawnPulse / 24 : 0;
        const r = self.r + pulse * 6;

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#3e2712';
        ctx.lineJoin = 'round';

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.lineTo(r * Math.cos(a) + 3, r * Math.sin(a) + 4);
        }
        ctx.closePath();
        ctx.fill();

        // Main Hexagon Carapace
        ctx.fillStyle = self.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top Carapace Highlight Facet
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.moveTo(r * Math.cos(0), r * Math.sin(0));
        ctx.lineTo(r * Math.cos(Math.PI / 3), r * Math.sin(Math.PI / 3));
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // 6 Outer Honeycomb Drone Launch Silos
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const sx = Math.cos(a) * self.r * 0.62;
            const sy = Math.sin(a) * self.r * 0.62;

            ctx.fillStyle = '#2c1806';
            ctx.beginPath();
            ctx.arc(sx, sy, self.r * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Amber Silo Indicator Ring
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(sx, sy, self.r * 0.09, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center Queen Breeder Core
        ctx.fillStyle = '#3e2712';
        ctx.beginPath();
        ctx.arc(0, 0, self.r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pulse > 0 ? '#ffffff' : '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, self.r * 0.24 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, '#ffd34d', 20, 'explosion');
        api.particles(self.x, self.y, self.color, 12, 'debris');
    },
});