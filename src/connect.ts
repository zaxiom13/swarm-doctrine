import './app.css';
import { configureOpponent, getOpponentStatus } from './lib/ai/jev.ts';

const form = document.querySelector<HTMLFormElement>('#connect-form')!;
const status = document.querySelector<HTMLElement>('#status')!;
const play = document.querySelector<HTMLElement>('#play')!;
const describe = (current: { model?: string; spentUsd?: number; budgetUsd?: number }) =>
    `Ready · ${current.model || 'configured model'} · $${(current.spentUsd || 0).toFixed(4)} of $${(current.budgetUsd ?? 2).toFixed(2)} used`;

try {
    const current = await getOpponentStatus();
    if (current.configured) { status.textContent = describe(current); play.classList.remove('hidden'); }
} catch { status.textContent = 'The local server is offline. Start it with: npm start'; }

form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button')!;
    const fields = form.elements as unknown as { key: HTMLInputElement; model: HTMLInputElement };
    button.disabled = true;
    status.textContent = 'Connecting…';
    try {
        const result = await configureOpponent({ apiKey: fields.key.value, model: fields.model.value });
        fields.key.value = '';
        status.textContent = describe(result);
        play.classList.remove('hidden');
    } catch (error) {
        status.textContent = (error as Error).message || 'Unable to connect';
    } finally {
        button.disabled = false;
    }
});
