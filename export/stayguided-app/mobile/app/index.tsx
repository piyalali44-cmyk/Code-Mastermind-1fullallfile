import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { useAppSettings } from "@/context/AppSettingsContext";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { isLoading, hasOnboarded, user, isGuest, logout } = useAuth();
  const { settings } = useAppSettings();

  useEffect(() => {
    if (!settings.guest_access_enabled && isGuest && !user) {
      logout();
    }
  }, [settings.guest_access_enabled, isGuest, user, logout]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: "#0C3222" }} />;
  }

  if (!settings.guest_access_enabled && isGuest && !user) {
    return <Redirect href="/login" />;
  }

  if (!hasOnboarded) return <Redirect href="/onboarding" />;
  if (!user && !isGuest) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
