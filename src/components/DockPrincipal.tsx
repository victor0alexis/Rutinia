import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tema } from '../constants/tema';
import { useLayout } from '../hooks/useLayout';

type Props = {
  children: React.ReactNode;
};

export default function DockPrincipal({ children }: Props) {
  const { isLandscape, gutter, contentMaxWidth, isKeyboardVisible, tabBarHeight } = useLayout();

  // If the keyboard is actively open on mobile web/native, hide the dock to not obstruct inputs
  if (isKeyboardVisible) return null;

  const bottomPosition = tabBarHeight + 12;

  return (
    <View pointerEvents="box-none" style={[styles.dockWrapper, { bottom: bottomPosition }]}>
      {/* Degradado de salida */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(11, 13, 20, 0.75)', tema.colores.fondo]}
        style={[styles.degradadoSalida, { height: isLandscape ? 80 : 120 }]}
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.buttonContainer,
          {
            maxWidth: contentMaxWidth,
            paddingHorizontal: gutter,
          },
        ]}
      >
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
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
});
