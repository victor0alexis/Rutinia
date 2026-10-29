/**
 * `metal-skia.tsx` is the literal source of the Reacticx Metal component:
 * https://reacticx.com/components/metal
 *
 * Native and web both render that exact implementation. On web it is loaded
 * lazily through `index.web.tsx` once CanvasKit is ready, because Skia's
 * runtime shader compiler is not available when the JS bundle first executes.
 */
import React from "react";
import { Platform, View } from "react-native";

import { Metal as MetalCanvas } from "./metal-skia";
import type { IMetal } from "./types";

/**
 * Expo Router may resolve this native entry while rendering on the server.
 * Skia and its native module only exist in the app runtime, so keep web SSR on
 * a plain wrapper. Native platforms always use the animated Metal.
 */
export const Metal: React.FC<IMetal> = (props) => {
  if (Platform.OS === "web" && typeof window === "undefined") {
    return <View style={props.style}>{props.children}</View>;
  }

  return <MetalCanvas {...props} />;
};

Metal.displayName = "Metal";
