import { supabase } from '../lib/supabase';
import { EjercicioCatalogo } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

async function getUsuarioId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

const CACHE_CATALOGO_KEY = 'rutinia_ejercicios_catalogo';

export async function listarEjerciciosCatalogo(): Promise<EjercicioCatalogo[]> {
  try {
    const { data, error } = await supabase
      .from('ejercicios_catalogo')
      .select('*')
      .order('nombre', { ascending: true });

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
