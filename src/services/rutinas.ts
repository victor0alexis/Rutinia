import { supabase } from '../lib/supabase';
import { Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

export type EjercicioNuevo = {
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
};

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
async function getUsuarioId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function listarRutinas(): Promise<Rutina[]> {
  try {
    const { data, error } = await supabase
      .from('rutinas')
      .select('*, ejercicios_rutina(*)')
      .order('creado_en', { ascending: false });

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

export async function crearRutina(nombre: string, ejercicios: EjercicioNuevo[]): Promise<Rutina | null> {
  try {
    const usuarioId = await getUsuarioId();

    const insertData: any = { nombre };
    if (usuarioId) insertData.usuario_id = usuarioId;

    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert(insertData)
      .select()
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
}


export async function duplicarRutina(rutina: Rutina): Promise<Rutina | null> {
  const nuevosEjercicios: EjercicioNuevo[] = (rutina.ejercicios_rutina || []).map((e) => {
    const nombreBase = e.nombre.replace(/\s*\(.*\)$/, '').trim();
    return {
      nombre: nombreBase || e.nombre,
      series: e.series,
      repeticiones: e.repeticiones,
      peso: e.peso,
    };
  });
  return crearRutina(`${rutina.nombre} (Copia)`, nuevosEjercicios);
}

export async function actualizarRutina(rutinaId: string, nombre: string, ejercicios: EjercicioNuevo[]): Promise<void> {
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
    return;
  }

  const usuarioId = await getUsuarioId();

  // 1. Actualizar nombre
  const { error: errNombre } = await supabase
    .from('rutinas')
    .update({ nombre })
    .eq('id', rutinaId);
  if (errNombre) throw new Error(`Error actualizando nombre: ${errNombre.message}`);

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
}
