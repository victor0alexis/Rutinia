import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type DebugInfo = {
  winSize: string;
  screenSize: string;
  visualViewportHeight: string;
  standalone: string;
  insetsEnv: string;
  rootRect: string;
  tabBarRect: string;
  metaViewport: string;
  metaCount: number;
};

export default function DebugViewportOverlay() {
  const [activo, setActivo] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('debug') === '1' || window.localStorage?.getItem('rutinia_debug') === '1';
    } catch {
      return false;
    }
  });
  const [info, setInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Activación con 5 toques rápidos en la pantalla
    let tapCount = 0;
    let tapTimer: any = null;

    const handleTap = () => {
      tapCount += 1;
      if (tapTimer) clearTimeout(tapTimer);
      if (tapCount >= 5) {
        tapCount = 0;
        setActivo((prev) => {
          const next = !prev;
          try {
            window.localStorage?.setItem('rutinia_debug', next ? '1' : '0');
          } catch {}
          return next;
        });
      } else {
        tapTimer = setTimeout(() => {
          tapCount = 0;
        }, 1500);
      }
    };

    window.addEventListener('click', handleTap, { passive: true });

    return () => {
      window.removeEventListener('click', handleTap);
      if (tapTimer) clearTimeout(tapTimer);
    };
  }, []);

  useEffect(() => {
    if (!activo || Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const recolectar = () => {
      // Dimensiones de ventana y pantalla
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const scrW = window.screen.width;
      const scrH = window.screen.height;
      const vvH = window.visualViewport ? Math.round(window.visualViewport.height) : winH;

      // Standalone
      const navStandalone = Boolean((window.navigator as any)?.standalone);
      const mediaStandalone = window.matchMedia
        ? window.matchMedia('(display-mode: standalone)').matches
        : false;

      // Insets reales mediante elemento de prueba
      let sat = '0px';
      let sab = '0px';
      try {
        const testEl = document.createElement('div');
        testEl.style.position = 'fixed';
        testEl.style.top = '0';
        testEl.style.left = '0';
        testEl.style.width = '0';
        testEl.style.height = '0';
        testEl.style.visibility = 'hidden';
        testEl.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        testEl.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
        document.body.appendChild(testEl);
        const cs = window.getComputedStyle(testEl);
        sat = cs.paddingTop || '0px';
        sab = cs.paddingBottom || '0px';
        document.body.removeChild(testEl);
      } catch {}

      // Rect de #root
      const rootEl = document.getElementById('root');
      let rootRectStr = 'no encontrado';
      if (rootEl) {
        const r = rootEl.getBoundingClientRect();
        rootRectStr = `top:${Math.round(r.top)} bot:${Math.round(r.bottom)} h:${Math.round(r.height)}`;
      }

      // Rect de la barra de pestañas
      const tabEl = document.getElementById('spotlight-tabbar');
      let tabRectStr = 'no encontrado';
      if (tabEl) {
        const tr = tabEl.getBoundingClientRect();
        tabRectStr = `top:${Math.round(tr.top)} bot:${Math.round(tr.bottom)} h:${Math.round(tr.height)}`;
      }

      // Meta viewport
      const metas = document.querySelectorAll('meta[name="viewport"]');
      const metaContent = metas.length > 0 ? metas[0].getAttribute('content') || '' : 'ninguno';

      setInfo({
        winSize: `${winW}×${winH}`,
        screenSize: `${scrW}×${scrH}`,
        visualViewportHeight: `${vvH}px`,
        standalone: `nav:${navStandalone ? '1' : '0'} media:${mediaStandalone ? '1' : '0'}`,
        insetsEnv: `top:${sat} bot:${sab}`,
        rootRect: rootRectStr,
        tabBarRect: tabRectStr,
        metaViewport: metaContent,
        metaCount: metas.length,
      });
    };

    recolectar();

    const interval = setInterval(recolectar, 600);
    window.addEventListener('resize', recolectar);
    window.addEventListener('orientationchange', recolectar);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', recolectar);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', recolectar);
      window.removeEventListener('orientationchange', recolectar);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', recolectar);
      }
    };
  }, [activo]);

  if (!activo || !info) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.title}>🔍 RUTINIA VIEWPORT DEBUG</Text>
      <Text style={styles.text}>Window: <Text style={styles.bold}>{info.winSize}</Text> | Screen: <Text style={styles.bold}>{info.screenSize}</Text></Text>
      <Text style={styles.text}>VisualVP: <Text style={styles.bold}>{info.visualViewportHeight}</Text> | Standalone: <Text style={styles.bold}>{info.standalone}</Text></Text>
      <Text style={styles.text}>Env insets: <Text style={styles.accent}>{info.insetsEnv}</Text></Text>
      <Text style={styles.text}>#root: <Text style={styles.mono}>{info.rootRect}</Text></Text>
      <Text style={styles.text}>TabBar: <Text style={styles.mono}>{info.tabBarRect}</Text></Text>
      <Text style={styles.text}>Meta ({info.metaCount}): <Text style={styles.small}>{info.metaViewport}</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // @ts-ignore
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 6,
    left: 6,
    zIndex: 999999,
    maxWidth: 290,
    backgroundColor: 'rgba(8, 10, 15, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    // @ts-ignore
    backdropFilter: 'blur(8px)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  title: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  text: {
    color: '#E2E8F0',
    fontSize: 8.5,
    lineHeight: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accent: {
    fontWeight: '700',
    color: '#34D399',
  },
  mono: {
    color: '#FCD34D',
  },
  small: {
    color: '#94A3B8',
    fontSize: 7.5,
  },
});
