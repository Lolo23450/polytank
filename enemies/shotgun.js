/**
 * enemies/shotgun.js
 * Heavy close-quarters breacher with flared muzzle, recoil pistons, and armored chassis.
 */

EnemyAPI.register({
    id:         'shotgun',
    name:       'Shotgun Unit',
    color:      '#c542f5',
    radius:     24,
    hp:         100,
    xpReward:   60,
    scoreValue: 50,
    bodyShape:  'circle',

    onSpawn(self) {
        self.reload = 80 + Math.random() * 40;
    },

    onUpdate(self, player, api) {
        const d   = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        self.angle = aim;

        const effective = 320;
        if (d > effective) {
            self.vx += Math.cos(aim) * 0.25;
            self.vy += Math.sin(aim) * 0.25;
        } else {
            self.vx += Math.cos(aim + Math.PI / 2) * 0.15;
            self.vy += Math.sin(aim + Math.PI / 2) * 0.15;
        }

        if (self.reload <= 0 && d < effective + 100) {
            for (let i = -2; i <= 2; i++) {
                api.shoot(self, aim + i * 0.15, { speed: 9, damage: 10, size: 9, life: 45 });
            }
            self.vx -= Math.cos(aim) * 3;
            self.vy -= Math.sin(aim) * 3;
            self.reload = 90;
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

        // Dual Recoil Piston Brackets
        ctx.fillStyle = '#57606f';
        ctx.fillRect(r * 0.3, -r * 0.82, r * 0.8, r * 0.26);
        ctx.strokeRect(r * 0.3, -r * 0.82, r * 0.8, r * 0.26);
        ctx.fillRect(r * 0.3,  r * 0.56, r * 0.8, r * 0.26);
        ctx.strokeRect(r * 0.3,  r * 0.56, r * 0.8, r * 0.26);

        // Flared Shotgun Barrel
        ctx.fillStyle = '#747d8c';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(r * 1.8, -r * 0.85);
        ctx.lineTo(r * 1.8,  r * 0.85);
        ctx.lineTo(0,  r * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner Void Chamber
        ctx.fillStyle = '#2f3542';
        ctx.fillRect(r * 1.6, -r * 0.72, r * 0.22, r * 1.44);

        // Heavy Armored Hull
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bevel highlight
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(-r * 0.22, -r * 0.22, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Armor Studs
        ctx.fillStyle = '#2f3542';
        for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center Chamber Ring
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = '#2f3542';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a55eea';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
});