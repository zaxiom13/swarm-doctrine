// Input Handler - Mouse, touch, and keyboard
import { Vector } from './vector.js';

export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.mousePos = new Vector(window.innerWidth / 2, window.innerHeight / 2);
        this.mouseDown = false;
        this.rightMouseDown = false;
        this.isMobile = this.detectMobile();
        this.lastTouchTime = 0;
        
        this.setupMouseEvents();
        this.setupTouchEvents();
        this.setupKeyboardEvents();
    }
    
    detectMobile() {
        // Only check user agent and screen size, not touch capability
        // Many desktops have touch support but should still use click-to-scatter
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window);
    }
    
    setupMouseEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos = new Vector(e.clientX, e.clientY);
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouseDown = true;
                // Activate scatter while mouse is held
                if (this.game.scatterCooldown <= 0 && this.game.gameState === 'playing') {
                    this.game.scatterActive = true;
                    this.game.audio.playScatter();
                }
            }
            if (e.button === 2) this.rightMouseDown = true;
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
                // Deactivate scatter and start cooldown when mouse released
                if (this.game.scatterActive) {
                    this.game.scatterActive = false;
                    this.game.scatterCooldown = this.game.scatterCooldownMax;
                }
            }
            if (e.button === 2) this.rightMouseDown = false;
        });
        
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle mouse leaving window
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
                if (this.game.scatterActive) {
                    this.game.scatterActive = false;
                    this.game.scatterCooldown = this.game.scatterCooldownMax;
                }
            }
            if (e.button === 2) this.rightMouseDown = false;
        });
    }
    
    setupTouchEvents() {
        // Touch works like mouse - touch to scatter (same as click on desktop)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                this.mousePos = new Vector(e.touches[0].clientX, e.touches[0].clientY);
                this.mouseDown = true;
                
                // Activate scatter while touching
                if (this.game.scatterCooldown <= 0 && this.game.gameState === 'playing') {
                    this.game.scatterActive = true;
                    this.game.audio.playScatter();
                }
            }
        }, { passive: true });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.mousePos = new Vector(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        
        this.canvas.addEventListener('touchend', (e) => {
            this.mouseDown = false;
            // Deactivate scatter and start cooldown when touch ends
            if (this.game.scatterActive) {
                this.game.scatterActive = false;
                this.game.scatterCooldown = this.game.scatterCooldownMax;
            }
        }, { passive: true });
    }
    
    
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Space':
                    if (this.game.gameState === 'playing') {
                        this.game.pause();
                    } else if (this.game.gameState === 'paused') {
                        this.game.resume();
                    }
                    break;
                case 'KeyR':
                    if (this.game.gameState === 'playing' || this.game.gameState === 'paused') {
                        this.game.startGame();
                    }
                    break;
                case 'Escape':
                    if (this.game.gameState === 'playing') {
                        this.game.pause();
                    }
                    break;
            }
        });
    }
}
