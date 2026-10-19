/**
 * Utilidad de vibración háptica con soporte para navegadores móviles y fallback seguro.
 */
export const vibrarBoton = (ms = 12) => {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.navigator !== 'undefined' &&
      typeof window.navigator.vibrate === 'function'
    ) {
      window.navigator.vibrate(ms);
    }
  } catch {
    // Silencioso en caso de bloqueo por política de navegador o SSR
  }
};
