import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tema } from '../constants/tema';

const PAD = 16;

const TORNASOL_COLORS = [
  'rgba(124,243,255,0)',
  'rgba(124,243,255,0)',
  '#7CF3FF',
  '#A78BFA',
  '#FF8AD8',
  '#FFE3C2',
  '#FFFFFF',
  'rgba(255,255,255,0)',
];

const TORNASOL_POSITIONS = [0, 0.40, 0.56, 0.70, 0.82, 0.92, 0.97, 1];

type Props = {
  titulo: string;
  onPress?: () => void;
  disabled?: boolean;
  tamano?: 'normal' | 'compacto';
  variante?: 'principal' | 'secundario' | 'peligro';
  style?: StyleProp<ViewStyle>;
};

export default function BotonRutinia({
  titulo,
  onPress,
  disabled,
  tamano = 'normal',
  variante = 'principal',
  style,
}: Props) {
  const esPrincipal = variante === 'principal';
  const esSecundario = variante === 'secundario';
  const esPeligro = variante === 'peligro';

  let alto = tamano === 'compacto' ? 40 : 52;
  if (!esPrincipal) {
    alto = tamano === 'compacto' ? 38 : 46;
  }

  const [ancho, setAncho] = useState(0);
  const progreso = useSharedValue(0);
  const presionado = useSharedValue(0);
  const fadeIn = useSharedValue(0);
  const reducir = useReducedMotion();

  // Animación de Giro y Fade-in de arranque sin tirón
  useEffect(() => {
    if (!esPrincipal || disabled || ancho === 0) {
      cancelAnimation(progreso);
      fadeIn.value = 0;
      return;
    }

    // Fade-in inicial de opacidad de las capas 2 y 3 en 350 ms
    fadeIn.value = withTiming(1, { duration: 350 });

    if (reducir) {
      cancelAnimation(progreso);
      progreso.value = 0.5; // Anillo estático detenido en la parte baja
      return;
    }

    // Iniciar el giro continuo 0 a 1 con withRepeat en Hilo de UI
    progreso.value = 0;
    progreso.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.vueltaBotonMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(progreso);
    };
  }, [esPrincipal, disabled, ancho, reducir, fadeIn, progreso]);

  // Escala en toque con spring
  const estiloEscala = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.03 * presionado.value }],
  }));

  // Centro para las transformaciones en Skia
  const cx = PAD + ancho / 2;
  const cy = PAD + alto / 2;

  // Transformación de rotación alrededor del centro del botón
  const transRotacion = useDerivedValue(() => {
    const angulo = reducir ? Math.PI * 0.5 : progreso.value * Math.PI * 2;
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: angulo },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  // Opacidad del halo (sube a 1 al presionar, fade-in al montar)
  const haloOpacityAnim = useDerivedValue(() => {
    const baseOpacity = 0.6 * fadeIn.value;
    return baseOpacity + (1 - baseOpacity) * presionado.value;
  });

  // Opacidad del anillo nítido
  const ringOpacityAnim = useDerivedValue(() => {
    return 1 * fadeIn.value;
  });

  // Colores y fondo según variante
  let fondoColor = 'rgba(14, 12, 24, 0.62)';
  let textoColor = '#FFFFFF';

  if (esSecundario) {
    fondoColor = 'rgba(14, 12, 24, 0.62)';
    textoColor = '#E6E4F0';
  } else if (esPeligro) {
    fondoColor = 'rgba(240, 86, 110, 0.08)';
    textoColor = '#F58A9B';
  }

  return (
    <Animated.View style={[{ alignSelf: 'flex-start' }, estiloEscala, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          presionado.value = withSpring(1, { damping: 18, stiffness: 300 });
        }}
        onPressOut={() => {
          presionado.value = withTiming(0, { duration: 200 });
        }}
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={{
          width: '100%',
          height: alto,
          borderRadius: alto / 2,
          paddingHorizontal: tamano === 'compacto' ? 18 : tema.medidas.margenLateral,
          backgroundColor: fondoColor,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          borderWidth: esPeligro ? 1 : 0,
          borderColor: esPeligro ? 'rgba(240, 86, 110, 0.45)' : undefined,
        }}
      >
        {/* SKIA CANVAS PARA VARIANTE PRINCIPAL */}
        {esPrincipal && ancho > 0 && (
          <Canvas
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -PAD,
              top: -PAD,
              width: ancho + PAD * 2,
              height: alto + PAD * 2,
            }}
          >
            {/* Capa 1: Borde Base tenue */}
            <RoundedRect
              x={PAD}
              y={PAD}
              width={ancho}
              height={alto}
              r={alto / 2}
              style="stroke"
              strokeWidth={1.5}
              color="rgba(167, 139, 250, 0.28)"
            />

            {/* Capas 2 y 3 (Animadas, omitidas si disabled) */}
            {!disabled && (
              <>
                {/* Capa 2: Halo de Resplandor Difuminado */}
                <Group opacity={haloOpacityAnim} transform={transRotacion}>
                  <RoundedRect
                    x={PAD}
                    y={PAD}
                    width={ancho}
                    height={alto}
                    r={alto / 2}
                    style="stroke"
                    strokeWidth={6}
                  >
                    <SweepGradient
                      c={vec(cx, cy)}
                      colors={TORNASOL_COLORS}
                      positions={TORNASOL_POSITIONS}
                    />
                    <BlurMask blur={8} style="normal" />
                  </RoundedRect>
                </Group>

                {/* Capa 3: Anillo Nítido */}
                <Group opacity={ringOpacityAnim} transform={transRotacion}>
                  <RoundedRect
                    x={PAD}
                    y={PAD}
                    width={ancho}
                    height={alto}
                    r={alto / 2}
                    style="stroke"
                    strokeWidth={2}
                  >
                    <SweepGradient
                      c={vec(cx, cy)}
                      colors={TORNASOL_COLORS}
                      positions={TORNASOL_POSITIONS}
                    />
                  </RoundedRect>
                </Group>
              </>
            )}
          </Canvas>
        )}

        {/* SKIA CANVAS PARA VARIANTE SECUNDARIO (Píldora con borde degradado lineal estático) */}
        {esSecundario && ancho > 0 && (
          <Canvas
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: ancho,
              height: alto,
            }}
          >
            <RoundedRect
              x={0}
              y={0}
              width={ancho}
              height={alto}
              r={alto / 2}
              style="stroke"
              strokeWidth={1.5}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(ancho, alto)}
                colors={[
                  'rgba(34, 213, 238, 0.5)',
                  'rgba(139, 92, 246, 0.5)',
                  'rgba(255, 138, 216, 0.5)',
                ]}
              />
            </RoundedRect>
          </Canvas>
        )}

        <Text
          style={{
            color: textoColor,
            fontSize: tamano === 'compacto' ? 14 : 17,
            fontFamily: 'DMSans_400Regular',
            fontWeight: '400',
            letterSpacing: 0.2,
          }}
        >
          {titulo}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
