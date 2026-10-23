import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fuentes, noir } from '../constants/colores';
import { ModalConfig, suscribirModalConfirmacion } from '../utils/errores';
import GlowPanel from './GlowPanel';
import { LiquidMetalButton } from './LiquidMetalButton';
import ShinyText from './ShinyText';

const DANGER = '#F08A9B';

const DANGER_METAL = {
  colorBack: '#45161E',
  colorTint: '#FFB4BF',
  speed: 0.24,
  repetition: 3.4,
  distortion: 0.14,
  softness: 0,
  shiftRed: 0.22,
  shiftBlue: -0.12,
  angle: 45,
  contour: 0.42,
};

function truncarTexto(texto: string, max: number) {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

export default function ConfirmModalGlobal() {
  const [config, setConfig] = useState<ModalConfig>({
    visible: false,
    tipo: 'confirm',
    titulo: '',
    mensaje: '',
  });
  const [cargando, setCargando] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const entrada = useSharedValue(0);

  useEffect(() => {
    return suscribirModalConfirmacion((nuevaConfig) => {
      setConfig(nuevaConfig);
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    if (!config.visible) {
      entrada.value = 0;
      return;
    }

    entrada.value = 0;
    entrada.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [config.visible, config.titulo, entrada]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [
      { translateY: 12 * (1 - entrada.value) },
      { scale: 0.96 + 0.04 * entrada.value },
    ],
  }));

  if (!config.visible) return null;

  const esAlerta = config.tipo === 'alert';
  const esEliminar =
    config.esPeligro === true ||
    (config.esPeligro !== false &&
      (config.textoConfirmar?.toLowerCase().includes('eliminar') ||
        config.textoConfirmar?.toLowerCase().includes('desvincular') ||
        config.titulo.toLowerCase().includes('eliminar') ||
        config.titulo.toLowerCase().includes('desvincular')));
  const esBorrado =
    config.textoConfirmar?.toLowerCase().includes('eliminar') ||
    config.titulo.toLowerCase().includes('eliminar');

  const accent = esAlerta ? noir.mint : esEliminar ? DANGER : noir.info;
  const icon = esAlerta
    ? 'checkmark'
    : esEliminar
      ? 'trash-outline'
      : 'alert-circle-outline';
  const kicker = esAlerta
    ? 'Acción completada'
    : esEliminar
      ? 'Acción irreversible'
      : 'Confirmación';

  const titleFontSize = windowWidth < 360 ? 21 : 23;
  const cardWidth = Math.min(390, windowWidth - 40);
  const titleMaxChars = Math.max(
    14,
    Math.floor((cardWidth - 44) / (titleFontSize * 0.52))
  );
  const displayTitle = truncarTexto(config.titulo, titleMaxChars);
  const titleWebStyle =
    Platform.OS === 'web'
      ? ({
          display: 'block',
          width: '100%',
          textAlign: 'center',
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

  const manejarCancelar = () => {
    if (cargando) return;
    setConfig((prev) => ({ ...prev, visible: false }));
  };

  const manejarConfirmar = async () => {
    if (cargando) return;
    if (config.tipo === 'alert') {
      setConfig((prev) => ({ ...prev, visible: false }));
      return;
    }

    if (config.onConfirmar) {
      try {
        setCargando(true);
        await config.onConfirmar();
      } catch (err) {
        console.warn('Error en confirmación:', err);
      } finally {
        setCargando(false);
        setConfig((prev) => ({ ...prev, visible: false }));
      }
    } else {
      setConfig((prev) => ({ ...prev, visible: false }));
    }
  };

  const content = (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={esAlerta ? manejarConfirmar : manejarCancelar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      />

      <Animated.View style={[styles.cardWrap, cardAnimatedStyle]}>
        <GlowPanel radius={28} style={styles.card}>
          <View style={styles.kickerRow}>
            <View
              style={[
                styles.kickerDot,
                { backgroundColor: accent, shadowColor: accent },
              ]}
            />
            <Text style={styles.kicker}>{kicker}</Text>
          </View>

          <View style={styles.orbStage}>
            <LinearGradient
              pointerEvents="none"
              colors={[`${accent}26`, 'transparent']}
              style={styles.orbHalo}
            />
            <View style={[styles.orbOuter, { borderColor: `${accent}33` }]}>
              <LinearGradient
                colors={[`${accent}30`, `${accent}0A`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.orbInner, { borderColor: `${accent}66` }]}
              >
                <Ionicons name={icon as any} size={26} color={accent} />
              </LinearGradient>
            </View>
          </View>

          {esAlerta ? (
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
                align="center"
                width="100%"
                height={titleFontSize * 1.4}
                color={noir.platinum}
                shineColor={noir.pearl}
                glow={0.18}
                speed={4.8}
                style={titleWebStyle}
              />
            </View>
          ) : (
            <Text style={styles.title}>{config.titulo}</Text>
          )}

          {config.mensaje ? (
            <Text style={styles.message}>{config.mensaje}</Text>
          ) : null}

          {!esAlerta && esEliminar ? (
            <View style={styles.warningRow}>
              <Ionicons
                name={esBorrado ? 'warning-outline' : 'information-circle-outline'}
                size={13}
                color={DANGER}
              />
              <Text style={styles.warningText}>
                {esBorrado
                  ? 'Esta acción no se puede deshacer.'
                  : 'Revisa los detalles antes de continuar.'}
              </Text>
            </View>
          ) : null}

          <View style={[styles.actions, esAlerta && styles.actionsSingle]}>
            {!esAlerta ? (
              <Pressable
                onPress={manejarCancelar}
                disabled={cargando}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressedSoft,
                  cargando && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={config.textoCancelar || 'Cancelar'}
              >
                <Text style={styles.cancelText}>
                  {config.textoCancelar || 'Cancelar'}
                </Text>
              </Pressable>
            ) : null}

            <View style={esAlerta ? styles.primaryFull : styles.primaryFlex}>
              <LiquidMetalButton
                titulo={
                  cargando
                    ? 'Procesando…'
                    : config.textoConfirmar ||
                      (esAlerta ? 'Entendido' : 'Confirmar')
                }
                onPress={manejarConfirmar}
                disabled={cargando}
                activo={config.visible && !cargando}
                height={50}
                borderWidth={3}
                tamano="normal"
                metalConfig={esEliminar ? DANGER_METAL : undefined}
              />
            </View>
          </View>
        </GlowPanel>
      </Animated.View>
    </View>
  );

  if (Platform.OS === 'web') {
    const webNode = <View style={styles.webWrapper}>{content}</View>;
    if (typeof document !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dinámico: evita romper el bundle nativo
        const ReactDOM = require('react-dom');
        if (ReactDOM && typeof ReactDOM.createPortal === 'function') {
          return ReactDOM.createPortal(webNode, document.body);
        }
      } catch {
        // Fallback al render normal si falla require
      }
    }
    return webNode;
  }

  return (
    <Modal
      visible={config.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={manejarCancelar}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 999999,
    elevation: 999999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 3, 6, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(14px)',
          width: '100%',
          height: '100%',
        }
      : {}),
  },
  cardWrap: {
    width: '100%',
    maxWidth: 390,
  },
  card: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 14,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 2,
  },
  kicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  orbStage: {
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  orbHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  orbOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shinyTitleWrap: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  title: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  message: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
    paddingHorizontal: 2,
  },
  warningRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.18)',
    backgroundColor: 'rgba(240, 138, 155, 0.07)',
    marginTop: 13,
  },
  warningText: {
    color: DANGER,
    fontFamily: fuentes.medium,
    fontSize: 9.5,
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    marginTop: 18,
  },
  actionsSingle: {
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.glass,
    borderWidth: 1,
    borderColor: noir.lineStrong,
  },
  cancelText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 12.5,
  },
  primaryFlex: {
    flex: 1.15,
  },
  primaryFull: {
    width: '100%',
  },
  pressedSoft: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
