import fs from 'node:fs';

const target = 'src/app/(tabs)/rutinas.tsx';
const source = fs.readFileSync(target, 'utf8');
const screenRegex = /\r?\n  return \(\r?\n    <ScreenBackground>/g;
const stylesRegex = /\r?\nconst styles = StyleSheet\.create\(\{/g;

const screenMatches = [...source.matchAll(screenRegex)];
const stylesMatches = [...source.matchAll(stylesRegex)];

if (screenMatches.length !== 1) {
  throw new Error(`Marcador de return no único: ${screenMatches.length}`);
}
if (stylesMatches.length !== 1) {
  throw new Error(`Marcador de styles no único: ${stylesMatches.length}`);
}

const returnIndex = screenMatches[0].index ?? -1;
const stylesIndex = stylesMatches[0].index ?? -1;

if (returnIndex < 0 || stylesIndex <= returnIndex) {
  throw new Error(`Orden inesperado (${returnIndex}, ${stylesIndex})`);
}

const nextReturn = fs.readFileSync('artifacts/rutinas-return.tmp', 'utf8').trimEnd();
const nextStyles = fs.readFileSync('artifacts/rutinas-styles.tmp', 'utf8').trimEnd();

const result = `${source.slice(0, returnIndex)}\n${nextReturn}\n\n${nextStyles}\n`;
fs.writeFileSync(target, result, 'utf8');
console.log(`Spliced ${target}: ${source.length} -> ${result.length} chars`);
