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
          '#080A0F', // Tope: obsidiana sutil
          '#040508', // Transición
          '#000000', // Zona de avatares (negro puro)
          '#000000', // Zona de GIF hero (negro puro sin recuadro)
          '#020306', // Inicio de tabla de series
          '#06080E', // Base: solidez visual inferior
        ]}
        locations={[0, 0.12, 0.24, 0.62, 0.82, 1.0]}
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
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  specularAura: {
    position: 'absolute',
    top: 120,
    left: '50%',
    width: 340,
    height: 340,
    marginLeft: -170,
    borderRadius: 170,
    backgroundColor: 'rgba(0, 229, 255, 0.025)',
    ...(Platform.OS === 'web'
      ? {
          background: 'radial-gradient(circle, rgba(0, 229, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }
      : {}),
  },
});
