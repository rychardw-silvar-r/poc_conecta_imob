-- ============================================================
-- Conecta Imob - schema inicial
-- ============================================================

create type categoria_lead as enum ('aluguel', 'venda', 'investimento', 'construcao');
create type status_lead as enum ('novo', 'em_atendimento', 'qualificado', 'fechado', 'perdido');
create type papel_usuario as enum ('captador', 'comercial', 'admin');

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique, -- formato E.164 com +, ex: +5511999998888
  papel papel_usuario not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  captador_id uuid references usuarios(id) on delete set null,
  comercial_id uuid references usuarios(id) on delete set null,

  audio_url text,
  whatsapp_media_id text unique,
  transcricao text,

  categoria categoria_lead,
  nome_cliente text,
  telefone_cliente text,
  descricao text,
  caracteristicas jsonb not null default '{}'::jsonb,

  status status_lead not null default 'novo',
  confirmado_captador boolean not null default false
);

create table interacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  autor_id uuid references usuarios(id) on delete set null,
  tipo text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index idx_leads_status on leads(status);
create index idx_leads_categoria on leads(categoria);
create index idx_leads_comercial on leads(comercial_id);
create index idx_leads_created on leads(created_at desc);
create index idx_interacoes_lead on interacoes(lead_id);

-- Bucket de áudios (público, mas URLs são unguessable via UUID)
insert into storage.buckets (id, name, public)
values ('audios-captacao', 'audios-captacao', true)
on conflict (id) do nothing;

-- Seed dos 5 sócios. AJUSTE OS TELEFONES antes de rodar em produção.
insert into usuarios (nome, telefone, papel) values
  ('Captador 1', '+5511900000001', 'captador'),
  ('Captador 2', '+5511900000002', 'captador'),
  ('Captador 3', '+5511900000003', 'captador'),
  ('Comercial 1', '+5511900000004', 'comercial'),
  ('Comercial 2', '+5511900000005', 'comercial');
