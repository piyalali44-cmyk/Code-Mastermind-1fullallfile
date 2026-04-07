import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function ChangePasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({
    visible: false, message: "", icon: "check",
  });

  const showToast = (msg: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message: msg, icon, iconColor });
  };

  const passwordStrength = () => {
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (newPassword.length >= 10) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strengthLabel = () => {
    const s = passwordStrength();
    if (s <= 1) return { label: "Weak", color: colors.error };
    if (s <= 3) return { label: "Fair", color: "#E09A2A" };
    return { label: "Strong", color: colors.green };
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showToast("Please enter your current password", "alert-circle", colors.error);
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters", "alert-circle", colors.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "alert-circle", colors.error);
      return;
    }
    if (!user?.email) {
      showToast("Could not identify your account. Please sign in again.", "alert-circle", colors.error);
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        showToast("Current password is incorrect", "shield-x", colors.error);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        showToast(updateError.message, "alert-circle", colors.error);
      } else {
        setSuccess(true);
      }
    } catch {
      showToast("Something went wrong. Please try again.", "alert-circle", colors.error);
    } finally {
      setLoading(false);
    }
  };

  const strength = strengthLabel();
  const strengthScore = passwordStrength();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Change Password</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {success ? (
          <View style={styles.successContainer}>
            <View style={[styles.successOuterRing, { borderColor: colors.green + "30" }]}>
              <View style={[styles.successInnerRing, { backgroundColor: colors.green + "18" }]}>
                <Icon name="check-circle" size={48} color={colors.green} />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Password Updated!</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
              Your password has been changed successfully. You're all set.
            </Text>
            <Pressable onPress={() => router.back()} style={[styles.submitBtn, { backgroundColor: colors.gold, marginTop: 8 }]}>
              <Text style={styles.submitBtnText}>Back to Settings</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: colors.gold + "18" }]}>
                <Icon name="shield" size={18} color={colors.goldLight} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>
                For your security, you must enter your current password before setting a new one.
              </Text>
            </View>

            <View style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Password</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="lock" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showCurrent}
                    style={[styles.input, { color: colors.textPrimary }]}
                  />
                  <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
                    <Icon name={showCurrent ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New Password</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: newPassword ? colors.gold + "66" : colors.border }]}>
                  <Icon name="lock" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showNew}
                    style={[styles.input, { color: colors.textPrimary }]}
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                    <Icon name={showNew ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                  </Pressable>
                </View>

                {newPassword.length > 0 && (
                  <View style={{ gap: 6, marginTop: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={styles.strengthBarRow}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <View
                            key={i}
                            style={[styles.strengthBar, {
                              backgroundColor: i <= strengthScore ? strength.color : colors.divider,
                            }]}
                          />
                        ))}
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: strength.color }}>{strength.label}</Text>
                    </View>
                    <View style={{ gap: 5 }}>
                      {[
                        { check: newPassword.length >= 6, label: "At least 6 characters" },
                        { check: /[A-Z]/.test(newPassword), label: "Contains uppercase letter" },
                        { check: /[0-9]/.test(newPassword), label: "Contains a number" },
                        { check: /[^A-Za-z0-9]/.test(newPassword), label: "Contains a special character" },
                      ].map(({ check, label }) => (
                        <View key={label} style={styles.strengthRow}>
                          <Icon name={check ? "check-circle" : "circle"} size={13} color={check ? colors.green : colors.textMuted} />
                          <Text style={{ color: check ? colors.green : colors.textMuted, fontSize: 12 }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm New Password</Text>
                <View style={[styles.inputRow, {
                  backgroundColor: colors.surface,
                  borderColor: confirmPassword && confirmPassword === newPassword
                    ? colors.green + "66"
                    : confirmPassword && confirmPassword !== newPassword
                    ? colors.error + "66"
                    : colors.border,
                }]}>
                  <Icon name="lock" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirm}
                    style={[styles.input, { color: colors.textPrimary }]}
                  />
                  {confirmPassword.length > 0 && (
                    <View style={{ paddingRight: 8 }}>
                      <Icon
                        name={confirmPassword === newPassword ? "check-circle" : "x-circle"}
                        size={18}
                        color={confirmPassword === newPassword ? colors.green : colors.error}
                      />
                    </View>
                  )}
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                    <Icon name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleChangePassword}
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              style={[styles.submitBtn, {
                backgroundColor: colors.gold,
                opacity: loading || !currentPassword || !newPassword || !confirmPassword ? 0.5 : 1,
              }]}
            >
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.submitBtnText}>Verifying...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="shield-check" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Update Password</Text>
                </View>
              )}
            </Pressable>
          </>
        )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15 },
  eyeBtn: { padding: 12 },
  dividerLine: { height: 1, marginVertical: 2 },
  strengthBarRow: { flexDirection: "row", gap: 4, flex: 1, marginRight: 12 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  submitBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  successContainer: { alignItems: "center", gap: 14, paddingTop: 40 },
  successOuterRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  successInnerRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 24, fontWeight: "700" },
});
