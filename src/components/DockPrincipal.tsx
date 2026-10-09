import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { tema } from '../constants/tema';

type Props = {
  children: React.ReactNode;
};

export default function DockPrincipal({ children }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 22 : 10;
  const tabBarHeight = 62 + bottomPadding;

  // bottom = alturaBarra + 12 (lo que sobresale el círculo central) + 20 (aire libre)
  const bottomPosition = tabBarHeight + 12 + 20;

  return (
    <View pointerEvents="box-none" style={[styles.dockWrapper, { bottom: bottomPosition }]}>
      {/* Degradado de salida de 134 px (de transparente a #0B0D14) */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(11, 13, 20, 0.75)', tema.colores.fondo]}
        style={styles.degradadoSalida}
      />
      <View pointerEvents="box-none" style={styles.buttonContainer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  degradadoSalida: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    height: 134,
  },
  buttonContainer: {
    paddingHorizontal: tema.medidas.margenLateral,
    width: '100%',
    alignItems: 'center',
  },
});
