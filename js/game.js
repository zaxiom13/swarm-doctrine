import { WorldMethods } from './modes.js';
// Enhanced Game Controller - Dynamic doctrines, tactical beacon, ability suite, combos, and wave survival
import { CONFIG, DIFFICULTY_MODS, TEAMS, DOCTRINES_CATALOG } from './config.js';
import { AudioSystem } from './audio.js';
import { Boid } from './boid.js';
import { Vector } from './vector.js';
import { UIManager } from './ui.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { QuadTree, Rectangle, Circle } from './quadtree.js';
import { ObstacleManager } from './obstacles.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');

        // Systems
        this.audio = new AudioSystem();
        this.renderer = new Renderer(this.canvas);
        this.ui = new UIManager(this);
        this.input = new InputHandler(this.canvas, this);

        // Game state
        this.boids = [];
        this.quadTree = null;
        this.gameState = 'menu'; // menu, team-select, playing, paused, victory, defeat, doctrine-select
        this.gameTime = 0;
        this.conversions = 0;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.peakPlayerCount = 0;
        this.recentConversions = [];
        this.difficultyMod = DIFFICULTY_MODS.medium;
        this.playerTeam = 'dragon';
        this.teamCounts = {};

        // Tactical Abilities & Balances
        this.beaconActive = false;
        this.rallyCoolOffDuration = 0.45; // 1.0s snappy disarm after releasing rally
        this.rallyCoolOffTimer = 0;
        this.empCooldown = 0;
        this.empCooldownMax = CONFIG.empCooldown;

        // Unlocked Doctrines
        this.activeDoctrines = [];
        this.playerResistBonus = 1.0;
        this.chainAssimilation = false;

        // Powerups & Hazards
        this.powerups = null;
        this.obstacles = new ObstacleManager(this);

        // Visual FX
        this.particles = [];
        this.screenShake = 0;

        // Game Modes
        this.gameMode = 'conquest';
        this.survivalWave = 0;
        this.survivalScore = 0;
        this.waveTimer = 0;
        this.waveDuration = 25;
        this.waveInProgress = false;
        this.nextConquestMilestone = 0.5;

        // Setup
        this.renderer.resize();
        this.ui.setup();
        window.addEventListener('resize', () => this.resizeWorld());

        // Loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    showTeamSelect(mode = 'conquest') {
        this.restoreRunTuning();
        this.practice = false;
        this.restoreLessonControls();
        this.gameMode = mode;
        this.gameState = 'team-select';
        this.ui.showScreen('team-select-screen');
    }

    selectTeam(teamId) {
        this.playerTeam = teamId;
        if (this.gameMode === 'survival') {
            this.startSurvivalMode();
        } else {
            if (this.gameMode === 'levels') this.level = 1;
            this.startGame({ fresh: true });
        }
    }

    addBoid(x, y, team) {
        const newBoid = new Boid(x, y, team);
        this.boids.push(newBoid);
        return newBoid;
    }

    setBeaconActive(active) {
        const wasActive = this.beaconActive;
        this.beaconActive = active;
        if (active) {
            this.rallyCoolOffTimer = this.rallyCoolOffDuration;
            if (this.gameState === 'playing') {
                this.audio.playBeaconPulse();
            }
        } else {
            // Releasing rally initiates the cool-off disarm countdown
            this.rallyCoolOffTimer = this.rallyCoolOffDuration;

            // Bloom dispersion: immediately give friendly boids a natural outward spread impulse
            if (wasActive && this.gameState === 'playing') {
                this.releaseSettleTimer = 1.5;
                this.releaseTarget = new Vector(this.input.mousePos.x, this.input.mousePos.y);
                const target = this.input.mousePos;
                for (let i = 0; i < this.boids.length; i++) {
                    const b = this.boids[i];
                    if (b.team === this.playerTeam) {
                        const dist = b.pos.dist(target);
                        if (dist < 140) {
                            const angle = Math.atan2(b.pos.y - target.y, b.pos.x - target.x) + (Math.random() - 0.5) * 0.5;
                            const spreadForce = 0.35 + Math.random() * 0.3;
                            b.vel.x += Math.cos(angle) * spreadForce;
                            b.vel.y += Math.sin(angle) * spreadForce;
                        }
                    }
                }
            }
        }
    }

    // Freeze uses simulation time, includes the boundary, and never spends a charge on air.
    triggerEmp() {
        if (this.gameState !== 'playing' || this.empCooldown > 0) return;
        if (this.practice && this.tutorial && !this.tutorial.allowsAbility('emp')) return;
        const target = this.input.mousePos;
        const radius = CONFIG.empRadius;
        const victims = this.boids.filter(b => b.team !== this.playerTeam && b.pos.distSq(target) <= radius * radius);
        if (!victims.length) {
            this.renderer.addFloatingText('No rivals in range · charge kept', target.x, target.y - 25, '#b8d9e5', 13);
            return;
        }
        this.empCooldown = this.empCooldownMax;
        for (const boid of victims) boid.stun(CONFIG.empDuration);
        this.freezeField = { x: target.x, y: target.y, radius, remaining: CONFIG.empDuration };
        this.audio.playEmp();
        this.renderer.addShockwave(target.x, target.y, radius, '#a5e9ff');
        this.renderer.addFloatingText(`${victims.length} frozen · ${CONFIG.empDuration}s`, target.x, target.y - 25, '#a5e9ff', 16);
        this.tutorial && this.practice && this.tutorial.recordAbility('emp', victims.length);
        // Freezing is an attack opening; releasing Rally lets conversion start immediately.
        if (this.beaconActive) this.setBeaconActive(false);
        this.input.mouseDown = false;
        this.rallyCoolOffTimer = 0;
    }

    restoreLessonControls() {
        for (const name of ['emp']) {
            const slot = document.getElementById('slot-' + name);
            slot.disabled = false;
            slot.classList.remove('lesson-locked');
            slot.removeAttribute('aria-label');
        }
        document.getElementById('lesson-checklist').classList.add('hidden');
        document.getElementById('btn-pause-lessons').classList.add('hidden');
    }

    restoreRunTuning() {
        if (!this.runTuning) return;
        Object.assign(CONFIG, this.runTuning);
        this.runTuning = null;
    }

    resetInteraction() {
        this.restoreRunTuning();
        const keys = ['peerPressureTime', 'beaconRadius', 'beaconAttractForce', 'maxSpeed', 'empRadius', 'empDuration'];
        this.runTuning = Object.fromEntries(keys.map(key => [key, CONFIG[key]]));
        this.beaconActive = false;
        this.rallyCoolOffTimer = 0;
        this.input.mouseDown = false;
        this.input.rightMouseDown = false;
        this.input.freezeAiming = false;
        this.input.pointerId = null;
        this.renderer.floatingTexts = [];
        this.renderer.shockwaveRings = [];
        this.ui.resetCoach?.();
        this.physicsAccumulator = 0;
        this.releaseSettleTimer = 0;
        this.freezeField = null;
        this.empCooldownMax = CONFIG.empCooldown;
    }

    startGame({ fresh = false } = {}) {
        this.resetInteraction();
        if (this.practice) this.gameMode = 'conquest';
        this.difficultyMod = DIFFICULTY_MODS[this.practice ? 'easy' : CONFIG.difficulty];
        document.getElementById('survival-hud')?.classList.add('hidden');
        this.boids = [];
        this.gameTime = 0;
        this.conversions = 0;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.peakPlayerCount = 0;
        this.recentConversions = [];
        this.teamCounts = {};
        this.activeDoctrines = [];
        this.playerResistBonus = 1.0;
        this.chainAssimilation = false;
        this.nextConquestMilestone = 0.5;

        this.empCooldown = 0;

        this.prepareWorld(fresh);
        const allTeams = [this.playerTeam, ...Object.keys(TEAMS).filter(t => t !== this.playerTeam)];
        const teamIds = this.practice ? ['dragon', 'salamander'] : this.gameMode === 'levels' ? allTeams.slice(0, this.rules.rivals + 1) : allTeams;
        const boidsPerTeam = Math.floor(CONFIG.boidCount / teamIds.length);
        const width = this.canvas.width;
        const height = this.canvas.height;

        const spawnAreas = [
            { x: 0.18, y: 0.18 }, // Top-left
            { x: 0.82, y: 0.18 }, // Top-right
            { x: 0.18, y: 0.82 }, // Bottom-left
            { x: 0.82, y: 0.82 }  // Bottom-right
        ];

        teamIds.forEach((teamId, index) => {
            const spawn = this.practice ? { x: index === 0 ? 0.28 : 0.68, y: 0.45 } : spawnAreas[index % spawnAreas.length];
            const count = this.practice ? (teamId === this.playerTeam ? 32 : 8) : this.gameMode === 'levels' ? (teamId === this.playerTeam ? this.rules.playerCount : this.rules.enemyCount) : boidsPerTeam;
            for (let i = 0; i < count; i++) {
                const x = (spawn.x + ((this.spawnRandom || Math.random)() - 0.5) * 0.10) * width;
                const y = (spawn.y + ((this.spawnRandom || Math.random)() - 0.5) * 0.10) * height;
                this.boids.push(new Boid(x, y, teamId));
            }
            this.teamCounts[teamId] = count;
        });

        this.peakPlayerCount = this.teamCounts[this.playerTeam];
        this.nextConquestMilestone = Math.max(0.5, this.peakPlayerCount / this.boids.length + 0.10);
        this.gameState = 'playing';
        this.ui.showScreen('game-screen');
        this.ui.hideOverlays();
        this.ui.updateTeamBanner(this.playerTeam);
        this.ui.createFleetBars(teamIds, this.playerTeam);

        this.obstacles.reset();
        this.particles = [];
        this.screenShake = 0;

        if (!this.practice) this.obstacles.spawnForConquest();
        this.obstacleTimer = 25;
        if (this.practice && this.tutorial) this.tutorial.setupArena();
        else { this.restoreLessonControls(); this.showSectorBriefing(); }
        this.updateWorld(0);
    }

    startSurvivalMode() {
        this.resetInteraction();
        this.practice = false;
        this.restoreLessonControls();
        this.gameMode = 'survival';
        this.difficultyMod = DIFFICULTY_MODS[CONFIG.difficulty];
        this.ui.createFleetBars(Object.keys(TEAMS), this.playerTeam);
        this.boids = [];
        this.gameTime = 0;
        this.conversions = 0;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.survivalWave = 0;
        this.survivalScore = 0;
        this.waveTimer = 4;
        this.waveInProgress = false;
        this.teamCounts = {};
        this.activeDoctrines = [];
        this.playerResistBonus = 1.0;
        this.chainAssimilation = false;

        this.empCooldown = 0;

        const width = this.canvas.width;
        const height = this.canvas.height;

        const startCount = 24;
        for (let i = 0; i < startCount; i++) {
            const x = width / 2 + (Math.random() - 0.5) * 120;
            const y = height / 2 + (Math.random() - 0.5) * 120;
            this.boids.push(new Boid(x, y, this.playerTeam));
        }
        this.teamCounts[this.playerTeam] = startCount;
        this.peakPlayerCount = startCount;

        this.obstacles.reset();
        this.particles = [];
        this.screenShake = 0;

        this.gameState = 'playing';
        this.ui.showScreen('game-screen');
        this.ui.hideOverlays();
        this.ui.updateTeamBanner(this.playerTeam);
        this.ui.showSurvivalHUD();
        this.prepareWorld(true);
        this.obstacles.loadWorld(this.world);
    }

    spawnSurvivalWave() {
        this.survivalWave++;
        this.waveInProgress = true;

        const width = this.canvas.width;
        const height = this.canvas.height;

        const enemyCount = Math.min(12 + this.survivalWave * 6, 80);
        const enemyTeams = Object.keys(TEAMS).filter(t => t !== this.playerTeam);
        const activeEnemyCount = Math.min(1 + Math.floor(this.survivalWave / 2), enemyTeams.length);
        const activeEnemies = enemyTeams.slice(0, activeEnemyCount);

        const spawnEdges = [
            { x: 0.05, y: 0.5, dx: 1, dy: 0 },
            { x: 0.95, y: 0.5, dx: -1, dy: 0 },
            { x: 0.5, y: 0.05, dx: 0, dy: 1 },
            { x: 0.5, y: 0.95, dx: 0, dy: -1 }
        ];

        const enemiesPerTeam = Math.floor(enemyCount / activeEnemies.length);

        activeEnemies.forEach((team, teamIndex) => {
            const edge = spawnEdges[teamIndex % spawnEdges.length];
            for (let i = 0; i < enemiesPerTeam; i++) {
                const x = (edge.x + (Math.random() - 0.5) * 0.2) * width;
                const y = (edge.y + (Math.random() - 0.5) * 0.2) * height;
                const boid = new Boid(x, y, team);
                boid.vel.x = edge.dx * CONFIG.maxSpeed * 0.6;
                boid.vel.y = edge.dy * CONFIG.maxSpeed * 0.6;
                this.boids.push(boid);
            }
            this.teamCounts[team] = (this.teamCounts[team] || 0) + enemiesPerTeam;
        });

        if (this.survivalWave >= 2) {
            this.obstacles.spawnForSurvival(this.survivalWave);
        }

        this.waveTimer = this.waveDuration;
        this.audio.playConversion(false);
        this.ui.showWaveAnnouncement(this.survivalWave);
        this.renderer.addFloatingText(`INCOMING WAVE ${this.survivalWave}`, width / 2, height / 2 - 60, '#ff4444', 22);
    }

    // Trigger Doctrine Draft Modal
    promptDoctrineSelect() {
        this.resetHeldInput();
        this.gameState = 'doctrine-select';

        // Pick 3 random doctrines not yet maxed out
        const available = DOCTRINES_CATALOG.filter(d => this.activeDoctrines.filter(a => a.id === d.id).length < 2);
        if (!available.length) { this.gameState = 'playing'; return; }
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        const choices = shuffled.slice(0, 3);

        this.ui.showDoctrineModal(choices, (chosenDoctrine) => {
            this.activeDoctrines.push(chosenDoctrine);
            chosenDoctrine.apply(this);
            this.audio.playDoctrineSelect();
            this.renderer.addFloatingText(`DOCTRINE ACQUIRED: ${chosenDoctrine.name}`, this.canvas.width / 2, 100, '#00ff88', 18);
            this.gameState = 'playing';
            this.ui.hideDoctrineModal();
        });
    }

    pause() {
        this.resetHeldInput();
        this.gameState = 'paused';
        this.ui.showPause();
    }

    resetHeldInput() {
        this.beaconActive = false;
        this.input.mouseDown = false;
        this.input.rightMouseDown = false;
        this.input.freezeAiming = false;
        this.input.pointerId = null;
    }

    resume() {
        this.gameState = 'playing';
        this.ui.hidePause();
    }

    quitToMenu() {
        this.restoreRunTuning();
        this.resetHeldInput();
        this.gameState = 'menu';
        this.ui.showScreen('main-menu');
    }

    victory() {
        this.gameState = 'victory';
        this.audio.playVictory();
        this.ui.showVictory(this.gameTime, this.conversions, this.score);
    }

    defeat() {
        this.gameState = 'defeat';
        this.audio.playDefeat();
        if (this.gameMode === 'survival') {
            this.ui.showSurvivalDefeat(this.survivalWave, this.survivalScore, this.gameTime);
        } else {
            this.ui.showDefeat(this.gameTime, this.peakPlayerCount, CONFIG.boidCount);
        }
    }

    update(deltaTime) {
        if (this.gameState !== 'playing') return;

        this.gameTime += deltaTime;
        this.ui.updateCoach?.();
        this.updateWorld(deltaTime);
        this.releaseSettleTimer = Math.max(0, (this.releaseSettleTimer || 0) - deltaTime);

        // Update rally conversion cool-off
        if (this.beaconActive) {
            this.rallyCoolOffTimer = this.rallyCoolOffDuration;
        } else if (this.rallyCoolOffTimer > 0) {
            this.rallyCoolOffTimer = Math.max(0, this.rallyCoolOffTimer - deltaTime);
        }

        this.empCooldown = Math.max(0, this.empCooldown - deltaTime);
        if (this.freezeField) this.freezeField.remaining = Math.max(0, this.freezeField.remaining - deltaTime);
        for (const boid of this.boids) {
            boid.freezeRemaining = Math.max(0, boid.freezeRemaining - deltaTime);
            boid.frozen = boid.freezeRemaining > 0;
        }

        // Combo decay
        if (this.combo > 0) {
            this.comboTimer -= deltaTime;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        // Update powerups and obstacles

        const destroyedBoids = this.obstacles.update(deltaTime, this.boids);
        if (destroyedBoids.length > 0) {
            this.losses = (this.losses || 0) + destroyedBoids.filter(b => b.team === this.playerTeam).length;
            this.boids = this.boids.filter(b => !destroyedBoids.includes(b));
            for (const boid of destroyedBoids) {
                const teamData = TEAMS[boid.team];
                if (teamData) {
                    this.spawnConversionParticles(boid.pos.x, boid.pos.y, teamData.colorRgb);
                }
            }
        }

        // Screen shake decay
        if (this.screenShake > 0) {
            this.screenShake -= deltaTime * 2.8;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        // Particles update
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vx *= 0.96;
            p.vy *= 0.96;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        // QuadTree spatial partitioning
        const boundary = new Rectangle(width / 2, height / 2, width / 2, height / 2);
        this.quadTree = new QuadTree(boundary, 4);
        for (let i = 0; i < this.boids.length; i++) {
            this.quadTree.insert(this.boids[i]);
        }

        const queryRadius = Math.max(CONFIG.perceptionRadius, CONFIG.separationRadius, CONFIG.conversionRadius);
        const beaconPos = this.input.mousePos;
        const beaconRad = CONFIG.beaconRadius || 180;
        const beaconRadSq = beaconRad * beaconRad;

        // Reset team counts
        const teamIds = Object.keys(TEAMS);
        this.teamCounts = {};
        for (const id of teamIds) this.teamCounts[id] = 0;

        // Process each boid
        for (let i = 0; i < this.boids.length; i++) {
            const boid = this.boids[i];
            const isPlayer = (boid.team === this.playerTeam);

            // Let beginners make the first move; practice targets stay in place.
            if (this.practice && !this.ui.coachHeld) {
                this.teamCounts[boid.team]++;
                continue;
            }

            // Spatial query
            const range = new Circle(boid.pos.x, boid.pos.y, queryRadius);
            const neighbors = this.quadTree.query(range);

            // Flocking
            boid.flock(neighbors, this.difficultyMod, !isPlayer);

            // Beacon Influence
            if (this.beaconActive) {
                const distSq = boid.pos.distSq(beaconPos);
                if (isPlayer) {
                    // Friendly boids actively maneuver towards beacon
                    const rally = boid.rallyTowardsBeacon(beaconPos, CONFIG.beaconAttractForce || 1.5);
                    boid.applyForce(rally);
                } else if (distSq < beaconRadSq) {
                    // Enemies inside the beacon are disrupted/repelled
                    const repel = boid.fleePoint(beaconPos, CONFIG.beaconRepelEnemies || 0.8, CONFIG.maxSpeed * 0.8);
                    boid.applyForce(repel);
                }
            }

            // Keep the released formation together briefly so surrounding feels intentional.
            if (!this.beaconActive && isPlayer && this.releaseSettleTimer > 0) {
                boid.applyForce(boid.rallyTowardsBeacon(this.releaseTarget, 0.7));
            }

            // Magnet powerup


            // Check conversion
            const isShielded = false;
            if (!isShielded && !(this.practice && isPlayer && !this.tutorial?.lesson.live) && (!this.practice || isPlayer || this.tutorial?.allowsConversion())) {
                const convertingTeam = this.checkMultiTeamConversion(boid, neighbors);
                if (convertingTeam) {
                    const wasEnemy = (boid.team !== this.playerTeam);
                    const nowPlayer = (convertingTeam === this.playerTeam);

                    if (this.practice && nowPlayer && wasEnemy) this.tutorial?.recordConversion(boid.frozen);
                    boid.convert(convertingTeam);
                    this.conversions++;

                    if (nowPlayer) {
                        this.combo++;
                        this.comboTimer = 2.4; // 2.4 seconds to keep combo alive
                        const comboBonus = Math.min(10, this.combo);
                        const pts = 100 * comboBonus;
                        this.score += pts;

                        this.audio.playConversion(true, comboBonus);
                        this.renderer.addFloatingText(`+${pts}${comboBonus > 1 ? ` (${comboBonus}x)` : ''}`, boid.pos.x, boid.pos.y - 12, '#00ffff', 12 + Math.min(10, comboBonus));

                        if (comboBonus === 5) {
                            this.renderer.addFloatingText('CHAIN REACTION', boid.pos.x, boid.pos.y - 35, '#ffaa00', 16);
                        } else if (this.combo === 10) {
                            this.renderer.addFloatingText('ONE UNSTOPPABLE SWARM', boid.pos.x, boid.pos.y - 35, '#ff00ff', 18);
                        }

                        // Chain defection doctrine
                        if (this.chainAssimilation) {
                            const nextNeighbor = neighbors.find(n => n !== boid && n.team !== this.playerTeam);
                            if (nextNeighbor) {
                                nextNeighbor.conversionPressure += Math.floor(CONFIG.peerPressureTime * 0.5);
                            }
                        }
                    } else {
                        this.audio.playConversion(false);
                    }

                    this.spawnConversionParticles(boid.pos.x, boid.pos.y, TEAMS[convertingTeam].colorRgb);
                }
            }

            // Motion update
            const teamSpeedMult = 1;
            const baseMult = isPlayer ? 1 : this.difficultyMod.enemySpeed;
            if (!this.practice || this.tutorial?.lesson.live || isPlayer || boid.team === this.playerTeam || (boid.freezeRemaining <= 0 && boid.frozen)) {
                boid.update(width, height, this.difficultyMod, teamSpeedMult * baseMult);
            } else {
                boid.acc.x = 0;
                boid.acc.y = 0;
            }

            this.teamCounts[boid.team]++;
        }

        // Track peak player strength
        const playerTeamCount = this.teamCounts[this.playerTeam] || 0;
        this.peakPlayerCount = Math.max(this.peakPlayerCount, playerTeamCount);

        // HUD Update
        this.ui.updateHUD(this.teamCounts, this.playerTeam, this.gameTime, this.score, this.combo);
        this.ui.updateAbilitiesHUD(
            this.empCooldown, this.empCooldownMax,
            this.beaconActive, this.rallyCoolOffTimer, this.rallyCoolOffDuration
        );

        // Survival wave check
        if (this.gameMode === 'survival') {
            this.waveTimer -= deltaTime;
            const enemyCount = this.boids.filter(b => b.team !== this.playerTeam).length;

            this.ui.updateSurvivalHUD(this.survivalWave, this.score, this.waveTimer, playerTeamCount, this.teamCounts);

            if (this.waveTimer <= 0 || (this.waveInProgress && enemyCount === 0)) {
                this.waveInProgress = false;
                this.score += this.survivalWave * 250 + playerTeamCount * 25;

                // Prompt doctrine card draft every 2 waves!
                if (this.survivalWave > 0 && this.survivalWave % 2 === 0) {
                    this.promptDoctrineSelect();
                }

                this.spawnSurvivalWave();
            }
        }

        // Conquest mode milestone check for doctrines
        if (['conquest','levels'].includes(this.gameMode) && !this.practice) {
            const totalUnits = this.boids.length;
            if (totalUnits > 0) {
                const ratio = playerTeamCount / totalUnits;
                if (ratio >= this.nextConquestMilestone && this.nextConquestMilestone < 0.9) {
                    this.nextConquestMilestone += 0.25;
                    this.promptDoctrineSelect();
                }
            }
        }

        // Check win/lose
        const aliveTeams = teamIds.filter(id => this.teamCounts[id] > 0);
        if (this.gameMode === 'zen') {
            this.replenishZen();
        } else if (playerTeamCount === 0) {
            this.defeat();
        } else if (this.practice && this.tutorial) {
            this.tutorial.update();
        } else if (['conquest','levels'].includes(this.gameMode) && aliveTeams.length === 1 && aliveTeams[0] === this.playerTeam) {
            this.victory();
        }
    }

    checkMultiTeamConversion(boid, neighbors) {
        if (boid.conversionCooldown > 0) {
            boid.conversionCooldown--;
            return null;
        }

        const teamCounts = {};
        let nearestEnemyBoid = null;
        let nearestDistSq = Infinity;

        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other !== boid) {
                teamCounts[other.team] = (teamCounts[other.team] || 0) + 1;

                if (other.team !== boid.team) {
                    const dSq = boid.pos.distSq(other.pos);
                    if (dSq < nearestDistSq) {
                        nearestDistSq = dSq;
                        nearestEnemyBoid = other;
                    }
                }
            }
        }

        const sameTeamCount = teamCounts[boid.team] || 0;
        const learning = this.practice && !this.tutorial?.lesson.live;
        const threshold = learning ? 2 : CONFIG.conversionThreshold;

        // Check resistance modifier (Player bonus from doctrines and team perks)
        let resistMod = 1.0;
        if (boid.team === this.playerTeam) {
            resistMod = this.playerResistBonus * (TEAMS[this.playerTeam].resistMult || 1.0);
            // VULNERABILITY IN TRANSIT: When player is rallying or in cool-off, friendly units take +25% conversion pressure!
            if (this.beaconActive || this.rallyCoolOffTimer > 0) {
                resistMod *= 0.75;
            }
        } else {
            resistMod = this.difficultyMod.conversionResist * (TEAMS[boid.team]?.resistMult || 1.0);
        }

        if (learning && boid.team !== this.playerTeam) resistMod *= 0.55;
        let dominantTeam = null;
        let dominantCount = 0;
        for (const [team, count] of Object.entries(teamCounts)) {
            if (team !== boid.team && count > dominantCount) {
                dominantCount = count;
                dominantTeam = team;
            }
        }

        // RALLY DISARM: If the dominant team is player's team, but player is rallying or in cool-off, player CANNOT convert!
        if (dominantTeam === this.playerTeam && (this.beaconActive || this.rallyCoolOffTimer > 0)) {
            boid.conversionPressure = Math.max(0, boid.conversionPressure - 2);
            if (boid.conversionPressure === 0) {
                boid.conversionSource = null;
            }
            return null; // DISARMED: Conversion offline while rallying/cooling off
        }

        if (dominantTeam && dominantCount >= threshold && dominantCount > sameTeamCount * resistMod) {
            boid.conversionSource = nearestEnemyBoid;
            boid.conversionPressure += 1;

            if (boid.conversionPressure >= CONFIG.peerPressureTime * (learning ? 0.5 : 1)) {
                return dominantTeam;
            }
        } else {
            boid.conversionPressure = Math.max(0, boid.conversionPressure - 1.5);
            if (boid.conversionPressure === 0) {
                boid.conversionSource = null;
            }
        }

        return null;
    }

    gameLoop(currentTime) {
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Boid steering is tuned at 60 Hz; keep play identical on fast displays.
        if (this.gameState === 'playing') {
            this.physicsAccumulator = (this.physicsAccumulator || 0) + deltaTime;
            while (this.physicsAccumulator >= 1 / 60 && this.gameState === 'playing') {
                this.update(1 / 60);
                this.physicsAccumulator -= 1 / 60;
            }
        } else this.physicsAccumulator = 0;
        this.renderer.render(
            this.boids,
            this.input.mousePos,
            this.beaconActive,
            this.gameState,
            this.powerups,
            this.particles,
            this.screenShake,
            this.empCooldown,
            this.empCooldownMax,
            this.playerTeam,
            this.obstacles,
            deltaTime,
            this.rallyCoolOffTimer,
            this.rallyCoolOffDuration
        );

        this.drawWorld();
        if (this.practice && this.tutorial) this.tutorial.drawTarget(this.renderer.ctx);
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    spawnConversionParticles(x, y, colorRgb) {
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
            const speed = 60 + Math.random() * 120;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8,
                colorRgb,
                size: 3 + Math.random() * 3
            });
        }
        this.screenShake = Math.max(this.screenShake, 0.2);
    }
}

Object.assign(Game.prototype, WorldMethods);
