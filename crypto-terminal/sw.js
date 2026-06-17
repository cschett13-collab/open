// Service worker for the Alpha Terminal PWA.
// Strategy:
//   • App shell (page, icons, manifest) -> cache-first, so it launches instantly
//     and opens even with no connection.
//   • Live data (/api/*) -> network-only (never serve stale prices); the page
//     keeps its last in-memory frame if a fetch fails.
const CACHE = 'alpha-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
	event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys()
			.then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', event => {
	const {request} = event;
	const url = new URL(request.url);

	if (url.pathname.startsWith('/api/')) {
		return; // let the network handle live data
	}

	if (request.mode === 'navigate') {
		// Network-first for the page so updates land, falling back to cached shell.
		event.respondWith(
			fetch(request)
				.then(res => {
					const copy = res.clone();
					caches.open(CACHE).then(c => c.put('/', copy));
					return res;
				})
				.catch(() => caches.match('/')),
		);
		return;
	}

	// Static assets: cache-first.
	event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});

// Tapping an alert focuses the app (or opens it if closed).
self.addEventListener('notificationclick', event => {
	event.notification.close();
	event.waitUntil(
		self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
			for (const client of list) {
				if ('focus' in client) return client.focus();
			}

			return self.clients.openWindow('/');
		}),
	);
});
