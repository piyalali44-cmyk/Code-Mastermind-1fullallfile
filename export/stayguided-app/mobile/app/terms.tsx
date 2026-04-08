import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: `Welcome to StayGuided Me. These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and StayGuided Me ("Company," "we," "our," or "us") governing your access to and use of the StayGuided Me mobile application ("App") and all associated services, content, and features (collectively, the "Services").

By downloading, installing, accessing, registering for, or using the App in any manner, you confirm that:
(i) you have read, understood, and agree to be bound by these Terms in their entirety;
(ii) you are at least 13 years of age, or, if younger, you have obtained verifiable parental or guardian consent;
(iii) if you are using the App on behalf of an organisation, you have the authority to bind that organisation to these Terms.

If you do not agree to any part of these Terms, you must immediately cease use of the App and uninstall it from your device.

We reserve the right to update these Terms at any time. We will notify you of material changes through the App or via email. Your continued use of the App after any such changes constitutes your acceptance of the revised Terms.`,
  },
  {
    title: "2. Description of Services",
    content: `StayGuided Me is an Islamic audio application providing users with access to spiritual, educational, and devotional content. The Services include:

A. QUR'AN LISTENING
• Free and unrestricted access to complete audio recitations of all 114 Surahs of the Holy Qur'an by reputable and qualified Qari (reciters).
• Multiple recitation styles and Qari options where available.
• The Qur'an shall always remain freely accessible to all users, regardless of subscription status. This is a foundational commitment of StayGuided Me.

B. ISLAMIC STORY LIBRARY
• A curated and growing library of Islamic audio content including:
  — Stories of the Prophets (Qasas ul-Anbiya)
  — Seerah of the Prophet Muhammad ﷺ
  — Stories of the Companions of the Prophet (Sahaba)
  — Islamic history from pre-Islamic Arabia through to the modern era
  — Stories of righteous scholars, saints, and historical Islamic figures
  — Moral and educational stories suitable for all ages

C. EDUCATIONAL CONTENT
• Tafseer (Qur'anic exegesis) series covering selected Surahs and Juz
• Hadith collections including the 40 Hadith of Imam Nawawi
• Pillars of Islam and foundational Islamic knowledge series
• Islamic jurisprudence and contemporary issues discussed by qualified scholars

D. GAMIFICATION AND ENGAGEMENT FEATURES
• XP (Experience Points) system tracking your listening progress and activity
• Daily streak counters rewarding consistent engagement
• Achievement badges for reaching milestones
• Quizzes and knowledge tests on Islamic topics
• A global and regional leaderboard system
• Journey Through Islam: a guided chronological pathway through Islamic history

E. PREMIUM SUBSCRIPTION FEATURES
Certain features and content are available exclusively to Premium subscribers, including:
• Offline downloads for listening without an internet connection
• Early or exclusive access to new content series
• Background audio playback on all content
• Full transcript access where available
• Priority customer support
• Ad-free experience (should ads ever be introduced)

F. COMMUNITY FEATURES
• Referral programme enabling users to invite friends and earn rewards
• Optional sharing of achievements and progress

G. ADMINISTRATIVE TOOLS (ADMIN USERS ONLY)
• Content management, user management, and platform administration tools are available exclusively to authorised administrators. Unauthorised access to administrative functions is strictly prohibited.`,
  },
  {
    title: "3. User Accounts",
    content: `A. REGISTRATION
• Guest Access: Certain features of the App, including Qur'an listening, may be used without an account. However, creating a free account is required to access personalised features, progress tracking, streaks, and gamification.
• Account Creation: To create an account, you must provide a valid email address and password. You may optionally provide additional profile information such as a display name and country.
• Accuracy of Information: You agree to provide accurate, current, and complete information at the time of registration and to keep your account information updated at all times.
• One Account Per User: You may not create multiple accounts. Creating duplicate or fake accounts is a violation of these Terms.

B. ACCOUNT SECURITY
• You are solely responsible for maintaining the confidentiality and security of your account credentials, including your password.
• You are responsible for all activities that occur under your account, whether or not you authorised them.
• You must notify us immediately at support@stayguided.me if you suspect any unauthorised access to or use of your account.
• We recommend choosing a strong, unique password and enabling any security features available on your device.
• We will never ask you for your password via email or any other unsolicited communication.

C. ACCOUNT SUSPENSION AND TERMINATION
• We reserve the right to suspend or permanently terminate your account, with or without notice, if we determine, in our sole discretion, that you have violated these Terms, engaged in fraudulent activity, or posed a risk to other users or the platform.
• Upon termination, your right to use the App will immediately cease, and any Premium subscription benefits will no longer be available.
• You may delete your own account at any time by going to Settings > Account > Delete Account within the App, or by contacting us at support@stayguided.me.

D. ACCOUNT DELETION
Upon account deletion:
• Your personal profile data, listening history, XP, and achievements will be permanently deleted within 30 days.
• Any active Premium subscription will be cancelled at the end of the current billing period.
• Content you have downloaded for offline use will be inaccessible.`,
  },
  {
    title: "4. Subscription, Billing, and Payments",
    content: `A. SUBSCRIPTION PLANS
StayGuided Me offers the following subscription plans for Premium access:
• Weekly Plan: Billed on a recurring weekly basis.
• Monthly Plan: Billed on a recurring monthly basis. This plan offers the best value per day of access.
• Lifetime Plan: Where available, a one-time payment granting permanent Premium access.

All prices are displayed in the App and may vary by country due to local pricing, taxes, and currency differences. Prices are subject to change with reasonable notice.

B. FREE TRIAL
Where a free trial is offered, the trial period will be clearly stated. At the end of the free trial, you will be automatically charged the applicable subscription fee unless you cancel before the trial ends. No charge will be made if you cancel before the trial expires.

C. BILLING AND PAYMENT PROCESSING
• All subscription purchases and billing are processed exclusively through the Apple App Store (for iOS devices) or Google Play Store (for Android devices), as applicable.
• By initiating a subscription, you authorise Apple or Google to charge the applicable subscription fee to the payment method associated with your Apple ID or Google account.
• We do not directly collect, store, or process your payment card information.
• Your subscription will automatically renew at the end of each billing period unless you cancel before the renewal date.

D. CANCELLATION
• You may cancel your subscription at any time by:
  — iOS: Go to Settings > [Your Name] > Subscriptions on your Apple device and cancel the StayGuided Me subscription.
  — Android: Go to Google Play Store > Menu > Subscriptions and cancel the StayGuided Me subscription.
• Cancellation takes effect at the end of your current billing period. You will retain Premium access until that date.
• Cancelling a subscription does not entitle you to a refund of any amounts already charged.
• We are unable to process cancellations directly. All cancellations must be made through your device's app store.

E. REFUND POLICY
• Subscription fees are non-refundable except as required by applicable law or as determined by Apple or Google under their respective refund policies.
• For refund requests, please contact:
  — Apple App Store: support.apple.com/billing
  — Google Play Store: support.google.com/googleplay/answer/2479637
• We are not able to process refunds directly and have no authority to override the decisions of Apple or Google regarding refunds.

F. PRICE CHANGES
We reserve the right to modify subscription pricing. We will provide reasonable advance notice of any price changes through the App or via email. If you do not agree with a price change, you must cancel your subscription before the new price takes effect.

G. PROMO CODES AND REFERRAL REWARDS
• We may, at our sole discretion, offer promotional codes, coupon codes, or referral rewards that grant temporary Premium access, XP bonuses, or other benefits.
• Promotional offers are subject to their own terms and expiry dates.
• Promotional codes are non-transferable, cannot be exchanged for cash, and may not be combined with other offers unless otherwise stated.
• We reserve the right to revoke promotional benefits if we suspect abuse or misuse of the promotional system.

H. TAXES
The prices displayed may or may not include applicable taxes depending on your location. You are responsible for any taxes applicable to your subscription purchase.`,
  },
  {
    title: "5. Intellectual Property Rights",
    content: `A. OWNERSHIP
StayGuided Me and its licensors own all intellectual property rights in and to the App and its content, including but not limited to:
• The App software, source code, and underlying technology.
• The StayGuided Me name, logo, trademarks, service marks, and branding.
• All original audio productions, scripts, narrations, and editorial content created by or for StayGuided Me.
• The App's design, user interface, graphics, icons, and visual elements.
• The gamification system, including XP mechanics, badge designs, and leaderboard architecture.

B. QUR'ANIC CONTENT
The Holy Qur'an is the word of Allah (SWT) and is the common heritage of all Muslims. The specific recordings made available in the App are provided by qualified Qari under appropriate licensing arrangements. These recordings may not be reproduced, redistributed, or used commercially without the explicit permission of the original reciter.

C. THIRD-PARTY CONTENT
Some content within the App may be licensed from third-party content creators, scholars, or institutions. Such content is used with permission and remains the intellectual property of the original rights holders.

D. LICENCE TO USE
Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable licence to:
• Download and use the App on your personal device(s) for your personal, non-commercial use.
• Access and listen to content in accordance with your subscription status.

This licence does not include the right to:
• Copy, modify, distribute, sell, or sublicense any part of the App or its content.
• Reverse engineer, decompile, or disassemble the App.
• Remove any copyright or proprietary notices from the App.
• Use the App's content for commercial purposes without prior written permission.

E. USER CONTENT
If you submit any content to the App (such as comments, reviews, or forum posts where applicable), you grant us a non-exclusive, worldwide, royalty-free licence to use, reproduce, modify, and display such content in connection with the Services. You represent that you have the right to submit such content and that it does not infringe the intellectual property rights of any third party.`,
  },
  {
    title: "6. Acceptable Use Policy",
    content: `You agree to use the App only for lawful purposes and in a manner consistent with the values and spirit of Islamic conduct. You agree not to:

A. PROHIBITED CONDUCT
• Use the App for any purpose that is illegal, fraudulent, harmful, or prohibited by these Terms.
• Violate any applicable local, national, or international law or regulation.
• Engage in any conduct that is harassing, abusive, threatening, defamatory, obscene, or otherwise objectionable.
• Attempt to gain unauthorised access to the App, our servers, databases, or any other systems or networks connected to the App.
• Interfere with or disrupt the integrity, security, or performance of the App or its infrastructure.
• Upload, transmit, or distribute any virus, malware, spyware, or other harmful code.
• Use automated scripts, bots, crawlers, or other automated means to access or interact with the App without our prior written consent.
• Scrape, extract, or otherwise harvest data from the App without authorisation.
• Create fake accounts, impersonate any person or entity, or misrepresent your affiliation with any person or entity.
• Manipulate or artificially inflate XP scores, streak counts, leaderboard positions, or other gamification metrics.
• Exploit bugs, vulnerabilities, or unintended features of the App for personal gain or to harm others.
• Use the App to infringe the intellectual property rights of StayGuided Me or any third party.
• Engage in any activity that could harm the reputation of StayGuided Me, its users, or the Islamic community.

B. CONTENT STANDARDS
Any content you submit must:
• Be accurate, truthful, and not misleading.
• Comply with all applicable laws.
• Not contain abusive, offensive, or inappropriate language.
• Not promote violence, hatred, discrimination, or extremism of any kind.
• Be respectful of Islamic principles and the diversity of Islamic scholarly opinion.

C. CONSEQUENCES OF VIOLATIONS
Violation of this Acceptable Use Policy may result in immediate suspension or termination of your account, removal of your content, and, where appropriate, reporting to law enforcement authorities. We reserve the right to take any action we deem necessary to protect the App and its users.`,
  },
  {
    title: "7. Islamic Content Disclaimer",
    content: `A. EDUCATIONAL PURPOSE
All Islamic content in StayGuided Me is provided for educational, spiritual, and devotional purposes only. The App is designed to help Muslims and those interested in Islam learn about the religion, its history, and its teachings in an accessible and engaging format.

B. SCHOLARLY ACCURACY
• We take great care to ensure that the content we produce and curate is accurate and reflects mainstream, orthodox Islamic scholarship.
• We primarily draw on content from qualified Islamic scholars and reputable Islamic institutions.
• However, Islamic jurisprudence (Fiqh) and theology contain areas of legitimate scholarly disagreement among qualified scholars. Content on the App may reflect one or more scholarly opinions and should not be taken as the definitive ruling on any matter.

C. NOT A SUBSTITUTE FOR SCHOLARLY GUIDANCE
• The content on StayGuided Me is not a substitute for advice from a qualified Islamic scholar (Alim or Mufti) on matters of personal religious practice, family law, financial matters, or other areas requiring specific scholarly guidance.
• For specific religious rulings (Fatwas) or personal matters requiring Islamic advice, we strongly recommend consulting a qualified and reputable Islamic scholar in your community.

D. NO LIABILITY FOR RELIGIOUS DECISIONS
StayGuided Me, its developers, administrators, and content contributors shall not be held liable for any decisions, actions, or consequences arising from a user's interpretation or application of the content provided in the App to their personal religious practice.

E. QUR'ANIC RECITATION
The Qur'anic recitations in the App are provided to facilitate listening, reflection (Tadabbur), and memorisation (Hifz). We encourage users to verify the correct Tajweed and pronunciation with a qualified Qur'an teacher. The App does not replace formal Qur'anic education.`,
  },
  {
    title: "8. Disclaimer of Warranties",
    content: `A. "AS IS" BASIS
The App and its content are provided on an "as is" and "as available" basis, without any warranties of any kind, either express or implied. To the fullest extent permitted by applicable law, StayGuided Me expressly disclaims all warranties, including but not limited to:

• Implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
• Warranties regarding the accuracy, completeness, reliability, timeliness, or availability of the App or its content.
• Warranties that the App will be uninterrupted, error-free, or free of viruses or other harmful components.
• Warranties regarding the results that may be obtained from the use of the App.

B. CONTENT ACCURACY
While we make reasonable efforts to ensure the accuracy of content, we do not warrant that all information is complete, accurate, or up to date. Islamic content reflects the understanding of scholars at the time of production and may not account for more recent scholarly developments.

C. THIRD-PARTY SERVICES
We are not responsible for the availability, reliability, or content of third-party services that the App integrates with or links to.

D. JURISDICTION
Some jurisdictions do not allow the exclusion of implied warranties. In such jurisdictions, the above exclusions apply to the fullest extent permitted by applicable law.`,
  },
  {
    title: "9. Limitation of Liability",
    content: `A. EXCLUSION OF LIABILITY
To the maximum extent permitted by applicable law, in no event shall StayGuided Me, its directors, employees, contractors, partners, suppliers, or licensors be liable for any:

• Indirect, incidental, special, exemplary, punitive, or consequential damages.
• Loss of profits, revenue, data, goodwill, or business opportunities.
• Damages arising from interruption of service, loss of access to content, or inability to use the App.
• Damages arising from unauthorised access to or use of your account or personal data.
• Damages arising from your reliance on any content, information, or advice provided through the App.
• Damages arising from any viruses, malware, or other harmful components introduced through the App.

B. AGGREGATE LIABILITY CAP
Our total aggregate liability to you for any and all claims arising out of or relating to the use of the App shall not exceed the greater of: (i) the total amount you have paid to us in the twelve (12) months preceding the claim, or (ii) USD $50 (or local equivalent).

C. ESSENTIAL BASIS
You acknowledge that the limitations set out in this section reflect a reasonable allocation of risk and form an essential basis of the bargain between you and StayGuided Me. StayGuided Me would not provide the App without these limitations.

D. EXCEPTIONS
Some jurisdictions do not allow the exclusion or limitation of liability for consequential or incidental damages. In such jurisdictions, liability is limited to the greatest extent permitted by law.`,
  },
  {
    title: "10. Indemnification",
    content: `You agree to indemnify, defend, and hold harmless StayGuided Me and its officers, directors, employees, agents, contractors, licensors, and service providers from and against any and all claims, liabilities, damages, judgements, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:

• Your violation of these Terms of Service.
• Your use or misuse of the App or any of its features.
• Any content you submit through the App that infringes the rights of any third party.
• Your violation of any applicable law, regulation, or third-party right.
• Any unauthorised use of your account.

This indemnification obligation will survive the termination of these Terms and your use of the App.`,
  },
  {
    title: "11. Governing Law and Dispute Resolution",
    content: `A. GOVERNING LAW
These Terms shall be governed by and construed in accordance with applicable law. Where a choice of governing law is required and not otherwise specified by applicable mandatory law, these Terms shall be interpreted consistently with the rights and responsibilities described herein.

B. INFORMAL RESOLUTION
Before initiating any formal legal proceedings, we encourage you to contact us at support@stayguided.me to seek an informal resolution of any dispute or concern. We are committed to addressing user concerns promptly and fairly.

C. CONSUMER RIGHTS
Nothing in these Terms is intended to limit or exclude any rights you may have under applicable consumer protection laws in your jurisdiction. These Terms do not affect your statutory rights as a consumer.

D. APP STORE TERMS
Your use of the App is also subject to the terms and conditions of the platform through which you downloaded the App:
• Apple App Store Terms of Service (iOS users): apple.com/legal/internet-services/itunes/
• Google Play Terms of Service (Android users): play.google.com/about/play-terms/

In the event of any conflict between these Terms and the applicable app store terms, the app store terms shall prevail with respect to your relationship with Apple or Google.`,
  },
  {
    title: "12. Privacy and Data Protection",
    content: `Your privacy is of paramount importance to us. Our collection, use, and handling of your personal data is governed by our Privacy Policy, which is incorporated into and forms part of these Terms. By accepting these Terms, you also acknowledge and agree to our Privacy Policy.

Key privacy commitments:
• We do not sell your personal data to third parties.
• We collect only the data necessary to provide and improve the Services.
• You have the right to access, correct, and delete your personal data as described in our Privacy Policy.
• All data is stored securely using industry-standard encryption and security measures.

Please review our full Privacy Policy within the App or by navigating to the Privacy Policy screen.`,
  },
  {
    title: "13. Modifications to the Services",
    content: `A. CHANGES TO THE APP
We reserve the right to modify, update, suspend, or discontinue any aspect of the App or the Services, temporarily or permanently, with or without notice. This includes:
• Adding, removing, or modifying features or content.
• Changing the scope of content available under free access versus Premium subscription.
• Altering the pricing, availability, or terms of subscription plans.

B. CONTENT CHANGES
The availability of specific content (e.g., particular recitations, series, or episodes) may change over time due to licensing arrangements, content updates, or editorial decisions. We do not guarantee the continued availability of any specific content.

C. DISCONTINUATION
In the event we decide to permanently discontinue the App, we will provide reasonable notice and, where possible, assist users in migrating their data. Premium subscribers will receive a pro-rated refund for any unused portion of their subscription where required by applicable law.

D. NO LIABILITY FOR CHANGES
We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Services.`,
  },
  {
    title: "14. Third-Party Services and Links",
    content: `A. THIRD-PARTY INTEGRATIONS
The App integrates with third-party services including payment processors (Apple and Google), cloud infrastructure providers, and analytics services. Your interactions with these services are governed by their respective terms and privacy policies.

B. EXTERNAL LINKS
The App may contain links to external websites or resources. We provide these links as a convenience and are not responsible for the content, privacy practices, availability, or accuracy of those sites. Inclusion of a link does not imply endorsement.

C. CONTENT FROM SCHOLARS AND INSTITUTIONS
Audio content featuring Islamic scholars, institutions, or organisations does not imply endorsement of StayGuided Me by those scholars or organisations, nor does it imply that those scholars endorse all content available on the App.`,
  },
  {
    title: "15. Severability and Entire Agreement",
    content: `A. SEVERABILITY
If any provision of these Terms is found to be unlawful, void, or unenforceable for any reason, that provision shall be deemed severable from the remaining provisions and shall not affect the validity and enforceability of the remaining provisions, which shall continue in full force and effect.

B. WAIVER
Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision unless acknowledged and agreed to by us in writing.

C. ENTIRE AGREEMENT
These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and StayGuided Me with respect to the App and supersede all prior agreements, representations, and understandings relating to the subject matter hereof.

D. ASSIGNMENT
You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition, or sale of assets without restriction.`,
  },
  {
    title: "16. Contact Us",
    content: `If you have any questions, concerns, or feedback regarding these Terms of Service, please contact us:

App Name: StayGuided Me
Email: support@stayguided.me

Support Hours: We aim to respond to all enquiries within 2–5 business days.

You can also use the Contact Us feature within the App to send us a message directly. For legal notices, please use the email address above with the subject line "Legal Notice — Terms of Service."

We value your feedback and are committed to making StayGuided Me the best possible Islamic audio experience for you. JazakAllah Khayran for choosing StayGuided Me.`,
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
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            Please read these Terms carefully before using StayGuided Me. These Terms govern your access to and use of the App and all associated services. By using the App, you agree to be bound by these Terms.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <View style={[styles.badgePill, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "33" }]}>
              <Icon name="shield" size={10} color={colors.goldLight} />
              <Text style={{ color: colors.goldLight, fontSize: 11, fontWeight: "600" }}>App Store Compliant</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "33" }]}>
              <Icon name="shield" size={10} color={colors.goldLight} />
              <Text style={{ color: colors.goldLight, fontSize: 11, fontWeight: "600" }}>Play Store Compliant</Text>
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
          <View style={[styles.footerIconWrap, { backgroundColor: colors.gold + "18" }]}>
            <Icon name="help-circle" size={24} color={colors.goldLight} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
            Have a Question?
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            If you have questions about these Terms or need help with your account, our support team is here for you.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/contact")}
            activeOpacity={0.8}
            style={[styles.contactBtn, { backgroundColor: colors.gold }]}
          >
            <Icon name="mail" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>Contact Support</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 4 }}>
            JazakAllah Khayran for using StayGuided Me.
          </Text>
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
  docIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
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
