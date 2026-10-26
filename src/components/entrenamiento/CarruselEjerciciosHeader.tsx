import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constants/colores';
import { vibrarBoton } from '../../utils/haptics';
import { obtenerGifEjercicio } from '../../services/ejerciciosGifs';
import { parsearEjercicioInfo } from '../../utils/ejercicios';
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

const CARD_GAP = 8;

/**
 * Filmstrip horizontal de ejercicios.
 *
 * Cada ejercicio ocupa una tarjeta fija sin solaparse. La tarjeta activa se
 * ilumina en blanco perla, agranda su GIF y se centra automáticamente al
 * cambiar de ejercicio, mientras las demás muestran su progreso en segundo
 * plano.
 */
export default function CarruselEjerciciosHeader({
  ejercicios,
  activoIndex,
  onSelectEjercicio,
  style,
}: Props) {
  const { isCompact } = useLayout();
  const scrollRef = useRef<ScrollView | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const total = ejercicios.length;
  const safeIndex = Math.min(Math.max(activoIndex, 0), Math.max(total - 1, 0));

  const activeWidth = isCompact ? 112 : 124;
  const inactiveWidth = isCompact ? 72 : 80;
  const cardHeight = isCompact ? 96 : 100;

  const cardWidthFor = useCallback(
    (index: number) => (index === safeIndex ? activeWidth : inactiveWidth),
    [activeWidth, inactiveWidth, safeIndex]
  );

  // Solo depende del número de tarjetas y de sus anchos: así los cambios de
  // series o de texto no vuelven a disparar el auto-centrado en cada tecla.
  const offsets = useMemo(() => {
    const result: number[] = [];
    let x = 0;
    for (let index = 0; index < total; index += 1) {
      result.push(x);
      x += cardWidthFor(index) + CARD_GAP;
    }
    return result;
  }, [cardWidthFor, total]);

  // Centra la tarjeta activa sin mover el resto de la tira.
  useEffect(() => {
    if (viewportWidth <= 0 || total === 0) return;
    const timeout = setTimeout(() => {
      const width = cardWidthFor(safeIndex);
      // +2 compensa el paddingHorizontal de scrollContent.
      const x = (offsets[safeIndex] ?? 0) + 2;
      scrollRef.current?.scrollTo({
        x: Math.max(0, x - (viewportWidth - width) / 2),
        animated: true,
      });
    }, 60);
    return () => clearTimeout(timeout);
  }, [cardWidthFor, offsets, safeIndex, total, viewportWidth]);

  const irA = (index: number) => {
    if (index < 0 || index >= total || index === safeIndex) return;
    vibrarBoton();
    onSelectEjercicio(index);
  };

  const seriesCompletadasSesion = ejercicios.reduce(
    (acc, item) => acc + item.seriesCompletadas,
    0
  );
  const totalSeriesSesion = ejercicios.reduce((acc, item) => acc + item.totalSeries, 0);
  const progresoSesion =
    totalSeriesSesion > 0
      ? Math.min(100, Math.round((seriesCompletadasSesion / totalSeriesSesion) * 100))
      : 0;

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && Math.abs(width - viewportWidth) > 1) {
      setViewportWidth(width);
    }
  };

  return (
    <View style={[styles.outerContainer, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrow}>SESIÓN EN VIVO</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Ejercicio {safeIndex + 1} de {Math.max(total, 1)}
          </Text>
        </View>

        <View style={styles.headerStats}>
          <Text style={styles.headerStatsValue}>
            {seriesCompletadasSesion}
            <Text style={styles.headerStatsMuted}>/{totalSeriesSesion}</Text>
          </Text>
          <Text style={styles.headerStatsLabel}>SERIES</Text>
        </View>
      </View>

      <View style={styles.overallTrack}>
        <View style={[styles.overallFill, { width: `${progresoSesion}%` }]} />
      </View>

      <View style={styles.filmstripRow}>
        {total > 1 && (
          <Pressable
            onPress={() => irA(safeIndex - 1)}
            disabled={safeIndex <= 0}
            style={({ pressed }) => [
              styles.navArrowButton,
              safeIndex <= 0 && styles.navArrowDisabled,
              pressed && safeIndex > 0 && { opacity: 0.65 },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ disabled: safeIndex <= 0 }}
            accessibilityLabel="Ejercicio anterior"
          >
            <Ionicons name="chevron-back" size={14} color={noir.platinum} />
          </Pressable>
        )}

        <View style={styles.scrollWrap} onLayout={handleViewportLayout}>
          {total === 0 ? (
            <Text style={styles.emptyText}>Sin ejercicios</Text>
          ) : (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              {ejercicios.map((ejercicio, index) => (
                <CarouselEjercicioCard
                  key={ejercicio.id || `${ejercicio.nombre}-${index}`}
                  item={ejercicio}
                  activo={index === safeIndex}
                  width={cardWidthFor(index)}
                  height={cardHeight}
                  onPress={() => irA(index)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {total > 1 && (
          <Pressable
            onPress={() => irA(safeIndex + 1)}
            disabled={safeIndex >= total - 1}
            style={({ pressed }) => [
              styles.navArrowButton,
              safeIndex >= total - 1 && styles.navArrowDisabled,
              pressed && safeIndex < total - 1 && { opacity: 0.65 },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ disabled: safeIndex >= total - 1 }}
            accessibilityLabel="Ejercicio siguiente"
          >
            <Ionicons name="chevron-forward" size={14} color={noir.platinum} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

interface CardProps {
  item: EjercicioCarruselItem;
  activo: boolean;
  width: number;
  height: number;
  onPress: () => void;
}

function CarouselEjercicioCard({ item, activo, width, height, onPress }: CardProps) {
  const nombreVisible =
    parsearEjercicioInfo({ nombre: item.nombre }).nombreLimpio || item.nombre;
  const gifInfo = obtenerGifEjercicio(nombreVisible);
  const completado =
    item.completado ||
    (item.totalSeries > 0 && item.seriesCompletadas >= item.totalSeries);
  const progreso =
    item.totalSeries > 0
      ? Math.min(100, Math.round((item.seriesCompletadas / item.totalSeries) * 100))
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width, height },
        activo ? styles.cardActive : styles.cardInactive,
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={`${item.nombre}. ${item.seriesCompletadas} de ${item.totalSeries} series completadas`}
    >
      {activo && (
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFFFF', '#F1F5FB', '#CFD9E7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
        />
      )}

      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.thumb,
            activo && styles.thumbActive,
            completado && !activo && styles.thumbDone,
          ]}
        >
          <EjercicioGif
            uri={gifInfo.gifUrl}
            style={styles.thumbImage}
            contentFit="contain"
            animated={activo}
            paused={!activo}
          />
        </View>

        <View
          style={[
            styles.statusChip,
            activo && styles.statusChipActive,
            completado && styles.statusChipDone,
          ]}
        >
          {completado ? (
            <Ionicons
              name="checkmark"
              size={10}
              color={activo ? '#0A6B4B' : noir.mint}
            />
          ) : (
            <Text style={[styles.statusText, activo && styles.statusTextActive]}>
              {item.seriesCompletadas}/{item.totalSeries}
            </Text>
          )}
        </View>
      </View>

      <Text
        numberOfLines={2}
        style={[styles.cardName, activo ? styles.cardNameActive : styles.cardNameInactive]}
      >
        {nombreVisible}
      </Text>

      <View style={[styles.cardTrack, activo && styles.cardTrackActive]}>
        <View
          style={[
            styles.cardFill,
            { width: `${progreso}%` },
            activo
              ? styles.cardFillActive
              : completado
              ? styles.cardFillDone
              : styles.cardFillIdle,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'rgba(10, 12, 17, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: noir.mint,
  },
  eyebrow: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 1,
  },
  headerTitle: {
    color: noir.text,
    fontFamily: fuentes.extraBold,
    fontSize: 12.5,
    letterSpacing: -0.15,
    marginTop: 1,
  },
  headerStats: {
    alignItems: 'flex-end',
    minWidth: 46,
  },
  headerStatsValue: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 14,
    lineHeight: 15,
  },
  headerStatsMuted: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9,
  },
  headerStatsLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.9,
    marginTop: 1,
  },
  overallTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    marginTop: 7,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  overallFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: noir.pearl,
  },
  filmstripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navArrowButton: {
    width: 24,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 2,
  },
  navArrowDisabled: {
    opacity: 0.22,
  },
  scrollWrap: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  scrollContent: {
    alignItems: 'center',
    gap: CARD_GAP,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 7,
    justifyContent: 'space-between',
  },
  cardInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderColor: 'rgba(255, 255, 255, 0.065)',
  },
  cardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 2,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(9, 11, 15, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbActive: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#090B0F',
    borderColor: 'rgba(9, 11, 15, 0.22)',
  },
  thumbDone: {
    borderColor: 'rgba(63, 242, 176, 0.3)',
  },
  thumbImage: {
    width: '94%',
    height: '94%',
  },
  statusChip: {
    minWidth: 20,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipActive: {
    backgroundColor: 'rgba(9, 12, 18, 0.08)',
  },
  statusChipDone: {
    backgroundColor: 'rgba(63, 242, 176, 0.16)',
  },
  statusText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.1,
  },
  statusTextActive: {
    color: 'rgba(9, 12, 18, 0.62)',
  },
  cardName: {
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginTop: 4,
  },
  cardNameActive: {
    color: '#090B0F',
    fontSize: 9.5,
    lineHeight: 11.5,
  },
  cardNameInactive: {
    color: 'rgba(255, 255, 255, 0.52)',
    fontSize: 8,
    lineHeight: 10,
  },
  cardTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    marginTop: 5,
  },
  cardTrackActive: {
    backgroundColor: 'rgba(9, 12, 18, 0.12)',
  },
  cardFill: {
    height: '100%',
    borderRadius: 2,
  },
  cardFillActive: {
    backgroundColor: '#090B0F',
  },
  cardFillIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
  cardFillDone: {
    backgroundColor: noir.mint,
  },
  emptyText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 10,
    paddingVertical: 18,
    textAlign: 'center',
  },
});
