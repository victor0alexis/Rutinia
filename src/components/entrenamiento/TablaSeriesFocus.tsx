import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes, noir } from '../../constantes/colores';
import { vibrarBoton } from '../../utils/haptics';
import { DROPSET_MAX_DROPS, calcularKgSugeridoDrop } from '../../constantes/entrenamiento';

export interface SerieItem {
  id?: string;
  setNum: number;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
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
  esUnilateral?: boolean;
  nombreEjercicio?: string;
  focusCampoActivo?: {
    sIdx: number;
    campo: 'kg' | 'reps' | 'rir' | 'parciales' | 'pesoI' | 'repsI';
    dropIdx?: number;
  } | null;
  onFocusCampo: (sIdx: number, campo: 'kg' | 'reps' | 'rir' | 'parciales' | 'pesoI' | 'repsI', dropIdx?: number) => void;
  onToggleCompletado: (sIdx: number, dropIdx?: number) => void;
  onAnadirSerie: () => void;
  onEliminarSerie: (sIdx: number) => void;
  onActualizarSerie: (sIdx: number, patch: Partial<SerieItem>) => void;
  onIntercambiarEjercicio?: (modo: 'solo_hoy' | 'rutina') => void;
  onToggleUnilateral?: () => void;
}

export default function TablaSeriesFocus({
  series,
  activo = true,
  esUnilateral = false,
  nombreEjercicio,
  focusCampoActivo,
  onFocusCampo,
  onToggleCompletado,
  onAnadirSerie,
  onEliminarSerie,
  onActualizarSerie,
  onIntercambiarEjercicio,
  onToggleUnilateral,
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
  const dropsActuales = serieSeleccionada?.drops || [];
  const puedeAnadirDrop = dropsActuales.length < DROPSET_MAX_DROPS;
  const primeraIncompleta = series.findIndex((s) => !s.completado);

  const handleAnadirDrop = () => {
    if (menuSerieIdx === null || !serieSeleccionada || !puedeAnadirDrop) return;

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

  const handleQuitarDrops = () => {
    if (menuSerieIdx === null) return;
    onActualizarSerie(menuSerieIdx, { drops: [] });
    cerrarMenu();
  };

  const handleToggleParciales = () => {
    if (menuSerieIdx === null || !serieSeleccionada) return;
    const actual = serieSeleccionada.repsParciales || 0;
    const nuevo = actual > 0 ? 0 : 3;
    onActualizarSerie(menuSerieIdx, {
      repsParciales: nuevo,
    });
    if (nuevo > 0) {
      onFocusCampo(menuSerieIdx, 'parciales');
    }
    cerrarMenu();
  };

  const handleCambiarParciales = (delta: number) => {
    if (menuSerieIdx === null || !serieSeleccionada) return;
    const actual = serieSeleccionada.repsParciales || 3;
    const nuevo = Math.max(1, actual + delta);
    onActualizarSerie(menuSerieIdx, {
      repsParciales: nuevo,
    });
  };

  const handleSeleccionarParcialesDirecto = (cant: number) => {
    if (menuSerieIdx === null) return;
    onActualizarSerie(menuSerieIdx, {
      repsParciales: cant,
    });
    onFocusCampo(menuSerieIdx, 'parciales');
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

  const handleIntercambiar = (modo: 'solo_hoy' | 'rutina') => {
    cerrarMenu();
    // Espera a que el sheet termine de cerrarse antes de abrir el selector.
    setTimeout(() => onIntercambiarEjercicio?.(modo), 160);
  };

  const handleEliminar = () => {
    if (menuSerieIdx === null) return;
    onEliminarSerie(menuSerieIdx);
    cerrarMenu();
  };

  return (
    <View style={styles.container}>
      <View style={styles.tableCard}>
        {/* Cabecera de la tabla */}
        <View style={styles.tableHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tableKicker}>REGISTRO DE SERIES</Text>
            <Text style={styles.tableTitle}>Hoy</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {onToggleUnilateral && (
              <Pressable
                onPress={onToggleUnilateral}
                style={[
                  styles.unilateralTogglePill,
                  esUnilateral && styles.unilateralTogglePillActive,
                ]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Cambiar modalidad unilateral o bilateral"
              >
                <Ionicons
                  name={esUnilateral ? 'hand-left-outline' : 'body-outline'}
                  size={9}
                  color={esUnilateral ? noir.mint : 'rgba(255, 255, 255, 0.45)'}
                />
                <Text style={[styles.unilateralToggleText, esUnilateral && styles.unilateralToggleTextActive]}>
                  {esUnilateral ? 'Unilateral D/I' : 'Bilateral'}
                </Text>
              </Pressable>
            )}
            <View style={styles.tableMetaPill}>
              <Ionicons name="layers-outline" size={9} color={noir.lavender} />
              <Text style={styles.tableMetaText}>{series.length} planificadas</Text>
            </View>
          </View>
        </View>

        {/* Encabezado de Columnas */}
        {esUnilateral ? (
          <View style={styles.headerRow}>
            <Text style={[styles.headerCol, styles.colSet]}>SET</Text>
            <Text style={[styles.headerCol, styles.colPrevia]}>PREVIA</Text>
            <Text style={[styles.headerCol, styles.colInput]}>KG-D</Text>
            <Text style={[styles.headerCol, styles.colInput]}>R-D</Text>
            <Text style={[styles.headerCol, styles.colInput]}>KG-I</Text>
            <Text style={[styles.headerCol, styles.colInput]}>R-I</Text>
            <View style={styles.colCheckHeader}>
              <Ionicons name="sparkles" size={11} color={noir.mint} />
            </View>
            <View style={styles.colMenuHeader} />
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={[styles.headerCol, styles.colSet]}>SET</Text>
            <Text style={[styles.headerCol, styles.colPrevia]}>PREVIA</Text>
            <Text style={[styles.headerCol, styles.colInput]}>KG</Text>
            <Text style={[styles.headerCol, styles.colInput]}>REPS</Text>
            <Text style={[styles.headerCol, styles.colRir]}>RIR</Text>
            <View style={styles.colCheckHeader}>
              <Ionicons name="sparkles" size={11} color={noir.mint} />
            </View>
            <View style={styles.colMenuHeader} />
          </View>
        )}

        {/* Filas de Series */}
        <View style={styles.seriesList}>
          {series.map((s, sIdx) => {
            const esFocusKg = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'kg' && focusCampoActivo?.dropIdx === undefined;
            const esFocusReps = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'reps' && focusCampoActivo?.dropIdx === undefined;
            const esFocusParciales = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'parciales' && focusCampoActivo?.dropIdx === undefined;
            const esFocusRir = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'rir' && focusCampoActivo?.dropIdx === undefined;
            const esFocusPesoI = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'pesoI' && focusCampoActivo?.dropIdx === undefined;
            const esFocusRepsI = focusCampoActivo?.sIdx === sIdx && focusCampoActivo?.campo === 'repsI' && focusCampoActivo?.dropIdx === undefined;
            const filaEnfocada = focusCampoActivo?.sIdx === sIdx;
            const esObjetivo = primeraIncompleta === sIdx;
            const tieneParciales = Boolean(s.repsParciales && s.repsParciales > 0);

            // Valores lado izquierdo: si están vacíos se muestra el mismo valor que el lado derecho
            const pesoIDisplay = s.pesoI !== undefined && s.pesoI !== '' ? s.pesoI : s.peso;
            const repsIDisplay = s.repsI !== undefined && s.repsI !== '' ? s.repsI : s.reps;

            return (
              <View key={s.id || `set-${sIdx}`} style={styles.serieBlock}>
                {/* Fila Principal de la Serie */}
                <View
                  style={[
                    styles.serieRow,
                    esObjetivo && styles.serieRowObjetivo,
                    filaEnfocada && styles.serieRowFocus,
                    s.completado && styles.serieRowCompletada,
                  ]}
                >
                  {/* SET NUM */}
                  <View
                    style={[
                      styles.setNumBadge,
                      s.completado && styles.setNumBadgeDone,
                      s.tipo === 'calentamiento' && styles.setNumWarmup,
                    ]}
                  >
                    <Text
                      style={[
                        styles.setNumText,
                        s.completado && styles.setNumTextDone,
                        s.tipo === 'calentamiento' && styles.setNumTextWarmup,
                      ]}
                    >
                      {s.tipo === 'calentamiento'
                        ? 'W'
                        : String(s.setNum).padStart(2, '0')}
                    </Text>
                  </View>

                  {/* CARGA PREVIA */}
                  <Text style={styles.colPreviaText} numberOfLines={1}>
                    {s.previa || '—'}
                  </Text>

                  {esUnilateral ? (
                    // Modo Unilateral: KG-D, REPS-D, KG-I, REPS-I
                    <>
                      {/* INPUT KG DERECHO */}
                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'kg')}
                        style={[styles.inputBox, esFocusKg && styles.inputBoxActivo]}
                      >
                        <Text style={[styles.inputText, !s.peso && styles.inputPlaceholder, esFocusKg && styles.inputTextActivo]}>
                          {s.peso || '0'}
                        </Text>
                      </Pressable>

                      {/* INPUT REPS DERECHO */}
                      <View style={[styles.inputBox, styles.inputBoxRepsGroup, esFocusReps && styles.inputBoxActivo]}>
                        <Pressable onPress={() => onFocusCampo(sIdx, 'reps')} style={styles.repsTouchArea} hitSlop={2}>
                          <Text style={[styles.inputText, !s.reps && styles.inputPlaceholder, esFocusReps && styles.inputTextActivo]}>
                            {s.reps || '0'}
                          </Text>
                        </Pressable>
                        {tieneParciales && (
                          <Pressable
                            onPress={() => onFocusCampo(sIdx, 'parciales')}
                            style={({ pressed }) => [styles.parcialesBadgeTouch, esFocusParciales && styles.parcialesBadgeTouchActivo, pressed && { opacity: 0.7 }]}
                            hitSlop={5}
                          >
                            <Text style={[styles.parcialesTag, esFocusParciales && styles.parcialesTagActivo]}>
                              +{s.repsParciales}p
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      {/* INPUT KG IZQUIERDO */}
                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'pesoI')}
                        style={[styles.inputBox, esFocusPesoI && styles.inputBoxActivo, styles.inputBoxUnilateralI]}
                      >
                        <Text style={[styles.inputText, !s.pesoI && styles.inputPlaceholder, esFocusPesoI && styles.inputTextActivo]}>
                          {pesoIDisplay || '0'}
                        </Text>
                      </Pressable>

                      {/* INPUT REPS IZQUIERDO */}
                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'repsI')}
                        style={[styles.inputBox, esFocusRepsI && styles.inputBoxActivo, styles.inputBoxUnilateralI]}
                      >
                        <Text style={[styles.inputText, !s.repsI && styles.inputPlaceholder, esFocusRepsI && styles.inputTextActivo]}>
                          {repsIDisplay || '0'}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    // Modo Bilateral: KG, REPS, RIR
                    <>
                      {/* INPUT KG */}
                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'kg')}
                        style={[styles.inputBox, esFocusKg && styles.inputBoxActivo]}
                      >
                        <Text
                          style={[
                            styles.inputText,
                            !s.peso && styles.inputPlaceholder,
                            esFocusKg && styles.inputTextActivo,
                          ]}
                        >
                          {s.peso || '0'}
                        </Text>
                      </Pressable>

                      {/* INPUT REPS + PARCIALES INTERACTIVO */}
                      <View
                        style={[
                          styles.inputBox,
                          styles.inputBoxRepsGroup,
                          (esFocusReps || esFocusParciales) && styles.inputBoxActivo,
                          esFocusParciales && styles.inputBoxParcialesActivo,
                        ]}
                      >
                        <Pressable
                          onPress={() => onFocusCampo(sIdx, 'reps')}
                          style={styles.repsTouchArea}
                          hitSlop={2}
                        >
                          <Text
                            style={[
                              styles.inputText,
                              !s.reps && styles.inputPlaceholder,
                              esFocusReps && styles.inputTextActivo,
                            ]}
                          >
                            {s.reps || '0'}
                          </Text>
                        </Pressable>

                        {tieneParciales && (
                          <Pressable
                            onPress={() => onFocusCampo(sIdx, 'parciales')}
                            style={({ pressed }) => [
                              styles.parcialesBadgeTouch,
                              esFocusParciales && styles.parcialesBadgeTouchActivo,
                              pressed && { opacity: 0.7 },
                            ]}
                            hitSlop={5}
                          >
                            <Text
                              style={[
                                styles.parcialesTag,
                                esFocusParciales && styles.parcialesTagActivo,
                              ]}
                            >
                              +{s.repsParciales}p
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      {/* INPUT RIR */}
                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'rir')}
                        style={[styles.rirBox, esFocusRir && styles.rirBoxActivo]}
                      >
                        <Text
                          style={[
                            styles.rirText,
                            !s.rir && styles.rirPlaceholder,
                            esFocusRir && styles.rirTextActivo,
                          ]}
                        >
                          {s.rir !== undefined && s.rir !== '' ? s.rir : '—'}
                        </Text>
                      </Pressable>
                    </>
                  )}

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
                      size={15}
                      color={s.completado ? '#06120D' : 'rgba(255, 255, 255, 0.4)'}
                    />
                  </Pressable>

                  {/* BOTÓN MENÜ ⋯ */}
                  <Pressable
                    onPress={() => abrirMenu(sIdx)}
                    style={styles.menuButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={15}
                      color="rgba(255, 255, 255, 0.45)"
                    />
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
                        <Text
                          style={[
                            styles.inputText,
                            !drop.peso && styles.inputPlaceholder,
                            esFocusDropKg && styles.inputTextActivo,
                          ]}
                        >
                          {drop.peso || '0'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => onFocusCampo(sIdx, 'reps', dIdx)}
                        style={[styles.inputBox, styles.inputBoxDrop, esFocusDropReps && styles.inputBoxActivo]}
                      >
                        <Text
                          style={[
                            styles.inputText,
                            !drop.reps && styles.inputPlaceholder,
                            esFocusDropReps && styles.inputTextActivo,
                          ]}
                        >
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
                          size={13}
                          color={drop.completado ? '#06120D' : 'rgba(255, 255, 255, 0.4)'}
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

        {/* Añadir serie: acción secundaria de cristal, sin competir con el dock */}
        <Pressable
          onPress={() => {
            vibrarBoton(12);
            onAnadirSerie();
          }}
          style={({ pressed }) => [
            styles.addSerieButton,
            pressed && styles.addSerieButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir serie"
        >
          <Ionicons name="add" size={14} color={noir.info} />
          <Text style={styles.addSerieText}>Añadir serie</Text>
        </Pressable>
      </View>

      {/* Menú Contextual Desplegable para la Serie */}
      <Modal
        visible={menuSerieIdx !== null}
        animationType="fade"
        transparent
        onRequestClose={cerrarMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={cerrarMenu}>
          <Pressable
            style={styles.menuSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.menuHandle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.menuScrollContent}
            >
              <View style={styles.menuHeader}>
                <Text style={styles.menuKicker}>
                  SERIE {String(serieSeleccionada?.setNum || 0).padStart(2, '0')}
                </Text>
                <Text style={styles.menuTitle}>Opciones de la serie</Text>
                {Boolean(nombreEjercicio) && (
                  <Text style={styles.menuSubtitle} numberOfLines={1}>
                    {nombreEjercicio}
                  </Text>
                )}
              </View>

              <Text style={styles.menuSectionLabel}>TÉCNICA</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.menuOption,
                  !puedeAnadirDrop && styles.menuOptionDisabled,
                  pressed && puedeAnadirDrop && { opacity: 0.72 },
                ]}
                onPress={handleAnadirDrop}
                disabled={!puedeAnadirDrop}
              >
                <View style={[styles.menuIconBox, styles.menuIconInfo]}>
                  <Ionicons name="arrow-down-circle-outline" size={18} color={noir.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuOptionText}>
                    {puedeAnadirDrop
                      ? dropsActuales.length > 0
                        ? `Añadir otro Drop Set (${dropsActuales.length}/${DROPSET_MAX_DROPS})`
                        : 'Añadir Drop Set'
                      : 'Drop Set completo'}
                  </Text>
                  <Text style={styles.menuOptionSub}>
                    Disminuye el peso al fallo sin descanso
                  </Text>
                </View>
              </Pressable>

              {dropsActuales.length > 0 && (
                <Pressable style={styles.menuOption} onPress={handleQuitarDrops}>
                  <View style={[styles.menuIconBox, styles.menuIconDanger]}>
                    <Ionicons name="remove-circle-outline" size={18} color="#F08A9B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuOptionText}>Quitar Drop Set</Text>
                    <Text style={styles.menuOptionSub}>
                      Vuelve a una serie convencional
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Opción Reps Parciales Configurable */}
              <View style={styles.menuConfigBox}>
                <View style={styles.menuConfigHeader}>
                  <View style={[styles.menuIconBox, styles.menuIconChamp]}>
                    <Ionicons name="flash-outline" size={18} color={noir.champagne} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuOptionText}>
                      {serieSeleccionada?.repsParciales
                        ? `Reps Parciales (+${serieSeleccionada.repsParciales}p)`
                        : 'Añadir Reps Parciales (+p)'}
                    </Text>
                    <Text style={styles.menuOptionSub}>
                      Repeticiones tras el fallo muscular
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleToggleParciales}
                    style={[
                      styles.switchBadge,
                      serieSeleccionada?.repsParciales
                        ? styles.switchBadgeActivo
                        : styles.switchBadgeInactivo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.switchBadgeText,
                        Boolean(serieSeleccionada?.repsParciales) && styles.switchBadgeTextActivo,
                      ]}
                    >
                      {serieSeleccionada?.repsParciales ? 'ACTIVADO' : 'AÑADIR'}
                    </Text>
                  </Pressable>
                </View>

                {Boolean(serieSeleccionada?.repsParciales && serieSeleccionada.repsParciales > 0) && (
                  <View style={styles.parcialesConfigRow}>
                    <View style={styles.parcialesStepper}>
                      <Pressable
                        onPress={() => handleCambiarParciales(-1)}
                        style={styles.stepperBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={15} color={noir.text} />
                      </Pressable>
                      <Text style={styles.stepperValue}>
                        +{serieSeleccionada?.repsParciales}p
                      </Text>
                      <Pressable
                        onPress={() => handleCambiarParciales(1)}
                        style={styles.stepperBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={15} color={noir.text} />
                      </Pressable>
                    </View>

                    <View style={styles.parcialesChipsRow}>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <Pressable
                          key={num}
                          onPress={() => handleSeleccionarParcialesDirecto(num)}
                          style={[
                            styles.chipParcial,
                            serieSeleccionada?.repsParciales === num && styles.chipParcialActivo,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipParcialText,
                              serieSeleccionada?.repsParciales === num && styles.chipParcialTextActivo,
                            ]}
                          >
                            +{num}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <Pressable style={styles.menuOption} onPress={handleToggleCalentamiento}>
                <View style={[styles.menuIconBox, styles.menuIconLav]}>
                  <Ionicons name="flame-outline" size={18} color={noir.lavender} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuOptionText}>
                    {serieSeleccionada?.tipo === 'calentamiento'
                      ? 'Convertir en Serie Normal'
                      : 'Marcar como Calentamiento (W)'}
                  </Text>
                  <Text style={styles.menuOptionSub}>
                    No cuenta para el volumen de hipertrofia
                  </Text>
                </View>
              </Pressable>

              {Boolean(onIntercambiarEjercicio) && (
                <>
                  <Text style={styles.menuSectionLabel}>EJERCICIO</Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.menuOption,
                      styles.menuOptionSwap,
                      pressed && { opacity: 0.72 },
                    ]}
                    onPress={() => handleIntercambiar('solo_hoy')}
                  >
                    <View style={[styles.menuIconBox, styles.menuIconInfo]}>
                      <Ionicons name="swap-horizontal" size={18} color={noir.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionText}>Intercambiar solo hoy</Text>
                      <Text style={styles.menuOptionSub}>
                        Sustituye este ejercicio únicamente en la sesión actual
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={noir.muted2} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.menuOption,
                      styles.menuOptionRoutine,
                      pressed && { opacity: 0.72 },
                    ]}
                    onPress={() => handleIntercambiar('rutina')}
                  >
                    <View style={[styles.menuIconBox, styles.menuIconLav]}>
                      <Ionicons name="repeat" size={18} color={noir.lavender} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionText}>Intercambiar en la rutina</Text>
                      <Text style={styles.menuOptionSub}>
                        Cambio definitivo para las próximas sesiones
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={noir.muted2} />
                  </Pressable>
                </>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.menuOption,
                  styles.menuOptionDelete,
                  pressed && { opacity: 0.72 },
                ]}
                onPress={handleEliminar}
              >
                <View style={[styles.menuIconBox, styles.menuIconDanger]}>
                  <Ionicons name="trash-outline" size={18} color="#F08A9B" />
                </View>
                <Text style={[styles.menuOptionText, { color: '#F08A9B' }]}>
                  Eliminar esta serie
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  tableCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    backgroundColor: 'rgba(10, 12, 17, 0.78)',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 5,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  tableKicker: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7.4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableTitle: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 15,
    letterSpacing: -0.25,
    marginTop: 1,
  },
  tableMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 21,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(179, 148, 255, 0.065)',
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.22)',
  },
  tableMetaText: {
    color: '#E6DCFF',
    fontFamily: fuentes.bold,
    fontSize: 7.2,
    letterSpacing: 0.15,
  },
  unilateralTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 21,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  unilateralTogglePillActive: {
    backgroundColor: 'rgba(63, 242, 176, 0.1)',
    borderColor: 'rgba(63, 242, 176, 0.32)',
  },
  unilateralToggleText: {
    fontFamily: fuentes.bold,
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.15,
  },
  unilateralToggleTextActive: {
    color: noir.mint,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  headerCol: {
    color: 'rgba(255, 255, 255, 0.38)',
    fontFamily: fuentes.bold,
    fontSize: 7.4,
    letterSpacing: 0.55,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  colSet: {
    width: 36,
    textAlign: 'center',
  },
  colPrevia: {
    width: 54,
    textAlign: 'center',
  },
  colInput: {
    flex: 1,
    textAlign: 'center',
  },
  colRir: {
    width: 38,
    textAlign: 'center',
  },
  colCheckHeader: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colMenuHeader: {
    width: 24,
  },
  seriesList: {
    gap: 5,
  },
  serieBlock: {
    gap: 4,
  },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.035)',
    backgroundColor: 'rgba(255, 255, 255, 0.022)',
  },
  serieRowObjetivo: {
    borderColor: 'rgba(92, 200, 255, 0.16)',
    backgroundColor: 'rgba(92, 200, 255, 0.025)',
  },
  serieRowFocus: {
    borderColor: 'rgba(92, 200, 255, 0.26)',
    backgroundColor: 'rgba(92, 200, 255, 0.04)',
  },
  serieRowCompletada: {
    borderColor: 'rgba(63, 242, 176, 0.15)',
    backgroundColor: 'rgba(63, 242, 176, 0.04)',
  },
  setNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  setNumBadgeDone: {
    backgroundColor: 'rgba(63, 242, 176, 0.14)',
    borderColor: 'rgba(63, 242, 176, 0.32)',
  },
  setNumWarmup: {
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    borderColor: 'rgba(255, 209, 102, 0.36)',
  },
  setNumText: {
    color: noir.platinum,
    fontFamily: fuentes.black,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  setNumTextDone: {
    color: noir.mint,
  },
  setNumTextWarmup: {
    color: noir.champagne,
  },
  colPreviaText: {
    width: 54,
    color: 'rgba(255, 255, 255, 0.36)',
    fontFamily: fuentes.medium,
    fontSize: 9.5,
    textAlign: 'center',
  },
  inputBox: {
    flex: 1,
    height: 38,
    marginHorizontal: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBoxDrop: {
    backgroundColor: 'rgba(92, 200, 255, 0.035)',
    borderColor: 'rgba(92, 200, 255, 0.14)',
  },
  inputBoxUnilateralI: {
    backgroundColor: 'rgba(179, 148, 255, 0.06)',
    borderColor: 'rgba(179, 148, 255, 0.18)',
  },
  inputBoxActivo: {
    borderColor: 'rgba(92, 200, 255, 0.7)',
    backgroundColor: 'rgba(92, 200, 255, 0.1)',
  },
  inputText: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  inputTextActivo: {
    color: '#C9F1FF',
  },
  inputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.22)',
  },
  inputBoxRepsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  inputBoxParcialesActivo: {
    borderColor: 'rgba(255, 209, 102, 0.65)',
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
  },
  repsTouchArea: {
    paddingHorizontal: 2,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcialesBadgeTouch: {
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.3)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 5,
    marginLeft: 2,
  },
  parcialesBadgeTouchActivo: {
    backgroundColor: 'rgba(255, 209, 102, 0.24)',
    borderColor: 'rgba(255, 209, 102, 0.7)',
  },
  parcialesTag: {
    color: noir.champagne,
    fontSize: 8.5,
    fontFamily: fuentes.black,
  },
  parcialesTagActivo: {
    color: '#FFE6A8',
    fontFamily: fuentes.black,
  },
  rirBox: {
    width: 36,
    height: 38,
    marginHorizontal: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.065)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirBoxActivo: {
    borderColor: 'rgba(179, 148, 255, 0.65)',
    backgroundColor: 'rgba(179, 148, 255, 0.1)',
  },
  rirText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  rirTextActivo: {
    color: '#E6DCFF',
  },
  rirPlaceholder: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  checkButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    marginLeft: 2,
  },
  checkButtonActive: {
    backgroundColor: noir.mint,
    borderColor: noir.mint,
  },
  checkButtonDrop: {
    width: 30,
    height: 30,
  },
  menuButton: {
    width: 24,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    paddingLeft: 18,
    marginLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(92, 200, 255, 0.18)',
  },
  dropBadge: {
    width: 23,
    height: 23,
    borderRadius: 6,
    backgroundColor: 'rgba(92, 200, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dropBadgeText: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
  },
  addSerieButton: {
    marginTop: 12,
    marginHorizontal: 6,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.13)',
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addSerieButtonPressed: {
    backgroundColor: 'rgba(92, 200, 255, 0.06)',
    borderColor: 'rgba(92, 200, 255, 0.3)',
  },
  addSerieText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0.15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    maxHeight: '90%',
    backgroundColor: noir.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  menuHandle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 2,
  },
  menuScrollContent: {
    padding: 18,
    paddingBottom: 34,
    gap: 9,
  },
  menuHeader: {
    marginBottom: 2,
  },
  menuKicker: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  menuTitle: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 18,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  menuSubtitle: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 10,
    marginTop: 1,
  },
  menuSectionLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.4,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    marginTop: 4,
    marginLeft: 3,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.045)',
    backgroundColor: 'rgba(255, 255, 255, 0.022)',
  },
  menuOptionDisabled: {
    opacity: 0.45,
  },
  menuOptionSwap: {
    borderColor: 'rgba(92, 200, 255, 0.12)',
    backgroundColor: 'rgba(92, 200, 255, 0.035)',
  },
  menuOptionRoutine: {
    borderColor: 'rgba(179, 148, 255, 0.12)',
    backgroundColor: 'rgba(179, 148, 255, 0.035)',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuIconInfo: {
    backgroundColor: 'rgba(92, 200, 255, 0.075)',
    borderColor: 'rgba(92, 200, 255, 0.18)',
  },
  menuIconChamp: {
    backgroundColor: 'rgba(255, 209, 102, 0.075)',
    borderColor: 'rgba(255, 209, 102, 0.18)',
  },
  menuIconLav: {
    backgroundColor: 'rgba(179, 148, 255, 0.075)',
    borderColor: 'rgba(179, 148, 255, 0.18)',
  },
  menuIconDanger: {
    backgroundColor: 'rgba(240, 138, 155, 0.075)',
    borderColor: 'rgba(240, 138, 155, 0.18)',
  },
  menuOptionText: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  menuOptionSub: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 1,
  },
  menuOptionDelete: {
    marginTop: 5,
    borderColor: 'rgba(240, 138, 155, 0.13)',
    backgroundColor: 'rgba(240, 138, 155, 0.035)',
  },
  menuConfigBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
    gap: 9,
  },
  menuConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  switchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  switchBadgeActivo: {
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
    borderColor: 'rgba(255, 209, 102, 0.45)',
  },
  switchBadgeInactivo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchBadgeText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: fuentes.bold,
    fontSize: 7.4,
    letterSpacing: 0.35,
  },
  switchBadgeTextActivo: {
    color: noir.champagne,
  },
  parcialesConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  parcialesStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.22)',
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 5,
  },
  stepperBtn: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: noir.champagne,
    fontFamily: fuentes.black,
    fontSize: 13,
    minWidth: 32,
    textAlign: 'center',
  },
  parcialesChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  chipParcial: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipParcialActivo: {
    backgroundColor: 'rgba(255, 209, 102, 0.17)',
    borderColor: 'rgba(255, 209, 102, 0.55)',
  },
  chipParcialText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: fuentes.bold,
    fontSize: 10,
  },
  chipParcialTextActivo: {
    color: noir.champagne,
  },
});
