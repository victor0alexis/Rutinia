import { supabase } from '../biblioteca/supabase';
import { Registro, Rutina } from '../tipos';
import {
  escribirLocal,
  guardarCacheLocal,
  leerLocal,
  listarSufijosLocales,
  obtenerCacheLocal,
} from '../utilidades/almacenamientoLocal';
import { filtrarPorPropietario, obtenerUsuarioIdActual } from '../utilidades/usuario';
import { parsearEjercicioInfo } from '../utilidades/ejercicios';
import {
  BorradorSesion,
  EjercicioStateDraft,
  SerieEjecucionDraft,
  emitirCambioSesionActiva,
} from '../utilidades/sesionActiva';
import { emitirCambioDatos } from '../utilidades/sincronizacion';

export type EjercicioNuevo = {
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
};

/** Configuración que hereda un ejercicio al reemplazar a otro en la rutina. */
export type HerenciaEjercicioRutina = {
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
};

/** Normaliza nombres con tags [U], detalles entre paréntesis o texto de sustitución. */
function normalizarNombreEjercicio(nombre: string): string {
  return parsearEjercicioInfo({ nombre }).nombreLimpio.trim().toLowerCase();
}

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
const getUsuarioId = obtenerUsuarioIdActual;

export async function listarRutinas(): Promise<Rutina[]> {
  try {
    const usuarioId = await getUsuarioId();
    const query = filtrarPorPropietario(
      supabase
        .from('rutinas')
        .select('*, ejercicios_rutina(*), planes_entrenamiento(*)'),
      usuarioId
    )
      .order('orden_en_plan', { ascending: true })
      .order('dia_sugerido', { ascending: true })
      .order('creado_en', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    const res = (data ?? []).map((r: any) => ({
      ...r,
      ejercicios_rutina: [...(r.ejercicios_rutina || [])].sort((a: any, b: any) => a.orden - b.orden),
    }));

    // Preservar cualquier rutina local creada offline para que no desaparezca
    const cacheLocal = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    const rutinasLocales = cacheLocal.filter((r) => r.id.startsWith('local_'));

    const map = new Map<string, Rutina>();
    [...rutinasLocales, ...res].forEach((r) => map.set(r.id, r));
    const combinadas = Array.from(map.values());

    await guardarCacheLocal('rutinas', combinadas);
    return combinadas;
  } catch {
    console.warn('Sin conexión a Supabase, cargando caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

export async function crearRutina(
  nombre: string,
  ejercicios: EjercicioNuevo[],
  planId?: string | null,
  diaSugerido?: number | null
): Promise<Rutina | null> {
  try {
    const usuarioId = await getUsuarioId();

    const insertData: any = { nombre };
    if (planId !== undefined) insertData.plan_id = planId;
    if (diaSugerido !== undefined) insertData.dia_sugerido = diaSugerido;
    if (usuarioId) insertData.usuario_id = usuarioId;

    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert(insertData)
      .select('*, planes_entrenamiento(*)')
      .single();


    if (error) {
      throw new Error(`Error Supabase al crear rutina: ${error.message} (Código: ${error.code})`);
    }
    if (!rutina) throw new Error('No se recibió respuesta de Supabase al crear la rutina.');

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

      if (ejsError) {
        throw new Error(`Error Supabase al insertar ejercicios: ${ejsError.message} (Código: ${ejsError.code})`);
      }
      ejerciciosCreados = ejsData ?? [];
    }

    const rutinaCompleta: Rutina = {
      ...rutina,
      ejercicios_rutina: ejerciciosCreados.sort((a, b) => a.orden - b.orden),
    };

    const rutinasExistentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', [rutinaCompleta, ...rutinasExistentes]);
    emitirCambioDatos();

    return rutinaCompleta;
  } catch (err: any) {
    console.warn('Error creando rutina:', err?.message ?? err);
    // Si la excepción proviene de una respuesta de error de Supabase, re-lanzar para informar al usuario
    if (err?.message?.includes('Supabase') || err?.message?.includes('Código')) {
      throw err;
    }

    // Fallback offline solo para fallos de red sin conexión
    const rutinaId = `local_${Date.now()}`;
    const nuevaRutinaLocal: Rutina = {
      id: rutinaId,
      nombre,
      creado_en: new Date().toISOString(),
      ejercicios_rutina: ejercicios.map((e, i) => ({
        id: `${rutinaId}_${i}`,
        rutina_id: rutinaId,
        nombre: e.nombre,
        series: e.series,
        repeticiones: e.repeticiones,
        peso: e.peso,
        orden: i,
      })),
    };
    const rutinasExistentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', [nuevaRutinaLocal, ...rutinasExistentes]);
    emitirCambioDatos();
    return nuevaRutinaLocal;
  }
}

export async function eliminarRutina(id: string): Promise<void> {
  // IDs locales (modo offline) → solo limpiar caché
  if (id.startsWith('local_')) {
    const cache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', cache.filter((r) => r.id !== id));
    return;
  }

  // 1. Verificar que la rutina existe antes de borrar
  const { data: existe, error: errCheck } = await supabase
    .from('rutinas')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (errCheck) {
    throw new Error(`Error verificando rutina: ${errCheck.message} (Código: ${errCheck.code})`);
  }
  if (!existe) {
    // Ya no existe en Supabase, limpiar caché local y salir
    const cache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', cache.filter((r) => r.id !== id));
    return;
  }

  // 2. Desvincular registros_entrenamiento (ON DELETE SET NULL lo hace automáticamente si el script SQL se corrió)
  const { error: errUpdate } = await supabase
    .from('registros_entrenamiento')
    .update({ rutina_id: null })
    .eq('rutina_id', id);

  if (errUpdate) {
    throw new Error(`Error desvinculando registros del día: ${errUpdate.message} (Código: ${errUpdate.code})`);
  }

  // 3. Borrar ejercicios_rutina (ON DELETE CASCADE lo hace automáticamente si el script SQL se corrió)
  const { error: errDelEjs } = await supabase
    .from('ejercicios_rutina')
    .delete()
    .eq('rutina_id', id);

  if (errDelEjs) {
    throw new Error(`Error eliminando ejercicios de rutina: ${errDelEjs.message} (Código: ${errDelEjs.code})`);
  }

  // 4. Borrar la rutina — con RETURNING verifica que realmente se eliminó
  const { data: eliminada, error } = await supabase
    .from('rutinas')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo eliminar la rutina de Supabase: ${error.message} (Código: ${error.code})`
    );
  }

  if (!eliminada) {
    throw new Error(
      `La rutina no fue eliminada. Verifica los permisos RLS y GRANT en Supabase (id: ${id})`
    );
  }

  // 5. Limpiar caché local
  const cache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal('rutinas', cache.filter((r) => r.id !== id));
  emitirCambioDatos();
}


export async function duplicarRutina(rutina: Rutina, nuevoPlanId?: string | null): Promise<Rutina | null> {
  const targetPlanId = nuevoPlanId !== undefined ? nuevoPlanId : rutina.plan_id;
  const nuevosEjercicios: EjercicioNuevo[] = (rutina.ejercicios_rutina || []).map((e) => {
    const nombreBase = e.nombre.replace(/\s*\(.*\)$/, '').trim();
    return {
      nombre: nombreBase || e.nombre,
      series: e.series,
      repeticiones: e.repeticiones,
      peso: e.peso,
    };
  });
  return crearRutina(`${rutina.nombre} (Copia)`, nuevosEjercicios, targetPlanId, rutina.dia_sugerido);
}

/**
 * Sincroniza de manera automática e instantánea cualquier cambio de ejercicios u orden
 * de una rutina con:
 * 1. Todos los registros programados incompletos de esa rutina en el calendario (ejercicios_registro).
 * 2. Cualquier borrador de sesión activa en curso (ejerciciosState), preservando las series completadas.
 * 3. Los cachés locales de registros de entrenamiento en AsyncStorage.
 * 4. Notifica a toda la aplicación para recarga inmediata en 0 ms.
 */
export async function sincronizarRutinaConRegistrosYActiva(
  rutinaId: string,
  nuevoNombre: string,
  nuevosEjercicios: EjercicioNuevo[]
): Promise<void> {
  try {
    const usuarioId = await getUsuarioId();

    // 1. En Supabase: buscar registros no completados que usen esta rutina
    let regsIncompletos: { id: string; fecha: string; rutina_id: string | null }[] = [];
    if (!rutinaId.startsWith('local_')) {
      try {
        const { data, error } = await supabase
          .from('registros_entrenamiento')
          .select('id, fecha, rutina_id')
          .eq('rutina_id', rutinaId)
          .eq('completado', false);

        if (!error && data) {
          regsIncompletos = data;
        }

        for (const reg of regsIncompletos) {
          // Actualizar nombre de rutina en el registro si cambió
          await supabase
            .from('registros_entrenamiento')
            .update({ rutina_nombre: nuevoNombre })
            .eq('id', reg.id);

          // Eliminar ejercicios previos que no sean notas/observaciones (📌)
          await supabase
            .from('ejercicios_registro')
            .delete()
            .eq('registro_id', reg.id)
            .not('nombre', 'ilike', '📌%');

          // Insertar la nueva lista de ejercicios sincronizada
          if (nuevosEjercicios.length > 0) {
            const filasEjs = nuevosEjercicios.map((e) => {
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
            await supabase.from('ejercicios_registro').insert(filasEjs);
          }
        }
      } catch (err) {
        console.warn('Error sincronizando registros de Supabase:', err);
      }
    }

    // 2. En AsyncStorage: actualizar cachés de registros locales
    try {
      const sufijos = await listarSufijosLocales();
      const regCacheKeys = sufijos.filter(
        (k) => k.startsWith('cache_registros_') || k.startsWith('registros_')
      );

      for (const k of regCacheKeys) {
        const raw = await leerLocal(k);
        if (raw) {
          let modificado = false;
          const listaRegs = JSON.parse(raw) as Registro[];
          const nuevaLista = listaRegs.map((r) => {
            if (r.rutina_id === rutinaId && !r.completado) {
              modificado = true;
              const obs = (r.ejercicios_registro || []).filter((e) => e.nombre.startsWith('📌'));
              const nuevosEjsMapeados = nuevosEjercicios.map((ne, idx) => ({
                id: `${r.id}_ej_${idx}_${Date.now()}`,
                registro_id: r.id,
                nombre: ne.nombre,
                series: ne.series,
                repeticiones: ne.repeticiones,
                peso: ne.peso,
                completado: false,
              }));
              return {
                ...r,
                rutina_nombre: nuevoNombre,
                rutinas: r.rutinas ? { ...r.rutinas, nombre: nuevoNombre } : { nombre: nuevoNombre },
                ejercicios_registro: [...nuevosEjsMapeados, ...obs],
              };
            }
            return r;
          });

          if (modificado) {
            await escribirLocal(k, JSON.stringify(nuevaLista));
          }
        }
      }
    } catch (err) {
      console.warn('Error sincronizando caché local de registros:', err);
    }

    // 3. En AsyncStorage: Sincronizar borradores de sesión en curso (rutinia_sesion_borrador_*)
    try {
      const sufijos = await listarSufijosLocales();
      const borradorKeys = sufijos.filter((k) => k.startsWith('sesion_borrador_'));

      for (const bKey of borradorKeys) {
        const rawB = await leerLocal(bKey);
        if (rawB) {
          const borrador = JSON.parse(rawB) as BorradorSesion;
          const regCoincide =
            regsIncompletos.some((r) => r.id === borrador.registroId) ||
            borrador.nombreRutina === nuevoNombre;

          if (regCoincide) {
            const prevEjStates = borrador.ejerciciosState || [];

            const nuevosStates: EjercicioStateDraft[] = nuevosEjercicios.map((ne, idx) => {
              const parsedNuevo = parsearEjercicioInfo(ne);
              const cleanNuevo = (parsedNuevo.nombreLimpio || ne.nombre).toLowerCase();

              // Buscar si ya existía en el borrador por nombre limpio para preservar series completadas
              const existente = prevEjStates.find(
                (pe) =>
                  (parsearEjercicioInfo({ nombre: pe.nombre }).nombreLimpio || pe.nombre).toLowerCase() ===
                  cleanNuevo
              );

              if (existente) {
                return {
                  ...existente,
                  nombre: parsedNuevo.nombreLimpio || ne.nombre,
                  esUnilateral: parsedNuevo.esUnilateral,
                };
              }

              // Ejercicio nuevo o intercambiado: construir series respetando el nuevo plan
              const numSeries = ne.series || parsedNuevo.detallesSets.length || 1;
              const seriesDraft: SerieEjecucionDraft[] = Array.from({ length: numSeries }, (_, sIdx) => {
                const sDetail = parsedNuevo.detallesSets[sIdx];
                return {
                  id: `${Date.now()}_${idx}_${sIdx}`,
                  peso: sDetail?.pesoD || (ne.peso ? ne.peso.toString() : ''),
                  reps: sDetail?.repsD || (ne.repeticiones ? ne.repeticiones.toString() : ''),
                  pesoI: sDetail?.pesoI || '',
                  repsI: sDetail?.repsI || '',
                  rir: sDetail?.rir || '',
                  nota: sDetail?.nota || '',
                  completado: false,
                  repsParciales: sDetail?.repsParciales || 0,
                  tieneParciales: Boolean(sDetail?.repsParciales && sDetail.repsParciales > 0),
                  esDropset: Boolean(sDetail?.esDropset),
                  drops: [],
                };
              });

              return {
                id: `draft_${Date.now()}_${idx}`,
                nombre: parsedNuevo.nombreLimpio || ne.nombre,
                esUnilateral: parsedNuevo.esUnilateral,
                series: seriesDraft,
              };
            });

            borrador.nombreRutina = nuevoNombre;
            borrador.ejerciciosState = nuevosStates;
            borrador.updatedAt = Date.now();
            await escribirLocal(bKey, JSON.stringify(borrador));
          }
        }
      }
    } catch (err) {
      console.warn('Error sincronizando borradores de sesión:', err);
    }

    // 4. Emisión reactiva para actualizar Home, Calendario y Modal de Entrenamiento al instante
    await emitirCambioSesionActiva();
    emitirCambioDatos();
  } catch (err) {
    console.warn('Error global en sincronizarRutinaConRegistrosYActiva:', err);
  }
}

export async function actualizarRutina(
  rutinaId: string,
  nombre: string,
  ejercicios: EjercicioNuevo[],
  planId?: string | null,
  diaSugerido?: number | null
): Promise<void> {
  // IDs locales (modo offline) → solo actualizar caché
  if (rutinaId.startsWith('local_')) {
    const existentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal(
      'rutinas',
      existentes.map((r) =>
        r.id === rutinaId
          ? {
              ...r,
              nombre,
              plan_id: planId !== undefined ? planId : r.plan_id,
              dia_sugerido: diaSugerido !== undefined ? diaSugerido : r.dia_sugerido,
              ejercicios_rutina: ejercicios.map((e, i) => ({
                id: `${rutinaId}_${i}`,
                rutina_id: rutinaId,
                nombre: e.nombre,
                series: e.series,
                repeticiones: e.repeticiones,
                peso: e.peso,
                orden: i,
              })),
            }
          : r
      )
    );
    await sincronizarRutinaConRegistrosYActiva(rutinaId, nombre, ejercicios);
    return;
  }

  const usuarioId = await getUsuarioId();

  // 1. Actualizar datos de rutina
  const updateData: any = { nombre };
  if (planId !== undefined) updateData.plan_id = planId;
  if (diaSugerido !== undefined) updateData.dia_sugerido = diaSugerido;

  const { error: errNombre } = await supabase
    .from('rutinas')
    .update(updateData)
    .eq('id', rutinaId);
  if (errNombre) throw new Error(`Error actualizando rutina: ${errNombre.message}`);


  // 2. Borrar ejercicios anteriores
  const { error: errDel } = await supabase
    .from('ejercicios_rutina')
    .delete()
    .eq('rutina_id', rutinaId);
  if (errDel) throw new Error(`Error eliminando ejercicios anteriores: ${errDel.message}`);

  // 3. Insertar nuevos ejercicios
  if (ejercicios.length > 0) {
    const filas = ejercicios.map((e, i) => {
      const fila: any = {
        ...e,
        rutina_id: rutinaId,
        orden: i,
      };
      if (usuarioId) fila.usuario_id = usuarioId;
      return fila;
    });

    const { error: errIns } = await supabase.from('ejercicios_rutina').insert(filas);
    if (errIns) throw new Error(`Error insertando ejercicios: ${errIns.message}`);
  }

  // 4. Actualizar caché local
  const existentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal(
    'rutinas',
    existentes.map((r) =>
      r.id === rutinaId
        ? {
            ...r,
            nombre,
            ejercicios_rutina: ejercicios.map((e, i) => ({
              id: `${rutinaId}_${i}`,
              rutina_id: rutinaId,
              nombre: e.nombre,
              series: e.series,
              repeticiones: e.repeticiones,
              peso: e.peso,
              orden: i,
            })),
          }
        : r
    )
  );

  // 5. Sincronizar automáticamente con registros programados hoy/incompletos y partidas en curso
  await sincronizarRutinaConRegistrosYActiva(rutinaId, nombre, ejercicios);
}

/** Opciones para reemplazar un ejercicio dentro de una rutina. */
export type OpcionesReemplazoRutina = {
  herencia?: HerenciaEjercicioRutina;
  /**
   * Nombre que tenía el ejercicio en la rutina antes de una sustitución
   * previa. Solo se usa cuando el nombre principal no existe en la rutina,
   * para que un cambio temporal seguido de uno permanente no se pierda.
   */
  nombreRespaldo?: string;
};

/**
 * Devuelve el nombre normalizado que existe en la lista, priorizando el
 * nombre principal sobre el de respaldo.
 */
function elegirNombreExistente(
  existentes: string[],
  principal: string,
  respaldo?: string
): string | null {
  const normalizados = existentes.map(normalizarNombreEjercicio);
  const principalNorm = normalizarNombreEjercicio(principal);
  if (normalizados.includes(principalNorm)) return principalNorm;

  if (respaldo) {
    const respaldoNorm = normalizarNombreEjercicio(respaldo);
    if (normalizados.includes(respaldoNorm)) return respaldoNorm;
  }

  return null;
}

export async function reemplazarEjercicioEnRutina(
  rutinaId: string,
  nombreOriginal: string,
  nombreNuevo: string,
  opciones?: OpcionesReemplazoRutina
): Promise<void> {
  const nombreNuevoFinal = nombreNuevo.trim();
  const { herencia, nombreRespaldo } = opciones ?? {};
  const camposHerencia = herencia
    ? {
        series: herencia.series,
        repeticiones: herencia.repeticiones,
        peso: herencia.peso,
      }
    : {};

  if (!rutinaId.startsWith('local_')) {
    const { data: ejs, error } = await supabase
      .from('ejercicios_rutina')
      .select('*')
      .eq('rutina_id', rutinaId);

    if (error) throw error;

    const objetivo = elegirNombreExistente(
      (ejs || []).map((ej) => ej.nombre),
      nombreOriginal,
      nombreRespaldo
    );

    if (objetivo) {
      for (const ej of ejs || []) {
        if (normalizarNombreEjercicio(ej.nombre) === objetivo) {
          const { error: errUpdate } = await supabase
            .from('ejercicios_rutina')
            .update({ nombre: nombreNuevoFinal, ...camposHerencia })
            .eq('id', ej.id);
          if (errUpdate) throw errUpdate;
        }
      }
    }
  }

  const existentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal(
    'rutinas',
    existentes.map((r) => {
      if (r.id !== rutinaId) return r;

      const objetivo = elegirNombreExistente(
        r.ejercicios_rutina.map((e) => e.nombre),
        nombreOriginal,
        nombreRespaldo
      );
      if (!objetivo) return r;

      return {
        ...r,
        ejercicios_rutina: r.ejercicios_rutina.map((e) => {
          if (normalizarNombreEjercicio(e.nombre) === objetivo) {
            return { ...e, nombre: nombreNuevoFinal, ...camposHerencia };
          }
          return e;
        }),
      };
    })
  );

  // Sincronizar registros incompletos y borradores de sesión activos
  try {
    if (!rutinaId.startsWith('local_')) {
      const { data: regs } = await supabase
        .from('registros_entrenamiento')
        .select('id')
        .eq('rutina_id', rutinaId)
        .eq('completado', false);

      for (const r of regs || []) {
        const { data: ejsReg } = await supabase
          .from('ejercicios_registro')
          .select('*')
          .eq('registro_id', r.id);

        const objetivo = elegirNombreExistente(
          (ejsReg || []).map((er) => er.nombre),
          nombreOriginal,
          nombreRespaldo
        );
        if (!objetivo) continue;

        for (const er of ejsReg || []) {
          if (normalizarNombreEjercicio(er.nombre) === objetivo) {
            await supabase
              .from('ejercicios_registro')
              .update({ nombre: nombreNuevoFinal, ...camposHerencia })
              .eq('id', er.id);
          }
        }
      }
    }

    // Actualizar borradores activos de la cuenta actual
    const sufijos = await listarSufijosLocales();
    const bKeys = sufijos.filter((k) => k.startsWith('sesion_borrador_'));
    for (const bk of bKeys) {
      const raw = await leerLocal(bk);
      if (raw) {
        const b = JSON.parse(raw) as BorradorSesion;
        const objetivo = elegirNombreExistente(
          (b.ejerciciosState || []).map((es) => es.nombre),
          nombreOriginal,
          nombreRespaldo
        );
        if (!objetivo) continue;

        let cambiado = false;
        const nextStates = (b.ejerciciosState || []).map((es) => {
          if (normalizarNombreEjercicio(es.nombre) === objetivo) {
            cambiado = true;
            return { ...es, nombre: nombreNuevoFinal };
          }
          return es;
        });
        if (cambiado) {
          b.ejerciciosState = nextStates;
          b.updatedAt = Date.now();
          await escribirLocal(bk, JSON.stringify(b));
        }
      }
    }

    await emitirCambioSesionActiva();
    emitirCambioDatos();
  } catch (err) {
    console.warn('Error sincronizando reemplazo de ejercicio:', err);
  }
}


