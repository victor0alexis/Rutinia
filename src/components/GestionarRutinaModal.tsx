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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { crearRutina, eliminarRutina, actualizarRutina } from '../services/rutinas';
import { seguro } from '../utils/errores';
import { Rutina } from '../types';

type SerieInput = {
  id: string;
  peso: string;
  reps: string;
  rir: string;
  nota: string;
};

type EjercicioInput = {
  id: string;
  nombre: string;
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
  rir: '',
  nota: '',
});

const nuevoEjercicioVacio = (): EjercicioInput => ({
  id: Date.now().toString() + Math.random().toString(),
  nombre: '',
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
    if (visible) {
      if (rutinaParaEditar) {
        setNombreRutina(rutinaParaEditar.nombre);
        // Mapear ejercicios existentes
        const ejsMapeados: EjercicioInput[] = (rutinaParaEditar.ejercicios_rutina || []).map((e) => {
          // Extraer nombre base limpiando resumen previo de series si existe
          const nombreLimpio = e.nombre.replace(/\s*\(.*\)$/, '').trim();
          const numSeries = e.series || 1;
          const seriesArray: SerieInput[] = Array.from({ length: numSeries }, (_, i) => ({
            id: i.toString() + Math.random().toString(),
            peso: e.peso ? e.peso.toString() : '',
            reps: e.repeticiones ? e.repeticiones.toString() : '',
            rir: '',
            nota: '',
          }));

          return {
            id: e.id,
            nombre: nombreLimpio,
            series: seriesArray,
          };
        });

        setEjercicios(ejsMapeados.length > 0 ? ejsMapeados : [nuevoEjercicioVacio()]);
      } else {
        setNombreRutina('');
        setEjercicios([nuevoEjercicioVacio()]);
      }
    }
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

        const resumenSeries = ej.series
          .map((s, idx) => {
            const p = s.peso ? `${s.peso}k` : '';
            const r = s.reps ? `${s.reps}r` : '';
            const rir = s.rir ? `RIR ${s.rir}` : '';
            const n = s.nota ? `[${s.nota}]` : '';
            return `${idx + 1}ª: ${[p, r, rir, n].filter(Boolean).join(' ')}`;
          })
          .join(' • ');

        return {
          nombre: `${ej.nombre.trim()} (${resumenSeries})`,
          series: numSeriesTotal,
          repeticiones: repsPrimera,
          peso: pesoPrimero,
        };
      });

      if (rutinaParaEditar?.id) {
        // ACTUALIZAR: preserva el ID y las vinculaciones de registros_entrenamiento
        await actualizarRutina(rutinaParaEditar.id, nombreRutina.trim(), payloadEjercicios);
      } else {
        // CREAR: nueva rutina
        await crearRutina(nombreRutina.trim(), payloadEjercicios);
      }

      onGuardado();
      onClose();
      Alert.alert('Éxito', rutinaParaEditar ? 'Rutina actualizada correctamente.' : 'Rutina guardada correctamente.');
    });

  const borrarRutinaCompleta = () => {
    if (!rutinaParaEditar) return;
    Alert.alert('Eliminar Rutina', `¿Deseas eliminar la rutina "${rutinaParaEditar.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          seguro(async () => {
            await eliminarRutina(rutinaParaEditar.id);
            onGuardado();
            onClose();
          }),
      },
    ]);
  };

  const inputStyle = {
    backgroundColor: colores.fondo,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colores.texto,
    fontSize: 14,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: colores.tarjetaElevada,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            height: '92%',
            paddingTop: 16,
            paddingHorizontal: 20,
            gap: 14,
          }}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colores.borde }} />
          </View>

          {/* Header del Modal Pantalla Completa */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {rutinaParaEditar ? 'GESTIONAR RUTINA' : 'CREAR RUTINA'}
              </Text>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }} numberOfLines={1}>
                {rutinaParaEditar ? rutinaParaEditar.nombre : 'Nueva Rutina'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: colores.fondo,
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colores.borde,
              }}
            >
              <Ionicons name="close" size={20} color={colores.texto} />
            </Pressable>
          </View>

          {/* Acciones Rápidas (Programar en Semana / Eliminar) */}
          {rutinaParaEditar && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onProgramarSemana && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onProgramarSemana(rutinaParaEditar);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: colores.primarioSuave,
                    borderWidth: 1,
                    borderColor: colores.primarioGlow,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={colores.primarioHover} />
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 13 }}>
                    Programar en Semana
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={borrarRutinaCompleta}
                style={{
                  backgroundColor: colores.peligro + '20',
                  borderWidth: 1,
                  borderColor: colores.peligro + '50',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colores.peligro} />
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Nombre Rutina */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colores.suave, fontFamily: fuentes.bold, fontSize: 11, textTransform: 'uppercase' }}>
                Nombre de la Rutina
              </Text>
              <TextInput
                placeholder="Ej. Upper-A, Torso Hipertrofia, Leg Day"
                placeholderTextColor={colores.suave}
                value={nombreRutina}
                onChangeText={setNombreRutina}
                style={[inputStyle, { backgroundColor: colores.tarjeta, fontSize: 15, fontFamily: fuentes.bold }]}
              />
            </View>

            {/* Listado de Ejercicios */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colores.suave, fontFamily: fuentes.bold, fontSize: 11, textTransform: 'uppercase' }}>
                Ejercicios ({ejercicios.length})
              </Text>
            </View>

            {ejercicios.map((ej, ejIdx) => (
              <View
                key={ej.id}
                style={{
                  backgroundColor: colores.tarjeta,
                  borderRadius: 16,
                  padding: 16,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colores.borde,
                }}
              >
                {/* Header Ejercicio */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>
                    Ejercicio #{ejIdx + 1}
                  </Text>
                  {ejercicios.length > 1 && (
                    <Pressable onPress={() => quitarEjercicio(ejIdx)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={colores.peligro} />
                    </Pressable>
                  )}
                </View>

                {/* Nombre del Ejercicio */}
                <TextInput
                  placeholder="Nombre del Ejercicio (ej. Press Inclinado, Dominadas)"
                  placeholderTextColor={colores.suave}
                  value={ej.nombre}
                  onChangeText={(val) => cambiarNombreEjercicio(ejIdx, val)}
                  style={inputStyle}
                />

                {/* Tabla de Series */}
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
                        style={[inputStyle, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                      />

                      <TextInput
                        placeholder="10"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={s.reps}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                        style={[inputStyle, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                      />

                      <TextInput
                        placeholder="2"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={s.rir}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                        style={[inputStyle, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}
                      />

                      <TextInput
                        placeholder="Fallo/Técnica"
                        placeholderTextColor={colores.suave}
                        value={s.nota}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                        style={[inputStyle, { flex: 1.5, paddingHorizontal: 6, fontSize: 12 }]}
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

                {/* Botón + Añadir Serie */}
                <Pressable
                  onPress={() => agregarSerieAEjercicio(ejIdx)}
                  style={({ pressed }) => ({
                    backgroundColor: colores.fondo,
                    borderWidth: 1,
                    borderColor: colores.borde,
                    borderRadius: 10,
                    paddingVertical: 8,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: pressed ? 0.8 : 1,
                    marginTop: 4,
                  })}
                >
                  <Ionicons name="add" size={16} color={colores.primarioHover} />
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 12 }}>+ Añadir Serie</Text>
                </Pressable>
              </View>
            ))}

            {/* Botón + Añadir Otro Ejercicio */}
            <Pressable
              onPress={agregarEjercicio}
              style={({ pressed }) => ({
                backgroundColor: colores.tarjeta,
                borderWidth: 1,
                borderColor: colores.primario,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="add-circle-outline" size={20} color={colores.primarioHover} />
              <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>+ Añadir Otro Ejercicio</Text>
            </Pressable>

            {/* Botón Guardar / Actualizar */}
            <Pressable
              onPress={guardar}
              style={({ pressed }) => ({
                backgroundColor: colores.primario,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
                shadowColor: colores.primario,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
                marginTop: 6,
              })}
            >
              <Text style={{ color: '#FFF', fontFamily: fuentes.black, fontSize: 16 }}>
                {rutinaParaEditar ? 'Guardar Cambios de Rutina' : 'Guardar Rutina Completa'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
