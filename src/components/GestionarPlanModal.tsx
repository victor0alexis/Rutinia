import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, COLORES_PLANES, fuentes, ICONOS_PLANES } from '../constants/colores';
import BotonRutinia from './BotonRutinia';
import { PlanEntrenamiento } from '../types';
import { useLayout } from '../hooks/useLayout';

type Props = {
  visible: boolean;
  planParaEditar?: PlanEntrenamiento | null;
  onClose: () => void;
  onGuardar: (datos: {
    nombre: string;
    descripcion: string;
    objetivo: string;
    color: string;
    icono: string;
    activo: boolean;
  }) => Promise<void>;
};

export default function GestionarPlanModal({
  visible,
  planParaEditar,
  onClose,
  onGuardar,
}: Props) {
  const { isLandscape, gutter, contentMaxWidth, bottomInset } = useLayout();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [color, setColor] = useState<string>(COLORES_PLANES[0]);
  const [icono, setIcono] = useState<string>(ICONOS_PLANES[0]);
  const [activo, setActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Resetear el formulario cuando cambia la apertura del modal o el plan a editar.
  // Patrón recomendado por React: ajustar estado durante el render en lugar de un efecto.
  const [estadoAnterior, setEstadoAnterior] = useState({ visible, planParaEditar });
  if (estadoAnterior.visible !== visible || estadoAnterior.planParaEditar !== planParaEditar) {
    setEstadoAnterior({ visible, planParaEditar });
    if (planParaEditar) {
      setNombre(planParaEditar.nombre || '');
      setDescripcion(planParaEditar.descripcion || '');
      setObjetivo(planParaEditar.objetivo || '');
      setColor(planParaEditar.color || COLORES_PLANES[0]);
      setIcono(planParaEditar.icono || ICONOS_PLANES[0]);
      setActivo(Boolean(planParaEditar.activo));
    } else {
      setNombre('');
      setDescripcion('');
      setObjetivo('');
      setColor(COLORES_PLANES[0]);
      setIcono(ICONOS_PLANES[0]);
      setActivo(false);
    }
    setErrorMsg('');
    setGuardando(false);
  }

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      setErrorMsg('Ingresa un nombre para el plan');
      return;
    }
    try {
      setGuardando(true);
      setErrorMsg('');
      await onGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        objetivo: objetivo.trim(),
        color,
        icono,
        activo,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el plan');
    } finally {
      setGuardando(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}
      >
        <View
          style={[
            styles.sheetContainer,
            {
              maxWidth: contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingBottom: Math.max(20, bottomInset + 10),
              maxHeight: isLandscape ? '98%' : '90%',
            },
          ]}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingBottom: 12 }}>
            <View style={styles.grabber} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.planIconPreview, { backgroundColor: color + '25', borderColor: color }]}>
                <Ionicons name={icono as any} size={22} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeText}>
                  {planParaEditar ? 'EDITAR PLAN' : 'NUEVO PLAN DE ENTRENAMIENTO'}
                </Text>
                <Text style={styles.titleText} numberOfLines={1}>
                  {nombre || 'Mi nuevo plan'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colores.suave} />
            </Pressable>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colores.peligro} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
            {/* Campo Nombre */}
            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>Nombre del Plan *</Text>
              <TextInput
                placeholder="Ej. Hipertrofia Torso / Pierna"
                placeholderTextColor={colores.suave}
                value={nombre}
                onChangeText={(t) => {
                  setNombre(t);
                  if (errorMsg) setErrorMsg('');
                }}
                style={styles.input}
              />
            </View>

            {/* Campo Objetivo */}
            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>Objetivo principal</Text>
              <TextInput
                placeholder="Ej. Ganancia muscular, Fuerza máxima, Definición..."
                placeholderTextColor={colores.suave}
                value={objetivo}
                onChangeText={setObjetivo}
                style={styles.input}
              />
            </View>

            {/* Campo Descripción */}
            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>Descripción o notas</Text>
              <TextInput
                placeholder="Ej. 4 días a la semana enfocado en progresión lineal de cargas..."
                placeholderTextColor={colores.suave}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={2}
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              />
            </View>

            {/* Selector de Color de Acento */}
            <View style={{ gap: 8 }}>
              <Text style={styles.inputLabel}>Color de Acento (Identidad visual)</Text>
              <View style={styles.colorsGrid}>
                {COLORES_PLANES.map((c) => {
                  const seleccionado = color === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        seleccionado && styles.colorCircleSelected,
                      ]}
                    >
                      {seleccionado && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Selector de Icono */}
            <View style={{ gap: 8 }}>
              <Text style={styles.inputLabel}>Icono representativo</Text>
              <View style={styles.iconsGrid}>
                {ICONOS_PLANES.map((iconName) => {
                  const seleccionado = icono === iconName;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => setIcono(iconName)}
                      style={[
                        styles.iconOption,
                        seleccionado && {
                          borderColor: color,
                          backgroundColor: color + '22',
                        },
                      ]}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={20}
                        color={seleccionado ? color : colores.suave}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Toggle Plan Activo */}
            <Pressable
              onPress={() => setActivo(!activo)}
              style={[
                styles.toggleActivoCard,
                activo && { borderColor: color, backgroundColor: color + '15' },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.toggleTitle, activo && { color: color }]}>
                    Definir como Plan Activo
                  </Text>
                  {activo && (
                    <View style={[styles.activeChip, { backgroundColor: color }]}>
                      <Text style={styles.activeChipText}>ACTIVO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toggleSubtitle}>
                  Aparecerá predeterminado en tu Semana, Calendario y al programar días.
                </Text>
              </View>
              <Ionicons
                name={activo ? 'checkbox' : 'square-outline'}
                size={24}
                color={activo ? color : colores.suave}
              />
            </Pressable>
          </ScrollView>

          {/* Botones de Acción */}
          <View style={styles.footerRow}>
            <BotonRutinia
              titulo={guardando ? 'Guardando...' : planParaEditar ? 'Guardar Cambios' : 'Crear Plan'}
              variante="principal"
              onPress={handleSubmit}
              disabled={guardando}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  planIconPreview: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 1.2,
  },
  titleText: {
    color: colores.texto,
    fontSize: 18,
    fontFamily: fuentes.black,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  inputLabel: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colores.tarjetaSolida,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  colorsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  iconsGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconOption: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActivoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjetaSolida,
    gap: 12,
  },
  toggleTitle: {
    color: colores.texto,
    fontSize: 14,
    fontFamily: fuentes.bold,
  },
  toggleSubtitle: {
    color: colores.suave,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  activeChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeChipText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  footerRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
});
