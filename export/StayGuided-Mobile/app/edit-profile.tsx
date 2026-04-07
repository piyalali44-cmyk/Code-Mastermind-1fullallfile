import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const isWeb = Platform.OS === "web";

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({ visible: false, message: "", icon: "check" });

  const showToast = (message: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message, icon, iconColor });
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast("Permission needed to access photos", "alert-circle", colors.error);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (_) {
      showToast("Could not open photo library", "alert-circle", colors.error);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !displayName.trim()) return;
    setSaving(true);
    try {
      let avatarUrl = user.avatarUrl;

      if (avatarUri && avatarUri !== user.avatarUrl && !avatarUri.startsWith("https://")) {
        try {
          const response = await fetch(avatarUri);
          const blob = await response.blob();
          // Use blob.type for accurate content-type (works for data URIs and blob URLs)
          const mimeType = blob.type || "image/jpeg";
          const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
          const fileName = `${user.id}/avatar.${ext}`;
          const arrayBuffer = await new Response(blob).arrayBuffer();
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, arrayBuffer, {
              contentType: mimeType,
              upsert: true,
            });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
            avatarUrl = urlData.publicUrl;
          }
        } catch (_) {}
      }

      const updateData: Record<string, unknown> = {
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };
      if (bio !== (user.bio ?? "")) {
        updateData.bio = bio.trim() || null;
      }
      await supabase.from("profiles").update(updateData).eq("id", user.id);

      await refreshUser();
      showToast("Profile updated", "check-circle", colors.green);
      setTimeout(() => router.back(), 800);
    } catch (_) {
      showToast("Could not save changes", "alert-circle", colors.error);
    } finally {
      setSaving(false);
    }
  };

  const initials = displayName ? displayName.charAt(0).toUpperCase() : "?";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={saving || !displayName.trim()} style={[styles.saveBtn, { opacity: saving || !displayName.trim() ? 0.5 : 1 }]}>
          {saving ? <ActivityIndicator size="small" color={colors.gold} /> : <Text style={[styles.saveBtnText, { color: colors.gold }]}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <Pressable onPress={pickImage} style={{ alignItems: "center" }}>
            <View style={[styles.avatarWrap, { backgroundColor: colors.gold, borderColor: colors.gold + "44" }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={[styles.cameraIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="camera" size={14} color={colors.goldLight} />
              </View>
            </View>
          </Pressable>
          <Pressable onPress={pickImage}>
            <Text style={{ color: colors.goldLight, fontSize: 14, fontWeight: "600" }}>Change Photo</Text>
          </Pressable>
        </View>

        <View style={{ gap: 20 }}>
          <View style={{ gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor={colors.textMuted}
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.bioInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
            <View style={[styles.input, styles.readOnlyInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>{user?.email}</Text>
              <Icon name="lock" size={14} color={colors.textMuted} />
            </View>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="info" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>
            Your profile is visible to others on the leaderboard. Choose a display name you're comfortable sharing.
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  saveBtn: { width: 50, alignItems: "flex-end" },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  avatarImg: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  avatarText: { color: "#fff", fontSize: 40, fontWeight: "700" },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  readOnlyInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
});
