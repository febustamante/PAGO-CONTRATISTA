// PARTE 6F · Asistencia: si el trabajador vino o no cada día del mes (no suma jornadas), con totales.

import { h } from '../core/dom.js';
import { csv, descargar, unicos, fecha, numero } from '../core/dom.js';
import { asistenciaMes } from '../core/reglas.js';
import { filasAsistencia } from '../data/lectura.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render } from '../estado.js';
import { aviso, boton, campo, seleccion, toast, esqueleto, kpi, tabla, celda, tarjeta } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const U = () => (S.ui.asis = S.ui.asis || { mes: '', contratista: '', buscar: '', cache: {}, cargando: false, error: null });
const coma = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

function mesesDisponibles() {
  const hoy = new Date();
  const lista = [];
  for (let a = 2026, m = 5; a < hoy.getFullYear() || (a === hoy.getFullYear() && m <= hoy.getMonth() + 1); ) {
    lista.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1; if (m > 12) { m = 1; a += 1; }
  }
  return lista.reverse();
}

async function cargarMes(mes) {
  const u = U();
  u.cargando = true; u.error = null; render();
  try { u.cache[mes] = await filasAsistencia(mes); } catch (e) { u.error = e.message; }
  u.cargando = false; render();
}

export function vistaAsistencia() {
  const u = U();
  const meses = mesesDisponibles();
  if (!u.mes) {
    // Hasta el día 10 el mes en curso casi no tiene datos: se parte por el mes anterior.
    const hoy = new Date();
    const ref = new Date(hoy.getFullYear(), hoy.getMonth() - (hoy.getDate() < 10 ? 1 : 0), 1);
    const clave = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    u.mes = meses.includes(clave) ? clave : meses[0];
  }
  const raiz = h('div');
  raiz.appendChild(encabezado('Asistencia',
    'Vino o no vino cada día. Se toma de las filas de Labores: si el trabajador aparece ese día, vino. No se suman jornadas.'));

  const filas = u.cache[u.mes];
  if (!filas && !u.cargando && !u.error) cargarMes(u.mes);

  const contrs = filas ? unicos(filas.map((f) => f.contratista).filter(Boolean)) : [];
  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Mes', seleccion(meses.map((m) => [m, m]), u.mes, (v) => { u.mes = v; render(); })),
    campo('Contratista', seleccion([['', 'Todos'], ...contrs.map((c) => [c, c])], u.contratista, (v) => { u.contratista = v; render(); })),
    campo('Buscar', h('input', { placeholder: 'Nombre o RUT', value: u.buscar, oninput: (e) => { u.buscar = e.target.value; pintar(); } }))
  ]));

  if (u.cargando || !filas) { raiz.appendChild(u.error ? aviso('err', u.error) : esqueleto(8)); return raiz; }

  const corr = S.pp.asistencia;
  const [a, m] = u.mes.split('-').map(Number);
  const ndias = new Date(a, m, 0).getDate();
  const caja = h('div');
  raiz.appendChild(caja);

  function pintar() {
    let lista = asistenciaMes(filas.filter((f) => !u.contratista || f.contratista === u.contratista), u.mes, corr);
    const q = u.buscar.trim().toUpperCase();
    if (q) lista = lista.filter((p) => (p.nombre || '').toUpperCase().includes(q) || (p.rut || '').toUpperCase().includes(q));
    const total = lista.length;
    const totalDias = lista.reduce((s, p) => s + p.cuenta, 0);
    const manual = new Set(corr.map((c) => c.rut + '|' + String(c.fecha).slice(0, 10)));
    const editable = puede('asistencia');

    // Totales por día y por contratista
    const porDia = Array.from({ length: ndias }, () => 0);
    const porContr = new Map();
    for (const p of lista) {
      for (const d of p.dias) { const i = Number(d.slice(8, 10)) - 1; if (i >= 0 && i < ndias) porDia[i] += 1; }
      const c = porContr.get(p.contratista) || { personas: 0, dias: 0 };
      c.personas += 1; c.dias += p.cuenta; porContr.set(p.contratista, c);
    }

    const resumen = [...porContr.entries()].sort((x, y) => String(x[0]).localeCompare(String(y[0]))).map(([c, v]) =>
      h('tr', {}, [celda(c || '—'), celda(v.personas, { num: true }), celda(v.dias, { num: true }), celda(coma(v.dias / v.personas), { num: true })]));
    resumen.push(h('tr', { class: 'total' }, [celda('TOTAL'), celda(total, { num: true }), celda(totalDias, { num: true }), celda(total ? coma(totalDias / total) : '0,0', { num: true })]));

    const cabeza = h('tr', {}, [h('th', { class: 'nombre', text: 'Trabajador' }), h('th', { text: 'Días' }), ...Array.from({ length: ndias }, (_, i) => h('th', { text: i + 1 }))]);
    const cuerpo = h('tbody', { onclick: async (e) => {
      const t = e.target;
      if (!editable || !t.dataset || !t.dataset.rut) return;
      const vino = !t.classList.contains('si');
      const r = await operar(PP.asistencia(S.sesion.pin, t.dataset.rut, t.dataset.fecha, vino));
      if (!r.ok) toast(r.error, 'err');
    } });
    for (const p of lista.slice(0, 300)) {
      const tr = h('tr', {}, [h('td', { class: 'nombre', title: p.contratista, text: `${p.nombre} · ${p.rut}` }), h('td', { class: 'cuenta', text: p.cuenta })]);
      for (let d = 1; d <= ndias; d += 1) {
        const iso = `${u.mes}-${String(d).padStart(2, '0')}`;
        const dow = new Date(iso + 'T00:00:00').getDay();
        tr.appendChild(h('td', {}, [h('div', { class: 'dia ' + (p.dias.has(iso) ? 'si' : 'no') + (dow === 0 || dow === 6 ? ' fin' : '') + (manual.has(p.rut + '|' + iso) ? ' man' : ''), 'data-rut': p.rut, 'data-fecha': iso, title: iso })]));
      }
      cuerpo.appendChild(tr);
    }
    const pie = h('tfoot', {}, [h('tr', { class: 'pie-total' }, [h('td', { class: 'nombre', text: 'TOTAL personas por día' }), h('td', { class: 'cuenta', text: totalDias }), ...porDia.map((n) => h('td', { class: 'pd', text: n || '·' }))])]);

    caja.replaceChildren(
      h('div', { class: 'kpis chicos' }, [kpi(total, 'Trabajadores'), kpi(numero(totalDias), 'Total de días trabajados', { tono: 'verde', sub: 'suma de días que vino cada persona' }), kpi(total ? coma(totalDias / total) : '0,0', 'Promedio de días por persona')]),
      tarjeta('Total por contratista', tabla([{ t: 'Contratista' }, { t: 'Trabajadores', num: true }, { t: 'Total de días', num: true }, { t: 'Promedio', num: true }], resumen)),
      h('p', { class: 'leyenda' }, [h('span', { class: 'cuadro si' }), 'Vino', h('span', { class: 'cuadro no' }), 'No registrado', h('span', { class: 'cuadro man' }), 'Corregido a mano']),
      h('div', { class: 'tabla-caja', style: 'max-height:440px' }, [h('table', { class: 'tabla asis compacta' }, [h('thead', {}, [cabeza]), cuerpo, pie])]),
      total > 300 ? h('p', { class: 'nota', text: `Se muestran 300 de ${total} en la tabla; los totales incluyen a todos. Usa el buscador o filtra por contratista.` }) : null,
      h('div', { class: 'barra' }, [boton('Descargar CSV', { icon: 'descargar', onclick: () => descargar(`asistencia_${u.mes}.csv`, csv([
        ['Trabajador', 'RUT', 'Contratista', 'Días que vino', 'Fechas'],
        ...lista.map((p) => [p.nombre, p.rut, p.contratista, p.cuenta, [...p.dias].sort().map(fecha).join(' ')]),
        ['TOTAL', '', '', totalDias, '']
      ])) })])
    );
  }
  pintar();
  return raiz;
}
