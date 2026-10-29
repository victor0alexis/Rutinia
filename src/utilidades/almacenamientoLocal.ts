import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Caché local con espacio de nombres por cuenta.
 *
 * El almacenamiento de React Native es compartido por toda la app. Si dos
 * cuentas guardan `rutinas` en la misma clave, al cambiar de sesión la segunda
 * cuenta vería (o perdería) los datos de la primera. Por eso cada identidad
 * tiene su propio prefijo:
 *
 *   rutinia_invitado__rutinas
 *   rutinia_u_<uuid>__rutinas
 *
 * La cuenta invitada conserva además una migración transparente desde las
 * claves antiguas (`rutinia_rutinas`) para no perder datos al actualizar.
 */
const PREFIJO = 'rutinia_';
const SEPARADOR = '__';
const NS_INVITADO = 'invitado';

let namespaceActual = NS_INVITADO;

export function establecerNamespaceDatos(usuarioId: string | null): void {
  namespaceActual = usuarioId ? `u_${usuarioId}` : NS_INVITADO;
}

export function obtenerNamespaceDatos(): string {
  return namespaceActual;
}

export function obtenerPrefijoNamespace(): string {
  return `${PREFIJO}${namespaceActual}${SEPARADOR}`;
}

function claveConNamespace(sufijo: string): string {
  return `${obtenerPrefijoNamespace()}${sufijo}`;
}

function claveLegacy(sufijo: string): string {
  return `${PREFIJO}${sufijo}`;
}

/**
 * Lee una clave del espacio de nombres actual y migra la clave heredada la
 * primera vez que se accede como invitado.
 */
export async function leerLocal(sufijo: string): Promise<string | null> {
  try {
    const actual = await AsyncStorage.getItem(claveConNamespace(sufijo));
    if (actual !== null) return actual;

    if (namespaceActual === NS_INVITADO) {
      const heredada = await AsyncStorage.getItem(claveLegacy(sufijo));
      if (heredada !== null) {
        await AsyncStorage.setItem(claveConNamespace(sufijo), heredada);
        // La clave antigua ya no se usa: evitamos que una limpieza de caché
        // vuelva a importar datos obsoletos en la siguiente lectura.
        await AsyncStorage.removeItem(claveLegacy(sufijo)).catch(() => {});
        return heredada;
      }
    }
  } catch (err) {
    console.warn(`Error al leer caché local (${sufijo}):`, err);
  }
  return null;
}

export async function escribirLocal(sufijo: string, valor: string): Promise<void> {
  try {
    await AsyncStorage.setItem(claveConNamespace(sufijo), valor);
  } catch (err) {
    console.warn(`Error al guardar caché local (${sufijo}):`, err);
  }
}

export async function eliminarLocal(sufijo: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(claveConNamespace(sufijo));
  } catch (err) {
    console.warn(`Error al eliminar caché local (${sufijo}):`, err);
  }
}

/** Devuelve los sufijos de las claves que pertenecen a la cuenta activa. */
export async function listarSufijosLocales(): Promise<string[]> {
  try {
    const prefijo = obtenerPrefijoNamespace();
    const claves = await AsyncStorage.getAllKeys();
    return claves
      .filter((clave) => clave.startsWith(prefijo))
      .map((clave) => clave.slice(prefijo.length));
  } catch (err) {
    console.warn('Error al listar claves locales:', err);
    return [];
  }
}

/**
 * Borra todas las claves locales de una cuenta concreta (cachés, borradores y
 * timers). Se usa al quitar o eliminar una cuenta del dispositivo.
 */
export async function limpiarCacheDeCuenta(usuarioId: string | null): Promise<number> {
  const namespace = usuarioId ? `u_${usuarioId}` : NS_INVITADO;
  const prefijo = `${PREFIJO}${namespace}${SEPARADOR}`;
  // Claves heredadas de la biblioteca de favoritos (antes del namespace).
  const favoritosLegacy = `@rutinia_biblioteca_favoritos_v2:${namespace}`;
  const favoritosGlobal = '@rutinia_biblioteca_favoritos_v2';
  try {
    const claves = await AsyncStorage.getAllKeys();
    const propias = claves.filter(
      (clave) =>
        clave.startsWith(prefijo) ||
        clave === favoritosLegacy ||
        (!usuarioId && clave === favoritosGlobal)
    );
    if (propias.length > 0) {
      await AsyncStorage.multiRemove(propias);
    }
    return propias.length;
  } catch (err) {
    console.warn('Error al limpiar la caché de la cuenta:', err);
    return 0;
  }
}

export async function limpiarCacheDatosLocales(): Promise<number> {
  const sufijos = await listarSufijosLocales();
  const protegidos = ['sesion_', 'timer_', 'pref_'];
  const eliminables = sufijos.filter(
    (sufijo) => !protegidos.some((prefijo) => sufijo.startsWith(prefijo))
  );

  const claves = eliminables.map(claveConNamespace);
  // La biblioteca de favoritos usó durante un tiempo una clave propia.
  const favoritosLegacy = `@rutinia_biblioteca_favoritos_v2:${namespaceActual}`;
  const todas = await AsyncStorage.getAllKeys();
  if (todas.includes(favoritosLegacy)) {
    claves.push(favoritosLegacy);
  }
  if (namespaceActual === NS_INVITADO && todas.includes('@rutinia_biblioteca_favoritos_v2')) {
    claves.push('@rutinia_biblioteca_favoritos_v2');
  }
  if (claves.length > 0) {
    await AsyncStorage.multiRemove(claves);
  }
  return claves.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// API usada por los servicios de datos
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarCacheLocal<T>(key: string, data: T): Promise<void> {
  try {
    await escribirLocal(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Error al guardar caché local:', err);
  }
}

export async function obtenerCacheLocal<T>(key: string): Promise<T | null> {
  try {
    const jsonStr = await leerLocal(key);
    return jsonStr ? (JSON.parse(jsonStr) as T) : null;
  } catch (err) {
    console.warn('Error al leer caché local:', err);
    return null;
  }
}
