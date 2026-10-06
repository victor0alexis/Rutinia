import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bwjtulvnpjgufxhoqehg.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3anR1bHZucGpndWZ4aG9xZWhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDcxNzM0NywiZXhwIjoyMTA2MjkzMzQ3fQ.X9TEflpAu88wnoMury3Ilpy9MEvAneboe6T-iyfAjqU';

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

