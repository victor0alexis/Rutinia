import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import GlowButton from '../../components/GlowButton';
import DiaDetalleModal, { parsearNotaInteligente } from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import { registrosDeRango } from '../../services/registros';
import { aISO, nombreDia } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { parsearEjercicioInfo } from '../../utils/ejercicios';
import { EjercicioRegistro, Registro } from '../../types';

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
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [fechaSeleccionadaISO, setFechaSeleccionadaISO] = useState(aISO(new Date()));
  const [registrosMes, setRegistrosMes] = useState<Registro[]>([]);
  
  // Modales
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);

  const cargarDatosMes = useCallback(() => {
    seguro(async () => {
      const inicio = aISO(startOfMonth(fechaReferencia));
      const fin = aISO(endOfMonth(fechaReferencia));
      const datos = await registrosDeRango(inicio, fin);
      setRegistrosMes(datos);
    });
  }, [fechaReferencia]);

  useFocusEffect(
    useCallback(() => {
      cargarDatosMes();
    }, [cargarDatosMes])
  );

  // Construir mapa de markedDates para react-native-calendars
  const markedDatesMap: Record<string, any> = {};

  registrosMes.forEach((r) => {
    const fecha = r.fecha;
    if (!markedDatesMap[fecha]) {
      markedDatesMap[fecha] = { dots: [] };
    }

    const ejs = r.ejercicios_registro || [];
    const tieneNotas = ejs.some((e) => e.nombre.startsWith('📌'));
    const ejsPuros = ejs.filter((e) => !e.nombre.startsWith('📌'));
    const esRutina = !!r.rutinas?.nombre;
    const esCompletado = r.completado || (ejsPuros.length > 0 && ejsPuros.every((e) => e.completado));

    if (esCompletado) {
      if (!markedDatesMap[fecha].dots.some((d: any) => d.key === 'completado')) {
        markedDatesMap[fecha].dots.push({ key: 'completado', color: colores.exito, selectedDotColor: '#FFF' });
      }
    } else if (esRutina || ejsPuros.length > 0) {
      if (!markedDatesMap[fecha].dots.some((d: any) => d.key === 'pendiente')) {
        markedDatesMap[fecha].dots.push({ key: 'pendiente', color: colores.primarioHover, selectedDotColor: '#FFF' });
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
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO CENTRADO */}
        <EncabezadoSeccion
          badgeText="HISTORIAL Y RITMO"
          titulo="Calendario"
          subtitulo="Visión completa e interactiva de tu actividad y rachas"
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 80, gap: 14 }}
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

          {/* CALENDARIO INTERACTIVO ENTERPRISE CON ESTÉTICT TRASLÚCIDA */}
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
                {rutinasDiaSel.map((r) => (
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
                        borderLeftColor: r.completado ? colores.exito : colores.primarioHover,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                        <Ionicons name="fitness" size={16} color={r.completado ? colores.exito : colores.primarioHover} />
                        <Text style={{ color: r.completado ? colores.exito : colores.primarioHover, fontFamily: fuentes.black, fontSize: 14, flex: 1 }} numberOfLines={1}>
                          {r.rutinas?.nombre}
                        </Text>
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
                ))}

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
          onClose={() => setModalEjecutarVisible(false)}
          onGuardado={() => {
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
});
