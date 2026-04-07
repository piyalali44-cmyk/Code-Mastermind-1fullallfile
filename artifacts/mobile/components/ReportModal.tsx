import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type ReportReason =
  | "incorrect_info"
  | "poor_audio"
  | "misleading"
  | "inappropriate"
  | "copyright"
  | "other";

type ContentType = "episode" | "series" | "surah";

interface Props {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  contentType: ContentType;
  contentTitle: string;
}

const REASONS: { key: ReportReason; label: string; icon: string; desc: string; color: string }[] = [
  { key: "incorrect_info", label: "Incorrect Information",  icon: "alert-circle",   desc: "Facts or details are wrong or outdated",             color: "#f59e0b" },
  { key: "poor_audio",     label: "Poor Audio Quality",     icon: "volume-x",       desc: "Audio is distorted, unclear or missing",             color: "#3b82f6" },
  { key: "misleading",     label: "Misleading Content",     icon: "alert-triangle", desc: "Title or description does not match content",        color: "#eab308" },
  { key: "inappropriate",  label: "Inappropriate Content",  icon: "shield-off",     desc: "Content violates Islamic values or guidelines",      color: "#ef4444" },
  { key: "copyright",      label: "Copyright Issue",        icon: "lock",           desc: "Content uses material without permission",           color: "#8b5cf6" },
  { key: "other",          label: "Other",                  icon: "more-horizontal", desc: "Something else — please describe below",            color: "#6b7280" },
];

type Step = "select" | "describe" | "done";

export default function ReportModal({ visible, onClose, contentId, contentType, contentTitle }: Props) {
  const colors = useColors();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("select");
      setSelected(null);
      setDescription("");
      setError(null);
    }, 300);
  }

  function handleSelectReason(reason: ReportReason) {
    setSelected(reason);
    setStep("describe");
    setError(null);
  }

  async function handleSubmit() {
    if (!selected) return;
    if (!user?.id) {
      setError("You must be signed in to submit a report.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("content_reports").insert({
        content_id: contentId,
        content_type: contentType,
        content_title: contentTitle,
        reporter_id: user.id,
        reason: selected,
        description: description.trim() || null,
        status: "pending",
      });
      if (insertError) throw insertError;
      setStep("done");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const s = StyleSheet.create({
    overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    sheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 32 },
    handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
    header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5 },
    title:      { fontSize: 16, fontWeight: "700" },
    subtitle:   { fontSize: 12, marginTop: 2 },
    closeBtn:   { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    sectionHdr: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    reasonRow:  { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 6, borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
    reasonIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    reasonText: { flex: 1 },
    reasonLabel:{ fontSize: 14, fontWeight: "600" },
    reasonDesc: { fontSize: 12, marginTop: 2 },
    descArea:   { marginHorizontal: 16, marginTop: 4, borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: "top" },
    charCount:  { fontSize: 11, textAlign: "right", marginHorizontal: 20, marginTop: 4 },
    backBtn:    { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 20, marginTop: 4, paddingVertical: 8 },
    submitBtn:  { marginHorizontal: 16, marginTop: 16, borderRadius: 12, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
    submitTxt:  { fontSize: 15, fontWeight: "700" },
    errorBox:   { marginHorizontal: 16, marginTop: 8, borderRadius: 10, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    doneWrap:   { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
    doneCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    doneTxt:    { fontSize: 20, fontWeight: "700", textAlign: "center" },
    doneDesc:   { fontSize: 14, textAlign: "center", lineHeight: 21 },
    doneBtn:    { marginHorizontal: 16, marginTop: 16, borderRadius: 12, paddingVertical: 15, alignItems: "center", justifyContent: "center", width: "100%" },
  });

  const selectedReason = REASONS.find(r => r.key === selected);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable
          style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[s.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.textPrimary }]}>
                {step === "done" ? "Report Submitted" : "Report an Issue"}
              </Text>
              {step !== "done" && (
                <Text style={[s.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {contentTitle}
                </Text>
              )}
            </View>
            <Pressable onPress={handleClose} style={[s.closeBtn, { backgroundColor: colors.surfaceHigh }]}>
              <Icon name="x" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Step: Select reason ── */}
          {step === "select" && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.sectionHdr, { color: colors.textMuted }]}>SELECT A REASON</Text>
              {REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  style={({ pressed }) => [
                    s.reasonRow,
                    {
                      backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleSelectReason(r.key)}
                >
                  <View style={[s.reasonIcon, { backgroundColor: r.color + "22" }]}>
                    <Icon name={r.icon} size={18} color={r.color} />
                  </View>
                  <View style={s.reasonText}>
                    <Text style={[s.reasonLabel, { color: colors.textPrimary }]}>{r.label}</Text>
                    <Text style={[s.reasonDesc, { color: colors.textSecondary }]}>{r.desc}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* ── Step: Add description ── */}
          {step === "describe" && (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Back + selected reason */}
              <Pressable onPress={() => { setStep("select"); setError(null); }} style={s.backBtn}>
                <Icon name="arrow-left" size={16} color={colors.textMuted} />
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Change reason</Text>
              </Pressable>

              {selectedReason && (
                <View style={[s.reasonRow, { backgroundColor: selectedReason.color + "12", borderColor: selectedReason.color + "40" }]}>
                  <View style={[s.reasonIcon, { backgroundColor: selectedReason.color + "22" }]}>
                    <Icon name={selectedReason.icon} size={18} color={selectedReason.color} />
                  </View>
                  <View style={s.reasonText}>
                    <Text style={[s.reasonLabel, { color: colors.textPrimary }]}>{selectedReason.label}</Text>
                    <Text style={[s.reasonDesc, { color: colors.textSecondary }]}>{selectedReason.desc}</Text>
                  </View>
                  <Icon name="check" size={16} color={colors.goldLight} />
                </View>
              )}

              <Text style={[s.sectionHdr, { color: colors.textMuted }]}>DESCRIBE THE ISSUE (OPTIONAL)</Text>
              <TextInput
                style={[s.descArea, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Provide more details to help us resolve this quickly…"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={t => t.length <= 500 && setDescription(t)}
                multiline
                maxLength={500}
              />
              <Text style={[s.charCount, { color: colors.textMuted }]}>{description.length}/500</Text>

              {error && (
                <View style={[s.errorBox, { backgroundColor: "#ef444420", borderColor: "#ef444440" }]}>
                  <Icon name="alert-circle" size={16} color="#f87171" />
                  <Text style={{ flex: 1, fontSize: 13, color: "#f87171" }}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[s.submitBtn, { backgroundColor: submitting ? colors.gold + "80" : colors.gold }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[s.submitTxt, { color: "#000" }]}>Submit Report</Text>
                }
              </Pressable>
            </ScrollView>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <View style={s.doneWrap}>
              <View style={[s.doneCircle, { backgroundColor: colors.green + "20" }]}>
                <Icon name="check-circle" size={36} color={colors.green} />
              </View>
              <Text style={[s.doneTxt, { color: colors.textPrimary }]}>Thank you for reporting</Text>
              <Text style={[s.doneDesc, { color: colors.textSecondary }]}>
                Your report has been submitted and will be reviewed by our team. We take all reports seriously and aim to respond within 24 hours.
              </Text>
              <Pressable
                style={[s.doneBtn, { backgroundColor: colors.gold }]}
                onPress={handleClose}
              >
                <Text style={[s.submitTxt, { color: "#000" }]}>Done</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
