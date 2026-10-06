/**
 * Utilidades para parsear y formatear ejercicios y series de Rutinia
 * Soporta ejercicios Estándar (bilaterales) y Unilaterales (Brazo/Pierna Derecho D vs Izquierdo I).
 */

export interface SetDetalleParsed {
  setNum: number;
  resumen: string;
  completado: boolean;
  pesoD?: string;
  repsD?: string;
  pesoI?: string;
  repsI?: string;
  rir?: string;
  nota?: string;
}

export interface InfoEjercicioParsed {
  nombreLimpio: string;
  esUnilateral: boolean;
  resumenVisual: string | null;
  totalSeries: number;
  seriesCompletadas: number;
  tieneDatosReales: boolean;
  detallesSets: SetDetalleParsed[];
}

/**
 * Parsea un objeto de ejercicio de registro o rutina para extraer el nombre limpio,
 * su modalidad (Estándar o Unilateral D/I) y badges de información estructurada.
 */
export function parsearEjercicioInfo(e: {
  nombre: string;
  series?: number | null;
  repeticiones?: number | null;
  peso?: number | null;
  completado?: boolean;
}): InfoEjercicioParsed {
  const nombreRaw = (e.nombre || '').trim();

  // 1. Detectar si es unilateral por etiqueta [U] o "D ... | I ..." en el resumen
  const tieneTagUnilateral = /^\[U(NILATERAL)?\]/i.test(nombreRaw) || nombreRaw.includes('[U]');

  // Extraer el nombre base removiendo prefijo [U] y cualquier bloque (...) al final
  const nombreSinTag = nombreRaw.replace(/^\[U(NILATERAL)?\]\s*/i, '').trim();
  const nombreLimpio = nombreSinTag.replace(/\s*\((.*?)\)$/, '').trim() || 'Ejercicio';

  // 2. Extraer el contenido entre paréntesis si existe
  const matchResumen = nombreRaw.match(/\((.*?)\)$/);

  let detallesSets: SetDetalleParsed[] = [];
  let totalSeries = Number(e.series) || 0;
  let seriesCompletadas = 0;
  let tieneDatosReales = false;
  let detectadoUnilateralEnSets = false;
  const partesDatos: string[] = [];

  if (matchResumen && matchResumen[1]) {
    const rawSets = matchResumen[1].split('•').map((s) => s.trim());
    totalSeries = Math.max(totalSeries, rawSets.length);

    rawSets.forEach((setStr, idx) => {
      const isComplete = setStr.includes('✓') || Boolean(e.completado);
      if (setStr.includes('✓')) seriesCompletadas++;

      const datosStr = setStr
        .replace(/^\d+ª:\s*/, '')
        .replace(/✓/g, '')
        .trim();

      let pesoD: string | undefined;
      let repsD: string | undefined;
      let pesoI: string | undefined;
      let repsI: string | undefined;
      let rir: string | undefined;
      let nota: string | undefined;

      if (datosStr.includes('|') || datosStr.includes('D ') || datosStr.includes('I ')) {
        detectadoUnilateralEnSets = true;
        const matchD = datosStr.match(/D\s*(?:(\d+(?:\.\d+)?)k)?\s*(?:(\d+)r)?/i);
        if (matchD) {
          if (matchD[1]) pesoD = matchD[1];
          if (matchD[2]) repsD = matchD[2];
        }

        const matchI = datosStr.match(/I\s*(?:(\d+(?:\.\d+)?)k)?\s*(?:(\d+)r)?/i);
        if (matchI) {
          if (matchI[1]) pesoI = matchI[1];
          if (matchI[2]) repsI = matchI[2];
        }
      }

      const matchRIR = datosStr.match(/RIR\s*(\d+)/i);
      if (matchRIR) rir = matchRIR[1];

      const matchNota = datosStr.match(/\[(.*?)\]/);
      if (matchNota) nota = matchNota[1];

      if (datosStr.length > 0) {
        tieneDatosReales = true;
        partesDatos.push(datosStr);
      }

      detallesSets.push({
        setNum: idx + 1,
        resumen: datosStr,
        completado: isComplete,
        pesoD,
        repsD,
        pesoI,
        repsI,
        rir,
        nota,
      });
    });

    if (e.completado && seriesCompletadas === 0 && totalSeries > 0) {
      seriesCompletadas = totalSeries;
    }
  } else {
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

  const esUnilateral = tieneTagUnilateral || detectadoUnilateralEnSets;

  // 3. Formatear resumen visual estilizado para chips/badges
  let resumenVisual: string | null = null;

  if (tieneDatosReales && partesDatos.length > 0) {
    if (partesDatos.length <= 2) {
      resumenVisual = partesDatos.join(' · ');
    } else {
      resumenVisual = `${partesDatos[0]} · ${partesDatos.length} series`;
    }
  } else if (totalSeries > 0) {
    resumenVisual = esUnilateral ? `${totalSeries} series (D/I)` : `${totalSeries} series`;
  }

  return {
    nombreLimpio,
    esUnilateral,
    resumenVisual,
    totalSeries,
    seriesCompletadas,
    tieneDatosReales,
    detallesSets,
  };
}
