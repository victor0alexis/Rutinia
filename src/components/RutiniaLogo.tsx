import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export interface RutiniaLogoProps {
  size?: number;
  style?: ViewStyle;
  showGlow?: boolean;
}

export default function RutiniaLogo({
  size = 32,
  style,
  showGlow = true,
}: RutiniaLogoProps) {
  const containerRadius = Math.round(size * 0.38);
  const iconSize = Math.round(size * 0.84);

  return (
    <View style={[styles.root, { width: size, height: size }, style]}>
      {showGlow && (
        <LinearGradient
          colors={['rgba(194, 36, 61, 0.28)', 'rgba(216, 228, 245, 0.15)', 'transparent']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={[
            styles.glowHalo,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: containerRadius + 4,
            },
          ]}
        />
      )}
      <LinearGradient
        colors={['#161B24', '#0B0D13', '#06070A']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.8, y: 0.95 }}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: containerRadius,
          },
        ]}
      >
        <Image
          source={require('../../assets/brand/rutinia-simbolo-1024.png')}
          style={{ width: iconSize, height: iconSize }}
          contentFit="contain"
          transition={150}
          accessibilityLabel="Rutinia Logo"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowHalo: {
    position: 'absolute',
    opacity: 0.85,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#C2243D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
});
