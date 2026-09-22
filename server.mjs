// Local static server and Jev proxy. The OpenRouter key stays in this process
// (and the git-ignored .env file); the browser never sees it.
import http from 'node:http';
import { loadEnvFile } from 'node:process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_MODEL_ID, ActionError, actionFromDecisionResponse, buildBatchedRequest, buildDecisionRequest, compactSnapshot } from './js/ai/jev.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_FLEETS = 8;
const DEFAULT_PORT = 4173;
const DEFAULT_TIMEOUT_MS = 5500;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_BUDGET_USD = 2;
const MODEL_PATTERN = /^~?typesafe\/jev(?:-[A-Za-z0-9.]+)?$/;
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};
// Source, credentials, training runs and tooling are never served.
const PRIVATE_NAMES = /^(?:server\.mjs|package(?:-lock)?\.json|.*\.(?:pem|key|crt|patch))$/i;
const PRIVATE_DIRS = new Set(['scripts', 'tests', 'training', 'build', 'node_modules']);

function json(res, status, value, extraHeaders = {}) {
    const body = JSON.stringify(value);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body), ...extraHeaders });
    res.end(body);
}

function modelId(value) {
    if (typeof value !== 'string' || !MODEL_PATTERN.test(value.trim())) throw new ActionError('model must be an exact Typesafe Jev model id', 'invalid_model');
    return value.trim();
}

function localOrigins(port, host) {
    const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`]);
    if (host && host !== '127.0.0.1') origins.add(`http://${host}:${port}`);
    return origins;
}

async function readBody(req, maxBytes = MAX_BODY_BYTES) {
    const tooLarge = () => Object.assign(new Error('request body too large'), { code: 'body_too_large' });
    if (Number(req.headers['content-length']) > maxBytes) throw tooLarge();
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) throw tooLarge();
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function readResponseBody(response) {
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('upstream response too large');
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('upstream response too large');
    return text;
}

export function safeStaticPath(rootDir, pathname) {
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return null; }
    if (decoded.includes('\0')) return null;
    const parts = decoded.replace(/^[/\\]+/, '').split(/[\\/]+/).filter(Boolean);
    if (parts.some(part => part === '..' || part.startsWith('.'))) return null;
    if (parts.length > 1 && PRIVATE_DIRS.has(parts[0])) return null;
    if (PRIVATE_NAMES.test(parts.at(-1) || 'index.html')) return null;
    const root = path.resolve(rootDir);
    const target = path.resolve(root, parts.join(path.sep) || 'index.html');
    return target === root || target.startsWith(root + path.sep) ? target : null;
}

async function serveStatic(req, res, rootDir) {
    const target = safeStaticPath(rootDir, new URL(req.url, 'http://localhost').pathname);
    if (!target) return json(res, 404, { error: 'not_found' });
    try {
        const stat = await fs.stat(target);
        const realRoot = await fs.realpath(rootDir), realTarget = await fs.realpath(target);
        if (!stat.isFile() || !(realTarget === realRoot || realTarget.startsWith(realRoot + path.sep))) return json(res, 404, { error: 'not_found' });
        const headers = { 'Content-Type': MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
        res.writeHead(200, headers);
        if (req.method === 'HEAD') return res.end();
        return res.end(await fs.readFile(realTarget));
    } catch {
        return json(res, 404, { error: 'not_found' });
    }
}

export function createOpponentServer(options = {}) {
    const port = Number(options.port ?? process.env.OPPONENT_PORT ?? DEFAULT_PORT);
    const host = options.host ?? process.env.OPPONENT_HOST ?? '127.0.0.1';
    const rootDir = path.resolve(options.rootDir ?? HERE);
    const origins = new Set(options.allowedOrigins ?? localOrigins(port, host));
    const openRouterUrl = options.openRouterUrl ?? process.env.OPENROUTER_URL ?? 'https://openrouter.ai';
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const timeoutMs = Math.min(15000, Math.max(1000, Number(options.timeoutMs ?? process.env.OPPONENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)));
    const concurrency = Math.max(1, Number(options.concurrency ?? DEFAULT_CONCURRENCY));
    const budgetUsd = Number(options.budgetUsd ?? process.env.JEV_BUDGET_USD ?? DEFAULT_BUDGET_USD);
    let apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : (process.env.OPENROUTER_API_KEY || '').trim();
    let model = modelId(typeof options.model === 'string' ? options.model : (process.env.OPENROUTER_MODEL || DEFAULT_MODEL_ID));
    const usage = { calls: 0, tokens: 0, spentUsd: 0 };
    let active = 0;

    const status = () => ({
        status: apiKey && model ? 'ready' : 'offline', configured: Boolean(apiKey), model: model || null, provider: 'openrouter',
        identity: model === DEFAULT_MODEL_ID ? 'Jev 1.13' : null, calls: usage.calls, spentUsd: usage.spentUsd, budgetUsd,
    });

    /** Sends one Decisions request and records its metered cost. */
    async function decide(request, signal) {
        const upstream = await fetchImpl(new URL('/api/alpha/decisions', openRouterUrl), {
            method: 'POST', signal,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json', 'X-OpenRouter-Title': 'Swarm Doctrine' },
            body: JSON.stringify(request),
        });
        const text = await readResponseBody(upstream);
        if (!upstream.ok) throw Object.assign(new Error('OpenRouter did not return a decision.'), { code: 'upstream_error' });
        let payload;
        try { payload = JSON.parse(text); } catch { throw Object.assign(new Error('invalid upstream JSON'), { code: 'upstream_error' }); }
        const cost = Number(payload.usage?.cost ?? payload.usage?.cost_usd) || 0;
        usage.calls++;
        usage.tokens += Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens) || 0;
        usage.spentUsd += cost;
        return { payload, cost };
    }

    async function handleDecision(req, res, headers, batched) {
        if (!apiKey || !model) return json(res, 503, { status: 'offline', code: 'missing_credentials', message: 'Configure an OpenRouter key and model on the local proxy.' }, headers);
        if (usage.spentUsd >= budgetUsd) return json(res, 402, { status: 'error', code: 'budget_exhausted', message: `Jev budget of $${budgetUsd.toFixed(2)} reached. Restart the server or raise JEV_BUDGET_USD.` }, headers);
        if (active >= concurrency) return json(res, 409, { status: 'error', code: 'busy', message: 'Too many Jev decisions in flight.' }, headers);
        let body;
        try { body = JSON.parse(await readBody(req)); } catch (error) {
            return json(res, error.code === 'body_too_large' ? 413 : 400, { status: 'error', code: error.code || 'invalid_json', message: error.code === 'body_too_large' ? error.message : 'JSON body required' }, headers);
        }
        let request, fleets;
        try {
            if (batched) {
                fleets = body?.fleets;
                if (!fleets || typeof fleets !== 'object' || !Object.keys(fleets).length || Object.keys(fleets).length > MAX_FLEETS) throw new ActionError(`fleets must map 1–${MAX_FLEETS} names to snapshots`);
                fleets = Object.fromEntries(Object.entries(fleets).map(([name, snapshot]) => [String(name).slice(0, 24), compactSnapshot(snapshot)]));
                request = buildBatchedRequest(fleets, model);
            } else {
                request = buildDecisionRequest(compactSnapshot(body?.snapshot), model);
            }
        } catch (error) {
            return json(res, 400, { status: 'error', code: error.code || 'invalid_snapshot', message: error.message }, headers);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const onClose = () => { if (!res.writableEnded) controller.abort(); };
        req.once('close', onClose);
        active++;
        try {
            const { payload, cost } = await decide(request, controller.signal);
            const tokens = Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens) || 0;
            const result = batched
                ? { actions: Object.fromEntries(Object.entries(fleets).map(([name, snapshot]) => [name, actionFromDecisionResponse(payload, snapshot, name)])) }
                : { action: actionFromDecisionResponse(payload, body.snapshot) };
            return json(res, 200, { status: 'online', model, ...result, usage: { cost, tokens } }, headers);
        } catch (error) {
            if (res.destroyed || res.writableEnded) return;
            if (controller.signal.aborted) return json(res, 504, { status: 'error', code: 'decision_timeout', message: 'Jev decision timed out or was cancelled.' }, headers);
            if (error instanceof ActionError) return json(res, 502, { status: 'error', code: error.code || 'invalid_model_output', message: 'Jev returned an unusable action.' }, headers);
            return json(res, 502, { status: 'error', code: 'upstream_error', message: 'Opponent model is unavailable.' }, headers);
        } finally {
            active--;
            clearTimeout(timeout);
            req.off('close', onClose);
        }
    }

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
        const origin = req.headers.origin;
        const allowed = !origin || origins.has(origin);
        const headers = origin && origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
        const api = url.pathname.startsWith('/api/opponent/');
        if (api && url.pathname !== '/api/opponent/status' && !allowed) return json(res, 403, { status: 'error', code: 'origin_not_allowed', message: 'Local origin required' });
        if (req.method === 'OPTIONS') {
            if (!allowed) return json(res, 403, { status: 'error', code: 'origin_not_allowed' });
            res.writeHead(204, { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '300' });
            return res.end();
        }
        if (url.pathname === '/api/opponent/status' && req.method === 'GET') return json(res, 200, status(), headers);
        if (url.pathname === '/api/opponent/config' && req.method === 'POST') {
            try {
                const parsed = JSON.parse(await readBody(req));
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ActionError('config must be an object');
                if (Object.hasOwn(parsed, 'apiKey')) {
                    if (typeof parsed.apiKey !== 'string' || parsed.apiKey.length > 256) throw new ActionError('apiKey is invalid');
                    apiKey = parsed.apiKey.trim();
                }
                if (Object.hasOwn(parsed, 'model')) model = modelId(parsed.model);
                if (options.envFile && Object.hasOwn(parsed, 'apiKey')) {
                    let envText = '';
                    try { envText = await fs.readFile(options.envFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
                    envText = envText.replace(/^OPENROUTER_(?:API_KEY|MODEL)=.*(?:\r?\n|$)/gm, '').trimEnd();
                    await fs.writeFile(options.envFile, `${envText}\nOPENROUTER_API_KEY=${JSON.stringify(apiKey)}\nOPENROUTER_MODEL=${JSON.stringify(model)}\n`, { mode: 0o600 });
                }
                return json(res, 200, status(), headers);
            } catch (error) {
                return json(res, error.code === 'body_too_large' ? 413 : 400, { status: 'error', code: error.code || 'invalid_config', message: error.message }, headers);
            }
        }
        if (url.pathname === '/api/opponent/decision' && req.method === 'POST') return handleDecision(req, res, headers, false);
        if (url.pathname === '/api/opponent/decisions' && req.method === 'POST') return handleDecision(req, res, headers, true);
        if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, rootDir);
        return json(res, 404, { error: 'not_found' });
    });

    return {
        server,
        usage,
        listen() { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server)); }); },
        close() { return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const envFile = path.join(HERE, '.env');
    try { loadEnvFile(envFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const app = createOpponentServer({ envFile });
    app.listen().then(() => {
        console.log(`Swarm Doctrine running at http://127.0.0.1:${process.env.OPPONENT_PORT || DEFAULT_PORT}`);
        if (!process.env.OPENROUTER_API_KEY) console.log('Jev is offline until a key is added at /connect.html.');
    }).catch(error => {
        console.error(`Unable to start the server: ${error.message}`);
        process.exitCode = 1;
    });
}
