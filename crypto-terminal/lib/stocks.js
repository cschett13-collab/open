// Live US-equity movers via Yahoo Finance's public chart endpoint (no key).
// Runs the SAME signal engine as crypto so scores are directly comparable.
// Note: stocks only move during US market hours; off-hours the % change and
// volume go quiet — that's expected, not a bug.

import https from 'node:https';
import {analyze} from './signals.js';
import {pool} from './okx.js';

// Liquid, high-attention, high-beta names — the stuff that actually moves.
export const WATCHLIST = [
	// Mega-cap / AI / semis
	'NVDA', 'TSLA', 'AAPL', 'AMD', 'MSFT', 'AMZN', 'META', 'GOOGL', 'NFLX', 'AVGO',
	'TSM', 'QCOM', 'MU', 'ARM', 'SMCI', 'INTC', 'DELL', 'MRVL', 'ASML', 'CRM',
	// High-beta / momentum / retail favorites
	'PLTR', 'COIN', 'MSTR', 'MARA', 'RIOT', 'SOFI', 'HOOD', 'CVNA', 'AFRM', 'GME',
	'AMC', 'DKNG', 'CRWD', 'SNOW', 'NET', 'DDOG', 'RBLX', 'UPST', 'ROKU', 'ABNB',
	// EVs / China / movers
	'NIO', 'LCID', 'RIVN', 'BABA', 'PDD', 'XPEV', 'LI', 'UBER', 'SHOP', 'PYPL',
	// Index / sector ETFs for regime context
	'SPY', 'QQQ', 'IWM', 'SMH', 'ARKK',
];

const agent = new https.Agent({keepAlive: true, maxSockets: 12});

function getChart(symbol, {timeout = 9000} = {}) {
	const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				host: 'query1.finance.yahoo.com',
				path,
				method: 'GET',
				agent,
				headers: {'user-agent': 'Mozilla/5.0', accept: 'application/json'},
			},
			res => {
				let body = '';
				res.setEncoding('utf8');
				res.on('data', c => {
					body += c;
				});
				res.on('end', () => {
					try {
						resolve(JSON.parse(body));
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		req.on('error', reject);
		req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
		req.end();
	});
}

// Build OHLCV candles + a synthetic ticker, then reuse the crypto analyzer.
async function analyzeStock(symbol) {
	const json = await getChart(symbol);
	const r = json?.chart?.result?.[0];
	if (!r) return undefined;
	const m = r.meta;
	const q = r.indicators?.quote?.[0];
	if (!q || !m) return undefined;

	const candles = [];
	for (let i = 0; i < q.close.length; i++) {
		if (q.close[i] == null || q.open[i] == null) continue;
		candles.push({
			t: (r.timestamp?.[i] ?? 0) * 1000,
			o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i],
			vol: q.volume?.[i] ?? 0,
		});
	}

	if (candles.length < 40) return undefined;

	const last = m.regularMarketPrice ?? candles[candles.length - 1].c;
	const prev = m.chartPreviousClose ?? candles[0].o;
	const changePct = prev ? ((last - prev) / prev) * 100 : 0;

	// Equities are liquid; pass a large turnover so the liquidity gate clears.
	const ticker = {volUsd24h: 1e9, changePct24h: changePct};
	const s = analyze(symbol, ticker, candles);
	if (!s) return undefined;
	s.last = last; // use the official last price, not the last 5m close
	s.changePct24h = changePct;
	s.marketState = m.marketState; // PRE / REGULAR / POST / CLOSED
	return s;
}

export async function scanStocks() {
	const rows = (await pool(WATCHLIST, analyzeStock, 6)).filter(Boolean);
	const movers = [...rows].sort((a, b) => Math.abs(b.changePct24h) - Math.abs(a.changePct24h));
	const booms = [...rows].filter(s => s.explosionScore >= 25).sort((a, b) => b.explosionScore - a.explosionScore);
	const buys = [...rows].filter(s => s.buyScore >= 30).sort((a, b) => b.buyScore - a.buyScore);
	const state = rows[0]?.marketState || 'UNKNOWN';
	return {rows, movers, booms, buys, marketState: state, ts: Date.now()};
}
