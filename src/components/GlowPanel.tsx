import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Box,
  BoxShadow,
  Canvas,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import { noir } from '../constantes/colores';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Radio de la superficie. Debe coincidir con el radio visual del contenedor. */
  radius?: number;
  /** Margen lateral del filo de luz superior. */
  hairlineInset?: number;
};

/**
 * Superficie de obsidiana con el glow perla del MainDayCard.
 *
 * Se extrajo del home para que cualquier sección nueva (Notas, y las que
 * vengan después) herede exactamente la misma profundidad, borde y filo de
 * luz. En web usa box-shadow; en nativo dibuja el glow con Skia.
 */
export default function GlowPanel({
  children,
  style,
  radius = 20,
  hairlineInset = 14,
}: Props) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isWeb = Platform.OS === 'web';

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.base,
        { borderRadius: radius },
        isWeb && styles.webShadow,
        style,
      ]}
    >
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(
              rect(0, 0, dimensions.width, dimensions.height),
              radius,
              radius
            )}
            color="rgb(15, 15, 15)"
          >
            <BoxShadow
              dx={0}
              dy={0}
              blur={28}
              color="rgba(226, 239, 255, 0.52)"
            />
            <BoxShadow
              dx={0}
              dy={0}
              blur={50}
              color="rgba(226, 239, 255, 0.24)"
              inner
            />
          </Box>
        </Canvas>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(255, 255, 255, 0.16)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.topHairline,
          { left: hairlineInset, right: hairlineInset },
        ]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.52,
    shadowRadius: 22,
    elevation: 12,
  },
  webShadow: {
    // @ts-ignore boxShadow existe en react-native-web
    boxShadow:
      '0 0 50px 0px rgba(226, 239, 255, 0.52), inset 0 0 90px 0px rgba(226, 239, 255, 0.24)',
    color: '#FFFFFF',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    height: 1,
    zIndex: 3,
  },
});
