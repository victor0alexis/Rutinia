import { useEffect } from 'react';
import { Stack } from 'expo-router';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { colores } from '../constants/colores';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
    ...Ionicons.font,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});

    // Inyectar fuente de iconos Ionicons en la web si no está cargada
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'expo-vector-icons-ionicons';
      if (!document.getElementById(styleId)) {
        try {
          const iconFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');
          const fontUrl =
            typeof iconFont === 'string'
              ? iconFont
              : iconFont?.uri ||
                iconFont?.default ||
                'https://cdnjs.cloudflare.com/ajax/libs/ionicons/5.5.2/fonts/ionicons.ttf';
          const style = document.createElement('style');
          style.id = styleId;
          style.type = 'text/css';
          style.appendChild(
            document.createTextNode(
              `@font-face { font-family: 'Ionicons'; src: url('${fontUrl}') format('truetype'); }`
            )
          );
          document.head.appendChild(style);
        } catch (e) {
          console.warn('No se pudo inyectar la fuente Ionicons en web:', e);
        }
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colores.fondo, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colores.primarioHover} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="rutina/nueva"
        options={{ headerShown: true, title: 'Nueva rutina', presentation: 'modal' }}
      />
    </Stack>
  );
}

