import type { StyleProp, ViewStyle } from 'react-native';

export interface EjercicioGifProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'contain' | 'cover';
  /** Fuerza imagen estática (primer fotograma) para listas y miniaturas. */
  animated?: boolean;
  paused?: boolean;
  accessibilityLabel?: string;
  /** Solo se usa en web; en nativo se ignora. */
  transition?: number;
}
