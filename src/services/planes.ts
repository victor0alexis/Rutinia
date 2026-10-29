import { supabase } from '../biblioteca/supabase';
import { PlanEntrenamiento, Rutina } from '../tipos';
import {
  guardarCacheLocal,
  leerLocal,
  obtenerCacheLocal,
  escribirLocal,
} from '../utils/offline';
import { filtrarPorPropietario, obtenerUsuarioIdActual } from '../utils/usuario';
import { EjercicioNuevo } from './rutinas';
import { aISO, diasDeSemana } from '../utils/fechas';

const KEY_ULTIMO_PLAN = 'ultimo_plan_usado';

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
const getUsuarioId = obtenerUsuarioIdActual;

/** Obtiene el ID del último plan usado persistido localmente */
export async function obtenerUltimoPlanUsadoId(): Promise<string | null> {
  return leerLocal(KEY_ULTIMO_PLAN);
}

/** Guarda el ID del último plan usado */
export async function guardarUltimoPlanUsadoId(planId: string): Promise<void> {
  await escribirLocal(KEY_ULTIMO_PLAN, planId);
}

/**
 * Lista todos los planes del usuario con conteo de rutinas y días por semana.
 */
export async function listarPlanes(opciones: { incluirArchivados?: boolean } = {}): Promise<PlanEntrenamiento[]> {
  try {
    const usuarioId = await getUsuarioId();
    let query = filtrarPorPropietario(
      supabase
        .from('planes_entrenamiento')
        .select('*, rutinas(id, dia_sugerido, archivado:id)'),
      usuarioId
    )
      .order('activo', { ascending: false })
      .order('orden', { ascending: true })
      .order('creado_en', { ascending: true });

    if (!opciones.incluirArchivados) {
      query = query.eq('archivado', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    const planesMapeados: PlanEntrenamiento[] = (data || []).map((p: any) => {
      const ruts = p.rutinas || [];
      const diasUnicos = new Set<number>();
      ruts.forEach((r: any) => {
        if (r.dia_sugerido !== null && r.dia_sugerido !== undefined) {
          diasUnicos.add(r.dia_sugerido);
        }
      });

      return {
        id: p.id,
        usuario_id: p.usuario_id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        objetivo: p.objetivo,
        color: p.color || '#E0334F',
        icono: p.icono || 'barbell-outline',
        orden: p.orden || 0,
        activo: Boolean(p.activo),
        archivado: Boolean(p.archivado),
        creado_en: p.creado_en,
        totalRutinas: ruts.length,
        diasPorSemana: diasUnicos.size,
      };
    });

    // Guardar en caché local
    await guardarCacheLocal('planes_entrenamiento', planesMapeados);
    return planesMapeados;
  } catch (err) {
    console.warn('Sin conexión a Supabase, cargando caché local de planes:', err);
    const cache = await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento');
    if (cache) {
      return opciones.incluirArchivados ? cache : cache.filter((p) => !p.archivado);
    }
    return [];
  }
}

/**
 * Obtiene un plan específico por ID.
 */
export async function obtenerPlanPorId(planId: string): Promise<PlanEntrenamiento | null> {
  const planes = await listarPlanes({ incluirArchivados: true });
  return planes.find((p) => p.id === planId) || null;
}

/**
 * Crea un nuevo plan de entrenamiento.
 */
export async function crearPlan(datos: {
  nombre: string;
  descripcion?: string;
  objetivo?: string;
  color?: string;
  icono?: string;
  activo?: boolean;
}): Promise<PlanEntrenamiento> {
  const usuarioId = await getUsuarioId();

  // Si se solicita como activo, desactivar los demás primero
  if (datos.activo) {
    await desactivarTodosLosPlanes(usuarioId);
  }

  const payload: any = {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion?.trim() || '',
    objetivo: datos.objetivo?.trim() || '',
    color: datos.color || '#E0334F',
    icono: datos.icono || 'barbell-outline',
    orden: 999, // Se colocará al final entre los inactivos
    activo: Boolean(datos.activo),
    archivado: false,
  };
  if (usuarioId) payload.usuario_id = usuarioId;

  const { data, error } = await supabase
    .from('planes_entrenamiento')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Error al crear el plan: ${error.message}`);

  const nuevoPlan: PlanEntrenamiento = {
    ...data,
    totalRutinas: 0,
    diasPorSemana: 0,
  };

  // Actualizar caché
  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  await guardarCacheLocal('planes_entrenamiento', [nuevoPlan, ...cache]);
  await guardarUltimoPlanUsadoId(nuevoPlan.id);

  return nuevoPlan;
}

/**
 * Edita los datos de un plan existente.
 */
export async function editarPlan(
  planId: string,
  cambios: {
    nombre?: string;
    descripcion?: string;
    objetivo?: string;
    color?: string;
    icono?: string;
    activo?: boolean;
    archivado?: boolean;
    orden?: number;
  }
): Promise<PlanEntrenamiento> {
  const usuarioId = await getUsuarioId();

  if (cambios.activo) {
    await desactivarTodosLosPlanes(usuarioId, planId);
  }

  const payload: any = { ...cambios };
  if (cambios.nombre) payload.nombre = cambios.nombre.trim();
  if (cambios.descripcion !== undefined) payload.descripcion = cambios.descripcion.trim();
  if (cambios.objetivo !== undefined) payload.objetivo = cambios.objetivo.trim();

  const { data, error } = await supabase
    .from('planes_entrenamiento')
    .update(payload)
    .eq('id', planId)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar el plan: ${error.message}`);

  // Actualizar caché local
  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  const actualizados = cache.map((p) => (p.id === planId ? { ...p, ...data } : p));
  await guardarCacheLocal('planes_entrenamiento', actualizados);

  return data;
}

/**
 * Desactiva todos los planes activos (excepto opcionalmente uno).
 */
async function desactivarTodosLosPlanes(usuarioId: string | null, exceptId?: string): Promise<void> {
  let query = supabase.from('planes_entrenamiento').update({ activo: false }).eq('activo', true);
  if (usuarioId) {
    query = query.eq('usuario_id', usuarioId);
  } else {
    query = query.is('usuario_id', null);
  }
  if (exceptId) {
    query = query.neq('id', exceptId);
  }
  const { error } = await query;
  if (error) console.warn('Error desactivando planes activos:', error);
}

/**
 * Define un plan como el Activo principal.
 */
export async function definirPlanActivo(planId: string): Promise<void> {
  const usuarioId = await getUsuarioId();
  await desactivarTodosLosPlanes(usuarioId, planId);

  const { error } = await supabase
    .from('planes_entrenamiento')
    .update({ activo: true, archivado: false })
    .eq('id', planId);

  if (error) throw new Error(`Error al activar el plan: ${error.message}`);

  await guardarUltimoPlanUsadoId(planId);

  // Actualizar caché
  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  const actualizados = cache.map((p) => ({
    ...p,
    activo: p.id === planId,
    archivado: p.id === planId ? false : p.archivado,
  }));
  await guardarCacheLocal('planes_entrenamiento', actualizados);
}

/**
 * Archiva un plan (si era activo, se desactiva).
 */
export async function archivarPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('planes_entrenamiento')
    .update({ archivado: true, activo: false })
    .eq('id', planId);

  if (error) throw new Error(`Error al archivar el plan: ${error.message}`);

  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  const actualizados = cache.map((p) =>
    p.id === planId ? { ...p, archivado: true, activo: false } : p
  );
  await guardarCacheLocal('planes_entrenamiento', actualizados);
}

/**
 * Restaura un plan archivado.
 */
export async function restaurarPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('planes_entrenamiento')
    .update({ archivado: false })
    .eq('id', planId);

  if (error) throw new Error(`Error al restaurar el plan: ${error.message}`);

  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  const actualizados = cache.map((p) =>
    p.id === planId ? { ...p, archivado: false } : p
  );
  await guardarCacheLocal('planes_entrenamiento', actualizados);
}

/**
 * Reordena una lista de planes según el orden proporcionado.
 */
export async function reordenarPlanes(planesOrdenadosIds: string[]): Promise<void> {
  for (let i = 0; i < planesOrdenadosIds.length; i++) {
    const id = planesOrdenadosIds[i];
    await supabase.from('planes_entrenamiento').update({ orden: i }).eq('id', id);
  }
}

/**
 * Opciones de resolución de rutinas al eliminar un plan:
 * 1. 'mover': transfiere todas las rutinas a `planDestinoId`.
 * 2. 'desvincular': deja las rutinas sin plan (`plan_id = null`).
 * 3. 'borrar': elimina las rutinas de la base de datos (NUNCA borra registros_entrenamiento históricos).
 */
export type AccionEliminarPlan =
  | { tipo: 'mover'; planDestinoId: string }
  | { tipo: 'desvincular' }
  | { tipo: 'borrar' };

export async function eliminarPlan(
  planId: string,
  resolucion: AccionEliminarPlan
): Promise<void> {
  // 1. Resolver las rutinas contenidas en el plan
  if (resolucion.tipo === 'mover') {
    const { error: errMover } = await supabase
      .from('rutinas')
      .update({ plan_id: resolucion.planDestinoId })
      .eq('plan_id', planId);
    if (errMover) throw new Error(`Error moviendo rutinas: ${errMover.message}`);
  } else if (resolucion.tipo === 'desvincular') {
    const { error: errDesv } = await supabase
      .from('rutinas')
      .update({ plan_id: null })
      .eq('plan_id', planId);
    if (errDesv) throw new Error(`Error desvinculando rutinas: ${errDesv.message}`);
  } else if (resolucion.tipo === 'borrar') {
    // Al eliminar las rutinas, la FK en registros_entrenamiento tiene ON DELETE SET NULL
    // y los registros conservan `rutina_nombre` y `plan_nombre`.
    const { error: errBorrarRuts } = await supabase
      .from('rutinas')
      .delete()
      .eq('plan_id', planId);
    if (errBorrarRuts) throw new Error(`Error eliminando rutinas: ${errBorrarRuts.message}`);
  }

  // 2. Eliminar el plan de entrenamiento
  const { error: errPlan } = await supabase
    .from('planes_entrenamiento')
    .delete()
    .eq('id', planId);

  if (errPlan) throw new Error(`Error al eliminar el plan: ${errPlan.message}`);

  // 3. Limpiar caché local
  const cache = (await obtenerCacheLocal<PlanEntrenamiento[]>('planes_entrenamiento')) || [];
  await guardarCacheLocal('planes_entrenamiento', cache.filter((p) => p.id !== planId));
}

/**
 * Lista las rutinas de un plan específico (o rutinas huérfanas si planId es null).
 */
export async function listarRutinasDePlan(planId: string | null): Promise<Rutina[]> {
  try {
    const usuarioId = await getUsuarioId();
    let query = filtrarPorPropietario(
      supabase
        .from('rutinas')
        .select('*, ejercicios_rutina(*), planes_entrenamiento(*)'),
      usuarioId
    )
      .order('orden_en_plan', { ascending: true })
      .order('dia_sugerido', { ascending: true })
      .order('creado_en', { ascending: true });

    if (planId) {
      query = query.eq('plan_id', planId);
    } else {
      query = query.is('plan_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      ejercicios_rutina: [...(r.ejercicios_rutina || [])].sort((a: any, b: any) => a.orden - b.orden),
    }));
  } catch (err) {
    console.warn('Error listando rutinas de plan:', err);
    return [];
  }
}

/**
 * Crea una rutina directamente asociada a un plan con día sugerido opcional.
 */
export async function crearRutinaEnPlan(
  planId: string | null,
  nombre: string,
  ejercicios: EjercicioNuevo[],
  diaSugerido: number | null = null
): Promise<Rutina | null> {
  const usuarioId = await getUsuarioId();

  const insertData: any = {
    nombre: nombre.trim(),
    plan_id: planId,
    dia_sugerido: diaSugerido,
    orden_en_plan: 0,
  };
  if (usuarioId) insertData.usuario_id = usuarioId;

  const { data: rutina, error } = await supabase
    .from('rutinas')
    .insert(insertData)
    .select('*, planes_entrenamiento(*)')
    .single();

  if (error) throw new Error(`Error al crear rutina: ${error.message}`);

  let ejerciciosCreados: any[] = [];
  if (ejercicios.length > 0) {
    const filas = ejercicios.map((e, i) => {
      const fila: any = {
        nombre: e.nombre,
        series: e.series,
        repeticiones: e.repeticiones,
        peso: e.peso,
        rutina_id: rutina.id,
        orden: i,
      };
      if (usuarioId) fila.usuario_id = usuarioId;
      return fila;
    });

    const { data: ejsData, error: ejsError } = await supabase
      .from('ejercicios_rutina')
      .insert(filas)
      .select();

    if (ejsError) throw new Error(`Error al insertar ejercicios: ${ejsError.message}`);
    ejerciciosCreados = ejsData || [];
  }

  const rutinaCompleta: Rutina = {
    ...rutina,
    ejercicios_rutina: ejerciciosCreados.sort((a, b) => a.orden - b.orden),
  };

  return rutinaCompleta;
}

/**
 * Mueve una rutina de un plan a otro (o a sin plan).
 */
export async function moverRutina(rutinaId: string, nuevoPlanId: string | null): Promise<void> {
  const { error } = await supabase
    .from('rutinas')
    .update({ plan_id: nuevoPlanId })
    .eq('id', rutinaId);

  if (error) throw new Error(`Error al mover rutina: ${error.message}`);
}

/**
 * Asigna o cambia el día sugerido de una rutina (0=Lunes, 6=Domingo, null=ninguno).
 */
export async function definirDiaSugerido(
  rutinaId: string,
  diaSugerido: number | null
): Promise<void> {
  const { error } = await supabase
    .from('rutinas')
    .update({ dia_sugerido: diaSugerido })
    .eq('id', rutinaId);

  if (error) throw new Error(`Error al asignar día sugerido: ${error.message}`);
}

/**
 * Duplica una rutina dentro del mismo plan o en otro plan de destino.
 */
export async function duplicarRutinaEnPlan(
  rutina: Rutina,
  destinoPlanId?: string | null
): Promise<Rutina | null> {
  const targetPlanId = destinoPlanId !== undefined ? destinoPlanId : rutina.plan_id;
  const nuevosEjercicios: EjercicioNuevo[] = (rutina.ejercicios_rutina || []).map((e) => ({
    nombre: e.nombre.replace(/\s*\(.*\)$/, '').trim() || e.nombre,
    series: e.series,
    repeticiones: e.repeticiones,
    peso: e.peso,
  }));

  return crearRutinaEnPlan(
    targetPlanId ?? null,
    `${rutina.nombre} (Copia)`,
    nuevosEjercicios,
    rutina.dia_sugerido
  );
}

/**
 * Aplica todas las rutinas con día sugerido de un plan a una semana específica.
 * Resuelve conflictos de días que ya tienen rutina (reemplazar o conservar).
 */
export async function aplicarPlanASemana(
  planId: string,
  fechaSemana: Date,
  opciones: {
    reemplazar: boolean;
    diasSeleccionados?: number[]; // Índices 0..6 a aplicar
  }
): Promise<{ aplicadas: number; omitidas: number }> {
  const diasSemana = diasDeSemana(fechaSemana); // Array de 7 Date (Lunes a Domingo)
  const rutinasPlan = await listarRutinasDePlan(planId);
  const planInfo = await obtenerPlanPorId(planId);
  const usuarioId = await getUsuarioId();

  let aplicadas = 0;
  let omitidas = 0;

  for (let diaIndex = 0; diaIndex < 7; diaIndex++) {
    // Si se especificó filtro de días y no está seleccionado, omitir
    if (opciones.diasSeleccionados && !opciones.diasSeleccionados.includes(diaIndex)) {
      continue;
    }

    const rutinaParaDia = rutinasPlan.find((r) => r.dia_sugerido === diaIndex);
    if (!rutinaParaDia) continue;

    const fechaISO = aISO(diasSemana[diaIndex]);

    // Verificar si ya existe un registro con rutina en esta fecha
    const { data: registrosExistentes } = await filtrarPorPropietario(
      supabase
        .from('registros_entrenamiento')
        .select('id, rutina_id')
        .eq('fecha', fechaISO),
      usuarioId
    );

    const tieneRutina = (registrosExistentes || []).some((r) => r.rutina_id !== null);

    if (tieneRutina && !opciones.reemplazar) {
      omitidas++;
      continue;
    }

    // Si reemplazar es true y existían registros, eliminamos los de rutina previos
    if (tieneRutina && opciones.reemplazar) {
      for (const reg of registrosExistentes || []) {
        if (reg.rutina_id !== null) {
          await supabase.from('registros_entrenamiento').delete().eq('id', reg.id);
        }
      }
    }

    // Crear el nuevo registro del día con los datos congelados del plan y rutina
    const regData: any = {
      fecha: fechaISO,
      rutina_id: rutinaParaDia.id,
      plan_id: planId,
      plan_nombre: planInfo?.nombre || 'Plan',
      rutina_nombre: rutinaParaDia.nombre,
      completado: false,
    };
    if (usuarioId) regData.usuario_id = usuarioId;

    const { data: nuevoReg, error: errReg } = await supabase
      .from('registros_entrenamiento')
      .insert(regData)
      .select()
      .single();

    if (errReg) {
      console.warn('Error al aplicar rutina al día:', errReg);
      continue;
    }

    // Insertar ejercicios de la rutina en el registro
    const ejercicios = rutinaParaDia.ejercicios_rutina || [];
    if (ejercicios.length > 0 && nuevoReg) {
      const filas = ejercicios.map((e) => {
        const f: any = {
          registro_id: nuevoReg.id,
          nombre: e.nombre,
          series: e.series,
          repeticiones: e.repeticiones,
          peso: e.peso,
          completado: false,
        };
        if (usuarioId) f.usuario_id = usuarioId;
        return f;
      });
      await supabase.from('ejercicios_registro').insert(filas);
    }

    aplicadas++;
  }

  return { aplicadas, omitidas };
}
