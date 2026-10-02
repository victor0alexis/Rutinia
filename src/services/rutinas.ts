import { supabase } from '../lib/supabase';
import { Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

export type EjercicioNuevo = {
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
};

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

    // Solo guardar en caché si hay datos reales; la lista vacía es un resultado válido
    await guardarCacheLocal('rutinas', res);
    return res;
  } catch (err) {
    console.warn('Sin conexión a Supabase, intentando cargar caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

const DEFAULT_USUARIO_ID = '65b515cd-790c-46da-b933-5a86bad00263';

export async function crearRutina(nombre: string, ejercicios: EjercicioNuevo[]) {
  const rutinaId = Date.now().toString();
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

  try {
    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert({ nombre, usuario_id: DEFAULT_USUARIO_ID })
      .select()
      .single();
    if (!error && rutina) {
      if (ejercicios.length) {
        const filas = ejercicios.map((e, i) => ({ ...e, rutina_id: rutina.id, usuario_id: DEFAULT_USUARIO_ID, orden: i }));
        await supabase.from('ejercicios_rutina').insert(filas);
      }
    }
  } catch (err) {
    console.warn('Supabase offline o RLS activo, guardando localmente');
  }

  // Guardar siempre en el caché local para disponibilidad inmediata
  const rutinasExistentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal('rutinas', [nuevaRutinaLocal, ...rutinasExistentes]);
}

export async function eliminarRutina(id: string) {
  // 1. Eliminar primero los ejercicios pertenecientes a la rutina para evitar errores FK
  try {
    await supabase.from('ejercicios_rutina').delete().eq('rutina_id', id);
  } catch (err) {
    console.warn('Advertencia al borrar ejercicios_rutina:', err);
  }

  // 2. Desvincular o limpiar registros de rutina si existen
  try {
    await supabase.from('registros_rutina').delete().eq('rutina_id', id);
  } catch (err) {
    console.warn('Advertencia al desvincular registros_rutina:', err);
  }

  // 3. Eliminar la rutina principal
  const { error } = await supabase.from('rutinas').delete().eq('id', id);
  if (error) throw error;

  // 4. Actualizar el caché local
  const rutinasCache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal('rutinas', rutinasCache.filter((r) => r.id !== id));
}

export async function duplicarRutina(rutina: Rutina) {
  const nuevosEjercicios: EjercicioNuevo[] = (rutina.ejercicios_rutina || []).map((e) => {
    // Extraer el nombre base del ejercicio eliminando resumen de series previo si lo tiene
    const nombreBase = e.nombre.replace(/\s*\(.*\)$/, '').trim();
    return {
      nombre: nombreBase || e.nombre,
      series: e.series,
      repeticiones: e.repeticiones,
      peso: e.peso,
    };
  });

  await crearRutina(`${rutina.nombre} (Copia)`, nuevosEjercicios);
}

// Actualizar nombre y ejercicios de una rutina existente sin eliminarla,
// preservando así las vinculaciones en registros_entrenamiento
export async function actualizarRutina(rutinaId: string, nombre: string, ejercicios: EjercicioNuevo[]) {
  try {
    // 1. Actualizar el nombre de la rutina
    const { error: errNombre } = await supabase
      .from('rutinas')
      .update({ nombre })
      .eq('id', rutinaId);
    if (errNombre) throw errNombre;

    // 2. Eliminar todos los ejercicios viejos
    const { error: errDel } = await supabase
      .from('ejercicios_rutina')
      .delete()
      .eq('rutina_id', rutinaId);
    if (errDel) throw errDel;

    // 3. Insertar los nuevos ejercicios
    if (ejercicios.length > 0) {
      const filas = ejercicios.map((e, i) => ({
        ...e,
        rutina_id: rutinaId,
        usuario_id: DEFAULT_USUARIO_ID,
        orden: i,
      }));
      const { error: errIns } = await supabase.from('ejercicios_rutina').insert(filas);
      if (errIns) throw errIns;
    }
  } catch (err) {
    console.warn('Error actualizando rutina en Supabase:', err);
    throw err;
  }

  // Actualizar también el caché local
  const rutinasExistentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  const actualizadas = rutinasExistentes.map((r) =>
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
  );
  await guardarCacheLocal('rutinas', actualizadas);
}
