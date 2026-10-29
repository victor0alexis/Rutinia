import { styles } from './ResumenEntrenamientoModal.estilos';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import FondoPantalla from '../comunes/FondoPantalla';
import TextoBrillante from '../efectos/TextoBrillante';
import { BotonMetalLiquido } from '../efectos/BotonMetalLiquido';
import { formatearTiempoTexto } from '../../utilidades/temporizador';
import { useLayout } from '../../hooks/useLayout';
export type SerieResumen = {
  peso: string;
  reps: string;
  pesoI: string;
  repsI: string;
  rir: string;
  nota: string;
};
export type EjercicioResumen = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  seriesTotal: number;
  seriesCompletadas: number;
  pesoMaximo: number;
  repsMaximas: number;
  tieneSobrecarga: boolean;
  notaEjercicio: string;
  series: SerieResumen[];
};
export type EjercicioEdicionResumen = {
  id: string;
  notaEjercicio: string;
  series: SerieResumen[];
};
export type EdicionResumen = {
  notasSesion: string;
  ejercicios: EjercicioEdicionResumen[];
};
type Props = {
  visible: boolean;
  nombreRutina: string;
  fechaTexto: string;
  segundosTranscurridos: number;
  totalSeriesEnSesion: number;
  totalSeriesCompletadas: number;
  volumenTotalKg: number;
  ejerciciosResumen: EjercicioResumen[];
  notasSesion: string;
  onChangeNotasSesion: (text: string) => void;
  guardando: boolean;
  onClose: () => void; // Volver a editar o cerrar
  onConfirmarGuardar: () => void;
  onDescartarSesion: () => void;
  esSoloLectura?: boolean;
  onGuardarEdiciones?: (edicion: EdicionResumen) => Promise<void> | void;
};
export default function ResumenEntrenamientoModal({
  visible,
  nombreRutina,
  fechaTexto,
  segundosTranscurridos,
  totalSeriesEnSesion,
  totalSeriesCompletadas,
  volumenTotalKg,
  ejerciciosResumen,
  notasSesion,
  onChangeNotasSesion,
  guardando,
  onClose,
  onConfirmarGuardar,
  onDescartarSesion,
  esSoloLectura = false,
  onGuardarEdiciones,
}: Props) {
  const { topInset, barBottomPadding, leftInset, rightInset, gutter, contentMaxWidth } = useLayout();
  const [modoEdicion, setModoEdicion] = useState(false);
  const [ejercicioEditando, setEjercicioEditando] = useState<string | null>(null);
  const [notaDraft, setNotaDraft] = useState(notasSesion);
  const [ejerciciosDraft, setEjerciciosDraft] = useState<EjercicioEdicionResumen[]>([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const porcentajeProgreso =
    totalSeriesEnSesion > 0
      ? Math.round((totalSeriesCompletadas / totalSeriesEnSesion) * 100)
      : 0;
  const totalSobrecargas = ejerciciosResumen.filter((e) => e.tieneSobrecarga).length;
  const totalEjerciciosCompletados = ejerciciosResumen.filter(
    (e) => e.seriesCompletadas >= e.seriesTotal
  ).length;
  const handleDescartar = () => {
    Alert.alert(
      '¿Descartar Entrenamiento?',
      'Se borrarán los datos ingresados en esta sesión y no se guardará el registro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, descartar',
          style: 'destructive',
          onPress: onDescartarSesion,
        },
      ]
    );
  };
  const iniciarEdicion = () => {
    setNotaDraft(notasSesion);
    setEjerciciosDraft(
      ejerciciosResumen.map((ej) => ({
        id: ej.id,
        notaEjercicio: ej.notaEjercicio || '',
        series: ej.series.map((serie) => ({ ...serie })),
      }))
    );
    setEjercicioEditando(ejerciciosResumen[0]?.id || null);
    setModoEdicion(true);
  };
  const cancelarEdicion = () => {
    setModoEdicion(false);
    setEjercicioEditando(null);
    setNotaDraft(notasSesion);
    setEjerciciosDraft([]);
  };
  const handleEditar = () => {
    if (!esSoloLectura) {
      onClose();
      return;
    }
    if (modoEdicion) {
      cancelarEdicion();
    } else {
      iniciarEdicion();
    }
  };
  const actualizarSerieDraft = (
    ejercicioId: string,
    serieIdx: number,
    campo: keyof SerieResumen,
    valor: string
  ) => {
    setEjerciciosDraft((prev) =>
      prev.map((ej) =>
        ej.id !== ejercicioId
          ? ej
          : {
              ...ej,
              series: ej.series.map((serie, idx) =>
                idx === serieIdx ? { ...serie, [campo]: valor } : serie
              ),
            }
      )
    );
  };
  const actualizarNotaEjercicioDraft = (ejercicioId: string, valor: string) => {
    setEjerciciosDraft((prev) =>
      prev.map((ej) => (ej.id === ejercicioId ? { ...ej, notaEjercicio: valor } : ej))
    );
  };
  const handleGuardarEdicion = async () => {
    if (!onGuardarEdiciones || guardandoEdicion) return;
    try {
      setGuardandoEdicion(true);
      await onGuardarEdiciones({
        notasSesion: notaDraft,
        ejercicios: ejerciciosDraft,
      });
      setModoEdicion(false);
      setEjercicioEditando(null);
    } catch (error: any) {
      Alert.alert(
        'No se pudieron guardar los cambios',
        error?.message || 'Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };
  const ejerciciosVista = useMemo(() => {
    if (!modoEdicion) return ejerciciosResumen;
    return ejerciciosResumen.map((ej) => {
      const draft = ejerciciosDraft.find((item) => item.id === ej.id);
      return draft
        ? { ...ej, notaEjercicio: draft.notaEjercicio, series: draft.series }
        : ej;
    });
  }, [ejerciciosResumen, ejerciciosDraft, modoEdicion]);
  const notasPorEjercicio = useMemo(
    () =>
      ejerciciosVista
        .map((ej) => ({
          id: ej.id,
          nombre: ej.nombre,
          nota: ej.notaEjercicio?.trim() || '',
          seriesNotas: ej.series
            .map((serie, idx) => ({ idx, nota: serie.nota?.trim() || '' }))
            .filter((serie) => Boolean(serie.nota)),
        }))
        .filter((ej) => Boolean(ej.nota) || ej.seriesNotas.length > 0),
    [ejerciciosVista]
  );
  if (!visible) return null;
  return (
    <KeyboardAvoidingView
      style={styles.overlayContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    >
      <FondoPantalla>
        <View style={styles.outer}>
          <View
            style={[
              styles.container,
              {
                width: '100%',
                maxWidth: contentMaxWidth,
                alignSelf: 'center',
                paddingTop: Math.max(12, topInset),
                paddingLeft: Math.max(gutter, leftInset),
                paddingRight: Math.max(gutter, rightInset),
              },
            ]}
          >
            {/* Barra superior */}
            <View style={styles.topBar}>
              <Pressable
                onPress={onClose}
                style={styles.closeIconButton}
                hitSlop={8}
                accessibilityLabel="Cerrar resumen"
              >
                <Ionicons name="chevron-down" size={18} color={noir.platinum} />
              </Pressable>
              <View style={styles.topCenter}>
                <Text style={styles.topKicker}>RESUMEN</Text>
                <Text style={styles.topSubtext} numberOfLines={1}>
                  {fechaTexto}
                </Text>
              </View>
              <Pressable
                onPress={handleEditar}
                disabled={guardando || guardandoEdicion}
                style={({ pressed }) => [
                  styles.editPill,
                  modoEdicion && styles.editPillActive,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel={modoEdicion ? 'Cancelar edición' : 'Editar resumen'}
              >
                <Ionicons
                  name={modoEdicion ? 'close' : 'create-outline'}
                  size={11}
                  color={modoEdicion ? noir.champagne : noir.info}
                />
                <Text style={[styles.editPillText, modoEdicion && styles.editPillTextActive]}>
                  {modoEdicion ? 'Cancelar' : 'Editar'}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                modoEdicion && { paddingBottom: 190 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Hero de sesión completada */}
              <LinearGradient
                colors={['rgba(24, 27, 35, 0.96)', 'rgba(9, 11, 16, 0.98)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroGlow} />
                <View style={styles.trophyOrb}>
                  <Ionicons name="trophy" size={24} color={noir.champagne} />
                </View>
                <Text style={styles.heroKicker}>ENTRENAMIENTO COMPLETADO</Text>
                <View style={styles.heroTitleWrap}>
                  <TextoBrillante
                    text={nombreRutina}
                    color={noir.platinum}
                    shineColor="#FFFFFF"
                    speed={2.4}
                    fontSize={24}
                    fontFamily={fuentes.black}
                    align="left"
                    width="100%"
                    height={32}
                  />
                </View>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {totalSeriesCompletadas} de {totalSeriesEnSesion} series ·{' '}
                  {totalEjerciciosCompletados}/{ejerciciosResumen.length} ejercicios completados
                </Text>
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark-circle" size={10} color={noir.mint} />
                  <Text style={styles.doneBadgeText}>Registro listo</Text>
                </View>
                <View style={styles.heroProgressTrack}>
                  <LinearGradient
                    colors={[noir.mint, noir.info, noir.pearl]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.heroProgressFill, { width: `${porcentajeProgreso}%` }]}
                  />
                </View>
                <View style={styles.heroProgressMeta}>
                  <Text style={styles.heroProgressPct}>{porcentajeProgreso}% completado</Text>
                  <Text style={styles.heroProgressPr}>
                    {totalSobrecargas} {totalSobrecargas === 1 ? 'PR' : 'PRs'}
                  </Text>
                </View>
              </LinearGradient>
              {/* Métricas de la sesión */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, styles.metricIconChamp]}>
                    <Ionicons name="time-outline" size={15} color={noir.champagne} />
                  </View>
                  <Text style={styles.metricValue}>
                    {segundosTranscurridos > 0
                      ? formatearTiempoTexto(segundosTranscurridos)
                      : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>DURACIÓN</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, styles.metricIconMint]}>
                    <Ionicons name="checkmark-done" size={15} color={noir.mint} />
                  </View>
                  <Text style={styles.metricValue}>
                    {totalSeriesCompletadas}/{totalSeriesEnSesion}
                  </Text>
                  <Text style={styles.metricLabel}>SERIES</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, styles.metricIconLav]}>
                    <Ionicons name="barbell-outline" size={15} color={noir.lavender} />
                  </View>
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {volumenTotalKg > 0 ? `${volumenTotalKg.toLocaleString()} kg` : '0 kg'}
                  </Text>
                  <Text style={styles.metricLabel}>VOLUMEN</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, styles.metricIconInfo]}>
                    <Ionicons name="flame-outline" size={15} color={noir.info} />
                  </View>
                  <Text style={styles.metricValue}>
                    {totalSobrecargas}
                  </Text>
                  <Text style={styles.metricLabel}>SOBRECARGAS</Text>
                </View>
              </View>
              {/* Desglose por ejercicio */}
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionKicker}>DESGLOSE</Text>
                    <Text style={styles.sectionTitle}>Ejercicios de la sesión</Text>
                  </View>
                  <View style={styles.sectionCountPill}>
                    <Text style={styles.sectionCountText}>{ejerciciosResumen.length}</Text>
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  {ejerciciosVista.map((ej, idx) => {
                    const completo = ej.seriesCompletadas >= ej.seriesTotal;
                    const draft = ejerciciosDraft.find((item) => item.id === ej.id);
                    const abierto = modoEdicion && ejercicioEditando === ej.id;
                    return (
                      <View key={ej.id} style={{ gap: 6 }}>
                        <Pressable
                          onPress={() => {
                            if (!modoEdicion) return;
                            setEjercicioEditando(abierto ? null : ej.id);
                          }}
                          disabled={!modoEdicion}
                          style={({ pressed }) => [
                            styles.exerciseSummaryRow,
                            modoEdicion && styles.exerciseSummaryRowEditing,
                            pressed && modoEdicion && { opacity: 0.82 },
                          ]}
                        >
                          <View
                            style={[
                              styles.exerciseIndexBadge,
                              completo && styles.exerciseIndexBadgeDone,
                            ]}
                          >
                            <Text
                              style={[
                                styles.exerciseIndexText,
                                completo && styles.exerciseIndexTextDone,
                              ]}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.exerciseNameRow}>
                              <Text style={styles.exerciseNameText} numberOfLines={1}>
                                {ej.nombre}
                              </Text>
                              {ej.esUnilateral && (
                                <View style={styles.unilateralBadge}>
                                  <Text style={styles.unilateralBadgeText}>D/I</Text>
                                </View>
                              )}
                              {ej.tieneSobrecarga && (
                                <View style={styles.prBadge}>
                                  <Ionicons name="trending-up" size={8} color={noir.champagne} />
                                  <Text style={styles.prBadgeText}>PR</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.exerciseSubRow}>
                              <Text style={styles.exerciseSubDetail}>
                                Series{' '}
                                <Text style={styles.exerciseSubValue}>
                                  {ej.seriesCompletadas}/{ej.seriesTotal}
                                </Text>
                              </Text>
                              {ej.pesoMaximo > 0 && (
                                <Text style={styles.exerciseSubDetail}>
                                  Máx{' '}
                                  <Text style={styles.exerciseSubValueAccent}>
                                    {ej.pesoMaximo} kg × {ej.repsMaximas}
                                  </Text>
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.exerciseCheck}>
                            {modoEdicion ? (
                              <Ionicons
                                name={abierto ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={noir.info}
                              />
                            ) : (
                              <Ionicons
                                name={completo ? 'checkmark-circle' : 'ellipse-outline'}
                                size={18}
                                color={completo ? noir.mint : noir.muted2}
                              />
                            )}
                          </View>
                        </Pressable>
                        {abierto && draft && (
                          <View style={styles.editBox}>
                            <View style={styles.editBoxHeader}>
                              <Ionicons name="create-outline" size={11} color={noir.info} />
                              <Text style={styles.editBoxTitle}>EDITAR {ej.nombre.toUpperCase()}</Text>
                            </View>
                            <TextInput
                              placeholder="Nota de este ejercicio (máquina, altura, sensaciones...)"
                              placeholderTextColor="rgba(255, 255, 255, 0.26)"
                              multiline
                              value={draft.notaEjercicio}
                              onChangeText={(valor) => actualizarNotaEjercicioDraft(ej.id, valor)}
                              textAlignVertical="top"
                              style={styles.editExerciseNoteInput}
                            />
                            {draft.series.map((serie, sIdx) => (
                              <View key={`${ej.id}-serie-${sIdx}`} style={styles.editSerieBlock}>
                                <View style={styles.editSerieHeader}>
                                  <View style={styles.editSerieBadge}>
                                    <Text style={styles.editSerieBadgeText}>S{sIdx + 1}</Text>
                                  </View>
                                  <Text style={styles.editSerieHint}>
                                    Ajusta solo los datos de esta serie
                                  </Text>
                                </View>
                                {ej.esUnilateral ? (
                                  <View style={styles.editFieldsGrid}>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>D · KG</Text>
                                      <TextInput
                                        value={serie.peso}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'peso', valor)}
                                        placeholder="kg"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="decimal-pad"
                                        inputMode="decimal"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>D · REPS</Text>
                                      <TextInput
                                        value={serie.reps}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'reps', valor)}
                                        placeholder="reps"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>I · KG</Text>
                                      <TextInput
                                        value={serie.pesoI}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'pesoI', valor)}
                                        placeholder="kg"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="decimal-pad"
                                        inputMode="decimal"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>I · REPS</Text>
                                      <TextInput
                                        value={serie.repsI}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'repsI', valor)}
                                        placeholder="reps"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>RIR</Text>
                                      <TextInput
                                        value={serie.rir}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'rir', valor)}
                                        placeholder="—"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.editFieldsGrid}>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>KG</Text>
                                      <TextInput
                                        value={serie.peso}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'peso', valor)}
                                        placeholder="kg"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="decimal-pad"
                                        inputMode="decimal"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>REPS</Text>
                                      <TextInput
                                        value={serie.reps}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'reps', valor)}
                                        placeholder="reps"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                    <View style={styles.editField}>
                                      <Text style={styles.editFieldLabel}>RIR</Text>
                                      <TextInput
                                        value={serie.rir}
                                        onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'rir', valor)}
                                        placeholder="—"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        style={styles.editFieldInput}
                                      />
                                    </View>
                                  </View>
                                )}
                                <TextInput
                                  value={serie.nota}
                                  onChangeText={(valor) => actualizarSerieDraft(ej.id, sIdx, 'nota', valor)}
                                  placeholder="Observación de esta serie (opcional)"
                                  placeholderTextColor="rgba(255,255,255,0.25)"
                                  style={styles.editSerieNoteInput}
                                />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
              {/* Insight de progreso */}
              <View style={styles.insightRow}>
                <View style={styles.insightIcon}>
                  <Ionicons
                    name={totalSobrecargas > 0 ? 'sparkles' : 'leaf-outline'}
                    size={14}
                    color={totalSobrecargas > 0 ? noir.champagne : noir.mint}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>
                    {totalSobrecargas > 0
                      ? `+${totalSobrecargas} ${totalSobrecargas === 1 ? 'récord personal' : 'récords personales'}`
                      : 'Sesión registrada'}
                  </Text>
                  <Text style={styles.insightSub}>
                    {totalSobrecargas > 0
                      ? 'Frente a tu última sesión. Sigue así.'
                      : 'Una base más para la próxima sobrecarga.'}
                  </Text>
                </View>
              </View>
              {/* Notas finales */}
              <View style={styles.notesCard}>
                <View style={styles.notesHeader}>
                  <View style={styles.notesIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={noir.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notesKicker}>SENSACIONES</Text>
                    <Text style={styles.notesTitle}>Notas de la sesión</Text>
                  </View>
                  <View style={styles.notesSmart}>
                    <Ionicons name="sparkles" size={8} color={noir.champagne} />
                    <Text style={styles.notesSmartText}>Smart</Text>
                  </View>
                </View>
                <TextInput
                  placeholder={
                    esSoloLectura && !modoEdicion
                      ? 'Sin notas registradas en esta sesión'
                      : 'Añade sensaciones finales, nivel de energía o apuntes de esta sesión...'
                  }
                  placeholderTextColor="rgba(255, 255, 255, 0.26)"
                  multiline
                  numberOfLines={3}
                  value={modoEdicion ? notaDraft : notasSesion}
                  onChangeText={(texto) => {
                    if (modoEdicion) {
                      setNotaDraft(texto);
                    } else {
                      onChangeNotasSesion(texto);
                    }
                  }}
                  editable={!esSoloLectura || modoEdicion}
                  inputMode="text"
                  keyboardType="default"
                  autoCapitalize="sentences"
                  autoCorrect={true}
                  textAlignVertical="top"
                  style={styles.notesInput}
                />
                {notasPorEjercicio.length > 0 ? (
                  <View style={styles.exerciseNotesBox}>
                    <View style={styles.exerciseNotesHeader}>
                      <Ionicons name="barbell-outline" size={11} color={noir.lavender} />
                      <Text style={styles.exerciseNotesTitle}>NOTAS POR EJERCICIO</Text>
                    </View>
                    {notasPorEjercicio.map((ej) => (
                      <View key={`nota-ejercicio-${ej.id}`} style={styles.exerciseNoteItem}>
                        <Text style={styles.exerciseNoteName}>{ej.nombre}</Text>
                        {ej.nota ? (
                          <Text style={styles.exerciseNoteBody}>{ej.nota}</Text>
                        ) : null}
                        {ej.seriesNotas.map((serie) => (
                          <View key={`nota-serie-${ej.id}-${serie.idx}`} style={styles.exerciseNoteSerieRow}>
                            <View style={styles.exerciseNoteSerieTag}>
                              <Text style={styles.exerciseNoteSerieTagText}>S{serie.idx + 1}</Text>
                            </View>
                            <Text style={styles.exerciseNoteBody}>{serie.nota}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.exerciseNotesEmpty}>
                    {modoEdicion
                      ? 'Abre un ejercicio del desglose para añadir su nota.'
                      : 'Sin notas de ejercicio. Usa Editar para añadir una.'}
                  </Text>
                )}
              </View>
              {/* Acciones secundarias: Solo activas si la sesión no ha finalizado */}
              {!esSoloLectura && (
                <View style={styles.secondaryActions}>
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="create-outline" size={14} color={noir.platinum} />
                    <Text style={styles.secondaryButtonText}>Seguir editando</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDescartar}
                    style={({ pressed }) => [
                      styles.dangerButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={14} color="#F08A9B" />
                    <Text style={styles.dangerButtonText}>Descartar</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
          {/* Dock fijo: única acción LiquidMetal */}
          <View
            style={[
              styles.dock,
              {
                paddingBottom: Math.max(barBottomPadding, 12),
                paddingHorizontal: Math.max(gutter, leftInset, rightInset),
              },
            ]}
          >
            <View style={styles.dockNote}>
              <View style={styles.dockDot} />
              <Text style={styles.dockNoteText}>
                {esSoloLectura
                  ? modoEdicion
                    ? 'Solo se actualizan series y notas · el tiempo no cambia'
                    : 'Entrenamiento finalizado y guardado'
                  : guardando
                  ? 'Guardando tu progreso…'
                  : 'Todo listo para guardar'}
              </Text>
            </View>
            <BotonMetalLiquido
              titulo={
                esSoloLectura
                  ? modoEdicion
                    ? guardandoEdicion
                      ? 'Guardando cambios…'
                      : 'Guardar cambios'
                    : 'Cerrar resumen'
                  : guardando
                  ? 'Guardando entrenamiento…'
                  : 'Guardar entrenamiento'
              }
              icon={
                <Ionicons
                  name={
                    esSoloLectura
                      ? modoEdicion
                        ? 'save-outline'
                        : 'checkmark-done'
                      : 'cloud-upload-outline'
                  }
                  size={16}
                  color={noir.mint}
                />
              }
              onPress={
                esSoloLectura
                  ? modoEdicion
                    ? handleGuardarEdicion
                    : onClose
                  : onConfirmarGuardar
              }
              disabled={guardando || guardandoEdicion}
              tamano="lg"
              height={56}
              activo={visible && !guardando && !guardandoEdicion}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </FondoPantalla>
    </KeyboardAvoidingView>
  );
}