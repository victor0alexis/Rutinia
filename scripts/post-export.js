const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    const srcPath = path.join(publicDir, file);
    const destPath = path.join(distDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copiado ${file} a dist/`);
    }
  }
}

// Expo's static/single rendering leaves initial tags generic.
// Inject viewport-fit=cover, iOS status bar meta tags, theme-color and background color locks
function patchHtmlFiles(dir) {
  const metaFixes = `
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Rutinia" />
    <meta name="theme-color" content="#080A0F" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#080A0F" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#080A0F" />
    <style id="rutinia-ios-viewport-fix">
      :root { color-scheme: dark !important; background-color: #080A0F !important; }
      html { color-scheme: dark !important; background-color: #080A0F !important; width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      body { color-scheme: dark !important; background-color: #080A0F !important; width: 100% !important; height: 100% !important; min-height: 100% !important; min-height: -webkit-fill-available !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; overscroll-behavior: none !important; -webkit-overscroll-behavior: none !important; }
      #root { color-scheme: dark !important; background-color: #080A0F !important; width: 100% !important; height: 100% !important; min-height: 100% !important; min-height: 100dvh !important; min-height: -webkit-fill-available !important; }
    </style>
  `;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patchHtmlFiles(fullPath);
    } else if (entry.name.endsWith('.html')) {
      let html = fs.readFileSync(fullPath, 'utf8');

      // 1. Título
      html = html.replace(
        '<title data-rh="true"></title>',
        '<title data-rh="true">Rutinia</title>'
      );

      // 2. Reemplazar o insertar un único viewport canónico con viewport-fit=cover
      html = html.replace(/<meta name="viewport"[^>]*>\s*/gi, '');
      html = html.replace('<head>', '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no" />');

      // 3. Inyectar tags iOS y CSS si no están presentes
      if (!html.includes('rutinia-ios-viewport-fix') && html.includes('</head>')) {
        html = html.replace('</head>', `${metaFixes}\n</head>`);
      }

      fs.writeFileSync(fullPath, html);
    }
  }
}

patchHtmlFiles(distDir);
console.log('✅ Metatags iOS (viewport-fit=cover, theme-color) y título aplicados a dist/*.html');
