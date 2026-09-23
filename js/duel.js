// Duel lifecycle mixed into Game: one entry point for every rival kind, a
// once-per-simulated-second decision clock, gray-ship waves and rival status.
import { createRival, loadLocalModel, RIVAL_NAMES } from './ai/rivals.js';
import { getOpponentStatus } from './ai/jev.js';
import { stepNeutralWaves } from './arena.js';

export const DuelMethods = {
    rivalName() { return RIVAL_NAMES[this.duelKind] ?? 'Rival'; },

    /** Opens a duel against `kind`, checking the rival's requirements first. */
    async startDuelMode(kind) {
        if (!(kind in RIVAL_NAMES)) throw new Error(`Unknown rival: ${kind}`);
        const token = this.duelToken = (this.duelToken || 0) + 1;
        this.gameState = 'connecting';
        this.ui.setBusy(true);
        try {
            if (kind === 'duel-jev') {
                const status = await getOpponentStatus();
                if (token !== this.duelToken) return;
                if (!status.reachable || !status.configured) { this.ui.showConnectJev(); return; }
            }
            this.localModel = kind === 'duel-local' ? await loadLocalModel() : null;
            if (token !== this.duelToken) return;
            Object.assign(this, { practice: false, gameMode: 'duel', duelKind: kind, playerTeam: 'dragon' });
            this.audio.init();
            this.startGame({ fresh: true });
        } catch (error) {
            if (token !== this.duelToken) return;
            this.gameState = 'menu';
            this.ui.showScreen('mode-screen');
            this.ui.toast(kind === 'duel-jev' ? 'Start the Jev proxy with "node server.mjs", then open its local address.' : error.message);
        } finally {
            if (token === this.duelToken) this.ui.setBusy(false);
        }
    },

    startDuel() {
        this.rival = createRival(this.duelKind, { model: this.localModel, style: (this.world?.seed ?? 0) % 3 });
        this.decisionClock = 1;
        this.decisionSecond = 0;
        if (document.hidden) this.pause();
        else this.resumeRival();
    },

    updateDuel(dt) {
        if (!this.rival) return;
        this.decisionClock += dt;
        while (this.decisionClock >= 1) {
            this.decisionClock -= 1;
            this.rival.tick(this.sim, this.opponentTeam, this.decisionSecond++);
        }
        stepNeutralWaves(this.arena, dt);
    },

    resumeRival() {
        if (this.gameMode !== 'duel' || this.practice || !this.rival) return;
        this.rival.start(status => this.reportRival(status), this.sim, this.opponentTeam);
    },

    stopRival() { this.rival?.stop(); },

    disposeRival() {
        this.rival?.stop();
        this.rival?.dispose?.();
        this.rival = null;
    },

    reportRival(status) {
        this.rivalStatus = status;
        this.ui.setRivalStatus(status);
        if (['offline', 'error'].includes(status.state) && this.gameState === 'playing') {
            this.pause();
            this.renderer.addFloatingText(`${this.rivalName()} disconnected — reconnect to continue`, this.renderer.width / 2, this.renderer.height / 2, '#ffd28a', 16);
        }
    },
};
