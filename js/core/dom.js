// PARTE 2A · Utilidades de interfaz: crear elementos, formatos y descargas.

export function h(tag, atributos, hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'selected', 'disabled'].includes(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(hijos || [])) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const vaciar = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };

const n0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

export const dinero = (n) => '$' + n0.format(Math.round(n || 0));
export const numero = (n) => {
  const v = n || 0;
  return Math.abs(v - Math.round(v)) < 0.005 ? n0.format(Math.round(v)) : n2.format(v);
};
export const pct = (n) => Math.round((n || 0) * 100) + '%';

export function fecha(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  return s.slice(8, 10) + '-' + s.slice(5, 7);
}
export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function hace(iso) {
  if (!iso) return '';
  const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seg < 60) return 'hace instantes';
  if (seg < 3600) return 'hace ' + Math.round(seg / 60) + ' min';
  if (seg < 86400) return 'hace ' + Math.round(seg / 3600) + ' h';
  return 'hace ' + Math.round(seg / 86400) + ' d';
}

export const unicos = (a) => [...new Set(a)].sort();

export function csv(filas) {
  return filas.map((f) => f.map((c) => {
    const s = c == null ? '' : String(c);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
}

// Nombres propios: "ROBINSON ZURITA" → "Robinson Zurita". Labores: "CORTAR SIERPES" → "Cortar sierpes".
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
const SIGLAS = new Set(['spa', 'ltda', 'sa', 'eirl']);
export function titulo(s) {
  return String(s == null ? '' : s).toLowerCase().split(/(\s+)/).map((w, i) => {
    if (!w || /^\s+$/.test(w)) return w;
    if (SIGLAS.has(w)) return w.toUpperCase();
    if (i > 0 && MINUSCULAS.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
}
export function oracion(s) {
  const t = String(s == null ? '' : s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Excel real (.xlsx): la librería se carga solo cuando se pide la primera descarga.
let promesaXlsx = null;
export function cargarXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!promesaXlsx) {
    promesaXlsx = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX);
      s.onerror = () => { promesaXlsx = null; mal(new Error('No se pudo cargar la librería de Excel. Revisa la conexión a internet.')); };
      document.head.appendChild(s);
    });
  }
  return promesaXlsx;
}
export async function descargarExcel(nombre, hojas) {
  const X = await cargarXlsx();
  const libro = X.utils.book_new();
  for (const hoja of hojas) X.utils.book_append_sheet(libro, X.utils.aoa_to_sheet(hoja.filas), hoja.nombre.slice(0, 31));
  X.writeFile(libro, nombre);
}

// Archivo de texto sin marca BOM (necesario para .bat). CRLF para que Windows lo lea bien.
export function descargarTexto(nombre, lineas) {
  const blob = new Blob([lineas.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

export async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* sin permiso: se usa el método antiguo */ }
  const t = h('textarea', { style: 'position:fixed;opacity:0' }, []);
  t.value = texto; document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  t.remove(); return ok;
}

export function descargar(nombre, contenido) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
