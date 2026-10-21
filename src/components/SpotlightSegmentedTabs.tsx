import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colores, fuentes } from '../constants/colores';
import { vibrarBoton } from '../utils/haptics';

export interface SpotlightTabItem<T extends string = string> {
  id: T;
  label: string;
  iconFocused: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}

export interface SpotlightSegmentedTabsProps<T extends string = string> {
  tabs: SpotlightTabItem<T>[];
  activeTab: T;
  onChangeTab: (tabId: T) => void;
  style?: StyleProp<ViewStyle>;
}

export default function SpotlightSegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChangeTab,
  style,
}: SpotlightSegmentedTabsProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const numTabs = tabs.length;
  const tabWidth = containerWidth > 0 && numTabs > 0 ? containerWidth / numTabs : 0;

  const spotlightX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      spotlightX.value = withSpring(activeIndex * tabWidth, {
        stiffness: 240,
        damping: 24,
        mass: 0.8,
      });
    }
  }, [activeIndex, tabWidth, spotlightX]);

  const animatedSpotlightStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: spotlightX.value }],
      width: tabWidth,
    };
  });

  const animatedAmbienceStyle = useAnimatedStyle(() => {
    const beamWidth = Math.min(48, Math.max(30, tabWidth * 0.45));
    return {
      transform: [{ translateX: spotlightX.value + (tabWidth - beamWidth) / 2 }],
      width: beamWidth,
    };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        isWeb && styles.containerWeb,
        style,
      ]}
    >
      {/* 1. THE MOVING SPOTLIGHT */}
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.spotlightWrapper, animatedSpotlightStyle]}
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

      {/* 2. THE AMBIENCE BEAM */}
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.ambienceBeam, animatedAmbienceStyle]}
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

      {/* 3. TAB BUTTONS */}
      <View style={styles.itemsRow}>
        {tabs.map((item, index) => {
          const isFocused = activeIndex === index;

          const onPress = () => {
            vibrarBoton();
            onChangeTab(item.id);
          };

          return (
            <Pressable
              key={item.id}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Ionicons
                name={isFocused ? item.iconFocused : item.iconOutline}
                size={16}
                color={isFocused ? '#FFFFFF' : colores.suave}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? '#FFFFFF' : colores.suave,
                    fontFamily: isFocused ? fuentes.extraBold : fuentes.medium,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17, 17, 21, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  containerWeb: {
    // @ts-ignore
    backdropFilter: 'blur(16px)',
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.55), 0 0 1px 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
  },
  spotlightWrapper: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightGradient: {
    width: '88%',
    height: '100%',
    borderRadius: 20,
  },
  ambienceBeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    zIndex: 10,
  },
  itemsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
