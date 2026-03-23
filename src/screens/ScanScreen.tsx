import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { fileService } from '../services/fileService';
import { pdfService } from '../services/pdfService';
import { RootStackParamList } from '../types';
import { generateFileName } from '../utils/format';
import { useTranslation } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScanState = 'idle' | 'scanning' | 'processing' | 'done' | 'error';

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedCount, setScannedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('permission_camera_title'),
            message: t('permission_camera_message'),
            buttonPositive: t('permission_camera_allow'),
            buttonNegative: t('permission_camera_deny'),
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    return true;
  };

  const startScan = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(t('scan_permission_title'), t('scan_permission_message'), [{ text: t('common_ok') }]);
      return;
    }

    setScanState('scanning');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
        croppedImageQuality: 100,
      });

      if (status === 'cancel' || !scannedImages || scannedImages.length === 0) {
        setScanState('idle');
        return;
      }

      setScanState('processing');
      setScannedCount(scannedImages.length);

      const fileName = generateFileName('scan');
      await pdfService.imagesToPdf(scannedImages, fileName);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScanState('done');
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMessage(err?.message ?? t('common_error'));
      setScanState('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDone = () => {
    setScanState('idle');
    setScannedCount(0);
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleScanAnother = () => {
    setScanState('idle');
    setScannedCount(0);
    startScan();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="scan" size={18} color={Colors.white} />
          </View>
          <Text style={styles.logoText}>{t('app_name')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {scanState === 'idle' && (
          <>
            <View style={styles.iconArea}>
              <View style={styles.scanCircle}>
                <Ionicons name="scan" size={80} color={Colors.primary} />
              </View>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>

            <Text style={styles.title}>{t('scan_title')}</Text>
            <Text style={styles.subtitle}>{t('scan_subtitle')}</Text>

            <View style={styles.features}>
              {[
                { icon: 'eye-outline', key: 'scan_feature_auto_detect' },
                { icon: 'cut-outline', key: 'scan_feature_bg_remove' },
                { icon: 'document-text-outline', key: 'scan_feature_save_pdf' },
              ].map((f) => (
                <View key={f.icon} style={styles.feature}>
                  <Ionicons name={f.icon as any} size={18} color={Colors.tertiary} />
                  <Text style={styles.featureText}>{t(f.key as any)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.scanBtn} onPress={startScan} activeOpacity={0.85}>
              <Ionicons name="scan" size={22} color={Colors.white} />
              <Text style={styles.scanBtnText}>{t('scan_start')}</Text>
            </TouchableOpacity>
          </>
        )}

        {scanState === 'scanning' && (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.stateTitle}>{t('scan_open')}</Text>
            <Text style={styles.stateSubtitle}>{t('scan_open_subtitle')}</Text>
          </View>
        )}

        {scanState === 'processing' && (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.stateTitle}>{t('scan_processing')}</Text>
            <Text style={styles.stateSubtitle}>{t('scan_processing_subtitle', scannedCount)}</Text>
          </View>
        )}

        {scanState === 'done' && (
          <View style={styles.stateWrap}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={56} color={Colors.white} />
            </View>
            <Text style={styles.stateTitle}>{t('scan_done_title')}</Text>
            <Text style={styles.stateSubtitle}>{t('scan_done_subtitle', scannedCount)}</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanAnother}>
              <Ionicons name="scan-outline" size={20} color={Colors.white} />
              <Text style={styles.scanBtnText}>{t('scan_another')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleDone}>
              <Text style={styles.secondaryBtnText}>{t('scan_go_files')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanState === 'error' && (
          <View style={styles.stateWrap}>
            <View style={styles.errorCircle}>
              <Ionicons name="close" size={56} color={Colors.white} />
            </View>
            <Text style={styles.stateTitle}>{t('scan_failed_title')}</Text>
            <Text style={styles.stateSubtitle}>{errorMessage}</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={startScan}>
              <Ionicons name="refresh-outline" size={20} color={Colors.white} />
              <Text style={styles.scanBtnText}>{t('common_retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleDone}>
              <Text style={styles.secondaryBtnText}>{t('common_cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { ...Typography.titleLarge, color: Colors.textPrimary, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  iconArea: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl, position: 'relative' },
  scanCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.primaryLight + '22', alignItems: 'center', justifyContent: 'center' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: Colors.primary, borderTopLeftRadius: 4 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: Colors.primary, borderTopRightRadius: 4 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: Colors.primary, borderBottomLeftRadius: 4 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: Colors.primary, borderBottomRightRadius: 4 },
  title: { ...Typography.headlineLarge, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  subtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  features: { gap: Spacing.sm, marginBottom: Spacing.xxl, alignSelf: 'stretch' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  featureText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl, borderRadius: Radius.md, alignSelf: 'stretch', justifyContent: 'center', ...Shadow.md, marginBottom: Spacing.md },
  scanBtnText: { ...Typography.titleMedium, color: Colors.white, fontWeight: '600' },
  secondaryBtn: { paddingVertical: Spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  secondaryBtnText: { ...Typography.titleMedium, color: Colors.primary },
  stateWrap: { alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' },
  stateTitle: { ...Typography.headlineMedium, color: Colors.textPrimary, marginTop: Spacing.md },
  stateSubtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  successCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  errorCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
});
