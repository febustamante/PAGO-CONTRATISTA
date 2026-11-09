// Ajustes (solo administrador): colaciones, IVA, retención, razón social y cuarteles en inversión.

import { h } from '../core/dom.js';
import { titulo } from '../core/dom.js';
import { PP } from '../data/pp.js';
import { S, operar } from '../estado.js';
import { boton, tarjeta, campo, seleccion, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

export function vistaAjustes() {
  const cfg = S.pp.config || {};
  const guardar = async (clave, valor) => {
    const r = await operar(PP.configGuardar(S.sesion.pin, clave, valor));
    toast(r.ok ? 'Guardado.' : r.error, r.ok ? 'ok' : 'err');
  };
  const num = (clave, etiqueta) => {
    const i = h('input', { type: 'number', step: 'any', value: cfg[clave] });
    return h('div', { class: 'barra' }, [campo(etiqueta, i), boton('Guardar', { onclick: () => guardar(clave, i.value) })]);
  };
  const base = seleccion([['total', 'Sobre el total con IVA'], ['neto', 'Sobre el neto (como en el Excel)']], cfg.retencion_base || 'total', (v) => guardar('retencion_base', v));

  const razones = [...new Set([...Object.keys(cfg).filter((k) => k.startsWith('razon:')).map((k) => k.slice(6)), ...S.pp.liberaciones.map((l) => l.contratista)])].sort();
  const razonUI = razones.map((c) => {
    const i = h('input', { type: 'text', value: cfg['razon:' + c] || '' });
    return h('div', { class: 'barra' }, [campo(titulo(c), i), boton('Guardar', { onclick: () => guardar('razon:' + c, i.value) })]);
  });

  const inv = new Set(S.pp.inversion || []);
  const todos = [...new Set([...Object.keys(S.base.cuarteles), ...inv])].sort();
  const checks = todos.map((c) => {
    const i = h('input', { type: 'checkbox' }); i.checked = inv.has(c);
    i.onchange = () => { if (i.checked) inv.add(c); else inv.delete(c); };
    return h('label', { class: 'check' }, [i, ' ' + c]);
  });

  return h('div', {}, [
    encabezado('Ajustes', 'Valores que usan las liquidaciones a facturar.'),
    tarjeta('Colaciones, IVA y retención', [
      num('precio_colacion', 'Precio de la colación ($, 100%)'), num('iva_pct', 'IVA (%)'), num('retencion_pct', 'Retención (%)'),
      h('div', { class: 'barra' }, [campo('La retención se calcula', base)])
    ]),
    tarjeta('Razón social por contratista', razonUI),
    tarjeta('Cuarteles en inversión (en formación)', [
      h('div', { class: 'barra' }, checks),
      boton('Guardar cuarteles en inversión', { tono: 'primario', onclick: async () => {
        const r = await operar(PP.inversionGuardar(S.sesion.pin, [...inv].sort()));
        toast(r.ok ? 'Guardado.' : r.error, r.ok ? 'ok' : 'err');
      } })
    ])
  ]);
}
