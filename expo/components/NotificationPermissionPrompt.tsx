import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { Platform } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissions, registerForPushNotifications } from '@/utils/notifications';
import { useUser } from '@/contexts/UserContext';

const DISMISS_KEY = 'notif_permission_dismissed';

/**
 * A banner that prompts the user to enable notifications. The tap on
 * "Enable" counts as a user gesture, which browsers require before
 * Notification.requestPermission() can succeed.
 *
 * Shows on web (where the browser gesture requirement blocks auto-request)
 * and on native (where it's a friendly prompt before the system dialog).
 *
 * Once the user grants permission, registers for push notifications (FCM
 * on web, Expo Push on native) and saves the token to Firebase.
 *
 * Dismissed state persists so the banner doesn't reappear after the user
 * says "Not now".
 */
export function NotificationPermissionPrompt() {
  const { userId } = useUser();
  const [visible, setVisible] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(-200));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Don't show if already dismissed or permission already granted.
      try {
        const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissed === 'true') return;
      } catch {}

      // Check current permission state.
      let alreadyGranted = false;
      if (Platform.OS === 'web') {
        if (typeof Notification !== 'undefined') {
          alreadyGranted = Notification.permission === 'granted';
        }
      } else {
        // On native, let the bootstrap handle it — this prompt is mainly
        // for web where auto-request fails. But still show on native if
        // permission isn't granted yet.
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        alreadyGranted = status === 'granted';
      }

      if (alreadyGranted) return;
      if (!mounted) return;

      // Small delay so it appears after the main UI loads.
      setTimeout(() => {
        if (!mounted) return;
        setVisible(true);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1500);
    })();

    return () => {
      mounted = false;
    };
  }, [fadeAnim, slideAnim]);

  const handleEnable = async () => {
    const granted = await requestNotificationPermissions();
    if (granted && userId) {
      registerForPushNotifications(userId).catch((e) =>
        console.warn('[NotifPrompt] Registration failed:', e),
      );
    }
    dismiss();
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
    AsyncStorage.setItem(DISMISS_KEY, 'true').catch(() => {});
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Bell size={20} color="#6366F1" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Enable Notifications</Text>
        <Text style={styles.body}>
          Get alerts for new messages, announcements, and events even when this tab is in the background.
        </Text>
      </View>
      <Pressable style={styles.enableBtn} onPress={handleEnable} hitSlop={8}>
        <Text style={styles.enableText}>Enable</Text>
      </Pressable>
      <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={8}>
        <X size={16} color="#999" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 14,
    paddingLeft: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9998,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 16,
  },
  enableBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  enableText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
