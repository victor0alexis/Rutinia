import React, { Component, lazy, Suspense } from "react";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import RadiantButtonFallback from "./radiant-button-fallback.web";
import type { IRadiantButton } from "./types";

/**
 * En web el componente oficial se carga bajo demanda junto con CanvasKit.
 * Así se ejecuta exactamente el mismo shader SkSL que en iOS/Android, sin
 * reimplementar el efecto con CSS.
 */
const CANVASKIT_WASM_PATH = "/canvaskit.wasm";

type RadiantButtonModule = {
  default: React.ComponentType<IRadiantButton>;
};

let componentPromise: Promise<RadiantButtonModule> | null = null;

function loadRadiantButton(): Promise<RadiantButtonModule> {
  if (!componentPromise) {
    componentPromise = (async () => {
      await LoadSkiaWeb({
        locateFile: (file: string) =>
          file.endsWith(".wasm") ? CANVASKIT_WASM_PATH : `/${file}`,
      });

      // Otros componentes de la app (BotonRutinia, MainDayCard, etc.)
      // importan Skia de forma estática en el bundle principal. Ese import
      // ocurre antes de que CanvasKit exista, así que el singleton `Skia`
      // queda con factorías sin CanvasKit. Lo refrescamos aquí, antes de
      // montar el componente oficial.
      const [{ Skia }, { JsiSkApi }] = await Promise.all([
        import("@shopify/react-native-skia"),
        import("@shopify/react-native-skia/lib/module/skia/web/JsiSkia"),
      ]);
      Object.assign(Skia, JsiSkApi(globalThis.CanvasKit));

      return import("./radiant-button-skia");
    })().catch((error) => {
      // Permite reintentar si CanvasKit no pudo cargar (por ejemplo, offline).
      componentPromise = null;
      throw error;
    });
  }
  return componentPromise;
}

const LazyRadiantButton = lazy(loadRadiantButton);

interface SkiaErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface SkiaErrorBoundaryState {
  failed: boolean;
}

class SkiaErrorBoundary extends Component<
  SkiaErrorBoundaryProps,
  SkiaErrorBoundaryState
> {
  constructor(props: SkiaErrorBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("RadiantButton web render error caught:", error);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const RadiantButtonWeb: React.FC<IRadiantButton> = (props) => (
  <SkiaErrorBoundary fallback={<RadiantButtonFallback {...props} />}>
    <Suspense fallback={<RadiantButtonFallback {...props} />}>
      <LazyRadiantButton {...props} />
    </Suspense>
  </SkiaErrorBoundary>
);

RadiantButtonWeb.displayName = "RadiantButtonWeb";

export default RadiantButtonWeb;
