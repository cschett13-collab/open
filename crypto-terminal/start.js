#!/usr/bin/env node
// ▲ Alpha Terminal — one-command launcher / "command center".
//
// This is the easiest way to run everything. It:
//   1. starts the web dashboard (server.js) — your "one place" for crypto +
//      stocks + alerts, openable on this PC and on your phone, and
//   2. keeps it running NON-STOP: if it ever crashes, this restarts it
//      automatically (with a short backoff), forever.
//
// You do not need to know how to code. Just run it (or double-click one of the
// start-windows.cmd / start-mac-linux.sh helpers) and leave it open.
//
//   node start.js
//
// Everything is zero-dependency (pure Node). All config is optional via env
// vars — see README.md. To also light up your RTX 5090 local AI briefing, set
// ALPHA_AI=ollama before launching (the helper scripts explain how).

import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, 'server.js');
const PORT = process.env.PORT || '8787';

// Best-effort LAN address so you know exactly what to type on your phone.
function lanAddress() {
	const nets = os.networkInterfaces();
	for (const name of Object.keys(nets)) {
		for (const net of nets[name] || []) {
			if (net.family === 'IPv4' && !net.internal) {
				return net.address;
			}
		}
	}

	return null;
}

function banner() {
	const ip = lanAddress();
	console.log('');
	console.log('  ============================================================');
	console.log('   ▲ ALPHA TERMINAL  —  your command center is starting');
	console.log('  ============================================================');
	console.log(`   On THIS computer:   http://localhost:${PORT}`);
	console.log(ip
		? `   On your PHONE:      http://${ip}:${PORT}   (same Wi-Fi)`
		: '   On your PHONE:      http://<this-pc-ip>:' + PORT + '   (same Wi-Fi)');
	console.log('');
	console.log('   Tip: in the phone browser, tap Share -> "Add to Home Screen"');
	console.log('        to install it as a real app with push alerts.');
	console.log('');
	console.log('   This window keeps the dashboard running non-stop.');
	console.log('   Leave it open. Press Ctrl+C here to stop everything.');
	console.log('  ============================================================');
	console.log('');
}

let stopping = false;
let restarts = 0;
let child = null;

function launch() {
	child = spawn(process.execPath, [server], {
		cwd: here,
		stdio: 'inherit',
		env: process.env,
	});

	child.on('exit', (code, signal) => {
		child = null;
		if (stopping) {
			return;
		}

		restarts += 1;
		// Back off a little so a hard-failing server doesn't spin the CPU,
		// but always come back up — this is the "runs non-stop" guarantee.
		const waitMs = Math.min(30_000, 1000 * Math.min(restarts, 10));
		const why = signal ? `signal ${signal}` : `exit code ${code}`;
		console.error(`\n  [supervisor] dashboard stopped (${why}). Restarting in ${Math.round(waitMs / 1000)}s… (restart #${restarts})\n`);
		setTimeout(launch, waitMs);
	});

	child.on('error', error => {
		console.error('  [supervisor] failed to start dashboard:', error.message);
	});
}

function shutdown() {
	if (stopping) {
		return;
	}

	stopping = true;
	console.log('\n  [supervisor] stopping… bye.');
	if (child) {
		child.kill();
	}

	// Give the child a moment to exit, then quit.
	setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

banner();
launch();
