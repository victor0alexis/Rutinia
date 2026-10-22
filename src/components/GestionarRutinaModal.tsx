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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colores, DIAS_SEMANA_ABREV, DIAS_SEMANA_NOMBRES, fuentes } from '../constants/colores';
import GlowButton from './GlowButton';
import BotonRutinia from './BotonRutinia';
import SelectorBibliotecaModal, { EjercicioSeleccionadoBiblioteca } from './SelectorBibliotecaModal';
import { obtenerGifEjercicio } from '../services/ejerciciosGifs';
import { crearRutina, eliminarRutina, actualizarRutina } from '../services/rutinas';
import { seguro, confirmarAccion, mostrarMensaje } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { listarPlanes } from '../services/planes';
import { PlanEntrenamiento, Rutina } from '../types';
import { useLayout } from '../hooks/useLayout';


type SerieInput = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
  repsParciales?: number;
  esDropset?: boolean;
};

type EjercicioInput = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieInput[];
  grupoMuscular?: string;
  equipo?: string;
  gifUrl?: string;
};

type Props = {
  visible: boolean;
  rutinaParaEditar?: Rutina | null;
  planIdInicial?: string | null;
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
  planIdInicial,
  onClose,
  onGuardado,
  onProgramarSemana,
}: Props) {
  const { isLandscape, isTablet, gutter, contentMaxWidth, bottomInset } = useLayout();
  const [nombreRutina, setNombreRutina] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [diaSugerido, setDiaSugerido] = useState<number | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<PlanEntrenamiento[]>([]);
  const [ejercicios, setEjercicios] = useState<EjercicioInput[]>([nuevoEjercicioVacio()]);
  const [notasExpandidas, setNotasExpandidas] = useState<Record<string, boolean>>({});

  // Modal selector de biblioteca de ejercicios
  const [modalBibliotecaVisible, setModalBibliotecaVisible] = useState(false);
  const [indiceEjercicioParaBiblioteca, setIndiceEjercicioParaBiblioteca] = useState<number | null>(null);

  const abrirBibliotecaParaEjercicio = (idx: number) => {
    setIndiceEjercicioParaBiblioteca(idx);
    setModalBibliotecaVisible(true);
  };

  const abrirBibliotecaNuevo = () => {
    setIndiceEjercicioParaBiblioteca(null);
    setModalBibliotecaVisible(true);
  };

  const handleSeleccionEjercicioBiblioteca = (sel: EjercicioSeleccionadoBiblioteca) => {
    if (indiceEjercicioParaBiblioteca !== null) {
      setEjercicios((prev) =>
        prev.map((ej, idx) => {
          if (idx !== indiceEjercicioParaBiblioteca) return ej;
          return {
            ...ej,
            nombre: sel.nombre,
            grupoMuscular: sel.grupoMuscular,
            equipo: sel.equipo,
            gifUrl: sel.gifUrl,
          };
        })
      );
    } else {
      setEjercicios((prev) => {
        if (prev.length === 1 && !prev[0].nombre.trim()) {
          return [
            {
              ...prev[0],
              nombre: sel.nombre,
              grupoMuscular: sel.grupoMuscular,
              equipo: sel.equipo,
              gifUrl: sel.gifUrl,
            },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(),
            nombre: sel.nombre,
            esUnilateral: false,
            series: [nuevaSerieVacia()],
            grupoMuscular: sel.grupoMuscular,
            equipo: sel.equipo,
            gifUrl: sel.gifUrl,
          },
        ];
      });
    }
  };

  const alternarNotaSerie = (sId: string) => {
    setNotasExpandidas((prev) => ({ ...prev, [sId]: !prev[sId] }));
  };

  useEffect(() => {
    if (!visible) return;
    listarPlanes({ incluirArchivados: false }).then(setPlanesDisponibles);

    const timer = setTimeout(() => {
      if (rutinaParaEditar) {
        setNombreRutina(rutinaParaEditar.nombre);
        setPlanId(rutinaParaEditar.plan_id ?? null);
        setDiaSugerido(rutinaParaEditar.dia_sugerido ?? null);
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
              repsParciales: sDetail?.repsParciales || 0,
              esDropset: Boolean(sDetail?.esDropset),
            };
          });

          const gifInfo = obtenerGifEjercicio(parsed.nombreLimpio);

          return {
            id: e.id,
            nombre: parsed.nombreLimpio,
            esUnilateral: parsed.esUnilateral,
            series: seriesArray,
            grupoMuscular: gifInfo.muscle,
            equipo: gifInfo.equipment,
            gifUrl: gifInfo.gifUrl,
          };
        });

        setEjercicios(ejsMapeados.length > 0 ? ejsMapeados : [nuevoEjercicioVacio()]);
      } else {
        setNombreRutina('');
        setPlanId(planIdInicial ?? null);
        setDiaSugerido(null);
        setEjercicios([nuevoEjercicioVacio()]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, rutinaParaEditar, planIdInicial]);


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
                  const parcialStr = s.repsParciales ? `+${s.repsParciales}p` : '';
                  const dropStr = s.esDropset ? '↓' : '';

                  const resumenBrazo = `D ${strD} | I ${strI}`.trim();
                  return `${idx + 1}ª: ${[resumenBrazo, parcialStr, dropStr, rir, n].filter(Boolean).join(' ')}`;
                } else {
                  const p = s.peso ? `${s.peso}k` : '';
                  const r = s.reps ? `${s.reps}r` : '';
                  const parcialStr = s.repsParciales ? `+${s.repsParciales}p` : '';
                  const dropStr = s.esDropset ? '↓' : '';
                  const rir = s.rir ? `RIR ${s.rir}` : '';
                  const n = s.nota ? `[${s.nota}]` : '';
                  return `${idx + 1}ª: ${[p, r, parcialStr, dropStr, rir, n].filter(Boolean).join(' ')}`;
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
        await actualizarRutina(rutinaParaEditar.id, nombreRutina.trim(), payloadEjercicios, planId, diaSugerido);
      } else {
        await crearRutina(nombreRutina.trim(), payloadEjercicios, planId, diaSugerido);
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
        <View
          style={[
            styles.sheetContainer,
            {
              maxWidth: contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingBottom: Math.max(20, bottomInset + 10),
              height: isLandscape ? '98%' : '92%',
            },
          ]}
        >
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
                inputMode="text"
                keyboardType="default"
                autoCapitalize="sentences"
                autoCorrect={false}
                returnKeyType="done"
                enterKeyHint="done"
                style={[styles.inputBase, { fontSize: 15, fontFamily: fuentes.bold }]}
              />
            </View>

            {/* Selector de Plan */}
            {planesDisponibles.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={styles.inputLabelText}>
                  Plan al que pertenece
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {/* Opción Sin Plan */}
                  <Pressable
                    onPress={() => setPlanId(null)}
                    style={[
                      styles.planChip,
                      planId === null && styles.planChipActive,
                    ]}
                  >
                    <Ionicons
                      name="folder-outline"
                      size={14}
                      color={planId === null ? colores.texto : colores.suave}
                    />
                    <Text style={[styles.planChipText, planId === null && { color: colores.texto, fontFamily: fuentes.bold }]}>
                      Sin plan
                    </Text>
                  </Pressable>

                  {/* Planes disponibles */}
                  {planesDisponibles.map((p) => {
                    const sel = planId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setPlanId(p.id)}
                        style={[
                          styles.planChip,
                          sel && {
                            borderColor: p.color,
                            backgroundColor: p.color + '22',
                          },
                        ]}
                      >
                        <View style={[styles.planDot, { backgroundColor: p.color }]} />
                        <Text style={[styles.planChipText, sel && { color: colores.texto, fontFamily: fuentes.bold }]}>
                          {p.nombre}
                        </Text>
                        {p.activo && (
                          <View style={[styles.activeMiniBadge, { backgroundColor: p.color }]}>
                            <Text style={styles.activeMiniBadgeText}>ACTIVO</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Selector de Día Sugerido */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabelText}>
                  Día sugerido en la semana
                </Text>
                {diaSugerido !== null && (
                  <Pressable onPress={() => setDiaSugerido(null)} hitSlop={6}>
                    <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold }}>
                      Quitar día fijo
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DIAS_SEMANA_ABREV.map((letra, index) => {
                  const sel = diaSugerido === index;
                  return (
                    <Pressable
                      key={letra}
                      onPress={() => setDiaSugerido(sel ? null : index)}
                      style={[
                        styles.dayChip,
                        sel && styles.dayChipActive,
                      ]}
                    >
                      <Text style={[styles.dayChipText, sel && styles.dayChipTextActive]}>
                        {letra}
                      </Text>
                      {sel && (
                        <View style={styles.dayDotIndicator} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.regular }}>
                {diaSugerido !== null
                  ? `Sugerida para cada ${DIAS_SEMANA_NOMBRES[diaSugerido]}`
                  : 'Sin día fijo (aparecerá disponible para asignar a cualquier fecha)'}
              </Text>
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

                {/* Header / Banner con GIF y metadatos si tiene nombre */}
                {ej.nombre.trim().length > 0 ? (
                  <View style={styles.exercisePreviewBanner}>
                    <View style={styles.exerciseGifContainer}>
                      <Image
                        source={{ uri: ej.gifUrl || obtenerGifEjercicio(ej.nombre).gifUrl }}
                        style={styles.exerciseGifPreview}
                        contentFit="contain"
                        cachePolicy="disk"
                        autoplay
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <TextInput
                        placeholder="Nombre del Ejercicio"
                        placeholderTextColor={colores.suave}
                        value={ej.nombre}
                        onChangeText={(val) => cambiarNombreEjercicio(ejIdx, val)}
                        inputMode="text"
                        keyboardType="default"
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="done"
                        enterKeyHint="done"
                        style={[styles.inputBase, { fontSize: 13, paddingVertical: 5, paddingHorizontal: 8 }]}
                      />

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={styles.bannerTagMusculo}>
                          <Text style={styles.bannerTagMusculoText}>
                            {(ej.grupoMuscular || obtenerGifEjercicio(ej.nombre).muscle || 'Cuerpo').toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.bannerTagEquipo}>
                          <Text style={styles.bannerTagEquipoText}>
                            {(ej.equipo || obtenerGifEjercicio(ej.nombre).equipment || 'Libre').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => abrirBibliotecaParaEjercicio(ejIdx)}
                      style={styles.btnCambiarEjercicio}
                      hitSlop={6}
                    >
                      <Ionicons name="swap-horizontal" size={13} color={colores.primarioHover} />
                      <Text style={styles.btnCambiarEjercicioText}>Cambiar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => abrirBibliotecaParaEjercicio(ejIdx)}
                      style={styles.btnAbrirBibliotecaCard}
                    >
                      <View style={styles.iconBoxBiblioteca}>
                        <Ionicons name="barbell" size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.btnAbrirBibliotecaTitle}>
                          Seleccionar de la Biblioteca
                        </Text>
                        <Text style={styles.btnAbrirBibliotecaSub}>
                          1.300+ ejercicios con técnica y animaciones GIF
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colores.suave} />
                    </Pressable>

                    <TextInput
                      placeholder="O escribe un nombre manual..."
                      placeholderTextColor={colores.suave}
                      value={ej.nombre}
                      onChangeText={(val) => cambiarNombreEjercicio(ejIdx, val)}
                      inputMode="text"
                      keyboardType="default"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      enterKeyHint="done"
                      style={[styles.inputBase, { fontSize: 13 }]}
                    />
                  </View>
                )}

                {/* Tabla de Series (Bilateral vs Unilateral D/I) */}
                {ej.esUnilateral ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 }}>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 24, textAlign: 'center' }}>ST</Text>
                      <Text style={{ color: colores.exito, fontSize: 10, fontFamily: fuentes.bold, flex: 2, minWidth: 0, textAlign: 'center' }}>DERECHO (D)</Text>
                      <Text style={{ color: colores.hoy, fontSize: 10, fontFamily: fuentes.bold, flex: 2, minWidth: 0, textAlign: 'center' }}>IZQUIERDO (I)</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, minWidth: 0, textAlign: 'center' }}>RIR</Text>
                      <View style={{ width: 24 }} />
                    </View>

                    {ej.series.map((s, sIdx) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 24, alignItems: 'center' }}>
                          <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 11 }}>#{sIdx + 1}</Text>
                        </View>

                        {/* DERECHO (D) */}
                        <View style={{ flex: 2, minWidth: 0, flexDirection: 'row', gap: 2 }}>
                          <TextInput
                            placeholder="KG D"
                            placeholderTextColor={colores.suave}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            returnKeyType="next"
                            enterKeyHint="next"
                            autoCorrect={false}
                            selectTextOnFocus
                            value={s.peso}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                            style={[styles.inputBase, styles.colInput, { flex: 1, paddingHorizontal: 2, fontSize: 11 }]}
                          />
                          <TextInput
                            placeholder="REPS D"
                            placeholderTextColor={colores.suave}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            returnKeyType="next"
                            enterKeyHint="next"
                            autoCorrect={false}
                            selectTextOnFocus
                            value={s.reps}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                            style={[styles.inputBase, styles.colInput, { flex: 1, paddingHorizontal: 2, fontSize: 11 }]}
                          />
                        </View>

                        {/* IZQUIERDO (I) */}
                        <View style={{ flex: 2, minWidth: 0, flexDirection: 'row', gap: 2 }}>
                          <TextInput
                            placeholder="KG I"
                            placeholderTextColor={colores.suave}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            returnKeyType="next"
                            enterKeyHint="next"
                            autoCorrect={false}
                            selectTextOnFocus
                            value={s.pesoI !== undefined ? s.pesoI : s.peso}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'pesoI', val)}
                            style={[styles.inputBase, styles.colInput, { flex: 1, paddingHorizontal: 2, fontSize: 11 }]}
                          />
                          <TextInput
                            placeholder="REPS I"
                            placeholderTextColor={colores.suave}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            returnKeyType="next"
                            enterKeyHint="next"
                            autoCorrect={false}
                            selectTextOnFocus
                            value={s.repsI !== undefined ? s.repsI : s.reps}
                            onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'repsI', val)}
                            style={[styles.inputBase, styles.colInput, { flex: 1, paddingHorizontal: 2, fontSize: 11 }]}
                          />
                        </View>

                        <TextInput
                          placeholder="RIR"
                          placeholderTextColor={colores.suave}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          maxLength={2}
                          returnKeyType="next"
                          enterKeyHint="next"
                          autoCorrect={false}
                          selectTextOnFocus
                          value={s.rir}
                          onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                          style={[styles.inputBase, styles.colInput, { flex: 1, paddingHorizontal: 2, fontSize: 11 }]}
                        />

                        <Pressable
                          onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                          disabled={ej.series.length === 1}
                          style={{ width: 24, alignItems: 'center', opacity: ej.series.length === 1 ? 0.3 : 1 }}
                          hitSlop={6}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={colores.suave} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, width: 28, textAlign: 'center' }}>ST</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1.2, minWidth: 0, textAlign: 'center' }}>KG</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1.2, minWidth: 0, textAlign: 'center' }}>REPS</Text>
                      <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1, minWidth: 0, textAlign: 'center' }}>RIR</Text>
                      {isLandscape || isTablet ? (
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, flex: 1.5, minWidth: 0, textAlign: 'center' }}>NOTAS</Text>
                      ) : (
                        <View style={{ width: 34 }} />
                      )}
                      <View style={{ width: 26 }} />
                    </View>

                    {ej.series.map((s, sIdx) => {
                      const tieneNota = Boolean(s.nota && s.nota.trim());
                      const notaAbierta = Boolean(notasExpandidas[s.id] || tieneNota);

                      return (
                        <View key={s.id} style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 28, alignItems: 'center' }}>
                              <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>#{sIdx + 1}</Text>
                            </View>

                            <TextInput
                              placeholder="100"
                              placeholderTextColor={colores.suave}
                              keyboardType="decimal-pad"
                              inputMode="decimal"
                              returnKeyType="next"
                              enterKeyHint="next"
                              autoCorrect={false}
                              selectTextOnFocus
                              value={s.peso}
                              onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'peso', val)}
                              style={[styles.inputBase, styles.colInput, { flex: 1.2 }]}
                            />

                            <TextInput
                              placeholder="10"
                              placeholderTextColor={colores.suave}
                              keyboardType="number-pad"
                              inputMode="numeric"
                              returnKeyType="next"
                              enterKeyHint="next"
                              autoCorrect={false}
                              selectTextOnFocus
                              value={s.reps}
                              onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'reps', val)}
                              style={[styles.inputBase, styles.colInput, { flex: 1.2 }]}
                            />

                            <TextInput
                              placeholder="2"
                              placeholderTextColor={colores.suave}
                              keyboardType="number-pad"
                              inputMode="numeric"
                              maxLength={2}
                              returnKeyType="next"
                              enterKeyHint="next"
                              autoCorrect={false}
                              selectTextOnFocus
                              value={s.rir}
                              onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'rir', val)}
                              style={[styles.inputBase, styles.colInput, { flex: 1 }]}
                            />

                            {isLandscape || isTablet ? (
                              <TextInput
                                placeholder="Fallo/Técnica"
                                placeholderTextColor={colores.suave}
                                inputMode="text"
                                keyboardType="default"
                                autoCapitalize="sentences"
                                returnKeyType="done"
                                enterKeyHint="done"
                                value={s.nota}
                                onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                style={[styles.inputBase, styles.colInput, { flex: 1.5, textAlign: 'left', paddingHorizontal: 8, fontSize: 12 }]}
                              />
                            ) : (
                              <Pressable
                                onPress={() => alternarNotaSerie(s.id)}
                                hitSlop={6}
                                style={{
                                  width: 34,
                                  height: 40,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: tieneNota ? 'rgba(217, 119, 6, 0.20)' : 'rgba(255, 255, 255, 0.05)',
                                  borderWidth: 1,
                                  borderColor: tieneNota ? colores.hoy : 'rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                <Ionicons
                                  name={tieneNota ? 'document-text' : 'document-text-outline'}
                                  size={16}
                                  color={tieneNota ? colores.hoy : colores.suave}
                                />
                              </Pressable>
                            )}

                            <Pressable
                              onPress={() => quitarSerieDeEjercicio(ejIdx, sIdx)}
                              disabled={ej.series.length === 1}
                              style={{ width: 26, alignItems: 'center', opacity: ej.series.length === 1 ? 0.3 : 1 }}
                              hitSlop={6}
                            >
                              <Ionicons name="close-circle-outline" size={20} color={colores.suave} />
                            </Pressable>
                          </View>

                          {/* Sub-fila de nota expandible en Portrait */}
                          {!isLandscape && !isTablet && notaAbierta && (
                            <View style={{ paddingLeft: 34, paddingRight: 32 }}>
                              <TextInput
                                placeholder="Nota de la serie (ej. Fallo -2, drop set, técnica...)"
                                placeholderTextColor={colores.suave}
                                inputMode="text"
                                keyboardType="default"
                                autoCapitalize="sentences"
                                returnKeyType="done"
                                enterKeyHint="done"
                                value={s.nota}
                                onChangeText={(val) => cambiarCampoSerie(ejIdx, sIdx, 'nota', val)}
                                style={[
                                  styles.inputBase,
                                  {
                                    fontSize: 12,
                                    minHeight: 36,
                                    paddingHorizontal: 8,
                                    borderColor: tieneNota ? 'rgba(217, 119, 6, 0.4)' : colores.borde,
                                  },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                      );
                    })}
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

            {/* Botones para Añadir Ejercicios */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={abrirBibliotecaNuevo}
                style={({ pressed }) => [
                  styles.addFromLibraryButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={styles.libraryButtonIconBox}>
                  <Ionicons name="barbell" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addFromLibraryButtonText}>+ Añadir desde Biblioteca</Text>
                  <Text style={styles.addFromLibrarySubtext}>Explorar por músculo con GIFs oscuros</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>

              <Pressable
                onPress={agregarEjercicio}
                style={({ pressed }) => [
                  styles.addCustomButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="create-outline" size={15} color={colores.suave} />
                <Text style={styles.addCustomButtonText}>+ Añadir ejercicio manual</Text>
              </Pressable>
            </View>

            {/* Botón Guardar / Actualizar */}
            <BotonRutinia
              titulo={rutinaParaEditar ? 'Guardar Cambios' : 'Guardar rutina'}
              onPress={guardar}
              style={{ alignSelf: 'stretch', marginTop: 6 }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de Exploración y Selección de la Biblioteca de Ejercicios */}
      <SelectorBibliotecaModal
        visible={modalBibliotecaVisible}
        onClose={() => setModalBibliotecaVisible(false)}
        onSeleccionar={handleSeleccionEjercicioBiblioteca}
      />
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
  colInput: {
    minWidth: 0,
    minHeight: 40,
    textAlign: 'center',
    paddingHorizontal: 4,
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
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
  },
  planChipActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planChipText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  activeMiniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeMiniBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  dayChip: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: colores.primarioHover,
    backgroundColor: colores.primarioSuave,
  },
  dayChipText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  dayChipTextActive: {
    color: '#FFF',
    fontFamily: fuentes.black,
  },
  dayDotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.primarioHover,
    marginTop: 2,
  },
  // Estilos de Integración de Biblioteca
  exercisePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 8,
    gap: 10,
  },
  exerciseGifContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#06070B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseGifPreview: {
    width: '100%',
    height: '100%',
  },
  bannerTagMusculo: {
    backgroundColor: 'rgba(158, 28, 48, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(158, 28, 48, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bannerTagMusculoText: {
    color: colores.primarioHover,
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  bannerTagEquipo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bannerTagEquipoText: {
    color: colores.suave,
    fontSize: 9,
    fontFamily: fuentes.medium,
  },
  btnCambiarEjercicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(158, 28, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(158, 28, 48, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnCambiarEjercicioText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  btnAbrirBibliotecaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(158, 28, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(158, 28, 48, 0.35)',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  iconBoxBiblioteca: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAbrirBibliotecaTitle: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  btnAbrirBibliotecaSub: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  addFromLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#821425',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  libraryButtonIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFromLibraryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  addFromLibrarySubtext: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: fuentes.regular,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    paddingVertical: 10,
  },
  addCustomButtonText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
});

