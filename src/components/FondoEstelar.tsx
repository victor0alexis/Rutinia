import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Dimensions, Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect as SvgRect,
  Circle as SvgCircle,
  Path as SvgPath,
} from 'react-native-svg';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';
import { tema } from '../constants/tema';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// 28 posiciones deterministas para estrellas
const ESTRELLAS = [
  { x: 30, y: 80, r: 0.8, phase: 0 },
  { x: 120, y: 50, r: 1.1, phase: 0.2 },
  { x: 200, y: 110, r: 0.7, phase: 0.4 },
  { x: 290, y: 40, r: 1.0, phase: 0.6 },
  { x: 350, y: 95, r: 1.2, phase: 0.8 },
  { x: 70, y: 220, r: 0.9, phase: 0.15 },
  { x: 160, y: 180, r: 1.0, phase: 0.35 },
  { x: 250, y: 240, r: 0.7, phase: 0.55 },
  { x: 330, y: 200, r: 1.1, phase: 0.75 },
  { x: 40, y: 340, r: 1.2, phase: 0.05 },
  { x: 110, y: 390, r: 0.8, phase: 0.25 },
  { x: 220, y: 310, r: 1.0, phase: 0.45 },
  { x: 300, y: 370, r: 0.7, phase: 0.65 },
  { x: 380, y: 330, r: 1.1, phase: 0.85 },
  { x: 80, y: 480, r: 0.9, phase: 0.1 },
  { x: 180, y: 450, r: 1.2, phase: 0.3 },
  { x: 270, y: 510, r: 0.8, phase: 0.5 },
  { x: 340, y: 460, r: 1.0, phase: 0.7 },
  { x: 50, y: 610, r: 0.7, phase: 0.9 },
  { x: 140, y: 580, r: 1.1, phase: 0.18 },
  { x: 230, y: 640, r: 0.9, phase: 0.38 },
  { x: 310, y: 590, r: 1.2, phase: 0.58 },
  { x: 90, y: 730, r: 0.8, phase: 0.78 },
  { x: 190, y: 710, r: 1.0, phase: 0.98 },
  { x: 280, y: 760, r: 0.7, phase: 0.22 },
  { x: 360, y: 720, r: 1.1, phase: 0.42 },
  { x: 130, y: 820, r: 0.9, phase: 0.62 },
  { x: 240, y: 800, r: 1.2, phase: 0.82 },
];

// Path base de destello de 4 puntas centrado en (0,0)
const PATH_DESTELLO = 'M 0 -14 Q 0 -3 3 0 Q 0 3 0 14 Q 0 3 -3 0 Q 0 -3 0 -14 Z';

type AcentoEstado = 'vacio' | 'pendiente' | 'completado';

type Props = {
  acento?: AcentoEstado;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const COLO_MAP: Record<AcentoEstado, string> = {
  vacio: tema.acentoEstado.vacio,
  pendiente: tema.acentoEstado.pendiente,
  completado: tema.acentoEstado.completado,
};

function EstrellaItem({
  star,
  parpadeo,
}: {
  star: (typeof ESTRELLAS)[0];
  parpadeo: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => {
    const angle = (parpadeo.value + star.phase) * Math.PI * 2;
    const sinVal = Math.sin(angle);
    return interpolate(sinVal, [-1, 1], [0.12, 0.95]);
  });

  return (
    <Circle
      cx={star.x}
      cy={star.y}
      r={star.r}
      color={tema.fondo.nucleo}
      opacity={opacity}
    />
  );
}

export default function FondoEstelar({ acento = 'vacio', style, children }: Props) {
  const isFocused = useIsFocused();
  const reducirMovimiento = useReducedMotion();
  const [appActive, setAppActive] = useState(true);

  // Escuchar AppState para pausar animaciones en 2do plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setAppActive(nextState === 'active');
    });
    return () => sub.remove();
  }, []);

  const animar = isFocused && appActive && !reducirMovimiento;

  // Derivas de Auroras
  const deriva1 = useSharedValue(0); // Violeta
  const deriva2 = useSharedValue(0); // Cian/Acento
  const deriva3 = useSharedValue(0); // Carmesí

  // Respiro Núcleo
  const respiro = useSharedValue(0);

  // Parpadeo Estrellas
  const parpadeo = useSharedValue(0);

  // Transición de Color Acento
  const colorTarget = useSharedValue(COLO_MAP[acento]);
  const colorPrev = useSharedValue(COLO_MAP[acento]);
  const colorProgreso = useSharedValue(1);

  useEffect(() => {
    colorPrev.value = colorTarget.value;
    colorTarget.value = COLO_MAP[acento];
    colorProgreso.value = 0;
    colorProgreso.value = withTiming(1, { duration: 800 });
  }, [acento, colorPrev, colorTarget, colorProgreso]);

  const acentoColorsAnim = useDerivedValue(() => {
    const col = interpolateColor(
      colorProgreso.value,
      [0, 1],
      [colorPrev.value, colorTarget.value]
    );
    return [col, col, 'rgba(0, 0, 0, 0)'];
  });

  // Efecto para iniciar/pausar animaciones en Hilo de UI
  useEffect(() => {
    if (!animar) {
      cancelAnimation(deriva1);
      cancelAnimation(deriva2);
      cancelAnimation(deriva3);
      cancelAnimation(respiro);
      cancelAnimation(parpadeo);
      return;
    }

    deriva1.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.derivaMs[0],
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    deriva2.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.derivaMs[1],
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    deriva3.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.derivaMs[2],
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    respiro.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.respiroMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    parpadeo.value = withRepeat(
      withTiming(1, {
        duration: tema.animacion.parpadeoMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(deriva1);
      cancelAnimation(deriva2);
      cancelAnimation(deriva3);
      cancelAnimation(respiro);
      cancelAnimation(parpadeo);
    };
  }, [animar, deriva1, deriva2, deriva3, respiro, parpadeo]);

  // Transformaciones derivadas para Native
  const trans1 = useDerivedValue(() => [
    { translateX: deriva1.value * 60 },
    { translateY: 140 + deriva1.value * 50 },
    { scale: 0.9 + deriva1.value * 0.3 },
  ]);

  const trans2 = useDerivedValue(() => [
    { translateX: 370 - deriva2.value * 60 },
    { translateY: 480 + deriva2.value * 50 },
    { scale: 0.9 + deriva2.value * 0.3 },
  ]);

  const trans3 = useDerivedValue(() => [
    { translateX: 60 + deriva3.value * 60 },
    { translateY: 750 - deriva3.value * 50 },
    { scale: 0.9 + deriva3.value * 0.3 },
  ]);

  const nucleoOpacity = useDerivedValue(() => 0.5 + respiro.value * 0.5);

  const destello1Transform = useDerivedValue(() => [
    { translateX: 320 },
    { translateY: 130 },
    { scale: 0.8 + respiro.value * 0.4 },
    { rotate: respiro.value * Math.PI * 0.25 },
  ]);

  const destello2Transform = useDerivedValue(() => [
    { translateX: 100 },
    { translateY: 380 },
    { scale: 0.6 + (1 - respiro.value) * 0.3 },
    { rotate: -respiro.value * Math.PI * 0.3 },
  ]);

  const destello3Transform = useDerivedValue(() => [
    { translateX: 280 },
    { translateY: 680 },
    { scale: 0.7 + respiro.value * 0.3 },
    { rotate: respiro.value * Math.PI * 0.4 },
  ]);

  // Si estamos en WEB, renderizar versión SVG compatible 100% universal
  if (Platform.OS === 'web') {
    return (
      <Animated.View style={[{ flex: 1, backgroundColor: tema.fondo.base }, style]}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadialGradient id="auroraV" cx="0%" cy="15%" r="60%">
              <Stop offset="0%" stopColor="rgba(124, 92, 255, 0.55)" />
              <Stop offset="100%" stopColor="rgba(124, 92, 255, 0)" />
            </SvgRadialGradient>

            <SvgRadialGradient id="auroraA" cx="90%" cy="50%" r="55%">
              <Stop offset="0%" stopColor={COLO_MAP[acento]} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={COLO_MAP[acento]} stopOpacity="0" />
            </SvgRadialGradient>

            <SvgRadialGradient id="auroraC" cx="15%" cy="85%" r="55%">
              <Stop offset="0%" stopColor="rgba(224, 51, 79, 0.32)" />
              <Stop offset="100%" stopColor="rgba(224, 51, 79, 0)" />
            </SvgRadialGradient>

            <SvgRadialGradient id="nucleoG" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="rgba(232, 228, 255, 0.65)" />
              <Stop offset="100%" stopColor="rgba(232, 228, 255, 0)" />
            </SvgRadialGradient>
          </Defs>

          {/* Base */}
          <SvgRect width="100%" height="100%" fill={tema.fondo.base} />

          {/* Auroras */}
          <SvgCircle cx="0" cy="140" r="300" fill="url(#auroraV)" />
          <SvgCircle cx="370" cy="480" r="260" fill="url(#auroraA)" />
          <SvgCircle cx="60" cy="750" r="280" fill="url(#auroraC)" />

          {/* Núcleo Estelar */}
          <SvgCircle cx="320" cy="130" r={110} fill="url(#nucleoG)" opacity={0.8} />

          {/* Destellos */}
          <SvgPath d={PATH_DESTELLO} fill={tema.fondo.nucleo} transform="translate(320, 130) scale(1)" />
          <SvgPath d={PATH_DESTELLO} fill={tema.fondo.nucleo} transform="translate(100, 380) scale(0.7)" />
          <SvgPath d={PATH_DESTELLO} fill={tema.fondo.nucleo} transform="translate(280, 680) scale(0.8)" />

          {/* Estrellas */}
          {ESTRELLAS.map((star, idx) => (
            <SvgCircle key={idx} cx={star.x} cy={star.y} r={star.r} fill={tema.fondo.nucleo} opacity={0.65} />
          ))}
        </Svg>
        {children}
      </Animated.View>
    );
  }

  // Renderizado GPU Skia para NATIVO (iOS / Android / Expo Go)
  return (
    <Animated.View style={[{ flex: 1, backgroundColor: tema.fondo.base }, style]}>
      <Canvas
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SCREEN_W,
          height: SCREEN_H,
        }}
      >
        {/* 1. Base */}
        <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} color={tema.fondo.base} />

        {/* 2. Auroras */}
        <Group transform={trans1}>
          <Circle cx={0} cy={0} r={260}>
            <RadialGradient
              c={vec(0, 0)}
              r={260}
              colors={['rgba(124, 92, 255, 0.55)', 'rgba(124, 92, 255, 0.55)', 'rgba(124, 92, 255, 0)']}
              positions={[0, 0.65, 1]}
            />
          </Circle>
        </Group>

        <Group transform={trans2}>
          <Circle cx={0} cy={0} r={220}>
            <RadialGradient
              c={vec(0, 0)}
              r={220}
              colors={acentoColorsAnim}
              positions={[0, 0.65, 1]}
            />
          </Circle>
        </Group>

        <Group transform={trans3}>
          <Circle cx={0} cy={0} r={230}>
            <RadialGradient
              c={vec(0, 0)}
              r={230}
              colors={['rgba(224, 51, 79, 0.32)', 'rgba(224, 51, 79, 0.32)', 'rgba(224, 51, 79, 0)']}
              positions={[0, 0.65, 1]}
            />
          </Circle>
        </Group>

        {/* 3. Núcleo Estelar y Destellos */}
        <Circle cx={320} cy={130} r={110} opacity={nucleoOpacity}>
          <RadialGradient
            c={vec(320, 130)}
            r={110}
            colors={['rgba(232, 228, 255, 0.65)', 'rgba(232, 228, 255, 0)']}
            positions={[0, 1]}
          />
        </Circle>

        <Group transform={destello1Transform}>
          <Path path={PATH_DESTELLO} color={tema.fondo.nucleo} opacity={nucleoOpacity} />
        </Group>
        <Group transform={destello2Transform}>
          <Path path={PATH_DESTELLO} color={tema.fondo.nucleo} opacity={nucleoOpacity} />
        </Group>
        <Group transform={destello3Transform}>
          <Path path={PATH_DESTELLO} color={tema.fondo.nucleo} opacity={nucleoOpacity} />
        </Group>

        {/* 4. Estrellas */}
        {ESTRELLAS.map((star, idx) => (
          <EstrellaItem key={idx} star={star} parpadeo={parpadeo} />
        ))}
      </Canvas>

      {children}
    </Animated.View>
  );
}
