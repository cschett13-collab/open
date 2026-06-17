// Optional local-AI briefing. Off by default — only activates when you point it
// at a model running on YOUR machine (this cloud container can't reach it).
//
// Enable by setting env vars when you run the app locally:
//   ALPHA_AI=ollama  ALPHA_AI_MODEL=llama3            (default URL :11434)
//   ALPHA_AI=openai  ALPHA_AI_MODEL=local-model \
//     ALPHA_AI_URL=http://localhost:1234/v1/chat/completions  [ALPHA_AI_KEY=...]
//
// It writes a short "desk analyst" briefing over the current signals. The AI
// only narrates the quantitative output — it does not invent prices.

import process from 'node:process';
import http from 'node:http';
import https from 'node:https';

export function aiConfig() {
	const mode = (process.env.ALPHA_AI || 'off').toLowerCase();
	if (mode === 'off' || mode === 'none' || mode === '') return {enabled: false, mode: 'off'};
	const model = process.env.ALPHA_AI_MODEL || (mode === 'ollama' ? 'llama3' : 'local-model');
	const url = process.env.ALPHA_AI_URL
		|| (mode === 'ollama'
			? 'http://localhost:11434/api/generate'
			: 'http://localhost:1234/v1/chat/completions');
	return {enabled: true, mode, model, url, key: process.env.ALPHA_AI_KEY};
}

function postJson(url, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const lib = u.protocol === 'https:' ? https : http;
		const data = JSON.stringify(body);
		const req = lib.request(
			{
				hostname: u.hostname,
				port: u.port || (u.protocol === 'https:' ? 443 : 80),
				path: u.pathname + u.search,
				method: 'POST',
				headers: {'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers},
			},
			res => {
				let out = '';
				res.on('data', c => {
					out += c;
				});
				res.on('end', () => {
					try {
						resolve(JSON.parse(out));
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		req.on('error', reject);
		req.setTimeout(60_000, () => req.destroy(new Error('AI request timeout')));
		req.write(data);
		req.end();
	});
}

function buildPrompt({regime, booms, buys, focus, bar}) {
	const line = s =>
		`${s.base}: price $${s.last}, 24h ${s.changePct24h?.toFixed(1)}%, RSI ${s.rsi?.toFixed(0)}, ` +
		`volZ ${s.volZ?.toFixed(1)}, buy ${s.buyScore}, explode ${s.explosionScore}`;
	const top = arr => arr.slice(0, 5).map(line).join('\n') || '(none)';
	return (
		`You are a sharp crypto desk analyst. Using ONLY the quantitative signals below ` +
		`(${bar} timeframe), write a tight briefing (max ~140 words): the current market ` +
		`regime read, the 1-2 highest-conviction ideas and why, and one risk to watch. ` +
		`Be direct and concrete. Do NOT invent numbers. End with: "Not financial advice."\n\n` +
		`MARKET REGIME: ${regime.label} (${regime.score}/100), breadth ${regime.advancers}/${regime.total}\n\n` +
		`TOP "ABOUT TO EXPLODE":\n${top(booms)}\n\n` +
		`TOP "BUY NOW":\n${top(buys)}\n\n` +
		`FOCUS IDEA: ${focus ? line(focus) : '(none)'}\n`
	);
}

// Returns briefing text, or undefined if AI is disabled/unreachable (graceful).
export async function briefing(snapshot) {
	const cfg = aiConfig();
	if (!cfg.enabled) return undefined;
	const prompt = buildPrompt(snapshot);
	try {
		if (cfg.mode === 'ollama') {
			const r = await postJson(cfg.url, {model: cfg.model, prompt, stream: false});
			return (r.response || '').trim() || undefined;
		}

		// OpenAI-compatible chat completions.
		const headers = cfg.key ? {authorization: `Bearer ${cfg.key}`} : {};
		const r = await postJson(
			cfg.url,
			{model: cfg.model, messages: [{role: 'user', content: prompt}], temperature: 0.4, stream: false},
			headers,
		);
		return (r.choices?.[0]?.message?.content || '').trim() || undefined;
	} catch {
		return undefined; // never let AI errors break the dashboard
	}
}
