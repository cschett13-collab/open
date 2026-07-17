// Pure unit tests for AI helpers (no live vLLM required).
//   node --test lib/ai.test.js

import {describe, it, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {
	parseBriefingJson,
	formatBriefingText,
	snapshotFingerprint,
	snapshotChanged,
	buildSignalBlock,
	aiConfig,
	_resetAiForTests,
} from './ai.js';

const sampleSnap = {
	bar: '5m',
	regime: {label: 'GREED', score: 72, advancers: 18, total: 24},
	focus: {base: 'HYPE', last: 75.5, changePct24h: 4.2, rsi: 58, volZ: 2.1, buyScore: 74, explosionScore: 61},
	booms: [
		{base: 'HYPE', last: 75.5, changePct24h: 4.2, rsi: 58, volZ: 2.1, buyScore: 74, explosionScore: 61},
	],
	buys: [
		{base: 'SOL', last: 140, changePct24h: 2.1, rsi: 55, volZ: 1.2, buyScore: 70, explosionScore: 40},
	],
};

beforeEach(() => {
	_resetAiForTests();
	delete process.env.ALPHA_AI;
	delete process.env.ALPHA_AI_MODEL;
	delete process.env.ALPHA_AI_URL;
});

describe('aiConfig', () => {
	it('is off by default', () => {
		assert.equal(aiConfig().enabled, false);
		assert.equal(aiConfig().mode, 'off');
	});

	it('enables vllm mode', () => {
		process.env.ALPHA_AI = 'vllm';
		process.env.ALPHA_AI_MODEL = 'test-model';
		const cfg = aiConfig();
		assert.equal(cfg.enabled, true);
		assert.equal(cfg.backend, 'vllm');
		assert.equal(cfg.model, 'test-model');
		assert.match(cfg.url, /\/v1\/chat\/completions$/);
	});

	it('treats openai as vllm-compatible alias', () => {
		process.env.ALPHA_AI = 'openai';
		assert.equal(aiConfig().backend, 'vllm');
		assert.equal(aiConfig().enabled, true);
	});

	it('rejects legacy ollama as unsupported', () => {
		process.env.ALPHA_AI = 'ollama';
		const cfg = aiConfig();
		assert.equal(cfg.enabled, false);
		assert.match(cfg.error || '', /unsupported/);
	});
});

describe('parseBriefingJson / formatBriefingText', () => {
	it('parses raw JSON', () => {
		const data = parseBriefingJson(
			'{"regime_read":"Risk-on","ideas":[{"symbol":"HYPE","why":"vol + trend"}],"risk":"fakeouts","summary":"Lean long."}',
		);
		assert.equal(data.regime_read, 'Risk-on');
		assert.equal(data.ideas[0].symbol, 'HYPE');
		const text = formatBriefingText(data);
		assert.match(text, /HYPE/);
		assert.match(text, /Not financial advice/i);
	});

	it('parses fenced JSON and falls back on garbage', () => {
		const data = parseBriefingJson('```json\n{"regime_read":"Fear","ideas":[],"risk":"chop","summary":"Wait."}\n```');
		assert.equal(data.regime_read, 'Fear');
		assert.equal(parseBriefingJson('not json at all'), null);
		assert.equal(formatBriefingText(null, 'plain fallback'), 'plain fallback');
	});
});

describe('snapshot fingerprint', () => {
	it('is stable for identical snapshots and changes when scores move', () => {
		const a = snapshotFingerprint(sampleSnap);
		const b = snapshotFingerprint(sampleSnap);
		assert.equal(a, b);
		assert.equal(snapshotChanged(a, sampleSnap), false);
		const moved = {
			...sampleSnap,
			booms: [{...sampleSnap.booms[0], explosionScore: 90}],
		};
		assert.equal(snapshotChanged(a, moved), true);
	});
});

describe('buildSignalBlock', () => {
	it('includes regime and symbols without inventing fields', () => {
		const block = buildSignalBlock(sampleSnap);
		assert.match(block, /GREED/);
		assert.match(block, /HYPE/);
		assert.match(block, /SOL/);
		assert.match(block, /5m/);
	});
});
