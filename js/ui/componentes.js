// PARTE 4B · Componentes visuales reutilizables.

import { h } from '../core/dom.js';
import { icono } from './iconos.js';

export const chip = (texto, tono = 'gris') => h('span', { class: 'chip ' + tono, text: texto });
export const aviso = (tono, texto) => h('div', { class: 'aviso ' + tono, role: tono === 'err' ? 'alert' : 'status', text: texto });

export function boton(texto, { tono = '', onclick, icon, titulo, deshabilitado } = {}) {
  return h('button', { class: 'boton ' + tono, type: 'button', onclick, title: titulo, disabled: !!deshabilitado }, [icon ? icono(icon, 16) : null, texto]);
}

export function tarjeta(titulo, hijos, { acciones, nota } = {}) {
  return h('section', { class: 'tarjeta' }, [
    (titulo || acciones) ? h('header', { class: 'tarjeta-cab' }, [titulo ? h('h2', { text: titulo }) : null, acciones ? h('div', { class: 'acciones' }, acciones) : null]) : null,
    nota ? h('p', { class: 'nota', text: nota }) : null,
    ...[].concat(hijos || [])
  ]);
}

export function kpi(valor, etiqueta, { sub, tono = '' } = {}) {
  return h('div', { class: 'kpi ' + tono }, [
    h('div', { class: 'kpi-valor', text: valor }),
    h('div', { class: 'kpi-etiqueta', text: etiqueta }),
    sub ? h('div', { class: 'kpi-sub', text: sub }) : null
  ]);
}

export function tabla(columnas, filas, { vacio = 'Sin datos.', alto } = {}) {
  if (!filas.length) return h('p', { class: 'vacio', text: vacio });
  return h('div', { class: 'tabla-caja', style: alto ? `max-height:${alto}px` : '' }, [
    h('table', { class: 'tabla' }, [
      h('thead', {}, [h('tr', {}, columnas.map((c) => h('th', { class: c.num ? 'num' : '', text: c.t })))]),
      h('tbody', {}, filas)
    ])
  ]);
}

export const celda = (contenido, { num, clase } = {}) =>
  h('td', { class: [num ? 'num' : '', clase || ''].join(' ').trim() }, [].concat(contenido == null ? '' : contenido));

export function campo(etiqueta, control, ayuda) {
  return h('label', { class: 'campo' }, [h('span', { class: 'campo-et', text: etiqueta }), control, ayuda ? h('span', { class: 'campo-ayuda', text: ayuda }) : null]);
}

export const cargando = (texto = 'Cargando…') => h('div', { class: 'cargando' }, [h('span', { class: 'giro' }), texto]);

export function seleccion(opciones, valor, alCambiar) {
  return h('select', { onchange: (e) => alCambiar(e.target.value) },
    opciones.map(([v, t]) => h('option', { value: v, text: t, selected: v === valor })));
}

// Aviso breve. Con `accion` ({texto, onclick}) queda más tiempo a la vista, por ejemplo para "Deshacer".
export function toast(mensaje, tono = 'ok', { accion, ms } = {}) {
  let caja = document.getElementById('toasts');
  if (!caja) { caja = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(caja); }
  const dur = ms || (accion ? 9000 : 3200);
  const t = h('div', { class: 'toast ' + tono }, [
    h('span', { text: mensaje }),
    accion ? h('button', { class: 'toast-acc', type: 'button', text: accion.texto, onclick: () => { t.remove(); accion.onclick(); } }) : null
  ]);
  caja.appendChild(t);
  setTimeout(() => t.classList.add('sale'), dur);
  setTimeout(() => t.remove(), dur + 500);
}

// Ventana de confirmación propia. Devuelve una promesa con true o false.
export function confirmar({ titulo, mensaje, ok = 'Confirmar', tono = 'primario', detalle }) {
  return new Promise((resolver) => {
    const previo = document.activeElement;
    const cerrar = (valor) => { fondo.remove(); document.removeEventListener('keydown', teclas); if (previo && previo.focus) previo.focus(); resolver(valor); };
    const teclas = (e) => { if (e.key === 'Escape') cerrar(false); };
    const aceptar = h('button', { class: 'boton ' + tono, type: 'button', text: ok, onclick: () => cerrar(true) });
    const fondo = h('div', { class: 'modal-fondo', onclick: (e) => { if (e.target === fondo) cerrar(false); } }, [
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
        h('h3', { text: titulo }),
        mensaje ? h('p', { class: 'modal-msg', text: mensaje }) : null,
        detalle ? h('div', { class: 'modal-det' }, [].concat(detalle)) : null,
        h('div', { class: 'modal-acc' }, [h('button', { class: 'boton', type: 'button', text: 'Cancelar', onclick: () => cerrar(false) }), aceptar])
      ])
    ]);
    document.body.appendChild(fondo);
    document.addEventListener('keydown', teclas);
    aceptar.focus();
  });
}

// Marcadores de carga con la forma de una tabla (mejor que un círculo girando).
export function esqueleto(filas = 6) {
  return h('div', { class: 'esq', 'aria-busy': 'true', 'aria-label': 'Cargando' },
    Array.from({ length: filas }, (_, i) => h('div', { class: 'esq-fila', style: `width:${100 - (i % 3) * 7}%` })));
}

export const ETAPAS = ['Sin plantas', 'Plantas asignadas', 'Liberado', 'Pagado'];
// Avance de un grupo: Sin plantas → Plantas asignadas → Liberado → Pagado.
export function etapa(n, jornada = false) {
  const etiquetas = jornada ? ['Pendiente', 'Por jornada', 'Liberado', 'Pagado'] : ETAPAS;
  const puntos = [];
  for (let i = 0; i < 4; i += 1) {
    puntos.push(h('span', { class: 'pt ' + (i < n ? 'ok' : i === n ? 'cur' : '') }));
    if (i < 3) puntos.push(h('span', { class: 'ln ' + (i < n ? 'ok' : '') }));
  }
  return h('div', { class: 'etapa', title: etiquetas[n] }, [...puntos, h('small', { text: etiquetas[n] })]);
}

// Una sola señal por fila, con la explicación al pasar el mouse.
export const pildora = (texto, tono, explicacion) => h('span', { class: 'pildora ' + tono, title: explicacion || texto, text: texto });

export const pestanas = (items, activo, alElegir) =>
  h('div', { class: 'pestanas', role: 'tablist' }, items.map(([v, t]) =>
    h('button', { class: 'pestana' + (v === activo ? ' activa' : ''), role: 'tab', 'aria-selected': v === activo ? 'true' : 'false', onclick: () => alElegir(v), text: t })));
