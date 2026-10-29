import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Head from 'expo-router/head';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { colores, fuentes } from '../../constantes/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import GlowButton from '../../components/GlowButton';
import DiaDetalleModal, { parsearNotaInteligente } from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import { registrosDeRango } from '../../services/registros';
import { listarPlanes } from '../../services/planes';
import { aISO, nombreDia } from '../../utilidades/fechas';
import { seguro } from '../../utilidades/errores';
import { parsearEjercicioInfo } from '../../utilidades/ejercicios';
import { EjercicioRegistro, PlanEntrenamiento, Registro } from '../../tipos';
import { useLayout } from '../../hooks/useLayout';
import {
  SesionActivaInfo,
  obtenerSesionActivaInfo,
  subscribirSesionActiva,
} from '../../utilidades/sesionActiva';
import { subscribirCambioDatos } from '../../utilidades/sincronizacion';

// Configuración de idioma Español para el Calendario
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarioScreen() {
  const { gutter, contentMaxWidth, tabBarHeight } = useLayout();
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [fechaSeleccionadaISO, setFechaSeleccionadaISO] = useState(aISO(new Date()));
  const [registrosMes, setRegistrosMes] = useState<Registro[]>([]);
  const [planes, setPlanes] = useState<PlanEntrenamiento[]>([]);
  const [filtroPlanId, setFiltroPlanId] = useState<string | null>(null);
  
  // Modales
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);
  const [sesionActivaInfo, setSesionActivaInfo] = useState<SesionActivaInfo | null>(null);
  const [modoResumenModal, setModoResumenModal] = useState(false);

  const cargarDatosMes = useCallback(() => {
    seguro(async () => {
      const inicio = aISO(startOfMonth(fechaReferencia));
      const fin = aISO(endOfMonth(fechaReferencia));
      const [datos, listaPlanes, active] = await Promise.all([
        registrosDeRango(inicio, fin),
        listarPlanes({ incluirArchivados: false }),
        obtenerSesionActivaInfo(),
      ]);
      setRegistrosMes(datos);
      setPlanes(listaPlanes);
      setSesionActivaInfo(active);
    });
  }, [fechaReferencia]);

  useEffect(() => {
    const unsubSesion = subscribirSesionActiva((info) => {
      setSesionActivaInfo(info);
      cargarDatosMes();
    });
    const unsubDatos = subscribirCambioDatos(() => {
      cargarDatosMes();
    });
    return () => {
      unsubSesion();
      unsubDatos();
    };
  }, [cargarDatosMes]);

  useFocusEffect(
    useCallback(() => {
      cargarDatosMes();
    }, [cargarDatosMes])
  );

  // Filtrar registros según el filtro de plan seleccionado si aplica
  const registrosFiltrados = filtroPlanId
    ? registrosMes.filter((r) => r.plan_id === filtroPlanId)
    : registrosMes;

  // Construir mapa de markedDates para react-native-calendars
  const markedDatesMap: Record<string, any> = {};

  registrosFiltrados.forEach((r) => {
    const fecha = r.fecha;
    if (!markedDatesMap[fecha]) {
      markedDatesMap[fecha] = { dots: [] };
    }

    const ejs = r.ejercicios_registro || [];
    const tieneNotas = ejs.some((e) => e.nombre.startsWith('📌'));
    const ejsPuros = ejs.filter((e) => !e.nombre.startsWith('📌'));
    const esRutina = Boolean(r.rutina_id || r.rutina_nombre || r.rutinas?.nombre);
    const esCompletado = r.completado || (ejsPuros.length > 0 && ejsPuros.every((e) => e.completado));

    // Color del dot según el color del plan
    const colorDelPlan = r.planes_entrenamiento?.color || colores.primarioHover;

    if (esCompletado) {
      if (!markedDatesMap[fecha].dots.some((d: any) => d.key === 'completado')) {
        markedDatesMap[fecha].dots.push({
          key: `completado_${r.id}`,
          color: colorDelPlan,
          selectedDotColor: '#FFF',
        });
      }
    } else if (esRutina || ejsPuros.length > 0) {
      if (!markedDatesMap[fecha].dots.some((d: any) => d.key === 'pendiente')) {
        markedDatesMap[fecha].dots.push({
          key: `pendiente_${r.id}`,
          color: colorDelPlan,
          selectedDotColor: '#FFF',
        });
      }
    }

    if (tieneNotas) {
      if (!markedDatesMap[fecha].dots.some((d: any) => d.key === 'nota')) {
        markedDatesMap[fecha].dots.push({ key: 'nota', color: colores.hoy, selectedDotColor: '#FFF' });
      }
    }
  });


  // Resaltar el día seleccionado
  markedDatesMap[fechaSeleccionadaISO] = {
    ...(markedDatesMap[fechaSeleccionadaISO] || {}),
    selected: true,
    selectedColor: colores.primarioHover,
  };

  // Datos del día seleccionado
  const registrosDiaSel = registrosMes.filter((r) => r.fecha === fechaSeleccionadaISO);
  const todosEjerciciosSel: EjercicioRegistro[] = registrosDiaSel.flatMap((r) => r.ejercicios_registro || []);
  const notasDiaSel = todosEjerciciosSel.filter((e) => e.nombre.startsWith('📌'));
  const rutinasDiaSel = registrosDiaSel.filter((r) => r.rutinas?.nombre);
  const extrasDiaSel = registrosDiaSel
    .filter((r) => !r.rutinas?.nombre)
    .flatMap((r) => r.ejercicios_registro || [])
    .filter((e) => !e.nombre.startsWith('📌'));

  // Métricas acumuladas del mes
  const totalDiasEntrenados = Object.keys(markedDatesMap).filter((fecha) =>
    markedDatesMap[fecha].dots?.some((d: any) => d.key === 'completado')
  ).length;

  const totalSeriesMes = registrosMes.reduce((acc, r) => {
    const ejs = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
    return acc + ejs.reduce((sAcc, e) => sAcc + (e.series || 1), 0);
  }, 0);

  const fechaSeleccionadaObj = parseISO(fechaSeleccionadaISO);

  return (
    <ScreenBackground>
      <Head>
        <title>Calendario · Rutinia</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO CENTRADO */}
        <EncabezadoSeccion
          badgeText="HISTORIAL Y RITMO"
          titulo="Calendario"
          subtitulo="Visión completa e interactiva de tu actividad y rachas"
        />

        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingTop: 10,
            paddingBottom: tabBarHeight + 16,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* BARRA DE MÉTRICAS MENSUALES */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Card Días Entrenados */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={colores.exito} />
                <Text style={styles.metricLabelText}>
                  Entrenamientos
                </Text>
              </View>
              <Text style={styles.metricValueText}>
                {totalDiasEntrenados} <Text style={styles.metricUnitText}>días</Text>
              </Text>
            </View>

            {/* Card Series Totales */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="repeat" size={16} color={colores.primarioHover} />
                <Text style={styles.metricLabelText}>
                  Series Mes
                </Text>
              </View>
              <Text style={styles.metricValueText}>
                {totalSeriesMes} <Text style={styles.metricUnitText}>series</Text>
              </Text>
            </View>
          </View>

          {/* FILTRO POR PLAN */}
          {planes.length > 0 && (
            <View style={{ gap: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                <Pressable
                  onPress={() => setFiltroPlanId(null)}
                  style={[
                    styles.planFilterPill,
                    filtroPlanId === null && styles.planFilterPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.planFilterPillText,
                      filtroPlanId === null && styles.planFilterPillTextActive,
                    ]}
                  >
                    Todos los planes
                  </Text>
                </Pressable>

                {planes.map((p) => {
                  const sel = filtroPlanId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setFiltroPlanId(sel ? null : p.id)}
                      style={[
                        styles.planFilterPill,
                        sel && {
                          borderColor: p.color,
                          backgroundColor: p.color + '22',
                        },
                      ]}
                    >
                      <View style={[styles.miniDot, { backgroundColor: p.color }]} />
                      <Text
                        style={[
                          styles.planFilterPillText,
                          sel && { color: p.color, fontFamily: fuentes.bold },
                        ]}
                      >
                        {p.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* CALENDARIO INTERACTIVO ENTERPRISE CON ESTÉTICA TRASLÚCIDA */}
          <View style={styles.calendarContainerCard}>

            <Calendar
              key={fechaReferencia.toISOString()}
              current={aISO(fechaReferencia)}
              markingType="multi-dot"
              markedDates={markedDatesMap}
              onDayPress={(day) => {
                setFechaSeleccionadaISO(day.dateString);
              }}
              onMonthChange={(month) => {
                setFechaReferencia(new Date(month.year, month.month - 1, 1));
              }}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                textSectionTitleColor: colores.suave,
                selectedDayBackgroundColor: colores.primarioHover,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: colores.hoy,
                dayTextColor: colores.texto,
                textDisabledColor: 'rgba(255, 255, 255, 0.15)',
                dotColor: colores.primarioHover,
                selectedDotColor: '#FFFFFF',
                arrowColor: colores.primarioHover,
                monthTextColor: colores.texto,
                indicatorColor: colores.primarioHover,
                textDayFontFamily: fuentes.bold,
                textMonthFontFamily: fuentes.black,
                textDayHeaderFontFamily: fuentes.bold,
                textDayFontSize: 15,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 11,
              }}
            />

            {/* LEYENDA DE PUNTOS */}
            <View style={styles.legendRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.legendDot, { backgroundColor: colores.exito }]} />
                <Text style={styles.legendText}>Completado</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.legendDot, { backgroundColor: colores.primarioHover }]} />
                <Text style={styles.legendText}>Programado</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.legendDot, { backgroundColor: colores.hoy }]} />
                <Text style={styles.legendText}>Nota</Text>
              </View>
            </View>
          </View>

          {/* DETALLE DEL DÍA SELECCIONADO EN EL CALENDARIO */}
          <View style={styles.selectedDayDetailCard}>
            {/* Header del Día */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase', letterSpacing: 1 }}>
                  ACTIVIDAD DEL DÍA SELECCIONADO
                </Text>
                <Text style={{ fontSize: 19, fontFamily: fuentes.black, color: colores.texto, textTransform: 'capitalize', marginTop: 2 }} numberOfLines={1}>
                  {nombreDia(fechaSeleccionadaObj)} • {format(fechaSeleccionadaObj, 'dd/MM/yyyy')}
                </Text>
              </View>

              <GlowButton
                title="+ Gestionar"
                onPress={() => setModalDetalleVisible(true)}
                variant="outline"
                size="sm"
                shape="pill"
              />
            </View>

            {/* Actividades o estado vacío */}
            {rutinasDiaSel.length === 0 && notasDiaSel.length === 0 && extrasDiaSel.length === 0 ? (
              <View style={styles.emptyDayBox}>
                <Ionicons name="calendar-outline" size={26} color={colores.suave} />
                <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic', fontFamily: fuentes.regular }}>
                  Sin actividad registrada para este día.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Rutinas */}
                {rutinasDiaSel.map((r) => {
                  const planColor = r.planes_entrenamiento?.color || colores.primarioHover;
                  const nombrePlan = r.plan_nombre || r.planes_entrenamiento?.nombre;
                  const nombreRutina = r.rutina_nombre || r.rutinas?.nombre || 'Rutina';

                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        setRegistroEjecutar(r);
                        setModalEjecutarVisible(true);
                      }}
                      style={({ pressed }) => [
                        styles.routineItemRow,
                        {
                          borderColor: r.completado ? colores.exito : colores.borde,
                          borderLeftColor: r.completado ? colores.exito : planColor,
                          borderLeftWidth: 4,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                          <Ionicons name="fitness" size={16} color={r.completado ? colores.exito : planColor} />
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {nombrePlan ? (
                              <View style={[styles.planTagChip, { backgroundColor: planColor + '20', borderColor: planColor + '40' }]}>
                                <Text style={[styles.planTagChipText, { color: planColor }]}>
                                  {nombrePlan}
                                </Text>
                              </View>
                            ) : null}
                            <Text style={{ color: r.completado ? colores.exito : colores.texto, fontFamily: fuentes.black, fontSize: 14 }} numberOfLines={1}>
                              {nombreRutina}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.fillBadge}>
                          <Text style={styles.fillBadgeText}>
                            {r.completado ? 'Completado' : 'Toca para Llenar'}
                          </Text>
                        </View>
                      </View>


                    {(r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌')).map((e) => {
                      const parsed = parsearEjercicioInfo(e);
                      return (
                        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4, paddingVertical: 1 }}>
                          <Text style={{ color: colores.texto, fontSize: 12, fontFamily: fuentes.regular, flex: 1 }} numberOfLines={1}>
                            • {parsed.nombreLimpio}
                          </Text>
                          {parsed.resumenVisual && (
                            <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold }}>
                              {parsed.resumenVisual}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </Pressable>
                );
              })}

                {/* Notas */}
                {notasDiaSel.map((n) => {
                  const { categoria, titulo, colorBadge, bgBadge } = parsearNotaInteligente(n.nombre);
                  return (
                    <View
                      key={n.id}
                      style={[
                        styles.noteItemRow,
                        { borderLeftColor: colorBadge },
                      ]}
                    >
                      <View style={[styles.noteBadge, { backgroundColor: bgBadge }]}>
                        <Text style={{ color: colorBadge, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>{categoria}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: colores.texto, fontSize: 13, fontFamily: fuentes.bold, flex: 1 }}>
                        {titulo}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal Detalle Día (Pantalla Completa) */}
        <DiaDetalleModal
          fecha={fechaSeleccionadaObj}
          registros={registrosDiaSel}
          visible={modalDetalleVisible}
          sesionActivaInfo={sesionActivaInfo}
          onIniciarRutina={(reg) => {
            setRegistroEjecutar(reg);
            setModoResumenModal(false);
            setModalEjecutarVisible(true);
          }}
          onReanudarRutina={(reg) => {
            setRegistroEjecutar(reg);
            setModoResumenModal(false);
            setModalEjecutarVisible(true);
          }}
          onVerResumenRutina={(reg) => {
            setRegistroEjecutar(reg);
            setModoResumenModal(true);
            setModalEjecutarVisible(true);
          }}
          onClose={() => setModalDetalleVisible(false)}
          alCambiar={() => {
            cargarDatosMes();
          }}
        />

        {/* Modal Ejecutar Entrenamiento del Día */}
        <EjecutarEntrenamientoModal
          visible={modalEjecutarVisible}
          registro={registroEjecutar}
          fecha={fechaSeleccionadaObj}
          modoResumen={modoResumenModal}
          onClose={async () => {
            setModalEjecutarVisible(false);
            setModoResumenModal(false);
            const active = await obtenerSesionActivaInfo();
            setSesionActivaInfo(active);
            cargarDatosMes();
          }}
          onGuardado={async () => {
            setModalEjecutarVisible(false);
            setModoResumenModal(false);
            const active = await obtenerSesionActivaInfo();
            setSesionActivaInfo(active);
            cargarDatosMes();
          }}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  metricCard: {
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
  metricLabelText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  metricValueText: {
    color: colores.texto,
    fontSize: 22,
    fontFamily: fuentes.black,
  },
  metricUnitText: {
    fontSize: 13,
    color: colores.suave,
    fontFamily: fuentes.regular,
  },
  calendarContainerCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    marginTop: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  selectedDayDetailCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyDayBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    borderStyle: 'dashed',
  },
  routineItemRow: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: 8,
  },
  fillBadge: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  fillBadgeText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  noteItemRow: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
  },
  planFilterPillActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  planFilterPillText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  planFilterPillTextActive: {
    color: '#FFF',
    fontFamily: fuentes.bold,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planTagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  planTagChipText: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
});

