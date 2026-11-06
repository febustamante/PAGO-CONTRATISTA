// PARTE 3D · Copia en memoria de las funciones pp_* para probar la interfaz sin escribir en Supabase.
// PIN de demostración: 1111 administrador · 2222 jefa de campo · 3333 solo lectura.

const USUARIOS = {
  '1111': { nombre: 'Administrador (demo)', rol: 'admin' },
  '2222': { nombre: 'Jefa de campo (demo)', rol: 'jefa_campo' },
  '3333': { nombre: 'Gerencia (demo)', rol: 'lectura' }
};

const D = { asignaciones: [], reparto: [], liberaciones: [], asistencia: [], contratos: [], movimientos: [], sig: 1 };
const ahora = () => new Date().toISOString();
const err = (error) => ({ ok: false, error });
const quien = (pin) => USUARIOS[pin] || null;
const mov = (u, accion, detalle) => D.movimientos.unshift({ id: D.movimientos.length + 1, usuario: u.nombre, accion, detalle, creado_en: ahora() });
const pausa = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 60));
const kg = (x) => [x.cuartel, x.labor, x.contratista, Number(x.valor)].join('|');

// Para probar la presencia en el modo demo: window.__ppDemo.presenciaSimulada = [{usuario:'Jefa de campo', clave:'C02|DESHOJE'}]
window.__ppDemo = window.__ppDemo || { presenciaSimulada: null };
export const presencia = () => pausa({ ok: true, presencia: window.__ppDemo.presenciaSimulada || [] });

D.impresion = { ultimo_folio: 8113, iniciado: true, reintentar: [], actualizado_por: 'Inicio automático', actualizado_en: new Date().toISOString(), historial: [] };
export const impresionLeer = (pin) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador usa la impresión de folios.'));
  return pausa({ ok: true, ...D.impresion });
};
export const impresionMarcar = (pin, hasta, cantidad, reintentar, nota) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador usa la impresión de folios.'));
  if (hasta == null || hasta < 0) return pausa(err('El número de folio no es válido.'));
  D.impresion.historial.unshift({ id: D.impresion.historial.length + 1, desde: D.impresion.ultimo_folio + 1, hasta, cantidad, errores: reintentar || [], nota: nota || null, por: u.nombre, en: ahora() });
  Object.assign(D.impresion, { ultimo_folio: hasta, iniciado: true, reintentar: reintentar || [], actualizado_por: u.nombre, actualizado_en: ahora() });
  mov(u, 'impresion', `último folio impreso → ${hasta}`);
  return pausa({ ok: true, ultimo_folio: hasta });
};

export const login = (pin) => pausa(quien(pin) ? { ok: true, ...quien(pin) } : err('PIN no válido o sin acceso a esta plataforma.'));

export const estado = (pin) => {
  const u = quien(pin);
  if (!u) return pausa(err('No autorizado.'));
  return pausa({ ok: true, usuario: u, asignaciones: D.asignaciones, reparto: D.reparto, liberaciones: D.liberaciones.filter((l) => !l.anulada), asistencia: D.asistencia, contratos: D.contratos, movimientos: D.movimientos.slice(0, 200), ahora: ahora() });
};

export const proponer = (pin, items) => {
  const u = quien(pin);
  if (!u || !['admin', 'jefa_campo'].includes(u.rol)) return pausa(err('Tu rol no permite asignar plantas.'));
  const e = u.rol === 'admin' ? 'aprobada' : 'propuesta';
  for (const it of items) {
    const i = D.asignaciones.findIndex((a) => kg(a) === kg(it));
    const fila = { cuartel: it.cuartel, labor: it.labor, contratista: it.contratista, valor: it.valor, plantas: it.plantas, estado: e, propuesto_por: e === 'propuesta' ? u.nombre : (i >= 0 ? D.asignaciones[i].propuesto_por : null), aprobado_por: e === 'aprobada' ? u.nombre : null, version: i >= 0 ? D.asignaciones[i].version + 1 : 1, actualizado_en: ahora() };
    if (i >= 0) D.asignaciones[i] = fila; else D.asignaciones.push(fila);
  }
  mov(u, e === 'aprobada' ? 'plantas_aprobadas' : 'plantas_propuestas', `${items.length} asignaciones`);
  return pausa({ ok: true, guardadas: items.length, estado: e });
};

export const aprobar = (pin, items) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador aprueba plantas.'));
  let n = 0;
  for (const it of items) {
    const a = D.asignaciones.find((x) => kg(x) === kg(it));
    if (a) { a.estado = 'aprobada'; a.aprobado_por = u.nombre; a.version += 1; a.actualizado_en = ahora(); n += 1; }
  }
  mov(u, 'plantas_aprobadas', `${n} asignaciones aprobadas`);
  return pausa({ ok: true, aprobadas: n });
};

export const guardarReparto = (pin, grupo, total, filas) => {
  const u = quien(pin);
  if (!u || !['admin', 'jefa_campo'].includes(u.rol)) return pausa(err('Tu rol no permite repartir plantas.'));
  const a = D.asignaciones.find((x) => kg(x) === kg(grupo));
  const objetivo = a ? Number(a.plantas) : total;
  const suma = filas.reduce((s, f) => s + Number(f.plantas), 0);
  if (filas.length && Math.abs(suma - objetivo) > 0.5) return pausa(err(`El reparto suma ${Math.round(suma)} y el total del equipo es ${Math.round(objetivo)}.`));
  D.reparto = D.reparto.filter((r) => kg(r) !== kg(grupo));
  for (const f of filas) D.reparto.push({ fila_id: f.id, ...grupo, plantas: f.plantas, actualizado_por: u.nombre, actualizado_en: ahora() });
  mov(u, 'reparto_personas', `${grupo.cuartel} ${grupo.labor} ${grupo.contratista}: ${filas.length} filas`);
  return pausa({ ok: true, filas: filas.length });
};

export const restaurar = (pin, items) => {
  const u = quien(pin);
  if (!u || !['admin', 'jefa_campo'].includes(u.rol)) return pausa(err('Tu rol no permite esta acción.'));
  for (const it of items) {
    D.asignaciones = D.asignaciones.filter((a) => kg(a) !== kg(it));
    D.reparto = D.reparto.filter((r) => kg(r) !== kg(it));
  }
  mov(u, 'restaurar', `${items.length} grupos vueltos a lo original`);
  return pausa({ ok: true, grupos: items.length });
};

export const liberar = (pin, items, factura, fecha, motivo) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador libera pagos.'));
  if (items.some((i) => ['misma', 'excede'].includes(i.estado)) && (!motivo || motivo.trim().length < 5)) return pausa(err('Hay grupos marcados como no pagar o con exceso de plantas: escribe el motivo.'));
  for (const it of items) {
    if (D.liberaciones.some((l) => !l.anulada && kg(l) === kg(it) && (l.trabajo_ini || '') === (it.ini || ''))) return pausa(err('Alguno de estos grupos ya fue liberado por otra persona. Actualiza la pantalla.'));
  }
  let total = 0;
  for (const it of items) {
    D.liberaciones.unshift({ id: D.sig++, cuartel: it.cuartel, labor: it.labor, contratista: it.contratista, valor: it.valor, plantas: it.plantas, filas: it.filas, monto: it.monto, trabajo_ini: it.ini, trabajo_fin: it.fin, n_factura: (factura || '').trim() || null, fecha_factura: fecha || null, fecha_pago: null, estado_al_liberar: it.estado, motivo: motivo || null, liberado_por: u.nombre, creado_en: ahora(), anulada: false });
    total += it.monto || 0;
  }
  mov(u, 'liberar', `${items.length} grupos por $${Math.round(total)}${factura && factura.trim() ? ' · factura ' + factura.trim() : ''}`);
  return pausa({ ok: true, liberados: items.length, monto: total });
};

export const fijarFechaPago = (pin, ids, fecha) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador fija la fecha de pago.'));
  if (!fecha && !ids) return pausa(err('Indica la fecha de pago.'));
  let n = 0;
  for (const l of D.liberaciones) {
    if (l.anulada) continue;
    if (fecha ? (ids ? ids.includes(l.id) : !l.fecha_pago) : ids.includes(l.id)) { l.fecha_pago = fecha || null; l.fecha_pago_por = fecha ? u.nombre : null; n += 1; }
  }
  mov(u, fecha ? 'fecha_pago' : 'quitar_fecha_pago', `${n} liberaciones${fecha ? ' → ' + fecha : ' sin fecha de pago'}`);
  return pausa({ ok: true, actualizadas: n });
};

export const deshacer = (pin, id) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador deshace liberaciones.'));
  const l = D.liberaciones.find((x) => x.id === id && !x.anulada);
  if (!l) return pausa(err('La liberación no existe o ya estaba anulada.'));
  if (l.fecha_pago) return pausa(err('Esta liberación ya tiene fecha de pago. Quita la fecha de pago primero.'));
  l.anulada = true;
  mov(u, 'deshacer_liberacion', `${l.cuartel} ${l.labor} ${l.contratista}`);
  return pausa({ ok: true });
};

export const asistencia = (pin, rut, fecha, vino) => {
  const u = quien(pin);
  if (!u || !['admin', 'jefa_campo'].includes(u.rol)) return pausa(err('Tu rol no permite corregir asistencia.'));
  const i = D.asistencia.findIndex((a) => a.rut === rut && a.fecha === fecha);
  const fila = { rut, fecha, vino, por: u.nombre, en: ahora() };
  if (i >= 0) D.asistencia[i] = fila; else D.asistencia.push(fila);
  mov(u, 'asistencia', `${rut} ${fecha} → ${vino ? 'vino' : 'no vino'}`);
  return pausa({ ok: true });
};

export const contrato = (pin, contratista, labor, precio) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador edita contratos.'));
  D.contratos = D.contratos.filter((c) => !(c.contratista === contratista && c.labor === labor));
  if (precio != null) D.contratos.push({ contratista, labor, precio, vigente_desde: ahora().slice(0, 10), vigente_hasta: null, creado_por: u.nombre });
  mov(u, 'contrato', `${contratista} ${labor} → ${precio == null ? 'sin precio' : '$' + precio}`);
  return pausa({ ok: true });
};
