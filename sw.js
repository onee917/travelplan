const CACHE = 'travelplanner-web-v3';
const TILE_CACHE = 'travelplanner-tiles-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 地图瓦片：缓存优先（离线也能看走过的区域），超过 500 张时淘汰最早的
  if (url.hostname === 'server.arcgisonline.com' && e.request.method === 'GET') {
    e.respondWith(
      caches.open(TILE_CACHE).then(c =>
        c.match(e.request).then(hit =>
          hit || fetch(e.request).then(resp => {
            if (resp && resp.ok) {
              c.put(e.request, resp.clone()).then(() =>
                c.keys().then(ks => { if (ks.length > 500) c.delete(ks[0]); })
              );
            }
            return resp;
          }).catch(() => hit || Response.error())
        )
      )
    );
    return;
  }

  // 页面导航：网络优先（绕过 HTTP 缓存，保证更新即时生效），断网回退到缓存的首页
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 本站静态资源：缓存优先
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
});
