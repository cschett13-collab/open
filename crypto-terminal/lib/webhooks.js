// Optional external alert delivery to Discord and/or Telegram. Zero-dependency.
// Configure with env vars (any/all):
//   ALPHA_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
//   ALPHA_TELEGRAM_TOKEN=123456:ABC...   ALPHA_TELEGRAM_CHAT=<chat id>
// Fires alongside phone push whenever a high-conviction alert triggers.

import process from 'node:process';
import https from 'node:https';

function post(url, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const data = typeof body === 'string' ? body : JSON.stringify(body);
		const req = https.request(
			{
				hostname: u.hostname,
				port: u.port || 443,
				path: u.pathname + u.search,
				method: 'POST',
				headers: {'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers},
			},
			res => {
				let out = '';
				res.on('data', c => {
					out += c;
				});
				res.on('end', () => resolve({status: res.statusCode, body: out}));
			},
		);
		req.on('error', reject);
		req.setTimeout(12_000, () => req.destroy(new Error('webhook timeout')));
		req.end(data);
	});
}

export function webhookConfig() {
	return {
		discord: process.env.ALPHA_DISCORD_WEBHOOK || null,
		telegramToken: process.env.ALPHA_TELEGRAM_TOKEN || null,
		telegramChat: process.env.ALPHA_TELEGRAM_CHAT || null,
	};
}

export function webhooksEnabled() {
	const c = webhookConfig();
	return Boolean(c.discord || (c.telegramToken && c.telegramChat));
}

function format(alert) {
	const arrow = alert.changePct >= 0 ? '▲' : '▼';
	const kind = alert.kind === 'stock' ? 'Stock' : 'Crypto';
	return `🚀 ${alert.sym} — ${alert.tag} (${alert.score}/100)\n` +
		`${kind} · $${alert.price} ${arrow}${Math.abs(alert.changePct).toFixed(1)}% · ${alert.why}\n` +
		`(not financial advice)`;
}

// Fire-and-forget; never throws.
export function dispatch(alert) {
	const c = webhookConfig();
	const msg = format(alert);
	if (c.discord) {
		post(c.discord, {content: msg}).catch(() => {});
	}

	if (c.telegramToken && c.telegramChat) {
		post(`https://api.telegram.org/bot${c.telegramToken}/sendMessage`, {
			chat_id: c.telegramChat,
			text: msg,
			disable_web_page_preview: true,
		}).catch(() => {});
	}
}
