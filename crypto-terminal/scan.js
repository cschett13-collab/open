#!/usr/bin/env node
// One-shot scanner: prints a ranked snapshot (and an AI briefing if configured)
// then exits. Useful for piping, logging, cron, or no-TTY environments.
//
// NOT FINANCIAL ADVICE — probabilistic signals from real price/volume only.

import process from 'node:process';
import {scan} from './lib/engine.js';
import {verdict} from './lib/signals.js';
import {briefing, aiConfig} from './lib/ai.js';
import {scanStocks} from './lib/stocks.js';
import {c, color, fmtPrice, fmtPct, meter, sparkline} from './lib/render.js';

const BAR = process.env.ALPHA_BAR || '5m';
const TOP = Number(process.env.ALPHA_TOP || 60);

function table(title, rows, key, accent) {
	console.log('\n' + color(title, c.bold + accent));
	console.log(color('─'.repeat(78), c.gray));
	if (rows.length === 0) {
		console.log(color('  (nothing clears the threshold right now)', c.dim));
		return;
	}

	for (const s of rows.slice(0, 10)) {
		const [tag] = verdict(s);
		console.log(
			'  ' + color(s.base.padEnd(9), c.bold + c.white) +
			('$' + fmtPrice(s.last)).padEnd(13) +
			fmtPct(s.changePct24h).padEnd(18) +
			' rsi ' + String((s.rsi ?? 0).toFixed(0)).padStart(3) +
			'  ' + meter(s[key], 8) + ' ' + String(s[key]).padStart(3) +
			'  ' + color(tag.padEnd(12), accent) +
			sparkline(s.closes, 14),
		);
	}
}

async function main() {
	process.stderr.write('Fetching live OKX market data…\n');
	const snap = await scan({bar: BAR, top: TOP});
	const {regime: reg, booms, buys} = snap;

	console.log(color('\n ▲ ALPHA TERMINAL — snapshot ' + new Date().toLocaleString(), c.bold + c.cyan));
	console.log(
		'   regime ' + color(reg.label, c.yellow) + color(` (${reg.score}/100)`, c.dim) +
		`   advancers ${reg.advancers}/${reg.total}   ${BAR} bars   ${snap.rows.length} markets scanned`,
	);

	table('🚀 ABOUT TO EXPLODE  (volume + squeeze pre-breakout)', booms, 'explosionScore', c.magenta);
	table('📈 BUY NOW  (confirmed momentum)', buys, 'buyScore', c.lime);

	if ((process.env.ALPHA_STOCKS || 'on').toLowerCase() !== 'off') {
		process.stderr.write('Fetching live equities…\n');
		try {
			const st = await scanStocks();
			table(`📊 STOCKS MOVING  (market ${st.marketState}, by today's move)`, st.movers.slice(0, 10), 'buyScore', c.cyan);
		} catch {
			console.log('\n' + color('  (stock feed unreachable)', c.dim));
		}
	}

	if (aiConfig().enabled) {
		process.stderr.write('\nAsking local AI for a briefing…\n');
		const text = await briefing(snap);
		if (text) {
			console.log('\n' + color('🧠 AI DESK BRIEFING', c.bold + c.cyan));
			console.log(color('─'.repeat(78), c.gray));
			console.log(text.split('\n').map(l => '  ' + l).join('\n'));
		} else {
			console.log('\n' + color('  (local AI unreachable — check ALPHA_AI settings)', c.dim));
		}
	}

	console.log('\n' + color(' signals are probabilistic — NOT financial advice. DYOR.', c.dim) + '\n');
}

main().catch(error => {
	console.error('Error:', error.message);
	process.exit(1);
});
