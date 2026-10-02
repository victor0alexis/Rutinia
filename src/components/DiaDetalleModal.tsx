import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colores, fuentes } from '../constants/colores';
import { NotaEstandar, obtenerNotasEstandar } from '../services/notas';
import {
  agregarActividad,
  agregarRutinaAFechas,
  alternarEjercicio,
  eliminarEjercicio,
  eliminarRegistroRutina,
  guardarNotaDelDia,
} from '../services/registros';
import { listarRutinas } from '../services/rutinas';
import { EjercicioRegistro, EjercicioRutina, Registro, Rutina } from '../types';
import { seguro } from '../utils/errores';
import { aISO, nombreDia } from '../utils/fechas';

type Props = {
  fecha: Date | null;
  registros: Registro[];
  visible: boolean;
  onClose: () => void;
  alCambiar: () => void;
};

const PALETA_NOTAS = [
  { border: '#6366F1', bg: 'rgba(99,102,241,0.10)' },
  { border: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  { border: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  { border: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
  { border: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  { border: '#A855F7', bg: 'rgba(168,85,247,0.10)' },
  { border: '#14B8A6', bg: 'rgba(20,184,166,0.10)' },
];

const num = (t: string) => (t.trim() ? Number(t) : null);

// Helper para parsear la nota e identificador visual inteligente
export function parsearNotaInteligente(rawText: string) {
  let textoLimpio = rawText.replace('📌 ', '').trim();
  let categoria = 'General';
  let titulo = 'Nota del Día';
  let cuerpo = textoLimpio;

  const matchCat = textoLimpio.match(/^\[(.*?)\]\s*/);
  if (matchCat) {
    categoria = matchCat[1];
    textoLimpio = textoLimpio.replace(matchCat[0], '');
  }

  const partes = textoLimpio.split(/:\s*(.+)/);
  if (partes.length > 1) {
    titulo = partes[0];
    cuerpo = partes[1];
  } else {
    titulo = textoLimpio;
    cuerpo = '';
  }

  // Estilos e Iconos por Categoría
  let colorBadge = colores.hoy;
  let bgBadge = colores.hoy + '20';
  let iconName: keyof typeof Ionicons.glyphMap = 'document-text-outline';

  const catUpper = categoria.toUpperCase();
  if (catUpper.includes('NUTRICI')) {
    colorBadge = '#10B981';
    bgBadge = 'rgba(16, 185, 129, 0.18)';
    iconName = 'nutrition-outline';
  } else if (catUpper.includes('ENTRENA')) {
    colorBadge = colores.primarioHover;
    bgBadge = colores.primarioSuave;
    iconName = 'fitness-outline';
  } else if (catUpper.includes('SUPLE')) {
    colorBadge = '#A855F7';
    bgBadge = 'rgba(168, 85, 247, 0.18)';
    iconName = 'medical-outline';
  } else if (catUpper.includes('RECUPERA')) {
    colorBadge = '#3B82F6';
    bgBadge = 'rgba(59, 130, 246, 0.18)';
    iconName = 'pulse-outline';
  }

  return { categoria, titulo, cuerpo, colorBadge, bgBadge, iconName };
}

export default function DiaDetalleModal({ fecha, registros, visible, onClose, alCambiar }: Props) {
  const [tab, setTab] = useState<'actividad' | 'rutina' | 'notas'>('actividad');

  // Form Actividad / Ejercicio Rápido
  const [nombreActividad, setNombreActividad] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [peso, setPeso] = useState('');

  // Rutinas disponibles
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [rutinaExpandida, setRutinaExpandida] = useState<string | null>(null);

  // Notas estandarizadas y notas ad-hoc
  const [notasBiblioteca, setNotasBiblioteca] = useState<NotaEstandar[]>([]);
  const [nuevaNotaAdHoc, setNuevaNotaAdHoc] = useState('');

  useEffect(() => {
    if (visible) {
      seguro(async () => {
        const ruts = await listarRutinas();
        setRutinas(ruts);
        const nats = await obtenerNotasEstandar();
        setNotasBiblioteca(nats);
      });
    }
  }, [visible]);

  if (!fecha) return null;

  const esHoy = aISO(fecha) === aISO(new Date());

  // Extraer todos los ejercicios del día
  const todosEjercicios: EjercicioRegistro[] = registros.flatMap((r) => r.ejercicios_registro || []);

  // Separar 1. NOTAS y 2. RUTINAS
  const notasDelDia = todosEjercicios.filter((e) => e.nombre.startsWith('📌'));
  const ejerciciosPure = todosEjercicios.filter((e) => !e.nombre.startsWith('📌'));

  const guardarActividadIndependiente = () =>
    seguro(async () => {
      if (!nombreActividad.trim()) return;
      await agregarActividad(aISO(fecha), nombreActividad.trim(), num(series), num(reps), num(peso));
      setNombreActividad('');
      setSeries('');
      setReps('');
      setPeso('');
      alCambiar();
      setTab('actividad');
      Alert.alert('Ejercicio añadido', `"${nombreActividad.trim()}" se agregó a la Actividad del Día.`);
    });

  const alternar = (e: EjercicioRegistro) =>
    seguro(async () => {
      await alternarEjercicio(e.id, !e.completado);
      alCambiar();
    });

  const quitarEjercicioSolo = (e: EjercicioRegistro) =>
    seguro(async () => {
      await eliminarEjercicio(e.id);
      alCambiar();
    });

  const desvincularRutinaCompleta = (r: Registro) => {
    Alert.alert(
      'Desvincular Rutina',
      `¿Deseas desvincular la rutina "${r.rutinas?.nombre || 'de este día'}" del ${nombreDia(fecha)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: () =>
            seguro(async () => {
              await eliminarRegistroRutina(r.id);
              alCambiar();
            }),
        },
      ]
    );
  };

  const vincularRutinaEntera = (rutina: Rutina) =>
    seguro(async () => {
      await agregarRutinaAFechas(rutina, [aISO(fecha)]);
      alCambiar();
      setTab('actividad');
      Alert.alert('Éxito', `Rutina "${rutina.nombre}" agregada a tu día.`);
    });

  const vincularEjercicioIndividual = (ejercicio: EjercicioRutina) =>
    seguro(async () => {
      await agregarActividad(aISO(fecha), ejercicio.nombre, ejercicio.series, ejercicio.repeticiones, ejercicio.peso);
      alCambiar();
      setTab('actividad');
      Alert.alert('Agregado', `Ejercicio "${ejercicio.nombre}" añadido al día.`);
    });

  const vincularNotaEstandar = (n: NotaEstandar) =>
    seguro(async () => {
      const textoFormateado = `[${n.categoria.toUpperCase()}] ${n.titulo}: ${n.contenido}`;
      await guardarNotaDelDia(aISO(fecha), textoFormateado);
      alCambiar();
      setTab('actividad');
      Alert.alert('Nota añadida', `Nota "${n.titulo}" vinculada al ${nombreDia(fecha)}.`);
    });

  const guardarNotaSubmit = () =>
    seguro(async () => {
      if (!nuevaNotaAdHoc.trim()) return;
      await guardarNotaDelDia(aISO(fecha), nuevaNotaAdHoc.trim());
      setNuevaNotaAdHoc('');
      alCambiar();
      setTab('actividad');
      Alert.alert('Nota guardada', 'Tu nota ha quedado registrada en la Actividad del Día.');
    });

  const inputStyle = {
    backgroundColor: colores.fondo,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colores.texto,
    fontSize: 15,
  };

  const subInputStyle = {
    backgroundColor: colores.fondo,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    color: colores.texto,
    fontSize: 13,
    textAlign: 'center' as const,
    flex: 1,
    minWidth: 0,
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
          {/* Header Pantalla Completa */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <View>
              <Text style={{ color: colores.primarioHover, textTransform: 'uppercase', fontSize: 11, fontFamily: fuentes?.bold || 'System', letterSpacing: 1.2 }}>
                {esHoy ? '🔥 HOY - DETALLE COMPLETO' : 'FECHA PROGRAMADA'}
              </Text>
              <Text style={{ color: colores.texto, fontSize: 26, fontFamily: fuentes?.black || 'System', textTransform: 'capitalize', marginTop: 2 }}>
                {nombreDia(fecha)}
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

          {/* Tabs Selector */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colores.fondo,
              borderRadius: 14,
              padding: 4,
              borderWidth: 1,
              borderColor: colores.borde,
            }}
          >
            {[
              { id: 'actividad', label: 'Actividad', icon: 'flash-outline' },
              { id: 'rutina', label: '+ Rutina', icon: 'barbell-outline' },
              { id: 'notas', label: 'Notas', icon: 'create-outline' },
            ].map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id as any)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: active ? colores.tarjeta : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? colores.borde : 'transparent',
                  }}
                >
                  <Ionicons name={item.icon as any} size={16} color={active ? colores.primarioHover : colores.suave} />
                  <Text style={{ color: active ? colores.texto : colores.suave, fontWeight: active ? '800' : '600', fontSize: 11 }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Contenido Dinámico con Scroll e integración con teclado */}
          <ScrollView
            contentContainerStyle={{ gap: 18, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* PANEL 1: Actividad del Día */}
            {tab === 'actividad' && (
              <View style={{ gap: 22 }}>

                {/* ────── SECCIÓN: NOTAS DEL DÍA ────── */}
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(16,185,129,0.30)' }} />
                    <Pressable
                      onPress={() => setTab('notas')}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        backgroundColor: 'rgba(16,185,129,0.11)',
                        paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: 20, borderWidth: 1,
                        borderColor: 'rgba(16,185,129,0.35)',
                      }}
                    >
                      <Ionicons name="document-text-outline" size={13} color="#10B981" />
                      <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Notas{notasDelDia.length > 0 ? `  ·  ${notasDelDia.length}` : ''}
                      </Text>
                      <Text style={{ color: 'rgba(16,185,129,0.65)', fontSize: 11, fontWeight: '700' }}>+ Añadir</Text>
                    </Pressable>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(16,185,129,0.30)' }} />
                  </View>

                  {notasDelDia.length === 0 ? (
                    <View style={{ backgroundColor: colores.tarjeta, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colores.borde, borderStyle: 'dashed', alignItems: 'center' }}>
                      <Text style={{ color: colores.suave, fontStyle: 'italic', fontSize: 13 }}>Sin notas registradas para este día.</Text>
                    </View>
                  ) : (
                    notasDelDia.map((n, idx) => {
                      const { categoria, titulo, cuerpo, iconName } = parsearNotaInteligente(n.nombre);
                      const pal = PALETA_NOTAS[idx % PALETA_NOTAS.length];
                      return (
                        <View
                          key={n.id}
                          style={{
                            backgroundColor: pal.bg,
                            borderRadius: 16,
                            padding: 16,
                            gap: 10,
                            borderWidth: 1,
                            borderColor: pal.border + '45',
                            borderLeftWidth: 3,
                            borderLeftColor: pal.border,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                              <View style={{
                                width: 34, height: 34, borderRadius: 10,
                                backgroundColor: pal.border + '20',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: pal.border + '40',
                              }}>
                                <Ionicons name={iconName} size={16} color={pal.border} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: pal.border, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                                  {categoria}
                                </Text>
                                <Text style={{ color: colores.texto, fontSize: 15, fontWeight: '800', marginTop: 1 }} numberOfLines={2}>
                                  {titulo}
                                </Text>
                              </View>
                            </View>
                            <Pressable
                              onPress={() => quitarEjercicioSolo(n)}
                              hitSlop={12}
                              style={{ backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 8, padding: 6 }}
                            >
                              <Ionicons name="trash-outline" size={16} color={colores.peligro} />
                            </Pressable>
                          </View>
                          {cuerpo ? (
                            <Text style={{ color: colores.suave, fontSize: 13, lineHeight: 20, paddingLeft: 44 }}>
                              {cuerpo}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>

                {/* ────── SECCIÓN: ENTRENAMIENTOS DEL DÍA ────── */}
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colores.primario + '60' }} />
                    <Pressable
                      onPress={() => setTab('rutina')}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        backgroundColor: colores.primarioSuave,
                        paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: 20, borderWidth: 1,
                        borderColor: colores.primarioGlow,
                      }}
                    >
                      <Ionicons name="barbell-outline" size={13} color={colores.primarioHover} />
                      <Text style={{ color: colores.primarioHover, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Entrenamientos{ejerciciosPure.length > 0 ? `  ·  ${ejerciciosPure.length}` : ''}
                      </Text>
                      <Text style={{ color: colores.primarioHover + 'AA', fontSize: 11, fontWeight: '700' }}>+ Añadir</Text>
                    </Pressable>
                    <View style={{ flex: 1, height: 1, backgroundColor: colores.primario + '60' }} />
                  </View>

                  {registros.length === 0 && ejerciciosPure.length === 0 ? (
                    <View style={{ backgroundColor: colores.tarjeta, padding: 20, borderRadius: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colores.borde, borderStyle: 'dashed' }}>
                      <Ionicons name="fitness-outline" size={30} color={colores.suave} />
                      <Text style={{ color: colores.suave, fontStyle: 'italic', fontSize: 13 }}>No hay rutinas ni ejercicios asignados a este día.</Text>
                    </View>
                  ) : (
                    registros.map((r) => {
                      const ejsEntrenamiento = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
                      const tieneRutina = Boolean(r.rutina_id || r.rutinas?.nombre);
                      if (!tieneRutina && ejsEntrenamiento.length === 0) return null;

                      const nombreMostrar = r.rutinas?.nombre || 'Rutina Vinculada';

                      return (
                        <View
                          key={r.id}
                          style={{
                            backgroundColor: colores.tarjeta,
                            borderRadius: 16,
                            padding: 16,
                            gap: 12,
                            borderWidth: 1,
                            borderColor: colores.borde,
                          }}
                        >
                          {tieneRutina ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colores.borde, paddingBottom: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{
                                  width: 34, height: 34, borderRadius: 10,
                                  backgroundColor: colores.primarioSuave,
                                  alignItems: 'center', justifyContent: 'center',
                                  borderWidth: 1, borderColor: colores.primarioGlow,
                                }}>
                                  <Ionicons name="barbell-outline" size={16} color={colores.primarioHover} />
                                </View>
                                <Text style={{ color: colores.primarioHover, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
                                  {nombreMostrar}
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => desvincularRutinaCompleta(r)}
                                style={{
                                  backgroundColor: colores.peligro + '18',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: colores.peligro + '35',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Ionicons name="trash-outline" size={13} color={colores.peligro} />
                                <Text style={{ color: colores.peligro, fontWeight: '700', fontSize: 11 }}>Desvincular</Text>
                              </Pressable>
                            </View>
                          ) : null}

                          {ejsEntrenamiento.map((e) => (
                            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                              <Pressable onPress={() => alternar(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <Ionicons
                                  name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={24}
                                  color={e.completado ? colores.exito : colores.suave}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: e.completado ? colores.suave : colores.texto,
                                      fontSize: 15,
                                      fontWeight: '700',
                                      textDecorationLine: e.completado ? 'line-through' : 'none',
                                    }}
                                  >
                                    {e.nombre}
                                  </Text>
                                  {(e.series || e.repeticiones || e.peso) && (
                                    <Text style={{ color: colores.suave, fontSize: 12, marginTop: 2 }}>
                                      {[e.series && e.repeticiones ? `${e.series} series × ${e.repeticiones} reps` : null, e.peso ? `${e.peso} kg` : null]
                                        .filter(Boolean)
                                        .join('  •  ')}
                                    </Text>
                                  )}
                                </View>
                              </Pressable>
                              <Pressable onPress={() => quitarEjercicioSolo(e)} hitSlop={10} style={{ padding: 6 }}>
                                <Ionicons name="close-circle-outline" size={20} color={colores.suave} />
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {/* PANEL 2: + Rutina / Ejercicio */}
            {tab === 'rutina' && (
              <View style={{ gap: 16 }}>
                <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Añadir Ejercicio Rápido al Día
                </Text>
                <View style={{ backgroundColor: colores.tarjeta, padding: 16, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: colores.borde }}>
                  <TextInput
                    placeholder="Nombre del ejercicio (ej. Sentadillas)"
                    placeholderTextColor={colores.suave}
                    value={nombreActividad}
                    onChangeText={setNombreActividad}
                    style={inputStyle}
                  />
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      placeholder="Series"
                      placeholderTextColor={colores.suave}
                      keyboardType="numeric"
                      value={series}
                      onChangeText={setSeries}
                      style={subInputStyle}
                    />
                    <TextInput
                      placeholder="Reps"
                      placeholderTextColor={colores.suave}
                      keyboardType="numeric"
                      value={reps}
                      onChangeText={setReps}
                      style={subInputStyle}
                    />
                    <TextInput
                      placeholder="Kg"
                      placeholderTextColor={colores.suave}
                      keyboardType="numeric"
                      value={peso}
                      onChangeText={setPeso}
                      style={subInputStyle}
                    />
                  </View>
                  <Pressable
                    onPress={guardarActividadIndependiente}
                    style={{
                      backgroundColor: colores.primario,
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>+ Guardar Ejercicio en el Día</Text>
                  </Pressable>
                </View>

                <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 }}>
                  Vincular Rutinas Preexistentes
                </Text>

                {rutinas.length === 0 ? (
                  <Text style={{ color: colores.suave, fontStyle: 'italic' }}>No tienes rutinas creadas aún. Dirígete a la pestaña 'Rutinas'.</Text>
                ) : (
                  rutinas.map((rut) => {
                    const estaExpandida = rutinaExpandida === rut.id;
                    return (
                      <View
                        key={rut.id}
                        style={{
                          backgroundColor: colores.tarjeta,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: colores.borde,
                          overflow: 'hidden',
                        }}
                      >
                        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Pressable onPress={() => setRutinaExpandida(estaExpandida ? null : rut.id)} style={{ flex: 1 }}>
                            <Text style={{ color: colores.texto, fontSize: 17, fontWeight: '800' }}>{rut.nombre}</Text>
                            <Text style={{ color: colores.suave, fontSize: 12, marginTop: 2 }}>
                              {rut.ejercicios_rutina?.length || 0} ejercicios • Toca para desplegar
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => vincularRutinaEntera(rut)}
                            style={{
                              backgroundColor: colores.primario,
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>+ Toda la Rutina</Text>
                          </Pressable>
                        </View>

                        {estaExpandida && (
                          <View style={{ borderTopWidth: 1, borderTopColor: colores.borde, backgroundColor: colores.fondo, padding: 14, gap: 10 }}>
                            <Text style={{ color: colores.suave, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                              Seleccionar ejercicio individual:
                            </Text>
                            {rut.ejercicios_rutina.map((ej) => (
                              <View key={ej.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colores.texto, fontSize: 14, fontWeight: '600' }}>{ej.nombre}</Text>
                                  <Text style={{ color: colores.suave, fontSize: 11 }}>
                                    {ej.series && ej.repeticiones ? `${ej.series}×${ej.repeticiones}` : ''} {ej.peso ? `• ${ej.peso}kg` : ''}
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => vincularEjercicioIndividual(ej)}
                                  style={{
                                    backgroundColor: colores.tarjeta,
                                    borderWidth: 1,
                                    borderColor: colores.primarioHover,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 8,
                                  }}
                                >
                                  <Text style={{ color: colores.primarioHover, fontWeight: '700', fontSize: 12 }}>+ Añadir solo este</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* PANEL 3: Notas */}
            {tab === 'notas' && (
              <View style={{ gap: 16 }}>
                <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Elegir de la Biblioteca de Notas
                </Text>

                {notasBiblioteca.length === 0 ? (
                  <Text style={{ color: colores.suave, fontStyle: 'italic', fontSize: 13 }}>
                    No tienes notas estandarizadas. Crea plantillas en la pestaña 'Notas'.
                  </Text>
                ) : (
                  notasBiblioteca.map((n) => (
                    <View
                      key={n.id}
                      style={{
                        backgroundColor: colores.tarjeta,
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: colores.borde,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ backgroundColor: colores.primarioSuave, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: colores.primarioHover, fontSize: 10, fontWeight: '800' }}>{n.categoria}</Text>
                        </View>
                        <Text style={{ color: colores.texto, fontSize: 15, fontWeight: '800' }}>{n.titulo}</Text>
                        <Text numberOfLines={2} style={{ color: colores.suave, fontSize: 12 }}>
                          {n.contenido}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => vincularNotaEstandar(n)}
                        style={{
                          backgroundColor: colores.primario,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>+ Añadir al Día</Text>
                      </Pressable>
                    </View>
                  ))
                )}

                <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 }}>
                  O redactar Nota Ad-hoc para este día
                </Text>
                <View style={{ backgroundColor: colores.tarjeta, padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: colores.borde }}>
                  <TextInput
                    placeholder="Escribe anotaciones rápidas exclusivas para esta fecha..."
                    placeholderTextColor={colores.suave}
                    multiline
                    numberOfLines={4}
                    value={nuevaNotaAdHoc}
                    onChangeText={setNuevaNotaAdHoc}
                    style={[inputStyle, { height: 90, textAlignVertical: 'top' }]}
                  />
                  <Pressable
                    onPress={guardarNotaSubmit}
                    style={{
                      backgroundColor: colores.primarioHover,
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Guardar Nota Ad-hoc</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
