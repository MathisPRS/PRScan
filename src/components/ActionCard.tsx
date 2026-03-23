import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

type Variant = 'primary' | 'outlined' | 'ghost';

interface ActionCardProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  description?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  label,
  icon,
  variant = 'outlined',
  onPress,
  loading = false,
  disabled = false,
  style,
  description,
}) => {
  const isPrimary = variant === 'primary';
  const isOutlined = variant === 'outlined';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isOutlined && styles.outlined,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator
            color={isPrimary ? Colors.white : Colors.primary}
            size="small"
          />
        ) : (
          <View style={[styles.iconWrap, isPrimary && styles.iconWrapPrimary]}>
            <Ionicons
              name={icon}
              size={isPrimary ? 22 : 20}
              color={isPrimary ? Colors.white : Colors.primary}
            />
          </View>
        )}
        <View style={styles.textWrap}>
          <Text
            style={[
              styles.label,
              isPrimary ? styles.labelPrimary : styles.labelOutlined,
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}
        </View>
        {!isPrimary && (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.neutral400}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  primary: {
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
  outlined: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  ghost: {
    backgroundColor: Colors.neutral100,
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrimary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    ...Typography.titleMedium,
  },
  labelPrimary: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  labelOutlined: {
    color: Colors.textPrimary,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
