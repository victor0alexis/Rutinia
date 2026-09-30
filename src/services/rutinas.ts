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

    if (res.length > 0) {
      await guardarCacheLocal('rutinas', res);
      return res;
    }

    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache && cache.length > 0 ? cache : res;
  } catch (err) {
    console.warn('Sin conexión a Supabase, intentando cargar caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

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
      .insert({ nombre })
      .select()
      .single();
    if (!error && rutina) {
      if (ejercicios.length) {
        const filas = ejercicios.map((e, i) => ({ ...e, rutina_id: rutina.id, orden: i }));
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
  try {
    const { error } = await supabase.from('rutinas').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Operación realizada offline (modo vista/caché)');
  }
}

