// Main Game Class - Orchestrates all systems
import { CONFIG, DIFFICULTY_MODS, TEAMS } from './config.js';
import { AudioSystem } from './audio.js';
import { Boid } from './boid.js';
import { Vector } from './vector.js';
import { UIManager } from './ui.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { QuadTree, Rectangle, Circle } from './quadtree.js';
import { PowerupManager } from './powerup.js';
import { ObstacleManager } from './obstacles.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        
        // Initialize systems
        this.audio = new AudioSystem();
        this.renderer = new Renderer(this.canvas);
        this.ui = new UIManager(this);
        this.input = new InputHandler(this.canvas, this);
        
        // Game state
        this.boids = [];
        this.quadTree = null;
        this.gameState = 'menu'; // menu, team-select, playing, paused, victory, defeat
        this.gameTime = 0;
        this.conversions = 0;
        this.peakPlayerCount = 0;
        this.recentConversions = [];
        this.difficultyMod = DIFFICULTY_MODS.medium;
        this.playerTeam = 'dragon'; // Selected team
        this.teamCounts = {}; // Track counts per team
        this.scatterCooldown = 0; // Cooldown for scatter ability
        this.scatterCooldownMax = 0.5; // 0.5 second cooldown (very short)
        this.scatterActive = false; // Is scatter currently happening
        this.scatterDuration = 2.6; // How long scatter lasts (longer burst)
        
        // Powerup system
        this.powerups = new PowerupManager(this);
        
        // Obstacle system
        this.obstacles = new ObstacleManager(this);
        
        // Visual effects
        this.particles = [];
        this.screenShake = 0;
        
        // Game mode
        this.gameMode = 'conquest'; // 'conquest' or 'survival'
        
        // Survival mode state
        this.survivalWave = 0;
        this.survivalScore = 0;
        this.waveTimer = 0;
        this.waveDuration = 30; // Seconds between waves
        this.enemiesThisWave = 0;
        this.waveInProgress = false;
        
        // Setup
        this.renderer.resize();
        this.ui.setup();
        window.addEventListener('resize', () => this.renderer.resize());
        
        // Start game loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    showTeamSelect(mode = 'conquest') {
        this.gameMode = mode;
        this.gameState = 'team-select';
        this.ui.showScreen('team-select-screen');
    }
    
    selectTeam(teamId) {
        this.playerTeam = teamId;
        if (this.gameMode === 'survival') {
            this.startSurvivalMode();
        } else {
            this.startGame();
        }
    }
    
    // Add a boid (used by clone powerup)
    addBoid(x, y, team) {
        const newBoid = new Boid(x, y, team);
        this.boids.push(newBoid);
        return newBoid;
    }
    
    startSurvivalMode() {
        this.boids = [];
        this.gameTime = 0;
        this.conversions = 0;
        this.survivalWave = 0;
        this.survivalScore = 0;
        this.waveTimer = 5; // First wave after 5 seconds
        this.waveInProgress = false;
        this.teamCounts = {};
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Spawn player boids in center
        const startCount = 20;
        for (let i = 0; i < startCount; i++) {
            const x = width / 2 + (Math.random() - 0.5) * 100;
            const y = height / 2 + (Math.random() - 0.5) * 100;
            this.boids.push(new Boid(x, y, this.playerTeam));
        }
        this.teamCounts[this.playerTeam] = startCount;
        this.peakPlayerCount = startCount;
        
        // Reset systems
        this.powerups.reset();
        this.obstacles.reset();
        this.particles = [];
        this.screenShake = 0;
        
        this.gameState = 'playing';
        this.ui.showScreen('game-screen');
        this.ui.hideOverlays();
        this.ui.updateTeamBanner(this.playerTeam);
        this.ui.showSurvivalHUD();
    }
    
    spawnSurvivalWave() {
        this.survivalWave++;
        this.waveInProgress = true;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Determine enemy count based on wave
        const baseEnemies = 10 + this.survivalWave * 5;
        const enemyCount = Math.min(baseEnemies, 60);
        this.enemiesThisWave = enemyCount;
        
        // Pick 1-3 enemy teams based on wave
        const enemyTeams = Object.keys(TEAMS).filter(t => t !== this.playerTeam);
        const activeEnemyCount = Math.min(1 + Math.floor(this.survivalWave / 3), enemyTeams.length);
        const activeEnemies = enemyTeams.slice(0, activeEnemyCount);
        
        // Spawn enemies from edges
        const spawnEdges = [
            { x: 0, y: 0.5, dx: 1, dy: 0 },      // Left
            { x: 1, y: 0.5, dx: -1, dy: 0 },     // Right
            { x: 0.5, y: 0, dx: 0, dy: 1 },      // Top
            { x: 0.5, y: 1, dx: 0, dy: -1 }      // Bottom
        ];
        
        const enemiesPerTeam = Math.floor(enemyCount / activeEnemies.length);
        
        activeEnemies.forEach((team, teamIndex) => {
            const edge = spawnEdges[teamIndex % spawnEdges.length];
            for (let i = 0; i < enemiesPerTeam; i++) {
                const spread = 0.3;
                const x = (edge.x + (Math.random() - 0.5) * spread * (1 - Math.abs(edge.dx))) * width;
                const y = (edge.y + (Math.random() - 0.5) * spread * (1 - Math.abs(edge.dy))) * height;
                const boid = new Boid(x, y, team);
                // Give initial velocity towards center
                boid.vel.x = edge.dx * CONFIG.maxSpeed * 0.5;
                boid.vel.y = edge.dy * CONFIG.maxSpeed * 0.5;
                this.boids.push(boid);
            }
            this.teamCounts[team] = (this.teamCounts[team] || 0) + enemiesPerTeam;
        });
        
        // Spawn obstacles on later waves
        if (this.survivalWave >= 2) {
            this.obstacles.spawnForSurvival(this.survivalWave);
        }
        
        // Reset wave timer
        this.waveTimer = this.waveDuration;
        
        // Play wave sound
        this.audio.playConversion(false);
        
        // Update UI
        this.ui.showWaveAnnouncement(this.survivalWave);
    }
    
    startGame() {
        this.boids = [];
        this.gameTime = 0;
        this.conversions = 0;
        this.peakPlayerCount = 0;
        this.recentConversions = [];
        this.teamCounts = {};
        
        const teamIds = Object.keys(TEAMS);
        const boidsPerTeam = Math.floor(CONFIG.boidCount / teamIds.length);
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Spawn positions for 4 teams (corners)
        const spawnAreas = [
            { x: 0.15, y: 0.15 },   // Top-left
            { x: 0.85, y: 0.15 },   // Top-right
            { x: 0.15, y: 0.85 },   // Bottom-left
            { x: 0.85, y: 0.85 }    // Bottom-right
        ];
        
        teamIds.forEach((teamId, index) => {
            const spawn = spawnAreas[index];
            for (let i = 0; i < boidsPerTeam; i++) {
                const x = (spawn.x + (Math.random() - 0.5) * 0.2) * width;
                const y = (spawn.y + (Math.random() - 0.5) * 0.2) * height;
                this.boids.push(new Boid(x, y, teamId));
            }
            this.teamCounts[teamId] = boidsPerTeam;
        });
        
        this.peakPlayerCount = boidsPerTeam;
        this.gameState = 'playing';
        this.ui.showScreen('game-screen');
        this.ui.hideOverlays();
        this.ui.updateTeamBanner(this.playerTeam);
        this.ui.createFleetBars(teamIds, this.playerTeam);
        
        // Reset powerups and obstacles
        this.powerups.reset();
        this.obstacles.reset();
        this.particles = [];
        this.screenShake = 0;
        
        // Spawn initial obstacles for conquest mode
        this.obstacles.spawnForConquest();
        this.obstacleTimer = 30; // Spawn new obstacles every 30 seconds
    }
    
    pause() {
        this.gameState = 'paused';
        this.ui.showPause();
    }
    
    resume() {
        this.gameState = 'playing';
        this.ui.hidePause();
    }
    
    quitToMenu() {
        this.gameState = 'menu';
        this.ui.showScreen('main-menu');
    }
    
    victory() {
        this.gameState = 'victory';
        this.audio.playVictory();
        this.ui.showVictory(this.gameTime, this.conversions);
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
        
        // Track conversions per second
        this.recentConversions = this.recentConversions.filter(t => this.gameTime - t < 1);
        
        // Reset team counts
        const teamIds = Object.keys(TEAMS);
        this.teamCounts = {};
        teamIds.forEach(id => this.teamCounts[id] = 0);
        
        // Update scatter cooldown
        if (this.scatterCooldown > 0) {
            this.scatterCooldown -= deltaTime;
        }
        
        // Update powerups
        this.powerups.update(deltaTime, this.boids, this.playerTeam);
        
        // Update obstacles and remove destroyed boids
        const destroyedBoids = this.obstacles.update(deltaTime, this.boids);
        if (destroyedBoids.length > 0) {
            this.boids = this.boids.filter(b => !destroyedBoids.includes(b));
            // Spawn death particles for destroyed boids
            for (const boid of destroyedBoids) {
                const teamData = TEAMS[boid.team];
                if (teamData) {
                    this.spawnConversionParticles(boid.pos.x, boid.pos.y, teamData.colorRgb);
                }
            }
        }
        
        // Survival mode wave logic
        if (this.gameMode === 'survival') {
            this.waveTimer -= deltaTime;
            
            // Spawn new wave when timer runs out or all enemies defeated
            const enemyCount = this.boids.filter(b => b.team !== this.playerTeam).length;
            if (this.waveTimer <= 0 || (this.waveInProgress && enemyCount === 0)) {
                // Award score for surviving wave
                if (this.waveInProgress && enemyCount === 0) {
                    this.survivalScore += this.survivalWave * 100 + (this.teamCounts[this.playerTeam] || 0) * 10;
                }
                this.spawnSurvivalWave();
            }
        }
        
        // Conquest mode obstacle refresh
        if (this.gameMode === 'conquest' && this.obstacleTimer !== undefined) {
            this.obstacleTimer -= deltaTime;
            if (this.obstacleTimer <= 0) {
                this.obstacles.refreshForConquest();
                this.obstacleTimer = 30; // Reset timer
            }
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
        
        // Build QuadTree for spatial partitioning
        const boundary = new Rectangle(width / 2, height / 2, width / 2, height / 2);
        this.quadTree = new QuadTree(boundary, 4);
        for (const boid of this.boids) {
            this.quadTree.insert(boid);
        }
        
        // Use the largest radius for neighbor queries
        const queryRadius = Math.max(CONFIG.perceptionRadius, CONFIG.separationRadius, CONFIG.conversionRadius);
        
        // Cache values outside loop
        const mouseX = this.input.mousePos.x;
        const mouseY = this.input.mousePos.y;
        const influenceRadiusSq = (CONFIG.influenceRadius * 1.5) ** 2;
        
        // Update all boids
        for (const boid of this.boids) {
            const isPlayerTeam = boid.team === this.playerTeam;
            
            // Query neighbors from QuadTree - single query for both flocking and conversion
            const range = new Circle(boid.pos.x, boid.pos.y, queryRadius);
            const neighbors = this.quadTree.query(range);
            
            // Apply flocking behavior with pre-queried neighbors
            boid.flock(neighbors, this.difficultyMod, !isPlayerTeam);
            
            // Apply powerup effects (magnet for any team that has it)
            const magnetForce = this.powerups.getMagnetForce(boid, boid.team);
            boid.applyForce(magnetForce);
            
            // Player influence - scatter from left mouse (affects ALL boids)
            if (this.scatterActive) {
                const dx = boid.pos.x - mouseX;
                const dy = boid.pos.y - mouseY;
                const distSq = dx * dx + dy * dy;
                if (distSq < influenceRadiusSq) {
                    const force = boid.fleeMouse(this.input.mousePos);
                    boid.applyForce(force);
                }
            }
            
            // Check for conversion - reuse neighbors (already includes conversion radius)
            // Skip if this boid's team has shield active
            const isShielded = this.powerups.isShielded(boid.team);
            if (!isShielded) {
                const conversionResult = this.checkMultiTeamConversion(boid, neighbors);
                if (conversionResult) {
                    boid.convert(conversionResult);
                    this.conversions++;
                    this.recentConversions.push(this.gameTime);
                    this.audio.playConversion(conversionResult === this.playerTeam);
                    
                    // Spawn conversion particles
                    this.spawnConversionParticles(boid.pos.x, boid.pos.y, TEAMS[conversionResult].colorRgb);
                }
            }
            
            // Update position with speed powerup for any team that has it
            const teamSpeedMult = this.powerups.getSpeedMultiplier(boid.team);
            const baseMult = isPlayerTeam ? 1 : this.difficultyMod.enemySpeed;
            boid.update(width, height, this.difficultyMod, teamSpeedMult * baseMult);
            
            // Count teams
            this.teamCounts[boid.team]++;
        }
        
        // Track peak for player's team
        this.peakPlayerCount = Math.max(this.peakPlayerCount, this.teamCounts[this.playerTeam] || 0);
        
        // Update HUD
        this.ui.updateHUD(this.teamCounts, this.playerTeam, this.gameTime, this.recentConversions);
        
        // Update survival HUD (after boid counts are calculated)
        if (this.gameMode === 'survival') {
            this.ui.updateSurvivalHUD(this.survivalWave, this.survivalScore, this.waveTimer, this.teamCounts[this.playerTeam] || 0, this.teamCounts);
        }
        
        // Check win/lose conditions
        const playerTeamCount = this.teamCounts[this.playerTeam] || 0;
        const aliveTeams = teamIds.filter(id => this.teamCounts[id] > 0);
        
        // Defeat: player's team is knocked out
        if (playerTeamCount === 0) {
            this.defeat();
        }
        // Victory: monoculture achieved by player's team (conquest mode only)
        else if (this.gameMode === 'conquest' && aliveTeams.length === 1 && aliveTeams[0] === this.playerTeam) {
            this.victory();
        }
    }
    
    // Check if boid should convert based on surrounding teams
    checkMultiTeamConversion(boid, neighbors) {
        if (boid.conversionCooldown > 0) {
            boid.conversionCooldown--;
            return null;
        }
        
        // Count neighbors by team
        const teamCounts = {};
        for (const other of neighbors) {
            if (other !== boid) {
                teamCounts[other.team] = (teamCounts[other.team] || 0) + 1;
            }
        }
        
        const sameTeamCount = teamCounts[boid.team] || 0;
        const threshold = CONFIG.conversionThreshold;
        const resistMod = boid.team !== this.playerTeam ? this.difficultyMod.conversionResist : 1;
        
        // Find the dominant enemy team
        let dominantTeam = null;
        let dominantCount = 0;
        
        for (const [team, count] of Object.entries(teamCounts)) {
            if (team !== boid.team && count > dominantCount) {
                dominantCount = count;
                dominantTeam = team;
            }
        }
        
        // Check if should convert
        if (dominantTeam && dominantCount >= threshold && dominantCount > sameTeamCount * resistMod) {
            boid.conversionPressure += 1;
            
            if (boid.conversionPressure >= CONFIG.peerPressureTime) {
                return dominantTeam;
            }
        } else {
            boid.conversionPressure = Math.max(0, boid.conversionPressure - 2);
        }
        
        return null;
    }
    
    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent huge jumps
        const cappedDelta = Math.min(deltaTime, 0.1);
        
        this.update(cappedDelta);
        this.renderer.render(
            this.boids, 
            this.input.mousePos, 
            this.input.mouseDown, 
            this.input.rightMouseDown,
            this.gameState,
            this.powerups,
            this.particles,
            this.screenShake,
            this.scatterCooldown,
            this.scatterCooldownMax,
            this.scatterActive,
            this.playerTeam,
            this.obstacles
        );
        
        requestAnimationFrame((t) => this.gameLoop(t));
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
}
