import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colores, DIAS_SEMANA_ABREV, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import BotonRutinia from '../../components/BotonRutinia';
import DockPrincipal from '../../components/DockPrincipal';
import GestionarPlanModal from '../../components/GestionarPlanModal';
import EliminarPlanModal from '../../components/EliminarPlanModal';
import AplicarPlanSemanaModal from '../../components/AplicarPlanSemanaModal';
import GestionarRutinaModal from '../../components/GestionarRutinaModal';
import {
  archivarPlan,
  crearPlan,
  definirDiaSugerido,
  definirPlanActivo,
  duplicarRutinaEnPlan,
  editarPlan,
  eliminarPlan,
  guardarUltimoPlanUsadoId,
  listarPlanes,
  listarRutinasDePlan,
  moverRutina,
  reordenarPlanes,
  restaurarPlan,
} from '../../services/planes';
import { eliminarRutina } from '../../services/rutinas';
import { PlanEntrenamiento, Rutina } from '../../types';
import { useLayout } from '../../hooks/useLayout';
import { mostrarMensaje, seguro } from '../../utils/errores';

export default function RutinasScreen() {
  const { gutter, contentMaxWidth, bottomInset } = useLayout();

  // Estados de datos
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [rutinasDelPlan, setRutinasDelPlan] = useState<Rutina[]>([]);
  const [rutinasSueltas, setRutinasSueltas] = useState<Rutina[]>([]);
  const [cargando, setCargando] = useState(true);

  // Navegación de niveles: null = Nivel 1 (Lista de planes), PlanEntrenamiento = Nivel 2 (Detalle del plan)
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanEntrenamiento | null>(null);
  const [viendoSinPlan, setViendoSinPlan] = useState(false);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);

  // Buscador
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalPlanVisible, setModalPlanVisible] = useState(false);
  const [planParaEditar, setPlanParaEditar] = useState<PlanEntrenamiento | null>(null);

  const [modalEliminarPlanVisible, setModalEliminarPlanVisible] = useState(false);
  const [planParaEliminar, setPlanParaEliminar] = useState<PlanEntrenamiento | null>(null);

  const [modalAplicarVisible, setModalAplicarVisible] = useState(false);

  const [modalRutinaVisible, setModalRutinaVisible] = useState(false);
  const [rutinaParaEditar, setRutinaParaEditar] = useState<Rutina | null>(null);

  // Modal para mover rutina
  const [rutinaParaMover, setRutinaParaMover] = useState<Rutina | null>(null);

  // Snackbar de Deshacer (6 segundos)
  const [undoItem, setUndoItem] = useState<{
    tipo: 'rutina' | 'plan';
    nombre: string;
    cancelar: () => void;
  } | null>(null);
  const [segundosRestantesUndo, setSegundosRestantesUndo] = useState(6);
  const undoTimerRef = useRef<any>(null);

  // Referencias para evitar condiciones de carrera o closures obsoletas al cambiar de nivel
  const planSeleccionadoRef = useRef<PlanEntrenamiento | null>(null);
  const viendoSinPlanRef = useRef<boolean>(false);

  useEffect(() => {
    planSeleccionadoRef.current = planSeleccionado;
  }, [planSeleccionado]);

  useEffect(() => {
    viendoSinPlanRef.current = viendoSinPlan;
  }, [viendoSinPlan]);

  // Carga general de datos con soporte para forzar id (o null para volver a todos los planes)
  const cargarDatos = useCallback(async (forcedPlanId?: string | null) => {
    try {
      setCargando(true);
      const todosPlanes = await listarPlanes({ incluirArchivados: true });
      setPlanes(todosPlanes);

      const idActual = forcedPlanId !== undefined ? forcedPlanId : planSeleccionadoRef.current?.id ?? null;

      if (idActual) {
        const ruts = await listarRutinasDePlan(idActual);
        setRutinasDelPlan(ruts);
        const planActualizado = todosPlanes.find((p) => p.id === idActual);
        if (planActualizado) {
          planSeleccionadoRef.current = planActualizado;
          setPlanSeleccionado(planActualizado);
        } else {
          planSeleccionadoRef.current = null;
          setPlanSeleccionado(null);
        }
      } else if (viendoSinPlanRef.current && forcedPlanId === undefined) {
        const sueltas = await listarRutinasDePlan(null);
        setRutinasSueltas(sueltas);
      } else {
        const sueltas = await listarRutinasDePlan(null);
        setRutinasSueltas(sueltas);
      }
    } catch (err) {
      console.warn('Error cargando planes y rutinas:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  // Función infalible para regresar al Nivel 1 (Todos los planes)
  const volverATodosLosPlanes = useCallback(() => {
    planSeleccionadoRef.current = null;
    viendoSinPlanRef.current = false;
    setPlanSeleccionado(null);
    setViendoSinPlan(false);
    setBusqueda('');
    cargarDatos(null);
  }, [cargarDatos]);

  // Soporte de botón retroceso de hardware (Android)
  useEffect(() => {
    const onBackPress = () => {
      if (planSeleccionado || viendoSinPlan) {
        volverATodosLosPlanes();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [planSeleccionado, viendoSinPlan, volverATodosLosPlanes]);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  // Manejador del Snackbar de Undo
  const dispararUndoSnackbar = (
    tipo: 'rutina' | 'plan',
    nombre: string,
    onConfirmarDefinitivo: () => Promise<void>,
    onRollback: () => void
  ) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    let cancelado = false;
    setSegundosRestantesUndo(6);
    setUndoItem({
      tipo,
      nombre,
      cancelar: () => {
        cancelado = true;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoItem(null);
        onRollback();
      },
    });

    // Countdown visible
    let segundos = 6;
    const interval = setInterval(() => {
      segundos--;
      setSegundosRestantesUndo(segundos);
      if (segundos <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    undoTimerRef.current = setTimeout(async () => {
      clearInterval(interval);
      if (!cancelado) {
        setUndoItem(null);
        await onConfirmarDefinitivo();
      }
    }, 6000);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ACCIONES NIVEL 1: GESTIÓN DE PLANES
  // ──────────────────────────────────────────────────────────────────────────

  const abrirCrearPlan = () => {
    setPlanParaEditar(null);
    setModalPlanVisible(true);
  };

  const abrirEditarPlan = (p: PlanEntrenamiento) => {
    setPlanParaEditar(p);
    setModalPlanVisible(true);
  };

  const guardarPlan = async (datos: {
    nombre: string;
    descripcion: string;
    objetivo: string;
    color: string;
    icono: string;
    activo: boolean;
  }) => {
    if (planParaEditar) {
      await editarPlan(planParaEditar.id, datos);
    } else {
      await crearPlan(datos);
    }
    await cargarDatos();
    mostrarMensaje('Éxito', planParaEditar ? 'Plan actualizado correctamente.' : 'Nuevo plan creado con éxito.');
  };

  const manejarDefinirActivo = async (p: PlanEntrenamiento) => {
    await seguro(async () => {
      await definirPlanActivo(p.id);
      await cargarDatos();
      mostrarMensaje('Plan Activo', `"${p.nombre}" es ahora tu plan de entrenamiento activo.`);
    });
  };

  const manejarArchivarPlan = async (p: PlanEntrenamiento) => {
    await seguro(async () => {
      await archivarPlan(p.id);
      if (planSeleccionado?.id === p.id) {
        volverATodosLosPlanes();
      } else {
        await cargarDatos();
      }
      mostrarMensaje('Plan Archivado', `El plan "${p.nombre}" se movió a la sección de archivados.`);
    });
  };

  const manejarRestaurarPlan = async (p: PlanEntrenamiento) => {
    await seguro(async () => {
      await restaurarPlan(p.id);
      await cargarDatos();
      mostrarMensaje('Plan Restaurado', `El plan "${p.nombre}" ha sido restaurado con éxito.`);
    });
  };

  const confirmarEliminarPlan = (p: PlanEntrenamiento) => {
    setPlanParaEliminar(p);
    setModalEliminarPlanVisible(true);
  };

  const ejecutarEliminarPlan = async (
    planId: string,
    resolucion: { tipo: 'mover'; planDestinoId: string } | { tipo: 'desvincular' } | { tipo: 'borrar' }
  ) => {
    const planTarget = planes.find((p) => p.id === planId);
    if (!planTarget) return;

    // Actualización optimista: quitarlo de la vista
    const planesPrevios = [...planes];
    setPlanes(planes.filter((p) => p.id !== planId));
    if (planSeleccionado?.id === planId) {
      volverATodosLosPlanes();
    }

    dispararUndoSnackbar(
      'plan',
      planTarget.nombre,
      async () => {
        try {
          await eliminarPlan(planId, resolucion);
          await cargarDatos();
        } catch (err: any) {
          setPlanes(planesPrevios);
          mostrarMensaje('Error', err?.message || 'No se pudo eliminar el plan.');
        }
      },
      () => {
        setPlanes(planesPrevios);
      }
    );
  };

  // Reordenar planes hacia arriba o abajo (accesibilidad y orden manual)
  const moverPlanOrden = async (index: number, direccion: 'arriba' | 'abajo') => {
    const planesActivosYNormales = planes.filter((p) => !p.archivado);
    const targetIdx = direccion === 'arriba' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= planesActivosYNormales.length) return;

    const copia = [...planesActivosYNormales];
    const item = copia[index];
    copia[index] = copia[targetIdx];
    copia[targetIdx] = item;

    // Actualizar optimista
    setPlanes([...copia, ...planes.filter((p) => p.archivado)]);

    await seguro(async () => {
      await reordenarPlanes(copia.map((p) => p.id));
      await cargarDatos();
    });
  };

  // Entrar al Nivel 2 (Detalle del Plan)
  const seleccionarPlan = async (p: PlanEntrenamiento) => {
    planSeleccionadoRef.current = p;
    viendoSinPlanRef.current = false;
    setViendoSinPlan(false);
    setPlanSeleccionado(p);
    await guardarUltimoPlanUsadoId(p.id);
    const ruts = await listarRutinasDePlan(p.id);
    setRutinasDelPlan(ruts);
  };

  const seleccionarSinPlan = async () => {
    planSeleccionadoRef.current = null;
    viendoSinPlanRef.current = true;
    setPlanSeleccionado(null);
    setViendoSinPlan(true);
    const sueltas = await listarRutinasDePlan(null);
    setRutinasSueltas(sueltas);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ACCIONES NIVEL 2: GESTIÓN DE RUTINAS DENTRO DEL PLAN
  // ──────────────────────────────────────────────────────────────────────────

  const abrirCrearRutinaEnPlan = () => {
    setRutinaParaEditar(null);
    setModalRutinaVisible(true);
  };

  const abrirEditarRutina = (r: Rutina) => {
    setRutinaParaEditar(r);
    setModalRutinaVisible(true);
  };

  const clonarRutina = async (r: Rutina) => {
    await seguro(async () => {
      await duplicarRutinaEnPlan(r, planSeleccionado ? planSeleccionado.id : null);
      await cargarDatos();
      mostrarMensaje('Rutina Clonada', `Se creó una copia de "${r.nombre}".`);
    });
  };

  const cambiarDiaSugeridoRutina = async (r: Rutina, diaIdx: number) => {
    const nuevoDia = r.dia_sugerido === diaIdx ? null : diaIdx;
    // Actualización optimista inmediata
    setRutinasDelPlan((prev) =>
      prev.map((item) => (item.id === r.id ? { ...item, dia_sugerido: nuevoDia } : item))
    );
    await seguro(async () => {
      await definirDiaSugerido(r.id, nuevoDia);
      await cargarDatos();
    });
  };

  const confirmarEliminarRutina = (r: Rutina) => {
    // Actualización optimista inmediata
    const rutinasPrevias = [...rutinasDelPlan];
    setRutinasDelPlan(rutinasDelPlan.filter((item) => item.id !== r.id));

    dispararUndoSnackbar(
      'rutina',
      r.nombre,
      async () => {
        try {
          await eliminarRutina(r.id);
          await cargarDatos();
        } catch (err: any) {
          setRutinasDelPlan(rutinasPrevias);
          mostrarMensaje('Error', err?.message || 'No se pudo eliminar la rutina.');
        }
      },
      () => {
        setRutinasDelPlan(rutinasPrevias);
      }
    );
  };

  const ejecutarMoverRutina = async (rutinaId: string, nuevoPlanId: string | null) => {
    await seguro(async () => {
      await moverRutina(rutinaId, nuevoPlanId);
      setRutinaParaMover(null);
      await cargarDatos();
      mostrarMensaje('Rutina Movida', 'La rutina fue transferida al nuevo plan con éxito.');
    });
  };

  // Filtro de búsqueda
  const planesFiltrados = planes.filter((p) => {
    if (p.archivado) return false;
    if (!busqueda.trim()) return true;
    return (
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.objetivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  const planesArchivados = planes.filter((p) => p.archivado);

  const rutinasFiltradas = (planSeleccionado ? rutinasDelPlan : rutinasSueltas).filter((r) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const matchRutina = r.nombre.toLowerCase().includes(q);
    const matchEj = r.ejercicios_rutina?.some((e) => e.nombre.toLowerCase().includes(q));
    return matchRutina || matchEj;
  });

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO */}
        <EncabezadoSeccion
          badgeText="SISTEMA DE ENTRENAMIENTO"
          titulo={planSeleccionado ? planSeleccionado.nombre : viendoSinPlan ? 'Rutinas sin plan' : 'Planes & Rutinas'}
          subtitulo={
            planSeleccionado
              ? planSeleccionado.objetivo || planSeleccionado.descripcion || 'Gestiona las rutinas de este plan'
              : 'Organiza tus rutinas en planes estructurados e inteligentes'
          }
          mostrarBotonVolver={Boolean(planSeleccionado || viendoSinPlan)}
          onVolver={volverATodosLosPlanes}
        />

        {/* CONTENEDOR PRINCIPAL */}
        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingTop: 8,
            paddingBottom: 140,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* BARRA SUPERIOR DE NAVEGACIÓN ENTRE NIVELES */}
          {(planSeleccionado || viendoSinPlan) && (
            <View style={styles.backNavRow}>
              <Pressable
                onPress={volverATodosLosPlanes}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Volver a todos los planes"
              >
                <Ionicons name="chevron-back" size={18} color={colores.primarioHover} />
                <Text style={styles.backButtonText}>Todos los planes</Text>
              </Pressable>

              {planSeleccionado && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {/* Botón rápido editar */}
                  <Pressable
                    onPress={() => abrirEditarPlan(planSeleccionado)}
                    style={styles.headerActionSmall}
                    hitSlop={6}
                  >
                    <Ionicons name="create-outline" size={16} color={colores.texto} />
                    <Text style={styles.headerActionSmallText}>Editar</Text>
                  </Pressable>

                  {/* Botón rápido archivar */}
                  <Pressable
                    onPress={() => manejarArchivarPlan(planSeleccionado)}
                    style={styles.headerActionSmall}
                    hitSlop={6}
                  >
                    <Ionicons name="archive-outline" size={16} color={colores.suave} />
                  </Pressable>

                  {/* Botón rápido eliminar */}
                  <Pressable
                    onPress={() => confirmarEliminarPlan(planSeleccionado)}
                    style={styles.headerActionDanger}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={16} color={colores.peligro} />
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* BUSCADOR */}
          <View style={styles.searchBarBox}>
            <Ionicons name="search" size={18} color={colores.suave} />
            <TextInput
              placeholder={
                planSeleccionado
                  ? `Buscar rutina en "${planSeleccionado.nombre}"...`
                  : 'Buscar plan o rutina...'
              }
              placeholderTextColor={colores.suave}
              value={busqueda}
              onChangeText={setBusqueda}
              style={{
                flex: 1,
                color: colores.texto,
                fontSize: 14,
                fontFamily: fuentes.regular,
                padding: 0,
              }}
            />
            {busqueda.length > 0 && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colores.suave} />
              </Pressable>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* NIVEL 1: LISTADO DE PLANES                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {!planSeleccionado && !viendoSinPlan && (
            <>
              {/* ESTADO VACÍO (Si no hay planes creados) */}
              {planesFiltrados.length === 0 && !cargando ? (
                <View style={styles.emptyStateCard}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons name="calendar-outline" size={32} color={colores.primarioHover} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {busqueda.trim() ? 'No se encontraron planes' : 'Sin planes de entrenamiento'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {busqueda.trim()
                      ? `No hay planes que coincidan con "${busqueda}".`
                      : 'Agrupa tus rutinas en planes con días sugeridos, objetivos y periodización.'}
                  </Text>
                  {!busqueda.trim() && (
                    <BotonRutinia
                      titulo="+ Crear mi primer plan"
                      variante="principal"
                      onPress={abrirCrearPlan}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </View>
              ) : null}

              {/* LISTA DE TARJETAS DE PLANES ACTIVOS Y NO ARCHIVADOS */}
              {planesFiltrados.map((p, index) => {
                const esActivo = p.activo;
                const rutsCount = p.totalRutinas || 0;
                const diasPorSem = p.diasPorSemana || 0;

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => seleccionarPlan(p)}
                    style={({ pressed }) => [
                      styles.planCard,
                      {
                        borderColor: esActivo ? p.color : colores.borde,
                        borderLeftWidth: 4,
                        borderLeftColor: p.color,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    {/* Header de la Tarjeta del Plan */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.planIconWrapper, { backgroundColor: p.color + '22', borderColor: p.color }]}>
                          <Ionicons name={p.icono as any} size={22} color={p.color} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.planTitle} numberOfLines={1}>
                              {p.nombre}
                            </Text>
                            {esActivo && (
                              <View style={[styles.activeBadge, { backgroundColor: p.color }]}>
                                <Ionicons name="sparkles" size={10} color="#FFF" />
                                <Text style={styles.activeBadgeText}>ACTIVO</Text>
                              </View>
                            )}
                          </View>

                          {p.objetivo ? (
                            <Text style={styles.planObjectiveText} numberOfLines={1}>
                              {p.objetivo}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Botón entrar */}
                      <Ionicons name="chevron-forward" size={20} color={colores.suave} />
                    </View>

                    {/* Descripción breve si existe */}
                    {p.descripcion ? (
                      <Text style={styles.planDescText} numberOfLines={2}>
                        {p.descripcion}
                      </Text>
                    ) : null}

                    {/* Barra de Estadísticas del Plan */}
                    <View style={styles.planStatsRow}>
                      <View style={styles.planStatItem}>
                        <Ionicons name="barbell-outline" size={14} color={colores.suave} />
                        <Text style={styles.planStatText}>
                          {rutsCount} {rutsCount === 1 ? 'rutina' : 'rutinas'}
                        </Text>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.planStatItem}>
                        <Ionicons name="calendar-outline" size={14} color={colores.suave} />
                        <Text style={styles.planStatText}>
                          {diasPorSem > 0 ? `${diasPorSem} días/semana` : 'Días flexibles'}
                        </Text>
                      </View>
                    </View>

                    {/* Acciones Secundarias de la Tarjeta */}
                    <View style={styles.planActionsRow}>
                      {!esActivo ? (
                        <Pressable
                          onPress={() => manejarDefinirActivo(p)}
                          style={styles.actionPillButton}
                          hitSlop={6}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={colores.texto} />
                          <Text style={styles.actionPillText}>Activar</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.actionPillActive}>
                          <Ionicons name="flash" size={12} color={p.color} />
                          <Text style={[styles.actionPillText, { color: p.color }]}>Predeterminado</Text>
                        </View>
                      )}

                      <Pressable
                        onPress={() => abrirEditarPlan(p)}
                        style={styles.actionPillButton}
                        hitSlop={6}
                      >
                        <Ionicons name="create-outline" size={14} color={colores.texto} />
                        <Text style={styles.actionPillText}>Editar</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => manejarArchivarPlan(p)}
                        style={styles.actionPillButton}
                        hitSlop={6}
                      >
                        <Ionicons name="archive-outline" size={14} color={colores.suave} />
                        <Text style={styles.actionPillText}>Archivar</Text>
                      </Pressable>

                      {/* Ordenar manual si hay varios */}
                      <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
                        {index > 0 && (
                          <Pressable
                            onPress={() => moverPlanOrden(index, 'arriba')}
                            style={styles.arrowSortBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="arrow-up" size={14} color={colores.suave} />
                          </Pressable>
                        )}
                        {index < planesFiltrados.length - 1 && (
                          <Pressable
                            onPress={() => moverPlanOrden(index, 'abajo')}
                            style={styles.arrowSortBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="arrow-down" size={14} color={colores.suave} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* SECCIÓN RUTINAS SIN PLAN (Si existen rutinas huérfanas) */}
              {rutinasSueltas.length > 0 && (
                <Pressable
                  onPress={seleccionarSinPlan}
                  style={styles.orphanPlanCard}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={styles.orphanIconBox}>
                      <Ionicons name="folder-open-outline" size={20} color={colores.suave} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orphanTitle}>Rutinas individuales (sin plan)</Text>
                      <Text style={styles.orphanSubtitle}>
                        {rutinasSueltas.length} {rutinasSueltas.length === 1 ? 'rutina libre' : 'rutinas libres'} • Toca para verlas o moverlas a un plan
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colores.suave} />
                </Pressable>
              )}

              {/* SECCIÓN PLANES ARCHIVADOS (Colapsable al final) */}
              {planesArchivados.length > 0 && (
                <View style={styles.archivedSectionContainer}>
                  <Pressable
                    onPress={() => setMostrarArchivados(!mostrarArchivados)}
                    style={styles.archivedToggleHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="archive-outline" size={16} color={colores.suave} />
                      <Text style={styles.archivedHeaderTitle}>
                        Planes Archivados ({planesArchivados.length})
                      </Text>
                    </View>
                    <Ionicons
                      name={mostrarArchivados ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colores.suave}
                    />
                  </Pressable>

                  {mostrarArchivados && (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {planesArchivados.map((ap) => (
                        <View key={ap.id} style={styles.archivedPlanRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={[styles.miniDot, { backgroundColor: ap.color }]} />
                            <Text style={styles.archivedPlanName} numberOfLines={1}>
                              {ap.nombre} ({ap.totalRutinas || 0} rutinas)
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => manejarRestaurarPlan(ap)}
                              style={styles.archivedRestoreBtn}
                              hitSlop={6}
                            >
                              <Ionicons name="refresh-outline" size={14} color={colores.exito} />
                              <Text style={styles.archivedRestoreText}>Restaurar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => confirmarEliminarPlan(ap)}
                              style={styles.archivedDeleteBtn}
                              hitSlop={6}
                            >
                              <Ionicons name="trash-outline" size={14} color={colores.peligro} />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* NIVEL 2: DETALLE DEL PLAN SELECCIONADO (O RUTINAS SUELTAS)     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(planSeleccionado || viendoSinPlan) && (
            <>
              {/* Tarjeta de Encabezado del Plan Actual */}
              {planSeleccionado && (
                <View
                  style={[
                    styles.planDetailHeaderCard,
                    {
                      borderColor: planSeleccionado.color + '55',
                      borderLeftWidth: 4,
                      borderLeftColor: planSeleccionado.color,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View
                        style={[
                          styles.planIconWrapper,
                          {
                            backgroundColor: planSeleccionado.color + '25',
                            borderColor: planSeleccionado.color,
                          },
                        ]}
                      >
                        <Ionicons
                          name={planSeleccionado.icono as any}
                          size={24}
                          color={planSeleccionado.color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.detailTitleText}>{planSeleccionado.nombre}</Text>
                          {planSeleccionado.activo ? (
                            <View style={[styles.activeBadge, { backgroundColor: planSeleccionado.color }]}>
                              <Ionicons name="sparkles" size={10} color="#FFF" />
                              <Text style={styles.activeBadgeText}>ACTIVO</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.detailObjectiveText}>
                          {planSeleccionado.objetivo || 'Sin objetivo asignado'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {planSeleccionado.descripcion ? (
                    <Text style={styles.detailDescText}>{planSeleccionado.descripcion}</Text>
                  ) : null}

                  {/* Acciones principales del Plan: Aplicar a semana y Definir Activo */}
                  <View style={styles.detailActionButtonsRow}>
                    <BotonRutinia
                      titulo="Aplicar plan a mi semana"
                      variante="secundario"
                      tamano="compacto"
                      onPress={() => setModalAplicarVisible(true)}
                      style={{ flex: 1.3 }}
                    />

                    {!planSeleccionado.activo && (
                      <Pressable
                        onPress={() => manejarDefinirActivo(planSeleccionado)}
                        style={styles.makeActiveBtn}
                      >
                        <Ionicons name="sparkles-outline" size={14} color={planSeleccionado.color} />
                        <Text style={[styles.makeActiveBtnText, { color: planSeleccionado.color }]}>
                          Hacer activo
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* LISTA DE RUTINAS DEL PLAN */}
              <View style={{ gap: 10, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.routinesSectionTitle}>
                    {planSeleccionado ? 'RUTINAS DEL PLAN' : 'RUTINAS LIBRES'} ({rutinasFiltradas.length})
                  </Text>
                </View>

                {rutinasFiltradas.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Ionicons name="barbell-outline" size={30} color={colores.suave} />
                    <Text style={styles.emptyTitle}>
                      {busqueda.trim() ? 'No hay rutinas que coincidan' : 'Este plan aún no tiene rutinas'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {busqueda.trim()
                        ? `No encontramos coincidencias para "${busqueda}".`
                        : 'Añade tu primera rutina con ejercicios, series, cargas y día sugerido.'}
                    </Text>
                    {!busqueda.trim() && (
                      <BotonRutinia
                        titulo="+ Crear rutina en este plan"
                        variante="principal"
                        onPress={abrirCrearRutinaEnPlan}
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </View>
                ) : null}

                {rutinasFiltradas.map((r) => {
                  const ejs = r.ejercicios_rutina || [];
                  const numEjercicios = ejs.length;
                  const totalSeries = ejs.reduce((sum, e) => sum + (e.series || 1), 0);
                  const primerosTres = ejs.slice(0, 3);
                  const restantes = numEjercicios - 3;

                  return (
                    <View key={r.id} style={styles.routineCard}>
                      {/* Fila Superior: Nombre y Acciones */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.routineNameText} numberOfLines={1}>
                            {r.nombre}
                          </Text>
                          <Text style={styles.routineMetaText}>
                            {numEjercicios} {numEjercicios === 1 ? 'ejercicio' : 'ejercicios'} • {totalSeries} series
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Pressable
                            onPress={() => abrirEditarRutina(r)}
                            style={styles.actionIconBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="create-outline" size={16} color={colores.texto} />
                          </Pressable>
                          <Pressable
                            onPress={() => clonarRutina(r)}
                            style={styles.actionIconBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="copy-outline" size={16} color={colores.texto} />
                          </Pressable>
                          <Pressable
                            onPress={() => setRutinaParaMover(r)}
                            style={styles.actionIconBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="swap-horizontal-outline" size={16} color={colores.texto} />
                          </Pressable>
                          <Pressable
                            onPress={() => confirmarEliminarRutina(r)}
                            style={styles.actionIconDangerBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={16} color={colores.peligro} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Selector Rápido de Día Sugerido: L M X J V S D */}
                      <View style={styles.daySelectorRow}>
                        <Text style={styles.daySelectorLabel}>Día sugerido:</Text>
                        <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                          {DIAS_SEMANA_ABREV.map((letra, diaIdx) => {
                            const asignado = r.dia_sugerido === diaIdx;
                            const colorPlan = planSeleccionado?.color || colores.primarioHover;
                            return (
                              <Pressable
                                key={diaIdx}
                                onPress={() => cambiarDiaSugeridoRutina(r, diaIdx)}
                                style={[
                                  styles.dayPickerPill,
                                  asignado && {
                                    backgroundColor: colorPlan,
                                    borderColor: colorPlan,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dayPickerPillText,
                                    asignado && { color: '#FFF', fontFamily: fuentes.black },
                                  ]}
                                >
                                  {letra}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Vista Previa de Primeros 3 Ejercicios */}
                      {numEjercicios > 0 && (
                        <View style={styles.previewExercisesBox}>
                          {primerosTres.map((ej) => {
                            const nombreLimpio = ej.nombre.replace(/\s*\(.*\)$/, '').trim();
                            return (
                              <View key={ej.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                  name="fitness-outline"
                                  size={13}
                                  color={planSeleccionado?.color || colores.primarioHover}
                                />
                                <Text style={styles.previewExerciseText} numberOfLines={1}>
                                  {nombreLimpio}
                                </Text>
                                <Text style={styles.previewExerciseSeries}>
                                  {ej.series || 1}s
                                </Text>
                              </View>
                            );
                          })}
                          {restantes > 0 && (
                            <Text style={styles.previewExerciseMore}>
                              + {restantes} {restantes === 1 ? 'ejercicio más' : 'ejercicios más'}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        {/* DOCK DEL BOTÓN PRINCIPAL */}
        <DockPrincipal>
          {planSeleccionado ? (
            <BotonRutinia
              titulo="+ Nueva rutina en este plan"
              variante="principal"
              onPress={abrirCrearRutinaEnPlan}
              style={{ alignSelf: 'stretch' }}
            />
          ) : viendoSinPlan ? (
            <BotonRutinia
              titulo="+ Nueva rutina"
              variante="principal"
              onPress={abrirCrearRutinaEnPlan}
              style={{ alignSelf: 'stretch' }}
            />
          ) : (
            <BotonRutinia
              titulo="+ Nuevo plan"
              variante="principal"
              onPress={abrirCrearPlan}
              style={{ alignSelf: 'stretch' }}
            />
          )}
        </DockPrincipal>

        {/* MODAL CREAR / EDITAR PLAN */}
        <GestionarPlanModal
          visible={modalPlanVisible}
          planParaEditar={planParaEditar}
          onClose={() => setModalPlanVisible(false)}
          onGuardar={guardarPlan}
        />

        {/* MODAL ELIMINAR PLAN (Con 3 opciones) */}
        <EliminarPlanModal
          visible={modalEliminarPlanVisible}
          plan={planParaEliminar}
          otrosPlanes={planes.filter((p) => p.id !== planParaEliminar?.id)}
          onClose={() => setModalEliminarPlanVisible(false)}
          onArchivarEnLugarDeEliminar={async (id) => {
            const p = planes.find((x) => x.id === id);
            if (p) await manejarArchivarPlan(p);
          }}
          onConfirmarEliminar={ejecutarEliminarPlan}
        />

        {/* MODAL APLICAR PLAN A LA SEMANA */}
        <AplicarPlanSemanaModal
          visible={modalAplicarVisible}
          plan={planSeleccionado}
          onClose={() => setModalAplicarVisible(false)}
          onAplicado={(res) => {
            mostrarMensaje(
              '¡Plan Aplicado a tu Semana!',
              `Se asignaron ${res.aplicadas} ${res.aplicadas === 1 ? 'rutina' : 'rutinas'} a tu calendario.${
                res.omitidas > 0 ? ` (${res.omitidas} días conservaron su rutina previa)` : ''
              }`
            );
          }}
        />

        {/* MODAL GESTIONAR RUTINA (Nivel 3) */}
        <GestionarRutinaModal
          visible={modalRutinaVisible}
          rutinaParaEditar={rutinaParaEditar}
          planIdInicial={planSeleccionado ? planSeleccionado.id : null}
          onClose={() => setModalRutinaVisible(false)}
          onGuardado={cargarDatos}
        />

        {/* MODAL MOVER RUTINA A OTRO PLAN */}
        <Modal
          visible={!!rutinaParaMover}
          transparent
          animationType="fade"
          onRequestClose={() => setRutinaParaMover(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.moverModalCard, { maxWidth: contentMaxWidth }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.moverTitle}>Mover rutina a otro plan</Text>
                <Pressable onPress={() => setRutinaParaMover(null)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={colores.suave} />
                </Pressable>
              </View>

              <Text style={styles.moverSubtext}>
                Selecciona a qué plan deseas transferir &quot;{rutinaParaMover?.nombre}&quot;:
              </Text>

              <ScrollView style={{ maxHeight: 240, gap: 8 }}>
                {/* Opción Dejar sin plan */}
                <Pressable
                  onPress={() => rutinaParaMover && ejecutarMoverRutina(rutinaParaMover.id, null)}
                  style={[
                    styles.moverPlanOption,
                    rutinaParaMover?.plan_id === null && styles.moverPlanOptionActive,
                  ]}
                >
                  <Ionicons name="folder-outline" size={16} color={colores.suave} />
                  <Text style={styles.moverPlanName}>Dejar sin plan (libre)</Text>
                </Pressable>

                {planes
                  .filter((p) => !p.archivado)
                  .map((p) => {
                    const esActual = rutinaParaMover?.plan_id === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => rutinaParaMover && ejecutarMoverRutina(rutinaParaMover.id, p.id)}
                        style={[
                          styles.moverPlanOption,
                          esActual && styles.moverPlanOptionActive,
                        ]}
                      >
                        <View style={[styles.miniDot, { backgroundColor: p.color }]} />
                        <Text style={[styles.moverPlanName, esActual && { color: p.color, fontFamily: fuentes.bold }]}>
                          {p.nombre} {esActual ? '(Plan actual)' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* SNACKBAR DE DESHACER (6 SEGUNDOS) */}
        {undoItem && (
          <View style={[styles.undoSnackbarContainer, { bottom: Math.max(80, bottomInset + 75) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="trash-bin-outline" size={18} color={colores.peligro} />
              <View style={{ flex: 1 }}>
                <Text style={styles.undoTitleText} numberOfLines={1}>
                  Eliminando {undoItem.tipo} &quot;{undoItem.nombre}&quot;
                </Text>
                <Text style={styles.undoCountdownText}>
                  Se confirmará en {segundosRestantesUndo}s
                </Text>
              </View>
            </View>

            <Pressable
              onPress={undoItem.cancelar}
              style={styles.undoButton}
              hitSlop={8}
            >
              <Text style={styles.undoButtonText}>DESHACER</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  backNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButtonText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  headerActionSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
  },
  headerActionSmallText: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  headerActionDanger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
  },
  emptyStateCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
    marginTop: 8,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colores.primarioSuave,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  emptyTitle: {
    color: colores.texto,
    fontSize: 17,
    fontFamily: fuentes.black,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colores.suave,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fuentes.regular,
  },
  planCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  planIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  planTitle: {
    fontSize: 17,
    fontFamily: fuentes.black,
    color: colores.texto,
    flexShrink: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  planObjectiveText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
    marginTop: 2,
  },
  planDescText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  planStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  planStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planStatText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: colores.borde,
  },
  planActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(10, 12, 18, 0.5)',
  },
  actionPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionPillText: {
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  arrowSortBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  orphanPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.borde,
    marginTop: 4,
  },
  orphanIconBox: {
    width: 36,
    height: 36,
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
  orphanSubtitle: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  archivedSectionContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  archivedToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  archivedHeaderTitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  archivedPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  archivedPlanName: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.medium,
  },
  archivedRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  archivedRestoreText: {
    color: colores.exito,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  archivedDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  planDetailHeaderCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  detailTitleText: {
    color: colores.texto,
    fontSize: 20,
    fontFamily: fuentes.black,
  },
  detailObjectiveText: {
    color: colores.primarioHover,
    fontSize: 12,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
  detailDescText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  detailActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  makeActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  makeActiveBtnText: {
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  routinesSectionTitle: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  routineCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
  },
  routineNameText: {
    color: colores.texto,
    fontSize: 16,
    fontFamily: fuentes.bold,
  },
  routineMetaText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
    marginTop: 1,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  actionIconDangerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  daySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  daySelectorLabel: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  dayPickerPill: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPickerPillText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  previewExercisesBox: {
    backgroundColor: 'rgba(10, 12, 18, 0.6)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  previewExerciseText: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.medium,
    flex: 1,
  },
  previewExerciseSeries: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  previewExerciseMore: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  moverModalCard: {
    backgroundColor: '#0F121B',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 12,
  },
  moverTitle: {
    color: colores.texto,
    fontSize: 16,
    fontFamily: fuentes.black,
  },
  moverSubtext: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  moverPlanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colores.tarjetaSolida,
    borderWidth: 1,
    borderColor: colores.borde,
    marginVertical: 3,
  },
  moverPlanOptionActive: {
    borderColor: colores.primarioHover,
    backgroundColor: colores.primarioSuave,
  },
  moverPlanName: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.medium,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  undoSnackbarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1E2333',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.primarioHover,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  undoTitleText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  undoCountdownText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colores.primarioHover,
  },
  undoButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
});
