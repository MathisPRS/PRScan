import { TextStyle } from 'react-native';

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const FontWeight: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

export const Typography = {
  displayLarge: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.display * LineHeight.tight,
  } as TextStyle,
  displaySmall: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xxxl * LineHeight.tight,
  } as TextStyle,
  headlineLarge: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xxl * LineHeight.tight,
  } as TextStyle,
  headlineMedium: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.xl * LineHeight.normal,
  } as TextStyle,
  titleLarge: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.lg * LineHeight.normal,
  } as TextStyle,
  titleMedium: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.relaxed,
  } as TextStyle,
  bodyMedium: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.normal,
  } as TextStyle,
  labelLarge: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.sm * LineHeight.normal,
    letterSpacing: 0.5,
  } as TextStyle,
  labelMedium: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.xs * LineHeight.normal,
    letterSpacing: 0.8,
  } as TextStyle,
  overline: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,
};
