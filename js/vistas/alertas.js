// PARTE 6H · Alertas: todo lo que conviene revisar antes de pagar.

import { h } from '../core/dom.js';
import { dinero, numero, titulo, oracion } from '../core/dom.js';
import { S } from '../estado.js';
import { tarjeta, chip } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const lugar = (g) => `${g.cuartel} · ${oracion(g.labor)}`;

function bloque(tituloBloque, descripcion, items, tono, texto) {
  const cuerpo = [h('p', { class: 'nota', text: descripcion })];
  if (items.length) {
    cuerpo.push(h('ul', { class: 'lista-alerta' }, items.slice(0, 40).map((x) => h('li', { text: texto(x) }))));
    if (items.length > 40) cuerpo.push(h('p', { class: 'nota', text: `… y ${items.length - 40} más` }));
  }
  return tarjeta(null, [h('h2', {}, [tituloBloque + ' ', chip(String(items.length), items.length ? tono : 'verde')]), ...cuerpo]);
}

export function vistaAlertas() {
  const ev = S.d.ev;
  const raiz = h('div');
  raiz.appendChild(encabezado('Alertas', 'Lo que conviene revisar antes de liberar un pago.'));

  raiz.appendChild(bloque('Ya pagado antes: misma vuelta', 'Hay un pago con factura del mismo cuartel y labor siete días o menos antes. No se debe pagar.',
    ev.filter((g) => g.rojo && g.estado === 'misma'), 'rojo',
    (g) => `${lugar(g)} · ${titulo(g.contratista)} ${dinero(g.valor)} · ya pagado: ${g.pagos.map((p) => `${titulo(p.contratista)} fact ${p.factura || 's/n'}`).join(' | ')}`));
  raiz.appendChild(bloque('Ya pagado antes: vuelta nueva', 'El pago anterior fue hace más de siete días. Se puede pagar dejando registro.',
    ev.filter((g) => g.rojo && g.estado === 'nueva'), 'ambar',
    (g) => `${lugar(g)} · ${titulo(g.contratista)} ${dinero(g.valor)} · ${g.dias} días desde el pago anterior`));
  raiz.appendChild(bloque('Otro precio', 'El pago anterior del mismo cuartel y labor fue a un valor distinto.',
    ev.filter((g) => g.otroPrecio), 'ambar',
    (g) => `${lugar(g)} · ${titulo(g.contratista)} ahora ${dinero(g.valor)} · antes ${g.pagos.map((p) => dinero(p.valor)).join(' / ')}`));

  const vistos = new Set();
  const azules = ev.filter((g) => g.azul && !vistos.has(g.cuartel + g.labor) && vistos.add(g.cuartel + g.labor));
  raiz.appendChild(bloque('Dos o más contratistas en el mismo cuartel y labor', 'Revisar que las plantas no se superpongan y que la suma no supere el cuartel.', azules, 'azul',
    (g) => `${lugar(g)} · ${g.contratistas.map(titulo).join(', ')} · suma ${numero(g.sumaCuartel)}${g.totalCuartel != null ? ' de ' + numero(g.totalCuartel) : ''}${g.excede ? ' (EXCEDE)' : ''}`));

  raiz.appendChild(bloque('Plantas propuestas sin aprobar', 'La jefa de campo propuso plantas que el administrador aún no aprueba.',
    ev.filter((g) => g.propuesta != null), 'violeta',
    (g) => `${lugar(g)} · ${titulo(g.contratista)}: propone ${numero(g.propuesta)} (Labores trae ${numero(g.plantasOrig)})`));

  raiz.appendChild(bloque('Plantas en cero', 'Pendientes sin plantas. Revisar si falta el rendimiento.', ev.filter((g) => !g.plantas), 'ambar',
    (g) => `${lugar(g)} · ${titulo(g.contratista)} ${dinero(g.valor)}`));

  const contratos = new Map(S.pp.contratos.map((c) => [c.contratista + '|' + c.labor, Number(c.precio)]));
  const fuera = ev.filter((g) => contratos.has(g.contratista + '|' + g.labor) && contratos.get(g.contratista + '|' + g.labor) !== g.valor);
  raiz.appendChild(bloque('Precio fuera de contrato', 'Solo se evalúa donde hay un precio de contrato cargado en la sección Contratos.', fuera, 'ambar',
    (g) => `${lugar(g)} · ${titulo(g.contratista)} paga ${dinero(g.valor)} y el contrato dice ${dinero(contratos.get(g.contratista + '|' + g.labor))}`));
  return raiz;
}
