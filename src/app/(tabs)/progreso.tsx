import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { startOfMonth, endOfMonth, subDays, startOfYear } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import { obtenerMetricasProgreso, MetricasProgreso } from '../../services/progreso';
import { aISO } from '../../utils/fechas';
import { seguro } from '../../utils/errores';

type PeriodoFiltro = 'mes' | '30dias' | 'anio';

export default function ProgresoScreen() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
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
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState<string | null>(null);

  const cargarMetricas = useCallback(() => {
    seguro(async () => {
      const hoy = new Date();
      let desdeISO = aISO(startOfMonth(hoy));
      let hastaISO = aISO(endOfMonth(hoy));

      if (periodo === '30dias') {
        desdeISO = aISO(subDays(hoy, 30));
        hastaISO = aISO(hoy);
      } else if (periodo === 'anio') {
        desdeISO = aISO(startOfYear(hoy));
        hastaISO = aISO(hoy);
      }

      const res = await obtenerMetricasProgreso(desdeISO, hastaISO);
      setMetricas(res);

      if (res.recordsPersonales.length > 0) {
        setEjercicioSeleccionado((prev) => prev || res.recordsPersonales[0].nombreEjercicio);
      }
    });
  }, [periodo]);

  useFocusEffect(
    useCallback(() => {
      cargarMetricas();
    }, [cargarMetricas])
  );

  const prDestacado = metricas.recordsPersonales.find((r) => r.nombreEjercicio === ejercicioSeleccionado) || metricas.recordsPersonales[0];

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO CENTRADO */}
        <EncabezadoSeccion
          badgeText="MÉTRICAS & NUTRICIÓN"
          titulo="Mi Progreso"
          subtitulo="Rendimiento de rutinas, récords de peso y hábitos saludables"
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 90, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* SELECTOR DE PERÍODO CON PILL LUMINOSO */}
          <View style={styles.periodSelectorBox}>
            {[
              { id: 'mes', label: 'Este Mes' },
              { id: '30dias', label: 'Últimos 30 Días' },
              { id: 'anio', label: 'Este Año' },
            ].map((item) => {
              const active = periodo === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPeriodo(item.id as PeriodoFiltro)}
                  style={[
                    styles.periodPill,
                    {
                      backgroundColor: active ? colores.primarioHover : 'transparent',
                      borderColor: active ? '#FFF' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#FFF' : colores.suave,
                      fontFamily: active ? fuentes.black : fuentes.bold,
                      fontSize: 12,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* TARJETAS KPI DE ALTO NIVEL */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Card 1: Tonelaje Total */}
              <View style={styles.kpiCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="barbell" size={16} color={colores.primarioHover} />
                  <Text style={styles.kpiLabelText}>Volumen Total</Text>
                </View>
                <Text style={styles.kpiValueText}>
                  {metricas.volumenTotalKg.toLocaleString()}{' '}
                  <Text style={styles.kpiUnitText}>kg</Text>
                </Text>
              </View>

              {/* Card 2: Días Cumplidos */}
              <View style={styles.kpiCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar" size={16} color={colores.exito} />
                  <Text style={styles.kpiLabelText}>Días Cumplidos</Text>
                </View>
                <Text style={styles.kpiValueText}>
                  {metricas.diasCompletados}{' '}
                  <Text style={styles.kpiUnitText}>días</Text>
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Card 3: Series Totales */}
              <View style={styles.kpiCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="repeat" size={16} color="#A855F7" />
                  <Text style={styles.kpiLabelText}>Series Totales</Text>
                </View>
                <Text style={styles.kpiValueText}>
                  {metricas.seriesTotales}{' '}
                  <Text style={styles.kpiUnitText}>series</Text>
                </Text>
              </View>

              {/* Card 4: Racha Activa */}
              <View style={styles.kpiCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flame" size={16} color={colores.hoy} />
                  <Text style={styles.kpiLabelText}>Racha Activa</Text>
                </View>
                <Text style={styles.kpiValueText}>
                  {metricas.rachaDias}{' '}
                  <Text style={styles.kpiUnitText}>días</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* SECCIÓN 1: PROGRESO DE RUTINAS ESPECÍFICAS (CREADAS) */}
          <View style={styles.sectionCardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="barbell-outline" size={20} color={colores.primarioHover} />
              <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
                Progreso por Rutina
              </Text>
            </View>

            {metricas.rutinasStats.length === 0 ? (
              <View style={styles.emptyDashedBox}>
                <Ionicons name="fitness-outline" size={24} color={colores.suave} />
                <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic', fontFamily: fuentes.regular }}>
                  Crea y completa rutinas para ver su desglose individual.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {metricas.rutinasStats.map((r) => (
                  <View key={r.id} style={styles.routineStatCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.routineIconBadge}>
                          <Ionicons name="fitness" size={14} color={colores.primarioHover} />
                        </View>
                        <Text style={{ color: colores.texto, fontSize: 16, fontFamily: fuentes.black }}>
                          {r.nombre}
                        </Text>
                      </View>
                      <View style={styles.executionBadge}>
                        <Text style={styles.executionBadgeText}>
                          {r.vecesEjecutada} {r.vecesEjecutada === 1 ? 'ejecución' : 'ejecuciones'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                      <View>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>Volumen Acumulado</Text>
                        <Text style={{ color: colores.texto, fontSize: 15, fontFamily: fuentes.bold }}>
                          {r.volumenTotalKg.toLocaleString()} kg
                        </Text>
                      </View>

                      <View>
                        <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>Series Totales</Text>
                        <Text style={{ color: colores.texto, fontSize: 15, fontFamily: fuentes.bold }}>
                          {r.seriesTotales} series
                        </Text>
                      </View>
                    </View>

                    {r.ejerciciosStats.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {r.ejerciciosStats.slice(0, 4).map((ej) => (
                          <View key={ej.nombre} style={styles.exerciseChip}>
                            <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.medium }}>
                              {ej.nombre}: <Text style={{ color: colores.texto, fontFamily: fuentes.bold }}>{ej.maxPeso > 0 ? `${ej.maxPeso}kg` : `${ej.series}s`}</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* SECCIÓN 2: SEGUIMIENTO DE HÁBITOS, NUTRICIÓN & SUPLEMENTOS (Creatina, Proteína, etc.) */}
          <View style={styles.sectionCardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={20} color={colores.hoy} />
                <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
                  Nutrición & Suplementos
                </Text>
              </View>
              <View style={styles.habitBadgeLabel}>
                <Text style={{ color: colores.hoy, fontSize: 10, fontFamily: fuentes.bold }}>TRACKER</Text>
              </View>
            </View>

            {metricas.habitosStats.length === 0 ? (
              <View style={styles.emptyDashedBox}>
                <Ionicons name="leaf-outline" size={24} color={colores.suave} />
                <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic', fontFamily: fuentes.regular }}>
                  Añade notas en tus días como &quot;📌 [NUTRICIÓN] Toma de Creatina&quot; para rastrear tu constancia.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {metricas.habitosStats.map((h) => {
                  const porcHabito = Math.min(100, Math.round((h.totalDias / (periodo === 'mes' ? 30 : 30)) * 100));
                  return (
                    <View key={h.id} style={styles.habitCardContainer}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.habitIconBox, { backgroundColor: h.bgBadge }]}>
                            <Ionicons name={h.icono as any} size={16} color={h.colorBadge} />
                          </View>
                          <View>
                            <Text style={{ color: colores.texto, fontSize: 15, fontFamily: fuentes.bold }}>
                              {h.titulo}
                            </Text>
                            <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                              {h.categoria}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: h.colorBadge, fontSize: 16, fontFamily: fuentes.black }}>
                            {h.totalDias} {h.totalDias === 1 ? 'día' : 'días'}
                          </Text>
                          {h.rachaActual > 0 && (
                            <Text style={{ color: colores.hoy, fontSize: 11, fontFamily: fuentes.bold }}>
                              ⚡ Racha {h.rachaActual}d
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Bar de Progreso */}
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.max(5, porcHabito)}%`, backgroundColor: h.colorBadge },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* SECCIÓN 3: SALÓN DE RÉCORDS PERSONALES (PRs) */}
          <View style={styles.sectionCardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy" size={20} color={colores.hoy} />
              <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
                Récords Personales (PRs)
              </Text>
            </View>

            {metricas.recordsPersonales.length === 0 ? (
              <View style={styles.emptyDashedBox}>
                <Ionicons name="trophy-outline" size={26} color={colores.suave} />
                <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic', fontFamily: fuentes.regular }}>
                  Registra tus entrenamientos para generar tus primeros récords personales.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {metricas.recordsPersonales.map((pr) => {
                  const sel = ejercicioSeleccionado === pr.nombreEjercicio;
                  return (
                    <Pressable
                      key={pr.nombreEjercicio}
                      onPress={() => setEjercicioSeleccionado(pr.nombreEjercicio)}
                      style={[
                        styles.prItemCard,
                        {
                          borderColor: sel ? colores.hoy : colores.borde,
                          backgroundColor: sel ? 'rgba(217, 119, 6, 0.12)' : 'rgba(10, 12, 18, 0.60)',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={styles.prBadgeBox}>
                          <Ionicons name="ribbon-outline" size={12} color={colores.hoy} />
                          <Text style={styles.prBadgeText}>RÉCORD</Text>
                        </View>
                        {pr.esUnilateral && (
                          <View style={styles.unilateralBadge}>
                            <Text style={styles.unilateralBadgeText}>D/I</Text>
                          </View>
                        )}
                      </View>

                      <Text style={{ color: colores.texto, fontSize: 15, fontFamily: fuentes.black }} numberOfLines={1}>
                        {pr.nombreEjercicio}
                      </Text>

                      <Text style={{ color: colores.hoy, fontSize: 24, fontFamily: fuentes.black }}>
                        {pr.maxPeso} <Text style={{ fontSize: 13, color: colores.suave, fontFamily: fuentes.regular }}>kg</Text>
                      </Text>

                      <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.regular }}>
                        Mejor serie: {pr.maxReps} reps • {pr.fecha}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* SECCIÓN 4: DETECTOR DE SOBRECARGA PROGRESIVA DEL EJERCICIO SELECCIONADO */}
          {prDestacado && (
            <View style={styles.sectionCardContainer}>
              <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase', letterSpacing: 1 }}>
                ANÁLISIS DE SOBRECARGA PROGRESIVA
              </Text>
              <Text style={{ fontSize: 20, fontFamily: fuentes.black, color: colores.texto }}>
                {prDestacado.nombreEjercicio}
              </Text>

              <View style={styles.analysisInnerBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.suave, fontSize: 12, fontFamily: fuentes.bold }}>Carga Máxima Registrada</Text>
                  <Text style={{ color: colores.exito, fontSize: 18, fontFamily: fuentes.black }}>{prDestacado.maxPeso} KG</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.suave, fontSize: 12, fontFamily: fuentes.bold }}>Series Realizadas en Período</Text>
                  <Text style={{ color: colores.texto, fontSize: 16, fontFamily: fuentes.bold }}>{prDestacado.totalSeries} series</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colores.suave, fontSize: 12, fontFamily: fuentes.bold }}>Fecha de Marca Máxima</Text>
                  <Text style={{ color: colores.texto, fontSize: 14, fontFamily: fuentes.bold }}>{prDestacado.fecha}</Text>
                </View>
              </View>
            </View>
          )}

          {/* SECCIÓN 5: DISTRIBUCIÓN DEL VOLUMEN POR EJERCICIO */}
          <View style={styles.sectionCardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="pie-chart" size={18} color={colores.primarioHover} />
              <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
                Distribución de Series por Ejercicio
              </Text>
            </View>

            {metricas.ejerciciosStats.length === 0 ? (
              <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic', fontFamily: fuentes.regular }}>Sin estadísticas registradas.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {metricas.ejerciciosStats.slice(0, 6).map((ej) => (
                  <View key={ej.nombre} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colores.texto, fontSize: 14, fontFamily: fuentes.bold }} numberOfLines={1}>
                        {ej.nombre}
                      </Text>
                      <Text style={{ color: colores.primarioHover, fontSize: 12, fontFamily: fuentes.black }}>
                        {ej.series} series ({ej.porcentaje}%)
                      </Text>
                    </View>

                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${ej.porcentaje}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  periodSelectorBox: {
    flexDirection: 'row',
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  kpiLabelText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  kpiValueText: {
    color: colores.texto,
    fontSize: 22,
    fontFamily: fuentes.black,
  },
  kpiUnitText: {
    fontSize: 13,
    color: colores.suave,
    fontFamily: fuentes.regular,
  },
  sectionCardContainer: {
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyDashedBox: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    borderStyle: 'dashed',
  },
  routineStatCard: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  routineIconBadge: {
    backgroundColor: colores.primarioSuave,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  executionBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.30)',
  },
  executionBadgeText: {
    color: colores.exito,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  exerciseChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  habitBadgeLabel: {
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  habitCardContainer: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
  },
  habitIconBox: {
    padding: 8,
    borderRadius: 10,
  },
  prItemCard: {
    borderRadius: 16,
    padding: 14,
    width: 170,
    borderWidth: 1.5,
    gap: 6,
  },
  prBadgeBox: {
    backgroundColor: 'rgba(217, 119, 6, 0.20)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.40)',
  },
  prBadgeText: {
    color: colores.hoy,
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  unilateralBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.30)',
  },
  unilateralBadgeText: {
    color: colores.exito,
    fontSize: 9,
    fontFamily: fuentes.black,
  },
  analysisInnerBox: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.80)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colores.primarioHover,
    borderRadius: 3,
  },
});
