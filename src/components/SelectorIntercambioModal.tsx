import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import { EjercicioCatalogo } from '../types';
import { listarEjerciciosCatalogo, crearEjercicioCatalogo } from '../services/catalogo';
import { seguro } from '../utils/errores';

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
  const { height, width } = useWindowDimensions();
  const { bottomInset } = useLayout();
  const [busqueda, setBusqueda] = useState('');
  const [catalogo, setCatalogo] = useState<EjercicioCatalogo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (visible) {
      setBusqueda('');
      setCargando(true);
      listarEjerciciosCatalogo()
        .then((items) => setCatalogo(items))
        .finally(() => setCargando(false));
    }
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

        <View style={[styles.sheetContainer, { maxHeight: maxSheetHeight, paddingBottom: Math.max(bottomInset, 16) }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="swap-horizontal" size={16} color={colores.primarioHover} />
                <Text style={styles.headerSubtitle}>
                  {modo === 'solo_hoy' ? 'SUSTITUIR SOLO HOY' : 'REEMPLAZO PERMANENTE EN RUTINA'}
                </Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Sustituir: {ejercicioActualNombre}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={colores.texto} />
            </Pressable>
          </View>

          {/* Buscador */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colores.suave} />
            <TextInput
              placeholder="Buscar ejercicio o grupo muscular..."
              placeholderTextColor={colores.suave}
              value={busqueda}
              onChangeText={setBusqueda}
              style={styles.searchInput}
              autoFocus
            />
            {Boolean(busqueda) && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={colores.suave} />
              </Pressable>
            )}
          </View>

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
                  <Ionicons name="add" size={18} color={colores.exito} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colores.exito, fontFamily: fuentes.bold, fontSize: 13 }}>
                    Crear y usar "{busqueda.trim()}"
                  </Text>
                  <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.regular }}>
                    Se guardará en tu catálogo de ejercicios
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Sección Alternativas Sugeridas (solo si no hay búsqueda activa) */}
            {!busqueda.trim() && alternativasSugeridas.length > 0 && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={13} color={colores.hoy} />
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
                              deshabilitado && { color: colores.suave },
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
                          <Ionicons name="chevron-forward" size={16} color={colores.suave} />
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
                  <Ionicons name="fitness-outline" size={28} color={colores.suave} />
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
                            deshabilitado && { color: colores.suave },
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
                        <Ionicons name="chevron-forward" size={16} color={colores.suave} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
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
    backgroundColor: '#0F111A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 16,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    color: colores.primarioHover,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fuentes.black,
    color: colores.texto,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.medium,
    padding: 0,
  },
  scrollList: {
    marginTop: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    color: colores.suave,
    letterSpacing: 0.8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 8,
  },
  itemCardDisabled: {
    opacity: 0.45,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  itemNombre: {
    fontSize: 14,
    fontFamily: fuentes.bold,
    color: colores.texto,
  },
  itemMeta: {
    fontSize: 11,
    fontFamily: fuentes.regular,
    color: colores.suave,
    marginTop: 2,
  },
  badgeActual: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  badgeActualText: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    color: '#60A5FA',
  },
  badgeYaEnRutina: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeYaEnRutinaText: {
    fontSize: 10,
    fontFamily: fuentes.bold,
    color: '#F87171',
  },
  crearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 10,
  },
  crearIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.regular,
    textAlign: 'center',
  },
});
