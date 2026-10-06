import { supabase } from '../lib/supabase';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

export type CategoriaNota = 'Nutrición' | 'Entrenamiento' | 'Suplementos' | 'Recuperación' | 'General';

export type NotaEstandar = {
  id: string;
  titulo: string;
  categoria: CategoriaNota;
  contenido: string;
  fechaCreacion: string;
  usuario_id?: string | null;
};

const STORAGE_KEY = 'notas';

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
async function getUsuarioId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Notas por defecto iniciales
const NOTAS_POR_DEFECTO: NotaEstandar[] = [
  {
    id: 'def_1',
    titulo: 'Protocolo de Suplementación',
    categoria: 'Suplementos',
    contenido: '• Creatina: 5g pre-entreno\n• Proteína Whey: 30g post-entreno\n• Multivitamínico: 1 cápsula con desayuno',
    fechaCreacion: new Date().toISOString(),
  },
  {
    id: 'def_2',
    titulo: 'Check-in de Peso y Medidas',
    categoria: 'Nutrición',
    contenido: '• Peso en ayunas: -- kg\n• Calorías objetivo: 2500 kcal\n• Agua consumida: 3.5 Litros',
    fechaCreacion: new Date().toISOString(),
  },
];

export async function obtenerNotasEstandar(): Promise<NotaEstandar[]> {
  try {
    const { data, error } = await supabase
      .from('notas')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error) throw error;

    const notasDb: NotaEstandar[] = (data ?? []).map((n: any) => ({
      id: n.id,
      titulo: n.titulo,
      categoria: n.categoria as CategoriaNota,
      contenido: n.contenido,
      fechaCreacion: n.creado_en || new Date().toISOString(),
      usuario_id: n.usuario_id,
    }));

    // Preservar cualquier nota local creada offline o guardada previamente en AsyncStorage
    const cacheLocal = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];

    // Migración transparente: si hay notas en el almacenamiento local que aún no están en la BD de Supabase, subirlas a Supabase
    if (cacheLocal.length > 0) {
      const usuarioId = await getUsuarioId();
      const idsDb = new Set(notasDb.map((n) => n.id));

      for (const notaLocal of cacheLocal) {
        // Si la nota local no está en la BD y no es de las por defecto no modificadas
        if (!idsDb.has(notaLocal.id) && !notaLocal.id.startsWith('def_')) {
          try {
            const insertData: any = {
              titulo: notaLocal.titulo,
              categoria: notaLocal.categoria,
              contenido: notaLocal.contenido,
            };
            if (usuarioId) insertData.usuario_id = usuarioId;

            const { data: nuevaNota } = await supabase
              .from('notas')
              .insert(insertData)
              .select()
              .single();

            if (nuevaNota) {
              notasDb.push({
                id: nuevaNota.id,
                titulo: nuevaNota.titulo,
                categoria: nuevaNota.categoria as CategoriaNota,
                contenido: nuevaNota.contenido,
                fechaCreacion: nuevaNota.creado_en,
                usuario_id: nuevaNota.usuario_id,
              });
              idsDb.add(nuevaNota.id);
            }
          } catch {
            // Si falla la migración individual, no romper el flujo
          }
        }
      }
    }

    // Combinar notas locales pendientes (IDs con prefijo local_) con las de la BD
    const notasLocalesOffline = cacheLocal.filter((n) => n.id.startsWith('local_'));
    const map = new Map<string, NotaEstandar>();
    [...notasLocalesOffline, ...notasDb].forEach((n) => map.set(n.id, n));

    let resultado = Array.from(map.values());

    // Si la BD y el caché están completamente vacíos, inicializar con las notas por defecto
    if (resultado.length === 0) {
      resultado = NOTAS_POR_DEFECTO;
    }

    await guardarCacheLocal(STORAGE_KEY, resultado);
    return resultado;
  } catch (err) {
    console.warn('Sin conexión a Supabase para notas, cargando caché local:', err);
    const cache = await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY);
    return cache && cache.length > 0 ? cache : NOTAS_POR_DEFECTO;
  }
}

export async function guardarNotaEstandar(
  nota: Omit<NotaEstandar, 'id' | 'fechaCreacion'> & { id?: string }
): Promise<void> {
  const usuarioId = await getUsuarioId();

  // Caso 1: Actualizar nota existente que ya tiene ID real en la BD
  if (nota.id && !nota.id.startsWith('local_') && !nota.id.startsWith('def_')) {
    const { error } = await supabase
      .from('notas')
      .update({
        titulo: nota.titulo,
        categoria: nota.categoria,
        contenido: nota.contenido,
      })
      .eq('id', nota.id);

    if (error) {
      throw new Error(`Error actualizando nota en Supabase: ${error.message} (Código: ${error.code})`);
    }

    // Actualizar también el caché local
    const existentes = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];
    const actualizadas = existentes.map((n) =>
      n.id === nota.id
        ? {
            ...n,
            titulo: nota.titulo,
            categoria: nota.categoria,
            contenido: nota.contenido,
          }
        : n
    );
    await guardarCacheLocal(STORAGE_KEY, actualizadas);
    return;
  }

  // Caso 2: Crear nueva nota en la BD (o guardar edición de nota local/defecto como nueva en la BD)
  const insertData: any = {
    titulo: nota.titulo,
    categoria: nota.categoria,
    contenido: nota.contenido,
  };
  if (usuarioId) insertData.usuario_id = usuarioId;

  try {
    const { data: nuevaDb, error } = await supabase
      .from('notas')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando nota en Supabase: ${error.message} (Código: ${error.code})`);
    }

    if (nuevaDb) {
      const nuevaNotaObj: NotaEstandar = {
        id: nuevaDb.id,
        titulo: nuevaDb.titulo,
        categoria: nuevaDb.categoria as CategoriaNota,
        contenido: nuevaDb.contenido,
        fechaCreacion: nuevaDb.creado_en || new Date().toISOString(),
        usuario_id: nuevaDb.usuario_id,
      };

      const existentes = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];
      const filtradas = nota.id ? existentes.filter((n) => n.id !== nota.id) : existentes;
      await guardarCacheLocal(STORAGE_KEY, [nuevaNotaObj, ...filtradas]);
    }
  } catch (err: any) {
    console.warn('Fallback offline creando nota:', err?.message ?? err);
    // Fallback si no hay conexión
    const localId = `local_${Date.now()}`;
    const nuevaNotaLocal: NotaEstandar = {
      id: localId,
      titulo: nota.titulo,
      categoria: nota.categoria,
      contenido: nota.contenido,
      fechaCreacion: new Date().toISOString(),
    };
    const existentes = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];
    await guardarCacheLocal(STORAGE_KEY, [nuevaNotaLocal, ...existentes]);
  }
}

export async function eliminarNotaEstandar(id: string): Promise<void> {
  // IDs locales o por defecto -> solo limpiar caché local
  if (id.startsWith('local_') || id.startsWith('def_')) {
    const cache = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];
    await guardarCacheLocal(STORAGE_KEY, cache.filter((n) => n.id !== id));
    return;
  }

  // Eliminar de Supabase BD con confirmación RETURNING
  const { data: eliminada, error } = await supabase
    .from('notas')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo eliminar la nota de Supabase: ${error.message} (Código: ${error.code})`);
  }

  if (!eliminada) {
    console.warn(`La nota con ID ${id} no existía en Supabase o ya fue eliminada.`);
  }

  // Limpiar del caché local
  const cache = (await obtenerCacheLocal<NotaEstandar[]>(STORAGE_KEY)) || [];
  await guardarCacheLocal(STORAGE_KEY, cache.filter((n) => n.id !== id));
}
