import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { Header } from '../components';
import { useTranslation, Language } from '../i18n';

export function SettingsScreen() {
  const { t, lang, changeLanguage } = useTranslation();
  const [autoSave, setAutoSave] = useState(true);
  const [highQuality, setHighQuality] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const connectedAccounts = [
    { id: 'google_drive', label: t('cloud_google_drive'), icon: 'logo-google', color: '#4285F4', connected: false },
    { id: 'onedrive', label: t('cloud_onedrive'), icon: 'cloud-outline', color: '#0078D4', connected: false },
    { id: 'icloud', label: t('cloud_icloud'), icon: 'cloud-outline', color: '#007AFF', connected: false },
  ];

  const handleConnect = (provider: string) => {
    Alert.alert(
      t('settings_cloud_connect_title'),
      t('settings_cloud_connect_message', provider),
      [{ text: t('common_ok') }],
    );
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: t('settings_language_en') },
    { code: 'fr', label: t('settings_language_fr') },
  ];

  return (
    <View style={styles.container}>
      <Header showAvatar={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t('settings_title')}</Text>

        {/* Cloud Storage */}
        <Text style={styles.sectionHeader}>{t('settings_section_cloud')}</Text>
        <View style={styles.card}>
          {connectedAccounts.map((acc, idx) => (
            <View key={acc.id}>
              <View style={styles.accountRow}>
                <View style={[styles.accountIcon, { backgroundColor: acc.color + '20' }]}>
                  <Ionicons name={acc.icon as any} size={20} color={acc.color} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountLabel}>{acc.label}</Text>
                  <Text style={styles.accountStatus}>
                    {acc.connected ? t('settings_cloud_connected') : t('settings_cloud_not_connected')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.connectBtn, acc.connected && styles.disconnectBtn]}
                  onPress={() => handleConnect(acc.label)}
                >
                  <Text style={[styles.connectBtnText, acc.connected && styles.disconnectBtnText]}>
                    {acc.connected ? t('settings_cloud_disconnect') : t('settings_cloud_connect')}
                  </Text>
                </TouchableOpacity>
              </View>
              {idx < connectedAccounts.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Scan preferences */}
        <Text style={styles.sectionHeader}>{t('settings_section_scan')}</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('settings_high_quality')}</Text>
              <Text style={styles.toggleSubtitle}>{t('settings_high_quality_subtitle')}</Text>
            </View>
            <Switch
              value={highQuality}
              onValueChange={setHighQuality}
              trackColor={{ false: Colors.neutral300, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('settings_auto_save')}</Text>
              <Text style={styles.toggleSubtitle}>{t('settings_auto_save_subtitle')}</Text>
            </View>
            <Switch
              value={autoSave}
              onValueChange={setAutoSave}
              trackColor={{ false: Colors.neutral300, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Display */}
        <Text style={styles.sectionHeader}>{t('settings_section_display')}</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('settings_dark_mode')}</Text>
              <Text style={styles.toggleSubtitle}>{t('settings_dark_mode_subtitle')}</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: Colors.neutral300, true: Colors.primary }}
              thumbColor={Colors.white}
              disabled
            />
          </View>
        </View>

        {/* Language */}
        <Text style={styles.sectionHeader}>{t('settings_section_language')}</Text>
        <View style={styles.card}>
          {languages.map((item, idx) => (
            <View key={item.code}>
              <TouchableOpacity
                style={styles.languageRow}
                onPress={() => changeLanguage(item.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.languageLabel}>{item.label}</Text>
                {lang === item.code && (
                  <Ionicons name="checkmark" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
              {idx < languages.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* About */}
        <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
        <View style={styles.card}>
          {[
            { label: t('settings_version'), value: '1.0.0' },
            { label: t('settings_build'), value: '1' },
          ].map((item, idx) => (
            <View key={item.label}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
              {idx === 0 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  pageTitle: {
    ...Typography.displaySmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    ...Typography.overline,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountLabel: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  accountStatus: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  connectBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  disconnectBtn: {
    backgroundColor: Colors.neutral200,
  },
  connectBtnText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },
  disconnectBtnText: {
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  languageLabel: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  infoLabel: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
});
