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

    // Guardar en caché solo si hay conexión y datos válidos
    await guardarCacheLocal('rutinas', res);
    return res;
  } catch (err) {
    console.warn('Sin conexión a Supabase, intentando cargar caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

const DEFAULT_USUARIO_ID = '65b515cd-790c-46da-b933-5a86bad00263';

export async function crearRutina(nombre: string, ejercicios: EjercicioNuevo[]): Promise<Rutina | null> {
  // Intentar crear en Supabase primero (fuente de verdad)
  try {
    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert({ nombre, usuario_id: DEFAULT_USUARIO_ID })
      .select()
      .single();

    if (error) throw error;
    if (!rutina) throw new Error('No se recibió la rutina de Supabase.');

    let ejerciciosCreados: any[] = [];
    if (ejercicios.length > 0) {
      const filas = ejercicios.map((e, i) => ({
        ...e,
        rutina_id: rutina.id,
        usuario_id: DEFAULT_USUARIO_ID,
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

    // Actualizar el caché local con el UUID real de Supabase
    const rutinasExistentes = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', [rutinaCompleta, ...rutinasExistentes]);

    return rutinaCompleta;
  } catch (err) {
    console.warn('Error creando rutina en Supabase:', err);
    // Fallback offline: crear con ID temporal local
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
  // Si es un ID local temporal (offline), solo eliminar del caché
  if (id.startsWith('local_')) {
    const rutinasCache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
    await guardarCacheLocal('rutinas', rutinasCache.filter((r) => r.id !== id));
    return;
  }

  // 1. Eliminar primero los ejercicios pertenecientes a la rutina
  const { error: errEjs } = await supabase.from('ejercicios_rutina').delete().eq('rutina_id', id);
  if (errEjs) {
    console.warn('Advertencia al borrar ejercicios_rutina:', errEjs);
  }

  // 2. Desvincular registros_entrenamiento (nullificar rutina_id)
  const { error: errRegs } = await supabase
    .from('registros_entrenamiento')
    .update({ rutina_id: null })
    .eq('rutina_id', id);
  if (errRegs) {
    console.warn('Advertencia al desvincular registros_entrenamiento:', errRegs);
  }

  // 3. Eliminar la rutina principal
  const { error } = await supabase.from('rutinas').delete().eq('id', id);
  if (error) throw new Error(`No se pudo eliminar la rutina: ${error.message}`);

  // 4. Actualizar el caché local
  const rutinasCache = (await obtenerCacheLocal<Rutina[]>('rutinas')) || [];
  await guardarCacheLocal('rutinas', rutinasCache.filter((r) => r.id !== id));
}

export async function duplicarRutina(rutina: Rutina): Promise<Rutina | null> {
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

  return crearRutina(`${rutina.nombre} (Copia)`, nuevosEjercicios);
}

// Actualizar nombre y ejercicios de una rutina existente sin eliminarla,
// preservando así las vinculaciones en registros_entrenamiento
export async function actualizarRutina(rutinaId: string, nombre: string, ejercicios: EjercicioNuevo[]): Promise<void> {
  // Si es un ID local temporal, solo actualizar el caché
  if (rutinaId.startsWith('local_')) {
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
    return;
  }

  // 1. Actualizar el nombre de la rutina
  const { error: errNombre } = await supabase
    .from('rutinas')
    .update({ nombre })
    .eq('id', rutinaId);
  if (errNombre) throw new Error(`Error actualizando nombre: ${errNombre.message}`);

  // 2. Eliminar todos los ejercicios viejos
  const { error: errDel } = await supabase
    .from('ejercicios_rutina')
    .delete()
    .eq('rutina_id', rutinaId);
  if (errDel) throw new Error(`Error eliminando ejercicios anteriores: ${errDel.message}`);

  // 3. Insertar los nuevos ejercicios
  if (ejercicios.length > 0) {
    const filas = ejercicios.map((e, i) => ({
      ...e,
      rutina_id: rutinaId,
      usuario_id: DEFAULT_USUARIO_ID,
      orden: i,
    }));
    const { error: errIns } = await supabase.from('ejercicios_rutina').insert(filas);
    if (errIns) throw new Error(`Error insertando nuevos ejercicios: ${errIns.message}`);
  }

  // 4. Actualizar también el caché local
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
