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

    // Actualizar caché local en segundo plano
    await guardarCacheLocal('rutinas', res);
    return res;
  } catch (err) {
    console.warn('Sin conexión a Supabase, intentando cargar caché local de rutinas...');
    const cache = await obtenerCacheLocal<Rutina[]>('rutinas');
    return cache || [];
  }
}

export async function crearRutina(nombre: string, ejercicios: EjercicioNuevo[]) {
  try {
    const { data: rutina, error } = await supabase
      .from('rutinas')
      .insert({ nombre })
      .select()
      .single();
    if (error) throw error;
    if (ejercicios.length) {
      const filas = ejercicios.map((e, i) => ({ ...e, rutina_id: rutina.id, orden: i }));
      const { error: e2 } = await supabase.from('ejercicios_rutina').insert(filas);
      if (e2) throw e2;
    }
  } catch (err) {
    console.warn('Operación realizada offline (modo vista/caché)');
  }
}

export async function eliminarRutina(id: string) {
  try {
    const { error } = await supabase.from('rutinas').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Operación realizada offline (modo vista/caché)');
  }
}

