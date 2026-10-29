import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { COLORES_PLANES } from '../constantes/colores';
import { supabase } from '../biblioteca/supabase';
import { establecerNamespaceDatos, limpiarCacheDeCuenta } from '../utilidades/almacenamientoLocal';
import { emitirCambioSesionActiva } from '../utilidades/sesionActiva';
import { emitirCambioDatos } from '../utilidades/sincronizacion';

WebBrowser.maybeCompleteAuthSession();

/**
 * Gestor de cuentas y sesiones de Rutinia.
 *
 * Responsabilidades:
 *  - Mantener un registro local de las cuentas usadas en este dispositivo.
 *  - Guardar una instantánea de la sesión de Supabase por cuenta para poder
 *    cambiar entre ellas sin volver a escribir la contraseña.
 *  - Activar el espacio de nombres correcto de las cachés antes de notificar
 *    el cambio a las pantallas.
 *  - Crear, actualizar y eliminar la cuenta (la eliminación real requiere el
 *    RPC `eliminar_mi_cuenta` incluido en supabase_multicuenta.sql).
 *
 * Los tokens se guardan en AsyncStorage (no cifrado). Para un entorno de
 * producción conviene migrar las claves `rutinia_cuenta_sesion_v1_*` a
 * expo-secure-store, sobre todo en iOS/Android.
 */

type TipoCuenta = 'local' | 'nube';

export type CuentaRutinia = {
  id: string;
  tipo: TipoCuenta;
  nombre: string;
  email: string | null;
  color: string;
  creadaEn: number;
  ultimaVez: number;
  /** Indica si en este dispositivo existe una sesión reutilizable. */
  sesionGuardada: boolean;
};

export type EstadoCuentas = {
  activaId: string;
  cuentas: CuentaRutinia[];
  activa: CuentaRutinia;
};

type RegistroCuentas = {
  version: 1;
  activaId: string;
  cuentas: CuentaRutinia[];
};

type SesionGuardada = {
  access_token: string;
  refresh_token: string;
  guardadaEn: number;
};

export type ResultadoCreacion = {
  requiereConfirmacion: boolean;
  email: string;
  mensaje: string;
};

const KEY_REGISTRO = 'rutinia_cuentas_registro_v1';
const KEY_SESION_PREFIX = 'rutinia_cuenta_sesion_v1_';
const ID_LOCAL = 'local';
const NOMBRE_LOCAL = 'Modo Invitado / Local';
const COLOR_LOCAL = '#8A8F9C';

const listeners = new Set<() => void>();

let registroCache: RegistroCuentas | null = null;
let inicializado = false;
let inicializacionEnCurso: Promise<void> | null = null;
let suscritoAuth = false;

export class SesionExpiradaError extends Error {
  readonly email: string | null;

  constructor(email: string | null, detalle?: string) {
    super(
      detalle ||
        'La sesión guardada de esta cuenta expiró. Ingresa de nuevo tu contraseña para continuar.'
    );
    this.name = 'SesionExpiradaError';
    this.email = email;
  }
}

export class EliminacionNoConfiguradaError extends Error {
  constructor() {
    super(
      'Para eliminar la cuenta y todos sus datos en la nube falta ejecutar supabase_multicuenta.sql en el proyecto de Supabase.'
    );
    this.name = 'EliminacionNoConfiguradaError';
  }
}

function cuentaLocal(): CuentaRutinia {
  return {
    id: ID_LOCAL,
    tipo: 'local',
    nombre: NOMBRE_LOCAL,
    email: null,
    color: COLOR_LOCAL,
    creadaEn: Date.now(),
    ultimaVez: Date.now(),
    sesionGuardada: false,
  };
}

function colorPorId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COLORES_PLANES[Math.abs(hash) % COLORES_PLANES.length];
}

function colorValido(valor: unknown, id: string): string {
  return typeof valor === 'string' && /^#[0-9a-fA-F]{6}$/.test(valor)
    ? valor
    : colorPorId(id);
}

function nombreDeUsuario(user: User): string {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const candidatos = [meta.nombre, meta.full_name, meta.name];
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim()) {
      return candidato.trim();
    }
  }
  return user.email?.split('@')[0]?.trim() || 'Atleta';
}

function normalizarRegistro(valor: unknown): RegistroCuentas {
  if (!valor || typeof valor !== 'object') {
    return { version: 1, activaId: ID_LOCAL, cuentas: [cuentaLocal()] };
  }

  const raw = valor as Partial<RegistroCuentas>;
  const cuentasRaw = Array.isArray(raw.cuentas) ? raw.cuentas : [];
  const cuentas: CuentaRutinia[] = [];

  for (const item of cuentasRaw) {
    if (!item || typeof item !== 'object') continue;
    const cuenta = item as Partial<CuentaRutinia>;
    if (!cuenta.id || (cuenta.tipo !== 'local' && cuenta.tipo !== 'nube')) continue;

    cuentas.push({
      id: String(cuenta.id),
      tipo: cuenta.tipo,
      nombre:
        typeof cuenta.nombre === 'string' && cuenta.nombre.trim()
          ? cuenta.nombre.trim()
          : cuenta.tipo === 'local'
            ? NOMBRE_LOCAL
            : 'Atleta Rutinia',
      email: typeof cuenta.email === 'string' ? cuenta.email : null,
      color: colorValido(cuenta.color, String(cuenta.id)),
      creadaEn: typeof cuenta.creadaEn === 'number' ? cuenta.creadaEn : Date.now(),
      ultimaVez: typeof cuenta.ultimaVez === 'number' ? cuenta.ultimaVez : Date.now(),
      sesionGuardada: Boolean(cuenta.sesionGuardada),
    });
  }

  if (!cuentas.some((cuenta) => cuenta.id === ID_LOCAL)) {
    cuentas.unshift(cuentaLocal());
  }

  const activaId =
    typeof raw.activaId === 'string' && cuentas.some((c) => c.id === raw.activaId)
      ? raw.activaId
      : ID_LOCAL;

  return { version: 1, activaId, cuentas };
}

function ordenarCuentas(cuentas: CuentaRutinia[]): CuentaRutinia[] {
  return [...cuentas].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'local' ? -1 : 1;
    return b.ultimaVez - a.ultimaVez;
  });
}

async function leerRegistro(): Promise<RegistroCuentas> {
  if (registroCache) return registroCache;

  try {
    const raw = await AsyncStorage.getItem(KEY_REGISTRO);
    registroCache = normalizarRegistro(raw ? JSON.parse(raw) : null);
  } catch (err) {
    console.warn('Error leyendo registro de cuentas:', err);
    registroCache = normalizarRegistro(null);
  }

  return registroCache;
}

async function guardarRegistro(registro: RegistroCuentas): Promise<void> {
  const normalizado: RegistroCuentas = {
    ...registro,
    cuentas: ordenarCuentas(registro.cuentas),
  };
  registroCache = normalizado;
  try {
    await AsyncStorage.setItem(KEY_REGISTRO, JSON.stringify(normalizado));
  } catch (err) {
    console.warn('Error guardando registro de cuentas:', err);
  }
}

function upsertCuentaEnRegistro(
  registro: RegistroCuentas,
  user: User,
  conSesion: boolean
): CuentaRutinia {
  const existente = registro.cuentas.find((cuenta) => cuenta.id === user.id);
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const ahora = Date.now();

  const actualizada: CuentaRutinia = {
    id: user.id,
    tipo: 'nube',
    nombre: nombreDeUsuario(user),
    email: user.email ?? existente?.email ?? null,
    color: colorValido(meta.color, user.id),
    creadaEn: existente?.creadaEn ?? (user.created_at ? Date.parse(user.created_at) : ahora),
    ultimaVez: ahora,
    sesionGuardada: conSesion || Boolean(existente?.sesionGuardada),
  };

  registro.cuentas = [
    ...registro.cuentas.filter((cuenta) => cuenta.id !== user.id),
    actualizada,
  ];

  return actualizada;
}

async function guardarSesionDe(session: Session): Promise<void> {
  const snapshot: SesionGuardada = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    guardadaEn: Date.now(),
  };
  try {
    await AsyncStorage.setItem(
      `${KEY_SESION_PREFIX}${session.user.id}`,
      JSON.stringify(snapshot)
    );
  } catch (err) {
    console.warn('Error guardando sesión de cuenta:', err);
  }
}

async function leerSesionDe(cuentaId: string): Promise<SesionGuardada | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY_SESION_PREFIX}${cuentaId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SesionGuardada>;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      guardadaEn: typeof parsed.guardadaEn === 'number' ? parsed.guardadaEn : 0,
    };
  } catch {
    return null;
  }
}

async function borrarSesionDe(cuentaId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${KEY_SESION_PREFIX}${cuentaId}`);
  } catch (err) {
    console.warn('Error eliminando sesión guardada:', err);
  }
}

function notificar(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.warn('Error en listener de cuentas:', err);
    }
  }
}

async function publicarCambioDeDatos(): Promise<void> {
  emitirCambioDatos();
  await emitirCambioSesionActiva();
}

/** Activa el espacio de nombres local de una cuenta y avisa a toda la app. */
async function fijarCuentaActiva(cuentaId: string): Promise<CuentaRutinia> {
  const registro = await leerRegistro();
  const cuenta = registro.cuentas.find((item) => item.id === cuentaId);
  if (!cuenta) throw new Error('La cuenta seleccionada ya no existe en este dispositivo.');

  registro.activaId = cuentaId;
  cuenta.ultimaVez = Date.now();
  await guardarRegistro(registro);

  establecerNamespaceDatos(cuenta.tipo === 'nube' ? cuenta.id : null);
  notificar();
  await publicarCambioDeDatos();
  return cuenta;
}

/** Guarda la sesión actual en el baúl sin cambiar de cuenta. */
async function guardarSesionActualSiHay(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    await guardarSesionDe(session);
    const registro = await leerRegistro();
    upsertCuentaEnRegistro(registro, session.user, true);
    await guardarRegistro(registro);
    return session.user.id;
  } catch (err) {
    console.warn('Error guardando la sesión actual:', err);
    return null;
  }
}

/** Registra una sesión recién obtenida y la deja como activa. */
async function activarSesion(session: Session): Promise<CuentaRutinia> {
  await guardarSesionDe(session);
  const registro = await leerRegistro();
  upsertCuentaEnRegistro(registro, session.user, true);
  registro.activaId = session.user.id;
  await guardarRegistro(registro);

  establecerNamespaceDatos(session.user.id);
  notificar();
  await publicarCambioDeDatos();

  return registro.cuentas.find((cuenta) => cuenta.id === session.user.id) as CuentaRutinia;
}

function traducirErrorAuth(error: { message?: string; code?: string } | null): Error {
  const mensaje = error?.message || 'No se pudo completar la operación.';
  const minusculas = mensaje.toLowerCase();

  if (minusculas.includes('invalid login credentials')) {
    return new Error('Correo o contraseña incorrectos.');
  }
  if (minusculas.includes('email not confirmed')) {
    return new Error('Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.');
  }
  if (minusculas.includes('user already registered')) {
    return new Error('Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.');
  }
  if (minusculas.includes('password should be at least')) {
    return new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (minusculas.includes('unable to validate email') || minusculas.includes('invalid email')) {
    return new Error('El correo electrónico no es válido.');
  }
  if (
    minusculas.includes('provider is not enabled') ||
    minusculas.includes('unsupported provider')
  ) {
    return new Error(
      'El inicio de sesión con Google no está habilitado en Supabase. Actívalo en Authentication → Providers → Google.'
    );
  }
  if (
    minusculas.includes('redirect') &&
    (minusculas.includes('not allowed') || minusculas.includes('mismatch'))
  ) {
    return new Error(
      'La URL de retorno de Google no está autorizada en Supabase. Añádela en Authentication → URL Configuration → Redirect URLs.'
    );
  }
  if (
    minusculas.includes('access_denied') ||
    minusculas.includes('user canceled') ||
    minusculas.includes('user cancelled') ||
    minusculas.includes('cancel')
  ) {
    return new Error('Inicio de sesión cancelado.');
  }
  if (
    minusculas.includes('email_not_confirmed') ||
    minusculas.includes('unverified email') ||
    minusculas.includes('email not verified')
  ) {
    return new Error('El correo de tu cuenta de Google no está verificado.');
  }
  if (
    error?.code === 'over_email_send_rate_limit' ||
    minusculas.includes('email rate limit exceeded') ||
    minusculas.includes('rate limit') ||
    minusculas.includes('too many requests')
  ) {
    return new Error(
      'Supabase alcanzó el límite de correos. Con el servicio integrado solo permite 2 por hora; espera o configura un SMTP propio.'
    );
  }
  if (
    error?.code === 'email_address_not_authorized' ||
    minusculas.includes('email address not authorized')
  ) {
    return new Error(
      'Supabase no autorizó el envío a este correo. El servicio integrado solo envía a miembros del equipo del proyecto; configura un SMTP propio en Authentication → Emails.'
    );
  }
  if (minusculas.includes('network request failed') || minusculas.includes('fetch')) {
    return new Error('No hay conexión con Supabase. Revisa tu red e intenta de nuevo.');
  }
  return new Error(mensaje);
}

function suscribirEventosAuth(): void {
  if (suscritoAuth) return;
  suscritoAuth = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) {
      // Si Supabase invalida la sesión (refresh token vencido/revocado),
      // volvemos al perfil local para que la interfaz no siga mostrando una
      // cuenta de nube sin sesión real. No borramos el baúl: al intentar
      // cambiar de nuevo se pedirá la contraseña si el token ya no sirve.
      if (event === 'SIGNED_OUT') {
        void (async () => {
          try {
            const registro = await leerRegistro();
            if (registro.activaId === ID_LOCAL) return;
            registro.activaId = ID_LOCAL;
            await guardarRegistro(registro);
            establecerNamespaceDatos(null);
            notificar();
            await publicarCambioDeDatos();
          } catch (err) {
            console.warn('Error regresando al perfil local:', err);
          }
        })();
      }
      return;
    }

    // No bloqueamos el callback de Supabase: solo persistimos el espejo local.
    void (async () => {
      try {
        await guardarSesionDe(session);
        const registro = await leerRegistro();
        upsertCuentaEnRegistro(registro, session.user, true);
        await guardarRegistro(registro);
        notificar();
      } catch (err) {
        console.warn('Error sincronizando cuenta autenticada:', err);
      }
    })();
  });
}

async function ejecutarInicializacion(): Promise<void> {
  try {
    await completarInicioConGoogleSiCorresponde();
  } catch (err) {
    console.warn('Error completando inicio de sesión con Google al arrancar:', err);
  }

  const registro = await leerRegistro();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    await guardarSesionDe(session);
    upsertCuentaEnRegistro(registro, session.user, true);
    registro.activaId = session.user.id;
  } else if (registro.activaId !== ID_LOCAL) {
    // Si la sesión persistida desapareció, arrancamos en local sin borrar el
    // baúl: la cuenta sigue disponible para volver a entrar con contraseña.
    registro.activaId = ID_LOCAL;
  }

  await guardarRegistro(registro);
  establecerNamespaceDatos(registro.activaId === ID_LOCAL ? null : registro.activaId);
  suscribirEventosAuth();
  inicializado = true;
  notificar();
}

/**
 * Debe llamarse al arrancar la app, antes de montar las pantallas. Varias
 * llamadas concurrentes (por ejemplo, un doble efecto en desarrollo) comparten
 * la misma inicialización para no competir por la sesión o el namespace.
 */
export function inicializarCuentas(): Promise<void> {
  if (inicializado) return Promise.resolve();
  if (inicializacionEnCurso) return inicializacionEnCurso;

  inicializacionEnCurso = ejecutarInicializacion().finally(() => {
    inicializacionEnCurso = null;
  });

  return inicializacionEnCurso;
}

export function subscribirCambioCuenta(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function obtenerEstadoCuentas(): Promise<EstadoCuentas> {
  const registro = await leerRegistro();
  const cuentas = ordenarCuentas(registro.cuentas);
  const activa =
    cuentas.find((cuenta) => cuenta.id === registro.activaId) ??
    cuentas.find((cuenta) => cuenta.id === ID_LOCAL) ??
    cuentaLocal();

  return { activaId: activa.id, cuentas, activa };
}

export async function obtenerCuentaActiva(): Promise<CuentaRutinia> {
  return (await obtenerEstadoCuentas()).activa;
}

export async function iniciarSesion(email: string, password: string): Promise<CuentaRutinia> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw traducirErrorAuth(error);
  if (!data.session || !data.user) {
    throw new Error('Supabase no devolvió una sesión válida. Intenta nuevamente.');
  }

  return activarSesion(data.session);
}

function parametrosDeRedireccion(url: string): URLSearchParams {
  const [sinHash, hash = ''] = url.split('#');
  const [, query = ''] = sinHash.split('?');
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

/**
 * Solo web: si venimos de redirigir a Google y la URL contiene el código de
 * autorización OAuth (o un error), intercambia el código por la sesión con PKCE,
 * limpia la URL con history.replaceState (sin recargar) y activa la sesión.
 * Devuelve `true` si se completó un inicio con Google, `false` si no correspondía.
 */
export async function completarInicioConGoogleSiCorresponde(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  let hayMarca = false;
  try {
    hayMarca = window.localStorage.getItem('rutinia_oauth_google_pendiente') === '1';
  } catch {
    hayMarca = false;
  }

  const parametros = new URLSearchParams(window.location.search);
  const code = parametros.get('code');
  const errorParam = parametros.get('error');
  const errorDescription = parametros.get('error_description');

  if (!hayMarca && !code && !errorParam && !errorDescription) {
    return false;
  }

  // Limpiar la marca de localStorage
  try {
    window.localStorage.removeItem('rutinia_oauth_google_pendiente');
  } catch {
    // ignorar
  }

  // Si no hay código ni error pero quedó la marca huérfana, salir
  if (!code && !errorParam && !errorDescription) {
    return false;
  }

  // Limpiar los parámetros de la URL sin recargar
  try {
    parametros.delete('code');
    parametros.delete('error');
    parametros.delete('error_description');
    parametros.delete('error_code');
    const resto = parametros.toString();
    const nuevaUrl =
      window.location.pathname + (resto ? `?${resto}` : '') + window.location.hash;
    window.history.replaceState(null, '', nuevaUrl);
  } catch {
    // ignorar
  }

  if (errorParam || errorDescription) {
    throw traducirErrorAuth({
      message: errorDescription || errorParam || 'Error al autenticarse con Google',
    });
  }

  if (!code) {
    return false;
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw traducirErrorAuth(error);

  if (!data.session?.user) {
    throw new Error('Google no devolvió una sesión válida. Intenta nuevamente.');
  }

  await activarSesion(data.session);
  return true;
}

/**
 * Inicia el flujo de autenticación con Google mediante OAuth y PKCE.
 * En web redirige la página completa (no popup) para compatibilidad con PWA en iOS;
 * en nativo abre un navegador del sistema con WebBrowser.
 */
export async function iniciarSesionConGoogle(): Promise<CuentaRutinia | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('No se pudo abrir la autenticación de Google en este entorno.');
    }

    try {
      window.localStorage.setItem('rutinia_oauth_google_pendiente', '1');
    } catch (err) {
      console.warn('No se pudo guardar la marca de OAuth en localStorage:', err);
    }

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '') ||
      window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) throw traducirErrorAuth(error);
    if (data?.url) {
      window.location.assign(data.url);
    }
    return null;
  }

  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw traducirErrorAuth(error);
  if (!data?.url) throw new Error('No se pudo abrir la autenticación de Google.');

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultado.type !== 'success') return null;

  const parametros = parametrosDeRedireccion(resultado.url);
  const errorGoogle = parametros.get('error_description') || parametros.get('error');
  if (errorGoogle) {
    throw traducirErrorAuth({ message: errorGoogle });
  }

  const code = parametros.get('code');
  if (code) {
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw traducirErrorAuth(exchangeError);
    if (!exchangeData.session?.user) {
      throw new Error('Google no devolvió una sesión válida. Intenta nuevamente.');
    }
    return activarSesion(exchangeData.session);
  }

  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw traducirErrorAuth(sessionError);
    if (!sessionData.session?.user) {
      throw new Error('Google no devolvió una sesión válida. Intenta nuevamente.');
    }
    return activarSesion(sessionData.session);
  }

  throw new Error('Google no devolvió un código de autorización válido.');
}

export async function crearCuenta(datos: {
  nombre: string;
  email: string;
  password: string;
}): Promise<ResultadoCreacion> {
  const email = datos.email.trim();
  const nombre = datos.nombre.trim() || 'Atleta';

  const { data, error } = await supabase.auth.signUp({
    email,
    password: datos.password,
    options: {
      data: { nombre, color: colorPorId(email.toLowerCase()) },
    },
  });

  if (error) throw traducirErrorAuth(error);

  if (data.session) {
    await activarSesion(data.session);
    return {
      requiereConfirmacion: false,
      email,
      mensaje: '¡Cuenta creada y sesión iniciada!',
    };
  }

  if (data.user) {
    // Con la confirmación activada, Supabase devuelve un usuario «falso» con
    // identities vacío cuando el correo ya está registrado. No lo añadimos al
    // selector ni decimos que se creó una cuenta nueva.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error(
        'Ya existe una cuenta con este correo. Inicia sesión o usa «Reenviar confirmación» si aún no la has confirmado.'
      );
    }

    // La cuenta existe pero Supabase exige confirmar el correo. La dejamos
    // anotada para que aparezca en el selector y pueda entrar luego.
    const registro = await leerRegistro();
    upsertCuentaEnRegistro(registro, data.user, false);
    await guardarRegistro(registro);
    notificar();
  }

  return {
    requiereConfirmacion: true,
    email,
    mensaje:
      'Cuenta creada. Te enviamos un correo para confirmarla. Si no llega, revisa Spam o usa «Reenviar confirmación».',
  };
}

/**
 * Vuelve a pedir el correo de confirmación de una cuenta pendiente.
 *
 * Supabase no revela si el correo existe, así que la UI debe mostrar un
 * mensaje neutro. Con el SMTP integrado el envío puede fallar por límite o
 * porque la dirección no pertenece al equipo del proyecto.
 */
export async function reenviarConfirmacion(email: string): Promise<void> {
  const correo = email.trim();
  if (!correo) throw new Error('Ingresa el correo de la cuenta.');

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: correo,
  });

  if (error) throw traducirErrorAuth(error);
}

/**
 * Cambia la cuenta activa reutilizando la sesión guardada. Si el refresh token
 * ya no es válido, lanza `SesionExpiradaError` para que la UI pida contraseña.
 */
export async function cambiarCuenta(cuentaId: string): Promise<CuentaRutinia> {
  const registro = await leerRegistro();
  if (registro.activaId === cuentaId) {
    return obtenerCuentaActiva();
  }

  const destino = registro.cuentas.find((cuenta) => cuenta.id === cuentaId);
  if (!destino) throw new Error('La cuenta seleccionada ya no existe en este dispositivo.');

  if (destino.tipo === 'local') {
    await guardarSesionActualSiHay();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return fijarCuentaActiva(ID_LOCAL);
  }

  const sesionGuardada = await leerSesionDe(cuentaId);
  if (!sesionGuardada) {
    destino.sesionGuardada = false;
    await guardarRegistro(registro);
    throw new SesionExpiradaError(destino.email);
  }

  const anterior = await supabase.auth.getSession();
  await guardarSesionActualSiHay();

  const { data, error } = await supabase.auth.setSession({
    access_token: sesionGuardada.access_token,
    refresh_token: sesionGuardada.refresh_token,
  });

  if (error || !data.session || !data.user) {
    // Restauramos la sesión anterior para no dejar al usuario en tierra de nadie.
    const sesionAnterior = anterior.data.session;
    if (sesionAnterior?.user) {
      if (sesionAnterior.user.id !== cuentaId) {
        await supabase.auth
          .setSession({
            access_token: sesionAnterior.access_token,
            refresh_token: sesionAnterior.refresh_token,
          })
          .catch(() => undefined);
      }
      // El fallo puede haber emitido SIGNED_OUT y movido el registro al
      // perfil local. Devolvemos la cuenta anterior a su lugar.
      try {
        await fijarCuentaActiva(sesionAnterior.user.id);
      } catch {
        await fijarCuentaActiva(ID_LOCAL).catch(() => undefined);
      }
    } else {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await fijarCuentaActiva(ID_LOCAL).catch(() => undefined);
    }

    const mensaje = error?.message || '';
    if (/network|fetch|timeout|conexi[oó]n/i.test(mensaje)) {
      // Un corte de red no invalida el refresh token: conservamos el baúl
      // para poder reintentar cuando vuelva la conexión.
      throw new Error(
        'No hay conexión para restaurar esta cuenta. Revisa tu red e inténtalo de nuevo.'
      );
    }

    await borrarSesionDe(cuentaId);
    const registroActual = await leerRegistro();
    const cuenta = registroActual.cuentas.find((item) => item.id === cuentaId);
    if (cuenta) cuenta.sesionGuardada = false;
    await guardarRegistro(registroActual);
    notificar();

    // No mostramos el mensaje crudo de Supabase («Invalid JWT structure»,
    // «Refresh Token Not Found», etc.): el usuario solo necesita saber que
    // debe volver a entrar.
    throw new SesionExpiradaError(destino.email);
  }

  return activarSesion(data.session);
}

/**
 * Cierra la sesión de la cuenta activa. `olvidarSesion` (por defecto) revoca la
 * sesión en Supabase y borra el token local; la cuenta queda en la lista para
 * volver a entrar con contraseña.
 */
export async function cerrarSesionActual(opciones?: { olvidarSesion?: boolean }): Promise<void> {
  const olvidarSesion = opciones?.olvidarSesion ?? true;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const cuentaId = session?.user?.id ?? null;

  try {
    if (cuentaId) {
      // `local` cierra solo esta instalación: las demás sesiones del usuario
      // (otros móviles/navegadores) siguen activas. La copia de seguridad de
      // los tokens se borra aparte cuando `olvidarSesion` es true.
      await supabase.auth.signOut({ scope: 'local' });
      if (olvidarSesion) {
        await borrarSesionDe(cuentaId);
        const registro = await leerRegistro();
        const cuenta = registro.cuentas.find((item) => item.id === cuentaId);
        if (cuenta) cuenta.sesionGuardada = false;
        await guardarRegistro(registro);
      }
    }
  } finally {
    await fijarCuentaActiva(ID_LOCAL);
  }
}

/** Quita una cuenta del selector sin tocar sus datos en la nube. */
export async function quitarCuentaDelDispositivo(cuentaId: string): Promise<void> {
  if (cuentaId === ID_LOCAL) {
    throw new Error('El perfil local no se puede quitar; puedes limpiar sus datos.');
  }

  const registro = await leerRegistro();
  const esActiva = registro.activaId === cuentaId;

  if (esActiva) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await fijarCuentaActiva(ID_LOCAL);
  }

  await borrarSesionDe(cuentaId);
  await limpiarCacheDeCuenta(cuentaId);
  const actualizado = await leerRegistro();
  actualizado.cuentas = actualizado.cuentas.filter((cuenta) => cuenta.id !== cuentaId);
  if (actualizado.activaId === cuentaId) actualizado.activaId = ID_LOCAL;
  await guardarRegistro(actualizado);
  notificar();
}

/**
 * Elimina la cuenta activa y todos sus datos. Requiere ejecutar el RPC
 * `eliminar_mi_cuenta` (ver supabase_multicuenta.sql).
 */
export async function eliminarCuentaActual(): Promise<void> {
  const cuenta = await obtenerCuentaActiva();
  if (cuenta.tipo !== 'nube') {
    throw new Error('El perfil local no se elimina como una cuenta en la nube.');
  }

  const { error } = await supabase.rpc('eliminar_mi_cuenta');

  if (error) {
    const mensaje = (error.message || '').toLowerCase();
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      mensaje.includes('could not find the function') ||
      mensaje.includes('does not exist')
    ) {
      throw new EliminacionNoConfiguradaError();
    }
    throw new Error(`No se pudo eliminar la cuenta: ${error.message}`);
  }

  await borrarSesionDe(cuenta.id);
  await limpiarCacheDeCuenta(cuenta.id);
  const registro = await leerRegistro();
  registro.cuentas = registro.cuentas.filter((item) => item.id !== cuenta.id);
  registro.activaId = ID_LOCAL;
  await guardarRegistro(registro);

  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await fijarCuentaActiva(ID_LOCAL);
}

export async function actualizarPerfilActual(datos: {
  nombre?: string;
  color?: string;
}): Promise<CuentaRutinia> {
  const meta: Record<string, unknown> = {};
  if (datos.nombre !== undefined) meta.nombre = datos.nombre.trim();
  if (datos.color !== undefined) meta.color = datos.color;

  const { data, error } = await supabase.auth.updateUser({ data: meta });
  if (error) throw traducirErrorAuth(error);
  if (!data.user) throw new Error('No se pudo actualizar el perfil.');

  const registro = await leerRegistro();
  const cuenta = upsertCuentaEnRegistro(registro, data.user, true);
  await guardarRegistro(registro);
  notificar();
  await publicarCambioDeDatos();
  return cuenta;
}

export async function actualizarEmailActual(email: string): Promise<{
  requiereConfirmacion: boolean;
  mensaje: string;
}> {
  const nuevoEmail = email.trim();
  const { data, error } = await supabase.auth.updateUser({ email: nuevoEmail });
  if (error) throw traducirErrorAuth(error);

  const confirmado = data.user?.email?.toLowerCase() === nuevoEmail.toLowerCase();

  if (confirmado && data.user) {
    const registro = await leerRegistro();
    upsertCuentaEnRegistro(registro, data.user, true);
    await guardarRegistro(registro);
    notificar();
  }

  return {
    requiereConfirmacion: !confirmado,
    mensaje: confirmado
      ? 'Correo actualizado.'
      : `Te enviamos un enlace de confirmación a ${nuevoEmail}. El cambio se aplicará cuando lo confirmes.`,
  };
}

export async function actualizarPasswordActual(password: string): Promise<void> {
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw traducirErrorAuth(error);
}
