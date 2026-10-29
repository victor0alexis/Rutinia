import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, DIAS_SEMANA_ABREV, DIAS_SEMANA_NOMBRES, fuentes } from '../constantes/colores';
import BotonRutinia from './BotonRutinia';
import { PlanEntrenamiento, Registro, Rutina } from '../tipos';
import { aISO, diasDeSemana, rangoSemana } from '../utilidades/fechas';
import { registrosDeRango } from '../services/registros';
import { aplicarPlanASemana, listarRutinasDePlan } from '../services/planes';
import { useLayout } from '../hooks/useLayout';

type Props = {
  visible: boolean;
  plan: PlanEntrenamiento | null;
  onClose: () => void;
  onAplicado: (resumen: { aplicadas: number; omitidas: number }) => void;
};

export default function AplicarPlanSemanaModal({
  visible,
  plan,
  onClose,
  onAplicado,
}: Props) {
  const { isLandscape, gutter, contentMaxWidth, barBottomPadding } = useLayout();
  const [fechaSemana] = useState(new Date());
  const [rutinasPlan, setRutinasPlan] = useState<Rutina[]>([]);
  const [registrosSemana, setRegistrosSemana] = useState<Registro[]>([]);
  const [reemplazarGlobal, setReemplazarGlobal] = useState(true);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [aplicando, setAplicando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const dias = useMemo(() => diasDeSemana(fechaSemana), [fechaSemana]);

  useEffect(() => {
    if (!visible || !plan) return;
    let cancelado = false;
    const cargarDatos = async () => {
      setCargando(true);
      const [ruts, regs] = await Promise.all([
        listarRutinasDePlan(plan.id),
        registrosDeRango(aISO(dias[0]), aISO(dias[6])),
      ]);
      if (cancelado) return;
      setRutinasPlan(ruts);
      setRegistrosSemana(regs);
      // Preseleccionar los días que efectivamente tienen una rutina sugerida asignada en este plan
      const diasConRutina = ruts
        .map((r) => r.dia_sugerido)
        .filter((d): d is number => d !== null && d !== undefined);
      setDiasSeleccionados(diasConRutina.length > 0 ? diasConRutina : [0, 1, 2, 3, 4, 5, 6]);
      setCargando(false);
    };
    cargarDatos();
    return () => {
      cancelado = true;
    };
  }, [visible, plan, dias]);

  if (!visible || !plan) return null;

  const toggleDia = (diaIndex: number) => {
    if (diasSeleccionados.includes(diaIndex)) {
      setDiasSeleccionados(diasSeleccionados.filter((d) => d !== diaIndex));
    } else {
      setDiasSeleccionados([...diasSeleccionados, diaIndex]);
    }
  };

  const handleConfirmar = async () => {
    try {
      setAplicando(true);
      const res = await aplicarPlanASemana(plan.id, fechaSemana, {
        reemplazar: reemplazarGlobal,
        diasSeleccionados,
      });
      onAplicado(res);
      onClose();
    } catch (err: any) {
      console.warn('Error al aplicar plan a la semana:', err);
    } finally {
      setAplicando(false);
    }
  };

  // Contar cuántos días con rutina configurada en el plan tienen conflicto en la semana
  let conflictos = 0;
  let rutinasAsignables = 0;
  for (let i = 0; i < 7; i++) {
    const rut = rutinasPlan.find((r) => r.dia_sugerido === i);
    if (rut) {
      rutinasAsignables++;
      const fechaISO = aISO(dias[i]);
      const tieneExistente = registrosSemana.some(
        (r) => r.fecha === fechaISO && (r.rutina_id || r.rutina_nombre)
      );
      if (tieneExistente) conflictos++;
    }
  }

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
              paddingBottom: Math.max(20, barBottomPadding + 10),
              maxHeight: isLandscape ? '98%' : '90%',
            },
          ]}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={styles.grabber} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.planBadgeIcon, { backgroundColor: plan.color + '22', borderColor: plan.color }]}>
              <Ionicons name={plan.icono as any} size={22} color={plan.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>APLICAR A MI SEMANA</Text>
              <Text style={styles.titleText} numberOfLines={1}>{plan.nombre}</Text>
              <Text style={styles.subdateText}>{rangoSemana(fechaSemana)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colores.suave} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 12 }}>
            {/* Aviso si no hay rutinas con día sugerido */}
            {rutinasAsignables === 0 && !cargando && (
              <View style={styles.emptyWarningBox}>
                <Ionicons name="alert-circle-outline" size={20} color={colores.hoy} />
                <Text style={styles.emptyWarningText}>
                  Ninguna rutina de este plan tiene un día sugerido configurado. Edita las rutinas del plan y asígnales Lunes, Martes, etc., o selecciona manualmente.
                </Text>
              </View>
            )}

            {/* Selector Reemplazar / Conservar si hay conflictos */}
            {conflictos > 0 && (
              <View style={styles.conflictCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="swap-horizontal" size={18} color={colores.primarioHover} />
                  <Text style={styles.conflictTitle}>
                    {conflictos} {conflictos === 1 ? 'día ya tiene' : 'días ya tienen'} rutina programada
                  </Text>
                </View>
                <Text style={styles.conflictText}>
                  Elige cómo proceder con los días que ya tienen una rutina asignada en tu semana:
                </Text>

                <View style={styles.replaceSwitchRow}>
                  <Pressable
                    onPress={() => setReemplazarGlobal(true)}
                    style={[
                      styles.replaceOption,
                      reemplazarGlobal && styles.replaceOptionSelected,
                    ]}
                  >
                    <Ionicons
                      name={reemplazarGlobal ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={reemplazarGlobal ? colores.primarioHover : colores.suave}
                    />
                    <Text style={[styles.replaceOptionText, reemplazarGlobal && { color: colores.texto }]}>
                      Reemplazar por este plan
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setReemplazarGlobal(false)}
                    style={[
                      styles.replaceOption,
                      !reemplazarGlobal && styles.replaceOptionSelected,
                    ]}
                  >
                    <Ionicons
                      name={!reemplazarGlobal ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={!reemplazarGlobal ? colores.primarioHover : colores.suave}
                    />
                    <Text style={[styles.replaceOptionText, !reemplazarGlobal && { color: colores.texto }]}>
                      Conservar existentes
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Vista Previa de los 7 Días */}
            <View style={{ gap: 8 }}>
              <Text style={styles.previewSectionTitle}>VISTA PREVIA DE ASIGNACIÓN DÍA POR DÍA</Text>

              {dias.map((d, index) => {
                const rut = rutinasPlan.find((r) => r.dia_sugerido === index);
                const fechaISO = aISO(d);
                const regExistente = registrosSemana.find(
                  (r) => r.fecha === fechaISO && (r.rutina_id || r.rutina_nombre)
                );
                const seleccionado = diasSeleccionados.includes(index) && !!rut;

                return (
                  <Pressable
                    key={index}
                    onPress={() => rut && toggleDia(index)}
                    style={[
                      styles.dayPreviewRow,
                      seleccionado && {
                        borderColor: plan.color + '60',
                        backgroundColor: plan.color + '12',
                      },
                    ]}
                  >
                    <View style={[styles.dayAbbrevBadge, seleccionado && { backgroundColor: plan.color }]}>
                      <Text style={[styles.dayAbbrevText, seleccionado && { color: '#FFF' }]}>
                        {DIAS_SEMANA_ABREV[index]}
                      </Text>
                    </View>

                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.dayFullDateText}>
                          {DIAS_SEMANA_NOMBRES[index]} {d.getDate()}
                        </Text>
                        {rut && (
                          <View style={[styles.suggestedBadge, { borderColor: plan.color + '45' }]}>
                            <Text style={[styles.suggestedBadgeText, { color: plan.color }]}>Sugerida</Text>
                          </View>
                        )}
                      </View>

                      {rut ? (
                        <Text style={[styles.routineAssignedName, { color: plan.color }]} numberOfLines={1}>
                          {rut.nombre} ({rut.ejercicios_rutina?.length || 0} ejercicios)
                        </Text>
                      ) : (
                        <Text style={styles.restDayText}>Día de descanso (sin rutina sugerida)</Text>
                      )}

                      {regExistente && (
                        <Text style={styles.conflictInfoText}>
                          ⚠️ Ya tiene: &quot;{regExistente.rutinas?.nombre || regExistente.rutina_nombre || 'Rutina'}&quot;{' '}
                          {reemplazarGlobal && seleccionado ? '(Se reemplazará)' : '(Se conservará)'}
                        </Text>
                      )}
                    </View>

                    {rut && (
                      <Ionicons
                        name={seleccionado ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={seleccionado ? plan.color : colores.suave}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer de Acciones */}
          <View style={styles.footerRow}>
            <BotonRutinia
              titulo="Cancelar"
              variante="secundario"
              onPress={onClose}
              disabled={aplicando}
              style={{ flex: 1 }}
            />
            <BotonRutinia
              titulo={aplicando ? 'Aplicando...' : 'Confirmar y Aplicar a la Semana'}
              variante="principal"
              onPress={handleConfirmar}
              disabled={aplicando || rutinasAsignables === 0}
              style={{ flex: 1.6 }}
            />
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
  planBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  kicker: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  titleText: {
    color: colores.texto,
    fontSize: 18,
    fontFamily: fuentes.black,
  },
  subdateText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emptyWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  emptyWarningText: {
    color: '#FDE68A',
    fontSize: 12,
    fontFamily: fuentes.regular,
    flex: 1,
    lineHeight: 16,
  },
  conflictCard: {
    backgroundColor: colores.tarjetaSolida,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: 8,
  },
  conflictTitle: {
    color: colores.primarioHover,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  conflictText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  replaceSwitchRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  replaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  replaceOptionSelected: {
    borderColor: colores.primarioHover,
    backgroundColor: colores.primarioSuave,
  },
  replaceOptionText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  previewSectionTitle: {
    color: colores.suave,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
  },
  dayAbbrevBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dayAbbrevText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.black,
  },
  dayFullDateText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  suggestedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  suggestedBadgeText: {
    fontSize: 9,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  routineAssignedName: {
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  restDayText: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    fontStyle: 'italic',
  },
  conflictInfoText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontFamily: fuentes.medium,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
});
