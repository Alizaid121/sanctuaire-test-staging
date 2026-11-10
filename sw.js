/* Sanctuaire Test service worker. It caches nothing on purpose: every page comes from the network,
   so an update uploaded to GitHub always shows up. It exists so Chrome treats the site as installable. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* network only */ });
