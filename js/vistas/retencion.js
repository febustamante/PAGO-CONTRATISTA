// Detalle a liberar: hoja imprimible por contratista con el estado de cada trabajador.

import { h } from '../core/dom.js';
import { dinero, titulo } from '../core/dom.js';
import { S } from '../estado.js';
import { aviso, boton } from '../ui/componentes.js';
import { revisiones } from './documentos.js';

const txt = (r) => (r[0] === 'ok' ? 'OK' : r[0] === 'dif' ? 'Diferencia' : 'Falta');

export function vistaRetencion() {
  const v = S.ui.verRet; const r = S.ui.retData;
  if (!v || !r || !r.ok) return h('div', {}, [aviso('info', 'Abre este detalle desde Documentos → Liberar retención.'), boton('Ir a Documentos', { onclick: () => { location.hash = '#/documentos'; } })]);
  const c = r.contratistas.find((x) => x.contratista === v.contratista) || { retenido: 0, liberado: 0 };
  const razon = (S.pp.config || {})['razon:' + v.contratista] || titulo(v.contratista);
  const ps = r.personas.filter((p) => p.contratista === v.contratista).map((p) => ({ p, r: revisiones(p) }));
  const ok = ps.filter((x) => x.r.res[0] === 'ok').length;
  document.title = 'Detalle a liberar - ' + titulo(v.contratista) + ' - ' + v.periodo;
  const pend = Math.round(c.retenido - c.liberado);
  return h('div', { class: 'hoja-liq' }, [
    h('div', { class: 'no-imprimir acciones' }, [boton('Volver', { onclick: () => { location.hash = '#/documentos'; } }), boton('Imprimir o guardar PDF', { tono: 'primario', icon: 'imprimir', onclick: () => window.print() })]),
    h('div', { class: 'liq-cab' }, [h('img', { src: 'img/logo.png', alt: 'Agrícola San José' }), h('div', { class: 'liq-der' }, [h('b', { text: 'DETALLE A LIBERAR' }), h('span', { text: 'Período ' + v.periodo })])]),
    h('div', { class: 'liq-top' }, [
      h('div', {}, [h('small', { text: 'RETENCIÓN A LIBERAR' }), h('div', { class: 'liq-total', text: dinero(pend) })]),
      h('div', {}, [h('small', { text: 'RAZÓN SOCIAL' }), h('div', { text: razon }), h('small', { text: 'DOCUMENTOS EN ORDEN' }), h('div', { text: `${ok} de ${ps.length} trabajadores` })])
    ]),
    h('table', { class: 'liq-tabla' }, [
      h('thead', {}, [h('tr', {}, ['Trabajador', 'RUT', 'Asistencia', 'Liquidación', 'Imposiciones', 'Contrato', 'Resultado'].map((t) => h('th', { text: t })))]),
      h('tbody', {}, ps.map(({ p, r: x }) => h('tr', {}, [h('td', { text: titulo(p.nombre || '—') }), h('td', { text: p.rut }), h('td', { text: p.dias_asistencia + ' días' }), h('td', { text: txt(x.liq) }), h('td', { text: txt(x.imp) }), h('td', { text: txt(x.con) }), h('td', { text: txt(x.res) })])))
    ]),
    h('table', { class: 'liq-resumen' }, [h('tbody', {}, [
      h('tr', {}, [h('td', { text: 'Retenido en total' }), h('td', { class: 'num', text: dinero(c.retenido) })]),
      h('tr', {}, [h('td', { text: 'Ya liberado' }), h('td', { class: 'num', text: '− ' + dinero(c.liberado) })]),
      h('tr', { class: 'final' }, [h('td', { text: 'Pendiente de liberar' }), h('td', { class: 'num', text: dinero(pend) })])
    ])])
  ]);
}
