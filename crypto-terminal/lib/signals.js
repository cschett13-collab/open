// Signal engine: turns raw candles into quantitative conviction scores.
//
// Two distinct ideas:
//   buyScore       — confirmed, ride-the-trend momentum entries ("buy now").
//   explosionScore — pre-breakout setups: accumulation + volatility squeeze +
//                    volume ignition BEFORE the big candle ("about to explode").
//
// These are probabilistic edges derived from real price/volume structure.
// They are NOT guarantees. Markets are adversarial. See README disclaimer.

import {
	rsi, atrPct, roc, zScore, bbWidth, slopePct, macdHist, ema,
} from './indicators.js';

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

// Map a value through a soft 0..1 ramp between a and b.
function ramp(x, a, b) {
	if (a === b) return x >= a ? 1 : 0;
	return clamp((x - a) / (b - a), 0, 1);
}

export function analyze(instId, ticker, candles) {
	if (!candles || candles.length < 40) return undefined;

	const closes = candles.map(c => c.c);
	const vols = candles.map(c => c.vol);
	const last = closes[closes.length - 1];

	const r = rsi(closes, 14);
	const atr = atrPct(candles, 14); // % volatility per bar
	const roc5 = roc(closes, 5);
	const roc15 = roc(closes, 15);
	const roc30 = roc(closes, 30);
	const accel = roc5 !== undefined && roc15 !== undefined ? roc5 - roc15 / 3 : 0; // momentum picking up
	const volZ = zScore(vols, 30); // is current volume abnormally high?
	const bbw = bbWidth(closes, 20, 2); // current band width
	const bbwHist = closes.length > 60 ? bbWidth(closes.slice(0, -20), 20, 2) : undefined; // width ~20 bars ago
	const slope = slopePct(closes, 20);
	const macd = macdHist(closes);
	const ema9 = ema(closes, 9);
	const ema21 = ema(closes, 21);
	const trendUp = ema9 !== undefined && ema21 !== undefined && ema9 > ema21;

	// 24h liquidity gate (skip illiquid junk that can't actually be traded).
	const liquid = (ticker?.volUsd24h ?? 0) > 2_000_000;

	// ---- BUY-NOW score: confirmed bullish momentum, not yet overextended ----
	let buy = 0;
	buy += ramp(slope ?? 0, 0, 0.25) * 22; // positive, steady uptrend
	buy += (trendUp ? 1 : 0) * 14; // fast EMA above slow EMA
	buy += ramp(macd ?? -1, 0, (atr ?? 1) * 0.4) * 16; // MACD histogram positive
	buy += ramp(roc15 ?? 0, 0, 6) * 16; // real recent gains
	buy += ramp((r ?? 50), 50, 62) * 12; // momentum but headroom...
	buy -= ramp((r ?? 50), 72, 85) * 24; // ...penalize overbought / late chase
	buy += ramp(volZ ?? 0, 0.5, 2.5) * 14; // participation confirms the move
	buy += ramp(accel, 0, 2) * 6; // acceleration bonus
	if (!liquid) buy *= 0.35;
	buy = clamp(buy);

	// ---- EXPLOSION score: coiled spring about to release ----
	// Squeeze: current band width well below its recent self.
	// Guard bbw===0 (flat tape) — otherwise bbwHist/bbw is Infinity/NaN.
	const squeeze = bbw !== undefined && bbwHist !== undefined && bbw > 0
		? ramp(bbwHist / bbw, 1.2, 2.6)
		: 0;
	let boom = 0;
	boom += squeeze * 26; // volatility compression precedes expansion
	boom += ramp(volZ ?? 0, 1.5, 4.5) * 30; // volume ignition is the trigger
	boom += ramp(accel, 0.2, 3) * 16; // momentum just turning up
	boom += ramp(roc5 ?? 0, 0.3, 4) * 12; // fresh kick off the base
	boom += (trendUp ? 1 : 0) * 8; // structure flipping up
	boom += ramp((r ?? 50), 48, 60) * 8; // emerging, not yet euphoric
	boom -= ramp((r ?? 50), 75, 90) * 20; // already exploded -> not "about to"
	boom -= ramp(roc30 ?? 0, 25, 60) * 18; // already ran a lot -> chase risk
	if (!liquid) boom *= 0.3;
	boom = clamp(boom);

	// Suggested trade geometry from ATR (purely mechanical, for context).
	const atrAbs = ((atr ?? 1) / 100) * last;
	const stop = last - atrAbs * 1.5;
	const target1 = last + atrAbs * 2;
	const target2 = last + atrAbs * 4;

	return {
		instId,
		base: instId.split('-')[0],
		last,
		rsi: r,
		atrPct: atr,
		roc5, roc15, roc30,
		volZ,
		slope,
		macd,
		trendUp,
		squeeze: squeeze * 100,
		liquid,
		volUsd24h: ticker?.volUsd24h ?? 0,
		changePct24h: ticker?.changePct24h ?? 0,
		buyScore: Math.round(buy),
		explosionScore: Math.round(boom),
		stop, target1, target2,
		closes, // kept for sparkline rendering
	};
}

// Plain-language verdict for a row.
export function verdict(s) {
	if (s.explosionScore >= 70) return ['IGNITION', 'about to break out — volume + squeeze'];
	if (s.buyScore >= 72) return ['STRONG BUY', 'confirmed momentum, trend intact'];
	if (s.buyScore >= 58) return ['BUY', 'bullish, building'];
	if (s.explosionScore >= 55) return ['COILING', 'tightening, watch for trigger'];
	if (s.buyScore >= 45) return ['ACCUMULATE', 'early / mild edge'];
	if ((s.rsi ?? 50) > 78) return ['OVEREXTENDED', 'late — wait for pullback'];
	return ['NEUTRAL', 'no clear edge'];
}

// Market regime from breadth of the whole board (a fear/greed proxy).
export function marketRegime(tickers) {
	const major = tickers.filter(t => t.volUsd24h > 5_000_000);
	if (major.length === 0) return {label: 'UNKNOWN', score: 50, advancers: 0, total: 0};
	const advancers = major.filter(t => t.changePct24h > 0).length;
	const breadth = advancers / major.length; // 0..1
	const avgChange = major.reduce((a, t) => a + t.changePct24h, 0) / major.length;
	const score = clamp(breadth * 70 + ramp(avgChange, -6, 6) * 30);
	let label = 'NEUTRAL';
	if (score >= 75) label = 'EXTREME GREED';
	else if (score >= 60) label = 'GREED / RISK-ON';
	else if (score >= 45) label = 'NEUTRAL';
	else if (score >= 30) label = 'FEAR / RISK-OFF';
	else label = 'EXTREME FEAR';
	return {label, score: Math.round(score), advancers, total: major.length, avgChange};
}
