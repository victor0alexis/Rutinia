import React, { Component, memo, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  type LayoutChangeEvent,
} from "react-native";
import {
  Canvas,
  RoundedRect,
  vec,
  Group,
  LinearGradient,
  Rect,
  Fill,
  Shader,
  Skia,
  BlurMask,
  Mask,
} from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { BORDER_GLOW_SHADER } from "./conf";
import { createDotShaderSource, hexToRgb } from "./helpers";
import type { IRadiantButton } from "./types";

interface EBState {
  hasError: boolean;
}

class RadiantErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  EBState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("RadiantButton native render error caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.props.children;
    }
    return this.props.children;
  }
}

const DEFAULT_THEME = {
  background: "#000000",
  backgroundSubtle: "#000000",
  foreground: "#ffffff",
  highlight: "#e37e19",
  highlightSubtle: "#000000",
};

const RadiantButtonCore: React.FC<IRadiantButton> = memo(
  function RadiantButtonCore({
    children,
    onPress,
    style,
    textStyle,
    borderRadius = 16,
    borderWidth = 1.5,
    duration = 3000,
    theme: themeProp,
    paddingHorizontal = 24,
    paddingVertical = 14,
    disabled = false,
    showDots = true,
    showShimmer = true,
    showGlow = true,
    dotSpacing = 5,
    dotRadius = 0.75,
    dotOpacity = 0.5,
    shimmerOpacity = 0.5,
    glowBlur = 18,
    glowWidth = 0.55,
    breathingEnabled = true,
    glowBandWidth = 0.18,
  }: IRadiantButton) {
    const progress = useSharedValue<number>(0);
    const shimmerAngle = useSharedValue<number>(0);
    const breathe = useSharedValue<number>(0);
    const pressed = useSharedValue<number>(0);

    const theme = useMemo(
      () => ({ ...DEFAULT_THEME, ...themeProp }),
      [themeProp],
    );

    const highlightColor = theme.highlight || "#e37e19";

    const highlightRgb = useMemo<number[]>(
      () => hexToRgb(highlightColor),
      [highlightColor],
    );

    const [layout, setLayout] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });

    const borderGlowShader = useMemo(() => {
      try {
        if (!Skia?.RuntimeEffect) return null;
        return Skia.RuntimeEffect.Make(BORDER_GLOW_SHADER);
      } catch {
        return null;
      }
    }, []);

    const dotShader = useMemo(() => {
      if (!showDots) return null;
      try {
        if (!Skia?.RuntimeEffect) return null;
        return Skia.RuntimeEffect.Make(
          createDotShaderSource<number, number>(
            dotSpacing,
            dotRadius,
            dotOpacity,
            false,
          ),
        );
      } catch {
        return null;
      }
    }, [showDots, dotSpacing, dotRadius, dotOpacity]);

    useEffect(() => {
      if (disabled) return;

      progress.value = withRepeat<number>(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false,
      );

      if (showShimmer) {
        shimmerAngle.value = withRepeat<number>(
          withTiming(360, {
            duration: duration / 0.4,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
      }

      if (breathingEnabled && showGlow) {
        breathe.value = withRepeat<number>(
          withTiming(1, {
            duration: duration * 1.5,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        );
      }
    }, [disabled, duration, showShimmer, showGlow, breathingEnabled, progress, shimmerAngle, breathe]);

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w > 0 && h > 0 && (w !== layout.width || h !== layout.height)) {
        setLayout({ width: w, height: h });
      }
    };

    const { width, height } = layout;
    const cx = width / 2;
    const cy = height / 2;

    const innerClip = useMemo(() => {
      if (!width || !height || !Skia?.Path) return undefined;
      try {
        const bw = borderWidth;
        const p = Skia.Path.Make();
        p.addRRect(
          Skia.RRectXY(
            Skia.XYWHRect(bw, bw, width - bw * 2, height - bw * 2),
            Math.max(borderRadius - bw, 0),
            Math.max(borderRadius - bw, 0),
          ),
        );
        return p;
      } catch {
        return undefined;
      }
    }, [width, height, borderRadius, borderWidth]);

    const borderGlowUniforms = useDerivedValue(() => {
      const bandWidthAdjusted = interpolate(
        pressed.value,
        [0, 1],
        [glowBandWidth, glowBandWidth * 1.8],
      );
      return {
        iResolution: [width, height] as [number, number],
        progress: progress.value,
        borderRadius: borderRadius,
        borderWidth: borderWidth,
        bandWidth: bandWidthAdjusted,
        highlightColor: highlightRgb,
      };
    });

    const dotUniforms = useDerivedValue(() => ({
      iResolution: [width, height] as [number, number],
      angle: progress.value * Math.PI * 2,
    }));

    const shimmerTransform = useDerivedValue(() => {
      const rad = (shimmerAngle.value * Math.PI) / 180;
      return [{ rotate: rad }];
    });

    const glowOpacity = useDerivedValue<number>(() => {
      const base = 0.55;
      const breatheAdd = breathingEnabled
        ? interpolate(breathe.value, [0, 1], [0, 0.35])
        : 0;
      const pressAdd = interpolate(pressed.value, [0, 1], [0, 0.45]);
      return base + breatheAdd + pressAdd;
    });

    const glowScale = useDerivedValue<number>(() =>
      breathingEnabled ? interpolate(breathe.value, [0, 1], [1, 1.25]) : 1,
    );

    const glowTransform = useDerivedValue(() => [{ scale: glowScale.value }]);

    const handlePressIn = () => {
      // eslint-disable-next-line react-hooks/immutability
      pressed.value = withTiming<number>(1, { duration: 180 });
    };

    const handlePressOut = () => {
      // eslint-disable-next-line react-hooks/immutability
      pressed.value = withTiming<number>(0, { duration: 350 });
    };

    const animatedPressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.985]) }],
    }));

    const animatedFloorAuraStyle = useAnimatedStyle(() => ({
      opacity: interpolate(breathe.value, [0, 1], [0.45, 0.85]),
      transform: [{ scaleX: interpolate(breathe.value, [0, 1], [1, 1.15]) }],
    }));

    const shimmerSize = Math.max(width, height) * 1.6;
    const hasLayout = width > 0 && height > 0;

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
      <View style={[styles.outerWrapper, style]}>
        {/* HALO RADIANTE EXTERNO (EL SPOTLIGHT DE FONDO IDENTICO AL SHOWCASE DE REACTICX) */}
        {showGlow && hasLayout && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floorAura,
              {
                width: width * glowWidth * 1.4,
                backgroundColor: highlightColor,
                shadowColor: highlightColor,
              },
              animatedFloorAuraStyle,
            ]}
          />
        )}

        <Animated.View style={animatedPressStyle}>
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
                opacity: disabled ? 0.5 : 1,
                backgroundColor: theme.background,
              },
            ]}
          >
            {hasLayout && innerClip && (
              <Canvas style={StyleSheet.absoluteFill}>
                {/* 1. SHADER DE BORDE RADIANTE (PERÍMETRO ROTATIVO) */}
                {borderGlowShader && (
                  <Group>
                    <Rect x={0} y={0} width={width} height={height}>
                      <Shader
                        source={borderGlowShader}
                        uniforms={borderGlowUniforms}
                      />
                      <BlurMask blur={8} style="normal" />
                    </Rect>
                    <Rect x={0} y={0} width={width} height={height}>
                      <Shader
                        source={borderGlowShader}
                        uniforms={borderGlowUniforms}
                      />
                    </Rect>
                  </Group>
                )}

                {/* 2. SUPERFICIE INTERIOR CON DOT MATRIX, SHIMMER Y RESPLANDOR */}
                <Group clip={innerClip}>
                  <Rect
                    x={borderWidth}
                    y={borderWidth}
                    width={width - borderWidth * 2}
                    height={height - borderWidth * 2}
                    color={theme.background}
                  />

                  <RoundedRect
                    x={borderWidth}
                    y={borderWidth}
                    width={width - borderWidth * 2}
                    height={height - borderWidth * 2}
                    r={Math.max(borderRadius - borderWidth, 0)}
                    color={theme.backgroundSubtle}
                    style="stroke"
                    strokeWidth={1}
                  />

                  {/* 3. MATRIZ DE PUNTOS CON SHADER */}
                  {showDots && dotShader && (
                    <Fill>
                      <Shader source={dotShader} uniforms={dotUniforms} />
                    </Fill>
                  )}

                  {/* 4. MÁSCARA DE SHIMMER DIAGONAL ROTATIVO */}
                  {showShimmer && (
                    <Mask
                      mask={
                        <Group>
                          <Rect
                            x={borderWidth}
                            y={borderWidth}
                            width={width - borderWidth * 2}
                            height={height - borderWidth * 2}
                          >
                            <LinearGradient
                              start={vec(cx, borderWidth)}
                              end={vec(cx, height - borderWidth)}
                              colors={["transparent", "transparent", "white"]}
                              positions={[0, 0.4, 1]}
                            />
                          </Rect>
                        </Group>
                      }
                    >
                      <Group
                        transform={shimmerTransform}
                        origin={vec(cx, cy)}
                        opacity={shimmerOpacity}
                      >
                        <Rect
                          x={cx - shimmerSize / 2}
                          y={cy - shimmerSize / 2}
                          width={shimmerSize}
                          height={shimmerSize}
                        >
                          <LinearGradient
                            start={vec(0, 0)}
                            end={vec(shimmerSize, shimmerSize * 0.7)}
                            colors={[
                              "transparent",
                              "transparent",
                              highlightColor,
                              "transparent",
                              "transparent",
                            ]}
                            positions={[0, 0.35, 0.5, 0.65, 1]}
                          />
                        </Rect>
                      </Group>
                    </Mask>
                  )}

                  {/* 5. RESPLANDOR DIFUSO RESPIRATORIO INTERNO */}
                  {showGlow && (
                    <Group
                      transform={glowTransform}
                      origin={vec(cx, height)}
                      opacity={glowOpacity}
                    >
                      <RoundedRect
                        x={cx - (width * glowWidth) / 2}
                        y={height - 18}
                        width={width * glowWidth}
                        height={24}
                        r={12}
                        color={highlightColor}
                      >
                        <BlurMask blur={glowBlur} style="normal" />
                      </RoundedRect>
                    </Group>
                  )}
                </Group>
              </Canvas>
            )}

            <View style={styles.content}>{renderChildren()}</View>
          </Pressable>
        </Animated.View>
      </View>
    );
  },
);

const RadiantButton: React.FC<IRadiantButton> = (props) => {
  const fallback = (
    <View
      style={[
        styles.button,
        {
          borderRadius: props.borderRadius ?? 16,
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
      <RadiantButtonCore {...props} />
    </RadiantErrorBoundary>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  floorAura: {
    position: "absolute",
    bottom: -14,
    height: 38,
    borderRadius: 19,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 12,
    zIndex: 0,
  },
  button: {
    position: "relative",
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default RadiantButton;
