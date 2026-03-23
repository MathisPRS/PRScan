import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { Header } from '../components';
import { pdfService } from '../services/pdfService';
import { fileService } from '../services/fileService';
import { generateFileName } from '../utils/format';
import { useTranslation } from '../i18n';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ConvertState = 'idle' | 'converting' | 'done' | 'error';

interface SelectedImage {
  uri: string;
  width: number;
  height: number;
}

export function PictureToPdfScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [convertState, setConvertState] = useState<ConvertState>('idle');
  const [savedFileName, setSavedFileName] = useState('');

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('pdf_permission_title'), t('pdf_permission_message'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      orderedSelection: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages: SelectedImage[] = result.assets.map((a) => ({
        uri: a.uri,
        width: a.width,
        height: a.height,
      }));
      setImages((prev) => [...prev, ...newImages]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [t]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  }, []);

  const convertToPdf = useCallback(async () => {
    if (images.length === 0) {
      Alert.alert(t('pdf_no_images_title'), t('pdf_no_images_message'));
      return;
    }

    setConvertState('converting');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const fileName = generateFileName('pictures');
      const uris = images.map((img) => img.uri);
      await pdfService.imagesToPdf(uris, fileName);

      setSavedFileName(fileName + '.pdf');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConvertState('done');
    } catch (err: any) {
      console.error('Convert error:', err);
      Alert.alert(t('common_error'), err?.message ?? t('common_error'));
      setConvertState('error');
    }
  }, [images, t]);

  const handleReset = () => {
    setImages([]);
    setConvertState('idle');
    setSavedFileName('');
  };

  if (convertState === 'done') {
    return (
      <View style={styles.container}>
        <Header
          showBack
          onBack={() => navigation.goBack()}
          title={t('pdf_title')}
        />
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={56} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>{t('pdf_done_title')}</Text>
          <Text style={styles.successSubtitle}>{savedFileName}</Text>
          <Text style={styles.successDetail}>
            {t('pdf_done_detail', images.length)}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset}>
            <Ionicons name="images-outline" size={20} color={Colors.white} />
            <Text style={styles.primaryBtnText}>{t('pdf_convert_more')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>{t('pdf_go_files')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        showBack
        onBack={() => navigation.goBack()}
        title={t('pdf_title')}
        subtitle={images.length > 0 ? t('pdf_convert_button', images.length) : undefined}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty state */}
        {images.length === 0 && (
          <TouchableOpacity
            style={styles.dropZone}
            onPress={pickImages}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={56} color={Colors.neutral400} />
            <Text style={styles.dropZoneTitle}>{t('pdf_add_images')}</Text>
            <Text style={styles.dropZoneSubtitle}>
              {t('pdf_add_images_subtitle')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <>
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>{t('pdf_pages_in_order')}</Text>
              <TouchableOpacity onPress={pickImages} style={styles.addMoreBtn}>
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.addMoreText}>{t('pdf_add_more')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {images.map((img, index) => (
                <View key={img.uri + index} style={styles.gridItem}>
                  <Image source={{ uri: img.uri }} style={styles.thumbnail} resizeMode="cover" />
                  {/* Page number */}
                  <View style={styles.pageNumber}>
                    <Text style={styles.pageNumberText}>{index + 1}</Text>
                  </View>
                  {/* Remove */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeImage(index)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                  {/* Move buttons */}
                  <View style={styles.moveRow}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveImage(index, index - 1)}
                      >
                        <Ionicons name="arrow-back" size={14} color={Colors.white} />
                      </TouchableOpacity>
                    )}
                    {index < images.length - 1 && (
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveImage(index, index + 1)}
                      >
                        <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      {images.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, convertState === 'converting' && styles.btnDisabled]}
            onPress={convertToPdf}
            disabled={convertState === 'converting'}
            activeOpacity={0.85}
          >
            {convertState === 'converting' ? (
              <>
                <ActivityIndicator color={Colors.white} size="small" />
                <Text style={styles.primaryBtnText}>{t('pdf_converting')}</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>
                  {t('pdf_convert_button', images.length)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const GRID_COLS = 3;
const GRID_GAP = Spacing.sm;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.neutral300,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  dropZoneTitle: {
    ...Typography.titleLarge,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  dropZoneSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  gridTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight + '22',
  },
  addMoreText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: `${(100 - (GRID_COLS - 1) * 2) / GRID_COLS}%`,
    aspectRatio: 0.707, // A4 ratio
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.neutral200,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  moveRow: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  moveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    ...Shadow.md,
    marginBottom: Spacing.sm,
  },
  primaryBtnText: {
    ...Typography.titleMedium,
    color: Colors.white,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...Typography.titleMedium,
    color: Colors.primary,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  successTitle: {
    ...Typography.headlineLarge,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  successSubtitle: {
    ...Typography.titleMedium,
    color: Colors.primary,
  },
  successDetail: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
});
