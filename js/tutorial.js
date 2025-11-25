// Tutorial Mode - Staged learning experience inspired by Dune's "desert power"
import { CONFIG, TEAMS, DIFFICULTY_MODS } from './config.js';
import { Boid } from './boid.js';
import { Vector } from './vector.js';
import { Renderer } from './renderer.js';
import { QuadTree, Rectangle, Circle } from './quadtree.js';

// Tutorial stages - Dune-inspired progression
const TUTORIAL_STAGES = [
    {
        id: 1,
        title: "THE SWARM AWAKENS",
        description: "On Arrakis, the Fremen learned that numbers alone do not win battles. But overwhelming force... that is another matter entirely.",
        objective: "Convert all 5 enemy units using your swarm of 30",
        hint: "Your boids will automatically convert enemies when they surround them. Watch the conversion happen!",
        completeMessage: "Excellent. You understand the basic doctrine: surround and convert.",
        setup: (tutorial) => {
            // Player gets 30 boids, enemy gets 5 static ones
            tutorial.spawnPlayerBoids(30, 0.3, 0.5);
            tutorial.spawnEnemyBoids(5, 0.7, 0.5, true); // static = true
        },
        checkComplete: (tutorial) => {
            return tutorial.getEnemyCount() === 0;
        }
    },
    {
        id: 2,
        title: "THE SCATTER PULSE",
        description: "The sandworm does not chase - it herds. Learn to use the scatter pulse to direct the flow of battle.",
        objective: "Use LEFT CLICK to scatter boids and convert all enemies",
        hint: "Click near enemy groups to scatter them apart, making them easier to surround!",
        completeMessage: "You wield the scatter pulse like a true commander.",
        setup: (tutorial) => {
            // Player gets 25, enemy gets 10 in a tight cluster
            tutorial.spawnPlayerBoids(25, 0.25, 0.5);
            tutorial.spawnEnemyCluster(10, 0.75, 0.5, 50); // clustered enemies
        },
        checkComplete: (tutorial) => {
            return tutorial.getEnemyCount() === 0;
        }
    },
    {
        id: 3,
        title: "DIVIDE AND CONQUER",
        description: "A single enemy formation is strong. But split them, isolate them, and they fall like sand through fingers.",
        objective: "Split the enemy formation and convert all units",
        hint: "Use scatter to break the enemy group into smaller pieces, then let your swarm pick them off!",
        completeMessage: "Divide et impera. The ancient wisdom serves you well.",
        setup: (tutorial) => {
            // Player gets 20, enemy gets 15 in a line formation
            tutorial.spawnPlayerBoids(20, 0.2, 0.5);
            tutorial.spawnEnemyLine(15, 0.7, 0.3, 0.7); // vertical line
        },
        checkComplete: (tutorial) => {
            return tutorial.getEnemyCount() === 0;
        }
    },
    {
        id: 4,
        title: "MULTI-FRONT WARFARE",
        description: "The spice must flow from all directions. So too must your forces learn to fight on multiple fronts.",
        objective: "Defeat enemies from two different armies",
        hint: "Focus on one group at a time. Overwhelming local superiority wins battles!",
        completeMessage: "You have learned to manage chaos. Two fronts, one victory.",
        setup: (tutorial) => {
            // Player gets 25, two enemy teams of 8 each
            tutorial.spawnPlayerBoids(25, 0.5, 0.5);
            tutorial.spawnEnemyBoids(8, 0.15, 0.3, false, 'salamander');
            tutorial.spawnEnemyBoids(8, 0.85, 0.7, false, 'phoenix');
        },
        checkComplete: (tutorial) => {
            return tutorial.getEnemyCount() === 0;
        }
    },
    {
        id: 5,
        title: "THE FINAL TEST",
        description: "Now you face a true challenge. The enemy is numerous, but you have the doctrine. Show them the meaning of swarm warfare.",
        objective: "Achieve total victory against a larger enemy force",
        hint: "Stay calm. Use scatter strategically. Pick off isolated units. Victory will come.",
        completeMessage: "You have completed your training. The enemy's gate is down.",
        setup: (tutorial) => {
            // Player gets 20, enemies get 25 total but spread out
            tutorial.spawnPlayerBoids(20, 0.5, 0.5);
            tutorial.spawnEnemyBoids(7, 0.15, 0.15, false, 'salamander');
            tutorial.spawnEnemyBoids(6, 0.85, 0.15, false, 'phoenix');
            tutorial.spawnEnemyBoids(6, 0.15, 0.85, false, 'rat');
            tutorial.spawnEnemyBoids(6, 0.85, 0.85, false, 'salamander');
        },
        checkComplete: (tutorial) => {
            return tutorial.getEnemyCount() === 0;
        }
    }
];

export class TutorialMode {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('tutorial-canvas');
        this.renderer = new Renderer(this.canvas);
        
        this.boids = [];
        this.quadTree = null;
        this.currentStage = 0;
        this.isPlaying = false;
        this.gameTime = 0;
        this.playerTeam = 'dragon';
        
        // Scatter mechanic
        this.scatterCooldown = 0;
        this.scatterCooldownMax = 1.2;
        this.scatterActive = false;
        this.scatterDuration = 0.25;
        
        // Mouse state
        this.mousePos = new Vector();
        this.mouseDown = false;
        
        // Particles
        this.particles = [];
        this.screenShake = 0;
        
        // Difficulty (easier for tutorial)
        this.difficultyMod = DIFFICULTY_MODS.easy;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Canvas mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos = new Vector(e.clientX, e.clientY);
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.isPlaying) {
                this.mouseDown = true;
                // Activate scatter while mouse is held
                if (this.scatterCooldown <= 0) {
                    this.scatterActive = true;
                    this.game.audio.playScatter();
                }
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
                // Deactivate scatter and start cooldown when mouse released
                if (this.scatterActive) {
                    this.scatterActive = false;
                    this.scatterCooldown = this.scatterCooldownMax;
                }
            }
        });
        
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // UI buttons
        document.getElementById('btn-start-interactive-tutorial').addEventListener('click', () => {
            this.game.audio.playClick();
            this.start();
        });
        
        document.getElementById('btn-tutorial-start-stage').addEventListener('click', () => {
            this.game.audio.playClick();
            this.startCurrentStage();
        });
        
        document.getElementById('btn-tutorial-next').addEventListener('click', () => {
            this.game.audio.playClick();
            this.nextStage();
        });
        
        document.getElementById('btn-tutorial-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.quit();
        });
        
        document.getElementById('btn-tutorial-to-conquest').addEventListener('click', () => {
            this.game.audio.playClick();
            this.goToConquest();
        });
        
        document.getElementById('btn-tutorial-to-menu').addEventListener('click', () => {
            this.game.audio.playClick();
            this.quit();
        });
    }
    
    start() {
        this.currentStage = 0;
        this.showScreen('interactive-tutorial-screen');
        this.renderer.resize();
        this.showStageIntro();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }
    
    showStageIntro() {
        const stage = TUTORIAL_STAGES[this.currentStage];
        
        document.getElementById('tutorial-stage-num').textContent = stage.id;
        document.getElementById('tutorial-stage-title').textContent = stage.title;
        document.getElementById('tutorial-stage-desc').textContent = stage.description;
        document.getElementById('tutorial-objective-text').textContent = stage.objective;
        
        document.getElementById('tutorial-stage-overlay').classList.remove('hidden');
        document.getElementById('tutorial-hud').classList.add('hidden');
        document.getElementById('tutorial-complete-overlay').classList.add('hidden');
        document.getElementById('tutorial-final-overlay').classList.add('hidden');
        
        // Update progress
        const progress = ((this.currentStage) / TUTORIAL_STAGES.length) * 100;
        document.getElementById('tutorial-progress-fill').style.width = `${progress}%`;
        document.getElementById('tutorial-progress-text').textContent = `Stage ${this.currentStage + 1}/${TUTORIAL_STAGES.length}`;
    }
    
    startCurrentStage() {
        const stage = TUTORIAL_STAGES[this.currentStage];
        
        // Reset state
        this.boids = [];
        this.particles = [];
        this.gameTime = 0;
        this.scatterCooldown = 0;
        this.scatterActive = false;
        
        // Setup stage
        stage.setup(this);
        
        // Show HUD, hide intro
        document.getElementById('tutorial-stage-overlay').classList.add('hidden');
        document.getElementById('tutorial-hud').classList.remove('hidden');
        document.getElementById('tutorial-hint-text').textContent = stage.hint;
        
        this.isPlaying = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    // Spawn helpers
    spawnPlayerBoids(count, xRatio, yRatio, spread = 80) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width * xRatio;
        const centerY = height * yRatio;
        
        for (let i = 0; i < count; i++) {
            const x = centerX + (Math.random() - 0.5) * spread;
            const y = centerY + (Math.random() - 0.5) * spread;
            this.boids.push(new Boid(x, y, this.playerTeam));
        }
    }
    
    spawnEnemyBoids(count, xRatio, yRatio, isStatic = false, team = 'salamander') {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width * xRatio;
        const centerY = height * yRatio;
        
        for (let i = 0; i < count; i++) {
            const x = centerX + (Math.random() - 0.5) * 60;
            const y = centerY + (Math.random() - 0.5) * 60;
            const boid = new Boid(x, y, team);
            if (isStatic) {
                boid.vel = new Vector(0, 0);
                boid.isStatic = true;
            }
            this.boids.push(boid);
        }
    }
    
    spawnEnemyCluster(count, xRatio, yRatio, radius) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width * xRatio;
        const centerY = height * yRatio;
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const r = radius * 0.3 + Math.random() * radius * 0.7;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            this.boids.push(new Boid(x, y, 'salamander'));
        }
    }
    
    spawnEnemyLine(count, xRatio, yStartRatio, yEndRatio) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const x = width * xRatio;
        
        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const y = height * (yStartRatio + t * (yEndRatio - yStartRatio));
            const boid = new Boid(x + (Math.random() - 0.5) * 20, y, 'salamander');
            this.boids.push(boid);
        }
    }
    
    getPlayerCount() {
        return this.boids.filter(b => b.team === this.playerTeam).length;
    }
    
    getEnemyCount() {
        return this.boids.filter(b => b.team !== this.playerTeam).length;
    }
    
    update(deltaTime) {
        if (!this.isPlaying) return;
        
        this.gameTime += deltaTime;
        
        // Update scatter cooldown
        if (this.scatterCooldown > 0) {
            this.scatterCooldown -= deltaTime;
        }
        
        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake -= deltaTime * 10;
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vx *= 0.98;
            p.vy *= 0.98;
            return p.life > 0;
        });
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Build QuadTree
        const boundary = new Rectangle(width / 2, height / 2, width / 2, height / 2);
        this.quadTree = new QuadTree(boundary, 4);
        for (const boid of this.boids) {
            this.quadTree.insert(boid);
        }
        
        const queryRadius = Math.max(CONFIG.perceptionRadius, CONFIG.separationRadius, CONFIG.conversionRadius);
        const mouseX = this.mousePos.x;
        const mouseY = this.mousePos.y;
        const influenceRadiusSq = (CONFIG.influenceRadius * 1.5) ** 2;
        
        // Update boids
        for (const boid of this.boids) {
            const isPlayerTeam = boid.team === this.playerTeam;
            
            // Query neighbors
            const range = new Circle(boid.pos.x, boid.pos.y, queryRadius);
            const neighbors = this.quadTree.query(range);
            
            // Skip flocking for static boids
            if (!boid.isStatic) {
                boid.flock(neighbors, this.difficultyMod, !isPlayerTeam);
            }
            
            // Scatter effect
            if (this.scatterActive) {
                const dx = boid.pos.x - mouseX;
                const dy = boid.pos.y - mouseY;
                if (dx * dx + dy * dy < influenceRadiusSq) {
                    const force = boid.fleeMouse(this.mousePos);
                    boid.applyForce(force);
                    // Unstick static boids when scattered
                    if (boid.isStatic) {
                        boid.isStatic = false;
                    }
                }
            }
            
            // Check conversion
            const conversionResult = this.checkConversion(boid, neighbors);
            if (conversionResult) {
                boid.convert(conversionResult);
                this.game.audio.playConversion(conversionResult === this.playerTeam);
                this.spawnConversionParticles(boid.pos.x, boid.pos.y, TEAMS[conversionResult].colorRgb);
            }
            
            // Update position
            if (!boid.isStatic) {
                const speedMult = isPlayerTeam ? 1 : this.difficultyMod.enemySpeed;
                boid.update(width, height, this.difficultyMod, speedMult);
            }
        }
        
        // Update HUD
        document.getElementById('tutorial-your-count').textContent = this.getPlayerCount();
        document.getElementById('tutorial-enemy-count').textContent = this.getEnemyCount();
        
        // Check stage completion
        const stage = TUTORIAL_STAGES[this.currentStage];
        if (stage.checkComplete(this)) {
            this.completeStage();
        }
        
        // Check defeat
        if (this.getPlayerCount() === 0) {
            this.failStage();
        }
    }
    
    checkConversion(boid, neighbors) {
        if (boid.conversionCooldown > 0) {
            boid.conversionCooldown--;
            return null;
        }
        
        const teamCounts = {};
        for (const other of neighbors) {
            if (other !== boid) {
                teamCounts[other.team] = (teamCounts[other.team] || 0) + 1;
            }
        }
        
        const sameTeamCount = teamCounts[boid.team] || 0;
        const threshold = CONFIG.conversionThreshold;
        
        let dominantTeam = null;
        let dominantCount = 0;
        
        for (const [team, count] of Object.entries(teamCounts)) {
            if (team !== boid.team && count > dominantCount) {
                dominantCount = count;
                dominantTeam = team;
            }
        }
        
        // Easier conversion in tutorial
        if (dominantTeam && dominantCount >= threshold && dominantCount > sameTeamCount * 0.8) {
            boid.conversionPressure += 1.5; // Faster conversion in tutorial
            
            if (boid.conversionPressure >= CONFIG.peerPressureTime * 0.7) {
                return dominantTeam;
            }
        } else {
            boid.conversionPressure = Math.max(0, boid.conversionPressure - 2);
        }
        
        return null;
    }
    
    spawnConversionParticles(x, y, colorRgb) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 50 + Math.random() * 100;
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
        this.screenShake = 0.3;
    }
    
    completeStage() {
        this.isPlaying = false;
        const stage = TUTORIAL_STAGES[this.currentStage];
        
        document.getElementById('tutorial-complete-message').textContent = stage.completeMessage;
        document.getElementById('tutorial-complete-overlay').classList.remove('hidden');
        
        this.game.audio.playVictory();
    }
    
    failStage() {
        this.isPlaying = false;
        // Just restart the stage
        document.getElementById('tutorial-hint-text').textContent = "Your fleet was eliminated. Try again!";
        setTimeout(() => {
            this.startCurrentStage();
        }, 1500);
    }
    
    nextStage() {
        this.currentStage++;
        
        if (this.currentStage >= TUTORIAL_STAGES.length) {
            // Tutorial complete!
            document.getElementById('tutorial-complete-overlay').classList.add('hidden');
            document.getElementById('tutorial-final-overlay').classList.remove('hidden');
        } else {
            document.getElementById('tutorial-complete-overlay').classList.add('hidden');
            this.showStageIntro();
        }
    }
    
    quit() {
        this.isPlaying = false;
        this.showScreen('main-menu');
    }
    
    goToConquest() {
        this.isPlaying = false;
        this.game.showTeamSelect('conquest');
    }
    
    gameLoop() {
        if (!this.isPlaying) {
            // Still render even when paused
            this.render();
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        const cappedDelta = Math.min(deltaTime, 0.1);
        
        this.update(cappedDelta);
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
        this.renderer.render(
            this.boids,
            this.mousePos,
            this.mouseDown,
            false, // rightMouseDown
            'playing',
            null, // powerups
            this.particles,
            this.screenShake,
            this.scatterCooldown,
            this.scatterCooldownMax,
            this.scatterActive,
            this.playerTeam,
            null // obstacles
        );
    }
}
