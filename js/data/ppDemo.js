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

D.config = { precio_colacion: '4100', iva_pct: '19', retencion_pct: '20', retencion_base: 'total', 'razon:ROBINSON ZURITA': 'SOCIEDAD ATIRUZ LTDA.', 'razon:JAVIER ESCUDERO': 'AGRICOLA PAMELA PEÑA', 'razon:DANIEL MORALEDA': 'DANIEL MORALEDA', 'razon:WILFREDO SPA': 'CONTRATISTA P.R.W. SPA' };
D.inversion = ['C24', 'C25', 'C26', 'C27', 'C28', 'C29'];
D.liquidaciones = [];
export const configGuardar = (pin, clave, valor) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador cambia los ajustes.'));
  if (['precio_colacion', 'iva_pct', 'retencion_pct'].includes(clave) && !(Number(valor) >= 0)) return pausa(err('El valor debe ser un número.'));
  D.config[clave] = String(valor);
  mov(u, 'ajuste', `${clave} → ${valor}`);
  return pausa({ ok: true });
};
export const inversionGuardar = (pin, cuarteles) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador cambia los ajustes.'));
  D.inversion = [...cuarteles].sort();
  mov(u, 'ajuste', `cuarteles en inversión: ${D.inversion.join(', ') || 'ninguno'}`);
  return pausa({ ok: true });
};
export const liquidar = (pin, contratista, tipo, ids, col50, col100, otros, fecha, factura) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador genera liquidaciones.'));
  if (!fecha) return pausa(err('Falta la fecha de factura.'));
  const libs = D.liberaciones.filter((l) => ids.includes(l.id) && !l.anulada && l.contratista === contratista && !l.liquidacion_id);
  if (libs.length !== ids.length) return pausa(err('Alguna liberación ya está en una liquidación, fue anulada o es de otro contratista. Actualiza la pantalla.'));
  if (libs.some((l) => D.inversion.includes(l.cuartel) !== (tipo === 'inversion'))) return pausa(err('Hay liberaciones que no corresponden a ' + (tipo === 'inversion' ? 'inversión' : 'servicios') + '.'));
  const precio = Number(D.config.precio_colacion); const ivaPct = Number(D.config.iva_pct); const retPct = Number(D.config.retencion_pct); const base = D.config.retencion_base;
  const bruto = Math.round(libs.reduce((s, l) => s + Number(l.monto), 0));
  const desc = Math.round((col50 || 0) * precio / 2 + (col100 || 0) * precio);
  const neto = Math.round(bruto - desc - (otros || 0));
  if (neto < 0) return pausa(err('Los descuentos superan el monto liberado.'));
  const iva = Math.round(neto * ivaPct / 100); const total = neto + iva;
  const baseRet = base === 'neto' ? neto : total; const ret = Math.round(baseRet * retPct / 100);
  const id = D.liquidaciones.length + 1;
  D.liquidaciones.unshift({ id, contratista, tipo, bruto, colaciones_50: col50 || 0, colaciones_100: col100 || 0, precio_colacion: precio, descuento_colaciones: desc, otros_descuentos: otros || 0, neto, iva_pct: ivaPct, iva, total_factura: total, retencion_pct: retPct, retencion_base: base, retencion: ret, a_pago: baseRet - ret, fecha_factura: fecha, n_factura: factura || null, creado_por: u.nombre, creado_en: ahora(), anulada: false });
  libs.forEach((l) => { l.liquidacion_id = id; });
  mov(u, 'liquidacion', `${contratista} · ${tipo} · total factura $${total}`);
  return pausa({ ok: true, id, neto, iva, total_factura: total, retencion: ret, a_pago: baseRet - ret });
};
export const liquidacionAnular = (pin, id) => {
  const u = quien(pin);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador anula liquidaciones.'));
  const l = D.liquidaciones.find((x) => x.id === id && !x.anulada);
  if (!l) return pausa(err('La liquidación no existe o ya estaba anulada.'));
  l.anulada = true; D.liberaciones.forEach((x) => { if (x.liquidacion_id === id) x.liquidacion_id = null; });
  mov(u, 'anular_liquidacion', `${l.contratista} · ${l.tipo}`);
  return pausa({ ok: true });
};

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

// Usuarios de demostración: usuario admin, jefa o lectura, con la clave "demo". El código de sesión es el PIN interno.
const DEMO_LOGIN = { admin: '1111', jefa: '2222', lectura: '3333' };
D.usuarios = [
  { id: 1, usuario: 'admin', nombre: 'Administrador (demo)', rol: 'admin', activo: true, debe_cambiar: false, ultimo_ingreso: null },
  { id: 2, usuario: 'jefa', nombre: 'Jefa de campo (demo)', rol: 'jefa_campo', activo: true, debe_cambiar: false, ultimo_ingreso: null },
  { id: 3, usuario: 'lectura', nombre: 'Gerencia (demo)', rol: 'lectura', activo: true, debe_cambiar: false, ultimo_ingreso: null }
];
export const login = (usuario, clave) => {
  const pin = DEMO_LOGIN[(usuario || '').trim().toLowerCase()];
  if (!pin || clave !== 'demo') return pausa(err('Usuario o clave incorrectos.'));
  return pausa({ ok: true, token: pin, nombre: quien(pin).nombre, rol: quien(pin).rol, debe_cambiar: false });
};
export const salir = () => pausa({ ok: true });
export const cambiarClave = (token, actual, nueva) => pausa((nueva || '').length < 8 ? err('La clave nueva debe tener al menos 8 caracteres.') : { ok: true });
export const usuariosListar = (token) => {
  const u = quien(token);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador administra usuarios.'));
  return pausa({ ok: true, usuarios: D.usuarios });
};
export const usuarioGuardar = (token, usuario, nombre, rol, clave, activo) => {
  const u = quien(token);
  if (!u || u.rol !== 'admin') return pausa(err('Solo el administrador administra usuarios.'));
  const id = (usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(id)) return pausa(err('El usuario debe tener de 3 a 40 letras minúsculas, números, punto, guion o guion bajo.'));
  const i = D.usuarios.findIndex((x) => x.usuario === id);
  if (i < 0 && (clave || '').length < 8) return pausa(err('La clave temporal debe tener al menos 8 caracteres.'));
  const fila = { id: i >= 0 ? D.usuarios[i].id : D.usuarios.length + 1, usuario: id, nombre, rol, activo: activo !== false, debe_cambiar: i < 0 || !!clave, ultimo_ingreso: null };
  if (i >= 0) D.usuarios[i] = fila; else D.usuarios.push(fila);
  mov(u, 'usuario', `${i >= 0 ? 'actualizó' : 'creó'} al usuario ${id} (${rol})`);
  return pausa({ ok: true, creado: i < 0 });
};

export const estado = (pin) => {
  const u = quien(pin);
  if (!u) return pausa(err('No autorizado.'));
  return pausa({ ok: true, usuario: u, asignaciones: D.asignaciones, reparto: D.reparto, liberaciones: D.liberaciones.filter((l) => !l.anulada), asistencia: D.asistencia, contratos: D.contratos, movimientos: D.movimientos.slice(0, 200), config: D.config, inversion: D.inversion, liquidaciones: D.liquidaciones.filter((l) => !l.anulada), ahora: ahora() });
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

export const documentosListar = () => pausa({ ok: true, documentos: [], diferencias: [], trabajadores: 0 });
export const documentoConfirmar = () => pausa({ ok: true });
export const ticketResolver = () => pausa({ ok: true });
const P = (rut, nombre, c, dias, dl, hl, hi, hc, casos) => ({ rut, nombre, contratista: c, dias_asistencia: dias, dias_liq: dl, renta_liq: hl ? 400000 : null, renta_imp: hi ? 400000 : null, hay_liq: hl, hay_imp: hi, hay_contrato: hc, casos });
export const retencionesResumen = () => pausa({ ok: true,
  contratistas: [{ contratista: 'CONTRATISTA A', retenido: 323204, liberado: 0, liberado_periodo: 0 }, { contratista: 'CONTRATISTA B', retenido: 180000, liberado: 0, liberado_periodo: 0 }],
  personas: [
    P('11111111-1', 'TRABAJADOR UNO', 'CONTRATISTA A', 22, 22, true, true, true, []),
    P('22222222-2', 'TRABAJADOR DOS', 'CONTRATISTA A', 19, 22, true, true, true, [{ clase: 'dias', detalle: 'La liquidación paga 22 días y la asistencia registra 19.', estado: 'abierto' }]),
    P('33333333-3', 'TRABAJADOR TRES', 'CONTRATISTA B', 20, 20, true, true, true, []),
    P('44444444-4', 'TRABAJADOR CUATRO', 'CONTRATISTA B', 21, 21, true, true, false, [{ clase: 'sin_contrato', detalle: 'No hay contrato cargado para este trabajador.', estado: 'abierto' }])
  ], historial: [] });
export const retencionLiberar = () => pausa({ ok: false, error: 'No disponible en la demostración.' });
