const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const packageJson = require.resolve("canvaskit-wasm/package.json");
const source = path.join(
  path.dirname(packageJson),
  "bin",
  "full",
  "canvaskit.wasm",
);
const dest = path.join(root, "public", "canvaskit.wasm");

if (!fs.existsSync(source)) {
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
