import { supabase } from '../lib/supabase';
import { Registro, Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

export async function registrosDeRango(desde: string, hasta: string): Promise<Registro[]> {
  try {
    const { data, error } = await supabase
      .from('registros_entrenamiento')
      .select('*, rutinas(nombre), ejercicios_registro(*)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('creado_en');

    if (error) throw error;
    const res = (data ?? []) as Registro[];

    // Guardar en caché local
    await guardarCacheLocal(`registros_${desde}_${hasta}`, res);
    return res;
  } catch (err) {
    console.warn('Sin conexión, cargando registros locales...');
    const cache = await obtenerCacheLocal<Registro[]>(`registros_${desde}_${hasta}`);
    return cache || [];
  }
}

const DEFAULT_USUARIO_ID = '65b515cd-790c-46da-b933-5a86bad00263';

// Copia los ejercicios de la rutina a cada fecha elegida
export async function agregarRutinaAFechas(rutina: Rutina, fechas: string[]) {
  for (const fecha of fechas) {
    const { data: reg, error } = await supabase
      .from('registros_entrenamiento')
      .insert({ fecha, rutina_id: rutina.id, usuario_id: DEFAULT_USUARIO_ID })
      .select()
      .single();
    if (error) throw error;
    const filas = rutina.ejercicios_rutina.map((e) => ({
      registro_id: reg.id,
      usuario_id: DEFAULT_USUARIO_ID,
      nombre: e.nombre,
      series: e.series,
      repeticiones: e.repeticiones,
      peso: e.peso,
    }));
    if (filas.length) {
      const { error: e2 } = await supabase.from('ejercicios_registro').insert(filas);
      if (e2) throw e2;
    }
  }
}

// Desvincula/elimina un registro completo de rutina o actividad del día
export async function eliminarRegistroRutina(registroId: string) {
  const { error } = await supabase.from('registros_entrenamiento').delete().eq('id', registroId);
  if (error) throw error;
}

// Actividad suelta
export async function agregarActividad(
  fecha: string,
  nombre: string,
  series: number | null,
  repeticiones: number | null,
  peso: number | null = null
) {
  const { data: existente } = await supabase
    .from('registros_entrenamiento')
    .select('id')
    .eq('fecha', fecha)
    .is('rutina_id', null)
    .limit(1)
    .maybeSingle();

  let registroId = existente?.id as string | undefined;
  if (!registroId) {
    const { data, error } = await supabase
      .from('registros_entrenamiento')
      .insert({ fecha, usuario_id: DEFAULT_USUARIO_ID })
      .select()
      .single();
    if (error) throw error;
    registroId = data.id;
  }
  const { error } = await supabase
    .from('ejercicios_registro')
    .insert({ registro_id: registroId, usuario_id: DEFAULT_USUARIO_ID, nombre, series, repeticiones, peso });
  if (error) throw error;
}

// Guardar nota del día en la tabla existente ejercicios_registro marcándola con [NOTA]
export async function guardarNotaDelDia(fecha: string, textoNota: string) {
  await agregarActividad(fecha, `📌 ${textoNota}`, null, null, null);
}

export async function alternarEjercicio(id: string, completado: boolean) {
  const { error } = await supabase.from('ejercicios_registro').update({ completado }).eq('id', id);
  if (error) throw error;
}

export async function actualizarEjecucionEjercicio(
  id: string,
  datos: { nombre?: string; series?: number | null; repeticiones?: number | null; peso?: number | null; completado?: boolean }
) {
  const { error } = await supabase.from('ejercicios_registro').update(datos).eq('id', id);
  if (error) throw error;
}

export async function actualizarEstadoRegistro(
  registroId: string,
  datos: { completado?: boolean; notas?: string | null },
  fecha?: string
) {
  // Solo actualizar 'completado' en registros_entrenamiento (evita error de columna inexistente 'notas')
  if (datos.completado !== undefined) {
    const { error } = await supabase
      .from('registros_entrenamiento')
      .update({ completado: datos.completado })
      .eq('id', registroId);
    if (error) throw error;
  }

  // Si se ingresaron observaciones del día, guardarlas como nota en ejercicios_registro
  if (datos.notas && datos.notas.trim()) {
    const { error: errorNota } = await supabase.from('ejercicios_registro').insert({
      registro_id: registroId,
      nombre: `📌 [OBSERVACIONES] ${datos.notas.trim()}`,
      series: null,
      repeticiones: null,
      peso: null,
    });
    if (errorNota) throw errorNota;
  }
}

export async function eliminarEjercicio(id: string) {
  const { error } = await supabase.from('ejercicios_registro').delete().eq('id', id);
  if (error) throw error;
}

