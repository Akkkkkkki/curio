const CACHE_NAME = 'curio-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

// URLs that should NEVER be cached (API, auth, dynamic data)
const NEVER_CACHE_PATTERNS = [
  /\.supabase\.co/,
  /\/api\//,
  /\/auth\//,
  /\/storage\//,
  /\/rest\//,
  /supabase/i,
];

// Check if a URL should be excluded from caching
const shouldNeverCache = (url) => {
  return NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url));
};

// Check if this is a shell asset that should be cached
const isShellAsset = (url) => {
  const pathname = new URL(url).pathname;
  return SHELL_ASSETS.includes(pathname);
};

// Check if this is a static asset (JS, CSS, fonts, static images)
const isStaticAsset = (url) => {
  const pathname = new URL(url).pathname;
  return (
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff')
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // NEVER cache Supabase, API, or dynamic data - always fetch from network
  if (shouldNeverCache(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For shell assets: cache-first strategy
  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // For static assets (JS, CSS): stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // For everything else (including user images): network-first
  // This ensures deleted/updated images are always fresh
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache user-uploaded images in SW - they're in IndexedDB
        return response;
      })
      .catch(() => {
        // If network fails, try cache as fallback for non-critical resources
        return caches.match(event.request);
      }),
  );
});
