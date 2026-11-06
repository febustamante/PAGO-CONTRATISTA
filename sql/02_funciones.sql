-- Software de pagos a contratistas. Parte 2: funciones (RPC).
-- Cada funcion valida el PIN contra usuarios_sj en el servidor y devuelve jsonb {ok, error?, ...}.
-- Roles: admin (rol_labores = admin), jefa_campo (supervisor con campo "El Cerrillo"),
--        lectura (gerencia u otros supervisores). Sin rol_labores no hay acceso.
-- Las 20 ultimas intentos fallidos en 5 minutos bloquean temporalmente el login.

create or replace function public.pp__err(p_msg text) returns jsonb
language sql immutable as $$ select jsonb_build_object('ok', false, 'error', p_msg) $$;

create or replace function public.pp__mov(p_usuario text, p_accion text, p_detalle text) returns void
language sql security definer set search_path = public as $$
  insert into pp_movimientos (usuario, accion, detalle) values (p_usuario, p_accion, p_detalle)
$$;

create or replace function public.pp__auth(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_u record; v_fallos int; v_rol text;
begin
  delete from pp_intentos where en < now() - interval '1 day';
  select count(*) into v_fallos from pp_intentos where en > now() - interval '5 minutes';
  if v_fallos >= 20 then return jsonb_build_object('bloqueado', true); end if;
  select u.id, u.nombre, u.rol_labores, u.campos into v_u
    from usuarios_sj u where u.pin = p_pin and coalesce(u.activo, true) limit 1;
  if not found or v_u.rol_labores is null or v_u.rol_labores not in ('admin', 'gerencia', 'supervisor') then
    insert into pp_intentos default values;
    return null;
  end if;
  v_rol := case v_u.rol_labores
    when 'admin' then 'admin'
    when 'gerencia' then 'lectura'
    else case when 'El Cerrillo' = any (coalesce(v_u.campos, '{}'::text[])) then 'jefa_campo' else 'lectura' end
  end;
  return jsonb_build_object('uid', v_u.id, 'nombre', v_u.nombre, 'rol', v_rol);
end $$;

create or replace function public.pp_login(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  a := pp__auth(p_pin);
  if a is null then return pp__err('PIN no válido o sin acceso a esta plataforma.'); end if;
  if a ? 'bloqueado' then return pp__err('Demasiados intentos. Espera unos minutos.'); end if;
  return jsonb_build_object('ok', true, 'nombre', a->>'nombre', 'rol', a->>'rol');
end $$;

create or replace function public.pp_estado(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  return jsonb_build_object(
    'ok', true,
    'usuario', a,
    'asignaciones', coalesce((select jsonb_agg(to_jsonb(x)) from pp_asignaciones x), '[]'::jsonb),
    'reparto', coalesce((select jsonb_agg(to_jsonb(x)) from pp_reparto_manual x), '[]'::jsonb),
    'liberaciones', coalesce((select jsonb_agg(to_jsonb(x) order by x.creado_en desc) from pp_liberaciones x where not x.anulada), '[]'::jsonb),
    'asistencia', coalesce((select jsonb_agg(to_jsonb(x)) from pp_asistencia_ov x), '[]'::jsonb),
    'contratos', coalesce((select jsonb_agg(to_jsonb(x)) from pp_contratos x), '[]'::jsonb),
    'movimientos', coalesce((select jsonb_agg(to_jsonb(x) order by x.creado_en desc) from (select * from pp_movimientos order by creado_en desc limit 200) x), '[]'::jsonb),
    'ahora', now()
  );
end $$;

-- Plantas por contratista en un cuartel y labor. La jefa de campo deja "propuesta"; el admin deja "aprobada".
create or replace function public.pp_proponer_plantas(p_pin text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; it jsonb; k record; v_estado text; v_nom text; v_tot numeric; v_sum numeric; n int := 0;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if not ((a->>'rol') = any (array['admin', 'jefa_campo'])) then return pp__err('Tu rol no permite asignar plantas.'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then return pp__err('No hay datos para guardar.'); end if;
  v_nom := a->>'nombre';
  v_estado := case when a->>'rol' = 'admin' then 'aprobada' else 'propuesta' end;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce(it->>'cuartel', '') !~ '^C[0-9]{2}$' or coalesce(it->>'labor', '') = '' or coalesce(it->>'contratista', '') = ''
       or coalesce((it->>'plantas')::numeric, -1) < 0 or (it->>'valor') is null then
      return pp__err('Datos inválidos en las plantas asignadas.');
    end if;
  end loop;
  for k in select distinct t.i->>'cuartel' as cuartel, t.i->>'labor' as labor from jsonb_array_elements(p_items) as t(i) loop
    select plantas_total into v_tot from cuarteles_plantas where cuartel = k.cuartel;
    if v_tot is not null then
      select coalesce(sum((t.i->>'plantas')::numeric), 0) into v_sum
        from jsonb_array_elements(p_items) as t(i) where t.i->>'cuartel' = k.cuartel and t.i->>'labor' = k.labor;
      v_sum := v_sum + coalesce((
        select sum(a2.plantas) from pp_asignaciones a2
        where a2.cuartel = k.cuartel and a2.labor = k.labor
          and not exists (select 1 from jsonb_array_elements(p_items) as t(i)
                          where t.i->>'contratista' = a2.contratista and (t.i->>'valor')::numeric = a2.valor and t.i->>'cuartel' = a2.cuartel and t.i->>'labor' = a2.labor)
      ), 0);
      if v_sum > v_tot * 1.02 then
        return pp__err('En ' || k.cuartel || ' ' || k.labor || ' la suma (' || round(v_sum) || ') supera las plantas del cuartel (' || v_tot || ').');
      end if;
    end if;
  end loop;
  for it in select value from jsonb_array_elements(p_items) loop
    insert into pp_asignaciones (cuartel, labor, contratista, valor, plantas, estado, propuesto_por, aprobado_por)
    values (it->>'cuartel', it->>'labor', it->>'contratista', (it->>'valor')::numeric, (it->>'plantas')::numeric, v_estado,
            case when v_estado = 'propuesta' then v_nom end, case when v_estado = 'aprobada' then v_nom end)
    on conflict (cuartel, labor, contratista, valor) do update set
      plantas = excluded.plantas, estado = excluded.estado,
      propuesto_por = coalesce(excluded.propuesto_por, pp_asignaciones.propuesto_por),
      aprobado_por = excluded.aprobado_por,
      version = pp_asignaciones.version + 1, actualizado_en = now();
    n := n + 1;
  end loop;
  perform pp__mov(v_nom, case when v_estado = 'aprobada' then 'plantas_aprobadas' else 'plantas_propuestas' end,
    n || ' asignaciones en ' || (select string_agg(distinct t.i->>'cuartel' || ' ' || (t.i->>'labor'), ', ') from jsonb_array_elements(p_items) as t(i)));
  return jsonb_build_object('ok', true, 'guardadas', n, 'estado', v_estado);
end $$;

create or replace function public.pp_aprobar_plantas(p_pin text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; it jsonb; n int := 0;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador aprueba plantas.'); end if;
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update pp_asignaciones set estado = 'aprobada', aprobado_por = a->>'nombre', version = version + 1, actualizado_en = now()
      where cuartel = it->>'cuartel' and labor = it->>'labor' and contratista = it->>'contratista' and valor = (it->>'valor')::numeric;
    if found then n := n + 1; end if;
  end loop;
  perform pp__mov(a->>'nombre', 'plantas_aprobadas', n || ' asignaciones aprobadas');
  return jsonb_build_object('ok', true, 'aprobadas', n);
end $$;

-- Reparto manual por persona. La suma debe cuadrar con las plantas asignadas del grupo (o con p_total).
create or replace function public.pp_guardar_reparto(p_pin text, p_grupo jsonb, p_total numeric, p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; f jsonb; v_obj numeric; v_sum numeric := 0; n int := 0;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if not ((a->>'rol') = any (array['admin', 'jefa_campo'])) then return pp__err('Tu rol no permite repartir plantas.'); end if;
  select plantas into v_obj from pp_asignaciones
    where cuartel = p_grupo->>'cuartel' and labor = p_grupo->>'labor' and contratista = p_grupo->>'contratista' and valor = (p_grupo->>'valor')::numeric;
  if v_obj is null then v_obj := p_total; end if;
  select coalesce(sum((t.f->>'plantas')::numeric), 0) into v_sum from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) as t(f);
  if jsonb_array_length(coalesce(p_filas, '[]'::jsonb)) > 0 and abs(v_sum - coalesce(v_obj, v_sum)) > 0.5 then
    return pp__err('El reparto suma ' || round(v_sum) || ' y el total del equipo es ' || round(v_obj) || '.');
  end if;
  delete from pp_reparto_manual
    where cuartel = p_grupo->>'cuartel' and labor = p_grupo->>'labor' and contratista = p_grupo->>'contratista' and valor = (p_grupo->>'valor')::numeric;
  for f in select value from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    if (f->>'plantas')::numeric < 0 then raise exception 'plantas negativas'; end if;
    insert into pp_reparto_manual (fila_id, cuartel, labor, contratista, valor, plantas, actualizado_por)
    values ((f->>'id')::bigint, p_grupo->>'cuartel', p_grupo->>'labor', p_grupo->>'contratista', (p_grupo->>'valor')::numeric, (f->>'plantas')::numeric, a->>'nombre')
    on conflict (fila_id) do update set plantas = excluded.plantas, actualizado_por = excluded.actualizado_por, actualizado_en = now();
    n := n + 1;
  end loop;
  perform pp__mov(a->>'nombre', 'reparto_personas', (p_grupo->>'cuartel') || ' ' || (p_grupo->>'labor') || ' ' || (p_grupo->>'contratista') || ': ' || n || ' filas');
  return jsonb_build_object('ok', true, 'filas', n);
end $$;

create or replace function public.pp_restaurar(p_pin text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; it jsonb; n int := 0;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if not ((a->>'rol') = any (array['admin', 'jefa_campo'])) then return pp__err('Tu rol no permite esta acción.'); end if;
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    delete from pp_asignaciones where cuartel = it->>'cuartel' and labor = it->>'labor' and contratista = it->>'contratista' and valor = (it->>'valor')::numeric;
    delete from pp_reparto_manual where cuartel = it->>'cuartel' and labor = it->>'labor' and contratista = it->>'contratista' and valor = (it->>'valor')::numeric;
    n := n + 1;
  end loop;
  perform pp__mov(a->>'nombre', 'restaurar', n || ' grupos vueltos a lo original');
  return jsonb_build_object('ok', true, 'grupos', n);
end $$;

create or replace function public.pp_liberar(p_pin text, p_items jsonb, p_factura text, p_fecha date, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; it jsonb; n int := 0; v_monto numeric := 0; v_exige boolean := false;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador libera pagos.'); end if;
  if coalesce(trim(p_factura), '') = '' then return pp__err('Falta el número de factura.'); end if;
  if p_fecha is null then return pp__err('Falta la fecha de factura.'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then return pp__err('No hay grupos para liberar.'); end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if (it->>'estado') in ('misma', 'excede') then v_exige := true; end if;
  end loop;
  if v_exige and length(coalesce(trim(p_motivo), '')) < 5 then return pp__err('Hay grupos marcados como no pagar o con exceso de plantas: escribe el motivo.'); end if;
  begin
    for it in select value from jsonb_array_elements(p_items) loop
      insert into pp_liberaciones (cuartel, labor, contratista, valor, plantas, filas, monto, trabajo_ini, trabajo_fin, n_factura, fecha_factura, estado_al_liberar, motivo, liberado_por)
      values (it->>'cuartel', it->>'labor', it->>'contratista', (it->>'valor')::numeric, coalesce((it->>'plantas')::numeric, 0), coalesce((it->>'filas')::int, 0),
              coalesce((it->>'monto')::numeric, 0), nullif(it->>'ini', '')::date, nullif(it->>'fin', '')::date, trim(p_factura), p_fecha, it->>'estado', nullif(trim(p_motivo), ''), a->>'nombre');
      n := n + 1;
      v_monto := v_monto + coalesce((it->>'monto')::numeric, 0);
    end loop;
  exception when unique_violation then
    return pp__err('Alguno de estos grupos ya fue liberado por otra persona. Actualiza la pantalla.');
  end;
  perform pp__mov(a->>'nombre', 'liberar', n || ' grupos por $' || round(v_monto) || ' · factura ' || trim(p_factura) || coalesce(' · ' || nullif(trim(p_motivo), ''), ''));
  return jsonb_build_object('ok', true, 'liberados', n, 'monto', v_monto);
end $$;

create or replace function public.pp_deshacer_liberacion(p_pin text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; r record;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador deshace liberaciones.'); end if;
  update pp_liberaciones set anulada = true, anulada_por = a->>'nombre', anulada_en = now() where id = p_id and not anulada
    returning cuartel, labor, contratista into r;
  if not found then return pp__err('La liberación no existe o ya estaba anulada.'); end if;
  perform pp__mov(a->>'nombre', 'deshacer_liberacion', r.cuartel || ' ' || r.labor || ' ' || r.contratista);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pp_asistencia(p_pin text, p_rut text, p_fecha date, p_vino boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if not ((a->>'rol') = any (array['admin', 'jefa_campo'])) then return pp__err('Tu rol no permite corregir asistencia.'); end if;
  if coalesce(p_rut, '') = '' or p_fecha is null or p_vino is null then return pp__err('Datos incompletos.'); end if;
  insert into pp_asistencia_ov (rut, fecha, vino, por) values (p_rut, p_fecha, p_vino, a->>'nombre')
    on conflict (rut, fecha) do update set vino = excluded.vino, por = excluded.por, en = now();
  perform pp__mov(a->>'nombre', 'asistencia', p_rut || ' ' || p_fecha || ' → ' || case when p_vino then 'vino' else 'no vino' end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pp_contrato(p_pin text, p_contratista text, p_labor text, p_precio numeric, p_desde date, p_hasta date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador edita contratos.'); end if;
  if coalesce(p_contratista, '') = '' or coalesce(p_labor, '') = '' then return pp__err('Faltan datos del contrato.'); end if;
  if p_precio is null then
    delete from pp_contratos where contratista = p_contratista and labor = p_labor;
  else
    if p_precio < 0 then return pp__err('El precio no puede ser negativo.'); end if;
    insert into pp_contratos (contratista, labor, vigente_desde, vigente_hasta, precio, creado_por)
    values (p_contratista, p_labor, coalesce(p_desde, current_date), p_hasta, p_precio, a->>'nombre')
    on conflict (contratista, labor, vigente_desde) do update set precio = excluded.precio, vigente_hasta = excluded.vigente_hasta, creado_por = excluded.creado_por, creado_en = now();
  end if;
  perform pp__mov(a->>'nombre', 'contrato', p_contratista || ' ' || p_labor || ' → ' || coalesce('$' || p_precio, 'sin precio'));
  return jsonb_build_object('ok', true);
end $$;

-- Permisos: las funciones internas no se exponen; las publicas las puede llamar la clave anon.
revoke all on function public.pp__err(text), public.pp__mov(text, text, text), public.pp__auth(text) from public, anon, authenticated;
revoke all on function
  public.pp_login(text), public.pp_estado(text), public.pp_proponer_plantas(text, jsonb), public.pp_aprobar_plantas(text, jsonb),
  public.pp_guardar_reparto(text, jsonb, numeric, jsonb), public.pp_restaurar(text, jsonb), public.pp_liberar(text, jsonb, text, date, text),
  public.pp_deshacer_liberacion(text, bigint), public.pp_asistencia(text, text, date, boolean), public.pp_contrato(text, text, text, numeric, date, date)
  from public;
grant execute on function
  public.pp_login(text), public.pp_estado(text), public.pp_proponer_plantas(text, jsonb), public.pp_aprobar_plantas(text, jsonb),
  public.pp_guardar_reparto(text, jsonb, numeric, jsonb), public.pp_restaurar(text, jsonb), public.pp_liberar(text, jsonb, text, date, text),
  public.pp_deshacer_liberacion(text, bigint), public.pp_asistencia(text, text, date, boolean), public.pp_contrato(text, text, text, numeric, date, date)
  to anon, authenticated;
