import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colores } from '../constants/colores';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hasHalos?: boolean;
};

export default function ScreenBackground({ children, style, hasHalos = true }: Props) {
  return (
    <View style={[styles.container, style]}>
      {/* Fondo Gradiente Oscuro de Alta Profundidad */}
      <LinearGradient
        colors={['#050608', '#0A0C14', '#06070B']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Halos de Luz Ambiental Sutiles para Dar Profundidad Tecnológica */}
      {hasHalos && (
        <>
          {/* Halo 1: Superior Izquierdo - Burdeos sutil */}
          <View
            pointerEvents="none"
            style={styles.haloTopLeft}
          />

          {/* Halo 2: Centro Derecho - Azul/Cian helado sutil */}
          <View
            pointerEvents="none"
            style={styles.haloBottomRight}
          />
        </>
      )}

      {/* Contenido Principal */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colores.fondo,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
  haloTopLeft: {
    position: 'absolute',
    top: -90,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(184, 29, 54, 0.12)',
    zIndex: 1,
  },
  haloBottomRight: {
    position: 'absolute',
    top: 250,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    zIndex: 1,
  },
});
