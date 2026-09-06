/**
 * enemies/hive.js
 * Hexagonal Swarm Carrier with 6 drone bays (Rebalanced for fair pacing).
 */

EnemyAPI.register({
    id:         'hive',
    name:       'Hive Carrier',
    color:      '#d9a441',
    radius:     34,
    hp:         165, // Lowered from 200 for faster takedowns
    xpReward:   120,
    scoreValue: 75,
    bodyShape:  'hexagon',

    onSpawn(self) {
        self.reload = 300 + Math.random() * 60;
        self.state.spawnPulse = 0;
    },

    onUpdate(self, player, api) {
        const d = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;

        // Gentle kiting - easier for player to catch up
        if (d < 420) {
            self.vx -= Math.cos(aim) * 0.05;
            self.vy -= Math.sin(aim) * 0.05;
        } else if (d > 650) {
            self.vx += Math.cos(aim) * 0.06;
            self.vy += Math.sin(aim) * 0.06;
        }

        if (self.state.spawnPulse > 0) self.state.spawnPulse--;

        // Only spawns within reasonable combat range (850px instead of off-screen 1400px)
        if (self.reload <= 0 && d < 850) {
            let baseCount = 3 + Math.floor(Math.random() * 2); // Act 1: 3-4 drones

            if (api.state) {
                const currentLevel = (typeof LEVELS !== 'undefined' && LEVELS[api.state.level]) ? LEVELS[api.state.level] : null;
                const act = currentLevel ? (currentLevel.act || 1) : 1;
                if (act === 2) {
                    baseCount = 4 + Math.floor(Math.random() * 2); // Act 2: 4-5 drones
                } else if (act === 3) {
                    baseCount = 5 + Math.floor(Math.random() * 2); // Act 3: 5-6 drones
                }
            }

            for (let i = 0; i < baseCount; i++) {
                const a = (i / baseCount) * Math.PI * 2 + Math.random() * 0.3;
                const r = 38 + Math.random() * 24;
                const child = api.spawnEnemy('swarm_drone', self.x + Math.cos(a) * r, self.y + Math.sin(a) * r);
                if (child) {
                    // Gentler ejection speed so player can react
                    child.vx = Math.cos(a) * (1.6 + Math.random() * 1.5);
                    child.vy = Math.sin(a) * (1.6 + Math.random() * 1.5);
                }
            }

            api.particles(self.x, self.y, '#ffd34d', 18, 'spark');
            api.text(self.x, self.y - 52, `SWARM (${baseCount})`, '#ffd34d');
            self.state.spawnPulse = 24;
            // Longer breather cooldown (5.5 - 6.5s)
            self.reload = 330 + Math.random() * 70;
        }
    },

    onDraw(self, ctx) {
        const pulse = self.state.spawnPulse > 0 ? self.state.spawnPulse / 24 : 0;
        const r = self.r + pulse * 5;

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