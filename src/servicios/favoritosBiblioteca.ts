import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../biblioteca/supabase';
import {
  escribirLocal,
  leerLocal,
  obtenerNamespaceDatos,
} from '../utilidades/almacenamientoLocal';
import { filtrarPorPropietario, obtenerUsuarioIdActual } from '../utilidades/usuario';

const STORAGE_SUFIJO = 'biblioteca_favoritos_v2';
const STORAGE_LEGACY_BASE = '@rutinia_biblioteca_favoritos_v2';
const getStorageKeyLegacy = () =>
  `${STORAGE_LEGACY_BASE}:${obtenerNamespaceDatos()}`;
const getLegacyKeys = () => {
  const claves = [getStorageKeyLegacy()];
  // La versión original guardaba una única clave global. Solo se adopta en el
  // perfil invitado, que es el único que podía usarla antes del multicuenta.
  if (obtenerNamespaceDatos() === 'invitado') claves.push(STORAGE_LEGACY_BASE);
  return claves;
};
const MAX_RECIENTES = 16;
const MAX_NOMBRE_LISTA = 42;
const MAX_LISTAS = 40;

export interface ListaFavoritosBiblioteca {
  id: string;
  nombre: string;
  /** id de grupo muscular (pectorals, lats…) o 'todos' */
  grupoMuscular: string;
  ejercicioIds: string[];
  creadaEn: number;
  actualizadaEn: number;
}

export interface EstadoBibliotecaFavoritos {
  favoritos: string[];
  listas: ListaFavoritosBiblioteca[];
  recientes: string[];
}

const ESTADO_FAVORITOS_INICIAL: EstadoBibliotecaFavoritos = {
  favoritos: [],
  listas: [],
  recientes: [],
};

function limpiarIds(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function sanearEstado(valor: unknown): EstadoBibliotecaFavoritos {
  if (!valor || typeof valor !== 'object') return { ...ESTADO_FAVORITOS_INICIAL };
  const raw = valor as Record<string, unknown>;

  const listasRaw = Array.isArray(raw.listas) ? raw.listas : [];
  const listas: ListaFavoritosBiblioteca[] = listasRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const lista = item as Record<string, unknown>;
      const id = typeof lista.id === 'string' ? lista.id : '';
      const nombre = typeof lista.nombre === 'string' ? lista.nombre.trim() : '';
      if (!id || !nombre) return null;

      const creadaEn = typeof lista.creadaEn === 'number' ? lista.creadaEn : Date.now();
      const actualizadaEn =
        typeof lista.actualizadaEn === 'number' ? lista.actualizadaEn : creadaEn;

      return {
        id,
        nombre: nombre.slice(0, MAX_NOMBRE_LISTA),
        grupoMuscular:
          typeof lista.grupoMuscular === 'string' && lista.grupoMuscular.length > 0
            ? lista.grupoMuscular
            : 'todos',
        ejercicioIds: limpiarIds(lista.ejercicioIds),
        creadaEn,
        actualizadaEn,
      };
    })
    .filter((lista): lista is ListaFavoritosBiblioteca => Boolean(lista))
    .slice(0, MAX_LISTAS);

  return {
    favoritos: limpiarIds(raw.favoritos),
    listas,
    recientes: limpiarIds(raw.recientes).slice(0, MAX_RECIENTES),
  };
}

let colaGuardado: Promise<void> = Promise.resolve();

/**
 * Lee el estado local usando el almacenamiento con espacio de nombres.
 * Migra la clave antigua `@rutinia_biblioteca_favoritos_v2:<cuenta>` la
 * primera vez, para no perder favoritos ni listas al actualizar.
 */
async function cargarEstadoLocal(): Promise<EstadoBibliotecaFavoritos> {
  const actual = await leerLocal(STORAGE_SUFIJO);
  if (actual) {
    try {
      return sanearEstado(JSON.parse(actual));
    } catch {
      // Si el JSON está corrupto, probamos la clave heredada.
    }
  }

  for (const clave of getLegacyKeys()) {
    try {
      const legacy = await AsyncStorage.getItem(clave);
      if (legacy) {
        await escribirLocal(STORAGE_SUFIJO, legacy);
        await AsyncStorage.removeItem(clave).catch(() => {});
        return sanearEstado(JSON.parse(legacy));
      }
    } catch {
      // Probamos la siguiente clave heredada.
    }
  }

  return { ...ESTADO_FAVORITOS_INICIAL };
}

/** Sincroniza en segundo plano las listas y favoritos con Supabase */
async function sincronizarCloud(estado: EstadoBibliotecaFavoritos): Promise<void> {
  try {
    const usuarioId = await obtenerUsuarioIdActual();
    const filaFavoritos: Record<string, unknown> = {
      id: usuarioId ?? 'invitado',
      favoritos: estado.favoritos,
      recientes: estado.recientes,
      actualizado_en: new Date().toISOString(),
    };
    if (usuarioId) filaFavoritos.usuario_id = usuarioId;

    // Sincronizar favoritos y recientes
    await supabase
      .from('favoritos_biblioteca')
      .upsert(filaFavoritos)
      .then(({ error }) => {
        if (error && error.code !== 'PGRST204') {
          // Si la tabla no existe en la BD todavía, no interrumpir
        }
      });

    // Sincronizar listas
    if (estado.listas.length > 0) {
      const filas = estado.listas.map((l) => ({
        id: l.id,
        nombre: l.nombre,
        grupo_muscular: l.grupoMuscular,
        ejercicio_ids: l.ejercicioIds,
        creada_en: l.creadaEn,
        actualizada_en: l.actualizadaEn,
        usuario_id: usuarioId,
      }));

      await supabase
        .from('listas_biblioteca')
        .upsert(filas)
        .then(({ error }) => {
          if (error && error.code !== 'PGRST204') {
            // Silencioso si la tabla no existe
          }
        });
    }
  } catch {
    // Modo offline / tabla pendiente de crear en Supabase
  }
}

/**
 * Carga el estado de favoritos, listas y recientes.
 * 1. Lee inmediatamente de AsyncStorage para carga a 0 ms.
 * 2. Si hay conexión y la tabla existe en Supabase, sincroniza y actualiza la caché.
 */
export async function cargarEstadoFavoritosBiblioteca(): Promise<EstadoBibliotecaFavoritos> {
  // 1. Cargar caché local inmediato de AsyncStorage (0 ms)
  await colaGuardado.catch(() => {});
  const estadoLocal = await cargarEstadoLocal();

  // 2. Intentar sincronizar con Supabase
  try {
    const usuarioId = await obtenerUsuarioIdActual();
    const [resListas, resFav] = await Promise.all([
      filtrarPorPropietario(
        supabase
          .from('listas_biblioteca')
          .select('*')
          .order('actualizada_en', { ascending: false }),
        usuarioId
      ),
      filtrarPorPropietario(
        supabase
          .from('favoritos_biblioteca')
          .select('*')
          .eq('id', usuarioId ?? 'invitado'),
        usuarioId
      ).maybeSingle(),
    ]);

    if (!resListas.error && resListas.data) {
      const listasDb = resListas.data as {
        id: string;
        nombre: string;
        grupo_muscular: string;
        ejercicio_ids: string[];
        creada_en: number | string;
        actualizada_en: number | string;
      }[];

      const listasCloud: ListaFavoritosBiblioteca[] = listasDb.map((row) => ({
        id: String(row.id),
        nombre: String(row.nombre || '').trim(),
        grupoMuscular: String(row.grupo_muscular || 'todos'),
        ejercicioIds: Array.isArray(row.ejercicio_ids) ? row.ejercicio_ids : [],
        creadaEn: Number(row.creada_en) || Date.now(),
        actualizadaEn: Number(row.actualizada_en) || Date.now(),
      }));

      // Si la nube está vacía pero en local teníamos listas, subir las listas locales a la nube
      if (listasCloud.length === 0 && estadoLocal.listas.length > 0) {
        sincronizarCloud(estadoLocal).catch(() => {});
      }

      const favCloud: string[] =
        !resFav.error && resFav.data && Array.isArray(resFav.data.favoritos)
          ? resFav.data.favoritos
          : estadoLocal.favoritos;

      const recCloud: string[] =
        !resFav.error && resFav.data && Array.isArray(resFav.data.recientes)
          ? resFav.data.recientes
          : estadoLocal.recientes;

      const estadoFinal: EstadoBibliotecaFavoritos = {
        favoritos: favCloud,
        listas: listasCloud.length > 0 ? listasCloud : estadoLocal.listas,
        recientes: recCloud,
      };

      // Actualizar AsyncStorage para próximas aperturas offline
      void escribirLocal(STORAGE_SUFIJO, JSON.stringify(estadoFinal));
      return estadoFinal;
    }
  } catch (err) {
    // Si la tabla aún no existe en Supabase o estamos offline, seguimos con estadoLocal
    console.warn('Sincronización Supabase de listas/favoritos en espera:', err);
  }

  return estadoLocal;
}

/** Serializa las escrituras para que una pulsación rápida nunca deje datos viejos. */
export function guardarEstadoFavoritosBiblioteca(
  estado: EstadoBibliotecaFavoritos
): Promise<void> {
  const limpio = sanearEstado(estado);

  // 1. Guardar siempre en local de forma inmediata (por cuenta)
  colaGuardado = colaGuardado
    .catch(() => {})
    .then(() => escribirLocal(STORAGE_SUFIJO, JSON.stringify(limpio)))
    .catch(() => {});

  // 2. Sincronizar en segundo plano con Supabase
  sincronizarCloud(limpio).catch(() => {});

  return colaGuardado;
}

export function alternarFavorito(ids: string[], ejercicioId: string): string[] {
  if (!ejercicioId) return ids;
  const existe = ids.includes(ejercicioId);
  return existe ? ids.filter((id) => id !== ejercicioId) : [ejercicioId, ...ids];
}

export function registrarEjercicioReciente(ids: string[], ejercicioId: string): string[] {
  if (!ejercicioId) return ids;
  return [ejercicioId, ...ids.filter((id) => id !== ejercicioId)].slice(0, MAX_RECIENTES);
}

export function crearListaFavoritos(params: {
  nombre: string;
  grupoMuscular: string;
  ejercicioIds?: string[];
  id?: string;
}): ListaFavoritosBiblioteca {
  const ahora = Date.now();
  return {
    id: params.id || `lista_${ahora}_${Math.random().toString(36).slice(2, 8)}`,
    nombre: params.nombre.trim().slice(0, MAX_NOMBRE_LISTA),
    grupoMuscular: params.grupoMuscular || 'todos',
    ejercicioIds: limpiarIds(params.ejercicioIds),
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
}

function ejecutarEnSegundoPlano(promesa: PromiseLike<unknown>): void {
  Promise.resolve(promesa).catch(() => {});
}

export function agregarListaFavoritos(
  listas: ListaFavoritosBiblioteca[],
  nueva: ListaFavoritosBiblioteca
): ListaFavoritosBiblioteca[] {
  // Disparar inserción inmediata de la nueva lista en Supabase
  ejecutarEnSegundoPlano(
    (async () => {
      const usuarioId = await obtenerUsuarioIdActual();
      await supabase.from('listas_biblioteca').upsert({
        id: nueva.id,
        nombre: nueva.nombre,
        grupo_muscular: nueva.grupoMuscular,
        ejercicio_ids: nueva.ejercicioIds,
        creada_en: nueva.creadaEn,
        actualizada_en: nueva.actualizadaEn,
        usuario_id: usuarioId,
      });
    })()
  );

  return [nueva, ...listas].slice(0, MAX_LISTAS);
}

export function alternarEjercicioEnLista(
  listas: ListaFavoritosBiblioteca[],
  listaId: string,
  ejercicioId: string
): ListaFavoritosBiblioteca[] {
  if (!listaId || !ejercicioId) return listas;

  const actualizadas = listas.map((lista) => {
    if (lista.id !== listaId) return lista;
    const yaEsta = lista.ejercicioIds.includes(ejercicioId);
    return {
      ...lista,
      ejercicioIds: yaEsta
        ? lista.ejercicioIds.filter((id) => id !== ejercicioId)
        : [ejercicioId, ...lista.ejercicioIds],
      actualizadaEn: Date.now(),
    };
  });

  // Disparar upsert de la lista modificada en Supabase
  const listaModificada = actualizadas.find((l) => l.id === listaId);
  if (listaModificada) {
    ejecutarEnSegundoPlano(
      (async () => {
        const usuarioId = await obtenerUsuarioIdActual();
        await supabase.from('listas_biblioteca').upsert({
          id: listaModificada.id,
          nombre: listaModificada.nombre,
          grupo_muscular: listaModificada.grupoMuscular,
          ejercicio_ids: listaModificada.ejercicioIds,
          creada_en: listaModificada.creadaEn,
          actualizada_en: listaModificada.actualizadaEn,
          usuario_id: usuarioId,
        });
      })()
    );
  }

  return actualizadas;
}

export function eliminarListaFavoritos(
  listas: ListaFavoritosBiblioteca[],
  listaId: string
): ListaFavoritosBiblioteca[] {
  // Disparar borrado en Supabase en segundo plano
  ejecutarEnSegundoPlano(
    (async () => {
      const usuarioId = await obtenerUsuarioIdActual();
      await filtrarPorPropietario(
        supabase.from('listas_biblioteca').delete().eq('id', listaId),
        usuarioId
      );
    })()
  );

  return listas.filter((lista) => lista.id !== listaId);
}
