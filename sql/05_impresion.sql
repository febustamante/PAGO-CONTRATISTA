-- Parte 5: impresion de folios. La plataforma recuerda el ultimo folio impreso y lista los que vienen despues.

create table if not exists public.pp_impresion (
  id integer primary key default 1 check (id = 1),     -- una sola fila
  ultimo_folio integer not null default 0,
  iniciado boolean not null default false,             -- falso hasta que se indica desde que folio partir
  reintentar integer[] not null default '{}',          -- folios que no salieron y hay que reintentar
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);
insert into public.pp_impresion (id) values (1) on conflict (id) do nothing;

create table if not exists public.pp_impresiones (
  id bigint generated always as identity primary key,
  desde integer,
  hasta integer,
  cantidad integer not null default 0,
  errores integer[] not null default '{}',
  nota text,
  por text,
  en timestamptz not null default now()
);

alter table public.pp_impresion enable row level security;
alter table public.pp_impresiones enable row level security;
revoke all on public.pp_impresion, public.pp_impresiones from public, anon, authenticated;

create or replace function public.pp_impresion_leer(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; r record;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador usa la impresión de folios.'); end if;
  select * into r from pp_impresion where id = 1;
  return jsonb_build_object('ok', true, 'ultimo_folio', r.ultimo_folio, 'iniciado', r.iniciado, 'reintentar', to_jsonb(r.reintentar),
    'actualizado_por', r.actualizado_por, 'actualizado_en', r.actualizado_en,
    'historial', coalesce((select jsonb_agg(to_jsonb(x) order by x.en desc) from (select * from pp_impresiones order by en desc limit 20) x), '[]'::jsonb));
end $$;

-- Deja el ultimo folio impreso en p_hasta y guarda la lista de folios a reintentar.
create or replace function public.pp_impresion_marcar(p_pin text, p_hasta integer, p_cantidad integer, p_reintentar integer[], p_nota text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; r record;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador usa la impresión de folios.'); end if;
  if p_hasta is null or p_hasta < 0 or p_hasta > 99999999 then return pp__err('El número de folio no es válido.'); end if;
  select * into r from pp_impresion where id = 1 for update;
  update pp_impresion set ultimo_folio = p_hasta, iniciado = true, reintentar = coalesce(p_reintentar, '{}'),
    actualizado_por = a->>'nombre', actualizado_en = now() where id = 1;
  insert into pp_impresiones (desde, hasta, cantidad, errores, nota, por)
    values (case when r.iniciado then r.ultimo_folio + 1 else null end, p_hasta, coalesce(p_cantidad, 0), coalesce(p_reintentar, '{}'), nullif(trim(coalesce(p_nota, '')), ''), a->>'nombre');
  perform pp__mov(a->>'nombre', 'impresion', case when r.iniciado then 'último folio impreso: ' || r.ultimo_folio || ' → ' || p_hasta else 'impresión iniciada desde el folio ' || p_hasta end
    || coalesce(' · ' || nullif(trim(coalesce(p_nota, '')), ''), ''));
  return jsonb_build_object('ok', true, 'ultimo_folio', p_hasta);
end $$;

revoke all on function public.pp_impresion_leer(text), public.pp_impresion_marcar(text, integer, integer, integer[], text) from public;
grant execute on function public.pp_impresion_leer(text), public.pp_impresion_marcar(text, integer, integer, integer[], text) to anon, authenticated;
