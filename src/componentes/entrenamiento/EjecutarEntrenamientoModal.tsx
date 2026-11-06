import { styles } from './EjecutarEntrenamientoModal.estilos';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes, noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import FondoPantalla from '../comunes/FondoPantalla';
import { BotonMetalLiquido } from '../efectos/BotonMetalLiquido';
import CarruselEjerciciosEncabezado from './CarruselEjerciciosEncabezado';
import HeroEjercicioActivo from './HeroEjercicioActivo';
import TablaSeriesFocus from './TablaSeriesFocus';
import HistorialEjercicioModal from './HistorialEjercicioModal';
import ResumenEntrenamientoModal from './ResumenEntrenamientoModal';
import type { EdicionResumen, EjercicioResumen } from './ResumenEntrenamientoModal';
import SelectorBibliotecaModal from '../biblioteca/SelectorBibliotecaModal';
import TecladoEntrenamientoInteligente, { CampoEntrenamiento } from './TecladoEntrenamientoInteligente';
import ConfiguracionCargaEjercicioModal from './ConfiguracionCargaEjercicioModal';
import {
  actualizarEjecucionEjercicio,
  actualizarEstadoRegistro,
  guardarNotaSesion,
  sincronizarNotasEjercicios,
  obtenerHistorialPrevioRutina,
  obtenerHistorialPrevioEjercicio,
  eliminarEjerciciosObsoletos,
  crearEjercicioRegistroSesion,
} from '../../servicios/registros';
import type { SesionHistorialEjercicio } from '../../servicios/registros';
import { agregarEjercicioARutina, reemplazarEjercicioEnRutina } from '../../servicios/rutinas';
import { seguro, mostrarMensaje } from '../../utilidades/errores';
import { parsearEjercicioInfo } from '../../utilidades/ejercicios';
import {
  parsearNotaEjercicio,
  parsearNotasSesion,
} from '../../utilidades/notasSesion';
import { nombreDia } from '../../utilidades/fechas';
import { Registro, CargaSerie, TipoCarga } from '../../tipos';
import { calcularKgSugeridoDrop } from '../../constantes/entrenamiento';
import { leerPreferenciasCarga, guardarPreferenciaCarga, normalizarPreferenciaCarga, PREFERENCIA_CARGA_POR_DEFECTO, normalizarNombreParaPreferencia, calcularKgDesdeCarga, convertirCargaAModo, formatearPreviaSerie, inferirTipoCargaDesdeSeries, recalcularPesoDeCarga } from '../../utilidades/cargasEjercicio';
import {
  EstadoTimer,
  obtenerOIniciarTimer,
  alternarPausaTimer,
  calcularSegundosTranscurridos,
  formatearTiempo,
} from '../../utilidades/temporizador';
import {
  guardarBorradorSesion,
  obtenerBorradorSesion,
  limpiarSesionActiva,
  emitirCambioSesionActiva,
} from '../../utilidades/sesionActiva';
export type FocusTeclado = {
  ejIdx: number;
  sIdx: number;
  campo: CampoEntrenamiento;
  dropIdx?: number;
} | null;
type Props = {
  visible: boolean;
  registro: Registro | null;
  fecha: Date | null;
  onClose: () => void;
  onGuardado: () => void;
  /** Si true, salta el lobby directamente al workout (usado al reanudar sesión guardada) */
  modoReanudar?: boolean;
  /** Si true, entra directamente en modo visualización de resumen (solo lectura) sin iniciar cronómetro ni alterar la sesión */
  modoResumen?: boolean;
};
export type DropItemEjecucion = {
  orden: number;
  kg: string;
  reps: string;
  rir?: string;
};
export type SerieEjecucion = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  repsMin?: number;
  repsMax?: number;
  carga?: CargaSerie;
  cargaI?: CargaSerie;
  pesoKgD?: number | null;
  pesoKgI?: number | null;
  rir: string;
  nota: string;
  completado: boolean;
  repsParciales: number;
  tieneParciales: boolean;
  esDropset: boolean;
  drops: DropItemEjecucion[];
  tipo?: 'normal' | 'calentamiento' | 'fallo';
  estado?: 'normal' | 'fallo' | 'no_hecha';
};
export type EjercicioState = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieEjecucion[];
  sustituye_a_nombre?: string | null;
  sustituye_a_ejercicio_id?: string | null;
  sustitucion_alcance?: 'solo_hoy' | 'rutina' | null;
  notaEjercicio?: string;
  origenSesion?: 'rutina' | 'solo_hoy';
  ordenSesion?: number;
  modoKg?: TipoCarga;
  modoReps?: 'reps' | 'rango';
};
type SerieHistorica = {
  peso: string;
  reps: string;
  repsMin?: number;
  repsMax?: number;
  rir: string;
  nota: string;
  repsParciales?: number;
  esDropset?: boolean;
  drops?: DropItemEjecucion[];
  carga?: CargaSerie;
  cargaI?: CargaSerie;
};
type HistoricoEjercicio = {
  fechaFormateada: string;
  series: SerieHistorica[];
};
type HistoricoMap = Record<string, HistoricoEjercicio>;
function limitarIndiceEjercicio(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), total - 1);
}
/**
 * Si un borrador antiguo no guardó el ejercicio activo, inferimos el más
 * probable: el que tiene progreso parcial, luego el primero incompleto.
 */
function inferirEjercicioActivo(ejercicios: EjercicioState[]): number {
  if (ejercicios.length === 0) return 0;
  const enProgreso = ejercicios.findIndex(
    (ej) => ej.series.some((s) => s.completado) && ej.series.some((s) => !s.completado)
  );
  if (enProgreso >= 0) return enProgreso;
  const primeroIncompleto = ejercicios.findIndex((ej) =>
    ej.series.some((s) => !s.completado)
  );
  if (primeroIncompleto >= 0) return primeroIncompleto;
  return ejercicios.length - 1;
}
function generarIdTemporal(): string {
  return `${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;
}
function crearSerieVacia(): SerieEjecucion {
  return {
    id: generarIdTemporal(),
    peso: '',
    reps: '',
    pesoI: '',
    repsI: '',
    rir: '',
    nota: '',
    completado: false,
    estado: 'normal',
    repsParciales: 0,
    tieneParciales: false,
    esDropset: false,
    drops: [],
  };
}
function crearCargaInicial(preferencia: ReturnType<typeof normalizarPreferenciaCarga>): CargaSerie | undefined {
  if (preferencia.tipo === 'placas') return { tipo: 'placas', placas: 0 };
  if (preferencia.tipo === 'discos_barra' || preferencia.tipo === 'discos_maquina') {
    return {
      tipo: preferencia.tipo,
      pesoBase: preferencia.tipo === 'discos_barra' ? preferencia.pesoBarra : preferencia.pesoBase,
      discosPorLado: [],
    };
  }
  return undefined;
}
/**
 * El modo guardado solo se usa si alguna serie lo respalda. Así los borradores
 * antiguos que cambiaron el encabezado sin cambiar la carga no muestran un
 * modo que no se corresponde con sus datos.
 */
function resolverModoCargaEjercicio(ej: EjercicioState): TipoCarga {
  if (ej.modoKg && ej.series.some((serie) => (serie.carga?.tipo ?? 'kg') === ej.modoKg)) {
    return ej.modoKg;
  }
  return inferirTipoCargaDesdeSeries(ej.series);
}
function resolverModoRepsEjercicio(ej: EjercicioState): 'reps' | 'rango' {
  if (ej.modoReps) return ej.modoReps;
  return ej.series.some((serie) => serie.repsMin || serie.repsMax) ? 'rango' : 'reps';
}

/** Copia profunda de series para que el nuevo ejercicio no comparta referencias. */
function heredarSeries(series: SerieEjecucion[]): SerieEjecucion[] {
  return series.map((serie) => ({
    ...serie,
    id: generarIdTemporal(),
    drops: (serie.drops || []).map((drop) => ({ ...drop })),
  }));
}
function esIdTemporal(id: string): boolean {
  return id.includes('.') || id.startsWith('draft_') || id.startsWith('temp_');
}
/** Convierte un valor numérico de texto a número, o null si no es válido. */
function numeroONull(valor?: string): number | null {
  if (!valor) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
const SUGERENCIAS_NOTA_EJERCICIO = [
  'Asiento 4',
  'Altura 5',
  'Agarre medio',
  'Tempo 3-1-1',
  'Pausa 2 s',
  'Rango completo',
  'Control excéntrico',
  'Sin molestias',
];
export default function EjecutarEntrenamientoModal({
  visible,
  registro,
  fecha,
  onClose,
  onGuardado,
  modoReanudar = false,
  modoResumen = false,
}: Props) {
  const esModoResumen = Boolean(modoResumen || (registro?.completado && !modoReanudar));
  // ── Responsive layout centralizado con useLayout ───────────────────────────
  const {
    width,
    height: alturaPantalla,
    isLandscape,
    isTablet,
    gutter,
    contentMaxWidth,
    topInset,
    barBottomPadding,
    isKeyboardVisible,
  } = useLayout();
  const dockHeight = isLandscape ? 76 : 98;
  const [focusTeclado, setFocusTeclado] = useState<FocusTeclado>(null);
  // Altura real del teclado táctil de entrenamiento, para no tapar el campo activo.
  const [altoTecladoEntrenamiento, setAltoTecladoEntrenamiento] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const nodoFocoRef = useRef<View | null>(null);
  const registrarNodoFoco = useCallback((nodo: View | null) => {
    // Solo guardamos nodos válidos: al cambiar de fila, el desmontaje del ref
    // anterior no debe borrar el nodo nuevo ya registrado.
    if (nodo) nodoFocoRef.current = nodo;
  }, []);
  const scrollBottomPad = (
    focusTeclado
      ? Math.max(altoTecladoEntrenamiento + 16, 320)
      : isKeyboardVisible
      ? 16
      : dockHeight
  ) + barBottomPadding + 20;
  const [ejerciciosState, setEjerciciosState] = useState<EjercicioState[]>([]);
  const ejerciciosStateActualRef = useRef(ejerciciosState);
  const [preferenciasCarga, setPreferenciasCarga] = useState<Record<string, ReturnType<typeof normalizarPreferenciaCarga>>>({});
  const [ejercicioActivoIndex, setEjercicioActivoIndex] = useState(0);
  // Espejo síncrono del índice activo: evita que un guardado en vuelo escriba
  // un índice anterior y que la sesión reanude en el ejercicio equivocado.
  const ejercicioActivoIndexRef = useRef(0);
  const [notasSesion, setNotasSesion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialMap, setHistorialMap] = useState<HistoricoMap>({});
  // ESTADO DE LOBBY / PRE-PARTIDA
  const [enLobby, setEnLobby] = useState(true);
  // TIMER PERSISTENTE (Único cronómetro de la sesión)
  const [estadoTimer, setEstadoTimer] = useState<EstadoTimer | null>(null);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // MODAL RESUMEN Y CONFIRMACIÓN
  const [resumenVisible, setResumenVisible] = useState(false);
  // ESTADOS PARA MENÚS DE SERIE, EJERCICIO E INTERCAMBIO
  const [serieMenu, setSerieMenu] = useState<{ ejIdx: number; sIdx: number } | null>(null);
  const [ejercicioMenu, setEjercicioMenu] = useState<number | null>(null);
  const [selectorIntercambio, setSelectorIntercambio] = useState<{ ejIdx: number; modo: 'solo_hoy' | 'rutina'; accion?: 'agregar'; posicion?: number } | null>(null);
  const [alcanceAgregar, setAlcanceAgregar] = useState<{ modo: 'solo_hoy' | 'rutina'; posicion: 'final' | 'despues' } | null>(null);
  const [reemplazoMenu, setReemplazoMenu] = useState<{ ejIdx: number } | null>(null);
  const [previaEjercicio, setPreviaEjercicio] = useState<{ ejIdx: number; nombre: string } | null>(null);
  const [solicitudTutorial, setSolicitudTutorial] = useState(0);
  const [modalNotaEjercicio, setModalNotaEjercicio] = useState<{ ejIdx: number; nota: string } | null>(null);
  const [configuracionCargaIdx, setConfiguracionCargaIdx] = useState<number | null>(null);
  useEffect(() => { leerPreferenciasCarga().then(setPreferenciasCarga).catch(() => undefined); }, []);
  useEffect(() => { ejerciciosStateActualRef.current = ejerciciosState; }, [ejerciciosState]);
  const [confirmacionPermanente, setConfirmacionPermanente] = useState<{
    ejIdx: number;
    nombreOriginal: string;
    nombreRutinaOriginal: string;
    nuevoNombre: string;
    ejercicioAnterior: EjercicioState;
    ejercicioNuevo: EjercicioState;
  } | null>(null);
  // SNACKBAR CON DESHACER (6 SEGUNDOS)
  const [snackbar, setSnackbar] = useState<{ mensaje: string; onDeshacer?: () => void; textoAccion?: string } | null>(null);
  const snackbarTimerRef = useRef<any>(null);
  const mostrarSnackbar = (mensaje: string, onDeshacer?: () => void, textoAccion?: string) => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    setSnackbar({ mensaje, onDeshacer, textoAccion });
    snackbarTimerRef.current = setTimeout(() => {
      setSnackbar(null);
    }, 6000);
  };
  // Cargar o restaurar sesión
  useEffect(() => {
    if (!visible || !registro) return;
    let cancelado = false;
    const timer = setTimeout(async () => {
      const borradorPrevio = await obtenerBorradorSesion(registro.id);
      let parsedEjercicios: EjercicioState[] = [];
      let notasTexto = '';
      if (!esModoResumen && borradorPrevio && borradorPrevio.ejerciciosState && borradorPrevio.ejerciciosState.length > 0) {
        parsedEjercicios = borradorPrevio.ejerciciosState.map((ej) => ({
          ...ej,
          esUnilateral: ej.esUnilateral ?? parsearEjercicioInfo({ nombre: ej.nombre }).esUnilateral,
          series: ej.series.map((s) => {
            const estado = s.estado || (s.tipo === 'fallo' ? 'fallo' : 'normal');
            return {
              ...s,
              repsParciales: s.repsParciales || 0,
              tieneParciales: Boolean(s.tieneParciales || (s.repsParciales && s.repsParciales > 0)),
              esDropset: Boolean(s.esDropset || (s.drops && s.drops.length > 0)),
              drops: s.drops ? s.drops.map((d) => ({ ...d })) : [],
              estado,
              tipo: s.tipo || (estado === 'fallo' ? 'fallo' : 'normal'),
              // Un estado no_hecha nunca puede quedar completado; un fallo
              // siempre cuenta como completado y parte de RIR 0.
              completado: estado === 'no_hecha' ? false : estado === 'fallo' ? true : s.completado,
              rir: estado === 'fallo' && !s.rir ? '0' : s.rir,
              repsMin: s.repsMin,
              repsMax: s.repsMax,
            };
          }),
        }));
        notasTexto = borradorPrevio.notasSesion || '';
      } else {
        const notaSesionGuardada = parsearNotasSesion(registro.notas);
        // Las notas por ejercicio se guardan como filas 📌 para que conserven
        // el nombre del ejercicio al que pertenecen.
        const notasEjercicio = new Map<string, string>();
        (registro.ejercicios_registro || []).forEach((fila) => {
          const parsed = parsearNotaEjercicio(fila as any);
          if (parsed && parsed.nota) {
            notasEjercicio.set(parsed.nombreEjercicio.trim().toLowerCase(), parsed.nota);
          }
        });
        const obsExistente = (registro.ejercicios_registro || []).find((e) =>
          e.nombre.includes('📌 [OBSERVACIONES]')
        );
        notasTexto =
          notaSesionGuardada.nota ||
          (obsExistente
            ? obsExistente.nombre.replace('📌 [OBSERVACIONES] ', '').trim()
            : '');
        const ejsPure = (registro.ejercicios_registro || []).filter(
          (e) => !e.nombre.startsWith('📌')
        );
        parsedEjercicios = ejsPure.map((e) => {
          const parsed = parsearEjercicioInfo(e);
          let cargasGuardadas: { carga?: CargaSerie | null; cargaI?: CargaSerie | null }[] = [];
          try { cargasGuardadas = JSON.parse((e as any).detalles_json || '[]'); } catch { cargasGuardadas = []; }
          const numSeries = e.series || parsed.detallesSets.length || 1;
          const seriesArray: SerieEjecucion[] = Array.from({ length: numSeries }, (_, i) => {
            const sDetail = parsed.detallesSets[i];
            let pesoStr = sDetail?.pesoD || (e.peso ? e.peso.toString() : '');
            let repsStr = sDetail?.repsD || (e.repeticiones ? e.repeticiones.toString() : '');
            let pesoIStr = sDetail?.pesoI || '';
            let repsIStr = sDetail?.repsI || '';
            let rirStr = sDetail?.rir || '';
            let notaStr = sDetail?.nota || '';
            if (!sDetail?.pesoD && sDetail?.resumen) {
              const matchK = sDetail.resumen.match(/(\d+(\.\d+)?)k/);
              if (matchK) pesoStr = matchK[1];
              const matchR = sDetail.resumen.match(/(\d+)r/);
              if (matchR) repsStr = matchR[1];
            }
            const rParciales = sDetail?.repsParciales || 0;
            const tieneP = Boolean(sDetail?.tieneParciales || rParciales > 0);
            const esDrop = Boolean(sDetail?.esDropset || (sDetail?.drops && sDetail.drops.length > 0));
            const dropsArray: DropItemEjecucion[] = (sDetail?.drops || []).map((d) => ({
              orden: d.orden,
              kg: d.kg,
              reps: d.reps,
              rir: d.rir,
            }));
            const estado =
              (cargasGuardadas[i] as any)?.estado ||
              sDetail?.estado ||
              ((cargasGuardadas[i] as any)?.tipo === 'fallo' ? 'fallo' : 'normal');
            return {
              id: i.toString() + Math.random().toString(),
              peso: pesoStr,
              reps: repsStr,
              pesoI: pesoIStr,
              repsI: repsIStr,
              carga: cargasGuardadas[i]?.carga || undefined,
              cargaI: cargasGuardadas[i]?.cargaI || undefined,
              rir: estado === 'fallo' && !rirStr ? '0' : rirStr,
              nota: notaStr,
              completado:
                estado === 'no_hecha'
                  ? false
                  : estado === 'fallo'
                  ? true
                  : sDetail
                  ? sDetail.completado
                  : Boolean(e.completado),
              repsParciales: rParciales,
              tieneParciales: tieneP,
              esDropset: esDrop,
              drops: dropsArray,
              estado,
              tipo: (cargasGuardadas[i] as any)?.tipo || sDetail?.tipo || 'normal',
              repsMin: (cargasGuardadas[i] as any)?.repsMin ?? sDetail?.repsMin ?? undefined,
              repsMax: (cargasGuardadas[i] as any)?.repsMax ?? sDetail?.repsMax ?? undefined,
            };
          });
          return {
            id: e.id,
            nombre: parsed.nombreLimpio,
            esUnilateral: parsed.esUnilateral,
            series: seriesArray,
            sustituye_a_nombre: parsed.sustituyeANombre || (e as any).sustituye_a_nombre || null,
            sustituye_a_ejercicio_id: (e as any).sustituye_a_ejercicio_id || null,
            sustitucion_alcance: (e as any).sustitucion_alcance || null,
            notaEjercicio: notasEjercicio.get(parsed.nombreLimpio.trim().toLowerCase()) || '',
            origenSesion: (cargasGuardadas[0] as any)?.origenSesion || 'rutina',
            ordenSesion: Number((cargasGuardadas[0] as any)?.ordenSesion) || 0,
          };
        });
      }
      const indiceRestaurado = limitarIndiceEjercicio(
        borradorPrevio?.ejercicioActivoIndex ?? inferirEjercicioActivo(parsedEjercicios),
        parsedEjercicios.length
      );
      setNotasSesion(notasTexto);
      setEjerciciosState(parsedEjercicios);
      ejercicioActivoIndexRef.current = indiceRestaurado;
      setEjercicioActivoIndex(indiceRestaurado);
      // Guardar borrador inicial solo si la sesión está en curso o nueva (no en modo resumen)
      if (!esModoResumen) {
        const nombreRutina = registro.rutinas?.nombre || 'Entrenamiento';
        await guardarBorradorSesion(registro.id, {
          nombreRutina,
          fechaISO: registro.fecha,
          notasSesion: notasTexto,
          ejerciciosState: parsedEjercicios,
          ejercicioActivoIndex: indiceRestaurado,
        });
      }
      // Cargar historial previo
      if (registro.rutina_id) {
        const sesionPrevia = await obtenerHistorialPrevioRutina(registro.rutina_id, registro.fecha);
        if (!cancelado && sesionPrevia) {
          const map: HistoricoMap = {};
          const dObj = new Date(sesionPrevia.fecha + 'T12:00:00');
          const fechaPrevStr = `${nombreDia(dObj)} ${dObj.getDate()}`;
          for (const ePrev of sesionPrevia.ejercicios_registro || []) {
            if (ePrev.nombre.startsWith('📌')) continue;
            const parsedPrev = parsearEjercicioInfo(ePrev);
            const nLimpio = parsedPrev.nombreLimpio;
            let cargasPrevias: { carga?: CargaSerie | null; cargaI?: CargaSerie | null }[] = [];
            try { cargasPrevias = JSON.parse((ePrev as any).detalles_json || '[]'); } catch { cargasPrevias = []; }
            const sPrevArray: SerieHistorica[] = parsedPrev.detallesSets.map((ds) => ({
              peso: ds.pesoD || (ePrev.peso ? ePrev.peso.toString() : ''),
              reps: ds.repsD || (ePrev.repeticiones ? ePrev.repeticiones.toString() : ''),
              repsMin: ds.repsMin,
              repsMax: ds.repsMax,
              rir: ds.rir || '',
              nota: ds.nota || '',
              repsParciales: ds.repsParciales || 0,
              esDropset: ds.esDropset || false,
              drops: ds.drops ? ds.drops.map((d) => ({ ...d })) : [],
              carga: cargasPrevias[ds.setNum - 1]?.carga || undefined,
              cargaI: cargasPrevias[ds.setNum - 1]?.cargaI || undefined,
            }));
            map[nLimpio] = {
              fechaFormateada: fechaPrevStr,
              series: sPrevArray.length > 0 ? sPrevArray : [
                {
                  peso: ePrev.peso ? ePrev.peso.toString() : '',
                  reps: ePrev.repeticiones ? ePrev.repeticiones.toString() : '',
                  rir: '',
                  nota: '',
                },
              ],
            };
          }
          setHistorialMap(map);
        }
      }
      // Si estamos en modo resumen (sesión completada), no iniciar timer ni lobby
      if (esModoResumen) {
        let duracionSegs = parsearNotasSesion(registro.notas).duracionSegundos;
        if (duracionSegs <= 0) {
          try {
            const val = await AsyncStorage.getItem(`rutinia_duracion_${registro.id}`);
            if (val) {
              const num = Number(val);
              if (!isNaN(num) && num > 0) duracionSegs = num;
            }
          } catch {}
        }
        if (!cancelado) {
          setEstadoTimer(null);
          setSegundosTranscurridos(duracionSegs);
          setEnLobby(false);
          setResumenVisible(true);
        }
      } else {
        // Inicializar / Restaurar Timer de la Sesión
        const timerState = await obtenerOIniciarTimer(registro.id);
        if (!cancelado) {
          setEstadoTimer(timerState);
          const segs = calcularSegundosTranscurridos(timerState);
          setSegundosTranscurridos(segs);
          // Si ya han pasado más de 5 segundos, había progreso guardado, o se viene de reanudar → salta lobby
          const algunaCompletada = parsedEjercicios.some((ej) => ej.series.some((s) => s.completado));
          const tieneBorrador = Boolean(borradorPrevio && borradorPrevio.ejerciciosState && borradorPrevio.ejerciciosState.length > 0);
          if (modoReanudar || segs > 5 || algunaCompletada || tieneBorrador) {
            setEnLobby(false);
          } else {
            setEnLobby(true);
          }
        }
      }
    }, 0);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [visible, registro, modoReanudar, esModoResumen]);
  // Manejador del Interval del Timer (se actualiza cada 1 seg de manera eficiente)
  useEffect(() => {
    if (!visible || !estadoTimer) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      const segs = calcularSegundosTranscurridos(estadoTimer);
      setSegundosTranscurridos(segs);
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [visible, estadoTimer]);
  // Estado y datos para el Modo Focus de Entrenamiento en Vivo.
  // Estos hooks deben ejecutarse antes del early return para no romper el
  // orden de hooks cuando `fecha` o `registro` cambian.
  const itemsCarrusel = useMemo(() => {
    return ejerciciosState.map((ej, idx) => ({
      id: ej.id || `ej-${idx}`,
      nombre: ej.nombre,
      completado: ej.series.length > 0 && ej.series.every((s) => s.completado || s.estado === 'no_hecha'),
      totalSeries: ej.series.filter((s) => s.estado !== 'no_hecha').length,
      seriesCompletadas: ej.series.filter((s) => s.completado && s.estado !== 'no_hecha').length,
      origenSesion: ej.origenSesion || 'rutina',
    }));
  }, [ejerciciosState]);
  const indexValido = Math.min(
    Math.max(0, ejercicioActivoIndex),
    Math.max(0, ejerciciosState.length - 1)
  );
  const ejActivo = ejerciciosState[indexValido] || ejerciciosState[0];
  const modoKgActivo = ejActivo ? resolverModoCargaEjercicio(ejActivo) : 'kg';
  const modoRepsActivo = ejActivo ? resolverModoRepsEjercicio(ejActivo) : 'reps';
  const seriesFocus = useMemo(() => {
    if (!ejActivo) return [];
    const hist = historialMap[ejActivo.nombre];
    return ejActivo.series.map((s, sIdx) => {
      const prevSet = hist?.series[sIdx];
      const previaStr = prevSet ? formatearPreviaSerie(prevSet) : undefined;
      return {
        id: s.id,
        setNum: sIdx + 1,
        peso: s.peso,
        reps: s.reps,
        pesoI: s.pesoI,
        repsI: s.repsI,
        repsMin: s.repsMin,
        repsMax: s.repsMax,
        carga: s.carga,
        cargaI: s.cargaI,
        rir: s.rir,
        completado: s.completado,
        previa: previaStr,
        repsParciales: s.repsParciales,
        tipo: s.tipo || 'normal',
        estado: s.estado || 'normal',
        drops: (s.drops || []).map((d) => ({
          orden: d.orden,
          peso: d.kg,
          reps: d.reps,
          rir: d.rir,
          completado: s.completado,
        })),
      };
    });
  }, [ejActivo, historialMap]);
  const seriesCompletadasActivo = ejActivo
    ? ejActivo.series.filter((s) => s.completado && s.estado !== 'no_hecha').length
    : 0;
  const totalSeriesActivo = ejActivo?.series.filter((s) => s.estado !== 'no_hecha').length || 0;
  const indiceSerieDockRaw =
    ejActivo?.series.findIndex((s) => !s.completado && s.estado !== 'no_hecha') ?? -1;
  const indiceSerieDock = indiceSerieDockRaw >= 0 ? indiceSerieDockRaw : null;
  const siguienteEjercicioIdx =
    indexValido + 1 < ejerciciosState.length ? indexValido + 1 : null;
  const todasCompletadasActivo = Boolean(ejActivo?.series.length) && ejActivo.series.every((s) => s.completado || s.estado === 'no_hecha');
  // Mantiene el campo activo de la tabla visible por encima del teclado de
  // entrenamiento al enfocar una celda o al avanzar de campo/serie. Solo
  // desplaza lo necesario para evitar saltos al cambiar entre campos.
  useEffect(() => {
    if (!focusTeclado || altoTecladoEntrenamiento <= 0) return;
    const temporizador = setTimeout(() => {
      const nodo = nodoFocoRef.current;
      const scroll = scrollRef.current;
      // El handle nativo del ScrollView define el área visible real, también en web.
      const viewport = scroll?.getNativeScrollRef();
      if (!nodo || !scroll || !viewport) return;
      nodo.measureInWindow((_x, y, _ancho, alto) => {
        viewport.measureInWindow((_sx, sy, _sw, sh) => {
          const margen = 12;
          const limiteSuperior = sy + margen;
          const limiteInferior = sy + sh - altoTecladoEntrenamiento - margen;
          const espacioVisible = limiteInferior - limiteSuperior;
          let delta = 0;
          if (espacioVisible <= 0) {
            // El teclado cubre todo el área visible (p. ej. landscape muy bajo):
            // cualquier desplazamiento dejaría el campo oculto igualmente.
            return;
          }
          if (espacioVisible < alto) {
            // Cabe parte de la fila: llévala al borde superior para mostrar lo máximo posible.
            delta = y - limiteSuperior;
          } else if (y + alto > limiteInferior) {
            delta = y + alto - limiteInferior;
          } else if (y < limiteSuperior) {
            delta = y - limiteSuperior;
          }
          if (Math.abs(delta) < 1) return;
          scroll.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + delta),
            animated: true,
          });
        });
      });
    }, 80);
    return () => clearTimeout(temporizador);
  }, [focusTeclado, altoTecladoEntrenamiento, isKeyboardVisible, alturaPantalla, width]);
  if (!fecha || !registro) return null;
  const totalSeriesEnSesion = ejerciciosState.reduce((acc, ej) => acc + ej.series.filter((s) => s.estado !== 'no_hecha').length, 0);
  const totalSeriesCompletadas = ejerciciosState.reduce(
    (acc, ej) => acc + ej.series.filter((s) => s.completado && s.estado !== 'no_hecha').length,
    0
  );
  const totalSeriesNoHechas = ejerciciosState.reduce(
    (acc, ej) => acc + ej.series.filter((s) => s.estado === 'no_hecha').length,
    0
  );
  // Iniciar la sesión de entrenamiento desde el lobby
  const iniciarEntrenamiento = async () => {
    setEnLobby(false);
    if (registro) {
      const st = await obtenerOIniciarTimer(registro.id);
      setEstadoTimer(st);
    }
  };
  // Pausar o reanudar el timer
  const togglePausaTimer = async () => {
    if (!estadoTimer) return;
    const nuevoSt = await alternarPausaTimer(estadoTimer);
    setEstadoTimer(nuevoSt);
    setSegundosTranscurridos(calcularSegundosTranscurridos(nuevoSt));
    await emitirCambioSesionActiva();
  };
  const guardarDraftAuto = (
    nextState: EjercicioState[],
    nTexto: string = notasSesion,
    indiceActivo: number = ejercicioActivoIndexRef.current
  ) => {
    if (!registro || esModoResumen) return;
    const nombreRutina = registro.rutinas?.nombre || 'Entrenamiento';
    guardarBorradorSesion(registro.id, {
      nombreRutina,
      fechaISO: registro.fecha,
      notasSesion: nTexto,
      ejerciciosState: nextState,
      ejercicioActivoIndex: limitarIndiceEjercicio(indiceActivo, nextState.length),
    });
  };
  const fijarIndiceActivo = (index: number, total: number = ejerciciosState.length) => {
    const siguiente = limitarIndiceEjercicio(index, total);
    ejercicioActivoIndexRef.current = siguiente;
    setEjercicioActivoIndex(siguiente);
    return siguiente;
  };
  const seleccionarEjercicioActivo = (index: number) => {
    const siguiente = fijarIndiceActivo(index);
    setFocusTeclado(null);
    guardarDraftAuto(ejerciciosState, notasSesion, siguiente);
  };
  const cambiarNotasSesion = (texto: string) => {
    setNotasSesion(texto);
    guardarDraftAuto(ejerciciosState, texto);
  };
  const agregarSugerenciaNota = (sugerencia: string) => {
    setModalNotaEjercicio((prev) => {
      if (!prev) return prev;
      const actual = prev.nota.trim();
      if (actual.toLowerCase().includes(sugerencia.toLowerCase())) return prev;
      const nota = actual ? `${actual} · ${sugerencia}` : sugerencia;
      return { ...prev, nota };
    });
  };
  const toggleUnilateralEjercicio = (ejIdx: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIdx) return ej;
        const activar = !ej.esUnilateral;
        return {
          ...ej,
          esUnilateral: activar,
          series: activar
            ? ej.series.map((serie) => ({
                ...serie,
                cargaI:
                  serie.cargaI ??
                  (serie.carga
                    ? {
                        ...serie.carga,
                        discosPorLado: (serie.carga.discosPorLado || []).map((item) => ({ ...item })),
                      }
                    : undefined),
                pesoI: serie.pesoI !== undefined && serie.pesoI !== '' ? serie.pesoI : serie.peso,
                repsI: serie.repsI !== undefined && serie.repsI !== '' ? serie.repsI : serie.reps,
              }))
            : ej.series,
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const obtenerPreferenciaEjercicio = (ej: EjercicioState) =>
    preferenciasCarga[normalizarNombreParaPreferencia(ej.nombre)] || PREFERENCIA_CARGA_POR_DEFECTO;
  const preferenciaActiva = ejActivo ? obtenerPreferenciaEjercicio(ejActivo) : PREFERENCIA_CARGA_POR_DEFECTO;
  const resumenEquipoActivo =
    modoKgActivo === 'kg'
      ? 'Entrada directa en kg'
      : modoKgActivo === 'placas'
      ? preferenciaActiva.kgPorPlaca
        ? `${preferenciaActiva.kgPorPlaca} kg por placa`
        : 'Sin equivalencia en kg'
      : modoKgActivo === 'discos_barra'
      ? `Barra ${preferenciaActiva.pesoBarra} kg · ${preferenciaActiva.discosDisponibles.length} discos`
      : `Base ${preferenciaActiva.pesoBase} kg · ${preferenciaActiva.discosDisponibles.length} discos`;
  const ejercicioConfig =
    configuracionCargaIdx !== null ? ejerciciosState[configuracionCargaIdx] : null;
  const tipoConfig = ejercicioConfig ? resolverModoCargaEjercicio(ejercicioConfig) : 'kg';
  /**
   * El encabezado de Carga es la única fuente de verdad del modo. Al cambiarlo
   * se convierten todas las series del ejercicio para que las celdas y el
   * teclado editen siempre la misma unidad.
   */
  const aplicarModoCarga = (modo: TipoCarga) => {
    const ej = ejerciciosState[indexValido];
    if (!ej) return;
    const clave = normalizarNombreParaPreferencia(ej.nombre);
    const preferencia = { ...obtenerPreferenciaEjercicio(ej), tipo: modo };
    guardarPreferenciaCarga(ej.nombre, preferencia).catch(() => undefined);
    setPreferenciasCarga((prev) => ({ ...prev, [clave]: preferencia }));
    setEjerciciosState((prev) => {
      const next = prev.map((item, i) => {
        if (i !== indexValido) return item;
        return {
          ...item,
          modoKg: modo,
          series: item.series.map((serie) => {
            const principal = convertirCargaAModo(serie.carga, modo, serie.peso, preferencia);
            if (!item.esUnilateral) {
              return { ...serie, carga: principal.carga, peso: principal.peso };
            }
            const izquierdo = convertirCargaAModo(
              serie.cargaI,
              modo,
              serie.pesoI !== undefined && serie.pesoI !== '' ? serie.pesoI : serie.peso,
              preferencia
            );
            return {
              ...serie,
              carga: principal.carga,
              peso: principal.peso,
              cargaI: izquierdo.carga,
              pesoI: izquierdo.peso,
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const aplicarModoReps = (modo: 'reps' | 'rango') => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => (i === indexValido ? { ...ej, modoReps: modo } : ej));
      guardarDraftAuto(next);
      return next;
    });
  };
  // Cambiar un campo de una serie
  const cambiarCampoSerie = (
    ejIndex: number,
    sIndex: number,
    campo: keyof SerieEjecucion,
    val: any
  ) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => (sj === sIndex ? { ...s, [campo]: val } : s)),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const agregarSerieAEjercicio = (ejIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        const ultimaSerie = ej.series[ej.series.length - 1];
        return {
          ...ej,
          series: [
            ...ej.series,
            {
              id: Date.now().toString() + Math.random().toString(),
              peso: ultimaSerie ? ultimaSerie.peso : '',
              reps: ultimaSerie ? ultimaSerie.reps : '',
              pesoI: ultimaSerie ? ultimaSerie.pesoI : '',
              repsI: ultimaSerie ? ultimaSerie.repsI : '',
              repsMin: ultimaSerie?.repsMin,
              repsMax: ultimaSerie?.repsMax,
              carga: ultimaSerie?.carga ? { ...ultimaSerie.carga } : undefined,
              cargaI: ultimaSerie?.cargaI ? { ...ultimaSerie.cargaI } : undefined,
              rir: ultimaSerie ? ultimaSerie.rir : '',
              nota: '',
              completado: false,
              estado: 'normal' as const,
              tipo: ultimaSerie?.tipo || 'normal',
              repsParciales: 0,
              tieneParciales: false,
              esDropset: false,
              drops: [],
            },
          ],
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const duplicarSerie = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        const sTarget = ej.series[sIndex];
        const copia: SerieEjecucion = {
          ...sTarget,
          id: Date.now().toString() + Math.random().toString(),
          completado: false,
          estado: 'normal',
          drops: sTarget.drops.map((d) => ({ ...d })),
        };
        const nuevasSeries = [...ej.series];
        nuevasSeries.splice(sIndex + 1, 0, copia);
        return {
          ...ej,
          series: nuevasSeries,
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const toggleRepsParciales = (ejIndex: number, sIndex: number, valorDirecto?: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            const nuevoTiene = valorDirecto !== undefined ? valorDirecto > 0 : !s.tieneParciales;
            const repsParcialesFinal =
              valorDirecto !== undefined
                ? valorDirecto
                : nuevoTiene && (!s.repsParciales || s.repsParciales <= 0)
                ? 3
                : nuevoTiene
                ? s.repsParciales
                : 0;
            return {
              ...s,
              tieneParciales: nuevoTiene,
              repsParciales: repsParcialesFinal,
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const toggleDropset = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            const nuevoTiene = !s.esDropset;
            let nuevosDrops = s.drops;
            if (nuevoTiene && s.drops.length === 0) {
              const kgSugerido = calcularKgSugeridoDrop(s.peso || '0');
              nuevosDrops = [{ orden: 1, kg: kgSugerido, reps: '', rir: '' }];
            }
            return {
              ...s,
              esDropset: nuevoTiene,
              drops: nuevosDrops,
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const cambiarCampoDrop = (
    ejIndex: number,
    sIndex: number,
    dropIndex: number,
    campo: keyof DropItemEjecucion,
    val: string
  ) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            return {
              ...s,
              drops: s.drops.map((d, di) => (di === dropIndex ? { ...d, [campo]: val } : d)),
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const toggleCompletarSerie = (ejIndex: number, sIndex: number) => {
    const s = ejerciciosState[ejIndex]?.series[sIndex];
    if (!s) return;
    // El check de una serie "No hecha" la reactiva; no la marca completada.
    if (s.estado === 'no_hecha') {
      setEjerciciosState((prev) => {
        const next = prev.map((ej, index) => index !== ejIndex ? ej : {
          ...ej,
          series: ej.series.map((serie, indexSerie) => indexSerie !== sIndex ? serie : {
            ...serie,
            estado: 'normal' as const,
            completado: false,
          }),
        });
        guardarDraftAuto(next);
        return next;
      });
      return;
    }
    if (!s.completado) {
      if (s.esDropset && s.drops.length > 0) {
        const dropIncompleto = s.drops.find((d) => !d.reps || d.reps.trim() === '' || Number(d.reps) <= 0);
        if (dropIncompleto) {
          mostrarMensaje(
            'Drop incompleto',
            `El Drop #${dropIncompleto.orden} no tiene repeticiones. Complétalo o quítalo antes de confirmar la serie.`
          );
          return;
        }
      }
    }
    setEjerciciosState((prev) => {
      const next = prev.map((ej, index) => index !== ejIndex ? ej : {
        ...ej,
        series: ej.series.map((serie, indexSerie) => indexSerie !== sIndex ? serie : {
          ...serie,
          completado: !s.completado,
          // Desmarcar una serie al fallo la devuelve a normal: fallo = completada.
          estado:
            s.estado === 'no_hecha'
              ? 'normal'
              : s.completado && serie.estado === 'fallo'
              ? 'normal'
              : serie.estado,
        }),
      });
      guardarDraftAuto(next);
      return next;
    });
  };

  /* FUNCIONES DE CONTROL PARA SMART WORKOUT KEYBOARD */
  const pasarASiguienteSerie = (ejIdx: number, sIdx: number) => {
    const ej = ejerciciosState[ejIdx];
    if (!ej) {
      setFocusTeclado(null);
      return;
    }
    if (sIdx + 1 < ej.series.length) {
      setFocusTeclado({ ejIdx, sIdx: sIdx + 1, campo: 'peso' });
    } else if (ejIdx + 1 < ejerciciosState.length) {
      seleccionarEjercicioActivo(ejIdx + 1);
      setFocusTeclado({ ejIdx: ejIdx + 1, sIdx: 0, campo: 'peso' });
    } else {
      setFocusTeclado(null);
    }
  };
  const avanzarCampoTeclado = () => {
    if (!focusTeclado) return;
    const { ejIdx, sIdx, campo, dropIdx } = focusTeclado;
    const ej = ejerciciosState[ejIdx];
    if (!ej) return;
    if (dropIdx !== undefined) {
      if (campo === 'peso') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'reps', dropIdx });
      } else if (campo === 'reps') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'rir', dropIdx });
      } else {
        const serie = ej.series[sIdx];
        if (serie && dropIdx + 1 < serie.drops.length) {
          setFocusTeclado({ ejIdx, sIdx, campo: 'peso', dropIdx: dropIdx + 1 });
        } else {
          pasarASiguienteSerie(ejIdx, sIdx);
        }
      }
      return;
    }
    if (ej.esUnilateral) {
      if (campo === 'peso') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'reps' });
      } else if (campo === 'reps') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'pesoI' });
      } else if (campo === 'pesoI') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'repsI' });
      } else if (campo === 'repsI') {
        const serie = ej.series[sIdx];
        if (serie?.tieneParciales || (serie?.repsParciales && serie.repsParciales > 0)) {
          setFocusTeclado({ ejIdx, sIdx, campo: 'parciales' });
        } else {
          setFocusTeclado({ ejIdx, sIdx, campo: 'rir' });
        }
      } else if (campo === 'parciales') {
        setFocusTeclado({ ejIdx, sIdx, campo: 'rir' });
      } else {
        pasarASiguienteSerie(ejIdx, sIdx);
      }
      return;
    }
    if (campo === 'peso') {
      setFocusTeclado({ ejIdx, sIdx, campo: 'reps' });
    } else if (campo === 'reps') {
      const serie = ej.series[sIdx];
      if (serie?.tieneParciales || (serie?.repsParciales && serie.repsParciales > 0)) {
        setFocusTeclado({ ejIdx, sIdx, campo: 'parciales' });
      } else {
        setFocusTeclado({ ejIdx, sIdx, campo: 'rir' });
      }
    } else if (campo === 'parciales') {
      setFocusTeclado({ ejIdx, sIdx, campo: 'rir' });
    } else {
      const serie = ej.series[sIdx];
      if (serie?.esDropset && serie.drops.length > 0) {
        setFocusTeclado({ ejIdx, sIdx, campo: 'peso', dropIdx: 0 });
      } else {
        pasarASiguienteSerie(ejIdx, sIdx);
      }
    }
  };
  const completarSerieDesdeTeclado = () => {
    if (!focusTeclado) return;
    const { ejIdx, sIdx } = focusTeclado;
    toggleCompletarSerie(ejIdx, sIdx);
    pasarASiguienteSerie(ejIdx, sIdx);
  };
  const obtenerValorActualTeclado = (): string => {
    if (!focusTeclado) return '';
    const { ejIdx, sIdx, campo, dropIdx } = focusTeclado;
    const ej = ejerciciosState[ejIdx];
    const serie = ej?.series[sIdx];
    if (!serie) return '';
    const modoCarga = ej ? resolverModoCargaEjercicio(ej) : 'kg';
    if (campo === 'parciales') {
      return serie.repsParciales ? String(serie.repsParciales) : '';
    }
    if (dropIdx !== undefined) {
      const drop = serie.drops[dropIdx];
      if (!drop) return '';
      if (campo === 'peso') return drop.kg || '';
      if (campo === 'reps') return drop.reps || '';
      if (campo === 'rir') return drop.rir || '';
      return '';
    }
    if (campo === 'pesoI') {
      return modoCarga === 'placas'
        ? String(serie.cargaI?.placas || 0)
        : serie.pesoI !== undefined
        ? serie.pesoI
        : serie.peso;
    }
    if (campo === 'peso' && modoCarga === 'placas') return String(serie.carga?.placas || 0);
    if (campo === 'repsI') return serie.repsI !== undefined ? serie.repsI : serie.reps;
    return (serie as any)[campo] || '';
  };
  const obtenerValorPrevioSugerido = (): string | undefined => {
    if (!focusTeclado) return undefined;
    const { ejIdx, sIdx, campo } = focusTeclado;
    const ej = ejerciciosState[ejIdx];
    if (!ej) return undefined;
    const hist = historialMap[ej.nombre];
    if (campo === 'peso' || campo === 'pesoI') {
      const modoActual = resolverModoCargaEjercicio(ej);
      const cargaSerieAnterior = campo === 'pesoI' ? ej.series[sIdx - 1]?.cargaI : ej.series[sIdx - 1]?.carga;
      const tipoAnterior = cargaSerieAnterior?.tipo ?? 'kg';
      const tieneAnterior =
        sIdx > 0 &&
        ((tipoAnterior === 'placas' && (cargaSerieAnterior?.placas || 0) > 0) ||
          (tipoAnterior !== 'placas' && Boolean(ej.series[sIdx - 1]?.peso)));
      if (tieneAnterior && modoActual === tipoAnterior) {
        return tipoAnterior === 'placas'
          ? String(cargaSerieAnterior?.placas || 0)
          : campo === 'pesoI'
          ? ej.series[sIdx - 1]?.pesoI
          : ej.series[sIdx - 1]?.peso;
      }
      const cargaPrevia = campo === 'pesoI' ? hist?.series[sIdx]?.cargaI : hist?.series[sIdx]?.carga;
      const tipoPrevio = cargaPrevia?.tipo ?? 'kg';
      if (modoActual !== tipoPrevio) return undefined;
      return tipoPrevio === 'placas'
        ? String(cargaPrevia?.placas || 0)
        : hist?.series[sIdx]?.peso;
    }
    if (campo === 'reps' || campo === 'repsI') {
      if (sIdx > 0 && ej.series[sIdx - 1]?.reps) {
        return ej.series[sIdx - 1].reps;
      }
      return hist?.series[sIdx]?.reps;
    }
    return undefined;
  };
  const actualizarValorDesdeTeclado = (nuevoValor: string) => {
    if (!focusTeclado) return;
    const { ejIdx, sIdx, campo, dropIdx } = focusTeclado;
    const ej = ejerciciosState[ejIdx];
    if (!ej) return;
    if (campo === 'parciales') {
      const numVal = parseInt(nuevoValor, 10);
      const finalReps = isNaN(numVal) || numVal < 0 ? 0 : numVal;
      setEjerciciosState((prev) => {
        const next = prev.map((ej, i) => {
          if (i !== ejIdx) return ej;
          return {
            ...ej,
            series: ej.series.map((s, sj) => {
              if (sj !== sIdx) return s;
              return {
                ...s,
                repsParciales: finalReps,
                tieneParciales: finalReps > 0,
              };
            }),
          };
        });
        guardarDraftAuto(next);
        return next;
      });
      return;
    }
    if (dropIdx !== undefined) {
      const campoDrop = campo === 'peso' ? 'kg' : campo;
      cambiarCampoDrop(ejIdx, sIdx, dropIdx, campoDrop as any, nuevoValor);
      return;
    }
    // En modo placas la celda muestra y edita el número de placas, no kg.
    if ((campo === 'peso' || campo === 'pesoI') && resolverModoCargaEjercicio(ej) === 'placas') {
      const preferencia = obtenerPreferenciaEjercicio(ej);
      const placas = Math.max(0, parseInt(nuevoValor.replace(',', '.'), 10) || 0);
      const carga: CargaSerie = { tipo: 'placas', placas };
      actualizarCargaDesdeTeclado(carga, calcularKgDesdeCarga(carga, preferencia));
      return;
    }
    cambiarCampoSerie(ejIdx, sIdx, campo, nuevoValor);
  };
  const actualizarCargaDesdeTeclado = (carga: CargaSerie, pesoKg: number | null) => {
    if (!focusTeclado) return;
    const { ejIdx, sIdx, campo } = focusTeclado;
    const ej = ejerciciosState[ejIdx];
    if (!ej) return;
    const clave = normalizarNombreParaPreferencia(ej.nombre);
    const preferencia = preferenciasCarga[clave] || PREFERENCIA_CARGA_POR_DEFECTO;
    const actualizada = { ...preferencia, tipo: carga.tipo };
    guardarPreferenciaCarga(ej.nombre, actualizada).catch(() => undefined);
    setPreferenciasCarga((prev) => ({ ...prev, [clave]: actualizada }));
    const esIzquierdo = campo === 'pesoI';
    setEjerciciosState((prev) => {
      const next = prev.map((item, i) => i !== ejIdx ? item : ({ ...item, series: item.series.map((serie, j) => j !== sIdx ? serie : ({ ...serie, [esIzquierdo ? 'cargaI' : 'carga']: carga, [esIzquierdo ? 'pesoI' : 'peso']: pesoKg == null ? '' : String(pesoKg) })) }));
      guardarDraftAuto(next);
      return next;
    });
  };
  const eliminarSerieConDeshacer = (ejIndex: number, sIndex: number) => {
    const s = ejerciciosState[ejIndex]?.series[sIndex];
    if (!s) return;
    if (ejerciciosState[ejIndex].series.length === 1) {
      mostrarMensaje('No permitido', 'Un ejercicio debe tener al menos una serie.');
      return;
    }
    quitarSerieDeEjercicio(ejIndex, sIndex);
    mostrarSnackbar(`Serie #${sIndex + 1} eliminada`, () => {
      setEjerciciosState((prev) => {
        const next = prev.map((ej, i) => {
          if (i !== ejIndex) return ej;
          const nuevas = [...ej.series];
          nuevas.splice(sIndex, 0, s);
          return { ...ej, series: nuevas };
        });
        guardarDraftAuto(next);
        return next;
      });
    });
  };
  const quitarSerieDeEjercicio = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        if (ej.series.length === 1) return ej;
        return {
          ...ej,
          series: ej.series.filter((_, sj) => sj !== sIndex),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };
  const aplicarSeriesHistorial = (
    ejIndex: number,
    sesion: SesionHistorialEjercicio
  ) => {
    if (!sesion.series.length) return;
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((serie, serieIdx) => {
            const historica =
              sesion.series[serieIdx] ||
              sesion.series[sesion.series.length - 1];
            if (!historica) return serie;
            return {
              ...serie,
              carga: historica.carga || undefined,
              cargaI: historica.cargaI || undefined,
              peso: historica.pesoD > 0 ? String(historica.pesoD) : '',
              reps: historica.repsD > 0 ? String(historica.repsD) : '',
              repsMin: historica.repsMin ?? undefined,
              repsMax: historica.repsMax ?? undefined,
              pesoI: historica.pesoI > 0 ? String(historica.pesoI) : '',
              repsI: historica.repsI > 0 ? String(historica.repsI) : '',
              rir: historica.rir !== null ? String(historica.rir) : '',
              nota: historica.nota || '',
              repsParciales: historica.repsParciales || 0,
              tieneParciales: Boolean(historica.repsParciales > 0),
              esDropset: Boolean(
                historica.esDropset || historica.drops.length > 0
              ),
              drops: historica.drops.map((drop) => ({
                orden: drop.orden,
                kg: drop.kg > 0 ? String(drop.kg) : '',
                reps: drop.reps > 0 ? String(drop.reps) : '',
                rir: drop.rir !== null ? String(drop.rir) : '',
              })),
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
    mostrarSnackbar(
      `Series copiadas desde tu sesión del ${sesion.fecha
        .split('-')
        .reverse()
        .join('/')}.`
    );
  };
  const abrirPrevia = (ejIdx: number) => {
    const ej = ejerciciosState[ejIdx];
    if (!ej) return;
    setPreviaEjercicio({ ejIdx, nombre: ej.nombre });
  };
  const abrirReemplazo = (ejIdx: number) => {
    setReemplazoMenu({ ejIdx });
  };
  const elegirModoReemplazo = (modo: 'solo_hoy' | 'rutina') => {
    const ejIdx = reemplazoMenu?.ejIdx;
    setReemplazoMenu(null);
    if (ejIdx === undefined) return;
    setTimeout(() => {
      setSelectorIntercambio({ ejIdx, modo });
    }, 160);
  };
  // Intercambiar Ejercicio
  const aplicarIntercambioEjercicio = async (
    ejIdx: number,
    nuevoNombre: string,
    modo: 'solo_hoy' | 'rutina'
  ) => {
    const ejActual = ejerciciosState[ejIdx];
    if (!ejActual) return;
    const nombreOriginal = ejActual.nombre;
    const nombreNuevoLimpio = nuevoNombre.trim();
    if (
      !nombreNuevoLimpio ||
      nombreNuevoLimpio.toLowerCase() === nombreOriginal.trim().toLowerCase()
    ) {
      return;
    }
    const yaExiste = ejerciciosState.some(
      (e, i) =>
        i !== ejIdx &&
        e.nombre.trim().toLowerCase() === nombreNuevoLimpio.toLowerCase()
    );
    if (yaExiste) {
      mostrarMensaje(
        'Ejercicio ya presente',
        `"${nombreNuevoLimpio}" ya está en este entrenamiento.`
      );
      return;
    }
    // Cargar historial del nuevo ejercicio
    const histNuevo = await obtenerHistorialPrevioEjercicio(
      nombreNuevoLimpio,
      registro?.fecha
    );
    if (histNuevo) {
      setHistorialMap((prev) => ({
        ...prev,
        [nombreNuevoLimpio]: histNuevo,
      }));
    }
    const esUnilateralNuevo = parsearEjercicioInfo({
      nombre: nombreNuevoLimpio,
    }).esUnilateral;
    const preferenciaNueva =
      (await leerPreferenciasCarga())[normalizarNombreParaPreferencia(nombreNuevoLimpio)] ||
      PREFERENCIA_CARGA_POR_DEFECTO;
    const seriesNuevas: SerieEjecucion[] =
      modo === 'rutina'
        ? heredarSeries(ejActual.series)
        : [
            (() => {
              const serie = crearSerieVacia();
              serie.carga = crearCargaInicial(preferenciaNueva);
              if (esUnilateralNuevo) serie.cargaI = crearCargaInicial(preferenciaNueva);
              return serie;
            })(),
          ];
    // Reutilizamos el id real del registro para que el guardado actualice la
    // misma fila y el ejercicio anterior desaparezca también de la base de datos.
    const idEjercicio = esIdTemporal(ejActual.id)
      ? generarIdTemporal()
      : ejActual.id;
    const ejercicioNuevo: EjercicioState = {
      ...ejActual,
      id: idEjercicio,
      nombre: nombreNuevoLimpio,
      esUnilateral: esUnilateralNuevo,
      series: seriesNuevas,
      modoKg:
        modo === 'rutina' ? inferirTipoCargaDesdeSeries(seriesNuevas) : preferenciaNueva.tipo,
      modoReps: seriesNuevas.some((serie) => serie.repsMin || serie.repsMax) ? 'rango' : 'reps',
      sustituye_a_nombre: ejActual.sustituye_a_nombre || nombreOriginal,
      sustituye_a_ejercicio_id: ejActual.sustituye_a_ejercicio_id || null,
      sustitucion_alcance: modo,
      notaEjercicio: '',
    };
    setSelectorIntercambio(null);
    if (modo === 'solo_hoy') {
      const nuevoEjerciciosState = ejerciciosState.map((ejercicio, index) =>
        index === ejIdx ? ejercicioNuevo : ejercicio
      );
      setEjerciciosState(nuevoEjerciciosState);
      guardarDraftAuto(nuevoEjerciciosState, notasSesion, ejIdx);
      mostrarSnackbar(
        `"${nombreNuevoLimpio}" sustituye a "${nombreOriginal}" solo por hoy`,
        () => {
          setEjerciciosState((prev) => {
            if (prev[ejIdx]?.id !== ejercicioNuevo.id) return prev;
            const restaurado = [...prev];
            restaurado[ejIdx] = ejActual;
            guardarDraftAuto(restaurado, notasSesion, ejIdx);
            return restaurado;
          });
        }
      );
      return;
    }
    setConfirmacionPermanente({
      ejIdx,
      nombreOriginal,
      nombreRutinaOriginal:
        ejActual.sustitucion_alcance === 'solo_hoy' && ejActual.sustituye_a_nombre
          ? ejActual.sustituye_a_nombre
          : nombreOriginal,
      nuevoNombre: nombreNuevoLimpio,
      ejercicioAnterior: ejActual,
      ejercicioNuevo,
    });
  };
  const agregarEjercicioASesion = async (
    nombre: string,
    modo: 'solo_hoy' | 'rutina',
    posicion: number,
    permitirDuplicado = false
  ): Promise<void> => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || !registro) return;
    const duplicado = ejerciciosState.some((item) => item.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase());
    if (duplicado && !permitirDuplicado) {
      Alert.alert(
        'Ejercicio ya presente',
        `“${nombreLimpio}” ya aparece en esta sesión. ¿Quieres añadirlo como segundo bloque?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Añadir segundo bloque', onPress: () => { void agregarEjercicioASesion(nombreLimpio, modo, posicion, true); } },
        ]
      );
      return;
    }

    try {
      const historial = await obtenerHistorialPrevioEjercicio(nombreLimpio, registro.fecha);
      if (historial) setHistorialMap((prev) => ({ ...prev, [nombreLimpio]: historial }));
      const preferencia = (await leerPreferenciasCarga())[normalizarNombreParaPreferencia(nombreLimpio)] || PREFERENCIA_CARGA_POR_DEFECTO;
      const parseado = parsearEjercicioInfo({ nombre: nombreLimpio });
      const seriesBase: SerieEjecucion[] = historial?.series.length
        ? historial.series.map((serie: any) => ({
            ...crearSerieVacia(),
            peso: serie.peso || '',
            reps: serie.repsMin && serie.repsMax && serie.repsMin !== serie.repsMax ? '' : serie.reps || '',
            repsMin: serie.repsMin,
            repsMax: serie.repsMax,
            pesoI: serie.pesoI || '',
            repsI: serie.repsI || '',
            carga: serie.carga || crearCargaInicial(preferencia),
            cargaI: serie.cargaI || (parseado.esUnilateral ? crearCargaInicial(preferencia) : undefined),
            rir: serie.rir || '',
            repsParciales: serie.repsParciales || 0,
            tieneParciales: Boolean(serie.repsParciales),
            esDropset: Boolean(serie.esDropset),
            drops: (serie.drops || []).map((drop: any) => ({ ...drop, kg: String(drop.kg || '') })),
            completado: false,
          }))
        : Array.from({ length: 3 }, () => {
            const serie = crearSerieVacia();
            serie.carga = crearCargaInicial(preferencia);
            if (parseado.esUnilateral) serie.cargaI = crearCargaInicial(preferencia);
            return serie;
          });
      const indexInsercion = Math.min(Math.max(posicion, 0), ejerciciosState.length);
      const origenSesion = modo === 'solo_hoy' ? 'solo_hoy' : 'rutina';
      const newEjercicio: EjercicioState = {
        id: generarIdTemporal(),
        nombre: nombreLimpio,
        esUnilateral: parseado.esUnilateral,
        series: seriesBase,
        notaEjercicio: '',
        origenSesion,
        ordenSesion: indexInsercion + 1,
        modoKg: inferirTipoCargaDesdeSeries(seriesBase),
        modoReps: seriesBase.some((serie) => serie.repsMin || serie.repsMax) ? 'rango' : 'reps',
      };

      if (modo === 'rutina') {
        if (!registro.rutina_id) throw new Error('Este entrenamiento no está vinculado a una rutina para guardar el ejercicio de forma permanente.');
        const referencia = seriesBase[0];
        await agregarEjercicioARutina(registro.rutina_id, {
          nombre: nombreLimpio,
          series: seriesBase.length,
          repeticiones: numeroONull(referencia?.reps),
          peso: numeroONull(referencia?.peso),
          repsMin: referencia?.repsMin ?? numeroONull(referencia?.reps),
          repsMax: referencia?.repsMax ?? numeroONull(referencia?.reps),
          detalles_json: JSON.stringify(seriesBase.map((serie) => ({ carga: serie.carga || null, cargaI: serie.cargaI || null, repsMin: serie.repsMin ?? null, repsMax: serie.repsMax ?? null, origenSesion: 'rutina' })) ),
        }, indexInsercion, registro.id);
      }

      if (!registro.id.startsWith('local_')) {
        newEjercicio.id = await crearEjercicioRegistroSesion({
          registroId: registro.id,
          nombre: nombreLimpio,
          series: seriesBase.length,
          repeticiones: numeroONull(seriesBase[0]?.reps),
          peso: numeroONull(seriesBase[0]?.peso),
          detalles_json: JSON.stringify(seriesBase.map((serie) => ({ carga: serie.carga || null, cargaI: serie.cargaI || null, repsMin: serie.repsMin ?? null, repsMax: serie.repsMax ?? null, origenSesion, ordenSesion: indexInsercion + 1 }))),
        });
      }

      const nextState = [...ejerciciosState];
      nextState.splice(indexInsercion, 0, newEjercicio);
      const conOrden = nextState.map((item, index) => ({ ...item, ordenSesion: index + 1 }));
      setEjerciciosState(conOrden);
      const foco = conOrden.findIndex((item) => item.id === newEjercicio.id);
      fijarIndiceActivo(foco, conOrden.length);
      setFocusTeclado(null);
      guardarDraftAuto(conOrden, notasSesion, foco);
      if (modo === 'solo_hoy') {
        mostrarSnackbar(`“${nombreLimpio}” añadido a esta sesión`, () => {
          const rutinaId = registro.rutina_id;
          if (!rutinaId) {
            mostrarMensaje('No disponible', 'Esta sesión no está vinculada a una rutina.');
            return;
          }
          void agregarEjercicioARutina(rutinaId, {
            nombre: nombreLimpio,
            series: seriesBase.length,
            repeticiones: numeroONull(seriesBase[0]?.reps),
            peso: numeroONull(seriesBase[0]?.peso),
            repsMin: seriesBase[0]?.repsMin ?? numeroONull(seriesBase[0]?.reps),
            repsMax: seriesBase[0]?.repsMax ?? numeroONull(seriesBase[0]?.reps),
            detalles_json: JSON.stringify(seriesBase.map((serie) => ({ carga: serie.carga || null, cargaI: serie.cargaI || null, repsMin: serie.repsMin ?? null, repsMax: serie.repsMax ?? null, origenSesion: 'rutina' }))),
          }, indexInsercion, registro.id).then(() => {
            const actualizado = ejerciciosStateActualRef.current.map((item) => item.id === newEjercicio.id ? { ...item, origenSesion: 'rutina' as const } : item);
            ejerciciosStateActualRef.current = actualizado;
            setEjerciciosState(actualizado);
            guardarDraftAuto(actualizado);
            mostrarSnackbar(`“${nombreLimpio}” guardado en la rutina`);
          }).catch((error) => mostrarMensaje('No se pudo guardar', error?.message || 'Inténtalo de nuevo.'));
        }, 'Guardar en la rutina');
      } else {
        mostrarSnackbar(`“${nombreLimpio}” añadido a la sesión y a la rutina`);
      }
    } catch (error: any) {
      mostrarMensaje('No se pudo añadir el ejercicio', error?.message || 'Inténtalo de nuevo.');
    }
  };

  const consolidarCambioPermanente = (conf: {
    ejIdx: number;
    nombreOriginal: string;
    nombreRutinaOriginal: string;
    nuevoNombre: string;
    ejercicioAnterior: EjercicioState;
    ejercicioNuevo: EjercicioState;
  }) => {
    const { ejIdx, nombreOriginal, nuevoNombre, ejercicioAnterior, ejercicioNuevo } =
      conf;
    const nuevoEjerciciosState = ejerciciosState.map((ejercicio, index) =>
      index === ejIdx ? ejercicioNuevo : ejercicio
    );
    setEjerciciosState(nuevoEjerciciosState);
    guardarDraftAuto(nuevoEjerciciosState, notasSesion, ejIdx);
    const serieReferencia =
      ejercicioNuevo.series.find((serie) => serie.reps || serie.peso) ||
      ejercicioNuevo.series[0];
    const herencia = {
      series: ejercicioNuevo.series.length,
      repeticiones: numeroONull(serieReferencia?.reps),
      peso: numeroONull(serieReferencia?.peso),
    };
    let consolidado = false;
    const timerConsolidar = setTimeout(async () => {
      consolidado = true;
      if (registro?.rutina_id) {
        await reemplazarEjercicioEnRutina(
          registro.rutina_id,
          nombreOriginal,
          nuevoNombre,
          {
            herencia,
            nombreRespaldo:
              ejercicioAnterior.sustitucion_alcance &&
              ejercicioAnterior.sustituye_a_nombre
                ? ejercicioAnterior.sustituye_a_nombre
                : undefined,
          }
        ).catch((err) =>
          console.warn('Error reemplazando ejercicio en rutina:', err)
        );
      }
    }, 6000);
    mostrarSnackbar(
      `Cambio aplicado en la rutina: "${nuevoNombre}" heredó ${ejercicioNuevo.series.length} ${
        ejercicioNuevo.series.length === 1 ? 'serie' : 'series'
      }`,
      () => {
        if (consolidado) return;
        clearTimeout(timerConsolidar);
        setEjerciciosState((prev) => {
          if (prev[ejIdx]?.id !== ejercicioNuevo.id) return prev;
          const restaurado = [...prev];
          restaurado[ejIdx] = ejercicioAnterior;
          guardarDraftAuto(restaurado, notasSesion, ejIdx);
          return restaurado;
        });
      }
    );
  };
  const resumenHerenciaPermanente = (ejercicio: EjercicioState): string => {
    const total = ejercicio.series.length;
    const referencia =
      ejercicio.series.find((serie) => serie.reps || serie.peso) || ejercicio.series[0];
    const partes = [`${total} ${total === 1 ? 'serie' : 'series'}`];
    if (referencia?.reps) partes.push(`${referencia.reps} reps`);
    if (referencia?.peso) partes.push(`${referencia.peso} kg`);
    return partes.join(', ');
  };
  const eliminarEjercicioDeSesion = (ejIdx: number) => {
    if (ejerciciosState.length === 1) {
      mostrarMensaje('No permitido', 'El entrenamiento debe tener al menos un ejercicio.');
      return;
    }
    const ejEliminado = ejerciciosState[ejIdx];
    const tieneSeriesCompletadas = ejEliminado.series.some((serie) => serie.completado);
    if (ejEliminado.origenSesion !== 'solo_hoy' || tieneSeriesCompletadas) {
      Alert.alert(
        'Quitar ejercicio de esta sesión',
        ejEliminado.origenSesion === 'solo_hoy'
          ? 'Este ejercicio tiene series completadas. ¿Quieres quitarlo de todas formas?'
          : 'Este ejercicio pertenece a la rutina. Se quitará solo de esta sesión; no se borrarán sesiones pasadas ni futuras.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Quitar', style: 'destructive', onPress: () => quitarEjercicioYGuardar(ejIdx) },
        ]
      );
      return;
    }
    quitarEjercicioYGuardar(ejIdx);
  };
  const quitarEjercicioYGuardar = (ejIdx: number) => {
    const ejEliminado = ejerciciosState[ejIdx];
    if (!ejEliminado) return;
    const indiceAnterior = ejercicioActivoIndex;
    const nextState = ejerciciosState.filter((_, i) => i !== ejIdx).map((ejercicio, index) => ({ ...ejercicio, ordenSesion: index + 1 }));
    const siguienteIndice = limitarIndiceEjercicio(
      ejIdx < indiceAnterior ? indiceAnterior - 1 : indiceAnterior,
      nextState.length
    );
    setEjerciciosState(nextState);
    fijarIndiceActivo(siguienteIndice, nextState.length);
    guardarDraftAuto(nextState, notasSesion, siguienteIndice);
    mostrarSnackbar(`"${ejEliminado.nombre}" eliminado`, () => {
      const restaurado: EjercicioState[] = [...nextState];
      restaurado.splice(ejIdx, 0, ejEliminado);
      const restauradoOrdenado = restaurado.map((ejercicio, index) => ({ ...ejercicio, ordenSesion: index + 1 }));
      const indiceRestaurado = limitarIndiceEjercicio(indiceAnterior, restauradoOrdenado.length);
      setEjerciciosState(restauradoOrdenado);
      fijarIndiceActivo(indiceRestaurado, restaurado.length);
      guardarDraftAuto(restauradoOrdenado, notasSesion, indiceRestaurado);
    });
  };
  // Cálculo de Métricas Inteligentes para el Modal de Resumen
  const calcularMetricasResumen = () => {
    let volumenTotalKg = 0;
    const ejerciciosResumen: EjercicioResumen[] = ejerciciosState.map((ej) => {
      let maxPeso = 0;
      let maxReps = 0;
      let seriesCompletadas = 0;
      ej.series.forEach((s) => {
        if (s.completado && s.estado !== 'no_hecha') {
          seriesCompletadas++;
          const pD = Number(s.peso) || 0;
          const rD = Number(s.reps) || 0;
          const pI = ej.esUnilateral ? Number(s.pesoI !== undefined && s.pesoI !== '' ? s.pesoI : s.peso) || 0 : pD;
          const rI = ej.esUnilateral ? Number(s.repsI !== undefined && s.repsI !== '' ? s.repsI : s.reps) || 0 : rD;
          volumenTotalKg += pD * rD + pI * rI;
          if (s.esDropset && s.drops && s.drops.length > 0) {
            s.drops.forEach((d) => {
              const dKg = Number(d.kg) || 0;
              const dReps = Number(d.reps) || 0;
              volumenTotalKg += dKg * dReps;
            });
          }
          if (pD > maxPeso) {
            maxPeso = pD;
            maxReps = rD;
          }
        }
      });
      const histEj = historialMap[ej.nombre];
      const maxPesoHist = histEj
        ? Math.max(...histEj.series.map((sh) => Number(sh.peso) || 0))
        : 0;
      const tieneSobrecarga = maxPeso > 0 && maxPeso > maxPesoHist;
      return {
        id: ej.id,
        nombre: ej.nombre,
        esUnilateral: ej.esUnilateral,
        seriesTotal: ej.series.filter((s) => s.estado !== 'no_hecha').length,
        seriesCompletadas,
        seriesNoHechas: ej.series.filter((s) => s.estado === 'no_hecha').length,
        pesoMaximo: maxPeso,
        repsMaximas: maxReps,
        tieneSobrecarga,
        notaEjercicio: ej.notaEjercicio?.trim() || '',
        origenSesion: ej.origenSesion || 'rutina',
        ordenSesion: ej.ordenSesion ?? ejerciciosState.indexOf(ej) + 1,
        series: ej.series.map((s) => ({
          peso: s.peso || '',
          reps: s.reps || '',
          pesoI: s.pesoI || '',
          repsI: s.repsI || '',
          carga: s.carga,
          cargaI: s.cargaI,
          estado: s.estado || 'normal',
          tipo: s.tipo || 'normal',
          repsMin: s.repsMin,
          repsMax: s.repsMax,
          rir: s.rir || '',
          nota: s.nota || '',
        })),
      };
    });
    return { volumenTotalKg, ejerciciosResumen };
  };
  // Abrir Modal de Confirmación y Resumen
  // Pausa el timer automáticamente al ver el resumen para que no siga contando
  const abrirResumenConfirmacion = async () => {
    if (estadoTimer && !estadoTimer.pausado) {
      const pausado = await alternarPausaTimer(estadoTimer);
      setEstadoTimer(pausado);
      setSegundosTranscurridos(calcularSegundosTranscurridos(pausado));
      await emitirCambioSesionActiva();
    }
    setResumenVisible(true);
  };
  // Volver a editar desde el resumen: reanuda el timer si estaba corriendo o cierra si es solo lectura
  const volverAEditarDesdeResumen = async () => {
    if (esModoResumen) {
      setResumenVisible(false);
      onClose();
      return;
    }
    setResumenVisible(false);
    if (estadoTimer && estadoTimer.pausado) {
      const reanudado = await alternarPausaTimer(estadoTimer);
      setEstadoTimer(reanudado);
      setSegundosTranscurridos(calcularSegundosTranscurridos(reanudado));
      await emitirCambioSesionActiva();
    }
  };
  const construirPayloadEjercicio = (ej: EjercicioState) => {
    const primeraSerie = ej.series[0];
    const numSeriesTotal = ej.series.length;
    const repsPrimera = primeraSerie?.repsMin ?? (primeraSerie?.reps ? Number(primeraSerie.reps) : null);
    const pesoPrimero = primeraSerie?.peso ? Number(primeraSerie.peso) : null;
    const seriesTrabajadas = ej.series.filter((s) => s.estado !== 'no_hecha');
    const todasCompletadas =
      seriesTrabajadas.length > 0 && seriesTrabajadas.every((s) => s.completado);
    const tieneDatos = ej.series.some(
      (s) => Boolean(s.peso || s.reps || s.repsMin || s.estado !== 'normal' || s.pesoI || s.repsI || s.rir || s.nota || s.completado || s.tieneParciales || s.esDropset)
    );
    const resumenSeries = tieneDatos
      ? ej.series
          .map((s, idx) => {
            let dropsStr = '';
            if (s.esDropset && s.drops && s.drops.length > 0) {
              dropsStr = s.drops.map((d) => ` → ${d.kg}k ${d.reps}r${d.rir ? ` RIR ${d.rir}` : ''}`).join('') + ' ↓';
            }
            if (ej.esUnilateral) {
              const pD = s.peso ? `${s.peso}k` : '';
              const rD = s.reps ? (s.repsParciales && s.repsParciales > 0 ? `${s.reps}+${s.repsParciales}p` : `${s.reps}r`) : '';
              const strD = [pD, rD].filter(Boolean).join(' ');
              const pesoIVal = s.pesoI !== undefined && s.pesoI !== '' ? s.pesoI : s.peso;
              const repsIVal = s.repsI !== undefined && s.repsI !== '' ? s.repsI : s.reps;
              const pI = pesoIVal ? `${pesoIVal}k` : '';
              const rI = repsIVal ? (s.repsParciales && s.repsParciales > 0 ? `${repsIVal}+${s.repsParciales}p` : `${repsIVal}r`) : '';
              const strI = [pI, rI].filter(Boolean).join(' ');
              const rir = s.rir ? `RIR ${s.rir}` : '';
              const n = s.nota ? `[${s.nota}]` : '';
              const estadoTag = s.estado === 'no_hecha' ? '[NH]' : s.estado === 'fallo' ? '[F]' : s.tipo === 'calentamiento' ? '[W]' : '';
              const objetivoTag = s.repsMin ? `[OBJ:${s.repsMin}${s.repsMax && s.repsMax !== s.repsMin ? `-${s.repsMax}` : ''}]` : '';
              const c = s.completado && s.estado !== 'no_hecha' ? '✓' : '';
              const resumenBrazo = `D ${strD} | I ${strI}`.trim();
              return `${idx + 1}ª: ${[estadoTag, resumenBrazo, objetivoTag, rir, dropsStr, n, c].filter(Boolean).join(' ')}`;
            } else {
              const p = s.peso ? `${s.peso}k` : '';
              const r = s.reps ? (s.repsParciales && s.repsParciales > 0 ? `${s.reps}+${s.repsParciales}p` : `${s.reps}r`) : '';
              const rir = s.rir ? `RIR ${s.rir}` : '';
              const n = s.nota ? `[${s.nota}]` : '';
              const estadoTag = s.estado === 'no_hecha' ? '[NH]' : s.estado === 'fallo' ? '[F]' : s.tipo === 'calentamiento' ? '[W]' : '';
              const objetivoTag = s.repsMin ? `[OBJ:${s.repsMin}${s.repsMax && s.repsMax !== s.repsMin ? `-${s.repsMax}` : ''}]` : '';
              const c = s.completado && s.estado !== 'no_hecha' ? '✓' : '';
              return `${idx + 1}ª: ${[estadoTag, p, r, objetivoTag, rir, dropsStr, n, c].filter(Boolean).join(' ')}`;
            }
          })
          .join(' • ')
      : '';
    const tagU = ej.esUnilateral ? '[U] ' : '';
    const nombreLimpio = ej.nombre.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');
    const nombreBase = tagU + nombreLimpio;
    const nombreConDetalle = resumenSeries ? `${nombreBase} (${resumenSeries})` : nombreBase;
    const totalParciales = ej.series.reduce((acc, s) => acc + (s.repsParciales || 0), 0);
    const allDrops = ej.series.flatMap((s) => (s.esDropset ? s.drops : []));
    return {
      nombreConDetalle,
      numSeriesTotal,
      repsPrimera,
      pesoPrimero,
      todasCompletadas,
      totalParciales,
      allDrops,
      ordenSesion: ejerciciosState.indexOf(ej) + 1,
    };
  };
  // Confirmar y Guardar Sesión en Supabase
  const guardarSesionFinal = () =>
    seguro(async () => {
      setGuardando(true);
      try {
        // El tiempo se calcula desde el estado real del cronómetro, no desde
        // un valor de pantalla que puede tener hasta un segundo de retraso.
        const segundosTimer = estadoTimer ? calcularSegundosTranscurridos(estadoTimer) : 0;
        const segundosFinales = Math.max(segundosTranscurridos, segundosTimer);
        setSegundosTranscurridos(segundosFinales);
        // Guardamos primero una copia local; la BD se actualiza al completar
        // el registro, pero así el tiempo no se pierde si falla la red.
        if (segundosFinales > 0) {
          try {
            await AsyncStorage.setItem(`rutinia_duracion_${registro.id}`, segundosFinales.toString());
          } catch (e) {
            console.warn('Error guardando duración final:', e);
          }
        }
        const idsConservados: string[] = [];
        // Si una inserción no devuelve su id (por ejemplo, por permisos de
        // lectura), no podemos distinguirla de una fila obsoleta: mejor no
        // borrar nada que arriesgar datos válidos.
        let limpiezaSegura = true;
        for (const ej of ejerciciosState) {
          const payload = construirPayloadEjercicio(ej);
          const datos = {
            nombre: payload.nombreConDetalle,
            series: payload.numSeriesTotal,
            repeticiones: payload.repsPrimera,
            peso: payload.pesoPrimero,
            completado: payload.todasCompletadas,
            ejercicio_nombre: ej.nombre,
            sustituye_a_nombre: ej.sustituye_a_nombre || null,
            sustituye_a_ejercicio_id: ej.sustituye_a_ejercicio_id || null,
            sustitucion_alcance: ej.sustitucion_alcance || null,
            reps_parciales: payload.totalParciales,
            drops: payload.allDrops,
            detalles_json: JSON.stringify(ej.series.map((s) => ({ carga: s.carga || null, cargaI: s.cargaI || null, estado: s.estado || 'normal', tipo: s.tipo || 'normal', repsMin: s.repsMin ?? null, repsMax: s.repsMax ?? null, origenSesion: ej.origenSesion || 'rutina', ordenSesion: ej.ordenSesion ?? payload.ordenSesion }))),
          };
          // Si el id es temporal generado por sustitución, insertamos nueva fila
          if (esIdTemporal(ej.id)) {
            const filaId = await crearEjercicioRegistroSesion({
              registroId: registro.id,
              nombre: datos.nombre,
              ejercicio_nombre: datos.ejercicio_nombre,
              series: datos.series,
              repeticiones: datos.repeticiones,
              peso: datos.peso,
              completado: datos.completado,
              reps_parciales: datos.reps_parciales,
              drops: datos.drops,
              sustituye_a_nombre: datos.sustituye_a_nombre,
              sustituye_a_ejercicio_id: datos.sustituye_a_ejercicio_id,
              sustitucion_alcance: datos.sustitucion_alcance,
              detalles_json: datos.detalles_json,
            });
            if (filaId) idsConservados.push(filaId);
            else limpiezaSegura = false;
          } else {
            await actualizarEjecucionEjercicio(ej.id, datos);
            idsConservados.push(ej.id);
          }
        }
        // Quita de la base cualquier ejercicio que haya quedado obsoleto por
        // una sustitución o eliminación durante la sesión.
        if (limpiezaSegura) {
          await eliminarEjerciciosObsoletos(registro.id, idsConservados);
        }
        const planNombreFinal = registro.plan_nombre || registro.planes_entrenamiento?.nombre || null;
        const rutinaNombreFinal = registro.rutina_nombre || registro.rutinas?.nombre || null;
        const planIdFinal = registro.plan_id || registro.planes_entrenamiento?.id || null;
        await actualizarEstadoRegistro(registro.id, {
          completado: true,
          plan_id: planIdFinal,
          plan_nombre: planNombreFinal,
          rutina_nombre: rutinaNombreFinal,
        });
        // Nota general + duración real persistidas en el registro.
        await guardarNotaSesion(registro.id, notasSesion, segundosFinales);
        // Notas por ejercicio, siempre vinculadas al nombre del ejercicio.
        await sincronizarNotasEjercicios(
          registro.id,
          ejerciciosState.map((ej) => ({ nombre: ej.nombre, nota: ej.notaEjercicio }))
        );
        // Limpiar el borrador y timer en AsyncStorage
        await limpiarSesionActiva(registro.id);
        setResumenVisible(false);
        onGuardado();
        onClose();
        mostrarMensaje('¡Entrenamiento Guardado!', `Se registró el progreso del día ${nombreDia(fecha)}.`);
      } finally {
        setGuardando(false);
      }
    });
  /**
   * Edición de un resumen ya guardado: modifica únicamente series, notas y
   * observaciones. No toca el estado de la sesión, la fecha ni la duración.
   */
  const guardarEdicionesResumen = async (edicion: EdicionResumen) => {
    const cambiosPorId = new Map(edicion.ejercicios.map((item) => [item.id, item]));
    const ejerciciosActualizados = ejerciciosState.map((ej) => {
      const cambios = cambiosPorId.get(ej.id);
      if (!cambios) return ej;
      return {
        ...ej,
        notaEjercicio: cambios.notaEjercicio,
        series: ej.series.map((serie, sIdx) => {
          const serieEditada = cambios.series[sIdx];
          if (!serieEditada) return serie;
          return {
            ...serie,
            peso: serieEditada.peso,
            reps: serieEditada.reps,
            pesoI: serieEditada.pesoI,
            repsI: serieEditada.repsI,
            carga: serieEditada.carga,
            cargaI: serieEditada.cargaI,
            estado: serieEditada.estado ?? serie.estado,
            tipo: serieEditada.tipo ?? serie.tipo,
            repsMin: serieEditada.repsMin ?? serie.repsMin,
            repsMax: serieEditada.repsMax ?? serie.repsMax,
            rir: serieEditada.rir,
            nota: serieEditada.nota,
          };
        }),
      };
    });
    for (const ej of ejerciciosActualizados) {
      if (!cambiosPorId.has(ej.id) || ej.id.includes('.')) continue;
      const payload = construirPayloadEjercicio(ej);
      await actualizarEjecucionEjercicio(ej.id, {
        nombre: payload.nombreConDetalle,
        series: payload.numSeriesTotal,
        repeticiones: payload.repsPrimera,
        peso: payload.pesoPrimero,
        completado: payload.todasCompletadas,
        reps_parciales: payload.totalParciales,
        drops: payload.allDrops,
        detalles_json: JSON.stringify(ej.series.map((s) => ({ carga: s.carga || null, cargaI: s.cargaI || null, estado: s.estado || 'normal', tipo: s.tipo || 'normal', repsMin: s.repsMin ?? null, repsMax: s.repsMax ?? null, origenSesion: ej.origenSesion || 'rutina', ordenSesion: ej.ordenSesion ?? payload.ordenSesion }))),
      });
    }
    await sincronizarNotasEjercicios(
      registro.id,
      ejerciciosActualizados.map((ej) => ({ nombre: ej.nombre, nota: ej.notaEjercicio }))
    );
    // Se conserva la duración ya registrada; solo cambia la nota visible.
    await guardarNotaSesion(registro.id, edicion.notasSesion, segundosTranscurridos);
    setEjerciciosState(ejerciciosActualizados);
    setNotasSesion(edicion.notasSesion);
  };
  // Descartar Sesión
  const descartarSesion = () =>
    seguro(async () => {
      if (registro) {
        await limpiarSesionActiva(registro.id);
      }
      setResumenVisible(false);
      onClose();
      mostrarMensaje('Entrenamiento Descartado', 'Se canceló el registro de esta sesión.');
    });
  const { volumenTotalKg, ejerciciosResumen } = calcularMetricasResumen();
  return (
    <Modal visible={visible} animationType="slide" transparent={Platform.OS === 'web' ? true : false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FondoPantalla variante="negro_gradiente">
          <View style={{ flex: 1, paddingTop: isLandscape ? Math.max(topInset, 6) : Math.max(topInset, Platform.OS === 'ios' ? 44 : 16) }}>
            {/* LOBBY PRE-PARTIDA */}
            {enLobby ? (
              <View style={[styles.lobbyContainer, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: gutter }]}>
                {/* Header Lobby */}
                <View style={styles.lobbyHeaderRow}>
                  <Text style={styles.modalBadgeText}>PRE-ENTRENAMIENTO • {nombreDia(fecha)}</Text>
                  <Pressable onPress={onClose} style={styles.closeIconButton}>
                    <Ionicons name="close" size={22} color={noir.platinum} />
                  </Pressable>
                </View>
                {/* Routine Card Banner */}
                <View style={styles.lobbyHeroCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.lobbyIconBox}>
                      <Ionicons name="flash" size={24} color={noir.lavender} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lobbyTitleText} numberOfLines={1}>
                        {registro.rutinas?.nombre || 'Entrenamiento del Día'}
                      </Text>
                      <Text style={styles.lobbySubtext}>
                        {ejerciciosState.length} Ejercicios planificados • {totalSeriesEnSesion} Series
                      </Text>
                    </View>
                  </View>
                  <View style={styles.lobbyDivider} />
                  {/* Highlights Grid */}
                  <View style={styles.lobbyGrid}>
                    <View style={styles.lobbyGridItem}>
                      <Ionicons name="barbell-outline" size={16} color={noir.info} />
                      <Text style={styles.lobbyGridItemText}>Sobrecarga Activa</Text>
                    </View>
                    <View style={styles.lobbyGridItem}>
                      <Ionicons name="stats-chart-outline" size={16} color={noir.mint} />
                      <Text style={styles.lobbyGridItemText}>Seguimiento en Vivo</Text>
                    </View>
                  </View>
                </View>
                {/* Lista rápida de Ejercicios del Día */}
                <View style={{ flex: 1, marginTop: 10 }}>
                  <Text style={styles.inputLabelText}>Ejercicios de la Rutina ({ejerciciosState.length}):</Text>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 20 }}
                  >
                    {ejerciciosState.map((ej, idx) => (
                      <View key={ej.id} style={styles.lobbyExerciseItem}>
                        <Text style={{ color: noir.info, fontFamily: fuentes.bold, width: 22 }}>
                          {idx + 1}.
                        </Text>
                        <Text style={{ color: noir.text, fontFamily: fuentes.bold, flex: 1 }}>
                          {ej.nombre}
                        </Text>
                        <Text style={{ color: noir.muted, fontFamily: fuentes.medium, fontSize: 11 }}>
                          {ej.series.length} series
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
                {/* Botón de Inicio de Impacto */}
                <View style={{ paddingBottom: Math.max(barBottomPadding, 16), paddingTop: 10 }}>
                  <BotonMetalLiquido
                    titulo="¡INICIAR ENTRENAMIENTO!"
                    onPress={iniciarEntrenamiento}
                    tamano="lg"
                    activo={visible}
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              </View>
            ) : (
              /* PANTALLA PRINCIPAL: MODO FOCUS DE ENTRENAMIENTO EN VIVO */
              <View style={{ flex: 1, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', position: 'relative' }}>
                {/* Top Header Bar: timer central + acciones de sesión */}
                <View style={[styles.focusTopBar, { paddingHorizontal: gutter }]}>
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    style={styles.focusChevronBtn}
                    accessibilityLabel="Cerrar entrenamiento"
                  >
                    <Ionicons name="chevron-down" size={19} color={noir.platinum} />
                  </Pressable>
                  <Pressable onPress={togglePausaTimer} style={styles.focusTimerBox} hitSlop={6}>
                    <Text style={styles.focusTimerText}>
                      {formatearTiempo(segundosTranscurridos)}
                    </Text>
                    <View style={styles.focusSubtitleRow}>
                      <View style={styles.focusLiveDot} />
                      <Text style={styles.focusSubtitleText} numberOfLines={1}>
                        {registro.rutina_nombre || registro.rutinas?.nombre || registro.plan_nombre || 'Entrenamiento'}
                        {' · '}
                        {nombreDia(fecha)}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.focusHeaderActions}>
                    <Pressable
                      onPress={togglePausaTimer}
                      style={styles.focusTimerIconBtn}
                      hitSlop={6}
                      accessibilityLabel={estadoTimer?.pausado ? 'Reanudar sesión' : 'Pausar sesión'}
                    >
                      <Ionicons
                        name={estadoTimer?.pausado ? 'play' : 'pause'}
                        size={15}
                        color={estadoTimer?.pausado ? noir.champagne : noir.platinum}
                      />
                    </Pressable>
                    <Pressable
                      onPress={abrirResumenConfirmacion}
                      style={styles.focusTerminarBtn}
                      hitSlop={6}
                      accessibilityLabel="Terminar entrenamiento"
                    >
                      <Ionicons name="close" size={11} color="#F7B6C1" />
                      <Text style={styles.focusTerminarBtnText}>Terminar</Text>
                    </Pressable>
                  </View>
                </View>
                {/* Carrusel Superior de Ejercicios con GIFs en modo oscuro */}
                <CarruselEjerciciosEncabezado
                  ejercicios={itemsCarrusel}
                  activoIndex={indexValido}
                  onSelectEjercicio={seleccionarEjercicioActivo}
                  onAddEjercicio={!esModoResumen ? () => setAlcanceAgregar({ modo: 'solo_hoy', posicion: 'despues' }) : undefined}
                  style={{ marginHorizontal: gutter, marginBottom: 10 }}
                />
                {/* Contenido Scrollable del Ejercicio Activo */}
                <ScrollView
                  ref={scrollRef}
                  contentContainerStyle={{
                    paddingHorizontal: gutter,
                    paddingBottom: scrollBottomPad + 40,
                    gap: 14,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
                  }}
                >
                  {Boolean(ejActivo) && (
                    <>
                      {/* Hero con Animación Anatómica y Píldoras de Acción */}
                      <HeroEjercicioActivo
                        nombreEjercicio={ejActivo.nombre}
                        totalSeries={ejActivo.series.length}
                        seriesCompletadas={seriesCompletadasActivo}
                        objetivoTexto={
                          ejActivo.series[0]?.reps
                            ? `${ejActivo.series[0].reps} reps`
                            : undefined
                        }
                        nombrePlan={
                          registro.plan_nombre ||
                          registro.planes_entrenamiento?.nombre ||
                          'Sesión de hoy'
                        }
                        indiceEjercicio={indexValido}
                        totalEjercicios={ejerciciosState.length}
                        solicitudTutorial={solicitudTutorial}
                        onVerPrevia={() => abrirPrevia(indexValido)}
                        onReemplazar={() => abrirReemplazo(indexValido)}
                        onOpciones={() => {
                          setEjercicioMenu(indexValido);
                        }}
                      />
                      {/* Tabla de Series de Alto Rendimiento */}
                      <TablaSeriesFocus
                        ejIdx={indexValido}
                        series={seriesFocus}
                        esUnilateral={ejActivo.esUnilateral}
                        nombreEjercicio={ejActivo.nombre}
                        onToggleUnilateral={() => toggleUnilateralEjercicio(indexValido)}
                        onIntercambiarEjercicio={(modo) => {
                          setSelectorIntercambio({ ejIdx: indexValido, modo });
                        }}
                        focusCampoActivo={
                          focusTeclado && focusTeclado.ejIdx === indexValido
                            ? {
                                sIdx: focusTeclado.sIdx,
                                campo: focusTeclado.campo === 'peso' ? 'kg' : (focusTeclado.campo as any),
                                dropIdx: focusTeclado.dropIdx,
                              }
                            : null
                        }
                        onFocusCampo={(sIdx, campo, dropIdx) => {
                          // Si venía abierto el teclado nativo (p. ej. notas), lo
                          // cerramos para dejar sitio al teclado de entrenamiento.
                          Keyboard.dismiss();
                          const campoTeclado = campo === 'kg' ? 'peso' : campo;
                          setFocusTeclado({
                            ejIdx: indexValido,
                            sIdx,
                            campo: campoTeclado as any,
                            dropIdx,
                          });
                        }}
                        registrarNodoFoco={registrarNodoFoco}
                        onToggleCompletado={(sIdx) => {
                          toggleCompletarSerie(indexValido, sIdx);
                        }}
                        onAnadirSerie={() => {
                          agregarSerieAEjercicio(indexValido);
                        }}
                        onEliminarSerie={(sIdx) => {
                          eliminarSerieConDeshacer(indexValido, sIdx);
                        }}
                        modoKg={modoKgActivo}
                        modoReps={modoRepsActivo}
                        resumenEquipo={resumenEquipoActivo}
                        onConfigurarCarga={() => setConfiguracionCargaIdx(indexValido)}
                        onCambiarModoKg={aplicarModoCarga}
                        onCambiarModoReps={aplicarModoReps}
                        onActualizarSerie={(sIdx, patch) => {
                          if (patch.drops) {
                            setEjerciciosState((prev) => {
                              const next = prev.map((ej, i) => {
                                if (i !== indexValido) return ej;
                                return {
                                  ...ej,
                                  series: ej.series.map((s, sj) => {
                                    if (sj !== sIdx) return s;
                                    return {
                                      ...s,
                                      esDropset: patch.drops!.length > 0,
                                      drops: patch.drops!.map((d) => ({
                                        orden: d.orden,
                                        kg: d.peso,
                                        reps: d.reps,
                                        rir: d.rir || '',
                                      })),
                                    };
                                  }),
                                };
                              });
                              guardarDraftAuto(next);
                              return next;
                            });
                          }
                          if (patch.repsParciales !== undefined) {
                            const repsParciales = patch.repsParciales ?? 0;
                            setEjerciciosState((prev) => {
                              const next = prev.map((ej, i) => {
                                if (i !== indexValido) return ej;
                                return {
                                  ...ej,
                                  series: ej.series.map((s, sj) => {
                                    if (sj !== sIdx) return s;
                                    return {
                                      ...s,
                                      tieneParciales: repsParciales > 0,
                                      repsParciales,
                                    };
                                  }),
                                };
                              });
                              guardarDraftAuto(next);
                              return next;
                            });
                          }
                          if (patch.tipo !== undefined) {
                            cambiarCampoSerie(indexValido, sIdx, 'tipo' as any, patch.tipo);
                          }
                          if (patch.estado !== undefined) {
                            cambiarCampoSerie(indexValido, sIdx, 'estado' as any, patch.estado);
                          }
                          if ('repsMin' in patch) {
                            cambiarCampoSerie(indexValido, sIdx, 'repsMin', patch.repsMin);
                          }
                          if ('repsMax' in patch) {
                            cambiarCampoSerie(indexValido, sIdx, 'repsMax', patch.repsMax);
                          }
                          if (patch.completado !== undefined) {
                            cambiarCampoSerie(indexValido, sIdx, 'completado', patch.completado);
                          }
                          if (patch.rir !== undefined) {
                            cambiarCampoSerie(indexValido, sIdx, 'rir', patch.rir);
                          }
                        }}
                      />
                      {/* Tarjeta de Notas Generales de la Sesión */}
                      <View style={styles.focusNotesCard}>
                        <View style={styles.focusNotesHeader}>
                          <View style={styles.focusNotesIcon}>
                            <Ionicons name="chatbubble-ellipses-outline" size={13} color={noir.info} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.focusNotesKicker}>SENSACIONES</Text>
                            <Text style={styles.focusNotesTitle}>Notas de la sesión</Text>
                          </View>
                          <View style={styles.focusNotesSmart}>
                            <Ionicons name="sparkles" size={8} color={noir.champagne} />
                            <Text style={styles.focusNotesSmartText}>Smart</Text>
                          </View>
                        </View>
                        <TextInput
                          placeholder="Registra sensaciones, fatiga o notas del entrenamiento..."
                          placeholderTextColor="rgba(255, 255, 255, 0.26)"
                          multiline
                          numberOfLines={2}
                          value={notasSesion}
                          onChangeText={cambiarNotasSesion}
                          inputMode="text"
                          keyboardType="default"
                          autoCapitalize="sentences"
                          autoCorrect={true}
                          textAlignVertical="top"
                          style={styles.focusNotesInput}
                        />
                        <View style={styles.focusExerciseNotesList}>
                          <View style={styles.focusExerciseNotesHeader}>
                            <View style={styles.focusExerciseNotesHeading}>
                              <Ionicons name="barbell-outline" size={10} color={noir.lavender} />
                              <Text style={styles.focusExerciseNotesLabel}>NOTAS POR EJERCICIO</Text>
                            </View>
                            <View style={styles.focusExerciseNotesCount}>
                              <Text style={styles.focusExerciseNotesCountText}>
                                {ejerciciosState.filter((ej) => Boolean(ej.notaEjercicio?.trim())).length}
                                /{ejerciciosState.length}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.focusExerciseNotesHint}>
                            Toca un ejercicio para ajustar máquina, técnica o sensaciones.
                          </Text>
                          <View style={styles.focusExerciseNotesGrid}>
                            {ejerciciosState.map((ej, idx) => {
                              const tieneNota = Boolean(ej.notaEjercicio?.trim());
                              const activo = idx === indexValido;
                              return (
                                <Pressable
                                  key={`nota-ej-${ej.id || idx}`}
                                  onPress={() => {
                                    seleccionarEjercicioActivo(idx);
                                    setModalNotaEjercicio({
                                      ejIdx: idx,
                                      nota: ej.notaEjercicio || '',
                                    });
                                  }}
                                  style={({ pressed }) => [
                                    styles.focusExerciseNoteChip,
                                    tieneNota && styles.focusExerciseNoteChipConNota,
                                    activo && styles.focusExerciseNoteChipActivo,
                                    pressed && { opacity: 0.78 },
                                  ]}
                                >
                                  <View style={styles.focusExerciseNoteChipHead}>
                                    <View
                                      style={[
                                        styles.focusExerciseNoteDot,
                                        tieneNota && styles.focusExerciseNoteDotOn,
                                      ]}
                                    />
                                    <Text
                                      style={styles.focusExerciseNoteChipName}
                                      numberOfLines={1}
                                    >
                                      {ej.nombre}
                                    </Text>
                                    <Ionicons
                                      name={tieneNota ? 'create-outline' : 'add'}
                                      size={11}
                                      color={tieneNota ? noir.lavender : noir.muted}
                                    />
                                  </View>
                                  <Text
                                    style={[
                                      styles.focusExerciseNoteChipText,
                                      !tieneNota && styles.focusExerciseNoteChipPlaceholder,
                                    ]}
                                    numberOfLines={2}
                                  >
                                    {tieneNota ? ej.notaEjercicio : 'Añadir nota'}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    </>
                  )}
                </ScrollView>
                {/* DOCK FIJO: única acción LiquidMetal de la pantalla */}
                {!focusTeclado && !isKeyboardVisible && (
                  <View
                    style={[
                      styles.focusDockWrap,
                      {
                        paddingHorizontal: gutter,
                        paddingBottom: Math.max(barBottomPadding, 10),
                      },
                    ]}
                    pointerEvents="box-none"
                  >
                    <View style={styles.focusDockNote}>
                      <View style={styles.focusDockDot} />
                      <Text style={styles.focusDockNoteText} numberOfLines={1}>
                        {indiceSerieDock !== null
                          ? `Serie ${indiceSerieDock + 1} de ${totalSeriesActivo} · ${seriesCompletadasActivo}/${totalSeriesActivo} completadas`
                          : todasCompletadasActivo
                          ? 'Ejercicio completado · listo para el siguiente'
                          : 'Sesión lista para guardar'}
                      </Text>
                    </View>
                    <BotonMetalLiquido
                      titulo={
                        indiceSerieDock !== null
                          ? `Completar serie ${indiceSerieDock + 1}`
                          : siguienteEjercicioIdx !== null
                          ? 'Siguiente ejercicio'
                          : 'Ver resumen'
                      }
                      icon={
                        <Ionicons
                          name={
                            indiceSerieDock !== null
                              ? 'checkmark'
                              : siguienteEjercicioIdx !== null
                              ? 'arrow-forward'
                              : 'flag'
                          }
                          size={16}
                          color={
                            indiceSerieDock !== null ? noir.mint : noir.info
                          }
                        />
                      }
                      onPress={() => {
                        if (indiceSerieDock !== null) {
                          toggleCompletarSerie(indexValido, indiceSerieDock);
                        } else if (siguienteEjercicioIdx !== null) {
                          seleccionarEjercicioActivo(siguienteEjercicioIdx);
                        } else {
                          abrirResumenConfirmacion();
                        }
                      }}
                      tamano="lg"
                      height={isLandscape ? 48 : 56}
                      activo={visible}
                      accessibilityLabel={
                        indiceSerieDock !== null
                          ? `Completar serie ${indiceSerieDock + 1}`
                          : siguienteEjercicioIdx !== null
                          ? 'Ir al siguiente ejercicio'
                          : 'Ver resumen del entrenamiento'
                      }
                      style={{ alignSelf: 'stretch' }}
                    />
                  </View>
                )}
                {/* TECLADO INTELIGENTE DE ENTRENAMIENTO */}
                {focusTeclado && (
                  <TecladoEntrenamientoInteligente
                    visible={Boolean(focusTeclado)}
                    modo={focusTeclado.campo}
                    valorActual={obtenerValorActualTeclado()}
                    nombreEjercicio={
                      parsearEjercicioInfo({ nombre: ejerciciosState[focusTeclado.ejIdx]?.nombre || '' }).nombreLimpio
                    }
                    serieNumero={focusTeclado.sIdx + 1}
                    esUnilateral={Boolean(ejerciciosState[focusTeclado.ejIdx]?.esUnilateral)}
                    lado={
                      focusTeclado.campo === 'peso' || focusTeclado.campo === 'reps'
                        ? 'D'
                        : focusTeclado.campo === 'pesoI' || focusTeclado.campo === 'repsI'
                        ? 'I'
                        : undefined
                    }
                    pesoPara1RM={
                      focusTeclado.campo === 'pesoI'
                        ? ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.pesoI ||
                          ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.peso
                        : ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.peso
                    }
                    repsPara1RM={
                      focusTeclado.campo === 'repsI'
                        ? ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.repsI ||
                          ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.reps
                        : ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.reps
                    }
                    repsMin={ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.repsMin}
                    repsMax={ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.repsMax}
                    estadoSerie={ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.estado || 'normal'}
                    valorPrevioSugerido={obtenerValorPrevioSugerido()}
                    carga={focusTeclado.campo === 'pesoI' ? ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.cargaI : ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.carga}
                    tipoCarga={resolverModoCargaEjercicio(ejerciciosState[focusTeclado.ejIdx] || ejActivo)}
                    preferenciaCarga={preferenciasCarga[normalizarNombreParaPreferencia(ejerciciosState[focusTeclado.ejIdx]?.nombre || '')] || PREFERENCIA_CARGA_POR_DEFECTO}
                    onChangeCarga={actualizarCargaDesdeTeclado}
                    onChangeValor={actualizarValorDesdeTeclado}
                    onNext={avanzarCampoTeclado}
                    onCompletarSerie={completarSerieDesdeTeclado}
                    onClose={() => setFocusTeclado(null)}
                    onMedirAltura={setAltoTecladoEntrenamiento}
                  />
                )}
              </View>
            )}
          </View>
        </FondoPantalla>
      </KeyboardAvoidingView>
      {/* MODAL DE RESUMEN Y CONFIRMACIÓN */}
      {resumenVisible && (
        <ResumenEntrenamientoModal
          visible={resumenVisible}
          nombreRutina={registro.rutina_nombre || registro.rutinas?.nombre || 'Entrenamiento del Día'}
          fechaTexto={nombreDia(fecha)}
          segundosTranscurridos={segundosTranscurridos}
          totalSeriesEnSesion={totalSeriesEnSesion}
          totalSeriesCompletadas={totalSeriesCompletadas}
          totalSeriesNoHechas={totalSeriesNoHechas}
          volumenTotalKg={volumenTotalKg}
          ejerciciosResumen={ejerciciosResumen}
          notasSesion={notasSesion}
          onChangeNotasSesion={cambiarNotasSesion}
          guardando={guardando}
          onClose={volverAEditarDesdeResumen}
          onConfirmarGuardar={guardarSesionFinal}
          onDescartarSesion={descartarSesion}
          esSoloLectura={esModoResumen}
          onGuardarEdiciones={guardarEdicionesResumen}
        />
      )}
      {/* ALCANCE Y POSICIÓN PARA AÑADIR UN BLOQUE */}
      <Modal visible={alcanceAgregar !== null} transparent animationType="fade" onRequestClose={() => setAlcanceAgregar(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAlcanceAgregar(null)}>
          <Pressable style={styles.sheetContent} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Añadir ejercicio</Text>
            <Text style={styles.sheetSubtitle}>Elige dónde guardarlo y su posición en la sesión.</Text>
            {(['solo_hoy', 'rutina'] as const).map((modo) => (
              <Pressable key={modo} onPress={() => setAlcanceAgregar((prev) => prev ? { ...prev, modo } : prev)} style={[styles.sheetOption, alcanceAgregar?.modo === modo && { borderColor: noir.info }]}>
                <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(92, 200, 255, 0.13)' }]}><Ionicons name={modo === 'solo_hoy' ? 'today-outline' : 'repeat-outline'} size={18} color={noir.info} /></View>
                <View style={{ flex: 1 }}><Text style={styles.sheetOptionText}>{modo === 'solo_hoy' ? 'Solo esta sesión' : 'Guardar también en la rutina'}</Text></View>
                {alcanceAgregar?.modo === modo && <Ionicons name="checkmark-circle" size={17} color={noir.mint} />}
              </Pressable>
            ))}
            <Text style={[styles.sheetSubtitle, { marginTop: 4 }]}>POSICIÓN</Text>
            {(['final', 'despues'] as const).map((posicion) => (
              <Pressable key={posicion} onPress={() => setAlcanceAgregar((prev) => prev ? { ...prev, posicion } : prev)} style={[styles.sheetOption, alcanceAgregar?.posicion === posicion && { borderColor: noir.info }]}>
                <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(63, 242, 176, 0.1)' }]}><Ionicons name={posicion === 'final' ? 'arrow-down' : 'arrow-forward'} size={17} color={noir.mint} /></View>
                <View style={{ flex: 1 }}><Text style={styles.sheetOptionText}>{posicion === 'final' ? 'Al final' : `Después del ejercicio ${indexValido + 1}`}</Text></View>
                {alcanceAgregar?.posicion === posicion && <Ionicons name="checkmark-circle" size={17} color={noir.mint} />}
              </Pressable>
            ))}
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setAlcanceAgregar(null)} style={styles.dialogBtnSecondary}><Text style={styles.dialogBtnSecondaryText}>Cancelar</Text></Pressable>
              <Pressable onPress={() => {
                if (!alcanceAgregar) return;
                const posicion = alcanceAgregar.posicion === 'final' ? ejerciciosState.length : indexValido + 1;
                const modo = alcanceAgregar.modo;
                setAlcanceAgregar(null);
                setTimeout(() => setSelectorIntercambio({ ejIdx: indexValido, modo, accion: 'agregar', posicion }), 160);
              }} style={styles.dialogBtnPrimary}><Text style={styles.dialogBtnPrimaryText}>Elegir ejercicio</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* MODAL / SHEET: BIBLIOTECA COMPLETA PARA REEMPLAZAR O AÑADIR */}
      {selectorIntercambio && (
        <SelectorBibliotecaModal
          visible
          onClose={() => setSelectorIntercambio(null)}
          titulo={selectorIntercambio.accion === 'agregar' ? 'Añadir ejercicio' : 'Reemplazar ejercicio'}
          subtitulo={
            selectorIntercambio.accion === 'agregar'
              ? selectorIntercambio.modo === 'solo_hoy'
                ? 'Solo esta sesión · elige un ejercicio para añadir'
                : 'Guardar también en la rutina · elige un ejercicio para añadir'
              : selectorIntercambio.modo === 'solo_hoy'
              ? 'Solo por esta sesión · elige cualquier ejercicio de la biblioteca completa'
              : 'Cambio permanente en la rutina · elige cualquier ejercicio de la biblioteca completa'
          }
          onSeleccionar={(seleccionado) => {
            const pendiente = selectorIntercambio;
            setSelectorIntercambio(null);
            if (pendiente.accion === 'agregar') {
              void agregarEjercicioASesion(seleccionado.nombre, pendiente.modo, pendiente.posicion ?? ejerciciosState.length);
            } else {
              void aplicarIntercambioEjercicio(pendiente.ejIdx, seleccionado.nombre, pendiente.modo);
            }
          }}
        />
      )}
      {/* MODAL / SHEET: OPCIONES DE LA SERIE */}
      <Modal
        visible={serieMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSerieMenu(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSerieMenu(null)}>
          <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            {serieMenu && ejerciciosState[serieMenu.ejIdx]?.series[serieMenu.sIdx] && (() => {
              const currentSerie = ejerciciosState[serieMenu.ejIdx].series[serieMenu.sIdx];
              return (
                <View style={{ gap: 10 }}>
                  <View style={{ paddingBottom: 6, borderBottomWidth: 1, borderColor: colores.borde }}>
                    <Text style={styles.sheetTitle}>
                      Opciones Serie #{serieMenu.sIdx + 1}
                    </Text>
                    <Text style={styles.sheetSubtitle}>
                      {ejerciciosState[serieMenu.ejIdx].nombre}
                    </Text>
                  </View>
                  {/* Configuración de Reps Parciales */}
                  <View style={styles.sheetConfigBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="flash" size={18} color="#F59E0B" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetOptionText}>
                          {currentSerie.tieneParciales
                            ? `Reps Parciales: +${currentSerie.repsParciales || 3}p`
                            : 'Activar reps parciales (+p)'}
                        </Text>
                        <Text style={styles.sheetOptionSubtext}>
                          {currentSerie.tieneParciales ? 'Ajusta la cifra tras el fallo muscular' : 'Repeticiones extras tras el fallo'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          const activando = !currentSerie.tieneParciales;
                          toggleRepsParciales(serieMenu.ejIdx, serieMenu.sIdx);
                          if (activando) {
                            setFocusTeclado({ ejIdx: serieMenu.ejIdx, sIdx: serieMenu.sIdx, campo: 'parciales' });
                            setSerieMenu(null);
                          }
                        }}
                        style={[
                          styles.switchBadgeMini,
                          currentSerie.tieneParciales ? styles.switchBadgeMiniActivo : styles.switchBadgeMiniInactivo,
                        ]}
                      >
                        <Text style={[
                          styles.switchBadgeMiniText,
                          currentSerie.tieneParciales && { color: '#F59E0B' },
                        ]}>
                          {currentSerie.tieneParciales ? 'QUITAR' : 'ACTIVAR'}
                        </Text>
                      </Pressable>
                    </View>
                    {Boolean(currentSerie.tieneParciales) && (
                      <View style={styles.sheetConfigRow}>
                        <View style={styles.sheetStepperContainer}>
                          <Pressable
                            onPress={() => {
                              const actual = currentSerie.repsParciales || 3;
                              toggleRepsParciales(serieMenu.ejIdx, serieMenu.sIdx, Math.max(1, actual - 1));
                            }}
                            style={styles.stepperBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="remove" size={16} color="#FFFFFF" />
                          </Pressable>
                          <Text style={styles.stepperValText}>+{currentSerie.repsParciales || 3}p</Text>
                          <Pressable
                            onPress={() => {
                              const actual = currentSerie.repsParciales || 3;
                              toggleRepsParciales(serieMenu.ejIdx, serieMenu.sIdx, actual + 1);
                            }}
                            style={styles.stepperBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="add" size={16} color="#FFFFFF" />
                          </Pressable>
                        </View>
                        <View style={styles.quickChipsRow}>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <Pressable
                              key={num}
                              onPress={() => {
                                toggleRepsParciales(serieMenu.ejIdx, serieMenu.sIdx, num);
                              }}
                              style={[
                                styles.quickChip,
                                currentSerie.repsParciales === num && styles.quickChipActivo,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickChipText,
                                  currentSerie.repsParciales === num && styles.quickChipTextActivo,
                                ]}
                              >
                                +{num}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                  {/* Toggle Dropset */}
                  <Pressable
                    onPress={() => {
                      toggleDropset(serieMenu.ejIdx, serieMenu.sIdx);
                      setSerieMenu(null);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                      <Ionicons name="arrow-down-circle" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>
                        {currentSerie.esDropset ? 'Desactivar dropset' : 'Activar dropset'}
                      </Text>
                      <Text style={styles.sheetOptionSubtext}>
                        {currentSerie.esDropset ? 'Eliminar series descendentes' : 'Añadir sub-series con -20% peso'}
                      </Text>
                    </View>
                    <Ionicons
                      name={currentSerie.esDropset ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={currentSerie.esDropset ? "#38BDF8" : colores.suave}
                    />
                  </Pressable>
                  {/* Duplicar Serie */}
                  <Pressable
                    onPress={() => {
                      duplicarSerie(serieMenu.ejIdx, serieMenu.sIdx);
                      setSerieMenu(null);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: colores.primarioSuave }]}>
                      <Ionicons name="copy-outline" size={18} color={colores.primarioHover} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Duplicar serie</Text>
                      <Text style={styles.sheetOptionSubtext}>Crear una serie idéntica debajo</Text>
                    </View>
                  </Pressable>
                  {/* Eliminar Serie */}
                  <Pressable
                    onPress={() => {
                      const { ejIdx, sIdx } = serieMenu;
                      setSerieMenu(null);
                      eliminarSerieConDeshacer(ejIdx, sIdx);
                    }}
                    style={[styles.sheetOption, styles.sheetOptionDanger]}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Eliminar serie</Text>
                      <Text style={styles.sheetOptionSubtext}>Podrás deshacer durante 6 segundos</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
      {/* MODAL / SHEET: OPCIONES DEL EJERCICIO */}
      <Modal
        visible={ejercicioMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEjercicioMenu(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setEjercicioMenu(null)}>
          <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            {ejercicioMenu !== null && ejerciciosState[ejercicioMenu] && (() => {
              const ej = ejerciciosState[ejercicioMenu];
              return (
                <View style={{ gap: 10 }}>
                  <View style={{ paddingBottom: 6, borderBottomWidth: 1, borderColor: colores.borde }}>
                    <Text style={styles.sheetTitle}>
                      {ej.nombre}
                    </Text>
                    <Text style={styles.sheetSubtitle}>
                      4 acciones · {ej.series.length}{' '}
                      {ej.series.length === 1 ? 'serie registrada' : 'series registradas'}
                    </Text>
                  </View>
                  {/* Tutorial */}
                  <Pressable
                    onPress={() => {
                      setEjercicioMenu(null);
                      setTimeout(() => {
                        setSolicitudTutorial((valor) => valor + 1);
                      }, 160);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(92, 200, 255, 0.13)' }]}>
                      <Ionicons name="play" size={18} color={noir.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Tutorial</Text>
                      <Text style={styles.sheetOptionSubtext}>Técnica, animación y anatomía del ejercicio</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={noir.muted} />
                  </Pressable>
                  {/* Previa / Historial */}
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      setEjercicioMenu(null);
                      setTimeout(() => {
                        abrirPrevia(idx);
                      }, 160);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(63, 242, 176, 0.12)' }]}>
                      <Ionicons name="analytics-outline" size={18} color={noir.mint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Previa</Text>
                      <Text style={styles.sheetOptionSubtext}>Historial completo, récords y evolución</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={noir.muted} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      setEjercicioMenu(null);
                      abrirReemplazo(idx);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.13)' }]}>
                      <Ionicons name="swap-horizontal" size={18} color="#B394FF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Reemplazar</Text>
                      <Text style={styles.sheetOptionSubtext}>Por esta sesión o permanente · biblioteca completa</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={noir.muted} />
                  </Pressable>
                  {/* Eliminar Ejercicio */}
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      setEjercicioMenu(null);
                      eliminarEjercicioDeSesion(idx);
                    }}
                    style={[styles.sheetOption, styles.sheetOptionDanger]}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Eliminar Ejercicio</Text>
                      <Text style={styles.sheetOptionSubtext}>Quitar de esta sesión de entrenamiento</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
      {ejercicioConfig && (
        <ConfiguracionCargaEjercicioModal
          visible
          nombreEjercicio={ejercicioConfig.nombre}
          tipo={tipoConfig}
          preferencia={obtenerPreferenciaEjercicio(ejercicioConfig)}
          onClose={() => setConfiguracionCargaIdx(null)}
          onGuardar={(preferencia) => {
            const idx = configuracionCargaIdx;
            const actual = idx !== null ? ejerciciosState[idx] : null;
            if (idx === null || !actual) return;
            const normalizada = { ...normalizarPreferenciaCarga(preferencia), tipo: tipoConfig };
            guardarPreferenciaCarga(actual.nombre, normalizada).catch(() => undefined);
            setPreferenciasCarga((prev) => ({ ...prev, [normalizarNombreParaPreferencia(actual.nombre)]: normalizada }));
            setEjerciciosState((prev) => {
              const next = prev.map((item, i) => {
                if (i !== idx) return item;
                return {
                  ...item,
                  modoKg: tipoConfig,
                  series: item.series.map((serie) => {
                    const principal = recalcularPesoDeCarga(serie.carga, normalizada, serie.peso);
                    if (!item.esUnilateral) {
                      return { ...serie, carga: principal.carga, peso: principal.peso };
                    }
                    const izquierdo = recalcularPesoDeCarga(
                      serie.cargaI,
                      normalizada,
                      serie.pesoI !== undefined && serie.pesoI !== '' ? serie.pesoI : serie.peso
                    );
                    return {
                      ...serie,
                      carga: principal.carga,
                      peso: principal.peso,
                      cargaI: izquierdo.carga,
                      pesoI: izquierdo.peso,
                    };
                  }),
                };
              });
              guardarDraftAuto(next);
              return next;
            });
            setConfiguracionCargaIdx(null);
            mostrarSnackbar('Ajustes de carga guardados.');
          }}
        />
      )}
      {/* MODAL / SHEET: ALCANCE DEL REEMPLAZO */}
      <Modal
        visible={reemplazoMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReemplazoMenu(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setReemplazoMenu(null)}
        >
          <Pressable
            style={styles.sheetContent}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            {reemplazoMenu !== null &&
              ejerciciosState[reemplazoMenu.ejIdx] &&
              (() => {
                const ej = ejerciciosState[reemplazoMenu.ejIdx];
                return (
                  <View style={{ gap: 10 }}>
                    <View
                      style={{
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderColor: colores.borde,
                      }}
                    >
                      <Text style={styles.sheetTitle}>Reemplazar ejercicio</Text>
                      <Text style={styles.sheetSubtitle} numberOfLines={1}>
                        {ej.nombre} · elige cómo aplicar el cambio
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => elegirModoReemplazo('solo_hoy')}
                      style={styles.sheetOption}
                    >
                      <View
                        style={[
                          styles.sheetIconBox,
                          { backgroundColor: 'rgba(92, 200, 255, 0.13)' },
                        ]}
                      >
                        <Ionicons
                          name="today-outline"
                          size={18}
                          color={noir.info}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetOptionText}>
                          Solo por esta sesión
                        </Text>
                        <Text style={styles.sheetOptionSubtext}>
                          El nuevo empieza sin series ni reps · podrás
                          deshacerlo
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={noir.muted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => elegirModoReemplazo('rutina')}
                      style={styles.sheetOption}
                    >
                      <View
                        style={[
                          styles.sheetIconBox,
                          { backgroundColor: 'rgba(179, 148, 255, 0.13)' },
                        ]}
                      >
                        <Ionicons
                          name="repeat"
                          size={18}
                          color={noir.lavender}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetOptionText}>
                          Permanente en la rutina
                        </Text>
                        <Text style={styles.sheetOptionSubtext}>
                          Hereda series, reps y peso · se usará en próximos días
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={noir.muted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setReemplazoMenu(null)}
                      style={{ alignSelf: 'center', padding: 10 }}
                    >
                      <Text
                        style={{
                          color: noir.muted,
                          fontFamily: fuentes.bold,
                          fontSize: 12,
                        }}
                      >
                        Cancelar
                      </Text>
                    </Pressable>
                  </View>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>
      {/* MODAL: HISTORIAL COMPLETO / EVOLUCIÓN DEL EJERCICIO */}
      {previaEjercicio && (
        <HistorialEjercicioModal
          visible
          nombreEjercicio={previaEjercicio.nombre}
          registroActualId={registro?.id}
          onClose={() => setPreviaEjercicio(null)}
          onUsarSesion={(sesion) => {
            aplicarSeriesHistorial(previaEjercicio.ejIdx, sesion);
          }}
        />
      )}
      {/* MODAL CONFIRMACIÓN: CAMBIO PERMANENTE EN RUTINA */}
      <Modal
        visible={confirmacionPermanente !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmacionPermanente(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setConfirmacionPermanente(null)}>
          <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="repeat" size={20} color="#A855F7" />
              </View>
              <Text style={styles.dialogTitle}>¿Cambiar en la rutina?</Text>
            </View>
            <Text style={styles.dialogText}>
              Se reemplazará{' '}
              <Text style={{ fontFamily: fuentes.bold, color: colores.texto }}>
                &quot;{confirmacionPermanente?.nombreRutinaOriginal}&quot;
              </Text>{' '}
              por{' '}
              <Text style={{ fontFamily: fuentes.bold, color: colores.primarioHover }}>
                &quot;{confirmacionPermanente?.nuevoNombre}&quot;
              </Text>{' '}
              en la rutina base.{' '}
              {confirmacionPermanente?.nombreRutinaOriginal !==
              confirmacionPermanente?.nombreOriginal ? (
                <Text>
                  {`El cambio temporal "${confirmacionPermanente?.nombreOriginal}" desaparecerá de esta sesión.`}
                </Text>
              ) : (
                <Text>El original desaparecerá también de esta sesión y las próximas.</Text>
              )}
            </Text>
            {confirmacionPermanente && (
              <View style={styles.dialogInheritanceBox}>
                <Ionicons name="git-merge-outline" size={14} color={noir.lavender} />
                <Text style={styles.dialogInheritanceText}>
                  Heredará{' '}
                  <Text style={styles.dialogInheritanceStrong}>
                    {resumenHerenciaPermanente(confirmacionPermanente.ejercicioNuevo)}
                  </Text>
                  .
                </Text>
              </View>
            )}
            <Text style={styles.dialogSubtext}>
              Tendrás 6 segundos para deshacer la acción mediante la barra inferior.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setConfirmacionPermanente(null)}
                style={styles.dialogBtnSecondary}
              >
                <Text style={styles.dialogBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (confirmacionPermanente) {
                    consolidarCambioPermanente(confirmacionPermanente);
                    setConfirmacionPermanente(null);
                  }
                }}
                style={styles.dialogBtnPrimary}
              >
                <Text style={styles.dialogBtnPrimaryText}>Confirmar cambio</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* MODAL NOTA DEL EJERCICIO */}
      <Modal
        visible={modalNotaEjercicio !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNotaEjercicio(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.noteOverlay}
            onPress={() => setModalNotaEjercicio(null)}
          >
            <Pressable
              style={styles.noteSheet}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.noteSheetHeader}>
                <View style={styles.noteSheetIcon}>
                  <Ionicons
                    name="barbell-outline"
                    size={18}
                    color={noir.lavender}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.noteSheetKicker}>NOTA DEL EJERCICIO</Text>
                  <Text style={styles.noteSheetTitle} numberOfLines={1}>
                    {modalNotaEjercicio &&
                      ejerciciosState[modalNotaEjercicio.ejIdx]?.nombre}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setModalNotaEjercicio(null)}
                  style={styles.noteSheetClose}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={noir.text} />
                </Pressable>
              </View>
              <Text style={styles.noteSheetHint}>
                Ajustes de máquina, técnica o sensaciones. Se guardará junto a
                este ejercicio y aparecerá en el resumen de la sesión.
              </Text>
              <TextInput
                placeholder="Ej. Asiento posición 4, polea a la altura del hombro..."
                placeholderTextColor="rgba(255, 255, 255, 0.26)"
                multiline
                numberOfLines={4}
                value={modalNotaEjercicio?.nota || ''}
                onChangeText={(val) => {
                  if (modalNotaEjercicio) {
                    setModalNotaEjercicio({ ...modalNotaEjercicio, nota: val });
                  }
                }}
                inputMode="text"
                keyboardType="default"
                autoCapitalize="sentences"
                autoCorrect={true}
                textAlignVertical="top"
                style={styles.noteSheetInput}
              />
              <View style={styles.noteSuggestionHeader}>
                <Ionicons name="sparkles" size={10} color={noir.champagne} />
                <Text style={styles.noteSuggestionLabel}>
                  SUGERENCIAS RÁPIDAS
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.noteSuggestionRow}
                keyboardShouldPersistTaps="handled"
              >
                {SUGERENCIAS_NOTA_EJERCICIO.map((sugerencia) => (
                  <Pressable
                    key={sugerencia}
                    onPress={() => agregarSugerenciaNota(sugerencia)}
                    style={({ pressed }) => [
                      styles.noteSuggestionChip,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.noteSuggestionChipText}>
                      + {sugerencia}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.noteSheetActions}>
                <Pressable
                  onPress={() => setModalNotaEjercicio(null)}
                  style={styles.noteSheetSecondary}
                >
                  <Text style={styles.noteSheetSecondaryText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!modalNotaEjercicio) return;
                    const nota = modalNotaEjercicio.nota.trim();
                    setEjerciciosState((prev) => {
                      const next = prev.map((e, i) =>
                        i === modalNotaEjercicio.ejIdx
                          ? { ...e, notaEjercicio: nota }
                          : e
                      );
                      guardarDraftAuto(next);
                      return next;
                    });
                    setModalNotaEjercicio(null);
                    mostrarSnackbar(
                      nota
                        ? 'Nota del ejercicio guardada.'
                        : 'Nota del ejercicio eliminada.'
                    );
                  }}
                  style={styles.noteSheetPrimary}
                >
                  <Ionicons name="checkmark" size={14} color="#07110D" />
                  <Text style={styles.noteSheetPrimaryText}>Guardar nota</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      {/* SNACKBAR DESHACER (6 SEGUNDOS) */}
      {snackbar && (
        <View
          style={[
            styles.snackbarContainer,
            {
              bottom: barBottomPadding + (isLandscape ? 60 : 76),
              left: isLandscape || isTablet ? 'auto' : gutter,
              right: isLandscape || isTablet ? 'auto' : gutter,
              width: isLandscape || isTablet ? Math.min(width - gutter * 2, 600) : undefined,
              alignSelf: 'center',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.snackbarText} numberOfLines={2}>
              {snackbar.mensaje}
            </Text>
          </View>
            {snackbar.onDeshacer && (
            <Pressable
              onPress={() => {
                const ejecutarAccion = snackbar.onDeshacer;
                setSnackbar(null);
                ejecutarAccion?.();
              }}
              style={styles.snackbarBtn}
              hitSlop={8}
            >
              <Text style={styles.snackbarBtnText}>{snackbar.textoAccion || 'DESHACER (6s)'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Modal>
  );
}
