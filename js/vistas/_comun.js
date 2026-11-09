// PARTE 6A · Piezas compartidas por varias pantallas.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, titulo } from '../core/dom.js';
import { chip, boton } from '../ui/componentes.js';
import { S, puede } from '../estado.js';

// Lleva a la Hoja de campo con este cuartel y labor ya elegidos.
export function irAAsignarPlantas(g) {
  const base = S.ui.hoja || { soloCompartidos: false, soloSin: false };
  S.ui.hoja = { ...base, soloCompartidos: false, soloSin: false, cl: g.cuartel + '|' + g.labor, borrador: null };
  S.ui.plantasTab = 'cuartel';
  location.hash = '#/plantas';
}

export function chipsGrupo(g) {
  const c = [];
  if (g.rojo && g.estado === 'misma') c.push(chip('No pagar: misma vuelta', 'rojo'));
  if (g.rojo && g.estado === 'nueva') c.push(chip('Pagar: vuelta nueva', 'ambar'));
  if (g.otroPrecio) c.push(chip('Otro precio', 'ambar'));
  if (g.azul) c.push(chip(g.contratistas.length + ' contratistas', 'azul'));
  if (g.excede) c.push(chip('Supera el cuartel', 'rojo'));
  if (g.propuesta != null) c.push(chip('Propuesta: ' + numero(g.propuesta) + ' pl.', 'violeta'));
  else if (!g.confirmadas) c.push(chip('Plantas sin asignar', 'gris'));
  if (!g.rojo && !g.azul) c.push(chip('Sin alertas', 'verde'));
  return c;
}

export function detalleGrupo(g, { boton: conBoton = true } = {}) {
  const caja = h('div', { class: 'detalle' });
  if (g.pagos.length) {
    caja.appendChild(h('p', { class: 'detalle-t', text: 'Ya pagado con factura en este cuartel y labor' }));
    for (const p of g.pagos) {
      caja.appendChild(h('div', { class: 'detalle-f', text: `${titulo(p.contratista)} · ${dinero(p.valor)} · factura ${p.factura || 's/n'} · trabajo ${fecha(p.ini)}${p.ini !== p.fin ? ' al ' + fecha(p.fin) : ''} · ${numero(p.plantas)} plantas` }));
    }
    caja.appendChild(h('p', { class: 'detalle-r', text: `Regla: ${g.dias} días entre el último trabajo pagado y el inicio de este. ` +
      (g.estado === 'misma' ? 'Siete días o menos es la misma vuelta: no pagar.' : 'Más de siete días es vuelta nueva: pagar.') +
      (g.otroPrecio ? ' El pago anterior fue a otro precio: definir cuál vale.' : '') }));
  } else {
    caja.appendChild(h('p', { class: 'detalle-r', text: 'No hay pagos anteriores con factura en este cuartel y labor.' }));
  }
  if (g.azul) {
    caja.appendChild(h('p', { class: 'detalle-t', text: 'Contratistas pendientes en el mismo cuartel y labor' }));
    for (const x of S.d.ev.filter((e) => e.cuartel === g.cuartel && e.labor === g.labor)) {
      caja.appendChild(h('div', { class: 'detalle-f', text: `${titulo(x.contratista)} · ${dinero(x.valor)} · ${numero(x.plantas)} plantas · desde ${fecha(x.ini)}` }));
    }
    caja.appendChild(h('p', { class: 'detalle-r', text: `Suma de plantas: ${numero(g.sumaCuartel)}${g.totalCuartel != null ? ' de ' + numero(g.totalCuartel) + ' del cuartel.' : '.'} ${g.excede ? 'Supera el total del cuartel.' : 'No supera el total del cuartel.'}` }));
  }
  if (conBoton && puede('asignar')) {
    caja.appendChild(h('div', { class: 'barra', style: 'margin-top:10px' }, [
      boton(g.confirmadas ? 'Cambiar plantas' : 'Asignar plantas', { tono: g.confirmadas ? '' : 'primario', onclick: () => irAAsignarPlantas(g) }),
      h('span', { class: 'sub', text: g.confirmadas ? `Plantas asignadas: ${numero(g.plantas)}` : `Hoy se pagaría con las plantas de Labores: ${numero(g.plantasOrig)}` })
    ]));
  }
  return caja;
}

export function encabezado(titulo, descripcion, acciones) {
  return h('div', { class: 'pagina-cab' }, [
    h('div', {}, [titulo ? h('h1', { text: titulo }) : null, descripcion ? h('p', { class: 'pagina-desc', text: descripcion }) : null]),
    acciones ? h('div', { class: 'acciones' }, acciones) : null
  ]);
}
