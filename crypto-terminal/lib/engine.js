// Shared scan engine used by the terminal, the one-shot scanner, and the web
// server, so all surfaces compute identical signals from one code path.

import {getAllSpotTickers, getCandles, pool} from './okx.js';
import {analyze, marketRegime} from './signals.js';

export async function scan({bar = '5m', top = 60, minVol = 2_000_000} = {}) {
	const tickers = (await getAllSpotTickers()).filter(t => t.quote === 'USDT' && t.last > 0);
	const regime = marketRegime(tickers);

	const universe = tickers
		.filter(t => t.volUsd24h > minVol)
		.sort((a, b) => b.volUsd24h - a.volUsd24h)
		.slice(0, top);

	const rows = (await pool(
		universe,
		async t => analyze(t.instId, t, await getCandles(t.instId, bar, 120)),
		6,
	)).filter(Boolean);

	const booms = [...rows]
		.filter(s => s.explosionScore >= 30)
		.sort((a, b) => b.explosionScore - a.explosionScore);
	const buys = [...rows]
		.filter(s => s.buyScore >= 35)
		.sort((a, b) => b.buyScore - a.buyScore);

	// Single highest-conviction actionable idea.
	const focus =
		booms.find(s => s.explosionScore >= 60) ||
		buys.find(s => s.buyScore >= 60) ||
		booms[0] || buys[0] || undefined;

	return {tickers, regime, rows, booms, buys, focus, bar, ts: Date.now()};
}
