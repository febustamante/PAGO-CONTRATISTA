// Documentos escaneados: revisión por trabajador (OK / diferencia / falta) y liberación de la retención.

import { h } from '../core/dom.js';
import { dinero, titulo } from '../core/dom.js';
import { PP } from '../data/pp.js';
import { S, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, seleccion, kpi, chip, toast, confirmar, pestanas } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const CLASES = { dias: 'Días distintos', imponible: 'Renta imponible distinta', sin_imposicion: 'Falta en imposiciones', sin_liquidacion: 'Falta liquidación', sin_contrato: 'Sin contrato' };
const mesActual = () => new Date().toISOString().slice(0, 7);
let cache = { periodo: null, datos: null, cargando: false };

async function cargar(periodo) {
  cache = { periodo, datos: null, cargando: true };
  const r = await PP.retencionesResumen(S.sesion.pin, periodo);
  if (cache.periodo !== periodo) return;
  cache = { periodo, datos: r, cargando: false };
  S.ui.retData = r; S.ui.retPeriodo = periodo;
  render();
}

// Estado de cada revisión de una persona: ok | dif | falta
export function revisiones(p) {
  const abierto = (clase) => p.casos.some((c) => c.clase === clase && c.estado === 'abierto');
  const liq = !p.hay_liq ? ['falta', 'Falta'] : abierto('dias') ? ['dif', 'Días distintos'] : ['ok', (p.dias_liq != null ? p.dias_liq + ' días' : 'OK')];
  const imp = !p.hay_imp ? ['falta', 'Falta'] : abierto('imponible') ? ['dif', 'Distinta'] : ['ok', 'OK'];
  const con = !p.hay_contrato ? ['falta', 'Falta'] : ['ok', 'Vigente'];
  const abiertos = p.casos.filter((c) => c.estado === 'abierto');
  const res = !abiertos.length ? ['ok', 'OK'] : abiertos.some((c) => c.clase === 'dias' || c.clase === 'imponible') ? ['dif', 'Revisar'] : ['falta', 'Incompleto'];
  return { liq, imp, con, res, abiertos };
}
const TONO = { ok: 'verde', dif: 'rojo', falta: 'ambar' };
const pill = (r) => chip(r[1], TONO[r[0]]);

export function vistaDocumentos() {
  const u = (S.ui.docs = S.ui.docs || { periodo: mesActual(), filtro: 'todos', contratista: '', abierta: null, tab: 'personas' });
  if (cache.periodo !== u.periodo && !cache.cargando) cargar(u.periodo);
  const raiz = h('div');
  raiz.appendChild(encabezado('Documentos', 'Liquidaciones, imposiciones y contratos comparados con la asistencia, trabajador por trabajador. Cuando un contratista está en orden, se le libera su retención.'));
  const mes = h('input', { type: 'month', value: u.periodo, onchange: (e) => { if (e.target.value) { u.periodo = e.target.value; render(); } } });
  raiz.appendChild(h('div', { class: 'barra' }, [campo('Período', mes), boton('Actualizar', { onclick: () => cargar(u.periodo) })]));
  raiz.appendChild(pestanas([['personas', 'Revisión por trabajador'], ['retencion', 'Liberar retención']], u.tab, (v) => { u.tab = v; render(); }));
  const r = cache.datos;
  if (!r) { raiz.appendChild(tarjeta(null, h('p', { class: 'vacio', text: 'Cargando…' }))); return raiz; }
  if (!r.ok) { raiz.appendChild(aviso('err', r.error || 'No se pudo cargar.')); return raiz; }
  raiz.appendChild(u.tab === 'retencion' ? vistaLiberar(r, u) : vistaPersonas(r, u));
  return raiz;
}

function vistaPersonas(r, u) {
  const raiz = h('div');
  if (!r.personas.length) { raiz.appendChild(tarjeta(null, h('p', { class: 'vacio', text: 'No hay documentos cargados para este mes. Se cargan con leer_pdfs.py y cargar_escaneos.py (ver INSTRUCCIONES_ESCANEOS.md).' }))); return raiz; }
  const contratistas = [...new Set(r.personas.map((p) => p.contratista).filter(Boolean))].sort();
  const base = r.personas.filter((p) => !u.contratista || p.contratista === u.contratista);
  const conDif = (p) => p.casos.some((c) => c.estado === 'abierto' && (c.clase === 'dias' || c.clase === 'imponible'));
  const lista = base.filter((p) => u.filtro !== 'dif' || conDif(p));
  const cuenta = (f) => base.filter(f).length;
  raiz.appendChild(h('div', { class: 'kpis' }, [
    kpi(base.length, 'Trabajadores'), kpi(cuenta((p) => p.hay_liq), 'Con liquidación'), kpi(cuenta((p) => p.hay_imp), 'Con imposiciones'), kpi(cuenta((p) => p.hay_contrato), 'Con contrato')
  ]));
  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Contratista', seleccion([['', 'Todos'], ...contratistas.map((c) => [c, titulo(c)])], u.contratista, (v) => { u.contratista = v; render(); })),
    campo('Mostrar', seleccion([['todos', 'Todos'], ['dif', 'Solo con diferencias']], u.filtro === 'dif' ? 'dif' : 'todos', (v) => { u.filtro = v; render(); }))
  ]));
  const abierto = (p, clase) => p.casos.some((c) => c.clase === clase && c.estado === 'abierto');
  const rojo = (t) => h('span', { style: 'color:var(--rojo);font-weight:600', text: t });
  const n = (x) => (x == null ? '—' : String(x).replace('.', ','));
  const $ = (x) => (x == null ? '—' : dinero(x));
  const filas = [];
  for (const p of lista) {
    filas.push(h('tr', { class: 'clic', onclick: () => { u.abierta = u.abierta === p.rut ? null : p.rut; render(); } }, [
      celda([h('div', { class: 'n', text: titulo(p.nombre || '—') }), h('div', { class: 'm', text: p.rut + (p.contratista ? ' · ' + titulo(p.contratista) : '') })]),
      celda(String(p.dias_asistencia), { num: true }),
      celda(p.hay_liq ? (abierto(p, 'dias') ? rojo(n(p.dias_liq)) : n(p.dias_liq)) : rojo('—'), { num: true }),
      celda(p.hay_imp ? (abierto(p, 'imponible') ? rojo($(p.renta_imp)) : $(p.renta_imp)) : rojo('—'), { num: true }),
      celda(p.hay_liq ? (abierto(p, 'imponible') ? rojo($(p.renta_liq)) : $(p.renta_liq)) : rojo('—'), { num: true }),
      celda(p.hay_contrato ? h('b', { style: 'color:var(--verde)', text: 'Sí' }) : rojo('No'), { num: true })
    ]));
    if (u.abierta === p.rut) {
      filas.push(h('tr', { class: 'fila-detalle' }, [h('td', { colspan: 6 }, p.casos.length ? p.casos.map((c) => h('div', { class: 'barra' }, [
        chip(CLASES[c.clase] || c.clase, c.estado === 'abierto' ? 'ambar' : 'verde'), h('span', { text: c.detalle + (c.nota ? ' · Nota: ' + c.nota : '') }),
        boton(c.estado === 'abierto' ? 'Marcar resuelto' : 'Reabrir', { onclick: async () => {
          const nota = c.estado === 'abierto' ? (window.prompt('Nota (opcional):') || '') : '';
          const x = await PP.ticketResolver(S.sesion.pin, p.rut, u.periodo, c.clase, c.estado === 'abierto', nota);
          if (!x.ok) { toast(x.error, 'err'); return; }
          await cargar(u.periodo);
        } })])) : [h('span', { text: 'Todo cuadra para este trabajador.' })])]));
    }
  }
  const suma = (f) => lista.reduce((s, p) => s + (Number(f(p)) || 0), 0);
  filas.push(h('tr', { class: 'total' }, [celda(`Total (${lista.length} trabajadores)`), celda(String(suma((p) => p.dias_asistencia)).replace('.', ','), { num: true }), celda(String(suma((p) => p.dias_liq)).replace('.', ','), { num: true }),
    celda(dinero(suma((p) => p.renta_imp)), { num: true }), celda(dinero(suma((p) => p.renta_liq)), { num: true }), celda(`${lista.filter((p) => p.hay_contrato).length} de ${lista.length}`, { num: true })]));
  raiz.appendChild(tarjeta(null, lista.length ? tabla([{ t: 'Trabajador' }, { t: 'Asistencia (días)', num: true }, { t: 'Liquidación (días)', num: true }, { t: 'Imposiciones (renta)', num: true }, { t: 'Liquidación (renta)', num: true }, { t: 'Contrato', num: true }], filas) : h('p', { class: 'vacio', text: 'No hay trabajadores con ese filtro.' })));
  return raiz;
}

function vistaLiberar(r, u) {
  const raiz = h('div');
  const porC = (c) => r.personas.filter((p) => p.contratista === c);
  const estado = (c) => { const ps = porC(c).map(revisiones); return { n: ps.length, abiertos: ps.reduce((s, v) => s + v.abiertos.length, 0), ok: ps.filter((v) => v.res[0] === 'ok').length }; };
  const filas = r.contratistas.filter((c) => c.retenido > 0 || c.liberado > 0).map((c) => {
    const e = estado(c.contratista); const pend = Math.round(c.retenido - c.liberado);
    const apto = e.n > 0 && e.abiertos === 0;
    return h('tr', {}, [
      celda(titulo(c.contratista)), celda(dinero(c.retenido), { num: true }), celda(dinero(c.liberado), { num: true }), celda(dinero(pend), { num: true, clase: 'sin-corte' }),
      celda(e.n ? `${e.ok} de ${e.n}` : '—', { num: true }),
      celda(!e.n ? chip('Sin documentos', 'ambar') : apto ? chip('Documentos OK', 'verde') : chip(e.abiertos + ' casos abiertos', 'rojo')),
      celda([boton('Ver detalle', { onclick: () => { S.ui.verRet = { contratista: c.contratista, periodo: u.periodo }; location.hash = '#/retencion'; } }),
        pend > 0 ? boton(apto ? 'Liberar retención' : 'Liberar con excepción', { tono: apto ? 'primario' : '', onclick: async () => {
          let nota = '';
          if (!apto) { nota = (window.prompt('Hay casos abiertos o faltan documentos. Escribe el motivo para liberar igual:') || '').trim(); if (!nota) return; }
          const ok = await confirmar({ titulo: `Liberar retención de ${titulo(c.contratista)}`, mensaje: `Se libera ${dinero(pend)}${apto ? '' : ' con excepción'}. Queda en el historial.`, ok: 'Liberar', tono: '' });
          if (!ok) return;
          const x = await PP.retencionLiberar(S.sesion.pin, c.contratista, u.periodo, pend, nota, !apto);
          if (!x.ok) { toast(x.error, 'err'); return; }
          toast('Retención liberada.'); await cargar(u.periodo);
        } }) : null])
    ]);
  });
  raiz.appendChild(tarjeta('Retención por contratista', filas.length ? tabla([{ t: 'Contratista' }, { t: 'Retenido', num: true }, { t: 'Ya liberado', num: true }, { t: 'Pendiente', num: true }, { t: 'Trabajadores OK', num: true }, { t: 'Documentos' }, { t: '' }], filas)
    : h('p', { class: 'vacio', text: 'Todavía no hay retenciones. Se generan al guardar liquidaciones en Pagos.' })));
  if (r.historial.length) raiz.appendChild(tarjeta('Retenciones liberadas', tabla([{ t: 'Fecha' }, { t: 'Contratista' }, { t: 'Período' }, { t: 'Monto', num: true }, { t: 'Nota' }, { t: 'Liberó' }],
    r.historial.map((x) => h('tr', {}, [celda(String(x.creado_en).slice(0, 10)), celda(titulo(x.contratista)), celda(x.periodo), celda(dinero(x.monto), { num: true }), celda((x.con_excepcion ? 'Con excepción: ' : '') + (x.nota || '')), celda(titulo(x.liberado_por || ''))])))));
  return raiz;
}
