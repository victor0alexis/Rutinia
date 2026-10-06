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
