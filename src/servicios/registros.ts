import { supabase } from '../biblioteca/supabase';
import { Registro, Rutina } from '../tipos';
import {
  guardarCacheLocal,
  leerLocal,
  listarSufijosLocales,
  obtenerCacheLocal,
} from '../utilidades/almacenamientoLocal';
import { filtrarPorPropietario, obtenerUsuarioIdActual } from '../utilidades/usuario';
import { parsearEjercicioInfo } from '../utilidades/ejercicios';
import {
  PREFIJO_NOTA_EJERCICIO,
  PREFIJO_OBSERVACIONES,
  formatearNotaEjercicio,
  parsearNotaEjercicio,
  parsearNotasSesion,
  serializarNotasSesion,
} from '../utilidades/notasSesion';

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
const getUsuarioId = obtenerUsuarioIdActual;

export async function registrosDeRango(desde: string, hasta: string): Promise<Registro[]> {
  try {
    const usuarioId = await getUsuarioId();
    const { data, error } = await filtrarPorPropietario(
      supabase
        .from('registros_entrenamiento')
        .select('*, rutinas(nombre, plan_id, dia_sugerido), planes_entrenamiento(*), ejercicios_registro(*)'),
      usuarioId
    )
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true });

    if (error) throw error;
    const res = (data ?? []) as Registro[];

    await guardarCacheLocal(`registros_${desde}_${hasta}`, res);
    return res;
  } catch {
    console.warn('Sin conexión, cargando registros locales...');
    const cache = await obtenerCacheLocal<Registro[]>(`registros_${desde}_${hasta}`);
    if (cache && cache.length > 0) return cache;

    // Fallback inteligente: buscar en cualquier rango cacheado de esta cuenta
    try {
      const sufijos = await listarSufijosLocales();
      const regKeys = sufijos.filter((k) => k.startsWith('registros_'));
      for (const k of regKeys) {
        const raw = await leerLocal(k);
        if (raw) {
          const arr = JSON.parse(raw) as Registro[];
          const filtrados = arr.filter((r) => r.fecha >= desde && r.fecha <= hasta);
          if (filtrados.length > 0) return filtrados;
        }
      }
    } catch {
      // Ignorar fallback
    }

    return cache || [];
  }
}

// Copia los ejercicios de la rutina a cada fecha elegida, congelando nombres de plan y rutina
export async function agregarRutinaAFechas(
  rutina: Rutina,
  fechas: string[],
  opciones?: {
    planId?: string | null;
    planNombre?: string | null;
    rutinaNombre?: string | null;
  }
) {
  const usuarioId = await getUsuarioId();
  const ejercicios = rutina.ejercicios_rutina || [];

  const targetPlanId = opciones?.planId !== undefined ? opciones.planId : rutina.plan_id ?? null;
  const targetPlanNombre = opciones?.planNombre !== undefined
    ? opciones.planNombre
    : rutina.planes_entrenamiento?.nombre ?? null;
  const targetRutinaNombre = opciones?.rutinaNombre || rutina.nombre;

  for (const fecha of fechas) {
    try {
      const regData: any = {
        fecha,
        plan_id: targetPlanId,
        plan_nombre: targetPlanNombre,
        rutina_nombre: targetRutinaNombre,
      };
      if (rutina.id && !rutina.id.startsWith('local_')) {
        regData.rutina_id = rutina.id;
      }
      if (usuarioId) regData.usuario_id = usuarioId;

      const { data: reg, error } = await supabase
        .from('registros_entrenamiento')
        .insert(regData)
        .select()
        .single();

      if (error) throw error;

      if (ejercicios.length > 0 && reg) {
        const filas = ejercicios.map((e) => {
          const fila: any = {
            registro_id: reg.id,
            nombre: e.nombre,
            series: e.series,
            repeticiones: e.repeticiones,
            peso: e.peso,
            completado: false,
          };
          if (usuarioId) fila.usuario_id = usuarioId;
          return fila;
        });
        const { error: errEjs } = await supabase.from('ejercicios_registro').insert(filas);
        if (errEjs) throw errEjs;
      }
    } catch (err: any) {
      console.warn('Error vinculando rutina a fecha en Supabase:', err);
      throw new Error(`No se pudo vincular la rutina a la fecha ${fecha}: ${err?.message ?? err}`);
    }
  }
}


// Desvincula/elimina un registro completo de rutina o actividad del día
export async function eliminarRegistroRutina(registroId: string) {
  // Paso 1: limpiar ejercicios_registro hijos (por si la FK no tiene CASCADE)
  try {
    await supabase.from('ejercicios_registro').delete().eq('registro_id', registroId);
  } catch {
    // Si la FK CASCADE ya lo limpió o no existe, continuar
  }

  // Paso 2: eliminar el registro de entrenamiento
  const { error } = await supabase
    .from('registros_entrenamiento')
    .delete()
    .eq('id', registroId);
  if (error) throw new Error(`No se pudo desvincular la rutina del día: ${error.message}`);
}

// Actividad suelta
export async function agregarActividad(
  fecha: string,
  nombre: string,
  series: number | null,
  repeticiones: number | null,
  peso: number | null = null
) {
  const usuarioId = await getUsuarioId();

  const { data: existente } = await filtrarPorPropietario(
    supabase
      .from('registros_entrenamiento')
      .select('id')
      .eq('fecha', fecha)
      .is('rutina_id', null),
    usuarioId
  )
    .limit(1)
    .maybeSingle();

  let registroId = existente?.id as string | undefined;
  if (!registroId) {
    const regData: any = { fecha };
    if (usuarioId) regData.usuario_id = usuarioId;

    const { data, error } = await supabase
      .from('registros_entrenamiento')
      .insert(regData)
      .select()
      .single();
    if (error) throw error;
    registroId = data.id;
  }

  const ejData: any = { registro_id: registroId, nombre, series, repeticiones, peso };
  if (usuarioId) ejData.usuario_id = usuarioId;

  const { error } = await supabase.from('ejercicios_registro').insert(ejData);
  if (error) throw error;
}

// Guardar nota del día
export async function guardarNotaDelDia(fecha: string, textoNota: string) {
  await agregarActividad(fecha, `📌 ${textoNota}`, null, null, null);
}

export async function alternarEjercicio(id: string, completado: boolean) {
  const { error } = await supabase.from('ejercicios_registro').update({ completado }).eq('id', id);
  if (error) throw error;
}

export async function actualizarEjecucionEjercicio(
  id: string,
  datos: {
    nombre?: string;
    series?: number | null;
    repeticiones?: number | null;
    peso?: number | null;
    completado?: boolean;
    ejercicio_nombre?: string | null;
    sustituye_a_ejercicio_id?: string | null;
    sustituye_a_nombre?: string | null;
    sustitucion_alcance?: 'solo_hoy' | 'rutina' | null;
    reps_parciales?: number;
    drops?: any[];
  }
) {
  const { error } = await supabase.from('ejercicios_registro').update(datos).eq('id', id);
  if (error) throw error;
}

/**
 * Elimina filas de ejercicios que ya no forman parte de la sesión guardada.
 * Es la red de seguridad para sustituciones/eliminaciones: evita que el
 * ejercicio anterior quede huérfano en la base de datos y reaparezca en el
 * historial. Nunca toca las filas de notas (📌).
 */
export async function eliminarEjerciciosObsoletos(
  registroId: string,
  idsConservados: string[]
): Promise<void> {
  if (idsConservados.length === 0) return;

  const { data, error } = await supabase
    .from('ejercicios_registro')
    .select('id, nombre')
    .eq('registro_id', registroId);

  if (error) {
    console.warn('No se pudieron revisar ejercicios obsoletos:', error.message);
    return;
  }

  const ids = new Set(idsConservados);
  const idsObsoletos = (data ?? [])
    .filter((fila) => {
      if (ids.has(fila.id)) return false;
      const nombre = fila.nombre || '';
      return (
        !nombre.startsWith(PREFIJO_OBSERVACIONES) &&
        !nombre.startsWith(PREFIJO_NOTA_EJERCICIO)
      );
    })
    .map((fila) => fila.id);

  if (idsObsoletos.length === 0) return;

  const { error: errorDelete } = await supabase
    .from('ejercicios_registro')
    .delete()
    .in('id', idsObsoletos);

  if (errorDelete) {
    console.warn('No se pudieron eliminar ejercicios obsoletos:', errorDelete.message);
  }
}

export async function actualizarEstadoRegistro(
  registroId: string,
  datos: {
    completado?: boolean;
    plan_id?: string | null;
    plan_nombre?: string | null;
    rutina_nombre?: string | null;
    notas?: string | null;
  }
) {
  const updateData: any = {};
  if (datos.completado !== undefined) updateData.completado = datos.completado;
  if (datos.plan_id !== undefined) updateData.plan_id = datos.plan_id;
  if (datos.plan_nombre !== undefined) updateData.plan_nombre = datos.plan_nombre;
  if (datos.rutina_nombre !== undefined) updateData.rutina_nombre = datos.rutina_nombre;
  if (datos.notas !== undefined) updateData.notas = datos.notas;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('registros_entrenamiento')
      .update(updateData)
      .eq('id', registroId);
    if (error) throw error;
  }
}

/**
 * Guarda la nota general de una sesión y su duración real.
 * La nota visible se mantiene además como fila 📌 para que Inicio y Calendario
 * la sigan mostrando sin cambios. Se actualiza la fila existente en lugar de
 * insertar duplicados cada vez que se guarda o edita la sesión.
 */
export async function guardarNotaSesion(
  registroId: string,
  nota: string | null | undefined,
  duracionSegundos?: number | null
) {
  const texto = (nota || '').trim();
  const notasSerializadas = serializarNotasSesion(texto, duracionSegundos);

  const { error } = await supabase
    .from('registros_entrenamiento')
    .update({ notas: notasSerializadas })
    .eq('id', registroId);
  if (error) throw error;

  const { data: existentes, error: errorSelect } = await supabase
    .from('ejercicios_registro')
    .select('id')
    .eq('registro_id', registroId)
    .like('nombre', `${PREFIJO_OBSERVACIONES}%`)
    .order('creado_en', { ascending: true });
  if (errorSelect) throw errorSelect;

  if (!texto) {
    if (existentes && existentes.length > 0) {
      const { error: errorDelete } = await supabase
        .from('ejercicios_registro')
        .delete()
        .in('id', existentes.map((fila) => fila.id));
      if (errorDelete) throw errorDelete;
    }
    return;
  }

  const nombre = `${PREFIJO_OBSERVACIONES}${texto}`;
  if (existentes && existentes.length > 0) {
    const [primera, ...sobrantes] = existentes;
    const { error: errorUpdate } = await supabase
      .from('ejercicios_registro')
      .update({ nombre })
      .eq('id', primera.id);
    if (errorUpdate) throw errorUpdate;

    if (sobrantes.length > 0) {
      const { error: errorDelete } = await supabase
        .from('ejercicios_registro')
        .delete()
        .in('id', sobrantes.map((fila) => fila.id));
      if (errorDelete) throw errorDelete;
    }
  } else {
    const { error: errorInsert } = await supabase.from('ejercicios_registro').insert({
      registro_id: registroId,
      nombre,
      series: null,
      repeticiones: null,
      peso: null,
    });
    if (errorInsert) throw errorInsert;
  }
}

/**
 * Sincroniza las notas de ejercicio de una sesión.
 * Cada nota vive como fila 📌 [ENTRENAMIENTO] <ejercicio>: <nota>, así que
 * siempre se muestra junto al nombre del ejercicio al que pertenece.
 */
export async function sincronizarNotasEjercicios(
  registroId: string,
  notas: { nombre: string; nota?: string | null }[]
) {
  const { data: existentes, error: errorSelect } = await supabase
    .from('ejercicios_registro')
    .select('id, nombre, ejercicio_nombre')
    .eq('registro_id', registroId)
    .like('nombre', `${PREFIJO_NOTA_EJERCICIO}%`);
  if (errorSelect) throw errorSelect;

  const porEjercicio = new Map<string, { id: string; nombre: string; ejercicio_nombre?: string | null }>();
  for (const fila of existentes || []) {
    const parsed = parsearNotaEjercicio(fila as any);
    if (parsed) porEjercicio.set(parsed.nombreEjercicio.trim().toLowerCase(), fila as any);
  }

  const nombresSesion = new Set(
    notas.map((item) => item.nombre.trim().toLowerCase())
  );

  for (const item of notas) {
    const key = item.nombre.trim().toLowerCase();
    const existente = porEjercicio.get(key);
    const texto = (item.nota || '').trim();

    if (!texto) {
      if (existente) {
        const { error } = await supabase
          .from('ejercicios_registro')
          .delete()
          .eq('id', existente.id);
        if (error) throw error;
      }
      continue;
    }

    const nombreFila = formatearNotaEjercicio(item.nombre, texto);
    if (existente) {
      const { error } = await supabase
        .from('ejercicios_registro')
        .update({ nombre: nombreFila, ejercicio_nombre: item.nombre })
        .eq('id', existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('ejercicios_registro').insert({
        registro_id: registroId,
        nombre: nombreFila,
        ejercicio_nombre: item.nombre,
        series: null,
        repeticiones: null,
        peso: null,
      });
      if (error) throw error;
    }
  }

  // Limpia notas huérfanas de ejercicios que ya no pertenecen a la sesión.
  for (const [key, fila] of porEjercicio.entries()) {
    if (!nombresSesion.has(key)) {
      const { error } = await supabase
        .from('ejercicios_registro')
        .delete()
        .eq('id', fila.id);
      if (error) throw error;
    }
  }
}

export async function eliminarEjercicio(id: string) {
  const { error } = await supabase.from('ejercicios_registro').delete().eq('id', id);
  if (error) throw error;
}

// Obtener la sesión anterior más reciente de una rutina para referencia de pesos/reps
export async function obtenerHistorialPrevioRutina(
  rutinaId?: string | null,
  fechaActual?: string
): Promise<Registro | null> {
  if (!rutinaId || rutinaId.startsWith('local_')) return null;

  try {
    const usuarioId = await getUsuarioId();
    let query = filtrarPorPropietario(
      supabase
        .from('registros_entrenamiento')
        .select('*, rutinas(nombre), ejercicios_registro(*)')
        .eq('rutina_id', rutinaId),
      usuarioId
    )
      .order('fecha', { ascending: false })
      .limit(3);

    if (fechaActual) {
      query = query.lt('fecha', fechaActual);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    // Retorna la sesión anterior más reciente
    return data[0] as Registro;
  } catch (err) {
    console.warn('Error obteniendo historial previo de rutina:', err);
    return null;
  }
}

// Obtener el historial previo de un ejercicio específico (para recálculo tras intercambiar ejercicio)
export async function obtenerHistorialPrevioEjercicio(
  nombreEjercicio: string,
  fechaActual?: string
): Promise<{ fechaFormateada: string; series: any[] } | null> {
  if (!nombreEjercicio.trim()) return null;

  try {
    const nombreLimpio = nombreEjercicio.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');
    const usuarioId = await getUsuarioId();

    let query = filtrarPorPropietario(
      supabase
        .from('ejercicios_registro')
        .select('*, registros_entrenamiento!inner(fecha, completado)')
        .ilike('nombre', `%${nombreLimpio}%`),
      usuarioId
    )
      .order('creado_en', { ascending: false })
      .limit(5);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    for (const item of data) {
      const fechaReg = (item as any).registros_entrenamiento?.fecha;
      if (fechaActual && fechaReg && fechaReg >= fechaActual) {
        continue;
      }

      const matchResumen = (item.nombre || '').match(/\((.*?)\)$/);
      if (matchResumen && matchResumen[1]) {
        const rawSets = matchResumen[1].split('•').map((s: string) => s.trim());
        const seriesPrevias = rawSets.map((setStr: string) => {
          const datosStr = setStr.replace(/^\d+ª:\s*/, '').replace(/✓/g, '').trim();
          const matchK = datosStr.match(/(\d+(?:\.\d+)?)k/);
          const matchR = datosStr.match(/(\d+)r/);
          const matchRir = datosStr.match(/RIR\s*(\d+)/i);
          const matchParcial = datosStr.match(/\+(\d+)p/);

          // Drops
          const drops: any[] = [];
          if (datosStr.includes('→')) {
            const dropParts = datosStr.split('→').map((p: string) => p.trim());
            dropParts.slice(1).forEach((dp: string, dIdx: number) => {
              const mKg = dp.match(/(\d+(?:\.\d+)?)k/);
              const mReps = dp.match(/(\d+)r/);
              const mRir = dp.match(/RIR\s*(\d+)/i);
              if (mKg || mReps) {
                drops.push({
                  orden: dIdx + 1,
                  kg: mKg ? mKg[1] : '',
                  reps: mReps ? mReps[1] : '',
                  rir: mRir ? mRir[1] : null,
                });
              }
            });
          }

          return {
            peso: matchK ? matchK[1] : (item.peso ? item.peso.toString() : ''),
            reps: matchR ? matchR[1] : (item.repeticiones ? item.repeticiones.toString() : ''),
            rir: matchRir ? matchRir[1] : '',
            nota: '',
            repsParciales: matchParcial ? parseInt(matchParcial[1], 10) : 0,
            esDropset: drops.length > 0,
            drops,
          };
        });

        return {
          fechaFormateada: fechaReg || 'Previo',
          series: seriesPrevias,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('Error obteniendo historial previo de ejercicio:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial completo por ejercicio (Previa / evolución)
// ─────────────────────────────────────────────────────────────────────────────

export type DropHistorialEjercicio = {
  orden: number;
  kg: number;
  reps: number;
  rir: number | null;
};

export type SerieHistorialEjercicio = {
  setNum: number;
  pesoD: number;
  repsD: number;
  pesoI: number;
  repsI: number;
  rir: number | null;
  nota: string;
  completado: boolean;
  repsParciales: number;
  esDropset: boolean;
  drops: DropHistorialEjercicio[];
  volumenKg: number;
  e1RM: number;
};

export type SesionHistorialEjercicio = {
  /** id de la fila en ejercicios_registro */
  id: string;
  registroId: string;
  fecha: string;
  creadoEn: string;
  rutinaNombre: string | null;
  planNombre: string | null;
  esUnilateral: boolean;
  series: SerieHistorialEjercicio[];
  seriesCompletadas: number;
  mejorPeso: number;
  repsMejorPeso: number;
  mejorE1RM: number;
  mejorReps: number;
  totalReps: number;
  volumenKg: number;
  notaEjercicio: string;
  notaSesion: string;
};

type RelacionNombre = { nombre?: string | null } | { nombre?: string | null }[] | null;

type RelacionRegistro = {
  id: string;
  fecha: string;
  completado: boolean;
  notas?: string | null;
  rutina_nombre?: string | null;
  plan_nombre?: string | null;
  rutinas?: RelacionNombre;
  planes_entrenamiento?: RelacionNombre;
};

type FilaHistorialEjercicio = {
  id: string;
  nombre: string;
  series?: number | null;
  repeticiones?: number | null;
  peso?: number | null;
  completado?: boolean | null;
  ejercicio_nombre?: string | null;
  creado_en?: string | null;
  registros_entrenamiento?: RelacionRegistro | RelacionRegistro[] | null;
};

const SELECT_HISTORIAL_EJERCICIO = `
  id,
  nombre,
  series,
  repeticiones,
  peso,
  completado,
  ejercicio_nombre,
  creado_en,
  registros_entrenamiento!inner(
    id,
    fecha,
    completado,
    notas,
    rutina_nombre,
    plan_nombre,
    rutinas(nombre),
    planes_entrenamiento(nombre)
  )
`;

function nombreDeRelacion(valor: RelacionNombre | undefined): string | null {
  if (!valor) return null;
  const item = Array.isArray(valor) ? valor[0] : valor;
  return item?.nombre?.trim() || null;
}

function obtenerRegistroDeFila(
  fila: FilaHistorialEjercicio
): RelacionRegistro | null {
  const valor = fila.registros_entrenamiento;
  if (!valor) return null;
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

/**
 * Normaliza nombres para agrupar variantes habituales del mismo ejercicio:
 * mayúsculas, tildes, puntuación y plurales simples (Dominada / Dominadas,
 * Elevación lateral / Elevaciones laterales).
 */
function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarNombreEjercicio(nombre?: string | null): string {
  return sinAcentos(nombre || '')
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((palabra) => {
      if (palabra.length > 4 && palabra.endsWith('es')) {
        return palabra.slice(0, -2);
      }
      if (
        palabra.length > 3 &&
        palabra.endsWith('s') &&
        !palabra.endsWith('ss')
      ) {
        return palabra.slice(0, -1);
      }
      return palabra;
    })
    .join(' ');
}

function numero(valor: string | number | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function numeroOpcional(
  valor: string | number | null | undefined
): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** 1RM estimado con la fórmula de Epley. */
function calcularE1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  return kg * (1 + reps / 30);
}

function construirSeriesHistorial(
  fila: FilaHistorialEjercicio,
  esUnilateral: boolean,
  detalles: ReturnType<typeof parsearEjercicioInfo>['detallesSets']
): SerieHistorialEjercicio[] {
  if (detalles.length === 0) {
    const peso = numero(fila.peso);
    const reps = numero(fila.repeticiones);
    if (peso <= 0 && reps <= 0) return [];

    return [
      {
        setNum: 1,
        pesoD: peso,
        repsD: reps,
        pesoI: 0,
        repsI: 0,
        rir: null,
        nota: '',
        completado: Boolean(fila.completado),
        repsParciales: 0,
        esDropset: false,
        drops: [],
        volumenKg: peso * reps,
        e1RM: calcularE1RM(peso, reps),
      },
    ];
  }

  return detalles.map((detalle, index) => {
    let pesoD = numero(detalle.pesoD);
    let repsD = numero(detalle.repsD);

    // Compatibilidad con resúmenes antiguos que no siguieron el formato exacto.
    if (pesoD <= 0 && detalle.resumen) {
      const matchKg = detalle.resumen.match(/(\d+(?:\.\d+)?)k/);
      if (matchKg) pesoD = numero(matchKg[1]);
    }
    if (repsD <= 0 && detalle.resumen) {
      const matchReps = detalle.resumen.match(/(\d+)r/);
      if (matchReps) repsD = numero(matchReps[1]);
    }

    const pesoI = esUnilateral ? numero(detalle.pesoI) : 0;
    const repsI = esUnilateral ? numero(detalle.repsI) : 0;

    const drops: DropHistorialEjercicio[] = (detalle.drops || []).map(
      (drop, dropIndex) => ({
        orden: drop.orden || dropIndex + 1,
        kg: numero(drop.kg),
        reps: numero(drop.reps),
        rir: numeroOpcional(drop.rir),
      })
    );

    const volumenD = pesoD * repsD;
    const volumenI = pesoI * repsI;
    const volumenDrops = drops.reduce(
      (total, drop) => total + drop.kg * drop.reps,
      0
    );

    return {
      setNum: detalle.setNum || index + 1,
      pesoD,
      repsD,
      pesoI,
      repsI,
      rir: numeroOpcional(detalle.rir),
      nota: detalle.nota || '',
      completado: Boolean(detalle.completado),
      repsParciales: detalle.repsParciales || 0,
      esDropset: Boolean(detalle.esDropset || drops.length > 0),
      drops,
      volumenKg: volumenD + volumenI + volumenDrops,
      e1RM: Math.max(
        calcularE1RM(pesoD, repsD),
        calcularE1RM(pesoI, repsI)
      ),
    };
  });
}

function construirSesionHistorial(
  fila: FilaHistorialEjercicio,
  notaEjercicio: string
): SesionHistorialEjercicio | null {
  const registro = obtenerRegistroDeFila(fila);
  if (!registro?.fecha) return null;

  const parsed = parsearEjercicioInfo({
    nombre: fila.nombre,
    series: fila.series,
    repeticiones: fila.repeticiones,
    peso: fila.peso,
    completado: Boolean(fila.completado),
  });

  const series = construirSeriesHistorial(
    fila,
    parsed.esUnilateral,
    parsed.detallesSets
  );
  if (series.length === 0) return null;

  const tieneDatos = series.some(
    (serie) =>
      serie.pesoD > 0 ||
      serie.repsD > 0 ||
      serie.pesoI > 0 ||
      serie.repsI > 0 ||
      Boolean(serie.nota)
  );
  if (!tieneDatos && !notaEjercicio) return null;

  const seriesCompletadas = series.filter((serie) => serie.completado).length;

  // Las filas de ejercicios que se saltaron en una sesión completada conservan
  // la prescripción (peso/reps de la rutina) pero ninguna serie con ✓. No son
  // historial real, así que se descartan.
  if (!fila.completado && seriesCompletadas === 0) return null;

  let mejorPeso = 0;
  let repsMejorPeso = 0;
  let mejorE1RM = 0;
  let mejorReps = 0;
  let totalReps = 0;
  let volumenKg = 0;

  for (const serie of series) {
    volumenKg += serie.volumenKg;
    mejorE1RM = Math.max(mejorE1RM, serie.e1RM);
    mejorReps = Math.max(mejorReps, serie.repsD, serie.repsI);
    totalReps +=
      serie.repsD +
      (parsed.esUnilateral ? serie.repsI : 0) +
      serie.drops.reduce((total, drop) => total + drop.reps, 0);

    const lados = [
      { peso: serie.pesoD, reps: serie.repsD },
      ...(parsed.esUnilateral
        ? [{ peso: serie.pesoI, reps: serie.repsI }]
        : []),
    ];

    for (const lado of lados) {
      if (
        lado.peso > mejorPeso ||
        (lado.peso === mejorPeso && lado.reps > repsMejorPeso)
      ) {
        mejorPeso = lado.peso;
        repsMejorPeso = lado.reps;
      }
    }
  }

  return {
    id: fila.id,
    registroId: registro.id,
    fecha: registro.fecha,
    creadoEn: fila.creado_en || '',
    rutinaNombre:
      registro.rutina_nombre?.trim() ||
      nombreDeRelacion(registro.rutinas) ||
      null,
    planNombre:
      registro.plan_nombre?.trim() ||
      nombreDeRelacion(registro.planes_entrenamiento) ||
      null,
    esUnilateral: parsed.esUnilateral,
    series,
    seriesCompletadas,
    mejorPeso,
    repsMejorPeso,
    mejorE1RM,
    mejorReps,
    totalReps,
    volumenKg,
    notaEjercicio: notaEjercicio.trim(),
    notaSesion: parsearNotasSesion(registro.notas).nota,
  };
}

async function obtenerNotasHistorial(
  registroIds: string[],
  nombreEjercicio: string
): Promise<Map<string, string>> {
  const notas = new Map<string, string>();
  const objetivo = normalizarNombreEjercicio(nombreEjercicio);
  const usuarioId = await getUsuarioId();

  for (let i = 0; i < registroIds.length; i += 100) {
    const lote = registroIds.slice(i, i + 100);
    const { data, error } = await filtrarPorPropietario(
      supabase
        .from('ejercicios_registro')
        .select('registro_id, nombre, ejercicio_nombre')
        .in('registro_id', lote),
      usuarioId
    ).like('nombre', `${PREFIJO_NOTA_EJERCICIO}%`);

    if (error) {
      console.warn('Error obteniendo notas del historial:', error);
      continue;
    }

    for (const fila of data || []) {
      const parsed = parsearNotaEjercicio(fila);
      if (
        parsed &&
        parsed.nota &&
        normalizarNombreEjercicio(parsed.nombreEjercicio) === objetivo
      ) {
        notas.set(fila.registro_id, parsed.nota);
      }
    }
  }

  return notas;
}

/**
 * Devuelve todo el historial real de un ejercicio para la Previa:
 * sesiones finalizadas, series, fechas, contexto de rutina/plan y notas.
 */
export async function obtenerHistorialEjercicio(
  nombreEjercicio: string,
  registroActualId?: string | null
): Promise<SesionHistorialEjercicio[]> {
  const nombreLimpio = parsearEjercicioInfo({
    nombre: nombreEjercicio,
  }).nombreLimpio;
  const objetivo = normalizarNombreEjercicio(nombreLimpio);

  if (!objetivo) return [];

  // La primera palabra sin tildes permite encontrar variantes naturales
  // (Elevación / Elevaciones, Jalón / Jalones) sin abrir demasiado el filtro.
  const primeraPalabra = sinAcentos(nombreLimpio.split(/\s+/)[0] || '');
  const usuarioId = await getUsuarioId();

  const [porNombre, porCampo, porPalabra] = await Promise.all([
    filtrarPorPropietario(
      supabase
        .from('ejercicios_registro')
        .select(SELECT_HISTORIAL_EJERCICIO)
        .eq('registros_entrenamiento.completado', true)
        .ilike('nombre', `%${nombreLimpio}%`),
      usuarioId
    ).order('creado_en', { ascending: false }),
    filtrarPorPropietario(
      supabase
        .from('ejercicios_registro')
        .select(SELECT_HISTORIAL_EJERCICIO)
        .eq('registros_entrenamiento.completado', true)
        .eq('ejercicio_nombre', nombreLimpio),
      usuarioId
    ).order('creado_en', { ascending: false }),
    primeraPalabra.length >= 3
      ? filtrarPorPropietario(
          supabase
            .from('ejercicios_registro')
            .select(SELECT_HISTORIAL_EJERCICIO)
            .eq('registros_entrenamiento.completado', true)
            .ilike('nombre', `%${primeraPalabra}%`),
          usuarioId
        ).order('creado_en', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (porNombre.error && porCampo.error && porPalabra.error) {
    throw new Error(
      porNombre.error.message ||
        porCampo.error.message ||
        porPalabra.error.message ||
        'Error de conexión'
    );
  }

  if (porNombre.error) {
    console.warn('Error en historial por nombre:', porNombre.error);
  }
  if (porCampo.error) {
    console.warn('Error en historial por ejercicio_nombre:', porCampo.error);
  }
  if (porPalabra.error) {
    console.warn('Error en historial por palabra clave:', porPalabra.error);
  }

  const filas = [
    ...((porNombre.data || []) as unknown as FilaHistorialEjercicio[]),
    ...((porCampo.data || []) as unknown as FilaHistorialEjercicio[]),
    ...((porPalabra.data || []) as unknown as FilaHistorialEjercicio[]),
  ];

  const filasUnicas = new Map<string, FilaHistorialEjercicio>();

  for (const fila of filas) {
    if (!fila?.id || !fila.nombre) continue;
    if (fila.nombre.startsWith('📌')) continue;

    const registro = obtenerRegistroDeFila(fila);
    if (!registro || registro.id === registroActualId) continue;
    if (!registro.completado) continue;

    const parsed = parsearEjercicioInfo({ nombre: fila.nombre });
    if (normalizarNombreEjercicio(parsed.nombreLimpio) !== objetivo) continue;

    filasUnicas.set(fila.id, fila);
  }

  if (filasUnicas.size === 0) return [];

  const registroIds = Array.from(
    new Set(
      Array.from(filasUnicas.values())
        .map((fila) => obtenerRegistroDeFila(fila)?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const notasPorRegistro = await obtenerNotasHistorial(
    registroIds,
    nombreLimpio
  );

  const sesiones = Array.from(filasUnicas.values())
    .map((fila) => {
      const registro = obtenerRegistroDeFila(fila);
      const nota = registro
        ? notasPorRegistro.get(registro.id) || ''
        : '';
      return construirSesionHistorial(fila, nota);
    })
    .filter((sesion): sesion is SesionHistorialEjercicio => Boolean(sesion));

  return sesiones.sort((a, b) => {
    const porFecha = b.fecha.localeCompare(a.fecha);
    if (porFecha !== 0) return porFecha;
    return b.creadoEn.localeCompare(a.creadoEn);
  });
}

