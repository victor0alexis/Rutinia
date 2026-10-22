import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, DIAS_SEMANA_ABREV, DIAS_SEMANA_NOMBRES, fuentes } from '../constants/colores';
import BotonRutinia from './BotonRutinia';
import { PlanEntrenamiento, Rutina } from '../types';
import {
  guardarUltimoPlanUsadoId,
  listarPlanes,
  listarRutinasDePlan,
  obtenerUltimoPlanUsadoId,
} from '../services/planes';
import { useLayout } from '../hooks/useLayout';
import { nombreDia } from '../utils/fechas';

type Props = {
  visible: boolean;
  fecha?: Date | null;
  titulo?: string;
  onClose: () => void;
  onSeleccionarRutina: (rutina: Rutina, plan: PlanEntrenamiento | null) => Promise<void> | void;
  onSeleccionarEjercicioIndividual?: (
    ejercicio: any,
    rutina: Rutina,
    plan: PlanEntrenamiento | null
  ) => Promise<void> | void;
  onCrearRutinaEnPlan?: (planId: string | null) => void;
};

export default function SelectorPlanRutina({
  visible,
  fecha,
  titulo = 'Elegir entrenamiento',
  onClose,
  onSeleccionarRutina,
  onSeleccionarEjercicioIndividual,
  onCrearRutinaEnPlan,
}: Props) {
  const { isLandscape, gutter, contentMaxWidth, bottomInset } = useLayout();

  // Paso actual: 1 = "Elige un plan", 2 = "Elige una rutina"
  const [paso, setPaso] = useState<1 | 2>(1);
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanEntrenamiento | null>(null);
  const [esSinPlan, setEsSinPlan] = useState(false);
  const [rutinasDelPlan, setRutinasDelPlan] = useState<Rutina[]>([]);
  const [rutinasSueltas, setRutinasSueltas] = useState<Rutina[]>([]);
  const [rutinaExpandidaId, setRutinaExpandidaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // Determinar índice de día de la semana (0 = Lunes, 6 = Domingo)
  const diaSemanaIndex = fecha ? (fecha.getDay() === 0 ? 6 : fecha.getDay() - 1) : null;

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    const cargarDatos = async () => {
      setCargando(true);
      setBusqueda('');
      setRutinaExpandidaId(null);
      const [planesCargados, sueltas, ultimoPlanId] = await Promise.all([
        listarPlanes({ incluirArchivados: false }),
        listarRutinasDePlan(null),
        obtenerUltimoPlanUsadoId(),
      ]);
      if (cancelado) return;
      setPlanes(planesCargados);
      setRutinasSueltas(sueltas);

      // Si el usuario tiene un solo plan y no tiene rutinas sueltas, saltar directo al Paso 2
      if (planesCargados.length === 1 && sueltas.length === 0) {
        setPlanSeleccionado(planesCargados[0]);
        setEsSinPlan(false);
        setPaso(2);
        listarRutinasDePlan(planesCargados[0].id).then(setRutinasDelPlan);
      } else {
        // Encontrar plan predeterminado (el activo o el último usado)
        let planPredet = planesCargados.find((p) => p.id === ultimoPlanId) ||
          planesCargados.find((p) => p.activo) ||
          planesCargados[0] ||
          null;

        if (planPredet) {
          setPlanSeleccionado(planPredet);
          listarRutinasDePlan(planPredet.id).then(setRutinasDelPlan);
        }
        setPaso(1);
      }
      setCargando(false);
    };
    cargarDatos();
    return () => {
      cancelado = true;
    };
  }, [visible]);

  if (!visible) return null;

  const elegirPlanYPasar = async (p: PlanEntrenamiento) => {
    setPlanSeleccionado(p);
    setEsSinPlan(false);
    setBusqueda('');
    setPaso(2);
    await guardarUltimoPlanUsadoId(p.id);
    const ruts = await listarRutinasDePlan(p.id);
    setRutinasDelPlan(ruts);
  };

  const elegirSinPlanYPasar = () => {
    setPlanSeleccionado(null);
    setEsSinPlan(true);
    setBusqueda('');
    setPaso(2);
    setRutinasDelPlan(rutinasSueltas);
  };

  const volverAPlanes = () => {
    setPaso(1);
    setBusqueda('');
  };

  const listaRutinasActuales = esSinPlan ? rutinasSueltas : rutinasDelPlan;

  // Filtrado por buscador
  const rutinasFiltradas = listaRutinasActuales.filter((r) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const matchNombre = r.nombre.toLowerCase().includes(q);
    const matchEj = r.ejercicios_rutina?.some((e) => e.nombre.toLowerCase().includes(q));
    return matchNombre || matchEj;
  });

  // Separar rutina sugerida para este día
  const rutinaSugerida = diaSemanaIndex !== null
    ? rutinasFiltradas.find((r) => r.dia_sugerido === diaSemanaIndex)
    : null;

  const otrasRutinas = rutinaSugerida
    ? rutinasFiltradas.filter((r) => r.id !== rutinaSugerida.id)
    : rutinasFiltradas;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' }}>
        <View
          style={[
            styles.sheetContainer,
            {
              maxWidth: contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingBottom: Math.max(20, bottomInset + 10),
              maxHeight: isLandscape ? '98%' : '90%',
            },
          ]}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={styles.grabber} />
          </View>

          {/* Header con pasos */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              {paso === 2 && planes.length > 1 && (
                <Pressable onPress={volverAPlanes} style={styles.backBtn} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color={colores.primarioHover} />
                  <Text style={styles.backBtnText}>Planes</Text>
                </Pressable>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.kickerText}>
                  {paso === 1 ? 'PASO 1 · ELIGE UN PLAN' : 'PASO 2 · ELIGE UNA RUTINA'}
                  {fecha ? ` • ${nombreDia(fecha)}` : ''}
                </Text>
                <Text style={styles.titleText} numberOfLines={1}>
                  {paso === 1
                    ? 'Selecciona el plan'
                    : esSinPlan
                    ? 'Rutinas sin plan'
                    : planSeleccionado?.nombre || 'Rutinas del plan'}
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colores.suave} />
            </Pressable>
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PASO 1: ELIGE UN PLAN                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {paso === 1 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {planes.length === 0 && rutinasSueltas.length === 0 && !cargando ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="barbell-outline" size={28} color={colores.suave} />
                  <Text style={styles.emptyTitle}>No tienes planes creados</Text>
                  <Text style={styles.emptySubtext}>
                    Crea un plan en la sección &quot;Rutinas&quot; para organizar tus entrenamientos.
                  </Text>
                </View>
              ) : null}

              {/* Lista de Planes */}
              {planes.map((p) => {
                const esActivo = p.activo;
                const ruts = p.totalRutinas || 0;

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => elegirPlanYPasar(p)}
                    style={({ pressed }) => [
                      styles.planRowCard,
                      {
                        borderLeftColor: p.color,
                        borderColor: esActivo ? p.color : colores.borde,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.planIconBox, { backgroundColor: p.color + '22', borderColor: p.color }]}>
                      <Ionicons name={p.icono as any} size={20} color={p.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.planNameText} numberOfLines={1}>
                          {p.nombre}
                        </Text>
                        {esActivo && (
                          <View style={[styles.activeChip, { backgroundColor: p.color }]}>
                            <Text style={styles.activeChipText}>ACTIVO</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.planSubtext}>
                        {ruts} {ruts === 1 ? 'rutina' : 'rutinas'}{' '}
                        {p.objetivo ? `• ${p.objetivo}` : ''}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={colores.suave} />
                  </Pressable>
                );
              })}

              {/* Opción Sin Plan */}
              <Pressable
                onPress={elegirSinPlanYPasar}
                style={styles.orphanRowCard}
              >
                <View style={styles.orphanIconBox}>
                  <Ionicons name="folder-outline" size={18} color={colores.suave} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orphanTitle}>Rutinas sin plan asignado</Text>
                  <Text style={styles.orphanSubtext}>
                    {rutinasSueltas.length} {rutinasSueltas.length === 1 ? 'rutina libre' : 'rutinas libres'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colores.suave} />
              </Pressable>
            </ScrollView>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PASO 2: ELIGE UNA RUTINA                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {paso === 2 && (
            <View style={{ flex: 1, gap: 10 }}>
              {/* Buscador dentro del plan */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colores.suave} />
                <TextInput
                  placeholder="Buscar ejercicio o rutina..."
                  placeholderTextColor={colores.suave}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  inputMode="search"
                  keyboardType="default"
                  returnKeyType="search"
                  enterKeyHint="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                  style={styles.searchInput}
                />
                {busqueda.length > 0 && (
                  <Pressable onPress={() => setBusqueda('')} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={colores.suave} />
                  </Pressable>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                {/* ESTADO VACÍO EN EL PLAN */}
                {listaRutinasActuales.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Ionicons name="barbell-outline" size={28} color={colores.suave} />
                    <Text style={styles.emptyTitle}>Este plan aún no tiene rutinas</Text>
                    <Text style={styles.emptySubtext}>
                      Crea la primera rutina para poder agregarla a tus días.
                    </Text>
                    {onCrearRutinaEnPlan && (
                      <BotonRutinia
                        titulo="+ Crear rutina en este plan"
                        variante="principal"
                        tamano="compacto"
                        onPress={() => {
                          onClose();
                          onCrearRutinaEnPlan(planSeleccionado ? planSeleccionado.id : null);
                        }}
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </View>
                )}

                {/* 1. RUTINA SUGERIDA DESTACADA PARA HOY */}
                {rutinaSugerida && !busqueda.trim() && (
                  <View style={styles.suggestedRoutineCard}>
                    <View style={styles.suggestedBadgeHeader}>
                      <Ionicons name="sparkles" size={12} color="#FFF" />
                      <Text style={styles.suggestedBadgeHeaderText}>
                        SUGERIDA PARA {fecha ? DIAS_SEMANA_NOMBRES[diaSemanaIndex || 0].toUpperCase() : 'HOY'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.routineTitleHighlight}>{rutinaSugerida.nombre}</Text>
                        <Text style={styles.routineMetaText}>
                          {rutinaSugerida.ejercicios_rutina?.length || 0} ejercicios • Rutina programada para este día
                        </Text>
                      </View>

                      <BotonRutinia
                        titulo="Seleccionar"
                        variante="principal"
                        tamano="compacto"
                        onPress={() => onSeleccionarRutina(rutinaSugerida, planSeleccionado)}
                      />
                    </View>

                    {/* Chips de ejercicios */}
                    {rutinaSugerida.ejercicios_rutina && rutinaSugerida.ejercicios_rutina.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {rutinaSugerida.ejercicios_rutina.slice(0, 3).map((e) => (
                          <View key={e.id} style={styles.exerciseChip}>
                            <Text style={styles.exerciseChipText} numberOfLines={1}>
                              {e.nombre.replace(/\s*\(.*\)$/, '').trim()}
                            </Text>
                          </View>
                        ))}
                        {rutinaSugerida.ejercicios_rutina.length > 3 && (
                          <Text style={styles.exerciseChipMore}>
                            +{rutinaSugerida.ejercicios_rutina.length - 3} más
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* 2. OTRAS RUTINAS DEL PLAN */}
                {otrasRutinas.map((rut) => {
                  const estaExpandida = rutinaExpandidaId === rut.id;
                  const ejs = rut.ejercicios_rutina || [];
                  const diaNombre =
                    rut.dia_sugerido !== null && rut.dia_sugerido !== undefined
                      ? DIAS_SEMANA_NOMBRES[rut.dia_sugerido]
                      : null;

                  return (
                    <View key={rut.id} style={styles.routineItemCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Pressable
                          onPress={() => setRutinaExpandidaId(estaExpandida ? null : rut.id)}
                          style={{ flex: 1, paddingRight: 8 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.routineItemTitle} numberOfLines={1}>
                              {rut.nombre}
                            </Text>
                            {diaNombre && (
                              <View style={styles.daySuggestedPill}>
                                <Text style={styles.daySuggestedPillText}>
                                  {DIAS_SEMANA_ABREV[rut.dia_sugerido!]}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.routineMetaText}>
                            {ejs.length} ejercicios {diaNombre ? `• Sugerida: ${diaNombre}` : ''} • Toca para desglosar
                          </Text>
                        </Pressable>

                        <BotonRutinia
                          titulo="+ Agregar"
                          variante="secundario"
                          tamano="compacto"
                          onPress={() => onSeleccionarRutina(rut, planSeleccionado)}
                        />
                      </View>

                      {/* Desglose de ejercicios para agregar individualmente si se requiere */}
                      {estaExpandida && (
                        <View style={styles.expandedExercisesContainer}>
                          <Text style={styles.expandedLabel}>O añade un ejercicio individual:</Text>
                          {ejs.map((ej) => (
                            <View key={ej.id} style={styles.expandedExerciseRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.expandedEjName}>{ej.nombre}</Text>
                                <Text style={styles.expandedEjMeta}>
                                  {ej.series || 1} {ej.series === 1 ? 'serie' : 'series'}
                                  {ej.repeticiones ? ` • ${ej.repeticiones} reps` : ''}
                                  {ej.peso ? ` • ${ej.peso}kg` : ''}
                                </Text>
                              </View>
                              {onSeleccionarEjercicioIndividual && (
                                <Pressable
                                  onPress={() =>
                                    onSeleccionarEjercicioIndividual(ej, rut, planSeleccionado)
                                  }
                                  style={styles.addSingleEjBtn}
                                >
                                  <Ionicons name="add" size={14} color={colores.texto} />
                                  <Text style={styles.addSingleEjBtnText}>Solo este</Text>
                                </Pressable>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#0F121B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingTop: 12,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  kickerText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
  },
  titleText: {
    color: colores.texto,
    fontSize: 18,
    fontFamily: fuentes.black,
    marginTop: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtnText: {
    color: colores.primarioHover,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  planRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    backgroundColor: colores.tarjetaSolida,
  },
  planIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  planNameText: {
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  activeChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeChipText: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  planSubtext: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
    marginTop: 2,
  },
  orphanRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.borde,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginTop: 2,
  },
  orphanIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orphanTitle: {
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.bold,
  },
  orphanSubtext: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.tarjetaSolida,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.regular,
    padding: 0,
  },
  emptyCard: {
    backgroundColor: colores.tarjetaSolida,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  emptyTitle: {
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  emptySubtext: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  suggestedRoutineCard: {
    backgroundColor: 'rgba(194, 36, 61, 0.12)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colores.primarioHover,
    gap: 8,
  },
  suggestedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.primarioHover,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  suggestedBadgeHeaderText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: fuentes.black,
    letterSpacing: 0.8,
  },
  routineTitleHighlight: {
    color: colores.texto,
    fontSize: 16,
    fontFamily: fuentes.black,
  },
  routineMetaText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.medium,
    marginTop: 1,
  },
  exerciseChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  exerciseChipText: {
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.medium,
  },
  exerciseChipMore: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.medium,
    alignSelf: 'center',
  },
  routineItemCard: {
    backgroundColor: colores.tarjetaSolida,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  routineItemTitle: {
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  daySuggestedPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySuggestedPillText: {
    color: colores.texto,
    fontSize: 9,
    fontFamily: fuentes.black,
  },
  expandedExercisesContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 4,
  },
  expandedLabel: {
    color: colores.suave,
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  expandedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  expandedEjName: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.medium,
  },
  expandedEjMeta: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  addSingleEjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  addSingleEjBtnText: {
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
});
