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
import { Event, Poll, PollOption, Chat, ChatMessage, ChatVisibility, ChatFileAttachment } from '@/types/event';

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

  subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
    const messagesRef = ref(database, `chats/${chatId}/messages`);

    onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const messagesData = snapshot.val();
      const messages: ChatMessage[] = Object.values(messagesData);
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(messages);
    });

    return () => off(messagesRef);
  },
};
