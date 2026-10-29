/**
 * Contrato compartido entre la implementación web (Paper Shaders/WebGL) y la
 * implementación nativa (Skia/SkSL). Mantener estos nombres alineados con los
 * uniforms del shader original de Paper/Vengeance UI.
 */
export interface LiquidMetalShaderProps {
  /** Color de fondo sobre el que se funden los bordes. */
  colorBack?: string;
  /** Color que tiñe el cromo (color burn). */
  colorTint?: string;
  /** Velocidad de la animación. 0 congela el shader. */
  speed?: number;
  /** Número de repeticiones de las bandas de metal. */
  repetition?: number;
  /** Distorsión orgánica del borde. */
  distortion?: number;
  /** Suavizado de las bandas. */
  softness?: number;
  /** Separación cromática del canal rojo. */
  shiftRed?: number;
  /** Separación cromática del canal azul. */
  shiftBlue?: number;
  /** Ángulo de las bandas en grados. */
  angle?: number;
  /** Dureza del contorno (0 = suave, 0.4 = duro). */
  contour?: number;
  /**
   * Grosor del anillo visible. En nativo permite recortar el shader al borde
   * y evitar sombrear el centro tapado por el cuerpo del botón. En web se
   * ignora (el canvas completo queda cubierto por el cuerpo interior).
   */
  borderWidth?: number;
  borderRadius?: number;
  /** Ancho lógico en puntos. En web se ignora y se usa el 100% del contenedor. */
  width?: number;
  /** Alto lógico en puntos. En web se ignora y se usa el 100% del contenedor. */
  height?: number;
  /** Permite pausar la animación sin desmontar el shader. */
  activo?: boolean;
}

/** Subconjunto de opciones que expone el botón como `metalConfig`. */
export type LiquidMetalShaderConfig = Pick<
  LiquidMetalShaderProps,
  | 'colorBack'
  | 'colorTint'
  | 'speed'
  | 'repetition'
  | 'distortion'
  | 'softness'
  | 'shiftRed'
  | 'shiftBlue'
  | 'angle'
  | 'contour'
>;

/** Valores por defecto equivalentes al preset de Vengeance UI. */
export const LIQUID_METAL_DEFAULTS = {
  colorBack: '#888888',
  colorTint: '#ffffff',
  speed: 0.4,
  repetition: 4,
  distortion: 0.15,
  softness: 0,
  shiftRed: 0.3,
  shiftBlue: -0.3,
  angle: 45,
  contour: 0.4,
  borderRadius: 26,
} as const;
