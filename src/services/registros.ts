import { supabase } from '../lib/supabase';
import { Registro, Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

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

export async function registrosDeRango(desde: string, hasta: string): Promise<Registro[]> {
  try {
    const { data, error } = await supabase
      .from('registros_entrenamiento')
      .select('*, rutinas(nombre), ejercicios_registro(*)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true });

    if (error) throw error;
    const res = (data ?? []) as Registro[];

    await guardarCacheLocal(`registros_${desde}_${hasta}`, res);
    return res;
  } catch (err) {
    console.warn('Sin conexión, cargando registros locales...');
    const cache = await obtenerCacheLocal<Registro[]>(`registros_${desde}_${hasta}`);
    return cache || [];
  }
}

// Copia los ejercicios de la rutina a cada fecha elegida
export async function agregarRutinaAFechas(rutina: Rutina, fechas: string[]) {
  const usuarioId = await getUsuarioId();
  const ejercicios = rutina.ejercicios_rutina || [];

  for (const fecha of fechas) {
    try {
      const { data: reg, error } = await supabase
        .from('registros_entrenamiento')
        .insert({ fecha, rutina_id: rutina.id, usuario_id: usuarioId })
        .select()
        .single();

      if (error) throw error;

      if (ejercicios.length > 0 && reg) {
        const filas = ejercicios.map((e) => ({
          registro_id: reg.id,
          usuario_id: usuarioId,
          nombre: e.nombre,
          series: e.series,
          repeticiones: e.repeticiones,
          peso: e.peso,
          completado: false,
        }));
        await supabase.from('ejercicios_registro').insert(filas);
      }
    } catch (err) {
      console.warn('Error vinculando rutina a fecha en Supabase:', err);
    }
  }
}

// Desvincula/elimina un registro completo de rutina o actividad del día
export async function eliminarRegistroRutina(registroId: string) {
  // Paso 1: limpiar ejercicios_registro hijos (ignorar error si CASCADE lo maneja)
  try {
    await supabase.from('ejercicios_registro').delete().eq('registro_id', registroId);
  } catch (_) {
    // CASCADE puede manejarlo automáticamente
  }

  // Paso 2: eliminar el registro de entrenamiento
  const { error } = await supabase
    .from('registros_entrenamiento')
    .delete()
    .eq('id', registroId);
  if (error) throw new Error(`No se pudo desvincular la rutina del día: ${error.message}`);
}

// Actividad suelta
export async function agregarActividad(
  fecha: string,
  nombre: string,
  series: number | null,
  repeticiones: number | null,
  peso: number | null = null
) {
  const usuarioId = await getUsuarioId();

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
      .insert({ fecha, usuario_id: usuarioId })
      .select()
      .single();
    if (error) throw error;
    registroId = data.id;
  }

  const { error } = await supabase
    .from('ejercicios_registro')
    .insert({ registro_id: registroId, usuario_id: usuarioId, nombre, series, repeticiones, peso });
  if (error) throw error;
}

// Guardar nota del día
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
  if (datos.completado !== undefined) {
    const { error } = await supabase
      .from('registros_entrenamiento')
      .update({ completado: datos.completado })
      .eq('id', registroId);
    if (error) throw error;
  }

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
