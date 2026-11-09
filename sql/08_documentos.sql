-- Documentos leídos desde escaneos (liquidaciones, imposiciones, contratos) y su cruce con la asistencia.
-- Solo el administrador puede cargar y ver. Las tablas están cerradas: todo pasa por funciones con sesión.

create table if not exists public.pp_documentos (
  id bigserial primary key,
  tipo text not null check (tipo in ('liquidacion','imposicion','contrato')),
  rut text not null,
  nombre text,
  periodo text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  datos jsonb not null default '{}'::jsonb,
  archivo text,
  estado text not null default 'por_confirmar' check (estado in ('por_confirmar','confirmado')),
  cargado_por text,
  creado_en timestamptz not null default now(),
  unique (tipo, rut, periodo)
);
create table if not exists public.pp_tickets (
  rut text not null,
  periodo text not null,
  clase text not null,
  estado text not null default 'abierto' check (estado in ('abierto','resuelto')),
  nota text,
  resuelto_por text,
  resuelto_en timestamptz,
  primary key (rut, periodo, clase)
);
alter table public.pp_documentos enable row level security;
alter table public.pp_tickets enable row level security;
revoke all on public.pp_documentos, public.pp_tickets from anon, authenticated;

create or replace function public.pp__rut(p text) returns text language sql immutable as
$$ select upper(regexp_replace(coalesce(p,''), '[^0-9kK-]', '', 'g')) $$;

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
    insert into pp_documentos (tipo, rut, nombre, periodo, datos, archivo, cargado_por)
    values (it->>'tipo', v_rut, it->>'nombre', it->>'periodo', coalesce(it->'datos','{}'::jsonb), it->>'archivo', a->>'nombre')
    on conflict (tipo, rut, periodo) do update set nombre = excluded.nombre, datos = excluded.datos, archivo = excluded.archivo, estado = 'por_confirmar', cargado_por = excluded.cargado_por, creado_en = now();
    n := n + 1;
  end loop;
  perform pp__mov(a->>'nombre', 'documentos', n || ' documentos cargados');
  return jsonb_build_object('ok', true, 'cargados', n);
end $f$;

create or replace function public.pp_documentos_listar(p_token text, p_periodo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb; res jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador ve los documentos.'); end if;
  with base as (
    select d.* from pp_documentos d where d.periodo = p_periodo
  ), personas as (select distinct rut from base),
  asis as (
    select p.rut, count(*) dias from (
      select pp__rut(f.rut_trabajador) rut, f.fecha::date fecha from folios_detalle f
      where to_char(f.fecha, 'YYYY-MM') = p_periodo and f.rut_trabajador is not null
      group by 1, 2
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
      (select nombre from base b where b.rut = pe.rut limit 1) nombre,
      coalesce(s.dias,0) + coalesce(x.dias,0) as dias_asistencia,
      (select (datos->>'dias_trabajados')::numeric from base b where b.rut = pe.rut and b.tipo = 'liquidacion') dias_liq,
      (select (datos->>'renta_imponible')::numeric from base b where b.rut = pe.rut and b.tipo = 'liquidacion') imp_liq,
      (select (datos->>'renta_imponible')::numeric from base b where b.rut = pe.rut and b.tipo = 'imposicion') imp_imp,
      exists (select 1 from base b where b.rut = pe.rut and b.tipo = 'liquidacion') hay_liq,
      exists (select 1 from base b where b.rut = pe.rut and b.tipo = 'imposicion') hay_imp,
      exists (select 1 from pp_documentos c where c.rut = pe.rut and c.tipo = 'contrato') hay_contrato
    from personas pe left join asis s on s.rut = pe.rut left join extra x on x.rut = pe.rut
  ), dif as (
    select rut, nombre, 'dias' clase, format('La liquidación paga %s días y la asistencia registra %s.', dias_liq, dias_asistencia) detalle
      from filas where hay_liq and dias_liq is not null and dias_liq <> dias_asistencia
    union all
    select rut, nombre, 'imponible', format('Renta imponible: liquidación %s, imposiciones %s.', imp_liq, imp_imp)
      from filas where hay_liq and hay_imp and imp_liq is not null and imp_imp is not null and abs(imp_liq - imp_imp) > 1
    union all
    select rut, nombre, 'sin_imposicion', 'Tiene liquidación pero no aparece en las imposiciones.' from filas where hay_liq and not hay_imp
    union all
    select rut, nombre, 'sin_liquidacion', 'Aparece en las imposiciones pero no tiene liquidación.' from filas where hay_imp and not hay_liq
    union all
    select rut, nombre, 'sin_contrato', 'No hay contrato cargado para este trabajador.' from filas where not hay_contrato
  )
  select jsonb_build_object('ok', true,
    'documentos', coalesce((select jsonb_agg(to_jsonb(b) order by b.nombre) from base b), '[]'::jsonb),
    'trabajadores', (select count(*) from personas),
    'diferencias', coalesce((select jsonb_agg(jsonb_build_object('rut', d.rut, 'nombre', d.nombre, 'clase', d.clase, 'detalle', d.detalle,
        'estado', coalesce(t.estado, 'abierto'), 'nota', t.nota) order by d.nombre, d.clase)
      from dif d left join pp_tickets t on t.rut = d.rut and t.periodo = p_periodo and t.clase = d.clase), '[]'::jsonb))
  into res;
  return res;
end $f$;

create or replace function public.pp_ticket_resolver(p_token text, p_rut text, p_periodo text, p_clase text, p_resuelto boolean, p_nota text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador resuelve casos.'); end if;
  insert into pp_tickets (rut, periodo, clase, estado, nota, resuelto_por, resuelto_en)
  values (pp__rut(p_rut), p_periodo, p_clase, case when p_resuelto then 'resuelto' else 'abierto' end, p_nota, a->>'nombre', now())
  on conflict (rut, periodo, clase) do update set estado = excluded.estado, nota = excluded.nota, resuelto_por = excluded.resuelto_por, resuelto_en = excluded.resuelto_en;
  perform pp__mov(a->>'nombre', 'ticket', p_clase || ' ' || p_periodo || (case when p_resuelto then ' resuelto' else ' reabierto' end));
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.pp_documento_confirmar(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare a jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador confirma documentos.'); end if;
  update pp_documentos set estado = 'confirmado' where id = p_id;
  return jsonb_build_object('ok', true);
end $f$;

revoke execute on function public.pp_documentos_cargar(text, jsonb), public.pp_documentos_listar(text, text), public.pp_ticket_resolver(text, text, text, text, boolean, text), public.pp_documento_confirmar(text, bigint) from public;
grant execute on function public.pp_documentos_cargar(text, jsonb), public.pp_documentos_listar(text, text), public.pp_ticket_resolver(text, text, text, text, boolean, text), public.pp_documento_confirmar(text, bigint) to anon, authenticated;
