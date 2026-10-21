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

// Expo's static rendering leaves the initial <title> empty because per-screen
// <Head> titles are applied after hydration. Set a default so the tab and
// crawlers have a title before React mounts.
function setDefaultTitle(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      setDefaultTitle(fullPath);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf8');
      const patched = html.replace(
        '<title data-rh="true"></title>',
        '<title data-rh="true">Rutinia</title>'
      );
      if (patched !== html) {
        fs.writeFileSync(fullPath, patched);
      }
    }
  }
}

setDefaultTitle(distDir);
console.log('✅ Título por defecto aplicado al HTML exportado');
