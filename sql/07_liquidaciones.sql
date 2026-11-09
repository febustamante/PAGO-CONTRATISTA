-- Parte 7: liquidaciones por contratista (detalle a facturar), colaciones, IVA, retención e inversión.
-- Todo se calcula en el servidor a partir de lo liberado y de los ajustes, y queda guardado como historial.

create table if not exists public.pp_config (
  clave text primary key,
  valor text not null,
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);
insert into public.pp_config (clave, valor) values
  ('precio_colacion', '4100'),            -- almuerzo completo (100%); el de 50% es la mitad
  ('iva_pct', '19'),
  ('retencion_pct', '20'),
  ('retencion_base', 'total'),            -- 'total' = sobre el total con IVA · 'neto' = sobre el neto
  ('razon:ROBINSON ZURITA', 'SOCIEDAD ATIRUZ LTDA.'),
  ('razon:JAVIER ESCUDERO', 'AGRICOLA PAMELA PEÑA'),
  ('razon:JAVIER ORELLANA', 'SERVICIOS AGRICOLAS SANTA CRUZ SPA'),
  ('razon:WILFREDO SPA', 'CONTRATISTA P.R.W. SPA'),
  ('razon:CLAUDIO CASTILLO', 'CLAUDIO ALEXIS CASTILLO CASTILLO'),
  ('razon:DANIEL MORALEDA', 'DANIEL MORALEDA')
on conflict (clave) do nothing;

-- Cuarteles en formación: sus pagos van en la factura de "inversión"; el resto, "servicios".
create table if not exists public.pp_cuarteles_inversion (
  cuartel text primary key check (cuartel ~ '^C[0-9]{2}$'),
  creado_por text,
  creado_en timestamptz not null default now()
);
insert into public.pp_cuarteles_inversion (cuartel, creado_por)
  select c, 'inicio' from unnest(array['C24', 'C25', 'C26', 'C27', 'C28', 'C29']) c on conflict (cuartel) do nothing;

create table if not exists public.pp_liquidaciones (
  id bigint generated always as identity primary key,
  contratista text not null,
  tipo text not null check (tipo in ('servicios', 'inversion')),
  bruto numeric not null,
  colaciones_50 integer not null default 0,
  colaciones_100 integer not null default 0,
  precio_colacion numeric not null,
  descuento_colaciones numeric not null default 0,
  otros_descuentos numeric not null default 0,
  neto numeric not null,
  iva_pct numeric not null,
  iva numeric not null,
  total_factura numeric not null,
  retencion_pct numeric not null,
  retencion_base text not null,
  retencion numeric not null,
  a_pago numeric not null,
  fecha_factura date not null,
  n_factura text,
  creado_por text not null,
  creado_en timestamptz not null default now(),
  anulada boolean not null default false,
  anulada_por text,
  anulada_en timestamptz
);
alter table public.pp_liberaciones add column if not exists liquidacion_id bigint references public.pp_liquidaciones(id);

alter table public.pp_config enable row level security;
alter table public.pp_cuarteles_inversion enable row level security;
alter table public.pp_liquidaciones enable row level security;
revoke all on public.pp_config, public.pp_cuarteles_inversion, public.pp_liquidaciones from public, anon, authenticated;

-- El estado compartido ahora incluye ajustes, cuarteles en inversión y liquidaciones.
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
    'config', coalesce((select jsonb_object_agg(clave, valor) from pp_config), '{}'::jsonb),
    'inversion', coalesce((select jsonb_agg(cuartel order by cuartel) from pp_cuarteles_inversion), '[]'::jsonb),
    'liquidaciones', coalesce((select jsonb_agg(to_jsonb(x) order by x.creado_en desc) from (select * from pp_liquidaciones where not anulada order by creado_en desc limit 300) x), '[]'::jsonb),
    'ahora', now()
  );
end $$;

create or replace function public.pp_config_guardar(p_token text, p_clave text, p_valor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; v numeric;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador cambia los ajustes.'); end if;
  if p_clave in ('precio_colacion', 'iva_pct', 'retencion_pct') then
    begin v := p_valor::numeric; exception when others then return pp__err('El valor debe ser un número.'); end;
    if v < 0 then return pp__err('El valor no puede ser negativo.'); end if;
    if p_clave <> 'precio_colacion' and v > 100 then return pp__err('El porcentaje no puede pasar de 100.'); end if;
  elsif p_clave = 'retencion_base' then
    if p_valor not in ('neto', 'total') then return pp__err('La base de la retención es "neto" o "total".'); end if;
  elsif p_clave like 'razon:%' and length(p_clave) between 8 and 80 then
    if length(trim(coalesce(p_valor, ''))) < 2 then return pp__err('Falta la razón social.'); end if;
  else
    return pp__err('Ajuste desconocido.');
  end if;
  insert into pp_config (clave, valor, actualizado_por) values (p_clave, trim(p_valor), a->>'nombre')
    on conflict (clave) do update set valor = excluded.valor, actualizado_por = excluded.actualizado_por, actualizado_en = now();
  perform pp__mov(a->>'nombre', 'ajuste', p_clave || ' → ' || trim(p_valor));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pp_inversion_guardar(p_token text, p_cuarteles text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; c text;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador cambia los ajustes.'); end if;
  foreach c in array coalesce(p_cuarteles, '{}'::text[]) loop
    if c !~ '^C[0-9]{2}$' then return pp__err('Cuartel no válido: ' || c); end if;
  end loop;
  delete from pp_cuarteles_inversion where cuartel <> all (coalesce(p_cuarteles, '{}'::text[]));
  insert into pp_cuarteles_inversion (cuartel, creado_por) select distinct x, a->>'nombre' from unnest(coalesce(p_cuarteles, '{}'::text[])) x on conflict (cuartel) do nothing;
  perform pp__mov(a->>'nombre', 'ajuste', 'cuarteles en inversión: ' || coalesce(array_to_string(p_cuarteles, ', '), 'ninguno'));
  return jsonb_build_object('ok', true);
end $$;

-- Crea la liquidación (detalle a facturar) de un contratista y un tipo, con las liberaciones indicadas.
create or replace function public.pp_liquidar(p_token text, p_contratista text, p_tipo text, p_ids bigint[], p_col50 integer, p_col100 integer, p_otros numeric, p_fecha date, p_factura text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; v_precio numeric; v_iva numeric; v_ret numeric; v_base text; v_bruto numeric; v_n int; v_malas int;
        v_desc numeric; v_neto numeric; v_ivam numeric; v_total numeric; v_retm numeric; v_apago numeric; v_id bigint;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador genera liquidaciones.'); end if;
  if p_tipo not in ('servicios', 'inversion') then return pp__err('El tipo debe ser servicios o inversión.'); end if;
  if p_ids is null or cardinality(p_ids) = 0 then return pp__err('No hay liberaciones para liquidar.'); end if;
  if coalesce(p_col50, 0) < 0 or coalesce(p_col100, 0) < 0 or coalesce(p_otros, 0) < 0 then return pp__err('Las colaciones y los descuentos no pueden ser negativos.'); end if;
  if p_fecha is null then return pp__err('Falta la fecha de factura.'); end if;
  select coalesce(sum(monto), 0), count(*) into v_bruto, v_n from pp_liberaciones
    where id = any (p_ids) and not anulada and contratista = p_contratista and liquidacion_id is null;
  if v_n <> cardinality(p_ids) then return pp__err('Alguna liberación ya está en una liquidación, fue anulada o es de otro contratista. Actualiza la pantalla.'); end if;
  select count(*) into v_malas from pp_liberaciones l
    where l.id = any (p_ids) and ((l.cuartel in (select cuartel from pp_cuarteles_inversion)) <> (p_tipo = 'inversion'));
  if v_malas > 0 then return pp__err('Hay liberaciones que no corresponden a ' || case when p_tipo = 'inversion' then 'inversión' else 'servicios' end || '.'); end if;
  select valor::numeric into v_precio from pp_config where clave = 'precio_colacion';
  select valor::numeric into v_iva from pp_config where clave = 'iva_pct';
  select valor::numeric into v_ret from pp_config where clave = 'retencion_pct';
  select valor into v_base from pp_config where clave = 'retencion_base';
  v_desc := round(coalesce(p_col50, 0) * v_precio / 2 + coalesce(p_col100, 0) * v_precio);
  v_neto := round(v_bruto - v_desc - coalesce(p_otros, 0));
  if v_neto < 0 then return pp__err('Los descuentos superan el monto liberado.'); end if;
  v_ivam := round(v_neto * v_iva / 100);
  v_total := v_neto + v_ivam;
  v_retm := round((case when v_base = 'neto' then v_neto else v_total end) * v_ret / 100);
  v_apago := (case when v_base = 'neto' then v_neto else v_total end) - v_retm;
  insert into pp_liquidaciones (contratista, tipo, bruto, colaciones_50, colaciones_100, precio_colacion, descuento_colaciones, otros_descuentos,
      neto, iva_pct, iva, total_factura, retencion_pct, retencion_base, retencion, a_pago, fecha_factura, n_factura, creado_por)
    values (p_contratista, p_tipo, round(v_bruto), coalesce(p_col50, 0), coalesce(p_col100, 0), v_precio, v_desc, coalesce(p_otros, 0),
      v_neto, v_iva, v_ivam, v_total, v_ret, v_base, v_retm, v_apago, p_fecha, nullif(trim(coalesce(p_factura, '')), ''), a->>'nombre')
    returning id into v_id;
  update pp_liberaciones set liquidacion_id = v_id where id = any (p_ids);
  perform pp__mov(a->>'nombre', 'liquidacion', p_contratista || ' · ' || p_tipo || ' · total factura $' || v_total || ' · retención $' || v_retm || ' · a pago $' || v_apago);
  return jsonb_build_object('ok', true, 'id', v_id, 'neto', v_neto, 'iva', v_ivam, 'total_factura', v_total, 'retencion', v_retm, 'a_pago', v_apago);
end $$;

create or replace function public.pp_liquidacion_anular(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; r record;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador anula liquidaciones.'); end if;
  update pp_liquidaciones set anulada = true, anulada_por = a->>'nombre', anulada_en = now() where id = p_id and not anulada
    returning contratista, tipo into r;
  if not found then return pp__err('La liquidación no existe o ya estaba anulada.'); end if;
  update pp_liberaciones set liquidacion_id = null where liquidacion_id = p_id;
  perform pp__mov(a->>'nombre', 'anular_liquidacion', r.contratista || ' · ' || r.tipo);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pp_config_guardar(text, text, text), public.pp_inversion_guardar(text, text[]),
  public.pp_liquidar(text, text, text, bigint[], integer, integer, numeric, date, text), public.pp_liquidacion_anular(text, bigint) from public;
grant execute on function public.pp_config_guardar(text, text, text), public.pp_inversion_guardar(text, text[]),
  public.pp_liquidar(text, text, text, bigint[], integer, integer, numeric, date, text), public.pp_liquidacion_anular(text, bigint) to anon, authenticated;
