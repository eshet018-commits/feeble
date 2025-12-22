import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { EventProvider } from "@/contexts/EventContext";
import { UserProvider } from "@/contexts/UserContext";
import { GroupProvider } from "@/contexts/GroupContext";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <UserProvider>
            <GroupProvider>
              <EventProvider>
                <RootLayoutNav />
              </EventProvider>
            </GroupProvider>
          </UserProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
