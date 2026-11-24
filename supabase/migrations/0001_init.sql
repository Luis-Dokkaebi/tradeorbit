-- Kiilonova Trade MVP — initial schema (14 entities, SDD § Modelo de datos y contratos).
-- Derived from src/shared/schemas.ts (the persisted subset); if a field changes, it changes there first.
--
-- Security model
--  * Every tenant row carries org_id; keys and foreign keys are composite (org_id, id), so rows can
--    never reference another organization and ids reveal nothing across tenants.
--  * RLS (forced) isolates by app.current_org(), read from the JWT claim org_id. The claim must be
--    injected by an auth hook from app_metadata, never from user-editable metadata.
--  * Tenants get no DELETE/TRUNCATE anywhere. State changes with external meaning (submit, approve,
--    reject) only happen through SECURITY DEFINER functions that take the approver from the JWT.
--  * payment_proposals.execute is false by CHECK (principle 1). audit_log is append-only and its hash
--    chain is computed by the database (principle 7). Policies are inserted only as sandbox and
--    tenants have no UPDATE on them: there is no deployment path (US-11).

create extension if not exists pgcrypto;
create schema if not exists app;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;

create or replace function app.claims() returns jsonb
language sql stable set search_path = pg_catalog as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- Organization of the caller. Fails closed (null) on a missing or malformed claim.
create or replace function app.current_org() returns uuid
language plpgsql stable set search_path = pg_catalog as $$
begin
  return nullif(app.claims() ->> 'org_id', '')::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- Human identity of the caller for approvals: display name if present, else the auth subject.
create or replace function app.current_person() returns text
language sql stable set search_path = pg_catalog as $$
  select nullif(trim(coalesce(app.claims() ->> 'name', app.claims() ->> 'sub', '')), '')
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.suppliers (
  org_id uuid not null references public.organizations(id),
  id uuid not null default gen_random_uuid(),
  name text not null,
  country char(2) not null,
  kyb_status text not null check (kyb_status in ('demo_verificado', 'demo_pendiente')),
  demo boolean not null default true check (demo),
  primary key (org_id, id)
);

create table public.shipments (
  org_id uuid not null references public.organizations(id),
  id text not null check (id ~ '^SHP-[0-9]{4}$'),
  supplier_id uuid not null,
  status text not null check (status in ('abierto','en_revision','en_transito','retraso','entregado','conciliado')),
  goods text not null check (length(goods) <= 160),
  hs_code text,
  quantity integer not null check (quantity > 0),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('MXN','USD','USDC','CNY')),
  eta date not null,
  created_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, supplier_id) references public.suppliers(org_id, id)
);

create table public.documents (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  type text not null check (type in ('orden_compra','factura','lista_empaque','comprobante_pago','transporte')),
  storage_path text not null,
  status text not null check (status in ('extraido','revision_manual')),
  fields jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id),
  check (storage_path like org_id::text || '/%' and storage_path not like '%..%')
);

create table public.discrepancies (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  type text not null check (type in ('importe','cantidad','proveedor')),
  severity text not null check (severity in ('alta','media','baja')),
  document_ids text[] not null check (cardinality(document_ids) between 2 and 10),
  expected text not null,
  found text not null,
  status text not null check (status in ('abierta','resuelta')),
  task text not null,
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id)
);

-- Global, versioned reference table: readable by every tenant, written only by maintainers.
create table public.tariff_rules (
  hs_code text not null check (hs_code ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$'),
  version integer not null check (version > 0),
  nico text,
  description text not null,
  rate numeric(6,4) not null check (rate >= 0),
  noms jsonb not null default '[]'::jsonb,
  source text not null check (length(source) > 10),
  published_at date not null,
  valid_from date not null,
  valid_to date,
  verification text not null check (verification in ('verificada','por_verificar')),
  primary key (hs_code, version)
);

create table public.landed_cost_quotes (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  inputs jsonb not null,
  components jsonb not null,
  total_mxn numeric(16,2) not null,
  rule_hs_code text not null,
  rule_version integer not null,
  created_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id),
  foreign key (rule_hs_code, rule_version) references public.tariff_rules(hs_code, version)
);

create table public.payment_proposals (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  corridor text not null check (corridor = 'MX-CN'),
  route text not null check (route in ('banco','riel_stablecoin')),
  send_amount_mxn numeric(16,2) not null check (send_amount_mxn > 0),
  fx_rate numeric(12,6) not null check (fx_rate > 0),
  fees jsonb not null,
  gross_usd numeric(16,2) not null,
  net_usd numeric(16,2) not null,
  status text not null check (status in ('propuesta','en_aprobacion','autorizada_simulada','rechazada')),
  mode text not null default 'simulation' check (mode = 'simulation'),
  requires_human_approval boolean not null default true check (requires_human_approval),
  execute boolean not null default false check (execute = false), -- principle 1
  version integer not null default 1 check (version > 0),
  demo boolean not null default true check (demo),
  created_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id)
);

create table public.approvals (
  org_id uuid not null references public.organizations(id),
  id uuid not null default gen_random_uuid(),
  proposal_id text not null,
  approver text not null check (length(trim(approver)) >= 3),
  decision text not null check (decision in ('aprobada','rechazada')),
  reason text check (reason is null or length(reason) <= 500),
  version integer not null,
  decided_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, proposal_id) references public.payment_proposals(org_id, id),
  check (decision = 'aprobada' or length(trim(coalesce(reason, ''))) >= 5) -- a rejection requires a reason
);

create table public.shipment_events (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  type text not null check (type in ('orden_confirmada','embarque','transito','arribo','liberacion','entrega')),
  date date not null,
  estimated boolean not null,
  origin text not null check (origin in ('demo','manual')),
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id)
);

create table public.reconciliations (
  org_id uuid not null references public.organizations(id),
  id text not null,
  shipment_id text not null,
  ordered numeric(16,2) not null,
  invoiced numeric(16,2) not null,
  paid numeric(16,2) not null,
  received_qty integer not null,
  balance numeric(16,2) not null,
  status text not null check (status in ('conciliado','con_diferencia','pendiente')),
  primary key (org_id, id),
  foreign key (org_id, shipment_id) references public.shipments(org_id, id)
);

create table public.audit_log (
  org_id uuid not null references public.organizations(id),
  seq bigint not null,
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('persona','agente','sistema')),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  prev_hash text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  primary key (org_id, seq),
  unique (org_id, prev_hash)
);

create table public.agent_runs (
  org_id uuid not null references public.organizations(id),
  id text not null,
  agent text not null,
  input text not null,
  output text not null,
  model text not null,
  policy_version text not null,
  latency_ms integer not null check (latency_ms >= 0),
  cost_usd numeric(12,4) not null default 0,
  outcome text not null check (outcome in ('ok','hold')),
  hold_reason text,
  replay boolean not null default false,
  at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.policies (
  org_id uuid not null references public.organizations(id),
  id text not null,
  agent text not null,
  version text not null,
  scope text not null,
  status text not null check (status in ('activa','sandbox')),
  proposed_by text not null,
  approved_by text,
  evaluation jsonb,
  primary key (org_id, id),
  check (status = 'sandbox' or approved_by is not null)
);

-- ── Append-only audit log with database-computed hash chain (principle 7, NFR-06) ──
create or replace function app.audit_log_immutable() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'audit_log es solo de agregar: % no permitido', tg_op using errcode = '42501';
end $$;
create trigger audit_log_no_update before update on public.audit_log for each row execute function app.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log for each row execute function app.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function app.audit_log_immutable();

create or replace function app.audit_log_chain() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare last record;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  select seq, content_hash into last from public.audit_log where org_id = new.org_id order by seq desc limit 1;
  new.seq := coalesce(last.seq + 1, 0);
  new.at := now();
  new.prev_hash := coalesce(last.content_hash, repeat('0', 64));
  new.content_hash := encode(public.digest(concat_ws('|', new.org_id, new.seq, new.at, new.actor_type, new.actor, new.action,
                                                   new.entity, new.entity_id, new.payload_hash, new.prev_hash), 'sha256'), 'hex');
  return new;
end $$;
create trigger audit_log_chain before insert on public.audit_log for each row execute function app.audit_log_chain();

-- ── Proposals: inserted only as 'propuesta'; transitions only through the functions below ──
create or replace function app.proposal_insert_guard() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if new.status <> 'propuesta' or new.version <> 1 then
    raise exception 'Una propuesta nace en estado propuesta, versión 1' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger payment_proposals_insert_guard before insert on public.payment_proposals for each row execute function app.proposal_insert_guard();

create or replace function app.submit_proposal(p_id text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare org uuid := app.current_org();
begin
  if org is null or app.current_person() is null then raise exception 'Sesión sin organización o sin persona' using errcode = '42501'; end if;
  update public.payment_proposals set status = 'en_aprobacion'
   where org_id = org and id = p_id and status = 'propuesta';
  if not found then raise exception 'La propuesta no existe o no está en estado propuesta'; end if;
end $$;

-- Records the human decision. The approver is the caller's identity from the JWT, never a parameter.
create or replace function app.decide_proposal(p_id text, p_decision text, p_reason text, p_version integer) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  org uuid := app.current_org();
  person text := app.current_person();
  approval_id uuid;
begin
  if org is null or person is null then raise exception 'Sesión sin organización o sin persona' using errcode = '42501'; end if;
  if p_decision not in ('aprobada', 'rechazada') then raise exception 'Decisión inválida'; end if;
  perform 1 from public.payment_proposals
   where org_id = org and id = p_id and status = 'en_aprobacion' and version = p_version for update;
  if not found then raise exception 'La propuesta no está en la bandeja o cambió de versión'; end if;
  insert into public.approvals (org_id, proposal_id, approver, decision, reason, version)
       values (org, p_id, person, p_decision, nullif(trim(p_reason), ''), p_version)
    returning id into approval_id;
  update public.payment_proposals
     set status = case when p_decision = 'aprobada' then 'autorizada_simulada' else 'rechazada' end
   where org_id = org and id = p_id;
  return approval_id;
end $$;

-- ── Policies: born in sandbox; promotion only by a maintainer who is not the proposer ──
create or replace function app.policy_insert_guard() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if new.status <> 'sandbox' or new.approved_by is not null then
    raise exception 'Una política nueva nace en sandbox y sin aprobación' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger policies_insert_guard before insert on public.policies for each row execute function app.policy_insert_guard();

create or replace function app.policy_promotion_guard() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if old.status = 'sandbox' and new.status = 'activa' and (new.approved_by is null or new.approved_by = new.proposed_by) then
    raise exception 'Una política en sandbox solo pasa a activa con la aprobación de una persona distinta de quien la propuso';
  end if;
  return new;
end $$;
create trigger policies_promotion_guard before update on public.policies for each row execute function app.policy_promotion_guard();

-- ── Privileges: start from nothing, then grant the minimum ───────────────────
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema app revoke all on functions from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['suppliers','shipments','documents','discrepancies','landed_cost_quotes','payment_proposals',
                            'approvals','shipment_events','reconciliations','agent_runs','policies','audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (org_id = app.current_org()) with check (org_id = app.current_org())', t || '_org', t);
  end loop;
end $$;

-- Mutable working tables: read, insert, update. No delete.
grant select, insert, update on public.suppliers, public.shipments, public.documents, public.discrepancies,
  public.shipment_events, public.reconciliations to authenticated;
-- Append-only tables: read and insert.
grant select, insert on public.landed_cost_quotes, public.payment_proposals, public.agent_runs, public.policies,
  public.audit_log to authenticated;
-- Approvals are written only by app.decide_proposal.
grant select on public.approvals to authenticated;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
create policy organizations_self on public.organizations for select to authenticated using (id = app.current_org());
grant select on public.organizations to authenticated;

alter table public.tariff_rules enable row level security;
create policy tariff_rules_read on public.tariff_rules for select to authenticated using (true);
grant select on public.tariff_rules to authenticated;

grant usage on schema app to authenticated;
grant execute on function app.claims(), app.current_org(), app.current_person(),
  app.submit_proposal(text), app.decide_proposal(text, text, text, integer) to authenticated;

-- ── Private document storage, isolated by organization folder (only on Supabase) ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
    execute $p$create policy documents_org_read on storage.objects for select to authenticated
      using (bucket_id = 'documents' and (storage.foldername(name))[1] = app.current_org()::text)$p$;
    execute $p$create policy documents_org_write on storage.objects for insert to authenticated
      with check (bucket_id = 'documents' and (storage.foldername(name))[1] = app.current_org()::text)$p$;
  end if;
end $$;
