import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, addWeeks, isSameDay, isSameWeek } from 'date-fns';
import { colores, fuentes } from '../../constants/colores';
import { supabase } from '../../lib/supabase';
import DiaDetalleModal, { parsearNotaInteligente } from '../../components/DiaDetalleModal';
import EjecutarEntrenamientoModal from '../../components/EjecutarEntrenamientoModal';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import { registrosDeRango } from '../../services/registros';
import { aISO, diasDeSemana, nombreDia, rangoSemana } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { EjercicioRegistro, Registro } from '../../types';

export default function Semana() {
  const [ref, setRef] = useState(new Date());
  const [diaActivo, setDiaActivo] = useState(new Date());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Modal para ejecutar / registrar entrenamiento del día
  const [registroEjecutar, setRegistroEjecutar] = useState<Registro | null>(null);
  const [modalEjecutarVisible, setModalEjecutarVisible] = useState(false);

  const dias = diasDeSemana(ref);
  const esSemanaActual = isSameWeek(ref, new Date(), { weekStartsOn: 1 });

  const cargar = useCallback(
    () => seguro(async () => setRegistros(await registrosDeRango(aISO(dias[0]), aISO(dias[6])))),
    [ref]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const esDiaHoy = (d: Date) => isSameDay(d, new Date());
  const esDiaSeleccionado = (d: Date) => isSameDay(d, diaActivo);

  // Registros del Día Activo
  const registrosDelDia = registros.filter((r) => r.fecha === aISO(diaActivo));
  const todosEjercicios: EjercicioRegistro[] = registrosDelDia.flatMap((r) => r.ejercicios_registro || []);
  
  // 1. NOTAS DEL DÍA
  const notasDelDia = todosEjercicios.filter((e) => e.nombre.startsWith('📌'));

  // 2. RUTINAS DEL DÍA (Registros que vienen con un rutina_id / rutinas.nombre)
  const registrosConRutina = registrosDelDia.filter((r) => r.rutinas?.nombre);

  // 3. EJERCICIOS EXTRAS / SUELTOS DEL DÍA (Registros sin rutina asignada)
  const registrosExtraSueltos = registrosDelDia.filter((r) => !r.rutinas?.nombre);
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colores.fondo }}>
      {/* ENCABEZADO ESTANDARIZADO CENTRADO CON DESTELLO ANIMADO */}
      <EncabezadoSeccion
        badgeText="ENTRENAMIENTO"
        titulo="Mi Semana"
        mostrarCerrarSesion
        onCerrarSesion={() => supabase.auth.signOut()}
      />

      {/* CONTENIDO PRINCIPAL */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
        {/* NAVEGADOR ENTRE SEMANAS */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colores.tarjeta,
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: colores.borde,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Pressable
            onPress={() => {
              const prev = addWeeks(ref, -1);
              setRef(prev);
              setDiaActivo(diasDeSemana(prev)[0]);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colores.fondo,
              borderWidth: 1,
              borderColor: colores.borde,
              opacity: pressed ? 0.7 : 1,
            })}
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
            <Text style={{ fontSize: 15, fontFamily: fuentes.black, color: colores.texto, letterSpacing: 0.3 }}>
              {rangoSemana(ref)}
            </Text>
            {!esSemanaActual ? (
              <View style={{ backgroundColor: colores.primarioSuave, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 10, color: colores.primarioHover, fontFamily: fuentes.bold }}>
                  • Toca para ir a Semana Actual
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 10, color: colores.suave, fontFamily: fuentes.bold, marginTop: 1 }}>
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
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colores.fondo,
              borderWidth: 1,
              borderColor: colores.borde,
              opacity: pressed ? 0.7 : 1,
            })}
            hitSlop={10}
          >
            <Ionicons name="chevron-forward" size={18} color={colores.primarioHover} />
          </Pressable>
        </View>

        {/* 7 DÍAS EN FILA HORIZONTAL FIJA */}
        <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'space-between' }}>
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
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: esSel ? colores.primario : esHoy ? colores.primarioSuave : colores.tarjeta,
                  borderWidth: 1.5,
                  borderColor: esSel ? colores.primarioHover : esHoy ? colores.hoy : colores.borde,
                  opacity: pressed ? 0.85 : 1,
                  gap: 2,
                })}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: fuentes.bold,
                    color: esSel ? '#FFF' : esHoy ? colores.hoy : colores.suave,
                    textTransform: 'uppercase',
                  }}
                >
                  {nombreDia(d).substring(0, 3)}
                </Text>

                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: fuentes.black,
                    color: esSel ? '#FFF' : colores.texto,
                  }}
                >
                  {d.getDate()}
                </Text>

                <View style={{ height: 6, flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                  {completo ? (
                    <Ionicons name="checkmark-circle" size={9} color={esSel ? '#FFF' : colores.exito} />
                  ) : ejsPuros.length > 0 ? (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: esSel ? '#FFF' : colores.primarioHover }} />
                  ) : null}
                  {notas.length > 0 && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: esSel ? '#FFF' : colores.hoy }} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* TARJETA PRINCIPAL DEL DÍA SELECCIONADO */}
        <View
          style={{
            flex: 1,
            backgroundColor: colores.tarjeta,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: esDiaHoy(diaActivo) ? colores.hoy : colores.borde,
            padding: 18,
            gap: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          {/* Header de la Tarjeta del Día */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={irDiaAnterior} style={{ padding: 6 }} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={colores.suave} />
            </Pressable>

            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20, fontFamily: fuentes.black, color: colores.texto, textTransform: 'capitalize' }}>
                  {nombreDia(diaActivo)}
                </Text>
                {esDiaHoy(diaActivo) && (
                  <View style={{ backgroundColor: colores.hoy + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: colores.hoy, fontSize: 10, fontFamily: fuentes.black }}>HOY</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: colores.suave, fontFamily: fuentes.bold, marginTop: 1 }}>
                {aISO(diaActivo)}
              </Text>
            </View>

            <Pressable onPress={irDiaSiguiente} style={{ padding: 6 }} hitSlop={10}>
              <Ionicons name="chevron-forward" size={22} color={colores.suave} />
            </Pressable>
          </View>

          {/* LISTA SCROLLABLE DE NOTAS, RUTINAS Y EJERCICIOS EXTRAS */}
          <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 2 }} showsVerticalScrollIndicator={false}>
            {notasDelDia.length === 0 && registrosConRutina.length === 0 && ejerciciosExtras.length === 0 ? (
              <View style={{ paddingVertical: 36, alignItems: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colores.fondo, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colores.borde }}>
                  <Ionicons name="barbell-outline" size={24} color={colores.suave} />
                </View>
                <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 15 }}>Sin actividades ni notas</Text>
                <Text style={{ color: colores.suave, textAlign: 'center', fontSize: 12, paddingHorizontal: 20 }}>
                  Toca el botón "+ Administrar Día" para añadir rutinas, ejercicios o anotaciones.
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
                          style={{
                            backgroundColor: colores.fondo,
                            borderRadius: 14,
                            padding: 12,
                            gap: 6,
                            borderWidth: 1,
                            borderColor: colores.borde,
                            borderLeftWidth: 4,
                            borderLeftColor: colorBadge,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: bgBadge, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name={iconName} size={12} color={colorBadge} />
                              <Text style={{ color: colorBadge, fontSize: 10, fontFamily: fuentes.bold, textTransform: 'uppercase' }}>
                                {categoria}
                              </Text>
                            </View>
                            <Text numberOfLines={1} style={{ color: colores.texto, fontSize: 14, fontFamily: fuentes.bold, flex: 1 }}>
                              {titulo}
                            </Text>
                          </View>
                          {cuerpo ? (
                            <Text numberOfLines={2} style={{ color: colores.suave, fontSize: 12, lineHeight: 17, paddingLeft: 2 }}>
                              {cuerpo}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 2. SECCIÓN RUTINAS DEL DÍA (Presionable para Llenar Entrenamiento del Día) */}
                {registrosConRutina.map((r) => {
                  const ejsRutina = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => abrirEjecutarRutina(r)}
                      style={({ pressed }) => ({
                        backgroundColor: colores.fondo,
                        borderRadius: 14,
                        padding: 14,
                        gap: 10,
                        borderWidth: 1,
                        borderColor: r.completado ? colores.exito : colores.borde,
                        borderLeftWidth: 4,
                        borderLeftColor: r.completado ? colores.exito : colores.primarioHover,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="fitness" size={18} color={r.completado ? colores.exito : colores.primarioHover} />
                          <Text style={{ color: r.completado ? colores.exito : colores.primarioHover, fontFamily: fuentes.black, fontSize: 15 }}>
                            {r.rutinas?.nombre}
                          </Text>
                        </View>

                        <View style={{ backgroundColor: colores.primarioSuave, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name={r.completado ? 'checkmark-circle' : 'create-outline'} size={12} color={colores.primarioHover} />
                          <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 11 }}>
                            {r.completado ? 'Completado' : 'Llenar Registro'}
                          </Text>
                        </View>
                      </View>

                      {ejsRutina.map((e) => (
                        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Ionicons
                              name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                              size={18}
                              color={e.completado ? colores.exito : colores.suave}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: e.completado ? colores.suave : colores.texto,
                                  fontSize: 14,
                                  fontFamily: fuentes.bold,
                                  textDecorationLine: e.completado ? 'line-through' : 'none',
                                }}
                              >
                                {e.nombre}
                              </Text>
                              {(e.series || e.repeticiones || e.peso) && (
                                <Text style={{ color: colores.suave, fontSize: 11, marginTop: 1 }}>
                                  {[e.series && e.repeticiones ? `${e.series}×${e.repeticiones}` : null, e.peso ? `${e.peso} kg` : null]
                                    .filter(Boolean)
                                    .join('  •  ')}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </Pressable>
                  );
                })}

                {/* 3. SECCIÓN EJERCICIOS EXTRAS / SUELTOS */}
                {ejerciciosExtras.length > 0 && (
                  <View
                    style={{
                      backgroundColor: colores.fondo,
                      borderRadius: 14,
                      padding: 14,
                      gap: 10,
                      borderWidth: 1,
                      borderColor: colores.borde,
                      borderLeftWidth: 4,
                      borderLeftColor: colores.exito,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="flash" size={15} color={colores.exito} />
                      <Text style={{ color: colores.exito, fontFamily: fuentes.black, fontSize: 14 }}>Ejercicios Extras</Text>
                    </View>

                    {ejerciciosExtras.map((e) => (
                      <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <Ionicons
                            name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={e.completado ? colores.exito : colores.suave}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: e.completado ? colores.suave : colores.texto,
                                fontSize: 14,
                                fontFamily: fuentes.bold,
                                textDecorationLine: e.completado ? 'line-through' : 'none',
                              }}
                            >
                              {e.nombre}
                            </Text>
                            {(e.series || e.repeticiones || e.peso) && (
                              <Text style={{ color: colores.suave, fontSize: 11, marginTop: 1 }}>
                                {[e.series && e.repeticiones ? `${e.series}×${e.repeticiones}` : null, e.peso ? `${e.peso} kg` : null]
                                  .filter(Boolean)
                                  .join('  •  ')}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Botón de Acción Principal para Administrar el Día */}
          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => ({
              backgroundColor: colores.primario,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: pressed ? 0.85 : 1,
              shadowColor: colores.primario,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4,
            })}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontFamily: fuentes.black, fontSize: 15 }}>+ Administrar / Gestionar Día</Text>
          </Pressable>
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
        onClose={() => setModalEjecutarVisible(false)}
        onGuardado={() => {
          cargar();
        }}
      />
    </SafeAreaView>
  );
}

