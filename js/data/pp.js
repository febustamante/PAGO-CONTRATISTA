// PARTE 3C · Operaciones compartidas (pp_*). Cada una valida el PIN en el servidor.
// En modo demo (?demo=1) se usa una copia en memoria que no escribe en Supabase.

import { CONFIG } from '../config.js';
import { rpc } from './api.js';
import * as demo from './ppDemo.js';

const real = {
  login: (usuario, clave) => rpc('pp_login', { p_usuario: usuario, p_clave: clave }),
  salir: (token) => rpc('pp_salir', { p_token: token }),
  cambiarClave: (token, actual, nueva) => rpc('pp_cambiar_clave', { p_token: token, p_actual: actual, p_nueva: nueva }),
  usuariosListar: (token) => rpc('pp_usuarios_listar', { p_token: token }),
  usuarioGuardar: (token, usuario, nombre, rol, clave, activo) => rpc('pp_usuario_guardar', { p_token: token, p_usuario: usuario, p_nombre: nombre, p_rol: rol, p_clave: clave || null, p_activo: activo }),
  estado: (pin) => rpc('pp_estado', { p_pin: pin }),
  proponer: (pin, items) => rpc('pp_proponer_plantas', { p_pin: pin, p_items: items }),
  aprobar: (pin, items) => rpc('pp_aprobar_plantas', { p_pin: pin, p_items: items }),
  guardarReparto: (pin, grupo, total, filas) => rpc('pp_guardar_reparto', { p_pin: pin, p_grupo: grupo, p_total: total, p_filas: filas }),
  restaurar: (pin, items) => rpc('pp_restaurar', { p_pin: pin, p_items: items }),
  liberar: (pin, items, factura, fecha, motivo) => rpc('pp_liberar', { p_pin: pin, p_items: items, p_factura: factura, p_fecha: fecha, p_motivo: motivo || null }),
  impresionLeer: (pin) => rpc('pp_impresion_leer', { p_pin: pin }),
  impresionMarcar: (pin, hasta, cantidad, reintentar, nota) => rpc('pp_impresion_marcar', { p_pin: pin, p_hasta: hasta, p_cantidad: cantidad, p_reintentar: reintentar, p_nota: nota || null }),
  configGuardar: (pin, clave, valor) => rpc('pp_config_guardar', { p_token: pin, p_clave: clave, p_valor: String(valor) }),
  inversionGuardar: (pin, cuarteles) => rpc('pp_inversion_guardar', { p_token: pin, p_cuarteles: cuarteles }),
  liquidar: (pin, contratista, tipo, ids, col50, col100, otros, fecha, factura) => rpc('pp_liquidar', { p_token: pin, p_contratista: contratista, p_tipo: tipo, p_ids: ids, p_col50: col50, p_col100: col100, p_otros: otros, p_fecha: fecha, p_factura: factura || null }),
  liquidacionAnular: (pin, id) => rpc('pp_liquidacion_anular', { p_token: pin, p_id: id }),
  presencia: (pin, clave) => rpc('pp_presencia', { p_pin: pin, p_clave: clave }),
  fijarFechaPago: (pin, ids, fecha) => rpc('pp_fijar_fecha_pago', { p_pin: pin, p_ids: ids, p_fecha: fecha }),
  deshacer: (pin, id) => rpc('pp_deshacer_liberacion', { p_pin: pin, p_id: id }),
  asistencia: (pin, rut, fecha, vino) => rpc('pp_asistencia', { p_pin: pin, p_rut: rut, p_fecha: fecha, p_vino: vino }),
  contrato: (pin, contratista, labor, precio) => rpc('pp_contrato', { p_pin: pin, p_contratista: contratista, p_labor: labor, p_precio: precio, p_desde: null, p_hasta: null })
};

export const PP = CONFIG.DEMO ? demo : real;
