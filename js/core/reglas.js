// PARTE 2B · Reglas del negocio. Funciones puras: sin pantalla ni red, fáciles de probar.

import { CONFIG } from '../config.js';

export const laborBase = (l) => (l || '').replace(/\s+2$/, '');
export const claveGrupo = (g) => [g.cuartel, g.labor, g.contratista, g.valor].join('|');
export const claveLiberacion = (g) => [g.cuartel, g.labor, g.contratista, g.valor, g.ini || ''].join('|');
export const esCuartelCerrillo = (c) => /^C\d\d$/.test(c || '');
export const monto = (plantas, valor) => (plantas || 0) * (valor || 0) * CONFIG.FACTOR_CONTRATISTA;

export function diasEntre(a, b) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

// Une las filas de pagos_facturados por cuartel, labor base, contratista y precio.
export function agruparPagos(filas, { pendientes }) {
  const g = new Map();
  for (const r of filas) {
    const pend = r.fecha_factura == null;
    if (pend !== pendientes) continue;
    if (!esCuartelCerrillo(r.cuartel)) continue;
    const valor = Number(r.valor_unitario);
    if (!Number.isFinite(valor)) continue;
    if (pendientes && !CONFIG.EXTERNOS.includes(r.contratista)) continue;
    const labor = laborBase(r.labor);
    const k = [r.cuartel, labor, r.contratista, valor, pendientes ? '' : r.n_factura].join('|');
    let x = g.get(k);
    if (!x) {
      x = { cuartel: r.cuartel, labor, contratista: r.contratista, valor, jornada: valor >= CONFIG.UMBRAL_PRECIO, plantas: 0, filas: 0, ini: r.trabajo_ini, fin: r.trabajo_fin, factura: r.n_factura, fechaFactura: r.fecha_factura };
      g.set(k, x);
    }
    x.plantas += Number(r.plantas) || 0;
    x.filas += Number(r.lineas) || 0;
    if (r.trabajo_ini && (!x.ini || r.trabajo_ini < x.ini)) x.ini = r.trabajo_ini;
    if (r.trabajo_fin && (!x.fin || r.trabajo_fin > x.fin)) x.fin = r.trabajo_fin;
  }
  return [...g.values()];
}

// Evalúa cada pendiente: pago anterior (rojo), varios contratistas (azul), exceso de plantas y asignación vigente.
export function evaluar(pendientes, historial, cuarteles, asignaciones, liberaciones) {
  const hist = historial.slice();
  for (const l of liberaciones) {
    hist.push({ cuartel: l.cuartel, labor: l.labor, contratista: l.contratista, valor: Number(l.valor), plantas: Number(l.plantas), factura: l.n_factura, fechaFactura: l.fecha_factura || l.fecha_pago || String(l.creado_en || '').slice(0, 10), ini: l.trabajo_ini, fin: l.trabajo_fin });
  }
  const porCL = new Map();
  const pagadosCL = new Map();
  for (const h of hist) {
    const k = h.cuartel + '|' + h.labor;
    if (!pagadosCL.has(k)) pagadosCL.set(k, []);
    pagadosCL.get(k).push(h);
  }
  const asig = new Map(asignaciones.map((a) => [[a.cuartel, a.labor, a.contratista, Number(a.valor)].join('|'), a]));
  const liberadas = new Set(liberaciones.map((l) => claveLiberacion({ cuartel: l.cuartel, labor: l.labor, contratista: l.contratista, valor: Number(l.valor), ini: l.trabajo_ini })));

  const vivos = pendientes.filter((g) => !liberadas.has(claveLiberacion(g)));
  for (const g of vivos) {
    const k = g.cuartel + '|' + g.labor;
    if (!porCL.has(k)) porCL.set(k, []);
    porCL.get(k).push(g);
  }

  return vivos.map((g) => {
    const a = asig.get(claveGrupo(g));
    const plantasOrig = g.plantas;
    const efectivas = a && a.estado === 'aprobada' ? Number(a.plantas) : plantasOrig;
    const out = { ...g, plantasOrig, plantas: efectivas, asignacion: a || null };
    if (g.jornada) {
      // Pago por jornada (precio desde $5.000): la cantidad son jornadas, no plantas. Monto = precio × jornadas × 1,5.
      Object.assign(out, { plantas: plantasOrig, rojo: false, estado: null, dias: null, otroPrecio: false, pagos: [], contratistas: [g.contratista], azul: false,
        sumaCuartel: plantasOrig, totalCuartel: null, excede: false, monto: monto(plantasOrig, g.valor), propuesta: null, confirmadas: true, listo: true, asignacion: null });
      return out;
    }
    const lst = (pagadosCL.get(g.cuartel + '|' + g.labor) || []);
    out.rojo = lst.length > 0;
    out.estado = null; out.dias = null; out.otroPrecio = false; out.pagos = [];
    if (lst.length) {
      const porC = new Map();
      for (const h of lst) {
        const c = porC.get(h.contratista);
        if (!c || (h.fechaFactura || '') > (c.fechaFactura || '') || ((h.fechaFactura || '') === (c.fechaFactura || '') && (h.fin || '') > (c.fin || ''))) porC.set(h.contratista, h);
      }
      out.pagos = [...porC.values()].sort((x, y) => (y.fin || '').localeCompare(x.fin || ''));
      const ref = lst.reduce((x, y) => ((y.fin || '') > (x.fin || '') ? y : x));
      out.dias = diasEntre(g.ini, ref.fin);
      out.estado = out.dias <= CONFIG.DIAS_MISMA_VUELTA ? 'misma' : 'nueva';
      out.otroPrecio = Number(ref.valor) !== g.valor;
    }
    const mismos = porCL.get(g.cuartel + '|' + g.labor);
    out.contratistas = [...new Set(mismos.map((x) => x.contratista))];
    out.azul = out.contratistas.length >= 2;
    out.sumaCuartel = mismos.reduce((s, x) => {
      const aa = asig.get(claveGrupo(x));
      return s + (aa && aa.estado === 'aprobada' ? Number(aa.plantas) : x.plantas);
    }, 0);
    out.totalCuartel = cuarteles[g.cuartel] ? cuarteles[g.cuartel].plantas : null;
    out.excede = out.azul && out.totalCuartel != null && out.sumaCuartel > out.totalCuartel * CONFIG.TOLERANCIA_EXCESO;
    out.monto = monto(out.plantas, g.valor);
    out.propuesta = a && a.estado === 'propuesta' ? Number(a.plantas) : null;
    out.confirmadas = !!(a && a.estado === 'aprobada');
    out.listo = !out.rojo && !out.excede;
    return out;
  }).sort((x, y) => (x.cuartel + x.labor + x.contratista + x.valor).localeCompare(y.cuartel + y.labor + y.contratista + y.valor));
}

export function resumen(ev) {
  const rojos = ev.filter((g) => g.rojo);
  const azulCL = new Set(ev.filter((g) => g.azul).map((g) => g.cuartel + '|' + g.labor));
  return {
    pendientes: ev.length,
    monto: ev.reduce((s, g) => s + g.monto, 0),
    plantas: ev.filter((g) => !g.jornada).reduce((s, g) => s + g.plantas, 0),
    jornadas: ev.filter((g) => g.jornada).length,
    azules: azulCL.size,
    revisar: rojos.length,
    noPagar: rojos.filter((g) => g.estado === 'misma').length,
    pagar: rojos.filter((g) => g.estado === 'nueva').length,
    otroPrecio: rojos.filter((g) => g.otroPrecio).length,
    listos: ev.filter((g) => g.listo).length,
    montoListo: ev.filter((g) => g.listo).reduce((s, g) => s + g.monto, 0),
    propuestas: ev.filter((g) => g.propuesta != null).length
  };
}

export function estadoParaLiberar(g) {
  if (g.rojo && g.estado === 'misma') return 'misma';
  if (g.excede) return 'excede';
  if (g.rojo && g.estado === 'nueva') return 'nueva';
  if (g.azul) return 'azul';
  return 'ok';
}

// Reparto por igual entre personas-día: el resto sobrante se entrega de a una planta.
export function repartoIgual(total, n) {
  if (n <= 0) return [];
  const q = Math.floor(total / n);
  const resto = Math.round(total - q * n);
  return Array.from({ length: n }, (_, i) => q + (i < resto ? 1 : 0));
}

// Asistencia: vino o no vino cada día. No suma jornadas.
export function asistenciaMes(filas, mes, correcciones) {
  const por = new Map();
  for (const r of filas) {
    if (!r.rut || r.fecha.slice(0, 7) !== mes) continue;
    let p = por.get(r.rut);
    if (!p) { p = { rut: r.rut, nombre: r.nombre, contratista: r.contratista, dias: new Set() }; por.set(r.rut, p); }
    p.dias.add(r.fecha);
  }
  for (const c of correcciones) {
    const f = String(c.fecha).slice(0, 10);
    if (f.slice(0, 7) !== mes) continue;
    const p = por.get(c.rut);
    if (!p) continue;
    if (c.vino) p.dias.add(f); else p.dias.delete(f);
  }
  return [...por.values()].map((p) => ({ ...p, cuenta: p.dias.size }))
    .sort((a, b) => (a.contratista + a.nombre).localeCompare(b.contratista + b.nombre));
}

export const esPersonalPropio = (c) => /AGR[IÍ]COLA SAN JOS[EÉ]/i.test(c || '');

// Otros campos: grupos que se pueden liberar (solo contratistas, por cuartel, labor, contratista y precio).
// El precio sale del costo del folio: costo = plantas × precio × 1,5. Lo ya liberado queda fuera.
export function gruposOtros(folios, liberaciones, control) {
  const libs = liberaciones.filter((l) => !esCuartelCerrillo(l.cuartel));
  const cubierto = (f) => libs.some((l) => l.cuartel === f.cuartel && l.labor === laborBase(f.labor) && l.contratista === f.contratista &&
    l.trabajo_ini && l.trabajo_fin && String(f.fecha_aprobado) >= String(l.trabajo_ini) && String(f.fecha_aprobado) <= String(l.trabajo_fin));
  const excede = new Set(control.filter((x) => x.exceso).map((x) => x.cuartel + '|' + x.labor));
  const g = new Map();
  for (const f of folios) {
    if (!f.cuartel || esCuartelCerrillo(f.cuartel) || esPersonalPropio(f.contratista)) continue;
    if (!(f.plantas > 0) || !(f.costo > 0) || (f.estado && f.estado !== 'APROBADO')) continue;
    if (cubierto(f)) continue;
    const labor = laborBase(f.labor);
    const valor = Math.round(f.costo / (f.plantas * CONFIG.FACTOR_CONTRATISTA));
    const k = [f.cuartel, labor, f.contratista, valor].join('|');
    let x = g.get(k);
    if (!x) { x = { cuartel: f.cuartel, labor, contratista: f.contratista, valor, plantas: 0, monto: 0, filas: 0, ini: f.fecha_aprobado, fin: f.fecha_aprobado }; g.set(k, x); }
    x.plantas += f.plantas; x.monto += f.costo; x.filas += 1;
    if (f.fecha_aprobado < x.ini) x.ini = f.fecha_aprobado;
    if (f.fecha_aprobado > x.fin) x.fin = f.fecha_aprobado;
  }
  return [...g.values()].map((x) => ({ ...x, excede: excede.has(x.cuartel + '|' + x.labor) }))
    .sort((a, b) => (a.cuartel + a.labor + a.contratista).localeCompare(b.cuartel + b.labor + b.contratista));
}

// Otros campos: plantas reales por folio frente al total del cuartel.
export function controlOtros(folios, cuarteles) {
  const m = new Map();
  for (const f of folios) {
    if (esCuartelCerrillo(f.cuartel) || !f.cuartel || !f.plantas) continue;
    const labor = laborBase(f.labor);
    const k = f.cuartel + '|' + labor;
    let x = m.get(k);
    if (!x) { x = { cuartel: f.cuartel, labor, contratistas: {}, plantas: 0, folios: 0 }; m.set(k, x); }
    x.contratistas[f.contratista] = (x.contratistas[f.contratista] || 0) + f.plantas;
    x.plantas += f.plantas;
    x.folios += 1;
  }
  return [...m.values()].map((x) => {
    const total = cuarteles[x.cuartel] ? cuarteles[x.cuartel].plantas : null;
    return { ...x, total, pct: total ? x.plantas / total : null, exceso: total != null && x.plantas > total * CONFIG.TOLERANCIA_EXCESO };
  }).sort((a, b) => (b.pct || 0) - (a.pct || 0));
}
