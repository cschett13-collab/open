#!/usr/bin/env node
// ============================================================================
//  ALPHA TERMINAL — live crypto momentum & breakout scanner
//  "Your quant desk in the terminal."  Data: OKX public API (no key needed).
//
//  Two loops run independently so the screen always feels live:
//   • FAST loop  (~1.5s): one bulk ticker request -> live prices, tape, regime.
//   • DEEP loop  (rotating): pulls candles for the most liquid markets and
//                runs the signal engine to rank BUY-NOW and ABOUT-TO-EXPLODE.
//
//  NOT FINANCIAL ADVICE. These are probabilistic signals from real price/volume
//  structure, not predictions of the future. Crypto can go to zero. Risk only
//  what you can afford to lose. See README.md.
// ============================================================================

import process from 'node:process';
import {getAllSpotTickers, getCandles, pool} from './lib/okx.js';
import {analyze, verdict, marketRegime} from './lib/signals.js';
import * as R from './lib/render.js';
import {c, color} from './lib/render.js';

const FAST_MS = 1500; // live price / tape refresh
const DEEP_REFRESH_MS = 20_000; // full re-scan cadence
const TOP_LIQUID = 60; // how many liquid USDT markets to deep-scan
const BAR = process.env.ALPHA_BAR || '5m'; // candle timeframe for signals

const state = {
	tickers: [],
	tickerMap: new Map(),
	regime: {label: '…', score: 50},
	analyses: [], // sorted signal rows
	lastDeep: 0,
	deepRunning: false,
	scanned: 0,
	scanTotal: 0,
	frame: 0,
	tapeOffset: 0,
	status: 'starting…',
	error: undefined,
	startedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// Data loops
// ---------------------------------------------------------------------------

async function fastTick() {
	try {
		const tickers = await getAllSpotTickers();
		// Focus the universe on USDT spot markets — the tradable, liquid core.
		const usdt = tickers.filter(t => t.quote === 'USDT' && t.last > 0);
		state.tickers = usdt;
		state.tickerMap = new Map(usdt.map(t => [t.instId, t]));
		state.regime = marketRegime(usdt);
		state.error = undefined;
	} catch (error) {
		state.error = `feed: ${error.message}`;
	}
}

async function deepScan() {
	if (state.deepRunning || state.tickers.length === 0) return;
	state.deepRunning = true;
	try {
		const universe = [...state.tickers]
			.filter(t => t.volUsd24h > 2_000_000)
			.sort((a, b) => b.volUsd24h - a.volUsd24h)
			.slice(0, TOP_LIQUID);

		state.scanTotal = universe.length;
		state.scanned = 0;

		const rows = await pool(
			universe,
			async t => {
				const candles = await getCandles(t.instId, BAR, 120);
				state.scanned++;
				state.status = `scanning ${state.scanned}/${state.scanTotal}  ${t.base}`;
				return analyze(t.instId, state.tickerMap.get(t.instId) ?? t, candles);
			},
			6,
		);

		state.analyses = rows.filter(Boolean);
		state.lastDeep = Date.now();
		state.status = 'live';
	} catch (error) {
		state.error = `scan: ${error.message}`;
	} finally {
		state.deepRunning = false;
	}
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function topBy(key, n, extraFilter = () => true) {
	return [...state.analyses]
		.filter(extraFilter)
		.sort((a, b) => b[key] - a[key])
		.slice(0, n);
}

function regimeColor(score) {
	if (score >= 60) return c.lime;
	if (score >= 45) return c.yellow;
	if (score >= 30) return c.orange;
	return c.red;
}

function header(width) {
	const now = new Date().toLocaleTimeString('en-US', {hour12: false});
	const spin = '⣾⣽⣻⢿⡿⣟⣯⣷'[state.frame % 8];
	const btc = state.tickerMap.get('BTC-USDT');
	const eth = state.tickerMap.get('ETH-USDT');
	const title = color(' ▲ ALPHA TERMINAL ', c.bold + c.cyan);
	const sub = color('live crypto momentum desk', c.gray);

	const btcStr = btc
		? `${color('BTC', c.orange)} $${R.fmtPrice(btc.last)} ${R.fmtPct(btc.changePct24h)}`
		: '';
	const ethStr = eth
		? `${color('ETH', c.blue)} $${R.fmtPrice(eth.last)} ${R.fmtPct(eth.changePct24h)}`
		: '';

	const reg = state.regime;
	const regStr = `${color('REGIME', c.gray)} ${color(reg.label, regimeColor(reg.score))} ${color(`${reg.score}/100`, c.dim)}`;

	const left = `${title} ${sub}`;
	const right = `${color(spin, c.cyan)} ${color(now, c.white)}`;
	const line1 = R.pad(left, width - R.pad(right, 0).length - 12) + right;
	const line2 = `  ${btcStr}   ${ethStr}   ${regStr}   ${color(`adv ${reg.advancers}/${reg.total}`, c.dim)}`;
	return `${line1}\n${line2}`;
}

function tradePanel(title, rows, scoreKey, width, accent) {
	const lines = [];
	lines.push(color(`${title}`, c.bold + accent));
	lines.push(R.rule(width));
	const head =
		'  ' +
		R.pad(color('SYM', c.gray), 12) +
		R.pad(color('PRICE', c.gray), 13) +
		R.pad(color('24h', c.gray), 9) +
		R.pad(color('RSI', c.gray), 6) +
		R.pad(color('VOLσ', c.gray), 7) +
		R.pad(color('SCORE', c.gray), 13) +
		R.pad(color('SIGNAL', c.gray), 14) +
		color('TREND', c.gray);
	lines.push(head);

	if (rows.length === 0) {
		lines.push(color('   warming up — running first scan…', c.dim));
		return lines;
	}

	for (const s of rows) {
		const [tag] = verdict(s);
		const tagColor =
			tag === 'IGNITION' ? c.magenta :
			tag === 'STRONG BUY' ? c.lime :
			tag === 'BUY' ? c.green :
			tag === 'COILING' ? c.cyan :
			tag === 'ACCUMULATE' ? c.yellow :
			tag === 'OVEREXTENDED' ? c.orange : c.gray;
		const rsiVal = s.rsi === undefined ? '—' : s.rsi.toFixed(0);
		const rsiColor = (s.rsi ?? 50) > 72 ? c.orange : (s.rsi ?? 50) < 35 ? c.blue : c.white;
		const volZ = s.volZ === undefined ? '—' : s.volZ.toFixed(1);
		const volColor = (s.volZ ?? 0) > 2 ? c.lime : c.gray;
		const score = s[scoreKey];

		lines.push(
			'  ' +
			R.pad(color(s.base, c.bold + c.white), 12) +
			R.pad(`$${R.fmtPrice(s.last)}`, 13) +
			R.pad(R.fmtPct(s.changePct24h), 9) +
			R.pad(color(rsiVal, rsiColor), 6) +
			R.pad(color(volZ, volColor), 7) +
			R.pad(`${R.meter(score, 8)} ${color(String(score).padStart(3), c.white)}`, 13) +
			R.pad(color(tag, tagColor), 14) +
			R.sparkline(s.closes, 16),
		);
	}

	return lines;
}

function focusCard(width) {
	// Pick the single highest-conviction actionable idea right now.
	const best =
		topBy('explosionScore', 1, s => s.explosionScore >= 60)[0] ||
		topBy('buyScore', 1, s => s.buyScore >= 60)[0];
	if (!best) return [color('  No high-conviction setup at this moment. Patience pays.', c.dim)];

	const [tag, why] = verdict(best);
	const isBoom = best.explosionScore >= best.buyScore;
	const score = isBoom ? best.explosionScore : best.buyScore;
	const accent = isBoom ? c.magenta : c.lime;

	const lines = [];
	lines.push(color('  ★ TOP CONVICTION RIGHT NOW', c.bold + accent));
	lines.push(
		`  ${color(best.base + '/USDT', c.bold + c.white)}  ` +
		`${color(tag, accent)} ${color(`(${score}/100)`, c.dim)}  ` +
		color(why, c.gray),
	);
	lines.push(
		`  entry ${color('$' + R.fmtPrice(best.last), c.white)}   ` +
		`stop ${color('$' + R.fmtPrice(best.stop), c.red)}   ` +
		`tgt1 ${color('$' + R.fmtPrice(best.target1), c.green)}   ` +
		`tgt2 ${color('$' + R.fmtPrice(best.target2), c.lime)}   ` +
		`${color('vol', c.gray)} ${R.fmtUsd(best.volUsd24h)}`,
	);
	return lines;
}

function tape(width) {
	// Scrolling ticker tape of biggest 24h movers.
	const movers = [...state.tickers]
		.filter(t => t.volUsd24h > 3_000_000)
		.sort((a, b) => Math.abs(b.changePct24h) - Math.abs(a.changePct24h))
		.slice(0, 40);
	if (movers.length === 0) return color(' '.repeat(width), c.gray);

	const cells = movers.map(t => {
		const arrow = t.changePct24h >= 0 ? '▲' : '▼';
		const col = t.changePct24h >= 0 ? c.green : c.red;
		return color(`${t.base} ${arrow}${Math.abs(t.changePct24h).toFixed(1)}%`, col);
	});
	let strip = cells.join(color('  ·  ', c.gray));
	// Build a plain version for offset math, then rotate.
	const plain = strip.replace(/\[[0-9;]*m/g, '');
	const doubled = strip + color('  ·  ', c.gray) + strip;
	// Approximate scroll by character offset on the colored doubled string.
	const off = state.tapeOffset % (plain.length || 1);
	// Cheap rotation: we just slide a window over the doubled colored string.
	// (Perfect ANSI-aware windowing is overkill; this looks smooth enough.)
	return color('TAPE ', c.bold + c.gray) + sliceVisible(doubled, off, width - 6);
}

// Slide a visible-width window over an ANSI string starting at visible offset.
// ANSI escape sequences (CSI ... 'm') are emitted but never counted as width,
// so color state stays correct and codes never leak as visible characters.
function sliceVisible(str, startVisible, visWidth) {
	let out = '';
	let visible = 0;
	let taken = 0;
	let i = 0;
	while (i < str.length && taken < visWidth) {
		if (str.charCodeAt(i) === 27) { // ESC — start of an ANSI sequence
			const end = str.indexOf('m', i);
			if (end === -1) break;
			out += str.slice(i, end + 1); // always carry color state forward
			i = end + 1;
			continue;
		}

		if (visible >= startVisible) {
			out += str[i];
			taken++;
		}

		visible++;
		i++;
	}

	return out + c.reset;
}

function footer(width) {
	const age = state.lastDeep ? Math.round((Date.now() - state.lastDeep) / 1000) : 0;
	const status = state.error
		? color('⚠ ' + state.error, c.red)
		: color('● ' + state.status, state.deepRunning ? c.yellow : c.green);
	const meta = color(
		`scan age ${age}s · ${BAR} bars · ${state.tickers.length} USDT mkts · q quit · r rescan`,
		c.dim,
	);
	const disc = color('signals are probabilistic — NOT financial advice', c.dim);
	return `${R.rule(width)}\n ${status}   ${meta}\n ${disc}`;
}

function draw() {
	state.frame++;
	state.tapeOffset++;
	const width = Math.max(96, Math.min(process.stdout.columns || 120, 160));

	const buys = topBy('buyScore', 7, s => s.buyScore >= 35);
	const booms = topBy('explosionScore', 7, s => s.explosionScore >= 30);

	const out = [];
	out.push(R.HOME);
	out.push(header(width));
	out.push('');
	out.push(...focusCard(width));
	out.push('');
	out.push(...tradePanel('🚀 ABOUT TO EXPLODE  (volume + squeeze pre-breakout)', booms, 'explosionScore', width, c.magenta));
	out.push('');
	out.push(...tradePanel('📈 BUY NOW  (confirmed momentum)', buys, 'buyScore', width, c.lime));
	out.push('');
	out.push(tape(width));
	out.push(footer(width));

	// Clear to end of screen on each line region by padding with the clear-line code.
	const frame = out.join(`${R.ESC}K\n`) + `${R.ESC}K` + `${R.ESC}0J`;
	process.stdout.write(frame);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let timers = [];
function shutdown(code = 0) {
	for (const t of timers) clearInterval(t);
	process.stdout.write(R.SHOW_CURSOR + R.ALT_SCREEN_OFF);
	process.exit(code);
}

async function main() {
	process.stdout.write(R.ALT_SCREEN_ON + R.HIDE_CURSOR + R.CLEAR);

	// Keyboard controls.
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', key => {
			if (key === 'q' || key === '' || key === '') shutdown(0); // q / Ctrl-C / Esc
			if (key === 'r') deepScan();
		});
	}

	process.on('SIGINT', () => shutdown(0));
	process.on('SIGTERM', () => shutdown(0));

	// First data, then start loops.
	await fastTick();
	draw();
	deepScan(); // fire and forget; panels fill in when done

	timers.push(setInterval(fastTick, FAST_MS));
	timers.push(setInterval(() => {
		if (Date.now() - state.lastDeep > DEEP_REFRESH_MS) deepScan();
	}, 3000));
	timers.push(setInterval(draw, 250)); // smooth repaint (spinner, tape, clock)
}

main().catch(error => {
	process.stdout.write(R.SHOW_CURSOR + R.ALT_SCREEN_OFF);
	console.error('Fatal:', error);
	process.exit(1);
});
