-- Parte 4: presencia. Muestra quien esta mirando o editando un grupo para no pisarse.
-- La tabla se limpia sola: los registros de mas de 10 minutos se borran en cada llamada.

create table if not exists public.pp_presencia (
  usuario text not null,
  clave text not null,
  en timestamptz not null default now(),
  primary key (usuario, clave)
);
alter table public.pp_presencia enable row level security;
revoke all on public.pp_presencia from public, anon, authenticated;

-- Registra que el usuario esta en p_clave (o nada si es nula) y devuelve quienes estuvieron activos en el ultimo minuto.
create or replace function public.pp_presencia(p_pin text, p_clave text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  a := pp__auth(p_pin);
  if a is null or a ? 'bloqueado' then return pp__err('No autorizado.'); end if;
  delete from pp_presencia where en < now() - interval '10 minutes';
  delete from pp_presencia where usuario = a->>'nombre' and (p_clave is null or clave <> p_clave) and en < now() - interval '5 seconds';
  if p_clave is not null and length(p_clave) between 1 and 200 then
    insert into pp_presencia (usuario, clave, en) values (a->>'nombre', p_clave, now())
      on conflict (usuario, clave) do update set en = now();
  end if;
  return jsonb_build_object('ok', true, 'presencia',
    coalesce((select jsonb_agg(jsonb_build_object('usuario', x.usuario, 'clave', x.clave)) from pp_presencia x
              where x.en > now() - interval '60 seconds' and x.usuario <> a->>'nombre'), '[]'::jsonb));
end $$;

revoke all on function public.pp_presencia(text, text) from public;
grant execute on function public.pp_presencia(text, text) to anon, authenticated;
