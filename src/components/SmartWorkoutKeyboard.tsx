import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { vibrarBoton } from '../utils/haptics';
import { calcular1RMEstimado, calcularDiscosPorLado } from '../utils/calculadoraFuerza';
import { useLayout } from '../hooks/useLayout';

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

export default function SmartWorkoutKeyboard({
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
  const { bottomInset, isLandscape, isTablet } = useLayout();
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

  if (!visible) return null;

  return (
    <View
      style={[
        styles.contenedorOverlay,
        {
          paddingBottom: Math.max(bottomInset, 8),
        },
      ]}
    >
      <View
        style={[
          styles.panelPrincipal,
          (isLandscape || isTablet) && styles.panelCentrado,
        ]}
      >
        {/* BARRA SUPERIOR: Contexto, 1RM en vivo y Botón Cerrar */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1, marginRight: 8 }}>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.campoActivoText}>{etiquetaCampo()}</Text>
              {estimacion1RM !== null && (
                <View style={styles.badge1RM}>
                  <Ionicons name="flame" size={11} color="#F59E0B" />
                  <Text style={styles.badge1RMText}>1RM Est: {estimacion1RM} kg</Text>
                </View>
              )}
            </View>
          </View>

          {/* Botón Cerrar Teclado */}
          <Pressable
            onPress={() => {
              vibrarBoton(10);
              onClose();
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.btnCerrar, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-down" size={22} color={colores.suave} />
          </Pressable>
        </View>

        {/* CALCULADORA DE DISCOS (Si está desplegada) */}
        {mostrarCalculadoraDiscos && infoDiscos && (
          <View style={styles.barraDiscos}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Ionicons name="barbell-outline" size={14} color={colores.primarioHover} />
              <Text style={styles.barraDiscosTitulo}>
                Barra 20kg + {infoDiscos.pesoPorLado} kg por lado:
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
                <Text style={{ color: colores.suave, fontSize: 11, fontStyle: 'italic' }}>
                  Solo la barra olímpica (20 kg)
                </Text>
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
                  <Text style={[styles.btnStepperText, { color: colores.primarioHover }]}>+2.5</Text>
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
                  color={mostrarCalculadoraDiscos ? colores.primarioHover : colores.suave}
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
                    {r === '0' ? '0 (Fallo)' : r}
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
                <Ionicons name="backspace-outline" size={20} color={colores.texto} />
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
            >
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              <Text style={styles.btnFlujoSiguienteText}>Sig.</Text>
            </Pressable>

            {/* BOTÓN CONFIRMAR Y COMPLETAR SERIE */}
            <Pressable
              onPress={() => {
                vibrarBoton(20);
                onCompletarSerie();
              }}
              style={({ pressed }) => [styles.btnFlujoCompletar, pressed && styles.btnFlujoPressed]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
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
    backgroundColor: 'rgba(11, 13, 20, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(194, 36, 61, 0.40)',
    shadowColor: '#C2243D',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  panelPrincipal: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  panelCentrado: {
    maxWidth: 620,
    alignSelf: 'center',
  },

  /* HEADER */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  nombreEjercicioText: {
    color: colores.texto,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  badgeSerie: {
    backgroundColor: 'rgba(194, 36, 61, 0.20)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeSerieText: {
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  campoActivoText: {
    color: colores.hoy,
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
  },
  badge1RM: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badge1RMText: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  btnCerrar: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
  },

  /* BARRA DISCOS */
  barraDiscos: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(194, 36, 61, 0.3)',
  },
  barraDiscosTitulo: {
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  discosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipDisco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(194, 36, 61, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colores.primarioHover,
  },
  chipDiscoCant: {
    color: colores.texto,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  chipDiscoPeso: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: fuentes.black,
  },

  /* TOOLBAR RÁPIDA */
  toolbarRapida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    minHeight: 40,
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  btnStepper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnStepperAccent: {
    borderColor: 'rgba(194, 36, 61, 0.5)',
    backgroundColor: 'rgba(194, 36, 61, 0.15)',
  },
  btnStepperPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  btnStepperText: {
    color: colores.texto,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  btnAccionEspecial: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccionEspecialActiva: {
    backgroundColor: 'rgba(194, 36, 61, 0.2)',
    borderColor: colores.primarioHover,
  },
  btnCopiarText: {
    color: colores.hoy,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },

  /* CHIPS REPS */
  chipsRepsRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  chipRep: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipRepActivo: {
    backgroundColor: 'rgba(194, 36, 61, 0.25)',
    borderColor: colores.primarioHover,
  },
  chipRepText: {
    color: colores.texto,
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  chipRepTextActivo: {
    color: colores.primarioHover,
  },

  /* CHIPS RIR */
  chipsRIRRow: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  chipRIR: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipRIRActivo: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  chipRIRFallo: {
    borderLeftWidth: 2,
    borderLeftColor: '#EF4444',
  },
  chipRIRText: {
    color: colores.texto,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  chipRIRTextActivo: {
    color: '#F59E0B',
  },

  /* GRID TECLADO */
  gridContenedor: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  gridNumerico: {
    flex: 3.2,
    gap: 6,
  },
  tecladoFila: {
    flexDirection: 'row',
    gap: 6,
  },
  teclaBtn: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  teclaBtnPressed: {
    backgroundColor: 'rgba(194, 36, 61, 0.35)',
    borderColor: colores.primarioHover,
    transform: [{ scale: 0.96 }],
  },
  teclaNumText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fuentes.bold,
  },
  teclaPuntoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: fuentes.black,
  },
  teclaLimpiarText: {
    color: colores.suave,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  teclaAccionSecundaria: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  /* COLUMNA DE FLUJO (DERECHA) */
  columnaFlujo: {
    flex: 1,
    gap: 6,
  },
  btnFlujoSiguiente: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnFlujoSiguienteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  btnFlujoCompletar: {
    flex: 1.4,
    backgroundColor: 'rgba(16, 185, 129, 0.40)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnFlujoCompletarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  btnFlujoPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
});
