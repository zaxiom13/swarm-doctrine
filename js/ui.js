// UI Manager - Handles all UI interactions
import { CONFIG, DIFFICULTY_MODS, TEAMS, saveConfig } from './config.js';

export class UIManager {
    constructor(game) {
        this.game = game;
    }
    
    setup() {
        this.setupMenuButtons();
        this.setupTeamSelect();
        this.setupSettings();
        this.setupGameButtons();
        this.setupControlPanel();
        this.setupCollapsiblePanels();
        this.setupMobileControls();
        this.loadSavedSettings();
    }
    
    setupMobileControls() {
        // Mobile controls removed - scatter via double-tap on canvas
    }
    
    setupCollapsiblePanels() {
        // Make HUD panels collapsible
        document.querySelectorAll('.hud-panel.collapsible .panel-header').forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.closest('.hud-panel');
                panel.classList.toggle('collapsed');
                this.game.audio.playClick();
            });
        });
    }
    
    // Load saved settings into UI controls
    loadSavedSettings() {
        // Settings screen
        document.getElementById('setting-boid-count').value = CONFIG.boidCount;
        document.getElementById('boid-count-value').textContent = CONFIG.boidCount;
        
        document.getElementById('setting-conversion').value = CONFIG.conversionThreshold;
        document.getElementById('conversion-value').textContent = CONFIG.conversionThreshold;
        
        document.getElementById('setting-difficulty').value = CONFIG.difficulty;
        this.game.difficultyMod = DIFFICULTY_MODS[CONFIG.difficulty];
        
        document.getElementById('setting-sound').checked = CONFIG.soundEnabled;
        this.game.audio.enabled = CONFIG.soundEnabled;
        
        // Control panel
        document.getElementById('ctrl-separation').value = CONFIG.separationWeight;
        document.getElementById('sep-value').textContent = CONFIG.separationWeight;
        
        document.getElementById('ctrl-alignment').value = CONFIG.alignmentWeight;
        document.getElementById('align-value').textContent = CONFIG.alignmentWeight;
        
        document.getElementById('ctrl-cohesion').value = CONFIG.cohesionWeight;
        document.getElementById('cohes-value').textContent = CONFIG.cohesionWeight;
        
        document.getElementById('ctrl-speed').value = CONFIG.maxSpeed;
        document.getElementById('speed-value').textContent = CONFIG.maxSpeed;
        
        document.getElementById('ctrl-perception').value = CONFIG.perceptionRadius;
        document.getElementById('percep-value').textContent = CONFIG.perceptionRadius;
    }
    
    setupMenuButtons() {
        document.getElementById('btn-play').addEventListener('click', () => {
            this.game.audio.init();
            this.game.audio.playClick();
            this.game.showTeamSelect('conquest');
        });
        
        // Survival mode button
        const survivalBtn = document.getElementById('btn-survival');
        if (survivalBtn) {
            survivalBtn.addEventListener('click', () => {
                this.game.audio.init();
                this.game.audio.playClick();
                this.game.showTeamSelect('survival');
            });
        }
        
        document.getElementById('btn-tutorial').addEventListener('click', () => {
            this.game.audio.init();
            this.game.audio.playClick();
            this.showScreen('tutorial-screen');
        });
        
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.game.audio.init();
            this.game.audio.playClick();
            this.showScreen('settings-screen');
        });
        
        document.getElementById('btn-back-tutorial').addEventListener('click', () => {
            this.game.audio.playClick();
            this.showScreen('main-menu');
        });
        
        document.getElementById('btn-back-settings').addEventListener('click', () => {
            this.game.audio.playClick();
            this.showScreen('main-menu');
        });
        
        document.getElementById('btn-back-team-select').addEventListener('click', () => {
            this.game.audio.playClick();
            this.showScreen('main-menu');
        });
    }
    
    setupTeamSelect() {
        const teamBtns = document.querySelectorAll('.team-btn');
        teamBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.audio.playClick();
                const teamId = btn.dataset.team;
                this.game.selectTeam(teamId);
            });
        });
    }
    
    setupSettings() {
        const boidCountSlider = document.getElementById('setting-boid-count');
        const boidCountValue = document.getElementById('boid-count-value');
        boidCountSlider.addEventListener('input', () => {
            CONFIG.boidCount = parseInt(boidCountSlider.value);
            boidCountValue.textContent = boidCountSlider.value;
            saveConfig();
        });
        
        const conversionSlider = document.getElementById('setting-conversion');
        const conversionValue = document.getElementById('conversion-value');
        conversionSlider.addEventListener('input', () => {
            CONFIG.conversionThreshold = parseInt(conversionSlider.value);
            conversionValue.textContent = conversionSlider.value;
            saveConfig();
        });
        
        const difficultySelect = document.getElementById('setting-difficulty');
        difficultySelect.addEventListener('change', () => {
            CONFIG.difficulty = difficultySelect.value;
            this.game.difficultyMod = DIFFICULTY_MODS[CONFIG.difficulty];
            saveConfig();
        });
        
        const soundCheckbox = document.getElementById('setting-sound');
        soundCheckbox.addEventListener('change', () => {
            CONFIG.soundEnabled = soundCheckbox.checked;
            this.game.audio.enabled = soundCheckbox.checked;
            saveConfig();
        });
    }
    
    setupControlPanel() {
        // Toggle panel
        const toggle = document.getElementById('panel-toggle');
        const content = document.getElementById('panel-content');
        
        toggle.addEventListener('click', () => {
            content.classList.toggle('expanded');
        });
        
        // Separation control
        const sepSlider = document.getElementById('ctrl-separation');
        const sepValue = document.getElementById('sep-value');
        sepSlider.addEventListener('input', () => {
            CONFIG.separationWeight = parseFloat(sepSlider.value);
            sepValue.textContent = sepSlider.value;
            saveConfig();
        });
        
        // Alignment control
        const alignSlider = document.getElementById('ctrl-alignment');
        const alignValue = document.getElementById('align-value');
        alignSlider.addEventListener('input', () => {
            CONFIG.alignmentWeight = parseFloat(alignSlider.value);
            alignValue.textContent = alignSlider.value;
            saveConfig();
        });
        
        // Cohesion control
        const cohesSlider = document.getElementById('ctrl-cohesion');
        const cohesValue = document.getElementById('cohes-value');
        cohesSlider.addEventListener('input', () => {
            CONFIG.cohesionWeight = parseFloat(cohesSlider.value);
            cohesValue.textContent = cohesSlider.value;
            saveConfig();
        });
        
        // Speed control
        const speedSlider = document.getElementById('ctrl-speed');
        const speedValue = document.getElementById('speed-value');
        speedSlider.addEventListener('input', () => {
            CONFIG.maxSpeed = parseFloat(speedSlider.value);
            speedValue.textContent = speedSlider.value;
            saveConfig();
        });
        
        // Perception control
        const percepSlider = document.getElementById('ctrl-perception');
        const percepValue = document.getElementById('percep-value');
        percepSlider.addEventListener('input', () => {
            CONFIG.perceptionRadius = parseFloat(percepSlider.value);
            percepValue.textContent = percepSlider.value;
            saveConfig();
        });
    }
    
    setupGameButtons() {
        // Pause menu
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.resume();
        });
        
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.startGame();
        });
        
        document.getElementById('btn-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.quitToMenu();
        });
        
        // Victory
        document.getElementById('btn-play-again').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.startGame();
        });
        
        document.getElementById('btn-victory-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.quitToMenu();
        });
        
        // Defeat
        document.getElementById('btn-retry').addEventListener('click', () => {
            this.game.audio.playClick();
            if (this.game.gameMode === 'survival') {
                this.game.startSurvivalMode();
            } else {
                this.game.startGame();
            }
        });
        
        document.getElementById('btn-defeat-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.quitToMenu();
        });
        
        // Survival defeat buttons
        const survivalRetryBtn = document.getElementById('btn-survival-retry');
        if (survivalRetryBtn) {
            survivalRetryBtn.addEventListener('click', () => {
                this.game.audio.playClick();
                this.game.startSurvivalMode();
            });
        }
        
        const survivalQuitBtn = document.getElementById('btn-survival-quit');
        if (survivalQuitBtn) {
            survivalQuitBtn.addEventListener('click', () => {
                this.game.audio.playClick();
                this.game.quitToMenu();
            });
        }
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }
    
    updateTeamBanner(playerTeam) {
        const teamData = TEAMS[playerTeam];
        if (!teamData) {
            console.warn('Invalid team:', playerTeam);
            return;
        }
        
        // Update edge glow colors based on team
        const root = document.documentElement;
        root.style.setProperty('--edge-glow-color', teamData.glow);
        root.style.setProperty('--edge-glow-inner', teamData.color + '40'); // Add transparency
    }
    
    createFleetBars(teamIds, playerTeam) {
        const container = document.getElementById('fleet-bars-container');
        container.innerHTML = '';
        
        // Sort so player team is first
        const sortedTeams = [playerTeam, ...teamIds.filter(id => id !== playerTeam)];
        
        sortedTeams.forEach(teamId => {
            const teamData = TEAMS[teamId];
            const isPlayer = teamId === playerTeam;
            
            const bar = document.createElement('div');
            bar.className = 'fleet-bar-dynamic';
            bar.id = `fleet-bar-${teamId}`;
            bar.innerHTML = `
                <div class="bar-label" style="color: ${teamData.color}">
                    ${isPlayer ? '★ ' : ''}${teamData.name}${isPlayer ? ' (YOU)' : ''}
                </div>
                <div class="bar-container">
                    <div class="bar-fill" id="bar-fill-${teamId}" style="background: ${teamData.color}; box-shadow: 0 0 10px ${teamData.glow};"></div>
                </div>
                <span class="count" id="count-${teamId}" style="color: ${teamData.color}">0</span>
            `;
            container.appendChild(bar);
        });
        
        // Create mobile fleet segments
        this.createMobileFleetBar(sortedTeams, playerTeam);
    }
    
    createMobileFleetBar(teamIds, playerTeam) {
        const container = document.getElementById('mobile-fleet-segments');
        if (!container) return;
        
        container.innerHTML = '';
        
        teamIds.forEach(teamId => {
            const teamData = TEAMS[teamId];
            const isPlayer = teamId === playerTeam;
            
            const segment = document.createElement('div');
            segment.className = `mobile-fleet-segment${isPlayer ? ' player' : ''}`;
            segment.id = `mobile-segment-${teamId}`;
            segment.style.background = teamData.color;
            segment.style.width = '25%'; // Initial equal distribution
            container.appendChild(segment);
        });
    }
    
    updateHUD(teamCounts, playerTeam, gameTime, recentConversions) {
        const total = Object.values(teamCounts).reduce((a, b) => a + b, 0);
        const playerCount = teamCounts[playerTeam] || 0;
        
        // Update all fleet bars (desktop)
        for (const [teamId, count] of Object.entries(teamCounts)) {
            const barFill = document.getElementById(`bar-fill-${teamId}`);
            const countEl = document.getElementById(`count-${teamId}`);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            if (barFill) barFill.style.width = `${percentage}%`;
            if (countEl) countEl.textContent = count;
            
            // Update mobile fleet segments
            const mobileSegment = document.getElementById(`mobile-segment-${teamId}`);
            if (mobileSegment) {
                mobileSegment.style.width = `${percentage}%`;
                // Hide segments with 0 count
                mobileSegment.style.display = count > 0 ? 'block' : 'none';
            }
        }
        
        const timerEl = document.getElementById('game-timer');
        if (timerEl) timerEl.textContent = this.formatTime(gameTime);
        
        // Status based on player team's position
        const ratio = total > 0 ? playerCount / total : 0;
        const aliveTeams = Object.values(teamCounts).filter(c => c > 0).length;
        let status = 'BATTLE IN PROGRESS';
        if (aliveTeams === 2) status = 'FINAL SHOWDOWN';
        else if (ratio > 0.5) status = 'DOMINANCE IMMINENT';
        else if (ratio < 0.15) status = 'CRITICAL - REGROUP';
        else if (ratio > 0.35) status = 'TACTICAL ADVANTAGE';
        else if (ratio < 0.2) status = 'UNDER PRESSURE';
        
        const statusEl = document.getElementById('game-status');
        if (statusEl) statusEl.textContent = status;
    }
    
    showVictory(gameTime, conversions) {
        const timeStr = this.formatTime(gameTime);
        document.getElementById('victory-time').textContent = timeStr;
        document.getElementById('victory-conversions').textContent = conversions;
        
        const timeBonus = Math.max(0, 180 - gameTime);
        const rating = timeBonus > 120 ? 'S' : timeBonus > 60 ? 'A' : timeBonus > 30 ? 'B' : 'C';
        document.getElementById('victory-rating').textContent = rating;
        
        document.getElementById('victory-overlay').classList.remove('hidden');
    }
    
    showDefeat(gameTime, peakPlayerCount, totalBoids) {
        document.getElementById('defeat-time').textContent = this.formatTime(gameTime);
        document.getElementById('defeat-peak').textContent = 
            Math.round((peakPlayerCount / totalBoids) * 100) + '%';
        
        document.getElementById('defeat-overlay').classList.remove('hidden');
    }
    
    hideOverlays() {
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('victory-overlay').classList.add('hidden');
        document.getElementById('defeat-overlay').classList.add('hidden');
    }
    
    showPause() {
        document.getElementById('pause-overlay').classList.remove('hidden');
    }
    
    hidePause() {
        document.getElementById('pause-overlay').classList.add('hidden');
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Survival Mode UI Methods
    showSurvivalHUD() {
        // Create survival HUD if it doesn't exist
        let survivalHud = document.getElementById('survival-hud');
        if (!survivalHud) {
            survivalHud = document.createElement('div');
            survivalHud.id = 'survival-hud';
            survivalHud.className = 'survival-hud';
            survivalHud.innerHTML = `
                <div class="survival-wave">
                    <span class="wave-label">WAVE</span>
                    <span id="wave-number" class="wave-number">0</span>
                </div>
                <div class="survival-score">
                    <span class="score-label">SCORE</span>
                    <span id="survival-score" class="score-value">0</span>
                </div>
                <div class="survival-timer">
                    <span class="timer-label">NEXT WAVE</span>
                    <span id="wave-timer" class="timer-value">0:00</span>
                </div>
                <div class="survival-fleet">
                    <span class="fleet-label">FLEET</span>
                    <span id="survival-fleet-count" class="fleet-value">0</span>
                </div>
            `;
            document.getElementById('game-screen').appendChild(survivalHud);
        }
        survivalHud.classList.remove('hidden');
        
        // Create survival fleet bars (player vs enemies)
        this.createSurvivalFleetBars();
    }
    
    createSurvivalFleetBars() {
        const container = document.getElementById('fleet-bars-container');
        if (!container) return;
        container.innerHTML = '';
        
        const playerTeam = this.game.playerTeam;
        const teamData = TEAMS[playerTeam];
        
        // Player fleet bar
        const playerBar = document.createElement('div');
        playerBar.className = 'fleet-bar-dynamic';
        playerBar.id = 'fleet-bar-player';
        playerBar.innerHTML = `
            <div class="bar-label" style="color: ${teamData.color}">
                ★ ${teamData.name} (YOU)
            </div>
            <div class="bar-container">
                <div class="bar-fill" id="bar-fill-player" style="background: ${teamData.color}; box-shadow: 0 0 10px ${teamData.glow};"></div>
            </div>
            <span class="count" id="count-player" style="color: ${teamData.color}">0</span>
        `;
        container.appendChild(playerBar);
        
        // Enemy fleet bar
        const enemyBar = document.createElement('div');
        enemyBar.className = 'fleet-bar-dynamic';
        enemyBar.id = 'fleet-bar-enemies';
        enemyBar.innerHTML = `
            <div class="bar-label" style="color: #ff4444">
                ENEMIES
            </div>
            <div class="bar-container">
                <div class="bar-fill" id="bar-fill-enemies" style="background: #ff4444; box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);"></div>
            </div>
            <span class="count" id="count-enemies" style="color: #ff4444">0</span>
        `;
        container.appendChild(enemyBar);
    }
    
    hideSurvivalHUD() {
        const survivalHud = document.getElementById('survival-hud');
        if (survivalHud) survivalHud.classList.add('hidden');
        
        const fleetContent = document.getElementById('fleet-content');
        if (fleetContent) fleetContent.classList.remove('hidden');
    }
    
    updateSurvivalHUD(wave, score, waveTimer, fleetCount, teamCounts) {
        const waveEl = document.getElementById('wave-number');
        const scoreEl = document.getElementById('survival-score');
        const timerEl = document.getElementById('wave-timer');
        const fleetEl = document.getElementById('survival-fleet-count');
        
        if (waveEl) waveEl.textContent = wave;
        if (scoreEl) scoreEl.textContent = score.toLocaleString();
        if (timerEl) timerEl.textContent = Math.ceil(waveTimer) + 's';
        if (fleetEl) fleetEl.textContent = fleetCount;
        
        // Update game timer too
        const gameTimerEl = document.getElementById('game-timer');
        const gameStatusEl = document.getElementById('game-status');
        if (gameTimerEl) gameTimerEl.textContent = this.formatTime(this.game.gameTime);
        if (gameStatusEl) gameStatusEl.textContent = `WAVE ${wave} - SURVIVE`;
        
        // Update survival fleet bars
        if (teamCounts) {
            const playerTeam = this.game.playerTeam;
            const playerCount = teamCounts[playerTeam] || 0;
            let enemyCount = 0;
            for (const [team, count] of Object.entries(teamCounts)) {
                if (team !== playerTeam) enemyCount += count;
            }
            const total = playerCount + enemyCount;
            
            const playerBarFill = document.getElementById('bar-fill-player');
            const playerCountEl = document.getElementById('count-player');
            const enemyBarFill = document.getElementById('bar-fill-enemies');
            const enemyCountEl = document.getElementById('count-enemies');
            
            if (playerBarFill) playerBarFill.style.width = total > 0 ? `${(playerCount / total) * 100}%` : '0%';
            if (playerCountEl) playerCountEl.textContent = playerCount;
            if (enemyBarFill) enemyBarFill.style.width = total > 0 ? `${(enemyCount / total) * 100}%` : '0%';
            if (enemyCountEl) enemyCountEl.textContent = enemyCount;
        }
    }
    
    showWaveAnnouncement(wave) {
        // Create wave announcement overlay
        let announcement = document.getElementById('wave-announcement');
        if (!announcement) {
            announcement = document.createElement('div');
            announcement.id = 'wave-announcement';
            announcement.className = 'wave-announcement';
            document.getElementById('game-screen').appendChild(announcement);
        }
        
        announcement.innerHTML = `
            <div class="wave-text">WAVE ${wave}</div>
            <div class="wave-subtext">${this.getWaveDescription(wave)}</div>
        `;
        announcement.classList.add('show');
        
        // Hide after 2 seconds
        setTimeout(() => {
            announcement.classList.remove('show');
        }, 2000);
    }
    
    getWaveDescription(wave) {
        if (wave === 1) return 'FIRST CONTACT';
        if (wave === 2) return 'OBSTACLES INCOMING';
        if (wave <= 4) return 'REINFORCEMENTS ARRIVING';
        if (wave <= 6) return 'MULTI-FRONT ASSAULT';
        if (wave <= 9) return 'OVERWHELMING FORCE';
        return 'FINAL STAND';
    }
    
    showSurvivalDefeat(wave, score, gameTime) {
        // Create survival defeat overlay if it doesn't exist
        let survivalDefeat = document.getElementById('survival-defeat-overlay');
        if (!survivalDefeat) {
            survivalDefeat = document.createElement('div');
            survivalDefeat.id = 'survival-defeat-overlay';
            survivalDefeat.className = 'overlay';
            survivalDefeat.innerHTML = `
                <div class="overlay-content defeat">
                    <h2>FLEET DESTROYED</h2>
                    <p class="defeat-quote">"The enemy's gate is down... but so are we."</p>
                    <div class="stats">
                        <div class="stat">
                            <span class="stat-label">WAVES SURVIVED</span>
                            <span id="survival-final-wave" class="stat-value">0</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">FINAL SCORE</span>
                            <span id="survival-final-score" class="stat-value">0</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">TIME</span>
                            <span id="survival-final-time" class="stat-value">00:00</span>
                        </div>
                    </div>
                    <button id="btn-survival-retry" class="menu-btn">TRY AGAIN</button>
                    <button id="btn-survival-quit" class="menu-btn">RETURN TO COMMAND</button>
                </div>
            `;
            document.getElementById('game-screen').appendChild(survivalDefeat);
            
            // Re-setup buttons
            document.getElementById('btn-survival-retry').addEventListener('click', () => {
                this.game.audio.playClick();
                survivalDefeat.classList.add('hidden');
                this.game.startSurvivalMode();
            });
            
            document.getElementById('btn-survival-quit').addEventListener('click', () => {
                this.game.audio.playClick();
                survivalDefeat.classList.add('hidden');
                this.hideSurvivalHUD();
                this.game.quitToMenu();
            });
        }
        
        document.getElementById('survival-final-wave').textContent = wave;
        document.getElementById('survival-final-score').textContent = score.toLocaleString();
        document.getElementById('survival-final-time').textContent = this.formatTime(gameTime);
        
        survivalDefeat.classList.remove('hidden');
    }
}
