/* eslint-disable react-hooks/immutability */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addWeeks, isSameDay } from 'date-fns';
import { fuentes, noir } from '../../constantes/colores';
import { Registro } from '../../tipos';
import { aISO, diasDeSemana, nombreDia } from '../../utilidades/fechas';
import { vibrarBoton } from '../../utilidades/hapticos';
import { useLayout } from '../../hooks/useLayout';

export interface Semana3DCarouselProps {
  fechaReferencia: Date;
  diaActivo: Date;
  registros: Registro[];
  onCambiarDia: (dia: Date) => void;
  onCambiarSemana: (semana: Date) => void;
}

const NUM_DIAS = 7;
const STEP = 360 / NUM_DIAS; // ~51.428 grados por día
const SNAP_SPRING = {
  damping: 24,
  stiffness: 140,
  mass: 0.7,
} as const;

export default function CarruselSemana3D({
  fechaReferencia,
  diaActivo,
  registros,
  onCambiarDia,
  onCambiarSemana,
}: Semana3DCarouselProps) {
  const { isCompact } = useLayout();
  const [containerWidth, setContainerWidth] = useState(350);

  const dias = useMemo(() => diasDeSemana(fechaReferencia), [fechaReferencia]);

  // Encontrar el índice del día activo dentro de los 7 días (0 a 6)
  const activeDayIndex = useMemo(() => {
    const idx = dias.findIndex((d) => isSameDay(d, diaActivo));
    return idx >= 0 ? idx : 0;
  }, [dias, diaActivo]);

  // Sensibilidad táctil: ~40px de arrastre equivale a 1 día
  const degreesPerPixel = STEP / 40;

  const rotation = useSharedValue<number>(-activeDayIndex * STEP);
  const dragOrigin = useSharedValue<number>(-activeDayIndex * STEP);

  const isDragging = useSharedValue(false);

  // Sincronizar rotación cuando cambia externamente el día activo
  useEffect(() => {
    if (isDragging.value) return;
    const currentRot = rotation.value;
    const baseTarget = -activeDayIndex * STEP;
    // Tomar siempre la ruta de rotación angular más corta en [-180, 180]
    const diff = ((((baseTarget - currentRot) % 360) + 540) % 360) - 180;
    const targetRot = currentRot + diff;
    rotation.value = withSpring(targetRot, SNAP_SPRING);
  }, [activeDayIndex, rotation, isDragging]);

  const handleIndexChangeFromWorklet = useCallback(
    (index: number) => {
      if (index >= 0 && index < dias.length) {
        const targetDia = dias[index];
        if (!isSameDay(targetDia, diaActivo)) {
          vibrarBoton();
          onCambiarDia(targetDia);
        }
      }
    },
    [dias, diaActivo, onCambiarDia]
  );

  // Reacción al rotar el cilindro para detectar el día que queda al frente
  useAnimatedReaction(
    () => {
      const idx = Math.round(-rotation.value / STEP) % NUM_DIAS;
      return idx < 0 ? idx + NUM_DIAS : idx;
    },
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(handleIndexChangeFromWorklet)(current);
      }
    },
    [handleIndexChangeFromWorklet]
  );

  // Gestor de arrastre táctil (Drag & Snap) con inercia y física de ReactICX
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .onBegin(() => {
          isDragging.value = true;
          cancelAnimation(rotation);
          dragOrigin.value = rotation.value;
        })
        .onUpdate((event) => {
          rotation.value = dragOrigin.value + event.translationX * degreesPerPixel;
        })
        .onEnd((event) => {
          const velocity = event.velocityX * degreesPerPixel;
          const projected = rotation.value + velocity * 0.28;
          const snapped = Math.round(projected / STEP) * STEP;
          rotation.value = withSpring(
            snapped,
            {
              ...SNAP_SPRING,
              velocity,
            },
            () => {
              isDragging.value = false;
            }
          );
        }),
    [degreesPerPixel, rotation, dragOrigin, isDragging]
  );

  const irSemanaAnterior = () => {
    vibrarBoton();
    const prev = addWeeks(fechaReferencia, -1);
    onCambiarSemana(prev);
    onCambiarDia(addWeeks(diaActivo, -1));
  };

  const irSemanaSiguiente = () => {
    vibrarBoton();
    const next = addWeeks(fechaReferencia, 1);
    onCambiarSemana(next);
    onCambiarDia(addWeeks(diaActivo, 1));
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setContainerWidth(width);
  };

  const maxSpan = Math.min(Math.max(containerWidth - 84, 220) * 0.46, 128);
  const cardWidth = isCompact ? 40 : 44;
  const cardHeight = isCompact ? 54 : 58;

  return (
    <View style={styles.outerContainer} onLayout={handleLayout}>
      {/* Carrusel 3D Cilíndrico de Días con Flechas en los Extremos */}
      <View style={styles.carouselRow}>
        {/* Flecha Extremo Izquierdo: Semana Anterior */}
        <Pressable
          onPress={irSemanaAnterior}
          style={({ pressed }) => [
            styles.navArrowButton,
            pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
          ]}
          hitSlop={12}
          accessibilityLabel="Semana anterior"
        >
          <Ionicons name="chevron-back" size={18} color={noir.platinum} />
        </Pressable>

        {/* Carrusel Cilíndrico de Días (Área de Gestos con los 7 días visibles) */}
        <GestureDetector gesture={panGesture}>
          <View style={[styles.cylinderStage, { height: cardHeight + 14 }]}>
            {dias.map((d, index) => {
              const esHoy = isSameDay(d, new Date());
              const esSel = isSameDay(d, diaActivo);
              const regsDia = registros.filter((r) => r.fecha === aISO(d));
              const ejsAll = regsDia.flatMap((r) => r.ejercicios_registro || []);
              const ejsPuros = ejsAll.filter((e) => !e.nombre.startsWith('📌'));
              const notas = ejsAll.filter((e) => e.nombre.startsWith('📌'));
              const completo = ejsPuros.length > 0 && ejsPuros.every((e) => e.completado);

              return (
                <Carousel3DDayFace
                  key={aISO(d)}
                  index={index}
                  date={d}
                  esHoy={esHoy}
                  esSel={esSel}
                  completo={completo}
                  tieneEjercicios={ejsPuros.length > 0}
                  tieneNotas={notas.length > 0}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  rotation={rotation}
                  maxSpan={maxSpan}
                  onPress={() => {
                    vibrarBoton();
                    const currentRot = rotation.value;
                    const baseTarget = -index * STEP;
                    const diff = ((((baseTarget - currentRot) % 360) + 540) % 360) - 180;
                    rotation.value = withSpring(currentRot + diff, SNAP_SPRING);
                    onCambiarDia(d);
                  }}
                />
              );
            })}
          </View>
        </GestureDetector>

        {/* Flecha Extremo Derecho: Semana Siguiente */}
        <Pressable
          onPress={irSemanaSiguiente}
          style={({ pressed }) => [
            styles.navArrowButton,
            pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
          ]}
          hitSlop={12}
          accessibilityLabel="Semana siguiente"
        >
          <Ionicons name="chevron-forward" size={18} color={noir.platinum} />
        </Pressable>
      </View>
    </View>
  );
}

interface Carousel3DDayFaceProps {
  index: number;
  date: Date;
  esHoy: boolean;
  esSel: boolean;
  completo: boolean;
  tieneEjercicios: boolean;
  tieneNotas: boolean;
  cardWidth: number;
  cardHeight: number;
  rotation: SharedValue<number>;
  maxSpan: number;
  onPress: () => void;
}

function Carousel3DDayFace({
  index,
  date,
  esHoy,
  esSel,
  completo,
  tieneEjercicios,
  tieneNotas,
  cardWidth,
  cardHeight,
  rotation,
  maxSpan,
  onPress,
}: Carousel3DDayFaceProps) {
  const animatedFaceStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = rotation.value + index * STEP;
    // Normalizar ángulo relativo al frente [-180, 180]
    const norm = ((((angle % 360) + 540) % 360) - 180);
    const absNorm = Math.abs(norm);
    const sign = norm >= 0 ? 1 : -1;

    // Desplazamiento horizontal para que los 7 días estén siempre visibles y apreciables:
    // norm = 0   (día activo al centro): translateX = 0
    // norm = 51° (±1 día vecino): translateX = ±35% de maxSpan (~42px)
    // norm = 103° (±2 días): translateX = ±68% de maxSpan (~82px)
    // norm = 154° (±3 días bordes): translateX = ±96% de maxSpan (~118px)
    const translateX = sign * interpolate(
      absNorm,
      [0, 51.43, 102.86, 154.29, 180],
      [0, maxSpan * 0.35, maxSpan * 0.68, maxSpan * 0.96, maxSpan * 1.02],
      Extrapolation.CLAMP
    );

    // Escala armónica: 1.08x al frente, descendiendo progresivamente
    const scale = interpolate(
      absNorm,
      [0, 51.43, 102.86, 154.29, 180],
      [1.08, 0.88, 0.78, 0.70, 0.65],
      Extrapolation.CLAMP
    );

    // Opacidad: visibilidad clara para todos los 7 días
    const opacity = interpolate(
      absNorm,
      [0, 51.43, 102.86, 154.29, 180],
      [1, 0.85, 0.68, 0.52, 0.38],
      Extrapolation.CLAMP
    );

    // Rotación 3D en el eje Y siguiendo la curvatura
    const rotateY = `${sign * Math.min(absNorm * 0.28, 38)}deg`;
    const translateY = interpolate(
      absNorm,
      [0, 51.43],
      [-2, 0],
      Extrapolation.CLAMP
    );

    // zIndex: la tarjeta más cercana al centro siempre tiene prioridad de capa
    const zIndex = Math.round(200 - absNorm);

    return {
      opacity,
      zIndex,
      transform: [
        { perspective: 700 },
        { translateX },
        { translateY },
        { rotateY },
        { scale },
      ],
    };
  }, [index, maxSpan]);

  return (
    <Animated.View
      style={[
        styles.faceItem,
        {
          width: cardWidth,
          height: cardHeight,
          marginLeft: -cardWidth / 2,
        },
        animatedFaceStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.dayPill,
          esSel
            ? styles.dayPillSelected
            : esHoy
            ? styles.dayPillToday
            : styles.dayPillNormal,
          pressed && { opacity: 0.82 },
        ]}
      >
        {esSel && (
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
          />
        )}

        <Text
          style={[
            styles.dayShortName,
            {
              color: esSel
                ? 'rgba(9, 12, 18, 0.56)'
                : esHoy
                ? noir.info
                : noir.muted,
            },
          ]}
        >
          {nombreDia(date).substring(0, 3)}
        </Text>

        <Text
          style={[
            styles.dayNumber,
            { color: esSel ? '#090B0F' : '#F0F3F8' },
          ]}
        >
          {date.getDate()}
        </Text>

        {/* Indicadores de estado en vivo */}
        <View style={styles.dotsRow}>
          {completo ? (
            <Ionicons
              name="checkmark-circle"
              size={9}
              color={esSel ? 'rgba(9, 12, 18, 0.62)' : noir.mint}
            />
          ) : tieneEjercicios ? (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: esSel
                    ? 'rgba(9, 12, 18, 0.62)'
                    : noir.info,
                },
              ]}
            />
          ) : null}
          {tieneNotas && (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: esSel
                    ? 'rgba(9, 12, 18, 0.62)'
                    : noir.champagne,
                },
              ]}
            />
          )}
          {!completo && !tieneEjercicios && !tieneNotas && (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: esSel
                    ? 'rgba(9, 12, 18, 0.45)'
                    : 'rgba(255, 255, 255, 0.16)',
                },
              ]}
            />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#121215',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: noir.line,
    paddingVertical: 7,
    paddingHorizontal: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 11,
    elevation: 6,
  },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  navArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: noir.line,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  cylinderStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  faceItem: {
    position: 'absolute',
    top: 6,
    left: '50%',
  },
  dayPill: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderWidth: 1,
    gap: 2,
  },
  dayPillNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: noir.line,
  },
  dayPillToday: {
    backgroundColor: 'rgba(92, 200, 255, 0.16)',
    borderColor: noir.info,
  },
  dayPillSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    // @ts-ignore
    boxShadow:
      '0 9px 23px rgba(206, 225, 247, 0.25), 0 0 18px rgba(240, 248, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  dayShortName: {
    fontSize: 8,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.64,
  },
  dayNumber: {
    fontSize: 14,
    fontFamily: fuentes.extraBold,
    letterSpacing: -0.28,
  },
  dotsRow: {
    height: 5,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
});
