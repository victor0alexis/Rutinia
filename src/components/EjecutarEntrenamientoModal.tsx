import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import ScreenBackground from './ScreenBackground';
import GlowButton from './GlowButton';
import { LiquidMetalButton } from './LiquidMetalButton';
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
import { DROPSET_MAX_DROPS, calcularKgSugeridoDrop } from '../constants/entrenamiento';
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
    isCompact,
    isTablet,
    gutter,
    contentMaxWidth,
    topInset,
    bottomInset,
    isKeyboardVisible,
  } = useLayout();

  const [dockHeight, setDockHeight] = useState(isLandscape ? 52 : 72);
  const [focusTeclado, setFocusTeclado] = useState<FocusTeclado>(null);
  const scrollBottomPad = (focusTeclado ? 280 : isKeyboardVisible ? 16 : dockHeight) + bottomInset + 20;

  // Mapa de notas colapsadas/expandidas en vista vertical portrait
  const [notasAbiertas, setNotasAbiertas] = useState<Record<string, boolean>>({});

  const toggleNotaAbierta = (serieId: string) => {
    setNotasAbiertas((prev) => ({
      ...prev,
      [serieId]: !prev[serieId],
    }));
  };

  const handleInputFocus = (e: any) => {
    if (Platform.OS === 'web' && e?.target?.scrollIntoView) {
      try {
        e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        // Ignorar si no está soportado en este entorno
      }
    }
  };

  const [ejerciciosState, setEjerciciosState] = useState<EjercicioState[]>([]);
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

  const toggleRepsParciales = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            const nuevoTiene = !s.tieneParciales;
            return {
              ...s,
              tieneParciales: nuevoTiene,
              repsParciales: nuevoTiene && (!s.repsParciales || s.repsParciales <= 0) ? 3 : s.repsParciales,
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

  const agregarDropASerie = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            if (s.drops.length >= DROPSET_MAX_DROPS) {
              mostrarMensaje('Límite alcanzado', `Una serie puede tener como máximo ${DROPSET_MAX_DROPS} drops.`);
              return s;
            }
            const ultimoDrop = s.drops[s.drops.length - 1];
            const pesoBase = ultimoDrop ? ultimoDrop.kg : s.peso;
            const kgSugerido = calcularKgSugeridoDrop(pesoBase || '0');
            const nuevoDrop: DropItemEjecucion = {
              orden: s.drops.length + 1,
              kg: kgSugerido,
              reps: '',
              rir: '',
            };
            return {
              ...s,
              drops: [...s.drops, nuevoDrop],
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
    });
  };

  const quitarDropDeSerie = (ejIndex: number, sIndex: number, dropIndex: number) => {
    setEjerciciosState((prev) => {
      const next = prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => {
            if (sj !== sIndex) return s;
            const filtrados = s.drops.filter((_, di) => di !== dropIndex);
            const reordenados = filtrados.map((d, di) => ({ ...d, orden: di + 1 }));
            return {
              ...s,
              esDropset: reordenados.length > 0,
              drops: reordenados,
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
        setFocusTeclado({ ejIdx, sIdx, campo: 'rir' });
      } else {
        pasarASiguienteSerie(ejIdx, sIdx);
      }
      return;
    }

    if (campo === 'peso') {
      setFocusTeclado({ ejIdx, sIdx, campo: 'reps' });
    } else if (campo === 'reps') {
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
    return serie[campo] || '';
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

    if (dropIdx !== undefined) {
      const campoDrop = campo === 'peso' ? 'kg' : campo;
      cambiarCampoDrop(ejIdx, sIdx, dropIdx, campoDrop as any, nuevoValor);
      return;
    }

    cambiarCampoSerie(ejIdx, sIdx, campo, nuevoValor);
  };

  const renderCeldaInteractiva = ({
    valor,
    placeholder,
    ejIdx,
    sIdx,
    campo,
    dropIdx,
    warning = false,
    extraStyle,
  }: {
    valor?: string;
    placeholder: string;
    ejIdx: number;
    sIdx: number;
    campo: CampoEntrenamiento;
    dropIdx?: number;
    warning?: boolean;
    extraStyle?: any;
  }) => {
    const esActivo =
      focusTeclado?.ejIdx === ejIdx &&
      focusTeclado?.sIdx === sIdx &&
      focusTeclado?.campo === campo &&
      focusTeclado?.dropIdx === dropIdx;

    const tieneValor = valor !== undefined && valor !== null && valor.trim() !== '';

    return (
      <Pressable
        onPress={() => setFocusTeclado({ ejIdx, sIdx, campo, dropIdx })}
        style={[
          styles.inputCell,
          styles.celdaInteractiva,
          extraStyle,
          warning && !tieneValor && styles.inputCellWarning,
          esActivo && styles.celdaActiva,
        ]}
      >
        <Text
          style={[
            styles.textoCelda,
            !tieneValor && styles.textoCeldaPlaceholder,
            esActivo && styles.textoCeldaActivo,
          ]}
          numberOfLines={1}
        >
          {tieneValor ? valor : placeholder}
        </Text>
        {esActivo && <View style={styles.cursorParpadeante} />}
      </Pressable>
    );
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
        <ScreenBackground>
          <View style={{ flex: 1, paddingTop: isLandscape ? Math.max(topInset, 6) : Math.max(topInset, Platform.OS === 'ios' ? 44 : 16) }}>
            {/* LOBBY PRE-PARTIDA */}
            {enLobby ? (
              <View style={[styles.lobbyContainer, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: gutter }]}>
                {/* Header Lobby */}
                <View style={styles.lobbyHeaderRow}>
                  <Text style={styles.modalBadgeText}>PRE-ENTRENAMIENTO • {nombreDia(fecha)}</Text>
                  <Pressable onPress={onClose} style={styles.closeIconButton}>
                    <Ionicons name="close" size={22} color={colores.texto} />
                  </Pressable>
                </View>

                {/* Routine Card Banner */}
                <View style={styles.lobbyHeroCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.lobbyIconBox}>
                      <Ionicons name="flash" size={24} color={colores.primarioHover} />
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
                      <Ionicons name="time-outline" size={16} color={colores.hoy} />
                      <Text style={styles.lobbyGridItemText}>~45 min est.</Text>
                    </View>
                    <View style={styles.lobbyGridItem}>
                      <Ionicons name="barbell-outline" size={16} color={colores.primarioHover} />
                      <Text style={styles.lobbyGridItemText}>Sobrecarga Activa</Text>
                    </View>
                    <View style={styles.lobbyGridItem}>
                      <Ionicons name="stats-chart-outline" size={16} color={colores.exito} />
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
                        <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, width: 22 }}>
                          {idx + 1}.
                        </Text>
                        <Text style={{ color: colores.texto, fontFamily: fuentes.bold, flex: 1 }}>
                          {ej.nombre}
                        </Text>
                        <Text style={{ color: colores.suave, fontFamily: fuentes.medium, fontSize: 11 }}>
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
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              </View>
            ) : (
              /* PANTALLA PRINCIPAL DE SIMULACIÓN / ENTRENAMIENTO EN VIVO */
              <View style={{ flex: 1, paddingHorizontal: gutter, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
                {/* Header de la Sesión en Vivo con Timer Persistente */}
                <View style={{ width: '100%' }}>
                  <View style={[styles.liveHeader, isLandscape && { paddingVertical: 2, paddingBottom: 4 }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.liveDotPulse} />
                        <Text style={styles.modalBadgeText}>
                          EN VIVO • {nombreDia(fecha)}
                        </Text>
                      </View>
                      {/* DOS LÍNEAS: Plan arriba en texto pequeño si existe, Rutina debajo */}
                      {Boolean(registro.plan_nombre || registro.planes_entrenamiento?.nombre) && (
                        <Text
                          style={styles.livePlanSubtitleText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {registro.plan_nombre || registro.planes_entrenamiento?.nombre}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.liveTitleText,
                          isCompact && { fontSize: 17 },
                          isLandscape && { fontSize: 16 },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {registro.rutina_nombre || registro.rutinas?.nombre || 'Entrenamiento del Día'}
                      </Text>
                    </View>



                    {/* Widget Timer Interactivo (ÚNICO TIMER DE LA SESIÓN) */}
                    <Pressable
                      onPress={togglePausaTimer}
                      style={({ pressed }) => [
                        styles.timerWidget,
                        estadoTimer?.pausado && styles.timerWidgetPausado,
                        pressed && { opacity: 0.8 },
                      ]}
                      hitSlop={6}
                    >
                      <Ionicons
                        name={estadoTimer?.pausado ? 'play' : 'time'}
                        size={14}
                        color={estadoTimer?.pausado ? '#F59E0B' : colores.hoy}
                      />
                      <Text style={styles.timerWidgetText}>
                        {formatearTiempo(segundosTranscurridos)}
                      </Text>
                    </Pressable>

                    <Pressable onPress={onClose} style={styles.closeIconButton} hitSlop={8}>
                      <Ionicons name="close" size={20} color={colores.texto} />
                    </Pressable>
                  </View>

                  {/* Barra de Progreso de Sesión: ultra-compacta en horizontal */}
                  {isLandscape ? (
                    <View style={styles.progressLandscapeRow}>
                      <Text style={styles.progressLandscapeText}>
                        Series: {totalSeriesCompletadas}/{totalSeriesEnSesion} ({porcentajeProgreso}%)
                      </Text>
                      <View style={styles.progressBarTrackLandscape}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${porcentajeProgreso}%`,
                              backgroundColor: porcentajeProgreso === 100 ? colores.exito : colores.primarioHover,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.progressCardBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>
                          Series completadas: {totalSeriesCompletadas} / {totalSeriesEnSesion}
                        </Text>
                        <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 13 }}>
                          {porcentajeProgreso}%
                        </Text>
                      </View>

                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${porcentajeProgreso}%`,
                              backgroundColor: porcentajeProgreso === 100 ? colores.exito : colores.primarioHover,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* Formulario Scrollable de Ejercicios y Series */}
                <ScrollView
                  contentContainerStyle={{ gap: 14, paddingTop: 10, paddingBottom: scrollBottomPad, width: '100%' }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {ejerciciosState.map((ej, ejIdx) => {
                    const histEj = historialMap[ej.nombre];
                    const mostrarNotaColumna = isLandscape || isTablet;

                    return (
                      <View key={ej.id} style={styles.exerciseCard}>
                        {/* Header del Ejercicio con menú ⋯ y badge de sustitución */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 15 }} numberOfLines={1}>
                                {ejIdx + 1}. {ej.nombre}
                              </Text>
                              {Boolean(ej.sustituye_a_nombre) && (
                                <View style={styles.sustituyeBadge}>
                                  <Ionicons name="swap-horizontal" size={10} color="#60A5FA" />
                                  <Text style={styles.sustituyeBadgeText}>
                                    ↔ Sustituye a {ej.sustituye_a_nombre}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {Boolean(ej.notaEjercicio) && (
                              <Text style={{ color: colores.suave, fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                                📝 {ej.notaEjercicio}
                              </Text>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.seriesCountBadge}>
                              <Text style={{ color: colores.primarioHover, fontSize: 10, fontFamily: fuentes.bold }}>
                                {ej.series.length} {ej.series.length === 1 ? 'Serie' : 'Series'}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => setEjercicioMenu(ejIdx)}
                              style={styles.cardHeaderMoreBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="ellipsis-horizontal" size={16} color={colores.suave} />
                            </Pressable>
                          </View>
                        </View>

                        {/* Banner de Referencia Histórica con Parciales y Drops */}
                        {histEj && histEj.series.length > 0 ? (
                          <View style={styles.historyBoxContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="time-outline" size={12} color={colores.hoy} />
                                <Text style={{ fontSize: 10, fontFamily: fuentes.bold, color: colores.hoy }}>
                                  PREVIO • {histEj.fechaFormateada}
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => copiarSeriesHistorial(ejIdx)}
                                hitSlop={6}
                                style={({ pressed }) => [
                                  styles.copyMarksBtn,
                                  pressed && { opacity: 0.7 },
                                ]}
                              >
                                <Ionicons name="duplicate-outline" size={11} color={colores.primarioHover} />
                                <Text style={{ fontSize: 10, fontFamily: fuentes.bold, color: colores.primarioHover }}>
                                  Copiar
                                </Text>
                              </Pressable>
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {histEj.series.map((sPrev, sIdx) => {
                                const tieneP = Boolean(sPrev.repsParciales && sPrev.repsParciales > 0);
                                const dropsStr = sPrev.drops && sPrev.drops.length > 0
                                  ? sPrev.drops.map((d) => ` → ${d.kg}k×${d.reps}r`).join('') + ' ↓'
                                  : '';
                                return (
                                  <View key={sIdx} style={styles.historyChip}>
                                    <Text style={{ fontSize: 10, fontFamily: fuentes.medium, color: colores.texto }}>
                                      #{sIdx + 1}: <Text style={{ fontFamily: fuentes.bold, color: colores.hoy }}>{sPrev.peso ? `${sPrev.peso}k` : '-'}</Text> ×{' '}
                                      <Text style={{ fontFamily: fuentes.bold, color: colores.texto }}>
                                        {sPrev.reps ? `${sPrev.reps}r` : '-'}
                                        {tieneP ? <Text style={{ color: '#F59E0B' }}> +{sPrev.repsParciales}p</Text> : ''}
                                      </Text>
                                      {sPrev.rir ? ` (RIR ${sPrev.rir})` : ''}
                                      {Boolean(dropsStr) && <Text style={{ color: '#38BDF8', fontFamily: fuentes.bold }}>{dropsStr}</Text>}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <View style={styles.noHistoryBox}>
                            <Ionicons name="sparkles-outline" size={12} color={colores.suave} />
                            <Text style={{ fontSize: 10, fontFamily: fuentes.medium, color: colores.suave, fontStyle: 'italic' }}>
                              Sin registro previo • Marca base
                            </Text>
                          </View>
                        )}


                        {/* Tabla de Series (Bilateral vs Unilateral D/I) */}
                        {ej.esUnilateral ? (
                          <View style={{ gap: 4 }}>
                            {/* Encabezado Unilateral — IDÉNTICO a la fila */}
                            <View style={styles.serieRow}>
                              <View style={styles.colUniST}>
                                <Text style={styles.serieHeaderText}>ST</Text>
                              </View>
                              <View style={[styles.colUniBox, { justifyContent: 'center' }]}>
                                <Text style={[styles.serieHeaderText, { color: colores.exito }]}>D (KG × R)</Text>
                              </View>
                              <View style={[styles.colUniBox, { justifyContent: 'center' }]}>
                                <Text style={[styles.serieHeaderText, { color: colores.hoy }]}>I (KG × R)</Text>
                              </View>
                              <View style={[styles.colUniRIR, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>RIR</Text>
                              </View>
                              {!mostrarNotaColumna && (
                                <View style={styles.colNotaBtn}>
                                  <Text style={styles.serieHeaderText}>NOTA</Text>
                                </View>
                              )}
                              <View style={[styles.colUniOK, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>OK</Text>
                              </View>
                              <View style={styles.colDel} />
                            </View>

                            {ej.series.map((s, sIdx) => (
                              <View key={s.id}>
                                <View
                                  style={[
                                    styles.serieRow,
                                    { backgroundColor: s.completado ? 'rgba(16, 185, 129, 0.12)' : 'transparent', borderRadius: 8 },
                                  ]}
                                >
                                  <View style={styles.colUniST}>
                                    <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 11 }}>
                                      #{sIdx + 1}
                                    </Text>
                                  </View>

                                  {/* DERECHO */}
                                  <View style={styles.colUniBox}>
                                    {renderCeldaInteractiva({
                                      valor: s.peso,
                                      placeholder: 'KG D',
                                      ejIdx,
                                      sIdx,
                                      campo: 'peso',
                                    })}
                                    {renderCeldaInteractiva({
                                      valor: s.reps,
                                      placeholder: 'REPS D',
                                      ejIdx,
                                      sIdx,
                                      campo: 'reps',
                                    })}
                                  </View>

                                  {/* IZQUIERDO */}
                                  <View style={styles.colUniBox}>
                                    {renderCeldaInteractiva({
                                      valor: s.pesoI !== undefined ? s.pesoI : s.peso,
                                      placeholder: 'KG I',
                                      ejIdx,
                                      sIdx,
                                      campo: 'pesoI',
                                    })}
                                    {renderCeldaInteractiva({
                                      valor: s.repsI !== undefined ? s.repsI : s.reps,
                                      placeholder: 'REPS I',
                                      ejIdx,
                                      sIdx,
                                      campo: 'repsI',
                                    })}
                                  </View>

                                  {/* RIR */}
                                  <View style={styles.colUniRIR}>
                                    {renderCeldaInteractiva({
                                      valor: s.rir,
                                      placeholder: 'RIR',
                                      ejIdx,
                                      sIdx,
                                      campo: 'rir',
                                    })}
                                  </View>

                                  {/* NOTA BUTTON (solo portrait) */}
                                  {!mostrarNotaColumna && (
                                    <View style={styles.colNotaBtn}>
                                      <Pressable
                                        onPress={() => toggleNotaAbierta(s.id)}
                                        style={({ pressed }) => [
                                          styles.notaToggleBtn,
                                          Boolean(s.nota) && styles.notaToggleBtnActiva,
                                          pressed && { opacity: 0.7 },
                                        ]}
                                        hitSlop={4}
                                      >
                                        <Ionicons
                                          name={Boolean(s.nota) ? 'document-text' : 'document-text-outline'}
                                          size={16}
                                          color={Boolean(s.nota) ? colores.hoy : colores.suave}
                                        />
                                      </Pressable>
                                    </View>
                                  )}

                                  {/* OK checkbox */}
                                  <View style={styles.colUniOK}>
                                    <Pressable
                                      onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'completado', !s.completado)}
                                      style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
                                      hitSlop={4}
                                    >
                                      <Ionicons
                                        name={s.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={22}
                                        color={s.completado ? colores.exito : colores.suave}
                                      />
                                    </Pressable>
                                  </View>

                                  {/* Menú de opciones de la serie (⋯) */}
                                  <View style={styles.colDel}>
                                    <Pressable
                                      onPress={() => setSerieMenu({ ejIdx, sIdx })}
                                      style={styles.serieMoreBtn}
                                      hitSlop={6}
                                    >
                                      <Ionicons name="ellipsis-horizontal" size={16} color={colores.suave} />
                                    </Pressable>
                                  </View>
                                </View>

                                {/* Sub-fila de nota en unilateral (portrait) */}
                                {!mostrarNotaColumna && (notasAbiertas[s.id] || Boolean(s.nota)) && (
                                  <View style={styles.subNotaContainer}>
                                    <Ionicons name="create-outline" size={14} color={colores.primarioHover} />
                                    <TextInput
                                      placeholder="Nota de la serie (ej. Técnica, sensaciones)..."
                                      placeholderTextColor={colores.suave}
                                      value={s.nota}
                                      onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                      onFocus={handleInputFocus}
                                      style={styles.subNotaInput}
                                    />
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        ) : (
                          /* BILATERAL */
                          <View style={{ gap: 4 }}>
                            {/* Encabezados — estructura IDÉNTICA a las filas */}
                            <View style={styles.serieRow}>
                              <View style={styles.colST}>
                                <Text style={styles.serieHeaderText}>ST</Text>
                              </View>
                              <View style={[styles.colKG, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>KG</Text>
                              </View>
                              <View style={[styles.colREPS, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>REPS</Text>
                              </View>
                              <View style={[styles.colRIR, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>RIR</Text>
                              </View>
                              {mostrarNotaColumna ? (
                                <View style={[styles.colNOTA, { alignItems: 'center' }]}>
                                  <Text style={styles.serieHeaderText}>NOTA</Text>
                                </View>
                              ) : (
                                <View style={styles.colNotaBtn}>
                                  <Text style={styles.serieHeaderText}>NOTA</Text>
                                </View>
                              )}
                              <View style={[styles.colOK, { alignItems: 'center' }]}>
                                <Text style={styles.serieHeaderText}>OK</Text>
                              </View>
                              <View style={styles.colDel} />
                            </View>

                            {ej.series.map((s, sIdx) => {
                              const sPrev = histEj?.series[sIdx];
                              const diffPeso = s.peso && sPrev?.peso ? Number(s.peso) - Number(sPrev.peso) : 0;

                              return (
                                <View key={s.id}>
                                  {/* Fila principal */}
                                  <View
                                    style={[
                                      styles.serieRow,
                                      { backgroundColor: s.completado ? 'rgba(16, 185, 129, 0.12)' : 'transparent', borderRadius: 8 },
                                    ]}
                                  >
                                    {/* ST — número de serie con chips de parcial y dropset */}
                                    <View style={styles.colST}>
                                      <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 11 }}>
                                        #{sIdx + 1}
                                      </Text>
                                      {s.tieneParciales && (
                                        <View style={styles.chipMiniParcial}>
                                          <Text style={styles.chipMiniParcialText}>P</Text>
                                        </View>
                                      )}
                                      {s.esDropset && (
                                        <View style={styles.chipMiniDrop}>
                                          <Text style={styles.chipMiniDropText}>DS</Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* KG */}
                                    <View style={styles.colKG}>
                                      {renderCeldaInteractiva({
                                        valor: s.peso,
                                        placeholder: sPrev?.peso ?? '0',
                                        ejIdx,
                                        sIdx,
                                        campo: 'peso',
                                      })}
                                      {diffPeso > 0 && (
                                        <Text style={styles.overloadBadge}>🔥+{diffPeso}k</Text>
                                      )}
                                    </View>

                                    {/* REPS */}
                                    <View style={styles.colREPS}>
                                      {renderCeldaInteractiva({
                                        valor: s.reps,
                                        placeholder: sPrev?.reps ?? '0',
                                        ejIdx,
                                        sIdx,
                                        campo: 'reps',
                                      })}
                                    </View>

                                    {/* RIR */}
                                    <View style={styles.colRIR}>
                                      {renderCeldaInteractiva({
                                        valor: s.rir,
                                        placeholder: sPrev?.rir ? sPrev.rir : '—',
                                        ejIdx,
                                        sIdx,
                                        campo: 'rir',
                                      })}
                                    </View>

                                    {/* NOTA (en fila para landscape / tablet) */}
                                    {mostrarNotaColumna ? (
                                      <View style={styles.colNOTA}>
                                        <TextInput
                                          placeholder="Nota"
                                          placeholderTextColor={colores.suave}
                                          value={s.nota}
                                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                          onFocus={handleInputFocus}
                                          style={[styles.inputCell, { fontSize: Platform.OS === 'web' ? 16 : 11 }]}
                                        />
                                      </View>
                                    ) : (
                                      <View style={styles.colNotaBtn}>
                                        <Pressable
                                          onPress={() => toggleNotaAbierta(s.id)}
                                          style={({ pressed }) => [
                                            styles.notaToggleBtn,
                                            Boolean(s.nota) && styles.notaToggleBtnActiva,
                                            pressed && { opacity: 0.7 },
                                          ]}
                                          hitSlop={4}
                                        >
                                          <Ionicons
                                            name={Boolean(s.nota) ? 'document-text' : 'document-text-outline'}
                                            size={16}
                                            color={Boolean(s.nota) ? colores.hoy : colores.suave}
                                          />
                                        </Pressable>
                                      </View>
                                    )}

                                    {/* OK checkbox con validación de drops */}
                                    <View style={styles.colOK}>
                                      <Pressable
                                        onPress={() => toggleCompletarSerie(ejIdx, sIdx)}
                                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                                        hitSlop={4}
                                      >
                                        <Ionicons
                                          name={s.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                          size={22}
                                          color={s.completado ? colores.exito : colores.suave}
                                        />
                                      </Pressable>
                                    </View>

                                    {/* Menú de opciones de la serie (⋯) */}
                                    <View style={styles.colDel}>
                                      <Pressable
                                        onPress={() => setSerieMenu({ ejIdx, sIdx })}
                                        style={styles.serieMoreBtn}
                                        hitSlop={6}
                                      >
                                        <Ionicons name="ellipsis-horizontal" size={16} color={colores.suave} />
                                      </Pressable>
                                    </View>
                                  </View>

                                  {/* NOTA — segunda línea colapsable/expandible, en vertical portrait */}
                                  {!mostrarNotaColumna && (notasAbiertas[s.id] || Boolean(s.nota)) && (
                                    <View style={styles.subNotaContainer}>
                                      <Ionicons name="create-outline" size={14} color={colores.primarioHover} />
                                      <TextInput
                                        placeholder="Nota de la serie (ej. Buena técnica, fallo en 8ª)..."
                                        placeholderTextColor={colores.suave}
                                        value={s.nota}
                                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                        onFocus={handleInputFocus}
                                        style={styles.subNotaInput}
                                      />
                                    </View>
                                  )}

                                  {/* Franja de Parciales si está activa */}
                                  {s.tieneParciales && (
                                    <View style={styles.parcialesRowContainer}>
                                      <View style={styles.parcialesLabelBox}>
                                        <Ionicons name="flash" size={12} color="#F59E0B" />
                                        <Text style={styles.parcialesLabelText}>Parciales</Text>
                                      </View>
                                      <View style={styles.stepperContainer}>
                                        <Pressable
                                          onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'repsParciales', Math.max(0, (s.repsParciales || 0) - 1))}
                                          style={styles.stepperBtn}
                                          hitSlop={6}
                                        >
                                          <Ionicons name="remove" size={14} color={colores.texto} />
                                        </Pressable>
                                        <View style={styles.stepperInput}>
                                          <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 13, textAlign: 'center' }}>
                                            {s.repsParciales || 0}
                                          </Text>
                                        </View>
                                        <Pressable
                                          onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'repsParciales', (s.repsParciales || 0) + 1)}
                                          style={styles.stepperBtn}
                                          hitSlop={6}
                                        >
                                          <Ionicons name="add" size={14} color={colores.texto} />
                                        </Pressable>
                                      </View>
                                    </View>
                                  )}

                                  {/* Filas de Dropset si está activo */}
                                  {s.esDropset && (
                                    <View style={styles.dropsetContainer}>
                                      {s.drops.map((drop, dIdx) => (
                                        <View key={drop.orden} style={styles.dropSubRow}>
                                          <View style={styles.colSTDrop}>
                                            <Ionicons name="arrow-down" size={11} color="#38BDF8" />
                                            <Text style={styles.dropNumText}>D{drop.orden}</Text>
                                          </View>
                                          <View style={styles.colKG}>
                                            {renderCeldaInteractiva({
                                              valor: drop.kg,
                                              placeholder: 'KG',
                                              ejIdx,
                                              sIdx,
                                              campo: 'peso',
                                              dropIdx: dIdx,
                                              extraStyle: styles.inputCellDrop,
                                            })}
                                          </View>
                                          <View style={styles.colREPS}>
                                            {renderCeldaInteractiva({
                                              valor: drop.reps,
                                              placeholder: 'REPS',
                                              ejIdx,
                                              sIdx,
                                              campo: 'reps',
                                              dropIdx: dIdx,
                                              warning: !drop.reps,
                                              extraStyle: styles.inputCellDrop,
                                            })}
                                          </View>
                                          <View style={styles.colRIR}>
                                            {renderCeldaInteractiva({
                                              valor: drop.rir || '',
                                              placeholder: '—',
                                              ejIdx,
                                              sIdx,
                                              campo: 'rir',
                                              dropIdx: dIdx,
                                              extraStyle: styles.inputCellDrop,
                                            })}
                                          </View>
                                          {mostrarNotaColumna && <View style={styles.colNOTA} />}
                                          <View style={styles.colOK} />
                                          <View style={styles.colDel}>
                                            <Pressable
                                              onPress={() => quitarDropDeSerie(ejIdx, sIdx, dIdx)}
                                              hitSlop={6}
                                              style={{ padding: 4 }}
                                            >
                                              <Ionicons name="close" size={13} color={colores.suave} />
                                            </Pressable>
                                          </View>
                                        </View>
                                      ))}

                                      {/* Botón + Añadir drop */}
                                      <View style={styles.addDropRow}>
                                        <Pressable
                                          onPress={() => agregarDropASerie(ejIdx, sIdx)}
                                          disabled={s.drops.length >= DROPSET_MAX_DROPS}
                                          style={({ pressed }) => [
                                            styles.addDropBtn,
                                            s.drops.length >= DROPSET_MAX_DROPS && { opacity: 0.5 },
                                            pressed && s.drops.length < DROPSET_MAX_DROPS && { opacity: 0.8 },
                                          ]}
                                        >
                                          <Ionicons name="add" size={12} color="#38BDF8" />
                                          <Text style={styles.addDropBtnText}>
                                            {s.drops.length >= DROPSET_MAX_DROPS
                                              ? `Máximo ${DROPSET_MAX_DROPS} drops`
                                              : `+ Añadir drop (${s.drops.length}/${DROPSET_MAX_DROPS})`}
                                          </Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>

                        )}

                        {/* Botón + Serie */}
                        <Pressable
                          onPress={() => agregarSerieAEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.addSerieBtn,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="add" size={14} color={colores.primarioHover} />
                          <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 11 }}>
                            + Añadir Serie
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}

                  {/* Observaciones Generales del Día */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.inputLabelText}>Observaciones del Entrenamiento</Text>
                    <TextInput
                      placeholder="Ej. Buena energía, foco en sobrecarga progresiva..."
                      placeholderTextColor={colores.suave}
                      multiline
                      numberOfLines={3}
                      value={notasSesion}
                      onChangeText={setNotasSesion}
                      onFocus={handleInputFocus}
                      style={[styles.inputBase, { height: 65, textAlignVertical: 'top' }]}
                    />
                  </View>
                </ScrollView>

                {/* DOCK INFERIOR — altura y posición responsive con safe areas, sin timer duplicado */}
                {!isKeyboardVisible && !focusTeclado && (
                  <View
                    style={[
                      styles.stickyBottomBar,
                      {
                        bottom: bottomInset + (isLandscape ? 4 : 8),
                        left: isLandscape || isTablet ? 'auto' : gutter,
                        right: isLandscape || isTablet ? 'auto' : gutter,
                        width: isLandscape || isTablet ? Math.min(width - gutter * 2, 720) : undefined,
                        alignSelf: 'center',
                        paddingVertical: isLandscape ? 6 : 10,
                      },
                    ]}
                    onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
                  >
                    <View style={{ flex: 1 }}>
                      <GlowButton
                        title="Guardar Entrenamiento"
                        onPress={abrirResumenConfirmacion}
                        variant="primary"
                        size={isLandscape ? "sm" : "md"}
                        shape="rounded"
                        fullWidth
                      />
                    </View>
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
        fechaTexto={`${nombreDia(fecha)} ${fecha.getDate()}`}
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

                  {/* Toggle Reps Parciales */}
                  <Pressable
                    onPress={() => {
                      toggleRepsParciales(serieMenu.ejIdx, serieMenu.sIdx);
                      setSerieMenu(null);
                    }}
                    style={styles.sheetOption}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Ionicons name="flash" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetOptionText}>
                        {currentSerie.tieneParciales ? 'Desactivar reps parciales' : 'Activar reps parciales'}
                      </Text>
                      <Text style={styles.sheetOptionSubtext}>
                        {currentSerie.tieneParciales ? 'Ocultar conteo de parciales' : 'Añadir repeticiones parciales al fallo'}
                      </Text>
                    </View>
                    <Ionicons
                      name={currentSerie.tieneParciales ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={currentSerie.tieneParciales ? "#F59E0B" : colores.suave}
                    />
                  </Pressable>

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
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 12,
    marginTop: 6,
  },
  lobbyIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyTitleText: {
    color: colores.texto,
    fontSize: 22,
    fontFamily: fuentes.black,
  },
  lobbySubtext: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  lobbyDivider: {
    height: 1,
    backgroundColor: colores.borde,
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
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.medium,
  },
  lobbyExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 12, 18, 0.50)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colores.borde,
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
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeIconButton: {
    backgroundColor: colores.tarjeta,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
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
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 10,
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
});
