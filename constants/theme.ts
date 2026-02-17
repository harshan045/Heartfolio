/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#1E293B",
    background: "#FDF6F0",
    card: "#FFFFFF",
    primary: "#FFB7CE", // Pink
    secondary: "#F1F5F9", // Light gray/input background
    tint: "#FFB7CE",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#FFB7CE",
    shadow: "#000",
    delete: "#EF4444",
  },
  dark: {
    text: "#070707", // Dark text for readability on light background
    background: "#0f0f0f", // Pure white for Gallery/Todo/Diary in dark mode
    card: "#FFFFFF", // White cards
    primary: "#fcfbfb", // Black for buttons/accents
    secondary: "#E2E8F0",
    tint: "#000000",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#000000",
    shadow: "#000",
    delete: "#EF4444",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
