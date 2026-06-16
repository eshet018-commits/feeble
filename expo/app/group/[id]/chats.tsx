import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { MessageCircle, Plus, Trash2, Lock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useGroups } from '@/contexts/GroupContext';
import { useChats } from '@/contexts/ChatContext';
import { Chat } from '@/types/event';

export default function ChatsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, isGroupAdmin } = useGroups();
  const {
    chats,
    subscribeToChats,
    createChat,
    deleteChat,
  } = useChats();

  const group = getGroupById(id!);
  const isAdmin = isGroupAdmin(id!);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToChats(id);
    return () => { unsub(); };
  }, [id, subscribeToChats]);

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  if (!group.chatEnabled) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chats' }} />
        <View style={styles.disabledState}>
          <Lock size={48} color="#CCC" strokeWidth={1.5} />
          <Text style={styles.disabledTitle}>Chat is Disabled</Text>
          <Text style={styles.disabledSubtitle}>
            The group admin has not enabled chat for this group yet.
          </Text>
        </View>
      </View>
    );
  }

  const handleCreateChat = async () => {
    const name = newChatName.trim();
    if (!name) {
      Alert.alert('Error', 'Please enter a chat name');
      return;
    }
    setIsCreating(true);
    try {
      await createChat(id!, name);
      setNewChatName('');
      setShowCreateModal(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create chat');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteChat = (chat: Chat) => {
    Alert.alert(
      'Delete Chat',
      `Delete "${chat.name}" and all its messages? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chat.id);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Chats',
          headerRight: () =>
            isAdmin ? (
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                style={styles.headerButton}
              >
                <Plus size={22} color="#007AFF" />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {chats.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color="#CCC" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Chats Yet</Text>
            <Text style={styles.emptySubtitle}>
              {isAdmin
                ? 'Create a chat to start the conversation'
                : 'No chats have been created yet'}
            </Text>
          </View>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatCard}
              onPress={() =>
                router.push(
                  `/group/${id}/chat/${chat.id}` as any
                )
              }
              activeOpacity={0.7}
              onLongPress={() => isAdmin && handleDeleteChat(chat)}
            >
              <View style={styles.chatIconContainer}>
                <MessageCircle size={22} color="#007AFF" />
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{chat.name}</Text>
                <Text style={styles.chatMeta}>
                  Created {formatDate(chat.createdAt)}
                </Text>
              </View>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => handleDeleteChat(chat)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCreateModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Chat</Text>
            <TextInput
              style={styles.modalInput}
              value={newChatName}
              onChangeText={setNewChatName}
              placeholder="Chat name (e.g. General, Planning)"
              placeholderTextColor="#999"
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleCreateChat}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewChatName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  (!newChatName.trim() || isCreating) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateChat}
                disabled={!newChatName.trim() || isCreating}
              >
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chatIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 4,
  },
  chatMeta: {
    fontSize: 13,
    color: '#999',
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  disabledState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  disabledSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500' as const,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#007AFF',
  },
  createButtonDisabled: {
    backgroundColor: '#B0D0FF',
  },
  createButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600' as const,
  },
});
