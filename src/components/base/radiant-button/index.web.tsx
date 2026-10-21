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
  backgroundSubtle: "#000000",
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
    glowWidth = 0.55,
    breathingEnabled = true,
  }: IRadiantButton) {
    const progress = useSharedValue<number>(0);
    const breathe = useSharedValue<number>(0);
    const pressed = useSharedValue<number>(0);

    const theme = useMemo(
      () => ({ ...DEFAULT_THEME, ...themeProp }),
      [themeProp],
    );

    const highlightColor = theme.highlight || "#e37e19";

    const [layout, setLayout] = useState({ width: 0, height: 0 });

    useEffect(() => {
      if (disabled) return;

      progress.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false,
      );

      if (breathingEnabled && showGlow) {
        breathe.value = withRepeat(
          withTiming(1, {
            duration: duration * 1.5,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        );
      }
    }, [disabled, duration, showGlow, breathingEnabled, progress, breathe]);

    const handlePressIn = () => {
      pressed.value = withTiming(1, { duration: 180 });
    };

    const handlePressOut = () => {
      pressed.value = withTiming(0, { duration: 350 });
    };

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w > 0 && h > 0 && (w !== layout.width || h !== layout.height)) {
        setLayout({ width: w, height: h });
      }
    };

    const animatedPressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.985]) }],
    }));

    const animatedFloorAuraStyle = useAnimatedStyle(() => ({
      opacity: interpolate(breathe.value, [0, 1], [0.5, 0.9]),
      transform: [{ scaleX: interpolate(breathe.value, [0, 1], [1, 1.2]) }],
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

    const { width } = layout;

    return (
      <View style={[styles.outerWrapper, style]}>
        {/* SPOTLIGHT HALO RADIANTE EXTERIOR (IDÉNTICO AL SHOWCASE DE REACTICX) */}
        {showGlow && width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floorAura,
              {
                width: width * glowWidth * 1.4,
                backgroundColor: highlightColor,
                // @ts-ignore
                boxShadow: `0 14px 45px 12px ${highlightColor}99`,
                filter: "blur(14px)",
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
                backgroundColor: theme.background,
                opacity: disabled ? 0.5 : 1,
                borderWidth,
                borderColor: `${highlightColor}44`,
                // @ts-ignore
                boxShadow: `0 0 20px ${highlightColor}44, inset 0 0 16px ${highlightColor}22`,
              },
            ]}
          >
            {/* MATRIZ DE PUNTOS SKIA-LIKE EN WEB */}
            {showDots && (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius,
                    opacity: dotOpacity,
                    // @ts-ignore
                    backgroundImage: `radial-gradient(${highlightColor} ${dotRadius}px, transparent ${dotRadius}px)`,
                    // @ts-ignore
                    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
                    // @ts-ignore
                    maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
                    // @ts-ignore
                    WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
                  },
                ]}
              />
            )}

            {/* HALO DE RESPLANDOR INTERIOR INFERIOR */}
            {showGlow && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  bottom: -10,
                  alignSelf: "center",
                  width: `${glowWidth * 100}%`,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: highlightColor,
                  opacity: 0.6,
                  // @ts-ignore
                  filter: "blur(12px)",
                }}
              />
            )}

            {/* SHIMMER DIAGONAL REFLEX */}
            {showShimmer && (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius,
                    opacity: shimmerOpacity,
                    // @ts-ignore
                    background: `linear-gradient(115deg, transparent 25%, ${highlightColor}33 50%, transparent 75%)`,
                  },
                ]}
              />
            )}

            <View style={styles.content}>{renderChildren()}</View>
          </Pressable>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  outerWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  floorAura: {
    position: "absolute",
    bottom: -16,
    height: 38,
    borderRadius: 19,
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
    zIndex: 2,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});

RadiantButtonWeb.displayName = "RadiantButtonWeb";

export default RadiantButtonWeb;
