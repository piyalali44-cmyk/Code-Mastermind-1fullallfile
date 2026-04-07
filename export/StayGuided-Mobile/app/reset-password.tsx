import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Step = "email" | "code" | "newPassword" | "done";

const STEPS: Step[] = ["email", "code", "newPassword"];

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();
  const isWeb = Platform.OS === "web";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({
    visible: false, message: "", icon: "check",
  });

  const codeRefs = useRef<(TextInput | null)[]>([]);

  const showToast = (msg: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message: msg, icon, iconColor });
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Please enter a valid email address"); return; }
    setLoading(true);
    setError("");
    try {
      const _rpd = process.env.EXPO_PUBLIC_DOMAIN || "";
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
        || (_rpd ? `https://${_rpd}/api` : "http://localhost:8080/api");
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); }
      else { setStep("code"); }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const handleCodeInput = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/[^0-9]/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((d, i) => { if (index + i < 6) newCode[index + i] = d; });
      setCode(newCode);
      codeRefs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    const newCode = [...code];
    newCode[index] = value.replace(/[^0-9]/g, "");
    setCode(newCode);
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
    }
  };

  const handleVerifyCode = async () => {
    const otp = code.join("");
    if (otp.length < 6) { setError("Please enter the full 6-digit code"); return; }
    setLoading(true);
    setError("");
    try {
      // Route OTP verification through the API server to avoid direct
      // Supabase network calls from the mobile device (which can time out).
      const _rpd = process.env.EXPO_PUBLIC_DOMAIN || "";
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
        || (_rpd ? `https://${_rpd}/api` : "http://localhost:8080/api");
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: otp,
          type: "recovery",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Invalid or expired code. Please request a new code.");
        return;
      }
      // Establish the recovery session in the Supabase client so
      // updateUser({ password }) works in the next step.
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });
      if (sessionError) {
        setError("Session setup failed. Please try again.");
        return;
      }
      setStep("newPassword");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
      } else {
        // Password updated — user stays logged in with the current session.
        // Refresh the auth context and navigate straight to the home tabs.
        showToast("Password changed successfully!", "check-circle", "#22C55E");
        refreshUser().catch(() => {});
        // Small delay so the toast is visible before navigating.
        setTimeout(() => router.replace("/(tabs)"), 1200);
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const renderEmailStep = () => (
    <>
      <View style={[styles.iconWrap, { backgroundColor: colors.gold + "15" }]}>
        <Icon name="lock" size={34} color={colors.goldLight} />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Forgot your password?</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Enter the email address linked to your account. We'll send a verification code to reset your password.
        </Text>
      </View>
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: colors.error + "14", borderColor: colors.error + "40" }]}>
          <Icon name="alert-circle" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}
      <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceHigh, borderColor: error ? colors.error + "60" : colors.border }]}>
        <Icon name="mail" size={17} color={colors.textMuted} />
        <TextInput
          value={email}
          onChangeText={(t) => { setEmail(t); setError(""); }}
          placeholder="Email address"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          style={[styles.input, { color: colors.textPrimary }]}
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>
      <Pressable
        onPress={handleSendCode}
        style={[styles.button, { backgroundColor: colors.gold, opacity: loading ? 0.75 : 1 }]}
        disabled={loading}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>Sending...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="send" size={17} color="#fff" />
            <Text style={styles.buttonText}>Send Reset Code</Text>
          </View>
        )}
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Icon name="arrow-left" size={15} color={colors.textSecondary} />
        <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>Back to sign in</Text>
      </Pressable>
    </>
  );

  const renderCodeStep = () => (
    <>
      <View style={[styles.sentBadge, { backgroundColor: colors.gold + "14", borderColor: colors.gold + "30" }]}>
        <Icon name="mail-check" size={28} color={colors.goldLight} />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Check your inbox</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          We've sent a 6-digit verification code to
        </Text>
        <View style={[styles.emailBadge, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Icon name="mail" size={14} color={colors.goldLight} />
          <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 14 }}>{email}</Text>
        </View>
        <Text style={[{ color: colors.textMuted, fontSize: 12, textAlign: "center" }]}>
          Didn't receive it? Check your spam folder or resend below.
        </Text>
      </View>

      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: colors.error + "14", borderColor: colors.error + "40" }]}>
          <Icon name="alert-circle" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}

      <View style={{ gap: 10, width: "100%" }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 1, textAlign: "center" }}>
          ENTER CODE
        </Text>
        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { codeRefs.current[i] = ref; }}
              value={digit}
              onChangeText={(v) => handleCodeInput(i, v)}
              onKeyPress={({ nativeEvent }) => handleCodeKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.codeInput, {
                backgroundColor: digit ? colors.gold + "18" : colors.surfaceHigh,
                borderColor: digit ? colors.gold : colors.border,
                color: colors.textPrimary,
              }]}
              selectTextOnFocus
            />
          ))}
        </View>
      </View>

      <Pressable
        onPress={handleVerifyCode}
        style={[styles.button, {
          backgroundColor: code.join("").length === 6 ? colors.gold : colors.surfaceHigh,
          borderWidth: code.join("").length === 6 ? 0 : 1,
          borderColor: colors.border,
          opacity: loading ? 0.75 : 1,
        }]}
        disabled={loading}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={code.join("").length === 6 ? "#fff" : colors.textSecondary} size="small" />
            <Text style={[styles.buttonText, { color: code.join("").length === 6 ? "#fff" : colors.textSecondary }]}>Verifying...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="shield-check" size={17} color={code.join("").length === 6 ? "#fff" : colors.textSecondary} />
            <Text style={[styles.buttonText, { color: code.join("").length === 6 ? "#fff" : colors.textSecondary }]}>Verify Code</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => { setCode(["", "", "", "", "", ""]); setError(""); handleSendCode(); }}
        style={[styles.resendBtn, { borderColor: colors.border }]}
      >
        <Icon name="refresh-cw" size={14} color={colors.goldLight} />
        <Text style={{ color: colors.goldLight, fontSize: 14, fontWeight: "600" }}>Resend Code</Text>
      </Pressable>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <View style={[styles.iconWrap, { backgroundColor: colors.green + "15" }]}>
        <Icon name="shield-check" size={34} color={colors.green} />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Set a new password</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Identity verified. Choose a strong, secure password for your account.
        </Text>
      </View>

      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: colors.error + "14", borderColor: colors.error + "40" }]}>
          <Icon name="alert-circle" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}

      <View style={{ gap: 12, width: "100%" }}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New Password</Text>
          <View style={[styles.passwordRow, { backgroundColor: colors.surfaceHigh, borderColor: newPassword ? colors.gold + "66" : colors.border }]}>
            <Icon name="lock" size={16} color={colors.textMuted} />
            <TextInput
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(""); }}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showNew}
              style={[styles.input, { color: colors.textPrimary }]}
            />
            <Pressable onPress={() => setShowNew(!showNew)} style={{ padding: 4 }}>
              <Icon name={showNew ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm Password</Text>
          <View style={[styles.passwordRow, {
            backgroundColor: colors.surfaceHigh,
            borderColor: confirmPassword && confirmPassword === newPassword
              ? colors.green + "66"
              : confirmPassword && confirmPassword !== newPassword
              ? colors.error + "66"
              : colors.border,
          }]}>
            <Icon name="lock" size={16} color={colors.textMuted} />
            <TextInput
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showConfirm}
              style={[styles.input, { color: colors.textPrimary }]}
            />
            {confirmPassword.length > 0 && (
              <Icon
                name={confirmPassword === newPassword ? "check-circle" : "x-circle"}
                size={18}
                color={confirmPassword === newPassword ? colors.green : colors.error}
              />
            )}
            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
              <Icon name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable
        onPress={handleSetPassword}
        style={[styles.button, { backgroundColor: colors.gold, opacity: loading ? 0.75 : 1 }]}
        disabled={loading}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>Saving...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="check" size={17} color="#fff" />
            <Text style={styles.buttonText}>Set New Password</Text>
          </View>
        )}
      </Pressable>
    </>
  );

  const renderDoneStep = () => (
    <View style={[styles.doneContainer]}>
      <LinearGradient
        colors={[colors.green + "22", "transparent"]}
        style={styles.doneGradientRing}
      >
        <View style={[styles.doneIconWrap, { backgroundColor: colors.green + "1A" }]}>
          <Icon name="check-circle" size={52} color={colors.green} />
        </View>
      </LinearGradient>
      <View style={{ gap: 8, alignItems: "center" }}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary, fontSize: 24 }]}>Password Reset!</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Your password has been changed successfully. You can now sign in with your new credentials.
        </Text>
      </View>
      <View style={[styles.doneCheckRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.doneCheckIcon, { backgroundColor: colors.green + "20" }]}>
          <Icon name="shield-check" size={16} color={colors.green} />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>
          Your account is secured. Keep your password safe and don't share it with anyone.
        </Text>
      </View>
      <Pressable
        onPress={() => router.replace("/login")}
        style={[styles.button, { backgroundColor: colors.gold, marginTop: 4 }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="log-in" size={17} color="#fff" />
          <Text style={styles.buttonText}>Sign In Now</Text>
        </View>
      </Pressable>
    </View>
  );

  const currentStepIndex = STEPS.indexOf(step as "email" | "code" | "newPassword");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Reset Password</Text>
        <View style={{ width: 38 }} />
      </View>

      {step !== "done" && (
        <View style={[styles.progressBar, { backgroundColor: colors.surfaceHigh }]}>
          <View style={[styles.progressFill, {
            backgroundColor: colors.gold,
            width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
          }]} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === "email" && renderEmailStep()}
        {step === "code" && renderCodeStep()}
        {step === "newPassword" && renderNewPasswordStep()}
        {step === "done" && renderDoneStep()}
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
  container: { flex: 1 },
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
  progressBar: { height: 3, width: "100%" },
  progressFill: { height: 3, borderRadius: 2 },
  content: {
    padding: 28,
    paddingTop: 32,
    alignItems: "center",
    gap: 18,
    flexGrow: 1,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sentBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  stepTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  stepSubtitle: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    width: "100%",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    width: "100%",
  },
  input: { flex: 1, fontSize: 15 },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  backLinkText: { fontSize: 14, fontWeight: "500" },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center", width: "100%" },
  codeInput: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
  },
  doneContainer: { alignItems: "center", gap: 16, paddingTop: 20, width: "100%" },
  doneGradientRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  doneIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  doneCheckIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
