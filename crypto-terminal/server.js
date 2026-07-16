#!/usr/bin/env node
// Web dashboard — open it from your phone or PC browser on the same network.
//   node server.js            then visit http://<this-machine-ip>:8787
//   PORT=9000 node server.js
//
// Serves a live, auto-refreshing dashboard plus a JSON API. The signal engine
// runs server-side on a timer; browsers just poll the cached snapshot, so many
// devices can watch at once with negligible load.
//
// NOT FINANCIAL ADVICE — probabilistic signals from real price/volume only.

import process from 'node:process';
import http from 'node:http';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {scan} from './lib/engine.js';
import {verdict} from './lib/signals.js';
import {
	briefing, aiConfig, aiStatus, aiHealth, enrichAlert, digest,
	snapshotFingerprint, snapshotChanged,
} from './lib/ai.js';
import {scanStocks} from './lib/stocks.js';
import {generateVapidKeys, sendNotification} from './lib/webpush.js';
import {dispatch as dispatchWebhooks, dispatchText, webhooksEnabled} from './lib/webhooks.js';
import {getCandles} from './lib/okx.js';
import {analyze} from './lib/signals.js';

const PORT = Number(process.env.PORT || 8787);
const BAR = process.env.ALPHA_BAR || '5m';
const TOP = Number(process.env.ALPHA_TOP || 60);
const REFRESH_MS = Number(process.env.ALPHA_REFRESH_MS || 15_000);
const STOCKS_MS = Number(process.env.ALPHA_STOCKS_MS || 30_000);
const STOCKS_ON = (process.env.ALPHA_STOCKS || 'on').toLowerCase() !== 'off';
const DIGEST_MS = Number(process.env.ALPHA_AI_DIGEST_MS || 0); // 0 = off

let snapshot = null;
let stocks = null;
let briefingText = null;
let lastError = null;
let lastBriefingFp = null;
let digestSince = Date.now();
const digestAlertIds = new Set();

// --- Web Push: persist VAPID keys + phone subscriptions ---------------------
const DATA_DIR = new URL('.data/', import.meta.url);
const VAPID_FILE = new URL('vapid.json', DATA_DIR);
const SUBS_FILE = new URL('subscriptions.json', DATA_DIR);
const PUSH_ON = (process.env.ALPHA_PUSH || 'on').toLowerCase() !== 'off';

let vapid = null;
let subscriptions = [];
function loadPush() {
	try {
		mkdirSync(DATA_DIR, {recursive: true});
	} catch {}

	try {
		vapid = JSON.parse(readFileSync(VAPID_FILE, 'utf8'));
	} catch {
		vapid = generateVapidKeys();
		try {
			writeFileSync(VAPID_FILE, JSON.stringify(vapid));
		} catch {}
	}

	try {
		subscriptions = JSON.parse(readFileSync(SUBS_FILE, 'utf8'));
	} catch {
		subscriptions = [];
	}
}

function saveSubs() {
	try {
		writeFileSync(SUBS_FILE, JSON.stringify(subscriptions));
	} catch {}
}

function pushToAll(alert) {
	if (!PUSH_ON || !vapid || subscriptions.length === 0) return;
	let body =
		`${alert.kind === 'stock' ? 'Stock' : 'Crypto'} · ${alert.score}/100 · $${alert.price} ` +
		`(${alert.changePct >= 0 ? '+' : ''}${alert.changePct.toFixed(1)}%) · ${alert.why}`;
	if (alert.ai) body += ` · ${alert.ai}`;
	const payload = JSON.stringify({
		title: `🚀 ${alert.sym} — ${alert.tag}`,
		body: body.slice(0, 220),
	});
	for (const sub of [...subscriptions]) {
		sendNotification(sub, payload, vapid)
			.then(r => {
				// 404/410 mean the subscription is dead — prune it.
				if (r.status === 404 || r.status === 410) {
					subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
					saveSubs();
				}
			})
			.catch(() => {});
	}
}

function pushText(title, body) {
	if (!PUSH_ON || !vapid || subscriptions.length === 0) return;
	const payload = JSON.stringify({title, body: String(body).slice(0, 220)});
	for (const sub of [...subscriptions]) {
		sendNotification(sub, payload, vapid).catch(() => {});
	}
}

async function deliverAlert(alert) {
	if (aiConfig().enabled) {
		const enriched = await enrichAlert(alert, snapshot);
		if (enriched.ok && enriched.text) alert.ai = enriched.text;
	}

	pushToAll(alert);
	dispatchWebhooks(alert);
}

// --- Real-time alert engine -------------------------------------------------
// Fire an alert when a symbol crosses into a high-conviction state. Cooldown
// prevents spamming the same idea; the PWA turns these into phone notifications.
const ALERT_COOLDOWN_MS = Number(process.env.ALPHA_ALERT_COOLDOWN_MS || 30 * 60_000);
const ALERT_IGNITION = Number(process.env.ALPHA_ALERT_IGNITION || 70);
const ALERT_BUY = Number(process.env.ALPHA_ALERT_BUY || 72);
const alerts = []; // newest-last, capped
const lastFired = new Map(); // key -> ts
let alertSeq = 0;

function consider(kind, rows) {
	const now = Date.now();
	for (const s of rows) {
		const tag = verdict(s)[0];
		const hot =
			(s.explosionScore >= ALERT_IGNITION && 'IGNITION') ||
			(s.buyScore >= ALERT_BUY && 'STRONG BUY') ||
			null;
		if (!hot) continue;
		const key = `${kind}:${s.base}:${hot}`;
		if (now - (lastFired.get(key) || 0) < ALERT_COOLDOWN_MS) continue;
		lastFired.set(key, now);
		const alert = {
			id: ++alertSeq,
			kind,
			sym: s.base,
			tag: hot,
			score: hot === 'IGNITION' ? s.explosionScore : s.buyScore,
			price: s.last,
			changePct: s.changePct24h,
			why: verdict(s)[1],
			ts: now,
		};
		alerts.push(alert);
		if (alerts.length > 50) alerts.shift();
		digestAlertIds.add(alert.id);
		// Enrich + fan-out async so the scan loop never waits on vLLM.
		deliverAlert(alert).catch(() => {});
	}
}

function maybeBriefing(snap) {
	if (!aiConfig().enabled) return;
	if (!snapshotChanged(lastBriefingFp, snap)) return;
	const fp = snapshotFingerprint(snap);
	briefing(snap).then(result => {
		if (result.ok && result.text) {
			lastBriefingFp = fp;
			briefingText = {text: result.text, ts: Date.now(), cached: Boolean(result.cached)};
		}
	}).catch(() => {});
}

async function runDigest() {
	if (!DIGEST_MS || !aiConfig().enabled) return;
	const recent = alerts.filter(a => a.ts >= digestSince && digestAlertIds.has(a.id));
	const regime = snapshot?.regime;
	// Only spend GPU when there is something to say (or regime exists after warmup).
	if (!regime && recent.length === 0) return;
	const result = await digest({regime, alerts: recent, bar: BAR});
	digestSince = Date.now();
	digestAlertIds.clear();
	if (!result.ok || !result.text) return;
	pushText('▲ Alpha — while you were away', result.text);
	dispatchText(result.text, {title: '▲ Alpha — while you were away'});
}

async function refresh() {
	try {
		snapshot = await scan({bar: BAR, top: TOP});
		lastError = null;
		consider('crypto', [...snapshot.booms, ...snapshot.buys]);
		maybeBriefing(snapshot);
	} catch (error) {
		lastError = error.message;
	}
}

async function refreshStocks() {
	if (!STOCKS_ON) return;
	try {
		stocks = await scanStocks();
		consider('stock', [...stocks.booms, ...stocks.buys]);
	} catch {
		/* keep last stock snapshot on transient error */
	}
}

// Slim payload for the wire (drop the heavy closes array except a sparkline).
function slim(s) {
	return {
		base: s.base, last: s.last, changePct24h: s.changePct24h,
		rsi: s.rsi, volZ: s.volZ, atrPct: s.atrPct,
		buyScore: s.buyScore, explosionScore: s.explosionScore,
		stop: s.stop, target1: s.target1, target2: s.target2,
		volUsd24h: s.volUsd24h, tag: verdict(s)[0], why: verdict(s)[1],
		spark: (s.closes || []).slice(-30),
	};
}

function payload() {
	if (!snapshot) return {ready: false, error: lastError};
	return {
		ready: true,
		ts: snapshot.ts,
		bar: snapshot.bar,
		regime: snapshot.regime,
		focus: snapshot.focus ? slim(snapshot.focus) : null,
		booms: snapshot.booms.slice(0, 12).map(slim),
		buys: snapshot.buys.slice(0, 12).map(slim),
		markets: snapshot.tickers.length,
		ai: aiConfig().enabled
			? {
				...(briefingText || {text: 'generating…', ts: 0}),
				status: aiStatus(),
			}
			: {status: aiStatus()},
		stocks: stocks ? {
			marketState: stocks.marketState,
			ts: stocks.ts,
			movers: stocks.movers.slice(0, 12).map(slim),
			booms: stocks.booms.slice(0, 8).map(slim),
		} : (STOCKS_ON ? {pending: true} : null),
		alerts: alerts.slice(-12).reverse(),
		error: lastError,
	};
}

// Small static assets for the installable PWA, read from disk once at boot.
const here = new URL('.', import.meta.url);
const readBin = p => {
	try {
		return readFileSync(new URL(p, here));
	} catch {
		return null;
	}
};

const ASSETS = {
	'/manifest.webmanifest': {body: readBin('manifest.webmanifest'), type: 'application/manifest+json'},
	'/sw.js': {body: readBin('sw.js'), type: 'text/javascript'},
	'/icons/icon-192.png': {body: readBin('icons/icon-192.png'), type: 'image/png'},
	'/icons/icon-512.png': {body: readBin('icons/icon-512.png'), type: 'image/png'},
};

function readBody(req, limit = 100_000) {
	return new Promise((resolve, reject) => {
		let data = '';
		req.on('data', c => {
			data += c;
			if (data.length > limit) {
				reject(new Error('body too large'));
				req.destroy();
			}
		});
		req.on('end', () => {
			try {
				resolve(data ? JSON.parse(data) : null);
			} catch (error) {
				reject(error);
			}
		});
		req.on('error', reject);
	});
}

const server = http.createServer((req, res) => {
	const path = req.url.split('?')[0];

	if (path === '/api/signals') {
		res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
		res.end(JSON.stringify(payload()));
		return;
	}

	if (path === '/api/alerts') {
		res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
		res.end(JSON.stringify({alerts: alerts.slice(-50).reverse()}));
		return;
	}

	if (path === '/api/coin') {
		const sym = (req.url.split('?')[1] || '').match(/sym=([A-Za-z0-9]+)/)?.[1];
		const instId = sym ? `${sym.toUpperCase()}-USDT` : null;
		if (!instId) {
			res.writeHead(400);
			res.end('{"error":"sym required"}');
			return;
		}

		getCandles(instId, BAR, 120)
			.then(candles => {
				const t = snapshot?.tickers.find(x => x.instId === instId);
				const s = analyze(instId, t || {volUsd24h: 1e9, changePct24h: 0}, candles);
				if (!s) {
					res.writeHead(404);
					res.end('{"error":"no data"}');
					return;
				}

				res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
				res.end(JSON.stringify({
					sym: s.base, last: s.last, bar: BAR,
					changePct24h: s.changePct24h, rsi: s.rsi, atrPct: s.atrPct,
					roc5: s.roc5, roc15: s.roc15, roc30: s.roc30, volZ: s.volZ,
					macd: s.macd, slope: s.slope, trendUp: s.trendUp, squeeze: s.squeeze,
					buyScore: s.buyScore, explosionScore: s.explosionScore,
					stop: s.stop, target1: s.target1, target2: s.target2,
					volUsd24h: s.volUsd24h, verdict: verdict(s),
					closes: s.closes.slice(-90),
				}));
			})
			.catch(error => {
				res.writeHead(502);
				res.end(JSON.stringify({error: error.message}));
			});
		return;
	}

	if (path === '/api/vapidPublicKey') {
		res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
		res.end(JSON.stringify({key: PUSH_ON && vapid ? vapid.publicKey : null}));
		return;
	}

	if (path === '/api/subscribe' && req.method === 'POST') {
		readBody(req).then(sub => {
			if (sub && sub.endpoint) {
				if (!subscriptions.some(s => s.endpoint === sub.endpoint)) {
					subscriptions.push(sub);
					saveSubs();
				}

				res.writeHead(201, {'content-type': 'application/json'});
				res.end(JSON.stringify({ok: true, count: subscriptions.length}));
			} else {
				res.writeHead(400);
				res.end('{"ok":false}');
			}
		}).catch(() => {
			res.writeHead(400);
			res.end('{"ok":false}');
		});
		return;
	}

	if (path === '/api/unsubscribe' && req.method === 'POST') {
		readBody(req).then(sub => {
			subscriptions = subscriptions.filter(s => s.endpoint !== sub?.endpoint);
			saveSubs();
			res.writeHead(200, {'content-type': 'application/json'});
			res.end(JSON.stringify({ok: true}));
		}).catch(() => {
			res.writeHead(400);
			res.end('{"ok":false}');
		});
		return;
	}

	if (path === '/healthz') {
		res.writeHead(200, {'content-type': 'text/plain'});
		res.end('ok');
		return;
	}

	const asset = ASSETS[path];
	if (asset && asset.body) {
		res.writeHead(200, {'content-type': asset.type, 'cache-control': 'public, max-age=86400'});
		res.end(asset.body);
		return;
	}

	res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
	res.end(PAGE);
});

if (PUSH_ON) loadPush();

server.listen(PORT, () => {
	const cfg = aiConfig();
	process.stdout.write(
		`\n ▲ ALPHA TERMINAL web dashboard\n` +
		`   local:   http://localhost:${PORT}\n` +
		`   network: http://<your-ip>:${PORT}   (open this on your phone)\n` +
		`   AI desk: ${cfg.enabled ? 'vllm (' + cfg.model + ') @ ' + cfg.url : 'off'}\n` +
		`   AI digest: ${DIGEST_MS ? (DIGEST_MS / 60_000) + 'm' : 'off'}\n` +
		`   phone push: ${PUSH_ON ? 'on (' + subscriptions.length + ' subscribed)' : 'off'}\n` +
		`   webhooks: ${webhooksEnabled() ? 'on' : 'off'}\n` +
		`   refreshing every ${REFRESH_MS / 1000}s · ${BAR} bars\n\n`,
	);
	if (cfg.enabled) aiHealth().catch(() => {});
	refresh();
	setInterval(refresh, REFRESH_MS);
	refreshStocks();
	setInterval(refreshStocks, STOCKS_MS);
	if (DIGEST_MS > 0) setInterval(() => {
		runDigest().catch(() => {});
	}, DIGEST_MS);
});

// ---------------------------------------------------------------------------
// Self-contained dashboard page (dark, mobile-first, auto-refreshing).
// ---------------------------------------------------------------------------
const PAGE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0e14">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Alpha">
<title>▲ Alpha Terminal</title>
<style>
:root{--bg:#0a0e14;--panel:#111722;--line:#1e2633;--dim:#5b6b80;--txt:#d6e1f0;--green:#3ddc84;--lime:#76ff7a;--red:#ff5d6c;--mag:#ff79e1;--cyan:#54d6ff;--yel:#ffd166;--orange:#ff9e57}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-text-size-adjust:100%}
header{position:sticky;top:0;background:linear-gradient(180deg,#0a0e14,#0a0e14ee);backdrop-filter:blur(6px);padding:12px 14px;border-bottom:1px solid var(--line);z-index:5}
h1{margin:0;font-size:16px;letter-spacing:.5px}.cyan{color:var(--cyan)}.dim{color:var(--dim)}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-top:6px}
.pill{padding:2px 8px;border:1px solid var(--line);border-radius:999px;font-size:12px}
main{padding:12px 14px;max-width:1100px;margin:0 auto}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0}
.panel h2{margin:0 0 8px;font-size:14px;letter-spacing:.5px}
.focus{border-color:#2a3a55;background:linear-gradient(180deg,#111d2e,#0e1622)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{ text-align:right;color:var(--dim);font-weight:500;padding:4px 6px;border-bottom:1px solid var(--line)}
th:first-child,td:first-child{text-align:left}
td{padding:6px;border-bottom:1px solid #161d29;white-space:nowrap}
.sym{font-weight:700}
.tag{font-size:11px;padding:1px 7px;border-radius:6px;border:1px solid currentColor}
.up{color:var(--green)}.down{color:var(--red)}
.meter{display:inline-block;height:7px;width:60px;background:#1b2433;border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:6px}
.meter>i{display:block;height:100%}
.spark{font-size:11px;letter-spacing:-1px}
.brief{white-space:pre-wrap;color:#cbd6e6;font-size:13px}
.foot{color:var(--dim);font-size:12px;padding:8px 14px 28px;text-align:center}
.live{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:p 1.6s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
@media(max-width:560px){.hideSm{display:none}td,th{padding:5px 4px}}
.bell{float:right;background:#16202e;color:var(--yel);border:1px solid var(--line);border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}
.bell.on{color:#0a0e14;background:var(--yel);border-color:var(--yel);font-weight:700}
.alertsPanel{border-color:#3a3320;background:linear-gradient(180deg,#1b1708,#12100a)}
.alert{display:flex;gap:10px;align-items:center;padding:6px 4px;border-bottom:1px solid #211c10}
.alert .b{font-weight:700;min-width:64px}
.alert .k{font-size:10px;color:var(--dim);border:1px solid var(--line);border-radius:5px;padding:0 5px}
tr.tap{cursor:pointer}tr.tap:hover td{background:#16202e}
.modal{position:fixed;inset:0;background:#0008;backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:60;padding:14px}
.modal.show{display:flex}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;max-width:540px;width:100%;padding:16px;max-height:90vh;overflow:auto}
.card h3{margin:0 0 2px;font-size:18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin:10px 0;font-size:13px}
.grid .k{color:var(--dim)}
.chart{display:block;width:100%;height:90px;margin:8px 0;background:#0c121c;border-radius:8px}
.x{float:right;cursor:pointer;color:var(--dim);font-size:20px;line-height:1}
.flash{position:fixed;inset:0;pointer-events:none;background:var(--mag);opacity:0;transition:opacity .12s;z-index:50}
.flash.go{opacity:.18}
@keyframes blink{50%{opacity:.4}}
.bell.on{animation:none}
</style></head><body>
<header>
  <h1>▲ <span class="cyan">ALPHA TERMINAL</span> <span class="dim hideSm">live momentum desk</span>
    <button id="bell" class="bell" title="Enable phone alerts">🔔 Alerts</button>
  </h1>
  <div class="row" id="topbar"><span class="dim">connecting…</span></div>
</header>
<div id="flash" class="flash"></div>
<main>
  <div class="panel alertsPanel" id="alertsWrap" style="display:none"><h2 style="color:var(--yel)">🔔 LIVE ALERTS</h2><div id="alerts"></div></div>
  <div class="panel focus" id="focusWrap" style="display:none"><h2 id="focusTitle"></h2><div id="focus"></div></div>
  <div class="panel" id="aiWrap" style="display:none"><h2>🧠 AI Desk Briefing <span class="dim" id="aiMeta"></span> <span class="pill" id="aiState" style="display:none"></span></h2><div class="brief" id="brief"></div></div>
  <div class="panel"><h2 style="color:var(--mag)">🚀 ABOUT TO EXPLODE <span class="dim">volume + squeeze pre-breakout</span></h2><div id="booms"></div></div>
  <div class="panel"><h2 style="color:var(--lime)">📈 BUY NOW <span class="dim">confirmed momentum</span></h2><div id="buys"></div></div>
  <div class="panel" id="stocksWrap" style="display:none"><h2 style="color:var(--cyan)">📊 STOCKS MOVING <span class="dim" id="stkState"></span></h2><div id="stocks"></div></div>
</main>
<div class="modal" id="modal"><div class="card" id="card"></div></div>
<div class="foot"><span class="live"></span> auto-updating · <span id="age"></span> · signals are probabilistic — <b>NOT financial advice</b></div>
<script>
const SPARK='▁▂▃▄▅▆▇█';
const fmtP=n=>n==null?'—':n>=1000?Math.round(n).toLocaleString():n>=1?n.toFixed(2):n>=0.01?n.toFixed(4):n.toPrecision(3);
const pct=n=>n==null?'—':'<span class="'+(n>=0?'up':'down')+'">'+(n>=0?'+':'')+n.toFixed(2)+'%</span>';
const usd=n=>!n?'—':n>=1e9?'$'+(n/1e9).toFixed(1)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':'$'+(n/1e3).toFixed(0)+'K';
function spark(a){if(!a||!a.length)return'';const mn=Math.min(...a),mx=Math.max(...a),r=(mx-mn)||1;const up=a[a.length-1]>=a[0];return '<span class="spark '+(up?'up':'down')+'">'+a.map(v=>SPARK[Math.round((v-mn)/r*7)]).join('')+'</span>';}
const tagColor=t=>({IGNITION:'var(--mag)','STRONG BUY':'var(--lime)',BUY:'var(--green)',COILING:'var(--cyan)',ACCUMULATE:'var(--yel)',OVEREXTENDED:'var(--orange)'}[t]||'var(--dim)');
function meter(s){const c=s>=70?'var(--lime)':s>=50?'var(--yel)':s>=30?'var(--orange)':'var(--dim)';return '<span class="meter"><i style="width:'+s+'%;background:'+c+'"></i></span>'+s;}
function rows(list,key,tap){if(!list||!list.length)return '<div class="dim">— nothing clears the threshold right now —</div>';
  let h='<table><thead><tr><th>SYM</th><th>PRICE</th><th>24h</th><th class="hideSm">RSI</th><th class="hideSm">VOLσ</th><th>SCORE</th><th>SIGNAL</th><th class="hideSm">TREND</th></tr></thead><tbody>';
  for(const s of list){h+='<tr'+(tap?' class="tap" data-sym="'+s.base+'"':'')+'><td class="sym">'+s.base+'</td><td>$'+fmtP(s.last)+'</td><td>'+pct(s.changePct24h)+'</td>'+
    '<td class="hideSm">'+(s.rsi==null?'—':s.rsi.toFixed(0))+'</td><td class="hideSm">'+(s.volZ==null?'—':s.volZ.toFixed(1))+'</td>'+
    '<td>'+meter(s[key])+'</td><td><span class="tag" style="color:'+tagColor(s.tag)+'">'+s.tag+'</span></td>'+
    '<td class="hideSm">'+spark(s.spark)+'</td></tr>';}
  return h+'</tbody></table>';}
function focusCard(f){if(!f)return '';
  return '<div style="font-size:15px"><b>'+f.base+'/USDT</b> <span class="tag" style="color:'+tagColor(f.tag)+'">'+f.tag+'</span> <span class="dim">'+f.why+'</span></div>'+
  '<div class="row" style="margin-top:6px"><span>entry <b>$'+fmtP(f.last)+'</b></span><span class="down">stop $'+fmtP(f.stop)+'</span>'+
  '<span class="up">tgt1 $'+fmtP(f.target1)+'</span><span class="up">tgt2 $'+fmtP(f.target2)+'</span><span class="dim">vol '+usd(f.volUsd24h)+'</span></div>';}
const regColor=s=>s>=60?'var(--lime)':s>=45?'var(--yel)':s>=30?'var(--orange)':'var(--red)';
let lastTs=0,seenAlert=0,alertsOn=localStorage.getItem('alertsOn')==='1';
const bell=document.getElementById('bell');
function paintBell(){bell.className='bell'+(alertsOn?' on':'');bell.textContent=alertsOn?'🔔 On':'🔔 Alerts';}
paintBell();
function u8(b64){const p='='.repeat((4-b64.length%4)%4);const s=(b64+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
async function subscribePush(){
  try{
    const reg=await navigator.serviceWorker?.ready;if(!reg||!reg.pushManager)return;
    const {key}=await (await fetch('/api/vapidPublicKey')).json();if(!key)return;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(key)});
    await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sub)});
  }catch(e){/* push optional; in-app notifications still work */}
}
bell.onclick=async()=>{
  if(!alertsOn){
    if('Notification'in window && Notification.permission!=='granted'){try{await Notification.requestPermission();}catch(e){}}
    alertsOn=true;localStorage.setItem('alertsOn','1');beep();subscribePush();
  }else{alertsOn=false;localStorage.setItem('alertsOn','0');}
  paintBell();
};
if(alertsOn&&'Notification'in window&&Notification.permission==='granted')subscribePush();
let actx;
function beep(){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.connect(g);g.connect(actx.destination);o.type='triangle';o.frequency.value=880;g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(.25,actx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.5);o.start();o.stop(actx.currentTime+.5);o.frequency.setValueAtTime(1320,actx.currentTime+.18);}catch(e){}}
function flash(){const f=document.getElementById('flash');f.classList.add('go');setTimeout(()=>f.classList.remove('go'),160);}
async function notify(a){
  const title='🚀 '+a.sym+' — '+a.tag;
  const body=(a.kind==='stock'?'Stock':'Crypto')+' · '+(a.score)+'/100 · $'+fmtP(a.price)+' ('+(a.changePct>=0?'+':'')+a.changePct.toFixed(1)+'%) · '+a.why;
  try{const reg=await navigator.serviceWorker?.ready;if(reg&&reg.showNotification){reg.showNotification(title,{body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'alpha-'+a.id,renotify:true});return;}}catch(e){}
  try{if(Notification.permission==='granted')new Notification(title,{body,icon:'/icons/icon-192.png'});}catch(e){}
}
function renderAlerts(list){
  const w=document.getElementById('alertsWrap');
  if(!list||!list.length){w.style.display='none';return;}
  w.style.display='';
  document.getElementById('alerts').innerHTML=list.map(a=>{
    const c=a.tag==='IGNITION'?'var(--mag)':'var(--lime)';const ago=Math.max(0,Math.round((Date.now()-a.ts)/1000));
    return '<div class="alert"><span class="b" style="color:'+c+'">'+a.sym+'</span>'+
      '<span class="k">'+(a.kind==='stock'?'STK':'CRY')+'</span>'+
      '<span style="color:'+c+'">'+a.tag+'</span>'+
      '<span>'+a.score+'/100</span><span class="dim hideSm">$'+fmtP(a.price)+'</span>'+
      '<span style="margin-left:auto" class="dim">'+(ago<60?ago+'s':Math.round(ago/60)+'m')+' ago</span></div>';
  }).join('');
}
function handleAlerts(list){
  if(!list)return;renderAlerts(list);
  const fresh=list.filter(a=>a.id>seenAlert);
  if(seenAlert>0&&fresh.length&&alertsOn){fresh.slice(0,3).forEach(notify);beep();flash();}
  for(const a of list)if(a.id>seenAlert)seenAlert=a.id;
}
async function tick(){
  try{
    const d=await (await fetch('/api/signals',{cache:'no-store'})).json();
    if(!d.ready){document.getElementById('topbar').innerHTML='<span class="dim">warming up — first scan running…'+(d.error?(' ('+d.error+')'):'')+'</span>';return;}
    lastTs=d.ts;
    const r=d.regime;
    document.getElementById('topbar').innerHTML=
      '<span class="pill">REGIME <b style="color:'+regColor(r.score)+'">'+r.label+'</b> '+r.score+'/100</span>'+
      '<span class="pill">breadth '+r.advancers+'/'+r.total+'</span>'+
      '<span class="pill dim">'+d.bar+' bars · '+d.markets+' USDT mkts</span>';
    const fw=document.getElementById('focusWrap');
    if(d.focus){fw.style.display='';document.getElementById('focusTitle').innerHTML='★ TOP CONVICTION RIGHT NOW';document.getElementById('focus').innerHTML=focusCard(d.focus);}else fw.style.display='none';
    const aiWrap=document.getElementById('aiWrap');
    const aiSt=d.ai&&d.ai.status;
    if(d.ai&&(d.ai.text!=null||(aiSt&&aiSt.enabled))){
      aiWrap.style.display='';
      document.getElementById('brief').textContent=d.ai.text||(aiSt&&aiSt.state==='degraded'?'(vLLM unreachable — signals still live)':'generating…');
      document.getElementById('aiMeta').textContent=d.ai.ts?new Date(d.ai.ts).toLocaleTimeString():'';
      const pill=document.getElementById('aiState');
      if(aiSt){
        pill.style.display='inline';
        const st=aiSt.state||'off';
        pill.textContent='AI: '+st+(aiSt.lastLatencyMs!=null?' · '+aiSt.lastLatencyMs+'ms':'');
        pill.style.borderColor=st==='ok'?'var(--green)':st==='degraded'?'var(--orange)':'var(--line)';
        pill.style.color=st==='ok'?'var(--green)':st==='degraded'?'var(--orange)':'var(--dim)';
      }else pill.style.display='none';
    }else aiWrap.style.display='none';
    document.getElementById('booms').innerHTML=rows(d.booms,'explosionScore',true);
    document.getElementById('buys').innerHTML=rows(d.buys,'buyScore',true);
    const sw=document.getElementById('stocksWrap');
    if(d.stocks){sw.style.display='';
      document.getElementById('stkState').textContent=d.stocks.pending?'loading…':('market '+(d.stocks.marketState||'')+' · sorted by today’s move');
      document.getElementById('stocks').innerHTML=d.stocks.pending?'<div class="dim">fetching live equities…</div>':rows(d.stocks.movers,'buyScore');
    }else sw.style.display='none';
    handleAlerts(d.alerts);
  }catch(e){/* keep last frame on transient error */}
}
function ageTick(){if(lastTs)document.getElementById('age').textContent='updated '+Math.max(0,Math.round((Date.now()-lastTs)/1000))+'s ago';}
const modal=document.getElementById('modal');
function closeModal(){modal.classList.remove('show');}
modal.onclick=e=>{if(e.target===modal)closeModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
document.addEventListener('click',e=>{
  if(e.target.classList&&e.target.classList.contains('x')){closeModal();return;}
  const tr=e.target.closest&&e.target.closest('tr.tap');if(tr)openCoin(tr.dataset.sym);
});
function svgChart(a){if(!a||a.length<2)return'';const w=500,h=90,mn=Math.min(...a),mx=Math.max(...a),r=(mx-mn)||1;
  const pts=a.map((v,i)=>(i/(a.length-1)*w).toFixed(1)+','+(h-((v-mn)/r)*(h-8)-4).toFixed(1)).join(' ');
  const up=a[a.length-1]>=a[0];const col=up?'#3ddc84':'#ff5d6c';
  return '<svg class="chart" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><polyline fill="none" stroke="'+col+'" stroke-width="2" points="'+pts+'"/></svg>';}
async function openCoin(sym){
  const card=document.getElementById('card');
  card.innerHTML='<span class="x">×</span><h3>'+sym+'/USDT</h3><div class="dim">loading…</div>';
  modal.classList.add('show');
  try{
    const d=await(await fetch('/api/coin?sym='+encodeURIComponent(sym))).json();
    if(d.error){card.querySelector('.dim').textContent=d.error;return;}
    const v=d.verdict||['',''];const row=(k,val)=>'<div class="k">'+k+'</div><div>'+val+'</div>';
    card.innerHTML='<span class="x">×</span>'+
      '<h3>'+d.sym+'/USDT <span style="font-size:13px" class="dim">'+d.bar+'</span></h3>'+
      '<div>$'+fmtP(d.last)+' '+pct(d.changePct24h)+' &nbsp; <span class="tag" style="color:'+tagColor(v[0])+'">'+v[0]+'</span> <span class="dim">'+v[1]+'</span></div>'+
      svgChart(d.closes)+
      '<div class="grid">'+
        row('Buy score',meter(d.buyScore))+row('Explosion',meter(d.explosionScore))+
        row('RSI(14)',d.rsi==null?'—':d.rsi.toFixed(1))+row('ATR %',d.atrPct==null?'—':d.atrPct.toFixed(2)+'%')+
        row('Volume σ',d.volZ==null?'—':d.volZ.toFixed(2))+row('Squeeze',d.squeeze==null?'—':d.squeeze.toFixed(0)+'/100')+
        row('MACD hist',d.macd==null?'—':d.macd.toFixed(4))+row('Trend',d.trendUp?'<span class="up">EMA up</span>':'<span class="down">EMA down</span>')+
        row('ROC 5/15/30',[d.roc5,d.roc15,d.roc30].map(x=>x==null?'—':x.toFixed(1)+'%').join(' / '))+row('24h vol',usd(d.volUsd24h))+
      '</div>'+
      '<div class="row"><span>entry <b>$'+fmtP(d.last)+'</b></span><span class="down">stop $'+fmtP(d.stop)+'</span><span class="up">tgt1 $'+fmtP(d.target1)+'</span><span class="up">tgt2 $'+fmtP(d.target2)+'</span></div>'+
      '<div class="dim" style="margin-top:8px;font-size:12px">probabilistic signal — not financial advice</div>';
  }catch(e){card.querySelector('.dim')&&(card.querySelector('.dim').textContent='failed to load');}
}
tick();setInterval(tick,4000);setInterval(ageTick,1000);
if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
</script></body></html>`;
