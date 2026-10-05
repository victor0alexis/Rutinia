import { supabase } from '../lib/supabase';
import { Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

export type EjercicioNuevo = {
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
};

/**
 * Obtiene el usuario_id del usuario autenticado actualmente.
 * Lanza error si no hay sesión activa.
 */
async function getUsuarioId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
  }
  return user.id;
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

    await guardarCacheLocal('rutinas', res);
    return res;
  } catch (err) {
    console.warn('Sin conexión a Supabase, cargando caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

export async function crearRutina(nombre: string, ejercicios: EjercicioNuevo[]): Promise<Rutina | null> {
  try {
    const usuarioId = await getUsuarioId();

    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert({ nombre, usuario_id: usuarioId })
      .select()
      .single();

    if (error) throw error;
    if (!rutina) throw new Error('No se recibió respuesta de Supabase.');

    let ejerciciosCreados: any[] = [];
    if (ejercicios.length > 0) {
      const filas = ejercicios.map((e, i) => ({
        ...e,
        rutina_id: rutina.id,
        usuario_id: usuarioId,
        orden: i,
      }));
      const { data: ejsData, error: ejsError } = await supabase
        .from('ejercicios_rutina')
        .insert(filas)
        .select();
      if (ejsError) throw ejsError;
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
    console.warn('Error creando rutina en Supabase:', err?.message ?? err);

    // Fallback offline con prefijo local_ para distinguirlos de UUIDs reales
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

  // 1. Eliminar ejercicios hijos (ignorar error si ya fue en cascade)
  await supabase.from('ejercicios_rutina').delete().eq('rutina_id', id);

  // 2. Desvincular registros sin eliminarlos (preserva historial)
  await supabase
    .from('registros_entrenamiento')
    .update({ rutina_id: null })
    .eq('rutina_id', id);

  // 3. Eliminar la rutina principal
  const { error: errDel } = await supabase.from('rutinas').delete().eq('id', id);
  if (errDel) {
    throw new Error(`Error al eliminar la rutina: ${errDel.message}`);
  }

  // 4. Verificar que la fila desapareció (detecta bloqueo RLS silencioso)
  const { data: aun_existe } = await supabase
    .from('rutinas')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (aun_existe) {
    throw new Error(
      'La rutina no se pudo eliminar. Esto puede ser un problema de permisos (RLS) en Supabase. ' +
      'Asegúrate de que el usuario tenga permiso de DELETE sobre su propia rutina.'
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
    const filas = ejercicios.map((e, i) => ({
      ...e,
      rutina_id: rutinaId,
      usuario_id: usuarioId,
      orden: i,
    }));
    const { error: errIns } = await supabase.from('ejercicios_rutina').insert(filas);
    if (errIns) throw new Error(`Error insertando ejercicios: ${errIns.message}`);
  }

  // 4. Actualizar caché
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
