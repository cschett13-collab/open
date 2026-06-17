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
import {scan} from './lib/engine.js';
import {verdict} from './lib/signals.js';
import {briefing, aiConfig} from './lib/ai.js';

const PORT = Number(process.env.PORT || 8787);
const BAR = process.env.ALPHA_BAR || '5m';
const TOP = Number(process.env.ALPHA_TOP || 60);
const REFRESH_MS = Number(process.env.ALPHA_REFRESH_MS || 15_000);

let snapshot = null;
let briefingText = null;
let lastError = null;

async function refresh() {
	try {
		snapshot = await scan({bar: BAR, top: TOP});
		lastError = null;
		if (aiConfig().enabled) {
			briefing(snapshot).then(text => {
				if (text) briefingText = {text, ts: Date.now()};
			});
		}
	} catch (error) {
		lastError = error.message;
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
		ai: aiConfig().enabled ? (briefingText || {text: 'generating…', ts: 0}) : null,
		error: lastError,
	};
}

const server = http.createServer((req, res) => {
	if (req.url === '/api/signals') {
		res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
		res.end(JSON.stringify(payload()));
		return;
	}

	if (req.url === '/healthz') {
		res.writeHead(200, {'content-type': 'text/plain'});
		res.end('ok');
		return;
	}

	res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
	res.end(PAGE);
});

server.listen(PORT, () => {
	process.stdout.write(
		`\n ▲ ALPHA TERMINAL web dashboard\n` +
		`   local:   http://localhost:${PORT}\n` +
		`   network: http://<your-ip>:${PORT}   (open this on your phone)\n` +
		`   AI briefing: ${aiConfig().enabled ? aiConfig().mode + ' (' + aiConfig().model + ')' : 'off'}\n` +
		`   refreshing every ${REFRESH_MS / 1000}s · ${BAR} bars\n\n`,
	);
	refresh();
	setInterval(refresh, REFRESH_MS);
});

// ---------------------------------------------------------------------------
// Self-contained dashboard page (dark, mobile-first, auto-refreshing).
// ---------------------------------------------------------------------------
const PAGE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="theme-color" content="#0a0e14">
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
</style></head><body>
<header>
  <h1>▲ <span class="cyan">ALPHA TERMINAL</span> <span class="dim">live crypto momentum desk</span></h1>
  <div class="row" id="topbar"><span class="dim">connecting…</span></div>
</header>
<main>
  <div class="panel focus" id="focusWrap" style="display:none"><h2 id="focusTitle"></h2><div id="focus"></div></div>
  <div class="panel" id="aiWrap" style="display:none"><h2>🧠 AI Desk Briefing <span class="dim" id="aiMeta"></span></h2><div class="brief" id="brief"></div></div>
  <div class="panel"><h2 style="color:var(--mag)">🚀 ABOUT TO EXPLODE <span class="dim">volume + squeeze pre-breakout</span></h2><div id="booms"></div></div>
  <div class="panel"><h2 style="color:var(--lime)">📈 BUY NOW <span class="dim">confirmed momentum</span></h2><div id="buys"></div></div>
</main>
<div class="foot"><span class="live"></span> auto-updating · <span id="age"></span> · signals are probabilistic — <b>NOT financial advice</b></div>
<script>
const SPARK='▁▂▃▄▅▆▇█';
const fmtP=n=>n==null?'—':n>=1000?Math.round(n).toLocaleString():n>=1?n.toFixed(2):n>=0.01?n.toFixed(4):n.toPrecision(3);
const pct=n=>n==null?'—':'<span class="'+(n>=0?'up':'down')+'">'+(n>=0?'+':'')+n.toFixed(2)+'%</span>';
const usd=n=>!n?'—':n>=1e9?'$'+(n/1e9).toFixed(1)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':'$'+(n/1e3).toFixed(0)+'K';
function spark(a){if(!a||!a.length)return'';const mn=Math.min(...a),mx=Math.max(...a),r=(mx-mn)||1;const up=a[a.length-1]>=a[0];return '<span class="spark '+(up?'up':'down')+'">'+a.map(v=>SPARK[Math.round((v-mn)/r*7)]).join('')+'</span>';}
const tagColor=t=>({IGNITION:'var(--mag)','STRONG BUY':'var(--lime)',BUY:'var(--green)',COILING:'var(--cyan)',ACCUMULATE:'var(--yel)',OVEREXTENDED:'var(--orange)'}[t]||'var(--dim)');
function meter(s){const c=s>=70?'var(--lime)':s>=50?'var(--yel)':s>=30?'var(--orange)':'var(--dim)';return '<span class="meter"><i style="width:'+s+'%;background:'+c+'"></i></span>'+s;}
function rows(list,key){if(!list||!list.length)return '<div class="dim">— nothing clears the threshold right now —</div>';
  let h='<table><thead><tr><th>SYM</th><th>PRICE</th><th>24h</th><th class="hideSm">RSI</th><th class="hideSm">VOLσ</th><th>SCORE</th><th>SIGNAL</th><th class="hideSm">TREND</th></tr></thead><tbody>';
  for(const s of list){h+='<tr><td class="sym">'+s.base+'</td><td>$'+fmtP(s.last)+'</td><td>'+pct(s.changePct24h)+'</td>'+
    '<td class="hideSm">'+(s.rsi==null?'—':s.rsi.toFixed(0))+'</td><td class="hideSm">'+(s.volZ==null?'—':s.volZ.toFixed(1))+'</td>'+
    '<td>'+meter(s[key])+'</td><td><span class="tag" style="color:'+tagColor(s.tag)+'">'+s.tag+'</span></td>'+
    '<td class="hideSm">'+spark(s.spark)+'</td></tr>';}
  return h+'</tbody></table>';}
function focusCard(f){if(!f)return '';
  return '<div style="font-size:15px"><b>'+f.base+'/USDT</b> <span class="tag" style="color:'+tagColor(f.tag)+'">'+f.tag+'</span> <span class="dim">'+f.why+'</span></div>'+
  '<div class="row" style="margin-top:6px"><span>entry <b>$'+fmtP(f.last)+'</b></span><span class="down">stop $'+fmtP(f.stop)+'</span>'+
  '<span class="up">tgt1 $'+fmtP(f.target1)+'</span><span class="up">tgt2 $'+fmtP(f.target2)+'</span><span class="dim">vol '+usd(f.volUsd24h)+'</span></div>';}
const regColor=s=>s>=60?'var(--lime)':s>=45?'var(--yel)':s>=30?'var(--orange)':'var(--red)';
let lastTs=0;
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
    if(d.ai){document.getElementById('aiWrap').style.display='';document.getElementById('brief').textContent=d.ai.text;document.getElementById('aiMeta').textContent=d.ai.ts?new Date(d.ai.ts).toLocaleTimeString():'';}
    document.getElementById('booms').innerHTML=rows(d.booms,'explosionScore');
    document.getElementById('buys').innerHTML=rows(d.buys,'buyScore');
  }catch(e){/* keep last frame on transient error */}
}
function ageTick(){if(lastTs)document.getElementById('age').textContent='updated '+Math.max(0,Math.round((Date.now()-lastTs)/1000))+'s ago';}
tick();setInterval(tick,4000);setInterval(ageTick,1000);
</script></body></html>`;
