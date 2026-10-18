/* Confere a estrutura do projeto, que não tem build: imports, ciclos, ids do HTML e arquivos referenciados.
   Pega o erro mais comum de refatoração (renomear um arquivo ou um id e esquecer um lugar). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'js');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const files = readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
const source = Object.fromEntries(files.map((f) => [f, readFileSync(join(jsDir, f), 'utf8')]));

function importsOf(code) {
  const found = [];
  const re = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(code))) found.push(m[1]);
  return found;
}

function matches(code, re) {
  const out = [];
  let m;
  while ((m = re.exec(code))) out.push(m[1]);
  return out;
}

test('todo import é relativo e aponta para um arquivo que existe em js/', () => {
  files.forEach((f) => {
    importsOf(source[f]).forEach((spec) => {
      assert.ok(spec.startsWith('./') && spec.endsWith('.js'), f + ': import "' + spec + '" deve ser relativo (./nome.js)');
      assert.ok(files.includes(spec.slice(2)), f + ' importa "' + spec + '", que não existe em js/');
    });
  });
});

test('os módulos não têm dependências circulares', () => {
  const graph = Object.fromEntries(files.map((f) => [f, importsOf(source[f]).map((s) => s.slice(2))]));
  const state = {};
  function visit(file, path) {
    if (state[file] === 'done') return;
    assert.notEqual(state[file], 'visiting', 'ciclo: ' + [...path, file].join(' → '));
    state[file] = 'visiting';
    (graph[file] || []).forEach((dep) => visit(dep, [...path, file]));
    state[file] = 'done';
  }
  files.forEach((f) => visit(f, []));
});

test('o index.html não repete ids', () => {
  const ids = matches(html, /\bid="([^"]+)"/g);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(repeated, [], 'ids repetidos no index.html');
});

test('todo id procurado pelo JavaScript existe no index.html', () => {
  const htmlIds = new Set(matches(html, /\bid="([^"]+)"/g));
  files.forEach((f) => {
    const used = [
      ...matches(source[f], /\$\(\s*'([\w-]+)'\s*\)/g),
      ...matches(source[f], /getElementById\(\s*'([\w-]+)'\s*\)/g)
    ];
    used.forEach((id) => {
      assert.ok(htmlIds.has(id), f + ' procura o id "' + id + '", que não existe no index.html');
    });
  });
});

test('os arquivos locais citados no index.html existem', () => {
  const refs = matches(html, /(?:href|src)="((?!https?:|\/\/|#|data:|mailto:)[^"]+)"/g);
  assert.ok(refs.length > 0, 'nenhuma referência local encontrada: o teste está quebrado?');
  refs.forEach((ref) => {
    const path = join(root, ref.split(/[?#]/)[0]);
    assert.ok(existsSync(path), 'index.html cita "' + ref + '", que não existe');
  });
});
