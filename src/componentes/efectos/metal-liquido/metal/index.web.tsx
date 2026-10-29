import React, {
  Children,
  Component,
  Suspense,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

import { CONF, METAL_COLORS } from "./const";
import { resolveRadius } from "./helper";
import type { IMetal, MetalStop } from "./types";

/**
 * Web entry point for the official Reacticx Metal component.
 *
 * The component compiles its SkSL shader lazily during render. CanvasKit is
 * asynchronous on web, so the exact Skia module is imported only after
 * `LoadSkiaWeb` has finished and the Skia singleton has been refreshed. While
 * it loads, a static rim with the same palette keeps the logo visually complete
 * instead of collapsing to the bare child.
 */
const CANVASKIT_WASM_PATH = "/canvaskit.wasm";

type MetalModule = {
  Metal: React.ComponentType<IMetal>;
};

let metalPromise: Promise<MetalModule> | null = null;

function loadMetal(): Promise<MetalModule> {
  if (!metalPromise) {
    metalPromise = (async () => {
      await LoadSkiaWeb({
        locateFile: (file: string) =>
          file.endsWith(".wasm") ? CANVASKIT_WASM_PATH : `/${file}`,
      });

      // Other parts of the app import Skia statically. Those imports run before
      // CanvasKit exists, so the singleton still has factories without a
      // backend. Refresh it before importing the exact shader implementation.
      const [{ Skia }, { JsiSkApi }] = await Promise.all([
        import("@shopify/react-native-skia"),
        import("@shopify/react-native-skia/lib/module/skia/web/JsiSkia"),
      ]);
      const skiaApi = JsiSkApi(globalThis.CanvasKit);

      // The package's static `Skia` binding is evaluated when the bundle is
      // first imported. Depending on the Metro environment it can be missing
      // or can still point to factories without a CanvasKit backend. Publish
      // the ready API globally and refresh the binding when it exists.
      (
        globalThis as unknown as { SkiaApi?: typeof skiaApi }
      ).SkiaApi = skiaApi;

      if (Skia) {
        Object.assign(Skia, skiaApi);
      }

      return import("./metal-skia");
    })().catch((error) => {
      // Allow a retry if CanvasKit could not be fetched (for example offline).
      metalPromise = null;
      throw error;
    });
  }

  return metalPromise;
}

const LazyMetal = lazy(async () => {
  const module = await loadMetal();
  return { default: module.Metal };
});

type MetalStyle = {
  style?: StyleProp<ViewStyle>;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  glow?: number;
  colors?: readonly MetalStop[];
  children?: React.ReactNode;
};

function getPaletteColor(colors: readonly MetalStop[] | undefined): string {
  const palette =
    colors && colors.length > 0 ? colors : METAL_COLORS.chromatic;
  const middle = palette[Math.min(Math.floor(palette.length / 2), palette.length - 1)];
  const stop = middle ?? "#B74616";

  return typeof stop === "string" ? stop : stop.color;
}

/**
 * Static rim shown only while CanvasKit loads. It uses the same outer edge,
 * radius, thickness and palette so the swap to the animated shader does not
 * move or resize the logo.
 */
const MetalFallback = memo(function MetalFallback({
  children,
  colors,
  borderWidth = CONF.borderWidth,
  borderRadius,
  opacity = CONF.opacity,
  glow = CONF.glow,
  style,
}: MetalStyle) {
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setMeasured((previous) =>
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  const childRadius = useMemo<StyleProp<ViewStyle>>(() => {
    const [child] = Children.toArray(children);

    return isValidElement<{ style?: StyleProp<ViewStyle> }>(child)
      ? child.props.style
      : undefined;
  }, [children]);

  const radius = resolveRadius(
    borderRadius,
    measured.width,
    measured.height,
    childRadius,
    style,
  );

  const ringColor = getPaletteColor(colors);

  return (
    <View style={style} onLayout={onLayout}>
      {children}

      {measured.width > 0 && measured.height > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.rim,
            {
              width: measured.width,
              height: measured.height,
              borderWidth,
              borderRadius: radius,
              borderColor: ringColor,
              opacity,
              shadowColor: ringColor,
              shadowOpacity: glow * 0.5,
              shadowRadius: Math.max(6, borderWidth * 2.5),
            },
          ]}
        />
      ) : null}
    </View>
  );
});

interface MetalErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface MetalErrorBoundaryState {
  failed: boolean;
}

class MetalErrorBoundary extends Component<
  MetalErrorBoundaryProps,
  MetalErrorBoundaryState
> {
  constructor(props: MetalErrorBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Metal web render error caught:", error);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const Metal: React.FC<IMetal> = (props) => {
  // Expo Router also renders these screens on the server. CanvasKit is a
  // browser-only binary, so the server snapshot gets the static rim and the
  // client snapshot resolves the lazy Skia module. `useSyncExternalStore`
  // makes the server/client distinction explicit without a cascading effect.
  const clientReady = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!clientReady) {
    return <MetalFallback {...props} />;
  }

  return (
    <MetalErrorBoundary fallback={<MetalFallback {...props} />}>
      <Suspense fallback={<MetalFallback {...props} />}>
        <LazyMetal {...props} />
      </Suspense>
    </MetalErrorBoundary>
  );
};

Metal.displayName = "Metal";

const styles = StyleSheet.create({
  rim: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
