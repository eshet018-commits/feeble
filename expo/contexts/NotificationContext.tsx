import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * In-app notification banner. Works on every platform (including web),
 * so notifications appear instantly when posted — no dependency on native
 * push APIs that are unavailable in the Rork web preview.
 */

export type NotificationKind = 'chat' | 'announcement' | 'event' | 'default';

export interface InAppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, any>;
  durationMs?: number;
}

interface ActiveBanner extends InAppNotification {
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  timer: ReturnType<typeof setTimeout> | null;
}

let counter = 0;

function makeId(): string {
  counter += 1;
  return `inapp_${Date.now()}_${counter}`;
}

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<ActiveBanner[]>([]);
  const bannersRef = useRef<ActiveBanner[]>([]);
  bannersRef.current = banners;

  const dismiss = useCallback((id: string) => {
    setBanners((prev) => {
      const target = prev.find((b) => b.id === id);
      if (target?.timer) clearTimeout(target.timer);
      // Animate out then remove.
      Animated.parallel([
        Animated.timing(target?.fadeAnim ?? new Animated.Value(0), {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(target?.slideAnim ?? new Animated.Value(-100), {
          toValue: -120,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setBanners((cur) => cur.filter((b) => b.id !== id));
      });
      return prev; // keep until animation completes
    });
  }, []);

  const showNotification = useCallback(
    (notif: Omit<InAppNotification, 'id'> & { id?: string }): string => {
      const id = notif.id ?? makeId();
      const fadeAnim = new Animated.Value(0);
      const slideAnim = new Animated.Value(-120);

      const duration = notif.durationMs ?? 4500;
      const timer = setTimeout(() => dismiss(id), duration);

      const banner: ActiveBanner = {
        ...(notif as InAppNotification),
        id,
        fadeAnim,
        slideAnim,
        timer,
      };

      setBanners((prev) => [banner, ...prev].slice(0, 3));

      // Slide + fade in.
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      return id;
    },
    [dismiss],
  );

  const handleTap = useCallback(
    (banner: ActiveBanner) => {
      const data = banner.data || {};
      try {
        if (banner.kind === 'chat' && data.chatId && data.groupId) {
          router.push(`/group/${data.groupId}/chat/${data.chatId}` as any);
        } else if (banner.kind === 'announcement' && data.groupId) {
          router.push(`/group/${data.groupId}` as any);
        } else if (banner.kind === 'event' && data.eventId) {
          router.push(`/event/${data.eventId}` as any);
        }
      } catch (e) {
        console.warn('[Notifications] Banner tap navigation failed:', e);
      }
      dismiss(banner.id);
    },
    [router, dismiss],
  );

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      bannersRef.current.forEach((b) => {
        if (b.timer) clearTimeout(b.timer);
      });
    };
  }, []);

  return {
    showNotification,
    dismiss,
    banners,
    insets,
    handleTap,
  };
});

export function NotificationBannerOverlay() {
  const { banners, insets, handleTap, dismiss } = useNotifications();

  if (banners.length === 0) return null;

  return (
    <View
      style={[
        styles.overlay,
        { top: (insets.top || 12) + 4 },
      ]}
      pointerEvents="box-none"
    >
      {banners.map((banner) => (
        <Animated.View
          key={banner.id}
          style={[
            styles.banner,
            {
              opacity: banner.fadeAnim,
              transform: [{ translateY: banner.slideAnim }],
            },
            bannerStyleForKind(banner.kind),
          ]}
        >
          <Pressable
            onPress={() => handleTap(banner)}
            style={styles.pressable}
          >
            <View style={styles.contentRow}>
              <Text style={styles.icon}>
                {iconForKind(banner.kind)}
              </Text>
              <View style={styles.textContent}>
                <Text style={styles.title} numberOfLines={1}>
                  {banner.title}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {banner.body}
                </Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={() => dismiss(banner.id)}
            style={styles.closeBtn}
            hitSlop={8}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

function iconForKind(kind: NotificationKind): string {
  switch (kind) {
    case 'chat':
      return '💬';
    case 'announcement':
      return '📢';
    case 'event':
      return '📅';
    default:
      return '🔔';
  }
}

function bannerStyleForKind(kind: NotificationKind) {
  switch (kind) {
    case 'chat':
      return { borderLeftColor: '#3B82F6' };
    case 'announcement':
      return { borderLeftColor: '#F59E0B' };
    case 'event':
      return { borderLeftColor: '#10B981' };
    default:
      return { borderLeftColor: '#6366F1' };
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
    gap: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E2E',
    borderRadius: 14,
    borderLeftWidth: 4,
    paddingRight: 8,
    paddingLeft: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 56,
  },
  pressable: {
    flex: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 20,
  },
  textContent: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: -2,
  },
});
