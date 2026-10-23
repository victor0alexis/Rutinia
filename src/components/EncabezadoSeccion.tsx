import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colores, fuentes } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import GlowButton from './GlowButton';
import { RutiniaLogo } from './RutiniaLogo';

type Props = {
  badgeText?: string;
  titulo: string;
  subtitulo?: string;
  mostrarCerrarSesion?: boolean;
  onCerrarSesion?: () => void;
  mostrarBotonVolver?: boolean;
  onVolver?: () => void;
  botonAccion?: {
    texto: string;
    icono?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
};

export default function EncabezadoSeccion({
  badgeText = 'RUTINIA',
  titulo,
  subtitulo,
  mostrarCerrarSesion,
  onCerrarSesion,
  mostrarBotonVolver,
  onVolver,
  botonAccion,
}: Props) {
  const { gutter, contentMaxWidth, isCompact, isLandscape } = useLayout();

  // Animación Enterprise: Micro-fade y micro-slide ultra suave
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(-6));
  const [lineWidthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lineWidthAnim, {
        toValue: 48,
        duration: 450,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, lineWidthAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: translateYAnim }],
        paddingTop: isLandscape ? 4 : 8,
        paddingBottom: isLandscape ? 6 : 10,
        paddingHorizontal: gutter,
        alignItems: 'center',
        gap: isLandscape ? 3 : 5,
        position: 'relative',
        width: '100%',
        maxWidth: contentMaxWidth,
        alignSelf: 'center',
      }}
    >
      {/* Botón flotante de volver atrás */}
      {mostrarBotonVolver && (
        <View style={[styles.volverContainer, { left: gutter }]}>
          <Pressable
            onPress={onVolver}
            style={({ pressed }) => [
              styles.volverButton,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            hitSlop={12}
            accessibilityLabel="Volver a todos los planes"
          >
            <Ionicons name="chevron-back" size={18} color={colores.texto} />
          </Pressable>
        </View>
      )}

      {/* Botón flotante discreto de cerrar sesión con Glow sutil */}
      {mostrarCerrarSesion && (
        <View style={[styles.cerrarSesionContainer, { right: gutter }]}>
          <Pressable
            onPress={onCerrarSesion}
            style={({ pressed }) => [
              styles.cerrarSesionButton,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Ionicons name="log-out-outline" size={17} color={colores.suave} />
          </Pressable>
        </View>
      )}

      {/* Marca metálica: el componente oficial de Reacticx como logotipo. */}
      <RutiniaLogo
        size={isLandscape ? 22 : 28}
        style={styles.brandMark}
      />

      {/* Badge Superior Micro-Elegante con Borde Luminoso */}
      <View style={styles.badgeGlowBorder}>
        <LinearGradient
          colors={['rgba(184, 29, 54, 0.40)', 'rgba(184, 29, 54, 0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.badgeInner}
        >
          <Text style={styles.badgeText}>{badgeText}</Text>
        </LinearGradient>
      </View>

      {/* TÍTULO PRINCIPAL */}
      <Text
        style={[
          styles.titulo,
          isCompact && { fontSize: 24 },
          isLandscape && { fontSize: 22 },
        ]}
      >
        {titulo}
      </Text>

      {/* Subtítulo Discreto */}
      {subtitulo ? (
        <Text
          style={[
            styles.subtitulo,
            isCompact && { fontSize: 11 },
            isLandscape && { fontSize: 11 },
          ]}
        >
          {subtitulo}
        </Text>
      ) : null}

      {/* Botón de Acción Principal usando el Sistema GlowButton */}
      {botonAccion && (
        <View style={{ marginTop: 2 }}>
          <GlowButton
            title={botonAccion.texto}
            icon={botonAccion.icono}
            onPress={botonAccion.onPress}
            variant="primary"
            size="sm"
            shape="pill"
          />
        </View>
      )}

      {/* Línea Divisoria de Acento Dinámica Luminosa */}
      <View style={{ marginTop: 4, alignItems: 'center' }}>
        <Animated.View style={[styles.lineaAcento, { width: lineWidthAnim }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    marginTop: 1,
    marginBottom: 1,
  },
  volverContainer: {
    position: 'absolute',
    top: 6,
    zIndex: 10,
  },
  volverButton: {
    backgroundColor: 'rgba(20, 24, 36, 0.85)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cerrarSesionContainer: {
    position: 'absolute',
    top: 6,
    zIndex: 10,
  },
  cerrarSesionButton: {
    backgroundColor: 'rgba(20, 24, 36, 0.80)',
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  badgeGlowBorder: {
    borderRadius: 999,
    padding: 1,
    backgroundColor: 'rgba(184, 29, 54, 0.35)',
  },
  badgeInner: {
    backgroundColor: 'rgba(184, 29, 54, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 3.5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colores.primarioHover,
  },
  badgeText: {
    fontFamily: fuentes.bold,
    color: colores.primarioHover,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titulo: {
    fontFamily: fuentes.black,
    fontSize: 29,
    color: colores.texto,
    textAlign: 'center',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitulo: {
    fontFamily: fuentes.medium,
    fontSize: 12,
    color: colores.suave,
    textAlign: 'center',
    opacity: 0.85,
    maxWidth: '85%',
  },
  lineaAcento: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colores.primarioHover,
    shadowColor: colores.primarioHover,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
