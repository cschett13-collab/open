// OKX public market-data client. Zero dependencies — uses Node's built-in https.
// OKX public endpoints need no API key and are not geo-restricted from here.
import https from 'node:https';

const HOST = 'www.okx.com';

// Small keep-alive agent so the rapid live-update loop reuses sockets (low latency).
const agent = new https.Agent({keepAlive: true, maxSockets: 16});

function get(path, {timeout = 9000} = {}) {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{host: HOST, path, method: 'GET', agent, headers: {'accept': 'application/json'}},
			res => {
				let body = '';
				res.setEncoding('utf8');
				res.on('data', chunk => {
					body += chunk;
				});
				res.on('end', () => {
					if (res.statusCode < 200 || res.statusCode >= 300) {
						reject(new Error(`HTTP ${res.statusCode} for ${path}`));
						return;
					}

					try {
						const json = JSON.parse(body);
						if (json.code && json.code !== '0') {
							reject(new Error(`OKX error ${json.code}: ${json.msg}`));
							return;
						}

						resolve(json.data);
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		req.on('error', reject);
		req.setTimeout(timeout, () => {
			req.destroy(new Error(`timeout for ${path}`));
		});
		req.end();
	});
}

// All spot tickers in a single request (~1200 markets). This is the cheap,
// high-frequency call that powers the live price tape.
export async function getAllSpotTickers() {
	const rows = await get('/api/v5/market/tickers?instType=SPOT');
	return rows.map(normalizeTicker);
}

function normalizeTicker(t) {
	const last = Number(t.last);
	const open = Number(t.open24h);
	return {
		instId: t.instId,
		base: t.instId.split('-')[0],
		quote: t.instId.split('-')[1],
		last,
		open24h: open,
		high24h: Number(t.high24h),
		low24h: Number(t.low24h),
		volBase24h: Number(t.vol24h), // volume in base currency
		volUsd24h: Number(t.volCcy24h), // OKX gives quote-ccy turnover for spot
		changePct24h: open ? ((last - open) / open) * 100 : 0,
		ts: Number(t.ts),
	};
}

// Candlesticks for one instrument. bar e.g. '1m','5m','15m','1H'.
// Returns chronological ascending array of {t,o,h,l,c,vol}.
export async function getCandles(instId, bar = '5m', limit = 120) {
	const rows = await get(
		`/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`,
	);
	return rows
		.map(r => ({
			t: Number(r[0]),
			o: Number(r[1]),
			h: Number(r[2]),
			l: Number(r[3]),
			c: Number(r[4]),
			vol: Number(r[5]),
			volCcy: Number(r[6]),
		}))
		.reverse();
}

// Paginated history: walk backwards with `after` to assemble up to `total`
// chronological candles (the single-call endpoint caps at 300).
export async function getCandlesPaged(instId, bar = '15m', total = 600) {
	const out = [];
	let after; // fetch records older than this ts
	while (out.length < total) {
		const q = `instId=${encodeURIComponent(instId)}&bar=${bar}&limit=300${after ? `&after=${after}` : ''}`;
		// eslint-disable-next-line no-await-in-loop
		const rows = await get(`/api/v5/market/candles?${q}`);
		if (!rows || rows.length === 0) break;
		for (const r of rows) {
			out.push({
				t: Number(r[0]), o: Number(r[1]), h: Number(r[2]),
				l: Number(r[3]), c: Number(r[4]), vol: Number(r[5]), volCcy: Number(r[6]),
			});
		}

		after = rows[rows.length - 1][0]; // oldest ts in this batch
		if (rows.length < 300) break; // no more history
	}

	out.sort((a, b) => a.t - b.t); // chronological ascending
	return out;
}

// Run promise-returning tasks with bounded concurrency so we never hammer the API.
export async function pool(items, worker, concurrency = 6) {
	const results = new Array(items.length);
	let cursor = 0;
	async function run() {
		while (cursor < items.length) {
			const index = cursor++;
			try {
				results[index] = await worker(items[index], index);
			} catch {
				results[index] = undefined;
			}
		}
	}

	await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, run));
	return results;
}
