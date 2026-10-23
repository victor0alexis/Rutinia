import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no"
        />

        {/* PWA / iOS Web App Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rutinia" />
        <meta name="theme-color" content="#050608" />

        {/* iOS standalone: marcar el documento antes del primer paint.
            Algunas versiones de iOS no activan (display-mode: standalone) en
            la PWA instalada aunque navigator.standalone sea true. */}
        <script
          dangerouslySetInnerHTML={{ __html: `
            (function () {
              try {
                var standalone = window.navigator.standalone === true ||
                  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                  (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches);
                if (standalone) {
                  document.documentElement.classList.add('pwa-standalone');
                }
              } catch (e) {}
            })();
          ` }}
        />

        {/* Iconos de pantalla de inicio para iOS (iPhone) y Web */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />

        {/* Google Fonts - Outfit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Ionicons & Base Web Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          * {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          html, body {
            background-color: #000000;
            color: #F9FAFB;
            width: 100%;
            height: 100%;
            height: -webkit-fill-available;
            height: 100dvh;
            margin: 0;
            padding: 0;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            -webkit-overscroll-behavior: none !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            touch-action: pan-x pan-y;
            -webkit-user-select: none;
            user-select: none;
          }

          #root {
            background-color: #000000;
            width: 100%;
            height: 100%;
            height: -webkit-fill-available;
            height: 100dvh;
            margin: 0;
            padding: 0;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            -webkit-overscroll-behavior: none !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
          }

          /* PWA instalada en iOS (pantalla de inicio):
             WebKit mide 100dvh/100svh/100% como "pantalla menos el safe-area
             superior", dejando una franja sin cubrir (normalmente abajo).
             En standalone usamos el viewport grande (100vh/100lvh), que sí
             equivale a la pantalla física completa. En Safari normal se
             mantiene 100dvh para no invadir las barras del navegador.
             Se cubren las dos detecciones: media query y la clase que añade
             el script de <head> cuando navigator.standalone es true. */
          @media (display-mode: standalone), (display-mode: fullscreen) {
            html, body, #root {
              height: 100vh;
              height: 100lvh;
            }
          }

          html.pwa-standalone,
          html.pwa-standalone body,
          html.pwa-standalone #root {
            height: 100vh;
            height: 100lvh;
          }

          /* Aplicar Outfit por defecto a todo texto en la web salvo Ionicons */
          div, span, p, label, select, textarea {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          /* Prevent iOS Safari auto-zoom on focus: must be at least 16px */
          input, textarea, select, button {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 16px !important;
            -webkit-user-select: text !important;
            user-select: text !important;
          }

          /* Garantizar que no haya scroll horizontal accidental */
          * {
            max-width: 100%;
          }

          /* Inversión estética para GIFs y miniaturas anatómicas de ejercicios (Dark Mode) */
          img[src*="JahelCuadrado"],
          img[src*="ExerciseGymGifsDB"],
          img[src*="exercises"],
          img[src*=".thumb.webp"],
          img[src*=".gif"] {
            filter: invert(1) contrast(1.1) brightness(0.96) !important;
            -webkit-filter: invert(1) contrast(1.1) brightness(0.96) !important;
            background-color: transparent !important;
          }

          /* Uiverse one-div glow card */
          .uiverse-one-div-glow {
            background-color: rgb(15, 15, 15) !important;
            border-radius: 20px !important;
            box-shadow: 0 0 50px 0px rgba(255, 255, 255, 0.7), inset 0 0 90px 0px rgba(255, 255, 255, 0.45) !important;
            color: white !important;
            transition: 1.5s !important;
          }

          /* ReactBits ShinyText Official CSS */
          .shiny-text {
            position: relative !important;
            display: inline-block !important;
            background-repeat: no-repeat !important;
            background-size: 100% 100% !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
          }

          .shiny-text__glow {
            position: absolute !important;
            inset: 0 !important;
            background-repeat: no-repeat !important;
            background-size: 100% 100% !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
            filter: blur(0.14em) !important;
            pointer-events: none !important;
            user-select: none !important;
          }
        ` }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
