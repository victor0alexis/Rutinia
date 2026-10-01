import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { colores } from '../../constants/colores';

const icono =
  (name: keyof typeof Ionicons.glyphMap, activeName: keyof typeof Ionicons.glyphMap) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) =>
    <Ionicons name={focused ? activeName : name} color={color as string} size={size} />;

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 22 : 10;
  const barHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primarioHover,
        tabBarInactiveTintColor: colores.suave,
        tabBarStyle: {
          backgroundColor: colores.tarjeta,
          borderTopColor: colores.borde,
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      {/* 1. PROGRESO */}
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: icono('stats-chart-outline', 'stats-chart'),
        }}
      />

      {/* 2. RUTINAS */}
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: icono('barbell-outline', 'barbell'),
        }}
      />

      {/* 3. SEMANA (CENTRAL RESALTADO POR SÍ SOLO) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Semana',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                top: -14,
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: focused ? colores.primarioHover : colores.primario,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: colores.tarjeta,
                shadowColor: colores.primarioHover,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Ionicons name="calendar" size={24} color="#FFF" />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '900',
            color: colores.primarioHover,
            marginTop: 4,
          },
        }}
      />

      {/* 4. NOTAS */}
      <Tabs.Screen
        name="notas"
        options={{
          title: 'Notas',
          tabBarIcon: icono('document-text-outline', 'document-text'),
        }}
      />

      {/* 5. CALENDARIO */}
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: icono('time-outline', 'time'),
        }}
      />
    </Tabs>
  );
}
