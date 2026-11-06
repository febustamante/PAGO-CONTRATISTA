-- Software de pagos a contratistas. Parte 1: tablas nuevas (prefijo pp_).
-- No modifica ninguna tabla existente. RLS activado y sin politicas: nadie puede leer ni escribir
-- estas tablas directamente con la clave publica; todo pasa por las funciones de 02_funciones.sql,
-- que validan el PIN en el servidor.

create table if not exists public.pp_asignaciones (
  cuartel text not null,
  labor text not null,                       -- labor base (sin sufijo " 2")
  contratista text not null,
  valor numeric not null,
  plantas numeric not null check (plantas >= 0),
  estado text not null default 'propuesta' check (estado in ('propuesta', 'aprobada')),
  propuesto_por text,
  aprobado_por text,
  version integer not null default 1,
  actualizado_en timestamptz not null default now(),
  primary key (cuartel, labor, contratista, valor)
);

create table if not exists public.pp_reparto_manual (
  fila_id bigint primary key,                -- folios_detalle.id
  cuartel text not null,
  labor text not null,
  contratista text not null,
  valor numeric not null,
  plantas numeric not null check (plantas >= 0),
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.pp_liberaciones (
  id bigint generated always as identity primary key,
  cuartel text not null,
  labor text not null,
  contratista text not null,
  valor numeric not null,
  plantas numeric not null,
  filas integer not null default 0,
  monto numeric not null default 0,
  trabajo_ini date,
  trabajo_fin date,
  n_factura text not null,
  fecha_factura date not null,
  estado_al_liberar text,                    -- ok | azul | misma | nueva | excede
  motivo text,
  liberado_por text not null,
  creado_en timestamptz not null default now(),
  anulada boolean not null default false,
  anulada_por text,
  anulada_en timestamptz
);
create unique index if not exists pp_liberaciones_unica
  on public.pp_liberaciones (cuartel, labor, contratista, valor, coalesce(trabajo_ini, date '1900-01-01'))
  where not anulada;

create table if not exists public.pp_asistencia_ov (
  rut text not null,
  fecha date not null,
  vino boolean not null,
  por text,
  en timestamptz not null default now(),
  primary key (rut, fecha)
);

create table if not exists public.pp_contratos (
  contratista text not null,
  labor text not null,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  precio numeric not null check (precio >= 0),
  creado_por text,
  creado_en timestamptz not null default now(),
  primary key (contratista, labor, vigente_desde)
);

create table if not exists public.pp_movimientos (
  id bigint generated always as identity primary key,
  usuario text,
  accion text not null,
  detalle text,
  creado_en timestamptz not null default now()
);

create table if not exists public.pp_intentos (
  id bigint generated always as identity primary key,
  en timestamptz not null default now()
);

alter table public.pp_asignaciones enable row level security;
alter table public.pp_reparto_manual enable row level security;
alter table public.pp_liberaciones enable row level security;
alter table public.pp_asistencia_ov enable row level security;
alter table public.pp_contratos enable row level security;
alter table public.pp_movimientos enable row level security;
alter table public.pp_intentos enable row level security;

revoke all on public.pp_asignaciones, public.pp_reparto_manual, public.pp_liberaciones,
  public.pp_asistencia_ov, public.pp_contratos, public.pp_movimientos, public.pp_intentos
  from public, anon, authenticated;
