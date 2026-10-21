import React, { Component, memo, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  type LayoutChangeEvent,
} from "react-native";
import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
  interpolate,
  cancelAnimation,
  useReducedMotion,
} from "react-native-reanimated";
import type { IRadiantButton } from "./types";

const DEFAULT_THEME = {
  background: "#000000",
  backgroundSubtle: "#101016",
  foreground: "#ffffff",
  highlight: "#e37e19",
  highlightSubtle: "#000000",
};

const PAD = 14;

// Error Boundary para blindar contra cualquier fallo de renderizado
interface EBState {
  hasError: boolean;
}

class RadiantErrorBoundary extends Component<{ children: React.ReactNode; fallback?: React.ReactNode }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("RadiantButton render error suppressed:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.props.children;
    }
    return this.props.children;
  }
}

const RadiantButtonInner: React.FC<IRadiantButton> = memo(
  function RadiantButtonInner({
    children,
    onPress,
    style,
    textStyle,
    borderRadius = 12,
    borderWidth = 1.5,
    duration = 3000,
    theme: themeProp,
    paddingHorizontal = 24,
    paddingVertical = 14,
    disabled = false,
    showGlow = true,
    glowWidth = 0.6,
    glowBlur = 8,
    breathingEnabled = true,
  }: IRadiantButton) {
    const progreso = useSharedValue<number>(0);
    const breathe = useSharedValue<number>(0);
    const presionado = useSharedValue<number>(0);
    const reduceMotion = useReducedMotion();

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const theme = useMemo(
      () => ({ ...DEFAULT_THEME, ...themeProp }),
      [themeProp],
    );

    const highlight = theme.highlight || "#e37e19";

    useEffect(() => {
      if (disabled || reduceMotion) {
        cancelAnimation(progreso);
        cancelAnimation(breathe);
        return;
      }

      progreso.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false,
      );

      if (breathingEnabled && showGlow) {
        breathe.value = withRepeat(
          withTiming(1, {
            duration: duration * 0.75,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        );
      }

      return () => {
        cancelAnimation(progreso);
        cancelAnimation(breathe);
      };
    }, [disabled, duration, showGlow, breathingEnabled, reduceMotion, progreso, breathe]);

    const handlePressIn = () => {
      presionado.value = withTiming(1, { duration: 150 });
    };

    const handlePressOut = () => {
      presionado.value = withTiming(0, { duration: 300 });
    };

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w > 0 && h > 0 && (w !== dimensions.width || h !== dimensions.height)) {
        setDimensions({ width: w, height: h });
      }
    };

    const animatedPressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(presionado.value, [0, 1], [1, 0.98]) }],
    }));

    const { width, height } = dimensions;
    const cx = PAD + width / 2;
    const cy = PAD + height / 2;

    const transRotacion = useDerivedValue(() => {
      const angulo = reduceMotion ? Math.PI * 0.5 : progreso.value * Math.PI * 2;
      return [
        { translateX: cx },
        { translateY: cy },
        { rotate: angulo },
        { translateX: -cx },
        { translateY: -cy },
      ];
    });

    const haloOpacityAnim = useDerivedValue(() => {
      const base = 0.55;
      const breatheAdd = breathingEnabled
        ? interpolate(breathe.value, [0, 1], [0, 0.25])
        : 0;
      const pressAdd = interpolate(presionado.value, [0, 1], [0, 0.35]);
      return base + breatheAdd + pressAdd;
    });

    const breatheBottomGlowOpacity = useDerivedValue(() => {
      const base = 0.4;
      const breatheAdd = breathingEnabled
        ? interpolate(breathe.value, [0, 1], [0, 0.3])
        : 0;
      return base + breatheAdd;
    });

    const radiantColors = useMemo(
      () => [
        "transparent",
        "transparent",
        `${highlight}44`,
        highlight,
        "#FFFFFF",
        highlight,
        `${highlight}44`,
        "transparent",
      ],
      [highlight],
    );

    const radiantPositions = useMemo(
      () => [0, 0.35, 0.5, 0.62, 0.72, 0.82, 0.92, 1],
      [],
    );

    const renderChildren = () => {
      if (typeof children === "string") {
        return (
          <Text style={[styles.text, { color: theme.foreground }, textStyle]}>
            {children}
          </Text>
        );
      }
      return children;
    };

    return (
      <Animated.View style={[styles.container, animatedPressStyle, style]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLayout={handleLayout}
          disabled={disabled}
          style={[
            styles.button,
            {
              borderRadius,
              paddingHorizontal,
              paddingVertical,
              backgroundColor: theme.background,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {/* Canvas Skia GPU de alta velocidad y resplandor continuo */}
          {width > 0 && height > 0 && (
            <Canvas
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -PAD,
                top: -PAD,
                width: width + PAD * 2,
                height: height + PAD * 2,
              }}
            >
              {/* Capa 1: Fondo interior */}
              <RoundedRect
                x={PAD}
                y={PAD}
                width={width}
                height={height}
                r={borderRadius}
                color={theme.background}
              />

              {/* Capa 2: Borde Base sutil */}
              <RoundedRect
                x={PAD}
                y={PAD}
                width={width}
                height={height}
                r={borderRadius}
                style="stroke"
                strokeWidth={borderWidth}
                color={`${highlight}30`}
              />

              {/* Capa 3: Halo de resplandor difuminado rotativo */}
              {showGlow && (
                <Group opacity={haloOpacityAnim} transform={transRotacion}>
                  <RoundedRect
                    x={PAD}
                    y={PAD}
                    width={width}
                    height={height}
                    r={borderRadius}
                    style="stroke"
                    strokeWidth={borderWidth * 2.5}
                  >
                    <SweepGradient
                      c={vec(cx, cy)}
                      colors={radiantColors}
                      positions={radiantPositions}
                    />
                    <BlurMask blur={glowBlur} style="normal" />
                  </RoundedRect>
                </Group>
              )}

              {/* Capa 4: Anillo nítido y brillante rotativo */}
              <Group opacity={1} transform={transRotacion}>
                <RoundedRect
                  x={PAD}
                  y={PAD}
                  width={width}
                  height={height}
                  r={borderRadius}
                  style="stroke"
                  strokeWidth={borderWidth}
                >
                  <SweepGradient
                    c={vec(cx, cy)}
                    colors={radiantColors}
                    positions={radiantPositions}
                  />
                </RoundedRect>
              </Group>

              {/* Capa 5: Halo respiratorio difuso en el borde inferior */}
              {showGlow && (
                <Group opacity={breatheBottomGlowOpacity}>
                  <RoundedRect
                    x={PAD + (width - width * glowWidth) / 2}
                    y={PAD + height - 6}
                    width={width * glowWidth}
                    height={10}
                    r={5}
                    color={highlight}
                  >
                    <BlurMask blur={7} style="normal" />
                  </RoundedRect>
                </Group>
              )}
            </Canvas>
          )}

          <View style={styles.content}>{renderChildren()}</View>
        </Pressable>
      </Animated.View>
    );
  },
);

const RadiantButton: React.FC<IRadiantButton> = (props) => {
  const fallback = (
    <View
      style={[
        styles.button,
        {
          borderRadius: props.borderRadius ?? 12,
          paddingHorizontal: props.paddingHorizontal ?? 24,
          paddingVertical: props.paddingVertical ?? 14,
          backgroundColor: props.theme?.background ?? "#000000",
          borderWidth: props.borderWidth ?? 1.5,
          borderColor: props.theme?.highlight ?? "#e37e19",
        },
        props.style,
      ]}
    >
      <View style={styles.content}>{props.children}</View>
    </View>
  );

  return (
    <RadiantErrorBoundary fallback={fallback}>
      <RadiantButtonInner {...props} />
    </RadiantErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
  },
  button: {
    position: "relative",
    overflow: "hidden",
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default RadiantButton;
