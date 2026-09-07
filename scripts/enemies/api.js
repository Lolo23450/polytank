const EnemyAPI = (() => {
    const _registry = new Map();

    const DEFAULTS = {
        id:         'unnamed',
        name:       'Unknown Unit',
        color:      '#888888',
        radius:     22,
        hp:         100,
        xpReward:   30,
        scoreValue: 20,
        bodyShape:  'circle',
        isBoss:     false,

        onSpawn(self, ctx) {},

        onUpdate(self, player, api) {
            const aim = Math.atan2(player.y - self.y, player.x - self.x);
            self.angle = aim;
            self.vx += Math.cos(aim) * 0.15;
            self.vy += Math.sin(aim) * 0.15;
            if (self.reload <= 0) {
                api.shoot(self, aim);
                self.reload = 100;
            }
        },

        onDraw: undefined,

        onDie(self, api) {
            api.particles(self.x, self.y, self.color, 12, 'explosion');
        },
    };

    return {
        register(def) {
            if (!def || !def.id) return null;
            const fullDef = Object.assign({}, DEFAULTS, def);
            _registry.set(def.id, fullDef);
            return fullDef;
        },

        remove(id) {
            return _registry.delete(id);
        },

        spawn(type, x, y, gameCtx) {
            const def = _registry.get(type);
            if (!def) return null;

            const instance = {
                _def:       def,
                type:       def.id,
                isBoss:     def.isBoss,
                x, y,
                r:          def.radius,
                vx: 0, vy: 0,
                angle:      0,
                hp:         def.hp,
                maxHp:      def.hp,
                color:      def.color,
                dead:       false,
                reload:     0,
                state:      {},

                update() {
                    if (this.dead) return;
                    const p = gameCtx.player;
                    const playerSnap = p ? {
                        x: p.x, y: p.y,
                        vx: p.vx || 0, vy: p.vy || 0,
                        hp: p.hp, maxHp: p.maxHp,
                        dead: Boolean(p.dead)
                    } : null;

                    if (!playerSnap || playerSnap.dead) return;

                    if (this.hp < this.maxHp) this.hp += 0.02;

                    const spd = Math.hypot(this.vx, this.vy);
                    if (spd > 24) { this.vx = (this.vx / spd) * 24; this.vy = (this.vy / spd) * 24; }

                    if (this.reload > 0) this.reload--;

                    try {
                        def.onUpdate(this, playerSnap, _makeApi(this, gameCtx));
                    } catch (err) {
                        console.warn(`[EnemyAPI:${this.type}] onUpdate error:`, err);
                    }

                    this.vx *= 0.92; this.vy *= 0.92;
                    this.x += this.vx; this.y += this.vy;

                    const lim = (gameCtx.state && gameCtx.state.mapSize ? gameCtx.state.mapSize : 1500) - this.r;
                    if (this.x < -lim) { this.x = -lim; this.vx = 0; }
                    if (this.x >  lim) { this.x =  lim; this.vx = 0; }
                    if (this.y < -lim) { this.y = -lim; this.vy = 0; }
                    if (this.y >  lim) { this.y =  lim; this.vy = 0; }
                },

                draw(ctx) {
                    if (this.dead) return;
                    try {
                        if (def.onDraw) {
                            def.onDraw(this, ctx);
                        } else {
                            _drawBody(ctx, this, def.bodyShape, def.color);
                        }
                    } catch (err) {
                        _drawBody(ctx, this, def.bodyShape, def.color);
                    }
                    _drawHealthBar(ctx, this);
                },

                takeDmg(amt) {
                    this.hp -= amt;
                    if (this.hp <= 0) this._die();
                },

                _die() {
                    if (this.dead) return;
                    this.dead = true;
                    try {
                        def.onDie(this, _makeApi(this, gameCtx));
                    } catch (e) {}

                    if (gameCtx.player && typeof gameCtx.player.gainXp === 'function') {
                        gameCtx.player.gainXp(def.xpReward);
                    }
                    if (gameCtx.state) gameCtx.state.score += def.scoreValue;

                    if (def.isBoss) {
                        if (gameCtx.state) gameCtx.state.bossDeathEffect = { timer: 200, x: this.x, y: this.y };
                    } else if (def.id !== 'swarm_drone' && !def.ignoreKillObjective) {
                        if (typeof gameCtx.checkObj === 'function') gameCtx.checkObj('kill');
                    }
                }
            };

            try {
                def.onSpawn(instance, gameCtx);
            } catch (e) {
                console.warn(`[EnemyAPI:${type}] onSpawn error:`, e);
            }
            return instance;
        },

        list() {
            return [..._registry.keys()];
        },

        inspect(type) {
            return _registry.get(type) ? Object.assign({}, _registry.get(type)) : null;
        },

        get(type) {
            return _registry.get(type);
        }
    };

    function _makeApi(self, gameCtx) {
        return {
            shoot(from, angle, opts = {}) {
                const { speed = 5, damage = 10, size = 10, life = 120, color = from.color } = opts;
                const scaledDamage = Math.round(damage * (from.dmgMult || 1));
                const bx = from.x + Math.cos(angle) * (from.r * 1.25);
                const by = from.y + Math.sin(angle) * (from.r * 1.25);
                if (gameCtx.bullets) {
                    const BulletType = gameCtx.Bullet === false ? null : (gameCtx.Bullet || (typeof Bullet !== 'undefined' ? Bullet : null));
                    if (BulletType) {
                        gameCtx.bullets.push(new BulletType(bx, by, angle, speed, scaledDamage, size, life, color, false, opts));
                    } else {
                        // Sandbox bullet fallback
                        gameCtx.bullets.push({ x: bx, y: by, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg: scaledDamage, r: size / 2, life, color });
                    }
                }
            },

            spawnEnemy(type, x, y) {
                const child = EnemyAPI.spawn(type, x, y, gameCtx);
                if (child && gameCtx.enemies) gameCtx.enemies.push(child);
                return child;
            },

            particles(x, y, color, count, type = 'spark', params = {}) {
                if (gameCtx.spawnParticles) gameCtx.spawnParticles(x, y, color, count, type, params);
            },

            text(x, y, str, color = '#fff') {
                if (gameCtx.spawnText) gameCtx.spawnText(x, y, str, color);
            },

            get state() { return gameCtx.state || {}; }
        };
    }

    function _drawBody(ctx, inst, shape, color) {
        ctx.save();
        ctx.translate(inst.x, inst.y);
        ctx.rotate(inst.angle);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2d3436';
        ctx.lineJoin = 'round';

        const r = inst.r;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(1.5, 2.5, r, 0, Math.PI * 2);
        ctx.fill();

        if (shape !== 'triangle') {
            ctx.fillStyle = '#8395a7';
            ctx.fillRect(0, -r * 0.38, r * 2.2, r * 0.76);
            ctx.strokeRect(0, -r * 0.38, r * 2.2, r * 0.76);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.fillRect(0, -r * 0.38, r * 2.2, r * 0.32);

            ctx.fillStyle = '#576574';
            ctx.fillRect(r * 1.9, -r * 0.44, r * 0.35, r * 0.88);
            ctx.strokeRect(r * 1.9, -r * 0.44, r * 0.35, r * 0.88);
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        if (shape === 'triangle') {
            for (let i = 0; i < 3; i++) {
                const a = i * 2.094 + Math.PI;
                ctx.lineTo(r * 1.25 * Math.cos(a), r * 1.25 * Math.sin(a));
            }
        } else if (shape === 'square') {
            ctx.rect(-r, -r, r * 2, r * 2);
        } else if (shape === 'hexagon') {
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                ctx.lineTo(r * 1.15 * Math.cos(a), r * 1.15 * Math.sin(a));
            }
        } else {
            ctx.arc(0, 0, r, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#2f3542';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    function _drawHealthBar(ctx, inst) {
        if (inst.hp >= inst.maxHp) return;
        ctx.save();
        ctx.translate(inst.x, inst.y + inst.r + 14);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-22, 0, 44, 7);
        ctx.strokeRect(-22, 0, 44, 7);

        const pct = Math.max(0, inst.hp / inst.maxHp);
        ctx.fillStyle = pct > 0.4 ? '#2ed573' : '#ff4757';
        ctx.fillRect(-20, 2, 40 * pct, 3);
        ctx.restore();
    }
})();