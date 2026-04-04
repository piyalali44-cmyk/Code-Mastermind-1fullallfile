import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { LeaderboardEntry, getLeaderboardByCountry, getLeaderboardGlobal, getLeaderboardMonthly, getLeaderboardWeekly } from "@/lib/db";
import { useColors } from "@/hooks/useColors";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS = ["Global", "My Country", "Weekly", "Monthly"] as const;
const MEDAL_COLORS = ["#D4A030", "#A8A8A8", "#CD7F32"] as const;

function countryToFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  const ch1 = upper.charCodeAt(0) - 65 + 0x1F1E6;
  const ch2 = upper.charCodeAt(1) - 65 + 0x1F1E6;
  return String.fromCodePoint(ch1) + String.fromCodePoint(ch2);
}

function Avatar({ name, size, gold, color }: { name: string; size: number; gold?: boolean; color?: string }) {
  const colors = useColors();
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const bg = gold ? colors.gold + "40" : (color ?? colors.surfaceHigh);
  const textColor = gold ? colors.goldLight : colors.textPrimary;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg, borderWidth: gold ? 2 : 1.5, borderColor: gold ? colors.gold : colors.border }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: textColor }}>{initial}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying } = useAudio();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: LeaderboardEntry[] = [];
      if (activeTab === 0) {
        data = await getLeaderboardGlobal(50);
      } else if (activeTab === 1) {
        if (!user?.country) { setEntries([]); setLoading(false); return; }
        data = await getLeaderboardByCountry(user.country, 50);
      } else if (activeTab === 2) {
        data = await getLeaderboardWeekly(50);
      } else {
        data = await getLeaderboardMonthly(50);
      }
      setEntries(data);
    } catch {
      setError("Unable to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasPodium = entries.length >= 3;
  const topThree = hasPodium ? entries.slice(0, 3) : [];
  const listEntries = entries;

  const myEntry = user ? entries.find((e) => e.id === user.id) : null;
  const myRank = myEntry ? Number(myEntry.rank) : null;
  const xpLabel = activeTab === 2 ? "XP this week" : activeTab === 3 ? "XP this month" : "Total XP";

  const renderRow = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = user?.id === item.id;
    const rankNum = Number(item.rank);
    const name = item.display_name || "Anonymous";
    return (
      <View style={[styles.row, { borderBottomColor: colors.divider, backgroundColor: isMe ? colors.gold + "14" : "transparent" }]}>
        <Text style={[styles.rowRank, { color: rankNum <= 10 ? colors.goldLight : colors.textMuted }]}>#{rankNum}</Text>
        <Avatar name={name} size={40} gold={isMe} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.rowName, { color: isMe ? colors.goldLight : colors.textPrimary }]} numberOfLines={1}>
            {isMe ? `${name} (You)` : name}
          </Text>
          {item.country ? (
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              {countryToFlag(item.country)} {item.country}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowXp, { color: isMe ? colors.goldLight : colors.textPrimary }]}>
            {(item.xp ?? 0).toLocaleString()}
          </Text>
          <Text style={[styles.rowXpLabel, { color: colors.textMuted }]}>XP</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Leaderboard</Text>
        <Pressable onPress={fetchData} disabled={loading} style={[styles.navBtn, { opacity: loading ? 0.5 : 1 }]}>
          <Icon name="refresh-cw" size={18} color={loading ? colors.textMuted : colors.goldLight} />
        </Pressable>
      </View>

      <View style={[styles.tabsRow, { borderBottomColor: colors.divider }]}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => setActiveTab(i)} style={styles.tab}>
            <Text style={[styles.tabText, { color: i === activeTab ? colors.goldLight : colors.textMuted }]}>{t}</Text>
            {i === activeTab && <View style={[styles.tabUnderline, { backgroundColor: colors.gold }]} />}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading leaderboard…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Icon name="wifi" size={32} color={colors.textMuted} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>Something went wrong</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>{error}</Text>
          <Pressable onPress={fetchData} style={[styles.retryBtn, { backgroundColor: colors.gold }]}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : activeTab === 1 && !user?.country ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Icon name="map-pin" size={32} color={colors.textMuted} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>Country not set</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
            Set your country in Settings → My Country to see the leaderboard for your region.
          </Text>
          <Pressable
            onPress={() => router.push("/settings")}
            style={{ backgroundColor: colors.gold, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, marginTop: 4 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Go to Settings</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Icon name="trophy" size={32} color={colors.textMuted} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>No rankings yet</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
            Be the first to earn XP and claim the top spot!
          </Text>
        </View>
      ) : (
        <FlatList
          data={listEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.gold} colors={[colors.gold]} />}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListHeaderComponent={
            <>
              {/* ── Podium (top 3) ── */}
              {hasPodium && (
                <View style={styles.podium}>
                  {/* 2nd place */}
                  <View style={[styles.podiumItem, { marginTop: 28 }]}>
                    <Avatar name={topThree[1]?.display_name || "?"} size={56} color={MEDAL_COLORS[1] + "22"} />
                    <Text style={[styles.podiumMedal, { color: MEDAL_COLORS[1] }]}>2</Text>
                    <Text style={[styles.podiumName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {(topThree[1]?.display_name || "?").split(" ")[0]}
                    </Text>
                    <Text style={[styles.podiumScore, { color: colors.textMuted }]}>
                      {(topThree[1]?.xp ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  {/* 1st place */}
                  <View style={styles.podiumItem}>
                    <Text style={{ fontSize: 22, marginBottom: 2 }}>👑</Text>
                    <Avatar name={topThree[0]?.display_name || "?"} size={72} gold />
                    <Text style={[styles.podiumMedal, { color: MEDAL_COLORS[0], fontSize: 22 }]}>1</Text>
                    <Text style={[styles.podiumName, { color: colors.textPrimary, fontWeight: "700" }]} numberOfLines={1}>
                      {(topThree[0]?.display_name || "?").split(" ")[0]}
                    </Text>
                    <Text style={[styles.podiumScore, { color: colors.goldLight }]}>
                      {(topThree[0]?.xp ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  {/* 3rd place */}
                  <View style={[styles.podiumItem, { marginTop: 48 }]}>
                    <Avatar name={topThree[2]?.display_name || "?"} size={56} color={MEDAL_COLORS[2] + "22"} />
                    <Text style={[styles.podiumMedal, { color: MEDAL_COLORS[2] }]}>3</Text>
                    <Text style={[styles.podiumName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {(topThree[2]?.display_name || "?").split(" ")[0]}
                    </Text>
                    <Text style={[styles.podiumScore, { color: colors.textMuted }]}>
                      {(topThree[2]?.xp ?? 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Label Row ── */}
              <View style={[styles.labelRow, { borderBottomColor: colors.divider, borderTopColor: colors.divider }]}>
                <Text style={[styles.labelLeft, { color: colors.textMuted }]}>
                  {hasPodium ? "Rank · Name" : "Rank · Name"}
                </Text>
                <Text style={[styles.labelRight, { color: colors.textMuted }]}>{xpLabel}</Text>
              </View>

            </>
          }
          renderItem={renderRow}
          ListFooterComponent={
            myRank && myRank > 50 ? (
              <>
                <View style={[styles.gapRow, { backgroundColor: colors.divider }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>• • •</Text>
                </View>
                <View style={[styles.row, { backgroundColor: colors.gold + "22", borderBottomColor: colors.divider }]}>
                  <Text style={[styles.rowRank, { color: colors.goldLight }]}>#{myRank}</Text>
                  <Avatar name={user?.displayName ?? "Y"} size={40} gold />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.goldLight }]}>{user?.displayName || "You"}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowXp, { color: colors.goldLight }]}>{(myEntry?.xp ?? 0).toLocaleString()}</Text>
                    <Text style={[styles.rowXpLabel, { color: colors.goldLight }]}>XP</Text>
                  </View>
                </View>
              </>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 0.5 },
  navBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  tabsRow: { flexDirection: "row", borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, position: "relative" },
  tabText: { fontSize: 12, fontWeight: "600" },
  tabUnderline: { position: "absolute", bottom: 0, height: 2, width: "60%", borderRadius: 1 },
  podium: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", paddingVertical: 24, gap: 16, paddingHorizontal: 20 },
  podiumItem: { alignItems: "center", gap: 5, flex: 1 },
  podiumMedal: { fontSize: 18, fontWeight: "700" },
  podiumName: { fontSize: 12, textAlign: "center" },
  podiumScore: { fontSize: 11 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5 },
  labelLeft: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  labelRight: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, gap: 12, borderBottomWidth: 0.5 },
  rowRank: { width: 36, fontSize: 13, fontWeight: "700" },
  rowName: { fontSize: 14, fontWeight: "600" },
  rowSub: { fontSize: 11 },
  rowRight: { alignItems: "flex-end" },
  rowXp: { fontSize: 15, fontWeight: "700" },
  rowXpLabel: { fontSize: 10 },
  gapRow: { height: 32, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  retryBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
});
