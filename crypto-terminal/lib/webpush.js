// Zero-dependency Web Push (VAPID + RFC 8291 "aes128gcm" payload encryption),
// implemented on Node's built-in crypto. Lets the server push notifications to
// subscribed phones even when the PWA is fully closed.
//
// Standards: RFC 8292 (VAPID), RFC 8291 (message encryption), RFC 8188 (aes128gcm).

import crypto from 'node:crypto';

const b64url = buf =>
	Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// --- VAPID keys (EC P-256) --------------------------------------------------
export function generateVapidKeys() {
	const {publicKey, privateKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
	const jwk = publicKey.export({format: 'jwk'});
	const pub = Buffer.concat([Buffer.from([0x04]), fromB64url(jwk.x), fromB64url(jwk.y)]); // uncompressed point
	return {
		publicKey: b64url(pub),
		privateJwk: privateKey.export({format: 'jwk'}),
	};
}

function vapidJwt(audience, vapid, subject = 'mailto:alerts@alpha.local') {
	const header = b64url(JSON.stringify({typ: 'JWT', alg: 'ES256'}));
	const payload = b64url(JSON.stringify({
		aud: audience,
		exp: Math.floor(Date.now() / 1000) + 12 * 3600,
		sub: subject,
	}));
	const signingInput = `${header}.${payload}`;
	const key = crypto.createPrivateKey({key: vapid.privateJwk, format: 'jwk'});
	const sig = crypto.sign('SHA256', Buffer.from(signingInput), {key, dsaEncoding: 'ieee-p1363'});
	return `${signingInput}.${b64url(sig)}`;
}

// --- RFC 8291 payload encryption (aes128gcm, single record) -----------------
export function encrypt(payload, p256dhB64, authB64) {
	const uaPublic = fromB64url(p256dhB64); // 65 bytes
	const authSecret = fromB64url(authB64); // 16 bytes

	const ecdh = crypto.createECDH('prime256v1');
	ecdh.generateKeys();
	const asPublic = ecdh.getPublicKey(); // 65 bytes
	const sharedSecret = ecdh.computeSecret(uaPublic); // 32 bytes

	// IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info"\0 ua_pub as_pub)
	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
	const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));

	const salt = crypto.randomBytes(16);
	const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
	const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

	// Single record: plaintext || 0x02 delimiter.
	const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]);
	const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
	const enc = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

	// aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(as_public) | ciphertext
	const rs = Buffer.alloc(4);
	rs.writeUInt32BE(4096);
	const idlen = Buffer.from([asPublic.length]);
	return Buffer.concat([salt, rs, idlen, asPublic, enc]);
}

// Decrypt — used by the self-test to prove the encryption round-trips.
export function decryptForTest(body, uaEcdh, authB64) {
	const authSecret = fromB64url(authB64);
	const salt = body.subarray(0, 16);
	const idlen = body[20];
	const asPublic = body.subarray(21, 21 + idlen);
	const ciphertext = body.subarray(21 + idlen);
	const uaPublic = uaEcdh.getPublicKey();

	const sharedSecret = uaEcdh.computeSecret(asPublic);
	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
	const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
	const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
	const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

	const tag = ciphertext.subarray(ciphertext.length - 16);
	const data = ciphertext.subarray(0, ciphertext.length - 16);
	const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
	decipher.setAuthTag(tag);
	const out = Buffer.concat([decipher.update(data), decipher.final()]);
	return out.subarray(0, out.length - 1).toString(); // strip 0x02 delimiter
}

// --- Send one push ----------------------------------------------------------
import https from 'node:https';
export function sendNotification(subscription, payloadString, vapid) {
	return new Promise((resolve, reject) => {
		let body = Buffer.alloc(0);
		let headers = {TTL: '2419200'};
		try {
			const url = new URL(subscription.endpoint);
			const audience = `${url.protocol}//${url.host}`;
			const jwt = vapidJwt(audience, vapid);
			if (payloadString) {
				body = encrypt(payloadString, subscription.keys.p256dh, subscription.keys.auth);
				headers = {
					...headers,
					'Content-Encoding': 'aes128gcm',
					'Content-Type': 'application/octet-stream',
					'Content-Length': body.length,
				};
			}

			headers.Authorization = `vapid t=${jwt}, k=${vapid.publicKey}`;
			const req = https.request(
				{hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: 'POST', headers},
				res => {
					let out = '';
					res.on('data', c => {
						out += c;
					});
					res.on('end', () => resolve({status: res.statusCode, body: out}));
				},
			);
			req.on('error', reject);
			req.setTimeout(15_000, () => req.destroy(new Error('push timeout')));
			req.end(body);
		} catch (error) {
			reject(error);
		}
	});
}
