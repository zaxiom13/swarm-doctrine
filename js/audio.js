// Procedural sound with the Web Audio API. Nothing plays until the first user gesture.
import { settings } from './settings.js';

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
const CHORDS = [[65.41, 130.81, 196.0], [55.0, 110.0, 164.81], [73.42, 146.83, 220.0], [49.0, 98.0, 146.83]];

export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.padTimer = null;
        this.chord = 0;
        document.addEventListener?.('visibilitychange', () => document.hidden ? this.suspend() : this.resume());
    }

    get enabled() { return settings.sound; }
    get musicEnabled() { return settings.music; }

    init() {
        if (this.ctx) return this.resume();
        try {
            const Context = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Context();
            const master = this.ctx.createGain();
            master.gain.value = 0.8;
            master.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.5;
            this.sfxGain.connect(master);
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.18;
            this.musicGain.connect(master);
        } catch (error) {
            console.warn('Web Audio is unavailable:', error);
        }
    }

    suspend() {
        clearInterval(this.padTimer);
        this.padTimer = null;
        if (this.ctx?.state === 'running') this.ctx.suspend();
    }

    resume() {
        if (!this.ctx || document.hidden) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    /** Music plays only during a live match; menus and pauses are silent. */
    setMusic(on) {
        if (on) this.startMusic();
        else if (this.padTimer) this.stopMusic();
    }

    stopMusic() {
        clearInterval(this.padTimer);
        this.padTimer = null;
        if (!this.musicGain) return;
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
        this.musicGain.gain.linearRampToValueAtTime(0, now + 0.4);
    }

    startMusic() {
        if (!this.ctx || this.padTimer || this.ctx.state !== 'running' || document.hidden) return;
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(0.18, now);
        const pad = () => {
            if (!this.enabled || !this.musicEnabled) return;
            const now = this.ctx.currentTime;
            CHORDS[this.chord++ % CHORDS.length].forEach((frequency, i) => {
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
                osc.type = i === 0 ? 'sawtooth' : 'sine';
                osc.frequency.setValueAtTime(frequency, now);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(180 + i * 80, now);
                filter.frequency.exponentialRampToValueAtTime(320, now + 3);
                filter.frequency.exponentialRampToValueAtTime(160, now + 6);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.04 / (i + 1), now + 1.5);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 6);
                osc.connect(filter).connect(gain).connect(this.musicGain);
                osc.start(now);
                osc.stop(now + 6.2);
            });
        };
        pad();
        this.padTimer = setInterval(pad, 5800);
    }

    tone(frequency, duration, type = 'sine', volume = 0.1, bendTo = null, delay = 0) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
        const start = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        if (bendTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, bendTo), start + duration);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + duration);
    }

    playConversion(gained, combo = 1) {
        if (!gained) { this.tone(180, 0.25, 'sawtooth', 0.08, 90); return; }
        const frequency = SCALE[Math.min(SCALE.length - 1, (combo - 1) % SCALE.length)];
        this.tone(frequency, 0.18, 'sine', 0.12);
        this.tone(frequency * 1.5, 0.14, 'triangle', 0.06, null, 0.04);
    }

    playRally() { this.tone(520, 0.08, 'sine', 0.04, 380); }
    playFreeze() { this.tone(900, 0.2, 'square', 0.1, 120); this.tone(450, 0.25, 'sawtooth', 0.08, 60, 0.06); }
    playUpgrade() { [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, null, i * 0.08)); }
    playVictory() { [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.15, null, i * 0.12)); }
    playDefeat() { [240, 210, 175, 130].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.1, f * 0.7, i * 0.14)); }
    playClick() { this.tone(800, 0.03, 'sine', 0.04); }
}
