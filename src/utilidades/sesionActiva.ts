import { calcularSegundosTranscurridos, limpiarTimerSesion, obtenerOIniciarTimer } from './temporizador';
import { eliminarLocal, escribirLocal, leerLocal } from './almacenamientoLocal';

export type DropDraftItem = {
  orden: number;
  kg: string;
  reps: string;
  rir?: string;
};

export type SerieEjecucionDraft = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
  completado: boolean;
  repsParciales?: number;
  tieneParciales?: boolean;
  esDropset?: boolean;
  drops?: DropDraftItem[];
};

export type EjercicioStateDraft = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieEjecucionDraft[];
  sustituye_a_nombre?: string | null;
  sustituye_a_ejercicio_id?: string | null;
  sustitucion_alcance?: 'solo_hoy' | 'rutina' | null;
  notaEjercicio?: string;
};


export type BorradorSesion = {
  registroId: string;
  nombreRutina: string;
  fechaISO: string;
  notasSesion: string;
  ejerciciosState: EjercicioStateDraft[];
  /** Último ejercicio que el usuario tenía seleccionado en la sesión. */
  ejercicioActivoIndex?: number;
  updatedAt: number;
};

export type SesionActivaInfo = {
  registroId: string;
  nombreRutina: string;
  fechaISO: string;
  segsTranscurridos: number;
  seriesCompletadas: number;
  totalSeries: number;
  /** Indica si el cronómetro está detenido por una pausa manual. */
  pausado: boolean;
  /** Momento en el que se calculó `segsTranscurridos` (para animar sin desfases). */
  actualizadoEn: number;
};

const BORRADOR_SUFIJO = 'sesion_borrador_';
const SESION_ACTIVA_SUFIJO = 'sesion_activa_id';

function getBorradorSufijo(registroId: string): string {
  return `${BORRADOR_SUFIJO}${registroId}`;
}

type SesionListener = (info: SesionActivaInfo | null) => void;
const sesionListeners = new Set<SesionListener>();

/**
 * Permite suscribirse en tiempo real a cualquier cambio en la sesión en vivo
 * (inicio, progreso de series, salida, descarte o finalización).
 */
export function subscribirSesionActiva(fn: SesionListener): () => void {
  sesionListeners.add(fn);
  return () => {
    sesionListeners.delete(fn);
  };
}

/**
 * Notifica a todas las pantallas (Home, Calendario, etc.) sobre el estado actual
 * de la sesión activa en 0 ms.
 */
export async function emitirCambioSesionActiva(): Promise<void> {
  try {
    const info = await obtenerSesionActivaInfo();
    for (const fn of sesionListeners) {
      try {
        fn(info);
      } catch (err) {
        console.warn('Error en listener de sesión activa:', err);
      }
    }
  } catch (err) {
    console.warn('Error emitiendo cambio de sesión activa:', err);
  }
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
    ejercicioActivoIndex?: number;
  }
): Promise<void> {
  try {
    const borrador: BorradorSesion = {
      registroId,
      nombreRutina: data.nombreRutina,
      fechaISO: data.fechaISO,
      notasSesion: data.notasSesion,
      ejerciciosState: data.ejerciciosState,
      ejercicioActivoIndex: Math.max(0, Math.floor(data.ejercicioActivoIndex ?? 0)),
      updatedAt: Date.now(),
    };
    await escribirLocal(getBorradorSufijo(registroId), JSON.stringify(borrador));
    await escribirLocal(SESION_ACTIVA_SUFIJO, registroId);
    await emitirCambioSesionActiva();
  } catch (err) {
    console.warn('Error guardando borrador de sesión:', err);
  }
}

/**
 * Obtiene el borrador guardado para un registro de entrenamiento.
 */
export async function obtenerBorradorSesion(registroId: string): Promise<BorradorSesion | null> {
  try {
    const raw = await leerLocal(getBorradorSufijo(registroId));
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
    const activeId = await leerLocal(SESION_ACTIVA_SUFIJO);
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
      pausado: timerState.pausado,
      actualizadoEn: Date.now(),
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
    await eliminarLocal(getBorradorSufijo(registroId));
    const activeId = await leerLocal(SESION_ACTIVA_SUFIJO);
    if (activeId === registroId) {
      await eliminarLocal(SESION_ACTIVA_SUFIJO);
    }
    await limpiarTimerSesion(registroId);
    await emitirCambioSesionActiva();
  } catch (err) {
    console.warn('Error limpiando sesión activa:', err);
  }
}
