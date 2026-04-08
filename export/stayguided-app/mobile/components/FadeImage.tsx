import React, { useRef } from "react";
import { Animated, ImageResizeMode, StyleProp, ImageStyle } from "react-native";

interface FadeImageProps {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  duration?: number;
}

export default function FadeImage({
  uri,
  style,
  resizeMode = "cover",
  duration = 300,
}: FadeImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  return (
    <Animated.Image
      source={{ uri }}
      style={[style, { opacity }]}
      resizeMode={resizeMode}
      onLoad={() =>
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }).start()
      }
    />
  );
}
