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

const TODOS = ['admin', 'jefa_campo', 'lectura'];
const NAV = [
  { id: 'inicio', t: 'Inicio', i: 'inicio', roles: ['admin', 'lectura'], v: () => vistaTablero(ir) },
  { id: 'pagos', t: 'Pagos', i: 'dinero', roles: ['admin', 'lectura'], v: vistaPagos },
  { id: 'plantas', t: 'Asignar plantas', i: 'reparto', roles: ['admin', 'jefa_campo'], v: vistaPlantas },
  { id: 'asistencia', t: 'Asistencia', i: 'personas', roles: ['admin', 'lectura'], v: vistaAsistencia },
  { id: 'alertas', t: 'Alertas', i: 'alerta', roles: ['admin', 'lectura'], v: vistaAlertas },
  { id: 'otros', t: 'Otros campos', i: 'mapa', roles: ['admin', 'lectura'], v: vistaOtros },
  { id: 'contratos', t: 'Contratos', i: 'contrato', roles: ['admin', 'lectura'], v: vistaContratos },
  { id: 'informe', t: 'Informe', i: 'hoja', roles: ['admin', 'lectura'], v: vistaInforme },
  { id: 'impresion', t: 'Impresión', i: 'imprimir', roles: ['admin'], v: vistaImpresion },
  { id: 'historial', t: 'Historial', i: 'reloj', roles: ['admin', 'lectura'], v: vistaHistorial }
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

function vistaActual() {
  let id = location.hash.replace('#/', '') || 'inicio';
  if (ALIAS[id]) { ALIAS[id][1](); id = ALIAS[id][0]; history.replaceState(null, '', '#/' + id); }
  return permitidas().find((n) => n.id === id) || permitidas()[0];
}

function insignia(id) {
  if (!S.d) return null;
  if (id === 'alertas') { const n = S.d.res.revisar + S.d.res.azules; return n ? h('span', { class: 'insignia', text: n }) : null; }
  if (id === 'plantas' && S.sesion.rol === 'admin') return S.d.res.propuestas ? h('span', { class: 'insignia violeta', title: 'Propuestas por aprobar', text: S.d.res.propuestas }) : null;
  if (id === 'pagos' && S.pp) { const n = S.pp.liberaciones.filter((l) => !l.fecha_pago).length; return n ? h('span', { class: 'insignia', title: 'Liberados sin fecha de pago', text: n }) : null; }
  return null;
}

function lateral(actual) {
  return h('aside', { class: 'lateral' }, [
    h('div', { class: 'marca' }, [h('span', { class: 'marca-a', text: 'Agrícola' }), h('span', { class: 'marca-b', text: 'San José' }), h('span', { class: 'marca-c', text: 'Pagos a contratistas' })]),
    h('nav', { 'aria-label': 'Secciones' }, permitidas().map((n, i) =>
      h('a', { class: 'nav-item' + (n.id === actual.id ? ' activo' : ''), href: '#/' + n.id, title: `${n.t} (Alt+${i + 1})`, 'aria-current': n.id === actual.id ? 'page' : false }, [icono(n.i), h('span', { text: n.t }), insignia(n.id)]))),
    h('div', { class: 'usuario' }, [
      h('div', { class: 'usuario-n', text: titulo(S.sesion.nombre) }),
      h('div', { class: 'usuario-r', text: ROLES[S.sesion.rol] || S.sesion.rol }),
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
  if (e.altKey && /^[1-9]$/.test(e.key)) { const n = permitidas()[Number(e.key) - 1]; if (n) { e.preventDefault(); location.hash = '#/' + n.id; } }
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
