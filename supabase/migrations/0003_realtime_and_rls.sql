-- ============================================================
-- Conecta Imob - migration 0003
-- Habilita RLS (necessario p/ Realtime) + adiciona leads e
-- interacoes a publicacao supabase_realtime.
-- ============================================================

-- RLS: leitura liberada para qualquer usuario autenticado.
-- Escritas (insert/update/delete) continuam sendo feitas pelo
-- service_role no backend, que bypassa RLS automaticamente.

alter table leads enable row level security;
drop policy if exists "auth users read leads" on leads;
create policy "auth users read leads"
  on leads for select to authenticated using (true);

alter table interacoes enable row level security;
drop policy if exists "auth users read interacoes" on interacoes;
create policy "auth users read interacoes"
  on interacoes for select to authenticated using (true);

-- Adiciona tabelas a publicacao do Realtime. Idempotente.
do $$
begin
  alter publication supabase_realtime add table leads;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table interacoes;
exception when duplicate_object then null;
end $$;
