/**
 * enemies/trapper.js
 * Advanced Mine-laying Tactical Unit with Predictive Kiting, Panic Cluster Ejections, and Choke-Point Denial.
 */

EnemyAPI.register({
    id:         'trapper',
    name:       'Trapper Minelayer',
    color:      '#708090',
    radius:     24,
    hp:         180,
    xpReward:   65,
    scoreValue: 55,
    bodyShape:  'circle',

    onSpawn(self) {
        self.reload = 300;
        self.state.strafeDir = Math.random() < 0.5 ? 1 : -1;
        self.state.strafeTimer = 0;
        self.state.panicCooldown = 0;
    },

    onUpdate(self, player, api) {
        const d = Math.hypot(player.x - self.x, player.y - self.y);
        const directAim = Math.atan2(player.y - self.y, player.x - self.x);
        
        if (self.state.panicCooldown > 0) self.state.panicCooldown--;
        self.state.strafeTimer++;
        if (self.state.strafeTimer > 90) {
            self.state.strafeDir *= -1; // Flip strafe direction for serpentine kiting
            self.state.strafeTimer = 0;
        }

        // 1. SMART PREDICTIVE MOVEMENT & KITING
        const strafeAngle = directAim + Math.PI + (self.state.strafeDir * 0.55);
        self.angle = directAim;

        if (d < 360) {
            self.vx += Math.cos(strafeAngle) * 0.32;
            self.vy += Math.sin(strafeAngle) * 0.32;
        } else if (d > 650) {
            self.vx += Math.cos(directAim) * 0.12;
            self.vy += Math.sin(directAim) * 0.12;
        } else {
            const orbitAngle = directAim + (Math.PI / 2 * self.state.strafeDir);
            self.vx += Math.cos(orbitAngle) * 0.22;
            self.vy += Math.sin(orbitAngle) * 0.22;
        }

        // 2. EMERGENCY PANIC CLUSTER (Punishes close rushing)
        if (d < 240 && self.state.panicCooldown <= 0) {
            [-0.35, 0, 0.35].forEach(offset => {
                api.shoot(self, directAim + Math.PI + offset, {
                    speed:      1.4,
                    damage:     55,
                    size:       18,
                    life:       500,
                    color:      '#ff1e27',
                    isMine:     true
                });
            });

            // Thruster Burst Away
            self.vx += Math.cos(directAim + Math.PI) * 2.8;
            self.vy += Math.sin(directAim + Math.PI) * 2.8;
            api.particles(self.x, self.y, '#38bdf8', 12, 'spark');
            api.text(self.x, self.y - 35, "CLUSTER DROP!", "#ff3838");

            self.state.panicCooldown = 180;
            self.reload = 200;
            return;
        }

        // 3. REGULAR TACTICAL PREDICTIVE MINE DROP
        if (self.reload <= 0) {
            const pSpeed = Math.hypot(player.vx || 0, player.vy || 0);
            const pMoveAngle = Math.atan2(player.vy || 0, player.vx || 0);
            
            let dropAngle = directAim + Math.PI;
            if (pSpeed > 0.5) {
                dropAngle = (directAim + Math.PI) * 0.7 + (pMoveAngle + Math.PI) * 0.3;
            }

            api.shoot(self, dropAngle + (Math.random() - 0.5) * 0.2, {
                speed:      0.4,
                damage:     46,
                size:       12,
                life:       500,
                color:      '#ff1e27',
                isMine:     true
            });

            api.particles(
                self.x - Math.cos(self.angle) * self.r,
                self.y - Math.sin(self.angle) * self.r,
                '#94a3b8', 6, 'debris'
            );

            self.reload = 135 + Math.random() * 20;
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

        // Rear Mine Loading Chute & Hydraulic Rails
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-r * 1.35, -r * 0.52, r * 0.85, r * 1.04);
        ctx.strokeRect(-r * 1.35, -r * 0.52, r * 0.85, r * 1.04);

        // Flared Ejector Flaps
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.45);
        ctx.lineTo(-r * 1.75, -r * 0.95);
        ctx.lineTo(-r * 1.75, -r * 0.45);
        ctx.lineTo(-r * 0.5, -r * 0.22);
        ctx.moveTo(-r * 0.5,  r * 0.45);
        ctx.lineTo(-r * 1.75,  r * 0.95);
        ctx.lineTo(-r * 1.75,  r * 0.45);
        ctx.lineTo(-r * 0.5,  r * 0.22);
        ctx.fill();
        ctx.stroke();

        // Dark Ejector Throat with Loaded Mine Core Indicator
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-r * 1.75, -r * 0.38, r * 0.5, r * 0.76);
        
        ctx.fillStyle = '#ff1e27';
        ctx.beginPath();
        ctx.arc(-r * 1.4, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Main Hull Body
        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Top Hull Specular Bevel
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.2, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Hazard Plate Warning Chevrons
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-r * 0.25, -r * 0.55, r * 0.5, r * 1.1);
        ctx.strokeRect(-r * 0.25, -r * 0.55, r * 0.5, r * 1.1);

        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-r * 0.25, -r * 0.35); ctx.lineTo(r * 0.25, -r * 0.1); ctx.lineTo(r * 0.25, 0); ctx.lineTo(-r * 0.25, -r * 0.25);
        ctx.moveTo(-r * 0.25,  r * 0.1); ctx.lineTo(r * 0.25,  r * 0.35); ctx.lineTo(r * 0.25, r * 0.45); ctx.lineTo(-r * 0.25,  r * 0.2);
        ctx.fill();

        ctx.restore();
    },

    onDie(self, api) {
        api.particles(self.x, self.y, self.color, 12, 'explosion');
        api.particles(self.x, self.y, '#ff1e27', 8, 'spark');
    },
});