// Act 1 Enemy: Prism Warden
// A three-phase controller with one readable rule: dodge the telegraph before the burst.
EnemyAPI.register({
    id: 'prism_warden',
    name: 'Prism Warden',
    color: '#f5c542',
    radius: 26,
    hp: 210,
    xpReward: 70,
    scoreValue: 55,
    bodyShape: 'hexagon',

    onSpawn(self) {
        self.state.phase = 'orbit';
        self.state.phaseTimer = 180;
        self.state.lockAngle = 0;
    },

    onUpdate(self, player, api) {
        const dx = player.x - self.x;
        const dy = player.y - self.y;
        const distance = Math.hypot(dx, dy) || 1;
        const aim = Math.atan2(dy, dx);
        self.angle = aim;

        if (self.state.phase === 'orbit') {
            const tangent = aim + Math.PI * 0.5;
            const radial = distance > 340 ? 0.2 : (distance < 250 ? -0.22 : 0);
            self.vx += Math.cos(tangent) * 0.22 + Math.cos(aim) * radial;
            self.vy += Math.sin(tangent) * 0.22 + Math.sin(aim) * radial;
            self.state.phaseTimer--;
            if (self.state.phaseTimer <= 0) {
                self.state.phase = 'telegraph';
                self.state.phaseTimer = 55;
                self.state.lockAngle = aim;
                api.text(self.x, self.y - 52, 'PRISM LOCK', '#ffe66d');
            }
        } else if (self.state.phase === 'telegraph') {
            self.angle = self.state.lockAngle;
            self.vx *= 0.82;
            self.vy *= 0.82;
            self.state.phaseTimer--;
            if (self.state.phaseTimer <= 0) {
                const spread = 0.22;
                [-2, -1, 0, 1, 2].forEach(index => {
                    api.shoot(self, self.state.lockAngle + index * spread, {
                        speed: 6.5,
                        damage: 11,
                        size: 9,
                        life: 120,
                        color: '#ffe66d'
                    });
                });
                self.state.phase = 'recover';
                self.state.phaseTimer = 75;
            }
        } else {
            const retreat = aim + Math.PI;
            self.vx += Math.cos(retreat) * 0.32;
            self.vy += Math.sin(retreat) * 0.32;
            self.state.phaseTimer--;
            if (self.state.phaseTimer <= 0) {
                self.state.phase = 'orbit';
                self.state.phaseTimer = 180;
            }
        }
    },

    onDraw(self, ctx) {
        const phase = self.state.phase;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);

        ctx.strokeStyle = phase === 'telegraph' ? '#ff4757' : '#f5c542';
        ctx.globalAlpha = phase === 'telegraph' ? 0.65 + pulse * 0.3 : 0.55;
        ctx.lineWidth = phase === 'telegraph' ? 4 : 2;
        ctx.setLineDash(phase === 'telegraph' ? [10, 7] : [18, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, self.r + 12 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (phase === 'telegraph') {
            ctx.strokeStyle = '#ff4757';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.35 + pulse * 0.45;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(self.r + 230, 0);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = '#101820';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.lineTo(self.r * 1.18 * Math.cos(angle), self.r * 1.18 * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = phase === 'telegraph' ? '#ff4757' : '#f5c542';
        ctx.beginPath();
        ctx.arc(0, 0, self.r * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(0, -4, self.r * 1.35, 8);
        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, '#ffe66d', 24, 'explosion');
        api.text(self.x, self.y - 42, 'PRISM SHATTERED', '#ffe66d');
    }
});
