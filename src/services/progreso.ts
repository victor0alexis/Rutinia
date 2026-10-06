import { registrosDeRango } from './registros';
import { listarRutinas } from './rutinas';
import { parsearEjercicioInfo } from '../utils/ejercicios';

export type RecordPersonal = {
  nombreEjercicio: string;
  maxPeso: number;
  maxReps: number;
  fecha: string;
  totalSeries: number;
  esUnilateral?: boolean;
};

export type EstadisticaRutina = {
  id: string;
  nombre: string;
  vecesEjecutada: number;
  volumenTotalKg: number;
  seriesTotales: number;
  ultimaEjecucion: string | null;
  ejerciciosStats: { nombre: string; maxPeso: number; series: number }[];
};

export type HabitoTrackerStat = {
  id: string;
  titulo: string;
  categoria: string;
  totalDias: number;
  rachaActual: number;
  colorBadge: string;
  bgBadge: string;
  icono: string;
  fechas: string[];
};

export type MetricasProgreso = {
  volumenTotalKg: number;
  diasCompletados: number;
  seriesTotales: number;
  rachaDias: number;
  recordsPersonales: RecordPersonal[];
  ejerciciosStats: { nombre: string; series: number; maxPeso: number; porcentaje: number }[];
  rutinasStats: EstadisticaRutina[];
  habitosStats: HabitoTrackerStat[];
};

export async function obtenerMetricasProgreso(desde: string, hasta: string): Promise<MetricasProgreso> {
  const [registros, rutinasExistentes] = await Promise.all([
    registrosDeRango(desde, hasta),
    listarRutinas().catch(() => []),
  ]);

  let volumenTotalKg = 0;
  let seriesTotales = 0;
  const diasUnicos = new Set<string>();
  const mapEjercicios: Record<string, { series: number; maxPeso: number; maxReps: number; fechaMax: string; esUnilateral: boolean }> = {};
  const mapRutinas: Record<string, { id: string; nombre: string; veces: number; volumen: number; series: number; ultimaFecha: string | null; ejercicios: Record<string, { maxPeso: number; series: number }> }> = {};
  const mapHabitos: Record<string, { titulo: string; categoria: string; fechas: Set<string> }> = {};

  // Inicializar rutinas creadas en el mapa de rutinas
  rutinasExistentes.forEach((r) => {
    mapRutinas[r.nombre] = {
      id: r.id,
      nombre: r.nombre,
      veces: 0,
      volumen: 0,
      series: 0,
      ultimaFecha: null,
      ejercicios: {},
    };
  });

  registros.forEach((r) => {
    const ejs = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
    const notas = (r.ejercicios_registro || []).filter((e) => e.nombre.startsWith('📌'));
    const esCompletado = r.completado || (ejs.length > 0 && ejs.every((e) => e.completado));

    if (esCompletado) {
      diasUnicos.add(r.fecha);
    }

    // 1. Procesar rutina asociada a este registro
    const nombreRutina = r.rutinas?.nombre;
    if (nombreRutina) {
      if (!mapRutinas[nombreRutina]) {
        mapRutinas[nombreRutina] = {
          id: r.rutina_id || nombreRutina,
          nombre: nombreRutina,
          veces: 0,
          volumen: 0,
          series: 0,
          ultimaFecha: null,
          ejercicios: {},
        };
      }
      if (esCompletado) {
        mapRutinas[nombreRutina].veces++;
      }
      if (!mapRutinas[nombreRutina].ultimaFecha || r.fecha > mapRutinas[nombreRutina].ultimaFecha!) {
        mapRutinas[nombreRutina].ultimaFecha = r.fecha;
      }
    }

    // 2. Procesar ejercicios
    ejs.forEach((e) => {
      const parsed = parsearEjercicioInfo(e);
      const nombreLimpio = parsed.nombreLimpio;
      const numSeries = e.series || parsed.detallesSets.length || 1;
      const reps = e.repeticiones || 1;
      const peso = e.peso || 0;

      const volEj = numSeries * reps * peso;
      volumenTotalKg += volEj;
      seriesTotales += numSeries;

      if (nombreRutina && mapRutinas[nombreRutina]) {
        mapRutinas[nombreRutina].volumen += volEj;
        mapRutinas[nombreRutina].series += numSeries;

        if (!mapRutinas[nombreRutina].ejercicios[nombreLimpio]) {
          mapRutinas[nombreRutina].ejercicios[nombreLimpio] = { maxPeso: 0, series: 0 };
        }
        mapRutinas[nombreRutina].ejercicios[nombreLimpio].series += numSeries;
        if (peso > mapRutinas[nombreRutina].ejercicios[nombreLimpio].maxPeso) {
          mapRutinas[nombreRutina].ejercicios[nombreLimpio].maxPeso = peso;
        }
      }

      if (!mapEjercicios[nombreLimpio]) {
        mapEjercicios[nombreLimpio] = {
          series: 0,
          maxPeso: 0,
          maxReps: 0,
          fechaMax: r.fecha,
          esUnilateral: parsed.esUnilateral,
        };
      }

      mapEjercicios[nombreLimpio].series += numSeries;
      if (peso > mapEjercicios[nombreLimpio].maxPeso) {
        mapEjercicios[nombreLimpio].maxPeso = peso;
        mapEjercicios[nombreLimpio].maxReps = reps;
        mapEjercicios[nombreLimpio].fechaMax = r.fecha;
      }
    });

    // 3. Procesar notas / hábitos (Creatina, Proteína, Nutrición, etc.)
    const todasLasNotas = [
      ...(r.notas ? [r.notas] : []),
      ...notas.map((n) => n.nombre),
    ];

    todasLasNotas.forEach((textoNota) => {
      const matchCat = textoNota.match(/\[(.*?)\]/);
      let cat = matchCat ? matchCat[1].toUpperCase() : 'GENERAL';
      let tit = textoNota.replace(/📌\s*/, '').replace(/\[.*?\]\s*/, '').trim();

      const lower = textoNota.toLowerCase();
      if (lower.includes('creatina')) {
        tit = 'Toma de Creatina';
        cat = 'NUTRICIÓN / SUPLEMENTOS';
      } else if (lower.includes('proteina') || lower.includes('proteína')) {
        tit = 'Consumo de Proteína';
        cat = 'NUTRICIÓN';
      } else if (lower.includes('agua') || lower.includes('litro')) {
        tit = 'Hidratación Diaria';
        cat = 'SALUD';
      } else if (lower.includes('sueño') || lower.includes('dormir')) {
        tit = 'Descanso Nocturno';
        cat = 'RECUPERACIÓN';
      }

      if (!tit) return;

      const key = `${cat}:${tit}`;
      if (!mapHabitos[key]) {
        mapHabitos[key] = {
          titulo: tit,
          categoria: cat,
          fechas: new Set(),
        };
      }
      mapHabitos[key].fechas.add(r.fecha);
    });
  });

  // Si no hay hábitos registrados en notas en este período, creamos tarjetas plantilla guías
  if (Object.keys(mapHabitos).length === 0) {
    mapHabitos['NUTRICIÓN:Toma de Creatina'] = {
      titulo: 'Toma de Creatina',
      categoria: 'NUTRICIÓN / SUPLEMENTOS',
      fechas: new Set(),
    };
    mapHabitos['NUTRICIÓN:Consumo de Proteína'] = {
      titulo: 'Consumo de Proteína',
      categoria: 'NUTRICIÓN',
      fechas: new Set(),
    };
  }

  // Formatear Rutinas Stats
  const rutinasStats: EstadisticaRutina[] = Object.values(mapRutinas)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      vecesEjecutada: r.veces,
      volumenTotalKg: Math.round(r.volumen),
      seriesTotales: r.series,
      ultimaEjecucion: r.ultimaFecha,
      ejerciciosStats: Object.entries(r.ejercicios).map(([nombre, data]) => ({
        nombre,
        maxPeso: data.maxPeso,
        series: data.series,
      })),
    }))
    .sort((a, b) => b.vecesEjecutada - a.vecesEjecutada || b.volumenTotalKg - a.volumenTotalKg);

  // Formatear Hábitos Tracker Stats
  const habitosStats: HabitoTrackerStat[] = Object.values(mapHabitos).map((h) => {
    const fechasArr = Array.from(h.fechas).sort();
    let rachaActual = 0;
    const hoyCheck = new Date(hasta);
    while (rachaActual < fechasArr.length) {
      const iso = hoyCheck.toISOString().slice(0, 10);
      if (h.fechas.has(iso)) {
        rachaActual++;
        hoyCheck.setDate(hoyCheck.getDate() - 1);
      } else {
        break;
      }
    }

    let colorBadge = '#F59E0B'; // Amber
    let bgBadge = 'rgba(245, 158, 11, 0.16)';
    let icono = 'flash-outline';

    const titLower = h.titulo.toLowerCase();
    if (titLower.includes('creatina')) {
      colorBadge = '#D97706';
      bgBadge = 'rgba(217, 119, 6, 0.20)';
      icono = 'sparkles';
    } else if (titLower.includes('prote')) {
      colorBadge = '#10B981';
      bgBadge = 'rgba(16, 185, 129, 0.18)';
      icono = 'fitness-outline';
    } else if (titLower.includes('agua') || titLower.includes('hidrat')) {
      colorBadge = '#06B6D4';
      bgBadge = 'rgba(6, 182, 212, 0.18)';
      icono = 'water-outline';
    } else if (titLower.includes('sueño') || titLower.includes('descanso')) {
      colorBadge = '#8B5CF6';
      bgBadge = 'rgba(139, 92, 246, 0.18)';
      icono = 'moon-outline';
    }

    return {
      id: `${h.categoria}-${h.titulo}`,
      titulo: h.titulo,
      categoria: h.categoria,
      totalDias: h.fechas.size,
      rachaActual,
      colorBadge,
      bgBadge,
      icono,
      fechas: fechasArr,
    };
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
      esUnilateral: data.esUnilateral,
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

  // Cálculo de racha de días completados
  const diasOrdenados = Array.from(diasUnicos).sort();
  let rachaDias = 0;
  let fechaCheck = new Date(hasta);
  while (rachaDias < diasOrdenados.length) {
    const iso = fechaCheck.toISOString().slice(0, 10);
    if (diasUnicos.has(iso)) {
      rachaDias++;
      fechaCheck.setDate(fechaCheck.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    volumenTotalKg: Math.round(volumenTotalKg),
    diasCompletados: diasUnicos.size,
    seriesTotales,
    rachaDias,
    recordsPersonales,
    ejerciciosStats,
    rutinasStats,
    habitosStats,
  };
}
