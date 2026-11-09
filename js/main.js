// PARTE 7 · Arranque, rutas, atajos de teclado y estructura general de la pantalla.

import { CONFIG, ROLES } from './config.js';
import { h } from './core/dom.js';
import { hace, titulo } from './core/dom.js';
import { S, alPintar, render, salir, cargarTodo, sincronizar, iniciarSincronizacion, sesionGuardada } from './estado.js';
import { boton, cargando, aviso, esqueleto } from './ui/componentes.js';
import { icono } from './ui/iconos.js';
import { vistaLogin } from './vistas/login.js';
import { vistaTablero } from './vistas/tablero.js';
import { vistaPagos } from './vistas/pagos.js';
import { vistaPlantas } from './vistas/plantas.js';
import { vistaAsistencia } from './vistas/asistencia.js';
import { vistaAlertas } from './vistas/alertas.js';
import { vistaOtros } from './vistas/otrosCampos.js';
import { vistaContratos } from './vistas/contratos.js';
import { vistaInforme } from './vistas/informe.js';
import { vistaHistorial } from './vistas/historial.js';
import { vistaImpresion } from './vistas/impresion.js';
import { vistaUsuarios } from './vistas/usuarios.js';
import { vistaClave } from './vistas/clave.js';
import { vistaDocumentos } from './vistas/documentos.js';
import { vistaRetencion } from './vistas/retencion.js';
import { vistaAjustes } from './vistas/ajustes.js';
import { vistaLiquidacion } from './vistas/liquidacion.js';

const TODOS = ['admin', 'jefa_campo', 'lectura'];
const NAV = [
  { id: 'inicio', g: 'Operación', t: 'Inicio', i: 'inicio', roles: ['admin', 'lectura'], v: () => vistaTablero(ir) },
  { id: 'pagos', g: 'Operación', t: 'Pagos', i: 'dinero', roles: ['admin', 'lectura'], v: vistaPagos },
  { id: 'plantas', g: 'Operación', t: 'Asignar plantas', i: 'reparto', roles: ['admin', 'jefa_campo'], v: vistaPlantas },
  { id: 'otros', g: 'Operación', t: 'Otros campos', i: 'mapa', roles: ['admin', 'lectura'], v: vistaOtros },
  { id: 'impresion', g: 'Operación', t: 'Impresión', i: 'imprimir', roles: ['admin'], v: vistaImpresion },
  { id: 'asistencia', g: 'Control', t: 'Asistencia', i: 'personas', roles: ['admin', 'lectura'], v: vistaAsistencia },
  { id: 'alertas', g: 'Control', t: 'Alertas', i: 'alerta', roles: ['admin', 'lectura'], v: vistaAlertas },
  { id: 'contratos', g: 'Control', t: 'Contratos', i: 'contrato', roles: ['admin', 'lectura'], v: vistaContratos },
  { id: 'documentos', g: 'Control', t: 'Documentos', i: 'contrato', roles: ['admin'], v: vistaDocumentos },
  { id: 'informe', g: 'Control', t: 'Informe', i: 'hoja', roles: ['admin', 'lectura'], v: vistaInforme },
  { id: 'ajustes', g: 'Administración', t: 'Ajustes', i: 'contrato', roles: ['admin'], v: vistaAjustes },
  { id: 'retencion', t: 'Detalle a liberar', i: 'hoja', roles: ['admin'], oculto: true, v: vistaRetencion },
  { id: 'liquidacion', t: 'Detalle a facturar', i: 'hoja', roles: ['admin', 'lectura'], oculto: true, v: vistaLiquidacion },
  { id: 'usuarios', g: 'Administración', t: 'Usuarios', i: 'personas', roles: ['admin'], v: vistaUsuarios },
  { id: 'historial', g: 'Administración', t: 'Historial', i: 'reloj', roles: ['admin', 'lectura'], v: vistaHistorial },
  { id: 'clave', t: 'Mi clave', i: 'candado', roles: TODOS, oculto: true, v: () => vistaClave() }
];

// Nombres cortos y rutas antiguas: llevan a la pantalla nueva con la pestaña correcta.
const ALIAS = {
  liberar: ['pagos', () => { S.ui.pagosTab = 'liberar'; }],
  hoja: ['plantas', () => { S.ui.plantasTab = 'cuartel'; }],
  reparto: ['plantas', () => { S.ui.plantasTab = 'persona'; }]
};
export function ir(destino) {
  const a = ALIAS[destino];
  if (a) { a[1](); location.hash = '#/' + a[0]; } else location.hash = '#/' + destino;
}

const permitidas = () => NAV.filter((n) => n.roles.includes(S.sesion.rol));
const menu = () => permitidas().filter((n) => !n.oculto);

function vistaActual() {
  let id = location.hash.replace('#/', '') || 'inicio';
  if (ALIAS[id]) { ALIAS[id][1](); id = ALIAS[id][0]; history.replaceState(null, '', '#/' + id); }
  return permitidas().find((n) => n.id === id) || menu()[0];
}

function insignia(id) {
  if (!S.d) return null;
  if (id === 'alertas') { const n = S.d.res.revisar + S.d.res.azules; return n ? h('span', { class: 'insignia rojo', text: n }) : null; }
  if (id === 'plantas' && S.sesion.rol === 'admin') return S.d.res.propuestas ? h('span', { class: 'insignia violeta', title: 'Propuestas por aprobar', text: S.d.res.propuestas }) : null;
  if (id === 'pagos' && S.pp) { const n = S.pp.liberaciones.filter((l) => !l.fecha_pago).length; return n ? h('span', { class: 'insignia', title: 'Liberados sin fecha de pago', text: n }) : null; }
  return null;
}

function lateral(actual) {
  return h('aside', { class: 'lateral' }, [
    h('div', { class: 'marca' }, [h('span', { class: 'marca-a', text: 'Agrícola San José' }), h('span', { class: 'marca-c', text: 'Pagos a contratistas' })]),
    h('nav', { 'aria-label': 'Secciones' }, menu().flatMap((n, i, arr) => [
      i === 0 || arr[i - 1].g !== n.g ? h('div', { class: 'nav-grupo', text: n.g }) : null,
      h('a', { class: 'nav-item' + (n.id === actual.id ? ' activo' : ''), href: '#/' + n.id, title: `${n.t} (Alt+${i + 1})`, 'aria-current': n.id === actual.id ? 'page' : false }, [icono(n.i), h('span', { text: n.t }), insignia(n.id)])
    ])),
    h('div', { class: 'usuario' }, [
      h('div', { class: 'usuario-n', text: titulo(S.sesion.nombre) }),
      h('div', { class: 'usuario-r', text: ROLES[S.sesion.rol] || S.sesion.rol }),
      boton('Mi clave', { icon: 'candado', onclick: () => { location.hash = '#/clave'; } }),
      boton('Salir', { icon: 'salir', onclick: salir })
    ])
  ]);
}

function barraSuperior(actual) {
  return h('header', { class: 'barra-sup' }, [
    h('div', { class: 'barra-sup-t', text: actual.t }),
    h('div', { class: 'barra-sup-d' }, [
      CONFIG.DEMO ? h('span', { class: 'chip violeta', text: 'Modo demostración' }) : null,
      h('span', { class: 'sync', id: 'sync', text: S.ultima ? 'Actualizado ' + hace(S.ultima) : '' }),
      boton('Actualizar', { icon: 'actualizar', onclick: () => cargarTodo() })
    ])
  ]);
}

alPintar(() => {
  const raiz = document.getElementById('app');
  const y = window.scrollY;
  raiz.replaceChildren();
  if (!S.sesion) { raiz.appendChild(vistaLogin()); return; }
  if (S.sesion.debe_cambiar) { raiz.appendChild(vistaClave({ obligatorio: true })); return; }
  if (!S.base || !S.pp || !S.d) {
    raiz.appendChild(h('div', { class: 'pantalla-carga' }, [S.error ? aviso('err', S.error) : esqueleto(7), S.error ? boton('Reintentar', { onclick: () => cargarTodo() }) : null]));
    return;
  }
  const actual = vistaActual();
  let contenido;
  try { contenido = actual.v(); } catch (e) { console.error(e); contenido = aviso('err', 'No se pudo mostrar esta pantalla: ' + e.message); }
  raiz.appendChild(h('div', { class: 'app' }, [
    lateral(actual),
    h('div', { class: 'principal' }, [barraSuperior(actual), S.error ? aviso('err', S.error) : null, h('main', { class: 'contenido', id: 'contenido' }, [contenido])])
  ]));
  window.scrollTo(0, y);
});

// Atajos: "/" busca, Alt+1…9 cambia de pantalla.
document.addEventListener('keydown', (e) => {
  if (!S.sesion) return;
  const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target.tagName || ''));
  if (e.key === '/' && !escribiendo) { const b = document.getElementById('buscar'); if (b) { e.preventDefault(); b.focus(); } }
  if (e.altKey && /^[1-9]$/.test(e.key)) { const n = menu()[Number(e.key) - 1]; if (n) { e.preventDefault(); location.hash = '#/' + n.id; } }
});

window.addEventListener('hashchange', () => { if (S.sesion) render(); });
setInterval(() => { const e = document.getElementById('sync'); if (e && S.ultima) e.textContent = 'Actualizado ' + hace(S.ultima); }, 30000);

(async function arrancar() {
  const previa = sesionGuardada();
  if (previa) { S.sesion = previa; await cargarTodo(); if (S.sesion && S.base) iniciarSincronizacion(); }
  else render();
  // Si se entra más tarde con el PIN, la sincronización arranca al cargar los datos.
  const observar = setInterval(() => { if (S.sesion && S.base) { clearInterval(observar); if (!previa) iniciarSincronizacion(); } }, 500);
})();

window.__PP = { S, ir, sincronizar };
