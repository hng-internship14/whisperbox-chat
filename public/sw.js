self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'WhisperBox',
    body: 'You have a new notification.',
  };

  try {
    payload = event.data?.json() || payload;
  } catch {
    payload.body = event.data?.text() || payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'WhisperBox', {
      body: payload.body || 'You have a new notification.',
      tag: payload.tag || 'whisperbox-notification',
      data: payload.data || {},
    })
  );
});
