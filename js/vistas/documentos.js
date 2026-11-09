// Documentos escaneados (liquidaciones, imposiciones, contratos) y su cruce con la asistencia.

import { h } from '../core/dom.js';
import { PP } from '../data/pp.js';
import { S, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, kpi, chip, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const CLASES = { dias: 'Días distintos', imponible: 'Renta imponible distinta', sin_imposicion: 'Falta en imposiciones', sin_liquidacion: 'Falta liquidación', sin_contrato: 'Sin contrato' };
const TIPOS = { liquidacion: 'Liquidación', imposicion: 'Imposiciones', contrato: 'Contrato' };

const mesActual = () => new Date().toISOString().slice(0, 7);
let cache = { periodo: null, datos: null, cargando: false };

async function cargar(periodo) {
  cache = { periodo, datos: null, cargando: true };
  const r = await PP.documentosListar(S.sesion.pin, periodo);
  if (cache.periodo !== periodo) return;
  cache = { periodo, datos: r, cargando: false };
  render();
}

export function vistaDocumentos() {
  const u = (S.ui.docs = S.ui.docs || { periodo: mesActual(), soloAbiertos: true });
  if (cache.periodo !== u.periodo && !cache.cargando) cargar(u.periodo);
  const raiz = h('div');
  raiz.appendChild(encabezado('Documentos', 'Liquidaciones, imposiciones y contratos leídos desde los escaneos, comparados con la asistencia. Los casos que no cuadran quedan como tickets.'));
  const mes = h('input', { type: 'month', value: u.periodo, onchange: (e) => { if (e.target.value) { u.periodo = e.target.value; render(); } } });
  raiz.appendChild(h('div', { class: 'barra' }, [campo('Período', mes), boton('Actualizar', { onclick: () => cargar(u.periodo) })]));
  const r = cache.datos;
  if (!r) { raiz.appendChild(tarjeta(null, h('p', { class: 'vacio', text: 'Cargando…' }))); return raiz; }
  if (!r.ok) { raiz.appendChild(aviso('err', r.error || 'No se pudo cargar.')); return raiz; }
  if (!r.documentos.length) {
    raiz.appendChild(tarjeta(null, h('p', { class: 'vacio', text: 'No hay documentos cargados para este mes. Se cargan con el programa cargar_escaneos.py (ver INSTRUCCIONES_ESCANEOS.md).' })));
    return raiz;
  }
  const abiertos = r.diferencias.filter((d) => d.estado === 'abierto');
  raiz.appendChild(h('div', { class: 'kpis' }, [
    kpi(r.trabajadores, 'Trabajadores con documentos'), kpi(r.documentos.length, 'Documentos leídos'),
    kpi(abiertos.length, 'Casos abiertos', { tono: abiertos.length ? 'rojo' : 'verde' }), kpi(r.diferencias.length - abiertos.length, 'Casos resueltos', { tono: 'verde' })
  ]));
  const lista = u.soloAbiertos ? abiertos : r.diferencias;
  raiz.appendChild(tarjeta('Casos a revisar', [
    h('div', { class: 'barra' }, [boton(u.soloAbiertos ? 'Mostrar también los resueltos' : 'Mostrar solo los abiertos', { onclick: () => { u.soloAbiertos = !u.soloAbiertos; render(); } })]),
    lista.length ? tabla([{ t: 'Trabajador' }, { t: 'RUT' }, { t: 'Caso' }, { t: 'Detalle' }, { t: 'Estado' }, { t: '' }], lista.map((d) => h('tr', {}, [
      celda(d.nombre || '—'), celda(d.rut), celda(chip(CLASES[d.clase] || d.clase, d.estado === 'abierto' ? 'ambar' : 'verde')), celda(d.detalle + (d.nota ? ' · Nota: ' + d.nota : '')),
      celda(d.estado === 'abierto' ? 'Abierto' : 'Resuelto'),
      celda(boton(d.estado === 'abierto' ? 'Marcar resuelto' : 'Reabrir', { onclick: async () => {
        const nota = d.estado === 'abierto' ? (window.prompt('Nota (opcional):') || '') : '';
        const x = await PP.ticketResolver(S.sesion.pin, d.rut, u.periodo, d.clase, d.estado === 'abierto', nota);
        if (!x.ok) { toast(x.error, 'err'); return; }
        await cargar(u.periodo);
      } }))
    ]))) : h('p', { class: 'vacio', text: 'No hay casos abiertos. Todo cuadra.' })
  ]));
  raiz.appendChild(tarjeta('Documentos leídos', tabla([{ t: 'Trabajador' }, { t: 'RUT' }, { t: 'Documento' }, { t: 'Archivo' }, { t: 'Estado' }, { t: '' }],
    r.documentos.map((d) => h('tr', {}, [celda(d.nombre || '—'), celda(d.rut), celda(TIPOS[d.tipo] || d.tipo), celda(d.archivo || '—'),
      celda(chip(d.estado === 'confirmado' ? 'Confirmado' : 'Por confirmar', d.estado === 'confirmado' ? 'verde' : 'ambar')),
      celda(d.estado === 'confirmado' ? '' : boton('Confirmar lectura', { onclick: async () => { const x = await PP.documentoConfirmar(S.sesion.pin, d.id); if (x.ok) await cargar(u.periodo); else toast(x.error, 'err'); } }))])))));
  return raiz;
}
