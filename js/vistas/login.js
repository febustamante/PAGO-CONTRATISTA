// PARTE 6K · Ingreso con usuario y clave propios de la plataforma.

import { h } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { S, entrar } from '../estado.js';
import { aviso, boton } from '../ui/componentes.js';
import { icono } from '../ui/iconos.js';

export function vistaLogin() {
  const salida = h('div');
  const usuario = h('input', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Usuario', 'aria-label': 'Usuario', class: 'pin', style: 'letter-spacing:0;font-size:16px' });
  const clave = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Clave', 'aria-label': 'Clave', class: 'pin', style: 'letter-spacing:0;font-size:16px' });
  const intentar = async () => {
    salida.replaceChildren();
    if (!usuario.value.trim() || !clave.value) { salida.appendChild(aviso('err', 'Escribe tu usuario y tu clave.')); return; }
    const r = await entrar(usuario.value.trim(), clave.value);
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); clave.select(); }
  };
  clave.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });
  usuario.addEventListener('keydown', (e) => { if (e.key === 'Enter') clave.focus(); });
  setTimeout(() => usuario.focus(), 0);

  return h('div', { class: 'login' }, [
    h('div', { class: 'login-caja' }, [
      h('div', { class: 'login-marca' }, [h('span', { class: 'marca-a', text: 'Agrícola' }), h('span', { class: 'marca-b', text: 'San José' })]),
      h('h1', { text: 'Pagos a contratistas' }),
      h('p', { class: 'nota', text: 'Ingresa con tu usuario y tu clave.' }),
      h('div', { class: 'login-campo' }, [icono('personas', 18), usuario]),
      h('div', { class: 'login-campo' }, [icono('candado', 18), clave]),
      boton('Entrar', { tono: 'primario', onclick: intentar }),
      salida,
      S.error ? aviso('err', S.error) : null,
      CONFIG.DEMO ? aviso('info', 'Modo demostración: usuario admin, jefa o lectura, con la clave demo. Nada se guarda en Supabase.') : null
    ])
  ]);
}
