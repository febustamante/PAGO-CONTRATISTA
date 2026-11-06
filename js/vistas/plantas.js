// PARTE 6M · Plantas: una sola pantalla con dos pestañas (por cuartel y por persona).

import { h } from '../core/dom.js';
import { S, render } from '../estado.js';
import { encabezado } from './_comun.js';
import { vistaHoja } from './hojaCampo.js';
import { vistaReparto } from './reparto.js';

export function vistaPlantas() {
  const pestana = S.ui.plantasTab || 'cuartel';
  const raiz = h('div');
  raiz.appendChild(encabezado('Plantas', null));
  raiz.appendChild(h('div', { class: 'pestanas', role: 'tablist' }, [['cuartel', 'Por cuartel y contratista'], ['persona', 'Por persona']].map(([v, t]) =>
    h('button', { class: 'pestana' + (v === pestana ? ' activa' : ''), role: 'tab', 'aria-selected': v === pestana ? 'true' : 'false', onclick: () => { S.ui.plantasTab = v; render(); }, text: t }))));
  raiz.appendChild(pestana === 'cuartel' ? vistaHoja() : vistaReparto());
  return raiz;
}
