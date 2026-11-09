-- Parte 6: usuarios y claves propios de la plataforma. Ya no depende de usuarios_sj (Labores).
-- Las claves se guardan cifradas (bcrypt). El ingreso entrega una sesión de 12 horas; las demás
-- funciones reciben ese código de sesión en el parametro p_pin (se mantiene el nombre por compatibilidad).

create table if not exists public.pp_usuarios (
  id bigint generated always as identity primary key,
  usuario text not null unique check (usuario = lower(usuario) and usuario ~ '^[a-z0-9._-]{3,40}$'),
  nombre text not null,
  rol text not null check (rol in ('admin', 'jefa_campo', 'lectura')),
  clave_hash text not null,
  debe_cambiar boolean not null default true,       -- la clave inicial es temporal: se cambia en el primer ingreso
  activo boolean not null default true,
  creado_por text,
  creado_en timestamptz not null default now(),
  ultimo_ingreso timestamptz
);

create table if not exists public.pp_sesiones (
  token_hash text primary key,                      -- solo se guarda el resumen (sha256) del código
  usuario_id bigint not null references public.pp_usuarios(id) on delete cascade,
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null
);

alter table public.pp_intentos add column if not exists usuario text;

alter table public.pp_usuarios enable row level security;
alter table public.pp_sesiones enable row level security;
revoke all on public.pp_usuarios, public.pp_sesiones from public, anon, authenticated;

drop function if exists public.pp_login(text);

-- Valida un código de sesión. Con debe_cambiar activo solo deja pasar el cambio de clave.
create or replace function public.pp__auth2(p_token text, p_permitir_cambio boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v record;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select u.id, u.nombre, u.rol, u.debe_cambiar into v
    from pp_sesiones s join pp_usuarios u on u.id = s.usuario_id
    where s.token_hash = encode(digest(p_token, 'sha256'), 'hex') and s.vence_en > now() and u.activo;
  if not found then return null; end if;
  if v.debe_cambiar and not p_permitir_cambio then return null; end if;
  return jsonb_build_object('uid', v.id, 'nombre', v.nombre, 'rol', v.rol, 'debe_cambiar', v.debe_cambiar);
end $$;

-- Mismo nombre y uso que antes: las demás funciones siguen llamando a pp__auth(p_pin).
create or replace function public.pp__auth(p_pin text) returns jsonb
language sql security definer set search_path = public, extensions as $$ select public.pp__auth2(p_pin, false) $$;

create or replace function public.pp_login(p_usuario text, p_clave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v record; u text := lower(trim(coalesce(p_usuario, ''))); fallos_u int; fallos_g int; tok text;
begin
  delete from pp_intentos where en < now() - interval '1 day';
  delete from pp_sesiones where vence_en < now();
  select count(*) into fallos_u from pp_intentos where usuario = u and en > now() - interval '10 minutes';
  select count(*) into fallos_g from pp_intentos where en > now() - interval '5 minutes';
  if fallos_u >= 8 or fallos_g >= 60 then return pp__err('Demasiados intentos. Espera unos minutos.'); end if;
  select * into v from pp_usuarios where usuario = u and activo;
  if not found or v.clave_hash <> crypt(coalesce(p_clave, ''), v.clave_hash) then
    insert into pp_intentos (usuario) values (u);
    return pp__err('Usuario o clave incorrectos.');
  end if;
  tok := encode(gen_random_bytes(32), 'hex');
  insert into pp_sesiones (token_hash, usuario_id, vence_en) values (encode(digest(tok, 'sha256'), 'hex'), v.id, now() + interval '12 hours');
  update pp_usuarios set ultimo_ingreso = now() where id = v.id;
  return jsonb_build_object('ok', true, 'token', tok, 'nombre', v.nombre, 'rol', v.rol, 'debe_cambiar', v.debe_cambiar);
end $$;

create or replace function public.pp_salir(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from pp_sesiones where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pp_cambiar_clave(p_token text, p_actual text, p_nueva text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a jsonb; hash_actual text; uid bigint;
begin
  a := pp__auth2(p_token, true);
  if a is null then return pp__err('La sesión venció. Vuelve a ingresar.'); end if;
  uid := (a->>'uid')::bigint;
  select clave_hash into hash_actual from pp_usuarios where id = uid;
  if hash_actual <> crypt(coalesce(p_actual, ''), hash_actual) then return pp__err('La clave actual no es correcta.'); end if;
  if length(coalesce(p_nueva, '')) < 8 then return pp__err('La clave nueva debe tener al menos 8 caracteres.'); end if;
  if p_nueva = p_actual then return pp__err('La clave nueva debe ser distinta a la actual.'); end if;
  update pp_usuarios set clave_hash = crypt(p_nueva, gen_salt('bf', 10)), debe_cambiar = false where id = uid;
  delete from pp_sesiones where usuario_id = uid and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  perform pp__mov(a->>'nombre', 'cambio_de_clave', 'cambió su clave');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pp_usuarios_listar(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a jsonb;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador administra usuarios.'); end if;
  return jsonb_build_object('ok', true, 'usuarios', coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'usuario', u.usuario, 'nombre', u.nombre, 'rol', u.rol, 'activo', u.activo,
      'debe_cambiar', u.debe_cambiar, 'ultimo_ingreso', u.ultimo_ingreso, 'creado_en', u.creado_en) order by u.nombre) from pp_usuarios u), '[]'::jsonb));
end $$;

-- Crea o edita un usuario. Con p_clave se (re)define la clave temporal: la persona debe cambiarla al ingresar.
create or replace function public.pp_usuario_guardar(p_token text, p_usuario text, p_nombre text, p_rol text, p_clave text, p_activo boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a jsonb; u text := lower(trim(coalesce(p_usuario, ''))); ant record; otros_admin int; existe boolean;
begin
  a := pp__auth(p_token);
  if a is null then return pp__err('No autorizado.'); end if;
  if a->>'rol' <> 'admin' then return pp__err('Solo el administrador administra usuarios.'); end if;
  if u !~ '^[a-z0-9._-]{3,40}$' then return pp__err('El usuario debe tener de 3 a 40 letras minúsculas, números, punto, guion o guion bajo.'); end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then return pp__err('Falta el nombre.'); end if;
  if p_rol not in ('admin', 'jefa_campo', 'lectura') then return pp__err('El perfil no es válido.'); end if;
  select * into ant from pp_usuarios where usuario = u;
  existe := found;
  if not existe and length(coalesce(p_clave, '')) < 8 then return pp__err('La clave temporal debe tener al menos 8 caracteres.'); end if;
  if existe and p_clave is not null and p_clave <> '' and length(p_clave) < 8 then return pp__err('La clave temporal debe tener al menos 8 caracteres.'); end if;
  if existe and ant.rol = 'admin' and ant.activo and (p_rol <> 'admin' or not coalesce(p_activo, true)) then
    select count(*) into otros_admin from pp_usuarios where rol = 'admin' and activo and id <> ant.id;
    if otros_admin = 0 then return pp__err('Debe quedar al menos un administrador activo.'); end if;
  end if;
  if not existe then
    insert into pp_usuarios (usuario, nombre, rol, clave_hash, debe_cambiar, activo, creado_por)
      values (u, trim(p_nombre), p_rol, crypt(p_clave, gen_salt('bf', 10)), true, coalesce(p_activo, true), a->>'nombre');
  else
    update pp_usuarios set nombre = trim(p_nombre), rol = p_rol, activo = coalesce(p_activo, true),
      clave_hash = case when p_clave is not null and p_clave <> '' then crypt(p_clave, gen_salt('bf', 10)) else clave_hash end,
      debe_cambiar = case when p_clave is not null and p_clave <> '' then true else debe_cambiar end
      where id = ant.id;
    if (p_clave is not null and p_clave <> '') or not coalesce(p_activo, true) then delete from pp_sesiones where usuario_id = ant.id; end if;
  end if;
  perform pp__mov(a->>'nombre', 'usuario', case when existe then 'actualizó' else 'creó' end || ' al usuario ' || u || ' (' || p_rol || ')'
    || case when p_clave is not null and p_clave <> '' then ' con clave temporal' else '' end || case when not coalesce(p_activo, true) then ' · desactivado' else '' end);
  return jsonb_build_object('ok', true, 'creado', not existe);
end $$;

revoke all on function public.pp__auth2(text, boolean) from public, anon, authenticated;
revoke all on function public.pp__auth(text) from public, anon, authenticated;
revoke all on function public.pp_login(text, text), public.pp_salir(text), public.pp_cambiar_clave(text, text, text),
  public.pp_usuarios_listar(text), public.pp_usuario_guardar(text, text, text, text, text, boolean) from public;
grant execute on function public.pp_login(text, text), public.pp_salir(text), public.pp_cambiar_clave(text, text, text),
  public.pp_usuarios_listar(text), public.pp_usuario_guardar(text, text, text, text, text, boolean) to anon, authenticated;
