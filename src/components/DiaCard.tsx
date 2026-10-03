import React, { useState } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { aISO, nombreDia } from '../utils/fechas';
import { EjercicioRegistro, Registro } from '../types';

type Props = {
  fecha: Date;
  registros: Registro[];
  onPress: () => void;
};

export default function DiaCard({ fecha, registros, onPress }: Props) {
  const esHoy = aISO(fecha) === aISO(new Date());
  const [scaleAnim] = useState(() => new Animated.Value(1));

  // Extraer todos los ejercicios del día
  const todosEjercicios: EjercicioRegistro[] = registros.flatMap((r) => r.ejercicios_registro || []);
  const completados = todosEjercicios.filter((e) => e.completado).length;
  const total = todosEjercicios.length;
  const estaCompleto = total > 0 && completados === total;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.cardContainer,
          {
            borderColor: esHoy
              ? colores.hoy
              : estaCompleto
              ? colores.exito + '80'
              : colores.borde,
            backgroundColor: pressed ? 'rgba(24, 28, 44, 0.85)' : colores.tarjeta,
          },
        ]}
      >
        {/* Header del Día */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={[
                styles.dayNameText,
                { color: esHoy ? colores.hoy : colores.texto },
              ]}
            >
              {nombreDia(fecha)}
            </Text>
            {esHoy && (
              <View style={styles.hoyBadge}>
                <Text style={styles.hoyBadgeText}>HOY</Text>
              </View>
            )}
          </View>

          {/* Badge de Progreso */}
          {total > 0 ? (
            <View
              style={[
                styles.progressBadge,
                {
                  backgroundColor: estaCompleto
                    ? 'rgba(16, 185, 129, 0.16)'
                    : colores.primarioSuave,
                  borderColor: estaCompleto
                    ? 'rgba(16, 185, 129, 0.35)'
                    : colores.primarioGlow,
                },
              ]}
            >
              <Ionicons
                name={estaCompleto ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={estaCompleto ? colores.exito : colores.primarioHover}
              />
              <Text
                style={[
                  styles.progressBadgeText,
                  { color: estaCompleto ? colores.exito : colores.primarioHover },
                ]}
              >
                {completados}/{total}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colores.suave} />
          )}
        </View>

        {/* Contenido / Resumen */}
        {registros.length > 0 ? (
          <View style={{ gap: 6 }}>
            {registros.map((r) => (
              <View key={r.id} style={{ gap: 4 }}>
                {r.rutinas?.nombre && (
                  <Text style={styles.routineName}>
                    • {r.rutinas.nombre}
                  </Text>
                )}
                {r.ejercicios_registro.slice(0, 3).map((e) => (
                  <View
                    key={e.id}
                    style={[
                      styles.exerciseRow,
                      { paddingLeft: r.rutinas?.nombre ? 12 : 0 },
                    ]}
                  >
                    <Ionicons
                      name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={e.completado ? colores.exito : colores.suave}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.exerciseText,
                        {
                          color: e.completado ? colores.suave : colores.texto,
                          textDecorationLine: e.completado ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {e.nombre}
                    </Text>
                  </View>
                ))}
                {r.ejercicios_registro.length > 3 && (
                  <Text style={styles.moreExercisesText}>
                    + {r.ejercicios_registro.length - 3} ejercicios más...
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Sin actividades programadas. Toca para agregar.
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 17,
    fontFamily: fuentes.bold,
    textTransform: 'capitalize',
  },
  hoyBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.40)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hoyBadgeText: {
    color: colores.hoy,
    fontSize: 10,
    fontFamily: fuentes.black,
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressBadgeText: {
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  routineName: {
    color: colores.primarioHover,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  moreExercisesText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
    paddingLeft: 12,
    fontStyle: 'italic',
  },
  emptyText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.regular,
    fontStyle: 'italic',
  },
});
