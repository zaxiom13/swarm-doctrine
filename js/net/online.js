// Online duels mixed into Game. The challenger hosts: it runs the one real
// Simulation, applies the guest's Rally/Freeze input to the rival team and
// streams snapshots back. The guest never steps the simulation; it shows the
// host's world, glides ships between snapshots and sends its own input.
import { Lobby } from './lobby.js';
import { ONLINE_ARENA, onlineAvailable, guessRegion } from './config.js';
import { encodeSnapshot, applySnapshot, drift, packEvent, validInput } from './sync.js';

const SNAPSHOT_SECONDS = 1 / 20;
const STEER_SECONDS = 1 / 15;
const SILENCE_SECONDS = 6;
const PROFILE_KEY = 'swarm-online-profile';

function loadProfile() {
    try { const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (saved?.name) return saved; } catch { /* Optional. */ }
    return { name: `Pilot ${Math.floor(100 + Math.random() * 900)}`, region: guessRegion() };
}

export const OnlineMethods = {
    onlineProfile() { return (this.profile ||= loadProfile()); },

    saveOnlineProfile(changes) {
        Object.assign(this.onlineProfile(), changes);
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch { /* Optional. */ }
    },

    /** Opens the lobby screen and joins the player's regional room. */
    async openLobby() {
        this.ui.showScreen('online-screen');
        if (!onlineAvailable()) { this.ui.renderLobby(null); return; }
        this.lobby ||= new Lobby({
            onChange: lobby => this.ui.renderLobby(lobby),
            onInvite: peer => this.ui.showInvite(peer),
            onCancel: () => this.ui.hideInvite(),
            onAnswer: (peer, accepted, reason) => { if (!accepted) this.ui.toast(`${peer?.name ?? 'They'} ${reason === 'timeout' ? 'did not answer' : reason === 'busy' ? 'is busy' : 'declined'}.`); },
            onStart: match => this.startOnlineMatch(match),
            onInput: (data, id) => this.onlineInput(data, id),
            onState: (data, id) => this.onlineState(data, id),
            onFx: (data, id) => this.onlineFx(data, id),
            onEnd: (data, id) => this.onlineEnd(data, id),
            onBye: (data, id) => this.onlinePeerGone(id, 'left the match'),
            onPeerLeave: id => this.onlinePeerGone(id, 'disconnected'),
        });
        const { region, name } = this.onlineProfile();
        try { await this.lobby.join(region, name); } catch (error) {
            this.lobby.status = 'error';
            this.ui.renderLobby(this.lobby);
            this.ui.toast(`Could not reach the lobby: ${error.message}`);
        }
    },

    leaveLobby() { this.lobby?.leave(); this.lobby = null; },

    startOnlineMatch({ role, peer, seed }) {
        if (this.online) return;
        this.ui.hideInvite();
        this.lobby.setBusy(true);
        this.online = { role, peerId: peer.id, peerName: peer.name, sendTimer: 0, steerTimer: 0, silence: 0, holding: false, events: [], ended: false, got: false };
        this.renderer.fixArena(ONLINE_ARENA);
        Object.assign(this, { practice: false, gameMode: 'duel', duelKind: 'duel-online', playerTeam: role === 'host' ? 'dragon' : 'salamander', mapSeed: seed });
        this.audio.init();
        this.startGame({ fresh: false });
        // Until the first snapshot arrives the guest shows only the map.
        if (role === 'guest') this.sim.boids = [];
        this.renderer.addFloatingText(`${role === 'host' ? 'You challenged' : 'Challenged by'} ${peer.name}`, ONLINE_ARENA.width / 2, ONLINE_ARENA.height * 0.3, '#ffd28a', 22);
    },

    /** A stand-in rival for the host: the guest's input arrives as messages, not ticks. */
    onlineRival() {
        const name = this.online?.peerName ?? 'Rival';
        return { start: report => report({ state: 'online', label: `Online · ${name}` }), stop() {}, tick() {} };
    },

    // Host ------------------------------------------------------------------

    onlineInput(data, peerId) {
        const online = this.online;
        if (!online || online.role !== 'host' || peerId !== online.peerId || this.gameState !== 'playing') return;
        const action = validInput(data, this.sim);
        if (action) this.sim.commander(this.opponentTeam).apply(action);
        online.silence = 0;
    },

    /** Called after each host tick: forwards events and, 20 times a second, a snapshot. */
    onlineHostTick(dt) {
        const online = this.online;
        online.sendTimer -= dt;
        if (online.sendTimer > 0) return;
        online.sendTimer = SNAPSHOT_SECONDS;
        this.lobby.send('state', encodeSnapshot(this.sim), online.peerId);
        if (online.events.length) { this.lobby.send('fx', online.events, online.peerId); online.events = []; }
    },

    queueOnlineEvent(event) {
        const packed = this.online?.role === 'host' && packEvent(event);
        if (packed) this.online.events.push(packed);
    },

    // Guest -----------------------------------------------------------------

    onlineState(buffer, peerId) {
        const online = this.online;
        if (!online || online.role !== 'guest' || peerId !== online.peerId || !(buffer instanceof ArrayBuffer)) return;
        // Keep the guest's own Rally feeling immediate: the host's copy of it lags a little.
        const mine = this.player, holding = online.holding, target = { x: mine.target.x, y: mine.target.y };
        if (!applySnapshot(this.sim, buffer)) return;
        if (holding) { mine.rallying = true; mine.target.set(target.x, target.y); }
        online.silence = 0;
        online.got = true;
    },

    onlineFx(events, peerId) {
        if (this.online?.role !== 'guest' || peerId !== this.online.peerId || !Array.isArray(events)) return;
        for (const event of events.slice(0, 200)) if (event && typeof event.type === 'string') this.handleEvent(event);
    },

    /** The guest's frame: glide ships, keep steering, watch for a silent host. */
    onlineGuestTick(dt) {
        const online = this.online;
        drift(this.sim, dt);
        if (online.holding) {
            this.player.moveTarget(this.input.pointer.x, this.input.pointer.y);
            if ((online.steerTimer -= dt) <= 0) {
                online.steerTimer = STEER_SECONDS;
                this.sendOnlineInput({ type: 'rally', x: this.input.pointer.x, y: this.input.pointer.y });
            }
        }
        if ((this.hudTimer -= dt) <= 0) { this.hudTimer = 0.1; this.ui.refresh(); }
    },

    sendOnlineInput(action) { this.lobby?.send('input', action, this.online.peerId); },

    /** Guest controls: show them locally at once and tell the host. */
    onlineControl(kind, x, y) {
        const online = this.online;
        if (kind === 'rally') { online.holding = true; this.player.rally(x, y); this.sendOnlineInput({ type: 'rally', x, y }); }
        else if (kind === 'release') { online.holding = false; this.player.release(); this.sendOnlineInput({ type: 'release' }); }
        else if (kind === 'freeze') {
            online.holding = false;
            this.player.rallying = false;
            this.sendOnlineInput({ type: 'freeze', x, y });
        }
    },

    // Both ------------------------------------------------------------------

    /** Silence watchdog for both sides; the guest also watches for its first snapshot. */
    onlineWatch(dt) {
        const online = this.online;
        if (!online || online.ended) return;
        online.silence += dt;
        if (online.role === 'guest' && online.silence > SILENCE_SECONDS) this.onlinePeerGone(online.peerId, 'stopped responding');
        // The host tolerates a quiet guest (it may simply be waiting); a real drop arrives as a peer leave.
    },

    /** Host decides the winner and tells the guest. */
    onlineFinished(won) {
        const online = this.online;
        if (!online || online.ended) return;
        online.ended = true;
        if (online.role === 'host') {
            this.lobby.send('state', encodeSnapshot(this.sim), online.peerId);
            this.lobby.send('end', { winner: won ? this.playerTeam : this.opponentTeam }, online.peerId);
        }
    },

    onlineEnd(data, peerId) {
        const online = this.online;
        if (!online || online.role !== 'guest' || peerId !== online.peerId || online.ended) return;
        if (data?.winner === this.playerTeam) this.victory(); else this.defeat();
    },

    onlinePeerGone(peerId, why) {
        const online = this.online;
        if (!online || peerId !== online.peerId || online.ended) return;
        if (!['playing', 'paused'].includes(this.gameState)) return;
        this.ui.toast(`${online.peerName} ${why}. You win.`, 4000);
        this.gameState = 'playing';
        this.victory();
    },

    /** Leaving mid-match tells the other player, who wins. */
    forfeitOnline() {
        const online = this.online;
        if (online && !online.ended) this.lobby?.send('bye', {}, online.peerId);
        this.endOnline();
    },

    endOnline() {
        if (!this.online) return;
        this.online = null;
        this.renderer.fixArena(null);
        this.resizeWorld();
        this.lobby?.setBusy(false);
    },

    backToLobby() {
        this.forfeitOnline();
        this.disposeRival();
        this.resetHeldInput();
        this.gameState = 'menu';
        this.openLobby();
    },
};
