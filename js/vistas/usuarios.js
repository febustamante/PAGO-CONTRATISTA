// PARTE 6Q · Usuarios de la plataforma (solo administrador). Independiente de Labores.

import { h } from '../core/dom.js';
import { fechaLarga, titulo } from '../core/dom.js';
import { ROLES } from '../config.js';
import { PP } from '../data/pp.js';
import { S, render } from '../estado.js';
import { aviso, boton, tarjeta, tabla, celda, campo, seleccion, toast, confirmar, esqueleto, pildora } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

const U = () => (S.ui.usuarios = S.ui.usuarios || { lista: null, cargando: false, error: null, mostrada: null });

async function cargar() {
  const u = U();
  u.cargando = true; u.error = null; render();
  const r = await PP.usuariosListar(S.sesion.pin);
  if (r.ok) u.lista = r.usuarios; else u.error = r.error;
  u.cargando = false; render();
}

// Clave temporal legible: sin letras que se confunden (0/O, 1/l/I).
function claveTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join('') + '!';
}

export function vistaUsuarios() {
  const u = U();
  const raiz = h('div');
  raiz.appendChild(encabezado('Usuarios', 'Quién puede entrar a la plataforma y con qué perfil. Es independiente de Labores y de las otras aplicaciones.'));
  if (!u.lista && !u.cargando && !u.error) cargar();
  if (u.cargando || !u.lista) { raiz.appendChild(u.error ? aviso('err', u.error) : esqueleto(5)); return raiz; }

  if (u.mostrada) {
    raiz.appendChild(h('div', { class: 'aviso ok' }, [
      h('b', { text: `Clave temporal de ${u.mostrada.nombre}: ` }), h('code', { text: u.mostrada.clave, style: 'font-size:15px;user-select:all' }),
      h('div', { class: 'sub', style: 'color:inherit', text: `Usuario: ${u.mostrada.usuario}. Entrégasela por un medio privado: tendrá que cambiarla al ingresar. Esta clave no se vuelve a mostrar.` }),
      boton('Listo, ya la anoté', { onclick: () => { u.mostrada = null; render(); } })
    ]));
  }

  // Crear usuario
  const usuario = h('input', { placeholder: 'ej. sergio', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Usuario' });
  const nombre = h('input', { placeholder: 'Nombre completo', 'aria-label': 'Nombre' });
  const rol = seleccion([['jefa_campo', ROLES.jefa_campo], ['lectura', ROLES.lectura], ['admin', ROLES.admin]], 'jefa_campo', () => {});
  const salida = h('div');
  const crear = async () => {
    salida.replaceChildren();
    const clave = claveTemporal();
    const r = await PP.usuarioGuardar(S.sesion.pin, usuario.value.trim().toLowerCase(), nombre.value.trim(), rol.value, clave, true);
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); return; }
    u.mostrada = { usuario: usuario.value.trim().toLowerCase(), nombre: nombre.value.trim(), clave };
    u.lista = null; toast('Usuario creado.'); render();
  };
  raiz.appendChild(tarjeta('Crear usuario', [
    h('div', { class: 'barra' }, [campo('Usuario', usuario), campo('Nombre', nombre), campo('Perfil', rol), boton('Crear con clave temporal', { tono: 'primario', onclick: crear })]),
    h('p', { class: 'nota', text: 'La plataforma genera una clave temporal y te la muestra una sola vez. La persona la cambia en su primer ingreso.' }),
    salida
  ]));

  const guardar = async (x, cambios, mensaje) => {
    const r = await PP.usuarioGuardar(S.sesion.pin, x.usuario, cambios.nombre ?? x.nombre, cambios.rol ?? x.rol, cambios.clave || null, cambios.activo ?? x.activo);
    if (!r.ok) { toast(r.error, 'err'); return false; }
    toast(mensaje); u.lista = null; render(); return true;
  };

  const filas = u.lista.map((x) => {
    const esYo = titulo(x.nombre) === titulo(S.sesion.nombre);
    const perfil = seleccion([['jefa_campo', ROLES.jefa_campo], ['lectura', ROLES.lectura], ['admin', ROLES.admin]], x.rol, async (v) => { if (v !== x.rol) await guardar(x, { rol: v }, 'Perfil actualizado.'); });
    return h('tr', {}, [
      celda(h('b', { text: x.usuario })), celda(titulo(x.nombre), { clase: 'sin-corte' }), celda(perfil),
      celda(x.activo ? (x.debe_cambiar ? pildora('Clave temporal', 'ambar', 'Aún no cambia su clave inicial') : pildora('Activo', 'verde')) : pildora('Desactivado', 'gris')),
      celda(x.ultimo_ingreso ? fechaLarga(x.ultimo_ingreso) : 'nunca', { clase: 'sin-corte' }),
      celda([
        boton('Nueva clave temporal', { onclick: async () => {
          const ok = await confirmar({ titulo: `Nueva clave temporal para ${titulo(x.nombre)}`, mensaje: 'Se cierra su sesión y tendrá que cambiar la clave al ingresar.', ok: 'Generar', tono: '' });
          if (!ok) return;
          const clave = claveTemporal();
          if (await guardar(x, { clave }, 'Clave temporal generada.')) { U().mostrada = { usuario: x.usuario, nombre: x.nombre, clave }; render(); }
        } }),
        !esYo ? boton(x.activo ? 'Desactivar' : 'Activar', { onclick: async () => {
          const ok = await confirmar({ titulo: `${x.activo ? 'Desactivar' : 'Activar'} a ${titulo(x.nombre)}`, mensaje: x.activo ? 'No podrá ingresar hasta que lo actives otra vez.' : 'Podrá ingresar de nuevo con su clave.', ok: x.activo ? 'Desactivar' : 'Activar', tono: '' });
          if (ok) await guardar(x, { activo: !x.activo }, x.activo ? 'Usuario desactivado.' : 'Usuario activado.');
        } }) : null
      ])
    ]);
  });
  raiz.appendChild(tarjeta('Usuarios', tabla([{ t: 'Usuario' }, { t: 'Nombre' }, { t: 'Perfil' }, { t: 'Estado' }, { t: 'Último ingreso' }, { t: '' }], filas, { vacio: 'No hay usuarios.' })));
  return raiz;
}
