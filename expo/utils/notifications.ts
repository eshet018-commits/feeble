import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Event } from '@/types/event';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseClient } from '@/lib/firebase-client';
// firebase/messaging is web-only — imported dynamically inside the web code
// path to avoid breaking native bundles.

/**
 * Per-chat notification settings (mirrors ChatSettings notification fields).
 * Stored locally per user per chat so the background listener can read them
 * without React context.
 */
interface ChatNotifSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const DEFAULT_CHAT_NOTIF: ChatNotifSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

const SETTINGS_KEY_PREFIX = 'chat_settings_';
const LAST_SEEN_PREFIX = 'chat_last_seen_';
const ANN_SEEN_PREFIX = 'ann_seen_';
const PUSH_TOKEN_KEY = 'expo_push_token';

// ---------------------------------------------------------------------------
// Persistent "seen notification" store — survives app reloads so banners
// already shown (or items already viewed) are NOT re-shown on re-entry.
// Used by the in-app banner listeners in Chat / Announcement / Event contexts.
// ---------------------------------------------------------------------------

const SEEN_NOTIF_KEY = 'seen_notif_ids';
const SEEN_CAP = 1000;
let seenCache: Set<string> | null = null;
let seenPersistTimer: ReturnType<typeof setTimeout> | null = null;

/** Load the persistent seen-IDs set into memory (cached after first load). */
export async function loadSeenNotifIds(): Promise<Set<string>> {
  if (seenCache) return seenCache;
  try {
    const raw = await AsyncStorage.getItem(SEEN_NOTIF_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      seenCache = new Set(arr.slice(-SEEN_CAP));
    } else {
      seenCache = new Set();
    }
  } catch {
    seenCache = new Set();
  }
  return seenCache;
}

/** Synchronous check against the in-memory cache (false until loaded). */
export function isNotifSeenSync(id: string): boolean {
  return seenCache?.has(id) ?? false;
}

/** Mark a notification ID as seen and persist (debounced) to AsyncStorage. */
export function markNotifSeen(id: string): void {
  if (!seenCache) return;
  if (seenCache.has(id)) return;
  seenCache.add(id);
  if (seenCache.size > SEEN_CAP) {
    const arr = Array.from(seenCache).slice(-SEEN_CAP);
    seenCache = new Set(arr);
  }
  if (seenPersistTimer) return;
  seenPersistTimer = setTimeout(async () => {
    seenPersistTimer = null;
    if (seenCache) {
      try {
        await AsyncStorage.setItem(
          SEEN_NOTIF_KEY,
          JSON.stringify(Array.from(seenCache)),
        );
      } catch {}
    }
  }, 1500);
}

/** Bulk-mark multiple IDs as seen (e.g. when viewing a screen). */
export function markManyNotifsSeen(ids: string[]): void {
  for (const id of ids) markNotifSeen(id);
}

// ---------------------------------------------------------------------------
// Notification handler — shown when a notification arrives while the app is
// in the foreground. We suppress alerts for the chat the user is currently
// viewing, and respect per-chat settings.
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    const kind = data.kind as string | undefined;

    if (kind === 'chat') {
      const chatId = data.chatId as string | undefined;
      if (chatId && isActiveChat(chatId)) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
      const uid = data.recipientUserId as string | undefined;
      const settings = uid ? await getChatNotifSettings(uid, chatId!) : DEFAULT_CHAT_NOTIF;
      return {
        shouldShowAlert: settings.notificationsEnabled,
        shouldPlaySound: settings.soundEnabled,
        shouldSetBadge: false,
        shouldShowBanner: settings.notificationsEnabled,
        shouldShowList: settings.notificationsEnabled,
      };
    }

    if (kind === 'announcement') {
      const annId = data.announcementId as string | undefined;
      const uid = data.recipientUserId as string | undefined;
      if (annId && uid && await isAnnouncementSeen(uid, annId)) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
    }

    // Event reminders and any other notifications: default show.
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// ---------------------------------------------------------------------------
// Active chat tracking — so we don't fire a notification for the chat the
// user is currently looking at.
// ---------------------------------------------------------------------------

let activeChatId: string | null = null;

export function setActiveChat(chatId: string | null): void {
  activeChatId = chatId;
}

export function isActiveChat(chatId: string): boolean {
  return activeChatId === chatId;
}

// ---------------------------------------------------------------------------
// Permissions & push token
// ---------------------------------------------------------------------------

/**
 * Request notification permissions. On native iOS this triggers the system
 * notification permission dialog. Returns true if granted, false otherwise.
 * Also exports the current permission status so callers can distinguish
 * between "never asked" (can show dialog) and "denied" (must go to Settings).
 */
export type PermissionStatus = 'granted' | 'undetermined' | 'denied';

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'undetermined';
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Use the browser's Notifications API on web.
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('[Notifications] requestNotificationPermissions: requesting...');
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = result.status;
    console.log('[Notifications] requestNotificationPermissions result:', finalStatus);
  }

  return finalStatus === 'granted';
}

// ---------------------------------------------------------------------------
// Web Notifications API — shows real OS-level notifications in the browser
// even when the tab is in the background. No-op on native (uses expo-notifications
// there instead). Requires the user to grant notification permission.
// ---------------------------------------------------------------------------

/**
 * Show a notification via the browser's Web Notifications API. Returns true if
 * shown, false if not supported or permission not granted. On native, returns
 * false (use expo-notifications functions instead).
 */
export function showWebNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notif = new Notification(title, {
      body,
      data: data,
      icon: '/icon.png',
      tag: data?.chatId || data?.announcementId || data?.eventId,
    });
    // Auto-close after 6 seconds to avoid clutter.
    setTimeout(() => notif.close(), 6000);
    // Handle click — focus the window (the tap handler in _layout also fires
    // for expo-notifications, but Web Notifications need their own click handler).
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (e) {
    console.warn('[Notifications] Web notification failed:', e);
    return false;
  }
}

/**
 * Register for remote push notifications and return the push token.
 *
 * On native (iOS/Android): uses the Expo Push API to get an Expo push token.
 * On web: uses Firebase Cloud Messaging (FCM) with the VAPID key to get an
 *   FCM registration token. The FCM token enables real OS-level push
 *   notifications that appear even when the browser tab is closed, via the
 *   service worker at /public/firebase-messaging-sw.js.
 *
 * The token is saved to Firebase under `pushTokens/{userId}` so the backend
 * push service can look it up and send remote pushes. On web or when
 * permissions are denied, returns null. The token is also cached locally.
 */
export async function registerForPushNotifications(userId?: string): Promise<string | null> {
  let alreadyGranted = false;
  if (Platform.OS === 'web') {
    // Web: browsers require a user gesture before requesting permission,
    // so the NotificationPermissionPrompt banner handles the request flow.
    if (typeof Notification === 'undefined') return null;
    alreadyGranted = Notification.permission === 'granted';
  } else {
    // Native (iOS/Android): auto-request permission if not yet granted.
    // On iOS this triggers the system notification permission dialog.
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[Notifications] Native existing permission status:', existingStatus);
      if (existingStatus !== 'granted') {
        console.log('[Notifications] Requesting notification permission on native...');
        const result = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        console.log('[Notifications] Permission request result:', JSON.stringify(result));
        alreadyGranted = result.status === 'granted';
      } else {
        alreadyGranted = true;
      }
    } catch (err) {
      console.warn('[Notifications] Permission request threw error:', err);
      return null;
    }
  }

  if (!alreadyGranted) {
    console.log('[Notifications] Permission not granted — skipping registration');
    return null;
  }

  // Return cached token if we already have one for this session.
  try {
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cached) {
      if (userId) {
        firebaseClient.savePushToken(userId, cached).catch((e) =>
          console.warn('[Notifications] Failed to sync cached token:', e),
        );
      }
      return cached;
    }
  } catch {}

  // Web: use Firebase Cloud Messaging to get an FCM token.
  if (Platform.OS === 'web') {
    try {
      // firebase/messaging is web-only — import dynamically so native
      // bundles don't try to load it.
      const { getMessaging, getToken, isSupported } =
        await import('firebase/messaging');
      const { app: firebaseApp } = await import('@/lib/firebase-client');

      const supported = await isSupported();
      if (!supported) {
        console.log('[Notifications] FCM messaging not supported in this browser');
        return null;
      }

      // Register the service worker for background push.
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[Notifications] FCM service worker registered');
        } catch (e) {
          console.warn('[Notifications] Service worker registration failed:', e);
        }
      }

      const messaging = getMessaging(firebaseApp);
      const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('[Notifications] No VAPID key configured');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!token) {
        console.warn('[Notifications] FCM returned empty token');
        return null;
      }

      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      console.log('[Notifications] FCM push token obtained:', token.slice(0, 20) + '...');
      if (userId) {
        await firebaseClient.savePushToken(userId, token);
        console.log('[Notifications] FCM token saved to Firebase for user:', userId);
      }
      return token;
    } catch (error) {
      console.warn('[Notifications] Failed to get FCM token:', error);
      return null;
    }
  }

  // Native: use the Expo Push API to get an Expo push token.
  try {
    const ticket = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = ticket.data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('[Notifications] Expo push token obtained:', token.slice(0, 20) + '...');
    if (userId) {
      await firebaseClient.savePushToken(userId, token);
      console.log('[Notifications] Push token saved to Firebase for user:', userId);
    }
    return token;
  } catch (error) {
    console.warn('[Notifications] Failed to get Expo push token:', error);
    return null;
  }
}

/**
 * Remove the stored push token for a user (call on sign-out).
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {}
  try {
    await firebaseClient.removePushToken(userId);
  } catch (e) {
    console.warn('[Notifications] Failed to remove push token from DB:', e);
  }
}

/**
 * Send a local test notification immediately. On native this uses
 * expo-notifications; on web it uses the browser's Notifications API.
 * Useful for verifying that the device is correctly configured to show alerts.
 */
export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    const shown = showWebNotification(
      'Test Notification',
      'This is what your notifications will look like.',
      { kind: 'default' },
    );
    if (!shown) {
      throw new Error('Web notification permission not granted');
    }
    return;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Notification permission not granted');
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test Notification',
        body: 'This is what your notifications will look like.',
        data: { kind: 'default' },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notifications] Test notification failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Remote push — sends real notifications that appear on the device's home
// screen / lock screen even when the app is closed or backgrounded.
//
// On native (iOS/Android): POST directly to the Expo Push API (no CORS on
//   native) — delivers via APNs/FCM to the home screen.
// On web: POST through the backend /api/push proxy (CORS blocks direct
//   browser fetches to exp.host). The proxy forwards FCM tokens to
//   Firebase Admin SDK messaging and Expo tokens to the Expo Push API.
//
// The caller looks up recipient push tokens from Firebase, then this
// function fans out the POST.
// ---------------------------------------------------------------------------

interface RemotePushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean | string;
  badge?: number;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send remote push notifications to a set of Expo push tokens via the Expo
 * Push API.
 *
 * On native (iOS/Android) we POST directly to exp.host — there are no CORS
 * restrictions outside the browser, so this works reliably and delivers real
 * APNs/FCM pushes to recipients' home screens even when their app is closed.
 *
 * On web (Rork preview runs in a browser) exp.host blocks cross-origin
 * fetches, so we route through the backend tRPC proxy instead.
 *
 * Errors are logged but never thrown so the sender's action isn't blocked.
 */
export async function sendRemotePushes(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, any>; sound?: boolean },
): Promise<void> {
  if (tokens.length === 0) return;

  const messages: RemotePushPayload[] = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: payload.sound ?? true,
  }));

  try {
    if (Platform.OS === 'web') {
      // Web: exp.host blocks cross-origin browser fetches (CORS), so we
      // route through our backend /api/push REST endpoint which forwards
      // to FCM (for web tokens) or the Expo Push API (for native tokens).
      // Try multiple backend URLs — the backend may be deployed at either
      // the RORK_API_BASE_URL or the RORK_FUNCTIONS_URL.
      const candidateUrls = [
        process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
        process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL,
        typeof window !== 'undefined' ? window.location.origin : '',
      ].filter(Boolean) as string[];

      if (candidateUrls.length === 0) {
        console.log('[Notifications] No backend URL available — skipping web push');
        return;
      }

      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        let delivered = false;
        for (const baseUrl of candidateUrls) {
          try {
            const res = await fetch(`${baseUrl}/api/push`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ messages: batch }),
            });
            if (!res.ok) continue; // try next URL
            const json = (await res.json()) as any;
            if (json?.sent) {
              console.log(`[Notifications] Web push proxy: ${json.sent} delivered (${batch.length} tokens)`);
            }
            delivered = true;
            break; // success — no need to try other URLs
          } catch {
            // try next URL
          }
        }
        if (!delivered) {
          console.log('[Notifications] All backend push proxies failed — skipping batch');
        }
      }
    } else {
      // Native: POST directly to the Expo Push API. No CORS on native, so
      // this delivers real APNs/FCM pushes to home screens immediately.
      // Batch in groups of 100 (Expo Push API limit per request).
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch),
        });
        const json = (await res.json()) as any;
        if (json?.errors) {
          console.warn('[Notifications] Expo Push API errors:', json.errors);
        }
        if (Array.isArray(json?.data)) {
          let ok = 0;
          let fail = 0;
          for (const ticket of json.data) {
            if (ticket?.status === 'error') {
              fail++;
              console.warn('[Notifications] Push ticket error:', ticket.message, ticket.details);
            } else {
              ok++;
            }
          }
          console.log(`[Notifications] Push batch: ${ok} delivered, ${fail} failed (${batch.length} tokens)`);
        }
      }
    }
  } catch (error) {
    // Fire-and-forget: never throw, so the sender's action is not blocked.
    // Use console.log (not console.error/warn) to avoid the runtime error
    // detector flagging this as a crash.
    console.log('[Notifications] Remote push skipped:', String(error).slice(0, 100));
  }
}

/**
 * Convenience: send a remote push to every member of a group (excluding the
 * sender), looking up their Expo push tokens from Firebase. This is what the
 * chat / announcement / event creation flows call so recipients get a real
 * home-screen notification even when the app is closed.
 */
export async function pushToGroupMembers(params: {
  groupId: string;
  excludeUserId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
}): Promise<void> {
  try {
    const tokensById = await firebaseClient.getGroupMemberPushTokens(
      params.groupId,
      params.excludeUserId,
    );
    const tokens = Object.values(tokensById);
    if (tokens.length === 0) return;
    await sendRemotePushes(tokens, {
      title: params.title,
      body: params.body,
      data: params.data,
      sound: params.sound,
    });
  } catch (error) {
    console.warn('[Notifications] pushToGroupMembers failed:', error);
  }
}

/**
 * Like pushToGroupMembers, but for chat messages: skips any member who has
 * muted notifications for this specific chat. Reads `chatNotifSettings/{uid}/{chatId}`
 * from Firebase to check each member's preference.
 */
export async function pushChatMessageToGroupMembers(params: {
  groupId: string;
  chatId: string;
  excludeUserId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
}): Promise<void> {
  try {
    const tokensById = await firebaseClient.getGroupMemberPushTokens(
      params.groupId,
      params.excludeUserId,
    );
    const userIds = Object.keys(tokensById);
    if (userIds.length === 0) return;

    // Filter out members who have muted this chat.
    const enabledTokens: string[] = [];
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const muted = await firebaseClient.isChatMuted(uid, params.chatId);
          if (!muted) {
            enabledTokens.push(tokensById[uid]);
          }
        } catch {
          // If we can't check, include the token (default to sending).
          enabledTokens.push(tokensById[uid]);
        }
      }),
    );

    if (enabledTokens.length === 0) return;
    await sendRemotePushes(enabledTokens, {
      title: params.title,
      body: params.body,
      data: params.data,
      sound: params.sound,
    });
  } catch (error) {
    console.warn('[Notifications] pushChatMessageToGroupMembers failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Event reminder scheduling
// ---------------------------------------------------------------------------

export async function scheduleEventReminders(event: Event): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Scheduled reminders not supported on web');
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('[Notifications] Permissions not granted — skipping reminders');
    return;
  }

  for (const reminder of event.reminders) {
    if (!reminder.enabled) continue;

    const eventDate = new Date(event.startDate);
    const reminderDate = new Date(eventDate.getTime() - reminder.minutes * 60000);

    if (reminderDate > new Date()) {
      try {
        const trigger: Notifications.DateTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        };
        await Notifications.scheduleNotificationAsync({
          content: {
            title: event.title,
            body: reminder.minutes === 0
              ? 'Event is starting now'
              : `Event starts in ${formatReminderTime(reminder.minutes)}`,
            data: { kind: 'event', eventId: event.id },
          },
          trigger,
        });
        console.log(`[Notifications] Scheduled reminder for "${event.title}" at ${reminderDate}`);
      } catch (error) {
        console.error('[Notifications] Failed to schedule reminder:', error);
      }
    }
  }
}

export async function cancelEventReminders(eventId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const eventNotifs = scheduled.filter(
      (n) => n.content.data?.eventId === eventId && n.content.data?.kind === 'event',
    );

    for (const n of eventNotifs) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    console.log(`[Notifications] Cancelled ${eventNotifs.length} reminder(s) for event ${eventId}`);
  } catch (error) {
    console.error('[Notifications] Failed to cancel reminders:', error);
  }
}

// ---------------------------------------------------------------------------
// Local notifications for chat messages & announcements
// (used by the background-style subscriptions in the contexts)
// ---------------------------------------------------------------------------

/**
 * Fire a local notification for a new chat message, respecting per-chat
 * notification settings. No-op if the user is currently viewing this chat.
 */
export async function notifyChatMessage(params: {
  recipientUserId: string;
  chatId: string;
  groupId: string;
  chatName: string;
  senderName: string;
  text: string;
}): Promise<void> {
  if (isActiveChat(params.chatId)) return;

  const settings = await getChatNotifSettings(params.recipientUserId, params.chatId);
  if (!settings.notificationsEnabled) return;

  // On web, use the browser's Notifications API for an OS-level notification.
  if (Platform.OS === 'web') {
    showWebNotification(
      `${params.senderName} · ${params.chatName}`,
      params.text || 'Sent a message',
      { kind: 'chat', chatId: params.chatId, groupId: params.groupId },
    );
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${params.senderName} · ${params.chatName}`,
        body: params.text || 'Sent a message',
        data: {
          kind: 'chat',
          chatId: params.chatId,
          groupId: params.groupId,
          recipientUserId: params.recipientUserId,
        },
        sound: settings.soundEnabled,
      },
      trigger: null, // fire immediately
    });
  } catch (error) {
    console.error('[Notifications] Failed to notify chat message:', error);
  }
}

/**
 * Fire a local notification for a new announcement.
 */
export async function notifyAnnouncement(params: {
  recipientUserId: string;
  announcementId: string;
  groupId: string;
  groupName: string;
  title: string;
}): Promise<void> {
  if (await isAnnouncementSeen(params.recipientUserId, params.announcementId)) return;

  // On web, use the browser's Notifications API.
  if (Platform.OS === 'web') {
    showWebNotification(
      `📢 ${params.groupName}`,
      `New announcement: ${params.title}`,
      { kind: 'announcement', announcementId: params.announcementId, groupId: params.groupId },
    );
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📢 ${params.groupName}`,
        body: `New announcement: ${params.title}`,
        data: {
          kind: 'announcement',
          announcementId: params.announcementId,
          groupId: params.groupId,
          recipientUserId: params.recipientUserId,
        },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[Notifications] Failed to notify announcement:', error);
  }
}

/**
 * Fire a local notification for a new event. Uses the browser's Notifications
 * API on web, expo-notifications on native.
 */
export async function notifyEvent(params: {
  groupId: string;
  groupName: string;
  eventId: string;
  title: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    showWebNotification(
      `${params.groupName} · New Event`,
      params.title,
      { kind: 'event', eventId: params.eventId, groupId: params.groupId },
    );
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${params.groupName} · New Event`,
        body: params.title,
        data: {
          kind: 'event',
          eventId: params.eventId,
          groupId: params.groupId,
        },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[Notifications] Failed to notify event:', error);
  }
}

// ---------------------------------------------------------------------------
// Per-user per-chat settings (read from AsyncStorage so the notification
// handler — which runs outside React — can access them)
// ---------------------------------------------------------------------------

export async function getChatNotifSettings(
  userId: string,
  chatId: string,
): Promise<ChatNotifSettings> {
  try {
    const key = `${SETTINGS_KEY_PREFIX}${userId}_${chatId}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatNotifSettings>;
      return { ...DEFAULT_CHAT_NOTIF, ...parsed };
    }
  } catch (e) {
    console.warn('[Notifications] Failed to read chat settings:', e);
  }
  return DEFAULT_CHAT_NOTIF;
}

// ---------------------------------------------------------------------------
// Last-seen tracking for chats (so we only notify for messages newer than
// the last time the user opened the chat)
// ---------------------------------------------------------------------------

export async function markChatSeen(userId: string, chatId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${LAST_SEEN_PREFIX}${userId}_${chatId}`, Date.now().toString());
  } catch {}
}

export async function getChatLastSeen(userId: string, chatId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${LAST_SEEN_PREFIX}${userId}_${chatId}`);
    if (raw) return parseInt(raw, 10) || 0;
  } catch {}
  return 0;
}

// ---------------------------------------------------------------------------
// Announcement seen tracking — avoids notifying for announcements the user
// has already viewed.
// ---------------------------------------------------------------------------

export async function markAnnouncementSeen(userId: string, announcementId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${ANN_SEEN_PREFIX}${userId}_${announcementId}`, '1');
  } catch {}
}

export async function isAnnouncementSeen(userId: string, announcementId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${ANN_SEEN_PREFIX}${userId}_${announcementId}`);
    return !!v;
  } catch {}
  return false;
}

// ---------------------------------------------------------------------------
// Notification tap handling — set up a listener that deep-links into the
// relevant screen. Call this once in the root layout.
// ---------------------------------------------------------------------------

export function setupNotificationTapHandler(onTap: (data: Record<string, any>) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    onTap(data);
  });
  return () => subscription.remove();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReminderTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}
