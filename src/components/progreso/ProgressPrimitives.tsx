import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fuentes, noir } from '../../constantes/colores';
import GlowPanel from '../GlowPanel';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Une un color hexadecimal con una transparencia de dos dígitos.
 * Los colores que no son hex (por ejemplo, rgba) se devuelven intactos.
 */
export function tint(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

/* -------------------------------------------------------------------------- */
/*                                  ProgressBar                               */
/* -------------------------------------------------------------------------- */

type ProgressBarProps = {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  value,
  color = noir.ice,
  trackColor = 'rgba(255, 255, 255, 0.065)',
  height = 6,
  delay = 0,
  style,
}: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const target = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0)
  );

  useEffect(() => {
    if (width <= 0) return;

    if (reduceMotion) {
      progress.value = target;
      return;
    }

    progress.value = withDelay(
      delay,
      withTiming(target, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, progress, reduceMotion, target, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width * (progress.value / 100),
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setWidth(nextWidth);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.barTrack,
        { height, borderRadius: height / 2, backgroundColor: trackColor },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.barFill,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: color,
            shadowColor: color,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                AdherenceRing                               */
/* -------------------------------------------------------------------------- */

type AdherenceRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
};

export function AdherenceRing({
  value,
  size = 92,
  strokeWidth = 6,
  color = noir.mint,
}: AdherenceRingProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const percentage = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0)
  );
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (reduceMotion) {
      progress.value = percentage;
      return;
    }

    progress.value = withTiming(percentage, {
      duration: 950,
      easing: Easing.out(Easing.cubic),
    });
  }, [percentage, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  return (
    <View
      style={[
        styles.ringWrap,
        {
          width: size,
          height: size,
          shadowColor: color,
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View pointerEvents="none" style={styles.ringCenter}>
        <Text style={styles.ringValue}>
          {Math.round(percentage)}
          <Text style={styles.ringPercent}>%</Text>
        </Text>
        <Text style={styles.ringLabel}>CONSTANCIA</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   PulseDot                                 */
/* -------------------------------------------------------------------------- */

type PulseDotProps = {
  color?: string;
  size?: number;
};

export function PulseDot({ color = noir.mint, size = 5 }: PulseDotProps) {
  const pulse = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1150, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                ProgressStatus                              */
/* -------------------------------------------------------------------------- */

type ProgressStatusProps = {
  loading?: boolean;
  label?: string;
};

export function ProgressStatus({
  loading = false,
  label = 'EN VIVO',
}: ProgressStatusProps) {
  return (
    <View style={styles.statusChip}>
      {loading ? (
        <ActivityIndicator size={10} color={noir.muted} />
      ) : (
        <PulseDot />
      )}
      <Text style={styles.statusText}>
        {loading ? 'ACTUALIZANDO' : label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                ProgressPanel                               */
/* -------------------------------------------------------------------------- */

type ProgressPanelProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  radius?: number;
  hairlineInset?: number;
};

export function ProgressPanel({
  children,
  style,
  glow = false,
  radius = 20,
  hairlineInset = 14,
}: ProgressPanelProps) {
  if (glow) {
    return (
      <GlowPanel
        radius={radius}
        hairlineInset={hairlineInset}
        style={[styles.panel, style]}
      >
        {children}
      </GlowPanel>
    );
  }

  return (
    <View style={[styles.panel, styles.glassPanel, { borderRadius: radius }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          'transparent',
          'rgba(255, 255, 255, 0.14)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.panelHairline,
          { left: hairlineInset, right: hairlineInset },
        ]}
      />
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                           ProgressSectionHeader                            */
/* -------------------------------------------------------------------------- */

type ProgressSectionHeaderProps = {
  icon: IconName;
  title: string;
  meta?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressSectionHeader({
  icon,
  title,
  meta,
  accent = noir.ice,
  style,
}: ProgressSectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderLeft}>
        <View
          style={[
            styles.sectionIcon,
            {
              backgroundColor: tint(accent, '18'),
              borderColor: tint(accent, '36'),
              shadowColor: accent,
            },
          ]}
        >
          <Ionicons name={icon} size={13} color={accent} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {meta ? (
        <View style={styles.sectionMetaChip}>
          <Text style={styles.sectionMeta}>{meta}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ProgressEmptyState                            */
/* -------------------------------------------------------------------------- */

type ProgressEmptyStateProps = {
  icon: IconName;
  title: string;
  text: string;
  action?: React.ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressEmptyState({
  icon,
  title,
  text,
  action,
  accent = noir.muted,
  style,
}: ProgressEmptyStateProps) {
  return (
    <View style={[styles.emptyState, style]}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: tint(accent, '12'),
            borderColor: tint(accent, '2E'),
            shadowColor: accent,
          },
        ]}
      >
        <Ionicons name={icon} size={24} color={accent} />
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>

      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  barTrack: {
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 6,
    elevation: 3,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  ringValue: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 20,
    letterSpacing: -0.7,
    lineHeight: 23,
  },
  ringPercent: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0,
  },
  ringLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.95,
  },
  pulseDot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 2,
  },
  statusChip: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
  },
  statusText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.9,
  },
  panel: {
    padding: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  glassPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 5,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore - boxShadow y backdropFilter son válidos en RN Web.
          boxShadow:
            '0 10px 30px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.045)',
          // @ts-ignore
          backdropFilter: 'blur(14px)',
        }
      : {}),
  },
  panelHairline: {
    position: 'absolute',
    top: 0,
    height: 1,
    zIndex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.055)',
    marginBottom: 11,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 1.02,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  sectionMetaChip: {
    minHeight: 21,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.065)',
  },
  sectionMeta: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 22,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 2,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'center',
    letterSpacing: -0.25,
  },
  emptyText: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 290,
  },
  emptyAction: {
    marginTop: 5,
    alignSelf: 'center',
  },
});
