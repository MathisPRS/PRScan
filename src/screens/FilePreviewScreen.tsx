import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { RootStackParamList } from '../types';
import { formatFileSize } from '../utils/format';
import { CloudUploadModal } from '../components';
import { fileService } from '../services/fileService';
import { useTranslation } from '../i18n';

type RouteT = RouteProp<RootStackParamList, 'FilePreview'>;

const { width, height } = Dimensions.get('window');

export function FilePreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { t } = useTranslation();
  const { file } = route.params;
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fileService.shareFile(file);
  };

  const isViewable = file.type === 'pdf' || file.type === 'image';
  const fileUri = Platform.OS === 'ios' ? file.path : `file://${file.path}`;

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.toolBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
            {file.name}
          </Text>
          <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
        </View>

        <View style={styles.toolBtns}>
          <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
            <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowUpload(true)} style={styles.toolBtn}>
            <Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview */}
      {isViewable ? (
        <>
          <WebView
            source={{ uri: fileUri }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            scalesPageToFit
            bounces={false}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>{t('preview_loading')}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.unsupported}>
          <Ionicons name="document-outline" size={64} color={Colors.neutral300} />
          <Text style={styles.unsupportedTitle}>{t('preview_unsupported_title')}</Text>
          <Text style={styles.unsupportedSubtitle}>
            {t('preview_unsupported_subtitle')}
          </Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={Colors.white} />
            <Text style={styles.shareBtnText}>{t('preview_open_with')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showUpload && (
        <CloudUploadModal
          visible={showUpload}
          fileName={file.name}
          onClose={() => setShowUpload(false)}
          onSelect={async (provider) => {
            await fileService.uploadToCloud(file, provider);
            setShowUpload(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral900,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 52 : Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  toolBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  toolBtns: {
    flexDirection: 'row',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  fileMeta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  unsupported: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  unsupportedTitle: {
    ...Typography.titleLarge,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  unsupportedSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
    ...Shadow.md,
  },
  shareBtnText: {
    ...Typography.titleMedium,
    color: Colors.white,
  },
});
