/* Confere a estrutura do projeto, que não tem build: imports, ciclos, ids do HTML e arquivos referenciados.
   Pega o erro mais comum de refatoração (renomear um arquivo ou um id e esquecer um lugar). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

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

test('config.js usa só a chave PÚBLICA do Supabase', () => {
  assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/, 'SUPABASE_URL fora do formato esperado');
  const publishable = SUPABASE_KEY.startsWith('sb_publishable_');
  let legacyAnon = false;
  if (SUPABASE_KEY.startsWith('eyJ')) {
    const payload = JSON.parse(Buffer.from(SUPABASE_KEY.split('.')[1], 'base64url').toString('utf8'));
    legacyAnon = payload.role === 'anon';
  }
  assert.ok(publishable || legacyAnon, 'SUPABASE_KEY deve ser a chave publishable (sb_publishable_...) ou a antiga anon');
});

test('nenhuma chave secreta do Supabase aparece no código do site', () => {
  const targets = ['index.html', 'sw.js', 'manifest.webmanifest', 'README.md', ...files.map((f) => 'js/' + f)];
  targets.forEach((rel) => {
    const text = readFileSync(join(root, rel), 'utf8');
    assert.doesNotMatch(text, /sb_secret_[A-Za-z0-9_-]{8,}/, rel + ' contém uma chave secreta (sb_secret_...)');
    (text.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g) || []).forEach((jwt) => {
      let role = null;
      try { role = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')).role; } catch (e) { /* não é um JWT */ }
      assert.notEqual(role, 'service_role', rel + ' contém a chave service_role, que ignora toda a proteção do banco');
    });
  });
});

test('index.html carrega a biblioteca do Supabase antes de js/main.js', () => {
  const lib = html.indexOf('vendor/supabase-js-');
  const main = html.indexOf('js/main.js');
  assert.ok(lib > -1, 'index.html não carrega a biblioteca em vendor/');
  assert.ok(lib < main, 'a biblioteca precisa vir antes de js/main.js');
  assert.match(html.slice(lib - 30, lib), /<script defer src="$/, 'a biblioteca deve ser um <script defer> (não trava a página)');
});

test('supabase/schema.sql liga a RLS e protege as quatro operações da própria linha', () => {
  const sql = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.planner_docs from anon/i);
  ['select', 'insert', 'update', 'delete'].forEach((op) => {
    assert.match(sql, new RegExp('for ' + op + ' to authenticated', 'i'), 'falta a política de ' + op);
  });
  assert.doesNotMatch(sql, /to anon|to public|using\s*\(\s*true\s*\)/i, 'nenhuma política pode abrir para anônimos ou usar "true"');
  assert.match(sql, /auth\.uid\(\)\) = user_id/);
});

test('toda classe usada pelos painéis (conta, agenda, backup) tem CSS', () => {
  const css = readdirSync(join(root, 'css')).filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(root, 'css', f), 'utf8')).join('\n');
  const used = new Set();
  ['utils.js', 'account.js', 'agenda.js', 'backup.js'].forEach((f) => {
    matches(source[f], /\bel\(\s*'[a-z0-9]+'\s*,\s*'([^']+)'/g).forEach((c) => c.split(/\s+/).forEach((x) => used.add(x)));
    matches(source[f], /className\s*=\s*'([^']+)'/g).forEach((c) => c.split(/\s+/).forEach((x) => used.add(x)));
  });
  ['panel', 'panel-row', 'panel-actions', 'row-text', 'row-title', 'row-desc', 'hint'].forEach((c) => used.add(c));
  assert.ok(used.size > 8, 'o teste não achou classes: está quebrado?');
  used.forEach((c) => {
    assert.ok(new RegExp('\\.' + c.replace(/-/g, '\\-') + '(?![\\w-])').test(css), 'o JavaScript usa a classe "' + c + '", mas ela não existe em css/*.css');
  });
});

test('index.html tem o #ferramentas onde os painéis são montados', () => {
  assert.match(html, /<div class="panels" id="ferramentas"><\/div>/);
});
