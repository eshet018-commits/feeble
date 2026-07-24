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
import { useLanguage } from '@/contexts/LanguageContext';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, updateGroup, deleteGroup, isGroupAdmin, toggleChatEnabled } = useGroups();
  const { t } = useLanguage();

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
        <Text>{t('accessDenied')}</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('groupNameEmpty'));
      return;
    }

    if (!inviteCode.trim()) {
      Alert.alert(t('error'), t('inviteCodeEmpty'));
      return;
    }

    setIsSaving(true);
    try {
      await updateGroup(id!, {
        name: name.trim(),
        description: description.trim() || undefined,
        inviteCode: inviteCode.trim(),
      });
      Alert.alert(t('success'), t('settingsUpdated'), [
        { text: t('ok'), onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Failed to update group:', error);
      const errorMessage = error?.message || t('settingsUpdateFailed');
      Alert.alert(t('error'), errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      t('deleteGroup'),
      t('deleteGroupConfirm', { name: group.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
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
          title: t('titleGroupSettings'),
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
                {isSaving ? t('saving') : t('save')}
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
          <Text style={styles.sectionTitle}>{t('groupInformation')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('groupName')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('enterGroupName')}
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('descriptionOptional')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('addGroupDescriptionPh')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={200}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('inviteCodeLabel')}</Text>
            <TextInput
              style={styles.input}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder={t('enterCustomInviteCode')}
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={styles.helperText}>{t('shareCodeHelper')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('chatSection')}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MessageCircle size={22} color="#007AFF" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>{t('groupChat')}</Text>
                <Text style={styles.settingDescription}>{t('groupChatDesc')}</Text>
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
                  Alert.alert(t('error'), error?.message || t('toggleChatFailed'));
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
              <Text style={styles.manageChatsText}>{t('manageChats')}</Text>
              <ChevronRight size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dangerZone')}</Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteGroup}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>{t('deleteGroup')}</Text>
          </TouchableOpacity>

          <Text style={styles.deleteWarning}>{t('deleteGroupWarning')}</Text>
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