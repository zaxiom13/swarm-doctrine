// DOM for menus, HUD and dialogs. Screens are generated from the catalog,
// lessons and settings schema so there is one source for every label.
import { TEAMS, MODES, teamPerks } from './catalog.js';
import { DEFAULT_RULES, describeRules } from './rules.js';
import { settings, setSetting, resetSettings, SETTINGS_SCHEMA, SETTINGS_GROUPS } from './settings.js';

const $ = id => document.getElementById(id);
const OVERLAYS = ['pause-overlay', 'result-overlay', 'upgrade-overlay', 'intro-overlay'];
const RECORD_PREFIX = 'swarm-best-';
const PROGRESS_KEYS = ['swarm-lessons-v2', 'swarm-lessons-v1', 'swarm-expedition-v1'];

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key in node || key === 'textContent' || key === 'className') node[key] = value;
        else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child != null) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    return node;
}

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class UIManager {
    constructor(game) {
        this.game = game;
        this.screen = 'main-menu';
        this.history = [];
        this.coachPinned = false;
        this.lastFocus = null;
    }

    setup() {
        const game = this.game;
        this.buildModes();
        this.buildTeams();
        this.buildHelp();
        this.buildSettings();
        this.showRecords();
        document.addEventListener('click', event => {
            const nav = event.target.closest?.('[data-nav]');
            if (nav) { game.audio.init(); game.audio.playClick(); this.showScreen(nav.dataset.nav); }
            else if (event.target.closest?.('[data-back]')) { game.audio.playClick(); this.back(); }
        });
        const on = (id, handler) => $(id)?.addEventListener('click', () => { game.audio.playClick(); handler(); });
        on('btn-lessons', () => { game.audio.init(); game.tutorial.showLessons(); });
        on('btn-help-lessons', () => game.tutorial.showLessons());
        on('btn-continue', () => { if (!game.resumeExpedition()) this.toast('No saved sector yet. Pick Levels to start.'); });
        on('btn-continue-lessons', () => game.tutorial.start(game.tutorial.firstIncomplete()));
        on('btn-pause', () => game.pause());
        on('btn-resume', () => game.resume());
        on('btn-restart', () => game.restart());
        on('btn-quit', () => game.quitToMenu());
        on('btn-pause-lessons', () => game.tutorial.showLessons());
        on('btn-pause-settings', () => this.showScreen('settings-screen', { returnTo: 'game-screen' }));
        on('btn-result-quit', () => game.quitToMenu());
        on('btn-result-replay', () => game.tutorial.start(game.tutorial.index));
        on('btn-result-primary', () => this.resultAction());
        on('btn-upgrade-quit', () => { this.hideUpgrades(); game.quitToMenu(); });
        on('btn-intro-start', () => { this.hide('intro-overlay'); game.gameState = 'playing'; game.audio.init(); });
        on('btn-intro-secondary', () => (game.practice ? game.tutorial.showLessons() : game.quitToMenu()));
        on('btn-reset-settings', () => { resetSettings(); this.buildSettings(); this.toast('Settings restored to defaults.'); });
        on('btn-reset-progress', () => this.clearProgress());
        $('slot-rally')?.addEventListener('click', () => game.input.toggleRally());
        $('slot-freeze')?.addEventListener('click', () => game.input.pressFreeze());
        $('btn-details')?.addEventListener('click', () => this.setDetailsOpen($('details-sheet').classList.contains('hidden')));
        $('btn-close-details')?.addEventListener('click', () => this.setDetailsOpen(false));
        $('details-scrim')?.addEventListener('click', () => this.setDetailsOpen(false));
        $('btn-guide')?.addEventListener('click', () => this.setCoachOpen(!this.coachPinned));
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (!$('details-sheet')?.classList.contains('hidden')) this.setDetailsOpen(false);
            else if (this.screen !== 'game-screen' && this.screen !== 'main-menu') this.back();
        });
        globalThis.addEventListener?.('popstate', () => {
            if (game.gameState === 'playing') { game.pause(); globalThis.history?.pushState({ screen: this.screen }, ''); }
            else this.back();
        });
    }

    // Navigation ------------------------------------------------------------

    showScreen(id, { returnTo = null, push = true } = {}) {
        if (push && this.screen !== id) {
            this.history.push(returnTo || this.screen);
            globalThis.history?.pushState?.({ screen: id }, '');
        }
        for (const screen of document.querySelectorAll('.screen')) screen.classList.add('hidden');
        $(id)?.classList.remove('hidden');
        this.screen = id;
        this.setDetailsOpen(false);
        this.setCoachOpen(false);
        if (id === 'mode-screen') this.refreshContinue();
        if (id === 'main-menu') { this.history = []; this.showRecords(); }
        if (id !== 'game-screen') $(id)?.querySelector('h2, h1')?.focus?.({ preventScroll: true });
    }

    back() {
        const target = this.history.pop() || 'main-menu';
        if (target === 'game-screen') this.showScreen('game-screen', { push: false });
        else if (['game-screen', 'team-select-screen'].includes(this.screen) || target === 'main-menu') this.game.quitToMenu();
        else this.showScreen(target, { push: false });
    }

    toast(message, ms = 3200) {
        const toast = $('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
    }

    setBusy(busy) { $('busy')?.classList.toggle('hidden', !busy); }

    haptic(ms) { if (settings.haptics) globalThis.navigator?.vibrate?.(ms); }

    showConnectJev() {
        this.game.gameState = 'menu';
        globalThis.location?.assign('/connect.html');
    }

    // Generated screens -----------------------------------------------------

    buildModes() {
        const root = $('mode-groups');
        if (!root) return;
        root.replaceChildren();
        for (const group of [...new Set(MODES.map(mode => mode.group))]) {
            const cards = MODES.filter(mode => mode.group === group).map(mode => el('button', { type: 'button', className: 'card', dataset: { mode: mode.id } }, [
                el('strong', { textContent: mode.name }), el('p', { textContent: mode.summary })]));
            root.appendChild(el('h3', { className: 'section-title', textContent: group }));
            root.appendChild(el('div', { className: 'card-grid' }, cards));
        }
        root.addEventListener('click', event => {
            const card = event.target.closest('[data-mode]');
            if (!card) return;
            this.game.audio.init();
            this.game.audio.playClick();
            const mode = card.dataset.mode;
            if (mode.startsWith('duel-')) this.game.startDuelMode(mode);
            else this.game.showTeamSelect(mode);
        });
    }

    refreshContinue() {
        const button = $('btn-continue');
        if (!button) return;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('swarm-expedition-v1')); } catch { /* none */ }
        const valid = this.game.hasCheckpoint();
        button.classList.toggle('hidden', !valid);
        if (valid) button.textContent = `Continue Levels · sector ${saved.level}`;
    }

    buildTeams() {
        const grid = $('team-grid');
        if (!grid) return;
        grid.replaceChildren(...Object.values(TEAMS).map(team => el('button', { type: 'button', className: 'card team-card', dataset: { team: team.id }, style: `--team:${team.color}` }, [
            el('span', { className: 'team-symbol', textContent: team.symbol, 'aria-hidden': 'true' }), el('strong', { textContent: team.name }), el('p', { textContent: teamPerks(team).join(' · ') })])));
        grid.addEventListener('click', event => {
            const card = event.target.closest('[data-team]');
            if (!card) return;
            this.game.audio.playClick();
            this.game.selectTeam(card.dataset.team);
        });
    }

    buildHelp() {
        const text = describeRules(DEFAULT_RULES);
        $('help-steps')?.replaceChildren(
            el('li', {}, [el('strong', { textContent: 'Rally' }), el('p', { textContent: 'Hold to move your ships together.' })]),
            el('li', {}, [el('strong', { textContent: 'Release' }), el('p', { textContent: 'Let go beside a smaller group to recruit it.' })]),
            el('li', {}, [el('strong', { textContent: 'Freeze' }), el('p', { textContent: text.freeze })]));
        $('help-rules')?.replaceChildren(...Object.values(text).map(line => el('li', { textContent: line })));
    }

    buildSettings() {
        const form = $('settings-form');
        if (!form) return;
        form.replaceChildren();
        for (const [group, title] of Object.entries(SETTINGS_GROUPS)) {
            const fieldset = el('fieldset', { className: 'settings-group' }, [el('legend', { textContent: title })]);
            for (const field of SETTINGS_SCHEMA.filter(f => f.group === group)) fieldset.appendChild(this.settingRow(field));
            form.appendChild(fieldset);
        }
    }

    settingRow(field) {
        const id = `setting-${field.key}`;
        const value = settings[field.key];
        let input, output = null;
        if (field.type === 'toggle') {
            input = el('input', { type: 'checkbox', id, className: 'switch', checked: value ?? Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) });
            input.addEventListener('change', () => this.applySetting(field, input.checked));
        } else if (field.type === 'select') {
            input = el('select', { id }, field.options.map(([optionValue, label]) => el('option', { value: optionValue, textContent: label, selected: optionValue === value })));
            input.addEventListener('change', () => this.applySetting(field, input.value));
        } else {
            input = el('input', { type: 'range', id, min: field.min, max: field.max, step: field.step, value });
            output = el('output', { htmlFor: id, textContent: String(value) });
            input.addEventListener('input', () => { output.textContent = input.value; this.applySetting(field, Number(input.value)); });
        }
        return el('div', { className: 'setting-row' }, [el('label', { htmlFor: id }, [field.label, field.note ? el('small', { textContent: ` · ${field.note}` }) : null]), input, output]);
    }

    /** Saves a setting and applies rule changes to the running match immediately. */
    applySetting(field, value) {
        if (!setSetting(field.key, value)) return;
        if (field.rule && this.game.sim) this.game.sim.rules[field.key] = value;
    }

    clearProgress() {
        if (globalThis.confirm && !globalThis.confirm('Clear lesson progress, saved sectors and best scores on this device?')) return;
        try {
            for (const key of PROGRESS_KEYS) localStorage.removeItem(key);
            for (const mode of MODES) localStorage.removeItem(RECORD_PREFIX + mode.id);
            localStorage.removeItem(RECORD_PREFIX + 'duel');
        } catch { /* Storage unavailable. */ }
        this.game.tutorial.completed.clear();
        this.showRecords();
        this.toast('Progress and records cleared.');
    }

    showLessons(lessons, doneCount) {
        this.showScreen('lessons-screen');
        $('lesson-grid').replaceChildren(...lessons.map(lesson => {
            const card = el('button', { type: 'button', className: `card${lesson.done ? ' done' : ''}` }, [
                el('span', { className: 'card-eyebrow', textContent: `${String(lesson.index + 1).padStart(2, '0')}${lesson.done ? ' · Done' : ''}` }),
                el('strong', { textContent: lesson.title }), el('p', { textContent: lesson.description })]);
            card.addEventListener('click', () => this.game.tutorial.start(lesson.index));
            return card;
        }));
        $('lesson-progress').textContent = `${doneCount} of ${lessons.length} complete`;
        $('btn-continue-lessons').textContent = doneCount === lessons.length ? 'Start again' : doneCount ? 'Continue learning →' : 'Start with movement →';
    }

    // Records -------------------------------------------------------------

    saveRecord(score) {
        if (this.game.practice || !score) return;
        const key = RECORD_PREFIX + this.game.gameMode;
        try { if (score > (Number(localStorage.getItem(key)) || 0)) localStorage.setItem(key, String(score)); } catch { /* Optional. */ }
    }

    showRecords() {
        const records = [];
        try {
            for (const mode of MODES) {
                const best = Number(localStorage.getItem(RECORD_PREFIX + mode.id)) || 0;
                if (best) records.push(`${mode.name} ${best.toLocaleString()}`);
            }
        } catch { /* Optional. */ }
        const node = $('home-record');
        if (node) node.textContent = records.length ? `Best · ${records.join(' · ')}` : '';
    }

    // Match HUD ------------------------------------------------------------

    prepareMatch() {
        const game = this.game, duel = game.gameMode === 'duel' && !game.practice;
        const look = game.palette(game.playerTeam);
        document.documentElement.style.setProperty('--player-color', look.color);
        $('hud-matchup')?.classList.toggle('hidden', !duel);
        $('hud-score')?.classList.toggle('hidden', duel);
        $('rival-status').textContent = '';
        $('rival-reconnect')?.classList.add('hidden');
        $('btn-pause-lessons')?.classList.toggle('hidden', !game.practice);
        $('share-label').textContent = game.practice ? `Lesson ${game.tutorial.index + 1}` : 'Your share';
        const freeze = $('slot-freeze'), locked = game.practice && !game.tutorial.allowsAbility('freeze');
        freeze.disabled = locked;
        freeze.classList.toggle('locked', locked);
        freeze.setAttribute('aria-label', locked ? 'Freeze: introduced in a later lesson' : 'Freeze');
        const teams = game.sim.teams.filter(team => team !== 'neutral');
        $('fleet-bars').replaceChildren(...teams.map(team => {
            const palette = game.palette(team);
            const name = duel ? (team === game.playerTeam ? 'You' : game.rivalName()) : `${TEAMS[team]?.name ?? team}${team === game.playerTeam ? ' · you' : ''}`;
            return el('div', { className: 'fleet-bar', style: `--team:${palette.color}` }, [
                el('span', { className: 'fleet-name', textContent: name }), el('span', { className: 'fleet-count', id: `fleet-count-${team}`, textContent: '0' }),
                el('div', { className: 'meter' }, [el('div', { id: `fleet-fill-${team}` })])]);
        }));
        this.coachMessage = '';
    }

    /** Called ten times a second while playing. */
    refresh() {
        const game = this.game, sim = game.sim, counts = sim.counts, player = game.player;
        const competing = Object.entries(counts).filter(([team]) => team !== 'neutral');
        const total = competing.reduce((sum, [, n]) => sum + n, 0);
        const mine = counts[game.playerTeam] || 0;
        const share = total ? Math.round(mine / total * 100) : 0;
        $('hud-timer').textContent = formatTime(sim.time);
        $('hud-score').textContent = game.gameMode === 'survival' ? `Wave ${game.survival?.wave ?? 0} · ${game.score.toLocaleString()}` : game.score.toLocaleString();
        $('hud-you').textContent = String(mine);
        $('hud-rival').textContent = String(counts[game.opponentTeam] || 0);
        $('hud-rival-name').textContent = game.rivalName();
        const combo = $('hud-combo');
        combo.classList.toggle('hidden', game.combo < 2);
        combo.textContent = `${game.combo}x`;
        $('share-value').textContent = `${share}%`;
        $('share-fill').style.width = `${share}%`;
        for (const [team, count] of competing) {
            const fill = $(`fleet-fill-${team}`);
            if (fill) fill.style.width = `${total ? count / total * 100 : 0}%`;
            const label = $(`fleet-count-${team}`);
            if (label) label.textContent = String(count);
        }
        $('world-label').textContent = game.worldLabel();
        $('world-detail').textContent = game.worldDetail();
        $('match-status').textContent = this.matchStatus(share / 100, competing.filter(([, n]) => n > 0).length, counts.neutral || 0);
        this.refreshAbilities(player);
        this.refreshCoach();
    }

    matchStatus(ratio, alive, neutrals) {
        if (this.game.gameMode === 'duel') return neutrals ? `${neutrals} unclaimed` : '';
        if (alive === 2) return 'Two fleets left';
        if (ratio > 0.6) return 'You lead';
        if (ratio < 0.15) return 'Regroup';
        if (ratio > 0.4) return 'Growing';
        return ratio < 0.25 ? 'Find a smaller group' : '';
    }

    refreshAbilities(player) {
        const input = this.game.input, rules = this.game.rules;
        const rally = $('slot-rally');
        rally.classList.toggle('active', player.rallying);
        rally.classList.toggle('cooling', !player.rallying && player.coolOff > 0);
        rally.setAttribute('aria-pressed', String(player.rallying));
        rally.querySelector('.ability-label').textContent = input.rallyLatched ? 'Release' : 'Rally';
        $('rally-status').textContent = player.rallying ? (input.rallyLatched ? 'Tap to move' : 'Release to recruit') : player.coolOff > 0 ? `Recruit in ${player.coolOff.toFixed(1)}s` : '';
        $('rally-cooldown').style.height = !player.rallying && player.coolOff > 0 ? `${player.coolOff / rules.rallyCoolOff * 100}%` : '0%';
        const wait = player.freezeWait, freeze = $('slot-freeze');
        freeze.classList.toggle('cooling', wait > 0);
        freeze.classList.toggle('aiming', input.freezeAiming);
        $('freeze-cooldown').style.height = `${Math.min(1, wait / (wait > rules.freezeCooldown ? rules.freezeLockout : rules.freezeCooldown)) * 100}%`;
        $('freeze-status').textContent = wait > 0 ? `${wait.toFixed(1)}s` : input.freezeAiming ? 'Tap a rival' : input.isTouch ? 'Tap to aim' : '';
    }

    refreshCoach() {
        const game = this.game;
        let content;
        if (game.practice) content = game.tutorial.coach();
        else {
            const player = game.player, input = game.input;
            const title = input.freezeAiming ? 'Tap a rival to freeze them.'
                : player.rallying ? 'Release beside a smaller group.'
                : !game.playerActed ? 'Hold to move your ships.'
                : game.score < 300 ? 'Release close to a smaller group.'
                : game.gameTime < 45 ? 'Freeze half a group. Frozen ships cannot defend.'
                : (game.sim.counts[game.playerTeam] || 0) / Math.max(1, game.sim.boids.length) < 0.25 ? 'Regroup on a smaller fight.'
                : game.gameMode === 'survival' ? 'Hold for the next wave.' : 'Keep recruiting.';
            content = { step: '', title, detail: '', checklist: [] };
        }
        const signature = JSON.stringify(content);
        if (signature === this.coachMessage) return;
        this.coachMessage = signature;
        $('coach-step').textContent = content.step;
        $('coach-title').textContent = content.title;
        $('coach-detail').textContent = content.detail;
        $('coach-checklist').replaceChildren(...content.checklist.map(item => el('li', { className: item.done ? 'done' : '', textContent: `${item.done ? '✓' : '○'} ${item.label}` })));
    }

    setCoachOpen(open) {
        this.coachPinned = open;
        $('coach')?.classList.toggle('hidden', !open);
        $('btn-guide')?.setAttribute('aria-expanded', String(open));
        if (open) this.setDetailsOpen(false);
    }

    setDetailsOpen(open) {
        const sheet = $('details-sheet');
        if (!sheet) return;
        sheet.classList.toggle('hidden', !open);
        $('details-scrim')?.classList.toggle('hidden', !open);
        $('btn-details')?.setAttribute('aria-expanded', String(open));
        document.body?.classList.toggle('details-open', open);
        if (open) this.setCoachOpen(false);
    }

    setRivalStatus(status) {
        $('rival-status').textContent = status.label || '';
        const failed = ['offline', 'error'].includes(status.state);
        $('rival-reconnect')?.classList.toggle('hidden', !(failed && this.game.duelKind === 'duel-jev'));
        $('pause-status').textContent = failed ? `${status.message || `${this.game.rivalName()} is unavailable.`} (${status.code || 'connection_error'}) Resume to retry.` : `The match is paused. ${this.game.rivalName()} pauses too.`;
    }

    // Dialogs -------------------------------------------------------------

    show(id) {
        this.lastFocus = document.activeElement;
        $(id)?.classList.remove('hidden');
        this.setCoachOpen(false);
        this.setDetailsOpen(false);
        $(id)?.querySelector('.btn-primary, button')?.focus?.({ preventScroll: true });
    }

    hide(id) {
        $(id)?.classList.add('hidden');
        this.lastFocus?.focus?.({ preventScroll: true });
    }

    hideOverlays() { for (const id of OVERLAYS) $(id)?.classList.add('hidden'); }

    showPause() {
        if (this.game.gameMode !== 'duel') $('pause-status').textContent = '';
        this.show('pause-overlay');
    }

    hidePause() { this.hide('pause-overlay'); }

    showIntro({ eyebrow, title, description, instruction, secondary }) {
        $('intro-eyebrow').textContent = eyebrow;
        $('intro-title').textContent = title;
        $('intro-description').textContent = description;
        $('intro-instruction').textContent = instruction;
        $('btn-intro-secondary').textContent = secondary;
        this.show('intro-overlay');
    }

    showLessonIntro(info) { this.showIntro({ eyebrow: info.number, title: info.title, description: info.description, instruction: info.instruction, secondary: 'All lessons' }); }

    showSectorBriefing(info) { this.showIntro({ eyebrow: info.number, title: info.title, description: info.description, instruction: 'Hold to move. Release beside a smaller group.', secondary: 'Save & quit' }); }

    showUpgrades(choices, onPick) {
        $('upgrade-cards').replaceChildren(...choices.map(upgrade => {
            const card = el('button', { type: 'button', className: 'card upgrade-card' }, [
                el('span', { className: 'card-eyebrow', textContent: `${upgrade.icon} ${upgrade.category}` }), el('strong', { textContent: upgrade.name }), el('p', { textContent: upgrade.description })]);
            card.addEventListener('click', () => onPick(upgrade));
            return card;
        }));
        this.show('upgrade-overlay');
    }

    hideUpgrades() { this.hide('upgrade-overlay'); }

    showResult(won) {
        const game = this.game, practice = game.practice, levels = game.gameMode === 'levels';
        this.saveRecord(game.score);
        this.showRecords();
        const stats = won
            ? [['Time', formatTime(game.gameTime)], ['Recruited', String(game.conversions)], ['Score', game.score.toLocaleString()], ['Rank', game.score > 30000 ? 'S+' : game.score > 15000 ? 'S' : 'A']]
            : game.gameMode === 'survival'
                ? [['Time', formatTime(game.gameTime)], ['Waves', String(game.survival?.wave ?? 0)], ['Score', game.score.toLocaleString()]]
                : [['Time', formatTime(game.gameTime)], ['Peak share', `${Math.round(game.peakPlayerCount / Math.max(1, game.startShips) * 100)}%`]];
        $('result-title').textContent = !won ? 'Try again' : practice ? 'Lesson done' : levels ? `Sector ${game.level} clear` : 'You won';
        $('result-quote').textContent = !won ? 'Hold, release, recruit.' : practice ? game.tutorial.text('success') : levels ? `${game.losses} lost · Next map ready.` : '';
        $('result-stats').replaceChildren(...stats.map(([label, value]) => el('div', { className: 'stat' }, [el('dt', { textContent: label }), el('dd', { textContent: value })])));
        $('btn-result-primary').textContent = !won ? 'Retry' : practice ? (game.tutorial.index < game.tutorial.lessonCount - 1 ? 'Next lesson' : 'Pick a mode') : levels ? 'Next sector' : 'Again';
        $('btn-result-replay').classList.toggle('hidden', !(won && practice));
        this.resultWon = won;
        if (won) this.haptic([30, 40, 30]);
        this.show('result-overlay');
    }

    resultAction() {
        const game = this.game;
        if (!this.resultWon) game.restart();
        else if (game.practice) game.tutorial.next();
        else if (game.gameMode === 'levels') game.advanceLevel();
        else game.restart();
    }
}
