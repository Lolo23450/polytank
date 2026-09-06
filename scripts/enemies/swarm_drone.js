/**
 * enemies/swarm_drone.js
 * Aerodynamic dart micro-drone with swept wings and glowing visor eye.
 */

EnemyAPI.register({
    id:         'swarm_drone',
    name:       'Swarm Drone',
    color:      '#ffd34d',
    radius:     9,
    hp:         1,
    xpReward:   4,
    scoreValue: 2,
    bodyShape:  'custom',

    onSpawn(self) {
        self.state.hitCooldown = 0;
        self.state.wobble = Math.random() * Math.PI * 2;
        self.angle = Math.random() * Math.PI * 2;
        self.vx = Math.cos(self.angle) * 1;
        self.vy = Math.sin(self.angle) * 1;
    },

    onUpdate(self, player, api) {
        const d = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        const wobble = Math.sin(api.state.frame * 0.16 + self.state.wobble) * 0.45;
        const steer = aim + wobble;

        self.angle = steer;
        self.vx += Math.cos(steer) * 0.42;
        self.vy += Math.sin(steer) * 0.42;

        const spd = Math.hypot(self.vx, self.vy);
        if (spd > 6.2) {
            self.vx = (self.vx / spd) * 6.2;
            self.vy = (self.vy / spd) * 6.2;
        }

        if (self.state.hitCooldown > 0) self.state.hitCooldown--;
        if (d < self.r + 22 + 2 && self.state.hitCooldown <= 0 && gameCtx.player) {
            const gamePlayer = gameCtx.player;
            const mult = self.dmgMult || 1;
            const dmg = Math.round(3.5 * mult);
            gamePlayer.takeDmg(dmg);
            gameCtx.state.cam.shake = 4;
            api.particles(self.x, self.y, self.color, 6, 'spark');
            api.text(self.x, self.y - 24, `-${dmg}`, '#ffcc55');
            // ...
            gameCtx.state.cam.shake = 4;
            api.particles(self.x, self.y, self.color, 6, 'spark');
            api.text(self.x, self.y - 24, '-6', '#ffcc55');
            const away = Math.atan2(self.y - player.y, self.x - player.x);
            gamePlayer.vx -= Math.cos(away) * 2.2;
            gamePlayer.vy -= Math.sin(away) * 2.2;
            self.dead = true;
        }
    },

    onDraw(self, ctx) {
        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4a3300';
        ctx.lineJoin = 'round';

        // Swept Arrow Dart Hull
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.moveTo(self.r * 1.5, 0);
        ctx.lineTo(-self.r * 0.6, -self.r * 0.95);
        ctx.lineTo(-self.r * 0.3, 0);
        ctx.lineTo(-self.r * 0.6,  self.r * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Upper Wing Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(self.r * 1.5, 0);
        ctx.lineTo(-self.r * 0.6, -self.r * 0.95);
        ctx.lineTo(-self.r * 0.3, 0);
        ctx.closePath();
        ctx.fill();

        // Center Optical Sensor
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.arc(self.r * 0.3, 0, self.r * 0.32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(self.r * 0.4, -self.r * 0.08, self.r * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, self.color, 4, 'spark');
    },
});