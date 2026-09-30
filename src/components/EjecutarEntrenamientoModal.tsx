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
import { actualizarEjecucionEjercicio, actualizarEstadoRegistro } from '../services/registros';
import { seguro } from '../utils/errores';
import { nombreDia } from '../utils/fechas';
import { Registro, EjercicioRegistro } from '../types';

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

  useEffect(() => {
    if (visible && registro) {
      const obsExistente = (registro.ejercicios_registro || []).find((e) => e.nombre.includes('📌 [OBSERVACIONES]'));
      const textoObs = obsExistente ? obsExistente.nombre.replace('📌 [OBSERVACIONES] ', '').trim() : '';
      setNotasSesion(textoObs);

      const ejsPure = (registro.ejercicios_registro || []).filter(
        (e) => !e.nombre.startsWith('📌')
      );

      const parsedEjercicios: EjercicioState[] = ejsPure.map((e) => {
        const nombreLimpio = e.nombre.replace(/\s*\(.*\)$/, '').trim();
        const numSeries = e.series || 1;

        // Tratar de parsear si había un resumen previo de series en el nombre
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
    }
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

  const guardarSesion = () =>
    seguro(async () => {
      setGuardando(true);
      try {
        // Actualizar cada ejercicio de registro en Supabase
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

        // Marcar la sesión de entrenamiento como completada si al menos 50% de las series se completaron
        const sesionCompletada = porcentajeProgreso >= 50;
        await actualizarEstadoRegistro(registro.id, {
          completado: sesionCompletada,
          notas: notasSesion.trim() || null,
        });

        onGuardado();
        onClose();
        Alert.alert('¡Entrenamiento Guardado!', `Se registró el progreso del día ${nombreDia(fecha)}.`);
      } finally {
        setGuardando(false);
      }
    });

  const inputStyle = {
    backgroundColor: colores.fondo,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colores.texto,
    fontSize: 13,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colores.fondo }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colores.fondo,
            paddingTop: Platform.OS === 'ios' ? 50 : 20,
            paddingHorizontal: 20,
            gap: 16,
          }}
        >
          {/* Header del Modal */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                REGISTRO DEL DÍA • {nombreDia(fecha)}
              </Text>
              <Text style={{ color: colores.texto, fontSize: 24, fontFamily: fuentes.black }} numberOfLines={1}>
                {registro.rutinas?.nombre || 'Entrenamiento del Día'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: colores.tarjeta,
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colores.borde,
              }}
            >
              <Ionicons name="close" size={22} color={colores.texto} />
            </Pressable>
          </View>

          {/* Barra de Progreso de Sesión */}
          <View
            style={{
              backgroundColor: colores.tarjeta,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colores.borde,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 13 }}>
                Series completadas: {totalSeriesCompletadas} / {totalSeriesEnSesion}
              </Text>
              <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>
                {porcentajeProgreso}%
              </Text>
            </View>

            <View style={{ height: 8, backgroundColor: colores.fondo, borderRadius: 4, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${porcentajeProgreso}%`,
                  backgroundColor: porcentajeProgreso === 100 ? colores.exito : colores.primario,
                }}
              />
            </View>
          </View>

          {/* Formulario Scrollable de Ejercicios y Series */}
          <ScrollView
            contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {ejerciciosState.map((ej, ejIdx) => (
              <View
                key={ej.id}
                style={{
                  backgroundColor: colores.tarjeta,
                  borderRadius: 18,
                  padding: 16,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colores.borde,
                }}
              >
                {/* Header del Ejercicio */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 16 }}>
                    {ejIdx + 1}. {ej.nombre}
                  </Text>
                  <View style={{ backgroundColor: colores.primarioSuave, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold }}>
                      {ej.series.length} {ej.series.length === 1 ? 'Serie' : 'Series'}
                    </Text>
                  </View>
                </View>

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

                  {ej.series.map((s, sIdx) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: s.completado ? colores.exito + '12' : 'transparent',
                        borderRadius: 10,
                        paddingVertical: 2,
                      }}
                    >
                      <View style={{ width: 28, alignItems: 'center' }}>
                        <Text style={{ color: s.completado ? colores.exito : colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>
                          #{sIdx + 1}
                        </Text>
                      </View>

                      {/* KG */}
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={s.peso}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                        style={[inputStyle, { flex: 1, textAlign: 'center' }]}
                      />

                      {/* REPS */}
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={s.reps}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                        style={[inputStyle, { flex: 1, textAlign: 'center' }]}
                      />

                      {/* RIR */}
                      <TextInput
                        placeholder="RIR"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={s.rir}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                        style={[inputStyle, { flex: 1, textAlign: 'center' }]}
                      />

                      {/* NOTA */}
                      <TextInput
                        placeholder="Sensación"
                        placeholderTextColor={colores.suave}
                        value={s.nota}
                        onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                        style={[inputStyle, { flex: 1.4, fontSize: 11 }]}
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
                  ))}
                </View>

                {/* Botón + Serie */}
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

            {/* Observaciones Generales del Día */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colores.suave, fontFamily: fuentes.bold, fontSize: 11, textTransform: 'uppercase' }}>
                Observaciones del Entrenamiento del Día
              </Text>
              <TextInput
                placeholder="Ej. Buena energía, foco en sobrecarga progresiva, molestias leves..."
                placeholderTextColor={colores.suave}
                multiline
                numberOfLines={3}
                value={notasSesion}
                onChangeText={setNotasSesion}
                style={[inputStyle, { height: 75, textAlignVertical: 'top' }]}
              />
            </View>

            {/* Botón Guardar / Finalizar */}
            <Pressable
              onPress={guardarSesion}
              disabled={guardando}
              style={({ pressed }) => ({
                backgroundColor: colores.primario,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed || guardando ? 0.85 : 1,
                shadowColor: colores.primario,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
                marginTop: 6,
              })}
            >
              <Text style={{ color: '#FFF', fontFamily: fuentes.black, fontSize: 16 }}>
                {guardando ? 'Guardando Entrenamiento...' : 'Guardar y Finalizar Entrenamiento'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
