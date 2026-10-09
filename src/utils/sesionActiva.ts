import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcularSegundosTranscurridos, limpiarTimerSesion, obtenerOIniciarTimer } from './timer';

export type SerieEjecucionDraft = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
  completado: boolean;
};

export type EjercicioStateDraft = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieEjecucionDraft[];
};

export type BorradorSesion = {
  registroId: string;
  nombreRutina: string;
  fechaISO: string;
  notasSesion: string;
  ejerciciosState: EjercicioStateDraft[];
  updatedAt: number;
};

export type SesionActivaInfo = {
  registroId: string;
  nombreRutina: string;
  fechaISO: string;
  segsTranscurridos: number;
  seriesCompletadas: number;
  totalSeries: number;
};

const BORRADOR_PREFIX = 'rutinia_sesion_borrador_';
const SESION_ACTIVA_KEY = 'rutinia_sesion_activa_id';

function getBorradorKey(registroId: string): string {
  return `${BORRADOR_PREFIX}${registroId}`;
}

/**
 * Guarda el estado en vivo (series, peso, reps, notas) y marca la sesión como activa.
 */
export async function guardarBorradorSesion(
  registroId: string,
  data: {
    nombreRutina: string;
    fechaISO: string;
    notasSesion: string;
    ejerciciosState: EjercicioStateDraft[];
  }
): Promise<void> {
  try {
    const borrador: BorradorSesion = {
      registroId,
      nombreRutina: data.nombreRutina,
      fechaISO: data.fechaISO,
      notasSesion: data.notasSesion,
      ejerciciosState: data.ejerciciosState,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(getBorradorKey(registroId), JSON.stringify(borrador));
    await AsyncStorage.setItem(SESION_ACTIVA_KEY, registroId);
  } catch (err) {
    console.warn('Error guardando borrador de sesión:', err);
  }
}

/**
 * Obtiene el borrador guardado para un registro de entrenamiento.
 */
export async function obtenerBorradorSesion(registroId: string): Promise<BorradorSesion | null> {
  try {
    const raw = await AsyncStorage.getItem(getBorradorKey(registroId));
    if (raw) {
      return JSON.parse(raw) as BorradorSesion;
    }
  } catch (err) {
    console.warn('Error obteniendo borrador de sesión:', err);
  }
  return null;
}

/**
 * Revisa si existe una sesión activa sin finalizar al abrir/volver a la app.
 */
export async function obtenerSesionActivaInfo(): Promise<SesionActivaInfo | null> {
  try {
    const activeId = await AsyncStorage.getItem(SESION_ACTIVA_KEY);
    if (!activeId) return null;

    const borrador = await obtenerBorradorSesion(activeId);
    if (!borrador) return null;

    const timerState = await obtenerOIniciarTimer(activeId);
    const segsTranscurridos = calcularSegundosTranscurridos(timerState);

    let seriesCompletadas = 0;
    let totalSeries = 0;
    borrador.ejerciciosState.forEach((ej) => {
      totalSeries += ej.series.length;
      seriesCompletadas += ej.series.filter((s) => s.completado).length;
    });

    return {
      registroId: activeId,
      nombreRutina: borrador.nombreRutina || 'Entrenamiento',
      fechaISO: borrador.fechaISO,
      segsTranscurridos,
      seriesCompletadas,
      totalSeries,
    };
  } catch (err) {
    console.warn('Error obteniendo sesión activa:', err);
    return null;
  }
}

/**
 * Limpia el borrador, el timer y la marca de sesión activa.
 */
export async function limpiarSesionActiva(registroId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getBorradorKey(registroId));
    const activeId = await AsyncStorage.getItem(SESION_ACTIVA_KEY);
    if (activeId === registroId) {
      await AsyncStorage.removeItem(SESION_ACTIVA_KEY);
    }
    await limpiarTimerSesion(registroId);
  } catch (err) {
    console.warn('Error limpiando sesión activa:', err);
  }
}
