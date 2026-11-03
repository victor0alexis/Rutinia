import { registrosDeRango } from './registros';
import { listarRutinas } from './rutinas';
import { parsearEjercicioInfo } from '../utilidades/ejercicios';
import { esNotaDeEjercicio, parsearNotasSesion } from '../utilidades/notasSesion';
import { formatearDetalleCarga } from '../utilidades/cargasEjercicio';
import type { CargaSerie } from '../tipos';

export type RecordPersonal = {
  nombreEjercicio: string;
  maxPeso: number;
  maxReps: number;
  fecha: string;
  totalSeries: number;
  esUnilateral?: boolean;
  composicionCarga?: string;
};

export type EstadisticaRutina = {
  id: string;
  nombre: string;
  planId?: string | null;
  planNombre?: string | null;
  planColor?: string | null;
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
  seriesSoloPlacas: number;
  seriesNoHechas: number;
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
  let seriesSoloPlacas = 0;
  let seriesNoHechas = 0;
  let seriesTotales = 0;
  const diasUnicos = new Set<string>();
  const mapEjercicios: Record<string, { series: number; maxPeso: number; maxReps: number; fechaMax: string; esUnilateral: boolean; composicionCarga: string }> = {};
  const mapRutinas: Record<
    string,
    {
      id: string;
      nombre: string;
      planId?: string | null;
      planNombre?: string | null;
      planColor?: string | null;
      veces: number;
      volumen: number;
      series: number;
      ultimaFecha: string | null;
      ejercicios: Record<string, { maxPeso: number; series: number }>;
    }
  > = {};
  const mapHabitos: Record<string, { titulo: string; categoria: string; fechas: Set<string> }> = {};

  // Inicializar rutinas creadas en el mapa de rutinas
  rutinasExistentes.forEach((r) => {
    mapRutinas[r.nombre] = {
      id: r.id,
      nombre: r.nombre,
      planId: r.plan_id || null,
      planNombre: (r as any).planes_entrenamiento?.nombre || null,
      planColor: (r as any).planes_entrenamiento?.color || null,
      veces: 0,
      volumen: 0,
      series: 0,
      ultimaFecha: null,
      ejercicios: {},
    };
  });

  registros.forEach((r) => {
    const ejs = (r.ejercicios_registro || []).filter((e) => !e.nombre.startsWith('📌'));
    // Las notas por ejercicio pertenecen al entrenamiento, no son hábitos
    // diarios de nutrición/suplementación.
    const notas = (r.ejercicios_registro || []).filter(
      (e) => e.nombre.startsWith('📌') && !esNotaDeEjercicio(e.nombre)
    );
    const esCompletado = r.completado || (ejs.length > 0 && ejs.every((e) => e.completado));

    if (esCompletado) {
      diasUnicos.add(r.fecha);
    }

    // 1. Procesar rutina asociada a este registro
    const nombreRutina = r.rutina_nombre || r.rutinas?.nombre;
    const planNombreReg = r.plan_nombre || r.planes_entrenamiento?.nombre || null;
    const planColorReg = r.planes_entrenamiento?.color || null;
    const planIdReg = r.plan_id || r.rutinas?.plan_id || null;

    if (nombreRutina) {
      if (!mapRutinas[nombreRutina]) {
        mapRutinas[nombreRutina] = {
          id: r.rutina_id || nombreRutina,
          nombre: nombreRutina,
          planId: planIdReg,
          planNombre: planNombreReg,
          planColor: planColorReg,
          veces: 0,
          volumen: 0,
          series: 0,
          ultimaFecha: null,
          ejercicios: {},
        };
      } else {
        if (!mapRutinas[nombreRutina].planNombre && planNombreReg) {
          mapRutinas[nombreRutina].planNombre = planNombreReg;
        }
        if (!mapRutinas[nombreRutina].planColor && planColorReg) {
          mapRutinas[nombreRutina].planColor = planColorReg;
        }
        if (!mapRutinas[nombreRutina].planId && planIdReg) {
          mapRutinas[nombreRutina].planId = planIdReg;
        }
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
      let volEj = 0;
      let maxPesoEnEj = 0;
      let maxRepsEnEj = 0;
      let cargasSeries: { carga?: CargaSerie | null }[] = [];
      try { cargasSeries = JSON.parse((e as any).detalles_json || '[]'); } catch { cargasSeries = []; }
      const noHechasEj = parsed.detallesSets.filter((set, setIdx) =>
        ((cargasSeries[setIdx] as any)?.estado || set.estado) === 'no_hecha'
      ).length;
      seriesNoHechas += noHechasEj;
      const numSeries = Math.max(0, (e.series || parsed.detallesSets.length || 1) - noHechasEj);
      parsed.detallesSets.forEach((set, setIdx) => {
        const estado = (cargasSeries[setIdx] as any)?.estado || set.estado || 'normal';
        if (estado === 'no_hecha') return;
        const carga = cargasSeries[setIdx]?.carga;
        if (carga?.tipo === 'placas' && !set.pesoD) seriesSoloPlacas++;
      });

      if (parsed.detallesSets.length > 0) {
        parsed.detallesSets.forEach((set, setIdx) => {
          const estado = (cargasSeries[setIdx] as any)?.estado || set.estado || 'normal';
          if (estado === 'no_hecha') return; // Excluir series no hechas de volumen y PRs
          const esPlacasSinEquivalencia = cargasSeries[setIdx]?.carga?.tipo === 'placas' && !set.pesoD;
          const pD = esPlacasSinEquivalencia ? 0 : Number(set.pesoD) || (e.peso || 0);
          const rD = Number(set.repsD) || (e.repeticiones || 1);
          const pI = parsed.esUnilateral ? (Number(set.pesoI) || pD) : 0;
          const rI = parsed.esUnilateral ? (Number(set.repsI) || rD) : 0;

          // Volumen de la serie principal
          volEj += (pD * rD) + (pI * rI);

          if (pD > maxPesoEnEj) maxPesoEnEj = pD;
          if (rD > maxRepsEnEj) maxRepsEnEj = rD;

          // Volumen de Dropsets
          if (set.drops && set.drops.length > 0) {
            set.drops.forEach((d) => {
              const dKg = Number(d.kg) || 0;
              const dReps = Number(d.reps) || 0;
              volEj += (dKg * dReps);
            });
          }
        });
      } else {
        const reps = e.repeticiones || 1;
        const peso = e.peso || 0;
        volEj = numSeries * reps * peso;
        maxPesoEnEj = peso;
        maxRepsEnEj = reps;
      }

      volumenTotalKg += volEj;
      seriesTotales += numSeries;

      if (nombreRutina && mapRutinas[nombreRutina]) {
        mapRutinas[nombreRutina].volumen += volEj;
        mapRutinas[nombreRutina].series += numSeries;

        if (!mapRutinas[nombreRutina].ejercicios[nombreLimpio]) {
          mapRutinas[nombreRutina].ejercicios[nombreLimpio] = { maxPeso: 0, series: 0 };
        }
        mapRutinas[nombreRutina].ejercicios[nombreLimpio].series += numSeries;
        if (maxPesoEnEj > mapRutinas[nombreRutina].ejercicios[nombreLimpio].maxPeso) {
          mapRutinas[nombreRutina].ejercicios[nombreLimpio].maxPeso = maxPesoEnEj;
        }
      }

      if (!mapEjercicios[nombreLimpio]) {
        mapEjercicios[nombreLimpio] = {
          series: 0,
          maxPeso: 0,
          maxReps: 0,
          fechaMax: r.fecha,
          esUnilateral: parsed.esUnilateral,
          composicionCarga: '',
        };
      }

      mapEjercicios[nombreLimpio].series += numSeries;
      if (maxPesoEnEj > mapEjercicios[nombreLimpio].maxPeso) {
        mapEjercicios[nombreLimpio].maxPeso = maxPesoEnEj;
        mapEjercicios[nombreLimpio].maxReps = maxRepsEnEj;
        mapEjercicios[nombreLimpio].fechaMax = r.fecha;
        const indiceSerieRecord = parsed.detallesSets.findIndex((set) => Number(set.pesoD) === maxPesoEnEj);
        const detalleCarga = indiceSerieRecord >= 0 ? formatearDetalleCarga(cargasSeries[indiceSerieRecord]?.carga) : '';
        mapEjercicios[nombreLimpio].composicionCarga = detalleCarga;
      }
    });

    // 3. Procesar notas / hábitos (Creatina, Proteína, Nutrición, etc.)
    const notaSesion = parsearNotasSesion(r.notas).nota;
    const todasLasNotas = [
      ...(notaSesion ? [notaSesion] : []),
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
      planId: r.planId,
      planNombre: r.planNombre,
      planColor: r.planColor,
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
      composicionCarga: data.composicionCarga,
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
    seriesSoloPlacas,
    seriesNoHechas,
    diasCompletados: diasUnicos.size,
    seriesTotales,
    rachaDias,
    recordsPersonales,
    ejerciciosStats,
    rutinasStats,
    habitosStats,
  };
}
