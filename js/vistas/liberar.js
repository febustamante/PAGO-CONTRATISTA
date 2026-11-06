// PARTE 6C · Por liberar: etapa por fila, plantas editables, una señal por fila y barra fija con la selección.

import { h } from '../core/dom.js';
import { dinero, numero, fecha, unicos, titulo, oracion, hace } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { claveLiberacion, estadoParaLiberar, monto } from '../core/reglas.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render, marcarPresencia, quienEsta } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, seleccion, toast, confirmar, etapa, pildora } from '../ui/componentes.js';
import { detalleGrupo, irAAsignarPlantas } from './_comun.js';

const U = () => (S.ui.liberar = S.ui.liberar || { contratista: '', filtro: 'todos', buscar: '', sel: {}, detalle: null, factura: '', motivo: '' });

function filtrar(ev) {
  const u = U();
  const q = u.buscar.trim().toLowerCase();
  return ev.filter((g) => {
    if (u.contratista && g.contratista !== u.contratista) return false;
    if (q && !`${g.cuartel} ${g.labor} ${g.contratista}`.toLowerCase().includes(q)) return false;
    if (u.filtro === 'listos') return g.listo;
    if (u.filtro === 'sinplantas') return !g.confirmadas;
    if (u.filtro === 'conplantas') return g.confirmadas;
    if (u.filtro === 'nopagar') return g.rojo && g.estado === 'misma';
    if (u.filtro === 'pagar') return g.rojo && g.estado === 'nueva';
    if (u.filtro === 'azul') return g.azul;
    return true;
  });
}

// La señal más importante de la fila. El resto del detalle se ve al abrirla.
function senal(g) {
  if (g.rojo && g.estado === 'misma') return ['rojo', pildora('No pagar', 'rojo', `Misma vuelta: hubo un pago con factura hace ${g.dias} días en este cuartel y labor.`)];
  if (g.excede) return ['rojo', pildora('Supera el cuartel', 'rojo', `Las plantas de los contratistas (${numero(g.sumaCuartel)}) pasan del total del cuartel (${numero(g.totalCuartel)}).`)];
  if (g.rojo && g.estado === 'nueva') return ['ambar', pildora(g.otroPrecio ? 'Vuelta nueva · otro precio' : 'Vuelta nueva', 'ambar', `Hace ${g.dias} días del último pago: se puede pagar.${g.otroPrecio ? ' El pago anterior fue a otro precio.' : ''}`)];
  if (g.azul) return ['azul', pildora('Compartido', 'azul', 'Lo comparten: ' + g.contratistas.map(titulo).join(', '))];
  return ['', null];
}

export function porLiberar() {
  const u = U();
  const ev = S.d.ev;
  const lista = filtrar(ev);
  const admin = puede('liberar');
  const raiz = h('div');

  const buscar = h('input', { id: 'buscar', type: 'search', placeholder: 'Buscar cuartel, labor o contratista  ( / )', value: u.buscar, oninput: (e) => { u.buscar = e.target.value; render(); const n = document.getElementById('buscar'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Buscar', buscar),
    campo('Contratista', seleccion([['', 'Todos'], ...unicos(ev.map((g) => g.contratista)).map((c) => [c, titulo(c)])], u.contratista, (v) => { u.contratista = v; render(); })),
    campo('Mostrar', seleccion([['todos', 'Todos'], ['conplantas', 'Con plantas asignadas'], ['sinplantas', 'Sin plantas asignadas'], ['listos', 'Sin pago anterior ni exceso'], ['nopagar', 'Rojo: no pagar'], ['pagar', 'Rojo: pagar'], ['azul', 'Azul: compartidos']], u.filtro, (v) => { u.filtro = v; render(); })),
    admin ? boton('Marcar los listos', { onclick: () => { lista.forEach((g) => { if (g.listo && !g.azul) u.sel[claveLiberacion(g)] = true; }); render(); } }) : null,
    admin ? boton('Limpiar', { onclick: () => { u.sel = {}; render(); } }) : null
  ]));

  const filas = [];
  for (const g of lista) {
    const k = claveLiberacion(g);
    const [tono, pil] = senal(g);
    const presentes = quienEsta(g.cuartel + '|' + g.labor);
    const input = h('input', { type: 'number', min: '0', step: '1', class: 'plantas', value: g.plantas, disabled: !puede('asignar') || g.jornada, title: g.jornada ? 'Pago por jornada: la cantidad son las jornadas de Labores' : '', 'aria-label': `Plantas de ${g.contratista} en ${g.cuartel}`,
      oninput: (e) => e.target.classList.toggle('cambiado', Number(e.target.value) !== g.plantas),
      onchange: async (e) => {
        const v = Math.max(0, Math.round(Number(e.target.value) || 0));
        const r = await operar(PP.proponer(S.sesion.pin, [{ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor, plantas: v }]));
        if (r.ok) toast(`Plantas guardadas: ${numero(v)} (${titulo(g.contratista)}, ${g.cuartel}).`); else { toast(r.error, 'err'); render(); }
      } });
    filas.push(h('tr', { class: 'clic' + (u.detalle === k ? ' sel' : ''), onclick: (e) => { if (['INPUT', 'BUTTON'].includes(e.target.tagName)) return; u.detalle = u.detalle === k ? null : k; marcarPresencia(u.detalle ? g.cuartel + '|' + g.labor : null); render(); } }, [
      h('td', { class: 'f ' + tono }, admin ? [h('input', { type: 'checkbox', checked: !!u.sel[k], 'aria-label': 'Seleccionar ' + g.cuartel, onchange: (e) => { u.sel[k] = e.target.checked; render(); } })] : []),
      h('td', { class: 'sin-corte' }, [h('div', { class: 'n', text: `${g.cuartel} · ${oracion(g.labor)}` }), h('div', { class: 'm' }, [dinero(g.valor) + (g.jornada ? ' por jornada' : ' por planta'), g.jornada ? pildora('Jornada', 'gris', `${dinero(g.valor)} × ${numero(g.plantas)} jornadas × 1,5 = ${dinero(g.monto)}`) : pil, presentes.length ? h('span', { class: 'presencia', style: 'margin-left:6px', text: titulo(presentes[0]) + ' está aquí' }) : null])]),
      celda(titulo(g.contratista), { clase: 'sin-corte' }),
      celda(input, { num: true }),
      celda(dinero(g.monto), { num: true, clase: 'sin-corte' }),
      celda(etapa(g.confirmadas ? 1 : 0, g.jornada), { clase: 'sin-corte' })
    ]));
    if (u.detalle === k) filas.push(h('tr', { class: 'fila-detalle' }, [h('td', { colspan: 6 }, [detalleGrupo(g), historialGrupo(g)])]));
  }
  raiz.appendChild(tabla([{ t: '' }, { t: 'Cuartel y labor' }, { t: 'Contratista' }, { t: 'Plantas / jornadas', num: true }, { t: 'Monto', num: true }, { t: 'Etapa' }], filas, { vacio: 'No hay grupos con este filtro.', alto: 620 }));
  raiz.appendChild(h('p', { class: 'nota', style: 'margin-top:8px', text: 'Escribe las plantas directamente en la fila: se guardan al salir del campo. Monto = plantas × precio × 1,5. Pasa el mouse por la señal de color para ver el motivo.' }));

  if (admin) raiz.appendChild(barraFija(ev));
  return raiz;
}

// Historial del grupo: lo que se ha hecho sobre este cuartel y labor.
function historialGrupo(g) {
  const clave = `${g.cuartel} ${g.labor}`;
  const mov = S.pp.movimientos.filter((m) => (m.detalle || '').includes(clave)).slice(0, 5);
  if (!mov.length) return h('div');
  return h('div', { class: 'detalle', style: 'margin-top:10px' }, [
    h('p', { class: 'detalle-t', text: 'Historial de este cuartel y labor' }),
    ...mov.map((m) => h('div', { class: 'detalle-f', text: `${hace(m.creado_en)} · ${titulo(m.usuario)} · ${(m.accion || '').replace(/_/g, ' ')}` }))
  ]);
}

function barraFija(ev) {
  const u = U();
  const sel = ev.filter((g) => u.sel[claveLiberacion(g)]);
  if (!sel.length) return h('div');
  const total = sel.reduce((s, g) => s + g.monto, 0);
  const exige = sel.some((g) => (g.rojo && g.estado === 'misma') || g.excede);
  const sinPlantas = sel.filter((g) => !g.confirmadas);
  const factura = h('input', { placeholder: 'N° de factura (opcional)', value: u.factura, oninput: (e) => { u.factura = e.target.value; }, 'aria-label': 'Número de factura' });
  const motivo = exige ? h('input', { placeholder: 'Motivo (obligatorio)', value: u.motivo, oninput: (e) => { u.motivo = e.target.value; }, 'aria-label': 'Motivo', style: 'min-width:220px' }) : null;

  const liberar = async () => {
    if (exige && u.motivo.trim().length < 5) { toast('Escribe el motivo: hay grupos marcados como no pagar o que pasan del cuartel.', 'err'); if (motivo) motivo.focus(); return; }
    const items = sel.map((g) => ({ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor, plantas: g.plantas, filas: g.filas, monto: g.monto, ini: g.ini, fin: g.fin, estado: estadoParaLiberar(g) }));
    const ok = await confirmar({
      titulo: `Liberar ${sel.length} ${sel.length === 1 ? 'grupo' : 'grupos'} por ${dinero(total)}`,
      mensaje: 'Pasan a Pagos, ordenados por contratista. La fecha de pago se pone después, a todos juntos.',
      ok: 'Liberar', tono: 'primario',
      detalle: [
        ...sel.slice(0, 8).map((g) => h('div', {}, [h('span', { text: `${g.cuartel} · ${oracion(g.labor)} · ${titulo(g.contratista)}` }), h('b', { text: dinero(g.monto) })])),
        sel.length > 8 ? h('div', {}, [h('span', { text: `… y ${sel.length - 8} más` })]) : null,
        sinPlantas.length ? h('div', {}, [h('span', { class: 'sub', text: `${sinPlantas.length} sin plantas asignadas: se pagan con las de Labores.` })]) : null
      ]
    });
    if (!ok) return;
    const r = await operar(PP.liberar(S.sesion.pin, items, u.factura.trim() || null, null, u.motivo.trim()));
    if (!r.ok) { toast(r.error, 'err'); return; }
    // Las claves permiten deshacer justo después, sin ir a otra pantalla.
    const claves = new Set(items.map((i) => claveLiberacion({ cuartel: i.cuartel, labor: i.labor, contratista: i.contratista, valor: i.valor, ini: i.ini })));
    u.sel = {}; u.factura = ''; u.motivo = '';
    toast(`Liberados ${r.r.liberados} ${r.r.liberados === 1 ? 'grupo' : 'grupos'} por ${dinero(r.r.monto)}. Ya están en Pagos.`, 'ok', { accion: { texto: 'Deshacer', onclick: () => deshacerClaves(claves) } });
    render();
  };

  return h('div', { class: 'barra-fija' }, [
    h('div', {}, [h('div', { class: 'res', text: `${sel.length} ${sel.length === 1 ? 'seleccionado' : 'seleccionados'} · ${dinero(total)} antes de IVA` }),
      sinPlantas.length ? h('div', { class: 'sub', style: 'color:inherit;opacity:.8', text: `${sinPlantas.length} sin plantas asignadas: se pagan con las de Labores` }) : null]),
    h('div', { class: 'barra', style: 'margin:0;align-items:center' }, [
      motivo, factura,
      sinPlantas.length ? boton('Asignar plantas', { onclick: () => irAAsignarPlantas(sinPlantas[0]) }) : null,
      boton('Liberar y enviar a Pagos', { tono: 'primario', onclick: liberar })
    ])
  ]);
}

async function deshacerClaves(claves) {
  const ids = S.pp.liberaciones.filter((l) => claves.has(claveLiberacion({ cuartel: l.cuartel, labor: l.labor, contratista: l.contratista, valor: Number(l.valor), ini: l.trabajo_ini }))).map((l) => l.id);
  let n = 0; let error = null;
  for (const id of ids) { const r = await operar(PP.deshacer(S.sesion.pin, id)); if (r.ok) n += 1; else error = r.error; }
  if (error) toast(error, 'err'); else toast(`Se deshizo la liberación de ${n} ${n === 1 ? 'grupo' : 'grupos'}.`);
  render();
}
