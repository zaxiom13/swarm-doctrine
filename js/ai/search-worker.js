// Runs the lookahead search off the main thread so play stays smooth.
import { chooseSearchAction } from './search-bot.js';

self.onmessage = ({ data }) => {
    const started = performance.now();
    try {
        const result = chooseSearchAction(data.state, data.team, data.options);
        self.postMessage({ id: data.id, action: result.action, ms: performance.now() - started });
    } catch (error) {
        self.postMessage({ id: data.id, error: error.message });
    }
};
