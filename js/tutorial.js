// Lesson runner: builds each exercise, tracks goals and saves completion.
import { buildWorld } from './worlds.js';
import { TEAM_IDS, DIFFICULTY } from './catalog.js';
import { LESSONS, freshLessonProgress, lessonComplete, lessonReadyToConvert, lessonText } from './lessons.js';

const PROGRESS_KEY = 'swarm-lessons-v2';
/** Simulated seconds of play after the goals are met, before the result screen. */
const COMPLETION_BEAT = 1.75;
/** Early exercises use a gentler recruit rule so beginners succeed on their first tries. */
const ASSIST = { threshold: 2, rivalResist: 0.55, speedup: 0.5 };
/** Lessons use fixed player stats so team rebalancing never changes how hard a lesson is. */
const LESSON_PLAYER = { speed: 1.15, resist: 1, pressure: 1.2 };

export class TutorialMode {
    constructor(game) {
        this.game = game;
        game.tutorial = this;
        this.index = 0;
        this.completed = new Set();
        this.progress = freshLessonProgress();
        try {
            const current = localStorage.getItem(PROGRESS_KEY);
            const saved = current ? JSON.parse(current) : JSON.parse(localStorage.getItem('swarm-lessons-v1') || '[]').filter(id => ['gather', 'surround', 'freeze'].includes(id));
            if (Array.isArray(saved)) this.completed = new Set(saved.filter(id => LESSONS.some(l => l.id === id)));
        } catch { /* Lessons also work without storage. */ }
    }

    get lessonCount() { return LESSONS.length; }
    get lesson() { return LESSONS[this.index]; }
    text(field) { return lessonText(this.lesson[field], this.game.rules); }
    firstIncomplete() { const i = LESSONS.findIndex(l => !this.completed.has(l.id)); return i < 0 ? 0 : i; }

    showLessons() {
        this.game.quitToMenu();
        this.game.ui.showLessons(LESSONS.map((lesson, index) => ({ index, title: lesson.title, description: lessonText(lesson.description, this.game.rules), done: this.completed.has(lesson.id) })), this.completed.size);
    }

    start(index = 0) {
        this.index = Math.max(0, Math.min(LESSONS.length - 1, index));
        Object.assign(this.game, { practice: true, gameMode: 'conquest', playerTeam: 'dragon' });
        this.game.startGame();
    }

    next() {
        if (this.index < LESSONS.length - 1) this.start(this.index + 1);
        else { this.game.quitToMenu(); this.game.ui.showScreen('mode-screen'); }
    }

    /** Called by Game.startGame on a fresh simulation. */
    setupArena() {
        const game = this.game, sim = game.sim, lesson = this.lesson, player = game.playerTeam;
        this.progress = freshLessonProgress();
        this.completionAt = null;
        game.zenShifts = 0;
        sim.setTeams([player, ...new Set(lesson.enemies.map(e => e.team))]);
        for (const team of [...TEAM_IDS, 'neutral']) sim.setModifiers(team, game.factionModifiers(team, DIFFICULTY.easy));
        sim.setModifiers(player, { ...game.factionModifiers(player, DIFFICULTY.easy), ...LESSON_PLAYER });
        const radius = Math.min(48, sim.width * 0.09);
        sim.spawnCluster(player, lesson.playerCount, sim.width * 0.25, sim.height * 0.44, radius);
        if (lesson.neutrals) sim.spawnCluster('neutral', lesson.neutrals, sim.width * 0.55, sim.height * 0.44, radius);
        for (const group of lesson.enemies) sim.spawnCluster(group.team, group.count, sim.width * group.x, sim.height * group.y, radius);
        // Outside live lessons your ships cannot be recruited and rivals hold still as targets.
        sim.canConvert = boid => boid.team === player ? Boolean(lesson.live) : lessonReadyToConvert(lesson, this.progress);
        sim.canMove = lesson.live ? null : boid => boid.team === player;
        sim.assist = lesson.live ? null : { team: player, ...ASSIST };
        // Exercises that teach Freeze start with it ready; live lessons keep the real opening lockout.
        if (!lesson.live) sim.rules.freezeLockout = 0;
        this.setupTerrain();
    }

    setupTerrain(tier = this.lesson.generated) {
        const game = this.game, sim = game.sim, lesson = this.lesson;
        // Seeded by lesson id, so reordering lessons never changes their maps.
        const idSeed = [...lesson.id].reduce((hash, ch) => Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
        const world = buildWorld((idSeed + this.progress.sectors) >>> 0, tier || 1, sim.width, sim.height);
        if (!tier) world.terrain = lesson.terrain.map((t, i) => ({ ...t, id: `lesson-${i}`, x: t.x * sim.width, y: t.y * sim.height, radius: t.radius * Math.min(sim.width, sim.height) }));
        game.world = world;
        sim.setTerrain(world.terrain);
        game.zenShiftTimer = lesson.evolving ? 15 : 40;
    }

    showIntro() {
        this.game.gameState = 'lesson-intro';
        this.game.ui.showIntro({
            eyebrow: `Lesson ${this.index + 1} of ${LESSONS.length} · ${this.lesson.duration}`,
            title: this.lesson.title, description: this.text('description'), instruction: this.text('instruction'), secondary: 'All lessons',
        });
    }

    allowsAbility(name) { return this.lesson.abilities.includes(name); }

    recordFreeze(hits) {
        this.progress.freezeHits = Math.max(this.progress.freezeHits, hits);
        this.progress.freezeCasts++;
    }

    recordRecruit(wasFrozen, wasNeutral) {
        this.progress.recruited++;
        if (wasNeutral) this.progress.neutralRecruits++;
        if (wasFrozen) this.progress.frozenRecruits++;
    }

    update() {
        const game = this.game, sim = game.sim, p = this.progress, lesson = this.lesson, player = game.playerTeam;
        if (game.input.rallyLatched) p.tapSteered = true;
        if (game.player.rallying) { p.held = true; p.released = false; }
        else if (p.held) p.released = true;
        const target = lesson.route?.[p.waypoints] || lesson.target;
        if (target) {
            const radius = Math.min(90, sim.width * 0.17), tx = target.x * sim.width, ty = target.y * sim.height;
            const arrived = sim.boids.filter(b => b.team === player && (b.pos.x - tx) ** 2 + (b.pos.y - ty) ** 2 < radius * radius).length;
            p.arrived = Math.max(p.arrived, arrived);
            if (lesson.route && arrived >= 8) p.waypoints++;
        }
        p.enemiesLeft = sim.boids.filter(b => b.team !== player && b.team !== 'neutral').length;
        p.nebulaSeen ||= sim.boids.some(b => b.team === player && b.slowMultiplier < 0.9);
        p.shifts = game.zenShifts;
        if (lesson.waveExercise && p.recruited >= 8 && p.waves === 1) {
            p.waves = 2;
            this.reinforce(12, 0.75, 0.62, 'Second wave');
        }
        if (lesson.sectorExercise && p.enemiesLeft === 0 && p.sectors === 0) {
            p.sectors = 1;
            this.setupTerrain(3);
            game.player.freezeCooldown = 0;
            this.reinforce(12, 0.82, 0.18, 'Sector two · new terrain');
        } else if (lesson.sectorExercise && p.enemiesLeft === 0) p.sectors = 2;
        if (lessonComplete(lesson, p)) {
            if (this.completionAt == null) {
                this.completed.add(lesson.id);
                try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...this.completed])); } catch { /* Optional. */ }
                this.completionAt = sim.time;
            }
            if (sim.time - this.completionAt >= COMPLETION_BEAT) game.victory();
        } else if (p.enemiesLeft === 0 && lesson.enemies.length && !lesson.sectorExercise) {
            // An unfinished timing goal always gets another group, without restarting.
            this.reinforce(8, 0.68, 0.44, 'Another group — try your timing again', lesson.enemies[0].team);
        }
    }

    reinforce(count, x, y, message, team = 'phoenix') {
        const sim = this.game.sim;
        for (let i = 0; i < count; i++) sim.addBoid(sim.width * x + (i % 4) * 9, sim.height * y + Math.floor(i / 4) * 9, team);
        this.progress.enemiesLeft += count;
        this.game.renderer.addFloatingText(message, sim.width / 2, sim.height * 0.4, '#b8edcb', 16);
    }

    /** Coach text for the Guide panel. */
    coach() {
        const lesson = this.lesson, p = this.progress;
        return {
            step: `Lesson ${this.index + 1} / ${LESSONS.length}`,
            title: lesson.title,
            detail: this.game.input.freezeAiming ? 'Tap anywhere in the arena to freeze rivals there. Tap Freeze again to cancel.' : this.game.gameTime > 25 ? this.text('hint') : this.text('instruction'),
            checklist: lesson.goals.map(g => ({ label: g.label, done: g.check(p) })),
        };
    }
}
