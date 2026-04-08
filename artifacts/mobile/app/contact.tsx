import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

import { useColors } from "@/hooks/useColors";

const _cd = process.env.EXPO_PUBLIC_DOMAIN || "";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
  || (_cd ? `https://${_cd}/api` : "http://localhost:8080/api");

export default function ContactScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { nowPlaying } = useAudio();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [name, setName] = useState(user?.displayName ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({ visible: false, message: "", icon: "check" });

  const showToast = (msg: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message: msg, icon, iconColor });
  };

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) {
      showToast("Please fill in all fields", "alert-circle", colors.error);
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: user?.email ?? "",
          subject: subject.trim(),
          message: message.trim(),
          userId: user?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setSent(true);
    } catch {
      showToast("Failed to send. Please try again.", "alert-circle", colors.error);
    } finally {
      setSending(false);
    }
  };

  const handleNewMessage = () => {
    setSubject("");
    setMessage("");
    setSent(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Contact Support</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: hasMiniplayer ? 148 : 108 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sent ? (
          <View style={styles.sentContainer}>
            <View style={[styles.sentRing, { borderColor: colors.green + "33" }]}>
              <View style={[styles.sentIconWrap, { backgroundColor: colors.green + "18" }]}>
                <Icon name="check-circle" size={44} color={colors.green} />
              </View>
            </View>

            <View style={{ alignItems: "center", gap: 8 }}>
              <Text style={[styles.sentTitle, { color: colors.textPrimary }]}>Message Sent!</Text>
              <Text style={[styles.sentSubtitle, { color: colors.textSecondary }]}>
                JazakAllah Khayran for reaching out. We've received your message and will respond as soon as possible, InshaAllah.
              </Text>
            </View>

            <View style={[styles.sentInfoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.sentInfoIcon, { backgroundColor: colors.gold + "18" }]}>
                <Icon name="clock" size={16} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>Typical Response Time</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Within 2–5 business days</Text>
              </View>
            </View>

            <View style={{ gap: 10, width: "100%" }}>
              <Pressable
                onPress={handleNewMessage}
                style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.gold, opacity: pressed ? 0.85 : 1 }]}
              >
                <Icon name="edit-3" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Send Another Message</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Icon name="arrow-left" size={16} color={colors.textSecondary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: colors.gold + "18" }]}>
                <Icon name="message-circle" size={20} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>How can we help?</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                  Fill out the form below and our team will get back to you as soon as possible.
                </Text>
              </View>
            </View>

            <View style={{ gap: 16 }}>
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Your Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Subject</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="What is this about?"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Message</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Write your message here..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  style={[styles.input, styles.messageInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                />
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={sending}
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.gold, opacity: sending || pressed ? 0.8 : 1 }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="send" size={16} color="#fff" />
                  <Text style={styles.submitBtnText}>Send Message</Text>
                </>
              )}
            </Pressable>

            <View style={[styles.noteRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="info" size={15} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, lineHeight: 18 }}>
                We typically respond within 2–5 business days. For urgent matters, you can also reach out through our social channels.
              </Text>
            </View>
          </>
        )}
      </KeyboardAwareScrollViewCompat>

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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  infoCard: { flexDirection: "row", gap: 14, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  messageInput: { minHeight: 140 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 12 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  noteRow: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  sentContainer: { alignItems: "center", gap: 24, paddingTop: 32 },
  sentRing: { width: 112, height: 112, borderRadius: 56, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  sentIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  sentTitle: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  sentSubtitle: { fontSize: 14, lineHeight: 22, textAlign: "center", paddingHorizontal: 8 },
  sentInfoRow: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", width: "100%" },
  sentInfoIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 12 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
});
