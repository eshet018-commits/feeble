import { useRouter } from 'expo-router';
import { UserPlus, Users } from 'lucide-react-native';
import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { joinGroupWithCode } = useGroups();
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { t } = useLanguage();

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert(t('error'), t('enterGroupCode'));
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinGroupWithCode(inviteCode.trim());
      
      if (result.success) {
        Alert.alert(
          t('success'),
          `${t('youJoined')} ${result.groupName}`,
          [
            {
              text: t('viewGroup'),
              onPress: () => {
                router.replace('/');
                setTimeout(() => {
                  router.push({ pathname: '/group/[id]', params: { id: result.groupId } });
                }, 100);
              },
            },
          ]
        );
      } else {
        Alert.alert(t('error'), result.error || t('invalidGroupCode'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('joinFailed'));
      console.error('Join group error:', error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('joinGroup')}</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View style={styles.iconContainer}>
              <Users size={48} color="#007AFF" />
            </View>

            <Text style={styles.title}>{t('joinGroupTitle')}</Text>
            <Text style={styles.description}>
              {t('joinGroupDescription')}
            </Text>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t('groupCode')}</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., group-abc123..."
                placeholderTextColor="#999"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                editable={!isJoining}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (!inviteCode.trim() || isJoining) && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinGroup}
              disabled={!inviteCode.trim() || isJoining}
              activeOpacity={0.7}
            >
              <UserPlus size={20} color="#FFF" />
              <Text style={styles.joinButtonText}>
                {isJoining ? t('joining') : t('joinGroup')}
              </Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('whatIsGroupCode')}</Text>
              <Text style={styles.infoText}>
                {t('groupCodeInfo')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
  },
  contentInner: {
    padding: 24,
    paddingBottom: 60,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    color: '#000',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  infoBox: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
