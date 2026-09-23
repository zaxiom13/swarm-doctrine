import './preview.js';
import { Game } from './game.js';
import { TutorialMode } from './tutorial.js';
import { AVAILABLE_RIVALS } from './catalog.js';

const game = new Game();
new TutorialMode(game);
globalThis.game = game;

// Deep links: ?duel=hard|tactician|local|jev (older ?hardbot and ?offline still work).
const params = new URLSearchParams(location.search);
const duel = params.get('duel');
const kind = params.has('hardbot') ? 'hard' : params.has('offline') ? 'local' : duel === '1' || duel === '' ? 'jev' : duel;
if (kind && AVAILABLE_RIVALS.some(rival => rival.id === `duel-${kind}`)) game.startDuelMode(`duel-${kind}`).catch(error => game.ui.toast(error.message));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* The game works without offline caching. */ });
}
