import { buildWorld } from './worlds.js';
import { LESSONS, freshLessonProgress, lessonComplete, lessonReadyToConvert } from './lessons.js';

const PROGRESS_KEY = 'swarm-lessons-v2';

export class TutorialMode {
    constructor(game) {
        this.game = game;
        this.index = 0;
        this.completed = new Set();
        try {
            const current = localStorage.getItem(PROGRESS_KEY);
            const saved = current ? JSON.parse(current) : JSON.parse(localStorage.getItem('swarm-lessons-v1') || '[]').filter(id => ['gather','surround','freeze'].includes(id));
            if (Array.isArray(saved)) this.completed = new Set(saved.filter(id => LESSONS.some(l => l.id === id)));
        } catch (_) { /* Lessons also work without local storage. */ }
        document.getElementById('btn-lessons-back').addEventListener('click', () => game.quitToMenu());
        document.getElementById('btn-lesson-begin').addEventListener('click', () => {
            document.getElementById('lesson-intro').classList.add('hidden');
            game.gameState = 'playing';
            game.audio.init();
        });
        document.getElementById('btn-lesson-library').addEventListener('click', () => this.showLessons());
        document.getElementById('btn-pause-lessons').addEventListener('click', () => this.showLessons());
        document.getElementById('btn-replay-lesson').addEventListener('click', () => this.start(this.index));
        document.getElementById('btn-continue-lessons').addEventListener('click', () => {
            const firstIncomplete = LESSONS.findIndex(l => !this.completed.has(l.id));
            this.start(firstIncomplete < 0 ? 0 : firstIncomplete);
        });
    }

    get lessonCount() { return LESSONS.length; }

    get lesson() { return LESSONS[this.index]; }

    showLessons() {
        this.game.restoreRunTuning();
        this.game.resetHeldInput();
        this.game.gameState = 'menu';
        this.game.ui.hideOverlays();
        this.game.ui.showScreen('lessons-screen');
        const grid = document.getElementById('lesson-grid');
        grid.replaceChildren();
        LESSONS.forEach((lesson, index) => {
            const button = document.createElement('button');
            button.className = 'lesson-card';
            const complete = this.completed.has(lesson.id);
            button.innerHTML = `<span class="lesson-number">${String(index + 1).padStart(2, '0')} / ${complete ? 'COMPLETED ✓' : lesson.duration}</span><span class="lesson-symbol">${lesson.symbol}</span><strong>${lesson.title}</strong><p>${lesson.description}</p><span class="lesson-link">${complete ? 'Play again' : 'Try lesson'} ↗</span>`;
            button.addEventListener('click', () => this.start(index));
            grid.appendChild(button);
        });
        document.getElementById('lesson-progress').textContent = `${this.completed.size} of ${LESSONS.length} complete · Choose any lesson`;
        document.getElementById('btn-continue-lessons').textContent = this.completed.size === LESSONS.length ? 'Start again' : this.completed.size ? 'Continue learning →' : 'Start with movement →';
    }

    start(index = 0) {
        this.index = Math.max(0, Math.min(LESSONS.length - 1, index));
        this.game.tutorial = this;
        this.game.practice = true;
        this.game.gameMode = 'conquest';
        this.game.playerTeam = 'dragon';
        this.game.startGame();
    }

    setupArena() {
        const g = this.game, lesson = this.lesson;
        this.progress = freshLessonProgress();
        this.game.zenShifts = 0;
        this.game.rescues = 0;
        this.game.losses = 0;
        this.lastChecklist = '';
        g.boids = [];
        const width = g.canvas.width, height = g.canvas.height;
        const cluster = (team, count, x, y) => {
            for (let i = 0; i < count; i++) {
                const angle = i * 2.399963;
                const radius = Math.sqrt(i / count) * Math.min(48, width * 0.09);
                g.addBoid(width * x + Math.cos(angle) * radius, height * y + Math.sin(angle) * radius, team);
            }
        };
        cluster(g.playerTeam, lesson.playerCount, 0.25, 0.44);
        lesson.enemies.forEach(enemy => cluster(enemy.team, enemy.count, enemy.x, enemy.y));
        g.teamCounts = Object.fromEntries([g.playerTeam, ...lesson.enemies.map(e => e.team)].map(team => [team, g.boids.filter(b => b.team === team).length]));
        g.peakPlayerCount = lesson.playerCount;
        g.ui.createFleetBars(Object.keys(g.teamCounts), g.playerTeam);
        g.ui.updateHUD(g.teamCounts, g.playerTeam, 0, 0, 0);
        this.setupTerrain();
        this.setAbilities();
        document.getElementById('lesson-intro-number').textContent = `LESSON ${this.index + 1} OF ${LESSONS.length} · ${lesson.duration}`;
        document.getElementById('lesson-intro-title').textContent = lesson.title;
        document.getElementById('lesson-intro-description').textContent = lesson.description;
        document.getElementById('lesson-intro-instruction').textContent = lesson.instruction;
        document.getElementById('lesson-intro').classList.remove('hidden');
        document.getElementById('btn-pause-lessons').classList.remove('hidden');
        g.gameState = 'lesson-intro';
        this.updateCoach();
    }

    setAbilities() {
        for (const name of ['emp']) {
            const slot = document.getElementById('slot-' + name);
            const enabled = this.lesson.abilities.includes(name);
            slot.disabled = !enabled;
            slot.classList.toggle('lesson-locked', !enabled);
            slot.setAttribute('aria-label', enabled ? `${name === 'emp' ? 'Freeze' : name} ability` : 'Introduced in a later lesson');
        }
    }

    allowsAbility(name) { return this.lesson.abilities.includes(name); }
    allowsConversion() { return lessonReadyToConvert(this.lesson, this.progress); }

    recordAbility(name, hits = 0) {
        if (name === 'emp' && hits > 0) {
            this.progress.freezeHits = Math.max(this.progress.freezeHits, hits);
            this.progress.freezeCasts++;
            this.game.ui.coachHeld = true;
        }
    }

    recordConversion(wasFrozen) {
        this.progress.recruited++;
        if (wasFrozen) this.progress.frozenRecruits++;
    }

    setupTerrain(tier = this.lesson.generated) {
        const g = this.game, l = this.lesson;
        const world = buildWorld(45123 + this.index * 1009 + (this.progress?.sectors || 0), tier || 1, g.canvas.width, g.canvas.height);
        if (!tier) world.terrain = l.terrain.map((t,i) => ({...t, id:'lesson-'+i, x:t.x*g.canvas.width, y:t.y*g.canvas.height, radius:t.radius*Math.min(g.canvas.width,g.canvas.height)}));
        if (!l.rescue && !tier) world.rescue = null;
        g.world = world;
        g.obstacles.loadWorld(world);
        g.zenShiftTimer = l.evolving ? 15 : 40;
    }

    update() {
        const g = this.game, s = this.progress;
        if (!s) return;
        if (g.beaconActive) { s.held = true; s.released = false; }
        else if (s.held) s.released = true;
        const currentTarget = this.lesson.route?.[s.waypoints] || this.lesson.target;
        if (currentTarget) {
            const target = currentTarget;
            const radius = Math.min(90, g.canvas.width * 0.17);
            const count = g.boids.filter(b => b.team === g.playerTeam && Math.hypot(b.pos.x - target.x * g.canvas.width, b.pos.y - target.y * g.canvas.height) < radius).length;
            s.arrived = Math.max(s.arrived, count);
            if (this.lesson.route && count >= 8) s.waypoints++;
        }
        s.enemiesLeft = g.boids.filter(b => b.team !== g.playerTeam).length;
        s.nebulaSeen ||= g.boids.some(b => b.team === g.playerTeam && b.slowMultiplier < .9);
        s.rescues = g.rescues || 0;
        s.shifts = g.zenShifts || 0;
        if (this.lesson.waveExercise && s.recruited >= 8 && s.waves === 1) {
            s.waves = 2;
            for(let i=0;i<12;i++) g.addBoid(g.canvas.width*.75+(i%4)*9,g.canvas.height*.62+Math.floor(i/4)*9,'phoenix');
            s.enemiesLeft += 12;
            g.renderer.addFloatingText('SECOND WAVE',g.canvas.width*.65,g.canvas.height*.5,'#b8edcb',18);
        }
        if (this.lesson.sectorExercise && s.enemiesLeft === 0) {
            s.sectors++;
            if (s.sectors === 1) {
                this.setupTerrain(3);
                // Keep reinforcement away from terrain and make the transition explicit.
                for(let i=0;i<12;i++) g.addBoid(g.canvas.width*.82+(i%4)*9,g.canvas.height*.18+Math.floor(i/4)*9,'phoenix');
                s.enemiesLeft = 12;
                g.empCooldown = 0;
                g.renderer.addFloatingText('SECTOR TWO · NEW TERRAIN',g.canvas.width/2,g.canvas.height*.4,'#b8edcb',18);
            }
        }
        this.updateCoach();
        if (lessonComplete(this.lesson, s)) {
            this.completed.add(this.lesson.id);
            try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...this.completed])); } catch (_) { /* Optional persistence. */ }
            g.victory();
        } else if (s.enemiesLeft === 0 && this.lesson.enemies.length) {
            // An unfinished timing goal always gets another chance, without restarting.
            const source = this.lesson.enemies[0];
            const count = 8;
            for (let i = 0; i < count; i++) g.addBoid(g.canvas.width * 0.68 + (i % 4) * 9, g.canvas.height * 0.44 + Math.floor(i / 4) * 9, source.team);
            g.renderer.addFloatingText('Another group — try your timing again', g.canvas.width / 2, g.canvas.height * 0.35, '#b8edcb', 14);
        }
    }

    updateCoach() {
        const lesson = this.lesson;
        document.getElementById('coach-step').textContent = `LESSON ${this.index + 1} / ${LESSONS.length}`;
        document.getElementById('coach-title').textContent = lesson.title;
        document.getElementById('coach-detail').textContent = this.game.input.freezeAiming ? 'Tap anywhere in the arena to freeze rivals there. Tap Freeze again to cancel.' : this.game.gameTime > 25 ? lesson.hint : lesson.instruction;
        const checklist = lesson.goals.map(goal => `${goal.check(this.progress) ? '✓' : '○'} ${goal.label}`);
        const signature = checklist.join('|');
        if (signature !== this.lastChecklist) {
            this.lastChecklist = signature;
            const list = document.getElementById('lesson-checklist');
            list.replaceChildren(...checklist.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
        }
        document.getElementById('lesson-checklist').classList.remove('hidden');
    }

    drawTarget(ctx) {
        const target = this.lesson.route?.[this.progress.waypoints] || this.lesson.target;
        if (!target || this.game.gameState !== 'playing') return;
        const g = this.game;
        const x = target.x * g.canvas.width, y = target.y * g.canvas.height;
        ctx.save();
        ctx.strokeStyle = '#b8edcb'; ctx.fillStyle = '#b8edcb0c'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(x, y, Math.min(90, g.canvas.width * 0.17), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#b8edcb'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('GATHER HERE', x, y - Math.min(90, g.canvas.width * 0.17) - 15);
        ctx.restore();
    }

    next() {
        if (this.index < LESSONS.length - 1) this.start(this.index + 1);
        else { this.game.practice = false; this.game.ui.showScreen('mode-screen'); this.game.gameState = 'menu'; }
    }
}
