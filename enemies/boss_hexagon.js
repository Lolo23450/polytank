/**
 * enemies/boss_hexagon.js
 * ACT 1 BOSS — The Hexagon Guardian
 * 4 Heavy multi-stage artillery cannons with dual muzzle brakes, Phase 2 Overdrive, and radial plasma barrages.
 */

EnemyAPI.register({
    id:         'hexagon',
    name:       'Hexagon Guardian',
    color:      '#9e55a0',
    radius:     52,
    hp:         3600,
    xpReward:   950,
    scoreValue: 850,
    bodyShape:  'hexagon',
    isBoss:     true,

    onSpawn(self) {
        self.reload = 60;
        self.state.burstCounter = 0;
        self.state.enraged = false;
        self.state.overdriveGlow = 0;
        self.state.spinCycle = 0;
    },

    onUpdate(self, player, api) {
        const hpPct = self.hp / self.maxHp;
        self.state.enraged = hpPct <= 0.5;

        const aim = Math.atan2(player.y - self.y, player.x - self.x);
        const dist = Math.hypot(player.x - self.x, player.y - self.y);

        // Dynamic turn rate: accelerates during Phase 2 overdrive
        const turnSpeed = self.state.enraged ? 0.075 : 0.045;
        const diff = aim - self.angle;
        const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
        self.angle += wrapped * turnSpeed;

        // Smart strafing positioning
        const moveSpeed = self.state.enraged ? 0.16 : 0.09;
        if (dist > 450) {
            self.vx += Math.cos(aim) * moveSpeed;
            self.vy += Math.sin(aim) * moveSpeed;
        } else if (dist < 260) {
            self.vx -= Math.cos(aim) * moveSpeed * 1.2;
            self.vy -= Math.sin(aim) * moveSpeed * 1.2;
        } else {
            // Circle player
            const tangent = aim + Math.PI / 2;
            self.vx += Math.cos(tangent) * moveSpeed * 0.9;
            self.vy += Math.sin(tangent) * moveSpeed * 0.9;
        }

        // Overdrive reactor pulse
        self.state.overdriveGlow = (self.state.overdriveGlow + 0.08) % (Math.PI * 2);

        if (self.reload <= 0) {
            self.state.burstCounter = (self.state.burstCounter || 0) + 1;

            if (self.state.enraged) {
                // PHASE 2 OVERDRIVE: Rapid quad heavy salvos with lead angle
                for (let i = 0; i < 4; i++) {
                    const a = self.angle + (Math.PI / 2) * i;
                    api.shoot(self, a, { speed: 5.6, damage: 24, size: 18, life: 240, isArtillery: true, color: '#ff3838' });
                }

                // 8-way secondary plasma sweep every 2nd volley
                if (self.state.burstCounter % 2 === 0) {
                    for (let i = 0; i < 8; i++) {
                        const a = self.angle + (Math.PI / 4) * i + Math.PI / 8;
                        api.shoot(self, a, { speed: 4.4, damage: 16, size: 13, life: 190, color: '#be2edd' });
                    }
                    api.particles(self.x, self.y, '#be2edd', 16, 'spark');
                }

                // Deploy tactical mine every 4th volley
                if (self.state.burstCounter % 4 === 0) {
                    api.shoot(self, self.angle + Math.PI, {
                        speed: 0.2, damage: 55, size: 18, life: 900, isMine: true, color: '#ff4757'
                    });
                }

                self.reload = 48; // Faster firing cadence in Phase 2
            } else {
                // PHASE 1: Heavy quad artillery
                for (let i = 0; i < 4; i++) {
                    const a = self.angle + (Math.PI / 2) * i;
                    api.shoot(self, a, { speed: 5.0, damage: 22, size: 17, life: 220, isArtillery: true, color: '#ff4757' });
                }

                // Secondary 6-way shockwave every 3rd volley
                if (self.state.burstCounter % 3 === 0) {
                    for (let i = 0; i < 6; i++) {
                        const a = (i * Math.PI) / 3 + self.angle;
                        api.shoot(self, a, { speed: 3.8, damage: 15, size: 12, life: 180, color: '#e056fd' });
                    }
                    api.particles(self.x, self.y, '#e056fd', 14, 'spark');
                }

                self.reload = 65;
            }
        }
    },

    onDraw(self, ctx) {
        const r = self.r;
        const isEnraged = self.state.enraged;
        const pulse = 0.5 + 0.5 * Math.sin(self.state.overdriveGlow || 0);

        ctx.save();
        ctx.translate(self.x, self.y);
        ctx.rotate(self.angle);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#2d132c';
        ctx.lineJoin = 'round';

        // Phase 2 Energy Shield Ring
        if (isEnraged) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 56, 56, ${0.4 + 0.4 * pulse})`;
            ctx.lineWidth = 4;
            ctx.setLineDash([14, 8]);
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // 4 Heavy Barrels at 90° intervals
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((Math.PI / 2) * i);

            // Barrel Body
            ctx.fillStyle = isEnraged ? '#4a1b2f' : '#574b60';
            ctx.fillRect(0, -r * 0.36, r * 2.05, r * 0.72);
            ctx.strokeRect(0, -r * 0.36, r * 2.05, r * 0.72);

            // Barrel Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(0, -r * 0.36, r * 2.05, r * 0.28);

            // Ventilated Heat Slots
            ctx.fillStyle = isEnraged ? '#ff4757' : '#1e293b';
            for (let v = 0; v < 3; v++) {
                ctx.fillRect(r * 0.7 + v * (r * 0.35), -r * 0.22, r * 0.18, r * 0.44);
            }

            // Reinforced Muzzle Brake
            ctx.fillStyle = '#2d132c';
            ctx.fillRect(r * 1.75, -r * 0.44, r * 0.35, r * 0.88);
            ctx.strokeRect(r * 1.75, -r * 0.44, r * 0.35, r * 0.88);

            // Recoil Strut Bracket
            ctx.fillStyle = '#3d2b42';
            ctx.fillRect(r * 0.45, -r * 0.48, r * 0.45, r * 0.96);
            ctx.strokeRect(r * 0.45, -r * 0.48, r * 0.45, r * 0.96);

            ctx.restore();
        }

        // Hexagonal Armored Carapace
        ctx.fillStyle = isEnraged ? '#c0392b' : self.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.lineTo(r * 1.15 * Math.cos(a), r * 1.15 * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top Carapace Highlight Plate
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.moveTo(r * 1.15 * Math.cos(0), r * 1.15 * Math.sin(0));
        ctx.lineTo(r * 1.15 * Math.cos(Math.PI / 3), r * 1.15 * Math.sin(Math.PI / 3));
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Guardian Reactor Outer Hub
        ctx.fillStyle = '#2d132c';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.lineTo(r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pulsing Guardian Eye Core (Red in Phase 2, Gold in Phase 1)
        ctx.fillStyle = isEnraged ? `rgba(255, ${Math.floor(70 * pulse)}, 70, 1)` : '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, r * (isEnraged ? 0.35 : 0.3), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.08, -r * 0.08, r * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    onDie(self, api) {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                api.particles(
                    self.x + (Math.random() - 0.5) * 110,
                    self.y + (Math.random() - 0.5) * 110,
                    '#ff3838', 28, 'explosion'
                );
            }, i * 150);
        }
    },
});