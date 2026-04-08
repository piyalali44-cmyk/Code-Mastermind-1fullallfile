import { useTheme } from "@/context/ThemeContext";
import colors from "@/constants/colors";

export function useColors() {
  const { theme } = useTheme();
  const paletteKey = theme === "light" ? "cream" : "dark";
  const palette = (colors as unknown as Record<string, typeof colors.light>)[paletteKey] ?? colors.light;
  return { ...palette, radius: colors.radius };
}
