/* Stayingfit service worker: shows phone notifications and opens the right chat when one is tapped. It caches nothing. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Stayingfit', {
    body: d.body || 'You have a new message.', tag: d.tag || 'stayingfit', renotify: true, icon: 'icon-192.png', badge: 'badge-96.png', data: { url: d.url || '' }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.indexOf(self.registration.scope) === 0);
    if (open) { try { await open.focus(); } catch (err) {} open.postMessage({ sfOpen: url }); return; }
    await self.clients.openWindow(self.registration.scope + url);
  })());
});
