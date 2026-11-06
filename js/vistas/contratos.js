// PARTE 6I · Contratos: precios observados y precio de contrato por contratista y labor.

import { h } from '../core/dom.js';
import { dinero, titulo, oracion } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { PP } from '../data/pp.js';
import { S, puede, operar } from '../estado.js';
import { tarjeta, tabla, celda, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

export function vistaContratos() {
  const obs = new Map();
  const sumar = (c, l, v) => { const k = c + '|' + l; if (!obs.has(k)) obs.set(k, new Set()); obs.get(k).add(Number(v)); };
  for (const g of S.d.historial) sumar(g.contratista, g.labor, g.valor);
  for (const g of S.d.ev) sumar(g.contratista, g.labor, g.valor);
  const contratos = new Map(S.pp.contratos.map((c) => [c.contratista + '|' + c.labor, c]));
  const editable = puede('contratos');

  const filas = [...obs.keys()].filter((k) => CONFIG.EXTERNOS.includes(k.split('|')[0])).sort().map((k) => {
    const [c, l] = k.split('|');
    const actual = contratos.get(k);
    const entrada = h('input', { type: 'number', min: '0', class: 'entrada-num', value: actual ? Number(actual.precio) : '', disabled: !editable, 'aria-label': `Precio de contrato ${c} ${l}`,
      onchange: async (e) => {
        const v = e.target.value === '' ? null : Number(e.target.value);
        const r = await operar(PP.contrato(S.sesion.pin, c, l, v));
        if (r.ok) toast('Contrato actualizado.'); else toast(r.error, 'err');
      } });
    return h('tr', {}, [celda(titulo(c), { clase: 'sin-corte' }), celda(oracion(l), { clase: 'sin-corte' }), celda([...obs.get(k)].sort((a, b) => a - b).map(dinero).join(' · '), { num: true }), celda(entrada, { num: true }), celda(actual ? actual.vigente_desde : '—')]);
  });

  return h('div', {}, [
    encabezado('Contratos', 'Precio observado en los pagos y precio de contrato. Si cargas un precio, la plataforma avisa cuando se pague otro valor.'),
    tarjeta(null, tabla([{ t: 'Contratista' }, { t: 'Labor' }, { t: 'Precios observados', num: true }, { t: 'Precio de contrato', num: true }, { t: 'Vigente desde' }], filas, { alto: 600 }),
      { nota: editable ? 'Deja el campo vacío para quitar el precio de contrato.' : 'Solo el administrador puede editar contratos.' })
  ]);
}
