// Metered calls to OpenRouter's Decisions API for scripts. Never retries, stops
// when a response lacks cost metering, and refuses to call past the budget.
import { loadEnvFile } from 'node:process';

export function decisionsClient({ budgetUsd, title }) {
    loadEnvFile(new URL('../../.env', import.meta.url));
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('Missing local OpenRouter key');
    const client = {
        spent: 0,
        get exhausted() { return client.spent >= budgetUsd; },
        async decide(request) {
            if (client.exhausted) throw new Error('budget stop');
            const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
                method: 'POST', signal: AbortSignal.timeout(15000), body: JSON.stringify(request),
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': `Swarm Doctrine ${title}` },
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 200)}; no retry`);
            const cost = Number(payload.usage?.cost);
            if (!Number.isFinite(cost)) throw new Error('Missing metering; stopping');
            client.spent += cost;
            return { payload, cost, tokens: payload.usage.input_tokens ?? payload.usage.prompt_tokens };
        },
    };
    return client;
}
