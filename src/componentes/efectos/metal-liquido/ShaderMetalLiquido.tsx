import { memo, useEffect, useMemo } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Fill,
  Group,
  RoundedRect,
  Shader,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import {
  LIQUID_METAL_DEFAULTS,
  type LiquidMetalShaderProps,
} from './types';
import { LIQUID_METAL_SKSL, parseColorToRGBA } from './metalLiquidoSkSL';

/** Paleta de respaldo si el RuntimeEffect no puede compilarse. */
const CHROMATIC_METAL_COLORS = [
  '#FFFFFF',
  '#888888',
  '#E2E8F0',
  '#FFFFFF',
  '#67E8F9',
  '#C084FC',
  '#F472B6',
  '#FFFFFF',
  '#64748B',
  '#94A3B8',
  '#FFFFFF',
];

// El shader es idéntico para todas las instancias: compilarlo una sola vez
// evita trabajo duplicado cuando el dock y el modal están montados a la vez.
let efectoCache: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;

function obtenerEfecto() {
  if (efectoCache === undefined) {
    efectoCache = Skia.RuntimeEffect.Make(LIQUID_METAL_SKSL);
  }
  return efectoCache;
}

const LiquidMetalShaderNative = memo(function LiquidMetalShaderNative({
  colorBack = LIQUID_METAL_DEFAULTS.colorBack,
  colorTint = LIQUID_METAL_DEFAULTS.colorTint,
  speed = LIQUID_METAL_DEFAULTS.speed,
  repetition = LIQUID_METAL_DEFAULTS.repetition,
  distortion = LIQUID_METAL_DEFAULTS.distortion,
  softness = LIQUID_METAL_DEFAULTS.softness,
  shiftRed = LIQUID_METAL_DEFAULTS.shiftRed,
  shiftBlue = LIQUID_METAL_DEFAULTS.shiftBlue,
  angle = LIQUID_METAL_DEFAULTS.angle,
  contour = LIQUID_METAL_DEFAULTS.contour,
  borderWidth = 4,
  borderRadius = LIQUID_METAL_DEFAULTS.borderRadius,
  width = 0,
  height = 0,
  activo = true,
}: LiquidMetalShaderProps) {
  const radio = Math.min(borderRadius, Math.min(width, height) / 2);
  const dpr = PixelRatio.get();

  const effect = obtenerEfecto();

  useEffect(() => {
    if (!effect && __DEV__) {
      console.warn(
        '[LiquidMetalShader] No se pudo compilar el shader SkSL; se usará el degradado de respaldo.'
      );
    }
  }, [effect]);

  const colorBackRGBA = useMemo(
    () => parseColorToRGBA(colorBack),
    [colorBack]
  );
  const colorTintRGBA = useMemo(
    () => parseColorToRGBA(colorTint),
    [colorTint]
  );

  // Tiempo acumulado en segundos. Solo avanza mientras el shader está activo,
  // así que pausar no reinicia la animación ni salta de frame.
  const tiempo = useSharedValue(0);
  const velocidad = useSharedValue(speed);

  useEffect(() => {
    velocidad.value = speed;
  }, [speed, velocidad]);

  const reduceMotion = useReducedMotion();
  const animar = activo && !reduceMotion && speed !== 0;

  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    // Limitamos el delta para evitar saltos al volver de segundo plano o de
    // una pausa larga.
    const delta = Math.min(frame.timeSincePreviousFrame ?? 16.6667, 50);
    tiempo.value += (delta / 1000) * velocidad.value;
  }, false);

  useEffect(() => {
    frameCallback.setActive(animar);
    return () => frameCallback.setActive(false);
  }, [animar, frameCallback]);

  const uniforms = useDerivedValue(() => ({
    u_resolution: [width, height],
    u_pixelRatio: dpr,
    u_time: tiempo.value,
    u_colorBack: colorBackRGBA,
    u_colorTint: colorTintRGBA,
    u_softness: softness,
    u_repetition: repetition,
    u_shiftRed: shiftRed,
    u_shiftBlue: shiftBlue,
    u_distortion: distortion,
    u_contour: contour,
    u_angle: angle,
  }));

  const clip = useMemo(
    () =>
      Skia.RRectXY(
        Skia.XYWHRect(0, 0, width, height),
        radio,
        radio
      ),
    [width, height, radio]
  );

  // Recorta el shader al anillo visible. Se solapa 0.5px bajo el cuerpo
  // interior para evitar costuras por antialiasing en las esquinas.
  const innerInset = borderWidth > 0 ? borderWidth + 0.5 : 0;
  const innerClip = useMemo(() => {
    const innerRadio = Math.max(0, radio - innerInset);
    return Skia.RRectXY(
      Skia.XYWHRect(
        innerInset,
        innerInset,
        Math.max(0, width - innerInset * 2),
        Math.max(0, height - innerInset * 2)
      ),
      innerRadio,
      innerRadio
    );
  }, [width, height, radio, innerInset]);

  if (width <= 0 || height <= 0) {
    return null;
  }

  if (!effect) {
    return (
      <View
        pointerEvents="none"
        style={[styles.contenedor, { borderRadius }]}
      >
        <Canvas style={{ width, height }}>
          <RoundedRect x={0} y={0} width={width} height={height} r={radio}>
            <SweepGradient
              c={vec(width / 2, height / 2)}
              colors={CHROMATIC_METAL_COLORS}
            />
          </RoundedRect>
        </Canvas>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.contenedor, { borderRadius }]}
    >
      <Canvas style={{ width, height }}>
        <Group clip={clip}>
          <Group clip={innerClip} invertClip={borderWidth > 0}>
            <Fill>
              <Shader source={effect} uniforms={uniforms} />
            </Fill>
          </Group>
        </Group>
      </Canvas>
    </View>
  );
});

LiquidMetalShaderNative.displayName = 'LiquidMetalShaderNative';

export default LiquidMetalShaderNative;

const styles = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
