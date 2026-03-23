import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { Header, FileListItem, StorageBar, FAB, CloudUploadModal } from '../components';
import { useFiles } from '../hooks/useFiles';
import { useStorage } from '../hooks/useStorage';
import { fileService } from '../services/fileService';
import { RootStackParamList, ScannedFile, SortOption } from '../types';
import { useTranslation } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FileManagerScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [uploadTarget, setUploadTarget] = useState<ScannedFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<ScannedFile | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { files, loading, refresh } = useFiles({ query, sortBy });
  const { storageInfo } = useStorage();

  const SORT_LABELS: Record<SortOption, string> = {
    name_asc: t('files_sort_name_asc'),
    name_desc: t('files_sort_name_desc'),
    date_desc: t('files_sort_date_desc'),
    date_asc: t('files_sort_date_asc'),
    size_desc: t('files_sort_size_desc'),
    size_asc: t('files_sort_size_asc'),
  };

  const handlePreview = useCallback((file: ScannedFile) => {
    navigation.navigate('FilePreview', { file });
  }, [navigation]);

  const handleRename = useCallback((file: ScannedFile) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        t('files_rename_title'),
        t('files_rename_message'),
        async (newName) => {
          if (newName && newName.trim()) {
            await fileService.renameFile(file, newName.trim());
            refresh();
          }
        },
        'plain-text',
        file.name.replace(/\.[^.]+$/, ''),
      );
    } else {
      setRenameValue(file.name.replace(/\.[^.]+$/, ''));
      setRenameTarget(file);
    }
  }, [refresh, t]);

  const commitRename = async () => {
    if (renameTarget && renameValue.trim()) {
      await fileService.renameFile(renameTarget, renameValue.trim());
      refresh();
    }
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleDelete = useCallback(async (file: ScannedFile) => {
    await fileService.deleteFile(file);
    refresh();
  }, [refresh]);

  const handleShare = useCallback(async (file: ScannedFile) => {
    await fileService.shareFile(file);
  }, []);

  const showSortOptions = () => {
    const options = Object.entries(SORT_LABELS).map(([k, v]) => v);
    const keys = Object.keys(SORT_LABELS) as SortOption[];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, t('common_cancel')], cancelButtonIndex: options.length, title: t('files_sort_by') },
        (idx) => {
          if (idx < keys.length) setSortBy(keys[idx]);
        },
      );
    } else {
      Alert.alert(
        t('files_sort_by'),
        undefined,
        [
          ...keys.map((k) => ({ text: SORT_LABELS[k], onPress: () => setSortBy(k) })),
          { text: t('common_cancel'), style: 'cancel' as const },
        ],
      );
    }
  };

  return (
    <View style={styles.container}>
      <Header showAvatar />

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{t('files_title')}</Text>
        <TouchableOpacity onPress={showSortOptions} style={styles.sortBtn}>
          <Ionicons name="funnel-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.sortLabel}>{SORT_LABELS[sortBy]}</Text>
        </TouchableOpacity>
      </View>

      {/* Storage bar */}
      {storageInfo && (
        <View style={styles.storageWrap}>
          <StorageBar
            usedBytes={storageInfo.used}
            totalBytes={storageInfo.total}
          />
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.neutral400} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('files_search_placeholder')}
            placeholderTextColor={Colors.neutral400}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.neutral400} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* File list */}
      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <FileListItem
            file={item}
            onPress={() => handlePreview(item)}
            onRename={() => handleRename(item)}
            onDelete={() => handleDelete(item)}
            onShare={() => handleShare(item)}
            onUpload={() => setUploadTarget(item)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={64} color={Colors.neutral300} />
              <Text style={styles.emptyTitle}>
                {query ? t('files_no_results_title') : t('files_empty_title')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query
                  ? t('files_no_results_subtitle', query)
                  : t('files_empty_subtitle')}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          files.length > 0 ? (
            <Text style={styles.endLabel}>{t('files_end_of_history')}</Text>
          ) : null
        }
        contentContainerStyle={files.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />

      <FAB onPress={() => navigation.navigate('ScanDocument')} />

      {uploadTarget && (
        <CloudUploadModal
          visible={!!uploadTarget}
          fileName={uploadTarget.name}
          onClose={() => setUploadTarget(null)}
          onSelect={async (provider) => {
            await fileService.uploadToCloud(uploadTarget, provider);
            setUploadTarget(null);
          }}
        />
      )}

      {/* Android rename dialog */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>{t('files_rename_title')}</Text>
            <Text style={styles.renameMsg}>{t('files_rename_message')}</Text>
            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={commitRename}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity onPress={() => setRenameTarget(null)} style={styles.renameCancelBtn}>
                <Text style={styles.renameCancelText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={commitRename} style={styles.renameConfirmBtn}>
                <Text style={styles.renameConfirmText}>{t('common_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  pageTitle: {
    ...Typography.displaySmall,
    color: Colors.textPrimary,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  storageWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyTitle: {
    ...Typography.titleLarge,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  endLabel: {
    ...Typography.labelMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    letterSpacing: 1,
    fontSize: 10,
  },
  // Android rename modal
  renameOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  renameCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl, width: '100%', ...Shadow.lg },
  renameTitle: { ...Typography.titleLarge, color: Colors.textPrimary, marginBottom: Spacing.xs },
  renameMsg: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.md },
  renameInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, ...Typography.bodyMedium, color: Colors.textPrimary, backgroundColor: Colors.background },
  renameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.lg },
  renameCancelBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  renameCancelText: { ...Typography.titleMedium, color: Colors.textSecondary },
  renameConfirmBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  renameConfirmText: { ...Typography.titleMedium, color: Colors.white },
});
