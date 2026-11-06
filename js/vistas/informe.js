// PARTE 6N · Informe "Pendiente de pago y casos a revisar · El Cerrillo", listo para PDF y Excel.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, titulo, oracion, descargarExcel, csv, descargar } from '../core/dom.js';
import { S } from '../estado.js';
import { boton, tarjeta, tabla, celda, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const hoyTexto = () => new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function textoQueHacer(g) {
  if (g.estado === 'misma') return 'Misma vuelta: no pagar' + (g.otroPrecio ? ' · otro precio' : '');
  return `Vuelta nueva (${g.dias} d): pagar` + (g.otroPrecio ? ' · otro precio' : '');
}

export function vistaInforme() {
  const ev = S.d.ev;
  const r = S.d.res;
  const revisar = ev.filter((g) => g.rojo);
  const raiz = h('div');

  const hojas = () => [
    { nombre: 'Pendiente', filas: [['Cuartel', 'Labor', 'Contratista', 'Precio', 'Filas', 'Plantas', 'Monto', 'Desde', 'Alerta'],
      ...ev.map((g) => [g.cuartel, oracion(g.labor), titulo(g.contratista), g.valor, g.filas, g.plantas, Math.round(g.monto), g.ini, g.rojo ? 'Pago anterior' : g.azul ? 'Compartido' : '']),
      ['TOTAL', '', '', '', ev.reduce((s, g) => s + g.filas, 0), ev.reduce((s, g) => s + g.plantas, 0), Math.round(ev.reduce((s, g) => s + g.monto, 0)), '', '']] },
    { nombre: 'A revisar', filas: [['Cuartel', 'Labor', 'Contratista', 'Precio', 'Filas', 'Desde', 'Ya pagado con factura', 'Qué hacer'],
      ...revisar.map((g) => [g.cuartel, oracion(g.labor), titulo(g.contratista), g.valor, g.filas, g.ini, g.pagos.map((p) => `${titulo(p.contratista)} $${p.valor} fact ${p.factura || 's/n'}`).join(' | '), textoQueHacer(g)])] },
    { nombre: 'Liberados', filas: [['Contratista', 'Cuartel', 'Labor', 'Plantas', 'Precio', 'Monto', 'Factura', 'Fecha de pago'],
      ...S.pp.liberaciones.map((l) => [titulo(l.contratista), l.cuartel, oracion(l.labor), l.plantas, l.valor, Math.round(l.monto), l.n_factura, l.fecha_pago])] }
  ];

  raiz.appendChild(encabezado('Informe', 'El mismo informe de pendiente y casos a revisar, siempre al día. Imprímelo o guárdalo como PDF, o descárgalo en Excel.', [
    boton('Imprimir o guardar PDF', { icon: 'imprimir', onclick: () => window.print() }),
    boton('Descargar Excel', { icon: 'descargar', onclick: async () => {
      try { await descargarExcel(`pendiente_y_revisar_${new Date().toISOString().slice(0, 10)}.xlsx`, hojas()); toast('Excel descargado.'); }
      catch (e) { descargar('pendiente.csv', csv(hojas()[0].filas)); toast(e.message + ' Se descargó un CSV.', 'err'); }
    } })
  ]));

  const papel = h('div', { class: 'tarjeta' });
  papel.appendChild(h('div', { class: 'informe-cab' }, [
    h('div', { class: 'marca' }, [h('span', { class: 'marca-a', text: 'Agrícola' }), h('span', { class: 'marca-b', text: 'San José' })]),
    h('div', { style: 'text-align:right' }, [h('div', { class: 'sub', text: hoyTexto() }), h('h2', { text: 'Pendiente de pago y casos a revisar · El Cerrillo', style: 'font-size:18px' })])
  ]));
  papel.appendChild(h('div', { class: 'informe-resumen' }, [
    h('b', { text: String(r.pendientes) }), ' pendientes · ', h('b', { text: String(r.azules) }), ' cuartel-labor con dos o más contratistas · ',
    h('b', { text: String(r.revisar) }), ` a revisar (pago anterior): ${r.noPagar} no pagar y ${r.pagar} pagar`
  ]));

  papel.appendChild(h('h2', { text: '1 · Todo lo pendiente, por cuartel, labor, contratista y precio', style: 'margin:6px 0 4px' }));
  papel.appendChild(h('p', { class: 'nota', text: 'Rojo: ya hay un pago anterior en ese cuartel y labor (ver punto 2). Azul: dos o más contratistas pendientes en el mismo cuartel y labor.' }));
  papel.appendChild(tabla(
    [{ t: 'Cuartel' }, { t: 'Labor' }, { t: 'Contratista' }, { t: 'Precio', num: true }, { t: 'Filas', num: true }, { t: 'Plantas', num: true }, { t: 'Desde' }, { t: '' }],
    ev.map((g) => h('tr', { class: g.rojo ? 'f-rojo' : g.azul ? 'f-azul' : '' }, [
      celda(g.cuartel), celda(oracion(g.labor)), celda(titulo(g.contratista), { clase: 'sin-corte' }), celda(dinero(g.valor), { num: true }), celda(g.filas, { num: true }),
      celda(numero(g.plantas), { num: true }), celda(fecha(g.ini)), celda(g.rojo ? '●' : g.azul ? '●' : '', { clase: g.rojo ? 'txt-rojo' : 'txt-azul' })
    ]))));

  papel.appendChild(h('h2', { text: '2 · A revisar: ya pagado antes o a otro precio', style: 'margin:20px 0 4px' }));
  papel.appendChild(h('p', { class: 'nota', text: 'Regla: 7 días o menos entre pagos es la misma vuelta (no pagar); más de 7 días es vuelta nueva (pagar). «Otro precio» significa que el pago anterior fue a distinto valor.' }));
  papel.appendChild(tabla(
    [{ t: 'Cuartel' }, { t: 'Labor' }, { t: 'Contratista' }, { t: 'Precio', num: true }, { t: 'Filas', num: true }, { t: 'Desde' }, { t: 'Ya pagado con factura' }, { t: 'Qué hacer' }],
    revisar.map((g) => h('tr', {}, [
      celda(g.cuartel, { clase: 'txt-rojo' }), celda(oracion(g.labor)), celda(titulo(g.contratista), { clase: 'sin-corte' }), celda(dinero(g.valor), { num: true }), celda(g.filas, { num: true }), celda(fecha(g.ini)),
      celda(g.pagos.map((p) => `${titulo(p.contratista)} ${dinero(p.valor)} fact ${p.factura || 's/n'}`).join(' | ')),
      celda(textoQueHacer(g), { clase: g.estado === 'misma' ? 'txt-rojo sin-corte' : 'sin-corte' })
    ])), { vacio: 'No hay casos a revisar.' }));
  raiz.appendChild(papel);
  return raiz;
}
