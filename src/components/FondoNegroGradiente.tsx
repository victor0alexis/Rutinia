import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fondo Negro Gradiente de Ultra-Gama para Rutinia.
 *
 * Características:
 * - 0% a 12%: Obsidiana nocturna elegante (#080A0F -> #040508) para anclar el encabezado y timer.
 * - 24% a 65%: NEGRO PURO ABSOLUTO (#000000) en la zona del carrusel y GIF hero.
 *   Al ser negro puro, los GIFs y miniaturas se funden al 100% con cero líneas o bordes visibles.
 * - 70% a 100%: Degradado aterciopelado (#020306 -> #06080E) que da peso y solidez a la tabla de series.
 * - Cero estrellas o imágenes particulares: estética limpia, sobria, inteligente y minimalista.
 */
export default function FondoNegroGradiente({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {/* Capa Base: Degradado Lineal Inteligente */}
      <LinearGradient
        colors={[
          '#07090D', // Tope: obsidiana sutil
          '#040507', // Zona de cabecera editorial
          '#040507', // Centro: negro perla
          '#040507', // Zona de tarjetas
          '#05070A', // Inicio de la base
          '#080A0F', // Base: solidez visual inferior
        ]}
        locations={[0, 0.12, 0.3, 0.64, 0.84, 1.0]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sutilísima aura de profundidad de estudio en el centro superior */}
      <View pointerEvents="none" style={styles.specularAura} />

      {/* Contenido */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040507',
    position: 'relative',
    overflow: 'hidden',
  },
  specularAura: {
    position: 'absolute',
    top: 96,
    left: '50%',
    width: 360,
    height: 360,
    marginLeft: -180,
    borderRadius: 180,
    backgroundColor: 'rgba(220, 235, 255, 0.022)',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'radial-gradient(circle, rgba(220, 235, 255, 0.045) 0%, rgba(255, 255, 255, 0.012) 40%, transparent 70%)',
          filter: 'blur(44px)',
        }
      : {}),
  },
});
