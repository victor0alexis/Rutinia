import { View, Text, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colores, fuentes } from '../../constants/colores';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 22 : 10;
  const barHeight = 62 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.texto,
        tabBarInactiveTintColor: colores.suave,
        tabBarStyle: {
          backgroundColor: 'rgba(10, 12, 18, 0.92)', // Obscure glass translucent
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding - 2,
          paddingTop: 8,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fuentes.bold,
          letterSpacing: 0.3,
          marginTop: 4,
        },
      }}
    >
      {/* 1. PROGRESO */}
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeGlowHalo} />}
              <Ionicons
                name={focused ? 'stats-chart' : 'stats-chart-outline'}
                size={22}
                color={focused ? colores.texto : colores.suave}
              />
            </View>
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 10,
                fontFamily: focused ? fuentes.black : fuentes.bold,
                color: focused ? colores.texto : colores.suave,
                letterSpacing: 0.2,
              }}
            >
              {children}
            </Text>
          ),
        }}
      />

      {/* 2. RUTINAS */}
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeGlowHalo} />}
              <Ionicons
                name={focused ? 'barbell' : 'barbell-outline'}
                size={22}
                color={focused ? colores.texto : colores.suave}
              />
            </View>
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 10,
                fontFamily: focused ? fuentes.black : fuentes.bold,
                color: focused ? colores.texto : colores.suave,
                letterSpacing: 0.2,
              }}
            >
              {children}
            </Text>
          ),
        }}
      />

      {/* 3. SEMANA (TAB CENTRAL CON CONTORNO LUMINOSO INTEGRADO) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Semana',
          tabBarIcon: ({ focused }) => (
            <View style={styles.centralButtonWrapper}>
              <LinearGradient
                colors={
                  focused
                    ? ['rgba(255, 255, 255, 0.85)', 'rgba(184, 29, 54, 0.80)', 'rgba(184, 29, 54, 0.20)']
                    : ['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.05)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.centralGlowBorder}
              >
                <LinearGradient
                  colors={
                    focused
                      ? [colores.primarioHover, colores.primario]
                      : ['rgba(22, 26, 38, 0.95)', 'rgba(14, 16, 24, 0.95)']
                  }
                  style={styles.centralInner}
                >
                  <Ionicons name="calendar" size={22} color="#FFF" />
                </LinearGradient>
              </LinearGradient>
            </View>
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 10,
                fontFamily: fuentes.black,
                color: focused ? colores.primarioHover : colores.suave,
                letterSpacing: 0.2,
                marginTop: 2,
              }}
            >
              {children}
            </Text>
          ),
        }}
      />

      {/* 4. NOTAS */}
      <Tabs.Screen
        name="notas"
        options={{
          title: 'Notas',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeGlowHalo} />}
              <Ionicons
                name={focused ? 'document-text' : 'document-text-outline'}
                size={22}
                color={focused ? colores.texto : colores.suave}
              />
            </View>
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 10,
                fontFamily: focused ? fuentes.black : fuentes.bold,
                color: focused ? colores.texto : colores.suave,
                letterSpacing: 0.2,
              }}
            >
              {children}
            </Text>
          ),
        }}
      />

      {/* 5. CALENDARIO */}
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeGlowHalo} />}
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={22}
                color={focused ? colores.texto : colores.suave}
              />
            </View>
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 10,
                fontFamily: focused ? fuentes.black : fuentes.bold,
                color: focused ? colores.texto : colores.suave,
                letterSpacing: 0.2,
              }}
            >
              {children}
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 28,
    position: 'relative',
  },
  activeGlowHalo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  centralButtonWrapper: {
    top: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralGlowBorder: {
    padding: 1.5,
    borderRadius: 24,
    shadowColor: colores.primarioHover,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  centralInner: {
    width: 48,
    height: 48,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
