import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const debugPort = 9222;
const appUrl = 'http://127.0.0.1:8083/rutinas';
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
    await sleep(400);
  }
  throw new Error(`Timeout waiting for ${label}`);
}

async function setViewport(width, height) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(900);
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

async function clickByLabelPrefix(prefix) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label]')].find(
      (element) => (element.getAttribute('aria-label') || '').startsWith(${JSON.stringify(prefix)})
    );
    if (!button) return false;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);
}

async function snapshot(name) {
  const state = await evaluate(`({
    url: location.href,
    title: document.title,
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    text: document.body.innerText.slice(0, 3000),
    shiny: [...document.querySelectorAll('.shiny-text')].map((element) => ({
      text: element.textContent,
      rect: element.getBoundingClientRect().toJSON(),
      lineHeight: getComputedStyle(element).lineHeight
    })),
    horizontalOverflow: [...document.querySelectorAll('*')]
      .filter((element) => element.scrollWidth > element.clientWidth + 4 && element.clientWidth > 0)
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: getComputedStyle(element).overflowX,
        text: element.textContent?.slice(0, 50)
      }))
  })`);
  fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify(state, null, 2));
  await screenshot(name);
  return state;
}

async function scrollContent(top) {
  return evaluate(`(() => {
    const scrollers = [...document.querySelectorAll('div')].filter((element) => {
      const style = getComputedStyle(element);
      return element.scrollHeight > element.clientHeight + 30 && (style.overflowY === 'auto' || style.overflowY === 'scroll');
    });
    const scroller = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!scroller) return false;
    scroller.scrollTop = ${top};
    return { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
  })()`);
}

async function closeActionSheet() {
  const closed = await clickByLabel('Cerrar menú');
  if (!closed) {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('[role="button"]')].find((element) => element.textContent?.trim() === 'close');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    })()`);
  }
  await sleep(500);
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await setViewport(390, 844);
await cdp('Page.navigate', { url: appUrl });
await waitFor(`document.body.innerText.includes('Planes & Rutinas')`, 'initial screen');
await sleep(1200);

const report = {};
report.phoneFirst = await snapshot('qa-clean-phone-first');

if (!(await clickByText('Abrir plan'))) throw new Error('No se encontró Abrir plan');
await waitFor(`document.title.includes('Upper-Lower')`, 'detail screen');
await sleep(1200);
report.phoneDetail = await snapshot('qa-clean-phone-detail');

if (await clickByLabel('Buscar rutinas')) {
  await sleep(700);
  report.phoneSearchOpen = await snapshot('qa-clean-phone-search-open');
  await clickByLabel('Cerrar búsqueda de rutinas');
  await sleep(500);
}

if (await clickByLabel('Opciones del plan')) {
  await sleep(700);
  report.phonePlanActions = await snapshot('qa-clean-phone-plan-actions');
  await closeActionSheet();
}

if (await clickByLabelPrefix('Más opciones de')) {
  await sleep(700);
  report.phoneRoutineActions = await snapshot('qa-clean-phone-routine-actions');
  await closeActionSheet();
}

if (await clickByLabel('Abrir menú de cuenta')) {
  await sleep(700);
  report.phoneAccount = await snapshot('qa-clean-phone-account');
  await clickByLabel('Cerrar menú de cuenta');
  await sleep(500);
}

const scrollResult = await scrollContent(520);
await sleep(700);
report.phoneScrolled = { scrollResult, state: await snapshot('qa-clean-phone-scrolled') };

if (await clickByLabel('Volver a todos los planes')) {
  await waitFor(`document.body.innerText.includes('Planes & Rutinas') && document.title.includes('Planes')`, 'back to plans');
  await sleep(800);
}

await setViewport(320, 700);
report.narrowFirst = await snapshot('qa-clean-narrow-first');
if (await clickByText('Abrir plan')) {
  await waitFor(`document.title.includes('Upper-Lower')`, 'narrow detail');
  await sleep(1000);
  report.narrowDetail = await snapshot('qa-clean-narrow-detail');
  await clickByLabel('Volver a todos los planes');
  await sleep(700);
}

await setViewport(1024, 768);
report.tabletFirst = await snapshot('qa-clean-tablet-first');
if (await clickByText('Abrir plan')) {
  await waitFor(`document.title.includes('Upper-Lower')`, 'tablet detail');
  await sleep(1000);
  report.tabletDetail = await snapshot('qa-clean-tablet-detail');
  await clickByLabel('Volver a todos los planes');
  await sleep(700);
}

await setViewport(844, 390);
report.landscapeFirst = await snapshot('qa-clean-landscape-first');
if (await clickByText('Abrir plan')) {
  await waitFor(`document.title.includes('Upper-Lower')`, 'landscape detail');
  await sleep(1000);
  report.landscapeDetail = await snapshot('qa-clean-landscape-detail');
}

console.log(JSON.stringify(report, null, 2));
ws.close();
