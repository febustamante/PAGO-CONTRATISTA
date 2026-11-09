// PARTE 6P · Cambio de clave. Es obligatorio la primera vez, cuando la clave la definió el administrador.

import { h } from '../core/dom.js';
import { PP } from '../data/pp.js';
import { S, claveCambiada, salir } from '../estado.js';
import { aviso, boton, tarjeta, campo, toast } from '../ui/componentes.js';
import { encabezado } from './_comun.js';

export function vistaClave({ obligatorio = false } = {}) {
  const salida = h('div');
  const actual = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Clave actual' });
  const nueva = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Clave nueva' });
  const repetir = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Repetir la clave nueva' });

  const guardar = async () => {
    salida.replaceChildren();
    if (!actual.value) { salida.appendChild(aviso('err', 'Escribe tu clave actual.')); return; }
    if (nueva.value.length < 8) { salida.appendChild(aviso('err', 'La clave nueva debe tener al menos 8 caracteres.')); return; }
    if (nueva.value !== repetir.value) { salida.appendChild(aviso('err', 'Las dos claves nuevas no son iguales.')); return; }
    const r = await PP.cambiarClave(S.sesion.pin, actual.value, nueva.value);
    if (!r.ok) { salida.appendChild(aviso('err', r.error)); return; }
    toast('Clave cambiada.');
    if (obligatorio) await claveCambiada(); else { actual.value = ''; nueva.value = ''; repetir.value = ''; }
  };

  const cuerpo = h('div', {}, [
    obligatorio ? aviso('warn', 'Tu clave inicial es temporal. Elige una clave propia para continuar.') : null,
    h('div', { class: 'barra' }, [campo('Clave actual', actual), campo('Clave nueva (8 caracteres o más)', nueva), campo('Repite la clave nueva', repetir)]),
    h('div', { class: 'barra' }, [boton('Guardar clave', { tono: 'primario', onclick: guardar }), obligatorio ? boton('Salir', { onclick: salir }) : null]),
    salida
  ]);
  if (obligatorio) return h('div', { class: 'login' }, [h('div', { class: 'login-caja', style: 'max-width:460px' }, [h('h1', { text: 'Cambiar clave' }), cuerpo])]);
  return h('div', {}, [encabezado('Mi clave', 'Cambia la clave con la que ingresas a la plataforma.'), tarjeta(null, cuerpo)]);
}
