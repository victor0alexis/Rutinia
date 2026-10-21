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
import { addWeeks, isSameDay, isSameWeek } from 'date-fns';
import { colores, fuentes } from '../constants/colores';
import { Registro } from '../types';
import { aISO, diasDeSemana, nombreDia, rangoSemana } from '../utils/fechas';
import { vibrarBoton } from '../utils/haptics';
import { useLayout } from '../hooks/useLayout';

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

export default function Semana3DCarousel({
  fechaReferencia,
  diaActivo,
  registros,
  onCambiarDia,
  onCambiarSemana,
}: Semana3DCarouselProps) {
  const { isCompact } = useLayout();
  const [containerWidth, setContainerWidth] = useState(340);

  const dias = useMemo(() => diasDeSemana(fechaReferencia), [fechaReferencia]);
  const esSemanaActual = useMemo(
    () => isSameWeek(fechaReferencia, new Date(), { weekStartsOn: 1 }),
    [fechaReferencia]
  );

  // Encontrar el índice del día activo dentro de los 7 días (0 a 6)
  const activeDayIndex = useMemo(() => {
    const idx = dias.findIndex((d) => isSameDay(d, diaActivo));
    return idx >= 0 ? idx : 0;
  }, [dias, diaActivo]);

  // Geometría 3D cilíndrica de ReactICX
  const radius = Math.max(130, containerWidth * 0.42);
  const degreesPerPixel = (180 / (Math.PI * radius)) * 0.95;

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

  const volverAHoy = () => {
    vibrarBoton();
    const hoy = new Date();
    onCambiarSemana(hoy);
    onCambiarDia(hoy);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setContainerWidth(width);
  };

  const cardWidth = isCompact ? 44 : 48;
  const cardHeight = isCompact ? 60 : 66;

  return (
    <View style={styles.outerContainer} onLayout={handleLayout}>
      {/* 1. Header Integrado de Rango de Semana */}
      <View style={styles.topHeaderRow}>
        <Pressable onPress={volverAHoy} style={styles.rangoPressable} hitSlop={8}>
          <View style={styles.rangoInnerRow}>
            <Ionicons name="calendar-outline" size={13} color={colores.primarioHover} />
            <Text style={styles.rangoText}>{rangoSemana(fechaReferencia)}</Text>
          </View>
          {!esSemanaActual ? (
            <View style={styles.subtextSemanaBadge}>
              <Text style={styles.subtextSemanaBadgeText}>• Ir a Semana Actual</Text>
            </View>
          ) : (
            <Text style={styles.subtextSemanaCurrent}>Semana en curso</Text>
          )}
        </Pressable>
      </View>

      {/* 2. Fila del Carrusel 3D con Flechas en los Extremos */}
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
          <Ionicons name="chevron-back" size={18} color={colores.primarioHover} />
        </Pressable>

        {/* Carrusel 3D Cilíndrico de Días (Área de Gestos) */}
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
                  radius={radius}
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
          <Ionicons name="chevron-forward" size={18} color={colores.primarioHover} />
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
  radius: number;
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
  radius,
  onPress,
}: Carousel3DDayFaceProps) {
  const animatedFaceStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = rotation.value + index * STEP;
    // Normalizar ángulo relativo al frente [-180, 180]
    const norm = ((((angle % 360) + 540) % 360) - 180);
    const radians = (norm * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Traslación cilíndrica horizontal
    const translateX = sin * radius;

    // Escala según profundidad (1.06x al frente, ~0.84x a los costados)
    const scale = interpolate(
      cos,
      [0, 0.5, 1],
      [0.75, 0.88, 1.05],
      Extrapolation.CLAMP
    );

    // Opacidad: visibilidad frontal limpia; desvanecer completamente en la parte posterior
    const opacity = interpolate(
      cos,
      [0.15, 0.5, 1],
      [0, 0.65, 1],
      Extrapolation.CLAMP
    );

    // Rotación 3D en el eje Y siguiendo la curvatura cilíndrica
    const rotateY = `${norm * 0.72}deg`;

    return {
      opacity,
      zIndex: Math.round(cos * 100) + 100,
      transform: [
        { perspective: 700 },
        { translateX },
        { rotateY },
        { scale },
      ],
    };
  }, [index, radius]);

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
        <Text
          style={[
            styles.dayShortName,
            { color: esSel ? '#FFFFFF' : esHoy ? colores.hoy : colores.suave },
          ]}
        >
          {nombreDia(date).substring(0, 3)}
        </Text>

        <Text
          style={[
            styles.dayNumber,
            { color: esSel ? '#FFFFFF' : colores.texto },
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
              color={esSel ? '#FFFFFF' : colores.exito}
            />
          ) : tieneEjercicios ? (
            <View
              style={[
                styles.statusDot,
                { backgroundColor: esSel ? '#FFFFFF' : colores.primarioHover },
              ]}
            />
          ) : null}
          {tieneNotas && (
            <View
              style={[
                styles.statusDot,
                { backgroundColor: esSel ? '#FFFFFF' : colores.hoy },
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  topHeaderRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangoPressable: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  rangoInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangoText: {
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    color: colores.texto,
    letterSpacing: -0.2,
  },
  subtextSemanaCurrent: {
    fontSize: 10,
    color: colores.suave,
    fontFamily: fuentes.medium,
    marginTop: 1,
  },
  subtextSemanaBadge: {
    marginTop: 1,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  subtextSemanaBadgeText: {
    fontSize: 9.5,
    color: colores.primarioHover,
    fontFamily: fuentes.bold,
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    paddingVertical: 6,
    borderWidth: 1,
    gap: 2,
  },
  dayPillNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayPillToday: {
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    borderColor: colores.hoy,
  },
  dayPillSelected: {
    backgroundColor: colores.primarioHover,
    borderColor: '#FFFFFF',
    shadowColor: colores.primarioHover,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  dayShortName: {
    fontSize: 9,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 13.5,
    fontFamily: fuentes.black,
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
