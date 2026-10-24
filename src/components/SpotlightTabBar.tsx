import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { fuentes, noir } from '../constants/colores';
import { vibrarBoton } from '../utils/haptics';
import { useLayout } from '../hooks/useLayout';

type TabRouteMeta = {
  name: string;
  label: string;
  iconFocused: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
};

const TAB_CONFIG: Record<string, TabRouteMeta> = {
  progreso: {
    name: 'progreso',
    label: 'Progreso',
    iconFocused: 'stats-chart',
    iconOutline: 'stats-chart-outline',
  },
  rutinas: {
    name: 'rutinas',
    label: 'Rutinas',
    iconFocused: 'barbell',
    iconOutline: 'barbell-outline',
  },
  index: {
    name: 'index',
    label: 'Semana',
    iconFocused: 'calendar',
    iconOutline: 'calendar-outline',
  },
  notas: {
    name: 'notas',
    label: 'Notas',
    iconFocused: 'document-text',
    iconOutline: 'document-text-outline',
  },
  calendario: {
    name: 'calendario',
    label: 'Calendario',
    iconFocused: 'time',
    iconOutline: 'time-outline',
  },
};

export default function SpotlightTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { isLandscape, isCompact } = useLayout();
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeIndex = state.index;
  const numTabs = state.routes.length;
  const tabWidth = containerWidth > 0 ? containerWidth / numTabs : 0;

  // Shared value para la posición del Spotlight y Ambience de VengeanceUI
  const spotlightX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      spotlightX.value = withSpring(activeIndex * tabWidth, {
        stiffness: 220,
        damping: 22,
        mass: 0.8,
      });
    }
  }, [activeIndex, tabWidth, spotlightX]);

  // Estilo animado del Spotlight (resplandor suave bajo el tab activo)
  const animatedSpotlightStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: spotlightX.value }],
      width: tabWidth,
    };
  });

  // Estilo animado del Ambience Beam (haz luminoso superior concentrado)
  const animatedAmbienceStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: spotlightX.value + (tabWidth - 44) / 2 }],
    };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const isWeb = Platform.OS === 'web';
  const bottomInsetToUse = isLandscape ? 4 : (insets.bottom > 0 ? 10 : 6);
  const contentHeight = isLandscape ? 44 : 52;
  const totalNavHeight = contentHeight + bottomInsetToUse;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerWrapper,
        isWeb && styles.outerWrapperWeb,
      ]}
    >
      <View
        onLayout={handleLayout}
        style={[
          styles.navbarContainer,
          {
            height: totalNavHeight,
            paddingBottom: bottomInsetToUse,
          },
          isLandscape && styles.navbarContainerLandscape,
          isWeb && styles.navbarContainerWeb,
        ]}
      >
        {/* 1. THE MOVING SPOTLIGHT (Cápsula de luz suave que sigue al tab activo) */}
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotlightWrapper,
              animatedSpotlightStyle,
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.14)',
                'rgba(255, 255, 255, 0.05)',
                'transparent',
              ]}
              style={styles.spotlightGradient}
            />
          </Animated.View>
        )}

        {/* 2. THE AMBIENCE BEAM (Haz de luz superior centrado en el activo) */}
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ambienceBeam,
              animatedAmbienceStyle,
            ]}
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255, 255, 255, 0.95)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* 3. ITEMS / BOTONES DE NAVEGACIÓN */}
        <View style={[styles.itemsRow, { height: contentHeight }]}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const meta = TAB_CONFIG[route.name] || {
              name: route.name,
              label: route.name,
              iconFocused: 'apps',
              iconOutline: 'apps-outline',
            };

            const onPress = () => {
              vibrarBoton();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={({ pressed }) => [
                  styles.tabItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
              >
                <Ionicons
                  name={isFocused ? meta.iconFocused : meta.iconOutline}
                  size={isLandscape ? 19 : isCompact ? 19 : 21}
                  color={
                    isFocused
                      ? '#FFFFFF'
                      : hoveredIndex === index
                      ? '#E8EDF4'
                      : noir.muted
                  }
                />
                {!isLandscape && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      {
                        color:
                          isFocused
                            ? '#FFFFFF'
                            : hoveredIndex === index
                            ? '#E8EDF4'
                            : noir.muted,
                        fontFamily: isFocused ? fuentes.extraBold : fuentes.medium,
                      },
                    ]}
                  >
                    {meta.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      {/* Extensión hacia abajo para garantizar 100% fondo sólido detrás del home indicator y en overscroll */}
      <View pointerEvents="none" style={styles.bottomFiller} />
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    zIndex: 9999,
    width: '100%',
    backgroundColor: '#0B0D13',
  },
  outerWrapperWeb: {
    // @ts-ignore
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
  },
  navbarContainer: {
    width: '100%',
    maxWidth: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#0B0D13',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.09)',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 16,
  },
  bottomFiller: {
    position: 'absolute',
    bottom: -300,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: '#0B0D13',
  },
  navbarContainerLandscape: {
    maxWidth: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  navbarContainerWeb: {
    // @ts-ignore
    backdropFilter: 'blur(16px)',
    boxShadow:
      '0 -6px 24px rgba(0, 0, 0, 0.65), 0 -1px 0 0 rgba(255, 255, 255, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
  },
  spotlightWrapper: {
    position: 'absolute',
    top: 2,
    height: 46,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightGradient: {
    width: '88%',
    height: '100%',
    borderRadius: 22,
  },
  ambienceBeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 2,
    zIndex: 10,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 4,
    // @ts-ignore
    boxShadow: '0 0 8px rgba(255, 255, 255, 0.55)',
  },
  itemsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
});
