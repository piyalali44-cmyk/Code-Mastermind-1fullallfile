import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    content: `When you use StayGuided Me, we may collect the following information:

• Account Information: Your name, email address, and profile details when you create an account.
• Usage Data: Information about how you interact with the app, including listening history, favourites, bookmarks, and progress data.
• Device Information: Device type, operating system version, and app version for technical support purposes.
• Payment Information: If you subscribe to Premium, payment processing is handled securely through Apple App Store or Google Play Store. We do not store your payment details.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use your information to:

• Provide and improve our services, including personalised content recommendations.
• Track your listening progress, streaks, XP, and achievements.
• Sync your data across devices when you are signed in.
• Send you notifications about new content, streak reminders, and updates (with your permission).
• Respond to your enquiries and provide customer support.`,
  },
  {
    title: "3. Data Storage & Security",
    content: `Your data is stored securely using industry-standard encryption and security measures. We use Supabase as our backend service provider, which employs enterprise-grade security protocols.

• All data transfers are encrypted using TLS/SSL.
• Passwords are hashed and never stored in plain text.
• We regularly review and update our security practices.`,
  },
  {
    title: "4. Data Sharing",
    content: `We do not sell, trade, or share your personal information with third parties, except:

• When required by law or legal process.
• To protect the rights, property, or safety of StayGuided Me, our users, or the public.
• With service providers who assist us in operating the app (under strict confidentiality agreements).`,
  },
  {
    title: "5. Your Rights",
    content: `You have the right to:

• Access your personal data stored in our systems.
• Update or correct your profile information at any time.
• Delete your account and all associated data by contacting us.
• Opt out of notifications and marketing communications.
• Export your data upon request.`,
  },
  {
    title: "6. Children's Privacy",
    content: `StayGuided Me is suitable for users of all ages. We do not knowingly collect personal information from children under 13 without parental consent. If you believe a child has provided us with personal data, please contact us immediately.`,
  },
  {
    title: "7. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of any significant changes through the app or via email. Your continued use of the app after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "8. Contact Us",
    content: `If you have any questions about this Privacy Policy or your data, please contact us at:

Email: support@stayguided.me

You can also reach us through the Contact Us page within the app.`,
  },
];

export default function PrivacyPolicyScreen() {
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Privacy Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: hasMiniplayer ? 148 : 108 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.shieldIcon, { backgroundColor: colors.gold + "18" }]}>
            <Icon name="shield" size={24} color={colors.goldLight} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>Your Privacy Matters</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
            StayGuided Me is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.
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
  shieldIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionContent: { fontSize: 14, lineHeight: 22 },
});
