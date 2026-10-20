import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LiquidMetal } from '@paper-design/shaders-react';

export interface LiquidMetalShaderProps {
  colorBack?: string;
  colorTint?: string;
  speed?: number;
  repetition?: number;
  distortion?: number;
  borderRadius?: number;
  width?: number;
  height?: number;
}

const LiquidMetalShaderWeb = memo(function LiquidMetalShaderWeb({
  colorBack = '#888888',
  colorTint = '#ffffff',
  speed = 0.4,
  repetition = 4,
  distortion = 0.15,
  borderRadius = 26,
}: LiquidMetalShaderProps) {
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
        speed={speed}
        repetition={repetition}
        distortion={distortion}
        softness={0}
        shiftRed={0.3}
        shiftBlue={-0.3}
        angle={45}
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
