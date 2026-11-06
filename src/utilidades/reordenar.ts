import type { EjercicioState } from '../componentes/entrenamiento/EjecutarEntrenamientoModal';

export function reordenarEjercicios<T extends { id?: string }>(
  lista: T[],
  desde: number,
  hasta: number
): T[] {
  if (desde === hasta) return [...lista];
  if (desde < 0 || hasta < 0) return [...lista];
  if (desde >= lista.length || hasta >= lista.length) return [...lista];

  const copia = [...lista];
  const [movido] = copia.splice(desde, 1);
  copia.splice(hasta, 0, movido);
  return copia;
}

export function reordenarConOrdenConsecutivo<T extends { id?: string; orden?: number }>(
  lista: T[],
  desde: number,
  hasta: number
): T[] {
  const reordenada = reordenarEjercicios(lista, desde, hasta);
  return reordenada.map((item, idx) => ({
    ...item,
    orden: idx + 1,
  }));
}
