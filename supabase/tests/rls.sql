-- Sensor for NFR-05 (cross-organization access), NFR-06 (append-only log) and principle 1 (execute=false).
-- Runs against a throwaway database (harness/scripts/db-test.sh). Stops at the first unexpected success.
\set ON_ERROR_STOP 1
begin;
insert into public.organizations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Org A (DEMO)'),
  ('22222222-2222-2222-2222-222222222222', 'Org B (DEMO)');
insert into public.tariff_rules values ('6205.20.01', 1, null, 'Camisas de algodón', 0.35, '[]', 'TIGIE DOF 19/12/2024 (por verificar)', '2024-12-19', '2024-12-20', null, 'por_verificar');
commit;

set role authenticated;
select set_config('request.jwt.claims', '{"org_id":"11111111-1111-1111-1111-111111111111"}', false);
insert into public.suppliers (id, org_id, name, country, kyb_status) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Proveedor ficticio', 'CN', 'demo_verificado');
insert into public.shipments (id, org_id, supplier_id, status, goods, quantity, amount, currency, eta)
  values ('SHP-0001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'abierto', 'Camisas', 200, 5480.00, 'USD', '2026-12-12');
insert into public.audit_log (org_id, actor_type, actor, action, entity, entity_id, content_hash, prev_hash)
  values ('11111111-1111-1111-1111-111111111111', 'persona', 'Dirección (DEMO)', 'expediente.creado', 'shipments', 'SHP-0001', repeat('a', 64), repeat('0', 64));
insert into public.payment_proposals (id, org_id, shipment_id, corridor, route, send_amount_mxn, fx_rate, fees, gross_usd, net_usd, status)
  values ('PRO-0001', '11111111-1111-1111-1111-111111111111', 'SHP-0001', 'MX-CN', 'banco', 100000, 18.25, '[]', 5479.45, 5342.26, 'propuesta');
\echo ok: org A writes its own rows

-- 1) Org B cannot see Org A rows
select set_config('request.jwt.claims', '{"org_id":"22222222-2222-2222-2222-222222222222"}', false);
do $$ begin
  if (select count(*) from public.shipments) <> 0 or (select count(*) from public.audit_log) <> 0 then
    raise exception 'FALLO: acceso cruzado entre organizaciones';
  end if;
end $$;
\echo ok: org B sees 0 rows of org A

-- 2) Org B cannot write rows for Org A
do $$ begin
  begin
    insert into public.shipment_events (id, org_id, shipment_id, type, date, estimated, origin)
      values ('EVT-X', '11111111-1111-1111-1111-111111111111', 'SHP-0001', 'arribo', '2026-12-01', false, 'manual');
    raise exception 'FALLO: escritura cruzada permitida';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;
end $$;
\echo ok: cross-org insert rejected

select set_config('request.jwt.claims', '{"org_id":"11111111-1111-1111-1111-111111111111"}', false);

-- 3) Audit log cannot be edited or removed
do $$ begin
  begin update public.audit_log set action = 'otra'; raise exception 'FALLO: update en audit_log'; exception when insufficient_privilege then null; end;
  begin delete from public.audit_log; raise exception 'FALLO: borrado en audit_log'; exception when insufficient_privilege then null; end;
end $$;
\echo ok: audit_log update/delete rejected

-- 4) execute=true is impossible (principle 1)
do $$ begin
  begin update public.payment_proposals set execute = true; raise exception 'FALLO: execute=true aceptado'; exception when check_violation then null; end;
end $$;
\echo ok: execute=true rejected

-- 5) A rejection without reason is impossible (US-06)
do $$ begin
  begin
    insert into public.approvals (id, org_id, proposal_id, approver, decision, reason, version)
      values ('APR-X', '11111111-1111-1111-1111-111111111111', 'PRO-0001', 'Tesorería (DEMO)', 'rechazada', null, 1);
    raise exception 'FALLO: rechazo sin motivo aceptado';
  exception when check_violation then null;
  end;
end $$;
\echo ok: rejection without reason rejected

-- 6) An active policy needs a human approver, and the proposer cannot promote itself
do $$ begin
  begin
    insert into public.policies (id, org_id, agent, version, scope, status, proposed_by)
      values ('POL-X', '11111111-1111-1111-1111-111111111111', 'documental', 'v9', 'x', 'activa', 'proponente_politicas');
    raise exception 'FALLO: política activa sin aprobación';
  exception when check_violation then null;
  end;
  insert into public.policies (id, org_id, agent, version, scope, status, proposed_by)
    values ('POL-Y', '11111111-1111-1111-1111-111111111111', 'documental', 'v9', 'x', 'sandbox', 'proponente_politicas');
  begin
    update public.policies set status = 'activa', approved_by = 'proponente_politicas' where id = 'POL-Y';
    raise exception 'FALLO: autopromoción de política';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
\echo ok: policy promotion requires a different human

-- 7) Tenants cannot write the tariff table
do $$ begin
  begin
    insert into public.tariff_rules values ('9999.99.99', 1, null, 'x', 0, '[]', 'fuente inventada x', '2026-01-01', '2026-01-01', null, 'verificada');
    raise exception 'FALLO: inquilino escribió tariff_rules';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo ok: tariff_rules read-only for tenants
\echo ALL RLS CHECKS PASSED
