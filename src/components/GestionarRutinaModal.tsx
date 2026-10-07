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
import GlowButton from './GlowButton';
import BotonRutinia from './BotonRutinia';
import { crearRutina, eliminarRutina, actualizarRutina } from '../services/rutinas';
import { seguro, confirmarAccion, mostrarMensaje } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { Rutina } from '../types';

type SerieInput = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
};

type EjercicioInput = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieInput[];
};

type Props = {
  visible: boolean;
  rutinaParaEditar?: Rutina | null;
  onClose: () => void;
  onGuardado: () => void;
  onProgramarSemana?: (rutina: Rutina) => void;
};

const nuevaSerieVacia = (): SerieInput => ({
  id: Date.now().toString() + Math.random().toString(),
  peso: '',
  reps: '',
  pesoI: '',
  repsI: '',
  rir: '',
  nota: '',
});

const nuevoEjercicioVacio = (): EjercicioInput => ({
  id: Date.now().toString() + Math.random().toString(),
  nombre: '',
  esUnilateral: false,
  series: [nuevaSerieVacia()],
});

export default function GestionarRutinaModal({
  visible,
  rutinaParaEditar,
  onClose,
  onGuardado,
  onProgramarSemana,
}: Props) {
  const [nombreRutina, setNombreRutina] = useState('');
  const [ejercicios, setEjercicios] = useState<EjercicioInput[]>([nuevoEjercicioVacio()]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (rutinaParaEditar) {
        setNombreRutina(rutinaParaEditar.nombre);
        const ejsMapeados: EjercicioInput[] = (rutinaParaEditar.ejercicios_rutina || []).map((e) => {
          const parsed = parsearEjercicioInfo(e);
          const numSeries = e.series || parsed.detallesSets.length || 1;

          const seriesArray: SerieInput[] = Array.from({ length: numSeries }, (_, i) => {
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
            };
          });

          return {
            id: e.id,
            nombre: parsed.nombreLimpio,
            esUnilateral: parsed.esUnilateral,
            series: seriesArray,
          };
        });

        setEjercicios(ejsMapeados.length > 0 ? ejsMapeados : [nuevoEjercicioVacio()]);
      } else {
        setNombreRutina('');
        setEjercicios([nuevoEjercicioVacio()]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, rutinaParaEditar]);

  // Modificar Ejercicio
  const cambiarNombreEjercicio = (index: number, val: string) => {
    setEjercicios(
      ejercicios.map((ej, i) => (i === index ? { ...ej, nombre: val } : ej))
    );
  };

  const agregarEjercicio = () => {
    setEjercicios([...ejercicios, nuevoEjercicioVacio()]);
  };

  const quitarEjercicio = (index: number) => {
    if (ejercicios.length === 1) return;
    setEjercicios(ejercicios.filter((_, i) => i !== index));
  };

  // Modificar Series de un Ejercicio
  const agregarSerieAEjercicio = (ejIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: [...ej.series, nuevaSerieVacia()],
        };
      })
    );
  };

  const quitarSerieDeEjercicio = (ejIndex: number, sIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        if (ej.series.length === 1) return ej;
        return {
          ...ej,
          series: ej.series.filter((_, sj) => sj !== sIndex),
        };
      })
    );
  };

  const cambiarCampoSerie = (
    ejIndex: number,
    sIndex: number,
    campo: keyof SerieInput,
    val: string
  ) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => (sj === sIndex ? { ...s, [campo]: val } : s)),
        };
      })
    );
  };

  const alternarUnilateral = (ejIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => (i === ejIndex ? { ...ej, esUnilateral: !ej.esUnilateral } : ej))
    );
  };

  const guardar = () =>
    seguro(async () => {
      if (!nombreRutina.trim()) throw new Error('Ingresa un nombre para la rutina.');

      const ejerciciosValidos = ejercicios.filter((ej) => ej.nombre.trim());
      if (ejerciciosValidos.length === 0) throw new Error('Agrega al menos un ejercicio con nombre.');

      const payloadEjercicios = ejerciciosValidos.map((ej) => {
        const primeraSerie = ej.series[0];
        const numSeriesTotal = ej.series.length;
        const repsPrimera = primeraSerie?.reps ? Number(primeraSerie.reps) : null;
        const pesoPrimero = primeraSerie?.peso ? Number(primeraSerie.peso) : null;

        const tieneDatos = ej.series.some((s) => Boolean(s.peso || s.reps || s.pesoI || s.repsI || s.rir || s.nota));
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

                  const resumenBrazo = `D ${strD} | I ${strI}`.trim();
                  return `${idx + 1}ª: ${[resumenBrazo, rir, n].filter(Boolean).join(' ')}`;
                } else {
                  const p = s.peso ? `${s.peso}k` : '';
                  const r = s.reps ? `${s.reps}r` : '';
                  const rir = s.rir ? `RIR ${s.rir}` : '';
                  const n = s.nota ? `[${s.nota}]` : '';
                  return `${idx + 1}ª: ${[p, r, rir, n].filter(Boolean).join(' ')}`;
                }
              })
              .join(' • ')
          : '';

        const tagU = ej.esUnilateral ? '[U] ' : '';
        const nombreLimpio = ej.nombre.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');
        const nombreBase = tagU + nombreLimpio;
        const nombreFinal = resumenSeries ? `${nombreBase} (${resumenSeries})` : nombreBase;

        return {
          nombre: nombreFinal,
          series: numSeriesTotal,
          repeticiones: repsPrimera,
          peso: pesoPrimero,
        };
      });

      if (rutinaParaEditar?.id) {
        await actualizarRutina(rutinaParaEditar.id, nombreRutina.trim(), payloadEjercicios);
      } else {
        await crearRutina(nombreRutina.trim(), payloadEjercicios);
      }

      onGuardado();
      onClose();
      mostrarMensaje('Éxito', rutinaParaEditar ? 'Rutina actualizada correctamente.' : 'Rutina guardada correctamente.');
    });

  const borrarRutinaCompleta = () => {
    if (!rutinaParaEditar) return;
    confirmarAccion(
      'Eliminar Rutina',
      `¿Deseas eliminar la rutina "${rutinaParaEditar.nombre}"?`,
      async () => {
        await eliminarRutina(rutinaParaEditar.id);
        onGuardado();
        onClose();
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' }}
      >
        <View style={styles.sheetContainer}>
          {/* Grabber */}
          <View style={{ alignItems: 'center' }}>
            <View style={styles.grabberHandle} />
          </View>

          {/* Header del Modal Pantalla Completa */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.modalBadgeText}>
                {rutinaParaEditar ? 'GESTIONAR RUTINA' : 'CREAR RUTINA'}
              </Text>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }} numberOfLines={1}>
                {rutinaParaEditar ? rutinaParaEditar.nombre : 'Nueva Rutina'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeIconButton}>
              <Ionicons name="close" size={20} color={colores.texto} />
            </Pressable>
          </View>

          {/* Acciones Rápidas (Programar en Semana / Eliminar) */}
          {rutinaParaEditar && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onProgramarSemana && (
                <View style={{ flex: 1 }}>
                  <GlowButton
                    title="Programar en Semana"
                    icon="calendar-outline"
                    onPress={() => {
                      onClose();
                      onProgramarSemana(rutinaParaEditar);
                    }}
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    fullWidth
                  />
                </View>
              )}

              <GlowButton
                icon="trash-outline"
                onPress={borrarRutinaCompleta}
                variant="danger"
                size="sm"
                shape="rounded"
              />
            </View>
          )}

          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Nombre Rutina */}
            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabelText}>
                Nombre de la Rutina
              </Text>
              <TextInput
                placeholder="Ej. Upper-A, Torso Hipertrofia, Leg Day"
                placeholderTextColor={colores.suave}
                value={nombreRutina}
                onChangeText={setNombreRutina}
                style={[styles.inputBase, { fontSize: 15, fontFamily: fuentes.bold }]}
              />
            </View>

            {/* Listado de Ejercicios */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.inputLabelText}>
                Ejercicios ({ejercicios.length})
              </Text>
            </View>

            {ejercicios.map((ej, ejIdx) => (
              <View key={ej.id} style={styles.exerciseCard}>
                {/* Header Ejercicio con Toggle Unilateral */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>
                    Ejercicio #{ejIdx + 1}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={() => alternarUnilateral(ejIdx)}
                      style={{
                        backgroundColor: ej.esUnilateral ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        borderWidth: 1,
                        borderColor: ej.esUnilateral ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.12)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name={ej.esUnilateral ? 'hand-left-outline' : 'body-outline'}
                        size={12}
                        color={ej.esUnilateral ? colores.exito : colores.suave}
                      />
                      <Text
                        style={{
                          color: ej.esUnilateral ? colores.exito : colores.suave,
                          fontSize: 10,
                          fontFamily: fuentes.bold,
                        }}
                      >
                        {ej.esUnilateral ? 'Unilateral (D/I)' : 'Bilateral'}
                      </Text>
                    </Pressable>

                    {ejercicios.length > 1 && (
                      <Pressable onPress={() => quitarEjercicio(ejIdx)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={18} color={colores.peligro} />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Nombre del Ejercicio */}
                <TextInput
                  placeholder="Nombre del Ejercicio (ej. Remo Unilateral, Press Mancuerna)"
                  placeholderTextColor={colores.suave}
                  value={ej.nombre}
                  onChangeText={(val) => cambiarNombreEjercicio(ejIdx, val)}
                  style={styles.inputBase}
                />

                {/* Tabla de Series (Bilateral vs Unilateral D/I) */}
                {ej.esUnilateral ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 26 }}>ST</Text>
                      <Text style={{ color: colores.exito, fontSize: 10, fontFamily: fuentes.bold, flex: 2, textAlign: 'center' }}>💪 DERECHO (D)</Text>
                      <Text style={{ color: colores.hoy, fontSize: 10, fontFamily: fuentes.bold, flex: 2, textAlign: 'center' }}>💪 IZQUIERDO (I)</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>RIR</Text>
                      <View style={{ width: 22 }} />
                    </View>

                    {ej.series.map((s, sIdx) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 26, alignItems: 'center' }}>
                          <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>#{sIdx + 1}</Text>
                        </View>

                        {/* DERECHO (D) */}
                        <View style={{ flex: 2, flexDirection: 'row', gap: 2 }}>
                          <TextInput
                            placeholder="KG D"
                            placeholderTextColor={colores.suave}
                            keyboardType="numeric"
                            value={s.peso}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                            style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 2, fontSize: 11 }]}
                          />
                          <TextInput
                            placeholder="REPS D"
                            placeholderTextColor={colores.suave}
                            keyboardType="numeric"
                            value={s.reps}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                            style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 2, fontSize: 11 }]}
                          />
                        </View>

                        {/* IZQUIERDO (I) */}
                        <View style={{ flex: 2, flexDirection: 'row', gap: 2 }}>
                          <TextInput
                            placeholder="KG I"
                            placeholderTextColor={colores.suave}
                            keyboardType="numeric"
                            value={s.pesoI !== undefined ? s.pesoI : s.peso}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'pesoI', val)}
                            style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 2, fontSize: 11 }]}
                          />
                          <TextInput
                            placeholder="REPS I"
                            placeholderTextColor={colores.suave}
                            keyboardType="numeric"
                            value={s.repsI !== undefined ? s.repsI : s.reps}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'repsI', val)}
                            style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 2, fontSize: 11 }]}
                          />
                        </View>

                        <TextInput
                          placeholder="RIR"
                          placeholderTextColor={colores.suave}
                          keyboardType="numeric"
                          value={s.rir}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                          style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 2, fontSize: 11 }]}
                        />

                        <Pressable
                          onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                          disabled={ej.series.length === 1}
                          style={{ opacity: ej.series.length === 1 ? 0.3 : 1 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={colores.suave} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 34 }}>SERIE</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>KG (PESO)</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>REPS</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, textAlign: 'center' }}>RIR</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1.5, textAlign: 'center' }}>NOTAS</Text>
                      <View style={{ width: 24 }} />
                    </View>

                    {ej.series.map((s, sIdx) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 34, alignItems: 'center' }}>
                          <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 13 }}>#{sIdx + 1}</Text>
                        </View>

                        <TextInput
                          placeholder="100"
                          placeholderTextColor={colores.suave}
                          keyboardType="numeric"
                          value={s.peso}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                          style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                        />

                        <TextInput
                          placeholder="10"
                          placeholderTextColor={colores.suave}
                          keyboardType="numeric"
                          value={s.reps}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                          style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                        />

                        <TextInput
                          placeholder="2"
                          placeholderTextColor={colores.suave}
                          keyboardType="numeric"
                          value={s.rir}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                          style={[styles.inputBase, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                        />

                        <TextInput
                          placeholder="Fallo/Técnica"
                          placeholderTextColor={colores.suave}
                          value={s.nota}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                          style={[styles.inputBase, { flex: 1.5, paddingHorizontal: 6, fontSize: 12 }]}
                        />

                        <Pressable
                          onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                          disabled={ej.series.length === 1}
                          style={{ opacity: ej.series.length === 1 ? 0.3 : 1 }}
                        >
                          <Ionicons name="close-circle-outline" size={20} color={colores.suave} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Botón + Añadir Serie */}
                <Pressable
                  onPress={() => agregarSerieAEjercicio(ejIdx)}
                  style={({ pressed }) => [
                    styles.addSerieButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="add" size={16} color={colores.primarioHover} />
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 12 }}>+ Añadir Serie</Text>
                </Pressable>
              </View>
            ))}

            {/* Botón + Añadir Otro Ejercicio */}
            <GlowButton
              title="+ Añadir Otro Ejercicio"
              icon="add-circle-outline"
              onPress={agregarEjercicio}
              variant="outline"
              size="md"
              shape="rounded"
              fullWidth
            />

            {/* Botón Guardar / Actualizar */}
            <BotonRutinia
              titulo={rutinaParaEditar ? 'Guardar Cambios' : 'Guardar rutina'}
              onPress={guardar}
              style={{ alignSelf: 'stretch', marginTop: 6 }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: colores.tarjetaElevada,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '92%',
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  grabberHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.bordeBrillante,
  },
  modalBadgeText: {
    color: colores.primarioHover,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeIconButton: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  inputLabelText: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  inputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  exerciseCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  addSerieButton: {
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
});
