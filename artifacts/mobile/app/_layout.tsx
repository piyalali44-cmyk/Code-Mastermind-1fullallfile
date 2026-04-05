import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PersistentChrome } from "@/components/PersistentChrome";
import { SplashLoader } from "@/components/SplashLoader";
import { AppSettingsProvider, useAppSettings } from "@/context/AppSettingsContext";
import { AudioProvider } from "@/context/AudioContext";
import { AuthProvider } from "@/context/AuthContext";
import { ContentProvider } from "@/context/ContentContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserActionsProvider } from "@/context/UserActionsContext";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

function MaintenanceScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, paddingHorizontal: 32, gap: 12 }}>
      <Text style={{ fontSize: 48 }}>🔧</Text>
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center", color: colors.textPrimary }}>Under Maintenance</Text>
      <Text style={{ fontSize: 14, textAlign: "center", lineHeight: 20, color: colors.textSecondary }}>We're making improvements. Please check back shortly.</Text>
    </View>
  );
}

import { navigateDeepLink } from "@/lib/deeplink";

function RootLayoutNav() {
  const colors = useColors();
  const router = useRouter();
  const { settings } = useAppSettings();

  // Handle push notification taps — navigate to deep link
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: { remove: () => void } | null = null;
    import("expo-notifications").then((Notifications) => {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const url = typeof data?.url === "string" ? data.url : "";
        if (url) navigateDeepLink(url, router);
      });
    }).catch(() => {});
    return () => { sub?.remove(); };
  }, [router]);

  if (settings.maintenance_mode) {
    return <MaintenanceScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, pointerEvents: "box-none" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ animation: "none" }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ animation: "fade", animationDuration: 320 }}
        />
        <Stack.Screen
          name="login"
          options={{ animation: "fade", animationDuration: 320 }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ animation: "fade", animationDuration: 250 }}
        />
        <Stack.Screen
          name="player"
          options={{
            animation: "slide_from_bottom",
            animationDuration: 380,
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen name="quran/[id]" />
        <Stack.Screen name="series/[id]" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="search" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="popular" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="hadith/index" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/[book]" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/bookmarks" options={{ headerShown: false }} />
      </Stack>
      <PersistentChrome />
    </View>
  );
}

const MIN_SPLASH_MS = 3400;

function SplashOverlay() {
  const [hidden, setHidden] = useState(false);
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setHidden(true));
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <Animated.View
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        opacity: fadeOut, zIndex: 999, pointerEvents: "none",
      }}
    >
      <SplashLoader />
    </Animated.View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    import("@/lib/notifications").then(({ setupNotificationHandlers }) => {
      setupNotificationHandlers().catch(() => {});
    });
  }, []);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#0C3222" }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppSettingsProvider>
                <UserActionsProvider>
                  <ContentProvider>
                    <AudioProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <RootLayoutNav />
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                    </AudioProvider>
                    <SplashOverlay />
                  </ContentProvider>
                </UserActionsProvider>
              </AppSettingsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
