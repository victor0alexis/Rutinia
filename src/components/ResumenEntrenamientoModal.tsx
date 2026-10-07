import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import GlowButton from './GlowButton';
import ScreenBackground from './ScreenBackground';
import { formatearTiempoTexto } from '../utils/timer';

export type EjercicioResumen = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  seriesTotal: number;
  seriesCompletadas: number;
  pesoMaximo: number;
  repsMaximas: number;
  tieneSobrecarga: boolean;
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
  onClose: () => void; // Volver a editar
  onConfirmarGuardar: () => void;
  onDescartarSesion: () => void;
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
}: Props) {
  if (!visible) return null;

  const porcentajeProgreso =
    totalSeriesEnSesion > 0
      ? Math.round((totalSeriesCompletadas / totalSeriesEnSesion) * 100)
      : 0;

  const totalSobrecargas = ejerciciosResumen.filter((e) => e.tieneSobrecarga).length;

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

  return (
    <View style={styles.overlayContainer}>
      <ScreenBackground>
        <View style={styles.container}>
          {/* Header del Modal */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.badgeText}>RESUMEN Y CONFIRMACIÓN</Text>
              <Text style={styles.titleText} numberOfLines={1}>
                {nombreRutina}
              </Text>
              <Text style={styles.dateSubtext}>{fechaTexto}</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeIconButton} hitSlop={8}>
              <Ionicons name="close" size={22} color={colores.texto} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* HERO METRICS GRID */}
            <View style={styles.metricsGrid}>
              {/* Tiempo */}
              <View style={styles.metricCard}>
                <Ionicons name="time-outline" size={20} color={colores.hoy} />
                <Text style={styles.metricValue}>
                  {formatearTiempoTexto(segundosTranscurridos)}
                </Text>
                <Text style={styles.metricLabel}>DURACIÓN</Text>
              </View>

              {/* Series & Progreso */}
              <View style={styles.metricCard}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color={colores.exito} />
                <Text style={styles.metricValue}>
                  {totalSeriesCompletadas}/{totalSeriesEnSesion}
                </Text>
                <Text style={styles.metricLabel}>{porcentajeProgreso}% COMPLETADO</Text>
              </View>

              {/* Volumen (Kg) */}
              <View style={styles.metricCard}>
                <Ionicons name="barbell-outline" size={20} color={colores.primarioHover} />
                <Text style={styles.metricValue}>
                  {volumenTotalKg > 0 ? `${volumenTotalKg.toLocaleString()} kg` : '0 kg'}
                </Text>
                <Text style={styles.metricLabel}>VOLUMEN TOTAL</Text>
              </View>

              {/* Sobrecargas / PRs */}
              <View style={styles.metricCard}>
                <Ionicons name="flame-outline" size={20} color="#F59E0B" />
                <Text style={styles.metricValue}>
                  {totalSobrecargas} {totalSobrecargas === 1 ? 'Ejercicio' : 'Ejercicios'}
                </Text>
                <Text style={styles.metricLabel}>SOBRECARGA PROGRESIVA</Text>
              </View>
            </View>

            {/* BARRA DE PROGRESO DE LA SESIÓN */}
            <View style={styles.progressBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colores.texto, fontFamily: fuentes.bold, fontSize: 12 }}>
                  Estado de Finalización
                </Text>
                <Text style={{ color: colores.exito, fontFamily: fuentes.black, fontSize: 12 }}>
                  {porcentajeProgreso >= 100 ? '¡100% Completo!' : `${porcentajeProgreso}% grabado`}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${porcentajeProgreso}%`,
                      backgroundColor: porcentajeProgreso === 100 ? colores.exito : colores.primarioHover,
                    },
                  ]}
                />
              </View>
            </View>

            {/* DESGLOSE DINÁMICO POR EJERCICIO */}
            <View style={styles.sectionBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="list-outline" size={16} color={colores.primarioHover} />
                <Text style={styles.sectionTitle}>DESGLOSE DE EJERCICIOS</Text>
              </View>

              <View style={{ gap: 8 }}>
                {ejerciciosResumen.map((ej, idx) => (
                  <View key={ej.id} style={styles.exerciseSummaryRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.exerciseIndexText}>#{idx + 1}</Text>
                        <Text style={styles.exerciseNameText} numberOfLines={1}>
                          {ej.nombre}
                        </Text>
                        {ej.esUnilateral && (
                          <View style={styles.unilateralBadge}>
                            <Text style={styles.unilateralBadgeText}>D/I</Text>
                          </View>
                        )}
                        {ej.tieneSobrecarga && (
                          <Text style={{ fontSize: 11 }}>🔥</Text>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                        <Text style={styles.exerciseSubDetail}>
                          Series: <Text style={{ color: colores.texto, fontFamily: fuentes.bold }}>{ej.seriesCompletadas}/{ej.seriesTotal}</Text>
                        </Text>
                        {ej.pesoMaximo > 0 && (
                          <Text style={styles.exerciseSubDetail}>
                            Máx: <Text style={{ color: colores.primarioHover, fontFamily: fuentes.bold }}>{ej.pesoMaximo} kg × {ej.repsMaximas} r</Text>
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={{ justifyContent: 'center' }}>
                      <Ionicons
                        name={ej.seriesCompletadas === ej.seriesTotal ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={ej.seriesCompletadas === ej.seriesTotal ? colores.exito : colores.suave}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* NOTAS Y OBSERVACIONES */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>NOTAS & SENSACIONES DE LA SESIÓN</Text>
              <TextInput
                placeholder="Añade sensaciones finales, nivel de energía o apuntes de esta sesión..."
                placeholderTextColor={colores.suave}
                multiline
                numberOfLines={3}
                value={notasSesion}
                onChangeText={onChangeNotasSesion}
                style={styles.notesInput}
              />
            </View>

            {/* BOTONES DE ACCIÓN DE ALTO IMPACTO */}
            <View style={styles.actionButtonsContainer}>
              <GlowButton
                title={guardando ? 'Guardando Entrenamiento...' : 'Confirmar y Guardar Entrenamiento'}
                onPress={onConfirmarGuardar}
                disabled={guardando}
                variant="primary"
                size="lg"
                shape="rounded"
                fullWidth
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="create-outline" size={16} color={colores.texto} />
                  <Text style={styles.secondaryButtonText}>Seguir Editando</Text>
                </Pressable>

                <Pressable
                  onPress={handleDescartar}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color="#F43F5E" />
                  <Text style={styles.dangerButtonText}>Descartar</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScreenBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 10,
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  badgeText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titleText: {
    color: colores.texto,
    fontSize: 22,
    fontFamily: fuentes.black,
    marginTop: 2,
  },
  dateSubtext: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  closeIconButton: {
    backgroundColor: colores.tarjeta,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 4,
  },
  metricValue: {
    color: colores.texto,
    fontSize: 17,
    fontFamily: fuentes.black,
    marginTop: 2,
  },
  metricLabel: {
    color: colores.suave,
    fontSize: 9,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressBox: {
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(10, 12, 18, 0.80)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionBox: {
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  sectionTitle: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  exerciseSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 12, 18, 0.50)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  exerciseIndexText: {
    color: colores.primarioHover,
    fontFamily: fuentes.bold,
    fontSize: 12,
  },
  exerciseNameText: {
    color: colores.texto,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  unilateralBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  unilateralBadgeText: {
    color: '#EC4899',
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  exerciseSubDetail: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
  },
  notesInput: {
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.regular,
    height: 70,
    textAlignVertical: 'top',
  },
  actionButtonsContainer: {
    gap: 8,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colores.texto,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  dangerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.10)',
    borderColor: 'rgba(244, 63, 94, 0.30)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: '#F43F5E',
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
});
