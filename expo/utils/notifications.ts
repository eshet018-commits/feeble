import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Event } from '@/types/event';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Register for remote push notifications and return the Expo push token.
 * On web or when permissions are denied, returns null.
 * The token is cached locally so we don't re-register on every launch.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.log('[Notifications] Permissions not granted');
    return null;
  }

  // Return cached token if we already have one.
  try {
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cached) return cached;
  } catch {}

  try {
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('[Notifications] Push token:', token);
    return token;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
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
  if (Platform.OS === 'web') return;
  if (isActiveChat(params.chatId)) return;

  const settings = await getChatNotifSettings(params.recipientUserId, params.chatId);
  if (!settings.notificationsEnabled) return;

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
  if (Platform.OS === 'web') return;

  if (await isAnnouncementSeen(params.recipientUserId, params.announcementId)) return;

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
