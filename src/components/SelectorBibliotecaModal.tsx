import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import { vibrarBoton } from '../utils/haptics';
import {
  EjercicioBiblioteca,
  GRUPOS_MUSCULARES,
  LISTA_EQUIPAMIENTOS,
  cargarBibliotecaEjercicios,
  filtrarEjerciciosBiblioteca,
} from '../services/bibliotecaEjercicios';

export interface EjercicioSeleccionadoBiblioteca {
  nombre: string;
  grupoMuscular?: string;
  equipo?: string;
  gifUrl?: string;
  instrucciones?: string[];
  esUnilateral?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSeleccionar: (ejercicio: EjercicioSeleccionadoBiblioteca) => void;
  grupoMuscularInicial?: string;
  titulo?: string;
  subtitulo?: string;
}

export default function SelectorBibliotecaModal({
  visible,
  onClose,
  onSeleccionar,
  grupoMuscularInicial = 'todos',
  titulo = 'Biblioteca de Ejercicios',
  subtitulo = 'Selecciona un movimiento con técnica y animación GIF',
}: Props) {
  const { isTablet, contentMaxWidth, bottomInset } = useLayout();

  const [catalogo, setCatalogo] = useState<EjercicioBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [grupoActivo, setGrupoActivo] = useState(grupoMuscularInicial);
  const [equipoActivo, setEquipoActivo] = useState('todos');

  // Modal de tutorial / detalle técnico
  const [ejercicioTutorial, setEjercicioTutorial] = useState<EjercicioBiblioteca | null>(null);

  // Cargar catálogo al abrir modal
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;

    const iniciar = async () => {
      setCargando(true);
      setGrupoActivo(grupoMuscularInicial || 'todos');
      setEquipoActivo('todos');
      setBusqueda('');

      try {
        const items = await cargarBibliotecaEjercicios();
        if (!cancelado) {
          setCatalogo(items);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    };

    iniciar();
    return () => {
      cancelado = true;
    };
  }, [visible, grupoMuscularInicial]);

  // Lista filtrada en tiempo real
  const ejerciciosFiltrados = useMemo(() => {
    return filtrarEjerciciosBiblioteca({
      catalogo,
      busqueda,
      grupoMuscular: grupoActivo,
      equipamiento: equipoActivo,
    });
  }, [catalogo, busqueda, grupoActivo, equipoActivo]);

  const handleSeleccionar = useCallback(
    (item: EjercicioBiblioteca) => {
      vibrarBoton(15);
      onSeleccionar({
        nombre: item.name,
        grupoMuscular: item.muscleLabel,
        equipo: item.equipmentLabel,
        gifUrl: item.gifUrl,
        instrucciones: item.instructions,
      });
      onClose();
    },
    [onSeleccionar, onClose]
  );

  const handleCrearPersonalizado = useCallback(() => {
    const nombreLimpio = busqueda.trim();
    if (!nombreLimpio) return;
    vibrarBoton(15);
    onSeleccionar({
      nombre: nombreLimpio,
      grupoMuscular: grupoActivo !== 'todos' ? grupoActivo : undefined,
      equipo: equipoActivo !== 'todos' ? equipoActivo : undefined,
    });
    onClose();
  }, [busqueda, grupoActivo, equipoActivo, onSeleccionar, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            isTablet && { maxWidth: contentMaxWidth || 680, alignSelf: 'center' },
            { paddingBottom: Math.max(bottomInset, 16) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="barbell" size={16} color={colores.primarioHover} />
                <Text style={styles.headerBadge}>CATÁLOGO INTELIGENTE</Text>
              </View>
              <Text style={styles.headerTitle}>{titulo}</Text>
              <Text style={styles.headerSubtitle}>{subtitulo}</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={colores.texto} />
            </Pressable>
          </View>

          {/* Buscador */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={17} color={colores.suave} />
            <TextInput
              placeholder="Buscar ejercicio (ej. Press militar, Polea, Sentadilla...)"
              placeholderTextColor={colores.suave}
              value={busqueda}
              onChangeText={setBusqueda}
              inputMode="search"
              keyboardType="default"
              returnKeyType="search"
              enterKeyHint="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              style={styles.searchInput}
            />
            {busqueda.length > 0 && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colores.suave} />
              </Pressable>
            )}
          </View>

          {/* Chips de Grupos Musculares */}
          <View style={styles.selectorGruposWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorGruposScroll}
            >
              {GRUPOS_MUSCULARES.map((g) => {
                const activo = grupoActivo === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      vibrarBoton(8);
                      setGrupoActivo(g.id);
                    }}
                    style={[styles.chipGrupo, activo && styles.chipGrupoActivo]}
                  >
                    <Ionicons
                      name={g.icono as any}
                      size={13}
                      color={activo ? '#FFFFFF' : colores.suave}
                    />
                    <Text
                      style={[
                        styles.chipGrupoText,
                        activo && styles.chipGrupoTextActivo,
                      ]}
                    >
                      {g.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Filtro secundario: Equipamiento */}
          <View style={styles.selectorEquiposWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorEquiposScroll}
            >
              {LISTA_EQUIPAMIENTOS.map((eq) => {
                const activo = equipoActivo === eq.id;
                return (
                  <Pressable
                    key={eq.id}
                    onPress={() => {
                      vibrarBoton(8);
                      setEquipoActivo(eq.id);
                    }}
                    style={[styles.pillEquipo, activo && styles.pillEquipoActivo]}
                  >
                    <Text
                      style={[
                        styles.pillEquipoText,
                        activo && styles.pillEquipoTextActivo,
                      ]}
                    >
                      {eq.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Contador de resultados */}
          <View style={styles.contadorRow}>
            <Text style={styles.contadorText}>
              {ejerciciosFiltrados.length}{' '}
              {ejerciciosFiltrados.length === 1 ? 'ejercicio disponible' : 'ejercicios disponibles'}
            </Text>
          </View>

          {/* Lista de Ejercicios */}
          {cargando ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colores.primarioHover} />
              <Text style={styles.loadingText}>Cargando catálogo anatómico...</Text>
            </View>
          ) : (
            <FlatList
              data={ejerciciosFiltrados}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listaEjercicios}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              maxToRenderPerBatch={16}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== 'web'}
              renderItem={({ item }) => (
                <View style={styles.cardItem}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardItemTouch,
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={() => handleSeleccionar(item)}
                  >
                    {/* GIF Box oscuro */}
                    <View style={styles.gifBox}>
                      <Image
                        source={{ uri: item.gifUrl }}
                        style={styles.gifImage}
                        contentFit="contain"
                        cachePolicy="disk"
                        autoplay
                      />
                    </View>

                    {/* Contenido e información */}
                    <View style={styles.cardInfo}>
                      <Text style={styles.ejercicioNombre} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.tagsRow}>
                        <View style={styles.tagMúsculo}>
                          <Text style={styles.tagMusculoText}>{item.muscleLabel}</Text>
                        </View>

                        <View style={styles.tagEquipo}>
                          <Text style={styles.tagEquipoText}>{item.equipmentLabel}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* Botón Ver Técnica / Info */}
                  <Pressable
                    onPress={() => {
                      vibrarBoton(10);
                      setEjercicioTutorial(item);
                    }}
                    style={styles.infoBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={colores.suave} />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={38} color={colores.mutado} />
                  <Text style={styles.emptyTitle}>No se encontraron ejercicios</Text>
                  <Text style={styles.emptySubtitle}>
                    {busqueda
                      ? `No hay coincidencias para "${busqueda}".`
                      : 'Prueba cambiando los filtros de músculo o equipamiento.'}
                  </Text>

                  {busqueda.trim().length > 1 && (
                    <Pressable
                      onPress={handleCrearPersonalizado}
                      style={({ pressed }) => [
                        styles.crearBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.crearBtnText}>
                        Usar &quot;{busqueda.trim()}&quot; como personalizado
                      </Text>
                    </Pressable>
                  )}
                </View>
              }
              ListFooterComponent={
                busqueda.trim().length > 1 && ejerciciosFiltrados.length > 0 ? (
                  <Pressable
                    onPress={handleCrearPersonalizado}
                    style={({ pressed }) => [
                      styles.footerCrearBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colores.hoy} />
                    <Text style={styles.footerCrearText}>
                      ¿No está el que buscas? Usar &quot;{busqueda.trim()}&quot; como personalizado
                    </Text>
                  </Pressable>
                ) : null
              }
            />
          )}
        </View>

        {/* Modal de Tutorial / Técnica Paso a Paso */}
        {ejercicioTutorial && (
          <Modal
            visible={Boolean(ejercicioTutorial)}
            transparent
            animationType="fade"
            onRequestClose={() => setEjercicioTutorial(null)}
          >
            <View style={styles.tutorialOverlay}>
              <Pressable
                style={styles.tutorialBackdrop}
                onPress={() => setEjercicioTutorial(null)}
              />

              <View style={styles.tutorialCard}>
                <View style={styles.tutorialHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tutorialTag}>TÉCNICA & ANATOMÍA</Text>
                    <Text style={styles.tutorialTitle} numberOfLines={2}>
                      {ejercicioTutorial.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setEjercicioTutorial(null)}
                    style={styles.tutorialCloseBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={20} color={colores.texto} />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ maxHeight: 460 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  {/* GIF Grande de Demostración */}
                  <View style={styles.tutorialGifContainer}>
                    <Image
                      source={{ uri: ejercicioTutorial.gifUrl }}
                      style={styles.tutorialGif}
                      contentFit="contain"
                      cachePolicy="disk"
                      autoplay
                    />
                  </View>

                  {/* Metadatos */}
                  <View style={styles.tutorialMetaRow}>
                    <View style={styles.tutorialMetaBox}>
                      <Text style={styles.tutorialMetaLabel}>GRUPO OBJETIVO</Text>
                      <Text style={styles.tutorialMetaVal}>{ejercicioTutorial.muscleLabel}</Text>
                    </View>
                    <View style={styles.tutorialMetaBox}>
                      <Text style={styles.tutorialMetaLabel}>EQUIPAMIENTO</Text>
                      <Text style={styles.tutorialMetaVal}>{ejercicioTutorial.equipmentLabel}</Text>
                    </View>
                  </View>

                  {/* Instrucciones paso a paso */}
                  {ejercicioTutorial.instructions && ejercicioTutorial.instructions.length > 0 && (
                    <View style={styles.instruccionesBox}>
                      <Text style={styles.instruccionesTitulo}>Ejecución correcta:</Text>
                      {ejercicioTutorial.instructions.map((inst, idx) => (
                        <View key={idx} style={styles.instruccionRow}>
                          <Text style={styles.instruccionNum}>{idx + 1}</Text>
                          <Text style={styles.instruccionText}>{inst}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Botón Seleccionar */}
                <Pressable
                  onPress={() => {
                    const sel = ejercicioTutorial;
                    setEjercicioTutorial(null);
                    handleSeleccionar(sel);
                  }}
                  style={styles.tutorialSelectBtn}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.tutorialSelectBtnText}>Seleccionar este Ejercicio</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    backgroundColor: '#0E1017',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '92%',
    height: '92%',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerBadge: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    color: colores.texto,
    fontSize: 18,
    fontFamily: fuentes.black,
    marginTop: 2,
  },
  headerSubtitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 18,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.medium,
    padding: 0,
  },
  selectorGruposWrapper: {
    marginTop: 12,
  },
  selectorGruposScroll: {
    paddingHorizontal: 18,
    gap: 8,
  },
  chipGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipGrupoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primarioHover,
  },
  chipGrupoText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  chipGrupoTextActivo: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
  },
  selectorEquiposWrapper: {
    marginTop: 8,
  },
  selectorEquiposScroll: {
    paddingHorizontal: 18,
    gap: 6,
  },
  pillEquipo: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillEquipoActivo: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  pillEquipoText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  pillEquipoTextActivo: {
    color: colores.hoy,
    fontFamily: fuentes.bold,
  },
  contadorRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  contadorText: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.medium,
  },
  listaEjercicios: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 10,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  cardItemTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gifBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#06070B',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  ejercicioNombre: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tagMúsculo: {
    backgroundColor: 'rgba(158, 28, 48, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(158, 28, 48, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagMusculoText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  tagEquipo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagEquipoText: {
    color: colores.suave,
    fontSize: 10,
    fontFamily: fuentes.medium,
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  emptySubtitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  crearBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.primario,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  crearBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  footerCrearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  footerCrearText: {
    color: colores.hoy,
    fontSize: 12,
    fontFamily: fuentes.bold,
    textAlign: 'center',
  },
  // Tutorial Modal
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  tutorialCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#12151D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 18,
    overflow: 'hidden',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tutorialTag: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  tutorialTitle: {
    color: colores.texto,
    fontSize: 16,
    fontFamily: fuentes.black,
    marginTop: 2,
  },
  tutorialCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialGifContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#06070B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialGif: {
    width: '100%',
    height: '100%',
  },
  tutorialMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  tutorialMetaBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
  },
  tutorialMetaLabel: {
    color: colores.suave,
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  tutorialMetaVal: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
  instruccionesBox: {
    marginTop: 14,
    gap: 8,
  },
  instruccionesTitulo: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  instruccionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  instruccionNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(158, 28, 48, 0.25)',
    color: colores.primarioHover,
    fontSize: 11,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    lineHeight: 20,
  },
  instruccionText: {
    flex: 1,
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  tutorialSelectBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colores.primario,
    borderRadius: 14,
    paddingVertical: 12,
  },
  tutorialSelectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
});
