import { useRouter } from 'expo-router';
import { Shield, Eye } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@/types/event';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { role, updateRole } = useUser();
  const { t } = useLanguage();

  const selectRole = async (newRole: UserRole) => {
    await updateRole(newRole);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('selectYourRole')}</Text>
        <Text style={styles.subtitle}>
          {t('chooseHowToUse')}
        </Text>

        <View style={styles.rolesContainer}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'admin' && styles.roleCardActive]}
            onPress={() => selectRole('admin')}
            activeOpacity={0.7}
          >
            <View
              style={[styles.iconContainer, role === 'admin' && styles.iconContainerActive]}
            >
              <Shield size={32} color={role === 'admin' ? '#FFF' : '#007AFF'} />
            </View>
            <Text style={styles.roleTitle}>{t('adminRole')}</Text>
            <Text style={styles.roleDescription}>
              {t('adminRoleDesc')}
            </Text>
            {role === 'admin' && <View style={styles.checkmark} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, role === 'viewer' && styles.roleCardActive]}
            onPress={() => selectRole('viewer')}
            activeOpacity={0.7}
          >
            <View
              style={[styles.iconContainer, role === 'viewer' && styles.iconContainerActive]}
            >
              <Eye size={32} color={role === 'viewer' ? '#FFF' : '#666'} />
            </View>
            <Text style={styles.roleTitle}>{t('viewerRole')}</Text>
            <Text style={styles.roleDescription}>
              {t('viewerRoleDesc')}
            </Text>
            {role === 'viewer' && <View style={styles.checkmark} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F8FBFF',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainerActive: {
    backgroundColor: '#007AFF',
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
});
