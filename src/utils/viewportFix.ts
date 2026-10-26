/**
 * Respaldo robusto de viewport para iOS PWA (Modo Standalone / Pantalla de inicio).
 * En iOS PWA WebKit puede limitar window.innerHeight a screen.height - safeAreas,
 * dejando el viewport sin cubrir la pantalla completa ("no cover").
 * Este script fuerza a #root a ocupar el alto físico total de la pantalla
 * y provee detección precisa de iOS Standalone.
 */

export function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isStandalone =
    Boolean((navigator as any)?.standalone) ||
    (window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false);

  return isIOS && isStandalone;
}

export function initViewportFix() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const applyFix = () => {
    if (!isIOSStandalone()) return;

    const root = document.getElementById('root');
    if (!root) return;

    const scrW = Math.min(window.screen.width, window.screen.height);
    const scrH = Math.max(window.screen.width, window.screen.height);
    const isLandscape =
      Math.abs(Number(window.orientation) || 0) === 90 ||
      window.innerWidth > window.innerHeight;

    const targetHeight = isLandscape ? scrW : scrH;
    const currentInnerH = window.innerHeight;

    // Si window.innerHeight < screen.height (con tolerancia de 2 px)
    if (targetHeight - currentInnerH > 2) {
      root.style.position = 'fixed';
      root.style.top = '0px';
      root.style.bottom = 'auto';
      root.style.height = `${targetHeight}px`;
      root.style.width = '100%';
    } else {
      root.style.position = 'fixed';
      root.style.top = '0px';
      root.style.bottom = '0px';
      root.style.height = '100%';
      root.style.width = '100%';
    }
  };

  const scheduleFix = () => {
    applyFix();
    setTimeout(applyFix, 150);
    setTimeout(applyFix, 300);
  };

  // Ejecución inmediata
  scheduleFix();

  // Recalcular en eventos clave de cambio de viewport
  window.addEventListener('resize', scheduleFix, { passive: true });
  window.addEventListener('orientationchange', scheduleFix, { passive: true });
  window.addEventListener('pageshow', scheduleFix, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleFix();
    }
  });
}
