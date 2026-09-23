// App controller: owns the current match, the fixed-step loop, player controls
// and the translation of simulation events into sound, effects and score.
import { Simulation, TICK } from './simulation.js';
import { createRules } from './rules.js';
import { ruleOverrides } from './settings.js';
import { TEAMS, DUEL_LOOK, NEUTRAL_LOOK, UPGRADES, UPGRADE_LIMIT } from './catalog.js';
import { AudioSystem } from './audio.js';
import { UIManager } from './ui.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { ModeMethods } from './modes.js';
import { DuelMethods } from './duel.js';

export class Game {
    constructor({ canvas = document.getElementById('game-canvas') } = {}) {
        this.canvas = canvas;
        this.audio = new AudioSystem();
        this.renderer = new Renderer(canvas);
        this.ui = new UIManager(this);
        this.input = new InputHandler(canvas, this);
        this.gameState = 'menu';
        this.gameMode = 'conquest';
        this.playerTeam = 'dragon';
        this.practice = false;
        this.tutorial = null;
        this.level = 1;
        this.mapSeed = null;
        this.rival = null;
        this.renderer.resize();
        this.sim = new Simulation({ width: canvas.width, height: canvas.height });
        this.resetMatchStats();
        this.ui.setup();
        window.addEventListener('resize', () => this.resizeWorld());
        this.lastTime = performance.now();
        this.accumulator = 0;
        requestAnimationFrame(time => this.frame(time));
    }

    get boids() { return this.sim.boids; }
    set boids(list) { this.sim.boids = list; }
    get gameTime() { return this.sim.time; }
    set gameTime(seconds) { this.sim.time = seconds; }
    get rules() { return this.sim.rules; }
    get player() { return this.sim.commander(this.playerTeam); }
    addBoid(x, y, team) { return this.sim.addBoid(x, y, team); }

    /** Colours for a team in the current mode. */
    palette(team) {
        if (team === 'neutral') return NEUTRAL_LOOK;
        if (this.gameMode === 'duel' && !this.practice) return team === this.playerTeam ? DUEL_LOOK.you : DUEL_LOOK.rival;
        return TEAMS[team] || NEUTRAL_LOOK;
    }

    resetMatchStats() {
        Object.assign(this, { score: 0, combo: 0, comboTimer: 0, conversions: 0, losses: 0, peakPlayerCount: 0, upgrades: [], playerActed: false, hudTimer: 0 });
    }

    showTeamSelect(mode = 'conquest') {
        this.practice = false;
        this.gameMode = mode;
        this.gameState = 'team-select';
        this.ui.showScreen('team-select-screen');
    }

    selectTeam(team) {
        this.playerTeam = team;
        if (this.gameMode === 'levels') this.level = 1;
        this.startGame({ fresh: true });
    }

    /** Builds a new match for the current mode. `fresh` rolls a new map seed. */
    startGame({ fresh = false } = {}) {
        this.disposeRival();
        this.resetHeldInput();
        this.resetMatchStats();
        this.renderer.clearEffects();
        this.accumulator = 0;
        if (this.practice) this.gameMode = 'conquest';
        this.prepareWorld(fresh);
        this.sim = new Simulation({ width: this.canvas.width, height: this.canvas.height, rules: createRules(ruleOverrides()), random: this.matchRandom() });
        if (this.practice) this.tutorial.setupArena();
        else this.setupMode();
        this.peakPlayerCount = this.sim.count(this.playerTeam);
        this.startShips = this.sim.boids.length;
        this.gameState = 'playing';
        this.ui.showScreen('game-screen');
        this.ui.hideOverlays();
        this.ui.prepareMatch();
        if (this.practice) this.tutorial.showIntro();
        else this.showSectorBriefing();
        if (this.gameMode === 'duel') this.startDuel();
        this.ui.refresh();
    }

    restart() { this.startGame(); }

    // Player controls ------------------------------------------------------

    setRally(active) {
        if (this.gameState !== 'playing') return;
        if (active) this.player.rally(this.input.pointer.x, this.input.pointer.y);
        else this.player.release();
    }

    castFreeze() {
        if (this.gameState !== 'playing') return;
        if (this.practice && !this.tutorial.allowsAbility('freeze')) return;
        this.player.freeze(this.input.pointer.x, this.input.pointer.y);
        this.input.endGesture();
    }

    // Lifecycle ------------------------------------------------------------

    resetHeldInput() {
        this.input.reset();
        if (this.sim.commanders[this.playerTeam]) this.player.release();
    }

    pause() {
        if (this.gameState !== 'playing') return;
        this.resetHeldInput();
        this.stopRival();
        this.gameState = 'paused';
        this.audio.suspend();
        this.ui.showPause();
    }

    resume() {
        if (this.gameState !== 'paused') return;
        this.gameState = 'playing';
        this.audio.resume();
        this.ui.hide('pause-overlay');
        document.activeElement?.blur?.();
        this.resumeRival();
    }

    quitToMenu() {
        this.disposeRival();
        this.resetHeldInput();
        this.practice = false;
        this.gameState = 'menu';
        this.ui.showScreen('main-menu');
    }

    victory() {
        if (this.gameState === 'victory') return;
        this.stopRival();
        this.gameState = 'victory';
        this.audio.playVictory();
        this.ui.showResult(true);
    }

    defeat() {
        if (this.gameState === 'defeat') return;
        this.stopRival();
        this.gameState = 'defeat';
        this.audio.playDefeat();
        this.ui.showResult(false);
    }

    promptUpgrade() {
        const team = this.playerTeam;
        const available = UPGRADES.filter(upgrade => this.upgrades.filter(id => id === upgrade.id).length < UPGRADE_LIMIT);
        if (!available.length) return;
        this.resetHeldInput();
        this.gameState = 'upgrade';
        const choices = [...available].sort(() => this.sim.random() - 0.5).slice(0, 3);
        this.ui.showUpgrades(choices, upgrade => {
            this.upgrades.push(upgrade.id);
            upgrade.apply(this.sim.modifiers(team), this.sim, team);
            this.audio.playUpgrade();
            this.renderer.addFloatingText(`Upgrade: ${upgrade.name}`, this.canvas.width / 2, 100, '#00ff88', 18);
            this.gameState = 'playing';
            this.ui.hide('upgrade-overlay');
        });
    }

    resizeWorld() {
        const oldWidth = this.canvas.width, oldHeight = this.canvas.height;
        this.renderer.resize();
        if (!oldWidth || !oldHeight || (oldWidth === this.canvas.width && oldHeight === this.canvas.height)) return;
        const { sx, sy } = this.sim.resize(this.canvas.width, this.canvas.height);
        this.input.pointer.x *= sx;
        this.input.pointer.y *= sy;
        this.resetHeldInput();
    }

    // Simulation -----------------------------------------------------------

    update(dt) {
        if (this.gameState !== 'playing') return;
        this.sim.dormant = this.practice && !this.playerActed;
        this.updateModeBefore(dt);
        if (this.player.rallying) this.player.moveTarget(this.input.pointer.x, this.input.pointer.y);
        this.sim.step(dt);
        for (const event of this.sim.drainEvents()) this.handleEvent(event);
        if (this.combo > 0 && (this.comboTimer -= dt) <= 0) this.combo = 0;
        const playerCount = this.sim.counts[this.playerTeam] || 0;
        this.peakPlayerCount = Math.max(this.peakPlayerCount, playerCount);
        if ((this.hudTimer -= dt) <= 0) { this.hudTimer = 0.1; this.ui.refresh(); }
        this.updateModeAfter(dt, playerCount);
    }

    handleEvent(event) {
        const mine = event.team === this.playerTeam;
        switch (event.type) {
            case 'convert': {
                this.conversions++;
                this.renderer.burst(event.x, event.y, this.palette(event.to).rgb);
                if (event.to === this.playerTeam) this.rewardRecruit(event);
                else if (event.from === this.playerTeam) this.audio.playConversion(false);
                break;
            }
            case 'destroyed':
                if (mine) this.losses++;
                this.renderer.burst(event.x, event.y, this.palette(event.team).rgb);
                break;
            case 'rally':
                if (mine) { this.playerActed = true; this.audio.playRally(); }
                break;
            case 'freeze':
                if (mine) {
                    this.playerActed = true;
                    this.audio.playFreeze();
                    this.renderer.addShockwave(event.x, event.y, event.radius, '#a5e9ff');
                    this.renderer.addFloatingText(`${event.victims}/${event.eligible} frozen · ${event.duration}s`, event.x, event.y - 25, '#a5e9ff', 16);
                    this.ui.haptic(20);
                    if (this.practice) this.tutorial.recordFreeze(event.victims);
                } else {
                    this.renderer.addShockwave(event.x, event.y, event.radius, '#ffbf87');
                    this.renderer.addFloatingText(`${this.rivalName()} · Freeze`, event.x, event.y, '#ffbf87', 15);
                }
                break;
            case 'freeze-miss':
                if (mine) this.renderer.addFloatingText('No rivals in range · charge kept', event.x, event.y - 25, '#b8d9e5', 13);
                break;
        }
    }

    rewardRecruit(event) {
        if (this.practice) this.tutorial.recordRecruit(event.wasFrozen, event.from === 'neutral');
        this.combo++;
        this.comboTimer = 2.4;
        const multiplier = Math.min(10, this.combo);
        const points = 100 * multiplier;
        this.score += points;
        this.audio.playConversion(true, multiplier);
        this.renderer.addFloatingText(`+${points}${multiplier > 1 ? ` (${multiplier}x)` : ''}`, event.x, event.y - 12, '#00ffff', 12 + multiplier);
        if (this.combo === 5) this.renderer.addFloatingText('Chain reaction', event.x, event.y - 35, '#ffaa00', 16);
        else if (this.combo === 10) this.renderer.addFloatingText('One unstoppable swarm', event.x, event.y - 35, '#ff00ff', 18);
    }

    frame(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        // Steering is tuned per 60 Hz tick; a fixed step keeps play identical on any display.
        if (this.gameState === 'playing') {
            this.accumulator = Math.min(this.accumulator + dt, 3 * TICK);
            while (this.accumulator >= TICK && this.gameState === 'playing') {
                this.update(TICK);
                this.accumulator -= TICK;
            }
        } else this.accumulator = 0;
        this.renderer.render(this, dt);
        requestAnimationFrame(time => this.frame(time));
    }
}

Object.assign(Game.prototype, ModeMethods, DuelMethods);
