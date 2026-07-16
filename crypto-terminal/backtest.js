#!/usr/bin/env node
// Backtest the signal engine against recent history and print an honest report.
//
//   node backtest.js                 # defaults: 15m bars, 2h horizon, 18 symbols
//   ALPHA_BT_BAR=1H ALPHA_BT_HORIZON=6 ALPHA_BT_BARS=800 node backtest.js
//
// NOT FINANCIAL ADVICE. In-sample, small sample — a sanity check
// on whether the engine has any edge, not a profit guarantee.
// Round-trip costs default to ALPHA_BT_FEE_BPS (10 bps) on reported nets.

import process from 'node:process';
import {backtest} from './lib/backtest.js';
import {c, color} from './lib/render.js';

const opts = {
	bar: process.env.ALPHA_BT_BAR || '15m',
	horizon: Number(process.env.ALPHA_BT_HORIZON || 8),
	bars: Number(process.env.ALPHA_BT_BARS || 600),
	symbols: Number(process.env.ALPHA_BT_SYMBOLS || 18),
	cost: Number(process.env.ALPHA_BT_FEE_BPS || 10) / 100, // bps → %
};

const pct = (n, plus = true) => {
	const s = `${n >= 0 && plus ? '+' : ''}${n.toFixed(3)}%`;
	return color(s, n >= 0 ? c.green : c.red);
};

const bar = (n, scale = 40) => {
	// Centered bar around zero for the decile view.
	const len = Math.min(scale, Math.round(Math.abs(n) * scale));
	return color((n >= 0 ? '▌' : '▐').repeat(Math.max(1, len)), n >= 0 ? c.lime : c.red);
};

async function main() {
	process.stderr.write('Running walk-forward backtest on live OKX history…\n');
	const r = await backtest({
		...opts,
		onProgress: (d, total, sym) => process.stderr.write(`\r  fetching ${d}/${total}  ${sym}            `),
	});
	process.stderr.write('\n\n');

	const p = r.params;
	const net = g => g - p.cost; // subtract round-trip cost from a traded signal's gross return
	console.log(color('▲ ALPHA TERMINAL — SIGNAL BACKTEST', c.bold + c.cyan));
	console.log(color(`  ${p.symbols} symbols · ${p.bar} bars · forward horizon ${p.horizonLabel} · ${r.baseline.count.toLocaleString()} samples`, c.dim));
	console.log(color(`  assumed cost: ${(p.cost).toFixed(2)}% round-trip (fees + slippage) — applied to traded signals below`, c.dim));
	console.log(color('  baseline (every bar): ', c.gray) + `avg fwd ${pct(r.baseline.avgRet)}  ·  win ${r.baseline.winRate.toFixed(1)}%`);

	const tbl = (title, buckets) => {
		console.log('\n' + color(title, c.bold + c.white));
		console.log(color('  thresh   samples   gross ret   NET (after cost)   win%     edge vs baseline', c.gray));
		for (const b of buckets) {
			const edge = b.avgRet - r.baseline.avgRet;
			const n = net(b.avgRet);
			console.log(
				'  ' + String('≥' + b.threshold).padEnd(8) +
				String(b.count).padStart(7) + '   ' +
				pct(b.avgRet).padStart(18) + '   ' +
				(n >= 0 ? color('+' + n.toFixed(3) + '%', c.lime) : color(n.toFixed(3) + '%', c.red)).padStart(24) + '   ' +
				(b.winRate.toFixed(1) + '%').padStart(6) + '   ' +
				(edge >= 0 ? color('+' + edge.toFixed(3) + '%', c.lime) : color(edge.toFixed(3) + '%', c.red)),
			);
		}
	};

	tbl('📈 BUY-NOW score → forward return', r.buyBuckets);
	tbl('🚀 EXPLOSION score → forward return', r.boomBuckets);

	console.log('\n' + color('BUY-score decile → avg forward return (monotonic rising = real edge)', c.bold + c.white));
	for (const d of r.deciles) {
		if (!d.count) continue;
		console.log(
			'  ' + d.range.padStart(6) + ' ' +
			color(String(d.count).padStart(5), c.dim) + '  ' +
			pct(d.avgRet).padStart(18) + '  ' + bar(d.avgRet),
		);
	}

	// Out-of-sample: did the threshold learned on train survive on unseen test data?
	const o = r.oos;
	console.log('\n' + color('🧪 OUT-OF-SAMPLE (threshold learned on first 70%, judged on last 30%)', c.bold + c.white));
	const oosLine = (label, sel) => {
		const tr = sel.train, te = sel.test;
		console.log(
			'  ' + label.padEnd(11) + color(`@≥${sel.threshold}`, c.dim) +
			'   train edge ' + pct(tr.edge) + ` (win ${tr.winRate.toFixed(1)}%, n=${tr.count})` +
			'   →   test edge ' + pct(te.edge) + ` (win ${te.winRate.toFixed(1)}%, n=${te.count})`,
		);
	};

	oosLine('BUY-NOW', o.buy);
	oosLine('EXPLOSION', o.boom);
	const survived = o.buy.test.edge > 0;
	console.log('  ' + (survived
		? color('✓ edge persisted out-of-sample — not just curve-fit on this window', c.lime)
		: color('✗ edge did NOT hold out-of-sample on this window — treat signals with caution', c.orange)));

	const netTest = net(o.buy.test.avgRet);
	console.log('  ' + (netTest > 0
		? color(`✓ BUY-NOW still NET POSITIVE out-of-sample after ${p.cost.toFixed(2)}% cost: ${'+' + netTest.toFixed(3)}%/trade`, c.lime)
		: color(`✗ BUY-NOW is NET NEGATIVE out-of-sample after ${p.cost.toFixed(2)}% cost (${netTest.toFixed(3)}%/trade) — costs eat the edge`, c.orange)));

	console.log('\n' + color(' Read it honestly: if higher thresholds/deciles show higher avg returns &', c.dim));
	console.log(color(' win rates than baseline, the engine has edge on this window. If not, it', c.dim));
	console.log(color(' does not — markets shift. Costs applied via ALPHA_BT_FEE_BPS. NOT financial advice.', c.dim) + '\n');
}

main().catch(error => {
	console.error('\nError:', error.message);
	process.exit(1);
});
