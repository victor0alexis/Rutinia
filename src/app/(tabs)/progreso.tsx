import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import Head from 'expo-router/head';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { fuentes, noir } from '../../constants/colores';
import EditorialHeader from '../../components/EditorialHeader';
import ScreenBackground from '../../components/ScreenBackground';
import ShinyText from '../../components/ShinyText';
import SpotlightSegmentedTabs from '../../components/SpotlightSegmentedTabs';
import YoungNewtButton from '../../components/YoungNewtButton';
import { LiquidMetalButton } from '../../components/LiquidMetalButton';
import {
  AdherenceRing,
  ProgressBar,
  ProgressEmptyState,
  ProgressPanel,
  ProgressSectionHeader,
  ProgressStatus,
  PulseDot,
  tint,
} from '../../components/progreso/ProgressPrimitives';
import {
  EstadisticaRutina,
  HabitoTrackerStat,
  MetricasProgreso,
  RecordPersonal,
  obtenerMetricasProgreso,
} from '../../services/progreso';
import { listarPlanes } from '../../services/planes';
import { PlanEntrenamiento } from '../../types';
import { aISO } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { useLayout } from '../../hooks/useLayout';

type PeriodoFiltro = 'mes' | '30dias' | 'anio';
type IconName = keyof typeof Ionicons.glyphMap;

const PERIODOS: {
  id: PeriodoFiltro;
  label: string;
  iconFocused: IconName;
  iconOutline: IconName;
}[] = [
  {
    id: 'mes',
    label: 'Este mes',
    iconFocused: 'calendar',
    iconOutline: 'calendar-outline',
  },
  {
    id: '30dias',
    label: '30 días',
    iconFocused: 'time',
    iconOutline: 'time-outline',
  },
  {
    id: 'anio',
    label: 'Este año',
    iconFocused: 'trending-up',
    iconOutline: 'trending-up-outline',
  },
];

const COLORES_BARRAS = [
  noir.ice,
  noir.mint,
  noir.lavender,
  noir.champagne,
  '#F08A9B',
  noir.info,
];

const PR_CARD_WIDTH = 184;

function numero(valor: number) {
  const redondeado = Math.round(valor * 10) / 10;
  return Number.isInteger(redondeado)
    ? redondeado.toLocaleString()
    : redondeado.toFixed(1);
}

function fechaCorta(iso?: string | null) {
  if (!iso) return '—';
  const fecha = parseISO(iso);
  if (!isValid(fecha)) return '—';
  return format(fecha, 'd MMM', { locale: es }).toUpperCase();
}

export default function ProgresoScreen() {
  const {
    gutter,
    contentMaxWidth,
    isCompact,
    isLandscape,
  } = useLayout();
  const isFocused = useIsFocused();
  const tabBottomPadding = isLandscape ? 50 : 66;

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [planSeleccionado, setPlanSeleccionado] = useState<string>('TODOS');
  const [cargando, setCargando] = useState(true);
  const [metricas, setMetricas] = useState<MetricasProgreso>({
    volumenTotalKg: 0,
    diasCompletados: 0,
    seriesTotales: 0,
    rachaDias: 0,
    recordsPersonales: [],
    ejerciciosStats: [],
    rutinasStats: [],
    habitosStats: [],
  });
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState<
    string | null
  >(null);

  const cargarMetricas = useCallback(async () => {
    await seguro(async () => {
      const hoy = new Date();
      let desdeISO = aISO(startOfMonth(hoy));
      let hastaISO = aISO(hoy);

      if (periodo === '30dias') {
        desdeISO = aISO(subDays(hoy, 30));
      } else if (periodo === 'anio') {
        desdeISO = aISO(startOfYear(hoy));
      }

      const res = await obtenerMetricasProgreso(desdeISO, hastaISO);
      setMetricas(res);
      setEjercicioSeleccionado((prev) => {
        const sigueExistiendo = res.recordsPersonales.some(
          (record) => record.nombreEjercicio === prev
        );
        if (sigueExistiendo) return prev;
        return res.recordsPersonales[0]?.nombreEjercicio ?? null;
      });
    });
  }, [periodo]);

  const cargarPlanes = useCallback(async () => {
    await seguro(async () => {
      const data = await listarPlanes({ incluirArchivados: true });
      setPlanes(data);
    });
  }, []);

  const recargar = useCallback(() => {
    setCargando(true);
    Promise.all([cargarMetricas(), cargarPlanes()]).finally(() => {
      setCargando(false);
    });
  }, [cargarMetricas, cargarPlanes]);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar])
  );

  const entrenamientos = useMemo(
    () =>
      metricas.rutinasStats.reduce(
        (total, rutina) => total + rutina.vecesEjecutada,
        0
      ),
    [metricas.rutinasStats]
  );

  const diasTranscurridos = useMemo(() => {
    const hoy = new Date();
    if (periodo === 'mes') {
      return differenceInCalendarDays(hoy, startOfMonth(hoy)) + 1;
    }
    if (periodo === 'anio') {
      return differenceInCalendarDays(hoy, startOfYear(hoy)) + 1;
    }
    return 30;
  }, [periodo]);

  const pctConstancia = Math.min(
    100,
    Math.round(
      (metricas.diasCompletados / Math.max(1, diasTranscurridos)) * 100
    )
  );

  const rutinasConActividad = useMemo(
    () =>
      metricas.rutinasStats.filter(
        (rutina) =>
          // Las sesiones sin completar no representan progreso de rutina.
          // Se excluyen aunque tengan series registradas (p. ej. un borrador).
          rutina.vecesEjecutada > 0 || rutina.volumenTotalKg > 0
      ),
    [metricas.rutinasStats]
  );

  const rutinasFiltradas = useMemo(
    () =>
      planSeleccionado === 'TODOS'
        ? rutinasConActividad
        : rutinasConActividad.filter(
            (rutina) => rutina.planId === planSeleccionado
          ),
    [planSeleccionado, rutinasConActividad]
  );

  const maxVolumenRutina = useMemo(
    () =>
      Math.max(
        1,
        ...rutinasFiltradas.map((rutina) => rutina.volumenTotalKg)
      ),
    [rutinasFiltradas]
  );

  const habitosOrdenados = useMemo(
    () =>
      [...metricas.habitosStats].sort(
        (a, b) =>
          b.totalDias - a.totalDias || b.rachaActual - a.rachaActual
      ),
    [metricas.habitosStats]
  );

  const topEjercicios = useMemo(
    () => metricas.ejerciciosStats.slice(0, 6),
    [metricas.ejerciciosStats]
  );

  const prDestacado =
    metricas.recordsPersonales.find(
      (record) => record.nombreEjercicio === ejercicioSeleccionado
    ) ?? metricas.recordsPersonales[0];

  const hayActividad =
    metricas.seriesTotales > 0 ||
    metricas.volumenTotalKg > 0 ||
    metricas.diasCompletados > 0 ||
    entrenamientos > 0;

  const tituloTamano = isLandscape ? 22 : isCompact ? 24 : 28;
  const shinyWebStyle =
    Platform.OS === 'web'
      ? ({
          width: '100%',
          display: 'block',
          fontSize: tituloTamano,
          fontFamily: fuentes.extraBold,
          fontWeight: 800,
          lineHeight: `${Math.round(tituloTamano * 1.18)}px`,
          letterSpacing: '-0.9px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as any)
      : undefined;

  const emptyRoutineAction =
    planSeleccionado === 'TODOS' ? (
      <YoungNewtButton
        title="Crear una rutina"
        onPress={() => router.push('/rutinas')}
      />
    ) : (
      <Pressable
        onPress={() => setPlanSeleccionado('TODOS')}
        style={({ pressed }) => [
          styles.emptyLink,
          pressed && { opacity: 0.62 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ver todos los planes"
      >
        <Text style={styles.emptyLinkText}>Ver todos los planes</Text>
      </Pressable>
    );

  return (
    <ScreenBackground>
      <Head>
        <title>Progreso · Rutinia</title>
      </Head>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingBottom: tabBottomPadding,
          }}
        >
          <EditorialHeader
            title="Progreso"
            style={{
              paddingTop: isLandscape ? 2 : 4,
              marginBottom: isLandscape ? 4 : 8,
            }}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HERO EDITORIAL: LA MARCA APLICADA A LAS MÉTRICAS */}
            <View style={styles.hero}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrowText}>PANEL DE RENDIMIENTO</Text>
              </View>

              <View
                style={[
                  styles.shinyTitleWrap,
                  { height: tituloTamano * 1.4 },
                ]}
              >
                <ShinyText
                  text="Tu evolución"
                  color={noir.platinum}
                  shineColor="#FFFFFF"
                  speed={3.2}
                  fontSize={tituloTamano}
                  fontFamily={fuentes.extraBold}
                  align="left"
                  width="100%"
                  height={tituloTamano * 1.4}
                  style={shinyWebStyle}
                />
              </View>

              <Text style={styles.heroStats} numberOfLines={2}>
                {hayActividad ? (
                  <>
                    <Text style={styles.heroStatsStrong}>
                      {metricas.diasCompletados}{' '}
                      {metricas.diasCompletados === 1 ? 'día activo' : 'días activos'}
                    </Text>
                    <Text style={styles.heroStatsSep}> · </Text>
                    <Text style={styles.heroStatsStrong}>
                      {numero(metricas.volumenTotalKg)} kg movidos
                    </Text>
                    <Text style={styles.heroStatsSep}> · </Text>
                    {metricas.rachaDias}{' '}
                    {metricas.rachaDias === 1 ? 'día de racha' : 'días de racha'}
                  </>
                ) : cargando ? (
                  'Sincronizando tu progreso con los entrenamientos…'
                ) : (
                  'Tu primera marca aparecerá aquí al registrar un entrenamiento'
                )}
              </Text>
            </View>

            <SpotlightSegmentedTabs
              tabs={PERIODOS}
              activeTab={periodo}
              onChangeTab={(id) => setPeriodo(id)}
            />

            {/* RESUMEN PRINCIPAL: VOLUMEN, CONSTANCIA Y MICRO-MÉTRICAS */}
            <ProgressPanel
              glow
              radius={22}
              style={[
                styles.summaryPanel,
                { padding: isCompact ? 13 : 16 },
              ]}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.summaryHeaderLeft}>
                  <PulseDot />
                  <Text style={styles.summaryHeaderLabel}>
                    RESUMEN DEL PERÍODO
                  </Text>
                </View>
                <ProgressStatus loading={cargando} />
              </View>

              <View style={styles.summaryTop}>
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryLabel}>VOLUMEN TOTAL</Text>
                  <View style={styles.volumeLine}>
                    <Text
                      style={[
                        styles.volumeValue,
                        { fontSize: isCompact ? 30 : 36 },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.66}
                    >
                      {numero(metricas.volumenTotalKg)}
                    </Text>
                    <Text style={styles.volumeUnit}>kg</Text>
                  </View>
                  <Text style={styles.summaryMeta} numberOfLines={1}>
                    {numero(metricas.seriesTotales)} series ·{' '}
                    {entrenamientos}{' '}
                    {entrenamientos === 1
                      ? 'entrenamiento'
                      : 'entrenamientos'}
                  </Text>
                </View>

                <AdherenceRing
                  value={pctConstancia}
                  size={isCompact ? 82 : 92}
                />
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.metricsRow}>
                <MiniMetric
                  icon="calendar-outline"
                  label="Días activos"
                  value={String(metricas.diasCompletados)}
                  color={noir.mint}
                />
                <MiniMetric
                  icon="flame-outline"
                  label="Racha"
                  value={String(metricas.rachaDias)}
                  color={noir.champagne}
                />
                <MiniMetric
                  icon="trophy-outline"
                  label="Récords"
                  value={String(metricas.recordsPersonales.length)}
                  color={noir.lavender}
                />
              </View>
            </ProgressPanel>

            {/* PROGRESO POR RUTINA + FILTRO DE PLANES */}
            <ProgressPanel style={styles.sectionPanel}>
              <ProgressSectionHeader
                icon="barbell-outline"
                title="Progreso por rutina"
                meta={
                  rutinasFiltradas.length > 0
                    ? `${rutinasFiltradas.length} ${
                        rutinasFiltradas.length === 1 ? 'rutina' : 'rutinas'
                      }`
                    : 'Sin actividad'
                }
                accent={noir.ice}
              />

              {planes.length > 0 ? (
                <View style={styles.planRail}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.planRailContent}
                  >
                    <PlanPill
                      label="Todos"
                      selected={planSeleccionado === 'TODOS'}
                      onPress={() => setPlanSeleccionado('TODOS')}
                      icon="layers-outline"
                    />

                    {planes.map((plan) => (
                      <PlanPill
                        key={plan.id}
                        label={plan.nombre}
                        color={plan.color}
                        selected={planSeleccionado === plan.id}
                        onPress={() => setPlanSeleccionado(plan.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {rutinasFiltradas.length === 0 ? (
                <ProgressEmptyState
                  icon="analytics-outline"
                  accent={noir.ice}
                  title={
                    planSeleccionado === 'TODOS'
                      ? 'Tu progreso empieza con una rutina'
                      : 'Sin actividad en este plan'
                  }
                  text={
                    planSeleccionado === 'TODOS'
                      ? 'Crea una rutina y registra tus entrenamientos para ver la evolución de cada bloque de trabajo.'
                      : 'Prueba otro plan o vuelve a la vista general para descubrir dónde se está acumulando tu volumen.'
                  }
                  action={emptyRoutineAction}
                />
              ) : (
                <View style={styles.listGap}>
                  {rutinasFiltradas.map((rutina, index) => (
                    <RoutineProgressCard
                      key={rutina.id}
                      rutina={rutina}
                      index={index}
                      maxVolumen={maxVolumenRutina}
                    />
                  ))}
                </View>
              )}
            </ProgressPanel>

            {/* HÁBITOS DE NUTRICIÓN Y SUPLEMENTACIÓN */}
            <ProgressPanel style={styles.sectionPanel}>
              <ProgressSectionHeader
                icon="nutrition-outline"
                title="Nutrición & suplementos"
                meta="TRACKER"
                accent={noir.champagne}
              />

              <Text style={styles.sectionIntro}>
                Constancia de los hábitos que registras en tus notas diarias.
              </Text>

              {habitosOrdenados.length === 0 ? (
                <ProgressEmptyState
                  icon="leaf-outline"
                  accent={noir.mint}
                  title="Sin hábitos registrados"
                  text="Añade una nota de nutrición o suplementación para empezar a medir tu constancia."
                />
              ) : (
                <>
                  <View style={styles.listGap}>
                    {habitosOrdenados.map((habito, index) => (
                      <HabitProgressCard
                        key={habito.id}
                        habito={habito}
                        index={index}
                        diasBase={diasTranscurridos}
                      />
                    ))}
                  </View>

                  {habitosOrdenados.every(
                    (habito) => habito.totalDias === 0
                  ) ? (
                    <View style={styles.hintRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={noir.muted2}
                      />
                      <Text style={styles.hintText}>
                        Añade una nota de nutrición en tus días para activar el
                        tracker de constancia.
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </ProgressPanel>

            {/* RÉCORDS PERSONALES: CARRUSEL SELECCIONABLE */}
            <ProgressPanel style={styles.sectionPanel}>
              <ProgressSectionHeader
                icon="trophy-outline"
                title="Récords personales"
                meta={
                  metricas.recordsPersonales.length > 0
                    ? `${metricas.recordsPersonales.length} ${
                        metricas.recordsPersonales.length === 1 ? 'PR' : 'PRs'
                      }`
                    : 'Sin PRs'
                }
                accent={noir.champagne}
              />

              {metricas.recordsPersonales.length === 0 ? (
                <ProgressEmptyState
                  icon="ribbon-outline"
                  accent={noir.champagne}
                  title="Aún no hay récords"
                  text="Registra series con peso para que tus mejores marcas aparezcan aquí y puedas analizarlas."
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.prRail}
                  decelerationRate="fast"
                  snapToInterval={PR_CARD_WIDTH + 10}
                  snapToAlignment="start"
                >
                  {metricas.recordsPersonales.map((record, index) => (
                    <PRCard
                      key={record.nombreEjercicio}
                      record={record}
                      index={index}
                      selected={
                        prDestacado?.nombreEjercicio ===
                        record.nombreEjercicio
                      }
                      onPress={() =>
                        setEjercicioSeleccionado(record.nombreEjercicio)
                      }
                    />
                  ))}
                </ScrollView>
              )}
            </ProgressPanel>

            {/* ANÁLISIS DEL RÉCORD SELECCIONADO */}
            {prDestacado ? (
              <ProgressPanel
                glow
                radius={22}
                style={styles.analysisPanel}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={[
                    'rgba(255, 209, 102, 0.095)',
                    'rgba(255, 209, 102, 0.01)',
                    'transparent',
                  ]}
                  locations={[0, 0.44, 1]}
                  style={styles.analysisGlow}
                />

                <Animated.View
                  key={prDestacado.nombreEjercicio}
                  entering={FadeInDown.duration(420)}
                  style={styles.analysisInner}
                >
                  <View style={styles.analysisHeader}>
                    <View style={styles.analysisHeaderLeft}>
                      <View style={styles.analysisIcon}>
                        <Ionicons
                          name="pulse-outline"
                          size={15}
                          color={noir.champagne}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.analysisKicker}>
                          ANÁLISIS DE CARGA
                        </Text>
                        <Text
                          style={styles.analysisTitle}
                          numberOfLines={2}
                        >
                          {prDestacado.nombreEjercicio}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.focusChip}>
                      <PulseDot color={noir.champagne} size={4} />
                      <Text style={styles.focusChipText}>EN FOCO</Text>
                    </View>
                  </View>

                  <View style={styles.analysisHero}>
                    <View style={styles.analysisMain}>
                      <Text style={styles.analysisLabel}>
                        CARGA MÁXIMA
                      </Text>
                      <View style={styles.analysisWeightLine}>
                        <Text style={styles.analysisWeight}>
                          {numero(prDestacado.maxPeso)}
                        </Text>
                        <Text style={styles.analysisWeightUnit}>kg</Text>
                      </View>
                    </View>

                    <View style={styles.analysisDivider} />

                    <View style={styles.analysisSide}>
                      <Text style={styles.analysisLabel}>MEJOR SERIE</Text>
                      <Text style={styles.analysisReps}>
                        {numero(prDestacado.maxReps)}
                        <Text style={styles.analysisRepsUnit}> reps</Text>
                      </Text>
                      <Text style={styles.analysisDate}>
                        {fechaCorta(prDestacado.fecha)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.analysisFooter}>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>
                        SERIES DEL PERÍODO
                      </Text>
                      <Text style={styles.analysisStatValue}>
                        {numero(prDestacado.totalSeries)}
                      </Text>
                    </View>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>
                        RÉCORDS TOTALES
                      </Text>
                      <Text style={styles.analysisStatValue}>
                        {metricas.recordsPersonales.length}
                      </Text>
                    </View>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>TIPO</Text>
                      <Text style={styles.analysisStatValue}>
                        {prDestacado.esUnilateral ? 'UNI' : 'BIL'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </ProgressPanel>
            ) : null}

            {/* DISTRIBUCIÓN DE SERIES POR EJERCICIO */}
            <ProgressPanel style={styles.sectionPanel}>
              <ProgressSectionHeader
                icon="stats-chart-outline"
                title="Distribución de series"
                meta={
                  topEjercicios.length > 0
                    ? `TOP ${topEjercicios.length}`
                    : 'Sin datos'
                }
                accent={noir.lavender}
              />

              {topEjercicios.length === 0 ? (
                <ProgressEmptyState
                  icon="stats-chart-outline"
                  accent={noir.lavender}
                  title="Sin series en este período"
                  text="Cuando registres entrenamientos verás qué ejercicios concentran tu volumen de trabajo."
                />
              ) : (
                <View style={styles.distributionList}>
                  {topEjercicios.map((ejercicio, index) => (
                    <View
                      key={ejercicio.nombre}
                      style={styles.distributionRow}
                    >
                      <View style={styles.distributionTop}>
                        <Text
                          style={styles.distributionName}
                          numberOfLines={1}
                        >
                          {ejercicio.nombre}
                        </Text>
                        <Text style={styles.distributionValue}>
                          {ejercicio.series}{' '}
                          {ejercicio.series === 1 ? 'serie' : 'series'} ·{' '}
                          {ejercicio.porcentaje}%
                        </Text>
                      </View>
                      <ProgressBar
                        value={ejercicio.porcentaje}
                        color={
                          COLORES_BARRAS[index % COLORES_BARRAS.length]
                        }
                        height={5}
                        delay={index * 45}
                      />
                    </View>
                  ))}
                </View>
              )}
            </ProgressPanel>
          </ScrollView>

          {/* ACCIÓN PRINCIPAL: METAL LÍQUIDO */}
          <View style={styles.ctaWrap}>
            <LiquidMetalButton
              titulo={cargando ? 'Actualizando…' : 'Actualizar métricas'}
              onPress={recargar}
              disabled={cargando}
              activo={isFocused && !cargando}
              height={54}
              borderWidth={4}
              tamano="lg"
              icon={
                <Ionicons
                  name="pulse-outline"
                  size={15}
                  color="#FFFFFF"
                />
              }
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Subcomponentes                                */
/* -------------------------------------------------------------------------- */

function MiniMetric({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.miniMetric}>
      <View
        style={[
          styles.miniIcon,
          {
            backgroundColor: tint(color, '16'),
            borderColor: tint(color, '34'),
          },
        ]}
      >
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PlanPill({
  label,
  color,
  selected,
  onPress,
  icon,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.planPill,
        selected && styles.planPillSelected,
        hovered && !selected && styles.planPillHovered,
        pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtrar por ${label}`}
    >
      {selected ? (
        <LinearGradient
          colors={['#FFFFFF', '#E8EEF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {icon ? (
        <Ionicons
          name={icon}
          size={12}
          color={selected ? '#090B0F' : noir.muted2}
        />
      ) : (
        <View
          style={[
            styles.planPillDot,
            {
              backgroundColor: color ?? noir.ice,
              borderColor: selected
                ? 'rgba(9, 11, 15, 0.18)'
                : 'transparent',
            },
          ]}
        />
      )}

      <Text
        numberOfLines={1}
        style={[
          styles.planPillText,
          selected && styles.planPillTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RoutineProgressCard({
  rutina,
  index,
  maxVolumen,
}: {
  rutina: EstadisticaRutina;
  index: number;
  maxVolumen: number;
}) {
  const color = rutina.planColor || noir.ice;
  const porcentaje = Math.min(
    100,
    Math.round((rutina.volumenTotalKg / Math.max(1, maxVolumen)) * 100)
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(390).delay(
        Math.min(60 + index * 55, 340)
      )}
    >
      <View style={styles.routineCard}>
        <View
          style={[styles.routineAccent, { backgroundColor: color }]}
        />

        <View style={styles.routineTopRow}>
          <View
            style={[
              styles.routineIcon,
              {
                backgroundColor: tint(color, '18'),
                borderColor: tint(color, '36'),
              },
            ]}
          >
            <Ionicons name="barbell-outline" size={15} color={color} />
          </View>

          <View style={styles.routineTitleWrap}>
            {rutina.planNombre ? (
              <View
                style={[
                  styles.planTag,
                  {
                    backgroundColor: tint(color, '16'),
                    borderColor: tint(color, '36'),
                  },
                ]}
              >
                <Text
                  style={[styles.planTagText, { color }]}
                  numberOfLines={1}
                >
                  {rutina.planNombre}
                </Text>
              </View>
            ) : null}

            <Text style={styles.routineName} numberOfLines={1}>
              {rutina.nombre}
            </Text>
          </View>

          <View style={styles.executionChip}>
            <Text style={styles.executionChipText}>
              {rutina.vecesEjecutada}×
            </Text>
          </View>
        </View>

        <View style={styles.routineStatsRow}>
          <View style={styles.routineStat}>
            <Text style={styles.routineStatLabel}>Volumen</Text>
            <Text style={styles.routineStatValue} numberOfLines={1}>
              {numero(rutina.volumenTotalKg)}
              <Text style={styles.routineStatUnit}> kg</Text>
            </Text>
          </View>
          <View style={styles.routineStat}>
            <Text style={styles.routineStatLabel}>Series</Text>
            <Text style={styles.routineStatValue} numberOfLines={1}>
              {numero(rutina.seriesTotales)}
            </Text>
          </View>
          <View style={styles.routineStat}>
            <Text style={styles.routineStatLabel}>Última</Text>
            <Text style={styles.routineStatValue} numberOfLines={1}>
              {fechaCorta(rutina.ultimaEjecucion)}
            </Text>
          </View>
        </View>

        {rutina.ejerciciosStats.length > 0 ? (
          <View style={styles.exerciseChips}>
            {rutina.ejerciciosStats.slice(0, 3).map((ejercicio) => (
              <View
                key={ejercicio.nombre}
                style={styles.exerciseChip}
              >
                <Text style={styles.exerciseChipText} numberOfLines={1}>
                  {ejercicio.nombre}
                  {ejercicio.maxPeso > 0
                    ? ` · ${numero(ejercicio.maxPeso)}kg`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.routineBarRow}>
          <View style={{ flex: 1 }}>
            <ProgressBar
              value={porcentaje}
              color={color}
              height={5}
              delay={80 + index * 40}
            />
          </View>
          <Text style={styles.routineBarPct}>{porcentaje}%</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function HabitProgressCard({
  habito,
  index,
  diasBase,
}: {
  habito: HabitoTrackerStat;
  index: number;
  diasBase: number;
}) {
  const color = habito.colorBadge || noir.mint;
  const porcentaje = Math.min(
    100,
    Math.round(
      (habito.totalDias / Math.max(1, diasBase)) * 100
    )
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(380).delay(
        Math.min(80 + index * 55, 300)
      )}
    >
      <View style={styles.habitCard}>
        <View style={styles.habitTopRow}>
          <View
            style={[
              styles.habitIcon,
              {
                backgroundColor: habito.bgBadge,
                borderColor: tint(color, '36'),
              },
            ]}
          >
            <Ionicons
              name={habito.icono as IconName}
              size={16}
              color={color}
            />
          </View>

          <View style={styles.habitTitleWrap}>
            <Text style={styles.habitTitle} numberOfLines={1}>
              {habito.titulo}
            </Text>
            <Text style={styles.habitCategory} numberOfLines={1}>
              {habito.categoria}
            </Text>
          </View>

          <View style={styles.habitCountWrap}>
            <Text style={[styles.habitCount, { color }]}>
              {habito.totalDias}
              <Text style={styles.habitCountUnit}> d</Text>
            </Text>
            <Text style={styles.habitStreak} numberOfLines={1}>
              {habito.totalDias === 0
                ? 'Sin registros'
                : habito.rachaActual > 0
                  ? `Racha ${habito.rachaActual}d`
                  : 'Sin racha'}
            </Text>
          </View>
        </View>

        <View style={styles.habitBarRow}>
          <View style={{ flex: 1 }}>
            <ProgressBar
              value={porcentaje}
              color={color}
              height={5}
              delay={80 + index * 40}
            />
          </View>
          <Text style={[styles.habitPct, { color }]}>
            {porcentaje}%
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function PRCard({
  record,
  index,
  selected,
  onPress,
}: {
  record: RecordPersonal;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Animated.View
      entering={FadeInRight.duration(360).delay(
        Math.min(index * 50, 260)
      )}
      style={styles.prCardWrap}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.prCard,
          selected && styles.prCardSelected,
          hovered && !selected && styles.prCardHovered,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Récord de ${record.nombreEjercicio}: ${record.maxPeso} kilos`}
      >
        {selected ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(255, 209, 102, 0.105)',
              'rgba(255, 209, 102, 0.012)',
            ]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <View style={styles.prTopRow}>
          <View
            style={[
              styles.prBadge,
              selected && styles.prBadgeSelected,
            ]}
          >
            <Ionicons
              name="ribbon-outline"
              size={11}
              color={selected ? noir.champagne : noir.muted2}
            />
            <Text
              style={[
                styles.prBadgeText,
                selected && { color: noir.champagne },
              ]}
            >
              RÉCORD
            </Text>
          </View>

          {record.esUnilateral ? (
            <View style={styles.prUnilateral}>
              <Text style={styles.prUnilateralText}>D/I</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.prExercise} numberOfLines={2}>
          {record.nombreEjercicio}
        </Text>

        <View style={styles.prWeightRow}>
          <Text
            style={[
              styles.prWeight,
              selected && { color: noir.champagne },
            ]}
          >
            {numero(record.maxPeso)}
          </Text>
          <Text style={styles.prUnit}>kg</Text>
        </View>

        <Text style={styles.prMeta} numberOfLines={1}>
          {numero(record.maxReps)} reps · {fechaCorta(record.fecha)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 2,
    paddingBottom: 6,
    gap: 13,
  },
  hero: {
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
    backgroundColor: noir.ice,
    shadowColor: noir.ice,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 2,
  },
  eyebrowText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 1.35,
  },
  shinyTitleWrap: {
    justifyContent: 'center',
    marginTop: 1,
  },
  heroStats: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  heroStatsStrong: {
    color: '#DCE3EC',
    fontFamily: fuentes.semiBold,
  },
  heroStatsSep: {
    color: 'rgba(255, 255, 255, 0.18)',
  },
  summaryPanel: {
    padding: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.055)',
    marginBottom: 14,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  summaryHeaderLabel: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 1.05,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.05,
  },
  volumeLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  volumeValue: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.65,
    flexShrink: 1,
  },
  volumeUnit: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 12,
    marginBottom: 5,
  },
  summaryMeta: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    marginTop: 15,
    marginBottom: 13,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  miniMetric: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  miniIcon: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  miniValue: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.4,
  },
  miniLabel: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  sectionPanel: {
    padding: 14,
  },
  sectionIntro: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },
  planRail: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 17,
    padding: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planRailContent: {
    gap: 4,
    paddingRight: 1,
  },
  planPill: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  planPillSelected: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  planPillHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
  },
  planPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  planPillText: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    letterSpacing: 0.05,
    maxWidth: 130,
  },
  planPillTextSelected: {
    color: '#090B0F',
    fontFamily: fuentes.bold,
  },
  listGap: {
    gap: 9,
  },
  routineCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.065)',
    borderRadius: 16,
    padding: 12,
    paddingLeft: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  routineAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
  routineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  routineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routineTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  planTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    maxWidth: 150,
  },
  planTagText: {
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  routineName: {
    color: '#F4F7FB',
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    letterSpacing: -0.15,
  },
  executionChip: {
    minWidth: 34,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  executionChipText: {
    color: '#E8EDF4',
    fontFamily: fuentes.extraBold,
    fontSize: 10.5,
    letterSpacing: -0.15,
  },
  routineStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  routineStat: {
    flex: 1,
    minWidth: 0,
  },
  routineStatLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  routineStatValue: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  routineStatUnit: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
  },
  exerciseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  exerciseChip: {
    maxWidth: '100%',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
  },
  exerciseChipText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    letterSpacing: 0.1,
  },
  routineBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  routineBarPct: {
    width: 29,
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8,
    textAlign: 'right',
  },
  habitCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.065)',
    borderRadius: 14,
    padding: 11,
  },
  habitTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  habitIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  habitTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  habitTitle: {
    color: '#F4F7FB',
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  habitCategory: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  habitCountWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  habitCount: {
    fontFamily: fuentes.extraBold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.45,
  },
  habitCountUnit: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8,
    letterSpacing: 0,
  },
  habitStreak: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    lineHeight: 11,
    marginTop: 1,
  },
  habitBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  habitPct: {
    width: 30,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    textAlign: 'right',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  hintText: {
    flex: 1,
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
  },
  prRail: {
    gap: 10,
    paddingTop: 1,
    paddingBottom: 1,
    paddingRight: 2,
  },
  prCardWrap: {
    width: PR_CARD_WIDTH,
  },
  prCard: {
    width: PR_CARD_WIDTH,
    minHeight: 166,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 4,
  },
  prCardHovered: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  prCardSelected: {
    borderColor: 'rgba(255, 209, 102, 0.42)',
    backgroundColor: 'rgba(255, 209, 102, 0.045)',
    shadowColor: noir.champagne,
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  prTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
  },
  prBadgeSelected: {
    backgroundColor: 'rgba(255, 209, 102, 0.10)',
    borderColor: 'rgba(255, 209, 102, 0.28)',
  },
  prBadgeText: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  prUnilateral: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
  },
  prUnilateralText: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.6,
  },
  prExercise: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.15,
    marginTop: 13,
    minHeight: 36,
  },
  prWeightRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  prWeight: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.1,
  },
  prUnit: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 10,
    marginBottom: 4,
  },
  prMeta: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  analysisPanel: {
    padding: 16,
  },
  analysisGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  analysisInner: {
    position: 'relative',
    zIndex: 1,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  analysisHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  analysisIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.26)',
    flexShrink: 0,
  },
  analysisKicker: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 8,
    letterSpacing: 1.05,
  },
  analysisTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
    marginTop: 1,
  },
  focusChip: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 209, 102, 0.075)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.22)',
    flexShrink: 0,
  },
  focusChipText: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  analysisHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
  },
  analysisMain: {
    flex: 1,
    minWidth: 0,
  },
  analysisLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.75,
  },
  analysisWeightLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 3,
  },
  analysisWeight: {
    color: noir.champagne,
    fontFamily: fuentes.extraBold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.7,
  },
  analysisWeightUnit: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 11,
    marginBottom: 5,
    opacity: 0.8,
  },
  analysisDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  analysisSide: {
    flex: 1,
    minWidth: 0,
  },
  analysisReps: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
    marginTop: 3,
  },
  analysisRepsUnit: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0,
  },
  analysisDate: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    lineHeight: 12,
    marginTop: 2,
  },
  analysisFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  analysisStat: {
    flex: 1,
    minWidth: 0,
  },
  analysisStatLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 6.8,
    letterSpacing: 0.62,
  },
  analysisStatValue: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 3,
  },
  distributionList: {
    gap: 11,
  },
  distributionRow: {
    gap: 5,
  },
  distributionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  distributionName: {
    flex: 1,
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 11.5,
  },
  distributionValue: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    flexShrink: 0,
  },
  emptyLink: {
    minHeight: 38,
    minWidth: 160,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLinkText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  ctaWrap: {
    width: '100%',
    paddingTop: 8,
    flexShrink: 0,
  },
});
