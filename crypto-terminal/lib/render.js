// Terminal rendering: ANSI colors, sparklines, boxes. Zero dependencies.
// We build the whole frame as one string and write it in a single syscall to
// avoid flicker — the "live, no-latency" feel comes from atomic repaints.

export const ESC = '[';
export const ALT_SCREEN_ON = `${ESC}?1049h`;
export const ALT_SCREEN_OFF = `${ESC}?1049l`;
export const HIDE_CURSOR = `${ESC}?25l`;
export const SHOW_CURSOR = `${ESC}?25h`;
export const CLEAR = `${ESC}2J${ESC}H`;
export const HOME = `${ESC}H`;

const c = {
	reset: `${ESC}0m`,
	bold: `${ESC}1m`,
	dim: `${ESC}2m`,
	red: `${ESC}38;5;203m`,
	green: `${ESC}38;5;78m`,
	lime: `${ESC}38;5;118m`,
	yellow: `${ESC}38;5;221m`,
	orange: `${ESC}38;5;215m`,
	cyan: `${ESC}38;5;81m`,
	blue: `${ESC}38;5;75m`,
	magenta: `${ESC}38;5;213m`,
	gray: `${ESC}38;5;245m`,
	white: `${ESC}38;5;255m`,
	bgDark: `${ESC}48;5;236m`,
};
export {c};

export const color = (s, col) => `${col}${s}${c.reset}`;

const SPARK = '▁▂▃▄▅▆▇█';
export function sparkline(values, width = 24) {
	if (!values || values.length === 0) return ' '.repeat(width);
	const slice = values.slice(-width);
	const min = Math.min(...slice);
	const max = Math.max(...slice);
	const range = max - min || 1;
	let out = '';
	for (const v of slice) {
		const idx = Math.round(((v - min) / range) * (SPARK.length - 1));
		out += SPARK[idx];
	}

	const up = slice[slice.length - 1] >= slice[0];
	return color(out.padStart(width), up ? c.green : c.red);
}

// Strip ANSI for length calculations.
const stripAnsi = s => s.replace(/\[[0-9;]*m/g, '');
export function pad(str, width, align = 'left') {
	const len = stripAnsi(str).length;
	if (len >= width) {
		// Truncate visible chars (keep it simple; our content fits).
		return str;
	}

	const space = ' '.repeat(width - len);
	return align === 'right' ? space + str : str + space;
}

export function fmtPrice(n) {
	if (n === undefined || Number.isNaN(n)) return '—';
	if (n >= 1000) return n.toLocaleString('en-US', {maximumFractionDigits: 0});
	if (n >= 1) return n.toFixed(2);
	if (n >= 0.01) return n.toFixed(4);
	return n.toPrecision(3);
}

export function fmtPct(n, {plus = true} = {}) {
	if (n === undefined || Number.isNaN(n)) return '—';
	const s = `${n >= 0 && plus ? '+' : ''}${n.toFixed(2)}%`;
	return color(s, n >= 0 ? c.green : c.red);
}

export function fmtUsd(n) {
	if (!n) return '—';
	if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
	if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
	return `$${n.toFixed(0)}`;
}

// Horizontal meter bar, e.g. score 0..100.
export function meter(score, width = 10) {
	const filled = Math.round((score / 100) * width);
	const col = score >= 70 ? c.lime : score >= 50 ? c.yellow : score >= 30 ? c.orange : c.gray;
	return color('█'.repeat(filled), col) + color('░'.repeat(width - filled), c.gray);
}

export function rule(width, ch = '─') {
	return color(ch.repeat(width), c.gray);
}
