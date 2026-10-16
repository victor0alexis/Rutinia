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
import { colores, fuentes } from '../constants/colores';
import BotonRutinia from './BotonRutinia';
import { PlanEntrenamiento } from '../types';
import { useLayout } from '../hooks/useLayout';

type Props = {
  visible: boolean;
  plan: PlanEntrenamiento | null;
  otrosPlanes: PlanEntrenamiento[];
  onClose: () => void;
  onArchivarEnLugarDeEliminar: (planId: string) => Promise<void>;
  onConfirmarEliminar: (
    planId: string,
    resolucion:
      | { tipo: 'mover'; planDestinoId: string }
      | { tipo: 'desvincular' }
      | { tipo: 'borrar' }
  ) => Promise<void>;
};

export default function EliminarPlanModal({
  visible,
  plan,
  otrosPlanes,
  onClose,
  onArchivarEnLugarDeEliminar,
  onConfirmarEliminar,
}: Props) {
  const { isLandscape, gutter, contentMaxWidth, bottomInset } = useLayout();
  const [opcion, setOpcion] = useState<'mover' | 'desvincular' | 'borrar'>('desvincular');
  const [planDestinoId, setPlanDestinoId] = useState<string>(otrosPlanes[0]?.id || '');
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  if (!visible || !plan) return null;

  const cantidadRutinas = plan.totalRutinas || 0;
  const planesDestinoDisponibles = otrosPlanes.filter((p) => p.id !== plan.id && !p.archivado);

  const handleEjecutarAccion = async () => {
    if (opcion === 'borrar' && !confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }

    try {
      setProcesando(true);
      if (opcion === 'mover') {
        const destino = planDestinoId || planesDestinoDisponibles[0]?.id;
        if (!destino) {
          // Si no hay destino, pasar a desvincular
          await onConfirmarEliminar(plan.id, { tipo: 'desvincular' });
        } else {
          await onConfirmarEliminar(plan.id, { tipo: 'mover', planDestinoId: destino });
        }
      } else if (opcion === 'desvincular') {
        await onConfirmarEliminar(plan.id, { tipo: 'desvincular' });
      } else {
        await onConfirmarEliminar(plan.id, { tipo: 'borrar' });
      }
      onClose();
    } finally {
      setProcesando(false);
      setConfirmandoBorrado(false);
    }
  };

  const handleArchivar = async () => {
    try {
      setProcesando(true);
      await onArchivarEnLugarDeEliminar(plan.id);
      onClose();
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' }}>
        <View
          style={[
            styles.sheetContainer,
            {
              maxWidth: contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingBottom: Math.max(20, bottomInset + 10),
              maxHeight: isLandscape ? '98%' : '88%',
            },
          ]}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={styles.grabber} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.warningIconBadge}>
              <Ionicons name="trash-outline" size={22} color={colores.peligro} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>Eliminar plan de entrenamiento</Text>
              <Text style={styles.subtitleText} numberOfLines={1}>
                &quot;{plan.nombre}&quot; ({cantidadRutinas} {cantidadRutinas === 1 ? 'rutina' : 'rutinas'})
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colores.suave} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
            {/* Mensaje de Garantía Histórica */}
            <View style={styles.guaranteeCard}>
              <Ionicons name="shield-checkmark" size={18} color={colores.exito} />
              <View style={{ flex: 1 }}>
                <Text style={styles.guaranteeTitle}>Tu historial no se pierde</Text>
                <Text style={styles.guaranteeText}>
                  Los entrenamientos pasados, cargas y series registradas seguirán intactos con el nombre de este plan.
                </Text>
              </View>
            </View>

            {/* Sugerencia Recomendada: ARCHIVAR */}
            <View style={styles.archiveRecommendationCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="archive-outline" size={18} color={colores.hoy} />
                <Text style={styles.archiveRecTitle}>Recomendado: Archivar en su lugar</Text>
              </View>
              <Text style={styles.archiveRecSubtext}>
                Oculta el plan de tu día a día sin eliminar sus rutinas ni modificar su estructura. Puedes restaurarlo cuando quieras.
              </Text>
              <BotonRutinia
                titulo="Archivar este plan"
                variante="secundario"
                tamano="compacto"
                onPress={handleArchivar}
                disabled={procesando}
              />
            </View>

            {/* Opciones de resolución de las rutinas contenidas */}
            {cantidadRutinas > 0 && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={styles.sectionLabel}>¿Qué deseas hacer con sus {cantidadRutinas} rutinas?</Text>

                {/* Opción 1: Mover a otro plan */}
                {planesDestinoDisponibles.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setOpcion('mover');
                      setConfirmandoBorrado(false);
                    }}
                    style={[
                      styles.optionCard,
                      opcion === 'mover' && styles.optionCardSelected,
                    ]}
                  >
                    <Ionicons
                      name={opcion === 'mover' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={opcion === 'mover' ? colores.primarioHover : colores.suave}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.optionTitle, opcion === 'mover' && { color: colores.texto }]}>
                        Mover las rutinas a otro plan
                      </Text>
                      {opcion === 'mover' && (
                        <View style={{ marginTop: 4, gap: 4 }}>
                          <Text style={{ color: colores.suave, fontSize: 11, fontFamily: fuentes.medium }}>
                            Selecciona el plan destino:
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {planesDestinoDisponibles.map((p) => {
                              const selDest = planDestinoId === p.id || (!planDestinoId && p === planesDestinoDisponibles[0]);
                              return (
                                <Pressable
                                  key={p.id}
                                  onPress={() => setPlanDestinoId(p.id)}
                                  style={[
                                    styles.planChoiceChip,
                                    selDest && { borderColor: p.color, backgroundColor: p.color + '22' },
                                  ]}
                                >
                                  <View style={[styles.miniDot, { backgroundColor: p.color }]} />
                                  <Text style={[styles.planChoiceText, selDest && { color: colores.texto }]}>
                                    {p.nombre}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  </Pressable>
                )}

                {/* Opción 2: Dejarlas sin plan */}
                <Pressable
                  onPress={() => {
                    setOpcion('desvincular');
                    setConfirmandoBorrado(false);
                  }}
                  style={[
                    styles.optionCard,
                    opcion === 'desvincular' && styles.optionCardSelected,
                  ]}
                >
                  <Ionicons
                    name={opcion === 'desvincular' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={opcion === 'desvincular' ? colores.primarioHover : colores.suave}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, opcion === 'desvincular' && { color: colores.texto }]}>
                      Dejarlas como rutinas individuales (sin plan)
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      Las rutinas se conservarán disponibles para agregarse a cualquier día o asignarse a otro plan más adelante.
                    </Text>
                  </View>
                </Pressable>

                {/* Opción 3: Eliminarlas con el plan */}
                <Pressable
                  onPress={() => {
                    setOpcion('borrar');
                  }}
                  style={[
                    styles.optionCard,
                    { borderColor: 'rgba(220, 38, 38, 0.35)' },
                    opcion === 'borrar' && { backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: colores.peligro },
                  ]}
                >
                  <Ionicons
                    name={opcion === 'borrar' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={opcion === 'borrar' ? colores.peligro : colores.suave}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: colores.peligro }]}>
                      Eliminarlas junto con el plan
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: '#FCA5A5' }]}>
                      Se borrarán estas rutinas del catálogo. Tu historial pasado de entrenamientos no se verá afectado.
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Confirmación y Botones */}
          <View style={styles.footerRow}>
            {opcion === 'borrar' && confirmandoBorrado && (
              <View style={styles.doubleConfirmBox}>
                <Ionicons name="warning-outline" size={18} color={colores.peligro} />
                <Text style={styles.doubleConfirmText}>
                  ¿Confirmas eliminar el plan y todas sus rutinas asociadas?
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <BotonRutinia
                titulo="Cancelar"
                variante="secundario"
                onPress={onClose}
                disabled={procesando}
                style={{ flex: 1 }}
              />
              <BotonRutinia
                titulo={
                  procesando
                    ? 'Eliminando...'
                    : opcion === 'borrar'
                    ? confirmandoBorrado
                      ? 'Sí, Eliminar Definitivamente'
                      : 'Eliminar Plan y Rutinas'
                    : 'Confirmar y Eliminar'
                }
                variante="peligro"
                onPress={handleEjecutarAccion}
                disabled={procesando}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#0F121B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingTop: 12,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  warningIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  titleText: {
    color: colores.texto,
    fontSize: 17,
    fontFamily: fuentes.black,
  },
  subtitleText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  guaranteeTitle: {
    color: colores.exito,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  guaranteeText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
    marginTop: 2,
  },
  archiveRecommendationCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    gap: 8,
  },
  archiveRecTitle: {
    color: colores.hoy,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  archiveRecSubtext: {
    color: '#FDE68A',
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  sectionLabel: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
  },
  optionCardSelected: {
    borderColor: colores.primarioHover,
    backgroundColor: colores.primarioSuave,
  },
  optionTitle: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  optionSubtitle: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.regular,
    lineHeight: 15,
    marginTop: 2,
  },
  planChoiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planChoiceText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  footerRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    gap: 8,
  },
  doubleConfirmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
    borderWidth: 1,
    borderColor: colores.peligro,
    borderRadius: 10,
    padding: 10,
  },
  doubleConfirmText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontFamily: fuentes.bold,
    flex: 1,
  },
});
