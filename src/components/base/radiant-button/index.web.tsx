import React, { memo, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import type { IRadiantButton } from "./types";

const DEFAULT_THEME = {
  background: "#000000",
  backgroundSubtle: "#101016",
  foreground: "#ffffff",
  highlight: "#e37e19",
  highlightSubtle: "#000000",
};

const RadiantButtonWeb: React.FC<IRadiantButton> = memo(
  function RadiantButtonWeb({
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
    showDots = true,
    showShimmer = true,
    showGlow = true,
    dotSpacing = 6,
    dotRadius = 0.8,
    dotOpacity = 0.45,
    shimmerOpacity = 0.4,
    glowWidth = 0.6,
    breathingEnabled = true,
  }: IRadiantButton) {
    const progress = useSharedValue<number>(0);
    const breathe = useSharedValue<number>(0);
    const pressed = useSharedValue<number>(0);

    const theme = useMemo(
      () => ({ ...DEFAULT_THEME, ...themeProp }),
      [themeProp],
    );

    const [layout, setLayout] = useState({ width: 0, height: 0 });

    useEffect(() => {
      if (disabled) return;

      progress.value = withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false,
      );

      if (breathingEnabled && showGlow) {
        breathe.value = withRepeat(
          withTiming(1, {
            duration: duration * 0.7,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        );
      }
    }, [disabled, duration, showGlow, breathingEnabled, progress, breathe]);

    const handlePressIn = () => {
      pressed.value = withTiming(1, { duration: 150 });
    };

    const handlePressOut = () => {
      pressed.value = withTiming(0, { duration: 300 });
    };

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w !== layout.width || h !== layout.height) {
        setLayout({ width: w, height: h });
      }
    };

    const animatedPressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.98]) }],
    }));

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

    const highlight = theme.highlight || "#e37e19";

    return (
      <Animated.View style={[animatedPressStyle, style]}>
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
              borderWidth,
              borderColor: `${highlight}55`,
              // Sombra radiante envolvente para Web
              // @ts-ignore
              boxShadow: showGlow
                ? `0 0 16px ${highlight}33, inset 0 0 12px ${highlight}22`
                : undefined,
            },
          ]}
        >
          {/* Matriz de micro-puntos estética de fondo */}
          {showDots && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  opacity: dotOpacity,
                  // @ts-ignore
                  backgroundImage: `radial-gradient(${highlight} ${dotRadius}px, transparent ${dotRadius}px)`,
                  // @ts-ignore
                  backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
                  // @ts-ignore
                  maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                  // @ts-ignore
                  WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                },
              ]}
            />
          )}

          {/* Halo radiante inferior que respira */}
          {showGlow && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -6,
                alignSelf: "center",
                width: `${glowWidth * 100}%`,
                height: 14,
                borderRadius: 7,
                backgroundColor: highlight,
                opacity: 0.45,
                // @ts-ignore
                filter: "blur(10px)",
              }}
            />
          )}

          {/* Shimmer superior tenue */}
          {showShimmer && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  opacity: shimmerOpacity,
                  // @ts-ignore
                  background: `linear-gradient(105deg, transparent 20%, ${highlight}22 50%, transparent 80%)`,
                },
              ]}
            />
          )}

          <View style={styles.content}>{renderChildren()}</View>
        </Pressable>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  button: {
    position: "relative",
    overflow: "hidden",
    minHeight: 44,
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

RadiantButtonWeb.displayName = "RadiantButtonWeb";

export default RadiantButtonWeb;
