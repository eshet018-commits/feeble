import { ref, onValue, get, off } from 'firebase/database';
import { database, isConfigured, authReadyPromise } from './firebase';

/**
 * Backend push notification service.
 *
 * Listens to Firebase Realtime Database for new chat messages, announcements,
 * and events. When a new item is created, it looks up the Expo push tokens of
 * all group members and sends real remote push notifications via the Expo Push
 * API. These are delivered by APNs/FCM to the device's home screen / lock
 * screen even when the app is fully closed or backgrounded.
 *
 * This runs on the backend (always-on server process) so notifications are
 * sent regardless of whether any client app is open.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SEEN_CAP = 5000;

// ---------------------------------------------------------------------------
// Type definitions for Firebase data shapes
// ---------------------------------------------------------------------------

interface ChatMessageData {
  id: string;
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachment?: { name: string };
}

interface AnnouncementData {
  id: string;
  groupId: string;
  title: string;
  body: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  durationHours: number;
  expiresAt?: string;
}

interface EventData {
  id: string;
  groupId: string;
  title: string;
  createdAt: string;
}

interface ChatData {
  id: string;
  groupId: string;
  name: string;
  createdBy: string;
}

interface PushTokenEntry {
  token: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Caches & seen-ID tracking
// ---------------------------------------------------------------------------

const groupNameCache = new Map<string, string>();
const chatCache = new Map<string, { groupId: string; name: string }>();

const seenMessageIds = new Set<string>();
const seenAnnouncementIds = new Set<string>();
const seenEventIds = new Set<string>();

const chatMessageUnsubs = new Map<string, () => void>();
const initializedChats = new Set<string>();
let announcementsInitialized = false;
let eventsInitialized = false;
let groupsInitialized = false;
let chatsInitialized = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trimSet(set: Set<string>): void {
  if (set.size <= SEEN_CAP) return;
  const arr = Array.from(set).slice(-Math.floor(SEEN_CAP * 0.6));
  set.clear();
  for (const id of arr) set.add(id);
}

async function getGroupName(groupId: string): Promise<string> {
  const cached = groupNameCache.get(groupId);
  if (cached) return cached;
  if (!database) return 'Group';
  try {
    const snap = await get(ref(database, `groups/${groupId}`));
    if (snap.exists()) {
      const name = (snap.val() as any)?.name || 'Group';
      groupNameCache.set(groupId, name);
      return name;
    }
  } catch {}
  return 'Group';
}

async function getGroupMemberTokens(
  groupId: string,
  excludeUserId?: string,
): Promise<string[]> {
  if (!database) return [];
  const db = database;
  try {
    const membersSnap = await get(ref(db, 'members'));
    if (!membersSnap.exists()) return [];

    const members = Object.values(membersSnap.val()) as Array<{
      userId: string;
      groupId: string;
    }>;
    const userIds = members
      .filter((m) => m.groupId === groupId && m.userId !== excludeUserId)
      .map((m) => m.userId);

    if (userIds.length === 0) return [];

    const tokens: string[] = [];
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const tokenSnap = await get(ref(db, `pushTokens/${uid}`));
          if (tokenSnap.exists()) {
            const data = tokenSnap.val() as PushTokenEntry;
            if (data?.token) tokens.push(data.token);
          }
        } catch {}
      }),
    );
    return tokens;
  } catch (error) {
    console.warn('[PushService] Failed to get member tokens:', error);
    return [];
  }
}

/**
 * Get group member push tokens, excluding any user who has muted the given
 * chat. Reads `chatNotifSettings/{userId}/{chatId}` from Firebase.
 */
async function getGroupMemberTokensForChat(
  groupId: string,
  chatId: string,
  excludeUserId?: string,
): Promise<string[]> {
  if (!database) return [];
  const db = database;
  try {
    const membersSnap = await get(ref(db, 'members'));
    if (!membersSnap.exists()) return [];

    const members = Object.values(membersSnap.val()) as Array<{
      userId: string;
      groupId: string;
    }>;
    const userIds = members
      .filter((m) => m.groupId === groupId && m.userId !== excludeUserId)
      .map((m) => m.userId);

    if (userIds.length === 0) return [];

    const tokens: string[] = [];
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          // Check per-chat mute setting.
          const prefSnap = await get(ref(db, `chatNotifSettings/${uid}/${chatId}`));
          if (prefSnap.exists()) {
            const pref = prefSnap.val() as { notificationsEnabled?: boolean };
            if (pref?.notificationsEnabled === false) return; // muted — skip
          }
          const tokenSnap = await get(ref(db, `pushTokens/${uid}`));
          if (tokenSnap.exists()) {
            const data = tokenSnap.val() as PushTokenEntry;
            if (data?.token) tokens.push(data.token);
          }
        } catch {}
      }),
    );
    return tokens;
  } catch (error) {
    console.warn('[PushService] Failed to get member tokens:', error);
    return [];
  }
}

async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;

  // Expo Push API accepts up to 100 messages per request.
  const batches: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    batches.push(tokens.slice(i, i + 100));
  }

  for (const batch of batches) {
    const messages = batch.map((to) => ({
      to,
      title,
      body,
      data: data || {},
      sound: true,
      priority: 'high',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as any;

      if (json?.errors) {
        console.warn('[PushService] Expo Push API errors:', json.errors);
      }
      if (Array.isArray(json?.data)) {
        let ok = 0;
        let fail = 0;
        for (const ticket of json.data) {
          if (ticket?.status === 'error') {
            fail++;
            console.warn(
              '[PushService] Push ticket error:',
              ticket.message,
              ticket.details,
            );
          } else {
            ok++;
          }
        }
        console.log(
          `[PushService] Push batch: ${ok} delivered, ${fail} failed (${batch.length} tokens)`,
        );
      }
    } catch (error) {
      console.warn('[PushService] Failed to send push batch:', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Chat message listener
// ---------------------------------------------------------------------------

function subscribeToChatMessages(chatId: string): void {
  if (!database || chatMessageUnsubs.has(chatId)) return;

  const messagesRef = ref(database, `chats/${chatId}/messages`);

  const unsub = onValue(
    messagesRef,
    (snapshot) => {
      if (!initializedChats.has(chatId)) {
        // First load — mark all existing messages as seen, don't push.
        if (snapshot.exists()) {
          const msgs = snapshot.val() as Record<string, ChatMessageData>;
          Object.keys(msgs).forEach((id) => seenMessageIds.add(id));
        }
        initializedChats.add(chatId);
        return;
      }

      if (!snapshot.exists()) return;

      const msgs = snapshot.val() as Record<string, ChatMessageData>;
      for (const [msgId, msg] of Object.entries(msgs)) {
        if (seenMessageIds.has(msgId)) continue;
        seenMessageIds.add(msgId);
        trimSet(seenMessageIds);

        handleNewChatMessage(chatId, msg).catch((e) =>
          console.warn('[PushService] Chat message handler error:', e),
        );
      }
    },
    (error) => {
      console.warn(`[PushService] Messages listener error for ${chatId}:`, error);
    },
  );

  chatMessageUnsubs.set(chatId, () => off(messagesRef));
}

async function handleNewChatMessage(
  chatId: string,
  msg: ChatMessageData,
): Promise<void> {
  const meta = chatCache.get(chatId);
  if (!meta) return;

  const title = `${msg.userName} · ${meta.name}`;
  const body = msg.text || (msg.attachment ? msg.attachment.name : 'Sent a message');

  const tokens = await getGroupMemberTokensForChat(
    meta.groupId,
    chatId,
    msg.userId,
  );
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, title, body, {
    kind: 'chat',
    chatId,
    groupId: meta.groupId,
  });
}

function startChatListener(): void {
  if (!database) return;

  const chatsRef = ref(database, 'chats');
  onValue(
    chatsRef,
    (snapshot) => {
      const newChatIds = new Set<string>();

      if (snapshot.exists()) {
        const chats = snapshot.val() as Record<string, ChatData>;
        for (const [id, chat] of Object.entries(chats)) {
          chatCache.set(id, { groupId: chat.groupId, name: chat.name });
          newChatIds.add(id);

          if (!chatMessageUnsubs.has(id)) {
            subscribeToChatMessages(id);
          }
        }
      }

      // Unsubscribe from removed chats.
      for (const [chatId, unsub] of chatMessageUnsubs) {
        if (!newChatIds.has(chatId)) {
          unsub();
          chatMessageUnsubs.delete(chatId);
          chatCache.delete(chatId);
          initializedChats.delete(chatId);
        }
      }

      if (!chatsInitialized) {
        chatsInitialized = true;
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        console.log(
          `[PushService] Chat listener initialized — ${count} existing chat(s)`,
        );
      }
    },
    (error) => {
      console.warn('[PushService] Chats listener error:', error);
    },
  );
}

// ---------------------------------------------------------------------------
// Announcement listener
// ---------------------------------------------------------------------------

async function handleNewAnnouncement(ann: AnnouncementData): Promise<void> {
  const groupName = await getGroupName(ann.groupId);
  const title = `📢 ${groupName}`;
  const body = `New announcement: ${ann.title}`;

  const tokens = await getGroupMemberTokens(ann.groupId, ann.createdBy);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, title, body, {
    kind: 'announcement',
    announcementId: ann.id,
    groupId: ann.groupId,
  });
}

function startAnnouncementListener(): void {
  if (!database) return;

  const annRef = ref(database, 'announcements');
  onValue(
    annRef,
    (snapshot) => {
      if (!announcementsInitialized) {
        if (snapshot.exists()) {
          const all = snapshot.val() as Record<string, AnnouncementData>;
          Object.keys(all).forEach((id) => seenAnnouncementIds.add(id));
        }
        announcementsInitialized = true;
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        console.log(
          `[PushService] Announcement listener initialized — ${count} existing`,
        );
        return;
      }

      if (!snapshot.exists()) return;

      const all = snapshot.val() as Record<string, AnnouncementData>;
      const now = Date.now();

      for (const [id, ann] of Object.entries(all)) {
        if (seenAnnouncementIds.has(id)) continue;
        seenAnnouncementIds.add(id);
        trimSet(seenAnnouncementIds);

        // Skip expired announcements.
        if (ann.expiresAt) {
          const ts = new Date(ann.expiresAt).getTime();
          if (!isNaN(ts) && ts <= now) continue;
        }

        handleNewAnnouncement(ann).catch((e) =>
          console.warn('[PushService] Announcement handler error:', e),
        );
      }
    },
    (error) => {
      console.warn('[PushService] Announcements listener error:', error);
    },
  );
}

// ---------------------------------------------------------------------------
// Event listener
// ---------------------------------------------------------------------------

async function handleNewEvent(ev: EventData): Promise<void> {
  const groupName = await getGroupName(ev.groupId);
  const title = `${groupName} · New Event`;
  const body = ev.title;

  // We don't have the creator's userId in the event data directly,
  // so we can't exclude anyone. The creator will get a push too,
  // but the client-side setNotificationHandler can suppress it if
  // they're the one who created it (they'll be on that screen).
  const tokens = await getGroupMemberTokens(ev.groupId);

  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, title, body, {
    kind: 'event',
    eventId: ev.id,
    groupId: ev.groupId,
  });
}

function startEventListener(): void {
  if (!database) return;

  const eventsRef = ref(database, 'events');
  onValue(
    eventsRef,
    (snapshot) => {
      if (!eventsInitialized) {
        if (snapshot.exists()) {
          const all = snapshot.val() as Record<string, EventData>;
          Object.keys(all).forEach((id) => seenEventIds.add(id));
        }
        eventsInitialized = true;
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        console.log(
          `[PushService] Event listener initialized — ${count} existing`,
        );
        return;
      }

      if (!snapshot.exists()) return;

      const all = snapshot.val() as Record<string, EventData>;

      for (const [id, ev] of Object.entries(all)) {
        if (seenEventIds.has(id)) continue;
        seenEventIds.add(id);
        trimSet(seenEventIds);

        handleNewEvent(ev).catch((e) =>
          console.warn('[PushService] Event handler error:', e),
        );
      }
    },
    (error) => {
      console.warn('[PushService] Events listener error:', error);
    },
  );
}

// ---------------------------------------------------------------------------
// Group name cache listener
// ---------------------------------------------------------------------------

function startGroupListener(): void {
  if (!database) return;

  const groupsRef = ref(database, 'groups');
  onValue(
    groupsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const groups = snapshot.val() as Record<string, any>;
        for (const [id, group] of Object.entries(groups)) {
          if (group?.name) groupNameCache.set(id, group.name);
        }
      }
      if (!groupsInitialized) {
        groupsInitialized = true;
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        console.log(
          `[PushService] Group listener initialized — ${count} group(s)`,
        );
      }
    },
    (error) => {
      console.warn('[PushService] Groups listener error:', error);
    },
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start all Firebase listeners and begin sending push notifications for new
 * chat messages, announcements, and events. Call once when the backend starts.
 */
export function startPushService(): void {
  if (!database || !isConfigured) {
    console.warn(
      '[PushService] Firebase not configured — push service disabled',
    );
    return;
  }

  console.log('[PushService] Starting backend push notification service...');

  // Wait for anonymous auth to complete before starting listeners.
  // Without auth, Firebase security rules reject every read with
  // PERMISSION_DENIED and no pushes are ever sent.
  const startListeners = () => {
    // Start the group name cache first so announcement/event handlers have names.
    startGroupListener();
    startChatListener();
    startAnnouncementListener();
    startEventListener();
    console.log('[PushService] All listeners started — monitoring for new content');
  };

  if (authReadyPromise) {
    console.log('[PushService] Waiting for backend auth before starting listeners...');
    authReadyPromise.then(() => {
      startListeners();
    }).catch((err) => {
      console.warn('[PushService] Auth wait failed, starting listeners anyway:', err);
      startListeners();
    });
  } else {
    startListeners();
  }
}
