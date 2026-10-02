import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import GestionarRutinaModal from '../../components/GestionarRutinaModal';
import { listarRutinas, eliminarRutina, duplicarRutina } from '../../services/rutinas';
import { agregarRutinaAFechas } from '../../services/registros';
import { aISO, diasDeSemana, nombreDia } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { Rutina } from '../../types';

export default function Rutinas() {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalGestionarVisible, setModalGestionarVisible] = useState(false);
  const [rutinaSeleccionada, setRutinaSeleccionada] = useState<Rutina | null>(null);

  // Modal para programar en semana
  const [elegidaParaSemana, setElegidaParaSemana] = useState<Rutina | null>(null);
  const [dias, setDias] = useState<string[]>([]);
  const semana = diasDeSemana(new Date());

  const cargar = useCallback(() => seguro(async () => setRutinas(await listarRutinas())), []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const abrirCrearRutina = () => {
    setRutinaSeleccionada(null);
    setModalGestionarVisible(true);
  };

  const abrirGestionarRutina = (r: Rutina) => {
    setRutinaSeleccionada(r);
    setModalGestionarVisible(true);
  };

  const confirmarEliminarRutina = (r: Rutina) => {
    Alert.alert(
      'Eliminar Rutina',
      `¿Deseas eliminar permanentemente la rutina "${r.nombre}" y sus ejercicios asociados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            seguro(async () => {
              await eliminarRutina(r.id);
              await cargar();
              Alert.alert('Eliminada', `La rutina "${r.nombre}" ha sido eliminada.`);
            }),
        },
      ]
    );
  };

  const clonarRutina = (r: Rutina) =>
    seguro(async () => {
      await duplicarRutina(r);
      await cargar();
      Alert.alert('Rutina Clonada', `Se ha creado una copia de "${r.nombre}".`);
    });

  const confirmarAsignacionSemana = () =>
    seguro(async () => {
      if (!elegidaParaSemana) return;
      await agregarRutinaAFechas(elegidaParaSemana, dias);
      setElegidaParaSemana(null);
      setDias([]);
      Alert.alert('¡Programado!', `La rutina "${elegidaParaSemana.nombre}" se asignó a los días seleccionados.`);
    });

  // Filtrado inteligente por nombre de rutina o por nombre de ejercicio
  const rutinasFiltradas = rutinas.filter((r) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const coincideNombre = r.nombre.toLowerCase().includes(q);
    const coincideEjercicio = r.ejercicios_rutina?.some((e) => e.nombre.toLowerCase().includes(q));
    return coincideNombre || coincideEjercicio;
  });

  // Estadísticas globales del panel
  const totalEjercicios = rutinas.reduce((acc, r) => acc + (r.ejercicios_rutina?.length || 0), 0);
  const totalSeries = rutinas.reduce(
    (acc, r) => acc + (r.ejercicios_rutina?.reduce((sum, e) => sum + (e.series || 1), 0) || 0),
    0
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colores.fondo }}>
      {/* ENCABEZADO ESTANDARIZADO */}
      <EncabezadoSeccion
        badgeText="PROGRAMAS & ENTRENAMIENTOS"
        titulo="Rutinas"
        subtitulo="Diseña, programa y optimiza tus planes de entrenamiento"
        botonAccion={{
          texto: 'Nueva rutina',
          icono: 'add',
          onPress: abrirCrearRutina,
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* STATS RÁPIDAS DEL PANEL */}
        {rutinas.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colores.tarjeta,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colores.borde,
              justifyContent: 'space-around',
              alignItems: 'center',
            }}
          >
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.texto }}>
                {rutinas.length}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: fuentes.bold, color: colores.suave, textTransform: 'uppercase' }}>
                Rutinas
              </Text>
            </View>

            <View style={{ width: 1, height: 26, backgroundColor: colores.borde }} />

            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.primarioHover }}>
                {totalEjercicios}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: fuentes.bold, color: colores.suave, textTransform: 'uppercase' }}>
                Ejercicios
              </Text>
            </View>

            <View style={{ width: 1, height: 26, backgroundColor: colores.borde }} />

            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.exito }}>
                {totalSeries}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: fuentes.bold, color: colores.suave, textTransform: 'uppercase' }}>
                Series
              </Text>
            </View>
          </View>
        )}

        {/* BARRA DE BÚSQUEDA INTELIGENTE */}
        {rutinas.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colores.tarjeta,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colores.borde,
              gap: 10,
            }}
          >
            <Ionicons name="search" size={18} color={colores.suave} />
            <TextInput
              placeholder="Buscar por rutina o ejercicio..."
              placeholderTextColor={colores.suave}
              value={busqueda}
              onChangeText={setBusqueda}
              style={{
                flex: 1,
                color: colores.texto,
                fontSize: 14,
                fontFamily: fuentes.regular,
                padding: 0,
              }}
            />
            {busqueda.length > 0 && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colores.suave} />
              </Pressable>
            )}
          </View>
        )}

        {/* LISTADO DE RUTINAS */}
        {rutinasFiltradas.length === 0 ? (
          <View
            style={{
              backgroundColor: colores.tarjeta,
              borderRadius: 20,
              padding: 30,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colores.borde,
              gap: 12,
              marginTop: 10,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: colores.primarioSuave,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colores.primarioGlow,
              }}
            >
              <Ionicons name="barbell-outline" size={30} color={colores.primarioHover} />
            </View>
            <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>
              {busqueda.trim() ? 'No hay coincidencia' : 'Sin rutinas creadas'}
            </Text>
            <Text style={{ color: colores.suave, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>
              {busqueda.trim()
                ? `No encontramos rutinas o ejercicios que contengan "${busqueda}".`
                : 'Empieza estructurando tus entrenamientos con ejercicios, series, repeticiones, peso y RIR.'}
            </Text>
            {!busqueda.trim() && (
              <Pressable
                onPress={abrirCrearRutina}
                style={{
                  marginTop: 6,
                  backgroundColor: colores.primario,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#FFF', fontFamily: fuentes.bold, fontSize: 14 }}>+ Crear Primera Rutina</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {rutinasFiltradas.map((r, idx) => {
          const ejs = r.ejercicios_rutina || [];
          const numEjercicios = ejs.length;
          const totalSeries = ejs.reduce((acc, ej) => acc + (ej.series || 1), 0);
          const primerosTres = ejs.slice(0, 3);
          const restantes = numEjercicios - 3;

          return (
            <View
              key={r.id}
              style={{
                backgroundColor: colores.tarjeta,
                borderRadius: 18,
                padding: 18,
                borderWidth: 1,
                borderColor: colores.borde,
                gap: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              {/* Header de la Tarjeta */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {/* Badge numérico / Icono */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colores.primarioSuave,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colores.primarioGlow,
                    }}
                  >
                    <Ionicons name="barbell-outline" size={22} color={colores.primarioHover} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.texto }} numberOfLines={1}>
                      {r.nombre}
                    </Text>
                    <Text style={{ fontSize: 12, color: colores.suave, fontFamily: fuentes.bold }}>
                      Programa #{idx + 1} • {numEjercicios} {numEjercicios === 1 ? 'ejercicio' : 'ejercicios'} ({totalSeries} series)
                    </Text>
                  </View>
                </View>
              </View>

              {/* Vista Previa de los Primeros Ejercicios */}
              {numEjercicios > 0 && (
                <View
                  style={{
                    backgroundColor: colores.fondo,
                    borderRadius: 12,
                    padding: 12,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: colores.borde,
                  }}
                >
                  {primerosTres.map((ej) => {
                    const nombreLimpio = ej.nombre.replace(/\s*\(.*\)$/, '').trim();
                    return (
                      <View key={ej.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="fitness-outline" size={14} color={colores.primarioHover} />
                        <Text style={{ fontSize: 13, color: colores.texto, fontFamily: fuentes.medium, flex: 1 }} numberOfLines={1}>
                          {nombreLimpio}
                        </Text>
                        <Text style={{ fontSize: 11, color: colores.suave, fontFamily: fuentes.bold }}>
                          {ej.series || 1} {ej.series === 1 ? 'serie' : 'series'}
                        </Text>
                      </View>
                    );
                  })}
                  {restantes > 0 && (
                    <Text style={{ fontSize: 11, color: colores.suave, fontFamily: fuentes.bold, marginTop: 2, fontStyle: 'italic' }}>
                      + {restantes} {restantes === 1 ? 'ejercicio adicional' : 'ejercicios adicionales'}
                    </Text>
                  )}
                </View>
              )}

              {/* BARRA DE ACCIONES BLINDADA Y COMPLETA */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 4,
                  borderTopWidth: 1,
                  borderTopColor: colores.borde,
                }}
              >
                {/* 1. Programar en Semana */}
                <Pressable
                  onPress={() => setElegidaParaSemana(r)}
                  style={({ pressed }) => ({
                    flex: 1.2,
                    backgroundColor: colores.primarioSuave,
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colores.primarioGlow,
                    opacity: pressed ? 0.75 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  })}
                >
                  <Ionicons name="calendar-outline" size={15} color={colores.primarioHover} />
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 12 }}>
                    Programar
                  </Text>
                </Pressable>

                {/* 2. Clonar / Duplicar */}
                <Pressable
                  onPress={() => clonarRutina(r)}
                  style={({ pressed }) => ({
                    backgroundColor: colores.fondo,
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colores.borde,
                    opacity: pressed ? 0.75 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  })}
                >
                  <Ionicons name="copy-outline" size={15} color={colores.texto} />
                  <Text style={{ color: colores.texto, fontFamily: fuentes.medium, fontSize: 12 }}>
                    Clonar
                  </Text>
                </Pressable>

                {/* 3. Editar */}
                <Pressable
                  onPress={() => abrirGestionarRutina(r)}
                  style={({ pressed }) => ({
                    backgroundColor: colores.fondo,
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colores.borde,
                    opacity: pressed ? 0.75 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  })}
                >
                  <Ionicons name="create-outline" size={15} color={colores.texto} />
                  <Text style={{ color: colores.texto, fontFamily: fuentes.medium, fontSize: 12 }}>
                    Editar
                  </Text>
                </Pressable>

                {/* 4. ELIMINAR RUTINA (Directo con Confirmación) */}
                <Pressable
                  onPress={() => confirmarEliminarRutina(r)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    backgroundColor: colores.peligro + '18',
                    paddingVertical: 9,
                    paddingHorizontal: 11,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colores.peligro + '40',
                    opacity: pressed ? 0.75 : 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  <Ionicons name="trash-outline" size={16} color={colores.peligro} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* MODAL GESTIONAR / CREAR RUTINA EN PANTALLA COMPLETA */}
      <GestionarRutinaModal
        visible={modalGestionarVisible}
        rutinaParaEditar={rutinaSeleccionada}
        onClose={() => setModalGestionarVisible(false)}
        onGuardado={() => {
          cargar();
        }}
        onProgramarSemana={(r) => {
          setElegidaParaSemana(r);
        }}
      />

      {/* MODAL ASIGNAR RUTINA A DÍAS DE LA SEMANA */}
      <Modal visible={!!elegidaParaSemana} transparent animationType="slide" onRequestClose={() => setElegidaParaSemana(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View style={{ backgroundColor: colores.tarjetaElevada, padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: colores.primarioHover, fontSize: 11, fontFamily: fuentes.bold, textTransform: 'uppercase', letterSpacing: 1 }}>
                  PROGRAMAR RUTINA EN CALENDARIO
                </Text>
                <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.texto }}>
                  "{elegidaParaSemana?.nombre}"
                </Text>
              </View>
              <Pressable onPress={() => { setElegidaParaSemana(null); setDias([]); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colores.suave} />
              </Pressable>
            </View>

            <View style={{ gap: 6 }}>
              {semana.map((d) => {
                const iso = aISO(d);
                const on = dias.includes(iso);
                return (
                  <Pressable
                    key={iso}
                    onPress={() => setDias(on ? dias.filter((x) => x !== iso) : [...dias, iso])}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: on ? colores.primarioSuave : colores.fondo,
                      borderWidth: 1,
                      borderColor: on ? colores.primario : colores.borde,
                    }}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colores.primarioHover : colores.suave} />
                    <Text style={{ fontSize: 15, color: colores.texto, fontFamily: on ? fuentes.bold : fuentes.regular, textTransform: 'capitalize' }}>
                      {nombreDia(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={confirmarAsignacionSemana}
              disabled={!dias.length}
              style={{
                backgroundColor: dias.length ? colores.primario : colores.borde,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: fuentes.black, fontSize: 15 }}>Asignar a Días Seleccionados</Text>
            </Pressable>

            <Pressable onPress={() => { setElegidaParaSemana(null); setDias([]); }} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: colores.suave, fontFamily: fuentes.bold }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


