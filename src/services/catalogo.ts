import { supabase } from '../biblioteca/supabase';
import { EjercicioCatalogo } from '../tipos';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';
import { obtenerUsuarioIdActual } from '../utils/usuario';

const getUsuarioId = obtenerUsuarioIdActual;

const CACHE_CATALOGO_KEY = 'ejercicios_catalogo';

export async function listarEjerciciosCatalogo(): Promise<EjercicioCatalogo[]> {
  try {
    const usuarioId = await getUsuarioId();
    // El catálogo base es global (`usuario_id = null`); cada cuenta añade sus
    // propios ejercicios personalizados.
    const query = usuarioId
      ? supabase
          .from('ejercicios_catalogo')
          .select('*')
          .or(`usuario_id.is.null,usuario_id.eq.${usuarioId}`)
      : supabase.from('ejercicios_catalogo').select('*').is('usuario_id', null);

    const { data, error } = await query.order('nombre', { ascending: true });

    if (error) throw error;
    const catalogo = (data || []) as EjercicioCatalogo[];
    await guardarCacheLocal(CACHE_CATALOGO_KEY, catalogo);
    return catalogo;
  } catch (err) {
    console.warn('Error obteniendo catálogo de Supabase, usando local:', err);
    const cache = await obtenerCacheLocal<EjercicioCatalogo[]>(CACHE_CATALOGO_KEY);
    return cache || [];
  }
}

export async function crearEjercicioCatalogo(
  nombre: string,
  grupoMuscular?: string | null,
  equipo?: string | null
): Promise<EjercicioCatalogo> {
  const usuarioId = await getUsuarioId();
  const insertData: any = {
    nombre: nombre.trim(),
    grupo_muscular: grupoMuscular?.trim() || null,
    equipo: equipo?.trim() || null,
  };
  if (usuarioId) insertData.usuario_id = usuarioId;

  const { data, error } = await supabase
    .from('ejercicios_catalogo')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al registrar ejercicio en el catálogo: ${error.message}`);
  }

  // Actualizar caché
  const cache = (await obtenerCacheLocal<EjercicioCatalogo[]>(CACHE_CATALOGO_KEY)) || [];
  const nuevo = data as EjercicioCatalogo;
  await guardarCacheLocal(CACHE_CATALOGO_KEY, [...cache, nuevo]);

  return nuevo;
}
