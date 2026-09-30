import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, subDays, startOfYear, parseISO } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import { obtenerMetricasProgreso, MetricasProgreso, RecordPersonal } from '../../services/progreso';
import { aISO, nombreDia } from '../../utils/fechas';
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

      if (res.recordsPersonales.length > 0 && !ejercicioSeleccionado) {
        setEjercicioSeleccionado(res.recordsPersonales[0].nombreEjercicio);
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colores.fondo }}>
      {/* ENCABEZADO ESTANDARIZADO CENTRADO */}
      <EncabezadoSeccion
        badgeText="MÉTRICAS & RENDIMIENTO"
        titulo="Mi Progreso"
        subtitulo="Estadísticas de tonelaje, sobrecarga progresiva y récords"
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* SELECTOR DE PERÍODO */}
        <View style={{ flexDirection: 'row', backgroundColor: colores.tarjeta, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colores.borde }}>
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
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: active ? colores.primario : 'transparent',
                }}
              >
                <Text style={{ color: active ? '#FFF' : colores.suave, fontFamily: active ? fuentes.black : fuentes.bold, fontSize: 12 }}>
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
            <View style={{ flex: 1, backgroundColor: colores.tarjeta, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colores.borde, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="barbell" size={16} color={colores.primarioHover} />
                <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                  Volumen Total
                </Text>
              </View>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }}>
                {metricas.volumenTotalKg.toLocaleString()}{' '}
                <Text style={{ fontSize: 13, color: colores.suave, fontFamily: fuentes.regular }}>kg</Text>
              </Text>
            </View>

            {/* Card 2: Días Entrenados */}
            <View style={{ flex: 1, backgroundColor: colores.tarjeta, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colores.borde, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={16} color={colores.exito} />
                <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                  Días Cumplidos
                </Text>
              </View>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }}>
                {metricas.diasCompletados}{' '}
                <Text style={{ fontSize: 13, color: colores.suave, fontFamily: fuentes.regular }}>días</Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Card 3: Series Totales */}
            <View style={{ flex: 1, backgroundColor: colores.tarjeta, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colores.borde, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="repeat" size={16} color="#A855F7" />
                <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                  Series Totales
                </Text>
              </View>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }}>
                {metricas.seriesTotales}{' '}
                <Text style={{ fontSize: 13, color: colores.suave, fontFamily: fuentes.regular }}>series</Text>
              </Text>
            </View>

            {/* Card 4: Racha Activa */}
            <View style={{ flex: 1, backgroundColor: colores.tarjeta, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colores.borde, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flame" size={16} color={colores.hoy} />
                <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                  Racha Activa
                </Text>
              </View>
              <Text style={{ color: colores.texto, fontSize: 22, fontFamily: fuentes.black }}>
                {metricas.rachaDias}{' '}
                <Text style={{ fontSize: 13, color: colores.suave, fontFamily: fuentes.regular }}>días</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* SECCIÓN 2: SALÓN DE RÉCORDS PERSONALES (PRs) */}
        <View
          style={{
            backgroundColor: colores.tarjeta,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: colores.borde,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trophy" size={20} color={colores.hoy} />
            <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
              Salón de Récords Personales (PRs)
            </Text>
          </View>

          {metricas.recordsPersonales.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center', gap: 6, backgroundColor: colores.fondo, borderRadius: 14, borderWidth: 1, borderColor: colores.borde, borderStyle: 'dashed' }}>
              <Ionicons name="trophy-outline" size={26} color={colores.suave} />
              <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic' }}>
                Registra tus entrenamientos para generar tus primeros récords personales.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {metricas.recordsPersonales.map((pr) => (
                <Pressable
                  key={pr.nombreEjercicio}
                  onPress={() => setEjercicioSeleccionado(pr.nombreEjercicio)}
                  style={{
                    backgroundColor: colores.fondo,
                    borderRadius: 16,
                    padding: 14,
                    width: 170,
                    borderWidth: 1.5,
                    borderColor: ejercicioSeleccionado === pr.nombreEjercicio ? colores.hoy : colores.borde,
                    gap: 6,
                  }}
                >
                  <View style={{ backgroundColor: colores.hoy + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="ribbon-outline" size={12} color={colores.hoy} />
                    <Text style={{ color: colores.hoy, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>RÉCORD</Text>
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
              ))}
            </ScrollView>
          )}
        </View>

        {/* SECCIÓN 3: DETECTOR DE SOBRECARGA PROGRESIVA DEL EJERCICIO SELECCIONADO */}
        {prDestacado && (
          <View
            style={{
              backgroundColor: colores.tarjeta,
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: colores.borde,
              gap: 12,
            }}
          >
            <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase', letterSpacing: 1 }}>
              ANÁLISIS DE SOBRECARGA PROGRESIVA
            </Text>
            <Text style={{ fontSize: 20, fontFamily: fuentes.black, color: colores.texto }}>
              {prDestacado.nombreEjercicio}
            </Text>

            <View style={{ backgroundColor: colores.fondo, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colores.borde, gap: 10 }}>
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

        {/* SECCIÓN 4: DISTRIBUCIÓN DEL VOLUMEN POR EJERCICIO */}
        <View
          style={{
            backgroundColor: colores.tarjeta,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: colores.borde,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="pie-chart" size={18} color={colores.primarioHover} />
            <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
              Distribución de Volumen por Ejercicio
            </Text>
          </View>

          {metricas.ejerciciosStats.length === 0 ? (
            <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic' }}>Sin estadísticas registradas.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {metricas.ejerciciosStats.slice(0, 5).map((ej) => (
                <View key={ej.nombre} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colores.texto, fontSize: 14, fontFamily: fuentes.bold }} numberOfLines={1}>
                      {ej.nombre}
                    </Text>
                    <Text style={{ color: colores.primarioHover, fontSize: 12, fontFamily: fuentes.black }}>
                      {ej.series} series ({ej.porcentaje}%)
                    </Text>
                  </View>

                  <View style={{ height: 6, backgroundColor: colores.fondo, borderRadius: 3, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${ej.porcentaje}%`,
                        backgroundColor: colores.primario,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

