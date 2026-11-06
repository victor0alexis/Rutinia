import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { vibrarBoton } from '../../utilidades/hapticos';
import { calcular1RMEstimado, estadoRangoRepeticiones } from '../../utilidades/calculadoraFuerza';
import { useLayout } from '../../hooks/useLayout';
import type { CargaSerie, TipoCarga } from '../../tipos';
import { calcularKgDesdeCarga, formatearComposicionDiscos, PREFERENCIA_CARGA_POR_DEFECTO, type PreferenciaCargaEjercicio } from '../../utilidades/cargasEjercicio';

export type CampoEntrenamiento = 'peso' | 'reps' | 'rir' | 'pesoI' | 'repsI' | 'parciales';

type Props = {
  visible: boolean;
  modo: CampoEntrenamiento;
  valorActual: string;
  nombreEjercicio: string;
  serieNumero: number;
  pesoPara1RM?: string;
  repsPara1RM?: string;
  repsMin?: number;
  repsMax?: number;
  modoReps?: 'reps' | 'rango';
  onChangeRango?: (repsMin?: number, repsMax?: number) => void;
  estadoSerie?: 'normal' | 'fallo' | 'no_hecha';
  valorPrevioSugerido?: string;
  carga?: CargaSerie;
  tipoCarga?: TipoCarga;
  preferenciaCarga?: PreferenciaCargaEjercicio;
  onChangeCarga?: (carga: CargaSerie, pesoKg: number | null) => void;
  esUnilateral?: boolean;
  lado?: 'D' | 'I';
  onChangeValor: (val: string) => void;
  onNext: () => void;
  onCompletarSerie: () => void;
  onClose: () => void;
  /** Notifica la altura real del panel para mantener el campo activo visible. */
  onMedirAltura?: (altura: number) => void;
};

export default function TecladoEntrenamientoInteligente({
  visible,
  modo,
  valorActual,
  nombreEjercicio,
  serieNumero,
  pesoPara1RM,
  repsPara1RM,
  repsMin,
  repsMax,
  modoReps = 'reps',
  onChangeRango,
  estadoSerie = 'normal',
  valorPrevioSugerido,
  carga,
  tipoCarga: tipoCargaProp = 'kg',
  preferenciaCarga = PREFERENCIA_CARGA_POR_DEFECTO,
  onChangeCarga,
  esUnilateral = false,
  lado,
  onChangeValor,
  onNext,
  onCompletarSerie,
  onClose,
  onMedirAltura,
}: Props) {
  const { barBottomPadding, isLandscape, isTablet } = useLayout();
  const [campoRangoActivo, setCampoRangoActivo] = useState<'reps' | 'min' | 'max'>('reps');
  const [rangoMinTexto, setRangoMinTexto] = useState(repsMin != null ? String(repsMin) : '');
  const [rangoMaxTexto, setRangoMaxTexto] = useState(repsMax != null ? String(repsMax) : '');
  // La unidad la decide el encabezado de la tabla; el teclado solo introduce valores.
  const tipoCarga: TipoCarga = tipoCargaProp;
  const esPeso = modo === 'peso' || modo === 'pesoI';
  const esRIR = modo === 'rir';
  const esParciales = modo === 'parciales';
  const esModoRango = modoReps === 'rango' && (modo === 'reps' || modo === 'repsI');
  const esPlacas = esPeso && tipoCarga === 'placas';
  const esDiscos = esPeso && (tipoCarga === 'discos_barra' || tipoCarga === 'discos_maquina');
  const aceptaDecimales = esPeso && tipoCarga === 'kg';
  const mostrarTecladoNumerico = !esPeso || tipoCarga === 'kg' || tipoCarga === 'placas';

  const rangoMinNum = rangoMinTexto ? parseInt(rangoMinTexto, 10) : undefined;
  const rangoMaxNum = rangoMaxTexto ? parseInt(rangoMaxTexto, 10) : undefined;
  const rangoValido =
    (rangoMinNum == null || (rangoMinNum >= 1 && rangoMinNum <= 100)) &&
    (rangoMaxNum == null || (rangoMaxNum >= 1 && rangoMaxNum <= 100)) &&
    (rangoMinNum == null || rangoMaxNum == null || rangoMinNum <= rangoMaxNum);
  const editandoRango = esModoRango && campoRangoActivo !== 'reps';
  const valorEditable = editandoRango
    ? campoRangoActivo === 'min'
      ? rangoMinTexto
      : rangoMaxTexto
    : valorActual;

  const actualizarValorEditable = useCallback(
    (texto: string) => {
      if (!editandoRango) {
        onChangeValor(texto);
        return;
      }
      const limpio = texto.replace(/[^0-9]/g, '').slice(0, 3);
      if (campoRangoActivo === 'min') setRangoMinTexto(limpio);
      else setRangoMaxTexto(limpio);

      const nextMin = campoRangoActivo === 'min' ? limpio : rangoMinTexto;
      const nextMax = campoRangoActivo === 'max' ? limpio : rangoMaxTexto;
      const min = nextMin ? parseInt(nextMin, 10) : undefined;
      const max = nextMax ? parseInt(nextMax, 10) : undefined;
      const valido =
        (min == null || (min >= 1 && min <= 100)) &&
        (max == null || (max >= 1 && max <= 100)) &&
        (min == null || max == null || min <= max);
      if (valido) onChangeRango?.(min, max);
    },
    [editandoRango, campoRangoActivo, rangoMinTexto, rangoMaxTexto, onChangeRango, onChangeValor]
  );

  const cargaDiscos = carga?.tipo === tipoCarga ? carga.discosPorLado || [] : [];
  const baseDiscos =
    tipoCarga === 'discos_barra' ? preferenciaCarga.pesoBarra : preferenciaCarga.pesoBase;
  const cargaDiscosActual: CargaSerie = {
    tipo: tipoCarga,
    pesoBase: baseDiscos,
    discosPorLado: cargaDiscos,
  };
  const totalDiscos = calcularKgDesdeCarga(cargaDiscosActual, preferenciaCarga);
  const totalPlacasKg =
    preferenciaCarga.kgPorPlaca != null
      ? Math.round(
          Math.max(0, parseInt(valorActual, 10) || 0) * preferenciaCarga.kgPorPlaca * 100
        ) / 100
      : null;

  const agregarDisco = (disco: number) => {
    const lista = cargaDiscos.map((item) => ({ ...item }));
    const existente = lista.find((item) => item.disco === disco);
    if (existente) existente.cantidadPorLado += 1;
    else lista.push({ disco, cantidadPorLado: 1 });
    const nueva: CargaSerie = { tipo: tipoCarga, pesoBase: baseDiscos, discosPorLado: lista };
    vibrarBoton(10);
    onChangeCarga?.(nueva, calcularKgDesdeCarga(nueva, preferenciaCarga));
  };
  const quitarDisco = (disco: number) => {
    const lista = cargaDiscos.map((item) => ({ ...item }));
    const indice = lista.findIndex((item) => item.disco === disco);
    if (indice < 0) return;
    if (lista[indice].cantidadPorLado > 1) lista[indice].cantidadPorLado -= 1;
    else lista.splice(indice, 1);
    const nueva: CargaSerie = { tipo: tipoCarga, pesoBase: baseDiscos, discosPorLado: lista };
    vibrarBoton(12);
    onChangeCarga?.(nueva, calcularKgDesdeCarga(nueva, preferenciaCarga));
  };
  const cambiarPlacas = (delta: number) => {
    const actual = Math.max(0, parseInt(valorActual, 10) || 0);
    const placasNuevas = Math.max(0, actual + delta);
    const nueva: CargaSerie = { tipo: 'placas', placas: placasNuevas };
    vibrarBoton(12);
    onChangeCarga?.(nueva, calcularKgDesdeCarga(nueva, preferenciaCarga));
  };

  // 1RM estimado en tiempo real. En placas/discos se calcula con el total en kg.
  const estimacion1RM = useMemo(() => {
    const p = esPeso && tipoCarga === 'kg' ? valorActual : pesoPara1RM;
    const r = modo === 'reps' || modo === 'repsI' ? valorActual : repsPara1RM;
    if (!p || !r || estadoSerie === 'no_hecha') return null;
    return calcular1RMEstimado(p, r);
  }, [valorActual, pesoPara1RM, repsPara1RM, esPeso, tipoCarga, modo, estadoSerie]);
  const estadoReps = estadoRangoRepeticiones(modo === 'reps' || modo === 'repsI' ? valorActual : '', repsMin, repsMax);

  // Cálculo de discos olímpicos

  // Lógica de digitación
  const presionarDigito = useCallback(
    (d: string) => {
      vibrarBoton(10);
      if (!valorEditable || valorEditable === '0') {
        actualizarValorEditable(d);
        return;
      }
      if (esParciales && valorEditable.length >= 2) return; // Limitar reps parciales a 2 dígitos
      if (esPlacas && valorEditable.length >= 3) return; // Placas: máximo 3 dígitos
      if (editandoRango && valorEditable.length >= 3) return;
      if (!editandoRango && valorEditable.length >= 6) return; // Limitar longitud
      actualizarValorEditable(valorEditable + d);
    },
    [valorEditable, esParciales, esPlacas, editandoRango, actualizarValorEditable]
  );

  const presionarPunto = useCallback(() => {
    vibrarBoton(10);
    if (!valorActual) {
      onChangeValor('0.');
      return;
    }
    if (valorActual.includes('.')) return;
    onChangeValor(valorActual + '.');
  }, [valorActual, onChangeValor]);

  const presionarBackspace = useCallback(() => {
    vibrarBoton(12);
    if (!valorEditable || valorEditable.length <= 1) {
      actualizarValorEditable('');
      return;
    }
    actualizarValorEditable(valorEditable.slice(0, -1));
  }, [valorEditable, actualizarValorEditable]);

  const limpiar = () => {
    vibrarBoton(15);
    actualizarValorEditable('');
  };

  const manejarSiguiente = () => {
    if (esModoRango && campoRangoActivo !== 'reps') {
      vibrarBoton(12);
      setCampoRangoActivo('reps');
      return;
    }
    onNext();
  };

  const manejarCompletar = () => {
    if (esModoRango && !rangoValido) {
      vibrarBoton(20);
      return;
    }
    onCompletarSerie();
  };

  // Soporte para teclado físico en Web (Desktop / Laptop)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un campo de texto normal (ej. notas)
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        presionarDigito(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        if (aceptaDecimales) presionarPunto();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        presionarBackspace();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        vibrarBoton(15);
        if (esModoRango && campoRangoActivo !== 'reps') {
          setCampoRangoActivo('reps');
        } else {
          onNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, aceptaDecimales, esModoRango, campoRangoActivo, onNext, onClose, presionarDigito, presionarPunto, presionarBackspace]);

  // Ajustes rápidos (+/- kilos)
  const ajustarPeso = (delta: number) => {
    vibrarBoton(15);
    const actual = parseFloat(valorActual.replace(',', '.')) || 0;
    const nuevo = Math.max(0, Math.round((actual + delta) * 100) / 100);
    onChangeValor(nuevo === 0 ? '' : nuevo.toString());
  };

  // Chips rápidos de repeticiones
  const seleccionarRepsRapidas = (r: number) => {
    vibrarBoton(15);
    actualizarValorEditable(r.toString());
  };

  // Chips rápidos de RIR
  const seleccionarRIR = (rir: string) => {
    vibrarBoton(15);
    onChangeValor(rir);
  };

  // Etiqueta del modo activo
  const etiquetaCampo = () => {
    switch (modo) {
      case 'peso':
        return esPlacas
          ? 'PESO DERECHO (PLACAS)'
          : esDiscos
          ? 'DISCOS POR LADO · TOTAL'
          : esUnilateral
          ? 'PESO DERECHO (KG)'
          : 'CARGA / PESO (KG)';
      case 'pesoI':
        return esPlacas
          ? 'PESO IZQUIERDO (PLACAS)'
          : esDiscos
          ? 'DISCOS POR LADO · I · TOTAL'
          : 'PESO IZQUIERDO (KG)';
      case 'reps':
        if (esModoRango) {
          if (campoRangoActivo === 'min') return 'RANGO · MÍNIMO';
          if (campoRangoActivo === 'max') return 'RANGO · MÁXIMO';
        }
        return esUnilateral ? 'REPS DERECHO' : 'REPETICIONES';
      case 'repsI':
        if (esModoRango) {
          if (campoRangoActivo === 'min') return 'RANGO · MÍNIMO';
          if (campoRangoActivo === 'max') return 'RANGO · MÁXIMO';
        }
        return 'REPS IZQUIERDO';
      case 'rir':
        return 'REPS EN RESERVA (RIR)';
      case 'parciales':
        return 'REPETICIONES PARCIALES (+p)';
      default:
        return 'VALOR';
    }
  };

  const unidad = esPeso
    ? tipoCarga === 'placas'
      ? 'placas'
      : 'kg'
    : esRIR
    ? 'RIR'
    : esParciales
    ? '+ reps'
    : 'reps';
  const mostrarToolbar =
    (esPeso && (tipoCarga === 'kg' || tipoCarga === 'placas')) ||
    modo === 'reps' ||
    modo === 'repsI' ||
    esRIR ||
    esParciales;
  const unidadPrevia = esPlacas ? ' pl' : esPeso ? ' kg' : esParciales ? 'p' : ' reps';

  if (!visible) return null;

  return (
    <View
      style={[
        styles.contenedorOverlay,
        {
          paddingBottom: Math.max(barBottomPadding, 8),
        },
      ]}
      onLayout={(event) => onMedirAltura?.(event.nativeEvent.layout.height)}
    >
      <View
        style={[
          styles.panelPrincipal,
          (isLandscape || isTablet) && styles.panelCentrado,
        ]}
      >
        <View style={styles.kbHandle} />

        {/* BARRA SUPERIOR: contexto de la serie */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1, marginRight: 8, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.nombreEjercicioText} numberOfLines={1}>
                {nombreEjercicio}
              </Text>
              <View style={styles.badgeSerie}>
                <Text style={styles.badgeSerieText}>
                  Serie #{serieNumero}
                  {esUnilateral && lado ? ` • Lado ${lado}` : ''}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => {
              vibrarBoton(10);
              onClose();
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.btnCerrar, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Cerrar teclado"
          >
            <Ionicons name="chevron-down" size={18} color={noir.platinum} />
          </Pressable>
        </View>

        {/* DISPLAY GRANDE DEL VALOR ACTIVO */}
        <View style={styles.kbDisplay}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kbDisplayLabel}>{etiquetaCampo()}</Text>
            <View style={styles.kbDisplayValueRow}>
              <Text style={styles.kbDisplayValue} numberOfLines={1}>
                {valorEditable || '0'}
              </Text>
              <Text style={styles.kbDisplayUnit}>{editandoRango ? 'reps' : unidad}</Text>
            </View>
            <Text style={styles.kbDisplayHint} numberOfLines={1}>
              {esModoRango
                ? `Rango ${rangoMinTexto || '—'}–${rangoMaxTexto || '—'} reps${!rangoValido ? ' · Revisa los valores' : estadoSerie === 'no_hecha' ? ' · NO HECHA' : estadoSerie === 'fallo' ? ' · FALLO' : estadoReps === 'en_rango' ? ' · En rango' : estadoReps === 'bajo' ? ' · Bajo' : estadoReps === 'sobre' ? ' · Sube carga' : ''}`
                : modo === 'reps' && repsMin && repsMax
                ? `Objetivo ${repsMin}${repsMin === repsMax ? '' : `–${repsMax}`} reps${estadoSerie === 'no_hecha' ? ' · NO HECHA' : estadoSerie === 'fallo' ? ' · FALLO' : estadoReps === 'en_rango' ? ' · En rango' : estadoReps === 'bajo' ? ' · Bajo' : estadoReps === 'sobre' ? ' · Sube carga' : ''}`
                : esPlacas
                ? `Total ${
                    totalPlacasKg != null ? `${totalPlacasKg} kg` : 'sin equivalencia kg'
                  }${valorPrevioSugerido ? ` · Previa ${valorPrevioSugerido} pl` : ''}`
                : esDiscos
                ? `${tipoCarga === 'discos_barra' ? 'Barra' : 'Base'} ${baseDiscos} kg + ${formatearComposicionDiscos(cargaDiscos)} = ${totalDiscos ?? '—'} kg`
                : valorPrevioSugerido
                ? `Previa ${valorPrevioSugerido}${unidadPrevia}`
                : 'Ajusta el valor con el teclado'}
            </Text>
          </View>

          {estimacion1RM !== null && (
            <View style={styles.kb1RM}>
              <Ionicons name="flame" size={11} color={noir.champagne} />
              <View>
                <Text style={styles.kb1RMLabel}>1RM EST.</Text>
                <Text style={styles.kb1RMValue}>{estimacion1RM} kg</Text>
              </View>
            </View>
          )}
        </View>

        {esModoRango && (
          <View style={styles.rangoEditor}>
            <Text style={styles.rangoEditorLabel}>RANGO OBJETIVO</Text>
            <View style={styles.rangoEditorRow}>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setCampoRangoActivo('min');
                }}
                style={[
                  styles.rangoCampo,
                  campoRangoActivo === 'min' && styles.rangoCampoActivo,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Editar repeticiones mínimas"
              >
                <Text style={styles.rangoCampoLabel}>MÍN</Text>
                <Text style={styles.rangoCampoValor}>{rangoMinTexto || '—'}</Text>
              </Pressable>
              <Text style={styles.rangoSeparador}>–</Text>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setCampoRangoActivo('max');
                }}
                style={[
                  styles.rangoCampo,
                  campoRangoActivo === 'max' && styles.rangoCampoActivo,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Editar repeticiones máximas"
              >
                <Text style={styles.rangoCampoLabel}>MÁX</Text>
                <Text style={styles.rangoCampoValor}>{rangoMaxTexto || '—'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setCampoRangoActivo('reps');
                }}
                style={[
                  styles.rangoCampo,
                  styles.rangoCampoReales,
                  campoRangoActivo === 'reps' && styles.rangoCampoActivo,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Editar repeticiones realizadas"
              >
                <Text style={styles.rangoCampoLabel}>REALES</Text>
                <Text style={styles.rangoCampoValor}>{valorActual || '0'}</Text>
              </Pressable>
            </View>
            {!rangoValido && (
              <Text style={styles.rangoError}>
                Usa valores de 1 a 100. El mínimo no puede superar el máximo.
              </Text>
            )}
          </View>
        )}

        {/* COMPOSITOR DE DISCOS: solo introduce la carga; la configuración vive en el encabezado */}
        {esDiscos && (
          <View style={styles.barraDiscos}>
            <View style={styles.barraDiscosHeader}>
              <Ionicons name="disc-outline" size={11} color={noir.info} />
              <Text style={styles.barraDiscosTitulo}>DISCOS POR LADO</Text>
              <Text style={styles.barraDiscosTotal} numberOfLines={1}>
                {tipoCarga === 'discos_barra'
                  ? `Barra ${preferenciaCarga.pesoBarra} kg`
                  : `Base ${preferenciaCarga.pesoBase} kg`}
                {' · '}
                {formatearComposicionDiscos(cargaDiscos)}
                {' · '}
                {totalDiscos ?? '—'} kg
              </Text>
            </View>
            {preferenciaCarga.discosDisponibles.length > 0 ? (
              <View style={styles.discosRow}>
                {preferenciaCarga.discosDisponibles.map((disco) => (
                  <Pressable
                    key={disco}
                    onPress={() => agregarDisco(disco)}
                    style={({ pressed }) => [styles.chipDisco, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={`Añadir disco de ${disco} kilos por lado`}
                  >
                    <Text style={styles.chipDiscoPeso}>+{disco}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.discosVacio}>
                Configura los discos disponibles desde el encabezado de Carga.
              </Text>
            )}
            {cargaDiscos.length > 0 && (
              <View style={[styles.discosRow, { marginTop: 6 }]}>
                <Text style={styles.discosVacio}>Quitar:</Text>
                {cargaDiscos.map((item) => (
                  <Pressable
                    key={item.disco}
                    onPress={() => quitarDisco(item.disco)}
                    style={({ pressed }) => [
                      styles.chipDisco,
                      styles.chipDiscoQuitar,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityLabel={`Quitar un disco de ${item.disco} kilos por lado`}
                  >
                    <Text style={styles.chipDiscoCant}>{item.cantidadPorLado}×</Text>
                    <Text style={styles.chipDiscoPeso}>{item.disco}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* BARRA DE HERRAMIENTAS RÁPIDAS (SEGÚN MODO) */}
        {mostrarToolbar && (
          <View style={styles.toolbarRapida}>
            {esPeso && tipoCarga === 'kg' && (
              <>
                {/* Botones de incremento / decremento rápido */}
                <View style={styles.steppersRow}>
                  <Pressable
                    onPress={() => ajustarPeso(-2.5)}
                    style={({ pressed }) => [styles.btnStepper, pressed && styles.btnStepperPressed]}
                  >
                    <Text style={styles.btnStepperText}>-2.5</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => ajustarPeso(1.25)}
                    style={({ pressed }) => [styles.btnStepper, pressed && styles.btnStepperPressed]}
                  >
                    <Text style={styles.btnStepperText}>+1.25</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => ajustarPeso(2.5)}
                    style={({ pressed }) => [styles.btnStepper, styles.btnStepperAccent, pressed && styles.btnStepperPressed]}
                  >
                    <Text style={[styles.btnStepperText, { color: noir.info }]}>+2.5</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => ajustarPeso(5)}
                    style={({ pressed }) => [styles.btnStepper, pressed && styles.btnStepperPressed]}
                  >
                    <Text style={styles.btnStepperText}>+5</Text>
                  </Pressable>
                </View>

                {/* Botón Copiar Previo */}
                {Boolean(valorPrevioSugerido) && (
                  <Pressable
                    onPress={() => {
                      vibrarBoton(12);
                      if (valorPrevioSugerido) onChangeValor(valorPrevioSugerido);
                    }}
                    style={({ pressed }) => [styles.btnAccionEspecial, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.btnCopiarText}>= {valorPrevioSugerido}kg</Text>
                  </Pressable>
                )}
              </>
            )}

            {esPlacas && (
              <View style={styles.steppersRow}>
                <Pressable
                  onPress={() => cambiarPlacas(-1)}
                  style={({ pressed }) => [styles.btnStepper, pressed && styles.btnStepperPressed]}
                >
                  <Text style={styles.btnStepperText}>−1 placa</Text>
                </Pressable>
                <Pressable
                  onPress={() => cambiarPlacas(1)}
                  style={({ pressed }) => [styles.btnStepper, styles.btnStepperAccent, pressed && styles.btnStepperPressed]}
                >
                  <Text style={[styles.btnStepperText, { color: noir.info }]}>+1 placa</Text>
                </Pressable>
                {Boolean(valorPrevioSugerido) && (
                  <Pressable
                    onPress={() => {
                      vibrarBoton(12);
                      if (valorPrevioSugerido) onChangeValor(valorPrevioSugerido);
                    }}
                    style={({ pressed }) => [styles.btnAccionEspecial, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.btnCopiarText}>= {valorPrevioSugerido} pl</Text>
                  </Pressable>
                )}
              </View>
            )}

          {/* MODO REPS: Chips de repeticiones frecuentes */}
          {(modo === 'reps' || modo === 'repsI') && (
            <View style={styles.chipsRepsRow}>
              {[6, 8, 10, 12, 15].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => seleccionarRepsRapidas(num)}
                  style={({ pressed }) => [
                    styles.chipRep,
                    valorEditable === num.toString() && styles.chipRepActivo,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipRepText,
                      valorEditable === num.toString() && styles.chipRepTextActivo,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}

              {Boolean(valorPrevioSugerido) && (
                <Pressable
                  onPress={() => {
                    vibrarBoton(12);
                    if (valorPrevioSugerido) actualizarValorEditable(valorPrevioSugerido);
                  }}
                  style={({ pressed }) => [styles.btnAccionEspecial, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.btnCopiarText}>= {valorPrevioSugerido}r</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* MODO RIR: Selector directo */}
          {esRIR && (
            <View style={styles.chipsRIRRow}>
              {['0', '1', '2', '3', '4', '5'].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => seleccionarRIR(r)}
                  style={({ pressed }) => [
                    styles.chipRIR,
                    valorActual === r && styles.chipRIRActivo,
                    r === '0' && styles.chipRIRFallo,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipRIRText,
                      valorActual === r && styles.chipRIRTextActivo,
                      r === '0' && { color: '#EF4444' },
                    ]}
                  >
                    {r === '0' ? '0' : r}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* MODO PARCIALES: Selector directo de repeticiones tras el fallo */}
          {esParciales && (
            <View style={styles.chipsRepsRow}>
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => seleccionarRepsRapidas(num)}
                  style={({ pressed }) => [
                    styles.chipRep,
                    valorActual === num.toString() && {
                      backgroundColor: 'rgba(245, 158, 11, 0.25)',
                      borderColor: '#F59E0B',
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipRepText,
                      valorActual === num.toString() && { color: '#F59E0B', fontFamily: fuentes.extraBold },
                    ]}
                  >
                    +{num}p
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          </View>
        )}

        {/* TECLADO NUMÉRICO TÁCTIL (GRID 3x4 + COLUMNA DE ACCIÓN) */}
        <View style={styles.gridContenedor}>
          {mostrarTecladoNumerico && (
            <View style={styles.gridNumerico}>
            {/* FILA 1 */}
            <View style={styles.tecladoFila}>
              <TeclaNum digito="1" onPress={presionarDigito} />
              <TeclaNum digito="2" onPress={presionarDigito} />
              <TeclaNum digito="3" onPress={presionarDigito} />
            </View>

            {/* FILA 2 */}
            <View style={styles.tecladoFila}>
              <TeclaNum digito="4" onPress={presionarDigito} />
              <TeclaNum digito="5" onPress={presionarDigito} />
              <TeclaNum digito="6" onPress={presionarDigito} />
            </View>

            {/* FILA 3 */}
            <View style={styles.tecladoFila}>
              <TeclaNum digito="7" onPress={presionarDigito} />
              <TeclaNum digito="8" onPress={presionarDigito} />
              <TeclaNum digito="9" onPress={presionarDigito} />
            </View>

            {/* FILA 4 */}
            <View style={styles.tecladoFila}>
              {aceptaDecimales ? (
                <Pressable
                  onPress={presionarPunto}
                  style={({ pressed }) => [styles.teclaBtn, pressed && styles.teclaBtnPressed]}
                >
                  <Text style={styles.teclaPuntoText}>.</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={limpiar}
                  style={({ pressed }) => [styles.teclaBtn, styles.teclaAccionSecundaria, pressed && styles.teclaBtnPressed]}
                >
                  <Text style={styles.teclaLimpiarText}>C</Text>
                </Pressable>
              )}

              <TeclaNum digito="0" onPress={presionarDigito} />

              <Pressable
                onPress={presionarBackspace}
                onLongPress={limpiar}
                delayLongPress={300}
                style={({ pressed }) => [styles.teclaBtn, styles.teclaAccionSecundaria, pressed && styles.teclaBtnPressed]}
              >
                <Ionicons name="backspace-outline" size={19} color={noir.platinum} />
              </Pressable>
            </View>
          </View>
          )}

          {/* COLUMNA DE ACCIONES DE FLUJO */}
          <View style={[styles.columnaFlujo, !mostrarTecladoNumerico && styles.columnaFlujoAncha]}>
            {/* BOTÓN SIGUIENTE */}
            <Pressable
              onPress={manejarSiguiente}
              style={({ pressed }) => [styles.btnFlujoSiguiente, pressed && styles.btnFlujoPressed]}
              accessibilityLabel={esModoRango && campoRangoActivo !== 'reps' ? 'Editar repeticiones realizadas' : 'Siguiente campo'}
            >
              <Ionicons name="arrow-forward" size={17} color={noir.info} />
              <Text style={styles.btnFlujoSiguienteText}>
                {esModoRango && campoRangoActivo !== 'reps' ? 'Reales' : 'Sig.'}
              </Text>
            </Pressable>

            {/* BOTÓN CONFIRMAR Y COMPLETAR SERIE */}
            <Pressable
              onPress={manejarCompletar}
              style={({ pressed }) => [styles.btnFlujoCompletar, pressed && styles.btnFlujoPressed]}
              accessibilityLabel="Completar serie"
            >
              <LinearGradient
                colors={['#8CFFD6', noir.mint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 8 }]}
              />
              <Ionicons name="checkmark-circle" size={19} color="#06120D" />
              <Text style={styles.btnFlujoCompletarText}>Hecha</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function TeclaNum({ digito, onPress }: { digito: string; onPress: (d: string) => void }) {
  return (
    <Pressable
      onPress={() => onPress(digito)}
      style={({ pressed }) => [styles.teclaBtn, pressed && styles.teclaBtnPressed]}
    >
      <Text style={styles.teclaNumText}>{digito}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    backgroundColor: 'rgba(9, 11, 16, 0.985)',
  },
  panelPrincipal: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: 'rgba(9, 11, 16, 0.985)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 24,
  },
  panelCentrado: {
    maxWidth: 620,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kbHandle: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginBottom: 7,
  },

  /* HEADER */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  nombreEjercicioText: {
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
    flexShrink: 1,
  },
  badgeSerie: {
    backgroundColor: 'rgba(179, 148, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.2)',
  },
  badgeSerieText: {
    color: '#E6DCFF',
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.2,
  },
  campoActivoText: {
    color: noir.info,
    fontSize: 7.4,
    fontFamily: fuentes.bold,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  btnCerrar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 15,
  },

  /* DISPLAY */
  kbDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 7,
  },
  kbDisplayLabel: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7.2,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  kbDisplayValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 1,
  },
  kbDisplayValue: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 29,
    lineHeight: 31,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  kbDisplayUnit: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 10,
    marginLeft: 4,
    marginBottom: 4,
  },
  kbDisplayHint: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 7.4,
    marginTop: 1,
  },
  kb1RM: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 209, 102, 0.065)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  kb1RMLabel: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 6.4,
    letterSpacing: 0.55,
  },
  kb1RMValue: {
    color: '#FFE6A8',
    fontFamily: fuentes.black,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  /* RANGO OBJETIVO */
  rangoEditor: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.16)',
    backgroundColor: 'rgba(63, 242, 176, 0.035)',
  },
  rangoEditorLabel: {
    color: noir.mint,
    fontFamily: fuentes.bold,
    fontSize: 7.2,
    letterSpacing: 0.65,
    marginBottom: 5,
  },
  rangoEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangoCampo: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  rangoCampoReales: {
    borderColor: 'rgba(92, 200, 255, 0.16)',
    backgroundColor: 'rgba(92, 200, 255, 0.035)',
  },
  rangoCampoActivo: {
    borderColor: 'rgba(63, 242, 176, 0.55)',
    backgroundColor: 'rgba(63, 242, 176, 0.1)',
  },
  rangoCampoLabel: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 6.6,
    letterSpacing: 0.5,
  },
  rangoCampoValor: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 16,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  rangoSeparador: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  rangoError: {
    color: '#F08A9B',
    fontFamily: fuentes.medium,
    fontSize: 7.2,
    marginTop: 4,
  },

  /* BARRA DISCOS */
  barraDiscos: {
    backgroundColor: 'rgba(92, 200, 255, 0.035)',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.14)',
  },
  barraDiscosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  barraDiscosTitulo: {
    color: '#CDEEFF',
    fontSize: 7.6,
    fontFamily: fuentes.bold,
    letterSpacing: 0.15,
  },
  barraDiscosTotal: {
    flex: 1,
    color: noir.muted,
    fontSize: 7.4,
    fontFamily: fuentes.medium,
    textAlign: 'right',
  },
  discosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chipDisco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  chipDiscoQuitar: {
    backgroundColor: 'rgba(240, 138, 155, 0.08)',
    borderColor: 'rgba(240, 138, 155, 0.28)',
  },
  chipDiscoCant: {
    color: noir.platinum,
    fontSize: 8,
    fontFamily: fuentes.bold,
  },
  chipDiscoPeso: {
    color: noir.info,
    fontSize: 8.5,
    fontFamily: fuentes.black,
  },
  discosVacio: {
    color: noir.muted,
    fontSize: 8,
    fontFamily: fuentes.medium,
    fontStyle: 'italic',
  },

  /* TOOLBAR RÁPIDA */
  toolbarRapida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    minHeight: 36,
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  btnStepper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnStepperAccent: {
    borderColor: 'rgba(92, 200, 255, 0.28)',
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
  },
  btnStepperPressed: {
    backgroundColor: 'rgba(92, 200, 255, 0.18)',
    borderColor: 'rgba(92, 200, 255, 0.4)',
  },
  btnStepperText: {
    color: noir.platinum,
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  btnAccionEspecial: {
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccionEspecialActiva: {
    backgroundColor: 'rgba(92, 200, 255, 0.12)',
    borderColor: 'rgba(92, 200, 255, 0.35)',
  },
  btnCopiarText: {
    color: noir.champagne,
    fontSize: 9,
    fontFamily: fuentes.bold,
  },

  /* CHIPS REPS */
  chipsRepsRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  chipRep: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipRepActivo: {
    backgroundColor: 'rgba(92, 200, 255, 0.12)',
    borderColor: 'rgba(92, 200, 255, 0.4)',
  },
  chipRepText: {
    color: noir.platinum,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  chipRepTextActivo: {
    color: '#CDEEFF',
  },

  /* CHIPS RIR */
  chipsRIRRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  chipRIR: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipRIRActivo: {
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
    borderColor: 'rgba(255, 209, 102, 0.45)',
  },
  chipRIRFallo: {
    borderColor: 'rgba(240, 138, 155, 0.4)',
    backgroundColor: 'rgba(240, 138, 155, 0.07)',
  },
  chipRIRText: {
    color: noir.platinum,
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  chipRIRTextActivo: {
    color: noir.champagne,
  },

  /* GRID TECLADO */
  gridContenedor: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 1,
  },
  gridNumerico: {
    flex: 3.2,
    gap: 5,
  },
  tecladoFila: {
    flexDirection: 'row',
    gap: 5,
  },
  teclaBtn: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
  },
  teclaBtnPressed: {
    backgroundColor: 'rgba(92, 200, 255, 0.18)',
    borderColor: 'rgba(92, 200, 255, 0.45)',
    transform: [{ scale: 0.96 }],
  },
  teclaNumText: {
    color: noir.text,
    fontSize: 17,
    fontFamily: fuentes.bold,
    fontVariant: ['tabular-nums'],
  },
  teclaPuntoText: {
    color: noir.text,
    fontSize: 20,
    fontFamily: fuentes.black,
  },
  teclaLimpiarText: {
    color: noir.muted,
    fontSize: 14,
    fontFamily: fuentes.bold,
  },
  teclaAccionSecundaria: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },

  /* COLUMNA DE FLUJO (DERECHA) */
  columnaFlujo: {
    flex: 1,
    gap: 5,
  },
  columnaFlujoAncha: {
    flexDirection: 'row',
    minHeight: 44,
  },
  btnFlujoSiguiente: {
    flex: 1,
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnFlujoSiguienteText: {
    color: '#CDEEFF',
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  btnFlujoCompletar: {
    flex: 1.4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: noir.mint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  btnFlujoCompletarText: {
    color: '#06120D',
    fontSize: 10,
    fontFamily: fuentes.black,
    letterSpacing: 0.25,
  },
  btnFlujoPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
