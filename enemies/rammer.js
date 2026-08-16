/**
 * enemies/rammer.js
 * Armored wedge rammer with front puncture blade, facet shading, and twin rear thrusters.
 */

EnemyAPI.register({
    id:         'rammer',
    name:       'Rammer',
    color:      '#fc7677',
    radius:     20,
    hp:         80,
    xpReward:   30,
    scoreValue: 20,
    bodyShape:  'triangle',

    onSpawn(self) {
        self.state.phase        = 'chase';
        self.state.dashCooldown = 240 + Math.random() * 160;
        self.state.phaseTimer   = 0;
        self.state.dashAngle    = 0;
        self.state.ramCooldown  = 0;
    },

    onUpdate(self, player, api) {
        const d   = Math.hypot(player.x - self.x, player.y - self.y);
        const aim = Math.atan2(player.y - self.y, player.x - self.x);

        if (self.state.phase === 'chase') {
            self.angle = aim;
            self.vx += Math.cos(aim) * 0.16;
            self.vy += Math.sin(aim) * 0.16;

            if (self.state.ramCooldown > 0) self.state.ramCooldown--;
            if (d < self.r + 22 + 4 && self.state.ramCooldown <= 0) {
                const impact = 10 + Math.hypot(self.vx, self.vy);
                const gamePlayer = gameCtx.player;
                gamePlayer.takeDmg(Math.round(impact));
                gameCtx.state.cam.shake = 6;
                triggerGlitch(12, 14);
                api.particles(self.x, self.y, self.color, 8, 'spark');
                api.text(self.x, self.y - 40, `-${Math.round(impact)}`, '#ff4444');
                const away = Math.atan2(self.y - player.y, self.x - player.x);
                self.vx = Math.cos(away) * 4;
                self.vy = Math.sin(away) * 4;
                gamePlayer.vx -= Math.cos(away) * 2;
                gamePlayer.vy -= Math.sin(away) * 2;
                self.state.ramCooldown = 55;
            }

            self.state.dashCooldown--;
            if (self.state.dashCooldown <= 0 && d < 800) {
                self.state.phase      = 'charge';
                self.state.phaseTimer = 75;
                self.state.dashAngle  = aim;
                self.vx *= 0.1;
                self.vy *= 0.1;
            }

        } else if (self.state.phase === 'charge') {
            self.angle = self.state.dashAngle;
            self.vx *= 0.6;
            self.vy *= 0.6;
            self.state.phaseTimer--;

            if (api.state.frame % 3 === 0) {
                const pa = aim + Math.PI + (Math.random() - 0.5);
                api.particles(
                    self.x + Math.cos(pa) * 40,
                    self.y + Math.sin(pa) * 40,
                    '#ffff00', 1, 'spark'
                );
            }

            if (self.state.phaseTimer <= 0) {
                self.state.phase      = 'dash';
                self.state.phaseTimer = 60;
                self.vx = Math.cos(self.state.dashAngle) * 7;
                self.vy = Math.sin(self.state.dashAngle) * 7;
                api.particles(self.x, self.y, '#ffbb00', 30, 'explosion');
            }

        } else if (self.state.phase === 'dash') {
            self.vx = Math.cos(self.state.dashAngle) * 7;
            self.vy = Math.sin(self.state.dashAngle) * 7;

            if (api.state.frame % 2 === 0) {
                api.particles(self.x, self.y, self.color, 1, 'spark');
            }

            if (d < self.r + 22 + 4) {
                const gamePlayer = gameCtx.player;
                const impact = 24;
                gamePlayer.takeDmg(impact);
                gameCtx.state.cam.shake = 14;
                triggerGlitch(24, 36);
                api.particles(self.x, self.y, '#ffffff', 15, 'explosion');
                api.text(self.x, self.y - 40, `CRITICAL -${impact}`, '#ff0000');
                const away = Math.atan2(self.y - player.y, self.x - player.x);
                self.vx = Math.cos(away) * 5;
                self.vy = Math.sin(away) * 5;
                gamePlayer.vx -= Math.cos(away) * 6;
                gamePlayer.vy -= Math.sin(away) * 6;
                self.state.phase        = 'chase';
                self.state.dashCooldown = 240 + Math.random() * 120;
                self.state.ramCooldown  = 45;
            } else {
                self.state.phaseTimer--;
                if (self.state.phaseTimer <= 0) {
                    self.state.phase        = 'chase';
                    self.state.dashCooldown = 210 + Math.random() * 90;
                }
            }
        }
    },

    onDraw(self, ctx) {
        const r = self.r;

        // Charge warning line
        if (self.state.phase === 'charge') {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(self.x, self.y);
            ctx.lineTo(
                self.x + Math.cos(self.state.dashAngle) * 1000,
                self.y + Math.sin(self.state.dashAngle) * 1000
            );
            const opacity = 1 - (self.state.phaseTimer / 45);
            ctx.strokeStyle = `rgba(255,50,50,${opacity})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.lineDashOffset = -self.state.phaseTimer * 3;
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2f3542';
        ctx.lineJoin = 'round';

        // Twin Rear Thruster Nozzles
        ctx.fillStyle = '#2f3542';
        ctx.fillRect(-r * 1.3, -r * 0.65, r * 0.45, r * 0.38);
        ctx.strokeRect(-r * 1.3, -r * 0.65, r * 0.45, r * 0.38);
        ctx.fillRect(-r * 1.3,  r * 0.27, r * 0.45, r * 0.38);
        ctx.strokeRect(-r * 1.3,  r * 0.27, r * 0.45, r * 0.38);

        // Thruster Flames when moving/dashing
        if (self.state.phase === 'dash' || Math.hypot(self.vx, self.vy) > 0.5) {
            const flameLen = self.state.phase === 'dash' ? r * 1.4 : r * 0.7;
            ctx.fillStyle = '#ff9f43';
            ctx.beginPath();
            ctx.moveTo(-r * 1.3, -r * 0.65);
            ctx.lineTo(-r * 1.3 - flameLen, -r * 0.46);
            ctx.lineTo(-r * 1.3, -r * 0.27);
            ctx.moveTo(-r * 1.3, r * 0.27);
            ctx.lineTo(-r * 1.3 - flameLen, r * 0.46);
            ctx.lineTo(-r * 1.3, r * 0.65);
            ctx.fill();
        }

        // Triangular Hull
        const p1 = { x:  r * 1.4, y: 0 };
        const p2 = { x: -r * 1.1, y: -r * 1.05 };
        const p3 = { x: -r * 1.1, y:  r * 1.05 };

        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top Facet Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(-r * 0.2, 0);
        ctx.closePath();
        ctx.fill();

        // Front Armored Prow Spike
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.moveTo(p1.x + 4, p1.y);
        ctx.lineTo(r * 0.5, -r * 0.4);
        ctx.lineTo(r * 0.7, 0);
        ctx.lineTo(r * 0.5,  r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, self.color, 12, 'debris');
    },
});