import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Chat, ChatMessage } from '@/types/event';
import { useUser } from './UserContext';
import { firebaseClient } from '@/lib/firebase-client';

export const [ChatProvider, useChats] = createContextHook(() => {
  const { userId, userName } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
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
    async (groupId: string, name: string) => {
      if (!userId) throw new Error('User not authenticated');
      return await firebaseClient.createChat(groupId, name, userId);
    },
    [userId]
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
    async (chatId: string, text: string) => {
      if (!userId) throw new Error('User not authenticated');
      if (!text.trim()) throw new Error('Message cannot be empty');
      await firebaseClient.sendMessage(chatId, userId, userName, text.trim());
    },
    [userId, userName]
  );

  const getMessagesForChat = useCallback(
    (chatId: string): ChatMessage[] => {
      return messages[chatId] || [];
    },
    [messages]
  );

  return {
    chats,
    messages,
    activeChatId,
    subscribeToChats,
    subscribeToMessages,
    createChat,
    deleteChat,
    sendMessage,
    getMessagesForChat,
  };
});
