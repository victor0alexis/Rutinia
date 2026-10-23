import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes, noir } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import ScreenBackground from './ScreenBackground';
import { LiquidMetalButton } from './LiquidMetalButton';
import CarruselEjerciciosHeader from './entrenamiento/CarruselEjerciciosHeader';
import HeroEjercicioActivo from './entrenamiento/HeroEjercicioActivo';
import TablaSeriesFocus from './entrenamiento/TablaSeriesFocus';
import ResumenEntrenamientoModal, { EjercicioResumen } from './ResumenEntrenamientoModal';
import SelectorIntercambioModal from './SelectorIntercambioModal';
import SmartWorkoutKeyboard, { CampoEntrenamiento } from './SmartWorkoutKeyboard';
import {
  actualizarEjecucionEjercicio,
  actualizarEstadoRegistro,
  obtenerHistorialPrevioRutina,
  obtenerHistorialPrevioEjercicio,
} from '../services/registros';
import { reemplazarEjercicioEnRutina } from '../services/rutinas';
import { seguro, mostrarMensaje } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { nombreDia } from '../utils/fechas';
import { Registro } from '../types';
import { calcularKgSugeridoDrop } from '../constants/entrenamiento';
import { supabase } from '../lib/supabase';
import {
  EstadoTimer,
  obtenerOIniciarTimer,
  alternarPausaTimer,
  calcularSegundosTranscurridos,
  formatearTiempo,
} from '../utils/timer';
import {
  guardarBorradorSesion,
  obtenerBorradorSesion,
  limpiarSesionActiva,
} from '../utils/sesionActiva';

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
  rir: string;
  nota: string;
  completado: boolean;
  repsParciales: number;
  tieneParciales: boolean;
  esDropset: boolean;
  drops: DropItemEjecucion[];
  tipo?: 'normal' | 'calentamiento' | 'fallo';
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
};

export type SerieHistorica = {
  peso: string;
  reps: string;
  rir: string;
  nota: string;
  repsParciales?: number;
  esDropset?: boolean;
  drops?: DropItemEjecucion[];
};

type HistoricoEjercicio = {
  fechaFormateada: string;
  series: SerieHistorica[];
};

type HistoricoMap = Record<string, HistoricoEjercicio>;

export default function EjecutarEntrenamientoModal({
  visible,
  registro,
  fecha,
  onClose,
  onGuardado,
  modoReanudar = false,
}: Props) {

  // ── Responsive layout centralizado con useLayout ───────────────────────────
  const {
    width,
    isLandscape,
    isTablet,
    gutter,
    contentMaxWidth,
    topInset,
    bottomInset,
    isKeyboardVisible,
  } = useLayout();

  const dockHeight = isLandscape ? 76 : 98;
  const [focusTeclado, setFocusTeclado] = useState<FocusTeclado>(null);
  const scrollBottomPad = (focusTeclado ? 320 : isKeyboardVisible ? 16 : dockHeight) + bottomInset + 20;

  const [ejerciciosState, setEjerciciosState] = useState<EjercicioState[]>([]);
  const [ejercicioActivoIndex, setEjercicioActivoIndex] = useState(0);
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
  const [selectorIntercambio, setSelectorIntercambio] = useState<{ ejIdx: number; modo: 'solo_hoy' | 'rutina' } | null>(null);
  const [modalNotaEjercicio, setModalNotaEjercicio] = useState<{ ejIdx: number; nota: string } | null>(null);
  const [confirmacionPermanente, setConfirmacionPermanente] = useState<{
    ejIdx: number;
    nombreOriginal: string;
    nuevoNombre: string;
    seriesHeredadas: SerieEjecucion[];
    seriesCompletadas: SerieEjecucion[];
  } | null>(null);

  // SNACKBAR CON DESHACER (6 SEGUNDOS)
  const [snackbar, setSnackbar] = useState<{ mensaje: string; onDeshacer?: () => void } | null>(null);
  const snackbarTimerRef = useRef<any>(null);

  const mostrarSnackbar = (mensaje: string, onDeshacer?: () => void) => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    setSnackbar({ mensaje, onDeshacer });
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

      if (borradorPrevio && borradorPrevio.ejerciciosState && borradorPrevio.ejerciciosState.length > 0) {
        parsedEjercicios = borradorPrevio.ejerciciosState.map((ej) => ({
          ...ej,
          series: ej.series.map((s) => ({
            ...s,
            repsParciales: s.repsParciales || 0,
            tieneParciales: Boolean(s.tieneParciales || (s.repsParciales && s.repsParciales > 0)),
            esDropset: Boolean(s.esDropset || (s.drops && s.drops.length > 0)),
            drops: s.drops ? s.drops.map((d) => ({ ...d })) : [],
          })),
        }));
        notasTexto = borradorPrevio.notasSesion || '';
      } else {
        const obsExistente = (registro.ejercicios_registro || []).find((e) =>
          e.nombre.includes('📌 [OBSERVACIONES]')
        );
        notasTexto = obsExistente
          ? obsExistente.nombre.replace('📌 [OBSERVACIONES] ', '').trim()
          : '';

        const ejsPure = (registro.ejercicios_registro || []).filter(
          (e) => !e.nombre.startsWith('📌')
        );

        parsedEjercicios = ejsPure.map((e) => {
          const parsed = parsearEjercicioInfo(e);
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

            return {
              id: i.toString() + Math.random().toString(),
              peso: pesoStr,
              reps: repsStr,
              pesoI: pesoIStr,
              repsI: repsIStr,
              rir: rirStr,
              nota: notaStr,
              completado: sDetail ? sDetail.completado : Boolean(e.completado),
              repsParciales: rParciales,
              tieneParciales: tieneP,
              esDropset: esDrop,
              drops: dropsArray,
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
          };
        });
      }

      setNotasSesion(notasTexto);
      setEjerciciosState(parsedEjercicios);

      // Guardar borrador inicial
      const nombreRutina = registro.rutinas?.nombre || 'Entrenamiento';
      await guardarBorradorSesion(registro.id, {
        nombreRutina,
        fechaISO: registro.fecha,
        notasSesion: notasTexto,
        ejerciciosState: parsedEjercicios,
      });

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
            const sPrevArray: SerieHistorica[] = parsedPrev.detallesSets.map((ds) => ({
              peso: ds.pesoD || (ePrev.peso ? ePrev.peso.toString() : ''),
              reps: ds.repsD || (ePrev.repeticiones ? ePrev.repeticiones.toString() : ''),
              rir: ds.rir || '',
              nota: ds.nota || '',
              repsParciales: ds.repsParciales || 0,
              esDropset: ds.esDropset || false,
              drops: ds.drops ? ds.drops.map((d) => ({ ...d })) : [],
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
    }, 0);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [visible, registro, modoReanudar]);

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
      completado: ej.series.length > 0 && ej.series.every((s) => s.completado),
      totalSeries: ej.series.length,
      seriesCompletadas: ej.series.filter((s) => s.completado).length,
    }));
  }, [ejerciciosState]);

  const indexValido = Math.min(
    Math.max(0, ejercicioActivoIndex),
    Math.max(0, ejerciciosState.length - 1)
  );
  const ejActivo = ejerciciosState[indexValido] || ejerciciosState[0];

  const seriesFocus = useMemo(() => {
    if (!ejActivo) return [];
    const hist = historialMap[ejActivo.nombre];
    return ejActivo.series.map((s, sIdx) => {
      const prevSet = hist?.series[sIdx];
      const previaStr = prevSet ? `${prevSet.peso} × ${prevSet.reps}` : undefined;
      return {
        id: s.id,
        setNum: sIdx + 1,
        peso: s.peso,
        reps: s.reps,
        rir: s.rir,
        completado: s.completado,
        previa: previaStr,
        repsParciales: s.repsParciales,
        tipo: s.tipo || 'normal',
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
    ? ejActivo.series.filter((s) => s.completado).length
    : 0;
  const totalSeriesActivo = ejActivo?.series.length || 0;
  const indiceSerieDockRaw =
    ejActivo?.series.findIndex((s) => !s.completado) ?? -1;
  const indiceSerieDock = indiceSerieDockRaw >= 0 ? indiceSerieDockRaw : null;
  const siguienteEjercicioIdx =
    indexValido + 1 < ejerciciosState.length ? indexValido + 1 : null;
  const todasCompletadasActivo =
    totalSeriesActivo > 0 && seriesCompletadasActivo >= totalSeriesActivo;

  if (!fecha || !registro) return null;

  const totalSeriesEnSesion = ejerciciosState.reduce((acc, ej) => acc + ej.series.length, 0);
  const totalSeriesCompletadas = ejerciciosState.reduce(
    (acc, ej) => acc + ej.series.filter((s) => s.completado).length,
    0
  );
  const porcentajeProgreso =
    totalSeriesEnSesion > 0
      ? Math.round((totalSeriesCompletadas / totalSeriesEnSesion) * 100)
      : 0;

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
  };

  const guardarDraftAuto = (nextState: EjercicioState[], nTexto: string = notasSesion) => {
    if (!registro) return;
    const nombreRutina = registro.rutinas?.nombre || 'Entrenamiento';
    guardarBorradorSesion(registro.id, {
      nombreRutina,
      fechaISO: registro.fecha,
      notasSesion: nTexto,
      ejerciciosState: nextState,
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
              rir: ultimaSerie ? ultimaSerie.rir : '',
              nota: '',
              completado: false,
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

    cambiarCampoSerie(ejIndex, sIndex, 'completado', !s.completado);
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
    const serie = ejerciciosState[ejIdx]?.series[sIdx];
    if (!serie) return '';

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

    if (campo === 'pesoI') return serie.pesoI !== undefined ? serie.pesoI : serie.peso;
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
      if (sIdx > 0 && ej.series[sIdx - 1]?.peso) {
        return ej.series[sIdx - 1].peso;
      }
      return hist?.series[sIdx]?.peso;
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

    cambiarCampoSerie(ejIdx, sIdx, campo, nuevoValor);
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

  const copiarSeriesHistorial = (ejIndex: number) => {
    const ej = ejerciciosState[ejIndex];
    if (!ej) return;
    const hist = historialMap[ej.nombre];
    if (!hist || !hist.series.length) return;

    setEjerciciosState((prev) => {
      const next = prev.map((e, i) => {
        if (i !== ejIndex) return e;
        return {
          ...e,
          series: e.series.map((s, sIdx) => {
            const hPrev = hist.series[sIdx] || hist.series[hist.series.length - 1];
            return {
              ...s,
              peso: hPrev?.peso ? hPrev.peso : s.peso,
              reps: hPrev?.reps ? hPrev.reps : s.reps,
              rir: hPrev?.rir ? hPrev.rir : s.rir,
              repsParciales: hPrev?.repsParciales !== undefined ? hPrev.repsParciales : s.repsParciales,
              tieneParciales: Boolean(hPrev?.repsParciales && hPrev.repsParciales > 0),
              esDropset: Boolean(hPrev?.esDropset || (hPrev?.drops && hPrev.drops.length > 0)),
              drops: hPrev?.drops && hPrev.drops.length > 0
                ? hPrev.drops.map((d) => ({ ...d }))
                : s.drops,
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
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

    const yaExiste = ejerciciosState.some(
      (e, i) => i !== ejIdx && e.nombre.trim().toLowerCase() === nuevoNombre.trim().toLowerCase()
    );
    if (yaExiste) {
      mostrarMensaje('Ejercicio ya presente', `"${nuevoNombre}" ya está en este entrenamiento.`);
      return;
    }

    const seriesCompletadas = ejActual.series.filter((s) => s.completado);
    const seriesNoCompletadas = ejActual.series.filter((s) => !s.completado);

    const seriesHeredadas: SerieEjecucion[] = (
      seriesNoCompletadas.length > 0 ? seriesNoCompletadas : [ejActual.series[0]]
    ).map((s, idx) => ({
      id: Date.now().toString() + Math.random().toString(),
      peso: '',
      reps: '',
      pesoI: '',
      repsI: '',
      rir: '',
      nota: '',
      completado: false,
      repsParciales: 0,
      tieneParciales: false,
      esDropset: false,
      drops: [],
    }));

    // Cargar historial del nuevo ejercicio
    const histNuevo = await obtenerHistorialPrevioEjercicio(nuevoNombre, registro?.fecha);
    if (histNuevo) {
      setHistorialMap((prev) => ({
        ...prev,
        [nuevoNombre]: histNuevo,
      }));
    }

    if (modo === 'solo_hoy') {
      let nuevoEjerciciosState: EjercicioState[] = [];
      if (seriesCompletadas.length > 0) {
        const ejOriginalRestante: EjercicioState = {
          ...ejActual,
          series: seriesCompletadas,
        };
        const ejNuevoState: EjercicioState = {
          id: Date.now().toString() + Math.random().toString(),
          nombre: nuevoNombre,
          esUnilateral: false,
          series: seriesHeredadas,
          sustituye_a_nombre: nombreOriginal,
          sustitucion_alcance: 'solo_hoy',
        };
        nuevoEjerciciosState = [
          ...ejerciciosState.slice(0, ejIdx),
          ejOriginalRestante,
          ejNuevoState,
          ...ejerciciosState.slice(ejIdx + 1),
        ];
      } else {
        const ejNuevoState: EjercicioState = {
          ...ejActual,
          nombre: nuevoNombre,
          series: seriesHeredadas,
          sustituye_a_nombre: nombreOriginal,
          sustitucion_alcance: 'solo_hoy',
        };
        nuevoEjerciciosState = [
          ...ejerciciosState.slice(0, ejIdx),
          ejNuevoState,
          ...ejerciciosState.slice(ejIdx + 1),
        ];
      }

      setEjerciciosState(nuevoEjerciciosState);
      guardarDraftAuto(nuevoEjerciciosState);
      setSelectorIntercambio(null);
      mostrarMensaje('Sustitución aplicada', `"${nombreOriginal}" ha sido sustituido por "${nuevoNombre}" para hoy.`);
    } else {
      setSelectorIntercambio(null);
      setConfirmacionPermanente({
        ejIdx,
        nombreOriginal,
        nuevoNombre,
        seriesHeredadas,
        seriesCompletadas,
      });
    }
  };

  const consolidarCambioPermanente = (conf: {
    ejIdx: number;
    nombreOriginal: string;
    nuevoNombre: string;
    seriesHeredadas: SerieEjecucion[];
    seriesCompletadas: SerieEjecucion[];
  }) => {
    const { ejIdx, nombreOriginal, nuevoNombre, seriesHeredadas, seriesCompletadas } = conf;
    const ejActual = ejerciciosState[ejIdx];
    const prevEjerciciosState = [...ejerciciosState];

    let nuevoEjerciciosState: EjercicioState[] = [];
    if (seriesCompletadas.length > 0) {
      const ejOriginalRestante: EjercicioState = {
        ...ejActual,
        series: seriesCompletadas,
      };
      const ejNuevoState: EjercicioState = {
        id: Date.now().toString() + Math.random().toString(),
        nombre: nuevoNombre,
        esUnilateral: false,
        series: seriesHeredadas,
        sustituye_a_nombre: nombreOriginal,
        sustitucion_alcance: 'rutina',
      };
      nuevoEjerciciosState = [
        ...ejerciciosState.slice(0, ejIdx),
        ejOriginalRestante,
        ejNuevoState,
        ...ejerciciosState.slice(ejIdx + 1),
      ];
    } else {
      const ejNuevoState: EjercicioState = {
        ...ejActual,
        nombre: nuevoNombre,
        series: seriesHeredadas,
        sustituye_a_nombre: nombreOriginal,
        sustitucion_alcance: 'rutina',
      };
      nuevoEjerciciosState = [
        ...ejerciciosState.slice(0, ejIdx),
        ejNuevoState,
        ...ejerciciosState.slice(ejIdx + 1),
      ];
    }

    setEjerciciosState(nuevoEjerciciosState);
    guardarDraftAuto(nuevoEjerciciosState);

    let consolidado = false;
    let timerConsolidar: any = setTimeout(async () => {
      consolidado = true;
      if (registro?.rutina_id) {
        await reemplazarEjercicioEnRutina(registro.rutina_id, nombreOriginal, nuevoNombre).catch((err) =>
          console.warn('Error reemplazando ejercicio en rutina:', err)
        );
      }
    }, 6000);

    mostrarSnackbar(`Cambio aplicado en la rutina: "${nuevoNombre}"`, () => {
      if (!consolidado) {
        clearTimeout(timerConsolidar);
        setEjerciciosState(prevEjerciciosState);
        guardarDraftAuto(prevEjerciciosState);
      }
    });
  };

  const eliminarEjercicioDeSesion = (ejIdx: number) => {
    if (ejerciciosState.length === 1) {
      mostrarMensaje('No permitido', 'El entrenamiento debe tener al menos un ejercicio.');
      return;
    }
    const ejEliminado = ejerciciosState[ejIdx];
    const nextState = ejerciciosState.filter((_, i) => i !== ejIdx);
    setEjerciciosState(nextState);
    guardarDraftAuto(nextState);

    mostrarSnackbar(`"${ejEliminado.nombre}" eliminado`, () => {
      const restaurado = [...nextState];
      restaurado.splice(ejIdx, 0, ejEliminado);
      setEjerciciosState(restaurado);
      guardarDraftAuto(restaurado);
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
        if (s.completado) {
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
        seriesTotal: ej.series.length,
        seriesCompletadas,
        pesoMaximo: maxPeso,
        repsMaximas: maxReps,
        tieneSobrecarga,
      };
    });

    return { volumenTotalKg, ejerciciosResumen };
  };

  // Abrir Modal de Confirmación y Resumen
  const abrirResumenConfirmacion = () => {
    setResumenVisible(true);
  };

  // Confirmar y Guardar Sesión en Supabase
  const guardarSesionFinal = () =>
    seguro(async () => {
      setGuardando(true);
      try {
        for (const ej of ejerciciosState) {
          const primeraSerie = ej.series[0];
          const numSeriesTotal = ej.series.length;
          const repsPrimera = primeraSerie?.reps ? Number(primeraSerie.reps) : null;
          const pesoPrimero = primeraSerie?.peso ? Number(primeraSerie.peso) : null;
          const todasCompletadas = ej.series.every((s) => s.completado);

          const tieneDatos = ej.series.some(
            (s) => Boolean(s.peso || s.reps || s.pesoI || s.repsI || s.rir || s.nota || s.completado || s.tieneParciales || s.esDropset)
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
                    const c = s.completado ? '✓' : '';

                    const resumenBrazo = `D ${strD} | I ${strI}`.trim();
                    return `${idx + 1}ª: ${[resumenBrazo, rir, dropsStr, n, c].filter(Boolean).join(' ')}`;
                  } else {
                    const p = s.peso ? `${s.peso}k` : '';
                    const r = s.reps ? (s.repsParciales && s.repsParciales > 0 ? `${s.reps}+${s.repsParciales}p` : `${s.reps}r`) : '';
                    const rir = s.rir ? `RIR ${s.rir}` : '';
                    const n = s.nota ? `[${s.nota}]` : '';
                    const c = s.completado ? '✓' : '';
                    return `${idx + 1}ª: ${[p, r, rir, dropsStr, n, c].filter(Boolean).join(' ')}`;
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

          // Si el id es temporal generado por sustitución, insertamos nueva fila
          if (ej.id.includes('.')) {
            await supabase.from('ejercicios_registro').insert({
              registro_id: registro.id,
              nombre: nombreConDetalle,
              series: numSeriesTotal,
              repeticiones: repsPrimera,
              peso: pesoPrimero,
              completado: todasCompletadas,
              ejercicio_nombre: ej.nombre,
              sustituye_a_nombre: ej.sustituye_a_nombre || null,
              sustituye_a_ejercicio_id: ej.sustituye_a_ejercicio_id || null,
              sustitucion_alcance: ej.sustitucion_alcance || null,
              reps_parciales: totalParciales,
              drops: allDrops,
            });
          } else {
            await actualizarEjecucionEjercicio(ej.id, {
              nombre: nombreConDetalle,
              series: numSeriesTotal,
              repeticiones: repsPrimera,
              peso: pesoPrimero,
              completado: todasCompletadas,
              ejercicio_nombre: ej.nombre,
              sustituye_a_nombre: ej.sustituye_a_nombre || null,
              sustituye_a_ejercicio_id: ej.sustituye_a_ejercicio_id || null,
              sustitucion_alcance: ej.sustitucion_alcance || null,
              reps_parciales: totalParciales,
              drops: allDrops,
            });
          }
        }


        const sesionCompletada = porcentajeProgreso >= 50;
        const planNombreFinal = registro.plan_nombre || registro.planes_entrenamiento?.nombre || null;
        const rutinaNombreFinal = registro.rutina_nombre || registro.rutinas?.nombre || null;
        const planIdFinal = registro.plan_id || registro.planes_entrenamiento?.id || null;

        await actualizarEstadoRegistro(registro.id, {
          completado: sesionCompletada,
          notas: notasSesion.trim() || null,
          plan_id: planIdFinal,
          plan_nombre: planNombreFinal,
          rutina_nombre: rutinaNombreFinal,
        });

        // Persistir la duración final de la sesión para la tarjeta de resumen
        if (segundosTranscurridos > 0) {
          try {
            await AsyncStorage.setItem(`rutinia_duracion_${registro.id}`, segundosTranscurridos.toString());
          } catch (e) {
            console.warn('Error guardando duración final:', e);
          }
        }

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
        <ScreenBackground variante="negro_gradiente">
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
                      <Ionicons name="time-outline" size={16} color={noir.champagne} />
                      <Text style={styles.lobbyGridItemText}>~45 min est.</Text>
                    </View>
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
                <View style={{ paddingBottom: Math.max(bottomInset, 16), paddingTop: 10 }}>
                  <LiquidMetalButton
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
                <CarruselEjerciciosHeader
                  ejercicios={itemsCarrusel}
                  activoIndex={indexValido}
                  onSelectEjercicio={(idx) => {
                    setEjercicioActivoIndex(idx);
                    setFocusTeclado(null);
                  }}
                  style={{ marginHorizontal: gutter, marginBottom: 10 }}
                />

                {/* Contenido Scrollable del Ejercicio Activo */}
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: gutter,
                    paddingBottom: scrollBottomPad + 40,
                    gap: 14,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
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
                        tieneHistorialPrevio={Boolean(historialMap[ejActivo.nombre]?.series?.length)}
                        onCopiarHistorial={() => {
                          copiarSeriesHistorial(indexValido);
                        }}
                        onReemplazar={() => {
                          setSelectorIntercambio({ ejIdx: indexValido, modo: 'solo_hoy' });
                        }}
                        onNotas={() => {
                          setModalNotaEjercicio({
                            ejIdx: indexValido,
                            nota: ejActivo.notaEjercicio || '',
                          });
                        }}
                        onOpciones={() => {
                          setEjercicioMenu(indexValido);
                        }}
                      />

                      {/* Tabla de Series de Alto Rendimiento */}
                      <TablaSeriesFocus
                        ejIdx={indexValido}
                        series={seriesFocus}
                        activo={visible}
                        nombreEjercicio={ejActivo.nombre}
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
                          const campoTeclado = campo === 'kg' ? 'peso' : campo;
                          setFocusTeclado({
                            ejIdx: indexValido,
                            sIdx,
                            campo: campoTeclado as any,
                            dropIdx,
                          });
                        }}
                        onToggleCompletado={(sIdx) => {
                          toggleCompletarSerie(indexValido, sIdx);
                        }}
                        onAnadirSerie={() => {
                          agregarSerieAEjercicio(indexValido);
                        }}
                        onEliminarSerie={(sIdx) => {
                          eliminarSerieConDeshacer(indexValido, sIdx);
                        }}
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
                          onChangeText={setNotasSesion}
                          inputMode="text"
                          keyboardType="default"
                          autoCapitalize="sentences"
                          autoCorrect={true}
                          textAlignVertical="top"
                          style={styles.focusNotesInput}
                        />
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
                        paddingBottom: Math.max(bottomInset, 10),
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
                    <LiquidMetalButton
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
                          setEjercicioActivoIndex(siguienteEjercicioIdx);
                          setFocusTeclado(null);
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
                  <SmartWorkoutKeyboard
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
                    pesoPara1RM={ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.peso}
                    repsPara1RM={ejerciciosState[focusTeclado.ejIdx]?.series[focusTeclado.sIdx]?.reps}
                    valorPrevioSugerido={obtenerValorPrevioSugerido()}
                    onChangeValor={actualizarValorDesdeTeclado}
                    onNext={avanzarCampoTeclado}
                    onCompletarSerie={completarSerieDesdeTeclado}
                    onClose={() => setFocusTeclado(null)}
                  />
                )}
              </View>
            )}
          </View>
        </ScreenBackground>
      </KeyboardAvoidingView>

      {/* MODAL DE RESUMEN Y CONFIRMACIÓN */}
      <ResumenEntrenamientoModal
        visible={resumenVisible}
        nombreRutina={registro.rutinas?.nombre || 'Entrenamiento del Día'}
        fechaTexto={nombreDia(fecha)}
        segundosTranscurridos={segundosTranscurridos}
        totalSeriesEnSesion={totalSeriesEnSesion}
        totalSeriesCompletadas={totalSeriesCompletadas}
        volumenTotalKg={volumenTotalKg}
        ejerciciosResumen={ejerciciosResumen}
        notasSesion={notasSesion}
        onChangeNotasSesion={setNotasSesion}
        guardando={guardando}
        onClose={() => setResumenVisible(false)}
        onConfirmarGuardar={guardarSesionFinal}
        onDescartarSesion={descartarSesion}
      />

      {/* MODAL / SHEET: SELECTOR DE INTERCAMBIO DE EJERCICIO */}
      {selectorIntercambio && (
        <SelectorIntercambioModal
          visible={Boolean(selectorIntercambio)}
          ejercicioActualNombre={ejerciciosState[selectorIntercambio.ejIdx]?.nombre || ''}
          ejerciciosEnRutina={ejerciciosState.map((e) => e.nombre)}
          modo={selectorIntercambio.modo}
          onSeleccionar={(nuevoNombre, modo) => {
            aplicarIntercambioEjercicio(selectorIntercambio.ejIdx, nuevoNombre, modo);
          }}
          onClose={() => setSelectorIntercambio(null)}
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
                      {ej.series.length} {ej.series.length === 1 ? 'serie registrada' : 'series registradas'}
                    </Text>
                  </View>

                  {/* Intercambiar solo hoy */}
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      setEjercicioMenu(null);
                      setSelectorIntercambio({ ejIdx: idx, modo: 'solo_hoy' });
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                      <Ionicons name="swap-horizontal" size={18} color="#60A5FA" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Intercambiar solo en este entrenamiento</Text>
                      <Text style={styles.sheetOptionSubtext}>Sustituye hoy; series previas se conservan</Text>
                    </View>
                  </Pressable>

                  {/* Intercambiar en la rutina (permanente) */}
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      setEjercicioMenu(null);
                      setSelectorIntercambio({ ejIdx: idx, modo: 'rutina' });
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                      <Ionicons name="repeat" size={18} color="#A855F7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>Intercambiar en la rutina (permanente)</Text>
                      <Text style={styles.sheetOptionSubtext}>Actualiza la plantilla de rutina para futuros días</Text>
                    </View>
                  </Pressable>

                  {/* Nota del Ejercicio */}
                  <Pressable
                    onPress={() => {
                      const idx = ejercicioMenu;
                      const notaActual = ej.notaEjercicio || '';
                      setEjercicioMenu(null);
                      setModalNotaEjercicio({ ejIdx: idx, nota: notaActual });
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: colores.primarioSuave }]}>
                      <Ionicons name="create-outline" size={18} color={colores.primarioHover} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>
                        {ej.notaEjercicio ? 'Editar nota del ejercicio' : 'Añadir nota del ejercicio'}
                      </Text>
                      <Text style={styles.sheetOptionSubtext}>Ajustes de máquina, alturas, sensaciones</Text>
                    </View>
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
                      <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Eliminar ejercicio</Text>
                      <Text style={styles.sheetOptionSubtext}>Quitar de esta sesión de entrenamiento</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

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
              Se reemplazará <Text style={{ fontFamily: fuentes.bold, color: colores.texto }}>&quot;{confirmacionPermanente?.nombreOriginal}&quot;</Text> por <Text style={{ fontFamily: fuentes.bold, color: colores.primarioHover }}>&quot;{confirmacionPermanente?.nuevoNombre}&quot;</Text> en la rutina base. Las próximas sesiones usarán este nuevo ejercicio.
            </Text>
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
        <Pressable style={styles.sheetBackdrop} onPress={() => setModalNotaEjercicio(null)}>
          <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dialogTitle}>Nota del Ejercicio</Text>
            <Text style={styles.dialogSubtext}>
              {modalNotaEjercicio && ejerciciosState[modalNotaEjercicio.ejIdx]?.nombre}
            </Text>
            <TextInput
              placeholder="Ej. Asiento posición 4, polea a la altura del hombro..."
              placeholderTextColor={colores.suave}
              multiline
              numberOfLines={3}
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
              style={[styles.inputBase, { height: 75, textAlignVertical: 'top', marginVertical: 10 }]}
            />
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setModalNotaEjercicio(null)}
                style={styles.dialogBtnSecondary}
              >
                <Text style={styles.dialogBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (modalNotaEjercicio) {
                    setEjerciciosState((prev) => {
                      const next = prev.map((e, i) =>
                        i === modalNotaEjercicio.ejIdx ? { ...e, notaEjercicio: modalNotaEjercicio.nota } : e
                      );
                      guardarDraftAuto(next);
                      return next;
                    });
                    setModalNotaEjercicio(null);
                  }
                }}
                style={styles.dialogBtnPrimary}
              >
                <Text style={styles.dialogBtnPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SNACKBAR DESHACER (6 SEGUNDOS) */}
      {snackbar && (
        <View
          style={[
            styles.snackbarContainer,
            {
              bottom: bottomInset + (isLandscape ? 60 : 76),
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
                snackbar.onDeshacer?.();
                setSnackbar(null);
              }}
              style={styles.snackbarBtn}
              hitSlop={8}
            >
              <Text style={styles.snackbarBtnText}>DESHACER (6s)</Text>
            </Pressable>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  lobbyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  lobbyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  lobbyHeroCard: {
    backgroundColor: noir.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    gap: 12,
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  lobbyIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(179, 148, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyTitleText: {
    color: noir.text,
    fontSize: 22,
    fontFamily: fuentes.black,
    letterSpacing: -0.4,
  },
  lobbySubtext: {
    color: noir.muted,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  lobbyDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  lobbyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  lobbyGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lobbyGridItemText: {
    color: noir.platinum,
    fontSize: 11,
    fontFamily: fuentes.medium,
  },
  lobbyExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.022)',
    borderRadius: 11,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  liveDotPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colores.exito,
  },
  timerWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    marginRight: 6,
  },
  timerWidgetPausado: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  timerWidgetText: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  modalBadgeText: {
    color: noir.info,
    fontSize: 9,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  closeIconButton: {
    backgroundColor: noir.surface,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  liveTitleText: {
    color: colores.texto,
    fontSize: 19,
    fontFamily: fuentes.black,
  },
  progressLandscapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 4,
  },
  progressLandscapeText: {
    color: colores.texto,
    fontFamily: fuentes.bold,
    fontSize: 11,
    flexShrink: 0,
  },
  progressBarTrackLandscape: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.80)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressCardBox: {
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 6,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: 'rgba(10, 12, 18, 0.80)',
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  exerciseCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  seriesCountBadge: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  // ── Columnas de la tabla de series BILATERAL ───────────────────────────────
  colST: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  colKG: {
    flex: 1.2,
    minWidth: 0,
  },
  colREPS: {
    flex: 1.2,
    minWidth: 0,
  },
  colRIR: {
    flex: 1.0,
    minWidth: 0,
  },
  colNOTA: {
    flex: 1.5,
    minWidth: 0,
  },
  colNotaBtn: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  colOK: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  colDel: {
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // ── Columnas UNILATERAL ────────────────────────────────────────────────────
  colUniST: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  colUniBox: {
    flex: 2,
    flexDirection: 'row',
    gap: 2,
    minWidth: 0,
  },
  colUniRIR: {
    flex: 0.9,
    minWidth: 0,
  },
  colUniOK: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // ── Sub-fila de nota colapsable en vertical portrait ───────────────────────
  subNotaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.70)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
    marginBottom: 4,
  },
  subNotaInput: {
    flex: 1,
    color: colores.texto,
    fontSize: Platform.OS === 'web' ? 16 : 12,
    fontFamily: fuentes.regular,
    paddingVertical: 4,
    minHeight: 36,
  },
  notaToggleBtn: {
    width: 30,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  notaToggleBtnActiva: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
  },
  serieHeaderText: {
    color: colores.suave,
    fontSize: 9,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  // inputCell: celda de input uniforme, minHeight 44, fontSize >= 16 en web
  inputCell: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    color: colores.texto,
    fontSize: Platform.OS === 'web' ? 16 : 13,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    minWidth: 0,
    minHeight: 44,
    width: '100%',
  },
  /* CELDAS INTERACTIVAS SMART KEYBOARD */
  celdaInteractiva: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
  },
  celdaActiva: {
    borderColor: colores.primarioHover,
    backgroundColor: 'rgba(194, 36, 61, 0.20)',
    borderWidth: 1.5,
    shadowColor: colores.primarioHover,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  textoCelda: {
    color: colores.texto,
    fontSize: Platform.OS === 'web' ? 14 : 12,
    fontFamily: fuentes.bold,
    textAlign: 'center',
  },
  textoCeldaPlaceholder: {
    color: colores.suave,
    fontFamily: fuentes.regular,
  },
  textoCeldaActivo: {
    color: '#FFFFFF',
    fontFamily: fuentes.black,
  },
  cursorParpadeante: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 2,
    backgroundColor: colores.primarioHover,
    borderRadius: 1,
  },
  inputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    color: colores.texto,
    fontSize: Platform.OS === 'web' ? 16 : 13,
    fontFamily: fuentes.regular,
    minWidth: 0,
    minHeight: 44,
  },
  addSerieBtn: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 2,
    minHeight: 44,
  },
  inputLabelText: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  historyBoxContainer: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
    gap: 4,
  },
  noHistoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.40)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  copyMarksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  historyChip: {
    backgroundColor: 'rgba(10, 12, 18, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  overloadBadge: {
    color: '#F59E0B',
    fontSize: 8,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    marginTop: 1,
  },

  /* STICKY BOTTOM BAR */
  stickyBottomBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.40)',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },

  /* BADGES & HEADER ACTIONS */
  sustituyeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  sustituyeBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  livePlanSubtitleText: {
    color: colores.primarioHover,
    fontSize: 11,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeaderMoreBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  serieMoreBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },

  /* MINI CHIPS EN SERIE ROW */
  chipMiniParcial: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    marginTop: 2,
  },
  chipMiniParcialText: {
    color: '#F59E0B',
    fontSize: 9,
    fontFamily: fuentes.black,
  },
  chipMiniDrop: {
    backgroundColor: 'rgba(56, 189, 248, 0.20)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    marginTop: 2,
  },
  chipMiniDropText: {
    color: '#38BDF8',
    fontSize: 9,
    fontFamily: fuentes.black,
  },

  /* STEPPER DE PARCIALES */
  parcialesRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  parcialesLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  parcialesLabelText: {
    color: '#F59E0B',
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.65)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.black,
    textAlign: 'center',
    minWidth: 26,
    paddingVertical: 0,
  },

  /* DROPSET CONTAINER & ROWS */
  dropsetContainer: {
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(56, 189, 248, 0.40)',
    gap: 4,
  },
  dropSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  colSTDrop: {
    width: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
  },
  dropNumText: {
    color: '#38BDF8',
    fontSize: 10,
    fontFamily: fuentes.black,
  },
  inputCellDrop: {
    backgroundColor: 'rgba(10, 12, 18, 0.50)',
    borderColor: 'rgba(56, 189, 248, 0.30)',
  },
  inputCellWarning: {
    borderColor: 'rgba(239, 68, 68, 0.60)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  addDropRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  addDropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  addDropBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontFamily: fuentes.bold,
  },

  /* BOTTOM SHEETS & DIALOGS */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContent: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: colores.tarjeta,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 16,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.suave,
    opacity: 0.4,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    color: colores.texto,
    fontSize: 16,
    fontFamily: fuentes.black,
  },
  sheetSubtitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
    marginTop: 2,
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetOptionDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  sheetOptionText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  sheetOptionSubtext: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.medium,
    marginTop: 1,
  },
  sheetConfigBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 10,
  },
  switchBadgeMini: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  switchBadgeMiniActivo: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  switchBadgeMiniInactivo: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  switchBadgeMiniText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: fuentes.bold,
    fontSize: 10,
  },
  sheetConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sheetStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepperValText: {
    color: '#F59E0B',
    fontFamily: fuentes.black,
    fontSize: 13,
    minWidth: 32,
    textAlign: 'center',
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    justifyContent: 'flex-end',
  },
  quickChip: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickChipActivo: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  quickChipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: fuentes.bold,
    fontSize: 11,
  },
  quickChipTextActivo: {
    color: '#F59E0B',
  },

  /* DIALOG CARD */
  dialogCard: {
    width: '90%',
    maxWidth: 480,
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 18,
    alignSelf: 'center',
    marginVertical: 'auto',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dialogTitle: {
    color: colores.texto,
    fontSize: 17,
    fontFamily: fuentes.black,
  },
  dialogText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  dialogSubtext: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.medium,
    marginTop: 6,
    lineHeight: 15,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  dialogBtnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  dialogBtnSecondaryText: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  dialogBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colores.primario,
  },
  dialogBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fuentes.bold,
  },

  /* SNACKBAR */
  snackbarContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.50)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  snackbarText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  snackbarBtn: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  snackbarBtnText: {
    color: colores.primarioHover,
    fontSize: 11,
    fontFamily: fuentes.black,
  },
  /* FOCUS MODE STYLES */
  focusTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
    width: '100%',
    zIndex: 10,
  },
  focusChevronBtn: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTimerBox: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  focusTimerText: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 21,
    letterSpacing: -0.55,
    fontVariant: ['tabular-nums'],
  },
  focusSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 1,
    maxWidth: '100%',
  },
  focusLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.mint,
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  focusSubtitleText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  focusHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  focusTimerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTerminarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(240, 138, 155, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.26)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  focusTerminarBtnText: {
    color: '#F7B6C1',
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  focusDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: 'rgba(4, 5, 7, 0.92)',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.055)',
  },
  focusDockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 5,
  },
  focusDockDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.info,
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  focusDockNoteText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 8,
    letterSpacing: 0.15,
  },
  focusNotesCard: {
    backgroundColor: 'rgba(10, 12, 17, 0.78)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(92, 200, 255, 0.4)',
    marginTop: 2,
  },
  focusNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  focusNotesIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(92, 200, 255, 0.075)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.17)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusNotesKicker: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  focusNotesTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 12,
    marginTop: 1,
  },
  focusNotesSmart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 209, 102, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.18)',
  },
  focusNotesSmartText: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  focusNotesInput: {
    color: noir.text,
    fontFamily: fuentes.regular,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 44,
    textAlignVertical: 'top',
    padding: 0,
  },
});
