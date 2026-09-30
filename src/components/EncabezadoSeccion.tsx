import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';

type Props = {
  badgeText?: string;
  titulo: string;
  subtitulo?: string;
  mostrarCerrarSesion?: boolean;
  onCerrarSesion?: () => void;
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
  botonAccion,
}: Props) {
  // Animación Enterprise: Micro-fade y micro-slide ultra suave
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-4)).current;

  // Expandir la línea decorativa de acento sutilmente
  const lineWidthAnim = useRef(new Animated.Value(0)).current;

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
        toValue: 44,
        duration: 450,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false, // para animar width
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: translateYAnim }],
        paddingTop: 12,
        paddingBottom: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Botón flotante discreto de cerrar sesión */}
      {mostrarCerrarSesion && (
        <View style={{ position: 'absolute', right: 20, top: 12, zIndex: 10 }}>
          <Pressable
            onPress={onCerrarSesion}
            style={({ pressed }) => ({
              backgroundColor: colores.tarjeta,
              padding: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colores.borde,
              opacity: pressed ? 0.7 : 1,
            })}
            hitSlop={10}
          >
            <Ionicons name="log-out-outline" size={17} color={colores.suave} />
          </Pressable>
        </View>
      )}

      {/* Badge Superior Micro-Elegante */}
      <View
        style={{
          backgroundColor: colores.primarioSuave,
          borderWidth: 1,
          borderColor: colores.primarioGlow,
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colores.primarioHover }} />
        <Text
          style={{
            fontFamily: fuentes.bold,
            color: colores.primarioHover,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}
        >
          {badgeText}
        </Text>
      </View>

      {/* TÍTULO PRINCIPAL NIVEL ENTERPRISE (Limpio, tipografía nítida y sombra sutil) */}
      <Text
        style={{
          fontFamily: fuentes.black,
          fontSize: 29,
          color: colores.texto,
          textAlign: 'center',
          letterSpacing: -0.3,
          textTransform: 'capitalize',
          textShadowColor: 'rgba(0, 0, 0, 0.6)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 4,
        }}
      >
        {titulo}
      </Text>

      {/* Subtítulo Discreto */}
      {subtitulo ? (
        <Text
          style={{
            fontFamily: fuentes.medium,
            fontSize: 12,
            color: colores.suave,
            textAlign: 'center',
            opacity: 0.8,
            maxWidth: '85%',
          }}
        >
          {subtitulo}
        </Text>
      ) : null}

      {/* Botón de Acción Principal de la Sección (Estética Integrada) */}
      {botonAccion && (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onPress={botonAccion.onPress}
            style={({ pressed }) => ({
              backgroundColor: colores.primario,
              borderRadius: 12,
              paddingHorizontal: 18,
              paddingVertical: 9,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              opacity: pressed ? 0.85 : 1,
              shadowColor: colores.primario,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 5,
              elevation: 3,
            })}
          >
            {botonAccion.icono && <Ionicons name={botonAccion.icono} size={17} color="#FFF" />}
            <Text style={{ fontFamily: fuentes.bold, color: '#FFF', fontSize: 13, letterSpacing: 0.2 }}>
              {botonAccion.texto}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Línea Divisoria de Acento Dinámica Nivel Enterprise */}
      <View style={{ marginTop: 6, alignItems: 'center' }}>
        <Animated.View
          style={{
            width: lineWidthAnim,
            height: 2,
            borderRadius: 1,
            backgroundColor: colores.primarioHover,
          }}
        />
      </View>
    </Animated.View>
  );
}
