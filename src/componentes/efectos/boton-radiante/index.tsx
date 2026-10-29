import React, { Component } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RadiantButtonSkia } from "./boton-radiante-skia";
import type { IRadiantButton } from "./types";

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * En nativo Skia siempre está disponible, pero mantenemos una red de
 * seguridad para que un fallo puntual del shader no tumbe la pantalla.
 */
class RadiantErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("RadiantButton render error caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const RadiantButtonFallback: React.FC<IRadiantButton> = ({
  children,
  style,
  textStyle,
  borderRadius = 12,
  borderWidth = 2,
  theme,
  paddingHorizontal = 24,
  paddingVertical = 14,
  disabled = false,
}) => (
  <View
    style={[
      styles.button,
      {
        borderRadius,
        borderWidth,
        borderColor: `${theme?.highlight ?? "#c084fc"}44`,
        backgroundColor: theme?.background ?? "#000000",
        paddingHorizontal,
        paddingVertical,
        opacity: disabled ? 0.5 : 1,
      },
      style,
    ]}
  >
    <View style={styles.content}>
      {typeof children === "string" ? (
        <Text
          style={[
            styles.text,
            { color: theme?.foreground ?? "#ffffff" },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  </View>
);

const RadiantButton: React.FC<IRadiantButton> = (props) => (
  <RadiantErrorBoundary fallback={<RadiantButtonFallback {...props} />}>
    <RadiantButtonSkia {...props} />
  </RadiantErrorBoundary>
);

RadiantButton.displayName = "RadiantButton";

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
  text: {
    fontSize: 16,
    fontWeight: "500",
  },
});

export default RadiantButton;
