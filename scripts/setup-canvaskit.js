const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "public", "canvaskit.wasm");

let packageJsonPath = null;
try {
  packageJsonPath = require.resolve("canvaskit-wasm/package.json");
} catch {
  try {
    packageJsonPath = require.resolve(
      "@shopify/react-native-skia/node_modules/canvaskit-wasm/package.json"
    );
  } catch {
    packageJsonPath = null;
  }
}

if (!packageJsonPath) {
  if (fs.existsSync(dest)) {
    console.log("ℹ️  canvaskit-wasm no está instalado, pero public/canvaskit.wasm ya existe.");
    process.exit(0);
  }
  console.warn("⚠️  No se encontró canvaskit-wasm en node_modules.");
  process.exit(0);
}

const source = path.join(
  path.dirname(packageJsonPath),
  "bin",
  "full",
  "canvaskit.wasm",
);

if (!fs.existsSync(source)) {
  if (fs.existsSync(dest)) {
    console.log("ℹ️  No se encontró source en canvaskit-wasm, pero public/canvaskit.wasm ya existe.");
    process.exit(0);
  }
  console.warn("⚠️  No se encontró canvaskit.wasm en canvaskit-wasm.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });

const sourceSize = fs.statSync(source).size;
const upToDate = fs.existsSync(dest) && fs.statSync(dest).size === sourceSize;

if (!upToDate) {
  fs.copyFileSync(source, dest);
  console.log(
    `✅ CanvasKit copiado a public/canvaskit.wasm (${(
      sourceSize /
      1024 /
      1024
    ).toFixed(1)} MB)`,
  );
}
