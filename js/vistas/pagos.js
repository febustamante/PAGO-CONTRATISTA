// PARTE 6L · Pagos: una sola pantalla con tres pestañas (Por liberar, Liberados, Con fecha de pago).
// Monto = plantas × precio × 1,5. Último paso: la fecha de pago se pone de una vez a todo lo liberado.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, unicos, csv, descargar, titulo, oracion } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, seleccion, kpi, chip, toast, confirmar, etapa, pestanas, pildora } from '../ui/componentes.js';
import { encabezado } from './_comun.js';
import { porLiberar } from './liberar.js';

const U = () => (S.ui.pagos = S.ui.pagos || { contratista: '', fechaPago: '' });
const coma = (n) => String(n).replace('.', ',');

export function vistaPagos() {
  const f = CONFIG.FACTOR_CONTRATISTA;
  const libs = S.pp.liberaciones;
  const sinFecha = libs.filter((l) => !l.fecha_pago);
  const conFecha = libs.filter((l) => l.fecha_pago);
  const pestana = S.ui.pagosTab || 'liberar';
  const raiz = h('div');

  const accionesTab = pestana === 'liberar' ? [] : [
    boton('Imprimir o guardar PDF', { icon: 'imprimir', onclick: () => window.print() }),
    boton('Descargar CSV', { icon: 'descargar', onclick: () => exportar(pestana === 'liberados' ? sinFecha : conFecha) })
  ];
  raiz.appendChild(encabezado('Pagos',
    `Por liberar, liberado y pagado en un solo lugar. A cada precio se le suma el 50%: monto = plantas × precio × ${coma(f)}. Ejemplo: 100 plantas a $150 = ${dinero(100 * 150 * f)}.`, accionesTab));

  raiz.appendChild(h('div', { class: 'pestanas', role: 'tablist' }, [
    ['liberar', 'Por liberar', S.d.ev.length], ['liberados', 'Liberados', sinFecha.length], ['pagados', 'Con fecha de pago', conFecha.length]
  ].map(([v, t, n]) => h('button', { class: 'pestana' + (v === pestana ? ' activa' : ''), role: 'tab', 'aria-selected': v === pestana ? 'true' : 'false', onclick: () => { S.ui.pagosTab = v; render(); } }, [t, h('span', { class: 'cuenta-p', text: n })]))));

  if (pestana === 'liberar') raiz.appendChild(porLiberar());
  else raiz.appendChild(contenidoLiberados(pestana === 'liberados' ? sinFecha : conFecha, pestana === 'liberados'));
  return raiz;
}

function exportar(lista) {
  const f = CONFIG.FACTOR_CONTRATISTA;
  descargar('pagos_liberados.csv', csv([
    ['Contratista', 'Cuartel', 'Labor', 'Plantas', 'Precio', 'Precio +50%', 'Monto', 'Factura', 'Fecha de pago', 'Liberó', 'Motivo'],
    ...lista.map((l) => [titulo(l.contratista), l.cuartel, oracion(l.labor), l.plantas, l.valor, Number(l.valor) * f, Math.round(l.monto), l.n_factura, l.fecha_pago, titulo(l.liberado_por), l.motivo])
  ]));
}

function contenidoLiberados(base, esSinFecha) {
  const u = U();
  const f = CONFIG.FACTOR_CONTRATISTA;
  const libs = base.filter((l) => !u.contratista || l.contratista === u.contratista);
  const raiz = h('div');
  const total = libs.reduce((s, l) => s + Number(l.monto), 0);
  const porC = new Map();
  for (const l of libs) { if (!porC.has(l.contratista)) porC.set(l.contratista, []); porC.get(l.contratista).push(l); }

  raiz.appendChild(h('div', { class: 'kpis' }, [
    kpi(dinero(total), esSinFecha ? 'Liberado sin fecha de pago' : 'Pagado', { sub: 'antes de IVA', tono: esSinFecha ? 'ambar' : 'verde' }),
    kpi(numero(libs.reduce((s, l) => s + Number(l.plantas), 0)), 'Plantas'),
    kpi(libs.length, 'Grupos'),
    kpi(porC.size, 'Contratistas')
  ]));

  if (esSinFecha && puede('liberar')) raiz.appendChild(ultimoPaso(base));

  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Contratista', seleccion([['', 'Todos'], ...unicos(base.map((l) => l.contratista)).map((c) => [c, titulo(c)])], u.contratista, (v) => { u.contratista = v; render(); }))
  ]));

  if (!libs.length) {
    raiz.appendChild(tarjeta(null, h('p', { class: 'vacio', text: esSinFecha ? 'No hay nada liberado esperando fecha de pago. Libera grupos en la pestaña Por liberar.' : 'Todavía no hay pagos con fecha de pago.' })));
    return raiz;
  }

  for (const [nombre, lista] of [...porC.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sub = lista.reduce((s, l) => s + Number(l.monto), 0);
    const plantas = lista.reduce((s, l) => s + Number(l.plantas), 0);
    const filas = lista.map((l) => h('tr', {}, [
      celda(`${l.cuartel} · ${oracion(l.labor)}`, { clase: 'sin-corte' }), celda(numero(l.plantas), { num: true }), celda(dinero(l.valor), { num: true }),
      celda(dinero(Number(l.valor) * f), { num: true }), celda(dinero(l.monto), { num: true, clase: 'sin-corte' }),
      celda(l.n_factura || '—'),
      celda(etapa(l.fecha_pago ? 3 : 2), { clase: 'sin-corte' }),
      celda(l.fecha_pago ? 'Pagado ' + fecha(l.fecha_pago) : '', { clase: 'sin-corte' }),
      celda([l.motivo ? pildora('Con motivo', 'ambar', l.motivo) : null,
        l.fecha_pago && puede('liberar') ? boton('Quitar fecha', { onclick: async () => {
          const r = await operar(PP.fijarFechaPago(S.sesion.pin, [l.id], null));
          if (r.ok) toast('Fecha de pago quitada.'); else toast(r.error, 'err');
        } }) : null,
        !l.fecha_pago && puede('liberar') ? boton('Deshacer', { onclick: async () => {
          const ok = await confirmar({ titulo: 'Deshacer la liberación', mensaje: `${l.cuartel} · ${oracion(l.labor)} · ${titulo(l.contratista)} vuelve a Por liberar.`, ok: 'Deshacer', tono: '' });
          if (!ok) return;
          const r = await operar(PP.deshacer(S.sesion.pin, l.id));
          if (r.ok) toast('Liberación deshecha.'); else toast(r.error, 'err');
        } }) : null])
    ]));
    filas.push(h('tr', { class: 'total' }, [celda('Total ' + titulo(nombre)), celda(numero(plantas), { num: true }), celda(''), celda(''), celda(dinero(sub), { num: true }), celda(''), celda(''), celda(''), celda('')]));
    raiz.appendChild(tarjeta(titulo(nombre), tabla(
      [{ t: 'Cuartel y labor' }, { t: 'Plantas', num: true }, { t: 'Precio', num: true }, { t: 'Precio +50%', num: true }, { t: 'Monto', num: true }, { t: 'Factura' }, { t: 'Etapa' }, { t: 'Fecha de pago' }, { t: '' }], filas),
      { acciones: [chip(dinero(sub), 'verde')] }));
  }
  return raiz;
}

// Último paso: una sola fecha para todo lo liberado que todavía no la tiene.
function ultimoPaso(pendientes) {
  const u = U();
  const total = pendientes.reduce((s, l) => s + Number(l.monto), 0);
  const entrada = h('input', { type: 'date', value: u.fechaPago, oninput: (e) => { u.fechaPago = e.target.value; } });
  const salida = h('div');
  const aplicar = async () => {
    salida.replaceChildren();
    if (!pendientes.length) { salida.appendChild(aviso('info', 'No hay nada liberado sin fecha de pago.')); return; }
    if (!entrada.value) { salida.appendChild(aviso('err', 'Elige la fecha de pago.')); return; }
    const ok = await confirmar({
      titulo: `Poner fecha de pago ${fecha(entrada.value)} a todo lo liberado`,
      mensaje: `${pendientes.length} liberaciones por ${dinero(total)}.`, ok: 'Poner fecha de pago',
      detalle: [...new Set(pendientes.map((l) => l.contratista))].sort().map((c) => h('div', {}, [h('span', { text: titulo(c) }), h('b', { text: dinero(pendientes.filter((l) => l.contratista === c).reduce((s, l) => s + Number(l.monto), 0)) })]))
    });
    if (!ok) return;
    const r = await operar(PP.fijarFechaPago(S.sesion.pin, null, entrada.value));
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); return; }
    u.fechaPago = '';
    toast(`Fecha de pago puesta a ${r.r.actualizadas} liberaciones.`);
    S.ui.pagosTab = 'pagados';
    render();
  };
  return tarjeta('Último paso: fecha de pago', [
    h('p', { class: 'nota', text: `${pendientes.length} liberaciones por ${dinero(total)} esperan su fecha de pago. Se pone una sola fecha a todas.` }),
    h('div', { class: 'barra' }, [campo('Fecha de pago', entrada), boton('Poner fecha de pago a todo lo liberado', { tono: 'primario', onclick: aplicar, deshabilitado: !pendientes.length })]),
    salida
  ]);
}
