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

/** A menu card: optional leading element or eyebrow, a title and one line of text. */
const card = ({ lead, eyebrow, title, text, className = '', ...props }, onClick) => {
    const node = el('button', { type: 'button', className: `card ${className}`.trim(), ...props },
        [lead, eyebrow && el('span', { className: 'card-eyebrow', textContent: eyebrow }), el('strong', { textContent: title }), el('p', { textContent: text })]);
    if (onClick) node.addEventListener('click', onClick);
    return node;
};

function formatTime(seconds) {
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
        const on = (id, handler) => $(id).addEventListener('click', () => { game.audio.playClick(); handler(); });
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
        on('btn-upgrade-quit', () => { this.hide('upgrade-overlay'); game.quitToMenu(); });
        on('btn-intro-start', () => { this.hide('intro-overlay'); game.gameState = 'playing'; game.audio.init(); });
        on('btn-intro-secondary', () => (game.practice ? game.tutorial.showLessons() : game.quitToMenu()));
        on('btn-reset-settings', () => { resetSettings(); this.buildSettings(); this.toast('Settings restored to defaults.'); });
        on('btn-reset-progress', () => this.clearProgress());
        $('slot-rally').addEventListener('click', () => game.input.toggleRally());
        $('slot-freeze').addEventListener('click', () => game.input.pressFreeze());
        $('btn-details').addEventListener('click', () => this.setDetailsOpen($('details-sheet').classList.contains('hidden')));
        $('btn-close-details').addEventListener('click', () => this.setDetailsOpen(false));
        $('details-scrim').addEventListener('click', () => this.setDetailsOpen(false));
        $('btn-guide').addEventListener('click', () => this.setCoachOpen(!this.coachPinned));
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (!$('details-sheet').classList.contains('hidden')) this.setDetailsOpen(false);
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
        $(id).classList.remove('hidden');
        this.screen = id;
        this.setDetailsOpen(false);
        this.setCoachOpen(false);
        if (id === 'mode-screen') this.refreshContinue();
        if (id === 'main-menu') { this.history = []; this.showRecords(); }
        if (id !== 'game-screen') $(id).querySelector('h2, h1')?.focus?.({ preventScroll: true });
    }

    back() {
        const target = this.history.pop() || 'main-menu';
        if (target === 'game-screen') this.showScreen('game-screen', { push: false });
        else if (['game-screen', 'team-select-screen'].includes(this.screen) || target === 'main-menu') this.game.quitToMenu();
        else this.showScreen(target, { push: false });
    }

    toast(message, ms = 3200) {
        const toast = $('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
    }

    setBusy(busy) { $('busy').classList.toggle('hidden', !busy); }

    haptic(ms) { if (settings.haptics) globalThis.navigator?.vibrate?.(ms); }

    showConnectJev() {
        this.game.gameState = 'menu';
        globalThis.location?.assign('/connect.html');
    }

    // Generated screens -----------------------------------------------------

    buildModes() {
        const root = $('mode-groups');
        for (const group of new Set(MODES.map(mode => mode.group))) {
            root.appendChild(el('h3', { className: 'section-title', textContent: group }));
            root.appendChild(el('div', { className: 'card-grid' }, MODES.filter(mode => mode.group === group).map(mode => card({ title: mode.name, text: mode.summary }, () => {
                this.game.audio.init();
                this.game.audio.playClick();
                if (mode.id.startsWith('duel-')) this.game.startDuelMode(mode.id);
                else this.game.showTeamSelect(mode.id);
            }))));
        }
    }

    refreshContinue() {
        const saved = this.game.loadCheckpoint();
        $('btn-continue').classList.toggle('hidden', !saved);
        if (saved) $('btn-continue').textContent = `Continue Levels · sector ${saved.level}`;
    }

    buildTeams() {
        $('team-grid').replaceChildren(...Object.values(TEAMS).map(team => card({
            lead: el('span', { className: 'team-symbol', textContent: team.symbol, 'aria-hidden': 'true' }),
            title: team.name, text: teamPerks(team).join(' · '), className: 'team-card', style: `--team:${team.color}`,
        }, () => { this.game.audio.playClick(); this.game.selectTeam(team.id); })));
    }

    buildHelp() {
        const text = describeRules(DEFAULT_RULES);
        const step = (title, body) => el('li', {}, [el('strong', { textContent: title }), el('p', { textContent: body })]);
        $('help-steps').replaceChildren(step('Rally', 'Hold to move your ships together.'), step('Release', 'Let go beside a smaller group to recruit it.'), step('Freeze', text.freeze));
        $('help-rules').replaceChildren(...Object.values(text).map(line => el('li', { textContent: line })));
    }

    buildSettings() {
        $('settings-form').replaceChildren(...Object.entries(SETTINGS_GROUPS).map(([group, title]) =>
            el('fieldset', { className: 'settings-group' }, [el('legend', { textContent: title }), ...SETTINGS_SCHEMA.filter(f => f.group === group).map(f => this.settingRow(f))])));
    }

    settingRow(field) {
        const id = `setting-${field.key}`, value = settings[field.key];
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
        return el('div', { className: 'setting-row' }, [el('label', { htmlFor: id }, [field.label, field.note && el('small', { textContent: ` · ${field.note}` })]), input, output]);
    }

    /** Saves a setting and applies rule changes to the running match immediately. */
    applySetting(field, value) {
        if (setSetting(field.key, value) && field.rule) this.game.sim.rules[field.key] = value;
    }

    clearProgress() {
        if (globalThis.confirm && !globalThis.confirm('Clear lesson progress, saved sectors and best scores on this device?')) return;
        try {
            for (const key of [...PROGRESS_KEYS, ...MODES.map(mode => RECORD_PREFIX + mode.id), RECORD_PREFIX + 'duel']) localStorage.removeItem(key);
        } catch { /* Storage unavailable. */ }
        this.game.tutorial.completed.clear();
        this.showRecords();
        this.toast('Progress and records cleared.');
    }

    showLessons(lessons, doneCount) {
        this.showScreen('lessons-screen');
        $('lesson-grid').replaceChildren(...lessons.map(lesson => card({
            eyebrow: `${String(lesson.index + 1).padStart(2, '0')}${lesson.done ? ' · Done' : ''}`, title: lesson.title, text: lesson.description, className: lesson.done ? 'done' : '',
        }, () => this.game.tutorial.start(lesson.index))));
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
        let records = [];
        try {
            records = MODES.map(mode => [mode.name, Number(localStorage.getItem(RECORD_PREFIX + mode.id)) || 0]).filter(([, best]) => best).map(([name, best]) => `${name} ${best.toLocaleString()}`);
        } catch { /* Optional. */ }
        $('home-record').textContent = records.length ? `Best · ${records.join(' · ')}` : '';
    }

    // Match HUD ------------------------------------------------------------

    prepareMatch() {
        const game = this.game, duel = game.gameMode === 'duel' && !game.practice;
        document.documentElement.style.setProperty('--player-color', game.palette(game.playerTeam).color);
        $('hud-matchup').classList.toggle('hidden', !duel);
        $('hud-score').classList.toggle('hidden', duel);
        $('rival-status').textContent = '';
        $('rival-reconnect').classList.add('hidden');
        $('btn-pause-lessons').classList.toggle('hidden', !game.practice);
        $('share-label').textContent = game.practice ? `Lesson ${game.tutorial.index + 1}` : 'Your share';
        const freeze = $('slot-freeze'), locked = game.practice && !game.tutorial.allowsAbility('freeze');
        freeze.disabled = locked;
        freeze.classList.toggle('locked', locked);
        freeze.setAttribute('aria-label', locked ? 'Freeze: introduced in a later lesson' : 'Freeze');
        $('fleet-bars').replaceChildren(...game.sim.teams.filter(team => team !== 'neutral').map(team => {
            const name = duel ? (team === game.playerTeam ? 'You' : game.rivalName()) : `${TEAMS[team]?.name ?? team}${team === game.playerTeam ? ' · you' : ''}`;
            return el('div', { className: 'fleet-bar', style: `--team:${game.palette(team).color}` }, [
                el('span', { className: 'fleet-name', textContent: name }), el('span', { className: 'fleet-count', id: `fleet-count-${team}`, textContent: '0' }),
                el('div', { className: 'meter' }, [el('div', { id: `fleet-fill-${team}` })])]);
        }));
        this.coachMessage = '';
    }

    /** Called ten times a second while playing. */
    refresh() {
        const game = this.game, counts = game.sim.counts;
        const competing = Object.entries(counts).filter(([team]) => team !== 'neutral');
        const total = competing.reduce((sum, [, n]) => sum + n, 0);
        const mine = counts[game.playerTeam] || 0;
        const share = total ? Math.round(mine / total * 100) : 0;
        $('hud-timer').textContent = formatTime(game.gameTime);
        $('hud-score').textContent = game.gameMode === 'survival' ? `Wave ${game.survival?.wave ?? 0} · ${game.score.toLocaleString()}` : game.score.toLocaleString();
        $('hud-you').textContent = String(mine);
        $('hud-rival').textContent = String(counts[game.opponentTeam] || 0);
        $('hud-rival-name').textContent = game.rivalName();
        $('hud-combo').classList.toggle('hidden', game.combo < 2);
        $('hud-combo').textContent = `${game.combo}x`;
        $('share-value').textContent = `${share}%`;
        $('share-fill').style.width = `${share}%`;
        for (const [team, count] of competing) {
            const fill = $(`fleet-fill-${team}`), label = $(`fleet-count-${team}`);
            if (fill) fill.style.width = `${total ? count / total * 100 : 0}%`;
            if (label) label.textContent = String(count);
        }
        $('world-label').textContent = game.worldLabel();
        $('world-detail').textContent = game.worldDetail();
        $('match-status').textContent = this.matchStatus(share / 100, competing.filter(([, n]) => n > 0).length, counts.neutral || 0);
        this.refreshAbilities(game.player);
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
        const input = this.game.input, rules = this.game.rules, rally = $('slot-rally'), freeze = $('slot-freeze');
        const cooling = !player.rallying && player.coolOff > 0, wait = player.freezeWait;
        rally.classList.toggle('active', player.rallying);
        rally.classList.toggle('cooling', cooling);
        rally.setAttribute('aria-pressed', String(player.rallying));
        rally.querySelector('.ability-label').textContent = input.rallyLatched ? 'Release' : 'Rally';
        $('rally-status').textContent = player.rallying ? (input.rallyLatched ? 'Tap to move' : 'Release to recruit') : cooling ? `Recruit in ${player.coolOff.toFixed(1)}s` : '';
        $('rally-cooldown').style.height = cooling ? `${player.coolOff / rules.rallyCoolOff * 100}%` : '0%';
        freeze.classList.toggle('cooling', wait > 0);
        freeze.classList.toggle('aiming', input.freezeAiming);
        $('freeze-cooldown').style.height = `${Math.min(1, wait / (wait > rules.freezeCooldown ? rules.freezeLockout : rules.freezeCooldown)) * 100}%`;
        $('freeze-status').textContent = wait > 0 ? `${wait.toFixed(1)}s` : input.freezeAiming ? 'Tap a rival' : input.isTouch ? 'Tap to aim' : '';
    }

    refreshCoach() {
        const game = this.game, player = game.player, input = game.input;
        const content = game.practice ? game.tutorial.coach() : {
            step: '', detail: '', checklist: [],
            title: input.freezeAiming ? 'Tap a rival to freeze them.'
                : player.rallying ? 'Release beside a smaller group.'
                : !game.playerActed ? 'Hold to move your ships.'
                : game.score < 300 ? 'Release close to a smaller group.'
                : game.gameTime < 45 ? 'Freeze half a group. Frozen ships cannot defend.'
                : (game.sim.counts[game.playerTeam] || 0) / Math.max(1, game.sim.boids.length) < 0.25 ? 'Regroup on a smaller fight.'
                : game.gameMode === 'survival' ? 'Hold for the next wave.' : 'Keep recruiting.',
        };
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
        $('coach').classList.toggle('hidden', !open);
        $('btn-guide').setAttribute('aria-expanded', String(open));
        if (open) this.setDetailsOpen(false);
    }

    setDetailsOpen(open) {
        $('details-sheet').classList.toggle('hidden', !open);
        $('details-scrim').classList.toggle('hidden', !open);
        $('btn-details').setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('details-open', open);
        if (open) this.setCoachOpen(false);
    }

    setRivalStatus(status) {
        const failed = ['offline', 'error'].includes(status.state), name = this.game.rivalName();
        $('rival-status').textContent = status.label || '';
        $('rival-reconnect').classList.toggle('hidden', !(failed && this.game.duelKind === 'duel-jev'));
        $('pause-status').textContent = failed ? `${status.message || `${name} is unavailable.`} (${status.code || 'connection_error'}) Resume to retry.` : `The match is paused. ${name} pauses too.`;
    }

    // Dialogs -------------------------------------------------------------

    show(id) {
        this.lastFocus = document.activeElement;
        $(id).classList.remove('hidden');
        this.setCoachOpen(false);
        this.setDetailsOpen(false);
        $(id).querySelector('.btn-primary, button')?.focus?.({ preventScroll: true });
    }

    hide(id) {
        $(id).classList.add('hidden');
        this.lastFocus?.focus?.({ preventScroll: true });
    }

    hideOverlays() { for (const id of OVERLAYS) $(id).classList.add('hidden'); }

    showPause() {
        if (this.game.gameMode !== 'duel') $('pause-status').textContent = '';
        this.show('pause-overlay');
    }

    /** Lesson intros and Levels briefings share one dialog. */
    showIntro({ eyebrow, title, description, instruction, secondary }) {
        $('intro-eyebrow').textContent = eyebrow;
        $('intro-title').textContent = title;
        $('intro-description').textContent = description;
        $('intro-instruction').textContent = instruction;
        $('btn-intro-secondary').textContent = secondary;
        this.show('intro-overlay');
    }

    showUpgrades(choices, onPick) {
        $('upgrade-cards').replaceChildren(...choices.map(upgrade =>
            card({ eyebrow: `${upgrade.icon} ${upgrade.category}`, title: upgrade.name, text: upgrade.description, className: 'upgrade-card' }, () => onPick(upgrade))));
        this.show('upgrade-overlay');
    }

    showResult(won) {
        const game = this.game, practice = game.practice, levels = game.gameMode === 'levels', time = ['Time', formatTime(game.gameTime)];
        this.saveRecord(game.score);
        this.showRecords();
        const stats = won ? [time, ['Recruited', String(game.conversions)], ['Score', game.score.toLocaleString()], ['Rank', game.score > 30000 ? 'S+' : game.score > 15000 ? 'S' : 'A']]
            : game.gameMode === 'survival' ? [time, ['Waves', String(game.survival?.wave ?? 0)], ['Score', game.score.toLocaleString()]]
            : [time, ['Peak share', `${Math.round(game.peakPlayerCount / Math.max(1, game.startShips) * 100)}%`]];
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
        if (this.resultWon && game.practice) game.tutorial.next();
        else if (this.resultWon && game.gameMode === 'levels') game.advanceLevel();
        else game.restart();
    }
}
