import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { ScannedFile } from '../types';
import { formatFileSize, formatDate } from '../utils/format';
import { useTranslation } from '../i18n';

interface FileListItemProps {
  file: ScannedFile;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
  onUpload: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  onPress,
  onRename,
  onDelete,
  onShare,
  onUpload,
}) => {
  const { t } = useTranslation();

  const showMenu = () => {
    Alert.alert(file.name, undefined, [
      {
        text: t('common_preview'),
        onPress,
      },
      {
        text: t('common_share'),
        onPress: onShare,
      },
      {
        text: t('common_upload_cloud'),
        onPress: onUpload,
      },
      {
        text: t('common_rename'),
        onPress: onRename,
      },
      {
        text: t('common_delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            t('files_delete_confirm_title'),
            t('files_delete_confirm_message', file.name),
            [
              { text: t('common_cancel'), style: 'cancel' },
              { text: t('common_delete'), style: 'destructive', onPress: onDelete },
            ],
          ),
      },
      { text: t('common_cancel'), style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* File icon */}
      <View style={styles.iconWrap}>
        <Ionicons
          name={file.type === 'pdf' ? 'document-text' : 'image'}
          size={24}
          color={Colors.primary}
        />
      </View>

      {/* File info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">
          {file.name}
        </Text>
        <Text style={styles.meta}>
          {formatFileSize(file.size)} · {formatDate(file.modifiedAt)}
        </Text>
      </View>

      {/* 3-dot menu */}
      <TouchableOpacity
        onPress={showMenu}
        style={styles.menuBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={Colors.neutral500} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.pdfRedLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  meta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
