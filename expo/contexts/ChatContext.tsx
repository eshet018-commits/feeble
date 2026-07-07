import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chat, ChatMessage, ChatVisibility, ChatFileAttachment, ChatSettings } from '@/types/event';
import { useUser } from './UserContext';
import { firebaseClient } from '@/lib/firebase-client';

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
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<Record<string, ChatSettings>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});
  const unsubscribeRefs = useRef<Record<string, (() => void) | undefined>>({});

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

    const unsub = firebaseClient.subscribeToMessages(chatId, (newMessages) => {
      setMessages((prev) => ({ ...prev, [chatId]: newMessages }));
    });

    unsubscribeRefs.current[chatId] = unsub;
    setActiveChatId(chatId);
    return unsub;
  }, []);

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
