import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { Game } from './lib/game.ts';
import { TutorialMode } from './lib/tutorial.ts';
import { AVAILABLE_RIVALS } from './lib/catalog.ts';
import { UIManager } from './lib/ui.svelte.ts';

const ui = new UIManager();

function start(canvas: HTMLCanvasElement) {
    const game = new Game({ canvas, ui });
    new TutorialMode(game);
    (globalThis as { game?: Game }).game = game;

    // Deep links: ?duel=hard|tactician|local|jev (older ?hardbot and ?offline still work).
    const params = new URLSearchParams(location.search);
    const duel = params.get('duel');
    const kind = params.has('hardbot') ? 'hard' : params.has('offline') ? 'local' : duel === '1' || duel === '' ? 'jev' : duel;
    if (kind && AVAILABLE_RIVALS.some(rival => rival.id === `duel-${kind}`)) game.startDuelMode(`duel-${kind}`).catch(error => ui.toast(error.message));
}

mount(App, { target: document.body, props: { ui, ready: start } });

// Packaged Android assets are versioned with the APK, not a browser cache.
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'appassets.androidplatform.net') {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* The game works without offline caching. */ });
}
