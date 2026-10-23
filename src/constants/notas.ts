import { Ionicons } from '@expo/vector-icons';
import type { CategoriaNota } from '../services/notas';

export const CATEGORIAS: CategoriaNota[] = [
  'General',
  'Nutrición',
  'Entrenamiento',
  'Suplementos',
  'Recuperación',
];

export type NotaCategoriaConfig = {
  color: string;
  bg: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * La biblioteca comparte los micro-acentos de Noir Pearl con las notas del
 * MainDayCard. El color nunca compite con la jerarquía blanca: solo identifica.
 */
export const CONFIG_CATEGORIAS: Record<string, NotaCategoriaConfig> = {
  Todas: {
    color: '#E9EEF6',
    bg: 'rgba(233, 238, 246, 0.14)',
    borderColor: 'rgba(233, 238, 246, 0.32)',
    icon: 'apps-outline',
  },
  General: {
    color: '#C9D1DD',
    bg: 'rgba(201, 209, 221, 0.12)',
    borderColor: 'rgba(201, 209, 221, 0.34)',
    icon: 'document-text-outline',
  },
  Nutrición: {
    color: '#3FF2B0',
    bg: 'rgba(63, 242, 176, 0.12)',
    borderColor: 'rgba(63, 242, 176, 0.38)',
    icon: 'nutrition-outline',
  },
  Entrenamiento: {
    color: '#B394FF',
    bg: 'rgba(179, 148, 255, 0.12)',
    borderColor: 'rgba(179, 148, 255, 0.38)',
    icon: 'fitness-outline',
  },
  Suplementos: {
    color: '#FFD166',
    bg: 'rgba(255, 209, 102, 0.12)',
    borderColor: 'rgba(255, 209, 102, 0.38)',
    icon: 'medical-outline',
  },
  Recuperación: {
    color: '#5CC8FF',
    bg: 'rgba(92, 200, 255, 0.12)',
    borderColor: 'rgba(92, 200, 255, 0.38)',
    icon: 'pulse-outline',
  },
};

export function obtenerConfigCategoria(categoria: string): NotaCategoriaConfig {
  return CONFIG_CATEGORIAS[categoria] ?? CONFIG_CATEGORIAS.General;
}
