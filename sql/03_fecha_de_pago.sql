-- Parte 3: la fecha de pago es el ultimo paso y se pone a todo lo liberado de una vez.
-- Liberar ya no exige factura ni fecha: pasa a la pestaña Pagos. La fecha de pago se fija despues.

alter table public.pp_liberaciones add column if not exists fecha_pago date;
alter table public.pp_liberaciones add column if not exists fecha_pago_por text;
alter table public.pp_liberaciones alter column n_factura drop not null;
alter table public.pp_liberaciones alter column fecha_factura drop not null;

create or replace function public.pp_liberar(p_pin text, p_items jsonb, p_factura text, p_fecha date, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; it jsonb; n int := 0; v_monto numeric := 0; v_exige boolean := false;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador libera pagos.'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then return pp__err('No hay grupos para liberar.'); end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if (it->>'estado') in ('misma', 'excede') then v_exige := true; end if;
  end loop;
  if v_exige and length(coalesce(trim(p_motivo), '')) < 5 then return pp__err('Hay grupos marcados como no pagar o con exceso de plantas: escribe el motivo.'); end if;
  begin
    for it in select value from jsonb_array_elements(p_items) loop
      insert into pp_liberaciones (cuartel, labor, contratista, valor, plantas, filas, monto, trabajo_ini, trabajo_fin, n_factura, fecha_factura, estado_al_liberar, motivo, liberado_por)
      values (it->>'cuartel', it->>'labor', it->>'contratista', (it->>'valor')::numeric, coalesce((it->>'plantas')::numeric, 0), coalesce((it->>'filas')::int, 0),
              coalesce((it->>'monto')::numeric, 0), nullif(it->>'ini', '')::date, nullif(it->>'fin', '')::date, nullif(trim(coalesce(p_factura, '')), ''), p_fecha, it->>'estado', nullif(trim(coalesce(p_motivo, '')), ''), a->>'nombre');
      n := n + 1;
      v_monto := v_monto + coalesce((it->>'monto')::numeric, 0);
    end loop;
  exception when unique_violation then
    return pp__err('Alguno de estos grupos ya fue liberado por otra persona. Actualiza la pantalla.');
  end;
  perform pp__mov(a->>'nombre', 'liberar', n || ' grupos por $' || round(v_monto) || coalesce(' · factura ' || nullif(trim(coalesce(p_factura, '')), ''), '') || coalesce(' · ' || nullif(trim(coalesce(p_motivo, '')), ''), ''));
  return jsonb_build_object('ok', true, 'liberados', n, 'monto', v_monto);
end $$;

-- Fija (o quita, con fecha nula) la fecha de pago. Con p_ids nulo se aplica a todo lo liberado sin fecha de pago.
create or replace function public.pp_fijar_fecha_pago(p_pin text, p_ids bigint[], p_fecha date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; n int;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador fija la fecha de pago.'); end if;
  if p_fecha is null and p_ids is null then return pp__err('Indica la fecha de pago.'); end if;
  if p_fecha is not null and p_fecha > current_date + 60 then return pp__err('La fecha de pago está demasiado lejos.'); end if;
  if p_fecha is null then
    update pp_liberaciones set fecha_pago = null, fecha_pago_por = null where id = any (p_ids) and not anulada;
  else
    update pp_liberaciones set fecha_pago = p_fecha, fecha_pago_por = a->>'nombre'
      where not anulada and ((p_ids is null and fecha_pago is null) or id = any (coalesce(p_ids, '{}'::bigint[])));
  end if;
  get diagnostics n = row_count;
  perform pp__mov(a->>'nombre', case when p_fecha is null then 'quitar_fecha_pago' else 'fecha_pago' end,
    n || ' liberaciones' || coalesce(' → ' || p_fecha::text, ' sin fecha de pago'));
  return jsonb_build_object('ok', true, 'actualizadas', n);
end $$;

create or replace function public.pp_deshacer_liberacion(p_pin text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; r record;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador deshace liberaciones.'); end if;
  if exists (select 1 from pp_liberaciones where id = p_id and not anulada and fecha_pago is not null) then
    return pp__err('Esta liberación ya tiene fecha de pago. Quita la fecha de pago primero.');
  end if;
  update pp_liberaciones set anulada = true, anulada_por = a->>'nombre', anulada_en = now() where id = p_id and not anulada
    returning cuartel, labor, contratista into r;
  if not found then return pp__err('La liberación no existe o ya estaba anulada.'); end if;
  perform pp__mov(a->>'nombre', 'deshacer_liberacion', r.cuartel || ' ' || r.labor || ' ' || r.contratista);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pp_fijar_fecha_pago(text, bigint[], date) from public;
grant execute on function public.pp_fijar_fecha_pago(text, bigint[], date) to anon, authenticated;
