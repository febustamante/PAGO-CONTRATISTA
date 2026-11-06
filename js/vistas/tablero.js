// PARTE 6B · Inicio: resumen, gráficos y tareas según el rol.

import { h } from '../core/dom.js';
import { dinero, numero, hace, fechaLarga, titulo } from '../core/dom.js';
import { kpi, tarjeta, boton, tabla, celda } from '../ui/componentes.js';
import { S, puede } from '../estado.js';
import { encabezado } from './_comun.js';

const millones = (n) => '$' + (Math.round(n / 100000) / 10).toFixed(1).replace('.', ',') + ' M';

export function vistaTablero(ir) {
  const r = S.d.res;
  const raiz = h('div');
  raiz.appendChild(encabezado('Inicio', 'Pendiente de pago de El Cerrillo con contratistas externos.'));

  const libs = S.pp.liberaciones;
  const sinFechaPago = libs.filter((l) => !l.fecha_pago);
  const conFechaPago = libs.filter((l) => l.fecha_pago);
  raiz.appendChild(h('div', { class: 'kpis' }, [
    kpi(millones(r.monto), 'Pendiente de pago', { sub: 'antes de IVA' }),
    kpi(r.pendientes, 'Grupos pendientes', { sub: `${numero(r.plantas)} plantas` }),
    kpi(millones(r.montoListo), 'Listos para liberar', { tono: 'verde', sub: `${r.listos} grupos sin alertas` }),
    kpi(r.revisar, 'A revisar', { tono: r.revisar ? 'ambar' : '', sub: `${r.noPagar} no pagar · ${r.pagar} pagar` }),
    kpi(r.azules, 'Cuartel-labor compartidos', { tono: 'azul', sub: 'dos o más contratistas' })
  ]));

  // Gráficos: pendiente por contratista y avance por etapa.
  const porC = new Map();
  for (const g of S.d.ev) porC.set(g.contratista, (porC.get(g.contratista) || 0) + g.monto);
  const barras = [...porC.entries()].sort((a, b) => b[1] - a[1]);
  const maximo = barras.length ? barras[0][1] : 1;
  const conPlantas = S.d.ev.filter((g) => g.confirmadas).length;
  const total = S.d.ev.length + libs.length;
  const etapas = [
    ['Pendientes', S.d.ev.length + libs.length, 'azul'],
    ['Plantas asignadas', conPlantas + libs.length, 'ambar'],
    ['Liberados', libs.length, 'verde'],
    ['Con fecha de pago', conFechaPago.length, 'verde']
  ];
  raiz.appendChild(h('div', { class: 'graficos' }, [
    tarjeta('Pendiente por contratista', barras.length ? barras.map(([c, v]) =>
      h('div', { class: 'g-fila' }, [h('span', { text: titulo(c) }), h('div', { class: 'g-pista' }, [h('div', { class: 'g-relleno', style: `width:${Math.max(3, Math.round(v / maximo * 100))}%` })]), h('span', { class: 'g-valor', text: millones(v) })]))
      : h('p', { class: 'vacio', text: 'No hay pendientes.' })),
    tarjeta('Avance por etapa', h('div', { class: 'g-embudo' }, etapas.map(([t, n, tono]) =>
      h('div', { class: 'g-paso' }, [h('span', { text: t }), h('div', { class: 'g-barra', style: `width:${total ? Math.max(8, Math.round(n / total * 100)) : 8}%;background:var(--${tono}-bg);color:var(--${tono})`, text: n })]))))
  ]));

  // Tareas según el rol
  const tareas = [];
  if (puede('aprobar') && r.propuestas) tareas.push([`${r.propuestas} propuestas de plantas esperan tu aprobación`, 'Revisar', 'hoja']);
  if (puede('liberar') && sinFechaPago.length) tareas.push([`${sinFechaPago.length} liberaciones esperan la fecha de pago (último paso)`, 'Poner fecha', 'pagos']);
  if (puede('liberar')) tareas.push([`${r.listos} grupos sin alertas se pueden liberar (${dinero(r.montoListo)})`, 'Liberar', 'liberar']);
  if (puede('asignar')) {
    const sin = S.d.ev.filter((g) => !g.confirmadas && g.propuesta == null).length;
    if (sin) tareas.push([`${sin} grupos aún sin plantas asignadas`, 'Asignar plantas', 'hoja']);
  }
  if (r.noPagar) tareas.push([`${r.noPagar} grupos marcados como no pagar (misma vuelta)`, 'Ver alertas', 'alertas']);

  raiz.appendChild(tarjeta('Tus tareas', tareas.length
    ? h('ul', { class: 'lista-acciones' }, tareas.map(([t, b, destino]) => h('li', {}, [h('span', { text: t }), boton(b, { onclick: () => ir(destino) })])))
    : h('p', { class: 'vacio', text: 'Nada pendiente de tu parte por ahora.' })));

  const mov = S.pp.movimientos.slice(0, 8);
  raiz.appendChild(tarjeta('Actividad reciente', tabla(
    [{ t: 'Cuándo' }, { t: 'Quién' }, { t: 'Qué' }],
    mov.map((m) => h('tr', {}, [celda(hace(m.creado_en) + ' · ' + fechaLarga(m.creado_en), { clase: 'sin-corte' }), celda(titulo(m.usuario), { clase: 'sin-corte' }), celda(m.detalle || m.accion)])),
    { vacio: 'Todavía no hay movimientos.' })));
  return raiz;
}
