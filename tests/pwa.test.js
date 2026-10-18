/* Confere o PWA (site instalável e que abre sem internet): lista de arquivos do service worker,
   manifest, ícones e as tags do index.html. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function listFiles(dir) {
  const out = [];
  readdirSync(join(root, dir)).forEach((name) => {
    if (name.startsWith('.')) return;
    const rel = dir + '/' + name;
    if (statSync(join(root, rel)).isDirectory()) out.push(...listFiles(rel));
    else out.push(rel);
  });
  return out.sort();
}

function pngSize(path) {
  const b = readFileSync(join(root, path));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', path + ' não é um PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const sw = read('sw.js');
const match = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
assert.ok(match, 'não achei a lista PRECACHE em sw.js');
const precache = new Function('return ' + match[1])();
const manifest = JSON.parse(read('manifest.webmanifest'));
const html = read('index.html');

test('PRECACHE: todo arquivo listado existe', () => {
  precache.filter((p) => p !== './').forEach((p) => {
    assert.ok(existsSync(join(root, p)), 'sw.js lista "' + p + '", que não existe');
  });
});

test('PRECACHE: não tem itens repetidos', () => {
  const repeated = precache.filter((p, i) => precache.indexOf(p) !== i);
  assert.deepEqual(repeated, []);
});

test('PRECACHE: lista todos os arquivos do site (senão ele não abre offline)', () => {
  const expected = ['index.html', 'manifest.webmanifest', ...listFiles('js'), ...listFiles('css'), ...listFiles('assets/img')];
  expected.forEach((p) => {
    assert.ok(precache.includes(p), 'sw.js não lista "' + p + '": atualize PRECACHE e some 1 a CACHE_VERSION');
  });
});

test('CACHE_VERSION é um número inteiro positivo', () => {
  const v = sw.match(/const CACHE_VERSION = (\d+);/);
  assert.ok(v && Number(v[1]) >= 1);
});

test('manifest: campos obrigatórios para ser instalável', () => {
  ['name', 'short_name', 'start_url', 'scope', 'background_color', 'theme_color'].forEach((k) => {
    assert.ok(typeof manifest[k] === 'string' && manifest[k], 'falta "' + k + '" no manifest');
  });
  assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display));
});

test('manifest: ícones 192 e 512 (any) e um maskable, existentes e com o tamanho declarado', () => {
  const icons = manifest.icons;
  assert.ok(Array.isArray(icons) && icons.length >= 3);
  icons.forEach((ic) => {
    assert.ok(existsSync(join(root, ic.src)), 'ícone "' + ic.src + '" não existe');
    const [w, h] = pngSize(ic.src);
    assert.equal(ic.sizes, w + 'x' + h, ic.src + ' tem ' + w + 'x' + h + ', mas o manifest diz ' + ic.sizes);
  });
  ['192x192', '512x512'].forEach((s) => {
    assert.ok(icons.some((ic) => ic.sizes === s && ic.purpose === 'any'), 'falta ícone ' + s + ' com purpose "any"');
  });
  assert.ok(icons.some((ic) => ic.purpose === 'maskable'), 'falta um ícone maskable');
});

test('index.html: manifest, viewport, idioma, cor do tema e ícone da Apple', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /<link rel="apple-touch-icon" href="assets\/img\/apple-touch-icon\.png">/);
  const theme = html.match(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})">/);
  assert.ok(theme, 'falta <meta name="theme-color">');
  assert.equal(theme[1].toLowerCase(), manifest.theme_color.toLowerCase(), 'theme-color do HTML e do manifest devem ser iguais');
});

test('o registro do service worker aponta para um sw.js que existe', () => {
  const m = read('js/pwa.js').match(/register\('([^']+)'\)/);
  assert.ok(m, 'js/pwa.js não registra nenhum service worker');
  assert.ok(existsSync(join(root, m[1])), 'js/pwa.js registra "' + m[1] + '", que não existe');
});
