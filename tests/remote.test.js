import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocRef, friendlyAuthError, validateCredentials, describeSyncError, PASSWORD_MIN, PASSWORD_MAX } from '../js/remote.js';
import { SYNC_TABLE } from '../js/config.js';

/** Cliente do Supabase de mentira: guarda as chamadas e devolve o que o teste mandar. */
function fakeClient({ selectResult, upsertResult } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        select(cols) {
          calls.push(['select', cols]);
          return {
            eq(col, val) {
              calls.push(['eq', col, val]);
              return { maybeSingle: async () => selectResult };
            }
          };
        },
        upsert: async (row, opts) => {
          calls.push(['upsert', row, opts]);
          return upsertResult || { error: null };
        }
      };
    }
  };
  return client;
}

test('get: linha existente vira exists + data()', async () => {
  const c = fakeClient({ selectResult: { data: { data: { items: [1], updatedAt: 5 } }, error: null } });
  const snap = await createDocRef(c, 'u1').get();
  assert.equal(snap.exists, true);
  assert.deepEqual(snap.data(), { items: [1], updatedAt: 5 });
  assert.deepEqual(c.calls, [['from', SYNC_TABLE], ['select', 'data'], ['eq', 'user_id', 'u1']]);
});

test('get: sem linha vira exists false', async () => {
  const snap = await createDocRef(fakeClient({ selectResult: { data: null, error: null } }), 'u1').get();
  assert.equal(snap.exists, false);
  assert.equal(snap.data(), null);
});

test('get: erro do servidor é lançado (storage.js mostra "sem conexão")', async () => {
  const c = fakeClient({ selectResult: { data: null, error: new Error('boom') } });
  await assert.rejects(() => createDocRef(c, 'u1').get(), /boom/);
});

test('set: grava na linha do próprio usuário, com upsert por user_id', async () => {
  const c = fakeClient();
  await createDocRef(c, 'u1').set({ version: 1, items: [], updatedAt: 9 });
  const up = c.calls.find((x) => x[0] === 'upsert');
  assert.equal(up[1].user_id, 'u1');
  assert.deepEqual(up[1].data, { version: 1, items: [], updatedAt: 9 });
  assert.ok(!Number.isNaN(Date.parse(up[1].updated_at)));
  assert.deepEqual(up[2], { onConflict: 'user_id' });
});

test('set: erro do servidor é lançado', async () => {
  const c = fakeClient({ upsertResult: { error: new Error('negado') } });
  await assert.rejects(() => createDocRef(c, 'u1').set({}), /negado/);
});

test('validateCredentials: e-mail inválido, senha vazia e senha curta no cadastro', () => {
  assert.match(validateCredentials('', 'x', 'signin'), /e-mail/i);
  assert.match(validateCredentials('semarroba', 'x', 'signin'), /e-mail/i);
  assert.match(validateCredentials('a@b', 'x', 'signin'), /e-mail/i);
  assert.match(validateCredentials('a@b.com', '', 'signin'), /senha/i);
  assert.match(validateCredentials('a@b.com', 'curta', 'signup'), new RegExp(String(PASSWORD_MIN)));
  assert.match(validateCredentials('a@b.com', 'x'.repeat(PASSWORD_MAX + 1), 'signup'), new RegExp(String(PASSWORD_MAX)));
});

test('validateCredentials: aceita dados bons; no login não exige tamanho mínimo', () => {
  assert.equal(validateCredentials(' pessoa@gmail.com ', 'senha-boa-123', 'signup'), '');
  assert.equal(validateCredentials('pessoa@gmail.com', 'antiga', 'signin'), '');
  assert.match(validateCredentials(null, 'x', 'signin'), /e-mail/i);
});

test('friendlyAuthError: erros conhecidos viram frases em português', () => {
  const cases = [
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, /incorretos/],
    [{ message: 'Invalid login credentials' }, /incorretos/],
    [{ code: 'user_already_exists', message: 'User already registered' }, /já tem conta/],
    [{ message: 'User already registered' }, /já tem conta/],
    [{ code: 'signup_disabled', message: 'Signups not allowed for this instance' }, /cadastros estão fechados/],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, /Confirme o e-mail/],
    [{ status: 429, message: 'x' }, /Muitas tentativas/],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, /Muitas tentativas/],
    [{ code: 'weak_password', message: 'Password should be at least 6 characters' }, /Senha fraca/],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, /Sem conexão/],
    [new TypeError('Failed to fetch'), /Sem conexão/]
  ];
  cases.forEach(([err, re]) => assert.match(friendlyAuthError(err), re, JSON.stringify(err)));
});

test('friendlyAuthError: erro desconhecido não vaza o texto técnico', () => {
  const msg = friendlyAuthError({ message: 'duplicate key value violates unique constraint "x_pkey"' });
  assert.doesNotMatch(msg, /duplicate|constraint|pkey/);
  assert.match(msg, /Tente de novo/);
  assert.match(friendlyAuthError(null), /Tente de novo/);
  assert.match(friendlyAuthError(undefined), /Tente de novo/);
});

test('describeSyncError: tabela que ainda não existe (o SQL não foi rodado)', () => {
  const real = { code: 'PGRST205', message: "Could not find the table 'public.planner_docs' in the schema cache", hint: 'Perhaps you meant ...' };
  const d = describeSyncError(real);
  assert.equal(d.kind, 'no-table');
  assert.match(d.text, /schema\.sql/);
  assert.match(d.text, /SQL Editor/);
  assert.match(d.short, /Tabela da conta não encontrada/);
  assert.equal(describeSyncError({ code: '42P01', message: 'relation "planner_docs" does not exist' }).kind, 'no-table');
});

test('describeSyncError: acesso recusado (permissões ou RLS)', () => {
  assert.equal(describeSyncError({ code: '42501', message: 'permission denied for table planner_docs' }).kind, 'permission');
  assert.equal(describeSyncError({ message: 'new row violates row-level security policy for table "planner_docs"' }).kind, 'permission');
  assert.equal(describeSyncError({ status: 403, message: 'x' }).kind, 'permission');
  assert.match(describeSyncError({ code: '42501' }).text, /schema\.sql/);
});

test('describeSyncError: chave inválida, sessão expirada e sem conexão', () => {
  assert.equal(describeSyncError({ message: 'Invalid API key' }).kind, 'key');
  assert.equal(describeSyncError({ message: 'No API key found in request' }).kind, 'key');
  assert.equal(describeSyncError({ code: 'PGRST301', message: 'JWT expired' }).kind, 'session');
  assert.equal(describeSyncError({ message: 'Invalid JWT' }).kind, 'session');
  assert.equal(describeSyncError(new TypeError('Failed to fetch')).kind, 'network');
  assert.equal(describeSyncError({ message: 'TypeError: Failed to fetch', details: '', code: '' }).kind, 'network');
  assert.equal(describeSyncError({ name: 'AuthRetryableFetchError', message: 'x' }).kind, 'network');
});

test('describeSyncError: erro desconhecido mostra um detalhe para diagnóstico e nunca quebra', () => {
  const d = describeSyncError({ code: '23505', message: 'duplicate key' });
  assert.equal(d.kind, 'other');
  assert.match(d.text, /23505/);
  assert.match(d.short, /23505/);
  assert.equal(describeSyncError(null).kind, 'other');
  assert.equal(describeSyncError(undefined).kind, 'other');
  assert.equal(describeSyncError('texto solto').kind, 'other');
});

test('describeSyncError: toda mensagem diz que os itens seguem salvos no aparelho', () => {
  [{ code: 'PGRST205' }, { code: '42501' }, { message: 'Invalid API key' }, { code: 'PGRST301' }, new TypeError('Failed to fetch'), {}].forEach((e) => {
    assert.match(describeSyncError(e).text, /seguem salvos neste aparelho/);
  });
});

test('describeSyncError: erro 500 é problema do servidor, não detalhe técnico', () => {
  const d = describeSyncError({ message: 'erro de teste', status: 503 });
  assert.equal(d.kind, 'server');
  assert.match(d.short, /Servidor da conta com problema/);
  assert.match(d.text, /alguns minutos/);
  assert.equal(describeSyncError({ status: 500 }).kind, 'server');
});

test('createDocRef: o código HTTP do Supabase viaja junto com o erro', async () => {
  const withStatus = (status, error) => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error, status }) }) }),
      upsert: async () => ({ error, status })
    })
  });
  const getErr = await createDocRef(withStatus(404, { code: 'PGRST205', message: 'x' }), 'u1').get().catch((e) => e);
  assert.equal(getErr.status, 404);
  const setErr = await createDocRef(withStatus(500, { message: 'y' }), 'u1').set({}).catch((e) => e);
  assert.equal(setErr.status, 500);
  assert.equal(describeSyncError(setErr).kind, 'server');
  const denied = await createDocRef(withStatus(403, { message: 'z' }), 'u1').set({}).catch((e) => e);
  assert.equal(describeSyncError(denied).kind, 'permission');
});
