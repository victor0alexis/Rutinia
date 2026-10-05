import { supabase } from '../lib/supabase';
import { Registro, Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';

/** Obtiene el usuario_id del usuario autenticado, o null si no hay sesión. */
async function getUsuarioId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
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
  } catch {
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
      const regData: any = { fecha };
      if (rutina.id && !rutina.id.startsWith('local_')) {
        regData.rutina_id = rutina.id;
      }
      if (usuarioId) regData.usuario_id = usuarioId;

      const { data: reg, error } = await supabase
        .from('registros_entrenamiento')
        .insert(regData)
        .select()
        .single();

      if (error) throw error;

      if (ejercicios.length > 0 && reg) {
        const filas = ejercicios.map((e) => {
          const fila: any = {
            registro_id: reg.id,
            nombre: e.nombre,
            series: e.series,
            repeticiones: e.repeticiones,
            peso: e.peso,
            completado: false,
          };
          if (usuarioId) fila.usuario_id = usuarioId;
          return fila;
        });
        const { error: errEjs } = await supabase.from('ejercicios_registro').insert(filas);
        if (errEjs) throw errEjs;
      }
    } catch (err: any) {
      console.warn('Error vinculando rutina a fecha en Supabase:', err);
      throw new Error(`No se pudo vincular la rutina a la fecha ${fecha}: ${err?.message ?? err}`);
    }
  }
}

// Desvincula/elimina un registro completo de rutina o actividad del día
export async function eliminarRegistroRutina(registroId: string) {
  // Paso 1: limpiar ejercicios_registro hijos (por si la FK no tiene CASCADE)
  try {
    await supabase.from('ejercicios_registro').delete().eq('registro_id', registroId);
  } catch {
    // Si la FK CASCADE ya lo limpió o no existe, continuar
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
    const regData: any = { fecha };
    if (usuarioId) regData.usuario_id = usuarioId;

    const { data, error } = await supabase
      .from('registros_entrenamiento')
      .insert(regData)
      .select()
      .single();
    if (error) throw error;
    registroId = data.id;
  }

  const ejData: any = { registro_id: registroId, nombre, series, repeticiones, peso };
  if (usuarioId) ejData.usuario_id = usuarioId;

  const { error } = await supabase.from('ejercicios_registro').insert(ejData);
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
