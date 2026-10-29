/**
 * Calcula el 1RM estimado usando la fórmula estándar combinada (Epley / Brzycki).
 * - Si reps === 1, el 1RM es exactamente el peso ingresado.
 * - Si reps <= 10, usa fórmula Epley: peso * (1 + reps / 30).
 * - Si reps > 10, usa fórmula Brzycki: peso * (36 / (37 - reps)).
 */
export const calcular1RMEstimado = (
  pesoStr: string | number,
  repsStr: string | number
): number | null => {
  const peso = typeof pesoStr === 'string' ? parseFloat(pesoStr.replace(',', '.')) : pesoStr;
  const reps = typeof repsStr === 'string' ? parseInt(repsStr, 10) : repsStr;

  if (!peso || isNaN(peso) || peso <= 0 || !reps || isNaN(reps) || reps <= 0) return null;
  if (reps === 1) return Math.round(peso * 10) / 10;

  let estimado = 0;
  if (reps <= 10) {
    estimado = peso * (1 + reps / 30);
  } else if (reps < 36) {
    estimado = peso * (36 / (37 - reps));
  } else {
    estimado = peso * 1.5;
  }

  return Math.round(estimado * 10) / 10;
};

export type DistribucionDiscos = {
  disco: number;
  cantidadPorLado: number;
};

/**
 * Calcula la combinación óptima de discos por cada lado de la barra olímpica estándar.
 * Discos olímpicos estándar disponibles: 25, 20, 15, 10, 5, 2.5, 1.25 kg.
 */
export const calcularDiscosPorLado = (
  pesoTotalStr: string | number,
  pesoBarra = 20
): {
  pesoPorLado: number;
  discos: DistribucionDiscos[];
  posible: boolean;
} => {
  const pesoTotal =
    typeof pesoTotalStr === 'string' ? parseFloat(pesoTotalStr.replace(',', '.')) : pesoTotalStr;

  if (!pesoTotal || isNaN(pesoTotal) || pesoTotal < pesoBarra) {
    return { pesoPorLado: 0, discos: [], posible: false };
  }

  const pesoPorLado = (pesoTotal - pesoBarra) / 2;
  const discosDisponibles = [25, 20, 15, 10, 5, 2.5, 1.25];
  let remanente = pesoPorLado;
  const resultado: DistribucionDiscos[] = [];

  for (const d of discosDisponibles) {
    if (remanente >= d - 0.001) {
      const cantidad = Math.floor((remanente + 0.0001) / d);
      if (cantidad > 0) {
        resultado.push({ disco: d, cantidadPorLado: cantidad });
        remanente = Math.round((remanente - cantidad * d) * 100) / 100;
      }
    }
  }

  return {
    pesoPorLado,
    discos: resultado,
    posible: remanente < 0.25,
  };
};
