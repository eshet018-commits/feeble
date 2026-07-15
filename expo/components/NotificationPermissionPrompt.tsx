import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Animated, Linking, Platform } from 'react-native';
import { Bell, X, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermissions,
  registerForPushNotifications,
  getNotificationPermissionStatus,
  type PermissionStatus,
} from '@/utils/notifications';
import { useUser } from '@/contexts/UserContext';

const DISMISS_KEY = 'notif_permission_dismissed';
const DISMISS_DENIED_KEY = 'notif_permission_denied_dismissed';

/**
 * On native iOS/Android we always want the user to see a clear path to enable
 * notifications, because the OS dialog can only appear once and many users miss
 * it. Web banners are more easily dismissed, so we still persist that choice.
 */
const IS_NATIVE = Platform.OS !== 'web';

/**
 * A banner that prompts the user to enable notifications.
 *
 * On web: The tap on "Enable" counts as a user gesture, which browsers
 * require before Notification.requestPermission() can succeed.
 *
 * On native iOS:
 * - If permission is undetermined: tapping "Allow" triggers the iOS system
 *   notification permission dialog.
 * - If permission was previously denied: shows a "Go to Settings" button
 *   that opens the iOS Settings app (iOS won't show the dialog again once
 *   denied).
 *
 * Dismissed state persists so the banner doesn't reappear after the user
 * says "Not now".
 */
export function NotificationPermissionPrompt() {
  const { userId, isAuthenticated } = useUser();
  const [visible, setVisible] = useState(false);
  const [permStatus, setPermStatus] = useState<PermissionStatus>('undetermined');
  const [slideAnim] = useState(() => new Animated.Value(-200));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    (async () => {
      // Check current permission state.
      const status = await getNotificationPermissionStatus();
      if (!mounted) return;
      setPermStatus(status);

      if (status === 'granted') return;

      // On native, keep the banner visible so users always have a way to enable
      // notifications. On web, respect the user's dismissal to reduce annoyance.
      if (!IS_NATIVE) {
        const dismissKey = status === 'denied' ? DISMISS_DENIED_KEY : DISMISS_KEY;
        try {
          const dismissed = await AsyncStorage.getItem(dismissKey);
          if (dismissed === 'true') return;
        } catch {}
      }

      if (!mounted) return;

      // Show the banner after the main UI has settled. On native we use a shorter
      // delay so the user notices the prompt right after login.
      const delay = IS_NATIVE ? 600 : 1500;
      setTimeout(() => {
        if (!mounted) return;
        setVisible(true);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: false,
          }),
        ]).start();
      }, delay);
    })();

    return () => {
      mounted = false;
    };
  }, [fadeAnim, slideAnim, isAuthenticated]);

  const handleEnable = async () => {
    if (permStatus === 'denied' && Platform.OS !== 'web') {
      // Permission was already denied — iOS won't show the dialog again.
      // Open the iOS Settings app so the user can enable notifications.
      Linking.openSettings();
      dismiss(false);
      return;
    }

    const granted = await requestNotificationPermissions();
    if (granted && userId) {
      registerForPushNotifications(userId).catch((e) =>
        console.warn('[NotifPrompt] Registration failed:', e),
      );
    }
    dismiss(true);
  };

  const dismiss = (markDismissed: boolean = true) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => setVisible(false));

    // Only persist dismissal on web. Native users need a persistent way to enable
    // notifications because the OS dialog can only be shown once.
    if (markDismissed && !IS_NATIVE) {
      const key = permStatus === 'denied' ? DISMISS_DENIED_KEY : DISMISS_KEY;
      AsyncStorage.setItem(key, 'true').catch(() => {});
    }
  };

  if (!visible) return null;

  const isDenied = permStatus === 'denied' && Platform.OS !== 'web';
  const buttonText = isDenied ? 'Settings' : 'Enable';
  const bodyText = isDenied
    ? 'Notifications are turned off in Settings. Tap to open Settings and enable them.'
    : Platform.OS === 'web'
      ? 'Get alerts for new messages, announcements, and events even when this tab is in the background.'
      : 'Get alerts for new messages, announcements, and events even when the app is closed.';

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
        {isDenied ? (
          <Settings size={20} color="#6366F1" />
        ) : (
          <Bell size={20} color="#6366F1" />
        )}
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {isDenied ? 'Notifications Disabled' : 'Enable Notifications'}
        </Text>
        <Text style={styles.body}>{bodyText}</Text>
      </View>
      <Pressable style={styles.enableBtn} onPress={handleEnable} hitSlop={8}>
        <Text style={styles.enableText}>{buttonText}</Text>
      </Pressable>
      <Pressable style={styles.closeBtn} onPress={() => dismiss(true)} hitSlop={8}>
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
