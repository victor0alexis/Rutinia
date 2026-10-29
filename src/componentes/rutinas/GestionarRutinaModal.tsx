import { styles } from './GestionarRutinaModal.estilos';
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
} from '../../constantes/colores';
import PanelBrillo from '../comunes/PanelBrillo';
import { BotonMetalLiquido } from '../efectos/BotonMetalLiquido';
import TextoBrillante from '../efectos/TextoBrillante';
import BotonYoungNewt from '../comunes/BotonYoungNewt';
import SelectorBibliotecaModal, { EjercicioSeleccionadoBiblioteca } from '../biblioteca/SelectorBibliotecaModal';
import { obtenerGifEjercicio } from '../../servicios/ejerciciosGifs';
import EjercicioGif from '../entrenamiento/EjercicioGif';
import { crearRutina, eliminarRutina, actualizarRutina } from '../../servicios/rutinas';
import { seguro, confirmarAccion, mostrarMensaje } from '../../utilidades/errores';
import { parsearEjercicioInfo } from '../../utilidades/ejercicios';
import { listarPlanes } from '../../servicios/planes';
import { PlanEntrenamiento, Rutina } from '../../tipos';
import { useLayout } from '../../hooks/useLayout';
import { vibrarBoton } from '../../utilidades/hapticos';

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
  const { isLandscape, isTablet, gutter, contentMaxWidth, barBottomPadding } = useLayout();
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
              paddingBottom: Math.max(12, barBottomPadding + 8),
              height: isLandscape ? '98%' : '94%',
            },
          ]}
        >
          <PanelBrillo radius={30} style={styles.sheet}>
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
                  <TextoBrillante
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

              <View style={styles.fieldPair}>
                {planesDisponibles.length > 0 ? (
                  <View style={styles.field}>
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

                <View style={styles.field}>
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
                <BotonYoungNewt
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

              <BotonMetalLiquido
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
          </PanelBrillo>
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
