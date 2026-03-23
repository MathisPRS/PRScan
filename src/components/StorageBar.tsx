import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { useTranslation } from '../i18n';

interface StorageBarProps {
  usedBytes: number;
  totalBytes: number;
}

export const StorageBar: React.FC<StorageBarProps> = ({ usedBytes, totalBytes }) => {
  const { t } = useTranslation();
  const percentUsed = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const percentAvailable = 100 - percentUsed;

  const formatGB = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const barColor =
    percentUsed > 90
      ? Colors.error
      : percentUsed > 70
      ? Colors.warning
      : Colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={styles.labelLeft}>{t('storage_capacity')}</Text>
        <Text style={styles.labelRight}>
          <Text style={styles.percent}>{Math.round(percentAvailable)}%</Text>
          {` ${t('storage_available')}`}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${percentUsed}%` as any, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={styles.detail}>
        {t('storage_used_of', formatGB(usedBytes), formatGB(totalBytes))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  labelLeft: {
    ...Typography.overline,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  labelRight: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  percent: {
    color: Colors.primary,
    fontWeight: '700',
  },
  track: {
    height: 4,
    backgroundColor: Colors.neutral200,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  detail: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
