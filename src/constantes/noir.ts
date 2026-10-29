/**
 * Noir Pearl: la paleta de la pantalla principal.
 *
 * Es deliberadamente monocroma en la base (obsidiana -> grafito -> perla) y
 * reserva los acentos vivos para los micro-estados. Así el brillo blanco sigue
 * siendo la jerarquía principal y los colores no compiten entre sí.
 */
export const noir = {
  // Fondos
  bg: '#040507',
  surface: '#0A0C11',
  surface2: '#12141A',
  surface3: '#191C23',
  card: '#0F0F0F',
  routine: '#14161C',

  // Líneas y superficies de cristal
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.14)',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassStrong: 'rgba(255, 255, 255, 0.09)',

  // Texto
  text: '#F2F6FC',
  platinum: '#C9D1DD',
  muted: '#98A1AF',
  muted2: '#6E7582',

  // Blanco difuminado
  pearl: '#F2F6FC',
  ice: '#DCE9FF',
  glow: 'rgba(226, 239, 255, 0.34)',
  glowSoft: 'rgba(226, 239, 255, 0.12)',

  // Micro-acentos vivos
  info: '#5CC8FF',
  mint: '#3FF2B0',
  champagne: '#FFD166',
  lavender: '#B394FF',
} as const;
