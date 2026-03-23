import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { Header, ActionCard, FileListItem, FAB, CloudUploadModal } from '../components';
import { useFiles } from '../hooks/useFiles';
import { fileService } from '../services/fileService';
import { RootStackParamList, ScannedFile } from '../types';
import { useTranslation } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { files, loading, refresh } = useFiles();
  const [uploadTarget, setUploadTarget] = React.useState<ScannedFile | null>(null);

  const recentFiles = files.slice(0, 5);

  const handleScanDocument = useCallback(() => {
    navigation.navigate('ScanDocument');
  }, [navigation]);

  const handlePictureToPdf = useCallback(() => {
    navigation.navigate('PictureToPdf');
  }, [navigation]);

  const handleFileManager = useCallback(() => {
    navigation.navigate('Main');
  }, [navigation]);

  const handlePreview = useCallback((file: ScannedFile) => {
    navigation.navigate('FilePreview', { file });
  }, [navigation]);

  const handleRename = useCallback((file: ScannedFile) => {
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
  }, [refresh, t]);

  const handleDelete = useCallback(async (file: ScannedFile) => {
    await fileService.deleteFile(file);
    refresh();
  }, [refresh]);

  const handleShare = useCallback(async (file: ScannedFile) => {
    await fileService.shareFile(file);
  }, []);

  return (
    <View style={styles.container}>
      <Header showAvatar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('home_hero_label')}</Text>
          <Text style={styles.heroTitle}>{t('home_hero_title')}</Text>
        </View>

        <ActionCard
          label={t('home_scan_document')}
          icon="scan"
          variant="primary"
          onPress={handleScanDocument}
          style={styles.primaryAction}
        />

        <ActionCard
          label={t('home_picture_to_pdf')}
          icon="images-outline"
          variant="outlined"
          onPress={handlePictureToPdf}
        />
        <ActionCard
          label={t('home_file_management')}
          icon="folder-open-outline"
          variant="outlined"
          onPress={handleFileManager}
        />

        {recentFiles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home_recent_documents')}</Text>
            <View style={styles.fileList}>
              {recentFiles.map((file) => (
                <FileListItem
                  key={file.id}
                  file={file}
                  onPress={() => handlePreview(file)}
                  onRename={() => handleRename(file)}
                  onDelete={() => handleDelete(file)}
                  onShare={() => handleShare(file)}
                  onUpload={() => setUploadTarget(file)}
                />
              ))}
            </View>
          </View>
        )}

        {recentFiles.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={Colors.neutral300} />
            <Text style={styles.emptyTitle}>{t('home_empty_title')}</Text>
            <Text style={styles.emptySubtitle}>{t('home_empty_subtitle')}</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB onPress={handleScanDocument} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  hero: { marginBottom: Spacing.xl },
  heroLabel: { ...Typography.overline, color: Colors.primary, marginBottom: Spacing.xs },
  heroTitle: { ...Typography.displaySmall, color: Colors.textPrimary, lineHeight: 38 },
  primaryAction: { marginBottom: Spacing.md },
  section: { marginTop: Spacing.xxl },
  sectionTitle: { ...Typography.overline, color: Colors.textSecondary, marginBottom: Spacing.md },
  fileList: { backgroundColor: Colors.surface, borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.sm },
  emptyTitle: { ...Typography.titleLarge, color: Colors.textSecondary, marginTop: Spacing.md },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
