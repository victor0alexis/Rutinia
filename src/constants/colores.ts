import { tema } from './tema';

export { noir } from './noir';

export const colores = {
  // Fondos y Capas (Base tokens de tema.ts)
  fondo: tema.colores.fondo,
  fondoGradiente: ['#080A0F', '#040508', '#000000', '#06080E'] as const,
  tarjeta: tema.fondo.vidrio,
  tarjetaSolida: tema.colores.superficie,
  tarjetaElevada: tema.fondo.vidrio,
  borde: tema.fondo.bordeVidrio,
  bordeBrillante: '#333A4E',
  bordeGlow: 'rgba(194, 36, 61, 0.45)',

  // Acento Carmesí
  primario: '#9E1C30',
  primarioHover: tema.colores.carmesi,
  primarioSuave: 'rgba(194, 36, 61, 0.16)',
  primarioGlow: 'rgba(194, 36, 61, 0.38)',

  // Línea de contorno luminoso
  glowLine: ['rgba(244, 243, 248, 0.85)', 'rgba(194, 36, 61, 0.7)', 'rgba(194, 36, 61, 0.05)'] as const,

  // Textos y Legibilidad
  texto: tema.colores.texto,
  suave: tema.colores.textoSuave,
  mutado: '#6B7280',

  // Indicadores de Estado
  hoy: tema.colores.naranja,
  peligro: '#DC2626',
  exito: tema.colores.verde,
  exitoBorde: tema.colores.verdeBorde,
  violeta: tema.colores.violeta,

  // Halos de Luz Ambiental
  haloPrimario: 'rgba(194, 36, 61, 0.12)',
  haloAzul: 'rgba(59, 130, 246, 0.08)',
  haloEsmeralda: 'rgba(43, 213, 152, 0.08)',
};

export const fuentes = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
  black: 'Outfit_900Black',
};

export const COLORES_PLANES = [
  '#E0334F', // Carmesí Rutinia
  '#F59E0B', // Ámbar / Dorado
  '#10B981', // Esmeralda
  '#06B6D4', // Cian Glaciar
  '#3B82F6', // Azul Cobalto
  '#8B5CF6', // Violeta
  '#EC4899', // Rosa Intenso
  '#6366F1', // Índigo
] as const;

export const ICONOS_PLANES = [
  'barbell-outline',
  'flame-outline',
  'flash-outline',
  'fitness-outline',
  'trophy-outline',
  'body-outline',
  'heart-outline',
  'shield-checkmark-outline',
] as const;

export const DIAS_SEMANA_ABREV = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const DIAS_SEMANA_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
