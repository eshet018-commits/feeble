import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chat, ChatMessage, ChatVisibility, ChatFileAttachment, ChatSettings } from '@/types/event';
import { useUser } from './UserContext';
import { useGroups } from './GroupContext';
import { firebaseClient } from '@/lib/firebase-client';
import {
  setActiveChat as setGlobalActiveChat,
  isActiveChat,
  notifyChatMessage,
  markChatSeen,
  getChatLastSeen,
  getChatNotifSettings,
} from '@/utils/notifications';
import { useNotifications } from './NotificationContext';

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  showTimestamps: true,
  showSenderNames: true,
  enterToSend: false,
};

const SETTINGS_KEY_PREFIX = 'chat_settings_';

function settingsKey(userId: string | undefined, chatId: string): string {
  return `${SETTINGS_KEY_PREFIX}${userId ?? 'anon'}_${chatId}`;
}

export const [ChatProvider, useChats] = createContextHook(() => {
  const { userId, userName } = useUser();
  const { groups } = useGroups();
  const { showNotification } = useNotifications();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<Record<string, ChatSettings>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});
  const unsubscribeRefs = useRef<Record<string, (() => void) | undefined>>({});
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const groupIdsKey = groups.map((g) => g.id).join(',');

  // ---------------------------------------------------------------------------
  // Background notification listener — subscribes to messages across every
  // group the user is a member of and fires a local notification for any
  // message that isn't theirs and isn't in the chat they're currently viewing.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!userId || !groupIdsKey) return;
    const groupIds = groupIdsKey.split(',').filter(Boolean);
    if (groupIds.length === 0) return;

    const unsub = firebaseClient.subscribeToAllChatMessages(
      groupIds,
      async (chat, message) => {
        if (message.userId === userId) return; // skip own messages
        if (notifiedMessageIds.current.has(message.id)) return;
        notifiedMessageIds.current.add(message.id);
        // Add a small cap to avoid unbounded growth.
        if (notifiedMessageIds.current.size > 500) {
          notifiedMessageIds.current = new Set(
            Array.from(notifiedMessageIds.current).slice(-300),
          );
        }

        // Suppress notifications for the chat the user is currently viewing.
        if (isActiveChat(chat.id)) return;

        // Respect the per-chat notification settings (notifications on/off).
        // This makes the toggle work both ways: enable → banners show,
        // disable → banners (and native alerts) are suppressed.
        const settings = await getChatNotifSettings(userId, chat.id);
        if (!settings.notificationsEnabled) return;

        // Instant in-app banner (works on all platforms, including web).
        showNotification({
          kind: 'chat',
          title: `${message.userName} · ${chat.name}`,
          body: message.text || (message.attachment ? message.attachment.name : '') || 'Sent a message',
          data: {
            chatId: chat.id,
            groupId: chat.groupId,
            recipientUserId: userId,
          },
        });
        // Also fire a native system notification where supported (respects
        // sound / vibration settings internally).
        notifyChatMessage({
          recipientUserId: userId,
          chatId: chat.id,
          groupId: chat.groupId,
          chatName: chat.name,
          senderName: message.userName,
          text: message.text || (message.attachment ? message.attachment.name : ''),
        }).catch(() => {});
      },
    );

    return () => unsub();
  }, [userId, groupIdsKey, showNotification]);

  useEffect(() => {
    return () => {
      Object.values(unsubscribeRefs.current).forEach((unsub) => {
        if (unsub) unsub();
      });
    };
  }, []);

  const subscribeToChats = useCallback((groupId: string) => {
    const unsub = firebaseClient.subscribeToGroupChats(groupId, (newChats) => {
      setChats(newChats);
    });
    return unsub;
  }, []);

  const subscribeToMessages = useCallback((chatId: string) => {
    if (unsubscribeRefs.current[chatId]) {
      unsubscribeRefs.current[chatId]?.();
    }

    // Track this chat as active so the notification handler suppresses alerts for it.
    setGlobalActiveChat(chatId);
    setActiveChatId(chatId);
    if (userId) {
      markChatSeen(userId, chatId).catch(() => {});
    }

    const unsub = firebaseClient.subscribeToMessages(chatId, (newMessages) => {
      setMessages((prev) => ({ ...prev, [chatId]: newMessages }));
    });

    unsubscribeRefs.current[chatId] = unsub;
    return unsub;
  }, [userId]);

  const createChat = useCallback(
    async (groupId: string, name: string, visibility: ChatVisibility = 'open') => {
      if (!userId) throw new Error('User not authenticated');
      return await firebaseClient.createChat(groupId, name, userId, visibility);
    },
    [userId]
  );

  const updateChat = useCallback(
    async (chatId: string, updates: { name?: string; visibility?: ChatVisibility }) => {
      await firebaseClient.updateChat(chatId, updates);
    },
    []
  );

  const deleteChat = useCallback(async (chatId: string) => {
    await firebaseClient.deleteChat(chatId);
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    if (unsubscribeRefs.current[chatId]) {
      unsubscribeRefs.current[chatId]?.();
      delete unsubscribeRefs.current[chatId];
    }
    setMessages((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, [activeChatId]);

  const sendMessage = useCallback(
    async (chatId: string, text: string, replyTo?: { messageId: string; userName: string; text: string }) => {
      if (!userId) throw new Error('User not authenticated');
      if (!text.trim()) throw new Error('Message cannot be empty');
      await firebaseClient.sendMessage(chatId, userId, userName, text.trim(), replyTo);
    },
    [userId, userName]
  );

  const sendFileMessage = useCallback(
    async (chatId: string, file: { name: string; uri: string; mimeType: string; size: number }, caption?: string, replyTo?: { messageId: string; userName: string; text: string }) => {
      if (!userId) throw new Error('User not authenticated');
      const attachment = await firebaseClient.uploadChatAttachment(chatId, userId, file);
      await firebaseClient.sendFileMessage(chatId, userId, userName, attachment, caption?.trim() || '', replyTo);
    },
    [userId, userName]
  );

  const getMessagesForChat = useCallback(
    (chatId: string): ChatMessage[] => {
      return messages[chatId] || [];
    },
    [messages]
  );

  const loadChatSettings = useCallback(
    async (chatId: string): Promise<ChatSettings> => {
      if (!userId) return DEFAULT_CHAT_SETTINGS;
      const key = settingsKey(userId, chatId);
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ChatSettings>;
          const merged: ChatSettings = { ...DEFAULT_CHAT_SETTINGS, ...parsed };
          setChatSettings((prev) => ({ ...prev, [chatId]: merged }));
          return merged;
        }
      } catch (e) {
        console.warn('[Chat] Failed to load settings:', e);
      }
      setChatSettings((prev) => ({ ...prev, [chatId]: DEFAULT_CHAT_SETTINGS }));
      return DEFAULT_CHAT_SETTINGS;
    },
    [userId]
  );

  const updateChatSettings = useCallback(
    async (chatId: string, updates: Partial<ChatSettings>): Promise<void> => {
      if (!userId) return;
      const current = chatSettings[chatId] ?? DEFAULT_CHAT_SETTINGS;
      const next: ChatSettings = { ...current, ...updates };
      setChatSettings((prev) => ({ ...prev, [chatId]: next }));
      const key = settingsKey(userId, chatId);
      try {
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.warn('[Chat] Failed to save settings:', e);
      }
    },
    [userId, chatSettings]
  );

  return {
    chats,
    messages,
    activeChatId,
    chatSettings,
    settingsLoading,
    subscribeToChats,
    subscribeToMessages,
    createChat,
    updateChat,
    deleteChat,
    sendMessage,
    sendFileMessage,
    getMessagesForChat,
    loadChatSettings,
    updateChatSettings,
  };
});
