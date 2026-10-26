import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Registro, Rutina } from '../types';
import { guardarCacheLocal, obtenerCacheLocal } from '../utils/offline';
import {
  PREFIJO_NOTA_EJERCICIO,
  PREFIJO_OBSERVACIONES,
  formatearNotaEjercicio,
  parsearNotaEjercicio,
  serializarNotasSesion,
} from '../utils/notasSesion';

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
      .select('*, rutinas(nombre, plan_id, dia_sugerido), planes_entrenamiento(*), ejercicios_registro(*)')
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
    if (cache && cache.length > 0) return cache;

    // Fallback inteligente: buscar en cualquier rango cacheado en almacenamiento local
    try {
      const keys = await AsyncStorage.getAllKeys();
      const regKeys = keys.filter((k) => k.startsWith('rutinia_registros_'));
      for (const k of regKeys) {
        const raw = await AsyncStorage.getItem(k);
        if (raw) {
          const arr = JSON.parse(raw) as Registro[];
          const filtrados = arr.filter((r) => r.fecha >= desde && r.fecha <= hasta);
          if (filtrados.length > 0) return filtrados;
        }
      }
    } catch {
      // Ignorar fallback
    }

    return cache || [];
  }
}

// Copia los ejercicios de la rutina a cada fecha elegida, congelando nombres de plan y rutina
export async function agregarRutinaAFechas(
  rutina: Rutina,
  fechas: string[],
  opciones?: {
    planId?: string | null;
    planNombre?: string | null;
    rutinaNombre?: string | null;
  }
) {
  const usuarioId = await getUsuarioId();
  const ejercicios = rutina.ejercicios_rutina || [];

  const targetPlanId = opciones?.planId !== undefined ? opciones.planId : rutina.plan_id ?? null;
  const targetPlanNombre = opciones?.planNombre !== undefined
    ? opciones.planNombre
    : rutina.planes_entrenamiento?.nombre ?? null;
  const targetRutinaNombre = opciones?.rutinaNombre || rutina.nombre;

  for (const fecha of fechas) {
    try {
      const regData: any = {
        fecha,
        plan_id: targetPlanId,
        plan_nombre: targetPlanNombre,
        rutina_nombre: targetRutinaNombre,
      };
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
  datos: {
    nombre?: string;
    series?: number | null;
    repeticiones?: number | null;
    peso?: number | null;
    completado?: boolean;
    ejercicio_nombre?: string | null;
    sustituye_a_ejercicio_id?: string | null;
    sustituye_a_nombre?: string | null;
    sustitucion_alcance?: 'solo_hoy' | 'rutina' | null;
    reps_parciales?: number;
    drops?: any[];
  }
) {
  const { error } = await supabase.from('ejercicios_registro').update(datos).eq('id', id);
  if (error) throw error;
}

/**
 * Elimina filas de ejercicios que ya no forman parte de la sesión guardada.
 * Es la red de seguridad para sustituciones/eliminaciones: evita que el
 * ejercicio anterior quede huérfano en la base de datos y reaparezca en el
 * historial. Nunca toca las filas de notas (📌).
 */
export async function eliminarEjerciciosObsoletos(
  registroId: string,
  idsConservados: string[]
): Promise<void> {
  if (idsConservados.length === 0) return;

  const { data, error } = await supabase
    .from('ejercicios_registro')
    .select('id, nombre')
    .eq('registro_id', registroId);

  if (error) {
    console.warn('No se pudieron revisar ejercicios obsoletos:', error.message);
    return;
  }

  const ids = new Set(idsConservados);
  const idsObsoletos = (data ?? [])
    .filter((fila) => {
      if (ids.has(fila.id)) return false;
      const nombre = fila.nombre || '';
      return (
        !nombre.startsWith(PREFIJO_OBSERVACIONES) &&
        !nombre.startsWith(PREFIJO_NOTA_EJERCICIO)
      );
    })
    .map((fila) => fila.id);

  if (idsObsoletos.length === 0) return;

  const { error: errorDelete } = await supabase
    .from('ejercicios_registro')
    .delete()
    .in('id', idsObsoletos);

  if (errorDelete) {
    console.warn('No se pudieron eliminar ejercicios obsoletos:', errorDelete.message);
  }
}

export async function actualizarEstadoRegistro(
  registroId: string,
  datos: {
    completado?: boolean;
    plan_id?: string | null;
    plan_nombre?: string | null;
    rutina_nombre?: string | null;
    notas?: string | null;
  }
) {
  const updateData: any = {};
  if (datos.completado !== undefined) updateData.completado = datos.completado;
  if (datos.plan_id !== undefined) updateData.plan_id = datos.plan_id;
  if (datos.plan_nombre !== undefined) updateData.plan_nombre = datos.plan_nombre;
  if (datos.rutina_nombre !== undefined) updateData.rutina_nombre = datos.rutina_nombre;
  if (datos.notas !== undefined) updateData.notas = datos.notas;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('registros_entrenamiento')
      .update(updateData)
      .eq('id', registroId);
    if (error) throw error;
  }
}

/**
 * Guarda la nota general de una sesión y su duración real.
 * La nota visible se mantiene además como fila 📌 para que Inicio y Calendario
 * la sigan mostrando sin cambios. Se actualiza la fila existente en lugar de
 * insertar duplicados cada vez que se guarda o edita la sesión.
 */
export async function guardarNotaSesion(
  registroId: string,
  nota: string | null | undefined,
  duracionSegundos?: number | null
) {
  const texto = (nota || '').trim();
  const notasSerializadas = serializarNotasSesion(texto, duracionSegundos);

  const { error } = await supabase
    .from('registros_entrenamiento')
    .update({ notas: notasSerializadas })
    .eq('id', registroId);
  if (error) throw error;

  const { data: existentes, error: errorSelect } = await supabase
    .from('ejercicios_registro')
    .select('id')
    .eq('registro_id', registroId)
    .like('nombre', `${PREFIJO_OBSERVACIONES}%`)
    .order('creado_en', { ascending: true });
  if (errorSelect) throw errorSelect;

  if (!texto) {
    if (existentes && existentes.length > 0) {
      const { error: errorDelete } = await supabase
        .from('ejercicios_registro')
        .delete()
        .in('id', existentes.map((fila) => fila.id));
      if (errorDelete) throw errorDelete;
    }
    return;
  }

  const nombre = `${PREFIJO_OBSERVACIONES}${texto}`;
  if (existentes && existentes.length > 0) {
    const [primera, ...sobrantes] = existentes;
    const { error: errorUpdate } = await supabase
      .from('ejercicios_registro')
      .update({ nombre })
      .eq('id', primera.id);
    if (errorUpdate) throw errorUpdate;

    if (sobrantes.length > 0) {
      const { error: errorDelete } = await supabase
        .from('ejercicios_registro')
        .delete()
        .in('id', sobrantes.map((fila) => fila.id));
      if (errorDelete) throw errorDelete;
    }
  } else {
    const { error: errorInsert } = await supabase.from('ejercicios_registro').insert({
      registro_id: registroId,
      nombre,
      series: null,
      repeticiones: null,
      peso: null,
    });
    if (errorInsert) throw errorInsert;
  }
}

/**
 * Sincroniza las notas de ejercicio de una sesión.
 * Cada nota vive como fila 📌 [ENTRENAMIENTO] <ejercicio>: <nota>, así que
 * siempre se muestra junto al nombre del ejercicio al que pertenece.
 */
export async function sincronizarNotasEjercicios(
  registroId: string,
  notas: { nombre: string; nota?: string | null }[]
) {
  const { data: existentes, error: errorSelect } = await supabase
    .from('ejercicios_registro')
    .select('id, nombre, ejercicio_nombre')
    .eq('registro_id', registroId)
    .like('nombre', `${PREFIJO_NOTA_EJERCICIO}%`);
  if (errorSelect) throw errorSelect;

  const porEjercicio = new Map<string, { id: string; nombre: string; ejercicio_nombre?: string | null }>();
  for (const fila of existentes || []) {
    const parsed = parsearNotaEjercicio(fila as any);
    if (parsed) porEjercicio.set(parsed.nombreEjercicio.trim().toLowerCase(), fila as any);
  }

  const nombresSesion = new Set(
    notas.map((item) => item.nombre.trim().toLowerCase())
  );

  for (const item of notas) {
    const key = item.nombre.trim().toLowerCase();
    const existente = porEjercicio.get(key);
    const texto = (item.nota || '').trim();

    if (!texto) {
      if (existente) {
        const { error } = await supabase
          .from('ejercicios_registro')
          .delete()
          .eq('id', existente.id);
        if (error) throw error;
      }
      continue;
    }

    const nombreFila = formatearNotaEjercicio(item.nombre, texto);
    if (existente) {
      const { error } = await supabase
        .from('ejercicios_registro')
        .update({ nombre: nombreFila, ejercicio_nombre: item.nombre })
        .eq('id', existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('ejercicios_registro').insert({
        registro_id: registroId,
        nombre: nombreFila,
        ejercicio_nombre: item.nombre,
        series: null,
        repeticiones: null,
        peso: null,
      });
      if (error) throw error;
    }
  }

  // Limpia notas huérfanas de ejercicios que ya no pertenecen a la sesión.
  for (const [key, fila] of porEjercicio.entries()) {
    if (!nombresSesion.has(key)) {
      const { error } = await supabase
        .from('ejercicios_registro')
        .delete()
        .eq('id', fila.id);
      if (error) throw error;
    }
  }
}

export async function eliminarEjercicio(id: string) {
  const { error } = await supabase.from('ejercicios_registro').delete().eq('id', id);
  if (error) throw error;
}

// Obtener la sesión anterior más reciente de una rutina para referencia de pesos/reps
export async function obtenerHistorialPrevioRutina(
  rutinaId?: string | null,
  fechaActual?: string
): Promise<Registro | null> {
  if (!rutinaId || rutinaId.startsWith('local_')) return null;

  try {
    let query = supabase
      .from('registros_entrenamiento')
      .select('*, rutinas(nombre), ejercicios_registro(*)')
      .eq('rutina_id', rutinaId)
      .order('fecha', { ascending: false })
      .limit(3);

    if (fechaActual) {
      query = query.lt('fecha', fechaActual);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    // Retorna la sesión anterior más reciente
    return data[0] as Registro;
  } catch (err) {
    console.warn('Error obteniendo historial previo de rutina:', err);
    return null;
  }
}

// Obtener el historial previo de un ejercicio específico (para recálculo tras intercambiar ejercicio)
export async function obtenerHistorialPrevioEjercicio(
  nombreEjercicio: string,
  fechaActual?: string
): Promise<{ fechaFormateada: string; series: any[] } | null> {
  if (!nombreEjercicio.trim()) return null;

  try {
    const nombreLimpio = nombreEjercicio.trim().replace(/^\[U(NILATERAL)?\]\s*/i, '');

    let query = supabase
      .from('ejercicios_registro')
      .select('*, registros_entrenamiento!inner(fecha, completado)')
      .ilike('nombre', `%${nombreLimpio}%`)
      .order('creado_en', { ascending: false })
      .limit(5);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    for (const item of data) {
      const fechaReg = (item as any).registros_entrenamiento?.fecha;
      if (fechaActual && fechaReg && fechaReg >= fechaActual) {
        continue;
      }

      const matchResumen = (item.nombre || '').match(/\((.*?)\)$/);
      if (matchResumen && matchResumen[1]) {
        const rawSets = matchResumen[1].split('•').map((s: string) => s.trim());
        const seriesPrevias = rawSets.map((setStr: string) => {
          const datosStr = setStr.replace(/^\d+ª:\s*/, '').replace(/✓/g, '').trim();
          const matchK = datosStr.match(/(\d+(?:\.\d+)?)k/);
          const matchR = datosStr.match(/(\d+)r/);
          const matchRir = datosStr.match(/RIR\s*(\d+)/i);
          const matchParcial = datosStr.match(/\+(\d+)p/);

          // Drops
          const drops: any[] = [];
          if (datosStr.includes('→')) {
            const dropParts = datosStr.split('→').map((p: string) => p.trim());
            dropParts.slice(1).forEach((dp: string, dIdx: number) => {
              const mKg = dp.match(/(\d+(?:\.\d+)?)k/);
              const mReps = dp.match(/(\d+)r/);
              const mRir = dp.match(/RIR\s*(\d+)/i);
              if (mKg || mReps) {
                drops.push({
                  orden: dIdx + 1,
                  kg: mKg ? mKg[1] : '',
                  reps: mReps ? mReps[1] : '',
                  rir: mRir ? mRir[1] : null,
                });
              }
            });
          }

          return {
            peso: matchK ? matchK[1] : (item.peso ? item.peso.toString() : ''),
            reps: matchR ? matchR[1] : (item.repeticiones ? item.repeticiones.toString() : ''),
            rir: matchRir ? matchRir[1] : '',
            nota: '',
            repsParciales: matchParcial ? parseInt(matchParcial[1], 10) : 0,
            esDropset: drops.length > 0,
            drops,
          };
        });

        return {
          fechaFormateada: fechaReg || 'Previo',
          series: seriesPrevias,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('Error obteniendo historial previo de ejercicio:', err);
    return null;
  }
}

