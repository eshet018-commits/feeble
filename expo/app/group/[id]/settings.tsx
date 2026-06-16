import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Trash2, MessageCircle, ChevronRight } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';

import { useGroups } from '@/contexts/GroupContext';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, updateGroup, deleteGroup, isGroupAdmin, toggleChatEnabled } = useGroups();

  const group = getGroupById(id!);
  const isAdmin = isGroupAdmin(id!);

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [inviteCode, setInviteCode] = useState(group?.inviteCode || '');
  const [chatEnabled, setChatEnabled] = useState(group?.chatEnabled || false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingChat, setIsTogglingChat] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || '');
      setInviteCode(group.inviteCode || '');
      setChatEnabled(group.chatEnabled || false);
    }
  }, [group]);

  if (!group || !isAdmin) {
    return (
      <View style={styles.container}>
        <Text>Access denied</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Invite code cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateGroup(id!, {
        name: name.trim(),
        description: description.trim() || undefined,
        inviteCode: inviteCode.trim(),
      });
      Alert.alert('Success', 'Group settings updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Failed to update group:', error);
      const errorMessage = error?.message || 'Failed to update group settings';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This will also delete all events in this group. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup(id!);
            router.replace('/');
          },
        },
      ]
    );
  };

  const hasChanges = 
    name !== group.name || 
    description !== (group.description || '') ||
    inviteCode !== (group.inviteCode || '');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Group Settings',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasChanges || isSaving}
              style={styles.headerButton}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  (!hasChanges || isSaving) && styles.saveButtonTextDisabled,
                ]}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter group name"
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description for this group"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={200}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Invite Code</Text>
            <TextInput
              style={styles.input}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Enter custom invite code"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={styles.helperText}>
              Share this code with people to invite them to your group
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MessageCircle size={22} color="#007AFF" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Group Chat</Text>
                <Text style={styles.settingDescription}>
                  Allow members to send messages in real-time
                </Text>
              </View>
            </View>
            <Switch
              value={chatEnabled}
              onValueChange={async (value) => {
                setChatEnabled(value);
                setIsTogglingChat(true);
                try {
                  await toggleChatEnabled(id!, value);
                } catch (error: any) {
                  setChatEnabled(!value);
                  Alert.alert('Error', error?.message || 'Failed to toggle chat');
                } finally {
                  setIsTogglingChat(false);
                }
              }}
              disabled={isTogglingChat}
              trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
              thumbColor="#FFF"
            />
          </View>

          {chatEnabled && (
            <TouchableOpacity
              style={styles.manageChatsButton}
              onPress={() => router.push(`/group/${id}/chats` as any)}
              activeOpacity={0.7}
            >
              <MessageCircle size={18} color="#007AFF" />
              <Text style={styles.manageChatsText}>Manage Chats</Text>
              <ChevronRight size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteGroup}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Group</Text>
          </TouchableOpacity>

          <Text style={styles.deleteWarning}>
            Deleting this group will permanently remove all events and member access.
            This action cannot be undone.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  saveButtonTextDisabled: {
    color: '#CCC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FF3B30',
  },
  deleteWarning: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  manageChatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 10,
  },
  manageChatsText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#007AFF',
  },
});