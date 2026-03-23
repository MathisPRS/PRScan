import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { CloudProvider } from '../types';
import { useTranslation } from '../i18n';

interface CloudUploadModalProps {
  visible: boolean;
  fileName: string;
  onClose: () => void;
  onSelect: (provider: CloudProvider) => void;
}

export const CloudUploadModal: React.FC<CloudUploadModalProps> = ({
  visible,
  fileName,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();

  const PROVIDERS: { id: CloudProvider; labelKey: 'cloud_local' | 'cloud_google_drive' | 'cloud_onedrive' | 'cloud_icloud'; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { id: 'local', labelKey: 'cloud_local', icon: 'phone-portrait-outline', color: Colors.tertiary },
    { id: 'google_drive', labelKey: 'cloud_google_drive', icon: 'logo-google', color: '#4285F4' },
    { id: 'onedrive', labelKey: 'cloud_onedrive', icon: 'cloud-outline', color: '#0078D4' },
    { id: 'icloud', labelKey: 'cloud_icloud', icon: 'cloud-outline', color: '#007AFF' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('cloud_save_to')}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{fileName}</Text>

        {PROVIDERS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.row}
            onPress={() => {
              onSelect(p.id);
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: p.color + '20' }]}>
              <Ionicons name={p.icon} size={22} color={p.color} />
            </View>
            <Text style={styles.rowLabel}>{t(p.labelKey)}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.neutral400} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>{t('common_cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.huge,
    paddingTop: Spacing.md,
    ...Shadow.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.neutral300,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  cancelBtn: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelText: {
    ...Typography.titleMedium,
    color: Colors.primary,
  },
});
