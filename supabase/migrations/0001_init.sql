-- Kiilonova Trade MVP — initial schema (14 entities, SDD § Modelo de datos y contratos).
-- Organization isolation by RLS, append-only audit log, execute=false enforced in the database.
-- Mirrors src/shared/schemas.ts; if a field changes, it changes there first.

create extension if not exists pgcrypto;
create schema if not exists app;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

-- Organization of the caller, from the JWT claims PostgREST/Supabase sets per request.
create or replace function app.current_org() returns uuid
language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'org_id', '')::uuid
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  country char(2) not null,
  kyb_status text not null check (kyb_status in ('demo_verificado', 'demo_pendiente')),
  demo boolean not null default true check (demo)
);

create table public.shipments (
  id text primary key check (id ~ '^SHP-[0-9]{4}$'),
  org_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id),
  status text not null check (status in ('abierto','en_revision','en_transito','retraso','entregado','conciliado')),
  goods text not null,
  hs_code text,
  quantity integer not null check (quantity > 0),
  amount numeric(14,2) not null,
  currency text not null check (currency in ('MXN','USD','USDC','CNY')),
  eta date not null,
  created_at timestamptz not null default now()
);

create table public.documents (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
  type text not null check (type in ('orden_compra','factura','lista_empaque','comprobante_pago','transporte')),
  storage_path text not null,
  status text not null check (status in ('extraido','revision_manual')),
  fields jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now()
);

create table public.discrepancies (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
  type text not null check (type in ('importe','cantidad','proveedor')),
  severity text not null check (severity in ('alta','media','baja')),
  document_ids text[] not null check (cardinality(document_ids) >= 2),
  expected text not null,
  found text not null,
  status text not null check (status in ('abierta','resuelta')),
  task text not null
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
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
  inputs jsonb not null,
  components jsonb not null,
  total_mxn numeric(16,2) not null,
  rule_hs_code text not null,
  rule_version integer not null,
  created_at timestamptz not null default now(),
  foreign key (rule_hs_code, rule_version) references public.tariff_rules(hs_code, version)
);

create table public.payment_proposals (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
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
  created_at timestamptz not null default now()
);

create table public.approvals (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  proposal_id text not null references public.payment_proposals(id),
  approver text not null check (length(trim(approver)) >= 3),
  decision text not null check (decision in ('aprobada','rechazada')),
  reason text,
  version integer not null,
  decided_at timestamptz not null default now(),
  check (decision = 'aprobada' or length(trim(coalesce(reason, ''))) >= 5) -- a rejection requires a reason
);

create table public.shipment_events (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
  type text not null check (type in ('orden_confirmada','embarque','transito','arribo','liberacion','entrega')),
  date date not null,
  estimated boolean not null,
  origin text not null check (origin in ('demo','manual'))
);

create table public.reconciliations (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  shipment_id text not null references public.shipments(id),
  ordered numeric(16,2) not null,
  invoiced numeric(16,2) not null,
  paid numeric(16,2) not null,
  received_qty integer not null,
  balance numeric(16,2) not null,
  status text not null check (status in ('conciliado','con_diferencia','pendiente'))
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id),
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('persona','agente','sistema')),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  prev_hash text not null check (prev_hash ~ '^[0-9a-f]{64}$')
);

create table public.agent_runs (
  id text primary key,
  org_id uuid not null references public.organizations(id),
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
  at timestamptz not null default now()
);

create table public.policies (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  agent text not null,
  version text not null,
  scope text not null,
  status text not null check (status in ('activa','sandbox')),
  proposed_by text not null,
  approved_by text,
  evaluation jsonb,
  check (status = 'sandbox' or approved_by is not null)
);

-- ── Append-only audit log (principle 7, NFR-06) ─────────────────────────────
create or replace function app.audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log es solo de agregar: % no permitido', tg_op using errcode = '42501';
end $$;
create trigger audit_log_no_update before update on public.audit_log for each row execute function app.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log for each row execute function app.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function app.audit_log_immutable();

-- A sandbox policy is never promoted by the agent that proposed it.
create or replace function app.policy_promotion_guard() returns trigger language plpgsql as $$
begin
  if old.status = 'sandbox' and new.status = 'activa' and (new.approved_by is null or new.approved_by = new.proposed_by) then
    raise exception 'Una política en sandbox solo pasa a activa con la aprobación de una persona distinta de quien la propuso';
  end if;
  return new;
end $$;
create trigger policies_promotion_guard before update on public.policies for each row execute function app.policy_promotion_guard();

-- ── Row level security: every tenant table isolated by organization ────────
do $$
declare t text;
begin
  foreach t in array array['suppliers','shipments','documents','discrepancies','landed_cost_quotes','payment_proposals',
                            'approvals','shipment_events','reconciliations','agent_runs','policies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (org_id = app.current_org()) with check (org_id = app.current_org())', t || '_org', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
create policy organizations_self on public.organizations for select to authenticated using (id = app.current_org());
grant select on public.organizations to authenticated;

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
create policy audit_log_read on public.audit_log for select to authenticated using (org_id = app.current_org());
create policy audit_log_append on public.audit_log for insert to authenticated with check (org_id = app.current_org());
grant select, insert on public.audit_log to authenticated;

alter table public.tariff_rules enable row level security;
create policy tariff_rules_read on public.tariff_rules for select to authenticated using (true);
grant select on public.tariff_rules to authenticated;

grant usage on schema app to authenticated;
grant execute on function app.current_org() to authenticated;

-- ── Private document storage (only when running on Supabase) ───────────────
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
  end if;
end $$;
