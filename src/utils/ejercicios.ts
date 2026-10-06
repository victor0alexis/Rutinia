/**
 * Utilidades para parsear y formatear ejercicios y series de Rutinia
 * Evita la visualización de texto sin formato como "(1ª: • 2ª: )" o tachados antiestéticos.
 */

export interface InfoEjercicioParsed {
  nombreLimpio: string;
  resumenVisual: string | null;
  totalSeries: number;
  seriesCompletadas: number;
  tieneDatosReales: boolean;
  detallesSets: { setNum: number; resumen: string; completado: boolean }[];
}

/**
 * Parsea un objeto de ejercicio de registro o rutina para extraer el nombre limpio
 * y badges de información estructurada.
 */
export function parsearEjercicioInfo(e: {
  nombre: string;
  series?: number | null;
  repeticiones?: number | null;
  peso?: number | null;
  completado?: boolean;
}): InfoEjercicioParsed {
  const nombreRaw = (e.nombre || '').trim();

  // 1. Extraer el nombre base removiendo cualquier bloque (...) al final
  const nombreLimpio = nombreRaw.replace(/\s*\((.*?)\)$/, '').trim() || 'Ejercicio';

  // 2. Intentar extraer el contenido entre paréntesis si existe
  const matchResumen = nombreRaw.match(/\((.*?)\)$/);

  let detallesSets: { setNum: number; resumen: string; completado: boolean }[] = [];
  let totalSeries = Number(e.series) || 0;
  let seriesCompletadas = 0;
  let tieneDatosReales = false;
  const partesDatos: string[] = [];

  if (matchResumen && matchResumen[1]) {
    const rawSets = matchResumen[1].split('•').map((s) => s.trim());
    totalSeries = Math.max(totalSeries, rawSets.length);

    rawSets.forEach((setStr, idx) => {
      const isComplete = setStr.includes('✓') || Boolean(e.completado);
      if (setStr.includes('✓')) seriesCompletadas++;

      // Limpiar prefijo "1ª:", "✓", y espacios
      const datosStr = setStr
        .replace(/^\d+ª:\s*/, '')
        .replace(/✓/g, '')
        .trim();

      if (datosStr.length > 0) {
        tieneDatosReales = true;
        partesDatos.push(datosStr);
      }

      detallesSets.push({
        setNum: idx + 1,
        resumen: datosStr,
        completado: isComplete,
      });
    });

    if (e.completado && seriesCompletadas === 0 && totalSeries > 0) {
      seriesCompletadas = totalSeries;
    }
  } else {
    // Si no hay paréntesis en el nombre, usar las props directas
    if (e.peso || e.repeticiones) {
      tieneDatosReales = true;
      const p = e.peso ? `${e.peso} kg` : '';
      const r = e.repeticiones ? `${e.repeticiones} reps` : '';
      partesDatos.push([p, r].filter(Boolean).join(' × '));
    }
    if (e.completado) {
      seriesCompletadas = totalSeries || 1;
    }
  }

  // 3. Formatear resumen visual estilizado para chips/badges
  let resumenVisual: string | null = null;

  if (tieneDatosReales && partesDatos.length > 0) {
    if (partesDatos.length <= 2) {
      resumenVisual = partesDatos.join(' · ');
    } else {
      resumenVisual = `${partesDatos[0]} · ${partesDatos.length} series`;
    }
  } else if (totalSeries > 0) {
    resumenVisual = `${totalSeries} series`;
  }

  return {
    nombreLimpio,
    resumenVisual,
    totalSeries,
    seriesCompletadas,
    tieneDatosReales,
    detallesSets,
  };
}
