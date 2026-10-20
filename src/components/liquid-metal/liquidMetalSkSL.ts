/**
 * Port a SkSL del fragment shader `LiquidMetal` de Paper Shaders
 * (Apache-2.0), adaptado al preset que usa Vengeance UI:
 *
 *   shape="none", fit="cover", scale=1, softness=0,
 *   shiftRed=0.3, shiftBlue=-0.3, angle=45, contour=0.4
 *
 * Se eliminaron las ramas de imagen y las máscaras de formas distintas de
 * "none". SkSL no expone dFdx/dFdy en todos los backends, así que:
 *   - fwidth(edge) se calcula analíticamente a partir de la máscara;
 *   - fwidth(stripe) se aproxima con el tamaño del píxel y la densidad de
 *     bandas para conservar el antialiasing del original.
 */
import { processColor } from 'react-native';

export const LIQUID_METAL_SKSL = `
uniform float2 u_resolution;
uniform float u_pixelRatio;
uniform float u_time;

uniform float4 u_colorBack;
uniform float4 u_colorTint;

uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_angle;

const float PI = 3.14159265358979323846;

float2 rotate2(float2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return float2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float3 mod289_3(float3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float2 mod289_2(float2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float3 permute(float3 x) {
  return mod289_3(((x * 34.0) + 1.0) * x);
}

// Derivada de smoothstep(0, p, x). Se usa para aproximar fwidth(edge)
// sin depender de dFdx/dFdy, que no están disponibles en todos los
// backends de RuntimeEffect.
float smoothstepDeriv(float p, float x) {
  float t = clamp(x / p, 0.0, 1.0);
  return 6.0 * t * (1.0 - t) / p;
}

float snoise(float2 v) {
  float4 C = float4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  float2 i = floor(v + float2(dot(v, C.yy), dot(v, C.yy)));
  float2 x0 = v - i + float2(dot(i, C.xx), dot(i, C.xx));

  float2 i1 = (x0.x > x0.y) ? float2(1.0, 0.0) : float2(0.0, 1.0);

  float4 x12 = float4(x0.x, x0.y, x0.x, x0.y)
    + float4(C.x, C.x, C.z, C.z);
  x12 = float4(x12.x - i1.x, x12.y - i1.y, x12.z, x12.w);

  i = mod289_2(i);

  float3 p = permute(
    permute(float3(i.y + 0.0, i.y + i1.y, i.y + 1.0))
    + float3(i.x + 0.0, i.x + i1.x, i.x + 1.0)
  );

  float3 m = max(
    float3(0.5, 0.5, 0.5) - float3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    float3(0.0, 0.0, 0.0)
  );

  m = m * m;
  m = m * m;

  float3 x = 2.0 * fract(p * C.www) - float3(1.0, 1.0, 1.0);
  float3 h = abs(x) - float3(0.5, 0.5, 0.5);
  float3 ox = floor(x + float3(0.5, 0.5, 0.5));
  float3 a0 = x - ox;

  m *= 1.79284291400159
    - 0.85373472095314 * (a0 * a0 + h * h);

  float3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.y = a0.y * x12.x + h.y * x12.y;
  g.z = a0.z * x12.z + h.z * x12.w;

  return 130.0 * dot(m, g);
}

float getColorChanges(
  float c1,
  float c2,
  float stripeP,
  float3 w,
  float blur,
  float bump,
  float tint
) {
  float ch = mix(c2, c1, smoothstep(0.0, 2.0 * blur, stripeP));

  float border = w.x;
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripeP));

  border = w.x + 0.4 * (1.0 - bump) * w.y;
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripeP));

  border = w.x + 0.5 * (1.0 - bump) * w.y;
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripeP));

  border = w.x + w.y;
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripeP));

  float gradientT = (stripeP - w.x - w.y) / w.z;
  float gradient = mix(c1, c2, smoothstep(0.0, 1.0, gradientT));
  ch = mix(ch, gradient, smoothstep(border, border + 0.5 * blur, stripeP));

  // El color tint se aplica con blending "color burn".
  ch = mix(
    ch,
    1.0 - min(1.0, (1.0 - ch) / max(tint, 0.0001)),
    u_colorTint.a
  );

  return ch;
}

half4 main(float2 fragCoord) {
  float2 res = max(u_resolution, float2(1.0, 1.0));
  float dpr = max(u_pixelRatio, 1.0);

  // Paper usa un UV con el eje Y hacia arriba. En Skia el eje Y va hacia
  // abajo, así que invertimos Y antes de reproducir las mismas operaciones.
  float2 centered = float2(
    fragCoord.x / res.x - 0.5,
    0.5 - fragCoord.y / res.y
  );

  float ratio = res.x / res.y;
  float2 physicalRes = res * dpr;

  // shape = "none": máscara de borde sobre todo el canvas.
  float2 borderUV = centered + float2(0.5, 0.5);
  float2 mask = min(borderUV, float2(1.0, 1.0) - borderUV);
  float2 pixelThickness = min(
    float2(250.0, 250.0) / physicalRes,
    float2(0.5, 0.5)
  );

  float smoothedX = smoothstep(0.0, pixelThickness.x, mask.x);
  float smoothedY = smoothstep(0.0, pixelThickness.y, mask.y);
  float maskX = pow(smoothedX, 0.25);
  float maskY = pow(smoothedY, 0.25);

  float edge = clamp(1.0 - maskX * maskY, 0.0, 1.0);

  // fwidth(edge) aproximado analíticamente. Es importante para que el
  // borde exterior se funda con colorBack en el primer píxel, igual que
  // en la implementación WebGL de Paper.
  float dMaskX = smoothedX > 0.0
    ? 0.25 * pow(smoothedX, -0.75)
      * smoothstepDeriv(pixelThickness.x, mask.x)
    : 0.0;
  float dMaskY = smoothedY > 0.0
    ? 0.25 * pow(smoothedY, -0.75)
      * smoothstepDeriv(pixelThickness.y, mask.y)
    : 0.0;
  float signX = borderUV.x < 0.5 ? 1.0 : -1.0;
  float signY = borderUV.y < 0.5 ? 1.0 : -1.0;
  float dEdgeDx = -maskY * dMaskX * signX / max(res.x * dpr, 1.0);
  float dEdgeDy = -maskX * dMaskY * signY / max(res.y * dpr, 1.0);
  float aa = abs(dEdgeDx) + abs(dEdgeDy);

  // Corrección de aspecto de v_responsiveUV.
  float2 uv = centered;
  if (ratio > 1.0) {
    uv.y /= ratio;
  } else {
    uv.x *= ratio;
  }
  uv += float2(0.5, 0.5);
  uv.y = 1.0 - uv.y;

  float cycleWidth = u_repetition * 2.0;

  float2 rotatedUV = uv - float2(0.5, 0.5);
  float angle = (-u_angle + 70.0) * PI / 180.0;
  float cosA = cos(angle);
  float sinA = sin(angle);
  rotatedUV = float2(
    rotatedUV.x * cosA - rotatedUV.y * sinA,
    rotatedUV.x * sinA + rotatedUV.y * cosA
  ) + float2(0.5, 0.5);

  // u_contour: 0..0.4 controla la dureza del borde.
  edge = mix(
    smoothstep(0.9 - 2.0 * aa, 0.9, edge),
    edge,
    smoothstep(0.0, 0.4, u_contour)
  );

  float opacity = 1.0 - smoothstep(0.9 - 2.0 * aa, 0.9, edge);
  edge = 1.2 * edge;

  float diagBLtoTR = rotatedUV.x - rotatedUV.y;
  float diagTLtoBR = rotatedUV.x + rotatedUV.y;

  float3 color1 = float3(0.98, 0.98, 1.0);
  float3 color2 = float3(
    0.1,
    0.1,
    0.1 + 0.1 * smoothstep(0.7, 1.3, diagTLtoBR)
  );

  float2 gradUV = uv - float2(0.5, 0.5);
  float dist = length(gradUV + float2(0.0, 0.2 * diagBLtoTR));
  gradUV = rotate2(gradUV, (0.25 - 0.2 * diagBLtoTR) * PI);
  float direction = gradUV.x;

  float bump = pow(1.8 * dist, 1.2);
  bump = 1.0 - bump;
  bump *= pow(uv.y, 0.3);

  float thinStrip1Ratio = 0.12 / cycleWidth * (1.0 - 0.4 * bump);
  float thinStrip2Ratio = 0.07 / cycleWidth * (1.0 + 0.4 * bump);
  float wideStripRatio = 1.0 - thinStrip1Ratio - thinStrip2Ratio;

  float thinStrip1Width = cycleWidth * thinStrip1Ratio;
  float thinStrip2Width = cycleWidth * thinStrip2Ratio;

  float t = 0.3 * (u_time + 2.8);
  float noise = snoise(uv - float2(t, t));

  edge += (1.0 - edge) * u_distortion * noise;

  direction += diagBLtoTR;
  direction -= 2.0 * noise * diagBLtoTR
    * (smoothstep(0.0, 1.0, edge) * (1.0 - smoothstep(0.0, 1.0, edge)));

  // u_contour: 0.5..1 deforma las bandas junto a los bordes.
  direction *= mix(1.0, 1.0 - edge, smoothstep(0.5, 1.0, u_contour));
  direction -= 1.7 * edge * smoothstep(0.5, 1.0, u_contour);
  direction += 0.2 * pow(u_contour, 4.0)
    * (1.0 - smoothstep(0.0, 1.0, edge));

  bump *= clamp(pow(uv.y, 0.1), 0.3, 1.0);
  direction *= (0.1 + (1.1 - edge) * bump);

  direction *= (0.4 + 0.6 * (1.0 - smoothstep(0.5, 1.0, edge)));
  direction += 0.18
    * (smoothstep(0.1, 0.2, uv.y) * (1.0 - smoothstep(0.2, 0.4, uv.y)));
  direction += 0.03
    * (smoothstep(0.1, 0.2, 1.0 - uv.y)
      * (1.0 - smoothstep(0.2, 0.4, 1.0 - uv.y)));

  direction *= (0.5 + 0.5 * pow(uv.y, 2.0));
  direction *= cycleWidth;
  direction -= t;

  float colorDispersion = 1.0 - bump;
  colorDispersion = clamp(colorDispersion, 0.0, 1.0);

  float dispersionRed = colorDispersion;
  dispersionRed += 0.03 * bump * noise;
  dispersionRed += 5.0
    * (smoothstep(-0.1, 0.2, uv.y) * (1.0 - smoothstep(0.1, 0.5, uv.y)))
    * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 1.0, bump)));
  dispersionRed -= diagBLtoTR;

  float dispersionBlue = colorDispersion;
  dispersionBlue *= 1.3;
  dispersionBlue +=
    (smoothstep(0.0, 0.4, uv.y) * (1.0 - smoothstep(0.1, 0.8, uv.y)))
    * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 0.8, bump)));
  dispersionBlue -= 0.2 * edge;

  dispersionRed *= (u_shiftRed / 20.0);
  dispersionBlue *= (u_shiftBlue / 20.0);

  float blur = u_softness / 15.0;
  // fwidth(stripe) no está disponible en SkSL. Aproximamos el ancho de un
  // píxel en unidades de fase para antialiasear las bandas igual que Paper.
  float stripeAA = 1.0 * cycleWidth / max(res.x * dpr, 1.0);

  float3 w = float3(thinStrip1Width, thinStrip2Width, wideStripRatio);
  w.y -= 0.02 * smoothstep(0.0, 1.0, edge + bump);

  float stripeR = fract(direction + dispersionRed);
  float r = getColorChanges(
    color1.r, color2.r, stripeR, w, blur + stripeAA, bump, u_colorTint.r
  );

  float stripeG = fract(direction);
  float g = getColorChanges(
    color1.g, color2.g, stripeG, w, blur + stripeAA, bump, u_colorTint.g
  );

  float stripeB = fract(direction - dispersionBlue);
  float b = getColorChanges(
    color1.b, color2.b, stripeB, w, blur + stripeAA, bump, u_colorTint.b
  );

  float3 color = float3(r, g, b);
  color *= opacity;

  float3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  float alpha = opacity + u_colorBack.a * (1.0 - opacity);

  // Dithering para evitar banding en los degradados del cromo.
  color += float3(1.0 / 256.0)
    * (fract(sin(dot(0.014 * fragCoord * dpr, float2(12.9898, 78.233)))
      * 43758.5453123) - 0.5);

  // Skia espera color premultiplicado.
  return half4(color * alpha, alpha);
}
`;

/**
 * Convierte un color CSS básico (#RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb(),
 * rgba()) a un vec4 normalizado para los uniforms de SkSL.
 */
export function parseColorToRGBA(color: string): [number, number, number, number] {
  const value = color.trim();

  // React Native reconoce nombres CSS, hsl, etc. Igual que el componente web,
  // processColor devuelve un entero ARGB empaquetado.
  try {
    const processed = processColor(value);
    if (typeof processed === 'number') {
      const argb = processed >>> 0;
      return [
        ((argb >>> 16) & 0xff) / 255,
        ((argb >>> 8) & 0xff) / 255,
        (argb & 0xff) / 255,
        ((argb >>> 24) & 0xff) / 255,
      ];
    }
  } catch {
    // Si processColor no puede interpretar el valor, usamos el parser manual.
  }

  if (value.startsWith('#')) {
    let hex = value.slice(1);

    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }

    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;

      if (
        Number.isFinite(r) &&
        Number.isFinite(g) &&
        Number.isFinite(b) &&
        Number.isFinite(a)
      ) {
        return [r, g, b, a];
      }
    }
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (match) {
    const rawParts = match[1]
      .split(/[,\s/]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (rawParts.length >= 3) {
      const parseChannel = (part: string, isAlpha: boolean) => {
        const numeric = parseFloat(part);
        if (!Number.isFinite(numeric)) return NaN;
        if (part.endsWith('%')) return numeric / 100;
        return isAlpha ? numeric : numeric / 255;
      };

      const r = parseChannel(rawParts[0], false);
      const g = parseChannel(rawParts[1], false);
      const b = parseChannel(rawParts[2], false);
      const a = rawParts.length >= 4 ? parseChannel(rawParts[3], true) : 1;

      if (
        Number.isFinite(r) &&
        Number.isFinite(g) &&
        Number.isFinite(b) &&
        Number.isFinite(a)
      ) {
        const clamp01 = (channel: number) =>
          Math.min(1, Math.max(0, channel));
        return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
      }
    }
  }

  // Fallback: gris neutro, el mismo colorBack por defecto.
  return [0.533, 0.533, 0.533, 1];
}
