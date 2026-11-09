# Pagos a contratistas · Agrícola San José (software de varias personas)

Aplicación web que usa los datos que ya están en Supabase (Labores y pagos facturados) y guarda lo nuevo en tablas propias `pp_*`.
Varias personas pueden usarla a la vez: lo que una hace lo ven las otras (se sincroniza cada 20 segundos o con "Actualizar").

## Cómo abrirla
- **En un computador de la oficina:** doble clic en `Iniciar servidor.bat` y abrir `http://localhost:8080`.
  Otras personas de la misma red entran con `http://IP-DE-ESE-COMPUTADOR:8080`.
- **En internet:** subir esta carpeta tal cual a cualquier hosting de archivos estáticos (Netlify, Cloudflare Pages, GitHub Pages o el servidor de la empresa). No necesita compilar nada.
- **Probar sin escribir nada:** agregar `?demo=1` al final de la dirección. PIN 1111 administrador, 2222 jefa de campo, 3333 solo lectura. Lee los datos reales, pero lo que se hace queda solo en memoria.

No se abre con doble clic en `index.html` (los navegadores bloquean los módulos de archivos locales).

## Pantallas
| Pantalla | Para qué |
|---|---|
| **Inicio** | Resumen, pendiente por contratista, avance por etapa y tus tareas según el rol. |
| **Pagos** | Tres pestañas: **Por liberar**, **Liberados** y **Con fecha de pago**. |
| **Plantas** | Dos pestañas: **Por cuartel y contratista** y **Por persona**. |
| **Asistencia** | Vino o no vino cada día del mes, con totales por contratista y por día. |
| **Alertas** | Ya pagado, otro precio, compartidos, plantas propuestas, precio fuera de contrato. |
| **Otros campos** | Control de plantas de Rulo, Nuevo Sendero y Valdés, y elección de qué liberar. |
| **Contratos** | Precios observados y precio de contrato. |
| **Informe** | "Pendiente de pago y casos a revisar", para PDF y Excel. |
| **Impresión** | Solo administrador. Lista los folios aprobados (sin los de Agrícola San José) que vienen después del último impreso, entrega el comando o un `.bat` para tu script `imprimir_folios.py` y recuerda sola hasta qué folio se imprimió. Admite folios con error para reintentar y corregir el punto de partida. Parte desde el folio 8113. Las credenciales de Google y el script se quedan en tu computador. |
| **Historial** | Quién hizo qué y cuándo. |

Atajos: `/` busca en Por liberar; `Alt+1…9` cambia de pantalla.

## Flujo
1. **Plantas:** se asigna cuántas plantas se pagan en cada cuartel y labor (también cuando hay un solo contratista). La jefa de campo deja una *propuesta*; el administrador la aprueba. En la pantalla Por liberar también se pueden escribir las plantas directamente en la fila. Las plantas se reparten por igual entre personas-día (ajustable en **Por persona**).
2. **Por liberar:** cada fila muestra su **etapa** (Sin plantas → Plantas asignadas → Liberado → Pagado), una franja de color por alerta (rojo no pagar, azul compartido, ámbar revisar) y, al pasar el mouse, el motivo. Al marcar filas aparece una barra fija con el total y el botón **Liberar y enviar a Pagos**; hay una ventana de confirmación y un aviso con **Deshacer**.
3. **Liberados:** lo liberado por contratista, con precio, precio +50% y monto (plantas × precio × 1,5; ej. 100 plantas a $150 = $22.500).
4. **Último paso:** una sola **fecha de pago** para todo lo liberado. Pasa a **Con fecha de pago**. Con fecha de pago no se puede deshacer sin quitar antes la fecha.

## Quién puede hacer qué
El ingreso es con el mismo PIN de las otras apps (`usuarios_sj`). El rol sale de `rol_labores`:
| Rol | Quién | Puede |
|---|---|---|
| Administrador | `admin` | todo |
| Jefa de campo | `supervisor` con campo "El Cerrillo" | solo **Asignar plantas** (por cuartel y contratista), con los casos en rojo (ya pagado antes) a la vista para ir revisando |
| Solo lectura | `gerencia` y otros supervisores | ver Inicio, Pagos, Asistencia, Alertas, Otros campos, Contratos, Informe e Historial |
Sin `rol_labores` no hay acceso. Cada acción queda en el Historial con el nombre de quien la hizo.

## Trabajo en equipo
- **Quién está aquí:** si otra persona está mirando o editando el mismo cuartel y labor, aparece "Nombre está aquí".
- **Aviso al administrador** cuando la jefa de campo envía una propuesta, y una insignia en el menú.
- **Historial por grupo** al abrir una fila en Por liberar.
- Si dos personas liberan el mismo grupo, la segunda recibe un aviso y no se duplica.

## De dónde sale cada dato
| Dato | Origen |
|---|---|
| Pendientes y pagos anteriores | `pagos_facturados` (sin fecha de factura = pendiente) |
| Personas y días | `folios_detalle` |
| Plantas y costo de otros campos | `folios_labores` |
| Plantas por cuartel | `cuarteles_plantas` |
| Plantas asignadas, repartos, liberaciones, fecha de pago, asistencia corregida, contratos, presencia, historial | `pp_*` (nuevas) |

La plataforma **no escribe** en `pagos_facturados`: las liberaciones quedan en `pp_liberaciones`.

## Reglas (ajustables en `js/config.js`)
- Precio por planta: menor a $5.000. Desde $5.000 es **pago por jornada**: la cantidad son las jornadas de Labores y el monto = precio × jornadas × 1,5 (ej. $30.000 × 0,5 × 1,5 = $22.500). Esos grupos se liberan como los demás, pero no llevan plantas, ni alerta de pago anterior, ni límite de cuartel.
- Misma vuelta: 7 días o menos entre el último trabajo pagado y el inicio del pendiente.
- Monto = plantas × precio × 1,5 (verificado contra `folios_labores.costo`).
- Exceso: más de 2% sobre las plantas del cuartel.
- Labores con sufijo " 2" se tratan como la labor base.
- Otros campos: solo contratistas; el personal propio de Agrícola San José no se libera.

## Estructura del código (por partes)
```
index.html            punto de entrada
css/                  tokens (colores) · base (estructura) · componentes · impresion
js/config.js          1  ajustes
js/core/dom.js        2A utilidades de pantalla, formatos, nombres y Excel
js/core/reglas.js     2B reglas del negocio (funciones puras)
js/data/api.js        3A conexión con Supabase
js/data/lectura.js    3B lectura de datos existentes
js/data/pp.js         3C operaciones compartidas (con el PIN)
js/data/ppDemo.js     3D copia en memoria para el modo demo
js/ui/                4  iconos y componentes (modal, avisos, etapa, esqueletos)
js/estado.js          5  sesión, datos, presencia y sincronización
js/vistas/            6  una pantalla por archivo
js/main.js            7  rutas, atajos y estructura general
sql/                  01 tablas · 02 funciones · 03 fecha de pago · 04 presencia · 05 impresión (ya aplicadas)
```

## Seguridad
- Las tablas `pp_*` no se pueden leer ni escribir directamente con la clave pública (se comprobó: acceso denegado). Todo pasa por funciones que validan el PIN en el servidor. 20 PIN malos en 5 minutos bloquean el ingreso por un rato.
- **Límite importante:** la tabla `usuarios_sj` de las otras apps es legible con la clave pública, incluidos los PIN. Mientras eso siga así, quien la lea puede ingresar a esta plataforma con el PIN de otra persona. Cerrar esa tabla exige cambiar las otras apps; conviene hacerlo.
- `petroleo_movs` y `reglas_operacion` siguen sin RLS (otras apps).

## Pendiente de verificar
- Las funciones de escritura se probaron en el modo demo y, contra Supabase, solo con PIN inválido. Falta probarlas con un PIN real (proponer, aprobar, liberar, fecha de pago, presencia).
- Avisos por correo o WhatsApp (hoy el aviso es dentro de la aplicación).
- Vigencia de contratos, facturas con IVA y colaciones, y marcar la factura en `pagos_facturados`.
