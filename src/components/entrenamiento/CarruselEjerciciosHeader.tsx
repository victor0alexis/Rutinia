import React, { useRef, useEffect } from 'react';
import {
  ScrollView,
  Pressable,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vibrarBoton } from '../../utils/haptics';
import { obtenerGifEjercicio } from '../../services/ejerciciosGifs';
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
}

export default function CarruselEjerciciosHeader({
  ejercicios,
  activoIndex,
  onSelectEjercicio,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll para centrar el ejercicio activo
  useEffect(() => {
    if (scrollRef.current && activoIndex >= 0) {
      const xOffset = Math.max(0, activoIndex * 66 - 80);
      scrollRef.current.scrollTo({ x: xOffset, animated: true });
    }
  }, [activoIndex]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ejercicios.map((ej, index) => {
          const esActivo = index === activoIndex;
          const estaCompletado = ej.completado || (ej.totalSeries > 0 && ej.seriesCompletadas >= ej.totalSeries);
          const gifInfo = obtenerGifEjercicio(ej.nombre);

          return (
            <Pressable
              key={ej.id || `${ej.nombre}-${index}`}
              onPress={() => {
                vibrarBoton(12);
                onSelectEjercicio(index);
              }}
              style={({ pressed }) => [
                styles.itemWrapper,
                pressed && { opacity: 0.8 },
              ]}
              hitSlop={6}
            >
              {/* Contenedor Circular del Avatar Anatómico */}
              <View
                style={[
                  styles.avatarRing,
                  esActivo && styles.avatarRingActivo,
                  !esActivo && !estaCompletado && styles.avatarRingInactivo,
                ]}
              >
                <EjercicioGif
                  uri={gifInfo.thumbUrl}
                  style={styles.avatarImage}
                  contentFit="contain"
                  animated={false}
                  transition={200}
                />
              </View>

              {/* Badge Checkmark si está completado */}
              {estaCompletado && (
                <View style={styles.badgeCompletado}>
                  <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                </View>
              )}

              {/* Pequeño punto indicador si es el activo pero no completado */}
              {esActivo && !estaCompletado && (
                <View style={styles.badgeActivoDot} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  itemWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarRingActivo: {
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 10,
    transform: [{ scale: 1.08 }],
  },
  avatarRingInactivo: {
    opacity: 0.45,
  },
  avatarImage: {
    width: '90%',
    height: '90%',
  },
  badgeCompletado: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF1E3C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
    shadowColor: '#FF1E3C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 2,
  },
  badgeActivoDot: {
    position: 'absolute',
    bottom: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7CF3FF',
    zIndex: 2,
  },
});
