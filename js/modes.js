import { buildWorld, levelRules, randomFrom, validCheckpoint, DIFFICULTY_CAP } from './worlds.js';
import { CONFIG, TEAMS } from './config.js';

export const WorldMethods = {
    resizeWorld() {
        const oldWidth = this.canvas.width, oldHeight = this.canvas.height;
        this.renderer.resize();
        if (!oldWidth || !oldHeight) return;
        const sx = this.canvas.width / oldWidth, sy = this.canvas.height / oldHeight;
        const sr = Math.min(this.canvas.width, this.canvas.height) / Math.min(oldWidth, oldHeight);
        for (const boid of this.boids) { boid.pos.x *= sx; boid.pos.y *= sy; boid.trail = []; }
        for (const obstacle of this.obstacles.obstacles) {
            obstacle.pos.x *= sx; obstacle.pos.y *= sy; obstacle.radius *= sr;
            if (obstacle.pullRadius) obstacle.pullRadius *= sr;
            if (obstacle.destroyRadius) obstacle.destroyRadius *= sr;
        }
        for (const terrain of this.world?.terrain || []) { terrain.x *= sx; terrain.y *= sy; terrain.radius *= sr; }
        if (this.world?.rescue) { this.world.rescue.x *= sx; this.world.rescue.y *= sy; this.world.rescue.radius *= sr; }
        if (this.freezeField) { this.freezeField.x *= sx; this.freezeField.y *= sy; this.freezeField.radius *= sr; }
        this.input.mousePos.x *= sx; this.input.mousePos.y *= sy;
        if (this.releaseTarget) { this.releaseTarget.x *= sx; this.releaseTarget.y *= sy; }
        this.resetHeldInput();
    },
    prepareWorld(fresh = false) {
        if (this.practice) { this.world = null; return; }
        if (!['levels', 'zen', 'conquest', 'survival'].includes(this.gameMode)) this.gameMode = 'conquest';
        if (fresh || this.mapSeed == null) this.mapSeed = Math.floor(Math.random() * 0x100000000) >>> 0;
        this.level = Math.max(1, this.level || 1);
        const tier = this.gameMode === 'levels' ? this.level : this.gameMode === 'zen' ? 3 : 5;
        this.rules = levelRules(tier);
        this.world = buildWorld((this.mapSeed + (this.gameMode === 'levels' ? this.level * 2654435761 : 0)) >>> 0, tier, this.canvas.width, this.canvas.height);
        this.spawnRandom = randomFrom(this.world.seed ^ 0xabcdef);
        this.zenShiftTimer = 40;
        this.zenShifts = 0;
        this.rescues = 0;
        this.losses = 0;
        if (this.gameMode === 'levels') {
            this.difficultyMod = { enemySpeed: this.rules.enemySpeed, enemyCohesion: this.rules.enemyCohesion, conversionResist: this.rules.conversionResist };
            this.saveCheckpoint();
        }
        if (this.gameMode === 'zen') this.difficultyMod = { enemySpeed: .75, enemyCohesion: .8, conversionResist: .75 };
    },
    saveCheckpoint() {
        if (this.practice || this.gameMode !== 'levels') return;
        try { localStorage.setItem('swarm-expedition-v1', JSON.stringify({ level: this.level, seed: this.mapSeed, team: this.playerTeam })); } catch (_) {}
    },
    resumeExpedition() {
        try {
            const saved = JSON.parse(localStorage.getItem('swarm-expedition-v1'));
            if (!validCheckpoint(saved)) return false;
            this.practice = false; this.gameMode = 'levels'; this.level = saved.level;
            this.mapSeed = saved.seed; this.playerTeam = saved.team;
            this.startGame(); return true;
        } catch (_) { return false; }
    },
    advanceLevel() {
        if (this.gameMode !== 'levels' || this.gameState !== 'victory') return;
        this.level++;
        this.startGame();
    },
    showSectorBriefing() {
        if (this.practice || this.gameMode !== 'levels') return;
        document.getElementById('sector-number').textContent = `SECTOR ${String(this.level).padStart(2, '0')} · ${this.rules.tier >= DIFFICULTY_CAP ? 'DIFFICULTY CAPPED' : 'DIFFICULTY ' + this.rules.tier + ' / ' + DIFFICULTY_CAP}`;
        document.getElementById('sector-title').textContent = this.world.name;
        document.getElementById('sector-description').textContent = `${this.rules.rivals} rival swarm${this.rules.rivals > 1 ? 's' : ''} · ${this.world.terrain.length} terrain fields. The map stays fixed. Unite the arena to open the next sector.`;
        document.getElementById('sector-intro').classList.remove('hidden');
        this.gameState = 'sector-intro';
    },
    updateWorld(dt) {
        if (!this.world) return;
        const rescue = this.world.rescue;
        if (rescue && !rescue.claimed) {
            const near = this.boids.filter(b => b.team === this.playerTeam && Math.hypot(b.pos.x - rescue.x, b.pos.y - rescue.y) < rescue.radius + 45).length;
            rescue.progress = Math.max(0, Math.min(2, rescue.progress + (near >= 5 ? dt : -dt * .5)));
            if (rescue.progress >= 2) {
                rescue.claimed = true; this.rescues++;
                for (let i = 0; i < 6; i++) this.addBoid(rescue.x + Math.cos(i) * 18, rescue.y + Math.sin(i) * 18, this.playerTeam);
                this.score += 600;
                this.audio.playConversion(true);
                this.renderer.addFloatingText('SIX STRAYS FOUND A HOME', rescue.x, rescue.y - 38, '#c7f5ba', 15);
            }
        }
        if (this.gameMode === 'zen' || (this.practice && this.tutorial?.lesson.evolving)) {
            this.zenShiftTimer -= dt;
            if (this.zenShiftTimer <= 0) {
                this.zenShifts++;
                const seed = (this.world.seed + 1013904223) >>> 0;
                this.world = buildWorld(seed, 3 + this.zenShifts % 5, this.canvas.width, this.canvas.height);
                this.obstacles.loadWorld(this.world);
                // A shift is never allowed to spawn a lethal core directly on a ship.
                for (const hazard of this.obstacles.obstacles.filter(o => o.type === 'blackHole')) {
                    for (const boid of this.boids) {
                        const dx = boid.pos.x - hazard.pos.x, dy = boid.pos.y - hazard.pos.y;
                        if (Math.hypot(dx, dy) < hazard.destroyRadius + 12) {
                            const angle = Math.atan2(dy, dx);
                            boid.pos.x = hazard.pos.x + Math.cos(angle) * (hazard.pullRadius + 10);
                            boid.pos.y = hazard.pos.y + Math.sin(angle) * (hazard.pullRadius + 10);
                            boid.trail = [];
                        }
                    }
                }
                this.zenShiftTimer = 40;
                this.renderer.addFloatingText('THE GARDEN CHANGES', this.canvas.width / 2, this.canvas.height * .32, '#b8edcb', 17);
            }
        }
        document.getElementById('world-label').textContent = this.practice ? this.tutorial.lesson.title : `${this.gameMode === 'levels' ? 'SECTOR ' + this.level : this.gameMode === 'zen' ? 'ZEN' : this.gameMode === 'survival' ? 'SURVIVAL' : 'COMPETITION'} · ${this.world.name}`;
        document.getElementById('world-detail').textContent = this.gameMode === 'zen' || this.tutorial?.lesson.evolving && this.practice ? `Terrain shifts in ${Math.ceil(this.zenShiftTimer)}s${this.zenShiftTimer <= 5 ? ' · prepare to move' : ''}` : `${this.world.terrain.length} terrain fields · map stays fixed`;
    },
    replenishZen() {
        const playerCount = this.boids.filter(b => b.team === this.playerTeam).length;
        const enemyCount = this.boids.length - playerCount;
        if (!playerCount) {
            for (let i = 0; i < 24; i++) this.addBoid(this.canvas.width * .18 + i % 6 * 8, this.canvas.height * .18 + Math.floor(i / 6) * 8, this.playerTeam);
            this.renderer.addFloatingText('A FRESH BEGINNING', this.canvas.width * .25, this.canvas.height * .3, '#b8edcb', 16);
        }
        if (enemyCount < 8) {
            const team = Object.keys(TEAMS).find(t => t !== this.playerTeam);
            // Keep long sessions bounded; excess allies wander off peacefully.
            if (this.boids.length > 180) this.boids = this.boids.filter((b,i) => b.team !== this.playerTeam || i < 120);
            for (let i = 0; i < 24; i++) this.addBoid(this.canvas.width * .82 + i % 6 * 8, this.canvas.height * .18 + Math.floor(i / 6) * 8, team);
        }
    },
    drawWorld() {
        if (!['playing','paused','sector-intro','lesson-intro','doctrine-select'].includes(this.gameState)) return;
        const ctx = this.renderer.ctx;
        const rescue = this.world?.rescue;
        if (rescue && !rescue.claimed) {
            ctx.save(); ctx.translate(rescue.x, rescue.y);
            ctx.strokeStyle = '#c7f5ba77'; ctx.fillStyle = '#c7f5ba'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0,0,rescue.radius,0,Math.PI*2); ctx.stroke();
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,rescue.radius,-Math.PI/2,-Math.PI/2+Math.PI*2*rescue.progress/2);ctx.stroke();
            for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(Math.cos(i)*13,Math.sin(i)*13,2,0,Math.PI*2);ctx.fill();}
            ctx.font='10px Segoe UI, sans-serif';ctx.textAlign='center';ctx.fillText('STRANDED · GATHER 5 SHIPS HERE',0,-rescue.radius-12);ctx.restore();
        }
        const aim = this.input.mousePos;
        if (this.empCooldown <= 0 && (!this.practice || this.tutorial?.allowsAbility('emp'))) {
            ctx.save();ctx.strokeStyle=this.input.freezeAiming?'#b6edff99':'#b6edff20';ctx.lineWidth=1;ctx.setLineDash([4,8]);
            ctx.beginPath();ctx.arc(aim.x,aim.y,CONFIG.empRadius,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        if (this.freezeField?.remaining > 0) {
            const field=this.freezeField;ctx.save();ctx.strokeStyle='#a5e9ff55';ctx.fillStyle='#a5e9ff';ctx.lineWidth=1;
            ctx.beginPath();ctx.arc(field.x,field.y,field.radius,0,Math.PI*2);ctx.stroke();
            ctx.font='11px Segoe UI, sans-serif';ctx.textAlign='center';ctx.fillText(`FROZEN · ${Math.ceil(field.remaining)}s`,Math.max(80,Math.min(this.canvas.width-80,field.x)),Math.max(150,field.y-field.radius+20));ctx.restore();
        }
    }
};
