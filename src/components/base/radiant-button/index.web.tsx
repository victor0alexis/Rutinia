import React, { lazy, Suspense } from "react";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import RadiantButtonFallback from "./radiant-button-fallback.web";
import type { IRadiantButton } from "./types";

/**
 * En web el componente oficial se carga bajo demanda junto con CanvasKit.
 * Así se ejecuta exactamente el mismo shader SkSL que en iOS/Android, sin
 * reimplementar el efecto con CSS.
 */
const CANVASKIT_VERSION = "0.41.0";
const CANVASKIT_CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full`;

type RadiantButtonModule = {
  default: React.ComponentType<IRadiantButton>;
};

let componentPromise: Promise<RadiantButtonModule> | null = null;

function loadRadiantButton(): Promise<RadiantButtonModule> {
  if (!componentPromise) {
    componentPromise = (async () => {
      await LoadSkiaWeb({
        locateFile: (file: string) => `${CANVASKIT_CDN}/${file}`,
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
    })();
  }
  return componentPromise;
}

const LazyRadiantButton = lazy(loadRadiantButton);

const RadiantButtonWeb: React.FC<IRadiantButton> = (props) => (
  <Suspense fallback={<RadiantButtonFallback {...props} />}>
    <LazyRadiantButton {...props} />
  </Suspense>
);

RadiantButtonWeb.displayName = "RadiantButtonWeb";

export default RadiantButtonWeb;
