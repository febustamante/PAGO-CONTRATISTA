// PARTE 6J · Historial: quién hizo qué y cuándo.

import { h } from '../core/dom.js';
import { fechaLarga, titulo } from '../core/dom.js';
import { S } from '../estado.js';
import { tarjeta, tabla, celda } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

export function vistaHistorial() {
  const filas = S.pp.movimientos.map((m) => h('tr', {}, [celda(fechaLarga(m.creado_en), { clase: 'sin-corte' }), celda(titulo(m.usuario), { clase: 'sin-corte' }), celda(m.accion.replace(/_/g, ' ')), celda(m.detalle)]));
  return h('div', {}, [
    encabezado('Historial', 'Últimos 200 movimientos de todas las personas.'),
    tarjeta(null, tabla([{ t: 'Cuándo' }, { t: 'Quién' }, { t: 'Acción' }, { t: 'Detalle' }], filas, { vacio: 'Todavía no hay movimientos.', alto: 640 }))
  ]);
}
