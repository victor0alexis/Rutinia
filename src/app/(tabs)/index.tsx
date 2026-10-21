import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, parseISO } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import { supabase } from '../../lib/supabase';
import DiaDetalleModal from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import ModalPartidaEnCurso from '../../components/ModalPartidaEnCurso';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import MainDayCard from '../../components/MainDayCard';
import Semana3DCarousel from '../../components/Semana3DCarousel';
import { LiquidMetalButton } from '../../components/LiquidMetalButton';
import { registrosDeRango } from '../../services/registros';
import { listarPlanes } from '../../services/planes';
import { aISO, diasDeSemana } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { EjercicioRegistro, PlanEntrenamiento, Registro } from '../../types';
import { SesionActivaInfo, obtenerSesionActivaInfo, obtenerBorradorSesion } from '../../utils/sesionActiva';
import { useLayout } from '../../hooks/useLayout';

export default function Semana() {
  const { gutter, contentMaxWidth, isLandscape, bottomInset, safeBottom } = useLayout();
  const tabBottomPadding = isLandscape ? 56 + Math.max(bottomInset, 4) : 74 + safeBottom;
  const isFocused = useIsFocused();
  const [ref, setRef] = useState(new Date());
  const [diaActivo, setDiaActivo] = useState(new Date());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [planActivo, setPlanActivo] = useState<PlanEntrenamiento | null>(null);
  const [modalVisible, setModalVisible] = useState(false);


  // Modal para ejecutar / registrar entrenamiento del día
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);

  // Partida en curso / Entrenamiento activo
  const [sesionActivaInfo, setSesionActivaInfo] = useState<SesionActivaInfo | null>(null);
  const [modalPartidaVisible, setModalPartidaVisible] = useState(false);
  const [modoReanudar, setModoReanudar] = useState(false);
  const atendidoPartidaRef = useRef(false);

  const dias = useMemo(() => diasDeSemana(ref), [ref]);
  const inicioSemanaISO = useMemo(() => aISO(dias[0]), [dias]);
  const finSemanaISO = useMemo(() => aISO(dias[6]), [dias]);

  const cargar = useCallback(() => {
    return seguro(async () => {
      const datos = await registrosDeRango(inicioSemanaISO, finSemanaISO);
      setRegistros(datos);
    });
  }, [inicioSemanaISO, finSemanaISO]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      listarPlanes({ incluirArchivados: false })
        .then((pls) => setPlanActivo(pls.find((p) => p.activo) || null))
        .catch(() => {});
      if (atendidoPartidaRef.current) return;
      seguro(async () => {
        const active = await obtenerSesionActivaInfo();
        if (active && !atendidoPartidaRef.current) {
          setSesionActivaInfo(active);
          setModalPartidaVisible(true);
        }
      });
    }, [cargar])
  );


  const reanudarPartidaEnCurso = () => {
    if (!sesionActivaInfo) return;
    atendidoPartidaRef.current = true;
    const targetSesion = sesionActivaInfo;

    // 1. Cerrar el modal de partida en curso
    setModalPartidaVisible(false);
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
          atendidoPartidaRef.current = false;
          setModoReanudar(false);
          setSesionActivaInfo(null);
        }
      } catch (err) {
        console.warn('[Rutinia] Error al reanudar entrenamiento:', err);
        atendidoPartidaRef.current = false;
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

  const irDiaAnterior = () => {
    setDiaActivo(addDays(diaActivo, -1));
  };
  const irDiaSiguiente = () => {
    setDiaActivo(addDays(diaActivo, 1));
  };

  const abrirEjecutarRutina = (r: Registro) => {
    setRegistroEjecutar(r);
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
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO CENTRADO CON DESTELLO ANIMADO */}
        <EncabezadoSeccion
          badgeText="ENTRENAMIENTO"
          titulo="Mi Semana"
          mostrarCerrarSesion
          onCerrarSesion={() => supabase.auth.signOut()}
        />

        {/* CONTENIDO PRINCIPAL */}
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingBottom: tabBottomPadding,
            gap: isLandscape ? 6 : 10,
          }}
        >
          {/* CHIP DE PLAN ACTIVO EN CABECERA */}
          {planActivo && (
            <View
              style={[
                styles.headerPlanChip,
                {
                  borderColor: planActivo.color + '60',
                  backgroundColor: planActivo.color + '15',
                },
              ]}
            >
              <Ionicons
                name={(planActivo.icono as any) || 'barbell-outline'}
                size={14}
                color={planActivo.color}
              />
              <Text style={[styles.headerPlanChipText, { color: planActivo.color }]}>
                PLAN ACTIVO · {planActivo.nombre.toUpperCase()}
              </Text>
            </View>
          )}

          {/* CARRUSEL 3D CILÍNDRICO UNIFICADO (ReactICX 3D Carousel + Flechas en extremos) */}
          <Semana3DCarousel
            fechaReferencia={ref}
            diaActivo={diaActivo}
            registros={registros}
            onCambiarDia={setDiaActivo}
            onCambiarSemana={setRef}
          />

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
            onVerResumenRutina={abrirEjecutarRutina}
          />

          {/* BOTÓN PRINCIPAL LIQUID METAL ENTRE MAINDAYCARD Y BOTTOMTABBAR */}
          <View style={{ paddingTop: 4, width: '100%' }}>
            <LiquidMetalButton
              titulo="+ Administrar / Gestionar Día"
              onPress={() => setModalVisible(true)}
              activo={
                isFocused &&
                !modalVisible &&
                !modalEjecutarVisible &&
                !modalPartidaVisible
              }
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>

        {/* Modal Detalle del Día (Pantalla Completa) */}
        <DiaDetalleModal
          fecha={diaActivo}
          registros={registrosDelDia}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          alCambiar={() => {
            cargar();
          }}
        />

        {/* Modal Llenar Registro / Ejecutar Entrenamiento del Día */}
        <EjecutarEntrenamientoModal
          visible={modalEjecutarVisible}
          registro={registroEjecutar}
          fecha={diaActivo}
          modoReanudar={modoReanudar}
          onClose={() => {
            setModalEjecutarVisible(false);
            setModoReanudar(false);
            atendidoPartidaRef.current = false;
          }}
          onGuardado={() => {
            setModalEjecutarVisible(false);
            setModoReanudar(false);
            atendidoPartidaRef.current = false;
            cargar();
          }}
        />

        {/* Modal de Partida en Curso (Borrador Activo) */}
        <ModalPartidaEnCurso
          visible={modalPartidaVisible}
          sesionInfo={sesionActivaInfo}
          onReanudar={reanudarPartidaEnCurso}
          onDescartar={() => {
            setModalPartidaVisible(false);
            setSesionActivaInfo(null);
            atendidoPartidaRef.current = true;
            cargar();
          }}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  weekNavigatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  navChevronButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  rangoSemanaText: {
    fontSize: 15,
    fontFamily: fuentes.black,
    color: colores.texto,
    letterSpacing: 0.3,
  },
  subtextSemanaBadge: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  subtextSemanaBadgeText: {
    fontSize: 10,
    color: colores.primarioHover,
    fontFamily: fuentes.bold,
  },
  subtextSemanaCurrent: {
    fontSize: 10,
    color: colores.suave,
    fontFamily: fuentes.bold,
    marginTop: 1,
  },
  dayPillButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    gap: 3,
  },
  dayNameShort: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  dayNumberText: {
    fontSize: 15,
    fontFamily: fuentes.black,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  mainDayCard: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  selectedDayTitle: {
    fontSize: 20,
    fontFamily: fuentes.black,
    color: colores.texto,
    textTransform: 'capitalize',
  },
  hoyBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.20)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.40)',
  },
  hoyBadgeText: {
    color: colores.hoy,
    fontSize: 10,
    fontFamily: fuentes.black,
  },
  selectedDaySubdate: {
    fontSize: 12,
    color: colores.suave,
    fontFamily: fuentes.bold,
    marginTop: 1,
  },
  emptyDayContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyDayIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  emptyDayTitle: {
    color: colores.texto,
    fontFamily: fuentes.bold,
    fontSize: 15,
  },
  emptyDaySubtext: {
    color: colores.suave,
    textAlign: 'center',
    fontSize: 12,
    paddingHorizontal: 20,
    fontFamily: fuentes.regular,
  },
  noteCard: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colores.borde,
    borderLeftWidth: 4,
  },
  noteCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteCategoryText: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  noteTitle: {
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.bold,
    flex: 1,
  },
  noteBody: {
    color: colores.suave,
    fontSize: 12,
    lineHeight: 17,
    paddingLeft: 2,
    fontFamily: fuentes.regular,
  },
  routineBox: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  routineBoxTitle: {
    fontFamily: fuentes.black,
    fontSize: 15,
  },
  fillRegistroBadge: {
    backgroundColor: colores.primarioSuave,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  fillRegistroBadgeText: {
    color: colores.primarioHover,
    fontFamily: fuentes.bold,
    fontSize: 11,
  },
  extraExercisesCard: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    borderLeftWidth: 4,
    borderLeftColor: colores.exito,
  },
  headerPlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  headerPlanChipText: {
    fontSize: 11,
    fontFamily: fuentes.black,
    letterSpacing: 0.8,
  },
  planTagChip: {
    paddingHorizontal: 7,
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

