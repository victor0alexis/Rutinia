import { supabase } from '../lib/supabase';
import { Registro, EjercicioRegistro } from '../types';
import { registrosDeRango } from './registros';

export type RecordPersonal = {
  nombreEjercicio: string;
  maxPeso: number;
  maxReps: number;
  fecha: string;
  totalSeries: number;
};

export type MetricasProgreso = {
  volumenTotalKg: number;
  diasCompletados: number;
  seriesTotales: number;
  rachaDias: number;
  recordsPersonales: RecordPersonal[];
  ejerciciosStats: { nombre: string; series: number; maxPeso: number; porcentaje: number }[];
};

export async function obtenerMetricasProgreso(desde: string, hasta: string): Promise<MetricasProgreso> {
  const registros = await registrosDeRango(desde, hasta);

  let volumenTotalKg = 0;
  let seriesTotales = 0;
  const diasUnicos = new Set<string>();
  const mapEjercicios: Record<string, { series: number; maxPeso: number; maxReps: number; fechaMax: string }> = {};

  registros.forEach((r) => {
    const ejs = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
    const esCompletado = r.completado || (ejs.length > 0 && ejs.every((e) => e.completado));

    if (esCompletado) {
      diasUnicos.add(r.fecha);
    }

    ejs.forEach((e) => {
      // Limpiar nombre borrando metadatos entre paréntesis si existen
      const nombreLimpio = e.nombre.replace(/\s*\(.*\)$/, '').trim();
      const numSeries = e.series || 1;
      const reps = e.repeticiones || 1;
      const peso = e.peso || 0;

      // Sumar volumen y series
      volumenTotalKg += numSeries * reps * peso;
      seriesTotales += numSeries;

      if (!mapEjercicios[nombreLimpio]) {
        mapEjercicios[nombreLimpio] = {
          series: 0,
          maxPeso: 0,
          maxReps: 0,
          fechaMax: r.fecha,
        };
      }

      mapEjercicios[nombreLimpio].series += numSeries;
      if (peso > mapEjercicios[nombreLimpio].maxPeso) {
        mapEjercicios[nombreLimpio].maxPeso = peso;
        mapEjercicios[nombreLimpio].maxReps = reps;
        mapEjercicios[nombreLimpio].fechaMax = r.fecha;
      }
    });
  });

  // Récords Personales (PRs)
  const recordsPersonales: RecordPersonal[] = Object.entries(mapEjercicios)
    .filter(([_, data]) => data.maxPeso > 0)
    .map(([nombre, data]) => ({
      nombreEjercicio: nombre,
      maxPeso: data.maxPeso,
      maxReps: data.maxReps,
      fecha: data.fechaMax,
      totalSeries: data.series,
    }))
    .sort((a, b) => b.maxPeso - a.maxPeso);

  // Estadísticas y Porcentaje por Ejercicio
  const ejerciciosStats = Object.entries(mapEjercicios)
    .map(([nombre, data]) => ({
      nombre,
      series: data.series,
      maxPeso: data.maxPeso,
      porcentaje: seriesTotales > 0 ? Math.round((data.series / seriesTotales) * 100) : 0,
    }))
    .sort((a, b) => b.series - a.series);

  return {
    volumenTotalKg: Math.round(volumenTotalKg),
    diasCompletados: diasUnicos.size,
    seriesTotales,
    rachaDias: diasUnicos.size,
    recordsPersonales,
    ejerciciosStats,
  };
}
