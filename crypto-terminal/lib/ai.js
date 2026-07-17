// Local AI desk agents via vLLM (OpenAI-compatible /v1/chat/completions).
// Off by default. All agents share one endpoint + model; they differ by role prompt.
//
//   ALPHA_AI=vllm  ALPHA_AI_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
//   ALPHA_AI_URL=http://localhost:8000/v1/chat/completions   [ALPHA_AI_KEY=...]
//
// Legacy aliases: ALPHA_AI=openai (same protocol). Agents only narrate quantitative
// output — they do not invent prices and never place trades.

import process from 'node:process';
import http from 'node:http';
import https from 'node:https';

const SYSTEM_RULES =
	'You are a sharp crypto desk analyst. Use ONLY the quantitative signals provided. ' +
	'Do NOT invent prices, scores, or symbols. Be direct and concrete. ' +
	'End user-facing text with: "Not financial advice."';

// --- Runtime status (for /api + logs) ---------------------------------------
const status = {
	lastOkAt: null,
	lastError: null,
	lastLatencyMs: null,
	lastAgent: null,
	agents: {
		briefing: {lastAt: null, lastError: null, cached: false},
		enrich: {lastAt: null, lastError: null},
		digest: {lastAt: null, lastError: null},
	},
};

let briefingCache = {fp: null, text: null, data: null, ts: 0};

export function aiConfig() {
	const raw = (process.env.ALPHA_AI || 'off').toLowerCase();
	if (raw === 'off' || raw === 'none' || raw === '') {
		return {enabled: false, mode: 'off', backend: 'off'};
	}

	// vllm is canonical; openai = OpenAI-compatible alias (same client path).
	const mode = raw === 'openai' || raw === 'vllm' || raw === 'on' ? 'vllm' : raw;
	if (mode !== 'vllm') {
		// Unknown modes stay disabled rather than guessing a protocol.
		return {enabled: false, mode: raw, backend: 'off', error: `unsupported ALPHA_AI=${raw} (use vllm|off)`};
	}

	const model = process.env.ALPHA_AI_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
	const url = process.env.ALPHA_AI_URL || 'http://localhost:8000/v1/chat/completions';
	const timeoutMs = Number(process.env.ALPHA_AI_TIMEOUT_MS || 60_000);
	const retries = Math.max(0, Number(process.env.ALPHA_AI_RETRIES || 2));
	const maxTokens = Number(process.env.ALPHA_AI_MAX_TOKENS || 280);
	return {
		enabled: true,
		mode: 'vllm',
		backend: 'vllm',
		model,
		url,
		key: process.env.ALPHA_AI_KEY || undefined,
		timeoutMs,
		retries,
		maxTokens,
	};
}

export function aiStatus() {
	const cfg = aiConfig();
	let host = null;
	try {
		host = cfg.url ? new URL(cfg.url).host : null;
	} catch {
		host = null;
	}

	const healthy = Boolean(cfg.enabled && status.lastOkAt && !status.lastError);
	const degraded = Boolean(cfg.enabled && status.lastError);
	return {
		enabled: cfg.enabled,
		backend: cfg.backend,
		mode: cfg.mode,
		model: cfg.enabled ? cfg.model : null,
		host,
		state: !cfg.enabled ? 'off' : (degraded ? 'degraded' : (healthy ? 'ok' : 'pending')),
		lastOkAt: status.lastOkAt,
		lastError: status.lastError,
		lastLatencyMs: status.lastLatencyMs,
		lastAgent: status.lastAgent,
		agents: status.agents,
		configError: cfg.error || null,
	};
}

function logAi(event, extra = {}) {
	const parts = Object.entries(extra)
		.filter(([, v]) => v !== undefined && v !== null)
		.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
	process.stderr.write(`ai.${event}${parts.length ? ' ' + parts.join(' ') : ''}\n`);
}

function modelsUrl(chatUrl) {
	const u = new URL(chatUrl);
	// .../v1/chat/completions → .../v1/models
	u.pathname = u.pathname.replace(/\/chat\/completions\/?$/, '/models');
	if (!u.pathname.endsWith('/models')) {
		u.pathname = u.pathname.replace(/\/?$/, '') + '/models';
	}

	return u;
}

function requestJson(url, {method = 'GET', body, headers = {}, timeoutMs = 60_000} = {}) {
	return new Promise((resolve, reject) => {
		let u;
		try {
			u = new URL(url);
		} catch (error) {
			reject(Object.assign(new Error('bad_url'), {reason: 'bad_response', cause: error}));
			return;
		}

		const lib = u.protocol === 'https:' ? https : http;
		const data = body === undefined ? null : JSON.stringify(body);
		const req = lib.request(
			{
				hostname: u.hostname,
				port: u.port || (u.protocol === 'https:' ? 443 : 80),
				path: u.pathname + u.search,
				method,
				headers: {
					...(data ? {'content-type': 'application/json', 'content-length': Buffer.byteLength(data)} : {}),
					...headers,
				},
			},
			res => {
				let out = '';
				res.on('data', c => {
					out += c;
				});
				res.on('end', () => {
					if (res.statusCode && res.statusCode >= 400) {
						const err = new Error(`HTTP ${res.statusCode}`);
						err.reason = 'bad_response';
						err.status = res.statusCode;
						err.body = out.slice(0, 200);
						reject(err);
						return;
					}

					if (!out) {
						resolve(null);
						return;
					}

					try {
						resolve(JSON.parse(out));
					} catch (error) {
						const err = new Error('invalid JSON from AI');
						err.reason = 'bad_response';
						err.cause = error;
						reject(err);
					}
				});
			},
		);
		req.on('error', error => {
			error.reason = error.reason || 'unreachable';
			reject(error);
		});
		req.setTimeout(timeoutMs, () => {
			const err = new Error('AI request timeout');
			err.reason = 'timeout';
			req.destroy(err);
		});
		if (data) req.write(data);
		req.end();
	});
}

async function withRetries(fn, retries) {
	let last;
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn();
		} catch (error) {
			last = error;
			if (i < retries) {
				await new Promise(r => setTimeout(r, 250 * (i + 1)));
			}
		}
	}

	throw last;
}

async function chatComplete({system, user, maxTokens, temperature = 0.3, agent = 'briefing'}) {
	const cfg = aiConfig();
	if (!cfg.enabled) {
		return {ok: false, error: 'disabled', reason: 'disabled'};
	}

	const headers = cfg.key ? {authorization: `Bearer ${cfg.key}`} : {};
	const started = Date.now();
	status.lastAgent = agent;
	try {
		const r = await withRetries(
			() => requestJson(cfg.url, {
				method: 'POST',
				timeoutMs: cfg.timeoutMs,
				headers,
				body: {
					model: cfg.model,
					messages: [
						{role: 'system', content: system},
						{role: 'user', content: user},
					],
					temperature,
					max_tokens: maxTokens ?? cfg.maxTokens,
					stream: false,
				},
			}),
			cfg.retries,
		);
		const text = (r?.choices?.[0]?.message?.content || '').trim();
		const latency = Date.now() - started;
		status.lastOkAt = Date.now();
		status.lastError = null;
		status.lastLatencyMs = latency;
		if (!text) {
			const err = 'empty_response';
			status.lastError = err;
			status.agents[agent] && (status.agents[agent].lastError = err);
			logAi('fail', {agent, error: err, ms: latency});
			return {ok: false, error: err, reason: 'bad_response'};
		}

		if (status.agents[agent]) {
			status.agents[agent].lastAt = Date.now();
			status.agents[agent].lastError = null;
		}

		logAi('ok', {agent, ms: latency, chars: text.length});
		return {ok: true, text, latencyMs: latency};
	} catch (error) {
		const reason = error.reason || 'unreachable';
		const msg = error.message || String(error);
		status.lastError = `${reason}:${msg}`;
		status.lastLatencyMs = Date.now() - started;
		if (status.agents[agent]) status.agents[agent].lastError = status.lastError;
		logAi('fail', {agent, error: status.lastError, ms: status.lastLatencyMs});
		return {ok: false, error: status.lastError, reason};
	}
}

/** Probe vLLM readiness via GET /v1/models. Never throws. */
export async function aiHealth() {
	const cfg = aiConfig();
	if (!cfg.enabled) return {ok: false, state: 'off'};
	const started = Date.now();
	try {
		const headers = cfg.key ? {authorization: `Bearer ${cfg.key}`} : {};
		await withRetries(
			() => requestJson(modelsUrl(cfg.url).href, {method: 'GET', timeoutMs: Math.min(cfg.timeoutMs, 15_000), headers}),
			1,
		);
		status.lastOkAt = Date.now();
		status.lastError = null;
		status.lastLatencyMs = Date.now() - started;
		logAi('ok', {agent: 'health', ms: status.lastLatencyMs});
		return {ok: true, state: 'ok', latencyMs: status.lastLatencyMs};
	} catch (error) {
		status.lastError = `${error.reason || 'unreachable'}:${error.message}`;
		status.lastLatencyMs = Date.now() - started;
		logAi('fail', {agent: 'health', error: status.lastError});
		return {ok: false, state: 'degraded', error: status.lastError, latencyMs: status.lastLatencyMs};
	}
}

function signalLine(s) {
	if (!s) return '(none)';
	return (
		`${s.base}: price $${s.last}, 24h ${s.changePct24h?.toFixed?.(1) ?? s.changePct24h}%, ` +
		`RSI ${s.rsi?.toFixed?.(0) ?? s.rsi}, volZ ${s.volZ?.toFixed?.(1) ?? s.volZ}, ` +
		`buy ${s.buyScore}, explode ${s.explosionScore}`
	);
}

function topLines(arr, n = 5) {
	return (arr || []).slice(0, n).map(signalLine).join('\n') || '(none)';
}

export function snapshotFingerprint(snapshot) {
	const reg = snapshot?.regime || {};
	const focus = snapshot?.focus?.base || '';
	const booms = (snapshot?.booms || []).slice(0, 5).map(s => `${s.base}:${s.explosionScore}`).join(',');
	const buys = (snapshot?.buys || []).slice(0, 5).map(s => `${s.base}:${s.buyScore}`).join(',');
	return `${reg.label}|${reg.score}|${focus}|${booms}|${buys}|${snapshot?.bar || ''}`;
}

export function buildSignalBlock(snapshot) {
	const {regime, booms, buys, focus, bar} = snapshot;
	return (
		`TIMEFRAME: ${bar || '?'}\n` +
		`MARKET REGIME: ${regime?.label} (${regime?.score}/100), breadth ${regime?.advancers}/${regime?.total}\n\n` +
		`TOP "ABOUT TO EXPLODE":\n${topLines(booms)}\n\n` +
		`TOP "BUY NOW":\n${topLines(buys)}\n\n` +
		`FOCUS IDEA: ${signalLine(focus)}\n`
	);
}

/** Extract JSON object from model output; null if none/invalid. */
export function parseBriefingJson(text) {
	if (!text) return null;
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced ? fenced[1].trim() : text.trim();
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		const obj = JSON.parse(candidate.slice(start, end + 1));
		if (!obj || typeof obj !== 'object') return null;
		return {
			regime_read: typeof obj.regime_read === 'string' ? obj.regime_read : undefined,
			ideas: Array.isArray(obj.ideas)
				? obj.ideas
					.filter(i => i && typeof i === 'object')
					.map(i => ({
						symbol: String(i.symbol || i.base || ''),
						why: String(i.why || ''),
					}))
					.filter(i => i.symbol)
					.slice(0, 3)
				: [],
			risk: typeof obj.risk === 'string' ? obj.risk : undefined,
			summary: typeof obj.summary === 'string' ? obj.summary : undefined,
		};
	} catch {
		return null;
	}
}

export function formatBriefingText(data, fallback) {
	if (!data) return fallback || '';
	const lines = [];
	if (data.regime_read) lines.push(data.regime_read);
	if (data.ideas?.length) {
		for (const idea of data.ideas.slice(0, 2)) {
			lines.push(`${idea.symbol}: ${idea.why}`);
		}
	}

	if (data.risk) lines.push(`Risk: ${data.risk}`);
	if (data.summary) lines.push(data.summary);
	let text = lines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
	if (!text) text = fallback || '';
	if (text && !/not financial advice/i.test(text)) {
		text += ' Not financial advice.';
	}

	return text;
}

/**
 * Desk briefing agent. Returns {ok, text?, data?, error?, cached?}.
 * Cached by snapshot fingerprint so idle markets do not spam the GPU.
 */
export async function briefing(snapshot, {force = false} = {}) {
	const cfg = aiConfig();
	if (!cfg.enabled) return {ok: false, error: 'disabled', reason: 'disabled'};

	const fp = snapshotFingerprint(snapshot);
	if (!force && briefingCache.fp === fp && briefingCache.text) {
		status.agents.briefing.cached = true;
		logAi('skip_cached', {agent: 'briefing', fp: fp.slice(0, 48)});
		return {ok: true, text: briefingCache.text, data: briefingCache.data, cached: true};
	}

	status.agents.briefing.cached = false;
	const system =
		SYSTEM_RULES +
		' Reply with a single JSON object only (no markdown): ' +
		'{"regime_read":string,"ideas":[{"symbol":string,"why":string}],"risk":string,"summary":string}. ' +
		'Max ~140 words across fields. ideas: 1-2 highest-conviction only.';
	const user = buildSignalBlock(snapshot);
	const result = await chatComplete({
		system,
		user,
		maxTokens: cfg.maxTokens,
		temperature: 0.3,
		agent: 'briefing',
	});
	if (!result.ok) return result;

	const data = parseBriefingJson(result.text);
	const text = formatBriefingText(data, result.text);
	briefingCache = {fp, text, data, ts: Date.now()};
	return {ok: true, text, data, cached: false, latencyMs: result.latencyMs};
}

/** One-line AI context for a threshold alert. Never throws. */
export async function enrichAlert(alert, snapshot) {
	const cfg = aiConfig();
	if (!cfg.enabled) return {ok: false, error: 'disabled'};

	const system =
		SYSTEM_RULES +
		' Write ONE short line (max 22 words) of context for this alert using only the facts given. ' +
		'No JSON. No preamble.';
	const user =
		`ALERT: ${alert.sym} ${alert.tag} score ${alert.score}/100 ` +
		`price $${alert.price} 24h ${alert.changePct?.toFixed?.(1) ?? alert.changePct}% why: ${alert.why}\n\n` +
		(snapshot ? buildSignalBlock(snapshot) : '');
	const result = await chatComplete({
		system,
		user,
		maxTokens: 80,
		temperature: 0.25,
		agent: 'enrich',
	});
	if (!result.ok) return result;
	const line = result.text.replace(/\s+/g, ' ').trim().slice(0, 180);
	return {ok: true, text: line, latencyMs: result.latencyMs};
}

/** Away digest from stored facts (alerts + regime). Never throws. */
export async function digest({regime, alerts, bar} = {}) {
	const cfg = aiConfig();
	if (!cfg.enabled) return {ok: false, error: 'disabled'};

	const list = (alerts || []).slice(-20);
	const lines = list.map(a =>
		`${new Date(a.ts).toISOString()} ${a.kind} ${a.sym} ${a.tag} ${a.score}/100 $${a.price}`,
	).join('\n') || '(no alerts in window)';
	const system =
		SYSTEM_RULES +
		' Write a compact "while you were away" digest (max ~120 words) from the facts below only. ' +
		'Mention regime and the most important alerts. No invented symbols.';
	const user =
		`REGIME: ${regime?.label || '?'} (${regime?.score ?? '?'}/100) bar=${bar || '?'}\n` +
		`ALERTS:\n${lines}\n`;
	const result = await chatComplete({
		system,
		user,
		maxTokens: Math.min(cfg.maxTokens, 220),
		temperature: 0.3,
		agent: 'digest',
	});
	if (!result.ok) return result;
	return {ok: true, text: result.text, latencyMs: result.latencyMs};
}

/** Compare fingerprints / focus / regime for change-gated orchestration. */
export function snapshotChanged(prevFp, snapshot) {
	return prevFp !== snapshotFingerprint(snapshot);
}

// Test helper — clear in-memory cache between unit tests.
export function _resetAiForTests() {
	briefingCache = {fp: null, text: null, data: null, ts: 0};
	status.lastOkAt = null;
	status.lastError = null;
	status.lastLatencyMs = null;
	status.lastAgent = null;
	for (const k of Object.keys(status.agents)) {
		status.agents[k] = {lastAt: null, lastError: null, cached: false};
	}
}
