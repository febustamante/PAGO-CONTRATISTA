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
  const nombre = titulo(l.contratista) + (l.tipo === 'inversion' ? ' - Inversión' : '');
  document.title = 'Detalle a facturar - ' + nombre + (l.n_factura ? ' - ' + l.n_factura : '');
  const filas = libs.map((x) => h('tr', {}, [
    h('td', { text: x.cuartel }), h('td', { text: oracion(x.labor) }), h('td', { class: 'num', text: numero(x.plantas) }),
    h('td', { class: 'num', text: dinero(x.valor) }), h('td', { class: 'num', text: dinero(Number(x.valor) * 1.5) }), h('td', { class: 'num', text: dinero(x.monto) })
  ]));
  const baseTxt = l.retencion_base === 'neto' ? 'sobre el neto' : 'sobre el total con IVA';
  const r = (t, v, clase) => h('tr', { class: clase || '' }, [h('td', { text: t }), h('td', { class: 'num', text: v })]);
  return h('div', { class: 'hoja-liq' }, [
    h('div', { class: 'no-imprimir acciones' }, [
      boton('Volver', { onclick: () => { location.hash = '#/pagos'; } }),
      boton('Imprimir o guardar PDF', { tono: 'primario', icon: 'imprimir', onclick: () => window.print() })
    ]),
    h('div', { class: 'liq-cab' }, [
      h('img', { src: 'img/logo.png', alt: 'Agrícola San José' }),
      h('div', { class: 'liq-der' }, [h('b', { text: 'DETALLE A FACTURAR' }), h('span', { text: 'Fecha de factura ' + fecha(l.fecha_factura) }), l.n_factura ? h('span', { text: 'N° ' + l.n_factura }) : null])
    ]),
    h('div', { class: 'liq-top' }, [
      h('div', {}, [h('small', { text: 'TOTAL A FACTURAR' }), h('div', { class: 'liq-total', text: dinero(l.total_factura) })]),
      h('div', {}, [h('small', { text: 'RAZÓN SOCIAL' }), h('div', { text: razon || titulo(l.contratista) }), h('small', { text: 'CONTRATISTA' }), h('div', { text: titulo(l.contratista) })])
    ]),
    h('table', { class: 'liq-tabla' }, [
      h('thead', {}, [h('tr', {}, ['Cuartel', 'Labor', 'Plantas', 'Precio', 'Precio +50 %', 'Monto'].map((t, i) => h('th', { class: i > 1 ? 'num' : '', text: t })))]),
      h('tbody', {}, filas)
    ]),
    h('table', { class: 'liq-resumen' }, [h('tbody', {}, [
      r('Total bruto', dinero(l.bruto)),
      l.colaciones_50 || l.colaciones_100 ? r(`Colaciones (${l.colaciones_50} al 50 % · ${l.colaciones_100} al 100 %)`, '− ' + dinero(l.descuento_colaciones)) : null,
      Number(l.otros_descuentos) ? r('Otros descuentos', '− ' + dinero(l.otros_descuentos)) : null,
      r('Total neto', dinero(l.neto), 'fuerte'),
      r(`IVA ${l.iva_pct} %`, dinero(l.iva)),
      r('Total a facturar', dinero(l.total_factura), 'fuerte'),
      r(`Retención ${l.retencion_pct} % ${baseTxt}`, '− ' + dinero(l.retencion)),
      r('A pago', dinero(l.a_pago), 'final')
    ])])
  ]);
}
