import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { Header } from '../components';
import { RootStackParamList } from '../types';
import { useTranslation } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Tool {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action: () => void;
}

export function ToolsScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  const tools: Tool[] = [
    {
      id: 'scan',
      label: t('tools_scan'),
      description: t('tools_scan_desc'),
      icon: 'scan',
      color: Colors.primary,
      action: () => navigation.navigate('ScanDocument'),
    },
    {
      id: 'img_to_pdf',
      label: t('tools_img_to_pdf'),
      description: t('tools_img_to_pdf_desc'),
      icon: 'images-outline',
      color: Colors.tertiary,
      action: () => navigation.navigate('PictureToPdf'),
    },
    {
      id: 'merge',
      label: t('tools_merge'),
      description: t('tools_merge_desc'),
      icon: 'git-merge-outline',
      color: Colors.secondary,
      action: () => {},
    },
    {
      id: 'compress',
      label: t('tools_compress'),
      description: t('tools_compress_desc'),
      icon: 'archive-outline',
      color: Colors.neutral700,
      action: () => {},
    },
    {
      id: 'ocr',
      label: t('tools_ocr'),
      description: t('tools_ocr_desc'),
      icon: 'text-outline',
      color: Colors.warning,
      action: () => {},
    },
    {
      id: 'sign',
      label: t('tools_sign'),
      description: t('tools_sign_desc'),
      icon: 'pencil-outline',
      color: Colors.success,
      action: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <Header showAvatar={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t('tools_title')}</Text>
        <Text style={styles.pageSubtitle}>{t('tools_subtitle')}</Text>

        <View style={styles.grid}>
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.toolCard}
              onPress={tool.action}
              activeOpacity={0.75}
            >
              <View style={[styles.toolIcon, { backgroundColor: tool.color + '18' }]}>
                <Ionicons name={tool.icon} size={28} color={tool.color} />
              </View>
              <Text style={styles.toolLabel}>{tool.label}</Text>
              <Text style={styles.toolDesc}>{tool.description}</Text>
            </TouchableOpacity>
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
  },
  pageSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  toolCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  toolIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  toolLabel: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  toolDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
