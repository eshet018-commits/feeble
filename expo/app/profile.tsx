import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { auth } from '@/lib/firebase-client';
import {
  requestNotificationPermissions,
  registerForPushNotifications,
  getNotificationPermissionStatus,
  type PermissionStatus,
} from '@/utils/notifications';
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateEmail } from 'firebase/auth';
import { LogOut, User, Mail, Save, Lock, Key, AtSign, Bell, BellOff, ChevronRight } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { userName, userEmail, userId, updateUserName, displayName, updateDisplayName } = useUser();
  const [newName, setNewName] = useState(userName);
  const [newUserId, setNewUserId] = useState(displayName || userName);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('undetermined');
  const [notifLoading, setNotifLoading] = useState(false);

  const handleSaveChanges = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (!newUserId.trim()) {
      Alert.alert('Error', 'User ID cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      await updateUserName(newName.trim());
      await updateDisplayName(newUserId.trim());
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('[Profile] Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!emailPassword || !newEmail || !confirmEmail) {
      Alert.alert('Error', 'Please fill in all email fields');
      return;
    }

    if (newEmail !== confirmEmail) {
      Alert.alert('Error', 'Email addresses do not match');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === userEmail.toLowerCase()) {
      Alert.alert('Error', 'New email must be different from current email');
      return;
    }

    setIsChangingEmail(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert('Error', 'No user is currently signed in');
        return;
      }

      console.log('[Profile] Reauthenticating user for email change...');
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(user, credential);
      console.log('[Profile] Reauthentication successful');

      console.log('[Profile] Updating email...');
      await updateEmail(user, newEmail);
      console.log('[Profile] Email updated successfully');

      setEmailPassword('');
      setNewEmail('');
      setConfirmEmail('');
      Alert.alert('Success', 'Email changed successfully. Please verify your new email address.');
    } catch (error: any) {
      console.error('[Profile] Email change error:', error);
      
      let errorMessage = 'Failed to change email';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use by another account';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing your email';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert('Error', 'No user is currently signed in');
        return;
      }

      console.log('[Profile] Reauthenticating user...');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      console.log('[Profile] Reauthentication successful');

      console.log('[Profile] Updating password...');
      await updatePassword(user, newPassword);
      console.log('[Profile] Password updated successfully');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (error: any) {
      console.error('[Profile] Password change error:', error);
      
      let errorMessage = 'Failed to change password';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing your password';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };



  const refreshNotifStatus = async () => {
    const status = await getNotificationPermissionStatus();
    setNotifStatus(status);
  };

  const handleToggleNotifications = async () => {
    if (notifStatus === 'granted') return;
    if (notifStatus === 'denied') {
      Linking.openSettings();
      return;
    }
    setNotifLoading(true);
    try {
      const granted = await requestNotificationPermissions();
      if (granted && userId) {
        await registerForPushNotifications(userId);
      }
    } catch (error) {
      console.warn('[Profile] Notification toggle failed:', error);
    } finally {
      await refreshNotifStatus();
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    refreshNotifStatus();
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Profile] Signing out...');
              await signOut(auth);
              console.log('[Profile] Signed out successfully');
              router.replace('/auth');
            } catch (error) {
              console.error('[Profile] Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#007AFF" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={handleToggleNotifications}
            disabled={notifLoading}
            activeOpacity={0.7}
          >
            <View style={styles.notifRow}>
              <View style={[styles.iconWrap, notifStatus === 'granted' ? styles.iconWrapEnabled : styles.iconWrapDisabled]}>
                {notifStatus === 'granted' ? (
                  <Bell size={22} color="#34C759" />
                ) : (
                  <BellOff size={22} color="#FF3B30" />
                )}
              </View>
              <View style={styles.notifText}>
                <Text style={styles.label}>
                  {notifStatus === 'granted'
                    ? 'Notifications Enabled'
                    : notifStatus === 'denied'
                      ? 'Notifications Disabled'
                      : 'Enable Notifications'}
                </Text>
                <Text style={styles.notifSubtext}>
                  {notifStatus === 'granted'
                    ? 'You will receive alerts for messages, announcements, and events.'
                    : notifStatus === 'denied'
                      ? 'Open iOS Settings to allow notifications for this app.'
                      : 'Tap to allow alerts for messages, announcements, and events.'}
                </Text>
              </View>
              {notifLoading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : notifStatus === 'granted' ? (
                <Text style={styles.notifStatusText}>On</Text>
              ) : (
                <ChevronRight size={20} color="#C7C7CC" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.card}>
            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <User size={20} color="#8E8E93" />
                <Text style={styles.label}>Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter your name"
                editable={!isLoading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <User size={20} color="#8E8E93" />
                <Text style={styles.label}>User ID</Text>
              </View>
              <TextInput
                style={styles.input}
                value={newUserId}
                onChangeText={setNewUserId}
                placeholder="Enter your user ID"
                editable={!isLoading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconLabel}>
                <Mail size={20} color="#8E8E93" />
                <Text style={styles.label}>Email</Text>
              </View>
              <Text style={styles.value}>{userEmail}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSaveChanges}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>

          <View style={styles.card}>
            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <Lock size={20} color="#8E8E93" />
                <Text style={styles.label}>Current Password</Text>
              </View>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                secureTextEntry
                autoCapitalize="none"
                editable={!isChangingPassword}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <Key size={20} color="#8E8E93" />
                <Text style={styles.label}>New Password</Text>
              </View>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min. 6 characters)"
                secureTextEntry
                autoCapitalize="none"
                editable={!isChangingPassword}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <Key size={20} color="#8E8E93" />
                <Text style={styles.label}>Confirm New Password</Text>
              </View>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
                autoCapitalize="none"
                editable={!isChangingPassword}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.changePasswordButton, isChangingPassword && styles.changePasswordButtonDisabled]} 
            onPress={handleChangePassword}
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Lock size={20} color="#FFFFFF" />
                <Text style={styles.changePasswordButtonText}>Change Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Email</Text>

          <View style={styles.card}>
            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <Lock size={20} color="#8E8E93" />
                <Text style={styles.label}>Current Password</Text>
              </View>
              <TextInput
                style={styles.input}
                value={emailPassword}
                onChangeText={setEmailPassword}
                placeholder="Enter current password"
                secureTextEntry
                autoCapitalize="none"
                editable={!isChangingEmail}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <AtSign size={20} color="#8E8E93" />
                <Text style={styles.label}>New Email</Text>
              </View>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Enter new email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isChangingEmail}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldContainer}>
              <View style={styles.iconLabel}>
                <AtSign size={20} color="#8E8E93" />
                <Text style={styles.label}>Confirm New Email</Text>
              </View>
              <TextInput
                style={styles.input}
                value={confirmEmail}
                onChangeText={setConfirmEmail}
                placeholder="Confirm new email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isChangingEmail}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.changeEmailButton, isChangingEmail && styles.changeEmailButtonDisabled]} 
            onPress={handleChangeEmail}
            disabled={isChangingEmail}
          >
            {isChangingEmail ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Mail size={20} color="#FFFFFF" />
                <Text style={styles.changeEmailButtonText}>Change Email</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldContainer: {
    paddingVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#8E8E93',
  },
  input: {
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF3B30',
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    height: 56,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  changePasswordButtonDisabled: {
    opacity: 0.6,
  },
  changePasswordButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  changeEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    height: 56,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  changeEmailButtonDisabled: {
    opacity: 0.6,
  },
  changeEmailButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapEnabled: {
    backgroundColor: '#E8FCEF',
  },
  iconWrapDisabled: {
    backgroundColor: '#FEE8E8',
  },
  notifText: {
    flex: 1,
    gap: 2,
  },
  notifSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  notifStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34C759',
  },
});
