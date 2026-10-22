import React, { useEffect, useState, memo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { fuentes } from '../constants/colores';
import { formatearTiempo } from '../utils/timer';
import { SesionActivaInfo, limpiarSesionActiva } from '../utils/sesionActiva';
import { confirmarAccion } from '../utils/errores';

type Props = {
  visible: boolean;
  sesionInfo: SesionActivaInfo | null;
  onReanudar: () => void;
  onDescartar: () => void;
  onClose?: () => void;
};

// Componente animado individual para cada una de las 7 barras del ecualizador
const AnimatedChartBar = memo(function AnimatedChartBar({
  dayLabel,
  seriesLabel,
  baseHeight,
  delay,
  isWhite,
}: {
  dayLabel: string;
  seriesLabel: string;
  baseHeight: number;
  delay: number;
  isWhite: boolean;
}) {
  const scale = useSharedValue(0.6);

  useEffect(() => {
    // 7.5s loop idéntico al @keyframes rippleBounce de lucky-dragon-87
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1875, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 1875, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.2, { duration: 1875, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 1875, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      )
    );
  }, [delay, scale]);

  const barAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <View style={styles.barColumn}>
      <Text style={[styles.prDayText, !isWhite && styles.textRed]}>
        {dayLabel}
      </Text>
      <Animated.View
        style={[
          styles.bar,
          { height: baseHeight, backgroundColor: isWhite ? '#FFFFFF' : '#FF7A85' },
          barAnimStyle,
        ]}
      />
      <Text style={styles.barLabel}>{seriesLabel}</Text>
    </View>
  );
});

export default function ModalPartidaEnCurso({
  visible,
  sesionInfo,
  onReanudar,
  onDescartar,
  onClose,
}: Props) {
  const [extraSegs, setExtraSegs] = useState(0);

  useEffect(() => {
    if (!visible || !sesionInfo) return;

    const interval = setInterval(() => {
      setExtraSegs((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      setExtraSegs(0);
    };
  }, [visible, sesionInfo]);

  if (!visible || !sesionInfo) return null;

  const segs = sesionInfo.segsTranscurridos + extraSegs;
  const porcentaje =
    sesionInfo.totalSeries > 0
      ? Math.round((sesionInfo.seriesCompletadas / sesionInfo.totalSeries) * 100)
      : 0;

  const handleDescartarConfirm = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán los datos no guardados.',
      async () => {
        await limpiarSesionActiva(sesionInfo.registroId);
        onDescartar();
      },
      'Descartar'
    );
  };

  const inner = (
    <View style={styles.backdrop}>
      {/* Contenedor Exterior con Resplandor Steam de Lucky Dragon */}
      <View style={styles.steamOuterWrapper}>
        {/* Borde con Gradiente Espectral Animado Steam */}
        <LinearGradient
          colors={[
            '#FA0A0A',
            '#EB021D',
            '#F17917',
            '#E763DC',
            '#B96565',
            '#E0D18B',
            '#DF6A0B',
            '#956DF3',
            '#B15A65',
            '#F5D103',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.steamBorder}
        >
          {/* Tarjeta Negra Interior */}
          <View style={styles.card}>
            {/* Botón opcional de cerrar (X) sin descartar sesión */}
            {onClose && (
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            )}

            {/* Caja de estadísticas superior (bg-custom) */}
            <LinearGradient
              colors={['#532222', '#08080A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bgCustom}
            >
              <View style={styles.headerFlex}>
                <Text style={styles.heading}>SESIÓN EN CURSO</Text>
                <View style={styles.tagIconBox}>
                  <Ionicons name="flash" size={14} color="#FFFFFF" />
                </View>
              </View>

              {/* Cronómetro en vivo */}
              <View style={styles.amountRow}>
                <Text style={styles.timerText}>{formatearTiempo(segs)}</Text>
                <View style={styles.mainPrPill}>
                  <Text style={styles.mainPrText}>
                    {porcentaje > 0 ? `${porcentaje}%` : 'EN VIVO'}
                  </Text>
                </View>
              </View>

              {/* Comparador / Detalle de la rutina y avance de series */}
              <Text style={styles.compareText} numberOfLines={2}>
                {sesionInfo.nombreRutina}
                {sesionInfo.totalSeries > 0
                  ? ` · ${sesionInfo.seriesCompletadas} de ${sesionInfo.totalSeries} series`
                  : ' · Pausado'}
              </Text>
            </LinearGradient>

            {/* Tags de estado */}
            <View style={styles.tagsRow}>
              <View style={styles.tagItem}>
                <Text style={styles.tagItemText}>EN VIVO</Text>
              </View>
              <View style={styles.tagItem}>
                <Text style={styles.tagItemText}>RECUPERABLE</Text>
              </View>
            </View>

            {/* Gráfico ecualizador con 7 barras animadas (rippleBounce) */}
            <View style={styles.chart}>
              <AnimatedChartBar dayLabel="L" seriesLabel="S1" baseHeight={28} delay={200} isWhite />
              <AnimatedChartBar dayLabel="M" seriesLabel="S2" baseHeight={70} delay={400} isWhite={false} />
              <AnimatedChartBar dayLabel="M" seriesLabel="S3" baseHeight={45} delay={600} isWhite />
              <AnimatedChartBar dayLabel="J" seriesLabel="S4" baseHeight={75} delay={800} isWhite={false} />
              <AnimatedChartBar dayLabel="V" seriesLabel="S5" baseHeight={60} delay={1000} isWhite />
              <AnimatedChartBar dayLabel="S" seriesLabel="S6" baseHeight={72} delay={1200} isWhite={false} />
              <AnimatedChartBar dayLabel="D" seriesLabel="S7" baseHeight={52} delay={1400} isWhite />
            </View>

            {/* Botón Principal: Reanudar Entrenamiento (more-button idéntico) */}
            <Pressable
              onPress={onReanudar}
              style={({ pressed }) => [
                styles.moreButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reanudar Entrenamiento"
            >
              <Ionicons name="play" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.moreButtonText}>Reanudar Entrenamiento</Text>
            </Pressable>

            {/* Botón Secundario Seguro: Descartar Entrenamiento */}
            <Pressable
              onPress={handleDescartarConfirm}
              style={({ pressed }) => [
                styles.discardButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Descartar Entrenamiento"
            >
              <Ionicons name="trash-outline" size={14} color="#FFA7A7" />
              <Text style={styles.discardButtonText}>Descartar Entrenamiento</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => {}}
    >
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 4, 8, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  steamOuterWrapper: {
    width: '100%',
    maxWidth: 326,
    borderRadius: 18,
    shadowColor: '#FA0A0A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 16,
  },
  steamBorder: {
    borderRadius: 18,
    padding: 2.2, // El grosor del borde de vapor espectral
  },
  card: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#000000',
    position: 'relative',
    gap: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bgCustom: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 133, 0.18)',
  },
  headerFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heading: {
    color: '#FFF7F7',
    fontSize: 14,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
  },
  tagIconBox: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontFamily: fuentes.black,
    letterSpacing: 0.8,
  },
  mainPrPill: {
    backgroundColor: '#FFA7AD4F',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  mainPrText: {
    color: '#FFA7A7',
    fontSize: 11.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
  },
  compareText: {
    color: '#FFF7F7',
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 5,
    marginBottom: 4,
  },
  tagItem: {
    backgroundColor: '#4D2C2C73',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagItemText: {
    color: '#FFF7F7',
    fontSize: 10.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.4,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 115,
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginBottom: 6,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 22,
    position: 'relative',
    height: '100%',
  },
  prDayText: {
    position: 'absolute',
    top: 0,
    fontSize: 11,
    fontFamily: fuentes.bold,
    color: '#FFFFFF',
  },
  textRed: {
    color: '#FFA7A7',
  },
  bar: {
    width: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10.5,
    fontFamily: fuentes.bold,
    color: '#FFF7F7',
    marginTop: 4,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    shadowColor: '#272727',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  moreButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 133, 0.25)',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 8,
  },
  discardButtonText: {
    color: '#FFA7A7',
    fontSize: 12.5,
    fontFamily: fuentes.bold,
  },
});
