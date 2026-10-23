import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const debugPort = 9222;
const appUrl = 'http://127.0.0.1:8082/rutinas';
const outDir = 'artifacts';

const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++sequence;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Evaluation failed');
  }
  return result.result.value;
}

async function waitFor(expression, label, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${label}`);
}

async function screenshot(name) {
  const result = await cdp('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = `${outDir}/${name}.png`;
  fs.writeFileSync(path, Buffer.from(result.data, 'base64'));
  return path;
}

async function clickByText(text) {
  return evaluate(`(() => {
    const target = [...document.querySelectorAll('*')].find(
      (element) => element.children.length === 0 && element.textContent?.trim() === ${JSON.stringify(text)}
    );
    if (!target) return false;
    const button = target.closest('[role="button"]') || target.parentElement;
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);
}

async function clickByLabel(label) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label]')].find(
      (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)}
    );
    if (!button) return false;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: 1000,
  height: 800,
  screenWidth: 1000,
  screenHeight: 800,
  deviceScaleFactor: 1,
  mobile: false,
});

await cdp('Page.navigate', { url: appUrl });
await waitFor(
  `document.body.innerText.includes('Planes & Rutinas') || document.body.innerText.includes('Iniciar sesión') || document.body.innerText.includes('Correo')`,
  'initial screen'
);
await sleep(1500);

const initial = await evaluate(`({
  url: location.href,
  title: document.title,
  text: document.body.innerText.slice(0, 1600),
  shiny: [...document.querySelectorAll('.shiny-text')].map((element) => ({
    text: element.textContent,
    rect: element.getBoundingClientRect().toJSON(),
    lineHeight: getComputedStyle(element).lineHeight
  }))
})`);
fs.writeFileSync(`${outDir}/qa-initial.json`, JSON.stringify(initial, null, 2));
await screenshot('qa-initial');

const opened = await clickByText('Abrir plan');
if (!opened) {
  const openedByLabel = await clickByLabel('Abrir plan Upper-Lower (Gym)');
  if (!openedByLabel) throw new Error('No se encontró Abrir plan');
}

await waitFor(
  `document.title.includes('Upper-Lower') && !!document.querySelector('.shiny-text')`,
  'detail screen'
);
await sleep(1500);

const detail = await evaluate(`({
  url: location.href,
  title: document.title,
  text: document.body.innerText.slice(0, 2200),
  shiny: [...document.querySelectorAll('.shiny-text')].map((element) => ({
    text: element.textContent,
    rect: element.getBoundingClientRect().toJSON(),
    lineHeight: getComputedStyle(element).lineHeight
  })),
  scrollHeight: document.scrollingElement?.scrollHeight,
  innerHeight
})`);
fs.writeFileSync(`${outDir}/qa-detail.json`, JSON.stringify(detail, null, 2));
await screenshot('qa-detail');

console.log(JSON.stringify({ initial, detail }, null, 2));
ws.close();
