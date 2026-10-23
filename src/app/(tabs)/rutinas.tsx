import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import Head from 'expo-router/head';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Box, BoxShadow, rect, rrect } from '@shopify/react-native-skia';
import {
  DIAS_SEMANA_ABREV,
  DIAS_SEMANA_NOMBRES,
  fuentes,
  noir,
} from '../../constants/colores';
import ScreenBackground from '../../components/ScreenBackground';
import DockPrincipal from '../../components/DockPrincipal';
import ShinyText from '../../components/ShinyText';
import YoungNewtButton from '../../components/YoungNewtButton';
import GradientText from '../../components/GradientText';
import RutiniaLogo from '../../components/RutiniaLogo';
import { LiquidMetalButton } from '../../components/LiquidMetalButton';
import GestionarPlanModal from '../../components/GestionarPlanModal';
import EliminarPlanModal from '../../components/EliminarPlanModal';
import AplicarPlanSemanaModal from '../../components/AplicarPlanSemanaModal';
import GestionarRutinaModal from '../../components/GestionarRutinaModal';
import { supabase } from '../../lib/supabase';
import { subscribirCambioDatos } from '../../utils/sincronizacion';
import { diasDeSemana } from '../../utils/fechas';
import { vibrarBoton } from '../../utils/haptics';
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
} from '../../services/planes';
import { eliminarRutina } from '../../services/rutinas';
import { PlanEntrenamiento, Rutina } from '../../types';
import { useLayout } from '../../hooks/useLayout';
import { mostrarMensaje, seguro } from '../../utils/errores';

const TITLE_GRADIENT_COLORS = ['#F2F6FC', '#C9D1DD', '#FFFFFF', '#C9D1DD', '#F2F6FC'];
const DANGER = '#F08A9B';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ActionSheetAction = {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

function truncarTexto(texto: string, max: number) {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

function programarAccion(fn: () => void) {
  setTimeout(fn, 160);
}

function PearlButton({
  label,
  onPress,
  icon,
  compact = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IoniconName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        vibrarBoton();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pearlButton,
        compact && styles.pearlButtonCompact,
        pressed && styles.pressedSoft,
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['#FFFFFF', '#EDF3FA', '#DCE8F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.pearlButtonFill]}
      />
      {icon && !compact ? (
        <View style={styles.pearlButtonOrb}>
          <Ionicons name={icon} size={12} color={noir.pearl} />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.pearlButtonText, compact && styles.pearlButtonTextCompact]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function IconGlassButton({
  name,
  onPress,
  size = 34,
  danger = false,
  label,
  style,
}: {
  name: IoniconName;
  onPress: () => void;
  size?: number;
  danger?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const iconSize = size <= 26 ? 12 : size <= 31 ? 14 : 16;
  return (
    <Pressable
      onPress={() => {
        vibrarBoton();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconGlassButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        danger && styles.iconGlassButtonDanger,
        pressed && styles.pressedSoft,
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize} color={danger ? DANGER : noir.platinum} />
    </Pressable>
  );
}

function GlassSurface({
  children,
  style,
  contentStyle,
  dashed = false,
  hairline = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dashed?: boolean;
  hairline?: boolean;
}) {
  return (
    <View style={[styles.glassSurface, dashed && styles.glassSurfaceDashed, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(18, 20, 26, 0.94)', 'rgba(10, 11, 15, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {hairline ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(255, 255, 255, 0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.glassHairline}
        />
      ) : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

function PlanHeroShell({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isWeb = Platform.OS === 'web';

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    );
  };

  return (
    <View
      onLayout={handleLayout}
      style={[styles.planHeroBase, isWeb && styles.planHeroWeb, style]}
    >
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 20, 20)}
            color="rgb(15, 15, 15)"
          >
            <BoxShadow dx={0} dy={0} blur={28} color="rgba(226, 239, 255, 0.52)" />
            <BoxShadow
              dx={0}
              dy={0}
              blur={50}
              color="rgba(226, 239, 255, 0.24)"
              inner
            />
          </Box>
        </Canvas>
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(255, 255, 255, 0.16)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.planHeroHairline}
      />

      <View style={[styles.planHeroContent, contentStyle]}>{children}</View>
    </View>
  );
}

function StatStrip({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View style={styles.statStrip}>
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <View style={styles.statDividerLine} /> : null}
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

function PlanShinyTitle({ text, compact }: { text: string; compact: boolean }) {
  const { contentMaxWidth, gutter } = useLayout();
  const fontSize = compact ? 23 : 26;
  const availableWidth = Math.max(120, contentMaxWidth - gutter * 2 - 28);
  const maxChars = Math.max(
    12,
    Math.min(36, Math.floor(availableWidth / (fontSize * 0.56)))
  );
  const display = truncarTexto(text, maxChars);
  const webStyle =
    Platform.OS === 'web'
      ? ({
          width: '100%',
          display: 'block',
          fontSize,
          fontFamily: fuentes.bold,
          fontWeight: 700,
          lineHeight: `${fontSize * 1.3}px`,
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as any)
      : undefined;

  return (
    <View style={[styles.planShinyTitleWrap, { height: fontSize * 1.4 }]}>
      <ShinyText
        text={display}
        fontSize={fontSize}
        fontFamily={fuentes.bold}
        align="left"
        width="100%"
        height={fontSize * 1.4}
        color={noir.platinum}
        shineColor={noir.pearl}
        speed={5.6}
        style={webStyle}
      />
    </View>
  );
}

function WeekStrip({
  days,
  plannedDays,
  todayIndex,
}: {
  days: Date[];
  plannedDays: Set<number>;
  todayIndex: number;
}) {
  return (
    <View style={styles.weekStrip}>
      {days.map((day, index) => {
        const active = index === todayIndex;
        const planned = plannedDays.has(index);
        const dayName = DIAS_SEMANA_NOMBRES[index].slice(0, 3).toUpperCase();
        return (
          <View
            key={index}
            accessible
            accessibilityLabel={`${DIAS_SEMANA_NOMBRES[index]} ${day.getDate()}${
              active ? ', hoy' : ''
            }${planned ? ', día con rutina' : ''}`}
            style={[
              styles.weekDay,
              planned && !active && styles.weekDayPlanned,
              active && styles.weekDayActive,
            ]}
          >
            {active ? (
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.weekDayActiveFill]}
              />
            ) : null}
            <Text style={[styles.weekDayName, active && styles.weekDayTextActive]}>
              {dayName}
            </Text>
            <Text style={[styles.weekDayNumber, active && styles.weekDayTextActive]}>
              {day.getDate()}
            </Text>
            <View
              style={[
                styles.weekDayDot,
                planned && styles.weekDayDotPlanned,
                active && styles.weekDayDotActive,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function ActionSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: ActionSheetAction[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
        <View style={styles.actionSheetCard}>
          <View style={styles.actionSheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionSheetTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.actionSheetSubtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <IconGlassButton name="close" size={31} onPress={onClose} label="Cerrar menú" />
          </View>

          <View style={styles.actionSheetList}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                disabled={action.disabled}
                onPress={() => {
                  if (action.disabled) return;
                  vibrarBoton();
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.actionSheetRow,
                  pressed && !action.disabled && styles.actionSheetRowPressed,
                  action.disabled && styles.actionSheetRowDisabled,
                ]}
              >
                <View
                  style={[
                    styles.actionSheetIcon,
                    action.danger && styles.actionSheetIconDanger,
                  ]}
                >
                  <Ionicons
                    name={action.icon}
                    size={16}
                    color={action.danger ? DANGER : noir.platinum}
                  />
                </View>
                <Text
                  style={[styles.actionSheetLabel, action.danger && { color: DANGER }]}
                >
                  {action.label}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={noir.muted2} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RutinasScreen() {
  const { gutter, contentMaxWidth, safeBottom, isLandscape, isCompact } = useLayout();
  const isFocused = useIsFocused();

  // Estados de datos
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [rutinasDelPlan, setRutinasDelPlan] = useState<Rutina[]>([]);
  const [rutinasSueltas, setRutinasSueltas] = useState<Rutina[]>([]);
  const [cargando, setCargando] = useState(true);

  // Navegación de niveles: null = Nivel 1 (Lista de planes), PlanEntrenamiento = Nivel 2 (Detalle del plan)
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanEntrenamiento | null>(null);
  const [viendoSinPlan, setViendoSinPlan] = useState(false);

  // Buscador principal y buscador colapsable del detalle
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDetalleVisible, setBusquedaDetalleVisible] = useState(false);

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

  // Menús de acciones
  const [planParaAcciones, setPlanParaAcciones] = useState<{
    plan: PlanEntrenamiento;
    indice: number;
  } | null>(null);
  const [rutinaParaAcciones, setRutinaParaAcciones] = useState<Rutina | null>(null);

  // Snackbar de Deshacer (6 segundos)
  const [undoItem, setUndoItem] = useState<{
    tipo: 'rutina' | 'plan';
    nombre: string;
    cancelar: () => void;
  } | null>(null);
  const [segundosRestantesUndo, setSegundosRestantesUndo] = useState(6);
  const undoTimerRef = useRef<any>(null);
  const undoIntervalRef = useRef<any>(null);

  // Menú de cuenta
  const [avatarInicial, setAvatarInicial] = useState('A');
  const [emailCuenta, setEmailCuenta] = useState('');
  const [menuCuentaVisible, setMenuCuentaVisible] = useState(false);

  // Referencias para evitar condiciones de carrera o closures obsoletas al cambiar de nivel
  const planSeleccionadoRef = useRef<PlanEntrenamiento | null>(null);
  const viendoSinPlanRef = useRef<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);

  const diasSemanaActuales = useMemo(() => diasDeSemana(new Date()), []);
  const hoyIdx = (new Date().getDay() + 6) % 7;

  const totalSeriesPlan = useMemo(
    () =>
      rutinasDelPlan.reduce(
        (sum, r) =>
          sum + (r.ejercicios_rutina || []).reduce((s, e) => s + (e.series || 1), 0),
        0
      ),
    [rutinasDelPlan]
  );

  const totalSeriesSueltas = useMemo(
    () =>
      rutinasSueltas.reduce(
        (sum, r) =>
          sum + (r.ejercicios_rutina || []).reduce((s, e) => s + (e.series || 1), 0),
        0
      ),
    [rutinasSueltas]
  );

  useEffect(() => {
    planSeleccionadoRef.current = planSeleccionado;
  }, [planSeleccionado]);

  useEffect(() => {
    viendoSinPlanRef.current = viendoSinPlan;
  }, [viendoSinPlan]);

  useEffect(() => {
    seguro(async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const nombre =
        (user?.user_metadata?.nombre as string | undefined) ||
        user?.email?.split('@')[0] ||
        'Atleta';
      setAvatarInicial(nombre.charAt(0).toUpperCase());
      setEmailCuenta(user?.email || '');
    });
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, []);

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
    setBusquedaDetalleVisible(false);
    cargarDatos(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
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

  useEffect(() => {
    const unsub = subscribirCambioDatos(() => {
      cargarDatos();
    });
    return unsub;
  }, [cargarDatos]);

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
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    let cancelado = false;
    setSegundosRestantesUndo(6);
    setUndoItem({
      tipo,
      nombre,
      cancelar: () => {
        cancelado = true;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
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
    undoIntervalRef.current = interval;

    undoTimerRef.current = setTimeout(async () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      if (!cancelado) {
        setUndoItem(null);
        await onConfirmarDefinitivo();
      }
    }, 6000);
  };

  const cerrarSesion = () => {
    setMenuCuentaVisible(false);
    seguro(async () => {
      await supabase.auth.signOut();
    });
  };

  const toggleBusquedaDetalle = () => {
    setBusquedaDetalleVisible((visible) => {
      if (visible) setBusqueda('');
      return !visible;
    });
  };

  const abrirAccionesPlan = (p: PlanEntrenamiento) => {
    const indice = planes.filter((item) => !item.archivado).findIndex((item) => item.id === p.id);
    setPlanParaAcciones({ plan: p, indice: Math.max(0, indice) });
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
      mostrarMensaje('Plan Archivado', `El plan "${p.nombre}" se archivó correctamente.`);
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
    setBusqueda('');
    setBusquedaDetalleVisible(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    await guardarUltimoPlanUsadoId(p.id);
    const ruts = await listarRutinasDePlan(p.id);
    setRutinasDelPlan(ruts);
  };

  const seleccionarSinPlan = async () => {
    planSeleccionadoRef.current = null;
    viendoSinPlanRef.current = true;
    setPlanSeleccionado(null);
    setViendoSinPlan(true);
    setBusqueda('');
    setBusquedaDetalleVisible(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
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
    // Actualización optimista inmediata en la lista activa (plan o rutinas libres)
    setRutinasDelPlan((prev) =>
      prev.map((item) => (item.id === r.id ? { ...item, dia_sugerido: nuevoDia } : item))
    );
    setRutinasSueltas((prev) =>
      prev.map((item) => (item.id === r.id ? { ...item, dia_sugerido: nuevoDia } : item))
    );
    await seguro(async () => {
      await definirDiaSugerido(r.id, nuevoDia);
      await cargarDatos();
    });
  };

  const confirmarEliminarRutina = (r: Rutina) => {
    const enPlan = Boolean(planSeleccionado);
    const rutinasActuales = enPlan ? rutinasDelPlan : rutinasSueltas;
    const rutinasPrevias = [...rutinasActuales];
    const actualizarLista = (lista: Rutina[]) => {
      if (enPlan) setRutinasDelPlan(lista);
      else setRutinasSueltas(lista);
    };

    // Actualización optimista inmediata
    actualizarLista(rutinasActuales.filter((item) => item.id !== r.id));

    dispararUndoSnackbar(
      'rutina',
      r.nombre,
      async () => {
        try {
          await eliminarRutina(r.id);
          await cargarDatos();
        } catch (err: any) {
          actualizarLista(rutinasPrevias);
          mostrarMensaje('Error', err?.message || 'No se pudo eliminar la rutina.');
        }
      },
      () => {
        actualizarLista(rutinasPrevias);
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
  const planesNoArchivados = planes.filter((p) => !p.archivado);
  const query = busqueda.trim().toLowerCase();

  const planesFiltrados = planesNoArchivados.filter((p) => {
    if (!query) return true;
    return (
      p.nombre.toLowerCase().includes(query) ||
      Boolean(p.objetivo?.toLowerCase().includes(query)) ||
      Boolean(p.descripcion?.toLowerCase().includes(query))
    );
  });

  const planDestacado =
    planesFiltrados.find((p) => p.activo) ?? planesFiltrados[0] ?? null;

  const planesSecundarios = planDestacado
    ? planesFiltrados.filter((p) => p.id !== planDestacado.id)
    : [];

  const totalRutinasGlobal =
    planesNoArchivados.reduce((sum, p) => sum + (p.totalRutinas || 0), 0) +
    rutinasSueltas.length;
  const totalActivosGlobal = planesNoArchivados.filter((p) => p.activo).length;

  const rutinasBase = planSeleccionado ? rutinasDelPlan : rutinasSueltas;

  const rutinasFiltradas = rutinasBase.filter((r) => {
    if (!query) return true;
    const matchRutina = r.nombre.toLowerCase().includes(query);
    const matchEj = r.ejercicios_rutina?.some((e) => e.nombre.toLowerCase().includes(query));
    return matchRutina || matchEj;
  });

  const diasPlanificados = new Set(
    rutinasBase
      .map((r) => r.dia_sugerido)
      .filter((dia): dia is number => typeof dia === 'number')
  );

  const totalSeriesDetalle = planSeleccionado ? totalSeriesPlan : totalSeriesSueltas;
  const diasDetalle = diasPlanificados.size || (planSeleccionado?.diasPorSemana ?? 0);
  const metalActivo =
    isFocused &&
    !menuCuentaVisible &&
    !modalPlanVisible &&
    !modalEliminarPlanVisible &&
    !modalAplicarVisible &&
    !modalRutinaVisible &&
    !rutinaParaMover &&
    !planParaAcciones &&
    !rutinaParaAcciones;

  /* eslint-disable react-hooks/refs -- las acciones se ejecutan en callbacks, nunca durante el render */
  const accionesPlan: ActionSheetAction[] = [];
  if (planParaAcciones) {
    const targetPlan = planParaAcciones.plan;
    const indice = planParaAcciones.indice;

    accionesPlan.push({
      label: 'Editar plan',
      icon: 'create-outline',
      onPress: () => {
        setPlanParaAcciones(null);
        programarAccion(() => abrirEditarPlan(targetPlan));
      },
    });

    if (!targetPlan.activo) {
      accionesPlan.push({
        label: 'Activar plan',
        icon: 'flash-outline',
        onPress: () => {
          setPlanParaAcciones(null);
          programarAccion(() => manejarDefinirActivo(targetPlan));
        },
      });
    }

    if (indice > 0) {
      accionesPlan.push({
        label: 'Mover hacia arriba',
        icon: 'arrow-up-outline',
        onPress: () => {
          setPlanParaAcciones(null);
          moverPlanOrden(indice, 'arriba');
        },
      });
    }

    if (indice < planesNoArchivados.length - 1) {
      accionesPlan.push({
        label: 'Mover hacia abajo',
        icon: 'arrow-down-outline',
        onPress: () => {
          setPlanParaAcciones(null);
          moverPlanOrden(indice, 'abajo');
        },
      });
    }

    accionesPlan.push({
      label: 'Archivar plan',
      icon: 'archive-outline',
      onPress: () => {
        setPlanParaAcciones(null);
        programarAccion(() => manejarArchivarPlan(targetPlan));
      },
    });

    accionesPlan.push({
      label: 'Eliminar plan',
      icon: 'trash-outline',
      danger: true,
      onPress: () => {
        setPlanParaAcciones(null);
        programarAccion(() => confirmarEliminarPlan(targetPlan));
      },
    });
  }

  const accionesRutina: ActionSheetAction[] = [];
  if (rutinaParaAcciones) {
    const targetRutina = rutinaParaAcciones;

    accionesRutina.push({
      label: 'Editar rutina',
      icon: 'create-outline',
      onPress: () => {
        setRutinaParaAcciones(null);
        programarAccion(() => abrirEditarRutina(targetRutina));
      },
    });

    accionesRutina.push({
      label: 'Duplicar rutina',
      icon: 'copy-outline',
      onPress: () => {
        setRutinaParaAcciones(null);
        programarAccion(() => clonarRutina(targetRutina));
      },
    });

    accionesRutina.push({
      label: 'Mover a otro plan',
      icon: 'swap-horizontal-outline',
      onPress: () => {
        setRutinaParaAcciones(null);
        programarAccion(() => setRutinaParaMover(targetRutina));
      },
    });

    accionesRutina.push({
      label: 'Eliminar rutina',
      icon: 'trash-outline',
      danger: true,
      onPress: () => {
        setRutinaParaAcciones(null);
        programarAccion(() => confirmarEliminarRutina(targetRutina));
      },
    });
  }
  /* eslint-enable react-hooks/refs */

  return (
    <ScreenBackground>
      <Head>
        <title>
          {planSeleccionado ? `${planSeleccionado.nombre} · Rutinia` : 'Planes & Rutinas · Rutinia'}
        </title>
      </Head>
      <SafeAreaView edges={['top']} style={styles.screen}>
        {menuCuentaVisible ? (
          <Pressable
            style={styles.accountScrim}
            onPress={() => setMenuCuentaVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de cuenta"
          />
        ) : null}

        {/* CABECERA: MARCA (SOLO EN DETALLE) + AVATAR */}
        <View
          style={[
            styles.headerOuter,
            {
              paddingHorizontal: gutter,
              maxWidth: contentMaxWidth,
              marginBottom: isLandscape ? 6 : 12,
            },
          ]}
        >
          <View
            style={[
              styles.headerWrap,
              { justifyContent: 'space-between' },
            ]}
          >
            <View style={styles.brandLockup}>
              <RutiniaLogo size={30} />

              <View style={styles.brandWordmark}>
                <GradientText
                  colors={TITLE_GRADIENT_COLORS}
                  animationSpeed={8}
                  direction="horizontal"
                  scale={3}
                  style={{
                    fontSize: isCompact ? 19 : 21,
                    lineHeight: 24,
                    fontFamily: fuentes.extraBold,
                    letterSpacing: -0.55,
                  }}
                >
                  Rutinas
                </GradientText>
                <View style={styles.brandDotSmall} />
              </View>
            </View>

            <View style={styles.avatarWrap}>
              <Pressable
                onPress={() => setMenuCuentaVisible((visible) => !visible)}
                style={({ pressed }) => [
                  styles.avatarButton,
                  pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Abrir menú de cuenta"
              >
                <LinearGradient
                  colors={['#232631', '#13151B']}
                  start={{ x: 0.3, y: 0.1 }}
                  end={{ x: 0.7, y: 0.95 }}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarText}>{avatarInicial}</Text>
                </LinearGradient>
              </Pressable>
              <View pointerEvents="none" style={styles.avatarStatus} />
            </View>

            {menuCuentaVisible && (
              <View style={styles.accountMenu}>
                <Text style={styles.accountMenuLabel}>CUENTA</Text>
                <Text numberOfLines={1} style={styles.accountMenuEmail}>
                  {emailCuenta || 'Sesión activa'}
                </Text>
                <View style={styles.accountMenuDivider} />
                <Pressable
                  onPress={cerrarSesion}
                  style={({ pressed }) => [
                    styles.accountMenuLogout,
                    pressed && { opacity: 0.68 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar sesión"
                >
                  <Ionicons name="log-out-outline" size={15} color={noir.platinum} />
                  <Text style={styles.accountMenuLogoutText}>Cerrar sesión</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: gutter,
              maxWidth: contentMaxWidth,
              paddingBottom: (isLandscape ? 128 : 168) + safeBottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!planSeleccionado && !viendoSinPlan ? (
            <>
              {/* SALUDO EDITORIAL */}
              <View style={styles.greeting}>
                <View style={styles.eyebrowRow}>
                  <View style={styles.eyebrowDot} />
                  <Text style={styles.eyebrowText}>SISTEMA DE ENTRENAMIENTO</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.greetingTitle,
                    {
                      fontSize: isLandscape ? 22 : isCompact ? 23 : 26,
                      lineHeight: isLandscape ? 25 : isCompact ? 27 : 30,
                    },
                  ]}
                >
                  Planes & Rutinas
                </Text>
                <Text style={styles.greetingStats} numberOfLines={2}>
                  <Text style={styles.greetingStatsStrong}>
                    {planesNoArchivados.length}{' '}
                    {planesNoArchivados.length === 1 ? 'plan' : 'planes'}
                  </Text>
                  <Text style={styles.greetingStatsDot}>  ·  </Text>
                  <Text style={styles.greetingStatsStrong}>
                    {totalRutinasGlobal} {totalRutinasGlobal === 1 ? 'rutina' : 'rutinas'}
                  </Text>
                  <Text style={styles.greetingStatsDot}>  ·  </Text>
                  <Text style={styles.greetingStatsStrong}>
                    {totalActivosGlobal}{' '}
                    {totalActivosGlobal === 1 ? 'activo' : 'activos'}
                  </Text>
                </Text>
              </View>

              {/* BUSCADOR */}
              <View style={styles.searchBarBox}>
                <Ionicons name="search-outline" size={16} color={noir.muted} />
                <TextInput
                  placeholder="Buscar plan o rutina..."
                  placeholderTextColor={noir.muted2}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  inputMode="search"
                  keyboardType="default"
                  returnKeyType="search"
                  enterKeyHint="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  selectionColor={noir.ice}
                  style={styles.searchInput}
                />
                {busqueda.length > 0 ? (
                  <Pressable
                    onPress={() => setBusqueda('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                  >
                    <Ionicons name="close-circle" size={17} color={noir.muted2} />
                  </Pressable>
                ) : null}
              </View>

              {cargando && planes.length === 0 ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={noir.platinum} />
                  <Text style={styles.loadingText}>Cargando planes...</Text>
                </View>
              ) : (
                <>
                  {planDestacado ? (
                    <PlanHeroShell contentStyle={styles.planHeroStack}>
                      <View style={styles.heroTopRow}>
                        <LinearGradient
                          colors={['rgba(92, 200, 255, 0.22)', 'rgba(92, 200, 255, 0.05)']}
                          start={{ x: 0.2, y: 0.1 }}
                          end={{ x: 0.8, y: 0.95 }}
                          style={styles.heroIconTile}
                        >
                          <Ionicons
                            name={(planDestacado.icono || 'barbell-outline') as IoniconName}
                            size={isCompact ? 20 : 22}
                            color={noir.info}
                          />
                        </LinearGradient>

                        <View style={styles.heroTopCopy}>
                          <View style={styles.heroMetaRow}>
                            <View
                              style={[
                                styles.heroStatusDot,
                                planDestacado.activo
                                  ? styles.heroStatusDotActive
                                  : styles.heroStatusDotIdle,
                              ]}
                            />
                            <Text style={styles.heroKicker}>
                              {planDestacado.activo ? 'PLAN ACTIVO' : 'PLAN'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.heroTopActions}>
                          <IconGlassButton
                            name="create-outline"
                            size={31}
                            onPress={() => abrirEditarPlan(planDestacado)}
                            label={`Editar ${planDestacado.nombre}`}
                          />
                          <IconGlassButton
                            name="ellipsis-horizontal"
                            size={31}
                            onPress={() => abrirAccionesPlan(planDestacado)}
                            label={`Opciones de ${planDestacado.nombre}`}
                          />
                        </View>
                      </View>

                      <PlanShinyTitle text={planDestacado.nombre} compact={isCompact} />

                      <Text style={styles.heroObjectiveLine} numberOfLines={2}>
                        <Text style={styles.heroObjectiveStrong}>
                          {planDestacado.objetivo || 'Entrenamiento estructurado'}
                        </Text>
                        <Text style={styles.heroObjectiveMuted}>
                          {`  ·  ${planDestacado.totalRutinas || 0} ${
                            (planDestacado.totalRutinas || 0) === 1 ? 'rutina' : 'rutinas'
                          }`}
                        </Text>
                      </Text>

                      <StatStrip
                        items={[
                          {
                            value: String(planDestacado.totalRutinas || 0),
                            label: 'Rutinas',
                          },
                          {
                            value: planDestacado.diasPorSemana
                              ? String(planDestacado.diasPorSemana)
                              : '—',
                            label: 'Días / sem',
                          },
                          {
                            value: planDestacado.activo ? 'Activo' : 'Plan',
                            label: 'Estado',
                          },
                        ]}
                      />

                      <View style={styles.heroOpenRow}>
                        <PearlButton
                          label="Abrir plan"
                          icon="chevron-forward"
                          onPress={() => seleccionarPlan(planDestacado)}
                          style={styles.heroOpenButton}
                        />
                        {!planDestacado.activo ? (
                          <PearlButton
                            compact
                            label="Activar"
                            onPress={() => manejarDefinirActivo(planDestacado)}
                          />
                        ) : null}
                      </View>
                    </PlanHeroShell>
                  ) : (
                    <GlassSurface style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
                      <View style={styles.emptyIconCircle}>
                        <Ionicons
                          name={query ? 'search-outline' : 'calendar-outline'}
                          size={24}
                          color={noir.platinum}
                        />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {query ? 'No encontramos planes' : 'Sin planes todavía'}
                      </Text>
                      <Text style={styles.emptySubtitle}>
                        {query
                          ? `No hay planes que coincidan con “${busqueda.trim()}”.`
                          : 'Agrupa tus rutinas en planes con días sugeridos, objetivos y periodización.'}
                      </Text>
                      {!query ? (
                        <PearlButton
                          label="Crear mi primer plan"
                          icon="add"
                          onPress={abrirCrearPlan}
                          style={{ marginTop: 4 }}
                        />
                      ) : null}
                    </GlassSurface>
                  )}

                  {planesSecundarios.map((p) => {
                    const rutsCount = p.totalRutinas || 0;
                    const diasPorSemana = p.diasPorSemana || 0;

                    return (
                      <GlassSurface key={p.id} style={styles.compactPlan} contentStyle={styles.compactPlanContent}>
                        <View style={styles.compactPlanRow}>
                          <Pressable
                            onPress={() => seleccionarPlan(p)}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir plan ${p.nombre}`}
                            style={({ pressed }) => [
                              styles.compactPlanMain,
                              pressed && styles.pressedSoft,
                            ]}
                          >
                            <View style={styles.compactPlanIcon}>
                              <Ionicons
                                name={(p.icono || 'barbell-outline') as IoniconName}
                                size={18}
                                color={noir.platinum}
                              />
                            </View>
                            <View style={styles.compactPlanCopy}>
                              <View style={styles.compactPlanNameRow}>
                                <Text style={styles.compactPlanName} numberOfLines={1}>
                                  {p.nombre}
                                </Text>
                              </View>
                              <Text style={styles.compactPlanMeta} numberOfLines={1}>
                                {rutsCount} {rutsCount === 1 ? 'rutina' : 'rutinas'} ·{' '}
                                {diasPorSemana > 0
                                  ? `${diasPorSemana} días/sem`
                                  : 'días flexibles'}
                              </Text>
                            </View>
                          </Pressable>

                          <View style={styles.compactPlanActions}>
                            {!p.activo ? (
                              <PearlButton
                                compact
                                label="Activar"
                                onPress={() => manejarDefinirActivo(p)}
                              />
                            ) : null}
                            <IconGlassButton
                              name="ellipsis-horizontal"
                              size={28}
                              onPress={() => abrirAccionesPlan(p)}
                              label={`Opciones de ${p.nombre}`}
                            />
                            {!isCompact ? (
                              <Pressable
                                onPress={() => seleccionarPlan(p)}
                                accessibilityRole="button"
                                accessibilityLabel={`Abrir plan ${p.nombre}`}
                                hitSlop={8}
                                style={({ pressed }) => [
                                  styles.compactChevron,
                                  pressed && styles.pressedSoft,
                                ]}
                              >
                                <Ionicons name="chevron-forward" size={16} color={noir.muted} />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      </GlassSurface>
                    );
                  })}

                  {rutinasSueltas.length > 0 ? (
                    <GlassSurface dashed style={styles.orphanCard} contentStyle={styles.orphanContent}>
                      <Pressable
                        onPress={seleccionarSinPlan}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir rutinas individuales"
                        style={({ pressed }) => [
                          styles.orphanPressable,
                          pressed && styles.pressedSoft,
                        ]}
                      >
                        <View style={styles.orphanIconBox}>
                          <Ionicons name="folder-open-outline" size={18} color={noir.platinum} />
                        </View>
                        <View style={styles.orphanCopy}>
                          <Text style={styles.orphanTitle}>Rutinas individuales</Text>
                          <Text style={styles.orphanSubtitle} numberOfLines={2}>
                            {rutinasSueltas.length}{' '}
                            {rutinasSueltas.length === 1 ? 'rutina libre' : 'rutinas libres'} · Toca
                            para verlas o moverlas a un plan
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={noir.muted} />
                      </Pressable>
                    </GlassSurface>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              {/* NAVEGACIÓN DE DETALLE */}
              <View style={styles.detailNavRow}>
                <Pressable
                  onPress={volverATodosLosPlanes}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a todos los planes"
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.backPill,
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <Ionicons name="chevron-back" size={16} color={noir.platinum} />
                  <Text style={styles.backPillText}>Planes</Text>
                </Pressable>

                {planSeleccionado ? (
                  <View style={styles.detailHeaderActions}>
                    <IconGlassButton
                      name="create-outline"
                      size={31}
                      onPress={() => abrirEditarPlan(planSeleccionado)}
                      label="Editar plan"
                    />
                    <IconGlassButton
                      name="archive-outline"
                      size={31}
                      onPress={() => manejarArchivarPlan(planSeleccionado)}
                      label="Archivar plan"
                    />
                    <IconGlassButton
                      name="trash-outline"
                      size={31}
                      danger
                      onPress={() => confirmarEliminarPlan(planSeleccionado)}
                      label="Eliminar plan"
                    />
                  </View>
                ) : null}
              </View>

              {planSeleccionado ? (
                <PlanHeroShell contentStyle={styles.planHeroStack}>
                  <View style={styles.heroTopRow}>
                    <LinearGradient
                      colors={['rgba(92, 200, 255, 0.22)', 'rgba(92, 200, 255, 0.05)']}
                      start={{ x: 0.2, y: 0.1 }}
                      end={{ x: 0.8, y: 0.95 }}
                      style={styles.heroIconTile}
                    >
                      <Ionicons
                        name={(planSeleccionado.icono || 'barbell-outline') as IoniconName}
                        size={isCompact ? 20 : 22}
                        color={noir.info}
                      />
                    </LinearGradient>

                    <View style={styles.heroTopCopy}>
                      <View style={styles.heroMetaRow}>
                        <View
                          style={[
                            styles.heroStatusDot,
                            planSeleccionado.activo
                              ? styles.heroStatusDotActive
                              : styles.heroStatusDotIdle,
                          ]}
                        />
                        <Text style={styles.heroKicker}>
                          {planSeleccionado.activo ? 'PLAN ACTIVO' : 'PLAN'}
                        </Text>
                      </View>
                      <Text style={styles.heroKickerSoft}>PLAN DE ENTRENAMIENTO</Text>
                    </View>
                  </View>

                  <PlanShinyTitle text={planSeleccionado.nombre} compact={isCompact} />

                  <Text style={styles.heroObjectiveLine} numberOfLines={2}>
                    <Text style={styles.heroObjectiveStrong}>
                      {planSeleccionado.objetivo || 'Sin objetivo asignado'}
                    </Text>
                    <Text style={styles.heroObjectiveMuted}>
                      {`  ·  ${rutinasDelPlan.length} ${
                        rutinasDelPlan.length === 1 ? 'rutina' : 'rutinas'
                      }`}
                    </Text>
                  </Text>

                  {planSeleccionado.descripcion ? (
                    <Text style={styles.planDescription} numberOfLines={3}>
                      {planSeleccionado.descripcion}
                    </Text>
                  ) : null}

                  <StatStrip
                    items={[
                      { value: String(rutinasDelPlan.length), label: 'Rutinas' },
                      { value: diasDetalle > 0 ? String(diasDetalle) : '—', label: 'Días / sem' },
                      { value: String(totalSeriesDetalle), label: 'Series' },
                    ]}
                  />

                  <WeekStrip
                    days={diasSemanaActuales}
                    plannedDays={diasPlanificados}
                    todayIndex={hoyIdx}
                  />

                  <View style={styles.planHeroActionsRow}>
                    <View style={styles.youngNewtWrap}>
                      <YoungNewtButton
                        title="Aplicar a mi semana"
                        fullWidth
                        onPress={() => setModalAplicarVisible(true)}
                      />
                    </View>
                    <IconGlassButton
                      name="ellipsis-horizontal"
                      size={34}
                      onPress={() => abrirAccionesPlan(planSeleccionado)}
                      label="Opciones del plan"
                    />
                  </View>

                  {!planSeleccionado.activo ? (
                    <Pressable
                      onPress={() => manejarDefinirActivo(planSeleccionado)}
                      accessibilityRole="button"
                      accessibilityLabel="Hacer activo este plan"
                      style={({ pressed }) => [
                        styles.makeActiveLink,
                        pressed && styles.pressedSoft,
                      ]}
                    >
                      <Ionicons name="sparkles-outline" size={13} color={noir.info} />
                      <Text style={styles.makeActiveLinkText}>Hacer activo</Text>
                    </Pressable>
                  ) : null}
                </PlanHeroShell>
              ) : (
                <GlassSurface style={styles.freeHeroCard} contentStyle={styles.freeHeroContent}>
                  <View style={styles.heroTopRow}>
                    <View style={styles.freeHeroIcon}>
                      <Ionicons name="folder-open-outline" size={21} color={noir.platinum} />
                    </View>
                    <View style={styles.heroTopCopy}>
                      <View style={styles.heroMetaRow}>
                        <View style={styles.heroStatusDotIdleSimple} />
                        <Text style={styles.heroKicker}>SIN PLAN</Text>
                      </View>
                      <Text style={styles.freeHeroTitle}>Rutinas libres</Text>
                    </View>
                  </View>

                  <Text style={styles.freeHeroText}>
                    Entrenamientos que no dependen de un plan. Muévelos a un plan cuando quieras.
                  </Text>

                  <StatStrip
                    items={[
                      { value: String(rutinasSueltas.length), label: 'Rutinas' },
                      { value: String(totalSeriesSueltas), label: 'Series' },
                      {
                        value: diasPlanificados.size > 0 ? String(diasPlanificados.size) : '—',
                        label: 'Días',
                      },
                    ]}
                  />
                </GlassSurface>
              )}

              <View style={styles.sectionHead}>
                <Text style={styles.sectionHeadLabel}>
                  {planSeleccionado ? 'RUTINAS DEL PLAN' : 'RUTINAS LIBRES'}
                </Text>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sectionHeadLine}
                />
                <Text style={styles.sectionHeadCount}>
                  {String(rutinasFiltradas.length).padStart(2, '0')}
                </Text>
                <Pressable
                  onPress={toggleBusquedaDetalle}
                  accessibilityRole="button"
                  accessibilityLabel={
                    busquedaDetalleVisible ? 'Cerrar búsqueda de rutinas' : 'Buscar rutinas'
                  }
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.sectionSearchButton,
                    busquedaDetalleVisible && styles.sectionSearchButtonActive,
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <Ionicons
                    name={busquedaDetalleVisible ? 'close' : 'search-outline'}
                    size={14}
                    color={busquedaDetalleVisible ? noir.text : noir.muted}
                  />
                </Pressable>
              </View>

              {busquedaDetalleVisible ? (
                <View style={styles.searchBarBox}>
                  <Ionicons name="search-outline" size={16} color={noir.muted} />
                  <TextInput
                    placeholder={
                      planSeleccionado
                        ? `Buscar rutina en "${planSeleccionado.nombre}"...`
                        : 'Buscar rutina...'
                    }
                    placeholderTextColor={noir.muted2}
                    value={busqueda}
                    onChangeText={setBusqueda}
                    inputMode="search"
                    keyboardType="default"
                    returnKeyType="search"
                    enterKeyHint="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                    selectionColor={noir.ice}
                    style={styles.searchInput}
                  />
                  {busqueda.length > 0 ? (
                    <Pressable
                      onPress={() => setBusqueda('')}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Limpiar búsqueda"
                    >
                      <Ionicons name="close-circle" size={17} color={noir.muted2} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {cargando && rutinasFiltradas.length === 0 ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={noir.platinum} />
                  <Text style={styles.loadingText}>Cargando rutinas...</Text>
                </View>
              ) : rutinasFiltradas.length === 0 ? (
                <GlassSurface style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name={query ? 'search-outline' : 'barbell-outline'}
                      size={24}
                      color={noir.platinum}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {query
                      ? 'No hay rutinas que coincidan'
                      : planSeleccionado
                        ? 'Este plan aún no tiene rutinas'
                        : 'Aún no tienes rutinas libres'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {query
                      ? `No encontramos coincidencias para “${busqueda.trim()}”.`
                      : 'Añade tu primera rutina con ejercicios, series, cargas y día sugerido.'}
                  </Text>
                  {!query ? (
                    <PearlButton
                      label="Crear rutina"
                      icon="add"
                      onPress={abrirCrearRutinaEnPlan}
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                </GlassSurface>
              ) : (
                <View style={styles.routinesList}>
                  {rutinasFiltradas.map((r, index) => {
                    const ejs = r.ejercicios_rutina || [];
                    const numEjercicios = ejs.length;
                    const totalSeries = ejs.reduce((sum, e) => sum + (e.series || 1), 0);
                    const primerosTres = ejs.slice(0, 3);
                    const restantes = numEjercicios - 3;
                    const dia = typeof r.dia_sugerido === 'number' ? r.dia_sugerido : null;
                    const diaNombre =
                      dia !== null
                        ? DIAS_SEMANA_NOMBRES[dia].slice(0, 3)
                        : null;
                    const esDeHoy = dia === hoyIdx;
                    const minutos = Math.max(25, Math.round(totalSeries * 2.5));

                    return (
                      <GlassSurface
                        key={r.id}
                        style={styles.routineCard}
                        contentStyle={styles.routineCardContent}
                      >
                        <View style={styles.routineHead}>
                          <View
                            style={[
                              styles.routineIndex,
                              esDeHoy && styles.routineIndexActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.routineIndexText,
                                esDeHoy && styles.routineIndexTextActive,
                              ]}
                            >
                              {String(index + 1).padStart(2, '0')}
                            </Text>
                          </View>

                          <View style={styles.routineHeadCopy}>
                            <View style={styles.routineNameRow}>
                              <Text style={styles.routineName} numberOfLines={1}>
                                {r.nombre}
                              </Text>
                              {diaNombre ? (
                                <View style={styles.routineDayBadge}>
                                  <Text style={styles.routineDayBadgeText}>{diaNombre}</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.routineMeta} numberOfLines={1}>
                              {numEjercicios}{' '}
                              {numEjercicios === 1 ? 'ejercicio' : 'ejercicios'} · {totalSeries}{' '}
                              series · ~{minutos} min
                            </Text>
                          </View>

                          <View style={styles.routineActions}>
                            <IconGlassButton
                              name="create-outline"
                              size={24}
                              onPress={() => abrirEditarRutina(r)}
                              label={`Editar ${r.nombre}`}
                            />
                            <IconGlassButton
                              name="copy-outline"
                              size={24}
                              onPress={() => clonarRutina(r)}
                              label={`Duplicar ${r.nombre}`}
                            />
                            <IconGlassButton
                              name="ellipsis-horizontal"
                              size={24}
                              onPress={() => setRutinaParaAcciones(r)}
                              label={`Más opciones de ${r.nombre}`}
                            />
                          </View>
                        </View>

                        <View style={styles.daySelectorRow}>
                          <Text style={styles.daySelectorLabel}>Día sugerido</Text>
                          <View style={styles.dayPills}>
                            {DIAS_SEMANA_ABREV.map((letra, diaIdx) => {
                              const asignado = dia === diaIdx;
                              const esHoyPill = diaIdx === hoyIdx;
                              return (
                                <Pressable
                                  key={diaIdx}
                                  onPress={() => cambiarDiaSugeridoRutina(r, diaIdx)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Seleccionar ${
                                    DIAS_SEMANA_NOMBRES[diaIdx]
                                  } como día sugerido`}
                                  accessibilityState={{ selected: asignado }}
                                  style={[
                                    styles.dayPill,
                                    esHoyPill && !asignado && styles.dayPillToday,
                                    asignado && styles.dayPillSelected,
                                  ]}
                                >
                                  {asignado ? (
                                    <LinearGradient
                                      pointerEvents="none"
                                      colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 0, y: 1 }}
                                      style={[StyleSheet.absoluteFill, styles.dayPillFill]}
                                    />
                                  ) : null}
                                  <Text
                                    style={[
                                      styles.dayPillText,
                                      esHoyPill && !asignado && styles.dayPillTextToday,
                                      asignado && styles.dayPillTextSelected,
                                    ]}
                                  >
                                    {letra}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        {numEjercicios > 0 ? (
                          <View style={styles.exercisePreview}>
                            {primerosTres.map((ej) => {
                              const nombreLimpio = ej.nombre.replace(/\s*\(.*\)$/, '').trim();
                              return (
                                <View key={ej.id} style={styles.previewRow}>
                                  <Ionicons
                                    name="barbell-outline"
                                    size={12}
                                    color={noir.info}
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
                            {restantes > 0 ? (
                              <Text style={styles.previewExerciseMore}>
                                + {restantes}{' '}
                                {restantes === 1 ? 'ejercicio más' : 'ejercicios más'}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}

                        <View style={styles.routineFoot}>
                          <View style={styles.routineChips}>
                            <View style={styles.routineChip}>
                              <Ionicons name="layers-outline" size={11} color={noir.lavender} />
                              <Text style={styles.routineChipText}>{totalSeries} series</Text>
                            </View>
                            <View style={styles.routineChip}>
                              <Ionicons name="barbell-outline" size={11} color={noir.info} />
                              <Text style={styles.routineChipText}>{numEjercicios} ej.</Text>
                            </View>
                          </View>
                          <PearlButton
                            compact
                            label="Abrir rutina"
                            onPress={() => abrirEditarRutina(r)}
                          />
                        </View>
                      </GlassSurface>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <DockPrincipal>
          <LiquidMetalButton
            titulo={
              planSeleccionado
                ? '+ Nueva rutina en este plan'
                : viendoSinPlan
                  ? '+ Nueva rutina'
                  : '+ Nuevo plan'
            }
            onPress={planSeleccionado || viendoSinPlan ? abrirCrearRutinaEnPlan : abrirCrearPlan}
            activo={metalActivo}
            height={52}
            borderWidth={4}
            style={{ alignSelf: 'stretch' }}
          />
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

        {/* MENÚ DE ACCIONES DEL PLAN */}
        <ActionSheetModal
          visible={!!planParaAcciones}
          onClose={() => setPlanParaAcciones(null)}
          title="Gestionar plan"
          subtitle={planParaAcciones?.plan.nombre}
          actions={accionesPlan}
        />

        {/* MENÚ DE ACCIONES DE LA RUTINA */}
        <ActionSheetModal
          visible={!!rutinaParaAcciones}
          onClose={() => setRutinaParaAcciones(null)}
          title="Acciones de la rutina"
          subtitle={rutinaParaAcciones?.nombre}
          actions={accionesRutina}
        />

        {/* MODAL MOVER RUTINA A OTRO PLAN */}
        <Modal
          visible={!!rutinaParaMover}
          transparent
          animationType="fade"
          onRequestClose={() => setRutinaParaMover(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.moverModalCard, { maxWidth: Math.min(contentMaxWidth, 420) }]}>
              <View style={styles.moverHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moverTitle}>Mover rutina a otro plan</Text>
                  <Text style={styles.moverSubtext} numberOfLines={2}>
                    Selecciona a qué plan deseas transferir &quot;{rutinaParaMover?.nombre}&quot;:
                  </Text>
                </View>
                <Pressable onPress={() => setRutinaParaMover(null)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={noir.muted} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.moverList}
                contentContainerStyle={{ gap: 8 }}
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  onPress={() => rutinaParaMover && ejecutarMoverRutina(rutinaParaMover.id, null)}
                  style={[
                    styles.moverPlanOption,
                    rutinaParaMover?.plan_id === null && styles.moverPlanOptionActive,
                  ]}
                >
                  <Ionicons name="folder-outline" size={16} color={noir.muted} />
                  <Text style={styles.moverPlanName}>Dejar sin plan (libre)</Text>
                </Pressable>

                {planesNoArchivados.map((p) => {
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
                      <View style={styles.moverPlanDot} />
                      <Text
                        style={[
                          styles.moverPlanName,
                          esActual && {
                            color: noir.text,
                            fontFamily: fuentes.semiBold,
                          },
                        ]}
                      >
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
        {undoItem ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.undoLayer,
              { bottom: safeBottom + (isLandscape ? 112 : 146) },
            ]}
          >
            <View
              style={[
                styles.undoSnackbarContainer,
                { maxWidth: contentMaxWidth, width: '100%' },
              ]}
            >
              <View style={styles.undoCopyRow}>
                <Ionicons name="trash-bin-outline" size={18} color={DANGER} />
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
                style={({ pressed }) => [
                  styles.undoButton,
                  pressed && { opacity: 0.8 },
                ]}
                hitSlop={8}
              >
                <Text style={styles.undoButtonText}>DESHACER</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  accountScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: 'rgba(4, 5, 7, 0.30)',
  },
  headerOuter: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 2,
    position: 'relative',
    zIndex: 60,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    position: 'relative',
    zIndex: 60,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 0,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  brandMarkText: {
    color: '#F8FBFF',
    fontFamily: fuentes.extraBold,
    fontSize: 15,
    letterSpacing: -1.2,
    paddingBottom: 1,
  },
  brandWordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 0,
  },
  brandDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.pearl,
    marginBottom: 4,
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#E8EDF5',
    fontFamily: fuentes.semiBold,
    fontSize: 11,
  },
  avatarStatus: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: noir.mint,
    borderWidth: 2,
    borderColor: '#06070A',
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  accountMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    width: 218,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 20, 26, 0.98)',
    borderWidth: 1,
    borderColor: noir.lineStrong,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
    zIndex: 70,
  },
  accountMenuLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  accountMenuEmail: {
    color: noir.text,
    fontFamily: fuentes.medium,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  accountMenuDivider: {
    height: 1,
    backgroundColor: noir.line,
    marginVertical: 8,
  },
  accountMenuLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  accountMenuLogoutText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 12,
  },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 2,
    gap: 10,
  },
  greeting: {
    paddingHorizontal: 1,
    flexShrink: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.pearl,
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  eyebrowText: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 9,
    letterSpacing: 1.3,
  },
  greetingTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    letterSpacing: -0.84,
    marginTop: 7,
  },
  greetingStats: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 6,
  },
  greetingStatsStrong: {
    color: '#DCE3EC',
    fontFamily: fuentes.medium,
  },
  greetingStatsDot: {
    color: noir.muted2,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.regular,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
  },

  // ── Plan hero (MainDayCard shell exacto) ──────────────────────────────────
  planHeroBase: {
    backgroundColor: noir.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.52,
    shadowRadius: 22,
    elevation: 12,
  },
  planHeroWeb: {
    // @ts-ignore
    boxShadow:
      '0 0 50px 0px rgba(226, 239, 255, 0.52), inset 0 0 90px 0px rgba(226, 239, 255, 0.24)',
  },
  planHeroHairline: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    zIndex: 3,
  },
  planHeroContent: {
    gap: 10,
    zIndex: 1,
  },
  planHeroStack: {
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTopCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  heroStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  heroStatusDotActive: {
    backgroundColor: noir.mint,
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 2,
  },
  heroStatusDotIdle: {
    backgroundColor: noir.muted2,
  },
  heroKicker: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.1,
  },
  heroKickerSoft: {
    color: noir.muted2,
    fontFamily: fuentes.semiBold,
    fontSize: 7.5,
    letterSpacing: 1.4,
    marginTop: 3,
  },
  heroTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  planShinyTitleWrap: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroObjectiveLine: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
  },
  heroObjectiveStrong: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
  },
  heroObjectiveMuted: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
  },
  planDescription: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: noir.line,
    borderRadius: 10,
    paddingVertical: 7,
    marginTop: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    minWidth: 0,
  },
  statValue: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  statLabel: {
    color: noir.muted2,
    fontFamily: fuentes.semiBold,
    fontSize: 7.3,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  statDividerLine: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: noir.line,
    marginVertical: 3,
  },
  heroOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  heroOpenButton: {
    flex: 1,
  },

  // ── Botones / superficies nuevas ─────────────────────────────────────────
  pearlButton: {
    height: 38,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.90)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  pearlButtonCompact: {
    height: 27,
    paddingHorizontal: 9,
    gap: 4,
    borderColor: 'rgba(255, 255, 255, 0.82)',
  },
  pearlButtonFill: {
    borderRadius: 999,
  },
  pearlButtonOrb: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: '#090B0F',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pearlButtonText: {
    color: '#090B0F',
    fontFamily: fuentes.bold,
    fontSize: 11.2,
    letterSpacing: 0.15,
  },
  pearlButtonTextCompact: {
    fontSize: 9.2,
  },
  pressedSoft: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  iconGlassButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    flexShrink: 0,
  },
  iconGlassButtonDanger: {
    backgroundColor: 'rgba(240, 138, 155, 0.08)',
    borderColor: 'rgba(240, 138, 155, 0.24)',
  },
  glassSurface: {
    backgroundColor: noir.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: noir.line,
    overflow: 'hidden',
    position: 'relative',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  glassSurfaceDashed: {
    borderStyle: 'dashed',
  },
  glassHairline: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
  },

  // ── Empty / loading ──────────────────────────────────────────────────────
  emptyCard: {
    borderRadius: 18,
    padding: 24,
  },
  emptyCardContent: {
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    marginBottom: 2,
  },
  emptyTitle: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 310,
  },

  // ── Plan compacto ────────────────────────────────────────────────────────
  compactPlan: {
    borderRadius: 14,
    padding: 10,
  },
  compactPlanContent: {
    gap: 0,
  },
  compactPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPlanMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  compactPlanIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    flexShrink: 0,
  },
  compactPlanCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactPlanNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  compactPlanName: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 13,
    flexShrink: 1,
    minWidth: 0,
  },
  compactPlanMeta: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.8,
    marginTop: 2,
  },
  compactPlanActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  compactChevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Rutinas individuales ─────────────────────────────────────────────────
  orphanCard: {
    borderRadius: 14,
    padding: 11,
  },
  orphanContent: {
    gap: 0,
  },
  orphanPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  orphanIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    flexShrink: 0,
  },
  orphanCopy: {
    flex: 1,
    minWidth: 0,
  },
  orphanTitle: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 12.5,
  },
  orphanSubtitle: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 1,
  },

  // ── Detalle ──────────────────────────────────────────────────────────────
  detailNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backPill: {
    height: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  backPillText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 10.5,
  },
  detailHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planHeroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  youngNewtWrap: {
    flex: 1,
    minWidth: 0,
  },
  makeActiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  makeActiveLinkText: {
    color: noir.info,
    fontFamily: fuentes.semiBold,
    fontSize: 10,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: noir.line,
  },
  weekDay: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
  },
  weekDayPlanned: {
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.18)',
    backgroundColor: 'rgba(92, 200, 255, 0.06)',
  },
  weekDayActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  weekDayActiveFill: {
    borderRadius: 8,
  },
  weekDayName: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.3,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  weekDayNumber: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 10.5,
    lineHeight: 12,
  },
  weekDayTextActive: {
    color: '#090B0F',
  },
  weekDayDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginTop: 1,
  },
  weekDayDotPlanned: {
    backgroundColor: noir.info,
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  weekDayDotActive: {
    backgroundColor: '#090B0F',
  },
  freeHeroCard: {
    borderRadius: 18,
    padding: 14,
  },
  freeHeroContent: {
    gap: 9,
  },
  freeHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    flexShrink: 0,
  },
  freeHeroTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  freeHeroText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  heroStatusDotIdleSimple: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: noir.muted2,
  },

  // ── Encabezado de sección / búsqueda de detalle ──────────────────────────
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  sectionHeadLabel: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  sectionHeadLine: {
    flex: 1,
    height: 1,
    borderRadius: 1,
  },
  sectionHeadCount: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  sectionSearchButton: {
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  sectionSearchButtonActive: {
    backgroundColor: noir.glassStrong,
    borderColor: noir.lineStrong,
  },

  // ── Tarjetas de rutina ───────────────────────────────────────────────────
  routinesList: {
    gap: 9,
  },
  routineCard: {
    borderRadius: 16,
    padding: 11,
  },
  routineCardContent: {
    gap: 9,
  },
  routineHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  routineIndex: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
    flexShrink: 0,
  },
  routineIndexActive: {
    backgroundColor: 'rgba(92, 200, 255, 0.10)',
    borderColor: 'rgba(92, 200, 255, 0.34)',
  },
  routineIndexText: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
  },
  routineIndexTextActive: {
    color: noir.info,
  },
  routineHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  routineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  routineName: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 14.5,
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: -0.15,
  },
  routineDayBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(92, 200, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.20)',
    flexShrink: 0,
  },
  routineDayBadgeText: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  routineMeta: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.8,
    marginTop: 2,
  },
  routineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginTop: 1,
  },
  daySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daySelectorLabel: {
    width: 54,
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
    flexShrink: 0,
  },
  dayPills: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    minWidth: 0,
  },
  dayPill: {
    flex: 1,
    height: 25,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minWidth: 0,
  },
  dayPillToday: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.24)',
  },
  dayPillSelected: {
    borderColor: 'rgba(255, 255, 255, 0.92)',
    backgroundColor: '#FFFFFF',
  },
  dayPillFill: {
    borderRadius: 7,
  },
  dayPillText: {
    color: noir.muted2,
    fontFamily: fuentes.semiBold,
    fontSize: 9.5,
  },
  dayPillTextToday: {
    color: noir.info,
  },
  dayPillTextSelected: {
    color: '#090B0F',
    fontFamily: fuentes.black,
  },
  exercisePreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: noir.line,
    padding: 8,
    gap: 5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewExerciseText: {
    flex: 1,
    color: noir.platinum,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    minWidth: 0,
  },
  previewExerciseSeries: {
    color: noir.muted2,
    fontFamily: fuentes.semiBold,
    fontSize: 9,
  },
  previewExerciseMore: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 8.5,
    marginTop: 1,
  },
  routineFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routineChips: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  routineChip: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: 7,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  routineChipText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 9,
  },

  // ── Action sheet ─────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  actionSheetCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F1117',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: noir.lineStrong,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 20,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actionSheetTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  actionSheetSubtitle: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  actionSheetList: {
    gap: 5,
    marginTop: 12,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: noir.line,
  },
  actionSheetRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  actionSheetRowDisabled: {
    opacity: 0.4,
  },
  actionSheetIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  actionSheetIconDanger: {
    backgroundColor: 'rgba(240, 138, 155, 0.08)',
    borderColor: 'rgba(240, 138, 155, 0.24)',
  },
  actionSheetLabel: {
    flex: 1,
    color: noir.text,
    fontFamily: fuentes.medium,
    fontSize: 12.5,
  },

  // ── Modal mover rutina ───────────────────────────────────────────────────
  moverModalCard: {
    width: '100%',
    backgroundColor: '#0F1117',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: noir.lineStrong,
    padding: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 20,
  },
  moverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  moverTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 15.5,
    letterSpacing: -0.25,
  },
  moverSubtext: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  moverList: {
    maxHeight: 260,
  },
  moverPlanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 11,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  moverPlanOptionActive: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.34)',
  },
  moverPlanName: {
    flex: 1,
    color: noir.platinum,
    fontFamily: fuentes.regular,
    fontSize: 11.8,
    minWidth: 0,
  },
  moverPlanDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: noir.info,
    flexShrink: 0,
  },

  // ── Snackbar de deshacer ─────────────────────────────────────────────────
  undoLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 30,
  },
  undoSnackbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 18, 24, 0.98)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: noir.lineStrong,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
  },
  undoCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  undoTitleText: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 10.5,
  },
  undoCountdownText: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    marginTop: 1,
  },
  undoButton: {
    backgroundColor: '#F2F6FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  undoButtonText: {
    color: '#090B0F',
    fontFamily: fuentes.black,
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
});
