// Procedural sound with the Web Audio API. Nothing plays until the first user gesture.
import { settings } from './settings.js';

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
// I–V–vi–IV in C, voiced around middle C so nothing rumbles.
const CHORDS = [[261.63, 329.63, 392.0], [246.94, 293.66, 392.0], [220.0, 261.63, 329.63], [220.0, 261.63, 349.23]];
const ARPEGGIO = [0, 1, 2, 1, 2, 3, 2, 1];
const BAR_SECONDS = 4;

export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.padTimer = null;
        this.chord = 0;
        document.addEventListener?.('visibilitychange', () => document.hidden ? this.suspend() : this.resume());
        // Browsers only allow audio after a gesture; the first tap anywhere starts the music.
        document.addEventListener?.('pointerdown', () => this.init(), { once: true });
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

    /** One continuous track across menus and matches; silent while paused. */
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
        const note = (frequency, start, length, type, volume) => {
            const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.02, length / 4));
            gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
            osc.connect(gain).connect(this.musicGain);
            osc.start(start);
            osc.stop(start + length + 0.05);
        };
        const bar = () => {
            if (!this.enabled || !this.musicEnabled) return;
            const now = this.ctx.currentTime + 0.05, chord = CHORDS[this.chord++ % CHORDS.length];
            // Soft sustained pad.
            chord.forEach(frequency => note(frequency, now, BAR_SECONDS * 0.95, 'sine', 0.045));
            // Bouncy plucked arpeggio an octave up, with a high sparkle on the last beat.
            const step = BAR_SECONDS / ARPEGGIO.length, tones = [...chord, chord[0] * 2];
            ARPEGGIO.forEach((index, i) => note(tones[index] * 2, now + i * step, step * 0.9, 'triangle', 0.05));
            note(tones[3] * 2, now + BAR_SECONDS - step, step * 1.5, 'sine', 0.025);
        };
        bar();
        this.padTimer = setInterval(bar, BAR_SECONDS * 1000);
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
