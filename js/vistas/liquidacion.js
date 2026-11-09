// Detalle a facturar (hoja para enviar al contratista). Se imprime o se guarda como PDF.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, titulo, oracion } from '../core/dom.js';
import { S } from '../estado.js';
import { aviso, boton } from '../ui/componentes.js';

export function abrirLiquidacion(id) { S.ui.verLiq = id; location.hash = '#/liquidacion'; }

const fila = (t, v, clase) => h('tr', { class: clase || '' }, [h('td', { text: t }), h('td', { class: 'num', text: v })]);

export function vistaLiquidacion() {
  const l = (S.pp.liquidaciones || []).find((x) => x.id === S.ui.verLiq);
  if (!l) return h('div', {}, [aviso('info', 'Elige una liquidación desde Pagos.'), boton('Volver a Pagos', { onclick: () => { location.hash = '#/pagos'; } })]);
  const libs = S.pp.liberaciones.filter((x) => x.liquidacion_id === l.id);
  const razon = (S.pp.config || {})['razon:' + l.contratista] || '';
  const nombre = titulo(l.contratista) + ' · ' + (l.tipo === 'inversion' ? 'Inversión' : 'Servicios');
  document.title = 'Detalle a facturar - ' + nombre + (l.n_factura ? ' - ' + l.n_factura : '');
  const baseTxt = l.retencion_base === 'neto' ? 'sobre el neto' : 'sobre el total con IVA';
  const filas = libs.map((x) => h('tr', {}, [
    h('td', { text: `${x.cuartel} · ${oracion(x.labor)}` }), h('td', { class: 'num', text: numero(x.plantas) }),
    h('td', { class: 'num', text: dinero(Number(x.valor) * 1.5) }), h('td', { class: 'num', text: dinero(x.monto) })
  ]));
  return h('div', { class: 'hoja-liq' }, [
    h('div', { class: 'no-imprimir acciones' }, [
      boton('Volver', { onclick: () => { location.hash = '#/pagos'; } }),
      boton('Imprimir o guardar PDF', { tono: 'primario', icon: 'imprimir', onclick: () => window.print() })
    ]),
    h('h1', { text: 'Detalle a facturar' }),
    h('p', {}, [h('b', { text: razon || titulo(l.contratista) }), razon ? ` (${titulo(l.contratista)})` : '']),
    h('p', { text: `Concepto: ${l.tipo === 'inversion' ? 'Inversión (cuarteles en formación)' : 'Servicios'} · Fecha de factura: ${fecha(l.fecha_factura)}${l.n_factura ? ' · N° ' + l.n_factura : ''}` }),
    h('table', { class: 'tabla' }, [
      h('thead', {}, [h('tr', {}, ['Cuartel y labor', 'Plantas', 'Precio +50%', 'Monto'].map((t, i) => h('th', { class: i ? 'num' : '', text: t })))]),
      h('tbody', {}, filas)
    ]),
    h('table', { class: 'tabla resumen-liq' }, [h('tbody', {}, [
      fila('Total bruto', dinero(l.bruto)),
      l.colaciones_50 || l.colaciones_100 ? fila(`Colaciones: ${l.colaciones_50} al 50% (${dinero(l.precio_colacion / 2)}) + ${l.colaciones_100} al 100% (${dinero(l.precio_colacion)})`, '− ' + dinero(l.descuento_colaciones)) : null,
      Number(l.otros_descuentos) ? fila('Otros descuentos', '− ' + dinero(l.otros_descuentos)) : null,
      fila('Total neto', dinero(l.neto), 'total'),
      fila(`IVA ${l.iva_pct}%`, dinero(l.iva)),
      fila('Total a facturar', dinero(l.total_factura), 'total'),
      fila(`Retención ${l.retencion_pct}% (${baseTxt})`, '− ' + dinero(l.retencion)),
      fila('A pago', dinero(l.a_pago), 'total')
    ])])
  ]);
}
