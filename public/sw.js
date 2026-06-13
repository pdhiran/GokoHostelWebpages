const CACHE_NAME = "goko-admin-v2";
const OFFLINE_URL = "/admin";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

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
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
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
