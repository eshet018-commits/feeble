// Firebase Cloud Messaging Service Worker
// This service worker receives push notifications from FCM when the web app
// tab is closed or in the background. It displays them as system-level
// notifications that appear on the user's screen even when the app is not open.

importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCS2ufJyQv8tK5VZwOBc2NF621zA6jL2C4",
  authDomain: "shared-event-planner-8f0c9.firebaseapp.com",
  databaseURL: "https://shared-event-planner-8f0c9-default-rtdb.firebaseio.com",
  projectId: "shared-event-planner-8f0c9",
  storageBucket: "shared-event-planner-8f0c9.firebasestorage.app",
  messagingSenderId: "446597142532",
  appId: "1:446597142532:web:fff7facf193f4deb5efd51",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages — this fires when the web tab is closed or
// in the background. The notification is shown automatically by FCM when
// the payload includes a `notification` object.
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png',
    data: payload.data || {},
    tag: payload.data?.chatId || payload.data?.announcementId || payload.data?.eventId,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks — focus or open the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const kind = data.kind;
  let url = '/';

  if (kind === 'chat' && data.chatId && data.groupId) {
    url = `/group/${data.groupId}/chat/${data.chatId}`;
  } else if (kind === 'announcement' && data.groupId) {
    url = `/group/${data.groupId}`;
  } else if (kind === 'event' && data.eventId) {
    url = `/event/${data.eventId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is open.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open a new tab if none exist.
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
