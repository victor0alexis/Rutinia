import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colores, fuentes, noir } from '../../constantes/colores';
import type { CuentaRutinia } from '../../servicios/cuentas';

export type AvatarProps = {
  cuenta?: CuentaRutinia | null;
  nombre?: string;
  color?: string;
  avatarUrl?: string | null;
  tipo?: 'local' | 'nube';
  size?: number;
  mostrarPuntoEstado?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({
  cuenta,
  nombre,
  color,
  avatarUrl,
  tipo,
  size = 44,
  mostrarPuntoEstado = false,
  style,
}: AvatarProps) {
  const [urlConFallo, setUrlConFallo] = useState<string | null>(null);

  const nombreFinal = cuenta?.nombre ?? nombre ?? 'Atleta';
  const colorFinal = cuenta?.color ?? color ?? colores.primario;
  const avatarUrlFinal = cuenta !== undefined ? cuenta?.avatarUrl : avatarUrl;
  const esNube = cuenta ? cuenta.tipo === 'nube' : tipo === 'nube';

  const inicial = nombreFinal.trim().charAt(0).toUpperCase() || 'A';
  const radio = size / 2;
  const dotSize = Math.max(9, Math.round(size * 0.22));

  // Si la URL actual no falló, mostramos la imagen
  const tieneFoto = Boolean(avatarUrlFinal && urlConFallo !== avatarUrlFinal);

  return (
    <View style={[styles.contenedor, { width: size, height: size }, style]}>
      <View
        style={[
          styles.mascara,
          {
            width: size,
            height: size,
            borderRadius: radio,
          },
        ]}
      >
        {tieneFoto ? (
          <Image
            source={{ uri: avatarUrlFinal as string }}
            style={{ width: size, height: size }}
            contentFit="cover"
            transition={200}
            onError={() => {
              if (avatarUrlFinal) {
                setUrlConFallo(avatarUrlFinal);
              }
            }}
          />
        ) : (
          <LinearGradient
            colors={
              esNube
                ? [colorFinal || colores.primario, '#15171F']
                : ['#242833', '#12141A']
            }
            start={{ x: 0.25, y: 0.1 }}
            end={{ x: 0.8, y: 0.95 }}
            style={styles.gradiente}
          >
            <Text
              style={[
                styles.inicialTexto,
                { fontSize: Math.max(10, Math.round(size * 0.38)) },
              ]}
            >
              {inicial}
            </Text>
          </LinearGradient>
        )}
      </View>

      {mostrarPuntoEstado ? (
        <View
          pointerEvents="none"
          style={[
            styles.puntoEstado,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: esNube ? '#3FF2B0' : noir.champagne,
              shadowColor: esNube ? '#3FF2B0' : noir.champagne,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: 'relative',
    flexShrink: 0,
  },
  mascara: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    backgroundColor: '#12141A',
  },
  gradiente: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialTexto: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
  },
  puntoEstado: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: '#080A0F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default Avatar;
