import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: `By downloading, installing, or using StayGuided Me ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.`,
  },
  {
    title: "2. Description of Service",
    content: `StayGuided Me is an Islamic audio application that provides:

• Free access to listen to all 114 surahs of the Holy Qur'an.
• A library of Islamic stories, including stories of the Prophets, Sahaba, Seerah, and Islamic history.
• Engagement features including XP tracking, streaks, achievements, and leaderboards.
• Premium subscription for additional features such as offline downloads and exclusive content.`,
  },
  {
    title: "3. User Accounts",
    content: `• You may use certain features as a guest, but creating an account unlocks full functionality.
• You are responsible for maintaining the confidentiality of your account credentials.
• You must provide accurate and complete information when creating an account.
• You must not create accounts for the purpose of abusing the app's features or harming others.`,
  },
  {
    title: "4. Subscription & Payments",
    content: `• Some features require a Premium subscription.
• Subscriptions are billed through the Apple App Store or Google Play Store.
• Subscription fees are charged at the beginning of each billing period.
• You may cancel your subscription at any time through your device's app store settings.
• Refunds are subject to the policies of Apple or Google, as applicable.`,
  },
  {
    title: "5. Content & Intellectual Property",
    content: `• All Qur'anic content is provided freely and is the word of Allah (SWT).
• Islamic stories and narrations are curated and produced by StayGuided Me.
• You may not reproduce, distribute, or create derivative works from our content without permission.
• All app designs, logos, and branding are the intellectual property of StayGuided Me.`,
  },
  {
    title: "6. Acceptable Use",
    content: `You agree not to:

• Use the App for any unlawful purpose.
• Attempt to gain unauthorised access to our systems or other users' accounts.
• Interfere with or disrupt the App's functionality.
• Upload or transmit any harmful, offensive, or inappropriate content.
• Use automated systems or bots to interact with the App.`,
  },
  {
    title: "7. Disclaimer",
    content: `• The App is provided "as is" without warranties of any kind.
• We strive for accuracy in all Islamic content but recommend consulting qualified scholars for specific religious rulings.
• We are not responsible for any actions taken based on the content provided in the App.`,
  },
  {
    title: "8. Limitation of Liability",
    content: `To the maximum extent permitted by law, StayGuided Me shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.`,
  },
  {
    title: "9. Changes to Terms",
    content: `We reserve the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms. We will notify users of significant changes.`,
  },
  {
    title: "10. Contact",
    content: `For any questions regarding these Terms of Service, please contact us at:

Email: support@stayguided.me`,
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { nowPlaying } = useAudio();
  const hasMiniplayer = !!nowPlaying;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Terms of Service</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: hasMiniplayer ? 148 : 108 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.docIcon, { backgroundColor: colors.gold + "18" }]}>
            <Icon name="file-text" size={24} color={colors.goldLight} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>Terms of Service</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
            Please read these terms carefully before using StayGuided Me.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Last updated: April 2026</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={{ gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.goldLight }]}>{section.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  headerCard: { alignItems: "center", gap: 10, padding: 20, borderRadius: 12, borderWidth: 1 },
  docIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionContent: { fontSize: 14, lineHeight: 22 },
});
