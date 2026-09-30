import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import GestionarRutinaModal from '../../components/GestionarRutinaModal';
import { listarRutinas } from '../../services/rutinas';
import { agregarRutinaAFechas } from '../../services/registros';
import { aISO, diasDeSemana, nombreDia } from '../../utils/fechas';
import { seguro } from '../../utils/errores';
import { Rutina } from '../../types';

export default function Rutinas() {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
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

  const confirmarAsignacionSemana = () =>
    seguro(async () => {
      if (!elegidaParaSemana) return;
      await agregarRutinaAFechas(elegidaParaSemana, dias);
      setElegidaParaSemana(null);
      setDias([]);
      Alert.alert('¡Asignado!', `La rutina "${elegidaParaSemana.nombre}" se programó para los días seleccionados.`);
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colores.fondo }}>
      {/* ENCABEZADO ESTANDARIZADO CENTRADO CON DESTELLO ENTERPRISE */}
      <EncabezadoSeccion
        badgeText="PROGRAMAS DETALLADOS"
        titulo="Rutinas"
        subtitulo="Gestión profesional de ejercicios, series, repeticiones, RIR y peso"
        botonAccion={{
          texto: 'Nueva rutina',
          icono: 'add',
          onPress: abrirCrearRutina,
        }}
      />

      {/* Lista de Rutinas (Tarjetas Compactas Ordenadas) */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {rutinas.length === 0 ? (
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
            <Text style={{ color: colores.texto, fontSize: 18, fontFamily: fuentes.black }}>Sin rutinas creadas todavía</Text>
            <Text style={{ color: colores.suave, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>
              Toca el botón "+ Nueva rutina" para estructurar tus entrenamientos con ejercicios, series, repeticiones, peso y RIR.
            </Text>
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
          </View>
        ) : null}

        {rutinas.map((r, idx) => {
          const numEjercicios = r.ejercicios_rutina?.length || 0;
          const totalSeries = r.ejercicios_rutina?.reduce((acc, ej) => acc + (ej.series || 1), 0) || 0;

          return (
            <Pressable
              key={r.id}
              onPress={() => abrirGestionarRutina(r)}
              style={({ pressed }) => ({
                backgroundColor: colores.tarjeta,
                borderRadius: 18,
                padding: 18,
                borderWidth: 1,
                borderColor: colores.borde,
                gap: 14,
                opacity: pressed ? 0.9 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 3,
              })}
            >
              {/* Header de la Tarjeta */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {/* Badge numérico de orden visual */}
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: colores.primarioSuave,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colores.primarioGlow,
                    }}
                  >
                    <Ionicons name="barbell-outline" size={20} color={colores.primarioHover} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.texto }} numberOfLines={1}>
                      {r.nombre}
                    </Text>
                    <Text style={{ fontSize: 12, color: colores.suave, fontFamily: fuentes.bold }}>
                      Programa #{idx + 1}
                    </Text>
                  </View>
                </View>

                {/* Flecha / Indicador de Acción */}
                <View
                  style={{
                    backgroundColor: colores.fondo,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colores.borde,
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color={colores.suave} />
                </View>
              </View>

              {/* Estadísticas Totales (Ejercicios + Series Totales) */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Chip Ejercicios */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colores.fondo,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colores.borde,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="list-outline" size={16} color={colores.primarioHover} />
                  <View>
                    <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 14 }}>
                      {numEjercicios}
                    </Text>
                    <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold }}>
                      {numEjercicios === 1 ? 'Ejercicio' : 'Ejercicios'}
                    </Text>
                  </View>
                </View>

                {/* Chip Series Totales */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colores.fondo,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colores.borde,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="repeat-outline" size={16} color={colores.primarioHover} />
                  <View>
                    <Text style={{ color: colores.texto, fontFamily: fuentes.black, fontSize: 14 }}>
                      {totalSeries}
                    </Text>
                    <Text style={{ color: colores.suave, fontSize: 10, fontFamily: fuentes.bold }}>
                      {totalSeries === 1 ? 'Serie Total' : 'Series Totales'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer con Botón Programar en Semana */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.bold }}>
                  Toca para gestionar o editar
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setElegidaParaSemana(r);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    backgroundColor: colores.primarioSuave,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colores.primarioGlow,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  })}
                >
                  <Ionicons name="calendar-outline" size={13} color={colores.primarioHover} />
                  <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold, fontSize: 11 }}>
                    + Programar
                  </Text>
                </Pressable>
              </View>
            </Pressable>
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
                  PROGRAMAR RUTINA
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

