// PARTE 3A · Acceso a Supabase por HTTP (sin librerías externas).

import { CONFIG } from '../config.js';

const CABECERAS = { apikey: CONFIG.SUPABASE_KEY };

// Lee una tabla o vista. Con todo=true recorre todas las páginas de 1.000 filas.
export async function leer(tabla, consulta, { todo = false } = {}) {
  const pagina = 1000;
  let desde = 0;
  const salida = [];
  for (;;) {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${tabla}?${consulta}`, {
      headers: { ...CABECERAS, 'Range-Unit': 'items', Range: `${desde}-${desde + pagina - 1}` }
    });
    if (!r.ok) throw new Error(`No se pudo leer ${tabla} (${r.status}).`);
    const datos = await r.json();
    salida.push(...datos);
    if (!todo || datos.length < pagina) break;
    desde += pagina;
  }
  return salida;
}

// Llama una función del servidor. Todas devuelven {ok, error?, ...}.
export async function rpc(funcion, argumentos) {
  const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: { ...CABECERAS, 'Content-Type': 'application/json' },
    body: JSON.stringify(argumentos)
  });
  if (!r.ok) {
    let m = `Error ${r.status} al llamar ${funcion}.`;
    try { const j = await r.json(); if (j && j.message) m = j.message; } catch (e) { /* sin detalle */ }
    return { ok: false, error: m };
  }
  return r.json();
}
