// Audio System
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }
    
    playTone(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    
    playConversion(isPlayerGain) {
        if (isPlayerGain) {
            this.playTone(880, 0.15, 'sine', 0.08);
            setTimeout(() => this.playTone(1100, 0.1, 'sine', 0.06), 50);
        } else {
            this.playTone(330, 0.2, 'sawtooth', 0.06);
        }
    }
    
    playVictory() {
        [0, 100, 200, 300, 400].forEach((delay, i) => {
            setTimeout(() => this.playTone(440 * Math.pow(2, i / 6), 0.3, 'sine', 0.1), delay);
        });
    }
    
    playDefeat() {
        [0, 150, 300].forEach((delay, i) => {
            setTimeout(() => this.playTone(220 / (i + 1), 0.4, 'sawtooth', 0.08), delay);
        });
    }
    
    playClick() {
        this.playTone(600, 0.05, 'square', 0.05);
    }
    
    playPowerup() {
        // Ascending sparkle sound
        this.playTone(523, 0.1, 'sine', 0.08);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.08), 50);
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(1047, 0.2, 'sine', 0.06), 150);
    }
    
    playScatter() {
        // Whoosh sound
        this.playTone(200, 0.15, 'sawtooth', 0.06);
        this.playTone(400, 0.1, 'sine', 0.04);
    }
}
