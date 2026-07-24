import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, setAuthPersistence } from '@/lib/firebase-client';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { LogIn, UserPlus, Mail, Lock, Check } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const { t } = useLanguage();

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t('error'), t('enterEmailFirst'));
      return;
    }

    setIsLoading(true);

    try {
      console.log('[Auth] Sending password reset email...');
      await sendPasswordResetEmail(auth, email);
      console.log('[Auth] Password reset email sent');
      
      Alert.alert(
        t('emailSent'),
        t('resetLinkSent'),
        [{ text: t('ok') }]
      );
    } catch (error: any) {
      console.warn('[Auth] Password reset error:', error?.code || error?.message || 'unknown');
      
      let errorMessage = t('resetFailed');
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = t('invalidEmail');
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = t('noAccountFound');
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = t('networkError');
      }
      
      Alert.alert(t('error'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const signedInWithoutRemember = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePageHide = () => {
        if (signedInWithoutRemember.current) {
          signOut(auth).catch(() => {});
        }
      };
      window.addEventListener('pagehide', handlePageHide);
      return () => window.removeEventListener('pagehide', handlePageHide);
    }
    
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && signedInWithoutRemember.current) {
        signOut(auth).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordsNoMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('error'), t('passwordMin6'));
      return;
    }

    setIsLoading(true);

    try {
      await setAuthPersistence(rememberMe);
      signedInWithoutRemember.current = !rememberMe;

      if (isLogin) {
        console.log('[Auth] Signing in...');
        await signInWithEmailAndPassword(auth, email, password);
        console.log('[Auth] Sign in successful');
      } else {
        console.log('[Auth] Creating account...');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log('[Auth] Account created successfully');
        // Mark onboarding as pending for the new user
        if (cred.user?.uid) {
          await AsyncStorage.setItem(`onboarding_pending_${cred.user.uid}`, 'true');
          console.log('[Auth] Onboarding marked as pending for new user');
        }
      }
      
      router.replace('/');
    } catch (error: any) {
      console.warn('[Auth] Authentication error:', error?.code || error?.message || 'unknown');
      
      let errorMessage = t('authFailed');
      
      if (isLogin) {
        if (error.code === 'auth/invalid-email' || 
            error.code === 'auth/user-not-found' || 
            error.code === 'auth/wrong-password' ||
            error.code === 'auth/invalid-credential') {
          errorMessage = t('invalidCredentials');
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = t('networkError');
        }
      } else {
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = t('emailInUse');
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = t('invalidEmail');
        } else if (error.code === 'auth/weak-password') {
          errorMessage = t('weakPassword');
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = t('networkError');
        }
      }
      
      Alert.alert(t('error'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {isLogin ? (
                <LogIn size={48} color="#007AFF" strokeWidth={2} />
              ) : (
                <UserPlus size={48} color="#007AFF" strokeWidth={2} />
              )}
            </View>
            <Text style={styles.title}>
              {isLogin ? t('welcomeBack') : t('createAccount')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin 
                ? t('signInSubtitle') 
                : t('signUpSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Mail size={20} color="#8E8E93" />
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor="#8E8E93"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Lock size={20} color="#8E8E93" />
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('password')}
                placeholderTextColor="#8E8E93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color="#8E8E93" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('confirmPassword')}
                  placeholderTextColor="#8E8E93"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                />
              </View>
            )}

            {isLogin && (
              <>
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={isLoading}
                  style={styles.rememberMeContainer}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.rememberMeText}>{t('rememberMe')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>{t('forgotPassword')}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.authButton, isLoading && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.authButtonText}>
                  {isLogin ? t('signIn') : t('createAccount')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin ? t('noAccount') : t('haveAccount')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsLogin(!isLogin);
                  setConfirmPassword('');
                }}
                disabled={isLoading}
              >
                <Text style={styles.switchLink}>
                  {isLogin ? t('signUp') : t('signIn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  authButton: {
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  switchText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  switchLink: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  rememberMeText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
