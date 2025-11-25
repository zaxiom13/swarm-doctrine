// Entry Point - Initialize the game
import { Game } from './game.js';
import { TutorialMode } from './tutorial.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
    window.tutorial = new TutorialMode(window.game);
});
