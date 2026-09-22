// Enhanced UI Manager - Manages HUD, Ability Hotbar, Roguelike Doctrine Drafts, Audio Controls, and Overlays
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
        this.setupAbilityHotbar();
        this.setupAudioToggles();
        this.setupControlPanel();
        this.setupCollapsiblePanels();
        this.loadSavedSettings();
        this.setupExperience();
        this.setupModes();
    }

    setupModes() {
        document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => this.game.showTeamSelect(button.dataset.mode)));
        document.getElementById('btn-modes-back').addEventListener('click', () => this.showScreen('main-menu'));
        document.getElementById('btn-resume-expedition').addEventListener('click', () => {
            if (!this.game.resumeExpedition()) {
                document.getElementById('campaign-status').textContent = 'No saved expedition yet. Choose Levels to begin.';
            }
        });
        document.getElementById('btn-sector-begin').addEventListener('click', () => {
            document.getElementById('sector-intro').classList.add('hidden');
            this.game.gameState = 'playing';
        });
        document.getElementById('btn-sector-quit').addEventListener('click', () => this.game.quitToMenu());
    }

    setupExperience() {
        document.getElementById('btn-practice').addEventListener('click', () => {
            this.game.audio.init();
            window.tutorial.showLessons();
        });
        document.getElementById('coach-dismiss').addEventListener('click', () => {
            document.getElementById('swarm-coach').classList.add('hidden');
        });
        this.showRecord();
        document.querySelectorAll('.setting-row, .control-row').forEach(row => {
            const input = row.querySelector('input, select');
            if (input) row.querySelector('label')?.setAttribute('for', input.id);
        });
    }

    resetCoach() {
        this.coachStage = 0;
        this.coachHeld = false;
        this.coachReleased = false;
        this.coachMessage = '';
        document.getElementById('swarm-coach').classList.remove('hidden');
    }

    updateCoach() {
        const g = this.game;
        if (g.beaconActive) this.coachHeld = true;
        if (this.coachHeld && !g.beaconActive) this.coachReleased = true;
        if (g.practice && g.tutorial) return;
        let message;
        if (g.input.freezeAiming) message = ['AIM FREEZE', 'Tap the arena to Freeze', 'Choose a rival group. Tap Freeze again to cancel.'];
        else if (g.beaconActive) message = ['02 / RELEASE', 'Let go to convert rivals', 'Your swarm needs to spread around the other ships.'];
        else if (!this.coachHeld) message = ['01 / GATHER', 'Hold to gather your swarm', 'Drag toward a smaller rival group. Your ships follow.'];
        else if (g.score < 300) message = ['03 / SURROUND', 'Let your numbers do the work', 'Release close to rivals. Outnumbered ships join your color.'];
        else if (g.gameTime < 45) message = ['NICE. THEY ARE JOINING YOU.', 'Give your swarm an advantage', 'Space or right-click freezes a wide area for 10 seconds. Rally to move; release to convert.'];
        else if ((g.teamCounts[g.playerTeam] || 0) / g.boids.length < 0.25) message = ['REGROUP', 'Pick a smaller fight', 'Gather your ships, then release beside an isolated group.'];
        else message = [g.gameMode === 'survival' ? 'SURVIVE & EVOLVE' : 'GROW & EVOLVE', g.gameMode === 'survival' ? 'Make every wave part of your swarm' : 'Unite the arena', 'Gather to travel. Release to convert. Repeat.'];
        const key = message.join('|');
        if (key !== this.coachMessage) {
            this.coachMessage = key;
            ['coach-step', 'coach-title', 'coach-detail'].forEach((id, i) => document.getElementById(id).textContent = message[i]);
        }
    }

    updateTerritory(count, total) {
        const percent = total ? Math.round(count / total * 100) : 0;
        document.getElementById('territory-value').textContent = percent + '%';
        document.getElementById('territory-fill').style.width = percent + '%';
        document.getElementById('objective-label').textContent = this.game.practice ? `LESSON ${(this.game.tutorial?.index || 0) + 1} · ${this.game.tutorial?.lesson.title || 'PRACTICE'}` : this.game.gameMode === 'zen' ? 'FIND YOUR FLOW' : this.game.gameMode === 'survival' ? 'YOUR SHARE OF THE ARENA' : 'UNITE THE ARENA';
    }

    saveRecord(score) {
        if (this.game.practice) return;
        try {
            const key = 'swarm-best-' + this.game.gameMode;
            const previous = Number(localStorage.getItem(key)) || 0;
            if (score > previous) localStorage.setItem(key, String(score));
        } catch (_) { /* The game remains playable without storage. */ }
        this.showRecord();
    }

    showRecord() {
        try {
            const conquest = Number(localStorage.getItem('swarm-best-conquest')) || 0;
            const survival = Number(localStorage.getItem('swarm-best-survival')) || 0;
            if (conquest || survival) document.getElementById('home-record').textContent = `PERSONAL BEST  /  Conquest ${conquest.toLocaleString()}  ·  Survival ${survival.toLocaleString()}`;
        } catch (_) { /* Optional records. */ }
    }

    setupCollapsiblePanels() {
        document.querySelectorAll('.hud-panel.collapsible .panel-header').forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.closest('.hud-panel');
                panel.classList.toggle('collapsed');
                this.game.audio.playClick();
            });
        });
    }

    setupAudioToggles() {
        const sfxBtn = document.getElementById('btn-toggle-sfx');
        const musicBtn = document.getElementById('btn-toggle-music');
        const pauseBtn = document.getElementById('btn-hud-pause');

        if (sfxBtn) {
            sfxBtn.addEventListener('click', () => {
                this.game.audio.enabled = !this.game.audio.enabled;
                CONFIG.soundEnabled = this.game.audio.enabled;
                sfxBtn.textContent = this.game.audio.enabled ? '🔊 SFX' : '🔇 SFX';
                saveConfig();
            });
        }

        if (musicBtn) {
            musicBtn.addEventListener('click', () => {
                this.game.audio.musicEnabled = !this.game.audio.musicEnabled;
                CONFIG.musicEnabled = this.game.audio.musicEnabled;
                musicBtn.textContent = this.game.audio.musicEnabled ? '🎵 MUSIC' : '🔇 MUSIC';
                saveConfig();
            });
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.game.audio.playClick();
                if (this.game.gameState === 'playing') {
                    this.game.pause();
                } else if (this.game.gameState === 'paused') {
                    this.game.resume();
                }
            });
        }
    }

    setupAbilityHotbar() {
        // Allow clicking the ability slots directly
        const slotBeacon = document.getElementById('slot-beacon');
        const slotEmp = document.getElementById('slot-emp');

        if (slotBeacon) {
            slotBeacon.addEventListener('click', () => {
                if (this.game.gameState === 'playing') this.game.setBeaconActive(!this.game.beaconActive);
            });
        }
        if (slotEmp) {
            slotEmp.addEventListener('click', () => {
                this.game.input.pressFreeze();
            });
        }
    }

    loadSavedSettings() {
        const boidCountSlider = document.getElementById('setting-boid-count');
        if (boidCountSlider) {
            boidCountSlider.value = CONFIG.boidCount;
            document.getElementById('boid-count-value').textContent = CONFIG.boidCount;
        }

        const conversionSlider = document.getElementById('setting-conversion');
        if (conversionSlider) {
            conversionSlider.value = CONFIG.conversionThreshold;
            document.getElementById('conversion-value').textContent = CONFIG.conversionThreshold;
        }

        const difficultySelect = document.getElementById('setting-difficulty');
        if (difficultySelect) {
            difficultySelect.value = CONFIG.difficulty;
            this.game.difficultyMod = DIFFICULTY_MODS[CONFIG.difficulty];
        }

        const soundCheckbox = document.getElementById('setting-sound');
        if (soundCheckbox) {
            soundCheckbox.checked = CONFIG.soundEnabled;
            this.game.audio.enabled = CONFIG.soundEnabled;
        }

        const musicCheckbox = document.getElementById('setting-music');
        if (musicCheckbox) {
            musicCheckbox.checked = CONFIG.musicEnabled;
            this.game.audio.musicEnabled = CONFIG.musicEnabled;
        }

        // Flocking sliders
        const sep = document.getElementById('ctrl-separation');
        if (sep) { sep.value = CONFIG.separationWeight; document.getElementById('sep-value').textContent = CONFIG.separationWeight; }
        const ali = document.getElementById('ctrl-alignment');
        if (ali) { ali.value = CONFIG.alignmentWeight; document.getElementById('align-value').textContent = CONFIG.alignmentWeight; }
        const coh = document.getElementById('ctrl-cohesion');
        if (coh) { coh.value = CONFIG.cohesionWeight; document.getElementById('cohes-value').textContent = CONFIG.cohesionWeight; }
        const spd = document.getElementById('ctrl-speed');
        if (spd) { spd.value = CONFIG.maxSpeed; document.getElementById('speed-value').textContent = CONFIG.maxSpeed; }
        const per = document.getElementById('ctrl-perception');
        if (per) { per.value = CONFIG.perceptionRadius; document.getElementById('percep-value').textContent = CONFIG.perceptionRadius; }
    }

    setupMenuButtons() {
        document.getElementById('btn-play').addEventListener('click', () => {
            this.game.audio.init();
            this.game.audio.playClick();
            this.showScreen('mode-screen');
        });

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

        const startTutorialBtn = document.getElementById('btn-start-interactive-tutorial');
        if (startTutorialBtn) {
            startTutorialBtn.addEventListener('click', () => {
                this.game.audio.init();
                this.game.audio.playClick();
                if (window.tutorial) {
                    window.tutorial.showLessons();
                } else {
                    this.game.startGame();
                }
            });
        }
    }

    setupTeamSelect() {
        const teamBtns = document.querySelectorAll('.team-btn');
        teamBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.audio.init();
                this.game.audio.playClick();
                const teamId = btn.dataset.team;
                this.game.selectTeam(teamId);
            });
        });
    }

    setupSettings() {
        const boidCountSlider = document.getElementById('setting-boid-count');
        const boidCountValue = document.getElementById('boid-count-value');
        if (boidCountSlider) {
            boidCountSlider.addEventListener('input', () => {
                CONFIG.boidCount = parseInt(boidCountSlider.value);
                boidCountValue.textContent = boidCountSlider.value;
                saveConfig();
            });
        }

        const conversionSlider = document.getElementById('setting-conversion');
        const conversionValue = document.getElementById('conversion-value');
        if (conversionSlider) {
            conversionSlider.addEventListener('input', () => {
                CONFIG.conversionThreshold = parseInt(conversionSlider.value);
                conversionValue.textContent = conversionSlider.value;
                saveConfig();
            });
        }

        const difficultySelect = document.getElementById('setting-difficulty');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', () => {
                CONFIG.difficulty = difficultySelect.value;
                this.game.difficultyMod = DIFFICULTY_MODS[CONFIG.difficulty];
                saveConfig();
            });
        }

        const soundCheckbox = document.getElementById('setting-sound');
        if (soundCheckbox) {
            soundCheckbox.addEventListener('change', () => {
                CONFIG.soundEnabled = soundCheckbox.checked;
                this.game.audio.enabled = soundCheckbox.checked;
                saveConfig();
            });
        }

        const musicCheckbox = document.getElementById('setting-music');
        if (musicCheckbox) {
            musicCheckbox.addEventListener('change', () => {
                CONFIG.musicEnabled = musicCheckbox.checked;
                this.game.audio.musicEnabled = musicCheckbox.checked;
                saveConfig();
            });
        }
    }

    setupControlPanel() {
        const toggle = document.getElementById('panel-toggle');
        const content = document.getElementById('panel-content');
        if (toggle && content) {
            toggle.addEventListener('click', () => {
                content.classList.toggle('expanded');
                this.game.audio.playClick();
            });
        }

        const handleSlider = (id, valId, key) => {
            const slider = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (slider && valEl) {
                slider.addEventListener('input', () => {
                    CONFIG[key] = parseFloat(slider.value);
                    valEl.textContent = slider.value;
                    saveConfig();
                });
            }
        };

        handleSlider('ctrl-separation', 'sep-value', 'separationWeight');
        handleSlider('ctrl-alignment', 'align-value', 'alignmentWeight');
        handleSlider('ctrl-cohesion', 'cohes-value', 'cohesionWeight');
        handleSlider('ctrl-speed', 'speed-value', 'maxSpeed');
        handleSlider('ctrl-perception', 'percep-value', 'perceptionRadius');
    }

    setupGameButtons() {
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.resume();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            this.game.audio.playClick();
            if (this.game.gameMode === 'survival') {
                this.game.startSurvivalMode();
            } else {
                this.game.startGame();
            }
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.quitToMenu();
        });

        document.getElementById('btn-play-again').addEventListener('click', () => {
            this.game.audio.playClick();
            if (this.game.practice) { this.game.tutorial.next(); return; }
            if (this.game.gameMode === 'levels') { this.game.advanceLevel(); return; }
            if (this.game.gameMode === 'survival') {
                this.game.startSurvivalMode();
            } else {
                this.game.startGame();
            }
        });

        document.getElementById('btn-victory-quit').addEventListener('click', () => {
            this.game.audio.playClick();
            this.game.quitToMenu();
        });

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
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
    }

    updateTeamBanner(playerTeam) {
        const teamData = TEAMS[playerTeam];
        if (!teamData) return;

        const root = document.documentElement;
        root.style.setProperty('--edge-glow-color', teamData.glow);
        root.style.setProperty('--edge-glow-inner', teamData.color + '40');
        root.style.setProperty('--player-color', teamData.color);
    }

    createFleetBars(teamIds, playerTeam) {
        const container = document.getElementById('fleet-bars-container');
        if (!container) return;
        container.innerHTML = '';

        const sortedTeams = [playerTeam, ...teamIds.filter(id => id !== playerTeam)];

        sortedTeams.forEach(teamId => {
            const teamData = TEAMS[teamId] || TEAMS.dragon;
            const isPlayer = teamId === playerTeam;

            const bar = document.createElement('div');
            bar.className = 'fleet-bar-dynamic';
            bar.id = `fleet-bar-${teamId}`;
            bar.innerHTML = `
                <div class="bar-label" style="color: ${teamData.color}">
                    ${teamData.name}${isPlayer ? ' · YOU' : ''}
                </div>
                <div class="bar-container">
                    <div class="bar-fill" id="bar-fill-${teamId}" style="background: ${teamData.color}; box-shadow: 0 0 10px ${teamData.glow};"></div>
                </div>
                <span class="count" id="count-${teamId}" style="color: ${teamData.color}">0</span>
            `;
            container.appendChild(bar);
        });

        this.createMobileFleetBar(sortedTeams, playerTeam);
    }

    createMobileFleetBar(teamIds, playerTeam) {
        const container = document.getElementById('mobile-fleet-segments');
        if (!container) return;
        container.innerHTML = '';

        teamIds.forEach(teamId => {
            const teamData = TEAMS[teamId] || TEAMS.dragon;
            const isPlayer = teamId === playerTeam;

            const segment = document.createElement('div');
            segment.className = `mobile-fleet-segment${isPlayer ? ' player' : ''}`;
            segment.id = `mobile-segment-${teamId}`;
            segment.style.background = teamData.color;
            segment.style.width = '25%';
            container.appendChild(segment);
        });
    }

    updateHUD(teamCounts, playerTeam, gameTime, score = 0, combo = 0) {
        const total = Object.values(teamCounts).reduce((a, b) => a + b, 0);
        const playerCount = teamCounts[playerTeam] || 0;
        this.updateTerritory(playerCount, total);

        for (const [teamId, count] of Object.entries(teamCounts)) {
            const barFill = document.getElementById(`bar-fill-${teamId}`);
            const countEl = document.getElementById(`count-${teamId}`);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            if (barFill) barFill.style.width = `${percentage}%`;
            if (countEl) countEl.textContent = count;

            const mobileSegment = document.getElementById(`mobile-segment-${teamId}`);
            if (mobileSegment) {
                mobileSegment.style.width = `${percentage}%`;
                mobileSegment.style.display = count > 0 ? 'block' : 'none';
            }
        }

        const timerEl = document.getElementById('game-timer');
        if (timerEl) timerEl.textContent = this.formatTime(gameTime);

        const scoreEl = document.getElementById('game-score-val');
        if (scoreEl) scoreEl.textContent = score.toLocaleString();

        // Combo display
        const comboBadge = document.getElementById('hud-combo-badge');
        const comboVal = document.getElementById('hud-combo-val');
        if (comboBadge && comboVal) {
            if (combo >= 2) {
                comboBadge.classList.remove('hidden');
                comboVal.textContent = `${combo}x`;
            } else {
                comboBadge.classList.add('hidden');
            }
        }

        // Tactical Status
        const ratio = total > 0 ? playerCount / total : 0;
        const aliveTeams = Object.values(teamCounts).filter(c => c > 0).length;
        let status = 'Gather · release · convert';
        if (aliveTeams === 2) status = 'FINAL SHOWDOWN';
        else if (ratio > 0.6) status = 'The arena is becoming yours';
        else if (ratio < 0.15) status = 'Regroup — hold to gather';
        else if (ratio > 0.4) status = 'Your swarm is growing';
        else if (ratio < 0.25) status = 'Find a smaller rival group';

        const statusEl = document.getElementById('game-status');
        if (statusEl) statusEl.textContent = status;
    }

    updateAbilitiesHUD(empCd, empMax, beaconActive = false, rallyTimer = 0, rallyMax = 1.0) {
        // Beacon slot & Transit Disarm Warning
        const beaconSlot = document.getElementById('slot-beacon');
        const beaconStatus = document.getElementById('status-beacon');
        const beaconFill = document.getElementById('cd-beacon');
        const rallyWarning = document.getElementById('hud-rally-warning');

        if (beaconSlot && beaconStatus) {
            if (beaconActive) {
                beaconSlot.classList.add('active');
                beaconSlot.classList.remove('on-cooldown');
                if (beaconFill) beaconFill.style.height = '0%';
                beaconStatus.textContent = 'RELEASE TO CONVERT';
                if (rallyWarning) {
                    rallyWarning.classList.remove('hidden');
                    rallyWarning.textContent = 'Release to surround and convert';
                }
            } else if (rallyTimer > 0) {
                beaconSlot.classList.remove('active');
                beaconSlot.classList.add('on-cooldown');
                if (beaconFill) beaconFill.style.height = `${(rallyTimer / rallyMax) * 100}%`;
                beaconStatus.textContent = `${rallyTimer.toFixed(1)}s`;
                if (rallyWarning) {
                    rallyWarning.classList.remove('hidden');
                    rallyWarning.textContent = `Ready to convert in ${rallyTimer.toFixed(1)}s`;
                }
            } else {
                beaconSlot.classList.remove('active', 'on-cooldown');
                if (beaconFill) beaconFill.style.height = '0%';
                beaconStatus.textContent = 'READY';
                if (rallyWarning) {
                    rallyWarning.classList.add('hidden');
                }
            }
        }

        // EMP
        const empSlot = document.getElementById('slot-emp');
        const empFill = document.getElementById('cd-emp');
        const empStatus = document.getElementById('status-emp');
        if (empSlot && empFill && empStatus) {
            if (empCd > 0) {
                empSlot.classList.add('on-cooldown');
                empFill.style.height = `${(empCd / empMax) * 100}%`;
                empStatus.textContent = `${empCd.toFixed(1)}s`;
            } else {
                empSlot.classList.remove('on-cooldown');
                empFill.style.height = '0%';
                empStatus.textContent = this.game.input.freezeAiming ? 'TAP THE ARENA' : this.game.input.isMobile ? 'TAP TO AIM' : 'READY';
            }
        }
    }

    // Roguelike Doctrine Draft Modal
    showDoctrineModal(choices, onSelect) {
        const overlay = document.getElementById('doctrine-overlay');
        const container = document.getElementById('doctrine-cards');
        if (!overlay || !container) return;

        container.innerHTML = '';
        choices.forEach(doctrine => {
            const card = document.createElement('div');
            card.className = 'doctrine-card';
            card.innerHTML = `
                <div class="doctrine-category">${doctrine.category}</div>
                <div class="doctrine-icon">${doctrine.icon}</div>
                <div class="doctrine-name">${doctrine.name}</div>
                <div class="doctrine-desc">${doctrine.description}</div>
                <button class="menu-btn primary-btn select-doctrine-btn">AUTHORIZE</button>
            `;
            card.addEventListener('click', () => {
                onSelect(doctrine);
            });
            container.appendChild(card);
        });

        overlay.classList.remove('hidden');
    }

    hideDoctrineModal() {
        const overlay = document.getElementById('doctrine-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    showVictory(gameTime, conversions, score = 0) {
        document.querySelector('#victory-overlay h2').textContent = this.game.practice ? 'Lesson complete.' : 'One swarm. Yours.';
        document.querySelector('#victory-overlay .victory-quote').textContent = this.game.practice ? this.game.tutorial.lesson.success : 'Every rival became part of something bigger.';
        document.getElementById('btn-replay-lesson').classList.toggle('hidden', !this.game.practice);
        document.getElementById('btn-play-again').textContent = this.game.practice ? (this.game.tutorial.index < this.game.tutorial.lessonCount - 1 ? 'Next lesson →' : 'Choose your mode →') : 'Play again';
        if (!this.game.practice && this.game.gameMode === 'levels') {
            document.querySelector('#victory-overlay h2').textContent = `Sector ${this.game.level} united.`;
            document.getElementById('btn-play-again').textContent = 'Next sector →';
            document.querySelector('#victory-overlay .victory-quote').textContent = `${this.game.rescues || 0} rescue completed · ${this.game.losses || 0} ships lost to terrain. A new map is waiting.`;
        }
        this.saveRecord(score);
        document.getElementById('victory-time').textContent = this.formatTime(gameTime);
        document.getElementById('victory-conversions').textContent = conversions;
        const scoreEl = document.getElementById('victory-score');
        if (scoreEl) scoreEl.textContent = score.toLocaleString();

        const ratingEl = document.getElementById('victory-rating');
        if (ratingEl) {
            ratingEl.textContent = score > 30000 ? 'S+ (VOID SOVEREIGN)' : score > 15000 ? 'S (HEGEMON)' : 'A (COMMANDER)';
        }
        document.getElementById('victory-overlay').classList.remove('hidden');
    }

    showDefeat(gameTime, peakPlayerCount, totalBoids) {
        document.querySelector('#defeat-overlay .stat:nth-child(2) .stat-label').textContent = 'PEAK STRENGTH';
        this.saveRecord(this.game.score);
        document.getElementById('defeat-time').textContent = this.formatTime(gameTime);
        document.getElementById('defeat-peak').textContent =
            Math.round((peakPlayerCount / totalBoids) * 100) + '%';

        document.getElementById('defeat-overlay').classList.remove('hidden');
    }

    hideOverlays() {
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('victory-overlay').classList.add('hidden');
        document.getElementById('defeat-overlay').classList.add('hidden');
        this.hideDoctrineModal();
        document.getElementById('lesson-intro').classList.add('hidden');
        document.getElementById('sector-intro').classList.add('hidden');
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

    showSurvivalHUD() {
        let survivalHud = document.getElementById('survival-hud');
        if (!survivalHud) {
            survivalHud = document.createElement('div');
            survivalHud.id = 'survival-hud';
            survivalHud.className = 'survival-hud';
            survivalHud.innerHTML = `
                <div class="survival-stat"><span class="label">WAVE</span><span id="wave-number" class="val">0</span></div>
                <div class="survival-stat"><span class="label">SCORE</span><span id="survival-score" class="val">0</span></div>
                <div class="survival-stat"><span class="label">NEXT WAVE</span><span id="wave-timer" class="val">0:00</span></div>
                <div class="survival-stat"><span class="label">FLEET</span><span id="survival-fleet-count" class="val">0</span></div>
            `;
            document.getElementById('game-screen').appendChild(survivalHud);
        }
        survivalHud.classList.remove('hidden');
    }

    updateSurvivalHUD(wave, score, timer, fleetCount, teamCounts) {
        const waveEl = document.getElementById('wave-number');
        if (waveEl) waveEl.textContent = wave;

        const scoreEl = document.getElementById('survival-score');
        if (scoreEl) scoreEl.textContent = score.toLocaleString();

        const timerEl = document.getElementById('wave-timer');
        if (timerEl) timerEl.textContent = Math.max(0, Math.ceil(timer)) + 's';

        const fleetEl = document.getElementById('survival-fleet-count');
        if (fleetEl) fleetEl.textContent = fleetCount;
    }

    showWaveAnnouncement(wave) {
        // Handled via floating text in game loop
    }

    showSurvivalDefeat(wave, score, gameTime) {
        this.showDefeat(gameTime, this.game.peakPlayerCount, Math.max(1, this.game.boids.length));
        document.querySelector('#defeat-overlay .stat:nth-child(2) .stat-label').textContent = 'WAVES REACHED';
        document.getElementById('defeat-peak').textContent = wave;
    }
}
