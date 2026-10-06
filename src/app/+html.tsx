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
        <meta name="theme-color" content="#0B0D12" />

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

          *, html, body, #root {
            box-sizing: border-box;
            background-color: #0B0D12;
            color: #F9FAFB;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }

          /* Aplicar Outfit por defecto a todo texto en la web salvo Ionicons */
          div, span, p, label, input, button, select, textarea {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
          }
        ` }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
