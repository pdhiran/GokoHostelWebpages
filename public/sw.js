const CACHE_NAME = "goko-admin-v2";
const OFFLINE_URL = "/admin";

// --- Failover State ---
let failoverConfig = { failoverEnabled: false, piLocalUrl: null, runtime: "cloudflare" };
let lastConfigFetch = 0;
const CONFIG_POLL_INTERVAL = 60000; // 1 minute

async function refreshFailoverConfig() {
  const now = Date.now();
  if (now - lastConfigFetch < CONFIG_POLL_INTERVAL) return;
  lastConfigFetch = now;

  try {
    const res = await fetch("/api/failover-config", { cache: "no-store" });
    if (res.ok) {
      failoverConfig = await res.json();
    }
  } catch {
    // Primary unreachable -- if we have a Pi URL, try fetching config from there
    if (failoverConfig.piLocalUrl) {
      try {
        const piRes = await fetch(`${failoverConfig.piLocalUrl}/api/failover-config`, { cache: "no-store" });
        if (piRes.ok) {
          failoverConfig = await piRes.json();
        }
      } catch {}
    }
  }
}

// --- Install & Activate ---

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    clients.claim().then(() => refreshFailoverConfig())
  );
});

// --- Fetch Interception (Failover) ---

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept API calls and page navigations to our own origin
  if (url.origin !== self.location.origin) return;

  // Skip non-GET/POST, skip static assets
  const method = event.request.method;
  if (method !== "GET" && method !== "POST") return;

  // Skip static files (images, CSS, JS chunks, fonts)
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|webp|avif)$/i.test(url.pathname)) return;
  if (url.pathname.startsWith("/_next/")) return;

  // Only intercept if failover is enabled and we have a Pi URL
  if (!failoverConfig.failoverEnabled || !failoverConfig.piLocalUrl) {
    // Still refresh config periodically on normal requests
    event.waitUntil(refreshFailoverConfig());
    return;
  }

  event.respondWith(handleWithFailover(event.request));
});

async function handleWithFailover(request) {
  try {
    // Try the primary server first (current origin)
    const response = await fetchWithTimeout(request.clone(), 8000);
    if (response.ok || response.status < 500) {
      // Primary worked -- refresh config in background
      refreshFailoverConfig();
      return response;
    }
    // 5xx error -- fall through to failover
  } catch {
    // Network error / timeout -- fall through to failover
  }

  // Primary failed -- try the Pi
  const piUrl = failoverConfig.piLocalUrl;
  if (!piUrl) return fetch(request);

  try {
    const originalUrl = new URL(request.url);
    const piRequestUrl = `${piUrl}${originalUrl.pathname}${originalUrl.search}`;

    const piRequest = new Request(piRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method === "POST" ? await request.clone().text() : undefined,
      mode: "cors",
      credentials: "omit",
    });

    const piResponse = await fetchWithTimeout(piRequest, 10000);

    // Notify clients that we're in failover mode
    notifyClients({ type: "FAILOVER_ACTIVE", piUrl });

    return piResponse;
  } catch {
    // Both primary and Pi failed
    return new Response(
      JSON.stringify({ error: "Both primary server and local Pi are unreachable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

function notifyClients(message) {
  self.clients.matchAll({ type: "window" }).then((clients) => {
    for (const client of clients) {
      client.postMessage(message);
    }
  });
}

// --- Message Handler (config updates from admin UI) ---

self.addEventListener("message", (event) => {
  if (event.data?.type === "UPDATE_FAILOVER_CONFIG") {
    failoverConfig = { ...failoverConfig, ...event.data.config };
    lastConfigFetch = Date.now();
  }
  if (event.data?.type === "REFRESH_CONFIG") {
    lastConfigFetch = 0;
    refreshFailoverConfig();
  }
});

// --- Push Notifications (unchanged) ---

self.addEventListener("push", (event) => {
  const showNotif = async () => {
    let title = "Goko Hostel";
    let body = "";
    let icon = "/icons/icon-192.png";
    let url = "/admin";
    let tag = "goko-notification";

    if (event.data) {
      try {
        const payload = event.data.json();
        if (payload && typeof payload === "object") {
          title = payload.title || title;
          body = payload.body || body;
          icon = payload.icon || icon;
          url = payload.url || url;
          tag = payload.tag || tag;
        }
      } catch {
        const text = event.data.text();
        if (text && text.length < 200) {
          body = text;
        }
      }
    }

    await self.registration.showNotification(title, {
      body: body || "You have a new update",
      icon,
      badge: "/icons/icon-192.png",
      data: { url },
      vibrate: [200, 100, 200],
      tag,
      renotify: true,
    });
  };

  event.waitUntil(showNotif());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((newSubscription) => {
        return fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "resubscribe",
            oldEndpoint: event.oldSubscription?.endpoint,
            subscription: newSubscription.toJSON(),
          }),
        });
      })
  );
});
