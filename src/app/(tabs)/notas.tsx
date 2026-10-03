import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../../constants/colores';
import EncabezadoSeccion from '../../components/EncabezadoSeccion';
import ScreenBackground from '../../components/ScreenBackground';
import GlowButton from '../../components/GlowButton';
import { CategoriaNota, eliminarNotaEstandar, guardarNotaEstandar, NotaEstandar, obtenerNotasEstandar } from '../../services/notas';
import { agregarActividad } from '../../services/registros';
import { aISO, diasDeSemana, nombreDia } from '../../utils/fechas';
import { seguro } from '../../utils/errores';

const CATEGORIAS: CategoriaNota[] = ['General', 'Nutrición', 'Entrenamiento', 'Suplementos', 'Recuperación'];

// Mapa de Configuración Estética por Categoría
const CONFIG_CATEGORIAS: Record<
  string,
  { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  Todas: { color: colores.primarioHover, bg: colores.primarioSuave, icon: 'apps-outline' },
  General: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)', icon: 'document-text-outline' },
  Nutrición: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.16)', icon: 'nutrition-outline' },
  Entrenamiento: { color: colores.primarioHover, bg: colores.primarioSuave, icon: 'fitness-outline' },
  Suplementos: { color: '#A855F7', bg: 'rgba(168, 85, 247, 0.16)', icon: 'medical-outline' },
  Recuperación: { color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.16)', icon: 'pulse-outline' },
};

export default function Notas() {
  const [notas, setNotas] = useState<NotaEstandar[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas');

  // Modal Crear/Editar
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [notaEditando, setNotaEditando] = useState<NotaEstandar | null>(null);
  const [tituloInput, setTituloInput] = useState('');
  const [catInput, setCatInput] = useState<CategoriaNota>('General');
  const [contenidoInput, setContenidoInput] = useState('');

  // Modal Asignar a Día
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [notaParaAsignar, setNotaParaAsignar] = useState<NotaEstandar | null>(null);
  const semana = diasDeSemana(new Date());

  const cargarNotas = useCallback(() => {
    seguro(async () => {
      const data = await obtenerNotasEstandar();
      setNotas(data);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarNotas();
    }, [cargarNotas])
  );

  const abrirCrear = () => {
    setNotaEditando(null);
    setTituloInput('');
    setCatInput('General');
    setContenidoInput('');
    setModalEditarVisible(true);
  };

  const abrirEditar = (n: NotaEstandar) => {
    setNotaEditando(n);
    setTituloInput(n.titulo);
    setCatInput(n.categoria);
    setContenidoInput(n.contenido);
    setModalEditarVisible(true);
  };

  const guardar = () =>
    seguro(async () => {
      if (!tituloInput.trim()) throw new Error('Ingresa un título para la nota.');
      await guardarNotaEstandar({
        id: notaEditando?.id,
        titulo: tituloInput.trim(),
        categoria: catInput,
        contenido: contenidoInput.trim(),
      });
      setModalEditarVisible(false);
      cargarNotas();
    });

  const borrar = (n: NotaEstandar) => {
    Alert.alert('Eliminar Nota', `¿Deseas eliminar "${n.titulo}" de tu biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          seguro(async () => {
            await eliminarNotaEstandar(n.id);
            cargarNotas();
          }),
      },
    ]);
  };

  const asignarADia = (d: Date) =>
    seguro(async () => {
      if (!notaParaAsignar) return;
      const textoFormateado = `📌 [${notaParaAsignar.categoria.toUpperCase()}] ${notaParaAsignar.titulo}: ${notaParaAsignar.contenido}`;
      await agregarActividad(aISO(d), textoFormateado, null, null, null);
      setModalAsignarVisible(false);
      Alert.alert('¡Asignada!', `Nota "${notaParaAsignar.titulo}" añadida al ${nombreDia(d)}.`);
    });

  const notasFiltradas = categoriaFiltro === 'Todas' ? notas : notas.filter((n) => n.categoria === categoriaFiltro);

  const contarPorCat = (catName: string) => {
    if (catName === 'Todas') return notas.length;
    return notas.filter((n) => n.categoria === catName).length;
  };

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ENCABEZADO ESTANDARIZADO CENTRADO CON DESTELLO ANIMADO */}
        <EncabezadoSeccion
          badgeText="BITÁCORA INTELIGENTE"
          titulo="Biblioteca de Notas"
          botonAccion={{
            texto: 'Nueva Nota',
            icono: 'add',
            onPress: abrirCrear,
          }}
        />

        {/* SECTOR DE FILTROS DE CATEGORÍAS JERÁRQUICO Y CENTRADO CON ICONOS Y BADGES */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4, alignItems: 'center' }}
          >
            {['Todas', ...CATEGORIAS].map((catName) => {
              const active = categoriaFiltro === catName;
              const cfg = CONFIG_CATEGORIAS[catName] || CONFIG_CATEGORIAS.General;
              const count = contarPorCat(catName);

              return (
                <Pressable
                  key={catName}
                  onPress={() => setCategoriaFiltro(catName)}
                  style={({ pressed }) => [
                    styles.categoryFilterPill,
                    {
                      backgroundColor: active ? cfg.bg : colores.tarjeta,
                      borderColor: active ? cfg.color : colores.borde,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name={cfg.icon} size={15} color={active ? cfg.color : colores.suave} />
                  <Text
                    style={{
                      color: active ? cfg.color : colores.texto,
                      fontFamily: active ? fuentes.black : fuentes.bold,
                      fontSize: 12,
                    }}
                  >
                    {catName}
                  </Text>

                  {/* Badge con cantidad */}
                  <View
                    style={{
                      backgroundColor: active ? cfg.color : 'rgba(10, 12, 18, 0.60)',
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? '#FFF' : colores.suave,
                        fontFamily: fuentes.bold,
                        fontSize: 10,
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista de Notas */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 80, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {notasFiltradas.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="document-text-outline" size={28} color={colores.primarioHover} />
              </View>
              <Text style={{ color: colores.texto, fontSize: 17, fontFamily: fuentes.black }}>Sin notas en &quot;{categoriaFiltro}&quot;</Text>
              <Text style={{ color: colores.suave, textAlign: 'center', fontSize: 13, lineHeight: 18, fontFamily: fuentes.regular }}>
                Crea notas o plantillas en esta categoría para vincularlas a tus días de entrenamiento.
              </Text>
            </View>
          ) : null}

          {notasFiltradas.map((n) => {
            const cfg = CONFIG_CATEGORIAS[n.categoria] || CONFIG_CATEGORIAS.General;

            return (
              <View
                key={n.id}
                style={[
                  styles.noteCardItem,
                  { borderLeftColor: cfg.color },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ gap: 6, flex: 1, paddingRight: 10 }}>
                    <View style={[styles.badgeCategoryBox, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={{ color: cfg.color, fontSize: 11, fontFamily: fuentes.black, textTransform: 'uppercase' }}>
                        {n.categoria}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, fontFamily: fuentes.black, color: colores.texto, marginTop: 2 }}>
                      {n.titulo}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => abrirEditar(n)} hitSlop={10}>
                      <Ionicons name="pencil-outline" size={18} color={colores.suave} />
                    </Pressable>
                    <Pressable onPress={() => borrar(n)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={colores.peligro} />
                    </Pressable>
                  </View>
                </View>

                {/* Contenido */}
                <Text style={{ color: colores.suave, fontSize: 14, lineHeight: 21, fontFamily: fuentes.regular }}>
                  {n.contenido}
                </Text>

                {/* Acciones */}
                <Pressable
                  onPress={() => {
                    setNotaParaAsignar(n);
                    setModalAsignarVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.assignButton,
                    { borderColor: cfg.color },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={16} color={cfg.color} />
                  <Text style={{ color: cfg.color, fontFamily: fuentes.bold, fontSize: 13 }}>
                    + Asignar a un Día de la Semana
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        {/* MODAL CREAR / EDITAR NOTA */}
        <Modal visible={modalEditarVisible} animationType="slide" transparent onRequestClose={() => setModalEditarVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}
          >
            <View style={styles.modalSheetContainer}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.modalGrabber} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontFamily: fuentes.black, color: colores.texto }}>
                  {notaEditando ? 'Editar Nota' : 'Nueva Nota Estandarizada'}
                </Text>
                <Pressable onPress={() => setModalEditarVisible(false)}>
                  <Ionicons name="close" size={22} color={colores.texto} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.inputLabel}>Título</Text>
                  <TextInput
                    placeholder="Ej. Rutina de Suplementos / Meta de Hidratación"
                    placeholderTextColor={colores.suave}
                    value={tituloInput}
                    onChangeText={setTituloInput}
                    style={styles.modalInput}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={styles.inputLabel}>Categoría</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {CATEGORIAS.map((cat) => {
                      const sel = catInput === cat;
                      const cfg = CONFIG_CATEGORIAS[cat] || CONFIG_CATEGORIAS.General;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setCatInput(cat)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 10,
                            backgroundColor: sel ? cfg.bg : 'rgba(10, 12, 18, 0.60)',
                            borderWidth: 1,
                            borderColor: sel ? cfg.color : colores.borde,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Ionicons name={cfg.icon} size={14} color={sel ? cfg.color : colores.suave} />
                          <Text style={{ color: sel ? cfg.color : colores.suave, fontFamily: sel ? fuentes.bold : fuentes.regular, fontSize: 12 }}>{cat}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={styles.inputLabel}>Cuerpo / Contenido</Text>
                  <TextInput
                    placeholder="Escribe el detalle de la nota o plantilla..."
                    placeholderTextColor={colores.suave}
                    multiline
                    numberOfLines={6}
                    value={contenidoInput}
                    onChangeText={setContenidoInput}
                    style={[styles.modalInput, { height: 120, textAlignVertical: 'top' }]}
                  />
                </View>

                <View style={{ marginTop: 6 }}>
                  <GlowButton
                    title="Guardar Nota"
                    onPress={guardar}
                    variant="primary"
                    size="md"
                    shape="rounded"
                    fullWidth
                  />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL ASIGNAR A DÍA */}
        <Modal visible={modalAsignarVisible} animationType="slide" transparent onRequestClose={() => setModalAsignarVisible(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
            <View style={styles.modalSheetContainer}>
              <Text style={{ fontSize: 19, fontFamily: fuentes.black, color: colores.texto }}>
                ¿A qué día asignamos &quot;{notaParaAsignar?.titulo}&quot;?
              </Text>

              <View style={{ gap: 8 }}>
                {semana.map((d) => (
                  <Pressable
                    key={aISO(d)}
                    onPress={() => asignarADia(d)}
                    style={({ pressed }) => [
                      styles.assignDayRow,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={{ fontSize: 15, color: colores.texto, fontFamily: fuentes.bold, textTransform: 'capitalize' }}>
                      {nombreDia(d)}
                    </Text>
                    <Ionicons name="add-circle" size={22} color={colores.primarioHover} />
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setModalAsignarVisible(false)} style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: colores.suave, fontFamily: fuentes.bold }}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  categoryFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  emptyStateCard: {
    backgroundColor: colores.tarjeta,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 10,
    marginTop: 6,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colores.primarioSuave,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.primarioGlow,
  },
  noteCardItem: {
    backgroundColor: colores.tarjeta,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeCategoryBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignButton: {
    marginTop: 4,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  modalSheetContainer: {
    backgroundColor: colores.tarjetaElevada,
    padding: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    maxHeight: '90%',
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.borde,
  },
  inputLabel: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.regular,
  },
  assignDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
  },
});
