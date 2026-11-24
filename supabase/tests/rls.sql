-- Sensor for NFR-05 (organization isolation), NFR-06 (append-only, DB-chained audit log),
-- principle 1 (execute=false) and principle 2 (only a person decides, through app.decide_proposal).
-- Runs against a throwaway database (harness/scripts/db-test.sh). Stops at the first unexpected success.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\o /dev/null
begin;
insert into public.organizations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Org A (DEMO)'),
  ('22222222-2222-2222-2222-222222222222', 'Org B (DEMO)');
insert into public.tariff_rules values ('6205.20.01', 1, null, 'Camisas de algodón', 0.35, '[]', 'TIGIE DOF 19/12/2024 (por verificar)', '2024-12-19', '2024-12-20', null, 'por_verificar');
commit;

set role authenticated;
select set_config('request.jwt.claims', '{"org_id":"11111111-1111-1111-1111-111111111111","sub":"u-a","name":"Dirección A (DEMO)"}', false);
insert into public.suppliers (org_id, id, name, country, kyb_status) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Proveedor ficticio', 'CN', 'demo_verificado');
insert into public.shipments (org_id, id, supplier_id, status, goods, quantity, amount, currency, eta)
  values ('11111111-1111-1111-1111-111111111111', 'SHP-0001', 'aaaaaaaa-0000-0000-0000-000000000001', 'abierto', 'Camisas', 200, 5480.00, 'USD', '2026-12-12');
insert into public.audit_log (org_id, actor_type, actor, action, entity, entity_id, payload_hash, content_hash, prev_hash)
  values ('11111111-1111-1111-1111-111111111111', 'persona', 'Dirección (DEMO)', 'expediente.creado', 'shipments', 'SHP-0001', repeat('b', 64), repeat('f', 64), repeat('f', 64));
insert into public.audit_log (org_id, actor_type, actor, action, entity, entity_id, payload_hash, content_hash, prev_hash)
  values ('11111111-1111-1111-1111-111111111111', 'persona', 'Dirección (DEMO)', 'documento.subido', 'documents', 'X', repeat('c', 64), repeat('f', 64), repeat('f', 64));
insert into public.payment_proposals (org_id, id, shipment_id, corridor, route, send_amount_mxn, fx_rate, fees, gross_usd, net_usd, status)
  values ('11111111-1111-1111-1111-111111111111', 'PRO-0001', 'SHP-0001', 'MX-CN', 'banco', 100000, 18.25, '[]', 5479.45, 5342.26, 'propuesta'),
         ('11111111-1111-1111-1111-111111111111', 'PRO-0002', 'SHP-0001', 'MX-CN', 'riel_stablecoin', 100000, 18.25, '[]', 5479.45, 5418.17, 'propuesta');
\o
\echo ok: org A writes its own rows

-- 1) The database computes the audit chain; client-sent hashes are ignored
do $$ declare a record; b record; begin
  select * into a from public.audit_log where seq = 0;
  select * into b from public.audit_log where seq = 1;
  if a.prev_hash <> repeat('0', 64) or b.prev_hash <> a.content_hash or a.content_hash = repeat('f', 64) then
    raise exception 'FALLO: cadena de bitácora no calculada por la base';
  end if;
end $$;
\echo ok: audit chain computed by the database

-- 2) Org B cannot see Org A rows; ids do not collide across organizations
\o /dev/null
select set_config('request.jwt.claims', '{"org_id":"22222222-2222-2222-2222-222222222222","sub":"u-b","name":"Org B (DEMO)"}', false);
\o
do $$ begin
  if (select count(*) from public.shipments) <> 0 or (select count(*) from public.audit_log) <> 0
     or (select count(*) from public.payment_proposals) <> 0 then
    raise exception 'FALLO: acceso cruzado entre organizaciones';
  end if;
  insert into public.suppliers (org_id, id, name, country, kyb_status) values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'Otro proveedor ficticio', 'CN', 'demo_pendiente');
  insert into public.shipments (org_id, id, supplier_id, status, goods, quantity, amount, currency, eta)
    values ('22222222-2222-2222-2222-222222222222', 'SHP-0001', 'bbbbbbbb-0000-0000-0000-000000000001', 'abierto', 'Camisas', 10, 100, 'USD', '2026-12-12');
end $$;
\echo ok: org B sees 0 rows of org A and reuses ids without an existence oracle

-- 3) Org B cannot write rows for Org A, nor link its rows to Org A rows
do $$ begin
  begin
    insert into public.shipment_events (org_id, id, shipment_id, type, date, estimated, origin)
      values ('11111111-1111-1111-1111-111111111111', 'EVT-X', 'SHP-0001', 'arribo', '2026-12-01', false, 'manual');
    raise exception 'FALLO: escritura cruzada permitida';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.shipments (org_id, id, supplier_id, status, goods, quantity, amount, currency, eta)
      values ('22222222-2222-2222-2222-222222222222', 'SHP-0002', 'aaaaaaaa-0000-0000-0000-000000000001', 'abierto', 'x', 1, 1, 'USD', '2026-12-12');
    raise exception 'FALLO: vínculo a proveedor de otra organización';
  exception when foreign_key_violation then null;
  end;
end $$;
\echo ok: cross-org insert and cross-org linking rejected

\o /dev/null
select set_config('request.jwt.claims', '{"org_id":"11111111-1111-1111-1111-111111111111","sub":"u-a","name":"Dirección A (DEMO)"}', false);
\o

-- 4) Audit log cannot be edited or removed
do $$ begin
  begin update public.audit_log set action = 'otra'; raise exception 'FALLO: update en audit_log'; exception when insufficient_privilege then null; end;
  begin delete from public.audit_log; raise exception 'FALLO: borrado en audit_log'; exception when insufficient_privilege then null; end;
end $$;
\echo ok: audit_log update/delete rejected

-- 5) Proposals: no direct status change, no execute=true, no direct approvals
do $$ begin
  begin update public.payment_proposals set status = 'autorizada_simulada'; raise exception 'FALLO: cambio directo de estado'; exception when insufficient_privilege then null; end;
  begin update public.payment_proposals set execute = true; raise exception 'FALLO: execute=true'; exception when insufficient_privilege then null; end;
  begin
    insert into public.approvals (org_id, proposal_id, approver, decision, version)
      values ('11111111-1111-1111-1111-111111111111', 'PRO-0001', 'Cualquiera', 'aprobada', 1);
    raise exception 'FALLO: aprobación directa sin función';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.payment_proposals (org_id, id, shipment_id, corridor, route, send_amount_mxn, fx_rate, fees, gross_usd, net_usd, status)
      values ('11111111-1111-1111-1111-111111111111', 'PRO-9', 'SHP-0001', 'MX-CN', 'banco', 1, 1, '[]', 1, 1, 'autorizada_simulada');
    raise exception 'FALLO: propuesta nacida autorizada';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.payment_proposals (org_id, id, shipment_id, corridor, route, send_amount_mxn, fx_rate, fees, gross_usd, net_usd, status, execute)
      values ('11111111-1111-1111-1111-111111111111', 'PRO-8', 'SHP-0001', 'MX-CN', 'banco', 1, 1, '[]', 1, 1, 'propuesta', true);
    raise exception 'FALLO: execute=true al insertar';
  exception when check_violation then null;
  end;
end $$;
\echo ok: proposals cannot be authorized or executed directly

-- 6) Decisions go through app.decide_proposal with the approver from the JWT
do $$ declare who text; begin
  begin perform app.decide_proposal('PRO-0001', 'aprobada', null, 1); raise exception 'FALLO: decisión fuera de la bandeja'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform app.submit_proposal('PRO-0001');
  perform app.submit_proposal('PRO-0002');
  begin perform app.decide_proposal('PRO-0002', 'rechazada', '  ', 1); raise exception 'FALLO: rechazo sin motivo'; exception when check_violation then null; end;
  begin perform app.decide_proposal('PRO-0001', 'aprobada', null, 2); raise exception 'FALLO: versión vieja aceptada'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform app.decide_proposal('PRO-0001', 'aprobada', null, 1);
  select approver into who from public.approvals where proposal_id = 'PRO-0001';
  if who <> 'Dirección A (DEMO)' then raise exception 'FALLO: aprobador no viene del JWT'; end if;
  if (select status from public.payment_proposals where id = 'PRO-0001') <> 'autorizada_simulada'
     or (select execute from public.payment_proposals where id = 'PRO-0001') then
    raise exception 'FALLO: estado tras aprobar';
  end if;
end $$;
\echo ok: decisions recorded by function, approver from JWT, rejection needs reason

-- 7) Policies are born in sandbox and tenants cannot promote them
do $$ begin
  begin
    insert into public.policies (org_id, id, agent, version, scope, status, proposed_by, approved_by)
      values ('11111111-1111-1111-1111-111111111111', 'POL-X', 'documental', 'v9', 'x', 'activa', 'proponente_politicas', 'alguien');
    raise exception 'FALLO: política nacida activa';
  exception when insufficient_privilege then null;
  end;
  insert into public.policies (org_id, id, agent, version, scope, status, proposed_by)
    values ('11111111-1111-1111-1111-111111111111', 'POL-Y', 'documental', 'v9', 'x', 'sandbox', 'proponente_politicas');
  begin
    update public.policies set status = 'activa', approved_by = 'alguien' where id = 'POL-Y';
    raise exception 'FALLO: inquilino promovió una política';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo ok: no deployment path for policies

-- 8) Tenants cannot write the tariff table; anon can read nothing
do $$ begin
  begin
    insert into public.tariff_rules values ('9999.99.99', 1, null, 'x', 0, '[]', 'fuente inventada x', '2026-01-01', '2026-01-01', null, 'verificada');
    raise exception 'FALLO: inquilino escribió tariff_rules';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform 1 from public.shipments; raise exception 'FALLO: anon lee expedientes'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.tariff_rules; raise exception 'FALLO: anon lee aranceles'; exception when insufficient_privilege then null; end;
end $$;
\echo ok: tariff_rules read-only for tenants, anon has no access
\echo ALL RLS CHECKS PASSED
