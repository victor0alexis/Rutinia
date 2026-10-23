import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import Head from 'expo-router/head';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fuentes, noir } from '../../constants/colores';
import { supabase } from '../../lib/supabase';
import DiaDetalleModal from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import ScreenBackground from '../../components/ScreenBackground';
import MainDayCard from '../../components/MainDayCard';
import Semana3DCarousel from '../../components/Semana3DCarousel';
import GradientText from '../../components/GradientText';
import { LiquidMetalButton } from '../../components/LiquidMetalButton';
import { registrosDeRango } from '../../services/registros';
import { aISO, diasDeSemana } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { EjercicioRegistro, Registro } from '../../types';
import {
  SesionActivaInfo,
  obtenerSesionActivaInfo,
  obtenerBorradorSesion,
  subscribirSesionActiva,
} from '../../utils/sesionActiva';
import { subscribirCambioDatos } from '../../utils/sincronizacion';
import { useLayout } from '../../hooks/useLayout';

// Noir Pearl wordmark: perla -> platino -> perla. El barrido conserva el
// GradientText original, pero ahora pertenece a la familia monocroma.
const TITLE_GRADIENT_COLORS = [
  '#FFFFFF',
  '#EDF3FB',
  '#AAB5C6',
  '#EAF1FA',
  '#FFFFFF',
];

export default function Semana() {
  const {
    gutter,
    contentMaxWidth,
    isLandscape,
    isCompact,
    bottomInset,
    safeBottom,
  } = useLayout();
  // La barra flota sobre el contenido. Reservamos su alto + un respiro corto
  // (el mockup deja 6-8 px entre "Administrar" y el navbar).
  const tabBottomPadding = isLandscape
    ? 56 + Math.max(bottomInset, 8) + 6
    : 64 + safeBottom;
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

  // Cabecera editorial: identidad discreta y menú de cuenta detrás del avatar.
  const [avatarInicial, setAvatarInicial] = useState('A');
  const [emailCuenta, setEmailCuenta] = useState('');
  const [menuCuentaVisible, setMenuCuentaVisible] = useState(false);

  useEffect(() => {
    let activo = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!activo) return;
        const user = data.session?.user;
        const nombre =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.nombre ||
          user?.email ||
          '';
        if (typeof nombre === 'string' && nombre.trim().length > 0) {
          setAvatarInicial(nombre.trim().charAt(0).toUpperCase());
        }
        setEmailCuenta(user?.email ?? '');
      })
      .catch(() => {
        // La cabecera funciona igual con el avatar de respaldo.
      });

    return () => {
      activo = false;
    };
  }, []);

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

  const cerrarSesion = () => {
    setMenuCuentaVisible(false);
    supabase.auth.signOut();
  };

  const irDiaAnterior = () => {
    setDiaActivo(addDays(diaActivo, -1));
  };
  const irDiaSiguiente = () => {
    setDiaActivo(addDays(diaActivo, 1));
  };

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
    <ScreenBackground acento={acento}>
      <Head>
        <title>Semana · Rutinia</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Capa que cierra el menú de cuenta al tocar fuera del avatar. */}
        {menuCuentaVisible && (
          <Pressable
            style={styles.accountScrim}
            onPress={() => setMenuCuentaVisible(false)}
            accessibilityLabel="Cerrar menú de cuenta"
          />
        )}

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
          {/* CABECERA EDITORIAL: MARCA + AVATAR */}
          <View
            style={[
              styles.headerWrap,
              {
                paddingTop: isLandscape ? 2 : 4,
                marginBottom: isLandscape ? 4 : 14,
              },
            ]}
          >
            <View style={styles.brandLockup}>
              <LinearGradient
                colors={[
                  'rgba(255,255,255,0.30)',
                  'rgba(255,255,255,0.16)',
                  'rgba(255,255,255,0.045)',
                ]}
                start={{ x: 0.15, y: 0.05 }}
                end={{ x: 0.85, y: 0.95 }}
                style={styles.brandMark}
              >
                <Text style={styles.brandMarkText}>m</Text>
              </LinearGradient>

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
                  myLife
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
                  <Ionicons
                    name="log-out-outline"
                    size={15}
                    color={noir.platinum}
                  />
                  <Text style={styles.accountMenuLogoutText}>Cerrar sesión</Text>
                </Pressable>
              </View>
            )}
          </View>

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
            <Semana3DCarousel
              fechaReferencia={ref}
              diaActivo={diaActivo}
              registros={registros}
              onCambiarDia={setDiaActivo}
              onCambiarSemana={setRef}
            />
          </View>

          {/* TARJETA PRINCIPAL DEL DÍA SELECCIONADO (Estilo Uiverse one-div glow) */}
          <MainDayCard
            diaActivo={diaActivo}
            onDiaAnterior={irDiaAnterior}
            onDiaSiguiente={irDiaSiguiente}
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
            <LiquidMetalButton
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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  accountScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
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
    zIndex: 61,
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

