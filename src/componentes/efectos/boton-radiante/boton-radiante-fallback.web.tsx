import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { IRadiantButton } from "./types";

const DEFAULT_THEME = {
  background: "#000000",
  backgroundSubtle: "#1a1a1a",
  foreground: "#ffffff",
  highlight: "#c084fc",
  highlightSubtle: "#a855f7",
};

/**
 * Fallback visual mientras CanvasKit (Skia web) carga bajo demanda.
 * Mantiene la geometría, colores y el press del componente oficial para
 * que el cambio al canvas real no provoque un salto brusco.
 */
const RadiantButtonFallback: React.FC<IRadiantButton> = memo(
  function RadiantButtonFallback({
    children,
    onPress,
    style,
    textStyle,
    borderRadius = 12,
    borderWidth = 2,
    theme: themeProp,
    paddingHorizontal = 24,
    paddingVertical = 14,
    disabled = false,
  }: IRadiantButton) {
    const pressed = useSharedValue(0);
    const theme = { ...DEFAULT_THEME, ...themeProp };
    const highlight = theme.highlight || "#c084fc";

    const pressStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: interpolate(pressed.value, [0, 1], [0, 1]) }],
    }));

    return (
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            pressed.value = withTiming(1, { duration: 300 });
          }}
          onPressOut={() => {
            pressed.value = withTiming(0, { duration: 600 });
          }}
          disabled={disabled}
          style={[
            styles.button,
            {
              borderRadius,
              paddingHorizontal,
              paddingVertical,
              opacity: disabled ? 0.5 : 1,
              backgroundColor: theme.background,
              borderWidth,
              borderColor: `${highlight}26`,
            },
            style,
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.bottomGlow,
              { backgroundColor: highlight, shadowColor: highlight },
            ]}
          />
          <View style={styles.content}>
            {typeof children === "string" ? (
              <Text
                style={[
                  styles.text,
                  { color: theme.foreground },
                  textStyle,
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

RadiantButtonFallback.displayName = "RadiantButtonFallback";

const styles = StyleSheet.create({
  button: {
    position: "relative",
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -14,
    alignSelf: "center",
    width: "50%",
    height: 26,
    borderRadius: 13,
    opacity: 0.3,
    // @ts-ignore web only
    filter: "blur(18px)",
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
  },
});

export default RadiantButtonFallback;
