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
  StyleSheet,
} from 'react-native';
import { colores, fuentes } from '../constants/colores';
import BotonRutinia from './BotonRutinia';
import ScreenBackground from './ScreenBackground';
import GlowButton from './GlowButton';
import SpotlightSegmentedTabs from './SpotlightSegmentedTabs';
import RutinaLiveCard from './RutinaLiveCard';
import { vibrarBoton } from '../utils/haptics';
import { NotaEstandar, obtenerNotasEstandar } from '../services/notas';
import {
  agregarActividad,
  agregarRutinaAFechas,
  eliminarEjercicio,
  eliminarRegistroRutina,
  guardarNotaDelDia,
} from '../services/registros';
import { listarRutinas } from '../services/rutinas';
import { EjercicioRegistro, EjercicioRutina, PlanEntrenamiento, Registro, Rutina } from '../types';
import { SesionActivaInfo } from '../utils/sesionActiva';
import { seguro, confirmarAccion } from '../utils/errores';
import { aISO, nombreDia } from '../utils/fechas';
import { useLayout } from '../hooks/useLayout';
import SelectorPlanRutina from './SelectorPlanRutina';

type Props = {
  fecha: Date | null;
  registros: Registro[];
  visible: boolean;
  onClose: () => void;
  alCambiar: () => void;
  sesionActivaInfo?: SesionActivaInfo | null;
  onIniciarRutina?: (r: Registro) => void;
  onReanudarRutina?: (r: Registro) => void;
  onVerResumenRutina?: (r: Registro) => void;
};

const PALETA_NOTAS = [
  { border: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { border: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  { border: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { border: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  { border: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  { border: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
  { border: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
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
  let bgBadge = 'rgba(217, 119, 6, 0.20)';
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

export default function DiaDetalleModal({
  fecha,
  registros,
  visible,
  onClose,
  alCambiar,
  sesionActivaInfo,
  onIniciarRutina,
  onReanudarRutina,
  onVerResumenRutina,
}: Props) {
  const { topInset, bottomInset, leftInset, rightInset, gutter, contentMaxWidth } = useLayout();
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
  const [selectorPlanRutinaVisible, setSelectorPlanRutinaVisible] = useState(false);

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

  // Extraer todos los ejercicios del día
  const todosEjercicios: EjercicioRegistro[] = registros.flatMap((r) => r.ejercicios_registro || []);

  // 1. NOTAS
  const notasDelDia = todosEjercicios.filter((e) => e.nombre.startsWith('📌'));
  const ejerciciosPure = todosEjercicios.filter((e) => !e.nombre.startsWith('📌'));

  // 2. RUTINAS CON REGISTRO ASIGNADO
  const registrosConRutina = registros.filter((r) => Boolean(r.rutina_id || r.rutinas?.nombre));

  // 3. EJERCICIOS EXTRAS SUELTOS (sin rutina)
  const registrosExtraSueltos = registros.filter((r) => !r.rutina_id && !r.rutinas?.nombre);
  const ejerciciosExtras = registrosExtraSueltos
    .flatMap((r) => r.ejercicios_registro || [])
    .filter((e) => !e.nombre.startsWith('📌'));

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

  const quitarEjercicioSolo = (e: EjercicioRegistro) =>
    seguro(async () => {
      await eliminarEjercicio(e.id);
      alCambiar();
    });

  const desvincularRutinaCompleta = (r: Registro) => {
    confirmarAccion(
      'Desvincular Rutina',
      `¿Deseas desvincular la rutina "${r.rutinas?.nombre || 'de este día'}" del ${nombreDia(fecha)}?`,
      async () => {
        await eliminarRegistroRutina(r.id);
        alCambiar();
      },
      'Desvincular'
    );
  };

  const vincularRutinaEntera = (rutina: Rutina, plan?: PlanEntrenamiento | null) =>
    seguro(async () => {
      await agregarRutinaAFechas(rutina, [aISO(fecha)], {
        planId: plan?.id ?? rutina.plan_id ?? null,
        planNombre: plan?.nombre ?? rutina.planes_entrenamiento?.nombre ?? null,
        rutinaNombre: rutina.nombre,
      });
      alCambiar();
      setSelectorPlanRutinaVisible(false);
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

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScreenBackground>
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              paddingTop: Math.max(12, topInset),
              paddingBottom: Math.max(12, bottomInset),
              paddingLeft: Math.max(gutter, leftInset),
              paddingRight: Math.max(gutter, rightInset),
              gap: 16,
            }}
          >
            {/* 1. TOP BAR ULTRA-ESTÉTICA: SHEET HANDLE & BOTÓN DE (X) INTELIGENTE */}
            <View style={styles.smartTopBar}>
              <View style={styles.sheetHandlePill} />
              <Pressable
                onPress={() => {
                  vibrarBoton();
                  onClose();
                }}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.smartCloseButton,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal"
              >
                <Ionicons name="close" size={19} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* 2. BARRA DE PESTAÑAS: SPOTLIGHT TAB BAR REUTILIZABLE (SIN EMOJIS) */}
            <SpotlightSegmentedTabs
              tabs={[
                { id: 'actividad', label: 'Actividad', iconFocused: 'flash', iconOutline: 'flash-outline' },
                { id: 'rutina', label: '+ Rutina', iconFocused: 'barbell', iconOutline: 'barbell-outline' },
                { id: 'notas', label: 'Notas', iconFocused: 'document-text', iconOutline: 'document-text-outline' },
              ]}
              activeTab={tab}
              onChangeTab={(newTab) => setTab(newTab as any)}
            />

            {/* 3. CONTENIDO DINÁMICO */}
            <ScrollView
              contentContainerStyle={{ gap: 20, paddingBottom: 60 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* PANEL 1: Actividad del Día */}
              {tab === 'actividad' && (
                <View style={{ gap: 24 }}>
                  {/* ────── SECCIÓN: NOTAS DEL DÍA ────── */}
                  <View style={{ gap: 12 }}>
                    <View style={styles.aestheticSectionHeaderRow}>
                      <View style={styles.cyberSectionBadge}>
                        <Ionicons name="document-text-outline" size={13} color="#10B981" />
                        <Text style={styles.cyberSectionBadgeText}>NOTAS</Text>
                        {notasDelDia.length > 0 && (
                          <View style={styles.countChip}>
                            <Text style={styles.countChipText}>{notasDelDia.length}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          setTab('notas');
                        }}
                        style={({ pressed }) => [
                          styles.addSectionBtn,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        <Ionicons name="add" size={13} color={colores.suave} />
                        <Text style={styles.addSectionBtnText}>Añadir</Text>
                      </Pressable>
                    </View>

                    {notasDelDia.length === 0 ? (
                      <View style={styles.emptyDashedBox}>
                        <Text style={styles.emptyDashedText}>Sin notas registradas para este día.</Text>
                      </View>
                    ) : (
                      notasDelDia.map((n, idx) => {
                        const { categoria, titulo, cuerpo, iconName } = parsearNotaInteligente(n.nombre);
                        const pal = PALETA_NOTAS[idx % PALETA_NOTAS.length];
                        return (
                          <View key={n.id} style={styles.obsidianNoteCard}>
                            <View style={styles.noteTopRow}>
                              <View style={styles.noteMetaLeft}>
                                <View style={[styles.noteCategoryIndicator, { backgroundColor: pal.border }]} />
                                <View style={[styles.noteCategoryPill, { backgroundColor: pal.border + '18' }]}>
                                  <Ionicons name={iconName} size={11} color={pal.border} />
                                  <Text style={[styles.noteCategoryPillText, { color: pal.border }]}>
                                    {categoria}
                                  </Text>
                                </View>
                              </View>
                              <Pressable
                                onPress={() => {
                                  vibrarBoton();
                                  quitarEjercicioSolo(n);
                                }}
                                hitSlop={10}
                                style={({ pressed }) => [
                                  styles.deleteNoteBtn,
                                  pressed && { opacity: 0.7, backgroundColor: 'rgba(239, 68, 68, 0.2)' },
                                ]}
                              >
                                <Ionicons name="trash-outline" size={13} color="rgba(248, 113, 113, 0.85)" />
                              </Pressable>
                            </View>

                            <Text style={styles.noteCardTitle} numberOfLines={2}>
                              {titulo}
                            </Text>

                            {cuerpo ? (
                              <Text style={styles.noteCardBody}>
                                {cuerpo}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* ────── SECCIÓN: ENTRENAMIENTOS DEL DÍA (RESUMEN ESTÉTICO REUTILIZANDO MAINDAYCARD) ────── */}
                  <View style={{ gap: 12 }}>
                    <View style={styles.aestheticSectionHeaderRow}>
                      <View style={styles.cyberSectionBadge}>
                        <Ionicons name="barbell-outline" size={13} color={colores.primarioHover} />
                        <Text style={styles.cyberSectionBadgeText}>ENTRENAMIENTOS</Text>
                        {ejerciciosPure.length > 0 && (
                          <View style={styles.countChip}>
                            <Text style={styles.countChipText}>{ejerciciosPure.length}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          setTab('rutina');
                        }}
                        style={({ pressed }) => [
                          styles.addSectionBtn,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        <Ionicons name="add" size={13} color={colores.suave} />
                        <Text style={styles.addSectionBtnText}>Añadir</Text>
                      </Pressable>
                    </View>

                    {registrosConRutina.length === 0 && ejerciciosExtras.length === 0 ? (
                      <View style={styles.emptyDashedBox}>
                        <Ionicons name="barbell-outline" size={26} color={colores.suave} />
                        <Text style={styles.emptyDashedText}>No hay entrenamientos asignados a este día.</Text>
                        <Pressable
                          onPress={() => {
                            vibrarBoton();
                            setTab('rutina');
                          }}
                          style={styles.emptyActionBtn}
                        >
                          <Text style={styles.emptyActionBtnText}>+ Asignar Rutina</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        {/* A. Resumen Estético de Rutina (Reutilizando RutinaLiveCard de MainDayCard) */}
                        {registrosConRutina.map((r) => (
                          <RutinaLiveCard
                            key={r.id}
                            registro={r}
                            sesionActivaInfo={sesionActivaInfo}
                            onIniciar={(reg) => {
                              onClose();
                              if (onIniciarRutina) onIniciarRutina(reg);
                            }}
                            onReanudar={(reg) => {
                              onClose();
                              if (onReanudarRutina) onReanudarRutina(reg);
                            }}
                            onVerResumen={(reg) => {
                              onClose();
                              if (onVerResumenRutina) onVerResumenRutina(reg);
                            }}
                            onDesvincular={() => desvincularRutinaCompleta(r)}
                            permitirDesplegarEjercicios={true}
                          />
                        ))}

                        {/* B. Ejercicios Sueltos / Extras (si los hay) */}
                        {ejerciciosExtras.length > 0 && (
                          <View style={styles.extraExercisesContainer}>
                            <View style={styles.extraExercisesHeader}>
                              <Ionicons name="flash-outline" size={12} color={colores.exito} />
                              <Text style={styles.extraExercisesHeaderText}>EJERCICIOS SUELTOS</Text>
                            </View>
                            {ejerciciosExtras.map((e) => (
                              <View key={e.id} style={styles.extraExerciseMinimalRow}>
                                <Text style={styles.extraExerciseMinimalName}>{e.nombre}</Text>
                                <Pressable
                                  onPress={() => {
                                    vibrarBoton();
                                    quitarEjercicioSolo(e);
                                  }}
                                  hitSlop={8}
                                  style={styles.deleteNoteBtn}
                                >
                                  <Ionicons name="trash-outline" size={13} color="rgba(248, 113, 113, 0.85)" />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* PANEL 2: + Rutina / Ejercicio Rápido */}
              {tab === 'rutina' && (
                <View style={{ gap: 18 }}>
                  <Text style={styles.sectionLabelText}>
                    Añadir Ejercicio Rápido al Día
                  </Text>
                  <View style={styles.quickFormBox}>
                    <TextInput
                      placeholder="Nombre del ejercicio (ej. Sentadillas)"
                      placeholderTextColor={colores.suave}
                      value={nombreActividad}
                      onChangeText={setNombreActividad}
                      style={styles.inputBase}
                    />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        placeholder="Series"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={series}
                        onChangeText={setSeries}
                        style={styles.subInputBase}
                      />
                      <TextInput
                        placeholder="Reps"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={reps}
                        onChangeText={setReps}
                        style={styles.subInputBase}
                      />
                      <TextInput
                        placeholder="Kg"
                        placeholderTextColor={colores.suave}
                        keyboardType="numeric"
                        value={peso}
                        onChangeText={setPeso}
                        style={styles.subInputBase}
                      />
                    </View>
                    <BotonRutinia
                      titulo="Guardar actividad"
                      tamano="compacto"
                      onPress={guardarActividadIndependiente}
                      style={{ alignSelf: 'stretch' }}
                    />
                  </View>

                  <Text style={[styles.sectionLabelText, { marginTop: 6 }]}>
                    Vincular Rutinas Preexistentes
                  </Text>

                  {/* Selector por Plan Jerárquico */}
                  <View style={{ gap: 8, marginBottom: 6 }}>
                    <BotonRutinia
                      titulo="Explorar planes y rutinas"
                      variante="principal"
                      onPress={() => setSelectorPlanRutinaVisible(true)}
                    />
                  </View>

                  {rutinas.length === 0 ? (
                    <Text style={{ color: colores.suave, fontStyle: 'italic', fontFamily: fuentes.regular }}>
                      No tienes rutinas creadas aún. Dirígete a la pestaña &apos;Rutinas&apos;.
                    </Text>
                  ) : (
                    rutinas.map((rut) => {
                      const estaExpandida = rutinaExpandida === rut.id;
                      return (
                        <View key={rut.id} style={styles.routineAccordionCard}>
                          <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Pressable onPress={() => setRutinaExpandida(estaExpandida ? null : rut.id)} style={{ flex: 1 }}>
                              <Text style={{ color: colores.texto, fontSize: 16, fontFamily: fuentes.black }}>{rut.nombre}</Text>
                              <Text style={{ color: colores.suave, fontSize: 11, marginTop: 2, fontFamily: fuentes.regular }}>
                                {rut.ejercicios_rutina?.length || 0} ejercicios • Toca para desplegar
                              </Text>
                            </Pressable>
                            <GlowButton
                              title="+ Toda"
                              onPress={() => vincularRutinaEntera(rut)}
                              variant="primary"
                              size="sm"
                              shape="pill"
                            />
                          </View>

                          {estaExpandida && (
                            <View style={styles.accordionBody}>
                              <Text style={{ color: colores.suave, fontSize: 10.5, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                                Seleccionar ejercicio individual:
                              </Text>
                              {rut.ejercicios_rutina.map((ej) => (
                                <View key={ej.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: colores.texto, fontSize: 13.5, fontFamily: fuentes.bold }}>{ej.nombre}</Text>
                                    <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.regular }}>
                                      {ej.series && ej.repeticiones ? `${ej.series}×${ej.repeticiones}` : ''} {ej.peso ? `• ${ej.peso}kg` : ''}
                                    </Text>
                                  </View>
                                  <GlowButton
                                    title="+ Solo este"
                                    onPress={() => vincularEjercicioIndividual(ej)}
                                    variant="outline"
                                    size="sm"
                                    shape="pill"
                                  />
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
                <View style={{ gap: 18 }}>
                  <Text style={styles.sectionLabelText}>
                    Elegir de la Biblioteca de Notas
                  </Text>

                  {notasBiblioteca.length === 0 ? (
                    <Text style={{ color: colores.suave, fontStyle: 'italic', fontSize: 13, fontFamily: fuentes.regular }}>
                      No tienes notas estandarizadas. Crea plantillas en la pestaña &apos;Notas&apos;.
                    </Text>
                  ) : (
                    notasBiblioteca.map((n) => (
                      <View key={n.id} style={styles.libraryNoteCard}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={styles.libraryNoteCategoryBadge}>
                            <Text style={{ color: colores.primarioHover, fontSize: 10, fontFamily: fuentes.bold }}>{n.categoria}</Text>
                          </View>
                          <Text style={{ color: colores.texto, fontSize: 14.5, fontFamily: fuentes.black }}>{n.titulo}</Text>
                          <Text numberOfLines={2} style={{ color: colores.suave, fontSize: 12, fontFamily: fuentes.regular }}>
                            {n.contenido}
                          </Text>
                        </View>

                        <GlowButton
                          title="+ Añadir"
                          onPress={() => vincularNotaEstandar(n)}
                          variant="primary"
                          size="sm"
                          shape="pill"
                        />
                      </View>
                    ))
                  )}

                  <Text style={[styles.sectionLabelText, { marginTop: 8 }]}>
                    O redactar Nota Ad-hoc para este día
                  </Text>
                  <View style={styles.quickFormBox}>
                    <TextInput
                      placeholder="Escribe anotaciones rápidas exclusivas para esta fecha..."
                      placeholderTextColor={colores.suave}
                      multiline
                      numberOfLines={4}
                      value={nuevaNotaAdHoc}
                      onChangeText={setNuevaNotaAdHoc}
                      style={[styles.inputBase, { height: 90, textAlignVertical: 'top' }]}
                    />
                    <GlowButton
                      title="Guardar Nota Ad-hoc"
                      onPress={guardarNotaSubmit}
                      variant="primary"
                      size="md"
                      shape="rounded"
                      fullWidth
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </ScreenBackground>
      </KeyboardAvoidingView>

      {/* Selector jerárquico de Plan y Rutina */}
      <SelectorPlanRutina
        visible={selectorPlanRutinaVisible}
        fecha={fecha}
        onClose={() => setSelectorPlanRutinaVisible(false)}
        onSeleccionarRutina={(rut, plan) => vincularRutinaEntera(rut, plan)}
        onSeleccionarEjercicioIndividual={(ej) => vincularEjercicioIndividual(ej)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  smartTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 2,
    position: 'relative',
    height: 40,
  },
  sheetHandlePill: {
    position: 'absolute',
    left: '50%',
    marginLeft: -18,
    top: 6,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  smartCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  aestheticSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cyberSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cyberSectionBadgeText: {
    color: '#E4E4E7',
    fontSize: 10.5,
    fontFamily: fuentes.extraBold,
    letterSpacing: 1.2,
  },
  countChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countChipText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  addSectionBtnText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  obsidianNoteCard: {
    backgroundColor: 'rgba(20, 20, 26, 0.85)',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  noteCategoryIndicator: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  noteCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  noteCategoryPillText: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  deleteNoteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCardTitle: {
    color: '#F4F4F5',
    fontSize: 14.5,
    fontFamily: fuentes.bold,
    lineHeight: 19,
  },
  noteCardBody: {
    color: colores.suave,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fuentes.regular,
  },
  emptyDashedBox: {
    backgroundColor: 'rgba(15, 15, 20, 0.5)',
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyDashedText: {
    color: colores.suave,
    fontStyle: 'italic',
    fontSize: 12.5,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  emptyActionBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  extraExercisesContainer: {
    backgroundColor: 'rgba(20, 20, 26, 0.75)',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  extraExercisesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  extraExercisesHeaderText: {
    color: colores.exito,
    fontSize: 10.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.8,
  },
  extraExerciseMinimalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  extraExerciseMinimalName: {
    color: '#F4F4F5',
    fontSize: 13.5,
    fontFamily: fuentes.bold,
    flex: 1,
  },
  sectionLabelText: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickFormBox: {
    backgroundColor: 'rgba(20, 20, 26, 0.85)',
    padding: 16,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colores.texto,
    fontSize: 14.5,
    fontFamily: fuentes.regular,
  },
  subInputBase: {
    backgroundColor: 'rgba(10, 12, 18, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
    color: colores.texto,
    fontSize: 13,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
    fontFamily: fuentes.regular,
  },
  routineAccordionCard: {
    backgroundColor: 'rgba(20, 20, 26, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  accordionBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    padding: 14,
    gap: 10,
  },
  libraryNoteCard: {
    backgroundColor: 'rgba(20, 20, 26, 0.85)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  libraryNoteCategoryBadge: {
    backgroundColor: colores.primarioSuave,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
