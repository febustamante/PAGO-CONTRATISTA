// PARTE 1 · Configuración. Todo lo que se puede ajustar sin tocar la lógica.
// La clave "publishable" es publica por diseño: va en el navegador. La seguridad real está en
// las funciones pp_* del servidor, que validan el PIN en cada llamada.

const parametros = new URLSearchParams(location.search);

export const CONFIG = {
  SUPABASE_URL: 'https://cmfvnluppvqyqwpfjrbs.supabase.co',
  SUPABASE_KEY: 'sb_publishable_TvfWNvrb2AitDfwvW5YNww_QsR_gjD1',

  // Modo demostración (?demo=1): lee los datos reales pero guarda todo en memoria, sin escribir en Supabase.
  DEMO: parametros.get('demo') === '1',

  EXTERNOS: ['ROBINSON ZURITA', 'JAVIER ESCUDERO', 'DANIEL MORALEDA', 'WILFREDO SPA', 'SERV LARA SPA'],
  UMBRAL_PRECIO: 5000,          // desde este valor es jornada o tarifa fija, no precio por planta
  DIAS_MISMA_VUELTA: 7,         // 7 días o menos entre pagos = misma vuelta (no pagar)
  FACTOR_CONTRATISTA: 1.5,      // monto = plantas × precio × 1,5 (verificado contra folios_labores.costo)
  TOLERANCIA_EXCESO: 1.02,      // 2% sobre las plantas del cuartel
  POLL_MS: 20000,               // cada cuánto se sincronizan los cambios de otras personas
  CAMPO_JEFA: 'El Cerrillo'
};

export const ROLES = {
  admin: 'Administrador',
  jefa_campo: 'Jefa de campo',
  lectura: 'Solo lectura'
};
