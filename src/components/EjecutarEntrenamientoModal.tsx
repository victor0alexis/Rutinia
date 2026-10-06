import React, { useState, useEffect } from 'react';
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
import { actualizarEjecucionEjercicio, actualizarEstadoRegistro, obtenerHistorialPrevioRutina } from '../services/registros';
import { seguro, mostrarMensaje } from '../utils/errores';
import { nombreDia } from '../utils/fechas';
import { Registro } from '../types';

type Props = {
  visible: boolean;
  registro: Registro | null;
  fecha: Date | null;
  onClose: () => void;
  onGuardado: () => void;
};

type SerieEjecucion = {
  id: string;
  peso: string;
  reps: string;
  rir: string;
  nota: string;
  completado: boolean;
};

type EjercicioState = {
  id: string;
  nombre: string;
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
}: Props) {
  const [ejerciciosState, setEjerciciosState] = useState<EjercicioState[]>([]);
  const [notasSesion, setNotasSesion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialMap, setHistorialMap] = useState<HistoricoMap>({});

  useEffect(() => {
    if (!visible || !registro) return;
    let cancelado = false;

    const timer = setTimeout(async () => {
      const obsExistente = (registro.ejercicios_registro || []).find((e) => e.nombre.includes('📌 [OBSERVACIONES]'));
      const textoObs = obsExistente ? obsExistente.nombre.replace('📌 [OBSERVACIONES] ', '').trim() : '';
      setNotasSesion(textoObs);

      const ejsPure = (registro.ejercicios_registro || []).filter(
        (e) => !e.nombre.startsWith('📌')
      );

      const parsedEjercicios: EjercicioState[] = ejsPure.map((e) => {
        const nombreLimpio = e.nombre.replace(/\s*\(.*\)$/, '').trim();
        const numSeries = e.series || 1;

        const matchResumen = e.nombre.match(/\((.*?)\)/);
        const resumenText = matchResumen ? matchResumen[1] : '';
        const seriesItems = resumenText.split('•').map((s) => s.trim());

        const seriesArray: SerieEjecucion[] = Array.from({ length: numSeries }, (_, i) => {
          let pesoStr = e.peso ? e.peso.toString() : '';
          let repsStr = e.repeticiones ? e.repeticiones.toString() : '';
          let rirStr = '';
          let notaStr = '';

          if (seriesItems[i]) {
            const item = seriesItems[i];
            const matchK = item.match(/(\d+(\.\d+)?)k/);
            if (matchK) pesoStr = matchK[1];
            const matchR = item.match(/(\d+)r/);
            if (matchR) repsStr = matchR[1];
            const matchRIR = item.match(/RIR\s*(\d+)/i);
            if (matchRIR) rirStr = matchRIR[1];
            const matchNota = item.match(/\[(.*?)\]/);
            if (matchNota) notaStr = matchNota[1];
          }

          return {
            id: i.toString() + Math.random().toString(),
            peso: pesoStr,
            reps: repsStr,
            rir: rirStr,
            nota: notaStr,
            completado: e.completado || false,
          };
        });

        return {
          id: e.id,
          nombre: nombreLimpio,
          series: seriesArray,
        };
      });

      setEjerciciosState(parsedEjercicios);

      // Cargar historial previo de la misma rutina
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
    }, 0);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [visible, registro]);

  if (!fecha || !registro) return null;

  const totalSeriesEnSesion = ejerciciosState.reduce((acc, ej) => acc + ej.series.length, 0);
  const totalSeriesCompletadas = ejerciciosState.reduce(
    (acc, ej) => acc + ej.series.filter((s) => s.completado).length,
    0
  );
  const porcentajeProgreso = totalSeriesEnSesion > 0 ? Math.round((totalSeriesCompletadas / totalSeriesEnSesion) * 100) : 0;

  const cambiarCampoSerie = (
    ejIndex: number,
    sIndex: number,
    campo: keyof SerieEjecucion,
    val: any
  ) => {
    setEjerciciosState((prev) =>
      prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => (sj === sIndex ? { ...s, [campo]: val } : s)),
        };
      })
    );
  };

  const agregarSerieAEjercicio = (ejIndex: number) => {
    setEjerciciosState((prev) =>
      prev.map((ej, i) => {
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
      })
    );
  };

  const quitarSerieDeEjercicio = (ejIndex: number, sIndex: number) => {
    setEjerciciosState((prev) =>
      prev.map((ej, i) => {
        if (i !== ejIndex) return ej;
        if (ej.series.length === 1) return ej;
        return {
          ...ej,
          series: ej.series.filter((_, sj) => sj !== sIndex),
        };
      })
    );
  };

  const copiarSeriesHistorial = (ejIndex: number) => {
    const ej = ejerciciosState[ejIndex];
    if (!ej) return;
    const hist = historialMap[ej.nombre];
    if (!hist || !hist.series.length) return;

    setEjerciciosState((prev) =>
      prev.map((e, i) => {
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
      })
    );
  };

  const guardarSesion = () =>
    seguro(async () => {
      setGuardando(true);
      try {
        for (const ej of ejerciciosState) {
          const primeraSerie = ej.series[0];
          const numSeriesTotal = ej.series.length;
          const repsPrimera = primeraSerie?.reps ? Number(primeraSerie.reps) : null;
          const pesoPrimero = primeraSerie?.peso ? Number(primeraSerie.peso) : null;
          const todasCompletadas = ej.series.every((s) => s.completado);

          const resumenSeries = ej.series
            .map((s, idx) => {
              const p = s.peso ? `${s.peso}k` : '';
              const r = s.reps ? `${s.reps}r` : '';
              const rir = s.rir ? `RIR ${s.rir}` : '';
              const n = s.nota ? `[${s.nota}]` : '';
              const c = s.completado ? '✓' : '';
              return `${idx + 1}ª: ${[p, r, rir, n, c].filter(Boolean).join(' ')}`;
            })
            .join(' • ');

          const nombreConDetalle = `${ej.nombre.trim()} (${resumenSeries})`;

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

        onGuardado();
        onClose();
        mostrarMensaje('¡Entrenamiento Guardado!', `Se registró el progreso del día ${nombreDia(fecha)}.`);
      } finally {
        setGuardando(false);
      }
    });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScreenBackground>
          <View
            style={{
              flex: 1,
              paddingTop: Platform.OS === 'ios' ? 50 : 20,
              paddingHorizontal: 16,
              gap: 16,
            }}
          >
            {/* Header del Modal */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalBadgeText}>
                  REGISTRO DEL DÍA • {nombreDia(fecha)}
                </Text>
                <Text style={{ color: colores.texto, fontSize: 24, fontFamily: fuentes.black }} numberOfLines={1}>
                  {registro.rutinas?.nombre || 'Entrenamiento del Día'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeIconButton}>
                <Ionicons name="close" size={22} color={colores.texto} />
              </Pressable>
            </View>

            {/* Barra de Progreso de Sesión */}
            <View style={styles.progressCardBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 13 }}>
                  Series completadas: {totalSeriesCompletadas} / {totalSeriesEnSesion}
                </Text>
                <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>
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
              contentContainerStyle={{ gap: 16, paddingBottom: 50 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {ejerciciosState.map((ej, ejIdx) => {
                const histEj = historialMap[ej.nombre];

                return (
                  <View key={ej.id} style={styles.exerciseCard}>
                    {/* Header del Ejercicio */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 16 }}>
                        {ejIdx + 1}. {ej.nombre}
                      </Text>
                      <View style={styles.seriesCountBadge}>
                        <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold }}>
                          {ej.series.length} {ej.series.length === 1 ? 'Serie' : 'Series'}
                        </Text>
                      </View>
                    </View>

                    {/* Banner de Referencia Histórica (Última Sesión) */}
                    {histEj && histEj.series.length > 0 ? (
                      <View style={styles.historyBoxContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="time-outline" size={13} color={colores.hoy} />
                            <Text style={{ fontSize: 11, fontFamily: fuentes.bold, color: colores.hoy }}>
                              SESIÓN ANTERIOR • {histEj.fechaFormateada}
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
                            <Ionicons name="duplicate-outline" size={12} color={colores.primarioHover} />
                            <Text style={{ fontSize: 11, fontFamily: fuentes.bold, color: colores.primarioHover }}>
                              Copiar marcas
                            </Text>
                          </Pressable>
                        </View>

                        {/* Marcas de la sesión previa por cada serie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {histEj.series.map((sPrev, sIdx) => (
                            <View key={sIdx} style={styles.historyChip}>
                              <Text style={{ fontSize: 11, fontFamily: fuentes.medium, color: colores.texto }}>
                                #{sIdx + 1}: <Text style={{ fontFamily: fuentes.bold, color: colores.hoy }}>{sPrev.peso ? `${sPrev.peso}kg` : '-'}</Text> ×{' '}
                                <Text style={{ fontFamily: fuentes.bold, color: colores.texto }}>{sPrev.reps ? `${sPrev.reps}r` : '-'}</Text>
                                {sPrev.rir ? ` (RIR ${sPrev.rir})` : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noHistoryBox}>
                        <Ionicons name="sparkles-outline" size={13} color={colores.suave} />
                        <Text style={{ fontSize: 11, fontFamily: fuentes.medium, color: colores.suave, fontStyle: 'italic' }}>
                          Sin registros previos para este ejercicio • Esta será tu marca base
                        </Text>
                      </View>
                    )}

                    {/* Tabla de Series */}
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 28 }}>ST</Text>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>KG</Text>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>REPS</Text>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>RIR</Text>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1.4, textAlign: 'center' }}>NOTA</Text>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 34, textAlign: 'center' }}>OK</Text>
                      </View>

                      {ej.series.map((s, sIdx) => {
                        const sPrev = histEj?.series[sIdx];
                        const diffPeso = s.peso && sPrev?.peso ? Number(s.peso) - Number(sPrev.peso) : 0;

                        return (
                          <View
                            key={s.id}
                            style={[
                              styles.serieRow,
                              {
                                backgroundColor: s.completado ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                              },
                            ]}
                          >
                            <View style={{ width: 28, alignItems: 'center' }}>
                              <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>
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
                                <Text style={styles.overloadBadge}>
                                  🔥 +{diffPeso}k
                                </Text>
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
                              style={[styles.inputBase, { flex: 1.4, fontSize: 11 }]}
                            />

                            {/* Checkbox OK */}
                            <Pressable
                              onPress={() => cambiarCampoSerie(ejIdx, sIdx, 'completado', !s.completado)}
                              style={{
                                width: 34,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 4,
                              }}
                            >
                              <Ionicons
                                name={s.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                size={24}
                                color={s.completado ? colores.exito : colores.suave}
                              />
                            </Pressable>

                            {/* Eliminar Serie */}
                            <Pressable
                              onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                              disabled={ej.series.length === 1}
                              style={{ opacity: ej.series.length === 1 ? 0.2 : 0.7, padding: 2 }}
                            >
                              <Ionicons name="close" size={16} color={colores.suave} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>

                  {/* Botón + Serie */}
                  <Pressable
                    onPress={() => agregarSerieAEjercicio(ejIdx)}
                    style={({ pressed }) => [
                      styles.addSerieBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={colores.primarioHover} />
                    <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 12 }}>+ Añadir Serie</Text>
                  </Pressable>
                </View>
              );
            })}

              {/* Observaciones Generales del Día */}
              <View style={{ gap: 6 }}>
                <Text style={styles.inputLabelText}>
                  Observaciones del Entrenamiento del Día
                </Text>
                <TextInput
                  placeholder="Ej. Buena energía, foco en sobrecarga progresiva, molestias leves..."
                  placeholderTextColor={colores.suave}
                  multiline
                  numberOfLines={3}
                  value={notasSesion}
                  onChangeText={setNotasSesion}
                  style={[styles.inputBase, { height: 75, textAlignVertical: 'top' }]}
                />
              </View>

              {/* Botón Guardar / Finalizar */}
              <GlowButton
                title={guardando ? 'Guardando Entrenamiento...' : 'Guardar y Finalizar Entrenamiento'}
                onPress={guardarSesion}
                disabled={guardando}
                variant="primary"
                size="lg"
                shape="rounded"
                fullWidth
                style={{ marginTop: 6 }}
              />
            </ScrollView>
          </View>
        </ScreenBackground>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBadgeText: {
    color: colores.primarioHover,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeIconButton: {
    backgroundColor: colores.tarjeta,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  progressCardBox: {
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(10, 12, 18, 0.80)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  exerciseCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  seriesCountBadge: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingVertical: 2,
  },
  inputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.regular,
  },
  addSerieBtn: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  inputLabelText: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  historyBoxContainer: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.28)',
    gap: 4,
    marginTop: 4,
  },
  noHistoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.40)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colores.borde,
    marginTop: 4,
  },
  copyMarksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  historyChip: {
    backgroundColor: 'rgba(10, 12, 18, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  overloadBadge: {
    color: '#F59E0B',
    fontSize: 9,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    marginTop: 2,
  },
});
