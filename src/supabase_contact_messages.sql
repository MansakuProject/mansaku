create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  category text not null check (category in ('bug', 'request', 'question', 'other')),
  message text not null,
  source text not null check (source in ('lp', 'app')),
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- 問い合わせはEdge FunctionのSERVICE_ROLE_KEYで保存する。
-- ブラウザから直接select/update/deleteさせないため、anon向けのselect/update/delete policyは作らない。
