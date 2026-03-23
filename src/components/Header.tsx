import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showAvatar?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showAvatar = true,
  onBack,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <View style={styles.row}>
        {/* Left: back button or logo */}
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Ionicons name="scan" size={18} color={Colors.white} />
              </View>
              <Text style={styles.logoText}>PRScan</Text>
            </View>
          )}
        </View>

        {/* Center: title when in sub-screen */}
        {showBack && title && (
          <View style={styles.center}>
            <Text style={styles.pageTitle} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
          </View>
        )}

        {/* Right: avatar or custom action */}
        <View style={styles.right}>
          {rightAction ?? (
            showAvatar && (
              <TouchableOpacity style={styles.avatar} activeOpacity={0.8}>
                <Ionicons name="person" size={18} color={Colors.neutral500} />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 2,
    alignItems: 'center',
  },
  right: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...Typography.titleLarge,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: -Spacing.sm,
  },
  pageTitle: {
    ...Typography.titleLarge,
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
