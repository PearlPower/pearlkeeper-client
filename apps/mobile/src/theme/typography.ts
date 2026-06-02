import { TextStyle } from "react-native";

export const fonts = {
  serif: "CrimsonPro-Regular",
  serifSemiBold: "CrimsonPro-SemiBold",
  serifBold: "CrimsonPro-Bold",
  sans: "OpenSans-Regular",
  sansSemiBold: "OpenSans-SemiBold",
  sansBold: "OpenSans-Bold",
  display: "Urbanist-Regular",
  displayExtraLight: "Urbanist-ExtraLight",
  displayLight: "Urbanist-Light",
  displaySemiBold: "Urbanist-SemiBold",
  mono: "monospace",
};

export const typeStyles: Record<string, TextStyle> = {
  displayLarge: {
    fontFamily: fonts.displayLight,
    fontSize: 32,
  },
  screenTitle: {
    fontFamily: fonts.displayLight,
    fontSize: 28,
  },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 30,
  },
  bodySmall: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 13,
  },
};
