// Reactive UI state and the actions the menus, HUD and dialogs call. The
// Svelte components in src/components only render this state and forward
// events to it, so every label still comes from the catalog, rules and settings
// schema in one place. The game engine talks to this class and never to the DOM.
import type { Game } from './game.ts';
import { TEAMS, MODES, IS_LOCAL, teamPerks } from './catalog.ts';
import { onlineAvailable, REGIONS } from './net/config.ts';
import { settings, setSetting, resetSettings, SETTINGS_SCHEMA } from './settings.ts';
import type { Lobby } from './net/lobby.ts';

export type ScreenId =
    | 'main-menu' | 'mode-screen' | 'lessons-screen' | 'guide-screen' | 'online-screen' | 'help-screen'
    | 'team-select-screen' | 'rival-screen' | 'settings-screen' | 'game-screen';
export type OverlayId = 'pause-overlay' | 'result-overlay' | 'upgrade-overlay' | 'intro-overlay';

export interface LessonCard { index: number; title: string; description: string; done: boolean }
export interface IntroContent { eyebrow: string; title: string; description: string; instruction: string; secondary: string }
export interface CoachContent { step: string; title: string; detail: string; checklist: { done: boolean; label: string }[] }
export interface FleetBar { team: string; name: string; color: string; count: number; pct: number }
export interface PeerRow { id: string; name: string; busy: boolean; waiting: boolean; disabled: boolean; label: string; note?: string }
export interface RivalStatus { state?: string; label?: string; message?: string; code?: string }
export interface UpgradeChoice { id: string; icon: string; category: string; name: string; description: string; apply: (...args: any[]) => void }

const RECORD_PREFIX = 'swarm-best-';
const PROGRESS_KEYS = ['swarm-lessons-v2', 'swarm-lessons-v1', 'swarm-expedition-v1'];

export function formatTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const emptyCoach = (): CoachContent => ({ step: '', title: '', detail: '', checklist: [] });

export class UIManager {
    game!: Game;

    // Navigation
    screen = $state<ScreenId>('main-menu');
    history: ScreenId[] = [];
    toastText = $state('');
    toastVisible = $state(false);
    busy = $state(false);
    overlays = $state<Record<OverlayId, boolean>>({ 'pause-overlay': false, 'result-overlay': false, 'upgrade-overlay': false, 'intro-overlay': false });

    // Menus
    records = $state('');
    continueLabel = $state<string | null>(null);
    showEnemyChoice = $state(false);
    levelEnemies = $state('ai');
    lessons = $state.raw<LessonCard[]>([]);
    lessonsDone = $state(0);
    jevNote = IS_LOCAL;
    settingsVersion = $state(0);

    // Match HUD
    detailsOpen = $state(false);
    coachOpen = $state(false);
    duel = $state(false);
    practice = $state(false);
    timer = $state('00:00');
    scoreText = $state('0');
    youCount = $state(0);
    rivalCount = $state(0);
    rivalName = $state('Rival');
    combo = $state(0);
    shareLabel = $state('Your share');
    shareValue = $state('0%');
    sharePct = $state(0);
    worldLabel = $state('');
    worldDetail = $state('');
    matchStatus = $state('');
    fleets = $state.raw<FleetBar[]>([]);
    coach = $state<CoachContent>(emptyCoach());
    rivalStatus = $state('');
    reconnectVisible = $state(false);
    pauseStatus = $state('');
    freeze = $state({ hidden: false, locked: false, cooling: false, aiming: false, cooldownPct: 0, status: '' });

    // Dialogs
    intro = $state<IntroContent>({ eyebrow: '', title: '', description: '', instruction: '', secondary: '' });
    result = $state({ title: '', quote: '', stats: [] as [string, string][], primary: '', replay: false });
    upgrades = $state.raw<UpgradeChoice[]>([]);
    invite = $state<{ name: string } | null>(null);
    lobbyView = $state.raw<{ available: boolean; state: string; text: string; name: string; region: string; peers: PeerRow[] }>({
        available: onlineAvailable(), state: 'offline', text: '', name: '', region: '', peers: [],
    });

    private lastFocus: Element | null = null;
    private toastTimer: ReturnType<typeof setTimeout> | undefined;
    private coachMessage = '';
    private resultWon = false;
    private onUpgradePick: ((upgrade: UpgradeChoice) => void) | null = null;

    /** Called by the Game once it exists; menus are built from static data so there is nothing else to set up. */
    attach(game: Game) {
        this.game = game;
        this.refreshContinue();
        this.showRecords();
    }

    // Static data for the menus ------------------------------------------------

    modeGroups() {
        return [...new Set(MODES.map(mode => mode.group))].map(group => ({
            group, modes: MODES.filter(mode => mode.group === group && (mode.id !== 'online' || onlineAvailable())),
        }));
    }

    teams() { return Object.values(TEAMS).map(team => ({ team, perks: teamPerks(team).join(' · ') })); }

    // Audio + navigation ---------------------------------------------------------

    click() { this.game.audio.playClick(); }

    /** Opens a screen from a menu button (adds click sound and starts audio on first use). */
    navigate(id: ScreenId) { this.game.audio.init(); this.click(); this.showScreen(id); }

    goBack() { this.click(); this.back(); }

    showScreen(id: ScreenId, { returnTo = null, push = true }: { returnTo?: ScreenId | null; push?: boolean } = {}) {
        if (push && this.screen !== id) {
            this.history.push(returnTo || this.screen);
            globalThis.history?.pushState?.({ screen: id }, '');
        }
        // Leaving the lobby for anything but a match takes you out of it.
        if (this.screen === 'online-screen' && id !== 'game-screen' && id !== 'online-screen') this.game.leaveLobby?.();
        this.screen = id;
        this.setDetailsOpen(false);
        this.setCoachOpen(false);
        if (id === 'mode-screen') this.refreshContinue();
        if (id === 'team-select-screen') this.refreshEnemyChoice();
        if (id === 'main-menu') { this.history = []; this.showRecords(); }
    }

    back() {
        const target = this.history.pop() || 'main-menu';
        if (target === 'game-screen') this.showScreen('game-screen', { push: false });
        else if (['game-screen', 'team-select-screen'].includes(this.screen) || target === 'main-menu') this.game.quitToMenu();
        else this.showScreen(target, { push: false });
    }

    /** Escape closes the details sheet first, then steps back out of a menu. */
    escape() {
        if (this.detailsOpen) { this.setDetailsOpen(false); return true; }
        if (this.screen !== 'game-screen' && this.screen !== 'main-menu') { this.back(); return true; }
        return false;
    }

    /** The browser Back button pauses a running match instead of leaving it. */
    popstate() {
        if (this.game.gameState === 'playing') { this.game.pause(); globalThis.history?.pushState({ screen: this.screen }, ''); }
        else this.back();
    }

    toast(message: string, ms = 3200) {
        this.toastText = message;
        this.toastVisible = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toastVisible = false; }, ms);
    }

    setBusy(busy: boolean) { this.busy = busy; }

    haptic(ms: number | number[]) { if (settings.haptics) globalThis.navigator?.vibrate?.(ms); }

    showConnectJev() {
        this.game.gameState = 'menu';
        globalThis.location?.assign('/connect.html');
    }

    // Menu actions ----------------------------------------------------------------

    pickMode(mode: { id: string }) {
        this.game.audio.init();
        this.click();
        if (mode.id === 'duel') this.showScreen('rival-screen');
        else if (mode.id === 'online') this.game.openLobby();
        else this.game.showTeamSelect(mode.id);
    }

    pickRival(id: string) { this.click(); this.game.startDuelMode(id); }

    pickEnemies(id: string) { this.click(); this.game.levelEnemies = id; this.refreshEnemyChoice(); }

    pickTeam(id: string) { this.click(); this.game.selectTeam(id); }

    refreshEnemyChoice() {
        this.showEnemyChoice = this.game.gameMode === 'levels';
        this.levelEnemies = this.game.levelEnemies;
    }

    refreshContinue() {
        const saved = this.game.loadCheckpoint();
        this.continueLabel = saved ? `Continue Levels · sector ${saved.level}` : null;
    }

    continueLevels() {
        this.click();
        if (!this.game.resumeExpedition()) this.toast('No saved sector yet. Pick Levels to start.');
    }

    openLessons() { this.game.audio.init(); this.click(); this.game.tutorial.showLessons(); }

    showLessons(lessons: LessonCard[], doneCount: number) {
        this.showScreen('lessons-screen');
        this.lessons = lessons;
        this.lessonsDone = doneCount;
    }

    startLesson(index: number) { this.click(); this.game.tutorial.start(index); }

    // Settings ---------------------------------------------------------------------

    /** Saves a setting and applies rule changes to the running match immediately. */
    applySetting(key: string, value: string | number | boolean) {
        const field = SETTINGS_SCHEMA.find(item => item.key === key);
        if (field && setSetting(key, value) && field.rule) this.game.sim.rules[key] = value;
    }

    resetSettings() { this.click(); resetSettings(); this.settingsVersion++; this.toast('Settings restored to defaults.'); }

    clearProgress() {
        this.click();
        if (globalThis.confirm && !globalThis.confirm('Clear lesson progress, saved sectors and best scores on this device?')) return;
        try {
            for (const key of [...PROGRESS_KEYS, ...MODES.map(mode => RECORD_PREFIX + mode.id), RECORD_PREFIX + 'duel']) localStorage.removeItem(key);
        } catch { /* Storage unavailable. */ }
        this.game.tutorial.completed.clear();
        this.showRecords();
        this.toast('Progress and records cleared.');
    }

    // Records ----------------------------------------------------------------------

    saveRecord(score: number) {
        if (this.game.practice || !score) return;
        const key = RECORD_PREFIX + this.game.gameMode;
        try { if (score > (Number(localStorage.getItem(key)) || 0)) localStorage.setItem(key, String(score)); } catch { /* Optional. */ }
    }

    showRecords() {
        let records: string[] = [];
        try {
            records = MODES.map(mode => [mode.name, Number(localStorage.getItem(RECORD_PREFIX + mode.id)) || 0] as const).filter(([, best]) => best).map(([name, best]) => `${name} ${best.toLocaleString()}`);
        } catch { /* Optional. */ }
        this.records = records.length ? `Best · ${records.join(' · ')}` : '';
    }

    // Online lobby -----------------------------------------------------------------

    /** Turns the lobby's live state into rows and a status line for the lobby screen. */
    renderLobby(lobby: Lobby | null) {
        const profile = this.game.onlineProfile();
        if (!onlineAvailable()) {
            this.lobbyView = { available: false, state: 'offline', text: 'Online play is not set up on this copy of the game yet.', name: profile.name, region: profile.region, peers: [] };
            return;
        }
        const region = REGIONS.find(r => r.id === lobby?.region)?.name ?? '';
        const found = [...(lobby?.peers.values() ?? [])].sort((a, b) => Number(a.busy) - Number(b.busy) || a.name.localeCompare(b.name));
        const pending = lobby?.pending() ?? [];
        const stuck = pending.filter(p => p.failed);
        const text = lobby?.status === 'connecting' ? `Joining the ${region} lobby…`
            : lobby?.status === 'error' ? 'The lobby is unreachable right now. Try again later.'
            : lobby?.health === 'denied' ? 'The matchmaking server refused this game. Its database rules need publishing in the Firebase console.'
            : lobby?.health === 'offline' ? 'Can\'t reach the matchmaking server. Check your internet connection, or try another network.'
            : lobby?.outgoing ? `Waiting for ${lobby.peers.get(lobby.outgoing.peerId)?.name ?? 'them'} to answer…`
            : found.length ? `${found.length} other pilot${found.length === 1 ? '' : 's'} in the ${region} lobby`
            : stuck.length ? `Found ${stuck.map(p => p.name).join(', ')}, but your networks won't connect. Try both on Wi-Fi, or the same network.`
            : pending.length ? `Found ${pending.length} pilot${pending.length === 1 ? '' : 's'}, connecting…`
            : lobby?.health === 'connecting' ? `Joining the ${region} lobby…`
            : `You are the only pilot in the ${region} lobby. Share the game with a friend, or try another region.`;
        const peers: PeerRow[] = found.map(peer => {
            const waiting = lobby!.outgoing?.peerId === peer.id;
            return { id: peer.id, name: peer.name, busy: peer.busy, waiting, label: waiting ? 'Cancel' : peer.busy ? 'In a match' : 'Challenge',
                disabled: Boolean(peer.busy || (lobby!.outgoing && !waiting) || lobby!.busy) };
        }).concat(pending.map(p => ({ id: p.id, name: p.name, busy: true, waiting: false, disabled: true,
            label: p.failed ? "Can't connect" : 'Connecting…', note: p.failed ? 'blocked by network' : undefined })));
        this.lobbyView = { available: true, state: lobby?.status ?? 'offline', text, name: lobby?.name ?? profile.name, region: profile.region, peers };
    }

    setOnlineName(name: string) {
        const game = this.game, profile = game.onlineProfile();
        game.saveOnlineProfile({ name });
        game.lobby?.setName(profile.name);
        this.lobbyView = { ...this.lobbyView, name: game.lobby?.name ?? profile.name };
    }

    setOnlineRegion(id: string) {
        const game = this.game, profile = game.onlineProfile();
        this.click();
        game.saveOnlineProfile({ region: id });
        this.lobbyView = { ...this.lobbyView, region: id };
        if (onlineAvailable()) game.lobby?.join(id, profile.name);
    }

    challenge(peer: PeerRow) {
        const lobby = this.game.lobby;
        this.click();
        if (!lobby) return;
        if (peer.waiting) lobby.cancelInvite(); else lobby.invite(peer.id);
    }

    showInvite(peer: { name: string }) {
        this.invite = { name: peer.name };
        this.click();
        this.haptic(40);
    }

    hideInvite() { this.invite = null; }

    answerInvite(accept: boolean) { this.click(); this.hideInvite(); this.game.lobby?.answer(accept); }

    // Match HUD --------------------------------------------------------------------

    prepareMatch() {
        const game = this.game, duel = game.gameMode === 'duel' && !game.practice;
        globalThis.document?.documentElement.style.setProperty('--player-color', game.palette(game.playerTeam).color);
        this.duel = duel;
        this.practice = game.practice;
        this.rivalStatus = '';
        this.reconnectVisible = false;
        this.shareLabel = game.practice ? `Lesson ${game.tutorial.index + 1}` : 'Your share';
        const locked = game.practice && !game.tutorial.allowsAbility('freeze');
        this.freeze = { hidden: false, locked, cooling: false, aiming: false, cooldownPct: 0, status: '' };
        this.fleets = game.sim.teams.filter(team => team !== 'neutral').map(team => ({
            team, color: game.palette(team).color, count: 0, pct: 0,
            name: duel ? (team === game.playerTeam ? 'You' : game.rivalName()) : `${TEAMS[team]?.name ?? team}${team === game.playerTeam ? ' · you' : ''}`,
        }));
        this.coachMessage = '';
    }

    /** Called ten times a second while playing. */
    refresh() {
        const game = this.game, counts = game.sim.counts;
        const competing = Object.entries(counts).filter(([team]) => team !== 'neutral') as [string, number][];
        const total = competing.reduce((sum, [, n]) => sum + n, 0);
        const mine = counts[game.playerTeam] || 0;
        const share = total ? Math.round(mine / total * 100) : 0;
        this.timer = formatTime(game.gameTime);
        this.scoreText = game.gameMode === 'survival' ? `Wave ${game.survival?.wave ?? 0} · ${game.score.toLocaleString()}` : game.score.toLocaleString();
        this.youCount = mine;
        this.rivalCount = counts[game.opponentTeam] || 0;
        this.rivalName = game.rivalName();
        this.combo = game.combo;
        this.shareValue = `${share}%`;
        this.sharePct = share;
        this.fleets = this.fleets.map(bar => {
            const count = counts[bar.team] || 0;
            return { ...bar, count, pct: total ? count / total * 100 : 0 };
        });
        this.worldLabel = game.worldLabel();
        this.worldDetail = game.worldDetail();
        this.matchStatus = this.statusFor(share / 100, competing.filter(([, n]) => n > 0).length, counts.neutral || 0);
        this.refreshAbilities(game.player);
        this.refreshCoach();
    }

    private statusFor(ratio: number, alive: number, neutrals: number) {
        if (this.game.gameMode === 'duel') return neutrals ? `${neutrals} unclaimed` : '';
        if (alive === 2) return 'Two fleets left';
        if (ratio > 0.6) return 'You lead';
        if (ratio < 0.15) return 'Regroup';
        if (ratio > 0.4) return 'Growing';
        return ratio < 0.25 ? 'Find a smaller group' : '';
    }

    private refreshAbilities(player: { freezeWait: number }) {
        const input = this.game.input, rules = this.game.rules, wait = player.freezeWait;
        this.freeze = {
            ...this.freeze,
            hidden: this.game.gameTime < rules.freezeLockout,
            cooling: wait > 0,
            aiming: input.freezeAiming,
            cooldownPct: Math.min(1, wait / (wait > rules.freezeCooldown ? rules.freezeLockout : rules.freezeCooldown)) * 100,
            status: wait > 0 ? `${wait.toFixed(1)}s` : input.freezeAiming ? 'Tap a rival' : input.isTouch ? 'Tap to aim' : '',
        };
    }

    private refreshCoach() {
        const game = this.game, player = game.player, input = game.input;
        const content: CoachContent = game.practice ? game.tutorial.coach() : {
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
        this.coach = content;
    }

    toggleFreeze() { this.game.input.pressFreeze(); }

    toggleCoach() { this.setCoachOpen(!this.coachOpen); }

    toggleDetails() { this.setDetailsOpen(!this.detailsOpen); }

    setCoachOpen(open: boolean) {
        this.coachOpen = open;
        if (open) this.setDetailsOpen(false);
    }

    setDetailsOpen(open: boolean) {
        this.detailsOpen = open;
        if (open) this.setCoachOpen(false);
    }

    /** The pause button: online matches leave the lobby match instead of pausing. */
    pausePressed() {
        this.click();
        const game = this.game;
        if (!game.online) { game.pause(); return; }
        if (!globalThis.confirm || globalThis.confirm('Leave this online match? Your opponent wins.')) game.backToLobby();
    }

    setRivalStatus(status: RivalStatus) {
        const failed = ['offline', 'error'].includes(status.state ?? ''), name = this.game.rivalName();
        this.rivalStatus = status.label || '';
        this.reconnectVisible = failed && this.game.duelKind === 'duel-jev';
        this.pauseStatus = failed ? `${status.message || `${name} is unavailable.`} (${status.code || 'connection_error'}) Resume to retry.` : `The match is paused. ${name} pauses too.`;
    }

    // Dialogs ----------------------------------------------------------------------

    /** Remembers the focused element so closing the dialog can hand focus back to it. */
    rememberFocus() { this.lastFocus = globalThis.document?.activeElement ?? null; }

    restoreFocus() { (this.lastFocus as HTMLElement | null)?.focus?.({ preventScroll: true }); }

    show(id: OverlayId) {
        this.rememberFocus();
        this.overlays[id] = true;
        this.setCoachOpen(false);
        this.setDetailsOpen(false);
    }

    hide(id: OverlayId) {
        if (!this.overlays[id]) return;
        this.overlays[id] = false;
        this.restoreFocus();
    }

    hideOverlays() { for (const id of Object.keys(this.overlays) as OverlayId[]) this.overlays[id] = false; }

    showPause() {
        if (this.game.gameMode !== 'duel') this.pauseStatus = '';
        this.show('pause-overlay');
    }

    resume() { this.click(); this.game.resume(); }
    restart() { this.click(); this.game.restart(); }
    quit() { this.click(); this.game.quitToMenu(); }
    pauseSettings() { this.click(); this.showScreen('settings-screen', { returnTo: 'game-screen' }); }
    pauseLessons() { this.click(); this.game.tutorial.showLessons(); }

    /** Lesson intros and Levels briefings share one dialog. */
    showIntro(content: IntroContent) {
        this.intro = content;
        this.show('intro-overlay');
    }

    startFromIntro() {
        this.click();
        this.hide('intro-overlay');
        this.game.gameState = 'playing';
        this.game.audio.init();
    }

    introSecondary() {
        this.click();
        if (this.game.practice) this.game.tutorial.showLessons(); else this.game.quitToMenu();
    }

    showUpgrades(choices: UpgradeChoice[], onPick: (upgrade: UpgradeChoice) => void) {
        this.upgrades = choices;
        this.onUpgradePick = onPick;
        this.show('upgrade-overlay');
    }

    pickUpgrade(upgrade: UpgradeChoice) { this.click(); this.onUpgradePick?.(upgrade); }

    quitFromUpgrade() { this.click(); this.hide('upgrade-overlay'); this.game.quitToMenu(); }

    showResult(won: boolean) {
        const game = this.game, practice = game.practice, levels = game.gameMode === 'levels', time: [string, string] = ['Time', formatTime(game.gameTime)];
        this.saveRecord(game.score);
        this.showRecords();
        const stats: [string, string][] = won ? [time, ['Recruited', String(game.conversions)], ['Score', game.score.toLocaleString()], ['Rank', game.score > 30000 ? 'S+' : game.score > 15000 ? 'S' : 'A']]
            : game.gameMode === 'survival' ? [time, ['Waves', String(game.survival?.wave ?? 0)], ['Score', game.score.toLocaleString()]]
            : [time, ['Peak share', `${Math.round(game.peakPlayerCount / Math.max(1, game.startShips) * 100)}%`]];
        this.result = {
            title: !won ? 'Try again' : practice ? 'Lesson done' : levels ? `Sector ${game.level} clear` : 'You won',
            quote: !won ? 'Hold, release, recruit.' : practice ? game.tutorial.text('success') : levels ? `${game.losses} lost · Next map ready.` : '',
            stats,
            primary: !won ? 'Retry' : practice ? (game.tutorial.index < game.tutorial.lessonCount - 1 ? 'Next lesson' : 'Pick a mode') : levels ? 'Next sector' : 'Again',
            replay: won && practice,
        };
        this.resultWon = won;
        if (won) this.haptic([30, 40, 30]);
        this.show('result-overlay');
    }

    replayLesson() { this.click(); this.game.tutorial.start(this.game.tutorial.index); }

    resultAction() {
        this.click();
        const game = this.game;
        if (game.online || game.duelKind === 'duel-online') game.backToLobby();
        else if (this.resultWon && game.practice) game.tutorial.next();
        else if (this.resultWon && game.gameMode === 'levels') game.advanceLevel();
        else game.restart();
    }
}
