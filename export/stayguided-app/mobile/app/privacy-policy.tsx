import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    title: "1. Introduction and Scope",
    content: `Welcome to StayGuided Me ("we," "our," or "us"). This Privacy Policy describes how StayGuided Me collects, uses, processes, stores, and shares your personal information when you use our mobile application ("App") and related services (collectively, the "Services").

This Privacy Policy applies to all users of the App, regardless of location. By downloading, installing, accessing, or using the App, you acknowledge that you have read, understood, and agree to the terms of this Privacy Policy. If you do not agree with this Policy, please discontinue use of the App immediately.

We are committed to protecting the privacy and security of your personal information in accordance with applicable data protection laws, including but not limited to the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), the Children's Online Privacy Protection Act (COPPA), and applicable laws in the United Kingdom, Canada, Australia, and other jurisdictions.

This policy should be read alongside our Terms of Service, which governs your use of the App.`,
  },
  {
    title: "2. Information We Collect",
    content: `We collect the following categories of personal information:

A. INFORMATION YOU PROVIDE DIRECTLY
• Account Registration: Your full name, email address, username, and password when you create an account.
• Profile Information: Optional information such as your country of residence, profile photo, biography, and display name.
• Communication: Messages, feedback, support requests, and any information you provide when contacting us through the Contact Us feature or by email.
• User-Generated Content: Any comments, reviews, or other content you submit within the App.

B. INFORMATION WE COLLECT AUTOMATICALLY
• Usage Data: Content you listen to, episodes completed, series started, search queries, time spent in the App, features accessed, and interaction patterns.
• Progress & Gamification Data: Your XP points, streak counts, badges earned, quiz results, leaderboard position, and achievement history.
• Listening History: Tracks you have played, your playback position, content you have bookmarked or favourited.
• Device Information: Device model, operating system version and build number, unique device identifiers (such as Device ID or IDFV), screen resolution, language and region settings, time zone, and app version.
• Network Information: IP address, internet service provider, and connection type (Wi-Fi, cellular).
• Crash Reports and Diagnostics: Information about app crashes, errors, and performance issues to help us improve the App.
• Log Data: Server logs including timestamps, app activity, and error reports.

C. INFORMATION FROM THIRD-PARTY SERVICES
• Authentication Providers: If you sign in via a third-party service, we may receive your name, email address, and profile picture from that provider.
• Payment Processors: If you subscribe to Premium, payment transactions are processed entirely by Apple App Store or Google Play Store. We receive confirmation of your subscription status, plan type, and expiry date. We do not receive or store your credit card, debit card, or banking information at any time.
• Analytics Services: We may use third-party analytics tools to understand how users interact with the App. These services may collect device information and usage data in accordance with their own privacy policies.`,
  },
  {
    title: "3. How We Use Your Information",
    content: `We use the information we collect for the following purposes:

A. TO PROVIDE AND OPERATE THE SERVICES
• Create and manage your user account.
• Deliver the content and features you request, including Islamic audio content, Qur'an recitations, stories, and educational material.
• Sync your progress, preferences, and settings across multiple devices when you are signed in.
• Process and manage your Premium subscription status.
• Enable gamification features including XP, streaks, badges, quizzes, and leaderboards.

B. TO PERSONALISE YOUR EXPERIENCE
• Provide personalised content recommendations based on your listening history and preferences.
• Customise the Discover feed to surface content most relevant to you.
• Remember your last playback position and continue where you left off.
• Apply your language and theme preferences across sessions.

C. TO COMMUNICATE WITH YOU
• Send push notifications about new content releases, streak reminders, achievement milestones, and app updates (subject to your notification preferences).
• Respond to your customer support enquiries, feedback, and reports.
• Send important service announcements related to changes in Terms of Service, Privacy Policy, or your account.
• Notify you of system maintenance or service interruptions.

D. TO IMPROVE AND DEVELOP OUR SERVICES
• Analyse usage patterns to understand which features are most valuable to users.
• Diagnose and resolve technical issues, bugs, and errors.
• Conduct internal research, analytics, and performance monitoring.
• Test new features and improvements.

E. TO ENSURE SAFETY AND SECURITY
• Detect, investigate, and prevent fraudulent activity, abuse, and violations of our Terms of Service.
• Protect the integrity of our platform and the safety of our users.
• Comply with legal obligations and enforce our policies.

F. FOR LEGAL AND REGULATORY COMPLIANCE
• Comply with applicable laws, regulations, legal proceedings, and governmental requests.
• Establish, exercise, or defend legal claims.
• Fulfil our contractual and statutory obligations.

We process your data on the legal bases of: (i) performance of a contract with you; (ii) our legitimate interests; (iii) your consent where specifically sought; and (iv) compliance with a legal obligation.`,
  },
  {
    title: "4. Data Storage and Security",
    content: `A. WHERE YOUR DATA IS STORED
Your personal data is stored on secure cloud servers provided by Supabase, Inc., a trusted database and backend-as-a-service provider. Data may be stored and processed in data centres located in the United States and the European Union, depending on your region. By using the App, you consent to this transfer of data.

B. SECURITY MEASURES
We implement industry-standard technical and organisational security measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction, including:

• All data transmitted between the App and our servers is encrypted using Transport Layer Security (TLS 1.2 or higher).
• User passwords are hashed using bcrypt with a strong salt factor. We never store passwords in plain text.
• Access to personal data is restricted to authorised personnel only, on a strict need-to-know basis.
• Our database enforces Row Level Security (RLS) policies, ensuring users can only access their own data.
• Regular security audits and code reviews are conducted to identify and remediate vulnerabilities.
• We maintain backup procedures to prevent data loss.

C. DATA RETENTION
We retain your personal data for as long as your account is active or as needed to provide the Services. Specifically:
• Account and profile data is retained until you request account deletion.
• Listening history, XP, and progress data is retained for the duration of your account.
• Log data and crash reports are typically retained for up to 90 days.
• When you delete your account, we will delete or anonymise your personal data within 30 days, except where we are required by law to retain it for longer.

D. LIMITATIONS
While we implement robust security measures, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your data. You are responsible for maintaining the security of your account credentials.`,
  },
  {
    title: "5. Information Sharing and Disclosure",
    content: `We respect your privacy and do not sell, rent, or trade your personal information to third parties for their marketing purposes. We may share your information only in the following limited circumstances:

A. SERVICE PROVIDERS
We engage trusted third-party service providers who perform services on our behalf, including:
• Cloud hosting and database services (Supabase)
• Push notification delivery services
• Analytics and performance monitoring tools
• Customer support platforms

These service providers are contractually obligated to maintain the confidentiality and security of your data and may only use it to perform the services we have contracted with them.

B. LEGAL REQUIREMENTS
We may disclose your information if required to do so by law or if we believe that such disclosure is necessary to:
• Comply with a legal obligation, court order, or governmental request.
• Enforce our Terms of Service or other agreements.
• Protect the rights, property, or safety of StayGuided Me, our users, or the public.
• Detect, prevent, or address fraud, security issues, or technical problems.

C. BUSINESS TRANSFERS
In the event of a merger, acquisition, reorganisation, or sale of all or a portion of our assets, your personal data may be transferred to the acquiring entity. We will notify you via email and/or a prominent notice in the App prior to such transfer and inform you of any choices you may have.

D. AGGREGATED AND ANONYMISED DATA
We may share aggregated, anonymised, or de-identified information that cannot reasonably be used to identify you with partners, researchers, or the public for purposes such as understanding global Islamic content consumption trends.

E. WITH YOUR CONSENT
We may share your information with third parties when you have given us explicit consent to do so.`,
  },
  {
    title: "6. Cookies and Tracking Technologies",
    content: `A. TRACKING IN THE APP
We and our service providers may use device storage (such as AsyncStorage on mobile) to store preferences, session tokens, and cached content to provide a seamless experience. These are necessary for the App to function correctly.

B. ANALYTICS
We may use analytics services to collect anonymised information about how users interact with the App. This helps us understand usage patterns and improve the App. Analytics data is aggregated and does not include personally identifiable information unless you have provided explicit consent.

C. ADVERTISING
StayGuided Me does not display third-party advertisements in the App and does not use your data for targeted advertising purposes by external advertisers.

D. OPT-OUT
You may opt out of analytics data collection through the Settings menu within the App. Opting out will not affect your ability to use the App's core features.`,
  },
  {
    title: "7. Children's Privacy",
    content: `StayGuided Me is designed to be a family-friendly Islamic application suitable for users of all ages, including children. We are committed to complying with applicable children's privacy laws, including the Children's Online Privacy Protection Act (COPPA) in the United States and similar laws in other jurisdictions.

A. CHILDREN UNDER 13 (OR APPLICABLE AGE IN YOUR JURISDICTION)
• We do not knowingly collect personal information directly from children under the age of 13 (or the applicable minimum age in your country) without verifiable parental or guardian consent.
• Features such as leaderboards, account creation, and social features require users to be of a minimum age or to have parental consent.
• Parents and guardians who believe their child has provided us with personal information without their consent should contact us at support@stayguided.me. Upon verification, we will promptly delete such information from our systems.

B. PARENTAL CONTROLS
• Parents may contact us to review, modify, or delete their child's account and associated data.
• We recommend parents monitor their children's use of the App.
• The Qur'an listening feature is available without account creation, allowing children to benefit from the App's core purpose without providing any personal data.

C. SAFE CONTENT
• All content within StayGuided Me is Islamic educational and spiritual material appropriate for all ages.
• The App does not contain advertising, violence, adult content, or material inappropriate for children.`,
  },
  {
    title: "8. Your Privacy Rights",
    content: `Depending on your location, you may have the following rights in relation to your personal information:

A. RIGHT OF ACCESS
You have the right to request a copy of the personal data we hold about you. You can access much of your data directly within the App's profile and settings sections.

B. RIGHT TO RECTIFICATION
You have the right to request that we correct any inaccurate or incomplete personal data we hold about you. You can update your profile information directly in the App at any time.

C. RIGHT TO ERASURE ("RIGHT TO BE FORGOTTEN")
You may request that we delete your account and all associated personal data. To request account deletion, please navigate to Settings > Account > Delete Account, or contact us at support@stayguided.me. We will process your request within 30 days.

D. RIGHT TO DATA PORTABILITY
You have the right to receive your personal data in a structured, commonly used, and machine-readable format and to transmit that data to another service provider. To request a data export, contact us at support@stayguided.me.

E. RIGHT TO RESTRICT PROCESSING
You may request that we temporarily restrict the processing of your personal data in certain circumstances, such as while we verify the accuracy of data you have contested.

F. RIGHT TO OBJECT
You have the right to object to the processing of your personal data for direct marketing purposes or where we process your data based on our legitimate interests.

G. RIGHT TO WITHDRAW CONSENT
Where processing is based on your consent, you have the right to withdraw that consent at any time without affecting the lawfulness of processing carried out prior to withdrawal.

H. CALIFORNIA RESIDENTS (CCPA)
If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete your personal information, and the right to opt out of the sale of personal information. We do not sell personal information.

I. EU / UK RESIDENTS (GDPR)
If you are located in the European Economic Area (EEA) or the United Kingdom, you have rights under the General Data Protection Regulation (GDPR) or UK GDPR, including the rights described above. You also have the right to lodge a complaint with your local supervisory authority.

J. HOW TO EXERCISE YOUR RIGHTS
To exercise any of the rights described above, please contact us at support@stayguided.me with the subject line "Privacy Rights Request." We will respond to your request within the timeframe required by applicable law (typically within 30 days).`,
  },
  {
    title: "9. Third-Party Services and Links",
    content: `A. THIRD-PARTY SERVICES
The App integrates with the following third-party services, each of which has its own privacy policy:

• Supabase (supabase.com) — Database, authentication, and backend services
• Apple App Store — Subscription billing and in-app purchases for iOS users
• Google Play Store — Subscription billing and in-app purchases for Android users

We are not responsible for the privacy practices of these third-party services. We encourage you to review their respective privacy policies.

B. EXTERNAL LINKS
The App may contain links to external websites or resources. We are not responsible for the content or privacy practices of those sites. We encourage you to review the privacy policies of any website you visit.

C. ISLAMIC CONTENT SOURCES
Audio content in the App is sourced from reputable Islamic scholars and institutions. When content originates from third parties, we do not share your personal data with those content providers.`,
  },
  {
    title: "10. Push Notifications",
    content: `A. TYPES OF NOTIFICATIONS
We may send you push notifications for the following purposes:
• Daily streak reminders to help you maintain your listening consistency.
• New content availability alerts for series or episodes you follow.
• Achievement and milestone celebrations (e.g., earning a badge, reaching a new XP level).
• Important account and service notifications (e.g., password changes, subscription renewals).
• Special Islamic calendar reminders (e.g., Ramadan features, Friday reminders).

B. YOUR CONSENT
Push notifications require your explicit permission. You will be asked to grant notification permission when you first use the App. You may grant or revoke this permission at any time through your device's Settings.

C. MANAGING NOTIFICATIONS
You can manage your notification preferences at any time through:
• The App's Settings menu under Notifications.
• Your device's operating system Settings under app notification permissions.

Disabling notifications will not affect your ability to use the App's core features.`,
  },
  {
    title: "11. Data Transfers",
    content: `StayGuided Me operates globally. Your personal information may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have data protection laws that are different from those in your country.

When we transfer personal data from the European Economic Area, the United Kingdom, or Switzerland to countries that have not been deemed adequate by the relevant authorities, we ensure that appropriate safeguards are in place, such as:
• Standard Contractual Clauses (SCCs) approved by the European Commission.
• Data processing agreements with our service providers that include appropriate data protection commitments.

By using the App, you acknowledge and consent to the transfer of your information as described in this Policy.`,
  },
  {
    title: "12. Changes to This Privacy Policy",
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or for other operational reasons. When we make material changes, we will:

• Update the "Last Updated" date at the top of this Policy.
• Notify you through a prominent notice within the App.
• Send you an email notification if the change significantly affects your rights or how we handle your data.

Your continued use of the App after the effective date of the updated Privacy Policy constitutes your acceptance of the changes. If you do not agree with the updated Privacy Policy, you must discontinue use of the App and may request deletion of your account.

We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.`,
  },
  {
    title: "13. Contact Information and Data Controller",
    content: `If you have any questions, concerns, or requests relating to this Privacy Policy or our data practices, please contact us:

App Name: StayGuided Me
Email: support@stayguided.me

You can also submit privacy-related requests through the Contact Us section within the App.

We will acknowledge your enquiry promptly and respond within the timeframe required by applicable law. For formal legal notices, please send correspondence to the email address above with the subject line "Legal Notice."

If you have a complaint about how we handle your personal data and are not satisfied with our response, you may have the right to lodge a complaint with the relevant data protection authority in your jurisdiction.`,
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
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            StayGuided Me is committed to protecting your privacy and handling your personal data with the utmost care and transparency. This comprehensive policy explains in detail how we collect, use, store, and safeguard your information.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <View style={[styles.badgePill, { backgroundColor: colors.green + "18", borderColor: colors.green + "33" }]}>
              <Icon name="check" size={10} color={colors.green} />
              <Text style={{ color: colors.green, fontSize: 11, fontWeight: "600" }}>GDPR Compliant</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.green + "18", borderColor: colors.green + "33" }]}>
              <Icon name="check" size={10} color={colors.green} />
              <Text style={{ color: colors.green, fontSize: 11, fontWeight: "600" }}>COPPA Compliant</Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Effective Date: 1 April 2026 · Last Updated: April 2026</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.goldLight }]}>{section.title}</Text>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{section.content}</Text>
          </View>
        ))}

        <View style={[styles.footerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.footerIconWrap, { backgroundColor: "#10B98118" }]}>
            <Icon name="shield" size={24} color="#10B981" />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
            Privacy Questions?
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            If you have concerns about how we handle your data or wish to exercise your privacy rights, please contact our support team.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/contact")}
            activeOpacity={0.8}
            style={[styles.contactBtn, { backgroundColor: "#10B981" }]}
          >
            <Icon name="mail" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  headerCard: { alignItems: "center", gap: 10, padding: 20, borderRadius: 14, borderWidth: 1 },
  shieldIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  badgePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 18, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  divider: { height: 1 },
  sectionContent: { fontSize: 14, lineHeight: 23 },
  footerCard: { alignItems: "center", gap: 12, padding: 24, borderRadius: 14, borderWidth: 1 },
  footerIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  contactBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 4 },
  contactBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
