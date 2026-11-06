// PARTE 6K · Ingreso con el mismo PIN de las otras aplicaciones.

import { h } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { S, entrar, render } from '../estado.js';
import { aviso, boton } from '../ui/componentes.js';
import { icono } from '../ui/iconos.js';

export function vistaLogin() {
  const salida = h('div');
  const pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password', placeholder: 'PIN', 'aria-label': 'PIN', class: 'pin' });
  const intentar = async () => {
    salida.replaceChildren();
    if (!pin.value.trim()) { salida.appendChild(aviso('err', 'Escribe tu PIN.')); return; }
    const r = await entrar(pin.value.trim());
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); pin.select(); }
  };
  pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });
  setTimeout(() => pin.focus(), 0);

  return h('div', { class: 'login' }, [
    h('div', { class: 'login-caja' }, [
      h('div', { class: 'login-marca' }, [h('span', { class: 'marca-a', text: 'Agrícola' }), h('span', { class: 'marca-b', text: 'San José' })]),
      h('h1', { text: 'Pagos a contratistas' }),
      h('p', { class: 'nota', text: 'Ingresa con el mismo PIN de Labores.' }),
      h('div', { class: 'login-campo' }, [icono('candado', 18), pin]),
      boton('Entrar', { tono: 'primario', onclick: intentar }),
      salida,
      S.error ? aviso('err', S.error) : null,
      CONFIG.DEMO ? aviso('info', 'Modo demostración: PIN 1111 administrador, 2222 jefa de campo, 3333 solo lectura. Nada se guarda en Supabase.') : null
    ])
  ]);
}
