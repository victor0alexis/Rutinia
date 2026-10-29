import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import { vibrarBoton } from '../../utils/haptics';

export interface SugerenciaTeclado {
  etiqueta: string;
  valor: string;
}

interface Props {
  visible?: boolean;
  valor: string;
  titulo: string;
  placeholder?: string;
  sugerencias?: SugerenciaTeclado[];
  /** Texto corto a la derecha del título, p. ej. «1323 resultados». */
  resumen?: string;
  maxLength?: number;
  textoListo?: string;
  onCambiar: (valor: string) => void;
  onCerrar: () => void;
  onSubmit?: () => void;
  onHeightChange?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
}

const FILAS_LETRAS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const FILAS_NUMEROS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '_', '.', ',', '?', '!', '/', '(', ')', '%'],
  ['@', '#', '&', '+', '=', '*'],
];

const FILA_ACENTOS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'];

export default function SmartTextKeyboard({ visible = true, ...props }: Props) {
  if (!visible) return null;
  return <SmartTextKeyboardPanel {...props} />;
}

function SmartTextKeyboardPanel({
  valor,
  titulo,
  placeholder = 'Escribe aquí…',
  sugerencias = [],
  resumen,
  maxLength = 80,
  textoListo = 'Listo',
  onCambiar,
  onCerrar,
  onSubmit,
  onHeightChange,
  style,
}: Omit<Props, 'visible'>) {
  const { barBottomPadding, height, isLandscape, isTablet } = useLayout();
  const [modoNumerico, setModoNumerico] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);

  const agregar = useCallback(
    (texto: string) => {
      if (!texto) return;
      if (valor.length >= maxLength) return;
      const recortado = texto.slice(0, Math.max(0, maxLength - valor.length));
      if (!recortado) return;
      vibrarBoton(9);
      onCambiar(valor + recortado);
    },
    [maxLength, onCambiar, valor]
  );

  const borrar = useCallback(() => {
    vibrarBoton(11);
    if (!valor) return;
    onCambiar(valor.slice(0, -1));
  }, [onCambiar, valor]);

  const limpiar = useCallback(() => {
    vibrarBoton(16);
    onCambiar('');
  }, [onCambiar]);

  const confirmar = useCallback(() => {
    vibrarBoton(14);
    if (onSubmit) {
      onSubmit();
      return;
    }
    onCerrar();
  }, [onCerrar, onSubmit]);

  // Teclado físico en web/desktop: nunca abre el teclado nativo de iOS.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const manejarTecla = (event: KeyboardEvent) => {
      const objetivo = event.target as HTMLElement | null;
      const etiqueta = objetivo?.tagName?.toLowerCase();
      if (
        etiqueta === 'input' ||
        etiqueta === 'textarea' ||
        etiqueta === 'select' ||
        objetivo?.isContentEditable
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCerrar();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        confirmar();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        borrar();
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        agregar(event.key);
      }
    };

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [agregar, borrar, confirmar, onCerrar]);

  const filas = modoNumerico ? FILAS_NUMEROS : FILAS_LETRAS;

  const sugerenciasUnicas = useMemo(() => {
    const vistos = new Set<string>();
    return sugerencias
      .filter((sugerencia) => {
        const valorSugerencia = (sugerencia.valor || sugerencia.etiqueta).trim();
        if (!valorSugerencia || vistos.has(valorSugerencia.toLowerCase())) return false;
        vistos.add(valorSugerencia.toLowerCase());
        return true;
      })
      .slice(0, 4);
  }, [sugerencias]);

  const manejarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onHeightChange?.(event.nativeEvent.layout.height);
    },
    [onHeightChange]
  );

  // En pantallas muy bajas reducimos un poco para que quepan los resultados
  // visibles, pero manteniendo teclas claramente más grandes que antes.
  const pantallaBaja = !isLandscape && height < 700;
  const altoTecla = isLandscape ? 38 : pantallaBaja ? 42 : 46;
  const altoAcento = isLandscape ? 30 : pantallaBaja ? 30 : 33;
  const tamanoTecla = isLandscape ? 17.5 : pantallaBaja ? 18 : 19.5;

  return (
    <View
      style={[
        styles.panel,
        { paddingBottom: Math.max(barBottomPadding, 8) },
        isTablet && styles.panelTablet,
        style,
      ]}
      onLayout={onHeightChange ? manejarLayout : undefined}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(92, 200, 255, 0.075)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.panelGlow}
      />

      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={12} color={noir.info} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {titulo}
              </Text>
              {resumen ? (
                <View style={styles.resumenPill}>
                  <Text style={styles.resumenText} numberOfLines={1}>
                    {resumen}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.headerValue} numberOfLines={1}>
              {valor || placeholder}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {valor.length > 0 ? (
            <Pressable
              onPress={limpiar}
              style={({ pressed }) => [
                styles.headerClearBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Borrar texto"
            >
              <Ionicons name="close-circle" size={18} color={noir.muted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={confirmar}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar teclado"
          >
            <Ionicons name="chevron-down" size={20} color={noir.platinum} />
          </Pressable>
        </View>
      </View>

      {sugerenciasUnicas.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sugerenciasRow}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sugerenciasLabel}>
            <Ionicons name="bulb-outline" size={11} color={noir.champagne} />
          </View>
          {sugerenciasUnicas.map((sugerencia) => {
            const valorSugerencia = (sugerencia.valor || sugerencia.etiqueta).trim();
            return (
              <Pressable
                key={`${sugerencia.etiqueta}-${valorSugerencia}`}
                onPress={() => {
                  vibrarBoton(10);
                  onCambiar(valorSugerencia.slice(0, maxLength));
                }}
                style={({ pressed }) => [
                  styles.sugerenciaChip,
                  pressed && styles.sugerenciaChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${sugerencia.etiqueta}`}
              >
                <Text style={styles.sugerenciaText} numberOfLines={1}>
                  {sugerencia.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!modoNumerico ? (
        <View style={styles.acentosRow}>
          {FILA_ACENTOS.map((acento) => (
            <Pressable
              key={acento}
              onPress={() => agregar(mayusculas ? acento.toUpperCase() : acento)}
              style={({ pressed }) => [
                styles.acentoBtn,
                { height: altoAcento },
                pressed && styles.teclaPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Letra ${mayusculas ? acento.toUpperCase() : acento}`}
            >
              <Text style={styles.acentoText}>
                {mayusculas ? acento.toUpperCase() : acento}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.teclado}>
        {filas.map((fila, filaIdx) => (
          <View key={`fila-${filaIdx}`} style={styles.fila}>
            {filaIdx === filas.length - 1 && !modoNumerico ? (
              <Pressable
                onPress={() => {
                  vibrarBoton(9);
                  setMayusculas((prev) => !prev);
                }}
                style={({ pressed }) => [
                  styles.tecla,
                  styles.teclaAccion,
                  styles.teclaShift,
                  { height: altoTecla },
                  mayusculas && styles.teclaShiftActiva,
                  pressed && styles.teclaPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mayusculas }}
                accessibilityLabel={
                  mayusculas ? 'Desactivar mayúsculas' : 'Activar mayúsculas'
                }
              >
                <Ionicons
                  name={mayusculas ? 'arrow-up' : 'arrow-up-outline'}
                  size={19}
                  color={mayusculas ? noir.info : noir.platinum}
                />
              </Pressable>
            ) : null}

            {fila.map((tecla) => (
              <Pressable
                key={`${filaIdx}-${tecla}`}
                onPress={() => {
                  agregar(mayusculas ? tecla.toUpperCase() : tecla);
                  // Como en iOS: mayúsculas se desactiva tras escribir.
                  if (mayusculas) setMayusculas(false);
                }}
                style={({ pressed }) => [
                  styles.tecla,
                  { height: altoTecla },
                  pressed && styles.teclaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={tecla === ' ' ? 'Espacio' : `Tecla ${tecla}`}
              >
                <Text style={[styles.teclaText, { fontSize: tamanoTecla }]}>
                  {mayusculas ? tecla.toUpperCase() : tecla}
                </Text>
              </Pressable>
            ))}

            {filaIdx === filas.length - 1 ? (
              <Pressable
                onPress={borrar}
                onLongPress={limpiar}
                delayLongPress={320}
                style={({ pressed }) => [
                  styles.tecla,
                  styles.teclaAccion,
                  { height: altoTecla, flex: 1.35 },
                  pressed && styles.teclaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Borrar letra"
              >
                <Ionicons name="backspace-outline" size={22} color={noir.platinum} />
              </Pressable>
            ) : null}
          </View>
        ))}

        <View style={styles.filaBottom}>
          <Pressable
            onPress={() => {
              vibrarBoton(10);
              setModoNumerico((prev) => !prev);
            }}
            style={({ pressed }) => [
              styles.tecla,
              styles.teclaAccion,
              styles.teclaModo,
              { height: altoTecla },
              pressed && styles.teclaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={modoNumerico ? 'Ver letras' : 'Ver números'}
          >
            <Text style={styles.teclaModoText}>{modoNumerico ? 'ABC' : '123'}</Text>
          </Pressable>

          <Pressable
            onPress={() => agregar(' ')}
            style={({ pressed }) => [
              styles.tecla,
              styles.teclaEspacio,
              { height: altoTecla },
              pressed && styles.teclaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Espacio"
          >
            <Text style={styles.teclaEspacioText}>espacio</Text>
          </Pressable>

          <Pressable
            onPress={confirmar}
            style={({ pressed }) => [
              styles.teclaListo,
              { height: altoTecla },
              pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={textoListo}
          >
            <LinearGradient
              colors={['#8CFFD6', noir.mint]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
            />
            <Ionicons name="checkmark" size={18} color="#06120D" />
            <Text style={styles.teclaListoText}>{textoListo}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    paddingHorizontal: 6,
    paddingTop: 6,
    backgroundColor: 'rgba(9, 11, 16, 0.995)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 24,
  },
  panelGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 110,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
  },
  panelTablet: {
    maxWidth: 620,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  handle: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginBottom: 7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92, 200, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.22)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    flexShrink: 1,
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  resumenPill: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
  },
  resumenText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 8,
    fontVariant: ['tabular-nums'],
  },
  headerValue: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 13,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerClearBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 17,
  },
  sugerenciasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  sugerenciasLabel: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.2)',
  },
  sugerenciaChip: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxWidth: 220,
  },
  sugerenciaChipPressed: {
    backgroundColor: 'rgba(92, 200, 255, 0.12)',
    borderColor: 'rgba(92, 200, 255, 0.35)',
  },
  sugerenciaText: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 11,
  },
  acentosRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 1,
    paddingBottom: 6,
  },
  acentoBtn: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.14)',
  },
  acentoText: {
    color: '#FFE6A8',
    fontFamily: fuentes.bold,
    fontSize: 16,
  },
  teclado: {
    gap: 6,
  },
  fila: {
    flexDirection: 'row',
    gap: 5,
  },
  filaBottom: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 1,
  },
  tecla: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.072)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  teclaPressed: {
    backgroundColor: 'rgba(92, 200, 255, 0.2)',
    borderColor: 'rgba(92, 200, 255, 0.5)',
    transform: [{ scale: 0.96 }],
  },
  teclaText: {
    color: noir.text,
    fontSize: 19.5,
    fontFamily: fuentes.semiBold,
  },
  teclaAccion: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  teclaShift: {
    flex: 1.2,
  },
  teclaShiftActiva: {
    backgroundColor: 'rgba(92, 200, 255, 0.14)',
    borderColor: 'rgba(92, 200, 255, 0.4)',
  },
  teclaModo: {
    flex: 1.1,
  },
  teclaModoText: {
    color: noir.muted,
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  teclaEspacio: {
    flex: 4.2,
  },
  teclaEspacioText: {
    color: noir.muted,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  teclaListo: {
    flex: 1.25,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: noir.mint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    overflow: 'hidden',
  },
  teclaListoText: {
    color: '#06120D',
    fontSize: 10.5,
    fontFamily: fuentes.black,
    letterSpacing: 0.2,
  },
});
