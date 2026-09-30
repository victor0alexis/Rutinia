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
import { ActivityIndicator, View } from 'react-native';
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
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
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
