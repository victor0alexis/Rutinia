import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fuentes, noir } from '../constantes/colores';
import { obtenerConfigCategoria } from '../constantes/notas';
import type { NotaEstandar } from '../servicios/notas';

type Props = {
  nota: NotaEstandar;
  index?: number;
  onEditar: (nota: NotaEstandar) => void;
  onEliminar: (nota: NotaEstandar) => void;
  onAsignar: (nota: NotaEstandar) => void;
};

function fechaCorta(fechaISO: string): string {
  const fecha = parseISO(fechaISO);
  if (!isValid(fecha)) return '';
  return format(fecha, 'd MMM', { locale: es }).toUpperCase();
}

/**
 * Tarjeta de nota de la biblioteca. Mantiene la misma superficie de obsidiana
 * que el resto de la app, con el acento de categoría reducido a una línea, un
 * badge y la acción de asignación. Así el blanco sigue mandando y el color
 * solo orienta.
 */
export default function NotaBibliotecaCard({
  nota,
  index = 0,
  onEditar,
  onEliminar,
  onAsignar,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const cfg = obtenerConfigCategoria(nota.categoria);
  const fecha = fechaCorta(nota.fechaCreacion);

  return (
    <Animated.View
      entering={FadeInDown.duration(380).delay(Math.min(index * 40, 240))}
    >
      <Pressable
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.card,
          hovered && styles.cardHovered,
          pressed && { opacity: 0.94 },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: cfg.color }]} />

        <View style={styles.topRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: cfg.bg, borderColor: cfg.borderColor },
            ]}
          >
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>
              {nota.categoria.toUpperCase()}
            </Text>
          </View>

          {fecha ? <Text style={styles.date}>{fecha}</Text> : null}
        </View>

        <Text numberOfLines={2} style={styles.title}>
          {nota.titulo}
        </Text>

        {nota.contenido ? (
          <Text numberOfLines={3} style={styles.body}>
            {nota.contenido}
          </Text>
        ) : (
          <Text style={styles.emptyBody}>Sin contenido adicional</Text>
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={() => onAsignar(nota)}
            style={({ pressed }) => [
              styles.assignButton,
              { borderColor: cfg.borderColor },
              pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Asignar ${nota.titulo} a un día`}
          >
            <Ionicons name="calendar-outline" size={13} color={cfg.color} />
            <Text style={[styles.assignText, { color: cfg.color }]}>
              Asignar al día
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              onPress={() => onEditar(nota)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${nota.titulo}`}
            >
              <Ionicons name="pencil-outline" size={15} color={noir.platinum} />
            </Pressable>

            <Pressable
              onPress={() => onEliminar(nota)}
              style={({ pressed }) => [
                styles.iconButton,
                styles.deleteButton,
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${nota.titulo}`}
            >
              <Ionicons
                name="trash-outline"
                size={15}
                color="rgba(255, 128, 148, 0.9)"
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 13,
    paddingLeft: 17,
    paddingRight: 14,
    gap: 7,
    overflow: 'hidden',
  },
  cardHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 2.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.86,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 0.6,
  },
  date: {
    color: noir.muted2,
    fontFamily: fuentes.semiBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.22,
  },
  body: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  emptyBody: {
    color: 'rgba(255, 255, 255, 0.28)',
    fontFamily: fuentes.regular,
    fontSize: 12,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 3,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  assignText: {
    fontFamily: fuentes.bold,
    fontSize: 10.5,
    letterSpacing: -0.05,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 92, 118, 0.07)',
    borderColor: 'rgba(255, 92, 118, 0.14)',
  },
  iconButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.92 }],
  },
});
