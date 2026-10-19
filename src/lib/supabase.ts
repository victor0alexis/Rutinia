import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Las credenciales se leen SIEMPRE de variables de entorno (.env).
// Nunca usar la service_role key en el cliente: va en el .env que no se sube a git,
// pero el cliente debería usar la anon key (Settings → API → "anon public").
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuración de Supabase incompleta. Define en tu archivo .env:\n' +
      '  EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co\n' +
      '  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key, NO la service_role>'
  );
}

const customStorage =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

