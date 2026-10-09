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
import ScreenBackground from './ScreenBackground';
import GlowButton from './GlowButton';
import ResumenEntrenamientoModal, { EjercicioResumen } from './ResumenEntrenamientoModal';
import {
  actualizarEjecucionEjercicio,
  actualizarEstadoRegistro,
  obtenerHistorialPrevioRutina,
} from '../services/registros';
import { seguro, mostrarMensaje } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { nombreDia } from '../utils/fechas';
import { Registro } from '../types';
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

type Props = {
  visible: boolean;
  registro: Registro | null;
  fecha: Date | null;
  onClose: () => void;
  onGuardado: () => void;
  /** Si true, salta el lobby directamente al workout (usado al reanudar sesión guardada) */
  modoReanudar?: boolean;
};

type SerieEjecucion = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
  completado: boolean;
};

type EjercicioState = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieEjecucion[];
};

type SerieHistorica = {
  peso: string;
  reps: string;
  rir: string;
  nota: string;
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
  const [ejerciciosState, setEjerciciosState] = useState<EjercicioState[]>([]);
  const [notasSesion, setNotasSesion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialMap, setHistorialMap] = useState<HistoricoMap>({});

  // ESTADO DE LOBBY / PRE-PARTIDA
  const [enLobby, setEnLobby] = useState(true);

  // TIMER PERSISTENTE
  const [estadoTimer, setEstadoTimer] = useState<EstadoTimer | null>(null);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // MODAL RESUMEN Y CONFIRMACIÓN
  const [resumenVisible, setResumenVisible] = useState(false);

  // Cargar o restaurar sesión
  useEffect(() => {
    if (!visible || !registro) return;
    let cancelado = false;

    const timer = setTimeout(async () => {
      const borradorPrevio = await obtenerBorradorSesion(registro.id);
      let parsedEjercicios: EjercicioState[] = [];
      let notasTexto = '';

      if (borradorPrevio && borradorPrevio.ejerciciosState && borradorPrevio.ejerciciosState.length > 0) {
        parsedEjercicios = borradorPrevio.ejerciciosState;
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

            return {
              id: i.toString() + Math.random().toString(),
              peso: pesoStr,
              reps: repsStr,
              pesoI: pesoIStr,
              repsI: repsIStr,
              rir: rirStr,
              nota: notaStr,
              completado: sDetail ? sDetail.completado : Boolean(e.completado),
            };
          });

          return {
            id: e.id,
            nombre: parsed.nombreLimpio,
            esUnilateral: parsed.esUnilateral,
            series: seriesArray,
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
            const nLimpio = ePrev.nombre.replace(/\s*\(.*\)$/, '').trim();
            const mResumen = ePrev.nombre.match(/\((.*?)\)/);
            const rText = mResumen ? mResumen[1] : '';
            const sItems = rText.split('•').map((s) => s.trim());
            const nSeries = ePrev.series || sItems.length || 1;

            const sPrevArray: SerieHistorica[] = Array.from({ length: nSeries }, (_, i) => {
              let pStr = ePrev.peso ? ePrev.peso.toString() : '';
              let rStr = ePrev.repeticiones ? ePrev.repeticiones.toString() : '';
              let rirS = '';
              let nS = '';

              if (sItems[i]) {
                const item = sItems[i];
                const matchK = item.match(/(\d+(\.\d+)?)k/);
                if (matchK) pStr = matchK[1];
                const matchR = item.match(/(\d+)r/);
                if (matchR) rStr = matchR[1];
                const matchRIR = item.match(/RIR\s*(\d+)/i);
                if (matchRIR) rirS = matchRIR[1];
                const matchNota = item.match(/\[(.*?)\]/);
                if (matchNota) nS = matchNota[1];
              }

              return { peso: pStr, reps: rStr, rir: rirS, nota: nS };
            });

            map[nLimpio] = {
              fechaFormateada: fechaPrevStr,
              series: sPrevArray,
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
              rir: ultimaSerie ? ultimaSerie.rir : '',
              nota: '',
              completado: false,
            },
          ],
        };
      });
      guardarDraftAuto(next);
      return next;
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
            };
          }),
        };
      });
      guardarDraftAuto(next);
      return next;
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
            (s) => Boolean(s.peso || s.reps || s.pesoI || s.repsI || s.rir || s.nota || s.completado)
          );
          const resumenSeries = tieneDatos
            ? ej.series
                .map((s, idx) => {
                  if (ej.esUnilateral) {
                    const pD = s.peso ? `${s.peso}k` : '';
                    const rD = s.reps ? `${s.reps}r` : '';
                    const strD = [pD, rD].filter(Boolean).join(' ');

                    const pesoIVal = s.pesoI !== undefined && s.pesoI !== '' ? s.pesoI : s.peso;
                    const repsIVal = s.repsI !== undefined && s.repsI !== '' ? s.repsI : s.reps;
                    const pI = pesoIVal ? `${pesoIVal}k` : '';
                    const rI = repsIVal ? `${repsIVal}r` : '';
                    const strI = [pI, rI].filter(Boolean).join(' ');

                    const rir = s.rir ? `RIR ${s.rir}` : '';
                    const n = s.nota ? `[${s.nota}]` : '';
                    const c = s.completado ? '✓' : '';

                    const resumenBrazo = `D ${strD} | I ${strI}`.trim();
                    return `${idx + 1}ª: ${[resumenBrazo, rir, n, c].filter(Boolean).join(' ')}`;
                  } else {
                    const p = s.peso ? `${s.peso}k` : '';
                    const r = s.reps ? `${s.reps}r` : '';
                    const rir = s.rir ? `RIR ${s.rir}` : '';
                    const n = s.nota ? `[${s.nota}]` : '';
                    const c = s.completado ? '✓' : '';
                    return `${idx + 1}ª: ${[p, r, rir, n, c].filter(Boolean).join(' ')}`;
                  }
                })
                .join(' • ')
            : '';

          const tagU = ej.esUnilateral ? '[U] ' : '';
          const nombreLimpio = ej.nombre.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');
          const nombreBase = tagU + nombreLimpio;
          const nombreConDetalle = resumenSeries ? `${nombreBase} (${resumenSeries})` : nombreBase;

          await actualizarEjecucionEjercicio(ej.id, {
            nombre: nombreConDetalle,
            series: numSeriesTotal,
            repeticiones: repsPrimera,
            peso: pesoPrimero,
            completado: todasCompletadas,
          });
        }

        const sesionCompletada = porcentajeProgreso >= 50;
        await actualizarEstadoRegistro(registro.id, {
          completado: sesionCompletada,
          notas: notasSesion.trim() || null,
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
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenBackground>
          <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
            {/* LOBBY PRE-PARTIDA */}
            {enLobby ? (
              <View style={styles.lobbyContainer}>
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
                <View style={{ paddingBottom: 30, paddingTop: 10 }}>
                  <GlowButton
                    title="🔥 ¡INICIAR ENTRENAMIENTO!"
                    onPress={iniciarEntrenamiento}
                    variant="primary"
                    size="lg"
                    shape="rounded"
                    fullWidth
                  />
                </View>
              </View>
            ) : (
              /* PANTALLA PRINCIPAL DE SIMULACIÓN / ENTRENAMIENTO EN VIVO */
              <View style={{ flex: 1, paddingHorizontal: 16 }}>
                {/* Header de la Sesión en Vivo con Timer Persistente */}
                <View style={styles.liveHeader}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.liveDotPulse} />
                      <Text style={styles.modalBadgeText}>EN VIVO • {nombreDia(fecha)}</Text>
                    </View>
                    <Text style={{ color: colores.texto, fontSize: 20, fontFamily: fuentes.black }} numberOfLines={1}>
                      {registro.rutinas?.nombre || 'Entrenamiento del Día'}
                    </Text>
                  </View>

                  {/* Widget Timer Interactivo */}
                  <Pressable
                    onPress={togglePausaTimer}
                    style={({ pressed }) => [
                      styles.timerWidget,
                      estadoTimer?.pausado && styles.timerWidgetPausado,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name={estadoTimer?.pausado ? 'play' : 'time'}
                      size={15}
                      color={estadoTimer?.pausado ? '#F59E0B' : colores.hoy}
                    />
                    <Text style={styles.timerWidgetText}>
                      {formatearTiempo(segundosTranscurridos)}
                    </Text>
                  </Pressable>

                  <Pressable onPress={onClose} style={styles.closeIconButton}>
                    <Ionicons name="close" size={20} color={colores.texto} />
                  </Pressable>
                </View>

                {/* Barra de Progreso de Sesión */}
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

                {/* Formulario Scrollable de Ejercicios y Series */}
                <ScrollView
                  contentContainerStyle={{ gap: 16, paddingTop: 12, paddingBottom: 110 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {ejerciciosState.map((ej, ejIdx) => {
                    const histEj = historialMap[ej.nombre];

                    return (
                      <View key={ej.id} style={styles.exerciseCard}>
                        {/* Header del Ejercicio */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 15, flex: 1, paddingRight: 8 }} numberOfLines={1}>
                            {ejIdx + 1}. {ej.nombre}
                          </Text>
                          <View style={styles.seriesCountBadge}>
                            <Text style={{ color: colores.primarioHover, fontSize: 10, fontFamily: fuentes.bold }}>
                              {ej.series.length} {ej.series.length === 1 ? 'Serie' : 'Series'}
                            </Text>
                          </View>
                        </View>

                        {/* Banner de Referencia Histórica */}
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
                              {histEj.series.map((sPrev, sIdx) => (
                                <View key={sIdx} style={styles.historyChip}>
                                  <Text style={{ fontSize: 10, fontFamily: fuentes.medium, color: colores.texto }}>
                                    #{sIdx + 1}: <Text style={{ fontFamily: fuentes.bold, color: colores.hoy }}>{sPrev.peso ? `${sPrev.peso}k` : '-'}</Text> ×{' '}
                                    <Text style={{ fontFamily: fuentes.bold, color: colores.texto }}>{sPrev.reps ? `${sPrev.reps}r` : '-'}</Text>
                                    {sPrev.rir ? ` (RIR ${sPrev.rir})` : ''}
                                  </Text>
                                </View>
                              ))}
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

                        {/* Tabla de Series (Bilateral vs Unilateral D/I) adaptada para móvil */}
                        {ej.esUnilateral ? (
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, width: 22 }}>ST</Text>
                              <Text style={{ color: colores.exito, fontSize: 9, fontFamily: fuentes.bold, flex: 2, textAlign: 'center' }}>DERECHO (D)</Text>
                              <Text style={{ color: colores.hoy, fontSize: 9, fontFamily: fuentes.bold, flex: 2, textAlign: 'center' }}>IZQUIERDO (I)</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>RIR</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, width: 28, textAlign: 'center' }}>OK</Text>
                            </View>

                            {ej.series.map((s, sIdx) => (
                              <View
                                key={s.id}
                                style={[
                                  styles.serieRow,
                                  { backgroundColor: s.completado ? 'rgba(16, 185, 129, 0.12)' : 'transparent' },
                                ]}
                              >
                                <View style={{ width: 22, alignItems: 'center' }}>
                                  <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 11 }}>
                                    #{sIdx + 1}
                                  </Text>
                                </View>

                                {/* DERECHO */}
                                <View style={{ flex: 2, flexDirection: 'row', gap: 2 }}>
                                  <TextInput
                                    placeholder="KG D"
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.peso}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center', fontSize: 11, paddingHorizontal: 2 }]}
                                  />
                                  <TextInput
                                    placeholder="REPS D"
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.reps}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center', fontSize: 11, paddingHorizontal: 2 }]}
                                  />
                                </View>

                                {/* IZQUIERDO */}
                                <View style={{ flex: 2, flexDirection: 'row', gap: 2 }}>
                                  <TextInput
                                    placeholder="KG I"
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.pesoI !== undefined ? s.pesoI : s.peso}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'pesoI', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center', fontSize: 11, paddingHorizontal: 2 }]}
                                  />
                                  <TextInput
                                    placeholder="REPS I"
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.repsI !== undefined ? s.repsI : s.reps}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'repsI', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center', fontSize: 11, paddingHorizontal: 2 }]}
                                  />
                                </View>

                                {/* RIR */}
                                <TextInput
                                  placeholder="RIR"
                                  placeholderTextColor={colores.suave}
                                  keyboardType="numeric"
                                  value={s.rir}
                                  onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                                  style={[styles.inputBase, { flex: 1, textAlign: 'center', fontSize: 11, paddingHorizontal: 2 }]}
                                />

                                {/* Checkbox OK */}
                                <Pressable
                                  onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'completado', !s.completado)}
                                  style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}
                                  hitSlop={6}
                                >
                                  <Ionicons
                                    name={s.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={s.completado ? colores.exito : colores.suave}
                                  />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        ) : (
                          /* BILATERAL */
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, width: 24 }}>ST</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>KG</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>REPS</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>RIR</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, flex: 1.3, textAlign: 'center' }}>NOTA</Text>
                              <Text style={{ color: colores.suave, fontSize: 9, fontFamily: fuentes.bold, width: 28, textAlign: 'center' }}>OK</Text>
                            </View>

                            {ej.series.map((s, sIdx) => {
                              const sPrev = histEj?.series[sIdx];
                              const diffPeso = s.peso && sPrev?.peso ? Number(s.peso) - Number(sPrev.peso) : 0;

                              return (
                                <View
                                  key={s.id}
                                  style={[
                                    styles.serieRow,
                                    { backgroundColor: s.completado ? 'rgba(16, 185, 129, 0.12)' : 'transparent' },
                                  ]}
                                >
                                  <View style={{ width: 24, alignItems: 'center' }}>
                                    <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 11 }}>
                                      #{sIdx + 1}
                                    </Text>
                                  </View>

                                  {/* KG */}
                                  <View style={{ flex: 1 }}>
                                    <TextInput
                                      placeholder={sPrev?.peso ? sPrev.peso : '0'}
                                      placeholderTextColor={colores.suave}
                                      keyboardType="numeric"
                                      value={s.peso}
                                      onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                                      style={[styles.inputBase, { textAlign: 'center' }]}
                                    />
                                    {diffPeso > 0 && (
                                      <Text style={styles.overloadBadge}>🔥 +{diffPeso}k</Text>
                                    )}
                                  </View>

                                  {/* REPS */}
                                  <TextInput
                                    placeholder={sPrev?.reps ? sPrev.reps : '0'}
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.reps}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center' }]}
                                  />

                                  {/* RIR */}
                                  <TextInput
                                    placeholder={sPrev?.rir ? `RIR ${sPrev.rir}` : 'RIR'}
                                    placeholderTextColor={colores.suave}
                                    keyboardType="numeric"
                                    value={s.rir}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                                    style={[styles.inputBase, { flex: 1, textAlign: 'center' }]}
                                  />

                                  {/* NOTA */}
                                  <TextInput
                                    placeholder="Sensación"
                                    placeholderTextColor={colores.suave}
                                    value={s.nota}
                                    onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                    style={[styles.inputBase, { flex: 1.3, fontSize: 10 }]}
                                  />

                                  {/* Checkbox OK */}
                                  <Pressable
                                    onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'completado', !s.completado)}
                                    style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}
                                    hitSlop={6}
                                  >
                                    <Ionicons
                                      name={s.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                      size={22}
                                      color={s.completado ? colores.exito : colores.suave}
                                    />
                                  </Pressable>

                                  {/* Eliminar Serie */}
                                  <Pressable
                                    onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                                    disabled={ej.series.length === 1}
                                    style={{ opacity: ej.series.length === 1 ? 0.2 : 0.7, padding: 2 }}
                                    hitSlop={6}
                                  >
                                    <Ionicons name="close" size={14} color={colores.suave} />
                                  </Pressable>
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
                      style={[styles.inputBase, { height: 65, textAlignVertical: 'top' }]}
                    />
                  </View>
                </ScrollView>

                {/* BOTÓN FLOTANTE / ADHERIDO PERMANENTEMENTE AL INFERIOR DE PANTALLA (STICKY ACTION BAR) */}
                <View style={styles.stickyBottomBar}>
                  <View style={styles.stickyTimerBadge}>
                    <Ionicons name="time-outline" size={16} color={colores.hoy} />
                    <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 13 }}>
                      {formatearTiempo(segundosTranscurridos)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <GlowButton
                      title="Guardar Entrenamiento"
                      onPress={abrirResumenConfirmacion}
                      variant="primary"
                      size="md"
                      shape="rounded"
                      fullWidth
                    />
                  </View>
                </View>
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
    padding: 14,
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
  },
  inputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.regular,
  },
  addSerieBtn: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 2,
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

  /* FIX STICKY BOTTOM BAR */
  stickyBottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.40)',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  stickyTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.tarjeta,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
});
