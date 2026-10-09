import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, addWeeks, isSameDay, isSameWeek, parseISO } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import { supabase } from '../../lib/supabase';
import DiaDetalleModal, { parsearNotaInteligente } from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import ModalPartidaEnCurso from '../../components/ModalPartidaEnCurso';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import BotonRutinia from '../../components/BotonRutinia';
import DockPrincipal from '../../components/DockPrincipal';
import { registrosDeRango } from '../../services/registros';
import { aISO, diasDeSemana, nombreDia, rangoSemana } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { parsearEjercicioInfo } from '../../utils/ejercicios';
import { EjercicioRegistro, Registro } from '../../types';
import { SesionActivaInfo, obtenerSesionActivaInfo } from '../../utils/sesionActiva';

export default function Semana() {
  const [ref, setRef] = useState(new Date());
  const [diaActivo, setDiaActivo] = useState(new Date());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Modal para ejecutar / registrar entrenamiento del día
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);

  // Partida en curso / Entrenamiento activo
  const [sesionActivaInfo, setSesionActivaInfo] = useState<SesionActivaInfo | null>(null);
  const [modalPartidaVisible, setModalPartidaVisible] = useState(false);
  const [modoReanudar, setModoReanudar] = useState(false);
  const atendidoPartidaRef = useRef(false);

  const dias = diasDeSemana(ref);
  const esSemanaActual = isSameWeek(ref, new Date(), { weekStartsOn: 1 });

  const cargar = useCallback(
    () => seguro(async () => setRegistros(await registrosDeRango(aISO(dias[0]), aISO(dias[6])))),
    [dias]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
      if (modalEjecutarVisible || atendidoPartidaRef.current) return;
      seguro(async () => {
        const active = await obtenerSesionActivaInfo();
        if (active && !modalEjecutarVisible && !atendidoPartidaRef.current) {
          setSesionActivaInfo(active);
          setModalPartidaVisible(true);
        }
      });
    }, [cargar, modalEjecutarVisible])
  );

  const reanudarPartidaEnCurso = () => {
    if (!sesionActivaInfo) return;
    atendidoPartidaRef.current = true;
    const targetSesion = sesionActivaInfo;

    // 1. Cerrar el modal de partida en curso
    setModalPartidaVisible(false);
    setModoReanudar(true);

    // 2. Esperar al desmonte del modal antes de abrir el de ejecución
    setTimeout(async () => {
      const fechaObj = parseISO(targetSesion.fechaISO);
      setDiaActivo(fechaObj);
      // Navegar a la semana correcta si la sesión es de otra semana
      setRef(fechaObj);

      let reg: Registro | null = registros.find((r) => r.id === targetSesion.registroId) || null;
      if (!reg) {
        const regs = await registrosDeRango(targetSesion.fechaISO, targetSesion.fechaISO);
        reg = regs.find((r) => r.id === targetSesion.registroId) || null;
      }

      if (reg) {
        setRegistroEjecutar(reg);
        setModalEjecutarVisible(true);
      } else {
        // No se encontró el registro — resetear estado para no dejar pantalla bloqueada
        console.warn('[Rutinia] No se encontró el registro para reanudar:', targetSesion.registroId);
        atendidoPartidaRef.current = false;
        setModoReanudar(false);
        setSesionActivaInfo(null);
      }
    }, 250);
  };

  const esDiaHoy = (d: Date) => isSameDay(d, new Date());
  const esDiaSeleccionado = (d: Date) => isSameDay(d, diaActivo);

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
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 70, gap: 10 }}>
          {/* NAVEGADOR ENTRE SEMANAS */}
          <View style={styles.weekNavigatorCard}>
            <Pressable
              onPress={() => {
                const prev = addWeeks(ref, -1);
                setRef(prev);
                setDiaActivo(diasDeSemana(prev)[0]);
              }}
              style={({ pressed }) => [
                styles.navChevronButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={18} color={colores.primarioHover} />
            </Pressable>

            <Pressable
              onPress={() => {
                const hoy = new Date();
                setRef(hoy);
                setDiaActivo(hoy);
              }}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <Text style={styles.rangoSemanaText}>
                {rangoSemana(ref)}
              </Text>
              {!esSemanaActual ? (
                <View style={styles.subtextSemanaBadge}>
                  <Text style={styles.subtextSemanaBadgeText}>
                    • Toca para ir a Semana Actual
                  </Text>
                </View>
              ) : (
                <Text style={styles.subtextSemanaCurrent}>
                  Semana en curso
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                const next = addWeeks(ref, 1);
                setRef(next);
                setDiaActivo(diasDeSemana(next)[0]);
              }}
              style={({ pressed }) => [
                styles.navChevronButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={10}
            >
              <Ionicons name="chevron-forward" size={18} color={colores.primarioHover} />
            </Pressable>
          </View>

          {/* 7 DÍAS EN FILA HORIZONTAL FIJA CON BOTONES DE IMPACTO */}
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'space-between' }}>
            {dias.map((d) => {
              const esHoy = esDiaHoy(d);
              const esSel = esDiaSeleccionado(d);
              const regsDia = registros.filter((r) => r.fecha === aISO(d));
              const ejsAll = regsDia.flatMap((r) => r.ejercicios_registro || []);
              const ejsPuros = ejsAll.filter((e) => !e.nombre.startsWith('📌'));
              const notas = ejsAll.filter((e) => e.nombre.startsWith('📌'));
              const completo = ejsPuros.length > 0 && ejsPuros.every((e) => e.completado);

              return (
                <Pressable
                  key={aISO(d)}
                  onPress={() => setDiaActivo(d)}
                  style={({ pressed }) => [
                    styles.dayPillButton,
                    {
                      backgroundColor: esSel
                        ? colores.primarioHover
                        : esHoy
                        ? 'rgba(217, 119, 6, 0.16)'
                        : colores.tarjeta,
                      borderColor: esSel
                        ? '#FFFFFF'
                        : esHoy
                        ? colores.hoy
                        : colores.borde,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNameShort,
                      { color: esSel ? '#FFF' : esHoy ? colores.hoy : colores.suave },
                    ]}
                  >
                    {nombreDia(d).substring(0, 3)}
                  </Text>

                  <Text
                    style={[
                      styles.dayNumberText,
                      { color: esSel ? '#FFF' : colores.texto },
                    ]}
                  >
                    {d.getDate()}
                  </Text>

                  <View style={{ height: 6, flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                    {completo ? (
                      <Ionicons name="checkmark-circle" size={10} color={esSel ? '#FFF' : colores.exito} />
                    ) : ejsPuros.length > 0 ? (
                      <View style={[styles.statusDot, { backgroundColor: esSel ? '#FFF' : colores.primarioHover }]} />
                    ) : null}
                    {notas.length > 0 && (
                      <View style={[styles.statusDot, { backgroundColor: esSel ? '#FFF' : colores.hoy }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* TARJETA PRINCIPAL DEL DÍA SELECCIONADO */}
          <View
            style={[
              styles.mainDayCard,
              {
                borderColor: esDiaHoy(diaActivo) ? colores.hoy : colores.borde,
              },
            ]}
          >
            {/* Header de la Tarjeta del Día */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={irDiaAnterior} style={{ padding: 6 }} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={colores.suave} />
              </Pressable>

              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.selectedDayTitle}>
                    {nombreDia(diaActivo)}
                  </Text>
                  {esDiaHoy(diaActivo) && (
                    <View style={styles.hoyBadge}>
                      <Text style={styles.hoyBadgeText}>HOY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.selectedDaySubdate}>
                  {aISO(diaActivo)}
                </Text>
              </View>

              <Pressable onPress={irDiaSiguiente} style={{ padding: 6 }} hitSlop={10}>
                <Ionicons name="chevron-forward" size={22} color={colores.suave} />
              </Pressable>
            </View>

            {/* LISTA SCROLLABLE DE NOTAS, RUTINAS Y EJERCICIOS EXTRAS */}
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 144 }} showsVerticalScrollIndicator={false}>
              {notasDelDia.length === 0 && registrosConRutina.length === 0 && ejerciciosExtras.length === 0 ? (
                <View style={styles.emptyDayContainer}>
                  <View style={styles.emptyDayIconBox}>
                    <Ionicons name="barbell-outline" size={24} color={colores.suave} />
                  </View>
                  <Text style={styles.emptyDayTitle}>Sin actividades ni notas</Text>
                  <Text style={styles.emptyDaySubtext}>
                    Toca el botón &quot;+ Administrar Día&quot; para añadir rutinas, ejercicios o anotaciones.
                  </Text>
                </View>
              ) : (
                <>
                  {/* 1. SECCIÓN NOTAS DEL DÍA */}
                  {notasDelDia.length > 0 && (
                    <View style={{ gap: 8 }}>
                      {notasDelDia.map((notaObj) => {
                        const { categoria, titulo, cuerpo, colorBadge, bgBadge, iconName } = parsearNotaInteligente(notaObj.nombre);
                        return (
                          <View
                            key={notaObj.id}
                            style={[
                              styles.noteCard,
                              { borderLeftColor: colorBadge },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={[styles.noteCategoryBadge, { backgroundColor: bgBadge }]}>
                                <Ionicons name={iconName} size={12} color={colorBadge} />
                                <Text style={[styles.noteCategoryText, { color: colorBadge }]}>
                                  {categoria}
                                </Text>
                              </View>
                              <Text numberOfLines={1} style={styles.noteTitle}>
                                {titulo}
                              </Text>
                            </View>
                            {cuerpo ? (
                              <Text numberOfLines={2} style={styles.noteBody}>
                                {cuerpo}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* 2. SECCIÓN RUTINAS DEL DÍA */}
                  {registrosConRutina.map((r) => {
                    const ejsRutina = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => abrirEjecutarRutina(r)}
                        style={({ pressed }) => [
                          styles.routineBox,
                          {
                            borderColor: r.completado ? colores.exito : colores.borde,
                            borderLeftColor: r.completado ? colores.exito : colores.primarioHover,
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="fitness" size={18} color={r.completado ? colores.exito : colores.primarioHover} />
                            <Text style={[styles.routineBoxTitle, { color: r.completado ? colores.exito : colores.primarioHover }]}>
                              {r.rutinas?.nombre || 'Rutina Vinculada'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.fillRegistroBadge,
                              r.completado && {
                                backgroundColor: 'rgba(43, 213, 152, 0.12)',
                                borderColor: 'rgba(43, 213, 152, 0.35)',
                              },
                            ]}
                          >
                            <Ionicons
                              name={r.completado ? 'checkmark-circle' : 'create-outline'}
                              size={12}
                              color={r.completado ? colores.exito : colores.primarioHover}
                            />
                            <Text
                              style={[
                                styles.fillRegistroBadgeText,
                                r.completado && { color: colores.exito },
                              ]}
                            >
                              {r.completado ? 'Completado' : 'Llenar Registro'}
                            </Text>
                          </View>
                        </View>

                        {ejsRutina.map((e) => {
                          const parsed = parsearEjercicioInfo(e);
                          return (
                            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <Ionicons
                                  name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={18}
                                  color={e.completado ? colores.exito : colores.suave}
                                />
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <Text
                                    style={{
                                      color: e.completado ? colores.texto : colores.texto,
                                      fontSize: 14,
                                      fontFamily: fuentes.bold,
                                      opacity: e.completado ? 0.75 : 1,
                                    }}
                                  >
                                    {parsed.nombreLimpio}
                                  </Text>
                                  {parsed.resumenVisual && (
                                    <View
                                      style={{
                                        backgroundColor: e.completado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                        paddingHorizontal: 7,
                                        paddingVertical: 1,
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: e.completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                      }}
                                    >
                                      <Text style={{ color: e.completado ? colores.exito : colores.suave, fontSize: 10, fontFamily: fuentes.bold }}>
                                        {parsed.resumenVisual}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </Pressable>
                    );
                  })}

                  {/* 3. SECCIÓN EJERCICIOS EXTRAS / SUELTOS */}
                  {ejerciciosExtras.length > 0 && (
                    <View style={styles.extraExercisesCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="flash" size={15} color={colores.exito} />
                        <Text style={{ color: colores.exito, fontFamily: fuentes.black, fontSize: 14 }}>Ejercicios Extras</Text>
                      </View>

                      {ejerciciosExtras.map((e) => {
                        const parsed = parsearEjercicioInfo(e);
                        return (
                          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <Ionicons
                                name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                                size={18}
                                color={e.completado ? colores.exito : colores.suave}
                              />
                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text
                                  style={{
                                    color: e.completado ? colores.texto : colores.texto,
                                    fontSize: 14,
                                    fontFamily: fuentes.bold,
                                    opacity: e.completado ? 0.75 : 1,
                                  }}
                                >
                                  {parsed.nombreLimpio}
                                </Text>
                                {parsed.resumenVisual && (
                                  <View
                                    style={{
                                      backgroundColor: e.completado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                      paddingHorizontal: 7,
                                      paddingVertical: 1,
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: e.completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    }}
                                  >
                                    <Text style={{ color: e.completado ? colores.exito : colores.suave, fontSize: 10, fontFamily: fuentes.bold }}>
                                      {parsed.resumenVisual}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Dock del Botón Principal anclado sobre la barra de pestañas */}
        <DockPrincipal>
          <BotonRutinia
            titulo="+ Administrar / Gestionar Día"
            variante="principal"
            onPress={() => setModalVisible(true)}
            style={{ alignSelf: 'stretch' }}
          />
        </DockPrincipal>

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
            atendidoPartidaRef.current = false;
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
});
