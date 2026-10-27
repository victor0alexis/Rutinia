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
import {
  COLORES_PLANES,
  fuentes,
  ICONOS_PLANES,
  noir,
} from '../constants/colores';
import GlowPanel from './GlowPanel';
import { LiquidMetalButton } from './LiquidMetalButton';
import ShinyText from './ShinyText';
import { PlanEntrenamiento } from '../types';
import { useLayout } from '../hooks/useLayout';
import { vibrarBoton } from '../utils/haptics';

const DANGER = '#F08A9B';

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

type TextInputProps = React.ComponentProps<typeof TextInput>;

function truncarTexto(texto: string, maxChars: number) {
  if (texto.length <= maxChars) return texto;
  return `${texto.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function conAlpha(color: string, alpha: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;
}

function PlanTextInput({
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? noir.muted2}
      selectionColor={props.selectionColor ?? noir.ice}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.input, style, focused && styles.inputFocused]}
    />
  );
}

function SectionHeading({
  index,
  title,
  meta,
}: {
  index: string;
  title: string;
  meta?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionNumber}>{index}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

export default function GestionarPlanModal({
  visible,
  planParaEditar,
  onClose,
  onGuardar,
}: Props) {
  const { isLandscape, gutter, contentMaxWidth, barBottomPadding } = useLayout();
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
    if (guardando) return;

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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setGuardando(false);
    }
  };

  if (!visible) return null;

  const sheetMaxWidth = Math.min(contentMaxWidth, 760);
  const titleFontSize = isLandscape ? 26 : 24;
  const titleAvailableWidth = Math.max(
    120,
    sheetMaxWidth - gutter * 2 - 36 - 42 - 10 - 32 - 10
  );
  const titleMaxChars = Math.max(
    12,
    Math.floor(titleAvailableWidth / (titleFontSize * 0.56))
  );
  const displayTitle = truncarTexto(
    nombre.trim() || planParaEditar?.nombre || 'Nuevo plan',
    titleMaxChars
  );
  const titleWebStyle =
    Platform.OS === 'web'
      ? ({
          display: 'block',
          width: '100%',
          fontSize: titleFontSize,
          fontFamily: fuentes.bold,
          fontWeight: 700,
          lineHeight: `${titleFontSize * 1.3}px`,
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as any)
      : undefined;

  const headerMeta = planParaEditar
    ? 'Ajusta la identidad de tu plan y su lugar en tu semana.'
    : 'Así se verá en tu biblioteca y en tu semana.';
  const accentSoft = conAlpha(color, '1C');
  const accentBorder = conAlpha(color, '66');
  const accentFaint = conAlpha(color, '0F');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <View
          style={[
            styles.modalFrame,
            {
              maxWidth: sheetMaxWidth,
              paddingHorizontal: gutter,
              paddingBottom: Math.max(12, barBottomPadding + 8),
              height: isLandscape ? '98%' : '94%',
            },
          ]}
        >
          <GlowPanel radius={30} style={styles.sheet}>
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.header}>
              <View
                style={[
                  styles.planIconPreview,
                  {
                    backgroundColor: accentSoft,
                    borderColor: accentBorder,
                  },
                ]}
              >
                <Ionicons name={icono as any} size={20} color={color} />
              </View>

              <View style={styles.headerCopy}>
                <View style={styles.kickerRow}>
                  <View
                    style={[
                      styles.kickerDot,
                      {
                        backgroundColor: color,
                        shadowColor: color,
                      },
                    ]}
                  />
                  <Text style={styles.kicker}>
                    {planParaEditar ? 'Edición de plan' : 'Nuevo plan'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.shinyTitleWrap,
                    { height: titleFontSize * 1.4 },
                  ]}
                >
                  <ShinyText
                    text={displayTitle}
                    fontSize={titleFontSize}
                    fontFamily={fuentes.bold}
                    align="left"
                    width="100%"
                    height={titleFontSize * 1.4}
                    color={noir.platinum}
                    shineColor={noir.pearl}
                    glow={0.14}
                    speed={5.6}
                    style={titleWebStyle}
                  />
                </View>

                <Text style={styles.headerMeta} numberOfLines={1}>
                  {headerMeta}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.pressedSoft,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={17} color={noir.platinum} />
                </Pressable>
              </View>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={DANGER} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SectionHeading index="01" title="Identidad" meta="Básico" />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Nombre del plan</Text>
                  <Text style={styles.fieldHint}>Obligatorio</Text>
                </View>
                <PlanTextInput
                  placeholder="Ej. Hipertrofia Torso / Pierna"
                  value={nombre}
                  onChangeText={(texto) => {
                    setNombre(texto);
                    if (errorMsg) setErrorMsg('');
                  }}
                  inputMode="text"
                  keyboardType="default"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  enterKeyHint="next"
                  style={styles.nameInput}
                  accessibilityLabel="Nombre del plan"
                />
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Objetivo principal</Text>
                  <Text style={styles.fieldHint}>Opcional</Text>
                </View>
                <PlanTextInput
                  placeholder="Ej. Ganancia muscular, Fuerza máxima, Definición…"
                  value={objetivo}
                  onChangeText={setObjetivo}
                  inputMode="text"
                  keyboardType="default"
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  returnKeyType="next"
                  enterKeyHint="next"
                  accessibilityLabel="Objetivo principal"
                />
              </View>

              <SectionHeading index="02" title="Contexto" meta="Opcional" />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Descripción o notas</Text>
                  <Text style={styles.fieldHint}>Opcional</Text>
                </View>
                <PlanTextInput
                  placeholder="Ej. 4 días a la semana enfocado en progresión lineal de cargas…"
                  value={descripcion}
                  onChangeText={setDescripcion}
                  multiline
                  numberOfLines={3}
                  inputMode="text"
                  keyboardType="default"
                  autoCapitalize="sentences"
                  autoCorrect
                  textAlignVertical="top"
                  style={styles.multilineInput}
                  accessibilityLabel="Descripción o notas"
                />
              </View>

              <SectionHeading index="03" title="Estética" meta="Identidad visual" />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Color de acento</Text>
                  <Text style={styles.fieldHint}>Color del plan</Text>
                </View>
                <View style={styles.paletteRail}>
                  {COLORES_PLANES.map((c) => {
                    const seleccionado = color === c;

                    return (
                      <Pressable
                        key={c}
                        onPress={() => {
                          vibrarBoton();
                          setColor(c);
                        }}
                        style={({ pressed }) => [
                          styles.colorSwatch,
                          { backgroundColor: c },
                          seleccionado && styles.colorSwatchSelected,
                          pressed && styles.pressedSoft,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: seleccionado }}
                        accessibilityLabel={`Color de acento ${c}`}
                      >
                        {seleccionado ? (
                          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Icono representativo</Text>
                  <Text style={styles.fieldHint}>Opcional</Text>
                </View>
                <View style={styles.iconsGrid}>
                  {ICONOS_PLANES.map((iconName) => {
                    const seleccionado = icono === iconName;

                    return (
                      <Pressable
                        key={iconName}
                        onPress={() => {
                          vibrarBoton();
                          setIcono(iconName);
                        }}
                        style={({ pressed }) => [
                          styles.iconOption,
                          seleccionado && {
                            borderColor: color,
                            backgroundColor: accentSoft,
                          },
                          pressed && styles.pressedSoft,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: seleccionado }}
                        accessibilityLabel="Icono del plan"
                      >
                        <Ionicons
                          name={iconName as any}
                          size={19}
                          color={seleccionado ? color : noir.muted}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <SectionHeading index="04" title="Estado" meta="Semana" />

              <Pressable
                onPress={() => {
                  vibrarBoton();
                  setActivo((valor) => !valor);
                }}
                style={({ pressed }) => [
                  styles.toggleCard,
                  activo && {
                    borderColor: accentBorder,
                    backgroundColor: accentFaint,
                  },
                  pressed && styles.pressedSoft,
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: activo }}
                accessibilityLabel="Definir como plan activo"
              >
                <View style={styles.toggleCopy}>
                  <View style={styles.toggleTitleRow}>
                    <Text
                      style={[
                        styles.toggleTitle,
                        activo && { color: noir.text },
                      ]}
                    >
                      Definir como plan activo
                    </Text>
                    {activo ? (
                      <View
                        style={[
                          styles.activeChip,
                          {
                            backgroundColor: accentSoft,
                            borderColor: accentBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.activeChipText, { color }]}
                        >
                          ACTIVO
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.toggleSubtitle}>
                    Aparecerá predeterminado en tu Semana, Calendario y al
                    programar días.
                  </Text>
                </View>

                <View
                  style={[
                    styles.switchTrack,
                    activo && {
                      backgroundColor: color,
                      borderColor: color,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      activo && styles.switchThumbOn,
                    ]}
                  />
                </View>
              </Pressable>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerMetaRow}>
                <View style={styles.footerDot} />
                <Text style={styles.footerMeta} numberOfLines={1}>
                  {guardando
                    ? 'Guardando plan…'
                    : planParaEditar
                      ? 'Los cambios se sincronizan con tu semana.'
                      : 'Disponible para tus rutinas y tu semana.'}
                </Text>
              </View>

              <LiquidMetalButton
                titulo={
                  guardando
                    ? 'Guardando…'
                    : planParaEditar
                      ? 'Guardar cambios'
                      : 'Crear plan'
                }
                onPress={handleSubmit}
                disabled={guardando}
                activo={visible && !guardando}
                height={54}
                borderWidth={4}
                tamano="lg"
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </GlowPanel>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 3, 6, 0.86)',
    justifyContent: 'flex-end',
  },
  modalFrame: {
    width: '100%',
    alignSelf: 'center',
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  grabberWrap: {
    alignItems: 'center',
    marginTop: -2,
    marginBottom: 2,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  planIconPreview: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  kicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  shinyTitleWrap: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  headerMeta: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(240, 138, 155, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.24)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    color: DANGER,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    lineHeight: 16,
  },
  scroll: {
    flex: 1,
    marginTop: 2,
  },
  scrollContent: {
    gap: 14,
    paddingTop: 2,
    paddingBottom: 4,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  sectionNumber: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: noir.line,
  },
  sectionMeta: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  fieldHint: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: noir.text,
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  inputFocused: {
    borderColor: 'rgba(255, 255, 255, 0.30)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  nameInput: {
    fontSize: 16,
    fontFamily: fuentes.bold,
    letterSpacing: -0.2,
    paddingVertical: 13,
  },
  multilineInput: {
    minHeight: 78,
    paddingTop: 12,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  paletteRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
    padding: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    // @ts-ignore boxShadow existe en react-native-web
    boxShadow:
      '0 0 0 3px rgba(255, 255, 255, 0.14), 0 0 16px rgba(255, 255, 255, 0.16)',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  toggleTitle: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 13.5,
  },
  toggleSubtitle: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  activeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeChipText: {
    fontFamily: fuentes.black,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  switchThumbOn: {
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 18 }],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: noir.line,
    paddingTop: 11,
    gap: 8,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.mint,
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  footerMeta: {
    flex: 1,
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9.5,
    letterSpacing: 0.1,
  },
  pressedSoft: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
