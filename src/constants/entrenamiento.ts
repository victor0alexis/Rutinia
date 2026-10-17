/**
 * Constantes y funciones de cálculo para Entrenamiento en Rutinia.
 * Configuraciones de DropSets, Reps Parciales y Ejercicios.
 */

export const DROPSET_PORCENTAJE_REDUCCION = 0.20; // 20% de reducción entre drops
export const DROPSET_REDONDEO_KG = 2.5; // Redondeo al múltiplo de 2.5 kg más cercano
export const DROPSET_MAX_DROPS = 4; // Máximo 4 drops por serie

/**
 * Calcula el peso sugerido para un drop aplicando -20% y redondeando al múltiplo de 2.5 kg más cercano.
 * @param kgBase Peso del drop anterior o de la serie principal
 * @returns Peso sugerido en formato string con máximo 1 decimal limpio (ej. "32.5" o "30")
 */
export function calcularKgSugeridoDrop(kgBase: number | string): string {
  const baseNum = typeof kgBase === 'string' ? parseFloat(kgBase.replace(',', '.')) : kgBase;
  if (!baseNum || isNaN(baseNum) || baseNum <= 0) {
    return '';
  }

  const conReduccion = baseNum * (1 - DROPSET_PORCENTAJE_REDUCCION);
  const redondeado = Math.round(conReduccion / DROPSET_REDONDEO_KG) * DROPSET_REDONDEO_KG;
  const finalNum = Math.max(1, redondeado);

  // Evitar decimales innecesarios como 20.0
  return Number.isInteger(finalNum) ? finalNum.toString() : finalNum.toFixed(1);
}
