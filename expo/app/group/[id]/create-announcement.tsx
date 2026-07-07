import { useRouter, useLocalSearchParams } from 'expo-router';
import { Megaphone, Clock, Send } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnnouncements } from '@/contexts/AnnouncementContext';
import { useGroups } from '@/contexts/GroupContext';
import { useUser } from '@/contexts/UserContext';
import { AnnouncementDuration } from '@/types/event';

const DURATION_OPTIONS: { label: string; value: AnnouncementDuration; hint: string }[] = [
  { label: '6 hours', value: 6, hint: 'Good for quick reminders' },
  { label: '1 day', value: 24, hint: 'Visible for a day' },
  { label: '3 days', value: 72, hint: 'A few days of visibility' },
  { label: '1 week', value: 168, hint: 'A full week' },
  { label: '30 days', value: 720, hint: 'Long-lasting' },
  { label: 'Never expires', value: 0, hint: 'Stays until deleted' },
];

export default function CreateAnnouncementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { createAnnouncement, isCreating } = useAnnouncements();
  const { getGroupById, isGroupAdmin } = useGroups();
  const { userId, userName } = useUser();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [durationHours, setDurationHours] = useState<AnnouncementDuration>(168);

  const group = id ? getGroupById(id) : null;
  const admin = id ? isGroupAdmin(id) : false;

  if (!admin) {
    return (
      <View style={styles.accessDenied}>
        <Megaphone size={48} color="#CCC" />
        <Text style={styles.accessDeniedTitle}>Admins Only</Text>
        <Text style={styles.accessDeniedText}>Only group admins can create announcements.</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your announcement a title.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Message required', 'Write the message for your announcement.');
      return;
    }
    if (!userId || !id) return;

    try {
      await createAnnouncement({
        groupId: id,
        title: title.trim(),
        body: body.trim(),
        createdBy: userId,
        createdByName: userName || 'Admin',
        durationHours,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create announcement');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.groupRow}>
          <Megaphone size={18} color="#007AFF" />
          <Text style={styles.groupName}>{group?.name || 'Group'}</Text>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Announcement title"
          placeholderTextColor="#B0B0B0"
          maxLength={80}
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Share an update with your group..."
          placeholderTextColor="#B0B0B0"
          multiline
          textAlignVertical="top"
        />

        <View style={styles.sectionHeader}>
          <Clock size={16} color="#666" />
          <Text style={styles.sectionTitle}>Visible for</Text>
        </View>
        <Text style={styles.sectionHint}>
          Announcements appear at the top of the group page. After the duration they are deleted automatically.
        </Text>

        <View style={styles.durationGrid}>
          {DURATION_OPTIONS.map((opt) => {
            const selected = durationHours === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.durationCard, selected && styles.durationCardSelected]}
                onPress={() => setDurationHours(opt.value)}
                activeOpacity={0.7}
              >
                <View style={styles.durationCardHeader}>
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                  <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                    {opt.label}
                  </Text>
                </View>
                <Text style={[styles.durationHint, selected && styles.durationHintSelected]}>
                  {opt.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isCreating || !title.trim() || !body.trim()) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isCreating || !title.trim() || !body.trim()}
          activeOpacity={0.8}
        >
          <Send size={18} color="#FFF" />
          <Text style={styles.submitText}>{isCreating ? 'Posting...' : 'Post Announcement'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  groupName: { fontSize: 15, fontWeight: '600' as const, color: '#007AFF' },
  label: { fontSize: 14, fontWeight: '700' as const, color: '#333', marginBottom: 8, marginLeft: 2 },
  titleInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#000',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  bodyInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    minHeight: 120,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    lineHeight: 22,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#333' },
  sectionHint: { fontSize: 13, color: '#999', marginBottom: 14, lineHeight: 18 },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  durationCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
  },
  durationCardSelected: { borderColor: '#007AFF', backgroundColor: '#F0F7FF' },
  durationCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CCC',
    backgroundColor: '#FFF',
  },
  radioSelected: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  durationLabel: { fontSize: 15, fontWeight: '600' as const, color: '#333' },
  durationLabelSelected: { color: '#007AFF' },
  durationHint: { fontSize: 12, color: '#999', paddingLeft: 26 },
  durationHintSelected: { color: '#3B82F6' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: 'rgba(245,245,247,0.95)',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
  },
  submitButtonDisabled: { backgroundColor: '#B0CFFF' },
  submitText: { color: '#FFF', fontSize: 17, fontWeight: '700' as const },
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#F5F5F7' },
  accessDeniedTitle: { fontSize: 22, fontWeight: '700' as const, color: '#000', marginTop: 16, marginBottom: 6 },
  accessDeniedText: { fontSize: 15, color: '#666', textAlign: 'center' },
});
