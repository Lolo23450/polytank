/**
 * enemies/sniper.js
 * ─────────────────────────────────────────────────────────────────────
 * Precision marksman unit with telegraph pause.
 * Removed sightline laser; retreat speed tuned down for fair counter-play.
 * ─────────────────────────────────────────────────────────────────────
 */

EnemyAPI.register({
    id:         'sniper',
    name:       'Sniper Unit',
    color:      '#ff4500',
    radius:     20,
    hp:         100,
    xpReward:   60,
    scoreValue: 50,
    bodyShape:  'circle',

    onSpawn(self) {
        self.state.aimLock  = false;
        self.state.aimTimer = 0;
        self.reload         = 170;
    },

    onUpdate(self, player, api) {
        const d   = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);

        const preferred = 600;
        if (d < preferred - 80) {
            // Slower, tuned-down retreat speed
            self.vx -= Math.cos(aim) * 0.07;
            self.vy -= Math.sin(aim) * 0.07;
        } else if (d > preferred + 200) {
            self.vx += Math.cos(aim) * 0.09;
            self.vy += Math.sin(aim) * 0.09;
        }

        if (self.state.aimLock) {
            self.angle = aim;
            self.state.aimTimer--;
            if (self.state.aimTimer <= 0) {
                api.shoot(self, self.angle, { speed: 9.8, damage: 18, size: 8, life: 160 });
                self.state.aimLock = false;
                self.reload        = 210;
            }
        } else {
            const diff = aim - self.angle;
            self.angle += diff * 0.06;

            if (self.reload <= 0) {
                self.state.aimLock  = true;
                self.state.aimTimer = 25; // Brief telegraph pause
            }
        }
    },

    onDraw(self, ctx) {
        const r = self.r;

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2f3542';
        ctx.lineJoin = 'round';

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(2, 3, r, 0, Math.PI * 2);
        ctx.fill();

        // Long Precision Barrel
        ctx.fillStyle = '#747d8c';
        ctx.fillRect(0, -r * 0.22, r * 3.3, r * 0.44);
        ctx.strokeRect(0, -r * 0.22, r * 3.3, r * 0.44);

        // Barrel Top Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, -r * 0.22, r * 3.3, r * 0.18);

        // Dual Stabilizer Struts
        ctx.fillStyle = '#57606f';
        ctx.fillRect(r * 1.0, -r * 0.36, r * 1.2, r * 0.72);
        ctx.strokeRect(r * 1.0, -r * 0.36, r * 1.2, r * 0.72);

        // Muzzle Brake
        ctx.fillStyle = '#2f3542';
        ctx.fillRect(r * 3.0, -r * 0.32, r * 0.35, r * 0.64);
        ctx.strokeRect(r * 3.0, -r * 0.32, r * 0.35, r * 0.64);

        // Main Hull
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hull Top Highlight Bevel
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.2, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Sniper Optic Housing
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cyan Optical Lens with Glint
        ctx.fillStyle = '#00d2d3';
        ctx.beginPath();
        ctx.arc(r * 0.08, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.04, -r * 0.08, r * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
});