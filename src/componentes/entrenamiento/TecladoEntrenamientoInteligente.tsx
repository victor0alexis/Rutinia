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
import { calcular1RMEstimado, calcularDiscosPorLado } from '../../utilidades/calculadoraFuerza';
import { useLayout } from '../../hooks/useLayout';

export type CampoEntrenamiento = 'peso' | 'reps' | 'rir' | 'pesoI' | 'repsI' | 'parciales';

type Props = {
  visible: boolean;
  modo: CampoEntrenamiento;
  valorActual: string;
  nombreEjercicio: string;
  serieNumero: number;
  pesoPara1RM?: string;
  repsPara1RM?: string;
  valorPrevioSugerido?: string;
  esUnilateral?: boolean;
  lado?: 'D' | 'I';
  onChangeValor: (val: string) => void;
  onNext: () => void;
  onCompletarSerie: () => void;
  onClose: () => void;
};

export default function TecladoEntrenamientoInteligente({
  visible,
  modo,
  valorActual,
  nombreEjercicio,
  serieNumero,
  pesoPara1RM,
  repsPara1RM,
  valorPrevioSugerido,
  esUnilateral = false,
  lado,
  onChangeValor,
  onNext,
  onCompletarSerie,
  onClose,
}: Props) {
  const { barBottomPadding, isLandscape, isTablet } = useLayout();
  const [mostrarCalculadoraDiscos, setMostrarCalculadoraDiscos] = useState(false);

  // Determinar si el campo activo admite decimales
  const esDecimal = modo === 'peso' || modo === 'pesoI';
  const esRIR = modo === 'rir';
  const esParciales = modo === 'parciales';

  // 1RM estimado en tiempo real
  const estimacion1RM = useMemo(() => {
    const p = esDecimal ? valorActual : pesoPara1RM;
    const r = modo === 'reps' || modo === 'repsI' ? valorActual : repsPara1RM;
    if (!p || !r) return null;
    return calcular1RMEstimado(p, r);
  }, [valorActual, pesoPara1RM, repsPara1RM, esDecimal, modo]);

  // Cálculo de discos olímpicos
  const infoDiscos = useMemo(() => {
    const pesoNum = parseFloat(valorActual.replace(',', '.'));
    if (!pesoNum || isNaN(pesoNum)) return null;
    return calcularDiscosPorLado(pesoNum, 20);
  }, [valorActual]);

  // Lógica de digitación
  const presionarDigito = useCallback(
    (d: string) => {
      vibrarBoton(10);
      if (!valorActual || valorActual === '0') {
        onChangeValor(d);
        return;
      }
      if (esParciales && valorActual.length >= 2) return; // Limitar reps parciales a 2 dígitos
      if (valorActual.length >= 6) return; // Limitar longitud
      onChangeValor(valorActual + d);
    },
    [valorActual, esParciales, onChangeValor]
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
    if (!valorActual || valorActual.length <= 1) {
      onChangeValor('');
      return;
    }
    onChangeValor(valorActual.slice(0, -1));
  }, [valorActual, onChangeValor]);

  const limpiar = () => {
    vibrarBoton(15);
    onChangeValor('');
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
        if (esDecimal) presionarPunto();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        presionarBackspace();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        vibrarBoton(15);
        onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, esDecimal, onNext, onClose, presionarDigito, presionarPunto, presionarBackspace]);

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
    onChangeValor(r.toString());
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
        return esUnilateral ? 'PESO DERECHO (KG)' : 'CARGA / PESO (KG)';
      case 'pesoI':
        return 'PESO IZQUIERDO (KG)';
      case 'reps':
        return esUnilateral ? 'REPS DERECHO' : 'REPETICIONES';
      case 'repsI':
        return 'REPS IZQUIERDO';
      case 'rir':
        return 'REPS EN RESERVA (RIR)';
      case 'parciales':
        return 'REPETICIONES PARCIALES (+p)';
      default:
        return 'VALOR';
    }
  };

  const unidad = esDecimal ? 'kg' : esRIR ? 'RIR' : esParciales ? '+ reps' : 'reps';

  if (!visible) return null;

  return (
    <View
      style={[
        styles.contenedorOverlay,
        {
          paddingBottom: Math.max(barBottomPadding, 8),
        },
      ]}
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
                {valorActual || '0'}
              </Text>
              <Text style={styles.kbDisplayUnit}>{unidad}</Text>
            </View>
            <Text style={styles.kbDisplayHint} numberOfLines={1}>
              {valorPrevioSugerido
                ? `Previa ${valorPrevioSugerido}${esDecimal ? ' kg' : esParciales ? 'p' : ' reps'}`
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

        {/* CALCULADORA DE DISCOS (Si está desplegada) */}
        {esDecimal && mostrarCalculadoraDiscos && infoDiscos && (
          <View style={styles.barraDiscos}>
            <View style={styles.barraDiscosHeader}>
              <Ionicons name="barbell-outline" size={12} color={noir.info} />
              <Text style={styles.barraDiscosTitulo}>
                Barra 20 kg + {infoDiscos.pesoPorLado} kg / lado
              </Text>
            </View>
            <View style={styles.discosRow}>
              {infoDiscos.discos.length > 0 ? (
                infoDiscos.discos.map((d, idx) => (
                  <View key={idx} style={styles.chipDisco}>
                    <Text style={styles.chipDiscoCant}>{d.cantidadPorLado}×</Text>
                    <Text style={styles.chipDiscoPeso}>{d.disco}k</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.discosVacio}>Solo la barra olímpica (20 kg)</Text>
              )}
            </View>
          </View>
        )}

        {/* BARRA DE HERRAMIENTAS RÁPIDAS (SEGÚN MODO) */}
        <View style={styles.toolbarRapida}>
          {esDecimal && (
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

              {/* Botón Calculadora de Discos */}
              <Pressable
                onPress={() => {
                  vibrarBoton(10);
                  setMostrarCalculadoraDiscos(!mostrarCalculadoraDiscos);
                }}
                style={({ pressed }) => [
                  styles.btnAccionEspecial,
                  mostrarCalculadoraDiscos && styles.btnAccionEspecialActiva,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="barbell"
                  size={14}
                  color={mostrarCalculadoraDiscos ? noir.info : noir.muted}
                />
              </Pressable>

              {/* Botón Copiar Previo */}
              {Boolean(valorPrevioSugerido) && (
                <Pressable
                  onPress={() => {
                    vibrarBoton(12);
                    if (valorPrevioSugerido) onChangeValor(valorPrevioSugerido);
                  }}
                  style={({ pressed }) => [styles.btnAccionEspecial, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.btnCopiarText}>= {valorPrevioSugerido}k</Text>
                </Pressable>
              )}
            </>
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
                    valorActual === num.toString() && styles.chipRepActivo,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipRepText,
                      valorActual === num.toString() && styles.chipRepTextActivo,
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
                    if (valorPrevioSugerido) onChangeValor(valorPrevioSugerido);
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

        {/* TECLADO NUMÉRICO TÁCTIL (GRID 3x4 + COLUMNA DE ACCIÓN) */}
        <View style={styles.gridContenedor}>
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
              {esDecimal ? (
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

          {/* COLUMNA DE ACCIONES DE FLUJO */}
          <View style={styles.columnaFlujo}>
            {/* BOTÓN SIGUIENTE */}
            <Pressable
              onPress={() => {
                vibrarBoton(15);
                onNext();
              }}
              style={({ pressed }) => [styles.btnFlujoSiguiente, pressed && styles.btnFlujoPressed]}
              accessibilityLabel="Siguiente campo"
            >
              <Ionicons name="arrow-forward" size={17} color={noir.info} />
              <Text style={styles.btnFlujoSiguienteText}>Sig.</Text>
            </Pressable>

            {/* BOTÓN CONFIRMAR Y COMPLETAR SERIE */}
            <Pressable
              onPress={() => {
                vibrarBoton(20);
                onCompletarSerie();
              }}
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
