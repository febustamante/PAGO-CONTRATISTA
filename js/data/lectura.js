// PARTE 3B · Lectura de los datos que ya existen en Supabase (solo lectura).

import { leer } from './api.js';
import { laborBase, esPersonalPropio } from '../core/reglas.js';

const enc = encodeURIComponent;
const dia = (iso) => String(iso).slice(0, 10);

export async function cargarBase() {
  const [cuarteles, pagos] = await Promise.all([
    leer('cuarteles_plantas', 'select=cuartel,grupo,plantas_total,variedad', { todo: true }),
    leer('pagos_facturados', 'select=cuartel,labor,contratista,valor_unitario,plantas,lineas,fecha_factura,n_factura,trabajo_ini,trabajo_fin&cuartel=like.C*', { todo: true })
  ]);
  const mapa = {};
  for (const c of cuarteles) mapa[c.cuartel] = { cuartel: c.cuartel, campo: c.grupo, plantas: Number(c.plantas_total), variedad: c.variedad };
  return { cuarteles: mapa, pagos };
}

// Filas de trabajadores (persona y día) de un grupo pendiente.
export async function filasEquipo(g) {
  const q = `select=id,fecha,folio,labor,rut_trabajador,nombre_trabajador,jornada,tipo` +
    `&cuartel=eq.${enc(g.cuartel)}&contratista=eq.${enc(g.contratista)}&valor_unitario=eq.${g.valor}` +
    `&labor=like.${enc(g.labor)}*&fecha=gte.${dia(g.ini)}&fecha=lte.${dia(g.fin)}T23:59:59&order=fecha,nombre_trabajador`;
  const filas = await leer('folios_detalle', q, { todo: true });
  return filas.filter((f) => laborBase(f.labor) === g.labor).map((f) => ({
    id: f.id, fecha: dia(f.fecha), folio: f.folio, rut: f.rut_trabajador, nombre: f.nombre_trabajador, jornada: f.jornada
  }));
}

// Asistencia de un mes: quién aparece trabajando cada día.
export async function filasAsistencia(mes) {
  const [a, m] = mes.split('-').map(Number);
  const sig = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  const filas = await leer('folios_detalle',
    `select=rut_trabajador,nombre_trabajador,contratista,fecha,campo,cuartel&fecha=gte.${mes}-01&fecha=lt.${sig}&order=fecha`, { todo: true });
  return filas.filter((f) => f.rut_trabajador).map((f) => ({
    rut: f.rut_trabajador, nombre: f.nombre_trabajador, contratista: f.contratista, fecha: dia(f.fecha), campo: f.campo, cuartel: f.cuartel
  }));
}

// Folios aprobados con número, sin los del contratista Agrícola San José (para la impresión).
export async function foliosAprobados() {
  const filas = await leer('folios_labores',
    'select=folio,cuartel,labor,contratista,fecha_aprobado&estado=eq.APROBADO&fecha_aprobado=gte.2026-05-01', { todo: true });
  const porFolio = new Map();
  for (const f of filas) {
    if (!/^\d+$/.test(f.folio || '') || esPersonalPropio(f.contratista)) continue;
    porFolio.set(Number(f.folio), { folio: Number(f.folio), cuartel: f.cuartel, labor: f.labor, contratista: f.contratista, fecha: f.fecha_aprobado });
  }
  return [...porFolio.values()].sort((a, b) => a.folio - b.folio);
}

// Plantas reales por folio (para Rulo, Nuevo Sendero y Valdés).
export async function foliosDesde(desde) {
  const filas = await leer('folios_labores',
    `select=folio,estado,cuartel,labor,contratista,plantas,costo,fecha_aprobado,tipo&tipo=eq.TRATO&fecha_aprobado=gte.${desde}`, { todo: true });
  return filas.map((f) => ({ ...f, plantas: Number(f.plantas) || 0, costo: Number(f.costo) || 0 }));
}
