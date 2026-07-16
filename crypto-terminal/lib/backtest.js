// Walk-forward backtest of the signal engine. For each historical bar we compute
// the signal using ONLY data up to that bar, then measure the realized forward
// return over a fixed horizon. This answers the only question that matters:
// do high scores actually precede higher returns, beyond random chance?
//
// Honesty notes (see README): this is in-sample on recent history and a few
// hundred bars is a small sample. The CLI reports net-of-cost averages using
// ALPHA_BT_FEE_BPS; per-bar samples themselves stay gross. Treat results as a
// sanity check on the engine's edge, not a profit promise.

import {getAllSpotTickers, getCandlesPaged, pool} from './okx.js';
import {analyze} from './signals.js';

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = a => {
	if (!a.length) return 0;
	const s = [...a].sort((x, y) => x - y);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const winRate = a => (a.length ? (a.filter(x => x > 0).length / a.length) * 100 : 0);

// Collect (score, forwardReturn%) samples for one symbol.
function sampleSymbol(instId, candles, {horizon, warmup}) {
	const samples = [];
	const N = candles.length;
	for (let t = warmup; t < N - horizon; t++) {
		const slice = candles.slice(0, t + 1);
		const s = analyze(instId, {volUsd24h: 1e9, changePct24h: 0}, slice);
		if (!s) continue;
		const entry = candles[t].c;
		const exit = candles[t + horizon].c;
		if (!entry) continue;
		samples.push({
			buy: s.buyScore,
			boom: s.explosionScore,
			ret: ((exit - entry) / entry) * 100,
		});
	}

	return samples;
}

function summarize(samples, key, threshold) {
	const hits = samples.filter(s => s[key] >= threshold).map(s => s.ret);
	return {
		threshold,
		count: hits.length,
		avgRet: mean(hits),
		medRet: median(hits),
		winRate: winRate(hits),
	};
}

function evalAt(samples, key, threshold) {
	const hits = samples.filter(s => s[key] >= threshold).map(s => s.ret);
	const base = samples.map(s => s.ret);
	return {
		threshold,
		count: hits.length,
		avgRet: mean(hits),
		winRate: winRate(hits),
		edge: mean(hits) - mean(base),
	};
}

// "Learn" the best threshold on the train split (maximize avg forward return
// among thresholds with enough samples), then report how it does out-of-sample.
function chooseThreshold(trainSamples, key, minCount = 25) {
	let best = null;
	for (let th = 40; th <= 80; th += 5) {
		const e = evalAt(trainSamples, key, th);
		if (e.count < minCount) continue;
		if (!best || e.avgRet > best.avgRet) best = e;
	}

	return best ? best.threshold : 55;
}

export async function backtest({
	bar = '15m',
	horizon = 8, // bars forward (8 × 15m = 2h)
	bars = 600,
	symbols = 18,
	warmup = 60,
	cost = 0.1, // round-trip cost in % (fees + slippage), applied to traded signals
	onProgress = () => {},
} = {}) {
	const tickers = (await getAllSpotTickers())
		.filter(t => t.quote === 'USDT' && t.volUsd24h > 5_000_000)
		.sort((a, b) => b.volUsd24h - a.volUsd24h)
		.slice(0, symbols);

	let done = 0;
	const perSymbol = await pool(
		tickers,
		async t => {
			const candles = await getCandlesPaged(t.instId, bar, bars);
			done++;
			onProgress(done, tickers.length, t.base);
			if (candles.length < warmup + horizon + 5) return {base: t.base, samples: []};
			return {base: t.base, samples: sampleSymbol(t.instId, candles, {horizon, warmup})};
		},
		5,
	);

	const all = [];
	// Chronological train/test split per symbol (samples are time-ordered).
	const trainAll = [];
	const testAll = [];
	for (const r of perSymbol) {
		if (!r) continue;
		all.push(...r.samples);
		const cut = Math.floor(r.samples.length * 0.7);
		trainAll.push(...r.samples.slice(0, cut));
		testAll.push(...r.samples.slice(cut));
	}

	const baseline = {avgRet: mean(all.map(s => s.ret)), winRate: winRate(all.map(s => s.ret)), count: all.length};

	// Buckets at increasing conviction thresholds.
	const buyBuckets = [40, 55, 70].map(th => summarize(all, 'buy', th));
	const boomBuckets = [40, 55, 70].map(th => summarize(all, 'boom', th));

	// Decile view: average forward return by buyScore decile (monotonic = good).
	const deciles = [];
	for (let d = 0; d < 10; d++) {
		const lo = d * 10, hi = lo + 10;
		const rets = all.filter(s => s.buy >= lo && s.buy < hi).map(s => s.ret);
		deciles.push({range: `${lo}-${hi}`, count: rets.length, avgRet: mean(rets), winRate: winRate(rets)});
	}

	// Out-of-sample validation: pick threshold on train, judge it on test.
	const buyTh = chooseThreshold(trainAll, 'buy');
	const boomTh = chooseThreshold(trainAll, 'boom');
	const oos = {
		buy: {
			threshold: buyTh,
			train: evalAt(trainAll, 'buy', buyTh),
			test: evalAt(testAll, 'buy', buyTh),
		},
		boom: {
			threshold: boomTh,
			train: evalAt(trainAll, 'boom', boomTh),
			test: evalAt(testAll, 'boom', boomTh),
		},
		trainBaseline: {avgRet: mean(trainAll.map(s => s.ret)), winRate: winRate(trainAll.map(s => s.ret)), count: trainAll.length},
		testBaseline: {avgRet: mean(testAll.map(s => s.ret)), winRate: winRate(testAll.map(s => s.ret)), count: testAll.length},
	};

	return {
		params: {bar, horizon, bars, symbols: tickers.length, warmup, cost, horizonLabel: `${horizon}×${bar}`},
		baseline,
		buyBuckets,
		boomBuckets,
		deciles,
		oos,
		perSymbol: perSymbol.filter(Boolean).map(r => ({base: r.base, n: r.samples.length})),
	};
}
