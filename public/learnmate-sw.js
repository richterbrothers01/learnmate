/* LearnMate push service worker.
 *
 * DEPLOYMENT (required): copy this file to the app's public/ directory so
 * it is served from the SITE ROOT as /learnmate-sw.js. A service worker
 * registered from any other path cannot cover the whole app, and the
 * usePushSubscription hook registers exactly '/learnmate-sw.js'.
 *
 * Behaviour:
 *  - 'push': show a notification from the payload's title/body, with sane
 *    defaults when the payload is missing or malformed. The payload shape
 *    is { title, body, url?, tag?, icon? } — see
 *    supabase/functions/send-reminders/index.ts.
 *  - 'notificationclick': focus an already-open app tab if one exists,
 *    otherwise open the payload's url (default '/').
 *
 * UNTESTED on real devices. Registration, permission prompts, and delivery
 * must be verified in a real browser before anyone is told reminders work.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'LearnMate';
  const body = data.body || 'Your scheduled test is coming up.';
  const options = {
    body,
    data: { url: data.url || '/' },
    ...(data.tag ? { tag: data.tag } : {}),
    ...(data.icon ? { icon: data.icon } : {}),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
        return undefined;
      }),
  );
});
