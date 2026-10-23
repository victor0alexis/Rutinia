type DataChangeListener = () => void;

const listeners = new Set<DataChangeListener>();

/**
 * Permite a cualquier pantalla o componente suscribirse a cambios globales
 * de datos (edición de rutinas, asignación de planes, actualizaciones en vivo).
 */
export function subscribirCambioDatos(fn: DataChangeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Notifica a todos los escuchas que los datos de entrenamiento o rutinas
 * han cambiado, forzando una recarga instantánea en 0 ms.
 */
export function emitirCambioDatos(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('Error en listener de cambio de datos:', err);
    }
  }
}
