import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAppSettings, type PopupNotice } from "@/context/AppSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { navigateDeepLink } from "@/lib/deeplink";
import { useColors } from "@/hooks/useColors";

const TYPE_ICONS: Record<string, string> = {
  info: "info",
  warning: "alert-triangle",
  success: "check-circle",
  promo: "gift",
  ramadan: "moon",
};

const TYPE_ACCENT: Record<string, string> = {
  info: "#3B82F6",
  warning: "#F59E0B",
  success: "#22C55E",
  promo: "#C9A84C",
  ramadan: "#A855F7",
};

const BANNER_TYPES = new Set(["info", "warning", "success"]);

function matchesAudience(notice: PopupNotice, userTier: string): boolean {
  if (notice.target_audience === "all") return true;
  return notice.target_audience === userTier;
}

export default function PopupNoticeModal() {
  const { popupNotices, dismissPopup } = useAppSettings();
  const { user, isGuest } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const [current, setCurrent] = useState<PopupNotice | null>(null);
  const [banners, setBanners] = useState<PopupNotice[]>([]);

  const userTier = isGuest ? "guest" : user?.isPremium ? "premium" : "free";

  useEffect(() => {
    const matching = popupNotices.filter((p) => matchesAudience(p, userTier));
    const bannerItems = matching.filter((p) => BANNER_TYPES.has(p.type));
    const modalItems = matching.filter((p) => !BANNER_TYPES.has(p.type));
    setBanners(bannerItems);
    if (!current && modalItems.length > 0) {
      setCurrent(modalItems[0]);
    }
  }, [popupNotices, userTier, current]);

  const handleCta = (notice: PopupNotice) => {
    dismissPopup(notice.id);
    if (notice === current) setCurrent(null);
    if (notice.cta_url) {
      navigateDeepLink(notice.cta_url, router);
    }
  };

  const handleDismiss = (notice: PopupNotice) => {
    dismissPopup(notice.id);
    if (notice === current) setCurrent(null);
  };

  return (
    <>
      {banners.length > 0 && (
        <View style={styles.bannerContainer}>
          {banners.map((banner) => {
            const accent = TYPE_ACCENT[banner.type] || colors.gold;
            const icon = TYPE_ICONS[banner.type] || "bell";
            return (
              <View key={banner.id} style={[styles.banner, { backgroundColor: accent + "15", borderColor: accent + "40" }]}>
                <View style={[styles.bannerAccent, { backgroundColor: accent }]} />
                <Icon name={icon} size={18} color={accent} style={styles.bannerIcon} />
                <View style={styles.bannerContent}>
                  <Text style={[styles.bannerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{banner.title}</Text>
                  {banner.body ? (
                    <Text style={[styles.bannerBody, { color: colors.textSecondary }]} numberOfLines={2}>{banner.body}</Text>
                  ) : null}
                </View>
                {banner.cta_label && banner.cta_url ? (
                  <Pressable onPress={() => handleCta(banner)} hitSlop={8}>
                    <Text style={[styles.bannerCta, { color: accent }]}>{banner.cta_label}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => handleDismiss(banner)} hitSlop={8} style={styles.bannerClose}>
                  <Icon name="x" size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {current && (
        <Modal transparent animationType="fade" visible onRequestClose={() => handleDismiss(current)}>
          <Pressable style={styles.overlay} onPress={() => handleDismiss(current)}>
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: (TYPE_ACCENT[current.type] || colors.gold) + "40" }]}
              onPress={() => {}}
            >
              <View style={[styles.accentBar, { backgroundColor: TYPE_ACCENT[current.type] || colors.gold }]} />
              <Pressable style={styles.closeBtn} onPress={() => handleDismiss(current)} hitSlop={12}>
                <Icon name="x" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={[styles.iconCircle, { backgroundColor: (TYPE_ACCENT[current.type] || colors.gold) + "20" }]}>
                <Icon name={TYPE_ICONS[current.type] || "bell"} size={24} color={TYPE_ACCENT[current.type] || colors.gold} />
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
              {current.body ? (
                <Text style={[styles.body, { color: colors.textSecondary }]}>{current.body}</Text>
              ) : null}
              <View style={styles.actions}>
                {current.cta_label && current.cta_url ? (
                  <Pressable style={[styles.ctaBtn, { backgroundColor: TYPE_ACCENT[current.type] || colors.gold }]} onPress={() => handleCta(current)}>
                    <Text style={styles.ctaText}>{current.cta_label}</Text>
                    <Icon name="arrow-right" size={14} color="#fff" />
                  </Pressable>
                ) : null}
                <Pressable style={[styles.dismissBtn, { borderColor: colors.border }]} onPress={() => handleDismiss(current)}>
                  <Text style={[styles.dismissText, { color: colors.textSecondary }]}>Dismiss</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 16,
    overflow: "hidden",
    gap: 10,
  },
  bannerAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  bannerIcon: {
    marginRight: 2,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  bannerBody: {
    fontSize: 12,
    marginTop: 2,
  },
  bannerCta: {
    fontSize: 12,
    fontWeight: "700",
  },
  bannerClose: {
    padding: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  actions: {
    width: "100%",
    gap: 10,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  dismissBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
