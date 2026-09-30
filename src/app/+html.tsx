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

        {/* Google Fonts - Outfit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Ionicons & Base Web Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Ionicons';
            src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Outfit_400Regular';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Outfit_600SemiBold';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Outfit_700Bold';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Outfit_900Black';
            src: url('https://fonts.gstatic.com/s/outfit/v11/Q8HY4v156D0v2v-1d9Fv1v4.ttf') format('truetype');
          }

          html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: #0B0D12 !important;
            color: #F9FAFB;
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            overflow-x: hidden;
          }

          /* Asegurar que los botones, inputs y textos hereden Outfit */
          input, button, select, textarea {
            font-family: 'Outfit', 'Outfit_400Regular', -apple-system, BlinkMacSystemFont, sans-serif;
          }
        ` }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
