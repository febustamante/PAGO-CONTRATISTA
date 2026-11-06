// PARTE 5 · Estado de la aplicación: sesión, datos cargados y sincronización entre personas.

import { CONFIG } from './config.js';
import { PP } from './data/pp.js';
import { cargarBase } from './data/lectura.js';
import { agruparPagos, evaluar, resumen } from './core/reglas.js';
import { toast } from './ui/componentes.js';

function avisarPropuesta() {
  toast('La jefa de campo envió una propuesta de plantas para aprobar.', 'ok', { accion: { texto: 'Ver', onclick: () => { location.hash = '#/plantas'; } }, ms: 10000 });
}

export const S = {
  sesion: null,      // {pin, nombre, rol}
  base: null,        // {cuarteles, pagos} leídos de Supabase
  pp: null,          // estado compartido (asignaciones, liberaciones, etc.)
  d: null,           // datos calculados
  vista: 'tablero',
  ultima: null,
  presencia: [],     // otras personas activas: [{usuario, clave}]
  claveActual: null, // grupo que esta persona está mirando o editando
  cargando: false,
  error: null,
  ui: {}             // estado propio de cada pantalla
};

let pintar = () => {};
export const alPintar = (f) => { pintar = f; };
export const render = () => pintar();

const PERMISOS = {
  liberar: ['admin'],
  aprobar: ['admin'],
  contratos: ['admin'],
  asignar: ['admin', 'jefa_campo'],
  repartir: ['admin', 'jefa_campo'],
  asistencia: ['admin', 'jefa_campo']
};
export const puede = (accion) => (PERMISOS[accion] || []).includes(S.sesion && S.sesion.rol);

export function recalcular() {
  if (!S.base || !S.pp) return;
  const pend = agruparPagos(S.base.pagos, { pendientes: true });
  const hist = agruparPagos(S.base.pagos, { pendientes: false }).filter((x) => !x.jornada);
  const ev = evaluar(pend, hist, S.base.cuarteles, S.pp.asignaciones, S.pp.liberaciones);
  S.d = { ev, res: resumen(ev), historial: hist };
}

function guardarSesion() {
  try { sessionStorage.setItem('pp_sesion', JSON.stringify(S.sesion)); } catch (e) { /* sin almacenamiento */ }
}
export function sesionGuardada() {
  try { return JSON.parse(sessionStorage.getItem('pp_sesion')); } catch (e) { return null; }
}

export async function entrar(pin) {
  const r = await PP.login(pin);
  if (!r.ok) return r;
  S.sesion = { pin, nombre: r.nombre, rol: r.rol };
  guardarSesion();
  await cargarTodo();
  return { ok: true };
}

export function salir() {
  S.sesion = null; S.base = null; S.pp = null; S.d = null; S.ui = {};
  try { sessionStorage.removeItem('pp_sesion'); } catch (e) { /* nada */ }
  render();
}

export async function cargarTodo() {
  S.cargando = true; S.error = null; render();
  try {
    const [base, pp] = await Promise.all([cargarBase(), PP.estado(S.sesion.pin)]);
    if (!pp.ok) { S.error = pp.error; salir(); return; }
    S.base = base; S.pp = pp; S.ultima = new Date().toISOString();
    recalcular();
  } catch (e) {
    S.error = e.message || 'No se pudo conectar con Supabase.';
  }
  S.cargando = false;
  render();
}

// Dice qué grupo está mirando esta persona (para que las demás lo vean). Con null se limpia.
export function marcarPresencia(clave) {
  if (S.claveActual === clave) return;
  S.claveActual = clave;
  sincronizar({ soloPresencia: true });
}
export const quienEsta = (clave) => S.presencia.filter((p) => p.clave === clave).map((p) => p.usuario);

const propuestas = (pp) => pp.asignaciones.filter((a) => a.estado === 'propuesta').length;

// Trae solo lo compartido. Si otra persona cambió algo, se actualiza la pantalla.
let ultimaHuella = '';
export async function sincronizar({ forzar = false, soloPresencia = false } = {}) {
  if (!S.sesion || !S.base) return;
  try {
    const [pp, pr] = await Promise.all([soloPresencia ? Promise.resolve(null) : PP.estado(S.sesion.pin), PP.presencia(S.sesion.pin, S.claveActual)]);
    const nuevaPresencia = pr && pr.ok ? pr.presencia : S.presencia;
    const cambioPresencia = JSON.stringify(nuevaPresencia) !== JSON.stringify(S.presencia);
    S.presencia = nuevaPresencia;
    if (!pp) { if (cambioPresencia) render(); return; }
    if (!pp.ok) return;
    const huella = JSON.stringify([pp.asignaciones, pp.reparto, pp.liberaciones, pp.asistencia, pp.contratos, (pp.movimientos[0] || {}).id]);
    if (!forzar && huella === ultimaHuella && !cambioPresencia) return;
    const antes = S.pp ? propuestas(S.pp) : 0;
    ultimaHuella = huella;
    S.pp = pp; S.ultima = new Date().toISOString();
    if (S.sesion.rol === 'admin' && !forzar && propuestas(pp) > antes) avisarPropuesta();
    recalcular();
    const activo = document.activeElement;
    const escribiendo = activo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName);
    if (forzar || !escribiendo) render();
  } catch (e) { /* se reintenta en el próximo ciclo */ }
}

export function iniciarSincronizacion() {
  setInterval(() => { if (!document.hidden) sincronizar(); }, CONFIG.POLL_MS);
}

// Ejecuta una operación compartida y deja la pantalla al día.
export async function operar(promesa, mensajeOk) {
  const r = await promesa;
  if (r.ok) {
    await sincronizar({ forzar: true });
    return { ok: true, r, mensaje: mensajeOk };
  }
  return { ok: false, error: r.error || 'No se pudo completar la acción.' };
}
