import React from 'react';
import {
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
import { fuentes, noir } from '../constantes/colores';
import { CATEGORIAS, obtenerConfigCategoria } from '../constantes/notas';
import { vibrarBoton } from '../utilidades/hapticos';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Conteo opcional por categoría. La clave "Todas" representa el total. */
  counts?: Record<string, number>;
  /** Incluye la pastilla "Todas" al inicio. */
  showAll?: boolean;
  /** Muestra el contador dentro de cada pastilla. */
  showCounts?: boolean;
  /** Versión reducida para el selector del modal de edición. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Selector horizontal de categorías con el mismo lenguaje que el carrusel de
 * días del home: contenedor de obsidiana, pastilla blanca para la selección y
 * micro-acentos Noir Pearl para identificar cada categoría sin romper la
 * jerarquía monocroma.
 */
export default function NotesCategoryRail({
  value,
  onChange,
  counts,
  showAll = true,
  showCounts = true,
  compact = false,
  style,
}: Props) {
  const items = showAll ? ['Todas', ...CATEGORIAS] : CATEGORIAS;

  return (
    <View style={[styles.rail, compact && styles.railCompact, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.railContent,
          compact && styles.railContentCompact,
        ]}
      >
        {items.map((item) => {
          const selected = value === item;
          const cfg = obtenerConfigCategoria(item);

          return (
            <Pressable
              key={item}
              onPress={() => {
                vibrarBoton();
                onChange(item);
              }}
              style={({ pressed }) => [
                styles.pill,
                compact && styles.pillCompact,
                selected ? styles.pillSelected : styles.pillIdle,
                pressed && styles.pillPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filtrar por ${item}`}
            >
              {selected && (
                <LinearGradient
                  pointerEvents="none"
                  colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: compact ? 11 : 13 },
                  ]}
                />
              )}

              <Ionicons
                name={cfg.icon}
                size={compact ? 13 : 14}
                color={selected ? '#090B0F' : cfg.color}
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.pillLabel,
                  compact && styles.pillLabelCompact,
                  {
                    color: selected ? '#090B0F' : noir.platinum,
                    fontFamily: selected ? fuentes.bold : fuentes.medium,
                  },
                ]}
              >
                {item}
              </Text>

              {showCounts && (
                <View
                  style={[
                    styles.countChip,
                    {
                      backgroundColor: selected
                        ? 'rgba(9, 12, 18, 0.12)'
                        : 'rgba(255, 255, 255, 0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: selected
                          ? 'rgba(9, 12, 18, 0.66)'
                          : noir.muted2,
                      },
                    ]}
                  >
                    {counts?.[item] ?? 0}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    backgroundColor: '#121215',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: noir.line,
    paddingVertical: 7,
    paddingHorizontal: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 11,
    elevation: 6,
    overflow: 'hidden',
  },
  railCompact: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 18,
    paddingVertical: 5,
    paddingHorizontal: 5,
    shadowOpacity: 0,
    elevation: 0,
  },
  railContent: {
    alignItems: 'center',
    gap: 7,
  },
  railContentCompact: {
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pillCompact: {
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 11,
  },
  pillIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: noir.line,
  },
  pillSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
    // @ts-ignore boxShadow existe en react-native-web
    boxShadow:
      '0 7px 18px rgba(206, 225, 247, 0.22), 0 0 14px rgba(240, 248, 255, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  pillPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  pillLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  pillLabelCompact: {
    fontSize: 11.5,
  },
  countChip: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    lineHeight: 12,
  },
});
