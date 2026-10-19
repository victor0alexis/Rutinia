import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LiquidMetalShader from './liquid-metal/LiquidMetalShader';
import { fuentes } from '../constants/colores';
import { vibrarBoton } from '../utils/haptics';

export interface LiquidMetalButtonProps {
  /** Texto del botón */
  titulo: string;
  /** Acción al presionar */
  onPress?: () => void;
  /** Estado deshabilitado */
  disabled?: boolean;
  /** Icono opcional en la parte izquierda */
  icon?: React.ReactNode;
  /** Ancho del borde metálico líquido en píxeles (default: 3) */
  borderWidth?: number;
  /** Tamaño del botón */
  tamano?: 'normal' | 'compacto';
  /** Configuración personalizada del shader de metal */
  metalConfig?: {
    colorBack?: string;
    colorTint?: string;
    speed?: number;
    repetition?: number;
    distortion?: number;
  };
  /** Estilo contenedor */
  style?: StyleProp<ViewStyle>;
}

export default function LiquidMetalButton({
  titulo,
  onPress,
  disabled = false,
  icon,
  borderWidth = 3,
  tamano = 'normal',
  metalConfig,
  style,
}: LiquidMetalButtonProps) {
  const [dimensiones, setDimensiones] = useState({ ancho: 0, alto: 0 });
  const presionado = useSharedValue(0);

  const altoDefecto = tamano === 'compacto' ? 42 : 52;
  const altoFinal = dimensiones.alto > 0 ? dimensiones.alto : altoDefecto;
  const borderRadius = altoFinal / 2;

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.03 * presionado.value }],
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensiones({ ancho: width, alto: height });
    }
  };

  const handlePressIn = () => {
    presionado.value = withSpring(1, { damping: 18, stiffness: 300 });
  };

  const handlePressOut = () => {
    presionado.value = withTiming(0, { duration: 180 });
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    vibrarBoton(15);
    onPress();
  };

  return (
    <Animated.View style={[styles.contenedorBase, estiloAnimado, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={handleLayout}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
          styles.pressableWrapper,
          {
            height: altoDefecto,
            borderRadius,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {/* CAPA DE SHADER DE METAL LÍQUIDO (FONDO Y BORDE) */}
        {dimensiones.ancho > 0 && (
          <LiquidMetalShader
            width={dimensiones.ancho}
            height={altoFinal}
            borderRadius={borderRadius}
            colorBack={metalConfig?.colorBack ?? '#121520'}
            colorTint={metalConfig?.colorTint ?? '#FFFFFF'}
            speed={metalConfig?.speed ?? 0.5}
            repetition={metalConfig?.repetition ?? 4.0}
            distortion={metalConfig?.distortion ?? 0.16}
          />
        )}

        {/* CUERPO INTERIOR OBSIDIANA / VIDRIO OSCURO */}
        <View
          style={[
            styles.cuerpoInterior,
            {
              top: borderWidth,
              left: borderWidth,
              right: borderWidth,
              bottom: borderWidth,
              borderRadius: Math.max(0, borderRadius - borderWidth),
              paddingHorizontal: tamano === 'compacto' ? 14 : 20,
            },
          ]}
        >
          {icon && (
            <View style={styles.iconChip}>
              {icon}
            </View>
          )}

          <Text style={[styles.tituloTexto, tamano === 'compacto' && styles.tituloTextoCompacto]}>
            {titulo}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedorBase: {
    alignSelf: 'stretch',
    shadowColor: '#7CF3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  pressableWrapper: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer' as any,
  },
  cuerpoInterior: {
    position: 'absolute',
    backgroundColor: 'rgba(12, 14, 22, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tituloTexto: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tituloTextoCompacto: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
