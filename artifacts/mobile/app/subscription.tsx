import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { applyReferralCode } from "@/lib/db";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSettings } from "@/context/AppSettingsContext";
import { useAudio } from "@/context/AudioContext";

const FEATURES = [
  "Unlimited access to all premium episodes",
  "Download for offline listening",
  "Background play on all content",
  "Full transcript access",
  "Priority support",
];

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { nowPlaying } = useAudio();
  const { settings } = useAppSettings();
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "monthly">("weekly");
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({
    visible: false, message: "", icon: "check",
  });

  const weeklyNum = parseFloat(settings.weekly_price_usd) || 0.99;
  const monthlyNum = parseFloat(settings.monthly_price_usd) || 4.99;
  const weeklyEquivMonthly = weeklyNum * 4.33;
  const savePct = weeklyEquivMonthly > 0 ? Math.round((1 - monthlyNum / weeklyEquivMonthly) * 100) : 0;

  const formatPrice = (val: number) => {
    if (val === Math.floor(val)) return `$${val}`;
    return `$${val.toFixed(2)}`;
  };

  const showToast = (message: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message, icon, iconColor });
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (!user) {
      showToast("Please sign in to apply a code", "alert-circle", colors.error);
      return;
    }
    setCouponLoading(true);
    const result = await applyReferralCode(code);
    setCouponLoading(false);
    if (result.success) {
      setCouponCode("");
      let msg = "Code applied successfully!";
      if (result.type === "free_days" && result.freeDays) {
        msg = `🎉 ${result.freeDays} days of Premium activated!`;
      } else if (result.type === "xp_bonus" && result.xpBonus) {
        msg = `+${result.xpBonus} XP added to your account!`;
      } else if (result.type === "referral") {
        msg = `Referral code applied! +${result.xpBonus ?? 100} XP added.`;
      } else if (result.xpBonus) {
        msg = `Code applied! +${result.xpBonus} XP added.`;
      }
      showToast(msg, "check-circle", colors.green);
    } else {
      const msg =
        result.error === "already_used"   ? "You have already used this code" :
        result.error === "invalid_code"   ? "That code is invalid or has expired" :
        result.error === "own_code"       ? "You cannot use your own referral code" :
        result.error === "code_exhausted" ? "This code has reached its maximum uses" :
        result.error === "new_users_only" ? "This code is for new users only" :
        result.error === "not_authenticated" ? "Please sign in to apply a code" :
        result.error || "Unable to apply code. Please try again.";
      showToast(msg, "alert-circle", colors.error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      showToast("Please sign in to subscribe", "alert-circle", colors.error);
      return;
    }
    setSubscribeLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubscribeLoading(false);
    showToast("Payment integration coming soon — thank you for your interest!", "bell", colors.gold + "cc");
  };

  if (!settings.subscription_enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.hero, { paddingTop: insets.top + (isWeb ? 67 : 0) + 16, paddingBottom: 24, alignItems: "center" }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: "flex-start" }]}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingHorizontal: 24, paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.crownWrap, { backgroundColor: colors.gold + "18" }]}>
            <Icon name="clock" size={44} color={colors.gold} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary, marginTop: 16 }]}>Coming Soon</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginTop: 8 }]}>
            Subscription is not yet available. All content is free while we get everything ready for you. JazakAllah Khayran!
          </Text>
          <Pressable onPress={() => router.replace("/(tabs)")} style={[styles.subscribeBtn, { backgroundColor: colors.gold, marginTop: 24, width: "100%" }]}>
            <Text style={styles.subscribeBtnText}>Continue Exploring</Text>
          </Pressable>

          <View style={[styles.couponCard, { backgroundColor: colors.surface, borderColor: colors.border, width: "100%", marginTop: 16 }]}>
            <Text style={[styles.couponLabel, { color: colors.textSecondary }]}>Have a referral or coupon code? Enter it here</Text>
            <View style={styles.couponRow}>
              <TextInput
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                style={[styles.couponInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, color: colors.textPrimary }]}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                importantForAutofill="no"
                editable={!couponLoading}
              />
              <Pressable
                onPress={handleApplyCoupon}
                disabled={!couponCode.trim() || couponLoading}
                style={[styles.applyBtn, { backgroundColor: couponCode.trim() && !couponLoading ? colors.gold : colors.divider }]}
              >
                {couponLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.applyBtnText, { color: couponCode.trim() ? "#fff" : colors.textMuted }]}>Apply</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={{ width: "100%", gap: 10, marginTop: 16 }}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureRow, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 }]}>
                <View style={[styles.featureCheck, { backgroundColor: colors.green + "22" }]}>
                  <Icon name="check" size={12} color={colors.green} />
                </View>
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f} — Free</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (user?.isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 160 : 110) + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.gold + "44", colors.gold + "11", colors.background]}
            style={[styles.hero, { paddingTop: insets.top + (isWeb ? 67 : 0) + 16, paddingBottom: 40 }]}
          >
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Icon name="x" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={[styles.crownWrap, { backgroundColor: colors.gold + "33" }]}>
              <Icon name="star" size={44} color={colors.goldLight} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>You're Premium</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Enjoy unlimited access to all Islamic content</Text>
          </LinearGradient>
          <View style={{ padding: 20, gap: 14 }}>
            <View style={[{ borderRadius: 14, borderWidth: 1, padding: 18, gap: 12, backgroundColor: colors.surface, borderColor: colors.gold + "44" }]}>
              <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 15 }}>Active Benefits</Text>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.featureCheck, { backgroundColor: colors.gold + "22" }]}>
                    <Icon name="check" size={12} color={colors.goldLight} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </View>
            <View style={[{ borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#0a2018", borderColor: colors.green + "33" }]}>
              <Icon name="shield" size={18} color={colors.green} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
                Your subscription is <Text style={{ color: colors.green, fontWeight: "700" }}>active</Text>. Manage billing in your account settings.
              </Text>
            </View>
            <View style={[styles.couponCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.couponLabel, { color: colors.textSecondary }]}>Have a coupon or referral code?</Text>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder="Enter code"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.couponInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, color: colors.textPrimary }]}
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!couponLoading}
                />
                <Pressable
                  onPress={handleApplyCoupon}
                  disabled={!couponCode.trim() || couponLoading}
                  style={[styles.applyBtn, { backgroundColor: couponCode.trim() && !couponLoading ? colors.gold : colors.divider }]}
                >
                  {couponLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.applyBtnText, { color: couponCode.trim() ? "#fff" : colors.textMuted }]}>Apply</Text>
                  )}
                </Pressable>
              </View>
            </View>
            <Pressable onPress={() => router.replace("/(tabs)")} style={[styles.subscribeBtn, { backgroundColor: colors.gold }]}>
              <Text style={styles.subscribeBtnText}>Continue Exploring</Text>
            </Pressable>
          </View>
        </ScrollView>
        <Toast
          visible={toast.visible}
          message={toast.message}
          icon={toast.icon}
          iconColor={toast.iconColor}
          onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 130 : 90) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gold + "44", colors.gold + "11", colors.background]}
          style={[styles.hero, { paddingTop: insets.top + (isWeb ? 67 : 0) + 16 }]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={[styles.crownWrap, { backgroundColor: colors.gold + "33" }]}>
            <Icon name="star" size={40} color={colors.goldLight} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Go Premium</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Unlock the complete Islamic audio experience</Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.plansRow}>
            <Pressable
              onPress={() => setSelectedPlan("weekly")}
              style={[
                styles.planCard,
                { borderColor: selectedPlan === "weekly" ? colors.gold : colors.border, backgroundColor: selectedPlan === "weekly" ? colors.gold + "11" : colors.surface },
              ]}
            >
              {selectedPlan === "weekly" && <Icon name="check-circle" size={18} color={colors.goldLight} style={styles.planCheck} />}
              <Text style={[styles.planLabel, { color: colors.textSecondary }]}>Weekly</Text>
              <Text style={[styles.planPrice, { color: colors.textPrimary }]}>{formatPrice(weeklyNum)}</Text>
              <Text style={[styles.planPer, { color: colors.textSecondary }]}>/ week</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedPlan("monthly")}
              style={[
                styles.planCard,
                { borderColor: selectedPlan === "monthly" ? colors.gold : colors.border, backgroundColor: selectedPlan === "monthly" ? colors.gold + "11" : colors.surface },
              ]}
            >
              {savePct > 0 && (
                <View style={[styles.saveBadge, { backgroundColor: colors.green }]}>
                  <Text style={styles.saveBadgeText}>SAVE {savePct}%</Text>
                </View>
              )}
              {selectedPlan === "monthly" && <Icon name="check-circle" size={18} color={colors.goldLight} style={styles.planCheck} />}
              <Text style={[styles.planLabel, { color: colors.textSecondary }]}>Monthly</Text>
              <Text style={[styles.planPrice, { color: colors.textPrimary }]}>{formatPrice(monthlyNum)}</Text>
              <Text style={[styles.planPer, { color: colors.textSecondary }]}>/ month</Text>
            </Pressable>
          </View>

          <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.featuresTitle, { color: colors.textPrimary }]}>What's included</Text>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureCheck, { backgroundColor: colors.green + "22" }]}>
                  <Icon name="check" size={12} color={colors.green} />
                </View>
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.quranNote, { backgroundColor: "#0a2018", borderColor: colors.green + "33" }]}>
            <Icon name="book-open" size={18} color={colors.green} />
            <Text style={[styles.quranNoteText, { color: colors.textSecondary }]}>
              The Holy Qur'an is always <Text style={{ color: colors.green, fontWeight: "700" }}>FREE for everyone</Text>. No subscription required.
            </Text>
          </View>

          <View style={[styles.couponCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.couponLabel, { color: colors.textSecondary }]}>Have a referral or coupon code?</Text>
            <View style={styles.couponRow}>
              <TextInput
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                style={[styles.couponInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, color: colors.textPrimary }]}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                importantForAutofill="no"
                editable={!couponLoading}
              />
              <Pressable
                onPress={handleApplyCoupon}
                disabled={!couponCode.trim() || couponLoading}
                style={[styles.applyBtn, { backgroundColor: couponCode.trim() && !couponLoading ? colors.gold : colors.divider }]}
              >
                {couponLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.applyBtnText, { color: couponCode.trim() ? "#fff" : colors.textMuted }]}>Apply</Text>
                )}
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSubscribe}
            disabled={subscribeLoading}
            style={[styles.subscribeBtn, { backgroundColor: colors.gold, opacity: subscribeLoading ? 0.8 : 1 }]}
          >
            {subscribeLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.subscribeBtnText}>Processing…</Text>
              </View>
            ) : (
              <Text style={styles.subscribeBtnText}>
                Start {selectedPlan === "weekly" ? `${formatPrice(weeklyNum)}/week` : `${formatPrice(monthlyNum)}/month`} — Cancel Anytime
              </Text>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            Subscriptions renew automatically. Cancel anytime from your account settings.
          </Text>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={toast.icon}
        iconColor={toast.iconColor}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingBottom: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: { alignSelf: "flex-start", width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  crownWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  heroTitle: { fontSize: 28, fontWeight: "700" },
  heroSub: { fontSize: 14, textAlign: "center" },
  content: { padding: 16, gap: 14 },
  plansRow: { flexDirection: "row", gap: 12 },
  planCard: { flex: 1, borderRadius: 14, borderWidth: 2, padding: 16, alignItems: "center", gap: 4, position: "relative" },
  planCheck: { position: "absolute", top: 10, right: 10 },
  saveBadge: { position: "absolute", top: -10, left: "50%", marginLeft: -28, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  saveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  planLabel: { fontSize: 13, fontWeight: "500" },
  planPrice: { fontSize: 32, fontWeight: "700" },
  planPer: { fontSize: 13 },
  featuresCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  featuresTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureCheck: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 14, flex: 1 },
  quranNote: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  quranNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  couponCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  couponLabel: { fontSize: 13 },
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: { flex: 1, height: 42, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  applyBtn: { paddingHorizontal: 16, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 72 },
  applyBtnText: { fontSize: 14, fontWeight: "600" },
  subscribeBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  subscribeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disclaimer: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
