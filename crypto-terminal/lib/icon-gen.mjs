// Generates the PWA app icons with zero dependencies (Node's built-in zlib).
// Run once: `node lib/icon-gen.mjs` — writes icons/icon-192.png & icon-512.png.
// Draws the ▲ ALPHA mark: neon triangle on the dark terminal background.

import zlib from 'node:zlib';
import {writeFileSync, mkdirSync} from 'node:fs';

const CRC = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xED_B8_83_20 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}

	return t;
})();

function crc32(buf) {
	let c = 0xFF_FF_FF_FF;
	for (const byte of buf) c = CRC[(c ^ byte) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFF_FF_FF_FF) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const t = Buffer.from(type, 'ascii');
	const body = Buffer.concat([t, data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	let p = 0;
	for (let y = 0; y < size; y++) {
		raw[p++] = 0; // no filter
		for (let x = 0; x < size; x++) {
			const [r, g, b, a] = pixel(x, y, size);
			raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
		}
	}

	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type RGBA
	return Buffer.concat([
		sig,
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

// Signed area of the triangle edge — used for the inside test.
const edge = (ax, ay, bx, by, px, py) => (px - ax) * (by - ay) - (py - ay) * (bx - ax);

function pixel(x, y, size) {
	// Background: dark with a subtle vertical gradient.
	const g = y / size;
	let r = Math.round(8 + g * 6);
	let gg = Math.round(12 + g * 8);
	let b = Math.round(20 + g * 12);
	let a = 255;

	// Upward triangle, centred, with a little margin.
	const m = size * 0.2;
	const ax = size / 2, ay = m; // apex
	const bx = m, by = size - m; // bottom-left
	const cx = size - m, cy = size - m; // bottom-right
	const w0 = edge(bx, by, cx, cy, x, y);
	const w1 = edge(cx, cy, ax, ay, x, y);
	const w2 = edge(ax, ay, bx, by, x, y);
	const inside = (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);

	if (inside) {
		// Cyan→green gradient down the triangle, like the sparkline accents.
		const t = (y - ay) / (cy - ay);
		r = Math.round(0x54 * (1 - t) + 0x3d * t);
		gg = Math.round(0xD6 * (1 - t) + 0xDC * t);
		b = Math.round(0xFF * (1 - t) + 0x84 * t);
		a = 255;
	}

	return [r, gg, b, a];
}

mkdirSync(new URL('../icons/', import.meta.url), {recursive: true});
for (const size of [192, 512]) {
	const out = new URL(`../icons/icon-${size}.png`, import.meta.url);
	writeFileSync(out, png(size, pixel));
	console.log('wrote', out.pathname);
}
