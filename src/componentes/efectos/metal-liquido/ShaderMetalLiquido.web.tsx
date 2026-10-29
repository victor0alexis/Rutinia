import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LiquidMetal } from '@paper-design/shaders-react';
import { useReducedMotion } from 'react-native-reanimated';
import {
  LIQUID_METAL_DEFAULTS,
  type LiquidMetalShaderProps,
} from './types';

export type {
  LiquidMetalShaderConfig,
  LiquidMetalShaderProps,
} from './types';

const LiquidMetalShaderWeb = memo(function LiquidMetalShaderWeb({
  colorBack = LIQUID_METAL_DEFAULTS.colorBack,
  colorTint = LIQUID_METAL_DEFAULTS.colorTint,
  speed = LIQUID_METAL_DEFAULTS.speed,
  repetition = LIQUID_METAL_DEFAULTS.repetition,
  distortion = LIQUID_METAL_DEFAULTS.distortion,
  softness = LIQUID_METAL_DEFAULTS.softness,
  shiftRed = LIQUID_METAL_DEFAULTS.shiftRed,
  shiftBlue = LIQUID_METAL_DEFAULTS.shiftBlue,
  angle = LIQUID_METAL_DEFAULTS.angle,
  contour = LIQUID_METAL_DEFAULTS.contour,
  borderRadius = LIQUID_METAL_DEFAULTS.borderRadius,
  activo = true,
}: LiquidMetalShaderProps) {
  const reduceMotion = useReducedMotion();
  const velocidad = activo && !reduceMotion ? speed : 0;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius,
          overflow: 'hidden',
        },
      ]}
    >
      <LiquidMetal
        colorBack={colorBack}
        colorTint={colorTint}
        speed={velocidad}
        repetition={repetition}
        distortion={distortion}
        softness={softness}
        shiftRed={shiftRed}
        shiftBlue={shiftBlue}
        angle={angle}
        contour={contour}
        shape="none"
        scale={1}
        fit="cover"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: `${borderRadius}px`,
        }}
      />
    </View>
  );
});

LiquidMetalShaderWeb.displayName = 'LiquidMetalShaderWeb';

export default LiquidMetalShaderWeb;
