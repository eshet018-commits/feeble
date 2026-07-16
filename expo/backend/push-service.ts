import { database, messaging, isConfigured, isApnsToken, sendApnsPush } from './firebase';

/**
 * Backend push notification service using Firebase Admin SDK.
 *
 * Uses the Admin SDK which bypasses all security rules — no more
 * PERMISSION_DENIED errors. Listens to the Realtime Database for new chat
 * messages, announcements, and events. When new content is created, it sends
 * real push notifications:
 *   - FCM tokens (web) via FCM HTTP v1 API
 *   - APNs tokens (iOS) via direct APNs HTTP/2 API using .p8 key
 *   - Expo push tokens (legacy) via the Expo Push API
 *
 * These are delivered to the device's home screen / lock screen even when the
 * app is fully closed or backgrounded.
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

const chatMessageCallbacks = new Map<string, (a: any, b: any) => void>();
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
    const snap = await database.ref(`groups/${groupId}`).get();
    if (snap.exists()) {
      const name = (snap.val() as any)?.name || 'Group';
      groupNameCache.set(groupId, name);
      return name;
    }
  } catch {}
  return 'Group';
}

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken');
}

async function getGroupMemberTokens(
  groupId: string,
  excludeUserId?: string,
): Promise<string[]> {
  if (!database) return [];
  const db = database;
  try {
    const membersSnap = await db.ref('members').get();
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
          const tokenSnap = await db.ref(`pushTokens/${uid}`).get();
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

async function getGroupMemberTokensForChat(
  groupId: string,
  chatId: string,
  excludeUserId?: string,
): Promise<string[]> {
  if (!database) return [];
  const db = database;
  try {
    const membersSnap = await db.ref('members').get();
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
          const prefSnap = await db.ref(`chatNotifSettings/${uid}/${chatId}`).get();
          if (prefSnap.exists()) {
            const pref = prefSnap.val() as { notificationsEnabled?: boolean };
            if (pref?.notificationsEnabled === false) return;
          }
          const tokenSnap = await db.ref(`pushTokens/${uid}`).get();
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
 * Send push notifications to a list of tokens. FCM tokens (web) are sent via
 * admin.messaging(); Expo push tokens (native) are sent via the Expo Push API.
 */
async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;

  // Categorize tokens into three groups: Expo, APNs (direct), and FCM.
  // APNs tokens are sent directly via APNs HTTP/2 API — completely independent
  // of Firebase auth. This ensures iOS pushes work even when Firebase OAuth
  // is broken (the 401 DB errors don't affect APNs delivery).
  const expoTokens = tokens.filter((t) => isExpoPushToken(t));
  const apnsTokens = tokens.filter((t) => !isExpoPushToken(t) && isApnsToken(t));
  const fcmTokens = tokens.filter((t) => !isExpoPushToken(t) && !isApnsToken(t));

  console.log(`[PushService] Token breakdown: ${fcmTokens.length} FCM, ${apnsTokens.length} APNs, ${expoTokens.length} Expo`);

  const messageData: Record<string, string> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      messageData[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }

  // Send APNs tokens directly via APNs HTTP/2 API (no Firebase dependency).
  if (apnsTokens.length > 0) {
    console.log(`[PushService] Sending ${apnsTokens.length} push(es) via direct APNs`);
    let apnsOk = 0;
    let apnsFail = 0;
    await Promise.all(
      apnsTokens.map(async (tok) => {
        try {
          const success = await sendApnsPush({
            token: tok,
            title,
            body,
            data: messageData,
            priority: 'high',
          });
          if (success) apnsOk++;
          else apnsFail++;
        } catch {
          apnsFail++;
        }
      }),
    );
    console.log(`[PushService] APNs direct: ${apnsOk} delivered, ${apnsFail} failed (${apnsTokens.length} tokens)`);
  }

  // Send FCM tokens via FCM HTTP v1 API (requires Firebase auth).
  if (fcmTokens.length > 0 && messaging) {
    try {
      const batchChunks: string[][] = [];
      for (let i = 0; i < fcmTokens.length; i += 500) {
        batchChunks.push(fcmTokens.slice(i, i + 500));
      }

      for (const chunk of batchChunks) {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: messageData,
          android: { priority: 'high' },
        });

        let ok = 0;
        let fail = 0;
        for (const r of response.responses) {
          if (r.success) ok++;
          else fail++;
        }
        console.log(
          `[PushService] FCM batch: ${ok} delivered, ${fail} failed (${chunk.length} tokens)`,
        );
      }
    } catch (error) {
      console.warn('[PushService] FCM send failed:', error);
    }
  }

  // Send Expo pushes (native tokens) via the Expo Push API.
  if (expoTokens.length > 0) {
    for (let i = 0; i < expoTokens.length; i += 100) {
      const batch = expoTokens.slice(i, i + 100);
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
              console.warn('[PushService] Push ticket error:', ticket.message, ticket.details);
            } else {
              ok++;
            }
          }
          console.log(
            `[PushService] Expo batch: ${ok} delivered, ${fail} failed (${batch.length} tokens)`,
          );
        }
      } catch (error) {
        console.warn('[PushService] Failed to send Expo push batch:', error);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Chat message listener
// ---------------------------------------------------------------------------

function subscribeToChatMessages(chatId: string): void {
  if (!database || chatMessageUnsubs.has(chatId)) return;

  const messagesRef = database.ref(`chats/${chatId}/messages`);

  const callback = (snapshot: any) => {
    if (!initializedChats.has(chatId)) {
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
  };

  const errorCallback = (error: any) => {
    console.warn(`[PushService] Messages listener error for ${chatId}:`, error);
  };

  messagesRef.on('value', callback, errorCallback);
  chatMessageCallbacks.set(chatId, callback);
  chatMessageUnsubs.set(chatId, () => messagesRef.off('value', callback));
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

  const chatsRef = database.ref('chats');
  const callback = (snapshot: any) => {
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

    for (const [chatId, unsub] of chatMessageUnsubs) {
      if (!newChatIds.has(chatId)) {
        unsub();
        chatMessageUnsubs.delete(chatId);
        chatMessageCallbacks.delete(chatId);
        chatCache.delete(chatId);
        initializedChats.delete(chatId);
      }
    }

    if (!chatsInitialized) {
      chatsInitialized = true;
      const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      console.log(`[PushService] Chat listener initialized — ${count} existing chat(s)`);
    }
  };

  const errorCallback = (error: any) => {
    console.warn('[PushService] Chats listener error:', error);
  };

  chatsRef.on('value', callback, errorCallback);
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

  const annRef = database.ref('announcements');
  const callback = (snapshot: any) => {
    if (!announcementsInitialized) {
      if (snapshot.exists()) {
        const all = snapshot.val() as Record<string, AnnouncementData>;
        Object.keys(all).forEach((id) => seenAnnouncementIds.add(id));
      }
      announcementsInitialized = true;
      const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      console.log(`[PushService] Announcement listener initialized — ${count} existing`);
      return;
    }

    if (!snapshot.exists()) return;

    const all = snapshot.val() as Record<string, AnnouncementData>;
    const now = Date.now();

    for (const [id, ann] of Object.entries(all)) {
      if (seenAnnouncementIds.has(id)) continue;
      seenAnnouncementIds.add(id);
      trimSet(seenAnnouncementIds);

      if (ann.expiresAt) {
        const ts = new Date(ann.expiresAt).getTime();
        if (!isNaN(ts) && ts <= now) continue;
      }

      handleNewAnnouncement(ann).catch((e) =>
        console.warn('[PushService] Announcement handler error:', e),
      );
    }
  };

  const errorCallback = (error: any) => {
    console.warn('[PushService] Announcements listener error:', error);
  };

  annRef.on('value', callback, errorCallback);
}

// ---------------------------------------------------------------------------
// Event listener
// ---------------------------------------------------------------------------

async function handleNewEvent(ev: EventData): Promise<void> {
  const groupName = await getGroupName(ev.groupId);
  const title = `${groupName} · New Event`;
  const body = ev.title;

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

  const eventsRef = database.ref('events');
  const callback = (snapshot: any) => {
    if (!eventsInitialized) {
      if (snapshot.exists()) {
        const all = snapshot.val() as Record<string, EventData>;
        Object.keys(all).forEach((id) => seenEventIds.add(id));
      }
      eventsInitialized = true;
      const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      console.log(`[PushService] Event listener initialized — ${count} existing`);
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
  };

  const errorCallback = (error: any) => {
    console.warn('[PushService] Events listener error:', error);
  };

  eventsRef.on('value', callback, errorCallback);
}

// ---------------------------------------------------------------------------
// Group name cache listener
// ---------------------------------------------------------------------------

function startGroupListener(): void {
  if (!database) return;

  const groupsRef = database.ref('groups');
  const callback = (snapshot: any) => {
    if (snapshot.exists()) {
      const groups = snapshot.val() as Record<string, any>;
      for (const [id, group] of Object.entries(groups)) {
        if (group?.name) groupNameCache.set(id, group.name);
      }
    }
    if (!groupsInitialized) {
      groupsInitialized = true;
      const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      console.log(`[PushService] Group listener initialized — ${count} group(s)`);
    }
  };

  const errorCallback = (error: any) => {
    console.warn('[PushService] Groups listener error:', error);
  };

  groupsRef.on('value', callback, errorCallback);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startPushService(): void {
  if (!database || !isConfigured) {
    console.warn('[PushService] Firebase not configured — push service disabled');
    return;
  }

  console.log('[PushService] Starting backend push notification service (Admin SDK)...');
  startGroupListener();
  startChatListener();
  startAnnouncementListener();
  startEventListener();
  console.log('[PushService] All listeners started — monitoring for new content');
}
