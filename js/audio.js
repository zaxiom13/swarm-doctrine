// Enhanced Procedural Audio System using Web Audio API
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;
        this.musicEnabled = true;
        this.musicGain = null;
        this.sfxGain = null;
        this.masterGain = null;
        this.ambientInterval = null;
        this.scaleNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]; // Pentatonic
    }
    
    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.8;
            this.masterGain.connect(this.ctx.destination);
            
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.5;
            this.sfxGain.connect(this.masterGain);
            
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.18;
            this.musicGain.connect(this.masterGain);
            
            this.initialized = true;
            this.startAmbientMusic();
        } catch (e) {
            console.warn('Web Audio not available:', e);
        }
    }
    
    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startAmbientMusic() {
        if (!this.ctx || this.ambientInterval) return;
        
        // Procedural atmospheric cyberpunk bass drone
        const chords = [
            [65.41, 130.81, 196.00], // C2, C3, G3
            [55.00, 110.00, 164.81], // A1, A2, E3
            [73.42, 146.83, 220.00], // D2, D3, A3
            [49.00, 98.00, 146.83]   // G1, G2, D3
        ];
        let chordIdx = 0;

        const playPad = () => {
            if (!this.enabled || !this.musicEnabled || !this.ctx) return;
            const now = this.ctx.currentTime;
            const currentChord = chords[chordIdx % chords.length];
            chordIdx++;
            
            currentChord.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                
                osc.type = i === 0 ? 'sawtooth' : 'sine';
                osc.frequency.setValueAtTime(freq, now);
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(180 + i * 80, now);
                filter.frequency.exponentialRampToValueAtTime(320, now + 3);
                filter.frequency.exponentialRampToValueAtTime(160, now + 6);
                
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.04 / (i + 1), now + 1.5);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 6);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                
                osc.start(now);
                osc.stop(now + 6.2);
            });
        };

        playPad();
        this.ambientInterval = setInterval(playPad, 5800);
    }
    
    playTone(frequency, duration, type = 'sine', volume = 0.1, pitchBend = null) {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (pitchBend) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, pitchBend), now + duration);
        }
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    // Musical conversion chime with combo scaling
    playConversion(isPlayerGain, combo = 1) {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        
        if (isPlayerGain) {
            const noteIdx = Math.min(this.scaleNotes.length - 1, (combo - 1) % this.scaleNotes.length);
            const freq = this.scaleNotes[noteIdx];
            
            // Primary bell note
            this.playTone(freq, 0.18, 'sine', 0.12);
            // Harmonic sparkle
            setTimeout(() => {
                this.playTone(freq * 1.5, 0.14, 'triangle', 0.06);
            }, 40);
        } else {
            // Low disquiet tone
            this.playTone(180, 0.25, 'sawtooth', 0.08, 90);
        }
    }
    
    playShockwave() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        const now = this.ctx.currentTime;
        
        // Deep sub punch
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.36);
        
        // Noise burst / whoosh
        this.playTone(280, 0.15, 'sine', 0.08, 60);
    }

    playBeaconPulse() {
        if (!this.enabled || !this.ctx) return;
        this.playTone(520, 0.08, 'sine', 0.04, 380);
    }

    playOverdrive() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        // Ascending sci-fi power up
        [0, 60, 120, 180].forEach((delay, i) => {
            setTimeout(() => {
                this.playTone(400 + i * 150, 0.12, 'sawtooth', 0.08, 600 + i * 200);
            }, delay);
        });
    }

    playEmp() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        // High voltage electric discharge
        this.playTone(900, 0.2, 'square', 0.1, 120);
        setTimeout(() => this.playTone(450, 0.25, 'sawtooth', 0.08, 60), 60);
    }

    playDoctrineSelect() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        [0, 80, 160, 240].forEach((delay, i) => {
            setTimeout(() => {
                this.playTone([392, 523.25, 659.25, 783.99][i], 0.3, 'sine', 0.12);
            }, delay);
        });
    }
    
    playVictory() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        const victoryChords = [440, 554.37, 659.25, 880];
        victoryChords.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.5, 'triangle', 0.15), i * 120);
        });
    }
    
    playDefeat() {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        [240, 210, 175, 130].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.45, 'sawtooth', 0.1, freq * 0.7), i * 140);
        });
    }
    
    playClick() {
        this.playTone(800, 0.03, 'sine', 0.04);
    }
    
    playPowerup() {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.07), i * 50);
        });
    }
    
    playScatter() {
        this.playShockwave();
    }
}
