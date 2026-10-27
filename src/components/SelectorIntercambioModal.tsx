import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes, noir } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import { EjercicioCatalogo } from '../types';
import { listarEjerciciosCatalogo, crearEjercicioCatalogo } from '../services/catalogo';
import { seguro } from '../utils/errores';
import SelectorBibliotecaModal from './SelectorBibliotecaModal';
import { obtenerGifEjercicio } from '../services/ejerciciosGifs';

type Props = {
  visible: boolean;
  ejercicioActualNombre: string;
  ejerciciosEnRutina: string[];
  modo: 'solo_hoy' | 'rutina';
  onClose: () => void;
  onSeleccionar: (nuevoNombre: string, modo: 'solo_hoy' | 'rutina') => void;
};

export default function SelectorIntercambioModal({
  visible,
  ejercicioActualNombre,
  ejerciciosEnRutina,
  modo,
  onClose,
  onSeleccionar,
}: Props) {
  const { height } = useWindowDimensions();
  const { barBottomPadding } = useLayout();
  const [busqueda, setBusqueda] = useState('');
  const [catalogo, setCatalogo] = useState<EjercicioCatalogo[]>([]);
  const [creando, setCreando] = useState(false);
  const [bibliotecaVisible, setBibliotecaVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    const cargarCatalogo = async () => {
      setBusqueda('');
      const items = await listarEjerciciosCatalogo();
      if (!cancelado) setCatalogo(items);
    };
    cargarCatalogo();
    return () => {
      cancelado = true;
    };
  }, [visible]);

  const nombreActualLimpio = ejercicioActualNombre.trim().toLowerCase();
  const nombresEnRutinaLimpios = useMemo(() => {
    return new Set(ejerciciosEnRutina.map((n) => n.trim().toLowerCase()));
  }, [ejerciciosEnRutina]);

  // Ejercicio actual en el catálogo para conocer su grupo muscular o equipo
  const ejercicioActualCat = useMemo(() => {
    return catalogo.find((e) => e.nombre.trim().toLowerCase() === nombreActualLimpio);
  }, [catalogo, nombreActualLimpio]);

  // Filtrado general por búsqueda
  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((e) =>
      e.nombre.toLowerCase().includes(q) ||
      (e.grupo_muscular && e.grupo_muscular.toLowerCase().includes(q)) ||
      (e.equipo && e.equipo.toLowerCase().includes(q))
    );
  }, [catalogo, busqueda]);

  // Alternativas sugeridas: mismo grupo muscular o equipo
  const alternativasSugeridas = useMemo(() => {
    if (!ejercicioActualCat || (!ejercicioActualCat.grupo_muscular && !ejercicioActualCat.equipo)) {
      // Sugerir los primeros 4 del catálogo distintos al actual
      return catalogo
        .filter((e) => e.nombre.trim().toLowerCase() !== nombreActualLimpio)
        .slice(0, 4);
    }
    return catalogo
      .filter((e) => {
        if (e.nombre.trim().toLowerCase() === nombreActualLimpio) return false;
        const coincideGrupo = ejercicioActualCat.grupo_muscular && e.grupo_muscular === ejercicioActualCat.grupo_muscular;
        const coincideEquipo = ejercicioActualCat.equipo && e.equipo === ejercicioActualCat.equipo;
        return coincideGrupo || coincideEquipo;
      })
      .slice(0, 5);
  }, [catalogo, ejercicioActualCat, nombreActualLimpio]);

  // Verificar si el texto buscado coincide exactamente con un ejercicio del catálogo
  const existeExacto = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return catalogo.some((e) => e.nombre.trim().toLowerCase() === q);
  }, [catalogo, busqueda]);

  const handleCrearNuevo = () =>
    seguro(async () => {
      const q = busqueda.trim();
      if (!q) return;
      setCreando(true);
      try {
        const nuevo = await crearEjercicioCatalogo(q, ejercicioActualCat?.grupo_muscular || null);
        setCatalogo((prev) => [...prev, nuevo]);
        onSeleccionar(nuevo.nombre, modo);
      } finally {
        setCreando(false);
      }
    });

  if (!visible) return null;

  const maxSheetHeight = Math.min(height * 0.9, 720);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheetContainer, { maxHeight: maxSheetHeight, paddingBottom: Math.max(barBottomPadding, 16) }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={modo === 'solo_hoy' ? 'today-outline' : 'repeat'}
                  size={16}
                  color={modo === 'solo_hoy' ? noir.info : noir.lavender}
                />
                <Text
                  style={[
                    styles.headerSubtitle,
                    modo === 'rutina' && { color: noir.lavender },
                  ]}
                >
                  {modo === 'solo_hoy' ? 'CAMBIO SOLO POR HOY' : 'CAMBIO PERMANENTE EN RUTINA'}
                </Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Sustituir: {ejercicioActualNombre}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={noir.text} />
            </Pressable>
          </View>

          {/* Buscador */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={noir.muted} />
            <TextInput
              placeholder="Buscar ejercicio o grupo muscular..."
              placeholderTextColor={noir.muted}
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
              autoFocus
            />
            {Boolean(busqueda) && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={noir.muted} />
              </Pressable>
            )}
          </View>

          {/* Explicación del alcance del cambio */}
          <View
            style={[
              styles.modeBanner,
              modo === 'solo_hoy' ? styles.modeBannerTemporal : styles.modeBannerPermanente,
            ]}
          >
            <View
              style={[
                styles.modeBannerIcon,
                modo === 'solo_hoy'
                  ? styles.modeBannerIconTemporal
                  : styles.modeBannerIconPermanente,
              ]}
            >
              <Ionicons
                name={modo === 'solo_hoy' ? 'today-outline' : 'repeat'}
                size={16}
                color={modo === 'solo_hoy' ? noir.info : noir.lavender}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeBannerTitle}>
                {modo === 'solo_hoy'
                  ? 'El original desaparece solo de esta sesión'
                  : 'El original desaparece de la rutina'}
              </Text>
              <Text style={styles.modeBannerText}>
                {modo === 'solo_hoy'
                  ? 'El nuevo ejercicio empieza sin series ni repeticiones: añádelas a tu medida. Podrás deshacerlo al instante.'
                  : 'El nuevo ejercicio hereda las series, repeticiones y peso del original, y se usará en las próximas sesiones.'}
              </Text>
            </View>
          </View>

          {/* Botón Acceso Rápido a Biblioteca Anatómica con GIFs */}
          <Pressable
            onPress={() => setBibliotecaVisible(true)}
            style={({ pressed }) => [
              styles.btnExplorarBiblioteca,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.iconBoxBiblioIntercambio}>
              <Ionicons name="albums" size={15} color={noir.lavender} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.btnBiblioIntercambioTitle}>
                Explorar Biblioteca Completa (1.300+ Ejercicios)
              </Text>
              <Text style={styles.btnBiblioIntercambioSub}>
                Filtrar por músculo con animaciones y técnica
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={noir.muted} />
          </Pressable>

          {/* Lista de Ejercicios */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Opción Crear Nuevo si no existe */}
            {!existeExacto && busqueda.trim().length > 1 && (
              <Pressable
                onPress={handleCrearNuevo}
                disabled={creando}
                style={({ pressed }) => [
                  styles.crearCard,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={styles.crearIconBox}>
                  <Ionicons name="add" size={18} color={noir.mint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: noir.mint, fontFamily: fuentes.bold, fontSize: 13 }}>
                    Crear y usar &quot;{busqueda.trim()}&quot;
                  </Text>
                  <Text style={{ color: noir.muted, fontSize: 11, fontFamily: fuentes.regular }}>
                    Se guardará en tu catálogo de ejercicios
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Sección Alternativas Sugeridas (solo si no hay búsqueda activa) */}
            {!busqueda.trim() && alternativasSugeridas.length > 0 && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={13} color={noir.champagne} />
                  <Text style={styles.sectionTitle}>ALTERNATIVAS SUGERIDAS</Text>
                </View>

                <View style={{ gap: 6 }}>
                  {alternativasSugeridas.map((item) => {
                    const itemLimpio = item.nombre.trim().toLowerCase();
                    const esActual = itemLimpio === nombreActualLimpio;
                    const yaEnRutina = nombresEnRutinaLimpios.has(itemLimpio);
                    const deshabilitado = esActual || yaEnRutina;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => onSeleccionar(item.nombre, modo)}
                        disabled={deshabilitado}
                        style={({ pressed }) => [
                          styles.itemCard,
                          deshabilitado && styles.itemCardDisabled,
                          pressed && !deshabilitado && { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemNombre,
                              deshabilitado && { color: noir.muted },
                            ]}
                          >
                            {item.nombre}
                          </Text>
                          {Boolean(item.grupo_muscular || item.equipo) && (
                            <Text style={styles.itemMeta}>
                              {[item.grupo_muscular, item.equipo].filter(Boolean).join(' • ')}
                            </Text>
                          )}
                        </View>

                        {esActual ? (
                          <View style={styles.badgeActual}>
                            <Text style={styles.badgeActualText}>Actual</Text>
                          </View>
                        ) : yaEnRutina ? (
                          <View style={styles.badgeYaEnRutina}>
                            <Text style={styles.badgeYaEnRutinaText}>En rutina</Text>
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={noir.muted} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Catálogo Completo */}
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionTitle}>
                {busqueda.trim() ? `RESULTADOS (${catalogoFiltrado.length})` : 'CATÁLOGO DE EJERCICIOS'}
              </Text>

              {catalogoFiltrado.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="fitness-outline" size={28} color={noir.muted} />
                  <Text style={styles.emptyText}>No se encontraron ejercicios con ese nombre.</Text>
                </View>
              ) : (
                catalogoFiltrado.map((item) => {
                  const itemLimpio = item.nombre.trim().toLowerCase();
                  const esActual = itemLimpio === nombreActualLimpio;
                  const yaEnRutina = nombresEnRutinaLimpios.has(itemLimpio);
                  const deshabilitado = esActual || yaEnRutina;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => onSeleccionar(item.nombre, modo)}
                      disabled={deshabilitado}
                      style={({ pressed }) => [
                        styles.itemCard,
                        deshabilitado && styles.itemCardDisabled,
                        pressed && !deshabilitado && { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.itemNombre,
                            deshabilitado && { color: noir.muted },
                          ]}
                        >
                          {item.nombre}
                        </Text>
                        {Boolean(item.grupo_muscular || item.equipo) && (
                          <Text style={styles.itemMeta}>
                            {[item.grupo_muscular, item.equipo].filter(Boolean).join(' • ')}
                          </Text>
                        )}
                      </View>

                      {esActual ? (
                        <View style={styles.badgeActual}>
                          <Text style={styles.badgeActualText}>Actual</Text>
                        </View>
                      ) : yaEnRutina ? (
                        <View style={styles.badgeYaEnRutina}>
                          <Text style={styles.badgeYaEnRutinaText}>En rutina</Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={noir.muted} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Selector de Biblioteca con filtro anatómico precargado */}
      <SelectorBibliotecaModal
        visible={bibliotecaVisible}
        onClose={() => setBibliotecaVisible(false)}
        onSeleccionar={(sel) => {
          setBibliotecaVisible(false);
          onSeleccionar(sel.nombre, modo);
        }}
        grupoMuscularInicial={obtenerGifEjercicio(ejercicioActualNombre).muscle}
        titulo="Sustituir Ejercicio"
        subtitulo={`Alternativas anatómicas para ${ejercicioActualNombre}`}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: noir.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 14,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerSubtitle: {
    fontSize: 8.5,
    fontFamily: fuentes.bold,
    color: noir.info,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: fuentes.black,
    color: noir.text,
    marginTop: 2,
    letterSpacing: -0.25,
  },
  closeBtn: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 11,
    paddingHorizontal: 11,
    height: 42,
    gap: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
  },
  searchInput: {
    flex: 1,
    color: noir.text,
    fontSize: 12.5,
    fontFamily: fuentes.medium,
    padding: 0,
  },
  modeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 9,
  },
  modeBannerTemporal: {
    backgroundColor: 'rgba(92, 200, 255, 0.045)',
    borderColor: 'rgba(92, 200, 255, 0.16)',
  },
  modeBannerPermanente: {
    backgroundColor: 'rgba(179, 148, 255, 0.045)',
    borderColor: 'rgba(179, 148, 255, 0.18)',
  },
  modeBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modeBannerIconTemporal: {
    backgroundColor: 'rgba(92, 200, 255, 0.1)',
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  modeBannerIconPermanente: {
    backgroundColor: 'rgba(179, 148, 255, 0.1)',
    borderColor: 'rgba(179, 148, 255, 0.22)',
  },
  modeBannerTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 11.5,
  },
  modeBannerText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 2,
  },
  scrollList: {
    marginTop: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: fuentes.bold,
    color: noir.muted2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.022)',
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
    gap: 8,
  },
  itemCardDisabled: {
    opacity: 0.45,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  itemNombre: {
    fontSize: 12.5,
    fontFamily: fuentes.bold,
    color: noir.text,
  },
  itemMeta: {
    fontSize: 9,
    fontFamily: fuentes.regular,
    color: noir.muted,
    marginTop: 2,
  },
  badgeActual: {
    backgroundColor: 'rgba(92, 200, 255, 0.09)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.25)',
  },
  badgeActualText: {
    fontSize: 8,
    fontFamily: fuentes.bold,
    color: '#CDEEFF',
  },
  badgeYaEnRutina: {
    backgroundColor: 'rgba(179, 148, 255, 0.09)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.25)',
  },
  badgeYaEnRutinaText: {
    fontSize: 8,
    fontFamily: fuentes.bold,
    color: '#E6DCFF',
  },
  crearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 242, 176, 0.045)',
    borderRadius: 11,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.18)',
    gap: 9,
  },
  crearIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(63, 242, 176, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: noir.muted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
  btnExplorarBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(179, 148, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.16)',
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 6,
    gap: 9,
  },
  iconBoxBiblioIntercambio: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(179, 148, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBiblioIntercambioTitle: {
    color: noir.text,
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  btnBiblioIntercambioSub: {
    color: noir.muted,
    fontSize: 9,
    fontFamily: fuentes.regular,
  },
});
