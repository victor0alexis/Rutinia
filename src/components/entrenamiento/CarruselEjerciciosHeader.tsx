/* eslint-disable react-hooks/immutability */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
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
import { fuentes, noir } from '../../constants/colores';
import { vibrarBoton } from '../../utils/haptics';
import { obtenerGifEjercicio } from '../../services/ejerciciosGifs';
import { useLayout } from '../../hooks/useLayout';
import EjercicioGif from './EjercicioGif';

export interface EjercicioCarruselItem {
  id: string;
  nombre: string;
  completado: boolean;
  totalSeries: number;
  seriesCompletadas: number;
}

interface Props {
  ejercicios: EjercicioCarruselItem[];
  activoIndex: number;
  onSelectEjercicio: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

const SNAP_SPRING = {
  damping: 24,
  stiffness: 140,
  mass: 0.7,
} as const;

/**
 * Carrusel 3D de ejercicios.
 *
 * Reutiliza la mecánica cilíndrica de `Semana3DCarousel`: arrastre con snap,
 * caras con perspectiva, selección blanca perla y estado semántico. En este
 * caso las caras son GIFs anatómicos en modo oscuro en lugar de días.
 */
export default function CarruselEjerciciosHeader({
  ejercicios,
  activoIndex,
  onSelectEjercicio,
  style,
}: Props) {
  const { isCompact } = useLayout();
  const [containerWidth, setContainerWidth] = useState(350);

  const total = ejercicios.length;
  const safeIndex = Math.min(Math.max(activoIndex, 0), Math.max(total - 1, 0));
  // Con 2 ejercicios usamos media vuelta de 120° para que ambos sean visibles.
  const step = total > 1 ? (total === 2 ? 120 : 360 / total) : 0;
  const degreesPerPixel = step > 0 ? step / 40 : 0;

  const rotation = useSharedValue<number>(-safeIndex * step);
  const dragOrigin = useSharedValue<number>(-safeIndex * step);
  const isDragging = useSharedValue(false);

  // Sincroniza la rotación cuando el ejercicio activo cambia desde fuera.
  useEffect(() => {
    if (isDragging.value || step <= 0) return;
    const currentRot = rotation.value;
    const baseTarget = -safeIndex * step;
    const diff = ((((baseTarget - currentRot) % 360) + 540) % 360) - 180;
    rotation.value = withSpring(currentRot + diff, SNAP_SPRING);
  }, [safeIndex, step, rotation, isDragging]);

  const handleIndexChange = useCallback(
    (index: number) => {
      if (index >= 0 && index < total && index !== safeIndex) {
        vibrarBoton();
        onSelectEjercicio(index);
      }
    },
    [safeIndex, total, onSelectEjercicio]
  );

  useAnimatedReaction(
    () => {
      if (step <= 0 || total <= 0) return 0;
      const idx = Math.round(-rotation.value / step) % total;
      return idx < 0 ? idx + total : idx;
    },
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(handleIndexChange)(current);
      }
    },
    [handleIndexChange, step, total]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(step > 0)
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
          if (step <= 0) {
            isDragging.value = false;
            return;
          }
          const velocity = event.velocityX * degreesPerPixel;
          const projected = rotation.value + velocity * 0.28;
          const snapped = Math.round(projected / step) * step;
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
    [degreesPerPixel, dragOrigin, isDragging, rotation, step]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) setContainerWidth(width);
  };

  const irA = (index: number) => {
    if (index < 0 || index >= total) return;
    vibrarBoton();
    const currentRot = rotation.value;
    const baseTarget = -index * step;
    const diff = ((((baseTarget - currentRot) % 360) + 540) % 360) - 180;
    rotation.value = withSpring(currentRot + diff, SNAP_SPRING);
    onSelectEjercicio(index);
  };

  const maxSpan = Math.min(Math.max(containerWidth - 80, 220) * 0.46, 150);
  const cardWidth = isCompact ? 50 : 54;
  const cardHeight = isCompact ? 60 : 64;

  return (
    <View style={[styles.outerContainer, style]} onLayout={handleLayout}>
      <View style={styles.carouselRow}>
        <Pressable
          onPress={() => irA(safeIndex - 1)}
          disabled={safeIndex <= 0}
          style={({ pressed }) => [
            styles.navArrowButton,
            safeIndex <= 0 && styles.navArrowDisabled,
            pressed && safeIndex > 0 && { opacity: 0.65 },
          ]}
          hitSlop={8}
          accessibilityLabel="Ejercicio anterior"
        >
          <Ionicons name="chevron-back" size={13} color={noir.platinum} />
        </Pressable>

        <GestureDetector gesture={panGesture}>
          <View style={[styles.cylinderStage, { height: cardHeight + 16 }]}>
            {total === 0 ? (
              <Text style={styles.emptyText}>Sin ejercicios</Text>
            ) : (
              ejercicios.map((ejercicio, index) => (
                <Carousel3DEjercicioFace
                  key={ejercicio.id || `${ejercicio.nombre}-${index}`}
                  index={index}
                  item={ejercicio}
                  activo={index === safeIndex}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  rotation={rotation}
                  maxSpan={maxSpan}
                  step={step}
                  onPress={() => irA(index)}
                />
              ))
            )}
          </View>
        </GestureDetector>

        <Pressable
          onPress={() => irA(safeIndex + 1)}
          disabled={safeIndex >= total - 1}
          style={({ pressed }) => [
            styles.navArrowButton,
            safeIndex >= total - 1 && styles.navArrowDisabled,
            pressed && safeIndex < total - 1 && { opacity: 0.65 },
          ]}
          hitSlop={8}
          accessibilityLabel="Ejercicio siguiente"
        >
          <Ionicons name="chevron-forward" size={13} color={noir.platinum} />
        </Pressable>
      </View>
    </View>
  );
}

interface FaceProps {
  index: number;
  item: EjercicioCarruselItem;
  activo: boolean;
  cardWidth: number;
  cardHeight: number;
  rotation: SharedValue<number>;
  maxSpan: number;
  step: number;
  onPress: () => void;
}

function Carousel3DEjercicioFace({
  index,
  item,
  activo,
  cardWidth,
  cardHeight,
  rotation,
  maxSpan,
  step,
  onPress,
}: FaceProps) {
  const gifInfo = obtenerGifEjercicio(item.nombre);
  const nombreCorto =
    item.nombre.replace(/^\[U(NILATERAL)?\]\s*/i, '').split(' ')[0] || 'Ej.';
  const completado =
    item.completado || (item.totalSeries > 0 && item.seriesCompletadas >= item.totalSeries);

  const animatedFaceStyle = useAnimatedStyle(() => {
    'worklet';
    if (step <= 0) {
      return {
        opacity: 1,
        zIndex: 200,
        transform: [{ perspective: 700 }],
      };
    }

    const angle = rotation.value + index * step;
    const norm = ((((angle % 360) + 540) % 360) - 180);
    const absNorm = Math.abs(norm);
    const sign = norm >= 0 ? 1 : -1;
    const t = Math.min(absNorm / 180, 1);

    // Distribución curva tipo cilindro: más cerca del centro = más grande.
    const translateX = sign * maxSpan * Math.pow(t, 0.72);
    const scale = interpolate(
      absNorm,
      [0, 180],
      [1.08, 0.62],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      absNorm,
      [0, 90, 150, 180],
      [1, 0.62, 0.22, 0],
      Extrapolation.CLAMP
    );
    const rotateY = `${sign * Math.min(absNorm * 0.28, 38)}deg`;
    const translateY = interpolate(
      absNorm,
      [0, 60],
      [-2, 0],
      Extrapolation.CLAMP
    );
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
  }, [index, maxSpan, step]);

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
          styles.chip,
          activo ? styles.chipActive : styles.chipInactive,
          pressed && { opacity: 0.86 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: activo }}
        accessibilityLabel={`${item.nombre}. ${item.seriesCompletadas} de ${item.totalSeries} series`}
      >
        {activo && (
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
          />
        )}

        <View style={[styles.thumbCircle, activo && styles.thumbCircleActive]}>
          <EjercicioGif
            uri={gifInfo.gifUrl}
            style={styles.thumbImage}
            contentFit="contain"
            animated={false}
          />
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.chipLabel,
            activo ? styles.chipLabelActive : styles.chipLabelInactive,
          ]}
        >
          {nombreCorto}
        </Text>

        <View
          style={[
            styles.statusDot,
            completado
              ? styles.statusDotDone
              : activo
              ? styles.statusDotActive
              : styles.statusDotIdle,
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'rgba(10, 12, 17, 0.86)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    paddingVertical: 4,
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 5,
  },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  navArrowButton: {
    width: 22,
    height: 52,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  navArrowDisabled: {
    opacity: 0.25,
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
    top: 8,
    left: '50%',
  },
  chip: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.032)',
    borderColor: 'rgba(255, 255, 255, 0.065)',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  thumbCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbCircleActive: {
    backgroundColor: '#090B0F',
    borderColor: 'rgba(9, 11, 15, 0.28)',
  },
  thumbImage: {
    width: '94%',
    height: '94%',
  },
  chipLabel: {
    maxWidth: '100%',
    paddingHorizontal: 2,
    fontFamily: fuentes.bold,
    fontSize: 6.8,
    lineHeight: 8,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  chipLabelActive: {
    color: '#090B0F',
  },
  chipLabelInactive: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusDotDone: {
    backgroundColor: noir.mint,
  },
  statusDotActive: {
    backgroundColor: 'rgba(9, 12, 18, 0.6)',
  },
  statusDotIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  emptyText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 10,
  },
});
