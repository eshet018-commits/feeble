import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signOut,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, FirebaseStorage, uploadString, StringFormat } from 'firebase/storage';
import { Event, Poll, PollOption, Chat, ChatMessage, ChatVisibility, ChatFileAttachment, Announcement, AnnouncementDuration, AnnouncementPollInput, AnnouncementPoll } from '@/types/event';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[Firebase] Configuration check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasDatabaseURL: !!firebaseConfig.databaseURL,
  hasProjectId: !!firebaseConfig.projectId,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
  apiKeyLength: firebaseConfig.apiKey?.length,
  authDomainValue: firebaseConfig.authDomain,
  projectIdValue: firebaseConfig.projectId,
});

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => {
  const value = firebaseConfig[field as keyof typeof firebaseConfig];
  return !value || value === 'undefined' || value === '';
});

if (missingFields.length > 0) {
  console.error('[Firebase] Missing required configuration fields:', missingFields);
  console.error('[Firebase] Please ensure environment variables are set correctly');
  console.error('[Firebase] Required variables: EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_APP_ID');
  throw new Error(`Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

// Always use AsyncStorage-backed auth on native. When "Remember Me" is off,
// persistenceReady signs out any restored session before the UI sees it.
// On web, persistence is configured dynamically in persistenceReady.
const auth: Auth = (() => {
  if (Platform.OS !== 'web') {
    const fbAuth = require('firebase/auth');
    return fbAuth.initializeAuth(app, {
      persistence: fbAuth.getReactNativePersistence(AsyncStorage),
    });
  }
  return getAuth(app);
})();

const REMEMBER_ME_KEY = 'auth_remember_me';

async function getRememberMePreference(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const val = localStorage.getItem(REMEMBER_ME_KEY);
      if (val === 'false') return false;
      if (val === 'true') return true;
    } else {
      const val = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (val === 'false') return false;
      if (val === 'true') return true;
    }
  } catch {}
  return true;
}

function saveRememberMePreference(rememberMe: boolean): void {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
    } else {
      AsyncStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
    }
  } catch {}
}

// On web, set the persistence layer based on the saved preference.
// On native, if "Remember Me" was off the last time the preference was saved,
// sign out any restored session so the user starts fresh.
const persistenceReady: Promise<void> = (async () => {
  const rememberMe = await getRememberMePreference();
  if (Platform.OS === 'web') {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      console.log('[Firebase] Web persistence:', rememberMe ? 'IndexedDB (persistent)' : 'session-only');
    } catch (e) {
      console.warn('[Firebase] Web setPersistence failed:', e);
    }
  } else {
    if (!rememberMe) {
      try {
        await signOut(auth);
        console.log('[Firebase] Signed out persisted session (remember me is off)');
      } catch {
        console.log('[Firebase] No persisted session to clear');
      }
    }
    console.log('[Firebase] Native auth ready (remember me:', rememberMe, ')');
  }
})();

async function setAuthPersistence(rememberMe: boolean): Promise<void> {
  saveRememberMePreference(rememberMe);

  if (Platform.OS === 'web') {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch (e) {
      console.warn('[Firebase] Web setPersistence failed:', e);
    }
  }
  console.log('[Firebase] Remember me preference saved:', rememberMe);
}

let storage: FirebaseStorage | null;
try {
  if (!firebaseConfig.storageBucket || firebaseConfig.storageBucket === 'undefined') {
    console.warn('[Firebase] Storage bucket not configured. Storage features will be disabled.');
    storage = null;
  } else {
    storage = getStorage(app);
    console.log('[Firebase] Storage initialized with bucket:', firebaseConfig.storageBucket);
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize storage:', error);
  storage = null;
}

console.log('[Firebase] Client initialized successfully');

export { auth, storage, setAuthPersistence, persistenceReady };

export const firebaseClient = {
  async createEvent(eventData: {
    groupId: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    categoryId: string;
    repeatFrequency: string;
    repeatEndDate?: string;
    reminders: { id: string; minutes: number; enabled: boolean }[];
    location?: { address: string; latitude: number; longitude: number };
  }) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const event: any = {
      id: eventId,
      groupId: eventData.groupId,
      title: eventData.title,
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      allDay: eventData.allDay,
      categoryId: eventData.categoryId,
      repeatFrequency: eventData.repeatFrequency,
      attachments: [],
      reminders: eventData.reminders,
      createdAt: now,
      updatedAt: now,
    };

    if (eventData.description) {
      event.description = eventData.description;
    }

    if (eventData.repeatEndDate) {
      event.repeatEndDate = eventData.repeatEndDate;
    }

    if (eventData.location) {
      event.location = eventData.location;
    }

    await set(ref(database, `events/${eventId}`), event);
    return { id: eventId, success: true };
  },

  async updateEvent(eventId: string, updates: Partial<Event>) {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startDate) updateData.startDate = updates.startDate;
    if (updates.endDate) updateData.endDate = updates.endDate;
    if (updates.allDay !== undefined) updateData.allDay = updates.allDay;
    if (updates.categoryId) updateData.categoryId = updates.categoryId;
    if (updates.repeatFrequency) updateData.repeatFrequency = updates.repeatFrequency;
    if (updates.repeatEndDate !== undefined) updateData.repeatEndDate = updates.repeatEndDate;
    if (updates.location !== undefined) updateData.location = updates.location;

    await update(ref(database, `events/${eventId}`), updateData);
    
    const snapshot = await get(ref(database, `events/${eventId}`));
    return snapshot.val() as Event;
  },

  async deleteEvent(eventId: string) {
    await remove(ref(database, `events/${eventId}`));
    return { success: true };
  },

  async getGroupEvents(groupId: string) {
    const eventsRef = ref(database, 'events');
    const q = query(eventsRef, orderByChild('groupId'), equalTo(groupId));
    const snapshot = await get(q);

    if (!snapshot.exists()) {
      return [];
    }

    const events = snapshot.val();
    return Object.values(events) as Event[];
  },

  async getAllUserEvents(groupIds: string[]) {
    if (groupIds.length === 0) return [];

    const eventsRef = ref(database, 'events');
    const snapshot = await get(eventsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const allEvents = snapshot.val();
    const events: Event[] = Object.values(allEvents);

    return events.filter(event => groupIds.includes(event.groupId || ''));
  },

  subscribeToGroupEvents(groupId: string, callback: (events: Event[]) => void) {
    const eventsRef = ref(database, 'events');
    const q = query(eventsRef, orderByChild('groupId'), equalTo(groupId));

    onValue(q, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const events = snapshot.val();
      callback(Object.values(events) as Event[]);
    });

    return () => off(q);
  },

  subscribeToUserEvents(groupIds: string[], callback: (events: Event[]) => void) {
    if (groupIds.length === 0) {
      callback([]);
      return () => {};
    }

    const eventsRef = ref(database, 'events');

    onValue(eventsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const allEvents = snapshot.val();
      const events: Event[] = Object.values(allEvents);
      const filtered = events.filter(event => groupIds.includes(event.groupId || ''));
      callback(filtered);
    });

    return () => off(eventsRef);
  },

  async createPoll(eventId: string, question: string, options: PollOption[]) {
    const poll: Poll = {
      id: eventId,
      question,
      options,
      votes: {},
    };
    await set(ref(database, `polls/${eventId}`), poll);
    await update(ref(database, `events/${eventId}`), { hasPoll: true });
    return poll;
  },

  async getPoll(eventId: string): Promise<Poll | null> {
    const snapshot = await get(ref(database, `polls/${eventId}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as Poll;
  },

  subscribeToPoll(eventId: string, callback: (poll: Poll | null) => void) {
    const pollRef = ref(database, `polls/${eventId}`);
    onValue(pollRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback(snapshot.val() as Poll);
    });
    return () => off(pollRef);
  },

  async voteOnPoll(eventId: string, userId: string, optionId: string) {
    await set(ref(database, `polls/${eventId}/votes/${userId}`), optionId);
  },

  async updatePoll(eventId: string, updates: { question?: string; options?: PollOption[] }) {
    const pollData: Record<string, unknown> = {};
    if (updates.question !== undefined) pollData.question = updates.question;
    if (updates.options !== undefined) pollData.options = updates.options;
    await update(ref(database, `polls/${eventId}`), pollData);
  },

  async removePoll(eventId: string) {
    await remove(ref(database, `polls/${eventId}`));
    await update(ref(database, `events/${eventId}`), { hasPoll: false });
  },

  async uploadProfilePicture(userId: string, uri: string) {
    if (!storage) {
      throw new Error('Firebase Storage is not configured. Please set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment variables.');
    }

    try {
      console.log('[Firebase] Starting profile picture upload for user:', userId);
      console.log('[Firebase] Image URI:', uri);
      console.log('[Firebase] Storage bucket:', firebaseConfig.storageBucket);
      
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[Firebase] Blob created, size:', blob.size, 'type:', blob.type);
      
      const timestamp = Date.now();
      const fileName = `${userId}_${timestamp}.jpg`;
      const filePath = `profilePictures/${fileName}`;
      const fileRef = storageRef(storage, filePath);
      console.log('[Firebase] Uploading to path:', filePath);
      
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          userId: userId,
          uploadedAt: new Date().toISOString(),
        },
      };
      
      console.log('[Firebase] Upload metadata:', metadata);
      const uploadResult = await uploadBytes(fileRef, blob, metadata);
      console.log('[Firebase] Upload complete:', uploadResult);
      
      const url = await getDownloadURL(fileRef);
      console.log('[Firebase] Download URL obtained:', url);
      
      await update(ref(database, `users/${userId}`), { profilePicture: url });
      console.log('[Firebase] Profile picture URL saved to database');
      
      return url;
    } catch (error: any) {
      console.error('[Firebase] Profile picture upload error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        serverResponse: error.serverResponse,
        customData: error.customData,
        stack: error.stack,
      });
      
      if (error.code === 'storage/unauthorized') {
        throw new Error('Storage upload not authorized. Please check Firebase Storage rules.');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Storage error. Please ensure Firebase Storage is enabled and rules are configured correctly.');
      }
      
      throw error;
    }
  },

  async getUserProfile(userId: string) {
    const snapshot = await get(ref(database, `users/${userId}`));
    return snapshot.val() || {};
  },

  async updateUserProfile(userId: string, updates: { displayName?: string; profilePicture?: string; userName?: string }) {
    await update(ref(database, `users/${userId}`), updates);
  },

  async createChat(groupId: string, name: string, createdBy: string, visibility: ChatVisibility = 'open'): Promise<Chat> {
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chat: Chat = {
      id: chatId,
      groupId,
      name,
      createdBy,
      visibility,
      createdAt: new Date().toISOString(),
    };
    await set(ref(database, `chats/${chatId}`), chat);
    return chat;
  },

  async updateChat(chatId: string, updates: { name?: string; visibility?: ChatVisibility }): Promise<void> {
    await update(ref(database, `chats/${chatId}`), updates);
  },

  async deleteChat(chatId: string): Promise<void> {
    await remove(ref(database, `chats/${chatId}/messages`));
    await remove(ref(database, `chats/${chatId}`));
  },

  subscribeToGroupChats(groupId: string, callback: (chats: Chat[]) => void) {
    const chatsRef = ref(database, 'chats');

    onValue(chatsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const allChats = snapshot.val();
      const chats: Chat[] = Object.values(allChats);
      const filtered = chats.filter((c) => c.groupId === groupId);
      callback(filtered);
    });

    return () => off(chatsRef);
  },

  /**
   * Subscribe to all chats for a set of group IDs. Used by the background
   * notification listener so a user gets notified for any group they're in.
   */
  subscribeToAllChats(groupIds: string[], callback: (chats: Chat[]) => void) {
    if (groupIds.length === 0) {
      callback([]);
      return () => {};
    }

    const chatsRef = ref(database, 'chats');

    onValue(chatsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const allChats = snapshot.val();
      const chats: Chat[] = Object.values(allChats);
      const filtered = chats.filter((c) => groupIds.includes(c.groupId));
      callback(filtered);
    });

    return () => off(chatsRef);
  },

  /**
   * Subscribe to the messages of every chat in a group set, invoking the
   * callback for each new message as it arrives. Returns an unsubscribe fn.
   * Used by the notification listener.
   */
  subscribeToAllChatMessages(
    groupIds: string[],
    onNewMessage: (chat: Chat, message: ChatMessage) => void,
  ): () => void {
    if (groupIds.length === 0) return () => {};

    const chatsRef = ref(database, 'chats');
    const messageUnsubs: Record<string, () => void> = {};
    let knownChats: Record<string, Chat> = {};

    const syncChatSubscriptions = (chats: Chat[]) => {
      const myChats = chats.filter((c) => groupIds.includes(c.groupId));
      const myChatIds = new Set(myChats.map((c) => c.id));
      knownChats = {};
      myChats.forEach((c) => {
        knownChats[c.id] = c;
      });

      // Subscribe to messages for any new chats.
      for (const chat of myChats) {
        if (messageUnsubs[chat.id]) continue;
        const messagesRef = ref(database, `chats/${chat.id}/messages`);
        const handler = (snapshot: any) => {
          if (!snapshot.exists()) return;
          const data = snapshot.val() as Record<string, ChatMessage>;
          const msgs = Object.values(data).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          const chatObj = knownChats[chat.id];
          if (!chatObj) return;
          for (const m of msgs) onNewMessage(chatObj, m);
        };
        onValue(messagesRef, handler);
        messageUnsubs[chat.id] = () => off(messagesRef);
      }

      // Unsubscribe from removed chats.
      for (const id of Object.keys(messageUnsubs)) {
        if (!myChatIds.has(id)) {
          messageUnsubs[id]?.();
          delete messageUnsubs[id];
          delete knownChats[id];
        }
      }
    };

    onValue(chatsRef, (snapshot) => {
      if (!snapshot.exists()) {
        Object.values(messageUnsubs).forEach((u) => u());
        Object.keys(messageUnsubs).forEach((id) => delete messageUnsubs[id]);
        knownChats = {};
        return;
      }
      const allChats = snapshot.val() as Record<string, Chat>;
      const chats = Object.values(allChats);
      syncChatSubscriptions(chats);
    });

    return () => {
      off(chatsRef);
      Object.values(messageUnsubs).forEach((u) => u());
    };
  },

  async sendMessage(chatId: string, userId: string, userName: string, text: string, replyTo?: { messageId: string; userName: string; text: string }): Promise<ChatMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessage = {
      id: messageId,
      chatId,
      userId,
      userName,
      text,
      createdAt: new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
    };
    await set(ref(database, `chats/${chatId}/messages/${messageId}`), message);
    return message;
  },

  async uploadChatAttachment(chatId: string, userId: string, file: { name: string; uri: string; mimeType: string; size: number }): Promise<ChatFileAttachment> {
    if (!storage) {
      throw new Error('Firebase Storage is not configured. Please set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment variables.');
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const fileName = `${timestamp}_${safeName}`;
      const filePath = `chats/${chatId}/${fileName}`;
      const fileRef = storageRef(storage, filePath);

      const metadata = {
        contentType: file.mimeType || 'application/octet-stream',
        customMetadata: {
          chatId,
          userId,
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
        },
      };

      // Images: fetch -> blob -> uploadBytes. Text-like files: read -> uploadString.
      const isImage = (file.mimeType || '').startsWith('image/');
      const isTextLike = (file.mimeType || '').startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.xml');

      if (isImage || (!isTextLike && Platform.OS !== 'web')) {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(fileRef, blob, metadata);
      } else if (isTextLike && Platform.OS === 'web') {
        const textRes = await fetch(file.uri);
        const text = await textRes.text();
        await uploadString(fileRef, text, StringFormat.RAW, metadata);
      } else {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(fileRef, blob, metadata);
      }

      const url = await getDownloadURL(fileRef);
      return {
        name: file.name,
        url,
        type: file.mimeType || 'application/octet-stream',
        size: file.size,
      };
    } catch (error: any) {
      console.error('[Firebase] Chat attachment upload error:', {
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse,
        bucket: firebaseConfig.storageBucket,
      });
      // Surface the server response so the real cause is visible.
      const serverHint = error.serverResponse ? ` (Server: ${error.serverResponse})` : '';
      if (error.code === 'storage/unauthorized' || error.code === 'storage/unknown') {
        throw new Error(
          `Upload failed (${error.code}). Open Firebase Console → Storage and click "Get started" to provision the bucket, then check the security rules allow authenticated writes.${serverHint}`
        );
      }
      throw new Error(error.message || 'Upload failed' + serverHint);
    }
  },

  async sendFileMessage(chatId: string, userId: string, userName: string, attachment: ChatFileAttachment, text: string = '', replyTo?: { messageId: string; userName: string; text: string }): Promise<ChatMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessage = {
      id: messageId,
      chatId,
      userId,
      userName,
      text,
      attachment,
      createdAt: new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
    };
    await set(ref(database, `chats/${chatId}/messages/${messageId}`), message);
    return message;
  },

  /**
   * Permanently deletes messages older than the retention window from the database.
   * Runs lazily when a chat is opened so no server functions are required.
   * @param chatId Chat to clean up
   * @param retentionDays Messages older than this many days are removed (default 7)
   */
  async cleanupOldMessages(chatId: string, retentionDays: number = 7): Promise<void> {
    try {
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const snapshot = await get(messagesRef);
      if (!snapshot.exists()) return;

      const now = Date.now();
      const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
      const messagesData = snapshot.val() as Record<string, ChatMessage>;

      const staleIds = Object.entries(messagesData)
        .filter(([, msg]) => {
          const ts = new Date(msg.createdAt).getTime();
          return isNaN(ts) || ts < cutoff;
        })
        .map(([key]) => key);

      if (staleIds.length === 0) return;

      const updates: Record<string, null> = {};
      staleIds.forEach((id) => {
        updates[`chats/${chatId}/messages/${id}`] = null;
      });
      await update(ref(database), updates);
      console.log(`[Firebase] Deleted ${staleIds.length} expired message(s) from chat ${chatId}`);
    } catch (error) {
      console.warn('[Firebase] Message cleanup failed:', error);
    }
  },

  subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

    // Lazily purge expired messages whenever a client opens the chat.
    this.cleanupOldMessages(chatId).catch(() => { /* errors are logged inside */ });

    onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const messagesData = snapshot.val() as Record<string, ChatMessage>;
      const now = Date.now();
      const messages: ChatMessage[] = Object.values(messagesData)
        .filter((msg) => {
          const ts = new Date(msg.createdAt).getTime();
          return !isNaN(ts) && now - ts < RETENTION_MS;
        });
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(messages);
    });

    return () => off(messagesRef);
  },

  // ---------------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------------

  /**
   * Create an announcement for a group. Only admins should call this.
   */
  async createAnnouncement(data: {
    groupId: string;
    title: string;
    body: string;
    createdBy: string;
    createdByName: string;
    durationHours: AnnouncementDuration;
    poll?: AnnouncementPollInput;
  }): Promise<Announcement> {
    const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const createdAt = now.toISOString();

    let expiresAt: string | undefined;
    if (data.durationHours > 0) {
      expiresAt = new Date(now.getTime() + data.durationHours * 60 * 60 * 1000).toISOString();
    }

    let poll: AnnouncementPoll | undefined;
    if (data.poll && data.poll.options.filter((o) => o.trim()).length >= 2) {
      poll = {
        question: data.poll.question.trim(),
        options: data.poll.options
          .map((text, i) => ({ id: `opt_${i}`, text: text.trim() }))
          .filter((o) => o.text),
        votes: {},
      };
    }

    const announcement: Announcement = {
      id,
      groupId: data.groupId,
      title: data.title,
      body: data.body,
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdAt,
      durationHours: data.durationHours,
      ...(expiresAt ? { expiresAt } : {}),
      ...(poll ? { poll } : {}),
    };

    await set(ref(database, `announcements/${id}`), announcement);
    return announcement;
  },

  /**
   * Update an existing announcement (title, body, and/or duration).
   */
  async updateAnnouncement(id: string, updates: Partial<Pick<Announcement, 'title' | 'body' | 'durationHours'>>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.durationHours !== undefined) {
      updateData.durationHours = updates.durationHours;
      if (updates.durationHours > 0) {
        updateData.expiresAt = new Date(Date.now() + updates.durationHours * 60 * 60 * 1000).toISOString();
      } else {
        updateData.expiresAt = null;
      }
    }
    await update(ref(database, `announcements/${id}`), updateData);
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await remove(ref(database, `announcements/${id}`));
  },

  /**
   * Cast or change a user's vote on an announcement poll. Each user gets one vote.
   */
  async voteOnAnnouncementPoll(announcementId: string, userId: string, optionId: string): Promise<void> {
    await set(ref(database, `announcements/${announcementId}/poll/votes/${userId}`), optionId);
  },

  /**
   * Subscribe to all announcements for a group. Expired announcements are
   * lazily pruned and excluded from the callback.
   */
  subscribeToAnnouncements(groupId: string, callback: (announcements: Announcement[]) => void) {
    const annRef = ref(database, 'announcements');

    // Lazily delete expired announcements on subscribe.
    this.cleanupExpiredAnnouncements(groupId).catch(() => { /* logged inside */ });

    onValue(annRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const now = Date.now();
      const all = snapshot.val() as Record<string, Announcement>;
      const list = Object.values(all)
        .filter((a) => a.groupId === groupId)
        .filter((a) => {
          if (!a.expiresAt) return true;
          const ts = new Date(a.expiresAt).getTime();
          return !isNaN(ts) && ts > now;
        })
        .map((a) => ({
          ...a,
          poll: a.poll ? { ...a.poll, votes: a.poll.votes || {} } : a.poll,
        }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    });

    return () => off(annRef);
  },

  /**
   * Subscribe to all announcements across a set of groups. Invokes the
   * callback once with the initial snapshot and then again whenever data
   * changes. Used by the notification listener.
   */
  subscribeToAllAnnouncements(
    groupIds: string[],
    callback: (announcements: Announcement[]) => void,
  ): () => void {
    if (groupIds.length === 0) {
      callback([]);
      return () => {};
    }

    const annRef = ref(database, 'announcements');

    onValue(annRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const now = Date.now();
      const all = snapshot.val() as Record<string, Announcement>;
      const list = Object.values(all)
        .filter((a) => groupIds.includes(a.groupId))
        .filter((a) => {
          if (!a.expiresAt) return true;
          const ts = new Date(a.expiresAt).getTime();
          return !isNaN(ts) && ts > now;
        })
        .map((a) => ({
          ...a,
          poll: a.poll ? { ...a.poll, votes: a.poll.votes || {} } : a.poll,
        }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    });

    return () => off(annRef);
  },

  // ---------------------------------------------------------------------------
  // Push notification tokens — each user's Expo push token is stored under
  // `pushTokens/{userId}` so other devices can look it up and send remote
  // pushes that appear on the iPhone home screen even when the app is closed.
  // ---------------------------------------------------------------------------

  /**
   * Save (or replace) the Expo push token for a user.
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    await set(ref(database, `pushTokens/${userId}`), {
      token,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Remove the stored push token for a user (e.g. on sign-out).
   */
  async removePushToken(userId: string): Promise<void> {
    await remove(ref(database, `pushTokens/${userId}`));
  },

  /**
   * Look up the Expo push token for a single user. Returns null if none.
   */
  async getPushToken(userId: string): Promise<string | null> {
    const snapshot = await get(ref(database, `pushTokens/${userId}`));
    if (!snapshot.exists()) return null;
    const val = snapshot.val();
    return (val && val.token) || null;
  },

  /**
   * Look up Expo push tokens for many users at once. Only users with a stored
   * token are included in the result. Use this to fan-out a remote push to all
   * members of a group.
   */
  async getPushTokensForUsers(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    const result: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const token = await this.getPushToken(uid);
        if (token) result[uid] = token;
      }),
    );
    return result;
  },

  /**
   * Get the Expo push tokens for every member of a group, optionally excluding
   * one user (e.g. the sender so they don't notify themselves).
   */
  async getGroupMemberPushTokens(groupId: string, excludeUserId?: string): Promise<Record<string, string>> {
    const membersRef = ref(database, 'members');
    const q = query(membersRef, orderByChild('groupId'), equalTo(groupId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return {};

    const members = Object.values(snapshot.val()) as Array<{ userId: string; groupId: string }>;
    const userIds = members
      .filter((m) => m.groupId === groupId && m.userId !== excludeUserId)
      .map((m) => m.userId);

    return this.getPushTokensForUsers(userIds);
  },

  /**
   * Permanently delete expired announcements for a group from the database.
   */
  async cleanupExpiredAnnouncements(groupId: string): Promise<void> {
    try {
      const annRef = ref(database, 'announcements');
      const snapshot = await get(annRef);
      if (!snapshot.exists()) return;

      const now = Date.now();
      const all = snapshot.val() as Record<string, Announcement>;
      const staleIds = Object.entries(all)
        .filter(([, a]) => a.groupId === groupId)
        .filter(([, a]) => {
          if (!a.expiresAt) return false;
          const ts = new Date(a.expiresAt).getTime();
          return !isNaN(ts) && ts <= now;
        })
        .map(([key]) => key);

      if (staleIds.length === 0) return;

      const updates: Record<string, null> = {};
      staleIds.forEach((aid) => {
        updates[`announcements/${aid}`] = null;
      });
      await update(ref(database), updates);
      console.log(`[Firebase] Deleted ${staleIds.length} expired announcement(s) in group ${groupId}`);
    } catch (error) {
      console.warn('[Firebase] Announcement cleanup failed:', error);
    }
  },
};
