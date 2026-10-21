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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no"
        />

        {/* PWA / iOS Web App Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rutinia" />
        <meta name="theme-color" content="#000000" />

        {/* Iconos de pantalla de inicio para iOS (iPhone) y Web */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        {/* Google Fonts - Outfit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Ionicons & Base Web Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Ionicons';
            src: url('https://cdnjs.cloudflare.com/ajax/libs/ionicons/5.5.2/fonts/ionicons.ttf') format('truetype'),
                 url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          
          /* Mapeo de nombres de fuentes de Expo Google Fonts a font-family real */
          @font-face {
            font-family: 'Outfit_400Regular';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 400;
          }
          @font-face {
            font-family: 'Outfit_500Medium';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Outfit_600SemiBold';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 600;
          }
          @font-face {
            font-family: 'Outfit_700Bold';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 700;
          }
          @font-face {
            font-family: 'Outfit_800ExtraBold';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 800;
          }
          @font-face {
            font-family: 'Outfit_900Black';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
            font-weight: 900;
          }

          * {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          html, body, #root {
            background-color: #000000;
            color: #F9FAFB;
          }

          html {
            width: 100%;
            height: 100%;
            height: -webkit-fill-available;
            height: 100dvh;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }

          body, #root {
            background-color: #000000;
            width: 100%;
            min-height: 100%;
            min-height: -webkit-fill-available;
            min-height: 100dvh;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            overflow-y: auto;
            touch-action: manipulation;
            -webkit-overflow-scrolling: touch;
          }

          /* Aplicar Outfit por defecto a todo texto en la web salvo Ionicons */
          div, span, p, label, select, textarea {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          /* Prevent iOS Safari auto-zoom on focus: must be at least 16px */
          input, textarea, select, button {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 16px !important;
          }

          /* Garantizar que no haya scroll horizontal accidental */
          * {
            max-width: 100%;
          }

          /* Inversión estética para GIFs y miniaturas anatómicas de ejercicios (Dark Mode) */
          img[src*="JahelCuadrado"],
          img[src*="exercises"],
          img[src*=".thumb.webp"],
          img[src*=".gif"] {
            filter: invert(1) contrast(1.1) brightness(0.96) !important;
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
