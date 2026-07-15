import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { EventProvider } from "@/contexts/EventContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { GroupProvider } from "@/contexts/GroupContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { AnnouncementProvider } from "@/contexts/AnnouncementContext";
import { NotificationProvider, NotificationBannerOverlay } from "@/contexts/NotificationContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  registerForPushNotifications,
  unregisterPushToken,
  setupNotificationTapHandler,
  loadSeenNotifIds,
} from "@/utils/notifications";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Wires up push notification registration and tap-to-deep-link handling.
 * Must live inside the providers so it has access to the user and router.
 */
function NotificationBootstrap() {
  const router = useRouter();
  const { userId, isAuthenticated } = useUser();

  useEffect(() => {
    // Register for push notifications when authenticated. On native
    // (iOS/Android), this auto-requests the system notification permission
    // if not yet granted (triggers the iOS system dialog). On web, it only
    // registers if already granted — the NotificationPermissionPrompt
    // banner handles the browser user-gesture requirement.
    if (!isAuthenticated || !userId) return;
    registerForPushNotifications(userId).catch((e) =>
      console.warn("[Notifications] Registration failed:", e),
    );
  }, [isAuthenticated, userId]);

  // Remove the stored push token on sign-out so the user stops receiving
  // pushes after logging out on this device.
  useEffect(() => {
    if (!isAuthenticated && userId) {
      unregisterPushToken(userId).catch(() => {});
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    // Handle taps on notifications — deep-link into the relevant screen.
    const removeTap = setupNotificationTapHandler((data) => {
      const kind = data.kind as string | undefined;
      try {
        if (kind === "chat" && data.chatId) {
          router.push(`/group/${data.groupId}/chat/${data.chatId}` as any);
        } else if (kind === "announcement" && data.groupId) {
          router.push(`/group/${data.groupId}` as any);
        } else if (kind === "event" && data.eventId) {
          router.push(`/event/${data.eventId}` as any);
        }
      } catch (e) {
        console.warn("[Notifications] Tap deep-link failed:", e);
      }
    });

    return () => removeTap();
  }, [router]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="group/[id]/index" 
        options={{ 
          headerShown: true,
          title: "Group",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/invite" 
        options={{ 
          headerShown: false,
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/create-event" 
        options={{ 
          headerShown: true,
          title: "New Event",
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="event/[id]" 
        options={{ 
          headerShown: true,
          title: "Event Details",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="event/[id]/edit" 
        options={{ 
          headerShown: true,
          title: "Edit Event",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="create-group" 
        options={{ 
          headerShown: false,
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          headerShown: true,
          title: "Profile",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="role-selection" 
        options={{ 
          headerShown: true,
          title: "Select Role",
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="create-event" 
        options={{ 
          headerShown: true,
          title: "Create Event",
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="join-group" 
        options={{ 
          headerShown: false,
          presentation: "modal"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/settings" 
        options={{ 
          headerShown: true,
          title: "Group Settings",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="help" 
        options={{ 
          headerShown: true,
          title: "Help",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/chats" 
        options={{ 
          headerShown: true,
          title: "Chats",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/chat/[chatId]" 
        options={{ 
          headerShown: true,
          title: "Chat",
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="group/[id]/create-announcement" 
        options={{ 
          headerShown: true,
          title: "New Announcement",
          presentation: "modal"
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Load the persistent seen-notification store before the contexts
    // wire up their listeners, so already-shown notifications are NOT
    // re-displayed when re-entering the app.
    loadSeenNotifIds().catch((e) =>
      console.warn("[Notifications] Failed to load seen store:", e),
    );
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <NotificationProvider>
              <UserProvider>
                <OnboardingProvider>
                  <GroupProvider>
                    <ChatProvider>
                      <AnnouncementProvider>
                        <EventProvider>
                          <NotificationBootstrap />
                          <RootLayoutNav />
                          <NotificationPermissionPrompt />
                        </EventProvider>
                      </AnnouncementProvider>
                    </ChatProvider>
                  </GroupProvider>
                </OnboardingProvider>
              </UserProvider>
              <NotificationBannerOverlay />
            </NotificationProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
