import { useRouter, useLocalSearchParams } from 'expo-router';
import { Megaphone, Clock, Send, BarChart3, Plus, X, Pencil } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { TranslationKey } from '@/constants/translations';
import { AnnouncementDuration } from '@/types/event';

const DURATION_OPTIONS: { labelKey: TranslationKey; value: AnnouncementDuration; hintKey: TranslationKey }[] = [
  { labelKey: 'dur6h', value: 6, hintKey: 'dur6hHint' },
  { labelKey: 'dur1d', value: 24, hintKey: 'dur1dHint' },
  { labelKey: 'dur3d', value: 72, hintKey: 'dur3dHint' },
  { labelKey: 'dur1w', value: 168, hintKey: 'dur1wHint' },
  { labelKey: 'dur30d', value: 720, hintKey: 'dur30dHint' },
  { labelKey: 'neverExpires', value: 0, hintKey: 'durNeverHint' },
];

export default function CreateAnnouncementScreen() {
  const router = useRouter();
  const { id, announcementId } = useLocalSearchParams<{ id: string; announcementId?: string }>();
  const { createAnnouncement, updateAnnouncement, isCreating, announcements } = useAnnouncements();
  const { getGroupById, isGroupAdmin } = useGroups();
  const { userId, userName } = useUser();
  const { t } = useLanguage();

  const isEditing = Boolean(announcementId);
  const existing = announcementId
    ? announcements.find((a) => a.id === announcementId)
    : null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [durationHours, setDurationHours] = useState<AnnouncementDuration>(168);

  // Poll builder state
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addPollOption = () => {
    if (pollOptions.length >= 6) return;
    setPollOptions((prev) => [...prev, '']);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const group = id ? getGroupById(id) : null;
  const admin = id ? isGroupAdmin(id) : false;

  // Prefill fields when editing an existing announcement.
  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body);
      setDurationHours(existing.durationHours);
      if (existing.poll) {
        setPollEnabled(true);
        setPollQuestion(existing.poll.question);
        setPollOptions(existing.poll.options.map((o) => o.text));
      }
    }
  }, [existing]);

  if (!admin) {
    return (
      <View style={styles.accessDenied}>
        <Megaphone size={48} color="#CCC" />
        <Text style={styles.accessDeniedTitle}>{t('adminsOnly')}</Text>
        <Text style={styles.accessDeniedText}>{isEditing ? t('adminsOnlyEdit') : t('adminsOnlyCreate')}</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('titleRequired'), t('titleRequiredMsg'));
      return;
    }
    if (!body.trim()) {
      Alert.alert(t('messageRequired'), t('messageRequiredMsg'));
      return;
    }
    if (!userId || !id) return;

    // Validate poll if enabled.
    let pollInput: { question: string; options: string[] } | undefined;
    if (pollEnabled) {
      const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!pollQuestion.trim()) {
        Alert.alert(t('pollQuestionRequired'), t('pollQuestionRequiredMsg'));
        return;
      }
      if (cleanOptions.length < 2) {
        Alert.alert(t('pollNeedOptions'), t('pollNeedOptionsMsg'));
        return;
      }
      pollInput = { question: pollQuestion.trim(), options: cleanOptions };
    }

    try {
      if (isEditing && announcementId) {
        await updateAnnouncement(announcementId, {
          title: title.trim(),
          body: body.trim(),
          durationHours,
        });
      } else {
        await createAnnouncement({
          groupId: id,
          title: title.trim(),
          body: body.trim(),
          createdBy: userId,
          createdByName: userName || 'Admin',
          durationHours,
          poll: pollInput,
        });
      }
      router.replace(`/group/${id}` as any);
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || (isEditing ? t('announcementUpdateFailed') : t('announcementCreateFailed')));
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
          {isEditing ? (
            <Pencil size={18} color="#FF6B35" />
          ) : (
            <Megaphone size={18} color="#007AFF" />
          )}
          <Text style={[styles.groupName, isEditing && { color: '#FF6B35' }]}>
            {isEditing ? t('editingAnnouncement') : group?.name || t('titleGroup')}
          </Text>
        </View>

        <Text style={styles.label}>{t('titleLabel')}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={t('announcementTitlePh')}
          placeholderTextColor="#B0B0B0"
          maxLength={80}
        />

        <Text style={styles.label}>{t('messageLabel')}</Text>
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder={t('announcementBodyPh')}
          placeholderTextColor="#B0B0B0"
          multiline
          textAlignVertical="top"
        />

        <View style={styles.sectionHeader}>
          <Clock size={16} color="#666" />
          <Text style={styles.sectionTitle}>{t('visibleFor')}</Text>
        </View>
        <Text style={styles.sectionHint}>{t('visibleForHint')}</Text>

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
                    {t(opt.labelKey)}
                  </Text>
                </View>
                <Text style={[styles.durationHint, selected && styles.durationHintSelected]}>
                  {t(opt.hintKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Poll builder */}
        <View style={styles.sectionHeader}>
          <BarChart3 size={16} color="#666" />
          <Text style={styles.sectionTitle}>{t('poll')}</Text>
        </View>
        <Text style={styles.sectionHint}>{t('pollAttachHint')}</Text>

        <TouchableOpacity
          style={[styles.pollToggle, pollEnabled && styles.pollToggleActive]}
          onPress={() => setPollEnabled((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.pollToggleCircle, pollEnabled && styles.pollToggleCircleActive]}>
            {pollEnabled && <View style={styles.pollToggleDot} />}
          </View>
          <Text style={[styles.pollToggleLabel, pollEnabled && styles.pollToggleLabelActive]}>
            {pollEnabled ? t('pollAttached') : t('addAPoll')}
          </Text>
        </TouchableOpacity>

        {pollEnabled && (
          <View style={styles.pollBuilder}>
            <TextInput
              style={styles.pollQuestionInput}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder={t('pollQuestionPh')}
              placeholderTextColor="#B0B0B0"
              maxLength={120}
            />
            <Text style={styles.pollOptionsLabel}>{t('optionsLabel')}</Text>
            {pollOptions.map((opt, i) => (
              <View key={i} style={styles.pollOptionRow}>
                <TextInput
                  style={styles.pollOptionInput}
                  value={opt}
                  onChangeText={(v) => updatePollOption(i, v)}
                  placeholder={t('optionN', { n: i + 1 })}
                  placeholderTextColor="#B0B0B0"
                  maxLength={80}
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity
                    onPress={() => removePollOption(i)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOptions.length < 6 && (
              <TouchableOpacity
                style={styles.addOptionButton}
                onPress={addPollOption}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#007AFF" />
                <Text style={styles.addOptionText}>{t('addOption')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isCreating || !title.trim() || !body.trim()) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isCreating || !title.trim() || !body.trim()}
          activeOpacity={0.8}
        >
          <Send size={18} color="#FFF" />
          <Text style={styles.submitText}>
            {isCreating ? t('saving') : isEditing ? t('saveChanges') : t('postAnnouncement')}
          </Text>
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
  pollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    marginBottom: 12,
  },
  pollToggleActive: { borderColor: '#007AFF', backgroundColor: '#F0F7FF' },
  pollToggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CCC',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollToggleCircleActive: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  pollToggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  pollToggleLabel: { fontSize: 15, fontWeight: '600' as const, color: '#333' },
  pollToggleLabelActive: { color: '#007AFF' },
  pollBuilder: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    marginBottom: 24,
  },
  pollQuestionInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  pollOptionsLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#666',
    marginBottom: 8,
    marginLeft: 2,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pollOptionInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addOptionText: { fontSize: 15, fontWeight: '600' as const, color: '#007AFF' },
});
