// RealCheck — AI reality checker backend.
//
// Exposes POST /api/check which takes one of:
//   { type: "text", content: "..." }
//   { type: "url",  content: "https://..." }
//   { type: "image", content: "<base64>", mediaType: "image/png" }
//
// and returns a structured verdict about whether the input is real, fake,
// AI-generated, or a scam. Uses Claude (with vision for images) when an
// ANTHROPIC_API_KEY is present, and falls back to a transparent heuristic
// engine so the app is fully runnable for demos without a key.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL = 'claude-opus-4-8';
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const client = hasKey ? new Anthropic() : null;

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// The shape every verdict conforms to — used both for the Claude structured
// output schema and for the heuristic fallback, so the frontend sees one shape.
const VERDICT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		verdict: {
			type: 'string',
			enum: ['real', 'fake', 'ai_generated', 'scam', 'misleading', 'uncertain'],
		},
		confidence: { type: 'integer' }, // 0-100
		headline: { type: 'string' },
		summary: { type: 'string' },
		signals: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					label: { type: 'string' },
					severity: { type: 'string', enum: ['info', 'caution', 'danger'] },
					detail: { type: 'string' },
				},
				required: ['label', 'severity', 'detail'],
			},
		},
		recommendation: { type: 'string' },
	},
	required: ['verdict', 'confidence', 'headline', 'summary', 'signals', 'recommendation'],
};

const SYSTEM_PROMPT = `You are RealCheck, an expert forensic analyst that helps everyday people decide whether something on their screen is REAL or FAKE.

You analyze text, links/URLs, and images (including screenshots and photos). For each input, judge whether it is:
- "real": genuine, authentic, trustworthy
- "fake": fabricated, forged, or doctored
- "ai_generated": likely produced by an AI image/text generator
- "scam": a phishing attempt, fraud, or social-engineering lure
- "misleading": real elements but framed deceptively / missing context
- "uncertain": genuinely not enough signal to call

Be concrete and skeptical but fair. Cite the specific observable signals that drove your verdict (writing tics, urgency/pressure tactics, mismatched URLs/domains, lookalike characters, image artifacts like warped hands/text/lighting, metadata or context clues). Never claim certainty you don't have — calibrate the confidence (0-100) honestly. Keep language plain and non-technical so a non-expert can act on it. The recommendation should be one clear, practical next step.`;

function clampInt(n, lo, hi) {
	n = Math.round(Number(n) || 0);
	return Math.max(lo, Math.min(hi, n));
}

// --- Claude-backed analysis ---------------------------------------------------

async function analyzeWithClaude({ type, content, mediaType }) {
	let userContent;

	if (type === 'image') {
		userContent = [
			{
				type: 'image',
				source: { type: 'base64', media_type: mediaType || 'image/png', data: content },
			},
			{
				type: 'text',
				text: 'Analyze this image. Is it a real photo, AI-generated, edited/doctored, or part of a scam? Point to specific visual evidence.',
			},
		];
	} else if (type === 'url') {
		const fetched = await fetchUrlContext(content);
		userContent = [
			{
				type: 'text',
				text: `Analyze this link for safety and authenticity (phishing, scam, fake site, impersonation).\n\nURL: ${content}\n\nFetched page context:\n${fetched}`,
			},
		];
	} else {
		userContent = [
			{
				type: 'text',
				text: `Analyze this text. Is it genuine, fabricated, AI-generated, misleading, or a scam?\n\n"""${String(content).slice(0, 8000)}"""`,
			},
		];
	}

	const message = await client.messages.create({
		model: MODEL,
		max_tokens: 1500,
		thinking: { type: 'adaptive' },
		system: SYSTEM_PROMPT,
		output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
		messages: [{ role: 'user', content: userContent }],
	});

	const textBlock = message.content.find((b) => b.type === 'text');
	const parsed = JSON.parse(textBlock.text);
	parsed.confidence = clampInt(parsed.confidence, 0, 100);
	parsed.engine = 'claude';
	return parsed;
}

// Best-effort fetch of a URL's visible text so Claude has page context.
async function fetchUrlContext(url) {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'RealCheckBot/0.1 (+safety-scan)' },
			redirect: 'follow',
		});
		clearTimeout(timer);
		const html = await res.text();
		const text = html
			.replace(/<script[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		return `HTTP ${res.status}. Final URL: ${res.url}\n${text.slice(0, 4000)}`;
	} catch (err) {
		return `(Could not fetch the page: ${err.message}. Judge from the URL string alone — look for lookalike domains, odd TLDs, IP-address hosts, and misspellings.)`;
	}
}

// --- Heuristic fallback (no API key) -----------------------------------------
// Transparent, rule-based scoring so the product is demoable out of the box.

function analyzeHeuristic({ type, content, mediaType }) {
	if (type === 'image') return heuristicImage(mediaType);
	if (type === 'url') return heuristicUrl(content);
	return heuristicText(String(content || ''));
}

function heuristicText(text) {
	const lower = text.toLowerCase();
	const signals = [];
	let risk = 0;

	const scamPhrases = [
		'verify your account', 'click here', 'act now', 'limited time', 'wire transfer',
		'gift card', 'bitcoin', 'crypto', 'you have won', 'congratulations you',
		'urgent', 'suspended', 'confirm your password', 'social security', 'irs',
		'final notice', 'do not ignore', 'send money', 'processing fee',
	];
	const hits = scamPhrases.filter((p) => lower.includes(p));
	if (hits.length) {
		risk += Math.min(60, hits.length * 18);
		signals.push({
			label: 'Pressure / lure language',
			severity: hits.length > 1 ? 'danger' : 'caution',
			detail: `Found classic scam phrasing: "${hits.slice(0, 3).join('", "')}".`,
		});
	}

	if (/https?:\/\/\S+/i.test(text) && (lower.includes('login') || lower.includes('verify'))) {
		risk += 20;
		signals.push({ label: 'Credential-harvesting link', severity: 'danger', detail: 'A link is paired with a request to log in or verify — a common phishing pattern.' });
	}

	const aiTells = ['as an ai', 'as a large language model', "i cannot", 'it is important to note that', 'in conclusion,', 'firstly,', 'moreover,'];
	const aiHits = aiTells.filter((p) => lower.includes(p));
	if (aiHits.length >= 2) {
		risk += 15;
		signals.push({ label: 'AI-writing tells', severity: 'caution', detail: 'Phrasing patterns common in AI-generated text were detected.' });
	}

	if (signals.length === 0) {
		signals.push({ label: 'No strong red flags', severity: 'info', detail: 'No common scam, phishing, or AI markers stood out in this text.' });
	}

	let verdict = 'uncertain';
	if (risk >= 55) verdict = 'scam';
	else if (risk >= 30) verdict = 'misleading';
	else if (aiHits.length >= 2 && risk < 30) verdict = 'ai_generated';
	else if (risk < 15) verdict = 'real';

	return finalize(verdict, Math.max(40, Math.min(92, 50 + risk)), signals, verdict === 'real'
		? 'Looks clean — no obvious manipulation detected.'
		: 'Treat this with caution. Verify the sender through an independent, official channel before acting.');
}

function heuristicUrl(raw) {
	const signals = [];
	let risk = 0;
	let host = raw;
	try { host = new URL(raw.includes('://') ? raw : `http://${raw}`).hostname; } catch { /* keep raw */ }

	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
		risk += 35;
		signals.push({ label: 'Raw IP address', severity: 'danger', detail: 'Legitimate brands rarely send links that point at a bare IP address.' });
	}
	const suspectTlds = ['.xyz', '.top', '.click', '.zip', '.mov', '.ru', '.tk', '.gq'];
	if (suspectTlds.some((t) => host.endsWith(t))) {
		risk += 20;
		signals.push({ label: 'High-risk domain ending', severity: 'caution', detail: `The domain ends in an extension frequently abused for scams.` });
	}
	const brands = ['paypal', 'apple', 'amazon', 'microsoft', 'netflix', 'google', 'bank', 'coinbase'];
	const lookalike = brands.find((b) => host.includes(b) && !host.endsWith(`${b}.com`));
	if (lookalike) {
		risk += 40;
		signals.push({ label: 'Brand impersonation', severity: 'danger', detail: `Mentions "${lookalike}" but is not the official ${lookalike}.com domain.` });
	}
	if ((host.match(/-/g) || []).length >= 3 || host.split('.').length >= 5) {
		risk += 15;
		signals.push({ label: 'Convoluted domain', severity: 'caution', detail: 'Lots of dashes/subdomains are used to disguise the true destination.' });
	}
	if (signals.length === 0) {
		signals.push({ label: 'No structural red flags', severity: 'info', detail: 'The link structure looks ordinary, but structure alone can not guarantee safety.' });
	}

	const verdict = risk >= 40 ? 'scam' : risk >= 20 ? 'misleading' : 'uncertain';
	return finalize(verdict, Math.max(45, Math.min(90, 50 + risk)), signals,
		risk >= 20 ? 'Do not enter any login or payment details. Navigate to the brand by typing its address yourself.'
			: 'No obvious red flags, but hover/verify the destination before entering anything sensitive.');
}

function heuristicImage(mediaType) {
	return finalize('uncertain', 50, [
		{ label: 'Connect an API key for deep analysis', severity: 'info', detail: 'Image forensics (deepfake & AI-generation detection) needs the AI engine. Set ANTHROPIC_API_KEY to enable it.' },
		{ label: `Received ${mediaType || 'image'}`, severity: 'info', detail: 'The image was uploaded successfully and is ready to scan.' },
	], 'Add an ANTHROPIC_API_KEY to unlock full image/deepfake analysis.');
}

function finalize(verdict, confidence, signals, recommendation) {
	const headlines = {
		real: 'Looks genuine',
		fake: 'Likely fabricated',
		ai_generated: 'Likely AI-generated',
		scam: 'Looks like a scam',
		misleading: 'Potentially misleading',
		uncertain: 'Not enough to be sure',
	};
	return {
		verdict,
		confidence: clampInt(confidence, 0, 100),
		headline: headlines[verdict] || 'Analysis complete',
		summary: signals.map((s) => s.detail).join(' '),
		signals,
		recommendation,
		engine: 'heuristic',
	};
}

// --- Routes -------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
	res.json({ ok: true, engine: hasKey ? 'claude' : 'heuristic', model: hasKey ? MODEL : null });
});

app.post('/api/check', async (req, res) => {
	const { type, content, mediaType } = req.body || {};
	if (!type || !content) {
		return res.status(400).json({ error: 'Provide { type, content }.' });
	}
	if (!['text', 'url', 'image'].includes(type)) {
		return res.status(400).json({ error: 'type must be "text", "url", or "image".' });
	}

	try {
		const result = hasKey
			? await analyzeWithClaude({ type, content, mediaType })
			: analyzeHeuristic({ type, content, mediaType });
		res.json(result);
	} catch (err) {
		console.error('check failed:', err);
		// Degrade gracefully to the heuristic engine rather than failing the user.
		try {
			const fallback = analyzeHeuristic({ type, content, mediaType });
			fallback.note = 'AI engine unavailable, used heuristic fallback.';
			res.json(fallback);
		} catch {
			res.status(500).json({ error: 'Analysis failed.' });
		}
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`RealCheck running on http://localhost:${PORT}  (engine: ${hasKey ? 'Claude ' + MODEL : 'heuristic demo'})`);
});
