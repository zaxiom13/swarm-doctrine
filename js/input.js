import { Vector } from './vector.js';

// Pointer Events keep mouse, touch and pen on the same targeting path.
export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas; this.game = game;
        this.mousePos = new Vector(window.innerWidth / 2, window.innerHeight / 2);
        this.mouseDown = false; this.rightMouseDown = false; this.freezeAiming = false;
        this.pointerId = null;
        this.isMobile = window.matchMedia?.('(pointer: coarse)').matches || false;
        const position = event => {
            const rect = canvas.getBoundingClientRect();
            this.mousePos = new Vector((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height);
        };
        canvas.addEventListener('pointerdown', event => {
            if (game.gameState !== 'playing' || this.pointerId !== null) return;
            if (event.pointerType === 'touch') this.isMobile = true;
            position(event); event.preventDefault();
            if (event.button === 2 || this.freezeAiming) {
                this.freezeAiming = false; game.triggerEmp(); return;
            }
            if (event.button !== 0) return;
            this.pointerId = event.pointerId; this.mouseDown = true;
            canvas.setPointerCapture?.(event.pointerId);
            game.setBeaconActive(true);
        });
        canvas.addEventListener('pointermove', event => {
            if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
            position(event);
        });
        const release = event => {
            if (event.pointerId !== this.pointerId) return;
            this.pointerId = null; this.mouseDown = false;
            if (game.gameState === 'playing' && game.beaconActive) game.setBeaconActive(false);
        };
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('lostpointercapture', release);
        canvas.addEventListener('contextmenu', event => event.preventDefault());
        window.addEventListener('blur', () => {
            this.pointerId = null;
            if (game.gameState === 'playing') game.pause();
            game.resetHeldInput();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && game.gameState === 'playing') game.pause();
        });
        document.addEventListener('keydown', event => {
            if (event.repeat || ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
            if (game.gameState === 'playing' && ['Space','KeyQ','KeyE','Digit1','Digit2'].includes(event.code)) {
                event.preventDefault(); game.triggerEmp();
            } else if (event.code === 'Escape' || event.code === 'KeyP') {
                if (this.freezeAiming) this.freezeAiming = false;
                else if (game.gameState === 'playing') game.pause();
                else if (game.gameState === 'paused') game.resume();
            } else if (event.code === 'KeyR' && ['playing','paused'].includes(game.gameState)) {
                game.gameMode === 'survival' ? game.startSurvivalMode() : game.startGame();
            }
        });
    }
    pressFreeze() {
        if (this.game.gameState !== 'playing' || this.game.empCooldown > 0) return;
        if (this.isMobile) {
            if (this.game.beaconActive) this.game.setBeaconActive(false);
            this.mouseDown = false; this.pointerId = null;
            this.freezeAiming = !this.freezeAiming;
        } else this.game.triggerEmp();
    }
}
