import { Vector } from './vector.js';

const FREEZE_KEYS = ['Space', 'KeyQ', 'KeyE', 'Digit1', 'Digit2'];

// Pointer Events keep mouse, touch and pen on one targeting path.
export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.pointer = new Vector(window.innerWidth / 2, window.innerHeight / 2);
        this.pointerId = null;
        this.rallyLatched = false;
        this.freezeAiming = false;
        this.isTouch = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        const playing = () => game.gameState === 'playing';
        const locate = event => {
            const rect = canvas.getBoundingClientRect();
            const scale = game.renderer?.viewScale || 1;
            this.pointer = new Vector((event.clientX - rect.left) * canvas.width / rect.width / scale, (event.clientY - rect.top) * canvas.height / rect.height / scale);
        };

        canvas.addEventListener('pointerdown', event => {
            if (!playing() || this.pointerId !== null) return;
            if (event.pointerType === 'touch') this.isTouch = true;
            locate(event);
            event.preventDefault();
            if (event.button === 2 || this.freezeAiming) {
                this.freezeAiming = false;
                game.castFreeze();
                return;
            }
            if (event.button !== 0) return;
            this.pointerId = event.pointerId;
            canvas.setPointerCapture?.(event.pointerId);
            game.setRally(true);
        });
        canvas.addEventListener('pointermove', event => {
            // A latched (tap) Rally moves only on deliberate taps, not on hover.
            if (this.rallyLatched && this.pointerId === null && !this.freezeAiming) return;
            if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
            locate(event);
        });
        const release = event => {
            if (event.pointerId !== this.pointerId) return;
            this.pointerId = null;
            if (event.type !== 'pointerup') this.rallyLatched = false;
            if (playing() && !this.rallyLatched) game.setRally(false);
        };
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, release);
        canvas.addEventListener('contextmenu', event => event.preventDefault());
        window.addEventListener('blur', () => game.pause());
        document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });
        document.addEventListener('keydown', event => {
            // Buttons own Space/Enter; do not also cast Freeze through the global handler.
            if (event.repeat || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target?.tagName)) return;
            if (playing() && FREEZE_KEYS.includes(event.code)) { event.preventDefault(); game.castFreeze(); }
            else if (event.code === 'Escape' || event.code === 'KeyP') {
                if (this.freezeAiming) this.freezeAiming = false;
                else if (playing()) game.pause();
                else if (game.gameState === 'paused') game.resume();
            } else if (event.code === 'KeyR' && ['playing', 'paused'].includes(game.gameState)) game.restart();
        });
    }

    reset() {
        this.pointerId = null;
        this.rallyLatched = false;
        this.freezeAiming = false;
    }

    /** Ends the current drag without releasing Rally twice (Freeze already released it). */
    endGesture() { this.pointerId = null; }

    toggleRally() {
        if (this.game.gameState !== 'playing') return;
        this.rallyLatched = !this.game.player.rallying;
        this.game.setRally(this.rallyLatched);
    }

    /** Touch aims Freeze with a second tap; mouse and keyboard cast at the pointer. */
    pressFreeze() {
        const game = this.game;
        if (game.gameState !== 'playing' || game.player.freezeWait > 0) return;
        if (!this.isTouch) { game.castFreeze(); return; }
        game.setRally(false);
        this.rallyLatched = false;
        this.pointerId = null;
        this.freezeAiming = !this.freezeAiming;
    }
}
