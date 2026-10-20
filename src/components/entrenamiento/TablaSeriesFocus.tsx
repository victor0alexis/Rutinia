import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../../constants/colores';
import { vibrarBoton } from '../../utils/haptics';
import { LiquidMetalButton } from '../LiquidMetalButton';
import { DROPSET_MAX_DROPS, calcularKgSugeridoDrop } from '../../constants/entrenamiento';

export interface SerieItem {
  id?: string;
  setNum: number;
  peso: string;
  reps: string;
  rir?: string;
  completado: boolean;
  previa?: string;
  repsParciales?: number;
  tipo?: 'normal' | 'calentamiento' | 'fallo';
  drops?: {
    orden: number;
    peso: string;
    reps: string;
    rir?: string;
    completado?: boolean;
  }[];
}

interface Props {
  ejIdx: number;
  series: SerieItem[];
  activo?: boolean;
  focusCampoActivo?: {
    sIdx: number;
    campo: 'kg' | 'reps' | 'rir';
    dropIdx?: number;
  } | null;
  onFocusCampo: (sIdx: number, campo: 'kg' | 'reps' | 'rir', dropIdx?: number) => void;
  onToggleCompletado: (sIdx: number, dropIdx?: number) => void;
  onAnadirSerie: () => void;
  onEliminarSerie: (sIdx: number) => void;
  onActualizarSerie: (sIdx: number, patch: Partial<SerieItem>) => void;
}

export default function TablaSeriesFocus({
  series,
  activo = true,
  focusCampoActivo,
  onFocusCampo,
  onToggleCompletado,
  onAnadirSerie,
  onEliminarSerie,
  onActualizarSerie,
}: Props) {
  const [menuSerieIdx, setMenuSerieIdx] = useState<number | null>(null);

  const abrirMenu = (idx: number) => {
    vibrarBoton(12);
    setMenuSerieIdx(idx);
  };

  const cerrarMenu = () => {
    setMenuSerieIdx(null);
  };

  const serieSeleccionada = menuSerieIdx !== null ? series[menuSerieIdx] : null;

  const handleAnadirDrop = () => {
    if (menuSerieIdx === null || !serieSeleccionada) return;
    const dropsActuales = serieSeleccionada.drops || [];
    if (dropsActuales.length >= DROPSET_MAX_DROPS) return;

    const baseKg = parseFloat(serieSeleccionada.peso) || 0;
    const sugerido = calcularKgSugeridoDrop(baseKg);

    const nuevoDrop = {
      orden: dropsActuales.length + 1,
      peso: sugerido,
      reps: '',
      rir: '0',
      completado: false,
    };

    onActualizarSerie(menuSerieIdx, {
      drops: [...dropsActuales, nuevoDrop],
    });
    cerrarMenu();
  };

  const handleToggleParciales = () => {
    if (menuSerieIdx === null || !serieSeleccionada) return;
    const actual = serieSeleccionada.repsParciales || 0;
    onActualizarSerie(menuSerieIdx, {
      repsParciales: actual > 0 ? 0 : 3,
    });
    cerrarMenu();
  };

  const handleToggleCalentamiento = () => {
    if (menuSerieIdx === null || !serieSeleccionada) return;
    const esWarmup = serieSeleccionada.tipo === 'calentamiento';
    onActualizarSerie(menuSerieIdx, {
      tipo: esWarmup ? 'normal' : 'calentamiento',
    });
    cerrarMenu();
  };

  const handleEliminar = () => {
    if (menuSerieIdx === null) return;
    onEliminarSerie(menuSerieIdx);
    cerrarMenu();
  };

  return (
    <View style={styles.container}>
      {/* Encabezado de Columnas */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCol, styles.colSet]}>SET</Text>
        <Text style={[styles.headerCol, styles.colPrevia]}>PREVIA</Text>
        <Text style={[styles.headerCol, styles.colInput]}>KG</Text>
        <Text style={[styles.headerCol, styles.colInput]}>REPS</Text>
        <Text style={[styles.headerCol, styles.colRir]}>RIR</Text>
        <View style={styles.colCheckHeader}>
          <Ionicons name="sparkles" size={13} color="#EF4444" />
        </View>
        <View style={styles.colMenuHeader} />
      </View>

      {/* Filas de Series */}
      <View style={styles.seriesList}>
        {series.map((s, sIdx) => {
          const esFocusKg = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'kg' && focusCampoActivo?.dropIdx === undefined;
          const esFocusReps = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'reps' && focusCampoActivo?.dropIdx === undefined;
          const esFocusRir = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'rir' && focusCampoActivo?.dropIdx === undefined;
          const tieneParciales = Boolean(s.repsParciales && s.repsParciales > 0);

          return (
            <View key={s.id || `set-${sIdx}`} style={styles.serieBlock}>
              {/* Fila Principal de la Serie */}
              <View
                style={[
                  styles.serieRow,
                  s.completado && styles.serieRowCompletada,
                ]}
              >
                {/* SET NUM */}
                <View style={[styles.setNumBadge, s.tipo === 'calentamiento' && styles.setNumWarmup]}>
                  <Text style={styles.setNumText}>
                    {s.tipo === 'calentamiento' ? 'W' : s.setNum}
                  </Text>
                </View>

                {/* CARGA PREVIA */}
                <Text style={styles.colPreviaText} numberOfLines={1}>
                  {s.previa || '—'}
                </Text>

                {/* INPUT KG */}
                <Pressable
                  onPress={() => onFocusCampo(sIdx, 'kg')}
                  style={[styles.inputBox, esFocusKg && styles.inputBoxActivo]}
                >
                  <Text style={[styles.inputText, !s.peso && styles.inputPlaceholder]}>
                    {s.peso || '0'}
                  </Text>
                </Pressable>

                {/* INPUT REPS */}
                <Pressable
                  onPress={() => onFocusCampo(sIdx, 'reps')}
                  style={[styles.inputBox, esFocusReps && styles.inputBoxActivo]}
                >
                  <Text style={[styles.inputText, !s.reps && styles.inputPlaceholder]}>
                    {s.reps || '0'}
                    {tieneParciales && (
                      <Text style={styles.parcialesTag}>+{s.repsParciales}p</Text>
                    )}
                  </Text>
                </Pressable>

                {/* INPUT RIR */}
                <Pressable
                  onPress={() => onFocusCampo(sIdx, 'rir')}
                  style={[styles.rirBox, esFocusRir && styles.rirBoxActivo]}
                >
                  <Text style={[styles.rirText, !s.rir && styles.rirPlaceholder]}>
                    {s.rir !== undefined && s.rir !== '' ? s.rir : '—'}
                  </Text>
                </Pressable>

                {/* BOTÓN CHECK COMPLETADO */}
                <Pressable
                  onPress={() => onToggleCompletado(sIdx)}
                  style={[
                    styles.checkButton,
                    s.completado && styles.checkButtonActive,
                  ]}
                  hitSlop={6}
                >
                  <Ionicons
                    name={s.completado ? 'checkmark' : 'checkmark-outline'}
                    size={17}
                    color={s.completado ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'}
                  />
                </Pressable>

                {/* BOTÓN MENÚ ⋯ */}
                <Pressable
                  onPress={() => abrirMenu(sIdx)}
                  style={styles.menuButton}
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-horizontal" size={17} color="rgba(255, 255, 255, 0.45)" />
                </Pressable>
              </View>

              {/* Subfilas de Drop Sets subordinadas */}
              {s.drops && s.drops.map((drop, dIdx) => {
                const esFocusDropKg = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'kg' && focusCampoActivo?.dropIdx === dIdx;
                const esFocusDropReps = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'reps' && focusCampoActivo?.dropIdx === dIdx;

                return (
                  <View key={`drop-${dIdx}`} style={styles.dropRow}>
                    <View style={styles.dropBadge}>
                      <Text style={styles.dropBadgeText}>D{dIdx + 1}</Text>
                    </View>

                    <Text style={styles.colPreviaText}>↓ Drop</Text>

                    <Pressable
                      onPress={() => onFocusCampo(sIdx, 'kg', dIdx)}
                      style={[styles.inputBox, styles.inputBoxDrop, esFocusDropKg && styles.inputBoxActivo]}
                    >
                      <Text style={[styles.inputText, !drop.peso && styles.inputPlaceholder]}>
                        {drop.peso || '0'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onFocusCampo(sIdx, 'reps', dIdx)}
                      style={[styles.inputBox, styles.inputBoxDrop, esFocusDropReps && styles.inputBoxActivo]}
                    >
                      <Text style={[styles.inputText, !drop.reps && styles.inputPlaceholder]}>
                        {drop.reps || '0'}
                      </Text>
                    </Pressable>

                    <View style={styles.rirBox}>
                      <Text style={styles.rirText}>0</Text>
                    </View>

                    <Pressable
                      onPress={() => onToggleCompletado(sIdx, dIdx)}
                      style={[
                        styles.checkButton,
                        styles.checkButtonDrop,
                        drop.completado && styles.checkButtonActive,
                      ]}
                      hitSlop={6}
                    >
                      <Ionicons
                        name={drop.completado ? 'checkmark' : 'checkmark-outline'}
                        size={15}
                        color={drop.completado ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'}
                      />
                    </Pressable>

                    <View style={styles.menuButton} />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {/* Botón Inferior para Añadir Serie con LiquidMetal */}
      <View style={styles.addSerieWrapper}>
        <LiquidMetalButton
          titulo="+ Añadir serie"
          onPress={() => {
            vibrarBoton(12);
            onAnadirSerie();
          }}
          tamano="normal"
          borderWidth={3}
          activo={activo}
          style={{ alignSelf: 'stretch' }}
        />
      </View>

      {/* Menú Contextual Desplegable para la Serie */}
      <Modal
        visible={menuSerieIdx !== null}
        animationType="fade"
        transparent
        onRequestClose={cerrarMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={cerrarMenu}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>
              OPCIONES DE SERIE #{serieSeleccionada?.setNum}
            </Text>

            <Pressable style={styles.menuOption} onPress={handleAnadirDrop}>
              <Ionicons name="arrow-down-circle-outline" size={19} color="#7CF3FF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuOptionText}>Añadir Drop Set</Text>
                <Text style={styles.menuOptionSub}>Disminuye el peso al fallo sin descanso</Text>
              </View>
            </Pressable>

            <Pressable style={styles.menuOption} onPress={handleToggleParciales}>
              <Ionicons name="flash-outline" size={19} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuOptionText}>
                  {serieSeleccionada?.repsParciales ? 'Quitar Reps Parciales' : 'Añadir Reps Parciales (+p)'}
                </Text>
                <Text style={styles.menuOptionSub}>Repeticiones tras el fallo muscular</Text>
              </View>
            </Pressable>

            <Pressable style={styles.menuOption} onPress={handleToggleCalentamiento}>
              <Ionicons name="flame-outline" size={19} color="#93C5FD" />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuOptionText}>
                  {serieSeleccionada?.tipo === 'calentamiento' ? 'Convertir en Serie Normal' : 'Marcar como Calentamiento (W)'}
                </Text>
                <Text style={styles.menuOptionSub}>No cuenta para el volumen de hipertrofia</Text>
              </View>
            </Pressable>

            <Pressable style={[styles.menuOption, styles.menuOptionDelete]} onPress={handleEliminar}>
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
              <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Eliminar esta serie</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerCol: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  colSet: {
    width: 38,
    textAlign: 'center',
  },
  colPrevia: {
    width: 66,
    textAlign: 'center',
  },
  colInput: {
    flex: 1,
    textAlign: 'center',
  },
  colRir: {
    width: 44,
    textAlign: 'center',
  },
  colCheckHeader: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colMenuHeader: {
    width: 28,
  },
  seriesList: {
    gap: 8,
  },
  serieBlock: {
    gap: 4,
  },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  serieRowCompletada: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  setNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  setNumWarmup: {
    backgroundColor: 'rgba(147, 197, 253, 0.18)',
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  setNumText: {
    color: '#FFFFFF',
    fontFamily: fuentes.black,
    fontSize: 13,
  },
  colPreviaText: {
    width: 66,
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    textAlign: 'center',
  },
  inputBox: {
    flex: 1,
    height: 42,
    marginHorizontal: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBoxDrop: {
    backgroundColor: 'rgba(124, 243, 255, 0.05)',
    borderColor: 'rgba(124, 243, 255, 0.18)',
  },
  inputBoxActivo: {
    borderColor: '#7CF3FF',
    backgroundColor: 'rgba(124, 243, 255, 0.12)',
  },
  inputText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15,
  },
  inputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.25)',
  },
  parcialesTag: {
    color: '#F59E0B',
    fontSize: 11,
    fontFamily: fuentes.black,
  },
  rirBox: {
    width: 42,
    height: 42,
    marginHorizontal: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirBoxActivo: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  rirText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 14,
  },
  rirPlaceholder: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 3,
  },
  checkButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkButtonDrop: {
    width: 32,
    height: 32,
  },
  menuButton: {
    width: 26,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    paddingLeft: 22,
  },
  dropBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(124, 243, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#7CF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropBadgeText: {
    color: '#7CF3FF',
    fontFamily: fuentes.bold,
    fontSize: 10,
  },
  addSerieWrapper: {
    marginTop: 18,
    paddingHorizontal: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#0F121C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  menuTitle: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  menuOptionText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15,
  },
  menuOptionSub: {
    color: colores.suave,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    marginTop: 2,
  },
  menuOptionDelete: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    paddingTop: 16,
  },
});
