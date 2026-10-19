import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export interface LiquidMetalShaderProps {
  colorBack?: string;
  colorTint?: string;
  speed?: number;
  repetition?: number;
  distortion?: number;
  borderRadius?: number;
  width: number;
  height: number;
}

const VS_SOURCE = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FS_SOURCE = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_colorBack;
  uniform vec3 u_colorTint;
  uniform float u_speed;
  uniform float u_repetition;
  uniform float u_distortion;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * u_speed;

    // Corrección de relación de aspecto para que el líquido sea uniforme en pastillas anchas
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y) * u_repetition;

    // Rotación de ángulo a 45 grados (como en VengeanceUI)
    float s = 0.70710678;
    p = vec2(p.x * s - p.y * s, p.x * s + p.y * s);

    // Ondas multicapa de distorsión líquida de mercurio
    float d1 = sin(p.x * 2.4 + t * 1.4) * cos(p.y * 2.4 + t * 0.8) * u_distortion;
    float d2 = cos(p.x * 2.8 - t * 1.0) * sin(p.y * 2.8 + t * 1.3) * u_distortion;
    p += vec2(d1, d2);

    float d3 = sin(p.y * 3.8 + t * 1.7) * u_distortion * 0.6;
    float d4 = cos(p.x * 3.8 - t * 1.4) * u_distortion * 0.6;
    p += vec2(d3, d4);

    // Dispersión cromática / aberración iridiscente (shiftRed = 0.35, shiftBlue = -0.35)
    float r = sin(p.x + p.y + t + 0.35) * 0.5 + 0.5;
    float g = sin(p.x + p.y + t) * 0.5 + 0.5;
    float b = sin(p.x + p.y + t - 0.35) * 0.5 + 0.5;

    // Curva de destello especular de cromo líquido pulido de alto contraste
    r = pow(r, 3.2);
    g = pow(g, 3.2);
    b = pow(b, 3.2);

    vec3 metal = mix(u_colorBack, u_colorTint, vec3(r, g, b));

    // Resplandor espectral platino / violeta / cian
    metal += vec3(r * 0.25, g * 0.12, b * 0.32);

    gl_FragColor = vec4(metal, 1.0);
  }
`;

function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return [0.5, 0.5, 0.5];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export default function LiquidMetalShaderWeb({
  colorBack = '#181B26',
  colorTint = '#FFFFFF',
  speed = 0.55,
  repetition = 4.0,
  distortion = 0.16,
  borderRadius = 26,
  width,
  height,
}: LiquidMetalShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const gl =
      canvas.getContext('webgl', { alpha: false, antialias: true }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) return;

    // Compilar vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return;
    gl.shaderSource(vs, VS_SOURCE);
    gl.compileShader(vs);

    // Compilar fragment shader
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) return;
    gl.shaderSource(fs, FS_SOURCE);
    gl.compileShader(fs);

    // Enlazar programa
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    // Cuadrilátero que cubre toda la pantalla
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uBack = gl.getUniformLocation(program, 'u_colorBack');
    const uTint = gl.getUniformLocation(program, 'u_colorTint');
    const uSpd = gl.getUniformLocation(program, 'u_speed');
    const uRep = gl.getUniformLocation(program, 'u_repetition');
    const uDist = gl.getUniformLocation(program, 'u_distortion');

    const backRgb = hexToRgb(colorBack);
    const tintRgb = hexToRgb(colorTint);

    let animationId: number;
    let startTime = performance.now();
    let isVisible = true;

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        startTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const render = (now: number) => {
      if (isVisible) {
        const elapsed = (now - startTime) * 0.001;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.round(width * dpr);
        const ch = Math.round(height * dpr);

        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }

        gl.viewport(0, 0, cw, ch);
        gl.uniform2f(uRes, cw, ch);
        gl.uniform1f(uTime, elapsed);
        gl.uniform3f(uBack, backRgb[0], backRgb[1], backRgb[2]);
        gl.uniform3f(uTint, tintRgb[0], tintRgb[1], tintRgb[2]);
        gl.uniform1f(uSpd, speed);
        gl.uniform1f(uRep, repetition);
        gl.uniform1f(uDist, distortion);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (gl) {
        gl.deleteBuffer(posBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, [width, height, colorBack, colorTint, speed, repetition, distortion]);

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
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: `${borderRadius}px`,
        }}
      />
    </View>
  );
}
