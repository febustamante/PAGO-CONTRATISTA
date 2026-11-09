-- Revisión por trabajador con contratista y liberación de la retención (20 %) cuando los documentos están en orden.

alter table public.pp_documentos add column if not exists contratista text;

create table if not exists public.pp_retenciones_liberadas (
  id bigserial primary key,
  contratista text not null,
  periodo text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  monto numeric not null check (monto > 0),
  con_excepcion boolean not null default false,
  nota text,
  liberado_por text,
  creado_en timestamptz not null default now(),
  anulada boolean not null default false
);
alter table public.pp_retenciones_liberadas enable row level security;
revoke all on public.pp_retenciones_liberadas from anon, authenticated;

create or replace function public.pp_documentos_cargar(p_token text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb; it jsonb; n int := 0; v_rut text;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador carga documentos.'); end if;
  if jsonb_typeof(p_items) <> 'array' then return pp__err('Formato no válido.'); end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_rut := pp__rut(it->>'rut');
    if v_rut !~ '^[0-9]{6,9}-[0-9K]$' then return pp__err('RUT no válido: ' || coalesce(it->>'rut','(vacío)')); end if;
    if (it->>'tipo') not in ('liquidacion','imposicion','contrato') then return pp__err('Tipo no válido: ' || coalesce(it->>'tipo','(vacío)')); end if;
    if (it->>'periodo') !~ '^[0-9]{4}-[0-9]{2}$' then return pp__err('Período no válido (use AAAA-MM).'); end if;
    insert into pp_documentos (tipo, rut, nombre, periodo, datos, archivo, contratista, cargado_por)
    values (it->>'tipo', v_rut, it->>'nombre', it->>'periodo', coalesce(it->'datos','{}'::jsonb), it->>'archivo', nullif(upper(trim(it->>'contratista')), ''), a->>'nombre')
    on conflict (tipo, rut, periodo) do update set nombre = excluded.nombre, datos = excluded.datos, archivo = excluded.archivo,
      contratista = coalesce(excluded.contratista, pp_documentos.contratista), estado = 'por_confirmar', cargado_por = excluded.cargado_por, creado_en = now();
    n := n + 1;
  end loop;
  perform pp__mov(a->>'nombre', 'documentos', n || ' documentos cargados');
  return jsonb_build_object('ok', true, 'cargados', n);
end $f$;

-- Una fila por trabajador con sus revisiones. El cliente pinta ok / diferencia / falta.
create or replace function public.pp_documentos_listar(p_token text, p_periodo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb; res jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador ve los documentos.'); end if;
  with base as (select d.* from pp_documentos d where d.periodo = p_periodo),
  personas as (select distinct rut from base),
  asis as (
    select p.rut, count(*) dias from (
      select pp__rut(f.rut_trabajador) rut, f.fecha::date fecha from folios_detalle f
      where to_char(f.fecha, 'YYYY-MM') = p_periodo and f.rut_trabajador is not null group by 1, 2
    ) p
    where not exists (select 1 from pp_asistencia_ov o where pp__rut(o.rut) = p.rut and o.fecha = p.fecha and o.vino = false)
    group by p.rut
  ), extra as (
    select pp__rut(o.rut) rut, count(*) dias from pp_asistencia_ov o
    where o.vino and to_char(o.fecha, 'YYYY-MM') = p_periodo
      and not exists (select 1 from folios_detalle f where pp__rut(f.rut_trabajador) = pp__rut(o.rut) and f.fecha::date = o.fecha)
    group by 1
  ), filas as (
    select pe.rut,
      (select nombre from base b where b.rut = pe.rut and b.nombre is not null limit 1) nombre,
      (select c.contratista from pp_documentos c where c.rut = pe.rut and c.contratista is not null order by c.creado_en desc limit 1) contratista,
      coalesce(s.dias,0) + coalesce(x.dias,0) as dias_asistencia,
      (select (datos->>'dias_trabajados')::numeric from base b where b.rut = pe.rut and b.tipo = 'liquidacion') dias_liq,
      (select (datos->>'renta_imponible')::numeric from base b where b.rut = pe.rut and b.tipo = 'liquidacion') imp_liq,
      (select (datos->>'renta_imponible')::numeric from base b where b.rut = pe.rut and b.tipo = 'imposicion') imp_imp,
      exists (select 1 from base b where b.rut = pe.rut and b.tipo = 'liquidacion') hay_liq,
      exists (select 1 from base b where b.rut = pe.rut and b.tipo = 'imposicion') hay_imp,
      exists (select 1 from pp_documentos c where c.rut = pe.rut and c.tipo = 'contrato') hay_contrato
    from personas pe left join asis s on s.rut = pe.rut left join extra x on x.rut = pe.rut
  ), dif as (
    select rut, 'dias' clase, format('La liquidación paga %s días y la asistencia registra %s.', dias_liq, dias_asistencia) detalle
      from filas where hay_liq and dias_liq is not null and dias_liq <> dias_asistencia
    union all
    select rut, 'imponible', format('Renta imponible: liquidación %s, imposiciones %s.', imp_liq, imp_imp)
      from filas where hay_liq and hay_imp and imp_liq is not null and imp_imp is not null and abs(imp_liq - imp_imp) > 1
    union all select rut, 'sin_imposicion', 'Tiene liquidación pero no aparece en las imposiciones.' from filas where hay_liq and not hay_imp
    union all select rut, 'sin_liquidacion', 'Aparece en las imposiciones pero no tiene liquidación.' from filas where hay_imp and not hay_liq
    union all select rut, 'sin_contrato', 'No hay contrato cargado para este trabajador.' from filas where not hay_contrato
  ), casos as (
    select d.rut, jsonb_agg(jsonb_build_object('clase', d.clase, 'detalle', d.detalle, 'estado', coalesce(t.estado, 'abierto'), 'nota', t.nota) order by d.clase) lista
    from dif d left join pp_tickets t on t.rut = d.rut and t.periodo = p_periodo and t.clase = d.clase group by d.rut
  )
  select jsonb_build_object('ok', true,
    'documentos', coalesce((select jsonb_agg(to_jsonb(b) order by b.nombre) from base b), '[]'::jsonb),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('rut', f.rut, 'nombre', f.nombre, 'contratista', f.contratista,
        'dias_asistencia', f.dias_asistencia, 'dias_liq', f.dias_liq, 'hay_liq', f.hay_liq, 'hay_imp', f.hay_imp, 'hay_contrato', f.hay_contrato,
        'casos', coalesce(c.lista, '[]'::jsonb)) order by f.contratista nulls last, f.nombre)
      from filas f left join casos c on c.rut = f.rut), '[]'::jsonb))
  into res;
  return res;
end $f$;

-- Resumen por contratista para liberar la retención: retenido, ya liberado, pendiente y estado de documentos.
create or replace function public.pp_retenciones_resumen(p_token text, p_periodo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb; docs jsonb; res jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador ve las retenciones.'); end if;
  docs := pp_documentos_listar(p_token, p_periodo);
  select jsonb_build_object('ok', true,
    'contratistas', coalesce((select jsonb_agg(x order by x->>'contratista') from (
      select jsonb_build_object('contratista', c.contratista,
        'retenido', coalesce((select sum(l.retencion) from pp_liquidaciones l where l.contratista = c.contratista and not l.anulada), 0),
        'liberado', coalesce((select sum(r.monto) from pp_retenciones_liberadas r where r.contratista = c.contratista and not r.anulada), 0),
        'liberado_periodo', coalesce((select sum(r.monto) from pp_retenciones_liberadas r where r.contratista = c.contratista and r.periodo = p_periodo and not r.anulada), 0)) x
      from (select contratista from pp_liquidaciones where not anulada union select contratista from pp_retenciones_liberadas union
            select (p->>'contratista') from jsonb_array_elements(docs->'personas') p where p->>'contratista' is not null) c(contratista)
    ) q), '[]'::jsonb),
    'personas', docs->'personas',
    'historial', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en desc) from pp_retenciones_liberadas r where not r.anulada), '[]'::jsonb))
  into res;
  return res;
end $f$;

create or replace function public.pp_retencion_liberar(p_token text, p_contratista text, p_periodo text, p_monto numeric, p_nota text, p_excepcion boolean) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb; docs jsonb; v_ret numeric; v_lib numeric; abiertos int;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador libera retenciones.'); end if;
  if p_monto is null or p_monto <= 0 then return pp__err('El monto debe ser mayor que cero.'); end if;
  select coalesce(sum(retencion), 0) into v_ret from pp_liquidaciones where contratista = p_contratista and not anulada;
  select coalesce(sum(monto), 0) into v_lib from pp_retenciones_liberadas where contratista = p_contratista and not anulada;
  if p_monto > v_ret - v_lib then return pp__err('El monto supera lo retenido pendiente de este contratista.'); end if;
  docs := pp_documentos_listar(p_token, p_periodo);
  select count(*) into abiertos from jsonb_array_elements(docs->'personas') p, jsonb_array_elements(p->'casos') c
    where p->>'contratista' = p_contratista and c->>'estado' = 'abierto';
  if abiertos > 0 and not coalesce(p_excepcion, false) then return pp__err('Hay ' || abiertos || ' casos abiertos en los documentos de este contratista.'); end if;
  if coalesce(p_excepcion, false) and coalesce(trim(p_nota), '') = '' then return pp__err('Una liberación con excepción necesita una nota.'); end if;
  insert into pp_retenciones_liberadas (contratista, periodo, monto, con_excepcion, nota, liberado_por)
  values (p_contratista, p_periodo, p_monto, coalesce(p_excepcion, false) and abiertos > 0, p_nota, a->>'nombre');
  perform pp__mov(a->>'nombre', 'retencion', p_contratista || ' ' || p_periodo || ' $' || p_monto);
  return jsonb_build_object('ok', true);
end $f$;

revoke execute on function public.pp_documentos_cargar(text, jsonb), public.pp_documentos_listar(text, text), public.pp_retenciones_resumen(text, text), public.pp_retencion_liberar(text, text, text, numeric, text, boolean) from public;
grant execute on function public.pp_documentos_cargar(text, jsonb), public.pp_documentos_listar(text, text), public.pp_retenciones_resumen(text, text), public.pp_retencion_liberar(text, text, text, numeric, text, boolean) to anon, authenticated;
