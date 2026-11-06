// PARTE 6E · Reparto por persona: las plantas del equipo se dividen por igual entre personas-día.
// Se puede ajustar a mano, pero el equipo siempre debe cuadrar con su total.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, titulo, oracion } from '../core/dom.js';
import { claveGrupo, monto, repartoIgual } from '../core/reglas.js';
import { filasEquipo } from '../data/lectura.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render, marcarPresencia } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, seleccion, toast, esqueleto } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const U = () => (S.ui.reparto = S.ui.reparto || { clave: '', filas: null, cargando: false, error: null, borrador: {}, vista: 'plantas' });

async function cargarFilas(g) {
  const u = U();
  u.cargando = true; u.error = null; u.filas = null;
  render();
  try {
    u.filas = await filasEquipo(g);
    iniciarBorrador(g);
  } catch (e) { u.error = e.message; }
  u.cargando = false;
  render();
}

function iniciarBorrador(g) {
  const u = U();
  const manual = new Map(S.pp.reparto.map((r) => [Number(r.fila_id), Number(r.plantas)]));
  const hayManual = u.filas.length && u.filas.every((f) => manual.has(Number(f.id)));
  const igual = repartoIgual(g.plantas, u.filas.length);
  u.borrador = {};
  u.filas.forEach((f, i) => { u.borrador[f.id] = hayManual ? manual.get(Number(f.id)) : igual[i]; });
  u.manual = hayManual;
}

export function vistaReparto() {
  const u = U();
  const ev = S.d.ev.filter((g) => !g.jornada);
  const raiz = h('div');
  marcarPresencia(null);
  raiz.appendChild(encabezado(null,
    'Las plantas del equipo se reparten por igual entre cada persona y cada día trabajado. Si hace falta, ajusta a mano: el total del equipo debe seguir cuadrando.'));
  if (!ev.length) { raiz.appendChild(h('p', { class: 'vacio', text: 'No hay grupos pendientes.' })); return raiz; }

  if (!u.clave || !ev.some((g) => claveGrupo(g) === u.clave)) { u.clave = claveGrupo(ev.find((g) => g.azul) || ev[0]); u.filas = null; }
  const g = ev.find((x) => claveGrupo(x) === u.clave);

  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Grupo', seleccion(ev.map((x) => [claveGrupo(x), `${x.cuartel} · ${oracion(x.labor)} · ${titulo(x.contratista)} · ${dinero(x.valor)} · ${numero(x.plantas)} pl.`]), u.clave, (v) => { u.clave = v; u.filas = null; render(); })),
    campo('Vista', seleccion([['plantas', 'Plantas'], ['montos', 'Montos por persona']], u.vista, (v) => { u.vista = v; render(); }))
  ]));

  if (u.filas === null && !u.cargando && !u.error) { cargarFilas(g); }
  if (u.cargando || u.filas === null) { raiz.appendChild(u.error ? aviso('err', u.error) : esqueleto(8)); return raiz; }
  if (u.error) { raiz.appendChild(aviso('err', u.error)); return raiz; }

  const puedeEditar = puede('repartir');
  const total = g.plantas;
  const cb = h('div');
  const montos = {};
  const suma = () => u.filas.reduce((s, f) => s + (u.borrador[f.id] || 0), 0);
  const refrescar = () => {
    const s = suma();
    const dif = Math.round((total - s) * 100) / 100;
    cb.replaceChildren(aviso(dif === 0 ? 'ok' : 'warn', dif === 0 ? `Cuadrado: ${numero(s)} de ${numero(total)} plantas asignadas.` : dif > 0 ? `Por repartir: ${numero(dif)} plantas.` : `Sobran ${numero(-dif)} plantas. Ajusta antes de guardar.`));
    for (const f of u.filas) { const m = montos[f.id]; if (m) m.textContent = dinero(monto(u.borrador[f.id] || 0, g.valor)); }
    return dif;
  };

  const avisos = [];
  if (u.filas.length !== g.filas) avisos.push(aviso('warn', `Labores trae ${u.filas.length} filas de personas y el pendiente cuenta ${g.filas}. Revisa antes de guardar.`));
  if (u.manual) avisos.push(aviso('info', 'Este equipo tiene un reparto manual guardado.'));

  const filas = u.filas.map((f) => {
    const inp = h('input', { type: 'number', min: '0', step: '1', value: u.borrador[f.id], disabled: !puedeEditar, class: 'entrada-num', 'aria-label': 'Plantas de ' + f.nombre, oninput: (e) => { u.borrador[f.id] = Math.max(0, Math.round(Number(e.target.value) || 0)); refrescar(); } });
    const cm = celda(dinero(monto(u.borrador[f.id], g.valor)), { num: true });
    montos[f.id] = cm;
    return h('tr', {}, [celda(fecha(f.fecha)), celda(titulo(f.nombre), { clase: 'sin-corte' }), celda(f.rut, { clase: 'sub' }), celda(f.jornada, { num: true }), celda(inp, { num: true }), u.vista === 'montos' ? cm : celda('')]);
  });

  const acciones = puedeEditar ? [
    boton('Repartir por igual', { onclick: () => { iniciarBordeIgual(g); render(); } }),
    boton('Volver al reparto por igual guardado', { onclick: async () => {
      const r = await operar(PP.guardarReparto(S.sesion.pin, { cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor }, total, []));
      if (r.ok) { u.filas = null; toast('Reparto manual eliminado.'); render(); } else toast(r.error, 'err');
    } }),
    boton('Guardar reparto', { tono: 'primario', onclick: async () => {
      if (refrescar() !== 0) { toast('El reparto no cuadra con el total del equipo.', 'err'); return; }
      const r = await operar(PP.guardarReparto(S.sesion.pin, { cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor }, total, u.filas.map((f) => ({ id: f.id, plantas: u.borrador[f.id] || 0 }))));
      if (r.ok) { u.filas = null; toast('Reparto guardado.'); render(); } else toast(r.error, 'err');
    } })
  ] : [];

  raiz.appendChild(tarjeta(`${g.cuartel} · ${oracion(g.labor)} · ${titulo(g.contratista)}`, [
    h('div', { class: 'kpis chicos' }, [
      h('div', { class: 'kpi' }, [h('div', { class: 'kpi-valor', text: numero(total) }), h('div', { class: 'kpi-etiqueta', text: 'Plantas del equipo' })]),
      h('div', { class: 'kpi' }, [h('div', { class: 'kpi-valor', text: u.filas.length }), h('div', { class: 'kpi-etiqueta', text: 'Personas-día' })]),
      h('div', { class: 'kpi' }, [h('div', { class: 'kpi-valor', text: dinero(monto(total, g.valor)) }), h('div', { class: 'kpi-etiqueta', text: 'Total del equipo' })])
    ]),
    ...avisos, cb,
    h('div', { class: 'barra fin' }, acciones),
    tabla([{ t: 'Día' }, { t: 'Trabajador' }, { t: 'RUT' }, { t: 'Jornada', num: true }, { t: 'Plantas', num: true }, { t: u.vista === 'montos' ? 'Monto' : '' }], filas, { alto: 480 })
  ]));
  setTimeout(refrescar, 0);
  return raiz;
}

function iniciarBordeIgual(g) {
  const u = U();
  const igual = repartoIgual(g.plantas, u.filas.length);
  u.borrador = {};
  u.filas.forEach((f, i) => { u.borrador[f.id] = igual[i]; });
}
