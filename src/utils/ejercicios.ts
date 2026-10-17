/**
 * Utilidades para parsear y formatear ejercicios y series de Rutinia
 * Soporta ejercicios Estándar (bilaterales) y Unilaterales (Brazo/Pierna Derecho D vs Izquierdo I),
 * así como Reps Parciales (+3p), Dropsets (→ kg r ↓) y Sustituciones (↔ Sustituye a...).
 */

export interface DropDetalleParsed {
  orden: number;
  kg: string;
  reps: string;
  rir?: string;
}

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
  repsParciales?: number;
  tieneParciales?: boolean;
  esDropset?: boolean;
  drops?: DropDetalleParsed[];
}

export interface InfoEjercicioParsed {
  nombreLimpio: string;
  esUnilateral: boolean;
  resumenVisual: string | null;
  totalSeries: number;
  seriesCompletadas: number;
  tieneDatosReales: boolean;
  detallesSets: SetDetalleParsed[];
  tieneParciales: boolean;
  tieneDropset: boolean;
  sustituyeANombre: string | null;
}

/**
 * Parsea un objeto de ejercicio de registro o rutina para extraer el nombre limpio,
 * su modalidad (Estándar o Unilateral D/I), parciales, dropsets y sustitución.
 */
export function parsearEjercicioInfo(e: {
  nombre: string;
  series?: number | null;
  repeticiones?: number | null;
  peso?: number | null;
  completado?: boolean;
  sustituye_a_nombre?: string | null;
}): InfoEjercicioParsed {
  const nombreRaw = (e.nombre || '').trim();

  // 1. Detectar si sustituye a otro ejercicio (sea por columna o en el texto)
  let sustituyeANombre = e.sustituye_a_nombre || null;
  const matchSust = nombreRaw.match(/↔\s*Sustituye\s+a\s+([^(\[]+)/i);
  if (matchSust && matchSust[1]) {
    sustituyeANombre = matchSust[1].trim();
  }

  // 2. Detectar si es unilateral por etiqueta [U] o "D ... | I ..." en el resumen
  const tieneTagUnilateral = /^\[U(NILATERAL)?\]/i.test(nombreRaw) || nombreRaw.includes('[U]');

  // Extraer el nombre base removiendo prefijo [U], cualquier bloque "↔ Sustituye a..." y bloque (...) al final
  let nombreSinTag = nombreRaw.replace(/^\[U(NILATERAL)?\]\s*/i, '').trim();
  nombreSinTag = nombreSinTag.replace(/↔\s*Sustituye\s+a\s+[^(\[]+/i, '').trim();
  const nombreLimpio = nombreSinTag.replace(/\s*\((.*?)\)$/, '').trim() || 'Ejercicio';

  // 3. Extraer el contenido entre paréntesis si existe
  const matchResumen = nombreRaw.match(/\((.*?)\)$/);

  let detallesSets: SetDetalleParsed[] = [];
  let totalSeries = Number(e.series) || 0;
  let seriesCompletadas = 0;
  let tieneDatosReales = false;
  let detectadoUnilateralEnSets = false;
  let tieneParcialesGlobal = false;
  let tieneDropsetGlobal = false;
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
      let repsParciales: number | undefined;
      let esDropset = false;
      const drops: DropDetalleParsed[] = [];

      // Detectar Parciales "+Np"
      const matchParcial = datosStr.match(/\+(\d+)p/);
      if (matchParcial) {
        repsParciales = parseInt(matchParcial[1], 10);
        tieneParcialesGlobal = true;
      }

      // Detectar Dropset si contiene flechas "→" o "↓"
      if (datosStr.includes('→') || datosStr.includes('↓')) {
        esDropset = true;
        tieneDropsetGlobal = true;

        // Separar drops si vienen con "→"
        const dropParts = datosStr.split('→').map((p) => p.trim());
        if (dropParts.length > 1) {
          dropParts.slice(1).forEach((dp, dIdx) => {
            const dpLimpio = dp.replace(/↓/g, '').trim();
            const mKg = dpLimpio.match(/(\d+(?:\.\d+)?)k/);
            const mReps = dpLimpio.match(/(\d+)r/);
            const mRir = dpLimpio.match(/RIR\s*(\d+)/i);
            if (mKg || mReps) {
              drops.push({
                orden: dIdx + 1,
                kg: mKg ? mKg[1] : '',
                reps: mReps ? mReps[1] : '',
                rir: mRir ? mRir[1] : undefined,
              });
            }
          });
        }
      }

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
      } else {
        // Bilateral normal
        const matchK = datosStr.match(/^(\d+(?:\.\d+)?)k/);
        if (matchK) pesoD = matchK[1];
        const matchR = datosStr.match(/(\d+)r/);
        if (matchR) repsD = matchR[1];
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
        repsParciales,
        tieneParciales: Boolean(repsParciales && repsParciales > 0),
        esDropset,
        drops: drops.length > 0 ? drops : undefined,
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

  // 4. Formatear resumen visual estilizado para chips/badges
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
    tieneParciales: tieneParcialesGlobal,
    tieneDropset: tieneDropsetGlobal,
    sustituyeANombre,
  };
}
