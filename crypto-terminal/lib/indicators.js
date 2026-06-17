// Pure-function technical indicators. Input arrays are chronological (oldest first).

export function sma(values, period) {
	if (values.length < period) return undefined;
	let sum = 0;
	for (let i = values.length - period; i < values.length; i++) sum += values[i];
	return sum / period;
}

export function ema(values, period) {
	if (values.length < period) return undefined;
	const k = 2 / (period + 1);
	// Seed with SMA of the first `period` values, then roll forward.
	let prev = 0;
	for (let i = 0; i < period; i++) prev += values[i];
	prev /= period;
	for (let i = period; i < values.length; i++) {
		prev = values[i] * k + prev * (1 - k);
	}

	return prev;
}

// Full EMA series (same length as input, leading entries undefined).
export function emaSeries(values, period) {
	const out = new Array(values.length).fill(undefined);
	if (values.length < period) return out;
	const k = 2 / (period + 1);
	let prev = 0;
	for (let i = 0; i < period; i++) prev += values[i];
	prev /= period;
	out[period - 1] = prev;
	for (let i = period; i < values.length; i++) {
		prev = values[i] * k + prev * (1 - k);
		out[i] = prev;
	}

	return out;
}

// Wilder's RSI.
export function rsi(closes, period = 14) {
	if (closes.length < period + 1) return undefined;
	let gain = 0;
	let loss = 0;
	for (let i = 1; i <= period; i++) {
		const diff = closes[i] - closes[i - 1];
		if (diff >= 0) gain += diff; else loss -= diff;
	}

	gain /= period;
	loss /= period;
	for (let i = period + 1; i < closes.length; i++) {
		const diff = closes[i] - closes[i - 1];
		const up = diff > 0 ? diff : 0;
		const down = diff < 0 ? -diff : 0;
		gain = (gain * (period - 1) + up) / period;
		loss = (loss * (period - 1) + down) / period;
	}

	if (loss === 0) return 100;
	const rs = gain / loss;
	return 100 - 100 / (1 + rs);
}

// Average True Range as a percentage of price (volatility, comparable across coins).
export function atrPct(candles, period = 14) {
	if (candles.length < period + 1) return undefined;
	const trs = [];
	for (let i = 1; i < candles.length; i++) {
		const {h, l} = candles[i];
		const prevC = candles[i - 1].c;
		trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
	}

	const atr = sma(trs, period) ?? trs.reduce((a, b) => a + b, 0) / trs.length;
	const lastClose = candles[candles.length - 1].c;
	return (atr / lastClose) * 100;
}

// Rate of change (percent) over the last `lookback` bars.
export function roc(closes, lookback) {
	if (closes.length <= lookback) return undefined;
	const past = closes[closes.length - 1 - lookback];
	if (!past) return undefined;
	return ((closes[closes.length - 1] - past) / past) * 100;
}

// Z-score of the latest value vs the prior window (how unusual is "now").
export function zScore(values, window) {
	if (values.length < window + 1) return undefined;
	const slice = values.slice(values.length - window - 1, values.length - 1);
	const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
	const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
	const sd = Math.sqrt(variance);
	if (sd === 0) return 0;
	return (values[values.length - 1] - mean) / sd;
}

// Bollinger Band width as fraction of price — low width = "squeeze" = coiled spring.
export function bbWidth(closes, period = 20, mult = 2) {
	if (closes.length < period) return undefined;
	const slice = closes.slice(closes.length - period);
	const mean = slice.reduce((a, b) => a + b, 0) / period;
	const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
	const sd = Math.sqrt(variance);
	return ((mult * 2 * sd) / mean) * 100;
}

// Linear-regression slope of closes, normalized to %/bar — trend strength & direction.
export function slopePct(closes, window) {
	if (closes.length < window) return undefined;
	const ys = closes.slice(closes.length - window);
	const n = ys.length;
	const meanX = (n - 1) / 2;
	const meanY = ys.reduce((a, b) => a + b, 0) / n;
	let num = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		num += (i - meanX) * (ys[i] - meanY);
		den += (i - meanX) ** 2;
	}

	if (den === 0) return 0;
	const slope = num / den;
	return (slope / meanY) * 100;
}

// MACD histogram (12,26,9) — last value, positive & rising = bullish momentum.
export function macdHist(closes) {
	if (closes.length < 35) return undefined;
	const fast = emaSeries(closes, 12);
	const slow = emaSeries(closes, 26);
	const macdLine = closes.map((_, i) =>
		fast[i] !== undefined && slow[i] !== undefined ? fast[i] - slow[i] : undefined,
	);
	const valid = macdLine.filter(v => v !== undefined);
	const signal = emaSeries(valid, 9);
	const lastMacd = valid[valid.length - 1];
	const lastSignal = signal[signal.length - 1];
	if (lastSignal === undefined) return undefined;
	return lastMacd - lastSignal;
}
