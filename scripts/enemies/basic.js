/**
 * enemies/basic.js
 * Standard Patrol Unit with layered hull, mantlet, and crisp split-barrel graphics.
 */

EnemyAPI.register({
    id:         'basic',
    name:       'Patrol Unit',
    color:      '#f14e54',
    radius:     22,
    hp:         90,
    xpReward:   30,
    scoreValue: 20,
    bodyShape:  'circle',

    onUpdate(self, player, api) {
        const d   = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;

        if (d > 500) { self.vx += Math.cos(aim) * 0.1;  self.vy += Math.sin(aim) * 0.1; }
        else         { self.vx -= Math.cos(aim) * 0.05; self.vy -= Math.sin(aim) * 0.05; }

        const s = Math.hypot(self.vx, self.vy);
        if (s > 0.8) { self.vx = (self.vx / s) * 0.8; self.vy = (self.vy / s) * 0.8; }

        if (d < 800 && self.reload <= 0) {
            api.shoot(self, aim, { speed: 5, damage: 10, size: 10, life: 120 });
            self.reload = 100;
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

        // Main Cannon Tube
        ctx.fillStyle = '#747d8c';
        ctx.fillRect(0, -r * 0.38, r * 2.2, r * 0.76);
        ctx.strokeRect(0, -r * 0.38, r * 2.2, r * 0.76);

        // Barrel Top Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(0, -r * 0.38, r * 2.2, r * 0.32);

        // Heavy Muzzle Shroud
        ctx.fillStyle = '#57606f';
        ctx.fillRect(r * 1.85, -r * 0.45, r * 0.4, r * 0.9);
        ctx.strokeRect(r * 1.85, -r * 0.45, r * 0.4, r * 0.9);

        // Reinforced Mantlet
        ctx.fillStyle = '#57606f';
        ctx.fillRect(r * 0.2, -r * 0.5, r * 0.65, r * 1.0);
        ctx.strokeRect(r * 0.2, -r * 0.5, r * 0.65, r * 1.0);

        // Outer Hull
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.2, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Center Turret Core & Optical Sensor
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.arc(r * 0.08, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.04, -r * 0.06, r * 0.07, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
});