import React, { memo, useState } from 'react';
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
import type { LiquidMetalShaderConfig } from './liquid-metal/types';
import { fuentes } from '../constantes/colores';
import { vibrarBoton } from '../utils/haptics';

export interface LiquidMetalButtonProps {
  /** Texto del botón */
  titulo?: string;
  /** Contenido libre */
  children?: React.ReactNode;
  /** Acción al presionar */
  onPress?: () => void;
  /** Estado deshabilitado */
  disabled?: boolean;
  /** Pausa la animación del metal (por ejemplo, con un modal cerrado). */
  activo?: boolean;
  /** Icono opcional en la parte izquierda */
  icon?: React.ReactNode;
  /** Ancho del borde metálico líquido en píxeles (default de VengeanceUI: 4) */
  borderWidth?: number;
  /** Tamaño del botón */
  tamano?: 'normal' | 'compacto' | 'lg';
  /** Alto explícito del botón. Si se omite, se usa el alto de `tamano`. */
  height?: number;
  /** Radio de borde explícito. Si se omite, se usa una cápsula (alto / 2). */
  borderRadius?: number;
  /** Configuración personalizada del shader de metal */
  metalConfig?: LiquidMetalShaderConfig;
  /** Etiqueta accesible. Si se omite, se usa `titulo`. */
  accessibilityLabel?: string;
  /** Estilo contenedor */
  style?: StyleProp<ViewStyle>;
}

export const LiquidMetalButton = memo(function LiquidMetalButton({
  titulo,
  children,
  onPress,
  disabled = false,
  activo = true,
  icon,
  borderWidth = 4,
  tamano = 'normal',
  height,
  borderRadius,
  metalConfig,
  accessibilityLabel,
  style,
}: LiquidMetalButtonProps) {
  const [dimensiones, setDimensiones] = useState({ ancho: 0, alto: 0 });
  const presionado = useSharedValue(0);

  const altoDefecto =
    height ?? (tamano === 'compacto' ? 44 : tamano === 'lg' ? 56 : 52);
  const altoFinal = dimensiones.alto > 0 ? dimensiones.alto : altoDefecto;
  const radioBorde = borderRadius ?? altoFinal / 2;

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.025 * presionado.value }],
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensiones({ ancho: width, alto: height });
    }
  };

  const handlePressIn = () => {
    presionado.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    presionado.value = withTiming(0, { duration: 160 });
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
        accessibilityLabel={accessibilityLabel ?? titulo}
        accessibilityState={{ disabled }}
        style={[
          styles.pressableWrapper,
          {
            height: altoDefecto,
            borderRadius: radioBorde,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {/* CAPA DE SHADER DE METAL LÍQUIDO 100% VENGEANCE UI */}
        <LiquidMetalShader
          width={dimensiones.ancho}
          height={altoFinal}
          borderRadius={radioBorde}
          borderWidth={borderWidth}
          colorBack={metalConfig?.colorBack}
          colorTint={metalConfig?.colorTint}
          speed={metalConfig?.speed}
          repetition={metalConfig?.repetition}
          distortion={metalConfig?.distortion}
          softness={metalConfig?.softness}
          shiftRed={metalConfig?.shiftRed}
          shiftBlue={metalConfig?.shiftBlue}
          angle={metalConfig?.angle}
          contour={metalConfig?.contour}
          activo={activo && !disabled}
        />

        {/* CUERPO INTERIOR DEL BOTÓN (Estilo Dark VengeanceUI: bg-black / obsidiana) */}
        <View
          style={[
            styles.cuerpoInterior,
            {
              top: borderWidth,
              left: borderWidth,
              right: borderWidth,
              bottom: borderWidth,
              borderRadius: Math.max(0, radioBorde - borderWidth),
              paddingHorizontal: tamano === 'compacto' ? 14 : 22,
            },
          ]}
        >
          {icon && (
            <View style={styles.iconChip}>
              {icon}
            </View>
          )}

          {titulo ? (
            <Text
              style={[
                styles.tituloTexto,
                tamano === 'compacto' && styles.tituloTextoCompacto,
                tamano === 'lg' && styles.tituloTextoLg,
              ]}
            >
              {titulo}
            </Text>
          ) : (
            children
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

LiquidMetalButton.displayName = 'LiquidMetalButton';

export default LiquidMetalButton;

const styles = StyleSheet.create({
  contenedorBase: {
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  pressableWrapper: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer' as any,
  },
  cuerpoInterior: {
    position: 'absolute',
    backgroundColor: '#05070B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  tituloTextoCompacto: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tituloTextoLg: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
