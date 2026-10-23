import React, { useState, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  DIAS_SEMANA_ABREV,
  DIAS_SEMANA_NOMBRES,
  fuentes,
  noir,
} from '../constants/colores';
import GlowPanel from './GlowPanel';
import { LiquidMetalButton } from './LiquidMetalButton';
import ShinyText from './ShinyText';
import YoungNewtButton from './YoungNewtButton';
import SelectorBibliotecaModal, { EjercicioSeleccionadoBiblioteca } from './SelectorBibliotecaModal';
import { obtenerGifEjercicio } from '../services/ejerciciosGifs';
import EjercicioGif from './entrenamiento/EjercicioGif';
import { crearRutina, eliminarRutina, actualizarRutina } from '../services/rutinas';
import { seguro, confirmarAccion, mostrarMensaje } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { listarPlanes } from '../services/planes';
import { PlanEntrenamiento, Rutina } from '../types';
import { useLayout } from '../hooks/useLayout';
import { vibrarBoton } from '../utils/haptics';

const DANGER = '#F08A9B';

type SerieInput = {
  id: string;
  peso: string;
  reps: string;
  pesoI?: string;
  repsI?: string;
  rir: string;
  nota: string;
  repsParciales?: number;
  esDropset?: boolean;
};

type EjercicioInput = {
  id: string;
  nombre: string;
  esUnilateral: boolean;
  series: SerieInput[];
  grupoMuscular?: string;
  equipo?: string;
  gifUrl?: string;
};

type Props = {
  visible: boolean;
  rutinaParaEditar?: Rutina | null;
  planIdInicial?: string | null;
  onClose: () => void;
  onGuardado: () => void;
  onProgramarSemana?: (rutina: Rutina) => void;
};

const nuevaSerieVacia = (): SerieInput => ({
  id: Date.now().toString() + Math.random().toString(),
  peso: '',
  reps: '',
  pesoI: '',
  repsI: '',
  rir: '',
  nota: '',
});

const nuevoEjercicioVacio = (): EjercicioInput => ({
  id: Date.now().toString() + Math.random().toString(),
  nombre: '',
  esUnilateral: false,
  series: [nuevaSerieVacia()],
});

type TextInputProps = React.ComponentProps<typeof TextInput>;

function truncarTexto(texto: string, max: number) {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

function RutinaTextInput({
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
      selectionColor={noir.ice}
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

function SerieCell({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? noir.muted2}
      selectionColor={noir.ice}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.serieCell, style, focused && styles.serieCellFocused]}
    />
  );
}

function SelectorDias({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const hoy = (new Date().getDay() + 6) % 7;

  return (
    <View style={styles.dayRail}>
      {DIAS_SEMANA_ABREV.map((letra, index) => {
        const selected = value === index;
        const today = hoy === index;

        return (
          <Pressable
            key={letra}
            onPress={() => {
              vibrarBoton();
              onChange(selected ? null : index);
            }}
            style={({ pressed }) => [
              styles.dayCell,
              selected && styles.dayCellSelected,
              pressed && styles.dayCellPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Día sugerido: ${DIAS_SEMANA_NOMBRES[index]}`}
          >
            {selected && (
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
            )}

            <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>
              {letra}
            </Text>
            <View
              style={[
                styles.dayDot,
                selected && styles.dayDotSelected,
                today && !selected && styles.dayDotToday,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
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

export default function GestionarRutinaModal({
  visible,
  rutinaParaEditar,
  planIdInicial,
  onClose,
  onGuardado,
  onProgramarSemana,
}: Props) {
  const { isLandscape, isTablet, gutter, contentMaxWidth, bottomInset } = useLayout();
  const [nombreRutina, setNombreRutina] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [diaSugerido, setDiaSugerido] = useState<number | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<PlanEntrenamiento[]>([]);
  const [ejercicios, setEjercicios] = useState<EjercicioInput[]>([nuevoEjercicioVacio()]);
  const [notasExpandidas, setNotasExpandidas] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  // Modal selector de biblioteca de ejercicios
  const [modalBibliotecaVisible, setModalBibliotecaVisible] = useState(false);
  const [indiceEjercicioParaBiblioteca, setIndiceEjercicioParaBiblioteca] = useState<number | null>(null);

  const abrirBibliotecaParaEjercicio = (idx: number) => {
    setIndiceEjercicioParaBiblioteca(idx);
    setModalBibliotecaVisible(true);
  };

  const abrirBibliotecaNuevo = () => {
    setIndiceEjercicioParaBiblioteca(null);
    setModalBibliotecaVisible(true);
  };

  const handleSeleccionEjercicioBiblioteca = (sel: EjercicioSeleccionadoBiblioteca) => {
    if (indiceEjercicioParaBiblioteca !== null) {
      setEjercicios((prev) =>
        prev.map((ej, idx) => {
          if (idx !== indiceEjercicioParaBiblioteca) return ej;
          return {
            ...ej,
            nombre: sel.nombre,
            grupoMuscular: sel.grupoMuscular,
            equipo: sel.equipo,
            gifUrl: sel.gifUrl,
          };
        })
      );
    } else {
      setEjercicios((prev) => {
        if (prev.length === 1 && !prev[0].nombre.trim()) {
          return [
            {
              ...prev[0],
              nombre: sel.nombre,
              grupoMuscular: sel.grupoMuscular,
              equipo: sel.equipo,
              gifUrl: sel.gifUrl,
            },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(),
            nombre: sel.nombre,
            esUnilateral: false,
            series: [nuevaSerieVacia()],
            grupoMuscular: sel.grupoMuscular,
            equipo: sel.equipo,
            gifUrl: sel.gifUrl,
          },
        ];
      });
    }
  };

  const alternarNotaSerie = (sId: string) => {
    setNotasExpandidas((prev) => ({ ...prev, [sId]: !prev[sId] }));
  };

  useEffect(() => {
    if (!visible) return;
    listarPlanes({ incluirArchivados: false }).then(setPlanesDisponibles);

    const timer = setTimeout(() => {
      setGuardando(false);
      if (rutinaParaEditar) {
        setNombreRutina(rutinaParaEditar.nombre);
        setPlanId(rutinaParaEditar.plan_id ?? null);
        setDiaSugerido(rutinaParaEditar.dia_sugerido ?? null);
        const ejsMapeados: EjercicioInput[] = (rutinaParaEditar.ejercicios_rutina || []).map((e) => {
          const parsed = parsearEjercicioInfo(e);
          const numSeries = e.series || parsed.detallesSets.length || 1;

          const seriesArray: SerieInput[] = Array.from({ length: numSeries }, (_, i) => {
            const sDetail = parsed.detallesSets[i];
            let pesoStr = sDetail?.pesoD || (e.peso ? e.peso.toString() : '');
            let repsStr = sDetail?.repsD || (e.repeticiones ? e.repeticiones.toString() : '');
            let pesoIStr = sDetail?.pesoI || '';
            let repsIStr = sDetail?.repsI || '';
            let rirStr = sDetail?.rir || '';
            let notaStr = sDetail?.nota || '';

            if (!sDetail?.pesoD && sDetail?.resumen) {
              const matchK = sDetail.resumen.match(/(\d+(\.\d+)?)k/);
              if (matchK) pesoStr = matchK[1];
              const matchR = sDetail.resumen.match(/(\d+)r/);
              if (matchR) repsStr = matchR[1];
            }

            return {
              id: i.toString() + Math.random().toString(),
              peso: pesoStr,
              reps: repsStr,
              pesoI: pesoIStr,
              repsI: repsIStr,
              rir: rirStr,
              nota: notaStr,
              repsParciales: sDetail?.repsParciales || 0,
              esDropset: Boolean(sDetail?.esDropset),
            };
          });

          const gifInfo = obtenerGifEjercicio(parsed.nombreLimpio);

          return {
            id: e.id,
            nombre: parsed.nombreLimpio,
            esUnilateral: parsed.esUnilateral,
            series: seriesArray,
            grupoMuscular: gifInfo.muscle,
            equipo: gifInfo.equipment,
            gifUrl: gifInfo.gifUrl,
          };
        });

        setEjercicios(ejsMapeados.length > 0 ? ejsMapeados : [nuevoEjercicioVacio()]);
      } else {
        setNombreRutina('');
        setPlanId(planIdInicial ?? null);
        setDiaSugerido(null);
        setEjercicios([nuevoEjercicioVacio()]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, rutinaParaEditar, planIdInicial]);


  // Modificar Ejercicio
  const cambiarNombreEjercicio = (index: number, val: string) => {
    setEjercicios(
      ejercicios.map((ej, i) => (i === index ? { ...ej, nombre: val } : ej))
    );
  };

  const agregarEjercicio = () => {
    setEjercicios([...ejercicios, nuevoEjercicioVacio()]);
  };

  const quitarEjercicio = (index: number) => {
    if (ejercicios.length === 1) return;
    setEjercicios(ejercicios.filter((_, i) => i !== index));
  };

  // Modificar Series de un Ejercicio
  const agregarSerieAEjercicio = (ejIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: [...ej.series, nuevaSerieVacia()],
        };
      })
    );
  };

  const quitarSerieDeEjercicio = (ejIndex: number, sIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        if (ej.series.length === 1) return ej;
        return {
          ...ej,
          series: ej.series.filter((_, sj) => sj !== sIndex),
        };
      })
    );
  };

  const cambiarCampoSerie = (
    ejIndex: number,
    sIndex: number,
    campo: keyof SerieInput,
    val: string
  ) => {
    setEjercicios(
      ejercicios.map((ej, i) => {
        if (i !== ejIndex) return ej;
        return {
          ...ej,
          series: ej.series.map((s, sj) => (sj === sIndex ? { ...s, [campo]: val } : s)),
        };
      })
    );
  };

  const alternarUnilateral = (ejIndex: number) => {
    setEjercicios(
      ejercicios.map((ej, i) => (i === ejIndex ? { ...ej, esUnilateral: !ej.esUnilateral } : ej))
    );
  };

  const guardar = () => {
    if (guardando) return;
    setGuardando(true);
    void seguro(async () => {
      if (!nombreRutina.trim()) throw new Error('Ingresa un nombre para la rutina.');

      const ejerciciosValidos = ejercicios.filter((ej) => ej.nombre.trim());
      if (ejerciciosValidos.length === 0) throw new Error('Agrega al menos un ejercicio con nombre.');

      const payloadEjercicios = ejerciciosValidos.map((ej) => {
        const primeraSerie = ej.series[0];
        const numSeriesTotal = ej.series.length;
        const repsPrimera = primeraSerie?.reps ? Number(primeraSerie.reps) : null;
        const pesoPrimero = primeraSerie?.peso ? Number(primeraSerie.peso) : null;

        const tieneDatos = ej.series.some((s) => Boolean(s.peso || s.reps || s.pesoI || s.repsI || s.rir || s.nota));
        const resumenSeries = tieneDatos
          ? ej.series
              .map((s, idx) => {
                if (ej.esUnilateral) {
                  const pD = s.peso ? `${s.peso}k` : '';
                  const rD = s.reps ? `${s.reps}r` : '';
                  const strD = [pD, rD].filter(Boolean).join(' ');

                  const pesoIVal = s.pesoI !== undefined && s.pesoI !== '' ? s.pesoI : s.peso;
                  const repsIVal = s.repsI !== undefined && s.repsI !== '' ? s.repsI : s.reps;
                  const pI = pesoIVal ? `${pesoIVal}k` : '';
                  const rI = repsIVal ? `${repsIVal}r` : '';
                  const strI = [pI, rI].filter(Boolean).join(' ');

                  const rir = s.rir ? `RIR ${s.rir}` : '';
                  const n = s.nota ? `[${s.nota}]` : '';
                  const parcialStr = s.repsParciales ? `+${s.repsParciales}p` : '';
                  const dropStr = s.esDropset ? '↓' : '';

                  const resumenBrazo = `D ${strD} | I ${strI}`.trim();
                  return `${idx + 1}ª: ${[resumenBrazo, parcialStr, dropStr, rir, n].filter(Boolean).join(' ')}`;
                } else {
                  const p = s.peso ? `${s.peso}k` : '';
                  const r = s.reps ? `${s.reps}r` : '';
                  const parcialStr = s.repsParciales ? `+${s.repsParciales}p` : '';
                  const dropStr = s.esDropset ? '↓' : '';
                  const rir = s.rir ? `RIR ${s.rir}` : '';
                  const n = s.nota ? `[${s.nota}]` : '';
                  return `${idx + 1}ª: ${[p, r, parcialStr, dropStr, rir, n].filter(Boolean).join(' ')}`;
                }
              })
              .join(' • ')
          : '';

        const tagU = ej.esUnilateral ? '[U] ' : '';
        const nombreLimpio = ej.nombre.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');
        const nombreBase = tagU + nombreLimpio;
        const nombreFinal = resumenSeries ? `${nombreBase} (${resumenSeries})` : nombreBase;

        return {
          nombre: nombreFinal,
          series: numSeriesTotal,
          repeticiones: repsPrimera,
          peso: pesoPrimero,
        };
      });

      if (rutinaParaEditar?.id) {
        await actualizarRutina(rutinaParaEditar.id, nombreRutina.trim(), payloadEjercicios, planId, diaSugerido);
      } else {
        await crearRutina(nombreRutina.trim(), payloadEjercicios, planId, diaSugerido);
      }


      onGuardado();
      onClose();
      mostrarMensaje('Éxito', rutinaParaEditar ? 'Rutina actualizada correctamente.' : 'Rutina guardada correctamente.');
    }).finally(() => setGuardando(false));
  };

  const borrarRutinaCompleta = () => {
    if (!rutinaParaEditar) return;
    confirmarAccion(
      'Eliminar Rutina',
      `¿Deseas eliminar la rutina "${rutinaParaEditar.nombre}"?`,
      async () => {
        await eliminarRutina(rutinaParaEditar.id);
        onGuardado();
        onClose();
      }
    );
  };

  const totalSeries = ejercicios.reduce(
    (total, ejercicio) => total + ejercicio.series.length,
    0
  );
  const planActual = planesDisponibles.find((plan) => plan.id === planId) ?? null;
  const sheetMaxWidth = Math.min(contentMaxWidth, 760);
  const titleFontSize = isLandscape ? 26 : 24;
  const titleAvailableWidth = Math.max(
    140,
    sheetMaxWidth - gutter * 2 - 36 - (rutinaParaEditar ? 80 : 42)
  );
  const titleMaxChars = Math.max(
    12,
    Math.floor(titleAvailableWidth / (titleFontSize * 0.56))
  );
  const displayTitle = truncarTexto(
    rutinaParaEditar?.nombre || 'Nueva Rutina',
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
  const headerMeta = rutinaParaEditar
    ? `${ejercicios.length} ${
        ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'
      } · ${totalSeries} ${totalSeries === 1 ? 'serie' : 'series'}${
        planActual ? ` · ${planActual.nombre}` : ''
      }`
    : 'Estructura la sesión y guárdala en tu biblioteca.';

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
              paddingBottom: Math.max(12, bottomInset + 8),
              height: isLandscape ? '98%' : '94%',
            },
          ]}
        >
          <GlowPanel radius={30} style={styles.sheet}>
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <View style={styles.kickerRow}>
                  <View style={styles.kickerDot} />
                  <Text style={styles.kicker}>
                    {rutinaParaEditar ? 'Gestión de rutina' : 'Nueva rutina'}
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
                {rutinaParaEditar ? (
                  <Pressable
                    onPress={borrarRutinaCompleta}
                    style={({ pressed }) => [
                      styles.headerDangerButton,
                      pressed && styles.pressedSoft,
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Eliminar rutina"
                  >
                    <Ionicons name="trash-outline" size={15} color={DANGER} />
                  </Pressable>
                ) : null}

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

            {rutinaParaEditar && onProgramarSemana ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onProgramarSemana(rutinaParaEditar);
                }}
                style={({ pressed }) => [
                  styles.scheduleButton,
                  pressed && styles.pressedSoft,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Programar en semana"
              >
                <Ionicons name="calendar-outline" size={14} color={noir.info} />
                <Text style={styles.scheduleButtonText}>Programar en semana</Text>
                <Ionicons name="arrow-forward" size={13} color={noir.muted2} />
              </Pressable>
            ) : null}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SectionHeading index="01" title="Identidad" meta="Contexto" />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Nombre de la rutina</Text>
                  <Text style={styles.fieldHint}>Obligatorio</Text>
                </View>
                <RutinaTextInput
                  placeholder="Ej. Upper-A, Torso Hipertrofia, Leg Day"
                  value={nombreRutina}
                  onChangeText={setNombreRutina}
                  inputMode="text"
                  keyboardType="default"
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  returnKeyType="done"
                  enterKeyHint="done"
                  style={styles.nameInput}
                  accessibilityLabel="Nombre de la rutina"
                />
              </View>

              <View
                style={[
                  styles.fieldPair,
                  (isLandscape || isTablet) && styles.fieldPairRow,
                ]}
              >
                {planesDisponibles.length > 0 ? (
                  <View
                    style={[
                      styles.field,
                      (isLandscape || isTablet) && styles.fieldPairItem,
                    ]}
                  >
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Plan</Text>
                      <Text style={styles.fieldHint}>Opcional</Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.planRailContent}
                    >
                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          setPlanId(null);
                        }}
                        style={({ pressed }) => [
                          styles.planChip,
                          planId === null && styles.planChipSelected,
                          pressed && styles.planChipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: planId === null }}
                        accessibilityLabel="Sin plan"
                      >
                        {planId === null ? (
                          <LinearGradient
                            pointerEvents="none"
                            colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={[StyleSheet.absoluteFill, { borderRadius: 13 }]}
                          />
                        ) : null}
                        <Ionicons
                          name="folder-outline"
                          size={13}
                          color={planId === null ? '#090B0F' : noir.muted}
                        />
                        <Text
                          style={[
                            styles.planChipText,
                            planId === null && styles.planChipTextSelected,
                          ]}
                        >
                          Sin plan
                        </Text>
                      </Pressable>

                      {planesDisponibles.map((plan) => {
                        const selected = planId === plan.id;

                        return (
                          <Pressable
                            key={plan.id}
                            onPress={() => {
                              vibrarBoton();
                              setPlanId(plan.id);
                            }}
                            style={({ pressed }) => [
                              styles.planChip,
                              selected && styles.planChipSelected,
                              pressed && styles.planChipPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Plan ${plan.nombre}`}
                          >
                            {selected ? (
                              <LinearGradient
                                pointerEvents="none"
                                colors={['#FFFFFF', '#EDF2F9', '#C9D4E3']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: 13 }]}
                              />
                            ) : null}

                            <View
                              style={[
                                styles.planDot,
                                {
                                  backgroundColor: plan.color,
                                  borderColor: selected
                                    ? 'rgba(9, 11, 15, 0.18)'
                                    : 'transparent',
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.planChipText,
                                selected && styles.planChipTextSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {plan.nombre}
                            </Text>

                            {plan.activo ? (
                              <View
                                style={[
                                  styles.planActiveBadge,
                                  {
                                    backgroundColor: selected
                                      ? 'rgba(9, 11, 15, 0.10)'
                                      : `${plan.color}22`,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.planActiveBadgeText,
                                    {
                                      color: selected
                                        ? 'rgba(9, 11, 15, 0.62)'
                                        : plan.color,
                                    },
                                  ]}
                                >
                                  ACTIVO
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.field,
                    (isLandscape || isTablet) && styles.fieldPairItem,
                  ]}
                >
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Día sugerido</Text>
                    {diaSugerido !== null ? (
                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          setDiaSugerido(null);
                        }}
                        hitSlop={8}
                        style={({ pressed }) => pressed && styles.pressedSoft}
                      >
                        <Text style={styles.clearLink}>Quitar</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.fieldHint}>Opcional</Text>
                    )}
                  </View>

                  <SelectorDias value={diaSugerido} onChange={setDiaSugerido} />

                  <Text style={styles.helperText}>
                    {diaSugerido !== null
                      ? `Sugerida para cada ${DIAS_SEMANA_NOMBRES[
                          diaSugerido
                        ].toLowerCase()}.`
                      : 'Sin día fijo: podrás asignarla a cualquier fecha.'}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              <SectionHeading
                index="02"
                title="Ejercicios"
                meta={`${ejercicios.length} ${
                  ejercicios.length === 1 ? 'bloque' : 'bloques'
                }`}
              />

              {ejercicios.map((ej, ejIdx) => {
                const gifInfo = obtenerGifEjercicio(ej.nombre);
                const musculo = ej.grupoMuscular || gifInfo.muscle || 'Cuerpo';
                const equipo = ej.equipo || gifInfo.equipment || 'Libre';

                return (
                  <View key={ej.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={styles.exerciseIndexBadge}>
                        <Text style={styles.exerciseIndexText}>
                          {String(ejIdx + 1).padStart(2, '0')}
                        </Text>
                      </View>

                      <View style={styles.exerciseHeaderCopy}>
                        <Text style={styles.exerciseKicker}>Ejercicio</Text>
                        <Text style={styles.exerciseTitle} numberOfLines={1}>
                          {ej.nombre.trim() || 'Nuevo ejercicio'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          alternarUnilateral(ejIdx);
                        }}
                        style={({ pressed }) => [
                          styles.unilateralChip,
                          ej.esUnilateral && styles.unilateralChipActive,
                          pressed && styles.unilateralChipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: ej.esUnilateral }}
                        accessibilityLabel="Alternar ejercicio unilateral"
                      >
                        <Ionicons
                          name={
                            ej.esUnilateral
                              ? 'hand-left-outline'
                              : 'body-outline'
                          }
                          size={11}
                          color={ej.esUnilateral ? noir.mint : noir.muted}
                        />
                        <Text
                          style={[
                            styles.unilateralText,
                            ej.esUnilateral && styles.unilateralTextActive,
                          ]}
                        >
                          {ej.esUnilateral ? 'D/I' : 'Bilateral'}
                        </Text>
                      </Pressable>

                      {ejercicios.length > 1 ? (
                        <Pressable
                          onPress={() => quitarEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.exerciseRemove,
                            pressed && styles.pressedSoft,
                          ]}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Quitar ejercicio"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={13}
                            color={DANGER}
                          />
                        </Pressable>
                      ) : null}
                    </View>

                    {ej.nombre.trim().length > 0 ? (
                      <View style={styles.exercisePreview}>
                        <View style={styles.gifBox}>
                          <EjercicioGif
                            uri={ej.gifUrl || gifInfo.gifUrl}
                            style={styles.gifPreview}
                            contentFit="contain"
                            animated={false}
                          />
                        </View>

                        <View style={styles.exercisePreviewCopy}>
                          <RutinaTextInput
                            placeholder="Nombre del ejercicio"
                            value={ej.nombre}
                            onChangeText={(val) =>
                              cambiarNombreEjercicio(ejIdx, val)
                            }
                            inputMode="text"
                            keyboardType="default"
                            autoCapitalize="words"
                            autoCorrect={false}
                            returnKeyType="done"
                            enterKeyHint="done"
                            style={styles.exerciseNameInput}
                            accessibilityLabel={`Nombre del ejercicio ${ejIdx + 1}`}
                          />

                          <View style={styles.tagRow}>
                            <View style={styles.tagMuscle}>
                              <Text style={styles.tagMuscleText}>
                                {musculo.toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.tagNeutral}>
                              <Text style={styles.tagNeutralText}>
                                {equipo.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => abrirBibliotecaParaEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.swapButton,
                            pressed && styles.pressedSoft,
                          ]}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel="Cambiar ejercicio"
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={14}
                            color={noir.platinum}
                          />
                          <Text style={styles.swapText}>Cambiar</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.emptyExercise}>
                        <Pressable
                          onPress={() => abrirBibliotecaParaEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.libraryInline,
                            pressed && styles.pressedSoft,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Seleccionar ejercicio de la biblioteca"
                        >
                          <View style={styles.libraryOrb}>
                            <Ionicons
                              name="barbell"
                              size={17}
                              color={noir.pearl}
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.libraryInlineTitle}>
                              Seleccionar de la biblioteca
                            </Text>
                            <Text
                              style={styles.libraryInlineSub}
                              numberOfLines={1}
                            >
                              1.300+ ejercicios con técnica y GIF
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color={noir.muted2}
                          />
                        </Pressable>

                        <RutinaTextInput
                          placeholder="O escribe un nombre manual…"
                          value={ej.nombre}
                          onChangeText={(val) =>
                            cambiarNombreEjercicio(ejIdx, val)
                          }
                          inputMode="text"
                          keyboardType="default"
                          autoCapitalize="words"
                          autoCorrect={false}
                          returnKeyType="done"
                          enterKeyHint="done"
                          style={styles.manualInput}
                          accessibilityLabel={`Nombre manual del ejercicio ${ejIdx + 1}`}
                        />
                      </View>
                    )}

                    {ej.esUnilateral ? (
                      <View style={styles.seriesPanel}>
                        <View style={styles.seriesHeaderRow}>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { width: 27 },
                            ]}
                          >
                            ST
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              styles.seriesHeaderAccentD,
                              { flex: 2 },
                            ]}
                          >
                            DERECHO (D)
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              styles.seriesHeaderAccentI,
                              { flex: 2 },
                            ]}
                          >
                            IZQUIERDO (I)
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { flex: 1 },
                            ]}
                          >
                            RIR
                          </Text>
                          <View style={{ width: 24 }} />
                        </View>

                        {ej.series.map((s, sIdx) => (
                          <View key={s.id} style={styles.seriesRow}>
                            <View style={styles.serieIndex}>
                              <Text style={styles.serieIndexText}>
                                #{sIdx + 1}
                              </Text>
                            </View>

                            <View
                              style={{
                                flex: 2,
                                minWidth: 0,
                                flexDirection: 'row',
                                gap: 3,
                              }}
                            >
                              <SerieCell
                                placeholder="KG"
                                keyboardType="decimal-pad"
                                inputMode="decimal"
                                returnKeyType="next"
                                enterKeyHint="next"
                                autoCorrect={false}
                                selectTextOnFocus
                                value={s.peso}
                                onChangeText={(val) =>
                                  cambiarCampoSerie(ejIdx, sIdx, 'peso', val)
                                }
                                style={{ flex: 1 }}
                              />
                              <SerieCell
                                placeholder="REPS"
                                keyboardType="number-pad"
                                inputMode="numeric"
                                returnKeyType="next"
                                enterKeyHint="next"
                                autoCorrect={false}
                                selectTextOnFocus
                                value={s.reps}
                                onChangeText={(val) =>
                                  cambiarCampoSerie(ejIdx, sIdx, 'reps', val)
                                }
                                style={{ flex: 1 }}
                              />
                            </View>

                            <View
                              style={{
                                flex: 2,
                                minWidth: 0,
                                flexDirection: 'row',
                                gap: 3,
                              }}
                            >
                              <SerieCell
                                placeholder="KG"
                                keyboardType="decimal-pad"
                                inputMode="decimal"
                                returnKeyType="next"
                                enterKeyHint="next"
                                autoCorrect={false}
                                selectTextOnFocus
                                value={
                                  s.pesoI !== undefined ? s.pesoI : s.peso
                                }
                                onChangeText={(val) =>
                                  cambiarCampoSerie(ejIdx, sIdx, 'pesoI', val)
                                }
                                style={{ flex: 1 }}
                              />
                              <SerieCell
                                placeholder="REPS"
                                keyboardType="number-pad"
                                inputMode="numeric"
                                returnKeyType="next"
                                enterKeyHint="next"
                                autoCorrect={false}
                                selectTextOnFocus
                                value={
                                  s.repsI !== undefined ? s.repsI : s.reps
                                }
                                onChangeText={(val) =>
                                  cambiarCampoSerie(ejIdx, sIdx, 'repsI', val)
                                }
                                style={{ flex: 1 }}
                              />
                            </View>

                            <SerieCell
                              placeholder="RIR"
                              keyboardType="number-pad"
                              inputMode="numeric"
                              maxLength={2}
                              returnKeyType="next"
                              enterKeyHint="next"
                              autoCorrect={false}
                              selectTextOnFocus
                              value={s.rir}
                              onChangeText={(val) =>
                                cambiarCampoSerie(ejIdx, sIdx, 'rir', val)
                              }
                              style={{ flex: 1 }}
                            />

                            <Pressable
                              onPress={() =>
                                quitarSerieDeEjercicio(ejIdx, sIdx)
                              }
                              disabled={ej.series.length === 1}
                              style={[
                                styles.removeSerie,
                                ej.series.length === 1 && { opacity: 0.22 },
                              ]}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel="Quitar serie"
                            >
                              <Ionicons
                                name="close"
                                size={13}
                                color={noir.muted2}
                              />
                            </Pressable>
                          </View>
                        ))}

                        <Pressable
                          onPress={() => agregarSerieAEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.addSerieButton,
                            pressed && { opacity: 0.8 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Añadir serie"
                        >
                          <Ionicons name="add" size={14} color={noir.platinum} />
                          <Text style={styles.addSerieText}>Añadir serie</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.seriesPanel}>
                        <View style={styles.seriesHeaderRow}>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { width: 27 },
                            ]}
                          >
                            ST
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { flex: 1.2 },
                            ]}
                          >
                            KG
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { flex: 1.2 },
                            ]}
                          >
                            REPS
                          </Text>
                          <Text
                            style={[
                              styles.seriesHeaderLabel,
                              { flex: 1 },
                            ]}
                          >
                            RIR
                          </Text>
                          {isLandscape || isTablet ? (
                            <Text
                              style={[
                                styles.seriesHeaderLabel,
                                { flex: 1.5 },
                              ]}
                            >
                              NOTAS
                            </Text>
                          ) : (
                            <View style={{ width: 30 }} />
                          )}
                          <View style={{ width: 24 }} />
                        </View>

                        {ej.series.map((s, sIdx) => {
                          const tieneNota = Boolean(s.nota && s.nota.trim());
                          const notaAbierta = Boolean(
                            notasExpandidas[s.id] || tieneNota
                          );

                          return (
                            <View key={s.id} style={styles.seriesRowBlock}>
                              <View style={styles.seriesRow}>
                                <View style={styles.serieIndex}>
                                  <Text style={styles.serieIndexText}>
                                    #{sIdx + 1}
                                  </Text>
                                </View>

                                <SerieCell
                                  placeholder="100"
                                  keyboardType="decimal-pad"
                                  inputMode="decimal"
                                  returnKeyType="next"
                                  enterKeyHint="next"
                                  autoCorrect={false}
                                  selectTextOnFocus
                                  value={s.peso}
                                  onChangeText={(val) =>
                                    cambiarCampoSerie(
                                      ejIdx,
                                      sIdx,
                                      'peso',
                                      val
                                    )
                                  }
                                  style={{ flex: 1.2 }}
                                />

                                <SerieCell
                                  placeholder="10"
                                  keyboardType="number-pad"
                                  inputMode="numeric"
                                  returnKeyType="next"
                                  enterKeyHint="next"
                                  autoCorrect={false}
                                  selectTextOnFocus
                                  value={s.reps}
                                  onChangeText={(val) =>
                                    cambiarCampoSerie(
                                      ejIdx,
                                      sIdx,
                                      'reps',
                                      val
                                    )
                                  }
                                  style={{ flex: 1.2 }}
                                />

                                <SerieCell
                                  placeholder="2"
                                  keyboardType="number-pad"
                                  inputMode="numeric"
                                  maxLength={2}
                                  returnKeyType="next"
                                  enterKeyHint="next"
                                  autoCorrect={false}
                                  selectTextOnFocus
                                  value={s.rir}
                                  onChangeText={(val) =>
                                    cambiarCampoSerie(
                                      ejIdx,
                                      sIdx,
                                      'rir',
                                      val
                                    )
                                  }
                                  style={{ flex: 1 }}
                                />

                                {isLandscape || isTablet ? (
                                  <SerieCell
                                    placeholder="Fallo / técnica"
                                    inputMode="text"
                                    keyboardType="default"
                                    autoCapitalize="sentences"
                                    returnKeyType="done"
                                    enterKeyHint="done"
                                    value={s.nota}
                                    onChangeText={(val) =>
                                      cambiarCampoSerie(
                                        ejIdx,
                                        sIdx,
                                        'nota',
                                        val
                                      )
                                    }
                                    style={[
                                      styles.serieNote,
                                      { flex: 1.5 },
                                    ]}
                                  />
                                ) : (
                                  <Pressable
                                    onPress={() => alternarNotaSerie(s.id)}
                                    hitSlop={6}
                                    style={[
                                      styles.noteToggle,
                                      tieneNota && styles.noteToggleActive,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Alternar nota de la serie"
                                  >
                                    <Ionicons
                                      name={
                                        tieneNota
                                          ? 'document-text'
                                          : 'document-text-outline'
                                      }
                                      size={15}
                                      color={
                                        tieneNota
                                          ? noir.champagne
                                          : noir.muted
                                      }
                                    />
                                  </Pressable>
                                )}

                                <Pressable
                                  onPress={() =>
                                    quitarSerieDeEjercicio(ejIdx, sIdx)
                                  }
                                  disabled={ej.series.length === 1}
                                  style={[
                                    styles.removeSerie,
                                    ej.series.length === 1 && { opacity: 0.22 },
                                  ]}
                                  hitSlop={6}
                                  accessibilityRole="button"
                                  accessibilityLabel="Quitar serie"
                                >
                                  <Ionicons
                                    name="close"
                                    size={13}
                                    color={noir.muted2}
                                  />
                                </Pressable>
                              </View>

                              {!isLandscape && !isTablet && notaAbierta ? (
                                <View style={styles.noteRow}>
                                  <SerieCell
                                    placeholder="Nota de la serie (fallo, drop set, técnica…)"
                                    inputMode="text"
                                    keyboardType="default"
                                    autoCapitalize="sentences"
                                    returnKeyType="done"
                                    enterKeyHint="done"
                                    value={s.nota}
                                    onChangeText={(val) =>
                                      cambiarCampoSerie(
                                        ejIdx,
                                        sIdx,
                                        'nota',
                                        val
                                      )
                                    }
                                    style={[
                                      styles.serieNote,
                                      styles.noteInput,
                                    ]}
                                  />
                                </View>
                              ) : null}
                            </View>
                          );
                        })}

                        <Pressable
                          onPress={() => agregarSerieAEjercicio(ejIdx)}
                          style={({ pressed }) => [
                            styles.addSerieButton,
                            pressed && { opacity: 0.8 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Añadir serie"
                        >
                          <Ionicons name="add" size={14} color={noir.platinum} />
                          <Text style={styles.addSerieText}>Añadir serie</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={styles.addExerciseArea}>
                <YoungNewtButton
                  title="Añadir desde la biblioteca"
                  fullWidth
                  onPress={abrirBibliotecaNuevo}
                />

                <Pressable
                  onPress={agregarEjercicio}
                  style={({ pressed }) => [
                    styles.addManualButton,
                    pressed && styles.pressedSoft,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Añadir ejercicio manual"
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={noir.muted}
                  />
                  <Text style={styles.addManualText}>
                    Añadir ejercicio manual
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerMetaRow}>
                <View style={styles.footerDot} />
                <Text style={styles.footerMeta} numberOfLines={1}>
                  {guardando
                    ? 'Sincronizando con tu biblioteca…'
                    : rutinaParaEditar
                      ? 'Los cambios se sincronizan con tu semana.'
                      : 'Disponible para asignar a cualquier día.'}
                </Text>
              </View>

              <LiquidMetalButton
                titulo={
                  guardando
                    ? 'Guardando…'
                    : rutinaParaEditar
                      ? 'Guardar cambios'
                      : 'Crear rutina'
                }
                onPress={guardar}
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

      <SelectorBibliotecaModal
        visible={modalBibliotecaVisible}
        onClose={() => setModalBibliotecaVisible(false)}
        onSeleccionar={handleSeleccionEjercicioBiblioteca}
      />
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
    backgroundColor: noir.pearl,
    shadowColor: '#E2EFFF',
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
  headerDangerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 138, 155, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.24)',
  },
  scheduleButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  scheduleButtonText: {
    flex: 1,
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 11.5,
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
  fieldPair: {
    gap: 14,
  },
  fieldPairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  fieldPairItem: {
    flex: 1,
    minWidth: 0,
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
  clearLink: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 10,
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
  helperText: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 1,
  },
  dayRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: noir.line,
    padding: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 11,
    elevation: 6,
  },
  dayCell: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellSelected: {
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
    // @ts-ignore boxShadow existe en react-native-web
    boxShadow:
      '0 7px 18px rgba(206, 225, 247, 0.22), 0 0 14px rgba(240, 248, 255, 0.14)',
  },
  dayCellPressed: {
    opacity: 0.82,
  },
  dayCellText: {
    color: noir.muted,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  dayCellTextSelected: {
    color: '#090B0F',
    fontFamily: fuentes.black,
  },
  dayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  dayDotSelected: {
    backgroundColor: 'rgba(9, 11, 15, 0.55)',
  },
  dayDotToday: {
    backgroundColor: noir.info,
  },
  planRailContent: {
    gap: 7,
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  planChip: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
  },
  planChipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#CEE1F7',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    // @ts-ignore boxShadow existe en react-native-web
    boxShadow:
      '0 7px 18px rgba(206, 225, 247, 0.20), 0 0 14px rgba(240, 248, 255, 0.12)',
  },
  planChipPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  planChipText: {
    color: noir.platinum,
    fontSize: 11.5,
    fontFamily: fuentes.medium,
  },
  planChipTextSelected: {
    color: '#090B0F',
    fontFamily: fuentes.bold,
  },
  planDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
  },
  planActiveBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  planActiveBadgeText: {
    fontSize: 7.5,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: noir.line,
    marginVertical: 1,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    padding: 13,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  exerciseIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  exerciseIndexText: {
    color: noir.pearl,
    fontFamily: fuentes.black,
    fontSize: 11,
    letterSpacing: -0.3,
  },
  exerciseHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseKicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  exerciseTitle: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 12.5,
    letterSpacing: -0.15,
    marginTop: 1,
  },
  unilateralChip: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: noir.glass,
  },
  unilateralChipActive: {
    backgroundColor: 'rgba(63, 242, 176, 0.10)',
    borderColor: 'rgba(63, 242, 176, 0.28)',
  },
  unilateralChipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  unilateralText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9,
  },
  unilateralTextActive: {
    color: noir.mint,
  },
  exerciseRemove: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 138, 155, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.16)',
  },
  exercisePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: noir.line,
    borderRadius: 14,
    padding: 8,
  },
  gifBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#06070B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifPreview: {
    width: '100%',
    height: '100%',
  },
  exercisePreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  exerciseNameInput: {
    fontSize: 12.5,
    fontFamily: fuentes.semiBold,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  tagMuscle: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(179, 148, 255, 0.12)',
    borderColor: 'rgba(179, 148, 255, 0.28)',
  },
  tagMuscleText: {
    color: noir.lavender,
    fontSize: 7.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.4,
  },
  tagNeutral: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: noir.glass,
    borderColor: noir.line,
  },
  tagNeutralText: {
    color: noir.muted,
    fontSize: 7.5,
    fontFamily: fuentes.medium,
    letterSpacing: 0.4,
  },
  swapButton: {
    width: 54,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  swapText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 8,
  },
  emptyExercise: {
    gap: 8,
  },
  libraryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  libraryOrb: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#090B0F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryInlineTitle: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 12,
  },
  libraryInlineSub: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10,
    marginTop: 1,
  },
  manualInput: {
    fontSize: 12.5,
    paddingVertical: 9,
  },
  seriesPanel: {
    gap: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderWidth: 1,
    borderColor: noir.line,
    borderRadius: 16,
    padding: 9,
  },
  seriesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 1,
  },
  seriesHeaderLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  seriesHeaderAccentD: {
    color: noir.mint,
  },
  seriesHeaderAccentI: {
    color: noir.champagne,
  },
  seriesRowBlock: {
    gap: 5,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  serieIndex: {
    width: 27,
    alignItems: 'center',
  },
  serieIndexText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 10.5,
  },
  serieCell: {
    minWidth: 0,
    minHeight: 38,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    color: noir.text,
    fontSize: 11.5,
    fontFamily: fuentes.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 9,
  },
  serieCellFocused: {
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  serieNote: {
    textAlign: 'left',
    paddingHorizontal: 8,
    fontSize: 11,
  },
  noteToggle: {
    width: 30,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.line,
  },
  noteToggleActive: {
    backgroundColor: 'rgba(255, 209, 102, 0.10)',
    borderColor: 'rgba(255, 209, 102, 0.30)',
  },
  noteRow: {
    paddingLeft: 32,
    paddingRight: 30,
  },
  noteInput: {
    minHeight: 34,
    fontSize: 11,
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  removeSerie: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSerieButton: {
    height: 34,
    marginTop: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: noir.lineStrong,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addSerieText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 10.5,
  },
  addExerciseArea: {
    gap: 8,
    marginTop: 2,
  },
  addManualButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: noir.line,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  addManualText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 11,
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

