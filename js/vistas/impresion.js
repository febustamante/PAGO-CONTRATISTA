// PARTE 6O · Impresión de folios: la plataforma recuerda el último folio impreso y lista los que vienen después.
// Solo folios aprobados y sin los del contratista Agrícola San José. Se imprimen con tu script imprimir_folios.py.

import { h } from '../core/dom.js';
import { fecha, fechaLarga, titulo, oracion, descargarTexto, copiarTexto, hace } from '../core/dom.js';
import { PP } from '../data/pp.js';
import { foliosAprobados } from '../data/lectura.js';
import { S, operar, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, kpi, toast, confirmar, esqueleto, pildora } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const U = () => (S.ui.impresion = S.ui.impresion || { estado: null, folios: null, cargando: false, error: null, errores: '', hasta: '', corregir: '' });
const CLAVE_CARPETA = 'pp_carpeta_script';
const POR_LINEA = 60;

const carpetaGuardada = () => { try { return localStorage.getItem(CLAVE_CARPETA) || ''; } catch (e) { return ''; } };
const guardarCarpeta = (v) => { try { localStorage.setItem(CLAVE_CARPETA, v); } catch (e) { /* sin almacenamiento */ } };

async function cargar() {
  const u = U();
  u.cargando = true; u.error = null; render();
  try {
    const [est, folios] = await Promise.all([PP.impresionLeer(S.sesion.pin), foliosAprobados()]);
    if (!est.ok) throw new Error(est.error);
    u.estado = est; u.folios = folios;
  } catch (e) { u.error = e.message; }
  u.cargando = false; render();
}

const comandos = (nums) => {
  const lineas = [];
  for (let i = 0; i < nums.length; i += POR_LINEA) lineas.push('python imprimir_folios.py ' + nums.slice(i, i + POR_LINEA).join(' '));
  return lineas;
};

export function vistaImpresion() {
  const u = U();
  const raiz = h('div');
  raiz.appendChild(encabezado('Impresión de folios',
    'Los folios aprobados que vienen después del último impreso (sin los de Agrícola San José). La plataforma recuerda sola hasta dónde se imprimió.'));
  if (!u.estado && !u.cargando && !u.error) cargar();
  if (u.cargando || !u.estado) { raiz.appendChild(u.error ? h('div', {}, [aviso('err', u.error), boton('Reintentar', { onclick: () => { u.error = null; cargar(); } })]) : esqueleto(6)); return raiz; }

  const est = u.estado;
  const reint = est.reintentar || [];
  const nuevos = u.folios.filter((f) => f.folio > est.ultimo_folio);
  const aReintentar = u.folios.filter((f) => reint.includes(f.folio) && f.folio <= est.ultimo_folio);
  const lista = [...aReintentar, ...nuevos];
  const nums = lista.map((f) => f.folio);
  const maximo = nuevos.length ? nuevos[nuevos.length - 1].folio : est.ultimo_folio;

  raiz.appendChild(h('div', { class: 'kpis' }, [
    kpi(est.ultimo_folio, 'Último folio impreso', { sub: `${est.actualizado_por ? titulo(est.actualizado_por) + ' · ' : ''}${hace(est.actualizado_en)}` }),
    kpi(nuevos.length, 'Folios por imprimir', { tono: nuevos.length ? 'ambar' : 'verde', sub: nuevos.length ? `del ${nuevos[0].folio} al ${maximo}` : 'al día' }),
    kpi(aReintentar.length, 'Para reintentar', { tono: aReintentar.length ? 'rojo' : '', sub: aReintentar.length ? aReintentar.map((f) => f.folio).join(', ') : 'ninguno' })
  ]));

  const carpeta = h('input', { placeholder: 'Carpeta donde está imprimir_folios.py', value: carpetaGuardada(), style: 'min-width:300px', oninput: (e) => guardarCarpeta(e.target.value.trim()) });
  raiz.appendChild(tarjeta('1 · Imprimir', [
    h('p', { class: 'nota', text: 'Copia el comando o descarga el archivo .bat y ejecútalo: usa tu script de siempre. La carpeta se guarda solo en este navegador.' }),
    h('div', { class: 'barra' }, [campo('Carpeta del script (opcional, para el .bat)', carpeta),
      boton(`Copiar comando (${nums.length} folios)`, { onclick: async () => { if (!nums.length) { toast('No hay folios por imprimir.', 'err'); return; } const ok = await copiarTexto(comandos(nums).join('\n')); toast(ok ? 'Comando copiado.' : 'No se pudo copiar. Usa el archivo .bat.', ok ? 'ok' : 'err'); } }),
      boton('Descargar .bat', { icon: 'descargar', onclick: () => {
        if (!nums.length) { toast('No hay folios por imprimir.', 'err'); return; }
        const c = carpetaGuardada();
        descargarTexto('imprimir_folios.bat', ['@echo off', ...(c ? [`cd /d "${c.replace(/"/g, '')}"`] : []), ...comandos(nums), 'pause']);
      } })
    ]),
    nums.length > POR_LINEA ? aviso('info', `Son ${nums.length} folios: el comando se divide en líneas de ${POR_LINEA} para que Windows lo acepte.`) : null
  ]));

  const hasta = h('input', { type: 'number', min: '0', value: u.hasta || maximo, style: 'width:120px', oninput: (e) => { u.hasta = e.target.value; }, 'aria-label': 'Marcar hasta el folio' });
  const errores = h('input', { placeholder: 'Folios que no salieron, separados por coma', value: u.errores, style: 'min-width:300px', oninput: (e) => { u.errores = e.target.value; } });
  raiz.appendChild(tarjeta('2 · Marcar como impresos', [
    h('p', { class: 'nota', text: 'Cuando termine de imprimir, deja marcado hasta qué folio llegaste. La próxima vez parte desde ahí.' }),
    h('div', { class: 'barra' }, [campo('Marcar hasta el folio', hasta), campo('Folios con error (opcional)', errores),
      boton('Marcar como impresos', { tono: 'primario', onclick: async () => {
        const tope = Math.round(Number(hasta.value));
        if (!Number.isFinite(tope) || tope < est.ultimo_folio) { toast('Indica un folio igual o mayor al último impreso.', 'err'); return; }
        const fallaron = [...new Set(errores.value.split(/[ ,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
        const lote = lista.filter((f) => f.folio <= tope).map((f) => f.folio);
        const impresos = lote.filter((n) => !fallaron.includes(n));
        const reintentar = [...new Set([...reint.filter((n) => !lote.includes(n)), ...fallaron])].sort((a, b) => a - b);
        const ok = await confirmar({ titulo: `Marcar hasta el folio ${tope}`, mensaje: `${impresos.length} folios impresos${fallaron.length ? ` y ${fallaron.length} para reintentar (${fallaron.join(', ')})` : ''}. El último impreso pasa de ${est.ultimo_folio} a ${tope}.`, ok: 'Marcar' });
        if (!ok) return;
        const r = await operar(PP.impresionMarcar(S.sesion.pin, tope, impresos.length, reintentar, fallaron.length ? 'con errores: ' + fallaron.join(', ') : null));
        if (!r.ok) { toast(r.error, 'err'); return; }
        u.hasta = ''; u.errores = ''; u.estado = null; u.folios = null;
        toast(`Último folio impreso: ${tope}.`); render();
      } })
    ])
  ]));

  raiz.appendChild(tarjeta(`Folios por imprimir (${lista.length})`, tabla(
    [{ t: 'Folio' }, { t: 'Aprobado' }, { t: 'Cuartel' }, { t: 'Labor' }, { t: 'Contratista' }, { t: '' }],
    lista.map((f) => h('tr', {}, [celda(h('b', { text: f.folio })), celda(fecha(f.fecha)), celda(f.cuartel), celda(oracion(f.labor), { clase: 'sin-corte' }), celda(titulo(f.contratista), { clase: 'sin-corte' }),
      celda(reint.includes(f.folio) && f.folio <= est.ultimo_folio ? pildora('Reintentar', 'rojo', 'No salió en la impresión anterior') : '')])),
    { vacio: 'Todo al día: no hay folios nuevos después del último impreso.', alto: 420 })));

  const corregir = h('input', { type: 'number', min: '0', placeholder: String(est.ultimo_folio), value: u.corregir, style: 'width:120px', oninput: (e) => { u.corregir = e.target.value; }, 'aria-label': 'Nuevo último folio impreso' });
  raiz.appendChild(tarjeta('Corregir el último folio impreso', [
    h('p', { class: 'nota', text: 'Si necesitas volver atrás o adelantar el punto de partida, indica el número del último folio que SÍ está impreso.' }),
    h('div', { class: 'barra' }, [campo('Último folio impreso', corregir), boton('Guardar', { onclick: async () => {
      const n = Math.round(Number(corregir.value));
      if (!Number.isFinite(n) || n < 0 || corregir.value === '') { toast('Escribe un número de folio.', 'err'); return; }
      const ok = await confirmar({ titulo: `Dejar el ${n} como último folio impreso`, mensaje: n < est.ultimo_folio ? `Se volverán a listar los folios del ${n + 1} al ${est.ultimo_folio}.` : 'Los folios hasta ese número se darán por impresos.', ok: 'Guardar' });
      if (!ok) return;
      const r = await operar(PP.impresionMarcar(S.sesion.pin, n, 0, reint.filter((x) => x <= n), 'ajuste manual'));
      if (r.ok) { u.corregir = ''; u.estado = null; u.folios = null; toast('Último folio impreso actualizado.'); render(); } else toast(r.error, 'err');
    } })])
  ]));

  raiz.appendChild(tarjeta('Historial de impresiones', tabla(
    [{ t: 'Cuándo' }, { t: 'Quién' }, { t: 'Folios' }, { t: 'Impresos', num: true }, { t: 'Detalle' }],
    (est.historial || []).map((x) => h('tr', {}, [celda(fechaLarga(x.en), { clase: 'sin-corte' }), celda(titulo(x.por), { clase: 'sin-corte' }), celda(x.desde && x.desde <= x.hasta ? `${x.desde} al ${x.hasta}` : `último: ${x.hasta}`), celda(x.cantidad, { num: true }), celda(x.nota || '')])),
    { vacio: 'Todavía no hay impresiones registradas.' })));
  return raiz;
}
