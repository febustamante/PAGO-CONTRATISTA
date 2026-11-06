// PARTE 6G · Otros campos (Rulo, Nuevo Sendero, Valdés): control de plantas y elección de qué liberar.

import { h } from '../core/dom.js';
import { dinero, numero, pct, fecha, titulo, oracion } from '../core/dom.js';
import { controlOtros, gruposOtros } from '../core/reglas.js';
import { foliosDesde } from '../data/lectura.js';
import { PP } from '../data/pp.js';
import { S, puede, operar, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, chip, campo, esqueleto, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const U = () => (S.ui.otros = S.ui.otros || { desde: '', folios: null, cargando: false, error: null, sel: {}, factura: '', motivo: '' });
const clave = (g) => [g.cuartel, g.labor, g.contratista, g.valor].join('|');

async function cargar(desde) {
  const u = U();
  u.cargando = true; u.error = null; render();
  try { u.folios = await foliosDesde(desde); } catch (e) { u.error = e.message; }
  u.cargando = false; render();
}

export function vistaOtros() {
  const u = U();
  if (!u.desde) {
    const ini = S.d.ev.map((g) => g.ini).filter(Boolean).sort()[0];
    u.desde = ini ? String(ini).slice(0, 10) : new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  }
  const raiz = h('div');
  raiz.appendChild(encabezado('Otros campos',
    'Rulo, Nuevo Sendero y Valdés vienen con rendimiento real: no se reparten plantas. Aquí se revisa que no pasen del cuartel y se elige qué liberar.'));
  raiz.appendChild(h('div', { class: 'barra' }, [
    campo('Folios aprobados desde', h('input', { type: 'date', value: u.desde, onchange: (e) => { u.desde = e.target.value; u.folios = null; u.sel = {}; render(); } }))
  ]));
  if (!u.folios && !u.cargando && !u.error) cargar(u.desde);
  if (u.cargando || !u.folios) { raiz.appendChild(u.error ? aviso('err', u.error) : esqueleto(8)); return raiz; }

  const control = controlOtros(u.folios, S.base.cuarteles);
  const grupos = gruposOtros(u.folios, S.pp.liberaciones, control);
  const pasados = control.filter((x) => x.exceso).length;
  raiz.appendChild(aviso(pasados ? 'err' : 'ok', pasados ? `${pasados} de ${control.length} cuartel-labor pasados en plantas.` : `Ningún cuartel-labor pasa del total de plantas (${control.length} revisados).`));

  raiz.appendChild(panelElegir(grupos));

  const filas = control.map((x) => h('tr', {}, [
    celda(x.cuartel, { clase: x.exceso ? 'txt-rojo' : '' }), celda(oracion(x.labor), { clase: x.exceso ? 'txt-rojo sin-corte' : 'sin-corte' }),
    celda(Object.keys(x.contratistas).map(titulo).join(', ')), celda(numero(x.plantas), { num: true }),
    celda(x.total == null ? 's/d' : numero(x.total), { num: true }), celda(x.pct == null ? 's/d' : pct(x.pct), { num: true }),
    celda(x.exceso ? chip('Pasado en plantas', 'rojo') : x.pct != null && x.pct >= 0.95 ? chip('Cuartel completo', 'verde') : chip('Dentro del total', 'gris'))
  ]));
  raiz.appendChild(tarjeta('Control de plantas', tabla(
    [{ t: 'Cuartel' }, { t: 'Labor' }, { t: 'Quién' }, { t: 'Plantas', num: true }, { t: 'Plantas del cuartel', num: true }, { t: '% usado', num: true }, { t: 'Estado' }], filas,
    { vacio: 'No hay folios de otros campos en este período.', alto: 420 }),
  { nota: 'Incluye al personal propio de Agrícola San José para controlar el cuartel completo. Las labores con sufijo " 2" se juntan con la labor base.' }));
  return raiz;
}

function panelElegir(grupos) {
  const u = U();
  const admin = puede('liberar');
  const sel = grupos.filter((g) => u.sel[clave(g)]);
  const total = sel.reduce((s, g) => s + g.monto, 0);
  const exige = sel.some((g) => g.excede);
  const factura = h('input', { placeholder: 'N° de factura (opcional)', value: u.factura, oninput: (e) => { u.factura = e.target.value; } });
  const motivo = h('textarea', { rows: 2, placeholder: 'Motivo (obligatorio si el cuartel pasa de sus plantas)', value: u.motivo, oninput: (e) => { u.motivo = e.target.value; } });
  const salida = h('div');

  const filas = grupos.map((g) => h('tr', {}, [
    admin ? h('td', {}, [h('input', { type: 'checkbox', checked: !!u.sel[clave(g)], 'aria-label': 'Seleccionar ' + g.cuartel, onchange: (e) => { u.sel[clave(g)] = e.target.checked; render(); } })]) : null,
    celda(g.cuartel), celda(oracion(g.labor), { clase: 'sin-corte' }), celda(titulo(g.contratista), { clase: 'sin-corte' }), celda(dinero(g.valor), { num: true }), celda(numero(g.plantas), { num: true }),
    celda(dinero(g.monto), { num: true }), celda(g.ini === g.fin ? fecha(g.ini) : `${fecha(g.ini)} al ${fecha(g.fin)}`),
    celda(g.excede ? chip('Supera el cuartel', 'rojo') : chip('Sin alertas', 'verde'))
  ]));
  const cols = [...(admin ? [{ t: '' }] : []), { t: 'Cuartel' }, { t: 'Labor' }, { t: 'Contratista' }, { t: 'Precio', num: true }, { t: 'Plantas', num: true }, { t: 'Monto', num: true }, { t: 'Trabajo' }, { t: 'Estado' }];

  const liberar = async () => {
    salida.replaceChildren();
    if (!sel.length) { salida.appendChild(aviso('err', 'Selecciona al menos un grupo.')); return; }
    if (exige && u.motivo.trim().length < 5) { salida.appendChild(aviso('err', 'Explica por qué se libera un cuartel que pasa de sus plantas.')); return; }
    const items = sel.map((g) => ({ cuartel: g.cuartel, labor: g.labor, contratista: g.contratista, valor: g.valor, plantas: g.plantas, filas: g.filas, monto: g.monto, ini: g.ini, fin: g.fin, estado: g.excede ? 'excede' : 'ok' }));
    const r = await operar(PP.liberar(S.sesion.pin, items, u.factura.trim() || null, null, u.motivo.trim()));
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); return; }
    u.sel = {}; u.factura = ''; u.motivo = '';
    toast(`Liberados ${r.r.liberados} grupos por ${dinero(r.r.monto)}. Ya están en Pagos.`);
    render();
  };

  const cuerpo = [
    tabla(cols, filas, { vacio: 'No hay nada pendiente de liberar en este período (solo se listan contratistas, no personal propio).', alto: 380 })
  ];
  if (admin) {
    cuerpo.push(
      h('p', { class: 'resumen-sel', text: `${sel.length} grupos seleccionados · ${dinero(total)} antes de IVA` }),
      exige ? aviso('warn', 'Hay cuarteles que pasan de sus plantas: se necesita un motivo escrito.') : null,
      h('div', { class: 'barra' }, [campo('N° de factura (opcional)', factura)]), motivo,
      h('div', { class: 'barra' }, [boton('Liberar y enviar a Pagos', { tono: 'primario', onclick: liberar }), boton('Limpiar selección', { onclick: () => { u.sel = {}; render(); } })]),
      salida);
  }
  return tarjeta('Elegir qué liberar', cuerpo, { nota: 'Solo contratistas. Precio = costo del folio ÷ plantas ÷ 1,5; monto = plantas × precio × 1,5. Lo liberado pasa a la pestaña Pagos.' });
}
