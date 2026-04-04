import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    const Constants = (await import("expo-constants")).default;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId ||
      Constants.expoConfig?.extra?.projectId;

    const tokenOptions = projectId ? { projectId } : {};
    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions as any);
    const token = tokenData?.data;
    if (!token) return;

    await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);
  } catch {
  }
}

export async function setupNotificationHandlers(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string | null,
  dataUrl?: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body ?? undefined,
        data: { url: dataUrl || "/contact" },
        sound: true,
      },
      trigger: null,
    });
  } catch {
  }
}
