// PARTE 6D · Plantas por cuartel: cuántas plantas se pagan a cada contratista en un cuartel y labor.
// La jefa de campo deja una propuesta; el administrador la aprueba (o asigna directo).

import { h } from '../core/dom.js';
import { dinero, numero, titulo, oracion } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { monto } from '../core/reglas.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render, marcarPresencia, quienEsta } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, chip, toast, confirmar, pildora } from '../ui/componentes.js';
import { encabezado, detalleGrupo } from './_comun.js';

const U = () => (S.ui.hoja = S.ui.hoja || { cl: '', borrador: null, soloCompartidos: false, soloSin: false, soloRojos: false });
const PASO = 100;

function listaCL() {
  const m = new Map();
  for (const g of S.d.ev) {
    if (g.jornada) continue; // las jornadas no llevan plantas asignadas
    const k = g.cuartel + '|' + g.labor;
    if (!m.has(k)) m.set(k, { k, cuartel: g.cuartel, labor: g.labor, grupos: [] });
    m.get(k).grupos.push(g);
  }
  return [...m.values()];
}

function estadoCL(x) {
  const a = x.grupos.filter((g) => g.asignacion);
  if (!a.length) return ['Sin asignar', 'gris'];
  if (a.some((g) => g.asignacion.estado === 'propuesta')) return ['Propuesta por aprobar', 'violeta'];
  return ['Aprobada', 'verde'];
}

export function vistaHoja() {
  const u = U();
  const todos = listaCL();
  const visibles = todos.filter((x) => (!u.soloCompartidos || x.grupos.length >= 2) && (!u.soloSin || estadoCL(x)[0] === 'Sin asignar') && (!u.soloRojos || x.grupos.some((g) => g.rojo)));
  const nRojos = todos.filter((x) => x.grupos.some((g) => g.rojo)).length;
  const nNoPagar = todos.filter((x) => x.grupos.some((g) => g.rojo && g.estado === 'misma')).length;
  const candidatos = todos.filter((x) => x.grupos.length === 1 && !x.grupos[0].asignacion &&
    (x.grupos[0].totalCuartel == null || x.grupos[0].plantasOrig <= x.grupos[0].totalCuartel * CONFIG.TOLERANCIA_EXCESO));
  if (!u.cl || !todos.some((x) => x.k === u.cl)) {
    u.cl = (visibles[0] || todos[0] || {}).k || '';
    u.borrador = null;
  }
  const asignados = todos.filter((x) => x.grupos.every((g) => g.asignacion)).length;
  const raiz = h('div');

  raiz.appendChild(encabezado(null,
    'Elige cuántas plantas se pagan en cada cuartel y labor, también cuando hay un solo contratista. Después se reparten por igual entre las personas de cada equipo.',
    [candidatos.length ? boton(`${puede('aprobar') ? 'Confirmar' : 'Proponer'} con las plantas de Labores (${candidatos.length} sin compartir)`, { onclick: async () => {
        const items = candidatos.map((x) => ({ cuartel: x.cuartel, labor: x.labor, contratista: x.grupos[0].contratista, valor: x.grupos[0].valor, plantas: x.grupos[0].plantasOrig }));
        const ok = await confirmar({
          titulo: `${puede('aprobar') ? 'Confirmar' : 'Proponer'} las plantas de Labores`,
          mensaje: `${items.length} cuarteles de un solo contratista quedan con las plantas que hoy trae Labores.`,
          ok: puede('aprobar') ? 'Confirmar' : 'Proponer'
        });
        if (!ok) return;
        const r = await operar(PP.proponer(S.sesion.pin, items));
        if (r.ok) { toast(`${r.r.guardadas} cuarteles ${r.r.estado === 'aprobada' ? 'confirmados' : 'propuestos'} con las plantas de Labores.`); render(); } else toast(r.error, 'err');
      } }) : null,
      boton('Imprimir hoja para la jefa de campo', { icon: 'imprimir', onclick: () => { document.body.classList.add('imprimir-hoja'); window.print(); setTimeout(() => document.body.classList.remove('imprimir-hoja'), 500); } })]));

  raiz.appendChild(h('div', { class: 'tarjeta' }, [
    h('div', { class: 'tarjeta-cab', style: 'margin-bottom:0' }, [h('b', { text: `${asignados} de ${todos.length} cuarteles con plantas asignadas` }), h('span', { class: 'sub', text: `${todos.length ? Math.round(asignados / todos.length * 100) : 0}%` })]),
    h('div', { class: 'progreso' }, [h('div', { style: `width:${todos.length ? Math.round(asignados / todos.length * 100) : 0}%` })]),
    nRojos ? h('p', { class: 'nota', style: 'margin:8px 0 0' }, [pildora(`${nRojos} en rojo`, 'rojo', 'Cuarteles y labores con un pago anterior con factura'), ` ${nNoPagar} con "no pagar" (misma vuelta). Ábrelos para ver el pago anterior.`]) : null
  ]));

  raiz.appendChild(h('div', { class: 'barra' }, [
    h('label', { class: 'check' }, [h('input', { type: 'checkbox', checked: u.soloCompartidos, onchange: (e) => { u.soloCompartidos = e.target.checked; render(); } }), 'Solo cuarteles compartidos (2 o más contratistas)']),
    h('label', { class: 'check' }, [h('input', { type: 'checkbox', checked: u.soloSin, onchange: (e) => { u.soloSin = e.target.checked; render(); } }), 'Solo los sin asignar']),
    h('label', { class: 'check' }, [h('input', { type: 'checkbox', checked: u.soloRojos, onchange: (e) => { u.soloRojos = e.target.checked; render(); } }), 'Solo los rojos (ya pagado antes)'])
  ]));

  const filas = visibles.map((x) => {
    const [t, tono] = estadoCL(x);
    const T = x.grupos[0].totalCuartel;
    const asignado = x.grupos.reduce((s, g) => s + g.plantas, 0);
    const presentes = quienEsta(x.k);
    return h('tr', { class: 'clic' + (x.k === u.cl ? ' sel' : ''), onclick: () => { u.cl = x.k; u.borrador = null; render(); } }, [
      celda(x.cuartel, { clase: x.grupos.some((g) => g.rojo) ? 'txt-rojo' : 'txt-azul' }), celda([oracion(x.labor),
        x.grupos.some((g) => g.rojo && g.estado === 'misma') ? pildora('No pagar', 'rojo', 'Misma vuelta: ya hay un pago con factura hace 7 días o menos') : x.grupos.some((g) => g.rojo) ? pildora('Pago anterior', 'ambar', 'Hay un pago anterior con factura (vuelta nueva)') : null,
        presentes.length ? h('span', { class: 'presencia', style: 'margin-left:8px', text: titulo(presentes[0]) + ' está aquí' }) : null], { clase: 'sin-corte' }),
      celda(x.grupos.map((g) => titulo(g.contratista)).join(', ')),
      celda(T != null ? numero(T) : 's/d', { num: true }), celda(numero(asignado), { num: true }), celda(chip(t, tono), { clase: 'sin-corte' })
    ]);
  });
  raiz.appendChild(tarjeta('Cuarteles para asignar', tabla(
    [{ t: 'Cuartel' }, { t: 'Labor' }, { t: 'Contratistas' }, { t: 'Plantas del cuartel', num: true }, { t: 'Plantas hoy', num: true }, { t: 'Estado' }], filas,
    { vacio: 'No hay cuarteles pendientes con este filtro.', alto: 300 })));

  const sel = todos.find((x) => x.k === u.cl);
  marcarPresencia(sel ? sel.k : null);
  if (sel) raiz.appendChild(editor(sel));
  raiz.appendChild(hojaImpresa(todos.filter((x) => x.grupos.some((g) => !g.confirmadas))));
  return raiz;
}

function editor(x) {
  const u = U();
  const gs = x.grupos;
  const T = gs[0].totalCuartel;
  if (!u.borrador || u.borrador.k !== x.k) {
    u.borrador = { k: x.k, v: {} };
    for (const g of gs) u.borrador.v[g.contratista + '|' + g.valor] = g.asignacion ? Number(g.asignacion.plantas) : g.plantasOrig;
  }
  const b = u.borrador.v;
  const cb = h('div');
  const montos = {};
  const entradas = {};
  const suma = () => gs.reduce((s, g) => s + (b[g.contratista + '|' + g.valor] || 0), 0);

  const refrescar = () => {
    const s = suma();
    cb.replaceChildren();
    if (T == null) cb.appendChild(aviso('info', `Asignadas ${numero(s)} plantas. No hay dato del total del cuartel.`));
    else if (s > T * CONFIG.TOLERANCIA_EXCESO) cb.appendChild(aviso('err', `Asignas ${numero(s)} y el cuartel tiene ${numero(T)}: sobran ${numero(s - T)} plantas.`));
    else if (Math.round(s) === T) cb.appendChild(aviso('ok', `Cuadra con el cuartel: ${numero(s)} de ${numero(T)} plantas.`));
    else cb.appendChild(aviso('info', `Asignadas ${numero(s)} de ${numero(T)} del cuartel. Quedan ${numero(T - s)} sin asignar (normal si el resto se paga en otra pasada).`));
    for (const g of gs) { const k = g.contratista + '|' + g.valor; if (montos[k]) montos[k].textContent = dinero(monto(b[k] || 0, g.valor)); }
    return s;
  };
  const poner = (k, v) => { b[k] = Math.max(0, Math.round(v)); if (entradas[k]) entradas[k].value = b[k]; refrescar(); };

  const td = (etiqueta, contenido, clase) => h('td', { 'data-et': etiqueta, class: clase || '' }, [].concat(contenido));
  const filas = gs.map((g) => {
    const k = g.contratista + '|' + g.valor;
    const inp = h('input', { type: 'number', min: '0', step: '1', value: b[k], 'aria-label': 'Plantas de ' + titulo(g.contratista), oninput: (e) => { b[k] = Math.max(0, Math.round(Number(e.target.value) || 0)); refrescar(); } });
    entradas[k] = inp;
    const control = h('div', { class: 'paso-num' }, [
      h('button', { type: 'button', 'aria-label': `Quitar ${PASO}`, onclick: () => poner(k, (b[k] || 0) - PASO), text: '−' }), inp,
      h('button', { type: 'button', 'aria-label': `Sumar ${PASO}`, onclick: () => poner(k, (b[k] || 0) + PASO), text: '+' })
    ]);
    const cm = td('Monto', dinero(monto(b[k], g.valor)), 'num sin-corte');
    montos[k] = cm;
    const a = g.asignacion;
    return h('tr', {}, [
      td('Contratista', h('b', { text: titulo(g.contratista) }), 'sin-corte'),
      td('Precio', dinero(g.valor), 'num'),
      td('Plantas en Labores', numero(g.plantasOrig), 'num'),
      td('Asignación', a ? [chip((a.estado === 'aprobada' ? 'Aprobada ' : 'Propuesta ') + numero(a.plantas), a.estado === 'aprobada' ? 'verde' : 'violeta'), h('span', { class: 'sub', text: ' ' + titulo(a.estado === 'aprobada' ? a.aprobado_por : a.propuesto_por) })] : '—', 'sin-corte'),
      td('Plantas nuevas', control, 'num'), cm
    ]);
  });

  const guardar = async () => {
    const s = refrescar();
    if (T != null && s > T * CONFIG.TOLERANCIA_EXCESO) { toast('La suma supera las plantas del cuartel.', 'err'); return; }
    const items = gs.map((g) => ({ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor, plantas: b[g.contratista + '|' + g.valor] || 0 }));
    const r = await operar(PP.proponer(S.sesion.pin, items));
    if (!r.ok) { toast(r.error, 'err'); return; }
    u.borrador = null;
    toast(r.r.estado === 'aprobada' ? 'Plantas aprobadas y aplicadas.' : 'Propuesta enviada. El administrador la aprobará.');
    render();
  };

  const acciones = [];
  if (T != null && gs.length > 1) acciones.push(boton('Partes iguales del cuartel', { onclick: () => { const q = Math.floor(T / gs.length); const resto = T - q * gs.length; gs.forEach((g, i) => { b[g.contratista + '|' + g.valor] = q + (i < resto ? 1 : 0); }); render(); } }));
  if (gs.length === 1) {
    const g0 = gs[0];
    acciones.push(boton(puede('aprobar') ? 'Confirmar plantas de Labores' : 'Proponer plantas de Labores', { onclick: async () => {
      const r = await operar(PP.proponer(S.sesion.pin, [{ cuartel: g0.cuartel, labor: g0.labor, contratista: g0.contratista, valor: g0.valor, plantas: g0.plantasOrig }]));
      if (r.ok) { U().borrador = null; toast('Plantas de Labores confirmadas.'); render(); } else toast(r.error, 'err');
    } }));
  }
  acciones.push(boton('Volver a lo original', { onclick: async () => {
    const r = await operar(PP.restaurar(S.sesion.pin, gs.map((g) => ({ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor }))));
    if (r.ok) { U().borrador = null; toast('Vuelto a lo original.'); render(); } else toast(r.error, 'err');
  } }));
  if (puede('aprobar') && gs.some((g) => g.asignacion && g.asignacion.estado === 'propuesta')) {
    acciones.push(boton('Aprobar propuesta', { tono: 'exito', onclick: async () => {
      const r = await operar(PP.aprobar(S.sesion.pin, gs.filter((g) => g.asignacion).map((g) => ({ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor }))));
      if (r.ok) { U().borrador = null; toast('Propuesta aprobada.'); render(); } else toast(r.error, 'err');
    } }));
  }
  acciones.push(boton(puede('aprobar') ? 'Guardar y aprobar' : 'Enviar propuesta', { tono: 'primario', onclick: guardar }));

  const presentes = quienEsta(x.k);
  const tarj = tarjeta(`${x.cuartel} · ${oracion(x.labor)}`, [
    h('div', { class: 'barra' }, [
      chip(T != null ? `Cuartel: ${numero(T)} plantas` : 'Cuartel sin dato', 'gris'),
      chip(gs.length + (gs.length === 1 ? ' contratista' : ' contratistas'), gs.length > 1 ? 'azul' : 'gris'),
      presentes.length ? h('span', { class: 'presencia', text: titulo(presentes.join(', ')) + (presentes.length > 1 ? ' están aquí' : ' está aquí') }) : null
    ]),
    gs.some((g) => g.rojo) ? h('div', { style: 'margin-bottom:12px' }, [
      aviso('warn', 'Este cuartel y labor ya tiene un pago anterior con factura. Revisa los datos antes de asignar plantas.'),
      ...gs.filter((g) => g.rojo).map((g) => h('div', { class: 'tarjeta', style: 'margin:8px 0' }, [h('b', { text: titulo(g.contratista) }), detalleGrupo(g, { boton: false })]))
    ]) : null,
    h('div', { class: 'tabla-caja' }, [h('table', { class: 'tabla editor' }, [
      h('thead', {}, [h('tr', {}, ['Contratista', 'Precio', 'Plantas en Labores', 'Asignación', 'Plantas nuevas', 'Monto'].map((t, i) => h('th', { class: i === 0 || i === 3 ? '' : 'num', text: t })))]),
      h('tbody', {}, filas)
    ])]),
    cb,
    h('div', { class: 'barra fin' }, acciones)
  ]);
  setTimeout(refrescar, 0);
  return tarj;
}

// Hoja en blanco que solo se ve al imprimir: la jefa de campo anota las plantas a mano.
function hojaImpresa(cls) {
  const filas = [];
  for (const x of cls) {
    const T = x.grupos[0].totalCuartel;
    x.grupos.forEach((g, i) => {
      filas.push(h('tr', {}, [
        celda(i === 0 ? x.cuartel : ''), celda(i === 0 ? oracion(x.labor) : ''), celda(i === 0 ? (T != null ? numero(T) : '') : '', { num: true }),
        celda(titulo(g.contratista)), celda(dinero(g.valor), { num: true }), celda(numero(g.plantasOrig), { num: true }), h('td', { class: 'casilla' })
      ]));
    });
  }
  return h('section', { class: 'hoja-impresa' }, [
    h('h1', { text: 'Plantas por cuartel · El Cerrillo' }),
    h('p', { text: 'Anota las plantas que corresponden a cada contratista. Total del cuartel = plantas de todos los contratistas en esa labor.' }),
    tabla([{ t: 'Cuartel' }, { t: 'Labor' }, { t: 'Plantas del cuartel', num: true }, { t: 'Contratista' }, { t: 'Precio', num: true }, { t: 'Según Labores', num: true }, { t: 'Plantas (a mano)' }], filas, { vacio: 'No hay cuarteles pendientes.' }),
    h('p', { class: 'firma', text: 'Jefa de campo: ____________________   Fecha: ____________' })
  ]);
}
