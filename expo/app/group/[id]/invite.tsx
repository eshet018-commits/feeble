import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserPlus, Copy, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import * as Clipboard from 'expo-clipboard';

export default function InviteMembersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById } = useGroups();
  const { t } = useLanguage();
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const group = getGroupById(id!);
  const membersQuery = trpc.groups.getMembers.useQuery(
    { groupId: id! },
    { enabled: !!id }
  );
  const members = membersQuery.data || [];

  const groupInviteCode = group?.inviteCode || `group-${id}`;

  const handleCopyCode = async () => {
    if (!groupInviteCode) return;
    await Clipboard.setStringAsync(groupInviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) return;

    if (inviteCode === groupInviteCode) {
      Alert.alert(t('error'), t('cannotJoinOwnGroup'));
      return;
    }

    Alert.alert('Info', 'Invite code functionality requires a backend to validate and add members.');
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>{t('groupNotFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{t('done')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('inviteMembers')}</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.iconContainer}>
            <UserPlus size={40} color="#007AFF" />
          </View>
          <Text style={styles.sectionTitle}>{t('shareGroupCode')}</Text>
          <Text style={styles.sectionDescription}>
            {t('shareCodeDesc', { name: group.name })}
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{groupInviteCode}</Text>
          </View>

          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyCode}
            activeOpacity={0.7}
          >
            {copied ? (
              <Check size={20} color="#FFF" />
            ) : (
              <Copy size={20} color="#FFF" />
            )}
            <Text style={styles.copyButtonText}>
              {copied ? t('copied') : t('copyCode')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('joinAnotherGroup')}</Text>
          <Text style={styles.sectionDescription}>{t('joinAsViewerDesc')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('enterGroupCodePh')}
            placeholderTextColor="#999"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[
              styles.joinButton,
              !inviteCode.trim() && styles.joinButtonDisabled,
            ]}
            onPress={handleJoinWithCode}
            disabled={!inviteCode.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.joinButtonText}>{t('joinGroup')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{t('currentMembers')} ({members.length})</Text>
          {members.map((member, index) => (
            <View key={member.id} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{t('memberCap')} {member.userId.slice(-8)}</Text>
                <Text style={styles.memberRole}>
                  {member.role === 'admin' ? t('adminRole') : t('viewerRole')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  safeArea: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    paddingVertical: 8,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  codeContainer: {
    backgroundColor: '#F5F5F7',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#007AFF',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#999',
    marginHorizontal: 16,
  },
  input: {
    width: '100%',
    fontSize: 17,
    color: '#000',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    marginBottom: 16,
  },
  joinButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#CCC',
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  infoSection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#000',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    color: '#999',
  },
});
