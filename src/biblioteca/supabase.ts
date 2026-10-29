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

function decodificarBase64Url(segmento: string): string | null {
  try {
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
    const atobGlobal = (globalThis as { atob?: (valor: string) => string }).atob;
    if (typeof atobGlobal === 'function') return atobGlobal(base64);

    const alfabeto =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let salida = '';
    let buffer = 0;
    let bits = 0;
    for (const caracter of base64.replace(/=+$/, '')) {
      const valor = alfabeto.indexOf(caracter);
      if (valor < 0) continue;
      buffer = (buffer << 6) | valor;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        salida += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    return salida;
  } catch {
    return null;
  }
}

function rolDeLaClave(clave: string): string | null {
  const payload = clave.split('.')[1];
  if (!payload) return null;
  const decodificado = decodificarBase64Url(payload);
  if (!decodificado) return null;
  try {
    const datos = JSON.parse(decodificado) as { role?: unknown };
    return typeof datos.role === 'string' ? datos.role : null;
  } catch {
    return null;
  }
}

if (rolDeLaClave(supabaseAnonKey) === 'service_role') {
  console.warn(
    '[Supabase] Estás usando la service_role key en la app. Esta clave ignora RLS y ' +
      'permite leer los datos de todas las cuentas. Cámbiala por la anon public key ' +
      '(Settings → API) y ejecuta supabase_multicuenta.sql.'
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
    flowType: 'pkce',
  },
});

