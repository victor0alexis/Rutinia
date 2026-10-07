import AsyncStorage from '@react-native-async-storage/async-storage';

export type EstadoTimer = {
  registroId: string;
  startTime: number;
  pausado: boolean;
  acumuladoPausaSegundos: number;
  ultimaPausaTimestamp: number | null;
};

const TIMER_KEY_PREFIX = 'rutinia_timer_sesion_';

/**
 * Obtiene la clave de almacenamiento para el timer de un registro.
 */
function getKey(registroId: string): string {
  return `${TIMER_KEY_PREFIX}${registroId}`;
}

/**
 * Guarda o recupera el inicio del timer de una sesión.
 * Si ya existe, lo retorna; si no, crea un nuevo timer y guarda el timestamp actual.
 */
export async function obtenerOIniciarTimer(registroId: string): Promise<EstadoTimer> {
  try {
    const raw = await AsyncStorage.getItem(getKey(registroId));
    if (raw) {
      const estado = JSON.parse(raw) as EstadoTimer;
      return estado;
    }
  } catch (err) {
    console.warn('Error leyendo timer de sesión:', err);
  }

  // Si no existía, creamos uno nuevo
  const nuevoTimer: EstadoTimer = {
    registroId,
    startTime: Date.now(),
    pausado: false,
    acumuladoPausaSegundos: 0,
    ultimaPausaTimestamp: null,
  };

  await guardarEstadoTimer(nuevoTimer);
  return nuevoTimer;
}

/**
 * Guarda el estado actual del timer en AsyncStorage.
 */
export async function guardarEstadoTimer(estado: EstadoTimer): Promise<void> {
  try {
    await AsyncStorage.setItem(getKey(estado.registroId), JSON.stringify(estado));
  } catch (err) {
    console.warn('Error guardando timer de sesión:', err);
  }
}

/**
 * Pausa o reanuda el timer guardando la diferencia en caché.
 */
export async function alternarPausaTimer(estado: EstadoTimer): Promise<EstadoTimer> {
  const ahora = Date.now();
  let nuevoEstado: EstadoTimer;

  if (estado.pausado) {
    // Reanudar
    const tiempoPausadoSeg = estado.ultimaPausaTimestamp
      ? Math.floor((ahora - estado.ultimaPausaTimestamp) / 1000)
      : 0;

    nuevoEstado = {
      ...estado,
      pausado: false,
      acumuladoPausaSegundos: estado.acumuladoPausaSegundos + tiempoPausadoSeg,
      ultimaPausaTimestamp: null,
    };
  } else {
    // Pausar
    nuevoEstado = {
      ...estado,
      pausado: true,
      ultimaPausaTimestamp: ahora,
    };
  }

  await guardarEstadoTimer(nuevoEstado);
  return nuevoEstado;
}

/**
 * Calcula los segundos transcurridos reales considerando salidas de la app y pausas.
 */
export function calcularSegundosTranscurridos(estado: EstadoTimer): number {
  const ahora = Date.now();
  const duracionBrutaSeg = Math.floor((ahora - estado.startTime) / 1000);

  let pausasTotales = estado.acumuladoPausaSegundos;

  if (estado.pausado && estado.ultimaPausaTimestamp) {
    pausasTotales += Math.floor((ahora - estado.ultimaPausaTimestamp) / 1000);
  }

  const neto = duracionBrutaSeg - pausasTotales;
  return Math.max(0, neto);
}

/**
 * Elimina la caché del timer al finalizar o descartar una sesión.
 */
export async function limpiarTimerSesion(registroId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getKey(registroId));
  } catch (err) {
    console.warn('Error limpiando timer de sesión:', err);
  }
}

/**
 * Formatea segundos en formato legible: `HH:MM:SS` o `MM:SS`.
 */
export function formatearTiempo(segundosTotales: number): string {
  const hrs = Math.floor(segundosTotales / 3600);
  const mins = Math.floor((segundosTotales % 3600) / 60);
  const segs = segundosTotales % 60;

  const mm = mins.toString().padStart(2, '0');
  const ss = segs.toString().padStart(2, '0');

  if (hrs > 0) {
    const hh = hrs.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Formatea segundos en texto natural corto: `45 min 20 seg` o `1h 15 min`.
 */
export function formatearTiempoTexto(segundosTotales: number): string {
  const hrs = Math.floor(segundosTotales / 3600);
  const mins = Math.floor((segundosTotales % 3600) / 60);
  const segs = segundosTotales % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins} min`;
  }
  if (mins > 0) {
    return `${mins} min ${segs} seg`;
  }
  return `${segs} seg`;
}
