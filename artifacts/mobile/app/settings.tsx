import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSettings } from "@/context/AppSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { getUserSettings, updateUserSettings, getUserCountry, updateUserCountry } from "@/lib/db";

const SETTINGS_KEY_PREFIX = "settings_";
const STORY_LANGUAGE_KEY = "story_language";

const STORY_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
];

const THEME_OPTIONS = [
  { key: "dark" as const, label: "Dark", icon: "moon", subtitle: "Deep navy theme" },
  { key: "light" as const, label: "Light", icon: "sun", subtitle: "Cream light theme" },
];

const COUNTRIES = [
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" }, { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿" }, { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AO", name: "Angola", flag: "🇦🇴" }, { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" }, { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" }, { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" }, { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" }, { code: "BJ", name: "Benin", flag: "🇧🇯" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" }, { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BA", name: "Bosnia & Herzegovina", flag: "🇧🇦" }, { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" }, { code: "BN", name: "Brunei", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" }, { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", flag: "🇧🇮" }, { code: "KH", name: "Cambodia", flag: "🇰🇭" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" }, { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫" }, { code: "TD", name: "Chad", flag: "🇹🇩" },
  { code: "CL", name: "Chile", flag: "🇨🇱" }, { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" }, { code: "KM", name: "Comoros", flag: "🇰🇲" },
  { code: "CG", name: "Congo", flag: "🇨🇬" }, { code: "CD", name: "Congo (DRC)", flag: "🇨🇩" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" }, { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" }, { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" }, { code: "DJ", name: "Djibouti", flag: "🇩🇯" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" }, { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶" }, { code: "ER", name: "Eritrea", flag: "🇪🇷" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" }, { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FI", name: "Finland", flag: "🇫🇮" }, { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" }, { code: "GM", name: "Gambia", flag: "🇬🇲" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" }, { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" }, { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" }, { code: "GN", name: "Guinea", flag: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼" }, { code: "HT", name: "Haiti", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" }, { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" }, { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IR", name: "Iran", flag: "🇮🇷" }, { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" }, { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" }, { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" }, { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" }, { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" }, { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "LA", name: "Laos", flag: "🇱🇦" }, { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" }, { code: "LR", name: "Liberia", flag: "🇱🇷" },
  { code: "LY", name: "Libya", flag: "🇱🇾" }, { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" }, { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" }, { code: "MW", name: "Malawi", flag: "🇲🇼" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" }, { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "ML", name: "Mali", flag: "🇲🇱" }, { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷" }, { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MD", name: "Moldova", flag: "🇲🇩" }, { code: "MC", name: "Monaco", flag: "🇲🇨" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" }, { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" }, { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" }, { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" }, { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" }, { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NE", name: "Niger", flag: "🇳🇪" }, { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KP", name: "North Korea", flag: "🇰🇵" }, { code: "MK", name: "North Macedonia", flag: "🇲🇰" },
  { code: "NO", name: "Norway", flag: "🇳🇴" }, { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" }, { code: "PS", name: "Palestine", flag: "🇵🇸" },
  { code: "PA", name: "Panama", flag: "🇵🇦" }, { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" }, { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" }, { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" }, { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "RO", name: "Romania", flag: "🇷🇴" }, { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" }, { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" }, { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱" }, { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" }, { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "SO", name: "Somalia", flag: "🇸🇴" }, { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" }, { code: "SS", name: "South Sudan", flag: "🇸🇸" },
  { code: "ES", name: "Spain", flag: "🇪🇸" }, { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "SD", name: "Sudan", flag: "🇸🇩" }, { code: "SR", name: "Suriname", flag: "🇸🇷" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" }, { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SY", name: "Syria", flag: "🇸🇾" }, { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯" }, { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" }, { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "TG", name: "Togo", flag: "🇹🇬" }, { code: "TT", name: "Trinidad & Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" }, { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲" }, { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" }, { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" }, { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" }, { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" }, { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "YE", name: "Yemen", flag: "🇾🇪" }, { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
];

type IconName = React.ComponentProps<typeof Icon>["name"];

interface ToggleRowProps {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}

function ToggleRow({ icon, iconBg, iconColor, label, subtitle, value, onChange, last }: ToggleRowProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  return (
    <View style={[styles.settingRow, { borderBottomColor: last ? "transparent" : colors.divider }]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          true: "#22C55E",
          false: isDark ? "#334155" : "#CBD5E1",
        }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={isDark ? "#334155" : "#CBD5E1"}
      />
    </View>
  );
}

interface NavRowProps {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
  labelColor?: string;
  hideChevron?: boolean;
}

function NavRow({ icon, iconBg, iconColor, label, subtitle, onPress, last, labelColor, hideChevron }: NavRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.settingRow, { borderBottomColor: last ? "transparent" : colors.divider }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: labelColor ?? colors.textPrimary }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      {!hideChevron && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const { nowPlaying } = useAudio();
  const { theme, setTheme } = useTheme();
  const { featureFlags } = useAppSettings();
  const isWeb = Platform.OS === "web";

  const [autoplay, setAutoplay] = useState(true);
  const [bgPlay, setBgPlay] = useState(true);
  const [showArabic, setShowArabic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [streakReminder, setStreakReminder] = useState(true);
  const [downloadWifi, setDownloadWifi] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  const [storyLanguage, setStoryLanguage] = useState("en");
  const [country, setCountry] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [storyLangModal, setStoryLangModal] = useState(false);
  const [themeModal, setThemeModal] = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [clearConfirmModal, setClearConfirmModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: string; iconColor?: string }>({
    visible: false, message: "", icon: "check",
  });

  const showToast = (msg: string, icon: string, iconColor?: string) => {
    setToast({ visible: true, message: msg, icon, iconColor });
  };

  useEffect(() => {
    const load = async () => {
      const keys = ["autoplay", "bgPlay", "showArabic", "showTranslation", "notifications", "streakReminder", "downloadWifi", "autoScroll"];
      const setters: Record<string, (v: boolean) => void> = {
        autoplay: setAutoplay, bgPlay: setBgPlay, showArabic: setShowArabic,
        showTranslation: setShowTranslation, notifications: setNotifications,
        streakReminder: setStreakReminder, downloadWifi: setDownloadWifi, autoScroll: setAutoScroll,
      };

      const results = await AsyncStorage.multiGet(keys.map((k) => SETTINGS_KEY_PREFIX + k));
      results.forEach(([key, val]) => {
        if (val !== null) setters[key.replace(SETTINGS_KEY_PREFIX, "")]?.(val === "true");
      });
      const lang = await AsyncStorage.getItem(STORY_LANGUAGE_KEY);
      if (lang) setStoryLanguage(lang);

      if (!isGuest && user) {
        const [dbSettings, dbCountry] = await Promise.all([
          getUserSettings(user.id),
          getUserCountry(user.id),
        ]);
        if (dbSettings) {
          if (dbSettings.autoplay !== null && dbSettings.autoplay !== undefined) setAutoplay(dbSettings.autoplay);
          if (dbSettings.background_play !== null && dbSettings.background_play !== undefined) setBgPlay(dbSettings.background_play);
          if (dbSettings.quran_show_arabic !== null && dbSettings.quran_show_arabic !== undefined) setShowArabic(dbSettings.quran_show_arabic);
          if (dbSettings.quran_show_translation !== null && dbSettings.quran_show_translation !== undefined) setShowTranslation(dbSettings.quran_show_translation);
          if (dbSettings.notifications_enabled !== null && dbSettings.notifications_enabled !== undefined) setNotifications(dbSettings.notifications_enabled);
          if (dbSettings.streak_reminder !== null && dbSettings.streak_reminder !== undefined) setStreakReminder(dbSettings.streak_reminder);
          if (dbSettings.download_wifi_only !== null && dbSettings.download_wifi_only !== undefined) setDownloadWifi(dbSettings.download_wifi_only);
          if (dbSettings.auto_scroll !== null && dbSettings.auto_scroll !== undefined) setAutoScroll(dbSettings.auto_scroll);
        }
        if (dbCountry) setCountry(dbCountry);
      }
    };
    load();
  }, [user?.id]);

  const persistToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    AsyncStorage.setItem(SETTINGS_KEY_PREFIX + key, String(value));
    if (!isGuest && user) {
      const dbUpdates: Record<string, Parameters<typeof updateUserSettings>[1]> = {
        autoplay: { autoplay: value },
        bgPlay: { background_play: value },
        showArabic: { quran_show_arabic: value },
        showTranslation: { quran_show_translation: value },
        notifications: { notifications_enabled: value },
        streakReminder: { streak_reminder: value },
        downloadWifi: { download_wifi_only: value },
        autoScroll: { auto_scroll: value },
      };
      const update = dbUpdates[key];
      if (update) {
        updateUserSettings(user.id, update);
      }
    }
  };

  const selectStoryLanguage = async (code: string) => {
    setStoryLanguage(code);
    await AsyncStorage.setItem(STORY_LANGUAGE_KEY, code);
    setStoryLangModal(false);
  };

  const selectCountry = async (code: string) => {
    setCountry(code);
    setCountryModal(false);
    setCountrySearch("");
    if (!isGuest && user) {
      await updateUserCountry(user.id, code);
      showToast("Country updated", "check-circle", colors.green);
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) =>
        k.startsWith("quran_cache") || k.startsWith("series_cache") ||
        k.startsWith("audio_cache") || k.startsWith("image_cache")
      );
      if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
      setClearConfirmModal(false);
      showToast("Cache cleared successfully", "check-circle", colors.green);
    } catch {
      showToast("Failed to clear cache", "alert-circle", colors.error);
    } finally {
      setClearing(false);
    }
  };

  const rateApp = () => {
    if (Platform.OS === "ios") Linking.openURL("https://apps.apple.com/app/stayguided-me/id0000000000");
    else if (Platform.OS === "android") Linking.openURL("https://play.google.com/store/apps/details?id=com.stayguidedme");
    else showToast("Thank you for your support!", "heart", colors.gold);
  };

  const selectedStoryLang = STORY_LANGUAGES.find((l) => l.code === storyLanguage)?.name || "English";
  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const currentThemeLabel = THEME_OPTIONS.find((t) => t.key === theme)?.label || "Dark";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 4, paddingBottom: !!nowPlaying ? 148 : 108 }}
        showsVerticalScrollIndicator={false}
      >
        {!isGuest && user && (
          <View style={{ marginBottom: 12 }}>
            <SectionHeader label="PROFILE" />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <NavRow
                icon="user"
                iconBg={colors.gold + "20"}
                iconColor={colors.goldLight}
                label="Edit Profile"
                subtitle="Update your name and avatar"
                onPress={() => router.push("/edit-profile")}
              />
              <Pressable
                onPress={() => setCountryModal(true)}
                style={[styles.settingRow, { borderBottomColor: "transparent" }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: "#10B98122" }]}>
                  <Icon name="map-pin" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>My Country</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "Not set — shown on Leaderboard"}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="APPEARANCE" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setThemeModal(true)}
              style={[styles.settingRow, { borderBottomColor: "transparent" }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: theme === "light" ? "#F59E0B22" : "#6366F122" }]}>
                <Icon name={theme === "light" ? "sun" : "moon"} size={16} color={theme === "light" ? "#F59E0B" : "#818CF8"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>App Theme</Text>
                <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>{currentThemeLabel} mode</Text>
              </View>
              <View style={[styles.valueBadge, { backgroundColor: colors.surfaceHigh }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{currentThemeLabel}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="AUDIO" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ToggleRow
              icon="skip-forward"
              iconBg="#10B98122"
              iconColor="#10B981"
              label="Autoplay Next Episode"
              subtitle="Automatically plays the next episode"
              value={autoplay}
              onChange={(v) => persistToggle("autoplay", v, setAutoplay)}
            />
            <ToggleRow
              icon="headphones"
              iconBg="#6366F122"
              iconColor="#818CF8"
              label="Background Play"
              subtitle="Continue when app is minimised"
              value={bgPlay}
              onChange={(v) => persistToggle("bgPlay", v, setBgPlay)}
            />
            <ToggleRow
              icon="wifi"
              iconBg="#0EA5E922"
              iconColor="#38BDF8"
              label="Download on Wi-Fi Only"
              subtitle="Prevent mobile data usage for downloads"
              value={downloadWifi}
              onChange={(v) => persistToggle("downloadWifi", v, setDownloadWifi)}
              last
            />
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="LANGUAGE" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setStoryLangModal(true)}
              style={[styles.settingRow, { borderBottomColor: "transparent" }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: "#F59E0B22" }]}>
                <Icon name="globe" size={16} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Story Language</Text>
                <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>Narration language for Islamic stories</Text>
              </View>
              <View style={[styles.valueBadge, { backgroundColor: colors.surfaceHigh }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{selectedStoryLang}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="QUR'AN" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ToggleRow
              icon="type"
              iconBg="#B8860E22"
              iconColor={colors.goldLight}
              label="Show Arabic Text"
              subtitle="Display Uthmanic script"
              value={showArabic}
              onChange={(v) => persistToggle("showArabic", v, setShowArabic)}
            />
            <ToggleRow
              icon="book-open"
              iconBg="#8B5CF622"
              iconColor="#A78BFA"
              label="Show Translation"
              subtitle="Show translation below each ayah"
              value={showTranslation}
              onChange={(v) => persistToggle("showTranslation", v, setShowTranslation)}
            />
            <ToggleRow
              icon="align-center"
              iconBg="#0EA5E922"
              iconColor="#38BDF8"
              label="Auto-Scroll"
              subtitle="Scroll to current ayah during playback"
              value={autoScroll}
              onChange={(v) => persistToggle("autoScroll", v, setAutoScroll)}
              last
            />
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="NOTIFICATIONS" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ToggleRow
              icon="bell"
              iconBg="#F59E0B22"
              iconColor="#F59E0B"
              label="Push Notifications"
              subtitle="Receive updates and reminders"
              value={notifications}
              onChange={(v) => persistToggle("notifications", v, setNotifications)}
            />
            <ToggleRow
              icon="flame"
              iconBg="#EF444422"
              iconColor="#F87171"
              label="Daily Streak Reminder"
              subtitle="Don't break your listening streak"
              value={streakReminder}
              onChange={(v) => persistToggle("streakReminder", v, setStreakReminder)}
              last
            />
          </View>
        </View>

        {!isGuest && (
          <View style={{ marginBottom: 12 }}>
            <SectionHeader label="ACCOUNT" />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <NavRow
                icon="lock"
                iconBg="#6366F122"
                iconColor="#818CF8"
                label="Change Password"
                subtitle="Update your current password"
                onPress={() => router.push("/change-password")}
              />
              <NavRow
                icon="key"
                iconBg="#B8860E22"
                iconColor={colors.goldLight}
                label="Reset Password"
                subtitle="Forgot your password? Reset via email"
                onPress={() => router.push("/reset-password")}
                last
              />
            </View>
          </View>
        )}

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="STORAGE" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <NavRow
              icon="trash-2"
              iconBg="#EF444422"
              iconColor="#F87171"
              label="Clear Cache"
              subtitle="Free up space by removing cached data"
              onPress={() => setClearConfirmModal(true)}
              last
            />
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="ABOUT" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <NavRow
              icon="shield"
              iconBg="#10B98122"
              iconColor="#10B981"
              label="Privacy Policy"
              subtitle="How we handle your data"
              onPress={() => router.push("/privacy-policy")}
            />
            <NavRow
              icon="file-text"
              iconBg="#6366F122"
              iconColor="#818CF8"
              label="Terms of Service"
              subtitle="App terms and conditions"
              onPress={() => router.push("/terms")}
            />
            <NavRow
              icon="mail"
              iconBg="#0EA5E922"
              iconColor="#38BDF8"
              label="Contact Support"
              subtitle="Get help from our team"
              onPress={() => router.push("/contact")}
            />
            <NavRow
              icon="star"
              iconBg="#F59E0B22"
              iconColor="#F59E0B"
              label="Rate the App"
              subtitle="Enjoyed the app? Leave a review"
              onPress={rateApp}
              last
            />
          </View>
        </View>

        <View style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.versionIconWrap, { backgroundColor: colors.gold + "18" }]}>
            <Icon name="info" size={16} color={colors.goldLight} />
          </View>
          <View style={{ alignItems: "center", gap: 3 }}>
            <Text style={[styles.versionText, { color: colors.textSecondary, fontWeight: "600" }]}>StayGuided Me · Version 1.0.0</Text>
            <Text style={[styles.arabicText, { color: colors.gold }]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          </View>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal visible={countryModal} transparent animationType="slide" onRequestClose={() => { setCountryModal(false); setCountrySearch(""); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setCountryModal(false); setCountrySearch(""); }}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: "80%", paddingBottom: 8 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>My Country</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Your flag will appear on the Leaderboard</Text>

            {/* Search */}
            <View style={[styles.countrySearchWrap, { backgroundColor: colors.surfaceHigh, borderColor: colors.divider }]}>
              <Icon name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.countrySearchInput, { color: colors.textPrimary }]}
                placeholder="Search country…"
                placeholderTextColor={colors.textMuted}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
              />
              {countrySearch.length > 0 && (
                <Pressable onPress={() => setCountrySearch("")}>
                  <Icon name="x" size={14} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
              {filteredCountries.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => selectCountry(c.code)}
                  style={[
                    styles.countryRow,
                    {
                      backgroundColor: country === c.code ? colors.gold + "18" : "transparent",
                      borderColor: country === c.code ? colors.gold + "50" : "transparent",
                    },
                  ]}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <Text style={[styles.countryName, { color: colors.textPrimary }]}>{c.name}</Text>
                  {country === c.code && <Icon name="check" size={16} color={colors.gold} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={themeModal} transparent animationType="slide" onRequestClose={() => setThemeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setThemeModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>App Theme</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Choose your preferred appearance</Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {/* Dark theme option */}
              <Pressable
                onPress={() => { setTheme("dark"); setThemeModal(false); }}
                style={[styles.themeOption, {
                  backgroundColor: theme === "dark" ? "#B8860E18" : colors.surfaceHigh,
                  borderColor: theme === "dark" ? "#B8860E60" : colors.border,
                }]}
              >
                <View style={[styles.themeIconWrap, { backgroundColor: "#1A2535" }]}>
                  <Icon name="moon" size={20} color="#818CF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editionName, { color: colors.textPrimary }]}>Dark</Text>
                  <Text style={[styles.editionLang, { color: colors.textMuted }]}>Deep navy theme</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4, marginRight: 8 }}>
                  {["#080F1C", "#101825", "#B8860E", "#F1F5F9"].map((c, i) => (
                    <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c, borderWidth: 1, borderColor: "#2A3D55" }} />
                  ))}
                </View>
                {theme === "dark" && (
                  <View style={[styles.themeCheck, { backgroundColor: "#B8860E" }]}>
                    <Icon name="check" size={14} color="#fff" />
                  </View>
                )}
              </Pressable>

              {/* Light theme option */}
              <Pressable
                onPress={() => { setTheme("light"); setThemeModal(false); }}
                style={[styles.themeOption, {
                  backgroundColor: theme === "light" ? "#B8860E18" : colors.surfaceHigh,
                  borderColor: theme === "light" ? "#B8860E60" : colors.border,
                }]}
              >
                <View style={[styles.themeIconWrap, { backgroundColor: "#FEF3C7" }]}>
                  <Icon name="sun" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editionName, { color: colors.textPrimary }]}>Light</Text>
                  <Text style={[styles.editionLang, { color: colors.textMuted }]}>Cream light theme</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4, marginRight: 8 }}>
                  {["#FAF7F2", "#FFFFFF", "#B8860E", "#1C1C1E"].map((c, i) => (
                    <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c, borderWidth: 1, borderColor: "#E0D8CC" }} />
                  ))}
                </View>
                {theme === "light" && (
                  <View style={[styles.themeCheck, { backgroundColor: "#B8860E" }]}>
                    <Icon name="check" size={14} color="#fff" />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={storyLangModal} transparent animationType="slide" onRequestClose={() => setStoryLangModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStoryLangModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Story Language</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Select narration language for Islamic stories</Text>
            <ScrollView style={{ maxHeight: 360, marginTop: 4 }} showsVerticalScrollIndicator={false}>
              {STORY_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => selectStoryLanguage(lang.code)}
                  style={[styles.editionRow, {
                    backgroundColor: storyLanguage === lang.code ? colors.gold + "18" : "transparent",
                    borderColor: storyLanguage === lang.code ? colors.gold + "40" : "transparent",
                    borderWidth: 1,
                  }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.editionName, { color: colors.textPrimary }]}>{lang.name}</Text>
                    <Text style={[styles.editionLang, { color: colors.textMuted }]}>{lang.nativeName}</Text>
                  </View>
                  {storyLanguage === lang.code && (
                    <View style={[styles.themeCheck, { backgroundColor: colors.gold }]}>
                      <Icon name="check" size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={clearConfirmModal} transparent animationType="fade" onRequestClose={() => setClearConfirmModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setClearConfirmModal(false)}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.confirmIconWrap, { backgroundColor: "#EF444422" }]}>
              <Icon name="trash-2" size={26} color="#F87171" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, textAlign: "center" }]}>Clear Cache?</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
              This removes cached audio, images, and temporary data.{"\n"}Your account data, favourites, and bookmarks are safe.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 4 }}>
              <Pressable
                onPress={() => setClearConfirmModal(false)}
                style={[styles.confirmBtn, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, flex: 1 }]}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleClearData}
                disabled={clearing}
                style={[styles.confirmBtn, { backgroundColor: "#EF4444", flex: 1, opacity: clearing ? 0.6 : 1 }]}
              >
                {clearing ? (
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Clearing…</Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name="trash-2" size={15} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Clear Cache</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
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
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, paddingHorizontal: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  sectionLine: { flex: 1, height: 1 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 15, fontWeight: "500" },
  settingSubtitle: { fontSize: 12, marginTop: 1 },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  versionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 10,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  versionIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  versionText: { fontSize: 13 },
  arabicText: { fontSize: 13, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 32,
    gap: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF30",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalSubtitle: { fontSize: 13, marginBottom: 4 },
  editionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, gap: 8 },
  editionName: { fontSize: 14, fontWeight: "500" },
  editionLang: { fontSize: 12, marginTop: 1 },
  themeOption: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  themeIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  themeCheck: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmSheet: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    marginHorizontal: 20,
    alignItems: "center",
    alignSelf: "center",
    width: "90%",
    marginBottom: 80,
  },
  confirmIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  confirmBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  countrySearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 2,
    gap: 10,
  },
  countryFlag: { fontSize: 22 },
  countryName: { flex: 1, fontSize: 14, fontWeight: "500" },
});
