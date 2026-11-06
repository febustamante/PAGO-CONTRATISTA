// PARTE 3C · Operaciones compartidas (pp_*). Cada una valida el PIN en el servidor.
// En modo demo (?demo=1) se usa una copia en memoria que no escribe en Supabase.

import { CONFIG } from '../config.js';
import { rpc } from './api.js';
import * as demo from './ppDemo.js';

const real = {
  login: (pin) => rpc('pp_login', { p_pin: pin }),
  estado: (pin) => rpc('pp_estado', { p_pin: pin }),
  proponer: (pin, items) => rpc('pp_proponer_plantas', { p_pin: pin, p_items: items }),
  aprobar: (pin, items) => rpc('pp_aprobar_plantas', { p_pin: pin, p_items: items }),
  guardarReparto: (pin, grupo, total, filas) => rpc('pp_guardar_reparto', { p_pin: pin, p_grupo: grupo, p_total: total, p_filas: filas }),
  restaurar: (pin, items) => rpc('pp_restaurar', { p_pin: pin, p_items: items }),
  liberar: (pin, items, factura, fecha, motivo) => rpc('pp_liberar', { p_pin: pin, p_items: items, p_factura: factura, p_fecha: fecha, p_motivo: motivo || null }),
  impresionLeer: (pin) => rpc('pp_impresion_leer', { p_pin: pin }),
  impresionMarcar: (pin, hasta, cantidad, reintentar, nota) => rpc('pp_impresion_marcar', { p_pin: pin, p_hasta: hasta, p_cantidad: cantidad, p_reintentar: reintentar, p_nota: nota || null }),
  presencia: (pin, clave) => rpc('pp_presencia', { p_pin: pin, p_clave: clave }),
  fijarFechaPago: (pin, ids, fecha) => rpc('pp_fijar_fecha_pago', { p_pin: pin, p_ids: ids, p_fecha: fecha }),
  deshacer: (pin, id) => rpc('pp_deshacer_liberacion', { p_pin: pin, p_id: id }),
  asistencia: (pin, rut, fecha, vino) => rpc('pp_asistencia', { p_pin: pin, p_rut: rut, p_fecha: fecha, p_vino: vino }),
  contrato: (pin, contratista, labor, precio) => rpc('pp_contrato', { p_pin: pin, p_contratista: contratista, p_labor: labor, p_precio: precio, p_desde: null, p_hasta: null })
};

export const PP = CONFIG.DEMO ? demo : real;
