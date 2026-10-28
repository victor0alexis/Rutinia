import { obtenerNamespaceDatos } from './offline';

/**
 * Devuelve el id del usuario propietario del espacio de datos activo.
 *
 * El espacio de nombres se fija al inicializar la app y al cambiar de cuenta
 * (`establecerNamespaceDatos`). Usarlo como fuente de verdad evita que una
 * sesión de Supabase residual haga que la interfaz local consulte datos de la
 * cuenta anterior. En modo invitado devuelve `null` sin tocar la red.
 */
export function obtenerUsuarioIdActual(): Promise<string | null> {
  const namespace = obtenerNamespaceDatos();
  if (namespace === 'invitado') return Promise.resolve(null);
  if (namespace.startsWith('u_')) return Promise.resolve(namespace.slice(2));
  return Promise.resolve(null);
}

type QueryConPropietario<T> = {
  eq: (columna: string, valor: string) => T;
  is: (columna: string, valor: null) => T;
};

/**
 * Restringe una consulta a las filas del usuario actual.
 *
 * Es una segunda capa de seguridad además de RLS: si el proyecto todavía tiene
 * RLS desactivado (o usa una clave indebida), las listas nunca mezclan datos de
 * dos cuentas. Las filas del invitado son las que tienen `usuario_id = null`.
 *
 * Se evita la restricción genérica recursiva (`T extends QueryConPropietario<T>`)
 * porque los builders de Supabase son tipos muy profundos y TypeScript acaba
 * lanzando TS2589 en algunas consultas con `select('*')`.
 */
export function filtrarPorPropietario<T>(query: T, usuarioId: string | null): T {
  const consulta = query as QueryConPropietario<T>;
  return usuarioId
    ? consulta.eq('usuario_id', usuarioId)
    : consulta.is('usuario_id', null);
}
