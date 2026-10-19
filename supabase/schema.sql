-- Planner Acadêmico: tabela de sincronização entre aparelhos.
-- Cole este arquivo inteiro no painel do Supabase (SQL Editor → New query → Run).
-- É seguro rodar de novo: não apaga dados.
--
-- Um documento por conta. A segurança vem das políticas abaixo (RLS): cada conta só
-- enxerga e altera a própria linha. É isso que permite deixar a chave PÚBLICA no código do site.

create table if not exists public.planner_docs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint planner_docs_data_e_objeto check (jsonb_typeof(data) = 'object'),
  constraint planner_docs_data_tamanho check (pg_column_size(data) <= 5000000)
);

alter table public.planner_docs enable row level security;

-- Quem não está logado não alcança a tabela; quem está logado só passa pelas políticas.
revoke all on public.planner_docs from anon;
revoke all on public.planner_docs from authenticated;
grant select, insert, update, delete on public.planner_docs to authenticated;

drop policy if exists "planner_docs: ler a própria linha" on public.planner_docs;
create policy "planner_docs: ler a própria linha"
  on public.planner_docs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "planner_docs: criar a própria linha" on public.planner_docs;
create policy "planner_docs: criar a própria linha"
  on public.planner_docs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "planner_docs: alterar a própria linha" on public.planner_docs;
create policy "planner_docs: alterar a própria linha"
  on public.planner_docs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "planner_docs: apagar a própria linha" on public.planner_docs;
create policy "planner_docs: apagar a própria linha"
  on public.planner_docs for delete to authenticated
  using ((select auth.uid()) = user_id);
