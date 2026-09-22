// Mode behaviour mixed into Game: world preparation, fleet setup, waves,
// upgrade milestones, Zen terrain shifts, Levels checkpoints and win/lose.
import { buildWorld, levelRules, randomFrom, validCheckpoint, DIFFICULTY_CAP } from './worlds.js';
import { TEAMS, TEAM_IDS, DIFFICULTY, baseModifiers } from './catalog.js';
import { settings } from './settings.js';
import { spawnFleet, setupDuelArena, duelWorld } from './arena.js';

const CHECKPOINT_KEY = 'swarm-expedition-v1';
const ZEN_SHIFT_SECONDS = 40;
const SURVIVAL_WAVE_SECONDS = 25;
const MODE_TIER = { duel: 1, zen: 3, conquest: 5, survival: 5 };
const MODE_NAMES = { conquest: 'Conquest', levels: 'Levels', zen: 'Zen', survival: 'Survival', duel: 'Duel' };

export const ModeMethods = {
    /** Chooses the map for this match. Retry and resume keep the seed; fresh starts roll one. */
    prepareWorld(fresh = false) {
        this.world = null;
        this.zenShiftTimer = ZEN_SHIFT_SECONDS;
        this.zenShifts = 0;
        if (this.practice) return;
        if (fresh || this.mapSeed == null) this.mapSeed = Math.floor(Math.random() * 0x100000000) >>> 0;
        this.level = Math.max(1, this.level || 1);
        const tier = this.gameMode === 'levels' ? this.level : MODE_TIER[this.gameMode] ?? 5;
        this.sector = levelRules(tier);
        const seed = (this.mapSeed + (this.gameMode === 'levels' ? this.level * 2654435761 : 0)) >>> 0;
        this.world = this.gameMode === 'duel' ? duelWorld(seed, this.canvas.width, this.canvas.height) : buildWorld(seed, tier, this.canvas.width, this.canvas.height);
        if (this.gameMode === 'levels') this.saveCheckpoint();
    },

    /** Seeded per match, so a restart replays the same opening. */
    matchRandom() { return randomFrom(((this.world?.seed ?? 45123) ^ 0xabcdef) >>> 0); },

    /** Speed, cohesion, defense and recruiting for a faction under a difficulty. */
    factionModifiers(team, difficulty) {
        const faction = TEAMS[team], rival = team !== this.playerTeam;
        if (team === 'neutral') return { ...baseModifiers(), speed: difficulty.speed, cohesion: difficulty.cohesion, resist: difficulty.resist };
        return { ...baseModifiers(), speed: faction.speed * (rival ? difficulty.speed : 1), cohesion: rival ? difficulty.cohesion : 1,
            resist: faction.resist * (rival ? difficulty.resist : 1), pressure: faction.pressure };
    },

    modeDifficulty() {
        if (this.practice) return DIFFICULTY.easy;
        if (this.gameMode === 'levels') return { speed: this.sector.enemySpeed, cohesion: this.sector.enemyCohesion, resist: this.sector.conversionResist };
        if (this.gameMode === 'zen') return { speed: 0.75, cohesion: 0.8, resist: 0.75 };
        return DIFFICULTY[settings.difficulty] || DIFFICULTY.medium;
    },

    /** Team order with the player first. */
    teamOrder() { return [this.playerTeam, ...TEAM_IDS.filter(team => team !== this.playerTeam)]; },

    setupMode() {
        const sim = this.sim;
        if (this.gameMode === 'duel') {
            this.opponentTeam = this.teamOrder()[1];
            this.arena = setupDuelArena(sim, this.world, { teams: [this.playerTeam, this.opponentTeam] });
            return;
        }
        const order = this.teamOrder();
        const teams = this.gameMode === 'levels' ? order.slice(0, this.sector.rivals + 1) : order;
        sim.setTeams(teams);
        const difficulty = this.modeDifficulty();
        for (const team of [...TEAM_IDS, 'neutral']) sim.setModifiers(team, this.factionModifiers(team, difficulty));
        sim.setTerrain(this.world.terrain);
        if (this.gameMode === 'survival') {
            sim.spawnBlob(this.playerTeam, 24, sim.width / 2, sim.height / 2, 120);
            this.survival = { wave: 0, timer: 4, inProgress: false };
            return;
        }
        const perTeam = Math.floor(settings.boidCount / teams.length);
        teams.forEach((team, index) => {
            const count = this.gameMode === 'levels' ? (team === this.playerTeam ? this.sector.playerCount : this.sector.enemyCount) : perTeam;
            spawnFleet(sim, team, count, index);
        });
        this.nextMilestone = Math.max(0.5, sim.count(this.playerTeam) / sim.boids.length + 0.1);
    },

    updateModeBefore(dt) {
        if (this.gameMode === 'duel' && !this.practice) this.updateDuel(dt);
        if (this.gameMode === 'zen' || (this.practice && this.tutorial.lesson.evolving)) {
            this.zenShiftTimer -= dt;
            if (this.zenShiftTimer <= 0) this.shiftTerrain();
        }
    },

    updateModeAfter(dt, playerCount) {
        if (this.gameMode === 'survival' && !this.practice) this.updateSurvival(dt, playerCount);
        if (['conquest', 'levels'].includes(this.gameMode) && !this.practice && this.nextMilestone < 0.9 && this.sim.boids.length) {
            if (playerCount / this.sim.boids.length >= this.nextMilestone) {
                this.nextMilestone += 0.25;
                this.promptUpgrade();
            }
        }
        if (this.gameState !== 'playing') return;
        if (this.gameMode === 'zen' && !this.practice) { this.replenishZen(); return; }
        if (playerCount === 0) { this.defeat(); return; }
        if (this.practice) { this.tutorial.update(); return; }
        const alive = this.sim.teams.filter(team => this.sim.counts[team] > 0);
        if (['conquest', 'levels', 'duel'].includes(this.gameMode) && alive.length === 1 && alive[0] === this.playerTeam) this.victory();
    },

    /** Rebuilds the map in place, moving any ship that would sit on a black-hole core. */
    shiftTerrain() {
        this.zenShifts++;
        this.world = buildWorld((this.world.seed + 1013904223) >>> 0, 3 + this.zenShifts % 5, this.canvas.width, this.canvas.height);
        this.sim.setTerrain(this.world.terrain);
        for (const hole of this.sim.terrain.filter(field => field.type === 'blackHole')) {
            for (const boid of this.sim.boids) {
                const dx = boid.pos.x - hole.x, dy = boid.pos.y - hole.y;
                if (Math.hypot(dx, dy) >= hole.core + 12) continue;
                const angle = Math.atan2(dy, dx);
                boid.pos.set(hole.x + Math.cos(angle) * (hole.reach + 10), hole.y + Math.sin(angle) * (hole.reach + 10));
                boid.clearTrail();
            }
        }
        this.zenShiftTimer = this.practice ? 15 : ZEN_SHIFT_SECONDS;
        this.renderer.addFloatingText('The garden changes', this.canvas.width / 2, this.canvas.height * 0.32, '#b8edcb', 17);
    },

    replenishZen() {
        const sim = this.sim, playerCount = sim.count(this.playerTeam), rivalCount = sim.boids.length - playerCount;
        if (!playerCount) {
            sim.spawnBlob(this.playerTeam, 24, sim.width * 0.18, sim.height * 0.18, 40);
            this.renderer.addFloatingText('A fresh beginning', sim.width * 0.25, sim.height * 0.3, '#b8edcb', 16);
        }
        if (rivalCount < 8) {
            // Keep long sessions bounded; excess allies wander off peacefully.
            if (sim.boids.length > 180) sim.boids = sim.boids.filter((b, i) => b.team !== this.playerTeam || i < 120);
            sim.spawnBlob(this.teamOrder()[1], 24, sim.width * 0.82, sim.height * 0.18, 40);
        }
    },

    updateSurvival(dt, playerCount) {
        const wave = this.survival;
        wave.timer -= dt;
        const rivals = this.sim.boids.length - playerCount;
        if (wave.timer > 0 && !(wave.inProgress && rivals === 0)) return;
        this.score += wave.wave * 250 + playerCount * 25;
        if (wave.wave > 0 && wave.wave % 2 === 0) this.promptUpgrade();
        this.spawnWave();
    },

    spawnWave() {
        const wave = this.survival, sim = this.sim;
        wave.wave++;
        wave.inProgress = true;
        wave.timer = SURVIVAL_WAVE_SECONDS;
        const rivals = this.teamOrder().slice(1, 2 + Math.floor(wave.wave / 2));
        const perTeam = Math.floor(Math.min(12 + wave.wave * 6, 80) / rivals.length);
        const edges = [{ x: 0.05, y: 0.5, dx: 1, dy: 0 }, { x: 0.95, y: 0.5, dx: -1, dy: 0 }, { x: 0.5, y: 0.05, dx: 0, dy: 1 }, { x: 0.5, y: 0.95, dx: 0, dy: -1 }];
        rivals.forEach((team, index) => {
            const edge = edges[index % edges.length];
            for (let i = 0; i < perTeam; i++) {
                const boid = sim.addBoid((edge.x + (sim.random() - 0.5) * 0.2) * sim.width, (edge.y + (sim.random() - 0.5) * 0.2) * sim.height, team);
                boid.vel.set(edge.dx * sim.rules.maxSpeed * 0.6, edge.dy * sim.rules.maxSpeed * 0.6);
            }
        });
        this.audio.playConversion(false);
        this.renderer.addFloatingText(`Wave ${wave.wave}`, sim.width / 2, sim.height / 2 - 60, '#ff4444', 22);
    },

    saveCheckpoint() {
        try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ level: this.level, seed: this.mapSeed, team: this.playerTeam })); } catch { /* Optional. */ }
    },

    hasCheckpoint() {
        try { return validCheckpoint(JSON.parse(localStorage.getItem(CHECKPOINT_KEY))); } catch { return false; }
    },

    resumeExpedition() {
        try {
            const saved = JSON.parse(localStorage.getItem(CHECKPOINT_KEY));
            if (!validCheckpoint(saved)) return false;
            Object.assign(this, { practice: false, gameMode: 'levels', level: saved.level, mapSeed: saved.seed, playerTeam: saved.team });
            this.startGame();
            return true;
        } catch { return false; }
    },

    advanceLevel() {
        if (this.gameMode !== 'levels' || this.gameState !== 'victory') return;
        this.level++;
        this.startGame();
    },

    showSectorBriefing() {
        if (this.gameMode !== 'levels') return;
        this.gameState = 'sector-intro';
        this.ui.showSectorBriefing({
            number: `Sector ${String(this.level).padStart(2, '0')} · ${this.sector.tier >= DIFFICULTY_CAP ? 'difficulty capped' : `difficulty ${this.sector.tier} / ${DIFFICULTY_CAP}`}`,
            title: this.world.name,
            description: `${this.sector.rivals} rival swarm${this.sector.rivals > 1 ? 's' : ''} · ${this.world.terrain.length} terrain fields. The map stays fixed. Unite the arena to open the next sector.`,
        });
    },

    worldLabel() {
        if (this.practice) return this.tutorial.lesson.title;
        if (this.gameMode === 'duel') return `You vs ${this.rivalName()}`;
        return `${this.gameMode === 'levels' ? `Sector ${this.level}` : MODE_NAMES[this.gameMode]} · ${this.world?.name ?? ''}`;
    },

    worldDetail() {
        if (this.gameMode === 'duel' && !this.practice) return `Gray ships are unclaimed · more in ${Math.ceil(this.arena?.neutralTimer ?? 0)}s`;
        if (this.gameMode === 'zen' || (this.practice && this.tutorial.lesson.evolving)) {
            return `Terrain shifts in ${Math.ceil(this.zenShiftTimer)}s${this.zenShiftTimer <= 5 ? ' · prepare to move' : ''}`;
        }
        if (this.gameMode === 'survival') return `Wave ${this.survival?.wave ?? 0} · next in ${Math.max(0, Math.ceil(this.survival?.timer ?? 0))}s`;
        return `${this.sim.terrain.length} terrain fields · map stays fixed`;
    },
};
