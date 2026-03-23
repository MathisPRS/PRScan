import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Shadow, Typography } from '../theme';
import { BottomTabParamList, RootStackParamList } from '../types';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { FileManagerScreen } from '../screens/FileManagerScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { PictureToPdfScreen } from '../screens/PictureToPdfScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { FilePreviewScreen } from '../screens/FilePreviewScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Files: { active: 'folder', inactive: 'folder-outline' },
  Scan: { active: 'scan', inactive: 'scan-outline' },
  Tools: { active: 'build', inactive: 'build-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm },
        ],
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.neutral500,
        tabBarShowLabel: true,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            style={[
              styles.tabLabel,
              { color },
              focused && styles.tabLabelActive,
            ]}
          >
            {children}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Files" component={HomeScreen} />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.scanTabIcon, focused && styles.scanTabIconActive]}>
              <Ionicons
                name={focused ? 'scan' : 'scan-outline'}
                size={24}
                color={focused ? Colors.white : Colors.neutral500}
              />
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabLabel, { color }, focused && styles.tabLabelActive]}>
              Scan
            </Text>
          ),
        }}
      />
      <Tab.Screen name="Tools" component={ToolsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="FilePreview"
          component={FilePreviewScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ScanDocument"
          component={ScanScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="PictureToPdf"
          component={PictureToPdfScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: Platform.OS === 'ios' ? 80 : 64,
    paddingTop: Spacing.sm,
    ...Shadow.sm,
  },
  tabLabel: {
    ...Typography.labelMedium,
    fontSize: 10,
    marginTop: 2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  scanTabIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scanTabIconActive: {
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
});
