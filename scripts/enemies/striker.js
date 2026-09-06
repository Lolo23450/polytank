// Sector 7 Enemy Unit: striker
EnemyAPI.register({
    id: "striker",
    name: "STRIKER",
    color: "#006666",
    radius: 22,
    hp: 120,
    bodyShape: "hexagon",
    xpReward: 35,
    scoreValue: 25,
    isBoss: false,
    onUpdate: function anonymous(self,player,api
) {
// Compiled by Sector 7 Scratch JIT Engine
/* [BLOCK:motion_turn_to_player] {"steerRate":0.16} */

                    const _aim = Math.atan2(player.y - self.y, player.x - self.x);
                    const _diff = Math.atan2(Math.sin(_aim - self.angle), Math.cos(_aim - self.angle));
                    self.angle += _diff * 0.16;
                
/* [BLOCK:motion_thrust_forward] {"force":0.3,"maxSpeed":5} */

                    self.vx += Math.cos(self.angle) * 0.3;
                    self.vy += Math.sin(self.angle) * 0.3;
                    const _spd = Math.hypot(self.vx, self.vy);
                    if (_spd > 5) {
                        self.vx = (self.vx / _spd) * 5;
                        self.vy = (self.vy / _spd) * 5;
                    }
                
/* [BLOCK:motion_maintain_distance] {"targetDist":180,"thrust":0.15} */

                    const _dx = player.x - self.x;
                    const _dy = player.y - self.y;
                    const _d = Math.hypot(_dx, _dy) || 1;
                    const _a = Math.atan2(_dy, _dx);
                    const _f = 0.15;
                    if (_d > 180 + 35) {
                        self.vx += Math.cos(_a) * _f;
                        self.vy += Math.sin(_a) * _f;
                    } else if (_d < 180 - 35) {
                        self.vx -= Math.cos(_a) * (_f * 1.35);
                        self.vy -= Math.sin(_a) * (_f * 1.35);
                    } else {
                        self.vx += -Math.sin(_a) * (_f * 0.95);
                        self.vy += Math.cos(_a) * (_f * 0.95);
                    }
                
/* [BLOCK:combat_shoot_scattergun] {"pelletCount":10,"spreadDeg":36,"damage":8,"speed":4,"recoilPush":0.8,"reloadFrames":75} */

                    self.state._cd_3 = self.state._cd_3 !== undefined ? self.state._cd_3 : 0;
                    if (self.state._cd_3 <= 0) {
                        const _arcRad = (36 * Math.PI) / 180;
                        const _cnt = 10;
                        for (let _i = 0; _i < _cnt; _i++) {
                            const _offset = -_arcRad / 2 + (_i / (_cnt - 1)) * _arcRad;
                            api.shoot(self, self.angle + _offset, {
                                speed: 4 * (0.85 + Math.random() * 0.3),
                                damage: 8,
                                size: 6,
                                life: 60,
                                color: self.color
                            });
                        }
                        self.vx -= Math.cos(self.angle) * 0.8;
                        self.vy -= Math.sin(self.angle) * 0.8;
                        self.state._cd_3 = 75;
                    }
                    if (self.state._cd_3 > 0) self.state._cd_3--;
                

},
    onDraw: function anonymous(self,ctx
) {
// Compiled by Sector 7 Scratch JIT Engine
/* [BLOCK:render_draw_body_hull] {"shape":"hexagon","borderWidth":3.5,"borderColor":"#1e293b"} */

                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.lineWidth = 3.5;
                    ctx.strokeStyle = '#1e293b';
                    ctx.fillStyle = self.color;
                    ctx.lineJoin = 'round';

                    const _r = self.r;
                    ctx.beginPath();
                    if ('hexagon' === 'triangle') {
                        for (let _i = 0; _i < 3; _i++) {
                            const _a = _i * 2.094 + Math.PI;
                            ctx.lineTo(_r * 1.25 * Math.cos(_a), _r * 1.25 * Math.sin(_a));
                        }
                    } else if ('hexagon' === 'square') {
                        ctx.rect(-_r, -_r, _r * 2, _r * 2);
                    } else if ('hexagon' === 'hexagon') {
                        for (let _i = 0; _i < 6; _i++) {
                            const _a = (_i * Math.PI) / 3;
                            ctx.lineTo(_r * 1.15 * Math.cos(_a), _r * 1.15 * Math.sin(_a));
                        }
                    } else {
                        ctx.arc(0, 0, _r, 0, Math.PI * 2);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
                    ctx.beginPath();
                    ctx.arc(-_r * 0.25, -_r * 0.25, _r * 0.65, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                
/* [BLOCK:render_rotating_shield] {"shieldColor":"#e0ec89","radiusOffset":14} */

                    ctx.save();
                    ctx.translate(self.x, self.y);
                    const _rot = (Date.now() * 0.002) % (Math.PI * 2);
                    ctx.rotate(_rot);
                    ctx.strokeStyle = '#e0ec89';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([12, 8]);
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r + 14, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                
/* [BLOCK:render_segmented_plates] {"plateColor":"#ceba5a","thickness":9} */

                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.strokeStyle = '#ceba5a';
                    ctx.lineWidth = 9;
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 0.3, Math.PI * 0.7);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 1.3, Math.PI * 1.7);
                    ctx.stroke();
                    ctx.restore();
                
/* [BLOCK:render_segmented_plates] {"plateColor":"#f3f1d8","thickness":4} */

                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    ctx.strokeStyle = '#f3f1d8';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 0.3, Math.PI * 0.7);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, self.r - 2, Math.PI * 1.3, Math.PI * 1.7);
                    ctx.stroke();
                    ctx.restore();
                
/* [BLOCK:render_draw_twin_barrels] {"lengthMult":1.1,"spacing":11,"barrelColor":"#264a59"} */

                    ctx.save();
                    ctx.translate(self.x, self.y);
                    ctx.rotate(self.angle);
                    const _len = self.r * 1.1;
                    const _sp = 11 / 2;
                    ctx.fillStyle = '#264a59';
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2;
                    ctx.fillRect(0, -_sp - 4, _len, 8);
                    ctx.strokeRect(0, -_sp - 4, _len, 8);
                    ctx.fillRect(0, _sp - 4, _len, 8);
                    ctx.strokeRect(0, _sp - 4, _len, 8);
                    ctx.restore();
                

}
});
