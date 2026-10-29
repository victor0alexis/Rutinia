import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import Head from 'expo-router/head';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fuentes, noir } from '../../constantes/colores';
import DiaDetalleModal from '../../componentes/semana/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../componentes/entrenamiento/EjecutarEntrenamientoModal';
import FondoPantalla from '../../componentes/comunes/FondoPantalla';
import TarjetaDiaPrincipal from '../../componentes/semana/TarjetaDiaPrincipal';
import EncabezadoEditorial from '../../componentes/comunes/EncabezadoEditorial';
import CarruselSemana3D from '../../componentes/semana/CarruselSemana3D';
import { BotonMetalLiquido } from '../../componentes/efectos/BotonMetalLiquido';
import { registrosDeRango } from '../../servicios/registros';
import { aISO, diasDeSemana } from '../../utilidades/fechas';
import { seguro } from '../../utilidades/errores';
import { EjercicioRegistro, Registro } from '../../tipos';
import {
  SesionActivaInfo,
  obtenerSesionActivaInfo,
  obtenerBorradorSesion,
  subscribirSesionActiva,
} from '../../utilidades/sesionActiva';
import { subscribirCambioDatos } from '../../utilidades/sincronizacion';
import { useLayout } from '../../hooks/useLayout';

export default function Semana() {
  const {
    gutter,
    contentMaxWidth,
    isLandscape,
    isCompact,
    tabBarHeight,
  } = useLayout();
  // El contenido y botón dock quedan exactamente a 12 px sobre la barra de pestañas
  const tabBottomPadding = tabBarHeight + 12;
  const isFocused = useIsFocused();
  const [ref, setRef] = useState(new Date());
  const [diaActivo, setDiaActivo] = useState(new Date());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [modalVisible, setModalVisible] = useState(false);


  // Modal para ejecutar / registrar entrenamiento del día
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);

  // Partida en curso / Entrenamiento activo
  const [sesionActivaInfo, setSesionActivaInfo] = useState<SesionActivaInfo | null>(null);
  const [modoReanudar, setModoReanudar] = useState(false);
  const [modoResumenModal, setModoResumenModal] = useState(false);

  // Cabecera editorial compartida con la Biblioteca de Notas.
  const dias = useMemo(() => diasDeSemana(ref), [ref]);
  const inicioSemanaISO = useMemo(() => aISO(dias[0]), [dias]);
  const finSemanaISO = useMemo(() => aISO(dias[6]), [dias]);

  const cargar = useCallback(() => {
    return seguro(async () => {
      const datos = await registrosDeRango(inicioSemanaISO, finSemanaISO);
      setRegistros(datos);
    });
  }, [inicioSemanaISO, finSemanaISO]);

  // Suscripción reactiva global: actualiza el estado de inmediato (0 ms) cuando
  // inicia, avanza o termina una sesión, o cuando se modifica cualquier rutina o plan
  useEffect(() => {
    const unsubSesion = subscribirSesionActiva((active) => {
      setSesionActivaInfo(active);
      cargar();
    });

    const unsubDatos = subscribirCambioDatos(() => {
      cargar();
      seguro(async () => {
        const active = await obtenerSesionActivaInfo();
        setSesionActivaInfo(active);
      });
    });

    return () => {
      unsubSesion();
      unsubDatos();
    };
  }, [cargar]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      seguro(async () => {
        const active = await obtenerSesionActivaInfo();
        setSesionActivaInfo(active);
      });
    }, [cargar])
  );

  const reanudarPartidaEnCurso = () => {
    if (!sesionActivaInfo) return;
    const targetSesion = sesionActivaInfo;
    setModoReanudar(true);

    // 2. Esperar al desmonte del modal y luego buscar el registro
    setTimeout(async () => {
      try {
        const regs = await registrosDeRango(targetSesion.fechaISO, targetSesion.fechaISO);
        let reg = regs.find((r) => r.id === targetSesion.registroId) || null;

        // Fallback 1: Buscar en los registros ya cargados en memoria
        if (!reg) {
          reg = registros.find((r) => r.id === targetSesion.registroId) || null;
        }

        // Fallback 2: Reconstruir registro a partir del borrador persistente en almacenamiento
        if (!reg) {
          const borrador = await obtenerBorradorSesion(targetSesion.registroId);
          if (borrador) {
            reg = {
              id: targetSesion.registroId,
              fecha: targetSesion.fechaISO,
              rutina_id: null,
              completado: false,
              notas: borrador.notasSesion || null,
              rutinas: { nombre: targetSesion.nombreRutina },
              ejercicios_registro: (borrador.ejerciciosState || []).map((ej) => ({
                id: ej.id,
                registro_id: targetSesion.registroId,
                nombre: ej.nombre,
                series: ej.series.length,
                repeticiones: null,
                peso: null,
                completado: ej.series.every((s) => s.completado),
              })),
            };
          }
        }

        if (reg) {
          // Navegamos al día correcto y abrimos el modal de ejecución
          const fechaObj = parseISO(targetSesion.fechaISO);
          setDiaActivo(fechaObj);
          setRef(fechaObj);
          setRegistroEjecutar(reg);
          setModalEjecutarVisible(true);
        } else {
          console.warn('[Rutinia] No se encontró el registro para reanudar:', targetSesion.registroId);
          setModoReanudar(false);
          setSesionActivaInfo(null);
        }
      } catch (err) {
        console.warn('[Rutinia] Error al reanudar entrenamiento:', err);
        setModoReanudar(false);
        setSesionActivaInfo(null);
      }
    }, 150);
  };

  // Registros del Día Activo
  const registrosDelDia = registros.filter((r) => r.fecha === aISO(diaActivo));
  const todosEjercicios: EjercicioRegistro[] = registrosDelDia.flatMap((r) => r.ejercicios_registro || []);

  // 1. NOTAS DEL DÍA
  const notasDelDia = todosEjercicios.filter((e) => e.nombre.startsWith('📌'));

  // 2. RUTINAS DEL DÍA (Registros que vienen con un rutina_id / rutinas.nombre)
  const registrosConRutina = registrosDelDia.filter((r) => Boolean(r.rutina_id || r.rutinas?.nombre));

  // 3. EJERCICIOS EXTRAS / SUELTOS DEL DÍA (Registros sin rutina asignada)
  const registrosExtraSueltos = registrosDelDia.filter((r) => !r.rutina_id && !r.rutinas?.nombre);
  const ejerciciosExtras = registrosExtraSueltos
    .flatMap((r) => r.ejercicios_registro || [])
    .filter((e) => !e.nombre.startsWith('📌'));

  const esHoy = isSameDay(diaActivo, new Date());
  const fechaTitulo = useMemo(() => {
    const texto = format(diaActivo, "EEEE, d 'de' MMMM", { locale: es });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [diaActivo]);

  const minutosRutinas = registrosConRutina.reduce((total, r) => {
    const series = (r.ejercicios_registro || [])
      .filter((e) => !e.nombre.startsWith('📌'))
      .reduce((acc, e) => acc + (e.series || 3), 0);
    return total + Math.max(25, Math.round(series * 2.5));
  }, 0);

  const resumenDia = {
    actividades: registrosConRutina.length + ejerciciosExtras.length,
    notas: notasDelDia.length,
    minutos: minutosRutinas + ejerciciosExtras.length * 10,
  };

  const minutosTexto = (() => {
    const { minutos } = resumenDia;
    if (minutos <= 0) return '0 min';
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) return `${resto} min`;
    return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
  })();

  const abrirEjecutarRutina = (r: Registro) => {
    setRegistroEjecutar(r);
    setModoReanudar(false);
    setModoResumenModal(false);
    setModalEjecutarVisible(true);
  };

  const abrirVerResumenRutina = (r: Registro) => {
    setRegistroEjecutar(r);
    setModoReanudar(false);
    setModoResumenModal(true);
    setModalEjecutarVisible(true);
  };

  // Determinar acento según las actividades del día seleccionado (vacio, pendiente, completado)
  let acento: 'vacio' | 'pendiente' | 'completado' = 'vacio';
  if (registrosDelDia.length > 0) {
    const hayEjercicios = todosEjercicios.length > 0;
    const todosCompletados =
      registrosDelDia.every((r) => r.completado) &&
      (!hayEjercicios || todosEjercicios.every((e) => e.completado));
    acento = todosCompletados ? 'completado' : 'pendiente';
  }

  return (
    <FondoPantalla acento={acento}>
      <Head>
        <title>Semana · Rutinia</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* CONTENIDO PRINCIPAL */}
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
          {/* CABECERA EDITORIAL COMPARTIDA: MARCA + AVATAR */}
          <EncabezadoEditorial
            title="Semana"
            style={{
              paddingTop: isLandscape ? 2 : 4,
              marginBottom: isLandscape ? 4 : 14,
            }}
          />

          {/* SALUDO EDITORIAL: HOY + FECHA + RESUMEN REAL DEL DÍA */}
          <View
            style={[
              styles.greeting,
              { marginBottom: isLandscape ? 6 : 12 },
            ]}
          >
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>
                {esHoy ? 'HOY' : 'DÍA SELECCIONADO'}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.greetingTitle,
                {
                  fontSize: isLandscape ? 20 : isCompact ? 21 : 24,
                  lineHeight: isLandscape ? 23 : 27,
                },
              ]}
            >
              {fechaTitulo}
            </Text>
            <Text style={styles.greetingStats} numberOfLines={1}>
              {resumenDia.actividades > 0 ? (
                <>
                  <Text style={styles.greetingStatsStrong}>
                    {resumenDia.actividades}{' '}
                    {resumenDia.actividades === 1 ? 'actividad' : 'actividades'}
                  </Text>
                  <Text style={styles.greetingSep}> · </Text>
                  {minutosTexto} planificadas
                </>
              ) : resumenDia.notas > 0 ? (
                <>
                  <Text style={styles.greetingStatsStrong}>
                    {resumenDia.notas}{' '}
                    {resumenDia.notas === 1 ? 'nota' : 'notas'}
                  </Text>
                  <Text style={styles.greetingSep}> · </Text>
                  sin entrenamientos
                </>
              ) : (
                'Sin actividades planificadas'
              )}
            </Text>
          </View>

          {/* CARRUSEL 3D CILÍNDRICO UNIFICADO (ReactICX 3D Carousel + Flechas en extremos) */}
          <View style={styles.carouselWrap}>
            <CarruselSemana3D
              fechaReferencia={ref}
              diaActivo={diaActivo}
              registros={registros}
              onCambiarDia={setDiaActivo}
              onCambiarSemana={setRef}
            />
          </View>

          {/* TARJETA PRINCIPAL DEL DÍA SELECCIONADO (Estilo Uiverse one-div glow) */}
          <TarjetaDiaPrincipal
            registrosConRutina={registrosConRutina}
            notasDelDia={notasDelDia}
            ejerciciosExtras={ejerciciosExtras}
            sesionActivaInfo={sesionActivaInfo}
            onIniciarRutina={abrirEjecutarRutina}
            onReanudarRutina={(r) => {
              if (sesionActivaInfo && sesionActivaInfo.registroId === r.id) {
                reanudarPartidaEnCurso();
              } else {
                abrirEjecutarRutina(r);
              }
            }}
            onVerResumenRutina={abrirVerResumenRutina}
            onDescartarRutina={async () => {
              setSesionActivaInfo(null);
              cargar();
            }}
          />

          {/* BOTÓN PRINCIPAL LIQUID METAL ENTRE MAINDAYCARD Y BOTTOMTABBAR */}
          <View style={styles.myDiaWrap}>
            <BotonMetalLiquido
              titulo="+ Administrar / Gestionar Día"
              onPress={() => setModalVisible(true)}
              activo={
                isFocused &&
                !modalVisible &&
                !modalEjecutarVisible
              }
              height={54}
              borderWidth={4}
              tamano="lg"
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>

        {/* Modal Detalle del Día (Pantalla Completa) */}
        <DiaDetalleModal
          fecha={diaActivo}
          registros={registrosDelDia}
          visible={modalVisible}
          onClose={async () => {
            setModalVisible(false);
            const active = await obtenerSesionActivaInfo();
            setSesionActivaInfo(active);
            cargar();
          }}
          alCambiar={() => {
            cargar();
          }}
          sesionActivaInfo={sesionActivaInfo}
          onIniciarRutina={abrirEjecutarRutina}
          onReanudarRutina={(r) => {
            if (sesionActivaInfo && sesionActivaInfo.registroId === r.id) {
              reanudarPartidaEnCurso();
            } else {
              abrirEjecutarRutina(r);
            }
          }}
          onVerResumenRutina={abrirVerResumenRutina}
        />

        {/* Modal Llenar Registro / Ejecutar Entrenamiento del Día */}
        <EjecutarEntrenamientoModal
          visible={modalEjecutarVisible}
          registro={registroEjecutar}
          fecha={diaActivo}
          modoReanudar={modoReanudar}
          modoResumen={modoResumenModal}
          onClose={async () => {
            setModalEjecutarVisible(false);
            setModoReanudar(false);
            setModoResumenModal(false);
            const active = await obtenerSesionActivaInfo();
            setSesionActivaInfo(active);
            cargar();
          }}
          onGuardado={async () => {
            setModalEjecutarVisible(false);
            setModoReanudar(false);
            setModoResumenModal(false);
            const active = await obtenerSesionActivaInfo();
            setSesionActivaInfo(active);
            cargar();
          }}
        />
      </SafeAreaView>
    </FondoPantalla>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: fuentes.semiBold,
  },
  greetingSep: {
    color: 'rgba(255, 255, 255, 0.18)',
  },
  carouselWrap: {
    flexShrink: 0,
    marginBottom: 8,
  },
  myDiaWrap: {
    width: '100%',
    paddingTop: 8,
    flexShrink: 0,
  },
});

