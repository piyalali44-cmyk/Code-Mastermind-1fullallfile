import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "@/components/Icon";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ReferralCodeInput } from "@/components/ReferralCodeInput";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useAuth, PENDING_REFERRAL_KEY } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Href, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightElement,
  colors,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  rightElement?: React.ReactNode;
  colors: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputWrap,
        {
          backgroundColor: colors.surfaceHigh,
          borderColor: focused ? colors.gold : colors.border,
        },
      ]}
    >
      <Icon name={icon} size={18} color={focused ? colors.gold : colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.textPrimary }]}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        importantForAutofill="no"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightElement}
    </View>
  );
}

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { login, signup, continueAsGuest, user } = useAuth() as any;
  const { settings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    Animated.spring(tabAnim, {
      toValue: next === "login" ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  };

  const submit = async () => {
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        router.replace("/(tabs)");
      } else {
        if (referralCode.trim()) {
          await AsyncStorage.setItem(PENDING_REFERRAL_KEY, referralCode.trim().toUpperCase());
        }
        await signup(email.trim(), password, name.trim());
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("Invalid login credentials")) setError("Incorrect email or password.");
      else if (msg.includes("Email not confirmed")) setError("Please verify your email first.");
      else if (msg.includes("User already registered")) setError("An account with this email already exists.");
      else if (msg.includes("Password should be")) setError("Password must be at least 6 characters.");
      else setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
    router.replace("/(tabs)");
  };

  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["2%", "51%"],
  });

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={Platform.OS === "ios" ? 20 : 40}
    >
        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: colors.gold + "1A", borderColor: colors.gold + "40" }]}>
            <View style={[styles.logoBg, { backgroundColor: colors.gold }]}>
              <Icon name="moon" size={30} color="#fff" />
            </View>
          </View>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>StayGuided Me</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>Your complete Islamic audio journey</Text>
        </View>

        <View style={[styles.segmentWrap, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Animated.View
            style={[
              styles.segmentIndicator,
              { backgroundColor: colors.gold, left: indicatorLeft },
            ]}
          />
          <Pressable style={styles.segmentBtn} onPress={() => switchMode("login")}>
            <Text style={[styles.segmentText, { color: mode === "login" ? "#fff" : colors.textMuted }]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable style={styles.segmentBtn} onPress={() => switchMode("signup")}>
            <Text style={[styles.segmentText, { color: mode === "signup" ? "#fff" : colors.textMuted }]}>
              Create Account
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === "signup" && (
            <InputField
              icon="user"
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              colors={colors}
            />
          )}

          <InputField
            icon="mail"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            colors={colors}
          />

          <InputField
            icon="lock"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            colors={colors}
            rightElement={
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                <Icon name={showPass ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
              </Pressable>
            }
          />

          {mode === "login" && (
            <Pressable onPress={() => router.push("/reset-password")} style={styles.forgotRow}>
              <Text style={[styles.forgotText, { color: colors.goldLight }]}>Forgot password?</Text>
            </Pressable>
          )}

          {mode === "signup" && (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setShowReferral(!showReferral)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
              >
                <View style={[styles.referralToggleIcon, {
                  backgroundColor: showReferral ? colors.gold + "22" : colors.surfaceHigh,
                  borderColor: showReferral ? colors.gold + "44" : colors.border,
                }]}>
                  <Icon name="gift" size={13} color={showReferral ? colors.goldLight : colors.textMuted} />
                </View>
                <Text style={[styles.referralToggleText, { color: showReferral ? colors.goldLight : colors.textMuted }]}>
                  {showReferral ? "Remove referral code" : "Have a referral code? +100 XP"}
                </Text>
                <Icon name={showReferral ? "chevron-up" : "chevron-down"} size={14} color={showReferral ? colors.goldLight : colors.textMuted} />
              </Pressable>
              {showReferral && (
                <ReferralCodeInput
                  value={referralCode}
                  onChange={setReferralCode}
                  placeholder="e.g. SGA1B2C3"
                  label="Friend's Referral Code"
                />
              )}
            </View>
          )}

          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "12", borderColor: colors.error + "35" }]}>
              <Icon name="alert-circle" size={15} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: colors.gold, opacity: loading ? 0.75 : 1 }]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{mode === "login" ? "Sign In" : "Create Account"}</Text>
            }
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {settings.guest_access_enabled && (
            <Pressable onPress={handleGuest} style={styles.guestLink}>
              <Text style={[styles.guestText, { color: colors.textMuted }]}>
                Browse without an account
              </Text>
            </Pressable>
          )}
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            By continuing you agree to our{" "}
            <Text style={{ color: colors.goldLight, textDecorationLine: "underline" }} onPress={() => router.push("/terms" as Href)}>Terms</Text>
            {" "}and{" "}
            <Text style={{ color: colors.goldLight, textDecorationLine: "underline" }} onPress={() => router.push("/privacy-policy" as Href)}>Privacy Policy</Text>
          </Text>
        </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoBg: {
    width: 68,
    height: 68,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  segmentWrap: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    position: "relative",
    height: 50,
    alignItems: "center",
  },
  segmentIndicator: {
    position: "absolute",
    width: "47%",
    top: 4,
    bottom: 4,
    borderRadius: 10,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
  },
  form: {
    gap: 14,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 54,
  },
  input: {
    flex: 1,
    fontSize: 15,
    letterSpacing: 0.1,
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "500",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  footer: {
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  divider: {
    width: "100%",
    height: 1,
  },
  guestLink: {
    paddingVertical: 4,
  },
  guestText: {
    fontSize: 14,
    fontWeight: "500",
  },
  disclaimer: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
  },
  referralToggleIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  referralToggleText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
