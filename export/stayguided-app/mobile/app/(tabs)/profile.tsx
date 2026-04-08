import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { ReferralCodeInput } from "@/components/ReferralCodeInput";
import { Toast } from "@/components/Toast";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import { ReferralStats, ReferralHistoryItem, applyReferralCode, getReferralHistory, getMyReferrer, getReferralStats, getUserReferralCode } from "@/lib/db";
import { supabase } from "@/lib/supabase";

interface MenuItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  showArrow?: boolean;
  tint?: string;
}

function MenuItem({ icon, label, value, onPress, showArrow = true, tint }: MenuItemProps) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.menuItem, { borderBottomColor: colors.divider }]}>
      <View style={[styles.menuIcon, { backgroundColor: (tint || colors.gold) + "22" }]}>
        <Icon name={icon} size={16} color={tint || colors.goldLight} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.menuRight}>
        {!!value && <Text style={[styles.menuValue, { color: colors.textSecondary }]}>{value}</Text>}
        {showArrow && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, session, isGuest, logout, refreshUser, applyXpBonus } = useAuth();
  const { nowPlaying } = useAudio();
  const { featureFlags, settings } = useAppSettings();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [referralModal, setReferralModal]   = useState(false);
  const [couponModal, setCouponModal]       = useState(false);
  const [couponCode, setCouponCode]         = useState("");
  const [couponLoading, setCouponLoading]   = useState(false);
  const [couponError, setCouponError]       = useState<string | null>(null);
  const [myCode, setMyCode]                 = useState<string | null>(null);
  const [codeLoading, setCodeLoading]       = useState(false);
  const [refStats, setRefStats]             = useState<ReferralStats>({ friendsReferred: 0, xpEarned: 0 });
  const [refHistory, setRefHistory]         = useState<ReferralHistoryItem[]>([]);
  const [myReferrer, setMyReferrer]         = useState<{ name: string; code: string } | null>(null);
  const [refHistoryLoading, setRefHistoryLoading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({
    visible: false, message: "", icon: "check",
  });

  const [signingOut, setSigningOut] = useState(false);

  const [verifyModal, setVerifyModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendVerifyOtp = async () => {
    if (!user?.email) return;
    setOtpSending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      // Even if resend returns an error (e.g. already confirmed), show the input
      // so the user can try entering a code they received.
      if (error) {
        console.warn("[sendVerifyOtp]", error.message);
      }
      setOtpSent(true);
    } catch (e: any) {
      // Network error — surface to user
      showToast("Failed to send code. Check your connection and try again.", "alert-circle", "#EF4444");
    } finally {
      setOtpSending(false);
    }
  };

  const confirmVerifyOtp = async () => {
    if (!user?.email || !otpCode.trim()) return;
    setOtpVerifying(true);
    try {
      // Route OTP verification through the API server to avoid direct
      // Supabase network calls from the mobile device (which can time out).
      const _pd = process.env.EXPO_PUBLIC_DOMAIN || "";
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
        || (_pd ? `https://${_pd}/api` : "http://localhost:8080/api");
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          token: otpCode.trim(),
          type: "signup",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error ?? "Invalid or expired code. Please try again.", "alert-circle", "#EF4444");
        return;
      }
      // Update the local Supabase session so emailVerified reflects the change.
      if (json.access_token && json.refresh_token) {
        await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        }).catch(() => {});
      }
      // Dismiss modal immediately, refresh user data in background.
      setVerifyModal(false);
      setOtpCode("");
      setOtpSent(false);
      showToast("Email verified successfully!", "check-circle", "#22C55E");
      refreshUser().catch(() => {});
    } catch (e: any) {
      showToast(e?.message ?? "Something went wrong. Please try again.", "alert-circle", "#EF4444");
    } finally {
      setOtpVerifying(false);
    }
  };

  const showToast = (msg: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message: msg, icon, iconColor });
  };

  const handleLogout = () => {
    const doLogout = async () => {
      setSigningOut(true);
      try {
        await logout();
        router.replace("/");
      } catch {
        showToast("Sign out failed. Please try again.", "alert-circle", colors.error);
        setSigningOut(false);
      }
    };

    if (Platform.OS === "web") {
      // Alert.alert doesn't render properly on web — skip confirmation.
      doLogout();
    } else {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: doLogout },
        ]
      );
    }
  };

  // Load referral code + stats when the user is known.
  // Listening time is NOT fetched here — it comes from user.totalHoursListened
  // which is synced by the auth context (same path as XP/streak) and cached
  // in AsyncStorage, so it shows instantly without a separate DB call.
  useEffect(() => {
    if (!user) return;
    let active = true;
    setCodeLoading(true);
    (async () => {
      const [code, stats] = await Promise.all([
        getUserReferralCode(user.id),
        getReferralStats(user.id),
      ]);
      if (!active) return;
      setMyCode(code);
      setCodeLoading(false);
      setRefStats(stats);
    })();
    return () => { active = false; };
  }, [user?.id]);

  // Load full referral history when the modal opens
  useEffect(() => {
    if (!referralModal || !user) return;
    let active = true;
    setRefHistoryLoading(true);
    Promise.all([
      getReferralHistory(user.id),
      getMyReferrer(user.id),
    ]).then(([history, referrer]) => {
      if (!active) return;
      setRefHistory(history);
      setMyReferrer(referrer);
    }).catch(() => {}).finally(() => {
      if (active) setRefHistoryLoading(false);
    });
    return () => { active = false; };
  }, [referralModal, user?.id]);

  const handleCopyCode = async () => {
    if (!myCode) return;
    try {
      await Clipboard.setStringAsync(myCode);
      showToast("Referral code copied!", "check-circle", colors.green);
    } catch {
      showToast("Copy not available on this device", "alert-circle", colors.error);
    }
  };

  const handleShare = async () => {
    const code = myCode ?? "StayGuided";
    try {
      await Share.share({
        message: `Join me on StayGuided Me — your Islamic audio journey app! Use my referral code ${code} when signing up to earn 100 bonus XP. Download the app now.`,
        title: "Join StayGuided Me",
      });
    } catch { /* user cancelled share */ }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!user) {
      setCouponError("Please sign in first.");
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await applyReferralCode(couponCode.trim(), session?.access_token);
      if (result.success) {
        setCouponCode("");
        setCouponModal(false);
        setCouponError(null);
        let msg = "Code applied successfully!";
        if (result.type === "free_days" && result.freeDays) {
          msg = `${result.freeDays} days of Premium unlocked!`;
        } else if (result.type === "influencer" || result.type === "referral") {
          msg = `Code applied! +${result.xpBonus ?? 100} XP earned.`;
        } else if (result.xpBonus) {
          msg = `Code applied! +${result.xpBonus} XP earned.`;
        }
        showToast(msg, "check-circle", colors.green);
        // Instant optimistic XP update + delayed DB sync (avoids getSession hang)
        if (result.xpBonus) applyXpBonus(result.xpBonus);
        else refreshUser().catch(() => {});
        const stats = await getReferralStats(user.id);
        setRefStats(stats);
      } else {
        const msg =
          result.error === "invalid_code"      ? "That code doesn't exist or has expired." :
          result.error === "already_used"      ? "You've already used this code." :
          result.error === "own_code"          ? "You can't use your own referral code." :
          result.error === "code_exhausted"    ? "This code has reached its maximum uses." :
          result.error === "new_users_only"    ? "This code is for new users only." :
          result.error === "not_authenticated" ? "Please sign in first." :
          result.error === "server_error"      ? "Server error. Please try again." :
          result.error || "Something went wrong. Please try again.";
        setCouponError(msg);
      }
    } finally {
      setCouponLoading(false);
    }
  };

  if (isGuest || !user) {
    const perks = [
      { icon: "zap",       label: "Earn XP & track your streak",    color: colors.goldLight },
      { icon: "bar-chart-2", label: "Detailed listening progress",  color: colors.goldLight },
      { icon: "award",     label: "Unlock badges & achievements",    color: colors.goldLight },
      { icon: "trophy",    label: "Compete on the leaderboard",      color: colors.goldLight },
    ];
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + (isWeb ? 67 : 0) + 24, paddingHorizontal: 28 }}>
        <View style={{ alignItems: "center", gap: 14 }}>
          <View style={[styles.guestAva, { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold + "33" }]}>
            <Icon name="user" size={40} color={colors.goldLight} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>Your Profile</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
            Create an account to track your Islamic learning journey
          </Text>
        </View>
        <View style={{ gap: 10, marginTop: 24, marginBottom: 28 }}>
          {perks.map((p) => (
            <View key={p.label} style={[styles.perkRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.perkIcon, { backgroundColor: colors.gold + "18" }]}>
                <Icon name={p.icon} size={16} color={p.color} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500", flex: 1 }}>{p.label}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={() => router.push("/login")} style={{ backgroundColor: colors.gold, paddingVertical: 15, borderRadius: 12, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Sign In or Create Account</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} style={{ alignItems: "center", marginTop: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>App Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gold + "33", colors.background]}
          style={[styles.profileHeader, { paddingTop: insets.top + (isWeb ? 67 : 0) + 16 }]}
        >
          <View style={{ position: "relative" }}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={[styles.avatar, { backgroundColor: colors.gold }]} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
                <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push("/edit-profile")}
              style={[styles.editBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="edit-2" size={12} color={colors.goldLight} />
            </Pressable>
          </View>
          <Text style={[styles.displayName, { color: colors.textPrimary }]}>{user.displayName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
            {user.emailVerified
              ? <Icon name="check-circle" size={14} color="#22C55E" />
              : (
                <Pressable
                  onPress={() => { setVerifyModal(true); setOtpSent(false); setOtpCode(""); }}
                  style={[styles.verifyBadge, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}
                >
                  <Icon name="alert-circle" size={11} color="#EF4444" />
                  <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>Verify</Text>
                </Pressable>
              )
            }
          </View>
          {user.isPremium ? (
            <View style={[styles.premiumBadge, { backgroundColor: colors.gold }]}>
              <Icon name="star" size={12} color="#fff" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          ) : settings.subscription_enabled ? (
            <Pressable
              onPress={() => router.push("/subscription")}
              style={[styles.upgradePill, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}
            >
              <Icon name="zap" size={12} color={colors.goldLight} />
              <Text style={[styles.upgradePillText, { color: colors.goldLight }]}>Upgrade to Premium</Text>
            </Pressable>
          ) : null}
        </LinearGradient>

        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.goldLight }]}>
              {(user.totalHoursListened ?? 0) >= 1
                ? `${user.totalHoursListened}h`
                : (user.totalHoursListened ?? 0) > 0
                  ? `${Math.round((user.totalHoursListened ?? 0) * 60)}m`
                  : "0m"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Listened</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.goldLight }]}>{user.streak}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Day Streak</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.goldLight }]}>{user.xp}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP</Text>
          </View>
        </View>

        <View style={[styles.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.levelTop}>
            <Text style={[styles.levelName, { color: colors.textPrimary }]}>Level {user.level}</Text>
            <Text style={[styles.levelXp, { color: colors.textSecondary }]}>{user.xp} / {user.level * 500} XP</Text>
          </View>
          <View style={[styles.levelBarBg, { backgroundColor: colors.divider }]}>
            <View style={[styles.levelBarFill, {
              width: `${Math.min(100, ((user.xp - (user.level - 1) * 500) / 500) * 100)}%`,
              backgroundColor: colors.gold,
            }]} />
          </View>
          <Text style={[styles.levelNext, { color: colors.textMuted }]}>
            {Math.max(0, user.level * 500 - user.xp)} XP to reach Level {user.level + 1}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 8, marginTop: 4 }}>
          <Text style={[styles.menuSection, { color: colors.textMuted }]}>ACTIVITY</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MenuItem icon="bar-chart-2" label="Progress" onPress={() => router.push("/progress")} />
            {featureFlags.leaderboard && (
              <MenuItem icon="award" label="Leaderboard" onPress={() => router.push("/leaderboard")} />
            )}
            {featureFlags.referral_program && (
              <MenuItem icon="users" label="Referral Program" onPress={() => setReferralModal(true)} />
            )}
          </View>

          <Text style={[styles.menuSection, { color: colors.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(settings.subscription_enabled || user.isPremium) && (
              <MenuItem icon="star" label="Premium" value={user.isPremium ? "Active" : "Free"} onPress={() => router.push("/subscription")} tint={colors.gold} />
            )}
            <MenuItem icon="gift" label="Redeem a Code" onPress={() => setCouponModal(true)} />
            <MenuItem icon="settings" label="Settings" onPress={() => router.push("/settings")} />
            <MenuItem icon="mail" label="Contact Support" onPress={() => router.push("/contact")} />
          </View>

          <Pressable
            onPress={handleLogout}
            disabled={signingOut}
            style={[styles.logoutBtn, { borderColor: colors.border, opacity: signingOut ? 0.6 : 1 }]}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Icon name="log-out" size={18} color={colors.error} />
            )}
            <Text style={[styles.logoutText, { color: colors.error }]}>
              {signingOut ? "Signing Out…" : "Sign Out"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Email Verification OTP Modal ── */}
      <Modal visible={verifyModal} transparent animationType="slide" onRequestClose={() => setVerifyModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVerifyModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
            <View style={{ alignItems: "center", gap: 10, marginBottom: 8, width: "100%" }}>
              <View style={[styles.modalIcon, { backgroundColor: "#EF444422" }]}>
                <Icon name="mail" size={26} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Verify Your Email</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                {otpSent
                  ? `A 6-digit code has been sent to ${user?.email}. Enter it below.`
                  : `Tap below to receive a verification code at ${user?.email}.`}
              </Text>
            </View>

            {!otpSent ? (
              <Pressable
                onPress={sendVerifyOtp}
                disabled={otpSending}
                style={[styles.modalBtn, { backgroundColor: "#EF4444", opacity: otpSending ? 0.7 : 1 }]}
              >
                {otpSending
                  ? <Text style={styles.modalBtnText}>Sending…</Text>
                  : <><Icon name="mail" size={16} color="#fff" /><Text style={styles.modalBtnText}>Send Verification Code</Text></>
                }
              </Pressable>
            ) : (
              <View style={{ width: "100%", gap: 12 }}>
                <TextInput
                  style={[styles.otpInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={colors.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <Pressable
                  onPress={confirmVerifyOtp}
                  disabled={otpVerifying || otpCode.length < 6}
                  style={[styles.modalBtn, { backgroundColor: "#22C55E", opacity: (otpVerifying || otpCode.length < 6) ? 0.6 : 1 }]}
                >
                  {otpVerifying
                    ? <Text style={styles.modalBtnText}>Verifying…</Text>
                    : <><Icon name="check-circle" size={16} color="#fff" /><Text style={styles.modalBtnText}>Confirm Code</Text></>
                  }
                </Pressable>
                <Pressable onPress={sendVerifyOtp} disabled={otpSending} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {otpSending ? "Resending…" : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Referral Program Modal ── */}
      <Modal visible={referralModal} transparent animationType="slide" onRequestClose={() => setReferralModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReferralModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={{ alignItems: "center", gap: 10, marginBottom: 4, width: "100%" }}>
              <View style={[styles.modalIcon, { backgroundColor: colors.gold + "22" }]}>
                <Icon name="users" size={26} color={colors.goldLight} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Referral Program</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                Share your code — you earn <Text style={{ color: colors.goldLight, fontWeight: "700" }}>500 XP</Text> per friend who joins, they earn <Text style={{ color: colors.goldLight, fontWeight: "700" }}>100 XP</Text> bonus.
              </Text>
            </View>

            {/* My code */}
            <View style={[styles.myCodeBox, { backgroundColor: colors.background, borderColor: colors.gold + "55" }]}>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={[styles.myCodeLabel, { color: colors.textMuted }]}>YOUR CODE</Text>
                <Text style={[styles.myCodeText, { color: codeLoading ? colors.textMuted : colors.goldLight, fontSize: codeLoading ? 14 : 22 }]}>
                  {codeLoading ? "loading…" : (myCode ?? "unavailable")}
                </Text>
              </View>
              <Pressable onPress={handleCopyCode} style={[styles.copyBtn, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "40" }]}>
                <Icon name="copy" size={15} color={colors.goldLight} />
                <Text style={[styles.copyBtnText, { color: colors.goldLight }]}>COPY</Text>
              </Pressable>
            </View>

            {/* Share button */}
            <Pressable onPress={handleShare} style={[styles.modalBtn, { backgroundColor: colors.gold }]}>
              <Icon name="share-2" size={16} color="#fff" />
              <Text style={styles.modalBtnText}>Share with Friends</Text>
            </Pressable>

            {/* Stats */}
            <View style={[styles.rewardInfo, { backgroundColor: colors.gold + "0E", borderColor: colors.gold + "28" }]}>
              <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Your Referral Stats</Text>
              <View style={styles.rewardRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="users" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Friends referred</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                  {refStats.friendsReferred}
                </Text>
              </View>
              <View style={[styles.rewardRow, { borderTopColor: colors.divider }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="zap" size={14} color={colors.goldLight} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>XP earned from referrals</Text>
                </View>
                <Text style={{ color: colors.goldLight, fontSize: 14, fontWeight: "700" }}>
                  {refStats.xpEarned.toLocaleString()} XP
                </Text>
              </View>
            </View>

            {/* Who referred me */}
            {myReferrer && (
              <View style={[styles.rewardInfo, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="heart" size={14} color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    You joined via <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{myReferrer.name}</Text>'s code
                  </Text>
                </View>
              </View>
            )}

            {/* Friends I referred */}
            {(refHistoryLoading || refHistory.length > 0) && (
              <View style={{ width: "100%", gap: 6 }}>
                <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: "700" }}>
                  Friends You Referred
                </Text>
                {refHistoryLoading ? (
                  <ActivityIndicator size="small" color={colors.goldLight} />
                ) : (
                  refHistory.map((item) => (
                    <View
                      key={item.referredId}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                        paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
                        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold + "22",
                          alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: colors.goldLight, fontSize: 12, fontWeight: "700" }}>
                            {item.referredName[0]?.toUpperCase() ?? "?"}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                            {item.referredName}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                            {new Date(item.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="zap" size={12} color={colors.goldLight} />
                        <Text style={{ color: colors.goldLight, fontSize: 12, fontWeight: "700" }}>
                          +{item.xpEarned}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Redeem a Code Modal ── */}
      <Modal
        visible={couponModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setCouponModal(false); setCouponError(null); setCouponCode(""); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setCouponModal(false); setCouponError(null); setCouponCode(""); }}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={{ alignItems: "center", gap: 10, marginBottom: 4, width: "100%" }}>
              <View style={[styles.modalIcon, { backgroundColor: colors.gold + "22" }]}>
                <Icon name="gift" size={26} color={colors.goldLight} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Redeem a Code</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                Enter a friend's referral code or a promotional code to earn bonus XP.
              </Text>
            </View>

            <ReferralCodeInput
              value={couponCode}
              onChange={(v) => { setCouponCode(v); setCouponError(null); }}
              onSubmit={handleApplyCoupon}
              placeholder="e.g. SGA1B2C3"
            />

            {!!couponError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.error + "18", borderWidth: 1, borderColor: colors.error + "44" }}>
                <Icon name="alert-circle" size={15} color={colors.error} />
                <Text style={{ flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>{couponError}</Text>
              </View>
            )}

            <Pressable
              onPress={handleApplyCoupon}
              disabled={!couponCode.trim() || couponLoading}
              style={[styles.modalBtn, {
                backgroundColor: couponCode.trim() && !couponLoading ? colors.gold : colors.gold + "40",
              }]}
            >
              {couponLoading ? (
                <Text style={styles.modalBtnText}>Applying…</Text>
              ) : (
                <>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={styles.modalBtnText}>Apply Code</Text>
                </>
              )}
            </Pressable>

            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
              Each code can only be redeemed once per account.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

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
  profileHeader: {
    alignItems: "center",
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  editBadge: {
    position: "absolute",
    bottom: 2, right: -4,
    width: 28, height: 28,
    borderRadius: 14, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  displayName: { fontSize: 22, fontWeight: "700" },
  email: { fontSize: 13 },
  premiumBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4,
  },
  premiumBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  upgradePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginTop: 4,
  },
  upgradePillText: { fontSize: 13, fontWeight: "600" },
  statsRow: {
    flexDirection: "row", marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, alignSelf: "stretch" },
  levelCard: { margin: 16, borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  levelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelName: { fontSize: 16, fontWeight: "700" },
  levelXp: { fontSize: 13 },
  levelBarBg: { height: 6, borderRadius: 3 },
  levelBarFill: { height: 6, borderRadius: 3 },
  levelNext: { fontSize: 12 },
  menuSection: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingLeft: 4, marginTop: 8 },
  menuCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 0.5,
  },
  menuIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuValue: { fontSize: 13 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 50, borderRadius: 12, borderWidth: 1, marginTop: 8, marginBottom: 24,
  },
  logoutText: { fontSize: 15, fontWeight: "600" },
  guestAva: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  perkRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
  },
  perkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1,
    padding: 24, gap: 16, alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  modalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, width: "100%",
  },
  modalBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  myCodeBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  myCodeLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  myCodeText: { fontSize: 22, fontWeight: "700", letterSpacing: 3 },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  copyBtnText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  rewardInfo: { borderWidth: 1, borderRadius: 14, padding: 16, width: "100%", gap: 0 },
  rewardRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderTopWidth: 0,
  },
  verifyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  otpInput: {
    width: "100%", height: 54, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 18, fontSize: 22, fontWeight: "700", letterSpacing: 6,
    textAlign: "center",
  },
});
