import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

const isWeb = Platform.OS === "web";

interface ReferralCodeInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label?: string;
}

async function readClipboard(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        return text?.trim() ?? null;
      }
      return null;
    }
    const text = await Clipboard.getStringAsync();
    return text?.trim() ?? null;
  } catch {
    return null;
  }
}

export function ReferralCodeInput({
  value,
  onChange,
  onSubmit,
  placeholder = "e.g. SGA1B2C3",
  label,
}: ReferralCodeInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [clipSuggestion, setClipSuggestion] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderAnim = useRef(new Animated.Value(0)).current;
  const chipAnim = useRef(new Animated.Value(0)).current;
  const prevSuggestion = useRef<string | null>(null);

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  useEffect(() => {
    const showing = !!clipSuggestion && !value;
    if (showing !== !!prevSuggestion.current || clipSuggestion !== prevSuggestion.current) {
      Animated.timing(chipAnim, {
        toValue: showing ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    }
    prevSuggestion.current = clipSuggestion;
  }, [clipSuggestion, value]);

  const checkClipboard = useCallback(async () => {
    const text = await readClipboard();
    if (text) {
      const trimmed = text.toUpperCase().replace(/\s+/g, "");
      if (trimmed.length >= 4 && trimmed.length <= 20) {
        setClipSuggestion(trimmed);
        return;
      }
    }
    setClipSuggestion(null);
  }, []);

  const handleFocus = () => {
    setFocused(true);
    checkClipboard();
  };

  const handleBlur = () => {
    setFocused(false);
  };

  const applyClipSuggestion = () => {
    if (clipSuggestion) {
      onChange(clipSuggestion);
      setClipSuggestion(null);
    }
  };

  const [pasteHint, setPasteHint] = useState<string | null>(null);

  const handlePastePress = async () => {
    if (pasting) return;
    setPasting(true);
    setPasteHint(null);
    try {
      const text = await readClipboard();
      if (text) {
        const cleaned = text.toUpperCase().replace(/\s+/g, "");
        if (cleaned.length >= 2) {
          onChange(cleaned);
          setClipSuggestion(null);
          return;
        }
      }
      if (isWeb) {
        // Clipboard access is blocked in iframe/browser — show manual paste hint
        setPasteHint("Tap the field and paste manually (Ctrl+V / \u2318V)");
        inputRef.current?.focus();
      } else {
        // Native: clipboard was empty
        setPasteHint("Nothing on clipboard");
        inputRef.current?.focus();
      }
    } finally {
      setPasting(false);
    }
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.gold],
  });

  const showChip = !!clipSuggestion && !value;

  return (
    <View style={styles.root}>
      {!!label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      {/* Floating paste suggestion chip — native only when clipboard has something */}
      <Animated.View
        style={[
          styles.chip,
          { pointerEvents: showChip ? "auto" : "none" },
          {
            backgroundColor: colors.surfaceHigh,
            borderColor: colors.gold + "50",
            opacity: chipAnim,
            transform: [
              {
                translateY: chipAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable onPress={applyClipSuggestion} style={styles.chipInner}>
          <View style={[styles.chipIconWrap, { backgroundColor: colors.gold + "20" }]}>
            <Icon name="clipboard" size={11} color={colors.goldLight} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.chipLabel, { color: colors.textMuted }]}>PASTE FROM CLIPBOARD</Text>
            <Text style={[styles.chipCode, { color: colors.textPrimary }]} numberOfLines={1}>
              {clipSuggestion}
            </Text>
          </View>
          <View style={[styles.chipAction, { backgroundColor: colors.gold }]}>
            <Text style={styles.chipActionText}>USE</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Input container */}
      <Animated.View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surfaceHigh,
            borderColor: borderColor,
          },
        ]}
      >
        {/* Left icon */}
        <View style={[styles.leftIcon, { backgroundColor: colors.gold + "18" }]}>
          <Icon name="tag" size={15} color={focused ? colors.goldLight : colors.textMuted} />
        </View>

        {/* Text field */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChange(t.toUpperCase().replace(/\s+/g, ""))}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          style={[
            styles.input,
            {
              color: value ? colors.textPrimary : colors.textMuted,
              letterSpacing: value ? 2 : 0.5,
              fontWeight: value ? "700" : "400",
            },
          ]}
        />

        {/* Right: paste or clear */}
        {value ? (
          <Pressable onPress={() => onChange("")} hitSlop={10} style={styles.rightBtn}>
            <View style={[styles.clearBtn, { backgroundColor: colors.border }]}>
              <Icon name="x" size={11} color={colors.textMuted} />
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={handlePastePress} hitSlop={10} style={styles.rightBtn} disabled={pasting}>
            <View style={[styles.pastePill, { backgroundColor: colors.gold + "20", borderColor: colors.gold + "40", opacity: pasting ? 0.5 : 1 }]}>
              <Icon name="clipboard" size={12} color={colors.goldLight} />
              <Text style={[styles.pastePillText, { color: colors.goldLight }]}>PASTE</Text>
            </View>
          </Pressable>
        )}
      </Animated.View>

      {/* Hint */}
      {pasteHint ? (
        <Text style={[styles.hint, { color: colors.goldLight }]}>{pasteHint}</Text>
      ) : focused && !value ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {isWeb
            ? "Type your code or press Ctrl+V / \u2318V to paste"
            : "Type your code or tap PASTE to fill it automatically"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  chipInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  chipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  chipCode: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  chipAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 54,
    gap: 12,
    paddingRight: 12,
    overflow: "hidden",
  },
  leftIcon: {
    width: 52,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  rightBtn: {
    padding: 2,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pastePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  pastePillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
});
