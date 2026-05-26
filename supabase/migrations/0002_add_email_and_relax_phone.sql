-- ============================================================
-- Conecta Imob - migration 0002
-- Permite usuários sem telefone (comerciais não precisam de WhatsApp)
-- e adiciona email para login no dashboard.
-- ============================================================

alter table usuarios alter column telefone drop not null;
alter table usuarios add column email text unique;
