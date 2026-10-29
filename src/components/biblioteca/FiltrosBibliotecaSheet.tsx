import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import { vibrarBoton } from '../../utilidades/hapticos';
import {
  GRUPOS_MUSCULARES,
  LISTA_EQUIPAMIENTOS,
  ORDENES_BIBLIOTECA,
  OrdenBiblioteca,
  colorDeGrupo,
} from '../../servicios/bibliotecaEjercicios';

export interface FiltrosBibliotecaState {
  grupos: string[];
  equipos: string[];
  soloFavoritos: boolean;
  orden: OrdenBiblioteca;
}

export const FILTROS_BIBLIOTECA_INICIALES: FiltrosBibliotecaState = {
  grupos: [],
  equipos: [],
  soloFavoritos: false,
  orden: 'inteligente',
};

interface Props {
  visible: boolean;
  filtros: FiltrosBibliotecaState;
  conteosGrupos?: Record<string, number>;
  conteosEquipos?: Record<string, number>;
  onClose: () => void;
  onAplicar: (filtros: FiltrosBibliotecaState) => void;
}

function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor)
    ? lista.filter((item) => item !== valor)
    : [...lista, valor];
}

export default function FiltrosBibliotecaSheet({ visible, ...props }: Props) {
  if (!visible) return null;
  return <FiltrosBibliotecaContenido {...props} />;
}

function FiltrosBibliotecaContenido({
  filtros,
  conteosGrupos = {},
  conteosEquipos = {},
  onClose,
  onAplicar,
}: Omit<Props, 'visible'>) {
  const { isTablet, contentMaxWidth, barBottomPadding } = useLayout();
  const [borrador, setBorrador] = useState<FiltrosBibliotecaState>(filtros);

  const activos =
    borrador.grupos.length +
    borrador.equipos.length +
    (borrador.soloFavoritos ? 1 : 0) +
    (borrador.orden !== 'inteligente' ? 1 : 0);

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar filtros"
      />

      <View
        style={[
          styles.sheet,
          isTablet && { maxWidth: contentMaxWidth || 620, alignSelf: 'center' },
          { paddingBottom: Math.max(barBottomPadding, 14) },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="options-outline" size={17} color={noir.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>FILTROS INTELIGENTES</Text>
            <Text style={styles.title}>Afina tu biblioteca</Text>
            <Text style={styles.subtitle}>
              Combina músculos, equipamiento y tu historial.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar filtros"
          >
            <Ionicons name="close" size={20} color={noir.platinum} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.sheetScroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>ORDENAR POR</Text>
              <Text style={styles.sectionHint}>La inteligencia aprende de tus favoritos</Text>
            </View>

            <View style={styles.ordenGrid}>
              {ORDENES_BIBLIOTECA.map((opcion) => {
                const activo = borrador.orden === opcion.id;
                return (
                  <Pressable
                    key={opcion.id}
                    onPress={() => {
                      vibrarBoton(8);
                      setBorrador((prev) => ({ ...prev, orden: opcion.id }));
                    }}
                    style={({ pressed }) => [
                      styles.ordenCard,
                      activo && styles.ordenCardActiva,
                      pressed && { opacity: 0.82 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={activo ? { selected: true } : {}}
                    accessibilityLabel={`Ordenar por ${opcion.nombre}`}
                  >
                    <Ionicons
                      name={opcion.icono as any}
                      size={14}
                      color={activo ? noir.info : noir.muted}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.ordenNombre, activo && styles.ordenNombreActivo]}
                        numberOfLines={1}
                      >
                        {opcion.nombre}
                      </Text>
                      <Text style={styles.ordenDesc} numberOfLines={1}>
                        {opcion.descripcion}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={() => {
              vibrarBoton(10);
              setBorrador((prev) => ({
                ...prev,
                soloFavoritos: !prev.soloFavoritos,
              }));
            }}
            style={({ pressed }) => [
              styles.favoritosRow,
              borrador.soloFavoritos && styles.favoritosRowActiva,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: borrador.soloFavoritos }}
            accessibilityLabel="Mostrar solo favoritos"
          >
            <View style={styles.favoritosIcon}>
              <Ionicons
                name={borrador.soloFavoritos ? 'heart' : 'heart-outline'}
                size={16}
                color={borrador.soloFavoritos ? '#FF6B8A' : noir.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.favoritosTitle}>Solo mis favoritos</Text>
              <Text style={styles.favoritosSub}>
                Reduce el catálogo a los ejercicios que ya guardaste.
              </Text>
            </View>
            <View
              style={[
                styles.switchTrack,
                borrador.soloFavoritos && styles.switchTrackActiva,
              ]}
            >
              <View
                style={[
                  styles.switchKnob,
                  borrador.soloFavoritos && styles.switchKnobActivo,
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>GRUPO MUSCULAR</Text>
              <Text style={styles.sectionHint}>
                {borrador.grupos.length > 0
                  ? `${borrador.grupos.length} seleccionados`
                  : 'Selecciona varios'}
              </Text>
            </View>

            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setBorrador((prev) => ({ ...prev, grupos: [] }));
                }}
                style={({ pressed }) => [
                  styles.chip,
                  borrador.grupos.length === 0 && styles.chipActivo,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                accessibilityState={
                  borrador.grupos.length === 0 ? { selected: true } : {}
                }
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: noir.info },
                  ]}
                />
                <Text
                  style={[
                    styles.chipText,
                    borrador.grupos.length === 0 && styles.chipTextActivo,
                  ]}
                >
                  Todos
                </Text>
              </Pressable>

              {GRUPOS_MUSCULARES.filter((grupo) => grupo.id !== 'todos').map(
                (grupo) => {
                  const activo = borrador.grupos.includes(grupo.id);
                  const color = colorDeGrupo(grupo.id);
                  return (
                    <Pressable
                      key={grupo.id}
                      onPress={() => {
                        vibrarBoton(8);
                        setBorrador((prev) => ({
                          ...prev,
                          grupos: alternar(prev.grupos, grupo.id),
                        }));
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        activo && {
                          backgroundColor: `${color}18`,
                          borderColor: `${color}66`,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={activo ? { selected: true } : {}}
                    >
                      <View style={[styles.chipDot, { backgroundColor: color }]} />
                      <Text
                        style={[
                          styles.chipText,
                          activo && { color, fontFamily: fuentes.bold },
                        ]}
                      >
                        {grupo.nombre}
                      </Text>
                      {conteosGrupos[grupo.id] ? (
                        <Text style={[styles.chipCount, activo && { color }]}>
                          {conteosGrupos[grupo.id]}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                }
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>EQUIPAMIENTO</Text>
              <Text style={styles.sectionHint}>
                {borrador.equipos.length > 0
                  ? `${borrador.equipos.length} seleccionados`
                  : 'Selecciona varios'}
              </Text>
            </View>

            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setBorrador((prev) => ({ ...prev, equipos: [] }));
                }}
                style={({ pressed }) => [
                  styles.chip,
                  borrador.equipos.length === 0 && styles.chipActivo,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                accessibilityState={
                  borrador.equipos.length === 0 ? { selected: true } : {}
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    borrador.equipos.length === 0 && styles.chipTextActivo,
                  ]}
                >
                  Todo el equipo
                </Text>
              </Pressable>

              {LISTA_EQUIPAMIENTOS.filter((equipo) => equipo.id !== 'todos').map(
                (equipo) => {
                  const activo = borrador.equipos.includes(equipo.id);
                  return (
                    <Pressable
                      key={equipo.id}
                      onPress={() => {
                        vibrarBoton(8);
                        setBorrador((prev) => ({
                          ...prev,
                          equipos: alternar(prev.equipos, equipo.id),
                        }));
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        activo && styles.chipActivo,
                        pressed && { opacity: 0.8 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={activo ? { selected: true } : {}}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          activo && styles.chipTextActivo,
                        ]}
                      >
                        {equipo.nombre}
                      </Text>
                      {conteosEquipos[equipo.id] ? (
                        <Text style={[styles.chipCount, activo && { color: noir.info }]}>
                          {conteosEquipos[equipo.id]}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                }
              )}
            </View>
          </View>

          <View style={styles.smartNote}>
            <Ionicons name="sparkles-outline" size={13} color={noir.champagne} />
            <Text style={styles.smartNoteText}>
              La búsqueda entiende «polea» o «cable», «pecho» o «pectoral», y
              prioriza tus grupos favoritos.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              vibrarBoton(10);
              setBorrador({ ...FILTROS_BIBLIOTECA_INICIALES });
            }}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={14} color={noir.muted} />
            <Text style={styles.resetText}>Restablecer</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              vibrarBoton(14);
              onAplicar(borrador);
            }}
            style={({ pressed }) => [
              styles.applyBtn,
              pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
            ]}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={['#E23A55', '#9E1C30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 13 }]}
            />
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.applyText}>
              Aplicar{activos > 0 ? ` · ${activos}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 3, 6, 0.78)',
    justifyContent: 'flex-end',
    zIndex: 70,
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#0B0D13',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  kicker: {
    color: noir.info,
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.9,
  },
  title: {
    color: noir.text,
    fontSize: 17,
    fontFamily: fuentes.black,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  subtitle: {
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 16,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: noir.muted2,
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.9,
  },
  sectionHint: {
    color: noir.muted2,
    fontSize: 8.5,
    fontFamily: fuentes.regular,
  },
  ordenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ordenCard: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  ordenCardActiva: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.32)',
  },
  ordenNombre: {
    color: noir.platinum,
    fontSize: 10.5,
    fontFamily: fuentes.bold,
  },
  ordenNombreActivo: {
    color: '#CDEEFF',
  },
  ordenDesc: {
    color: noir.muted2,
    fontSize: 7.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  favoritosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  favoritosRowActiva: {
    backgroundColor: 'rgba(255, 107, 138, 0.075)',
    borderColor: 'rgba(255, 107, 138, 0.28)',
  },
  favoritosIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 138, 0.08)',
  },
  favoritosTitle: {
    color: noir.text,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  favoritosSub: {
    color: noir.muted,
    fontSize: 8.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActiva: {
    backgroundColor: 'rgba(255, 107, 138, 0.25)',
    borderColor: 'rgba(255, 107, 138, 0.5)',
  },
  switchKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: noir.muted,
  },
  switchKnobActivo: {
    backgroundColor: '#FF6B8A',
    alignSelf: 'flex-end',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  chipActivo: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.3)',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chipText: {
    color: noir.muted,
    fontSize: 9.5,
    fontFamily: fuentes.medium,
  },
  chipTextActivo: {
    color: '#CDEEFF',
    fontFamily: fuentes.bold,
  },
  chipCount: {
    color: noir.muted2,
    fontSize: 8,
    fontFamily: fuentes.bold,
    fontVariant: ['tabular-nums'],
  },
  smartNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 209, 102, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.13)',
  },
  smartNoteText: {
    flex: 1,
    color: '#C8B98C',
    fontSize: 8.5,
    lineHeight: 12.5,
    fontFamily: fuentes.regular,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resetText: {
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  applyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
});
