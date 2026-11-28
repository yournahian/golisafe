import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DARK_THEME, LIGHT_THEME } from '../screens/mapConstants';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export type UniversalTab = 'map' | 'alerts' | 'report';

export interface BottomNavBarProps {
  activeTab: UniversalTab;
  isDark?: boolean;
  language?: Language;
  positionAbsolute?: boolean;
  onPressMap: () => void;
  onPressAlerts: () => void;
  onPressReport: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  isDark = true,
  language = 'en',
  positionAbsolute = false,
  onPressMap,
  onPressAlerts,
  onPressReport,
}) => {
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <View
      style={[
        styles.bottomNav,
        positionAbsolute && styles.absolutePos,
        {
          backgroundColor: theme.bottomNavBg,
          borderTopColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.navItem}
        onPress={onPressMap}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.navIconPill,
            activeTab === 'map' && { backgroundColor: theme.primarySurface },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 4 3 6.8v13.2L9 17.2l6 2.8 6-2.8V4l-6 2.8L9 4Z"
              stroke={activeTab === 'map' ? theme.primary : theme.navInactive}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Path
              d="M9 4v13.2M15 6.8V20"
              stroke={activeTab === 'map' ? theme.primary : theme.navInactive}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text
          style={[
            styles.navLabel,
            { color: theme.navInactive },
            activeTab === 'map' && {
              color: theme.primary,
              fontWeight: '600',
            },
          ]}
        >
          {t.tabs.map}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={onPressAlerts}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.navIconPill,
            activeTab === 'alerts' && { backgroundColor: theme.primarySurface },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
              stroke={activeTab === 'alerts' ? theme.primary : theme.navInactive}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M13.7 21a2 2 0 0 1-3.4 0"
              stroke={activeTab === 'alerts' ? theme.primary : theme.navInactive}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text
          style={[
            styles.navLabel,
            { color: theme.navInactive },
            activeTab === 'alerts' && {
              color: theme.primary,
              fontWeight: '600',
            },
          ]}
        >
          {t.tabs.alerts}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={onPressReport}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.navIconPill,
            activeTab === 'report' && { backgroundColor: theme.primarySurface },
          ]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 5v14M5 12h14"
              stroke={activeTab === 'report' ? theme.primary : theme.navInactive}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text
          style={[
            styles.navLabel,
            { color: theme.navInactive },
            activeTab === 'report' && {
              color: theme.primary,
              fontWeight: '600',
            },
          ]}
        >
          {t.tabs.report}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    height: 72,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 10,
  },
  absolutePos: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navIconPill: {
    width: 48,
    height: 26,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default BottomNavBar;
