import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { DbNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NotifIcon = "headphones" | "map" | "book-open" | "zap" | "bell" | "star" | "award" | "check-circle" | "mail";

function iconForType(type: string, actionType: string | null): NotifIcon {
  if (actionType === "series") return "headphones";
  if (actionType === "journey") return "map";
  if (actionType === "quran") return "book-open";
  if (actionType === "contact_reply" || type === "contact_reply") return "mail";
  if (type === "achievement") return "zap";
  if (type === "reminder") return "bell";
  if (type === "general") return "star";
  return "bell";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function NotificationCard({ notif, onPress }: { notif: DbNotification; onPress: () => void }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const icon = iconForType(notif.type, notif.action_type);

  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, tension: 200, friction: 12 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start()}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.notifCard,
          {
            backgroundColor: notif.is_read ? colors.surface : colors.surfaceHigh,
            borderBottomColor: colors.divider,
            transform: [{ scale }],
          },
        ]}
      >
        {(notif.image_url || notif.action_payload?.image_url) ? (
          <Image source={{ uri: notif.image_url || notif.action_payload?.image_url }} style={styles.notifImage} />
        ) : (
          <View style={[styles.notifIconWrap, { backgroundColor: notif.is_read ? colors.surfaceHigh : colors.gold + "22" }]}>
            <Icon name={icon} size={18} color={notif.is_read ? colors.textMuted : colors.goldLight} />
          </View>
        )}
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text style={[styles.notifTitle, { color: colors.textPrimary, fontWeight: notif.is_read ? "500" : "700" }]}>
              {notif.title}
            </Text>
            {!notif.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.gold }]} />}
          </View>
          <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>
            {notif.body}
          </Text>
          <Text style={[styles.notifTime, { color: colors.textMuted }]}>{timeAgo(notif.created_at)}</Text>
        </View>
        <View style={styles.chevronWrap}>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      const notifs = await getNotifications(user.id, user.joinDate);
      if (active) {
        setNotifications(notifs);
        setLoading(false);
      }
    };
    load();

    // Real-time subscription — refresh when new notification arrives
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        getNotifications(user.id, user.joinDate).then((notifs) => {
          if (active) setNotifications(notifs);
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleNotifPress = async (notif: DbNotification) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
      );
      await markNotificationRead(notif.id);
    }

    const actionType = notif.action_type;
    const payload = notif.action_payload ?? {};
    switch (actionType) {
      case "series": {
        const seriesId = typeof payload.seriesId === "string" && payload.seriesId ? payload.seriesId : null;
        router.push(seriesId ? `/series/${seriesId}` : "/");
        break;
      }
      case "quran":
        router.push("/(tabs)/quran");
        break;
      case "journey":
        router.push("/journey");
        break;
      case "profile":
        router.push("/(tabs)/profile");
        break;
      case "contact_reply":
        router.push("/contact");
        break;
      case "home":
        router.push("/");
        break;
      case "deeplink": {
        // Parse stayguided://screen/<name> or stayguided://series/<id>
        const url = typeof payload.url === "string" ? payload.url : "";
        const screen = url.replace(/^stayguided:\/\/screen\//, "");
        const seriesMatch = url.match(/^stayguided:\/\/series\/(.+)$/);
        if (seriesMatch) {
          router.push(`/series/${seriesMatch[1]}`);
        } else if (screen === "journey") {
          router.push("/journey");
        } else if (screen === "quran") {
          router.push("/(tabs)/quran");
        } else if (screen === "profile") {
          router.push("/(tabs)/profile");
        } else if (screen === "leaderboard") {
          router.push("/leaderboard");
        } else if (screen === "subscription") {
          router.push("/subscription");
        } else {
          router.push("/");
        }
        break;
      }
      default:
        // For general/reminder/achievement notifications with no specific action — do nothing (already read)
        break;
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(user.id);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <Pressable
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          style={[styles.markReadBtn, { backgroundColor: colors.surfaceHigh, opacity: unreadCount === 0 ? 0.4 : 1 }]}
        >
          <Icon name="check-circle" size={14} color={colors.textSecondary} />
          <Text style={[styles.markReadText, { color: colors.textSecondary }]}>Read all</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading notifications…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHigh }]}>
              <Icon name="bell" size={32} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Notifications</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>You're all caught up!</Text>
          </View>
        ) : (
          notifications.map((notif) => (
            <NotificationCard key={notif.id} notif={notif} onPress={() => handleNotifPress(notif)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  notifCard: {
    flexDirection: "row",
    padding: 16,
    gap: 14,
    borderBottomWidth: 0.5,
    alignItems: "center",
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notifTitle: {
    fontSize: 15,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },
  chevronWrap: {
    paddingLeft: 4,
  },
  markReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
  },
});
