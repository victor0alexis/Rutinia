import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@rutinia_biblioteca_favoritos_v2';
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

export const ESTADO_FAVORITOS_INICIAL: EstadoBibliotecaFavoritos = {
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

export async function cargarEstadoFavoritosBiblioteca(): Promise<EstadoBibliotecaFavoritos> {
  try {
    // Espera a que terminen las escrituras pendientes (p. ej. al reabrir el modal).
    await colaGuardado.catch(() => {});
    const guardado = await AsyncStorage.getItem(STORAGE_KEY);
    if (!guardado) return { ...ESTADO_FAVORITOS_INICIAL };
    return sanearEstado(JSON.parse(guardado));
  } catch {
    return { ...ESTADO_FAVORITOS_INICIAL };
  }
}

/** Serializa las escrituras para que una pulsación rápida nunca deje datos viejos. */
export function guardarEstadoFavoritosBiblioteca(
  estado: EstadoBibliotecaFavoritos
): Promise<void> {
  const limpio = sanearEstado(estado);
  colaGuardado = colaGuardado
    .catch(() => {})
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(limpio)))
    .catch(() => {});

  return colaGuardado;
}

export function alternarFavorito(ids: string[], ejercicioId: string): string[] {
  if (!ejercicioId) return ids;
  const existe = ids.includes(ejercicioId);
  if (existe) return ids.filter((id) => id !== ejercicioId);
  return [ejercicioId, ...ids];
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

export function agregarListaFavoritos(
  listas: ListaFavoritosBiblioteca[],
  nueva: ListaFavoritosBiblioteca
): ListaFavoritosBiblioteca[] {
  return [nueva, ...listas].slice(0, MAX_LISTAS);
}

export function alternarEjercicioEnLista(
  listas: ListaFavoritosBiblioteca[],
  listaId: string,
  ejercicioId: string
): ListaFavoritosBiblioteca[] {
  if (!listaId || !ejercicioId) return listas;

  return listas.map((lista) => {
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
}

export function eliminarListaFavoritos(
  listas: ListaFavoritosBiblioteca[],
  listaId: string
): ListaFavoritosBiblioteca[] {
  return listas.filter((lista) => lista.id !== listaId);
}
