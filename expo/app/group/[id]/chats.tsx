import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { MessageCircle, Plus, Trash2, Lock, Eye, EyeOff, MessageSquareX } from 'lucide-react-native';
import React, { useEffect, useState, useMemo } from 'react';
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
import { Chat, ChatVisibility } from '@/types/event';

const VISIBILITY_OPTIONS: { value: ChatVisibility; label: string; icon: typeof Eye; description: string }[] = [
  { value: 'open', label: 'Open', icon: Eye, description: 'Everyone can view and type' },
  { value: 'readonly', label: 'Read-Only', icon: MessageSquareX, description: 'Everyone can view, only admins can type' },
  { value: 'admin-only', label: 'Admin Only', icon: EyeOff, description: 'Only admins can view and type' },
];

const VISIBILITY_LABELS: Record<ChatVisibility, string> = {
  'open': 'Open',
  'admin-only': 'Admin Only',
  'readonly': 'Read-Only',
};

const VISIBILITY_COLORS: Record<ChatVisibility, string> = {
  'open': '#34C759',
  'admin-only': '#FF3B30',
  'readonly': '#FF9500',
};

export default function ChatsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, isGroupAdmin } = useGroups();
  const {
    chats,
    subscribeToChats,
    createChat,
    updateChat,
    deleteChat,
  } = useChats();

  const group = getGroupById(id!);
  const isAdmin = isGroupAdmin(id!);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatVisibility, setNewChatVisibility] = useState<ChatVisibility>('open');
  const [isCreating, setIsCreating] = useState(false);

  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [editVisibility, setEditVisibility] = useState<ChatVisibility>('open');

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToChats(id);
    return () => { unsub(); };
  }, [id, subscribeToChats]);

  const visibleChats = useMemo(() => {
    if (isAdmin) return chats;
    return chats.filter((c) => c.visibility !== 'admin-only');
  }, [chats, isAdmin]);

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
      await createChat(id!, name, newChatVisibility);
      setNewChatName('');
      setNewChatVisibility('open');
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

  const openEditVisibility = (chat: Chat) => {
    setEditingChat(chat);
    setEditVisibility(chat.visibility);
  };

  const handleSaveVisibility = async () => {
    if (!editingChat) return;
    try {
      await updateChat(editingChat.id, { visibility: editVisibility });
      setEditingChat(null);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update chat');
    }
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
        {visibleChats.length === 0 ? (
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
          visibleChats.map((chat) => {
            const isReadonlyForUser = !isAdmin && chat.visibility === 'readonly';
            const visibilityColor = VISIBILITY_COLORS[chat.visibility];

            return (
              <TouchableOpacity
                key={chat.id}
                style={styles.chatCard}
                onPress={() =>
                  router.push(
                    `/group/${id}/chat/${chat.id}` as any
                  )
                }
                onLongPress={() => {
                  if (isAdmin) openEditVisibility(chat);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.chatIconContainer}>
                  {chat.visibility === 'admin-only' ? (
                    <EyeOff size={20} color={visibilityColor} />
                  ) : chat.visibility === 'readonly' ? (
                    <MessageSquareX size={20} color={visibilityColor} />
                  ) : (
                    <MessageCircle size={20} color="#007AFF" />
                  )}
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatNameRow}>
                    <Text style={styles.chatName}>{chat.name}</Text>
                    <View style={[styles.visibilityBadge, { backgroundColor: visibilityColor + '20' }]}>
                      <Text style={[styles.visibilityBadgeText, { color: visibilityColor }]}>
                        {VISIBILITY_LABELS[chat.visibility]}
                      </Text>
                    </View>
                    {isReadonlyForUser && (
                      <View style={[styles.visibilityBadge, { backgroundColor: '#FF950020' }]}>
                        <Text style={[styles.visibilityBadgeText, { color: '#FF9500' }]}>
                          View Only
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chatMeta}>
                    Created {formatDate(chat.createdAt)}
                  </Text>
                </View>
                {isAdmin && (
                  <View style={styles.chatActions}>
                    <TouchableOpacity
                      onPress={() => openEditVisibility(chat)}
                      style={styles.editVisButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editVisButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteChat(chat)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Create Chat Modal */}
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

            <Text style={styles.sectionLabel}>Visibility</Text>
            <View style={styles.visibilityOptions}>
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = newChatVisibility === opt.value;
                const color = VISIBILITY_COLORS[opt.value];
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.visibilityOption,
                      isSelected && { borderColor: color, backgroundColor: color + '10' },
                    ]}
                    onPress={() => setNewChatVisibility(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Icon size={18} color={isSelected ? color : '#999'} />
                    <View style={styles.visibilityOptionText}>
                      <Text style={[styles.visibilityOptionLabel, isSelected && { color, fontWeight: '600' as const }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.visibilityOptionDesc}>{opt.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewChatName('');
                  setNewChatVisibility('open');
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

      {/* Edit Visibility Modal */}
      <Modal
        visible={editingChat !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingChat(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditingChat(null)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Chat</Text>
            {editingChat && (
              <Text style={styles.editChatName}>{editingChat.name}</Text>
            )}

            <Text style={styles.sectionLabel}>Visibility</Text>
            <View style={styles.visibilityOptions}>
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = editVisibility === opt.value;
                const color = VISIBILITY_COLORS[opt.value];
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.visibilityOption,
                      isSelected && { borderColor: color, backgroundColor: color + '10' },
                    ]}
                    onPress={() => setEditVisibility(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Icon size={18} color={isSelected ? color : '#999'} />
                    <View style={styles.visibilityOptionText}>
                      <Text style={[styles.visibilityOptionLabel, isSelected && { color, fontWeight: '600' as const }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.visibilityOptionDesc}>{opt.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingChat(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveVisibility}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  chatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  visibilityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visibilityBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  chatMeta: {
    fontSize: 13,
    color: '#999',
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  editVisButton: {
    padding: 4,
  },
  editVisButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500' as const,
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
  editChatName: {
    fontSize: 15,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
  },
  modalInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 10,
  },
  visibilityOptions: {
    gap: 8,
    marginBottom: 20,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  visibilityOptionText: {
    flex: 1,
  },
  visibilityOptionLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#333',
    marginBottom: 2,
  },
  visibilityOptionDesc: {
    fontSize: 12,
    color: '#999',
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
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600' as const,
  },
});
