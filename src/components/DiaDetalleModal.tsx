import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import {
  Canvas,
  Box,
  BoxShadow,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import { colores, fuentes } from '../constantes/colores';
import ScreenBackground from './ScreenBackground';
import SpotlightSegmentedTabs from './SpotlightSegmentedTabs';
import RutinaLiveCard from './RutinaLiveCard';
import RadiantButton from './base/radiant-button';
import YoungNewtButton from './YoungNewtButton';
import { vibrarBoton } from '../utilidades/hapticos';
import { NotaEstandar, obtenerNotasEstandar } from '../services/notas';
import {
  agregarRutinaAFechas,
  eliminarEjercicio,
  eliminarRegistroRutina,
  guardarNotaDelDia,
} from '../services/registros';
import { listarRutinas } from '../services/rutinas';
import { listarPlanes, listarRutinasDePlan } from '../services/planes';
import { EjercicioRegistro, PlanEntrenamiento, Registro, Rutina } from '../tipos';
import { SesionActivaInfo } from '../utilidades/sesionActiva';
import { seguro, confirmarAccion } from '../utilidades/errores';
import { aISO, nombreDia } from '../utilidades/fechas';
import { useLayout } from '../hooks/useLayout';

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
    titulo = partes[0].replace(/:\s*$/, '').trim();
    cuerpo = partes[1];
  } else {
    titulo = textoLimpio.replace(/:\s*$/, '').trim() || 'Nota del Día';
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

interface RoutineStatCardWithMainDayGlowProps {
  rut: Rutina;
  esSugeridoHoy: boolean;
  planParaVerRutinas: PlanEntrenamiento | null;
  onVincular: (r: Rutina, p?: PlanEntrenamiento | null) => void;
}

function RoutineStatCardWithMainDayGlow({
  rut,
  esSugeridoHoy,
  planParaVerRutinas,
  onVincular,
}: RoutineStatCardWithMainDayGlowProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const isWeb = Platform.OS === 'web';
  const numEjs = rut.ejercicios_rutina?.length || 0;
  const totalSeries = (rut.ejercicios_rutina || []).reduce(
    (acc, ej) => acc + (ej.series || 3),
    0
  );

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.routineStatCard,
        styles.routineCardMainDayGlowBase,
        isWeb && styles.routineCardMainDayGlowWeb,
      ]}
    >
      {/* Fondo Skia en plataformas nativas para lograr el BoxShadow e Inset Glow idéntico a MainDayCard */}
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 20, 20)}
            color="rgb(15, 15, 17)"
          >
            {/* Outer Glow blanco/plateado difuso prolijo y minimalista */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={16}
              color="rgba(255, 255, 255, 0.40)"
            />
            {/* Inset Glow blanco suave desde el perímetro hacia adentro */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={26}
              color="rgba(255, 255, 255, 0.20)"
              inner
            />
          </Box>
        </Canvas>
      )}

      {/* Badge superior si es sugerido hoy */}
      {esSugeridoHoy && (
        <View style={styles.routineHoyBadgeCentered}>
          <Ionicons name="flash" size={10} color="#10B981" />
          <Text style={styles.routineHoyBadgeText}>SUGERIDO PARA HOY</Text>
        </View>
      )}

      {/* Título de la Rutina Centrado */}
      <Text style={styles.routineStatTitle}>{rut.nombre}</Text>

      {/* Micro-chips de Métricas Centrados */}
      <View style={styles.routineStatMetaRow}>
        <View style={styles.routineMiniChip}>
          <Ionicons name="barbell-outline" size={11} color={colores.suave} />
          <Text style={styles.routineMiniChipText}>{numEjs} ejercicios</Text>
        </View>
        {Boolean(totalSeries) && (
          <View style={styles.routineMiniChip}>
            <Ionicons name="layers-outline" size={11} color={colores.suave} />
            <Text style={styles.routineMiniChipText}>{totalSeries} series</Text>
          </View>
        )}
      </View>

      {/* Separador de luz interno tenue */}
      <View style={styles.routineCardInnerDivider} />

      {/* Botón Uiverse Young-Newt-20 animado idéntico y centrado */}
      <View style={styles.routineStatActionRow}>
        <YoungNewtButton
          title="Añadir al Día"
          loadingTitle="Añadiendo..."
          onPress={() => onVincular(rut, planParaVerRutinas)}
        />
      </View>
    </View>
  );
}

interface LibraryNoteCardWithMainDayGlowProps {
  nota: NotaEstandar;
  isLinking: boolean;
  onVincular: (n: NotaEstandar) => void;
}

function LibraryNoteCardWithMainDayGlow({
  nota,
  isLinking,
  onVincular,
}: LibraryNoteCardWithMainDayGlowProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const isWeb = Platform.OS === 'web';
  const parsed = parsearNotaInteligente(`[${nota.categoria}] ${nota.titulo}: ${nota.contenido}`);

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.libraryNoteCardGlowBase,
        isWeb && styles.routineCardMainDayGlowWeb,
      ]}
    >
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 20, 20)}
            color="rgb(15, 15, 17)"
          >
            <BoxShadow
              dx={0}
              dy={0}
              blur={16}
              color="rgba(255, 255, 255, 0.40)"
            />
            <BoxShadow
              dx={0}
              dy={0}
              blur={26}
              color="rgba(255, 255, 255, 0.20)"
              inner
            />
          </Box>
        </Canvas>
      )}

      {/* Header con Badge de Categoría Inteligente */}
      <View style={styles.libraryNoteTopRow}>
        <View
          style={[
            styles.libraryNoteCategoryPill,
            {
              backgroundColor: parsed.bgBadge,
              borderColor: `${parsed.colorBadge}40`,
            },
          ]}
        >
          <Ionicons name={parsed.iconName} size={11.5} color={parsed.colorBadge} />
          <Text
            style={[
              styles.libraryNoteCategoryPillText,
              { color: parsed.colorBadge },
            ]}
          >
            {nota.categoria.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Título de la Nota Centrado */}
      <Text style={styles.libraryNoteTitle}>{nota.titulo}</Text>

      {/* Contenido / Descripción */}
      {Boolean(nota.contenido) && (
        <Text style={styles.libraryNoteBody} numberOfLines={3}>
          {nota.contenido}
        </Text>
      )}

      {/* Separador de luz tenue */}
      <View style={styles.routineCardInnerDivider} />

      {/* Botón YoungNewtButton animado idéntico */}
      <View style={styles.routineStatActionRow}>
        <YoungNewtButton
          title="Añadir al Día"
          loadingTitle="Añadiendo..."
          loading={isLinking}
          onPress={() => onVincular(nota)}
        />
      </View>
    </View>
  );
}

const CATEGORIAS_RAPIDAS = [
  { id: 'General', label: 'General', icon: 'document-text-outline', color: colores.hoy },
  { id: 'Nutrición', label: 'Nutrición', icon: 'nutrition-outline', color: '#10B981' },
  { id: 'Entrenamiento', label: 'Entreno', icon: 'fitness-outline', color: colores.primarioHover },
  { id: 'Suplementos', label: 'Suplementos', icon: 'medical-outline', color: '#A855F7' },
  { id: 'Recuperación', label: 'Descanso', icon: 'pulse-outline', color: '#3B82F6' },
];

interface QuickNoteCardWithMainDayGlowProps {
  texto: string;
  onChangeTexto: (t: string) => void;
  categoria: string;
  onSelectCategoria: (cat: string) => void;
  guardando: boolean;
  onSubmit: () => void;
}

function QuickNoteCardWithMainDayGlow({
  texto,
  onChangeTexto,
  categoria,
  onSelectCategoria,
  guardando,
  onSubmit,
}: QuickNoteCardWithMainDayGlowProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.quickNoteCardGlowBase,
        isWeb && styles.routineCardMainDayGlowWeb,
      ]}
    >
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 22, 22)}
            color="rgb(15, 15, 17)"
          >
            <BoxShadow
              dx={0}
              dy={0}
              blur={16}
              color="rgba(255, 255, 255, 0.40)"
            />
            <BoxShadow
              dx={0}
              dy={0}
              blur={26}
              color="rgba(255, 255, 255, 0.20)"
              inner
            />
          </Box>
        </Canvas>
      )}

      {/* Header del bloque rápido */}
      <View style={{ alignItems: 'center', gap: 3, width: '100%' }}>
        <Text style={styles.quickNoteHeadingTitle}>Nota Rápida Exclusiva</Text>
        <Text style={styles.quickNoteHeadingSubtitle}>
          Registra sensaciones, pesajes o comentarios para esta fecha
        </Text>
      </View>

      {/* Selector Inteligente de Categorías */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickNoteCategoryChipsRow}
      >
        {CATEGORIAS_RAPIDAS.map((cat) => {
          const isSelected = categoria === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => {
                vibrarBoton();
                onSelectCategoria(cat.id);
              }}
              style={({ pressed }) => [
                styles.quickNoteCategoryChip,
                isSelected && {
                  backgroundColor: `${cat.color}22`,
                  borderColor: cat.color,
                },
                pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={12}
                color={isSelected ? cat.color : colores.suave}
              />
              <Text
                style={[
                  styles.quickNoteCategoryChipText,
                  { color: isSelected ? '#FFFFFF' : colores.suave },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* TextInput de nota rápida */}
      <TextInput
        placeholder="Escribe anotaciones rápidas, sensaciones o hydration..."
        placeholderTextColor="rgba(255, 255, 255, 0.35)"
        multiline
        numberOfLines={3}
        value={texto}
        onChangeText={onChangeTexto}
        inputMode="text"
        keyboardType="default"
        autoCapitalize="sentences"
        autoCorrect={true}
        textAlignVertical="top"
        style={styles.quickNoteTextInput}
      />

      {/* Botón YoungNewtButton para guardar */}
      <View style={styles.routineStatActionRow}>
        <YoungNewtButton
          title="Guardar Nota al Día"
          loadingTitle="Guardando..."
          loading={guardando}
          disabled={!texto.trim()}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
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
  const { topInset, barBottomPadding, leftInset, rightInset, gutter, contentMaxWidth } = useLayout();
  const [tab, setTab] = useState<'actividad' | 'rutina' | 'notas'>('actividad');

  // Planes y Rutinas para vincular
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [rutinasSueltas, setRutinasSueltas] = useState<Rutina[]>([]);
  const [planParaVerRutinas, setPlanParaVerRutinas] = useState<PlanEntrenamiento | null>(null);
  const [rutinasDelPlanModal, setRutinasDelPlanModal] = useState<Rutina[]>([]);
  const [cargandoRutinasPlan, setCargandoRutinasPlan] = useState(false);
  const [modalRutinasPlanVisible, setModalRutinasPlanVisible] = useState(false);

  // Notas estandarizadas y notas ad-hoc
  const [notasBiblioteca, setNotasBiblioteca] = useState<NotaEstandar[]>([]);
  const [nuevaNotaAdHoc, setNuevaNotaAdHoc] = useState('');
  const [categoriaAdHoc, setCategoriaAdHoc] = useState('General');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [vinculandoNotaId, setVinculandoNotaId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      seguro(async () => {
        const [ruts, nats, pls] = await Promise.all([
          listarRutinas(),
          obtenerNotasEstandar(),
          listarPlanes({ incluirArchivados: false }),
        ]);
        setNotasBiblioteca(nats);
        setRutinasSueltas(ruts.filter((r) => !r.plan_id));

        // Ordenar planes: el activo SIEMPRE al principio
        const ordenados = [...pls].sort((a, b) => {
          if (a.activo && !b.activo) return -1;
          if (!a.activo && b.activo) return 1;
          return (a.orden || 0) - (b.orden || 0);
        });
        setPlanes(ordenados);
      });
    }
  }, [visible]);

  if (!fecha) return null;

  // Extraer todos los ejercicios del día
  const todosEjercicios: EjercicioRegistro[] = registros.flatMap((r) => r.ejercicios_registro || []);

  // 1. NOTAS
  const notasDelDia = todosEjercicios.filter((e) => e.nombre.startsWith('📌'));

  // 2. RUTINAS CON REGISTRO ASIGNADO
  const registrosConRutina = registros.filter((r) => Boolean(r.rutina_id || r.rutinas?.nombre));

  // 3. EJERCICIOS EXTRAS SUELTOS (sin rutina)
  const registrosExtraSueltos = registros.filter((r) => !r.rutina_id && !r.rutinas?.nombre);
  const ejerciciosExtras = registrosExtraSueltos
    .flatMap((r) => r.ejercicios_registro || [])
    .filter((e) => !e.nombre.startsWith('📌'));

  // Bloques de entrenamiento mostrados en Actividad: rutinas + bloque de sueltos
  const totalEntrenamientosDelDia =
    registrosConRutina.length + (ejerciciosExtras.length > 0 ? 1 : 0);

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
      setModalRutinasPlanVisible(false);
      setTab('actividad');
      Alert.alert('Éxito', `Rutina "${rutina.nombre}" agregada a tu día.`);
    });

  const abrirModalRutinasPlan = async (p: PlanEntrenamiento | null) => {
    vibrarBoton();
    setPlanParaVerRutinas(p);
    setModalRutinasPlanVisible(true);
    setCargandoRutinasPlan(true);
    if (p) {
      const ruts = await listarRutinasDePlan(p.id);
      setRutinasDelPlanModal(ruts);
    } else {
      setRutinasDelPlanModal(rutinasSueltas);
    }
    setCargandoRutinasPlan(false);
  };

  const vincularNotaEstandar = (n: NotaEstandar) =>
    seguro(async () => {
      setVinculandoNotaId(n.id);
      const textoFormateado = `[${n.categoria.toUpperCase()}] ${n.titulo}: ${n.contenido}`;
      await guardarNotaDelDia(aISO(fecha), textoFormateado);
      setVinculandoNotaId(null);
      alCambiar();
      setTab('actividad');
      Alert.alert('Nota añadida', `Nota "${n.titulo}" vinculada al ${nombreDia(fecha)}.`);
    });

  const guardarNotaSubmit = () =>
    seguro(async () => {
      const texto = nuevaNotaAdHoc.trim();
      if (!texto) return;
      setGuardandoNota(true);
      const textoFinal = `[${categoriaAdHoc.toUpperCase()}] ${texto}`;
      await guardarNotaDelDia(aISO(fecha), textoFinal);
      setNuevaNotaAdHoc('');
      setGuardandoNota(false);
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
              paddingBottom: Math.max(12, barBottomPadding),
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

            {/* 2. BARRA DE PESTAÑAS: SPOTLIGHT TAB BAR (TIPOGRAFÍA, SIN ICONOS) */}
            <SpotlightSegmentedTabs
              tabs={[
                { id: 'actividad', label: 'Actividad' },
                { id: 'rutina', label: '+ Rutina' },
                { id: 'notas', label: 'Notas' },
              ]}
              activeTab={tab}
              onChangeTab={(newTab) => setTab(newTab as any)}
            />

            {/* 3. CONTENIDO DINÁMICO */}
            <ScrollView
              contentContainerStyle={{ gap: 22, paddingBottom: 60, paddingHorizontal: 6, paddingTop: 6 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* PANEL 1: Actividad del Día */}
              {tab === 'actividad' && (
                <View style={{ gap: 24 }}>
                  {/* ────── SECCIÓN: NOTAS DEL DÍA ────── */}
                  <View style={{ gap: 12 }}>
                    <View style={styles.activitySectionHeader}>
                      <View style={styles.activitySectionTitleGroup}>
                        <View style={[styles.activitySectionAccent, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.activitySectionTitle}>NOTAS</Text>
                        {notasDelDia.length > 0 && (
                          <View style={styles.activitySectionCount}>
                            <Text style={styles.activitySectionCountText}>{notasDelDia.length}</Text>
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
                      notasDelDia.map((n) => {
                        const { categoria, titulo, cuerpo, colorBadge, bgBadge } = parsearNotaInteligente(n.nombre);
                        return (
                          <View
                            key={n.id}
                            style={[
                              styles.obsidianNoteCard,
                              { borderLeftColor: colorBadge, borderLeftWidth: 2.5 },
                            ]}
                          >
                            <View style={styles.noteTopRow}>
                              <View style={styles.noteMetaLeft}>
                                <View style={[styles.noteCategoryPill, { backgroundColor: bgBadge, borderColor: `${colorBadge}30` }]}>
                                  <View style={[styles.noteCategoryDot, { backgroundColor: colorBadge }]} />
                                  <Text style={[styles.noteCategoryPillText, { color: colorBadge }]}>
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

                  {/* ────── SECCIÓN: ENTRENAMIENTOS DEL DÍA (RESUMEN ESTÉTICO CON EFECTO GLOW BLANCO) ────── */}
                  <View style={{ gap: 12 }}>
                    <View style={styles.activitySectionHeader}>
                      <View style={styles.activitySectionTitleGroup}>
                        <View style={[styles.activitySectionAccent, { backgroundColor: colores.primarioHover }]} />
                        <Text style={styles.activitySectionTitle}>ENTRENAMIENTOS</Text>
                        {totalEntrenamientosDelDia > 0 && (
                          <View style={styles.activitySectionCount}>
                            <Text style={styles.activitySectionCountText}>{totalEntrenamientosDelDia}</Text>
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
                        {/* A. Resumen Estético de Rutina (Reutilizando RutinaLiveCard de MainDayCard con Efecto Glow Blanco) */}
                        {registrosConRutina.map((r) => (
                          <RutinaLiveCard
                            key={r.id}
                            registro={r}
                            sesionActivaInfo={sesionActivaInfo}
                            conEfectoGlowBlanco={true}
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
                            onDescartar={() => alCambiar()}
                            permitirDesplegarEjercicios={true}
                          />
                        ))}

                        {/* B. Ejercicios Sueltos / Extras (si los hay) */}
                        {ejerciciosExtras.length > 0 && (
                          <View style={styles.extraExercisesContainer}>
                            <View style={styles.extraExercisesHeader}>
                              <View style={styles.extraExercisesDot} />
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

              {/* PANEL 2: Planes de Entrenamiento con RadiantButton de Reacticx */}
              {tab === 'rutina' && (
                <View style={{ gap: 16 }}>
                  <View style={styles.radiantButtonCenterWrapper}>
                    <RadiantButton
                      style={styles.radiantHeroButton}
                      theme={{
                        foreground: "#ffffff",
                        background: "#000000",
                        backgroundSubtle: "#000000",
                        highlight: "#e37e19",
                        highlightSubtle: "#000000",
                      }}
                      borderRadius={16}
                      borderWidth={1.5}
                      dotOpacity={1}
                      showDots
                      glowWidth={0.5}
                      shimmerOpacity={0.5}
                      paddingHorizontal={24}
                      paddingVertical={14}
                    >
                      <View style={styles.radiantHeaderRow}>
                        <Text style={styles.radiantHeaderText}>
                          PLANES DE ENTRENAMIENTO
                        </Text>
                      </View>
                    </RadiantButton>
                  </View>

                  {planes.length === 0 ? (
                    <View style={styles.emptyDashedBox}>
                      <Ionicons name="folder-open-outline" size={26} color={colores.suave} />
                      <Text style={styles.emptyDashedText}>
                        No tienes planes de entrenamiento creados todavía. Ve a la pestaña &apos;Rutinas&apos; para crear uno.
                      </Text>
                    </View>
                  ) : (
                    planes.map((p) => {
                      const esActivo = Boolean(p.activo);
                      const colorTema = p.color || colores.primarioHover;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => abrirModalRutinasPlan(p)}
                          style={({ pressed }) => [
                            styles.planStatCard,
                            esActivo && styles.planStatCardActivo,
                            pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
                          ]}
                        >
                          {/* 1. Header con Badge de Plan y Estado Activo */}
                          <View style={styles.planCardHeaderRow}>
                            <View
                              style={[
                                styles.planCardTagBadge,
                                {
                                  backgroundColor: `${colorTema}18`,
                                  borderColor: `${colorTema}40`,
                                },
                              ]}
                            >
                              <Ionicons name={(p?.icono as any) || 'barbell'} size={11} color={colorTema} />
                              <Text
                                numberOfLines={1}
                                style={[styles.planCardTagText, { color: colorTema }]}
                              >
                                {(p?.nombre || 'PLAN').toUpperCase()}
                              </Text>
                            </View>

                            {esActivo ? (
                              <View style={styles.planCardBadgeActivo}>
                                <View style={styles.dotLiveGreenPulse} />
                                <Text style={styles.planCardBadgeActivoText}>PLAN ACTIVO</Text>
                              </View>
                            ) : (
                              <View style={styles.planCardBadgeSecundario}>
                                <Text style={styles.planCardBadgeSecundarioText}>DISPONIBLE</Text>
                              </View>
                            )}
                          </View>

                          {/* 2. Título y Objetivo / Descripción */}
                          <Text numberOfLines={1} style={styles.planCardTitle}>
                            {p?.nombre || 'Plan de Entrenamiento'}
                          </Text>

                          {Boolean(p.descripcion || p.objetivo) && (
                            <Text numberOfLines={2} style={styles.planCardSubtitle}>
                              {p.descripcion || p.objetivo}
                            </Text>
                          )}

                          {/* 3. Métricas y Botón de Acción */}
                          <View style={styles.planCardFooterRow}>
                            <View style={styles.planMetricChipsContainer}>
                              <View style={styles.planMetricChip}>
                                <Ionicons name="barbell-outline" size={12} color={colores.suave} />
                                <Text style={styles.planMetricChipText}>{p.totalRutinas || 0} rutinas</Text>
                              </View>

                              {Boolean(p.diasPorSemana) && (
                                <View style={styles.planMetricChip}>
                                  <Ionicons name="calendar-outline" size={12} color={colores.suave} />
                                  <Text style={styles.planMetricChipText}>{p.diasPorSemana} días/sem</Text>
                                </View>
                              )}
                            </View>

                            <View style={[styles.planCardActionBtn, esActivo && styles.planCardActionBtnActivo]}>
                              <Text style={[styles.planCardActionBtnText, esActivo && styles.planCardActionBtnTextActivo]}>
                                Ver Rutinas
                              </Text>
                              <Ionicons
                                name="chevron-forward"
                                size={13}
                                color={esActivo ? '#FFFFFF' : colores.suave}
                              />
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  {/* Rutinas Sueltas / Independientes (si existen) */}
                  {rutinasSueltas.length > 0 && (
                    <Pressable
                      onPress={() => abrirModalRutinasPlan(null)}
                      style={({ pressed }) => [
                        styles.planStatCard,
                        { borderColor: 'rgba(255, 255, 255, 0.08)' },
                        pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
                      ]}
                    >
                      <View style={styles.planCardHeaderRow}>
                        <View style={[styles.planCardTagBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' }]}>
                          <Ionicons name="folder-outline" size={11} color={colores.suave} />
                          <Text style={[styles.planCardTagText, { color: colores.suave }]}>INDEPENDIENTES</Text>
                        </View>
                      </View>
                      <Text style={styles.planCardTitle}>Rutinas sin Plan Asignado</Text>
                      <Text style={styles.planCardSubtitle}>Colección de rutinas sueltas o personalizadas</Text>
                      <View style={styles.planCardFooterRow}>
                        <View style={styles.planMetricChip}>
                          <Ionicons name="barbell-outline" size={12} color={colores.suave} />
                          <Text style={styles.planMetricChipText}>{rutinasSueltas.length} rutinas</Text>
                        </View>
                        <View style={styles.planCardActionBtn}>
                          <Text style={styles.planCardActionBtnText}>Ver Rutinas</Text>
                          <Ionicons name="chevron-forward" size={13} color={colores.suave} />
                        </View>
                      </View>
                    </Pressable>
                  )}
                </View>
              )}

              {/* PANEL 3: Notas (Rediseñado con Efecto MainDayCard y YoungNewtButton) */}
              {tab === 'notas' && (
                <View style={{ gap: 20 }}>
                  {/* Header Inteligente 1: Biblioteca de Plantillas */}
                  <View style={styles.aestheticSectionHeaderRow}>
                    <View style={styles.cyberSectionBadge}>
                      <Ionicons name="document-text" size={12.5} color="#FFFFFF" />
                      <Text style={styles.cyberSectionBadgeText}>BIBLIOTECA DE PLANTILLAS</Text>
                    </View>
                    <View style={styles.countChip}>
                      <Text style={styles.countChipText}>{notasBiblioteca.length}</Text>
                    </View>
                  </View>

                  {/* Lista de Notas de la Biblioteca con Efecto MainDayCard */}
                  {notasBiblioteca.length === 0 ? (
                    <View style={styles.emptyDashedBox}>
                      <Ionicons name="document-text-outline" size={26} color={colores.suave} />
                      <Text style={styles.emptyDashedText}>
                        No tienes notas estandarizadas. Crea plantillas en la pestaña &apos;Notas&apos;.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 14 }}>
                      {notasBiblioteca.map((n) => (
                        <LibraryNoteCardWithMainDayGlow
                          key={n.id}
                          nota={n}
                          isLinking={vinculandoNotaId === n.id}
                          onVincular={vincularNotaEstandar}
                        />
                      ))}
                    </View>
                  )}

                  {/* Header Inteligente 2: Nota Rápida del Día */}
                  <View style={[styles.aestheticSectionHeaderRow, { marginTop: 6 }]}>
                    <View style={styles.cyberSectionBadge}>
                      <Ionicons name="sparkles" size={12.5} color={colores.primarioHover} />
                      <Text style={styles.cyberSectionBadgeText}>NOTA RÁPIDA AD-HOC</Text>
                    </View>
                  </View>

                  {/* Tarjeta de Nota Rápida con Selector Inteligente y Efecto MainDayCard */}
                  <QuickNoteCardWithMainDayGlow
                    texto={nuevaNotaAdHoc}
                    onChangeTexto={setNuevaNotaAdHoc}
                    categoria={categoriaAdHoc}
                    onSelectCategoria={setCategoriaAdHoc}
                    guardando={guardandoNota}
                    onSubmit={guardarNotaSubmit}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </ScreenBackground>
      </KeyboardAvoidingView>

      {/* MODAL DE RUTINAS ASOCIADAS AL PLAN SELECCIONADO (DIÁLOGO FLOTANTE CENTRADO) */}
      <Modal
        visible={modalRutinasPlanVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setModalRutinasPlanVisible(false)}
      >
        <View style={styles.modalCenteredBackdrop}>
          {/* Backdrop con tap para descartar */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalRutinasPlanVisible(false)}
          />

          <View style={styles.modalCenteredCard}>
            {/* Top Bar con Badge Centrado y Botón Cerrar (X) Inteligente */}
            <View style={styles.modalHeaderTopBar}>
              {/* Badge del Plan Centrado */}
              <View
                style={[
                  styles.planCardTagBadge,
                  {
                    backgroundColor: `${planParaVerRutinas?.color || colores.primarioHover}18`,
                    borderColor: `${planParaVerRutinas?.color || colores.primarioHover}40`,
                  },
                ]}
              >
                <Ionicons
                  name={(planParaVerRutinas?.icono as any) || 'barbell'}
                  size={11.5}
                  color={planParaVerRutinas?.color || colores.primarioHover}
                />
                <Text
                  style={[
                    styles.planCardTagText,
                    { color: planParaVerRutinas?.color || colores.primarioHover },
                  ]}
                >
                  {planParaVerRutinas ? (planParaVerRutinas.activo ? 'PLAN ACTIVO' : 'PLAN') : 'INDEPENDIENTES'}
                </Text>
              </View>

              {/* Botón de Cerrar (X) posicionado de forma absoluta a la derecha */}
              <Pressable
                onPress={() => {
                  vibrarBoton();
                  setModalRutinasPlanVisible(false);
                }}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.modalCloseButtonAbsolute,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal de rutinas"
              >
                <Ionicons name="close" size={17} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Cabecera del Plan Centrada */}
            <View style={styles.modalHeaderCenterGroup}>
              <Text style={styles.modalPlanTitle}>
                {planParaVerRutinas?.nombre || 'Rutinas Independientes'}
              </Text>
              <Text style={styles.modalPlanSubtitle}>
                Selecciona una rutina para vincular a tu {nombreDia(fecha)}
              </Text>
            </View>

            {/* Separador de luz sutil */}
            <View style={styles.dialogDivider} />

            {/* Lista de Rutinas del Plan con StatCards Estéticas Centradas y Efecto MainDayCard */}
            <ScrollView
              contentContainerStyle={{ gap: 16, paddingVertical: 10, paddingHorizontal: 6 }}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 440 }}
            >
              {cargandoRutinasPlan ? (
                <View style={styles.emptyDashedBox}>
                  <Text style={styles.emptyDashedText}>Cargando rutinas del plan...</Text>
                </View>
              ) : rutinasDelPlanModal.length === 0 ? (
                <View style={styles.emptyDashedBox}>
                  <Ionicons name="barbell-outline" size={26} color={colores.suave} />
                  <Text style={styles.emptyDashedText}>No hay rutinas creadas en este plan todavía.</Text>
                </View>
              ) : (
                rutinasDelPlanModal.map((rut) => {
                  const diaSemanaIndex = fecha ? (fecha.getDay() === 0 ? 6 : fecha.getDay() - 1) : null;
                  const esSugeridoHoy = rut.dia_sugerido !== null && rut.dia_sugerido === diaSemanaIndex;

                  return (
                    <RoutineStatCardWithMainDayGlow
                      key={rut.id}
                      rut={rut}
                      esSugeridoHoy={esSugeridoHoy}
                      planParaVerRutinas={planParaVerRutinas}
                      onVincular={vincularRutinaEntera}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  aestheticSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  activitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  activitySectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activitySectionAccent: {
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  activitySectionTitle: {
    color: '#E4E4E7',
    fontSize: 10.5,
    fontFamily: fuentes.extraBold,
    letterSpacing: 1.2,
  },
  activitySectionCount: {
    minWidth: 18,
    height: 17,
    paddingHorizontal: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitySectionCountText: {
    color: '#8A8A93',
    fontSize: 9.5,
    fontFamily: fuentes.bold,
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
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  addSectionBtnText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10.5,
    fontFamily: fuentes.bold,
  },
  obsidianNoteCard: {
    backgroundColor: 'rgba(16, 17, 23, 0.92)',
    borderRadius: 18,
    padding: 14,
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 2,
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
  noteCategoryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  noteCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  noteCategoryPillText: {
    fontSize: 9.5,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.85,
  },
  deleteNoteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCardTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontFamily: fuentes.extraBold,
    lineHeight: 20,
  },
  noteCardBody: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fuentes.regular,
  },
  emptyDashedBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyDashedText: {
    color: 'rgba(255, 255, 255, 0.42)',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  emptyActionBtn: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyActionBtnText: {
    color: 'rgba(255, 255, 255, 0.82)',
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
    gap: 7,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  extraExercisesDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colores.exito,
  },
  extraExercisesHeaderText: {
    color: colores.exito,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
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
  libraryNoteCardGlowBase: {
    backgroundColor: 'rgb(14, 14, 18)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryNoteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryNoteCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
  },
  libraryNoteCategoryPillText: {
    fontSize: 9.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.6,
  },
  libraryNoteTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontFamily: fuentes.bold,
    textAlign: 'center',
  },
  libraryNoteBody: {
    color: 'rgba(255, 255, 255, 0.70)',
    fontSize: 12.5,
    fontFamily: fuentes.regular,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  quickNoteCardGlowBase: {
    backgroundColor: 'rgb(14, 14, 18)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
  },
  quickNoteHeadingTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fuentes.bold,
    textAlign: 'center',
  },
  quickNoteHeadingSubtitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  quickNoteCategoryChipsRow: {
    gap: 7,
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  quickNoteCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  quickNoteCategoryChipText: {
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  quickNoteTextInput: {
    backgroundColor: 'rgba(10, 10, 14, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: fuentes.regular,
    minHeight: 85,
    textAlignVertical: 'top',
  },
  planSectionSubtext: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12.5,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  planStatCard: {
    backgroundColor: 'rgba(20, 20, 26, 0.90)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  planStatCardActivo: {
    backgroundColor: 'rgba(24, 24, 30, 0.96)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  planCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  planCardTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  planCardTagText: {
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  planCardBadgeActivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  dotLiveGreenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  planCardBadgeActivoText: {
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    color: '#10B981',
    letterSpacing: 0.5,
  },
  planCardBadgeSecundario: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  planCardBadgeSecundarioText: {
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    color: colores.suave,
    letterSpacing: 0.5,
  },
  planCardTitle: {
    fontFamily: fuentes.black,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  planCardSubtitle: {
    fontFamily: fuentes.regular,
    fontSize: 12,
    color: colores.suave,
    lineHeight: 17,
  },
  planCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    gap: 8,
  },
  planMetricChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planMetricChipText: {
    fontFamily: fuentes.medium,
    fontSize: 11,
    color: colores.suave,
  },
  planCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#101010',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
    // @ts-ignore
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            'inset 0px 1px 1px rgba(255, 255, 255, 0.2), inset 0px 2px 2px rgba(255, 255, 255, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.35)',
        }
      : {}),
  },
  planCardActionBtnActivo: {
    borderColor: 'rgba(255, 255, 255, 0.30)',
    // @ts-ignore
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            'inset 0px 1px 1px rgba(255, 255, 255, 0.28), 0 0 10px rgba(255, 255, 255, 0.2)',
        }
      : {}),
  },
  planCardActionBtnText: {
    fontFamily: fuentes.bold,
    fontSize: 11,
    color: colores.suave,
  },
  planCardActionBtnTextActivo: {
    color: '#FFFFFF',
  },
  modalCenteredBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCenteredCard: {
    width: '92%',
    maxWidth: 390,
    backgroundColor: '#0C0C11',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 36,
    elevation: 24,
    gap: 10,
  },
  modalHeaderTopBar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    width: '100%',
  },
  modalCloseButtonAbsolute: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
    // @ts-ignore
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            'inset 0px 1px 1px rgba(255, 255, 255, 0.22), inset 0px 2px 2px rgba(255, 255, 255, 0.14), inset 0px 4px 4px rgba(255, 255, 255, 0.08), 0px 2px 6px rgba(0, 0, 0, 0.45)',
        }
      : {}),
  },
  modalHeaderCenterGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
    paddingHorizontal: 10,
  },
  modalPlanTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: fuentes.black,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  modalPlanSubtitle: {
    color: colores.suave,
    fontSize: 12.5,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  dialogDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  routineStatCard: {
    backgroundColor: 'rgb(14, 14, 18)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 3,
  },
  routineCardMainDayGlowBase: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 8,
  },
  routineCardMainDayGlowWeb: {
    // @ts-ignore
    boxShadow:
      '0 0 28px 0px rgba(255, 255, 255, 0.38), inset 0 0 36px 0px rgba(255, 255, 255, 0.24)',
  },
  routineHoyBadgeCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: 2,
  },
  routineHoyBadgeText: {
    color: '#10B981',
    fontSize: 9.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.6,
  },
  routineStatTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fuentes.bold,
    textAlign: 'center',
  },
  routineStatMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  routineMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  routineMiniChipText: {
    color: colores.suave,
    fontSize: 11.5,
    fontFamily: fuentes.medium,
  },
  routineCardInnerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: '80%',
    marginVertical: 4,
  },
  routineStatActionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 2,
  },
  radiantButtonCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  radiantHeroButton: {
    width: '100%',
    maxWidth: 290,
  },
  radiantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  radiantHeaderText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.8,
  },
});
