# Instrucciones: leer escaneos y cargarlos a la plataforma

Esto es para quien tenga Claude y los papeles escaneados (liquidaciones de sueldo, planillas de imposiciones y contratos).
Claude lee los PDF, guarda lo leído en un archivo y un programa lo sube a la plataforma, donde se compara con la asistencia.

## Antes de empezar
- Tener un usuario **administrador** de la plataforma (se crea en Usuarios) y haber cambiado la clave temporal.
- Python instalado. No se necesita instalar nada más.
- Los escaneos se quedan en tu computador. A la plataforma solo se suben los datos leídos, nunca el archivo.
- **No pegues claves ni datos personales en el repositorio de GitHub.** Los escaneos y los JSON no se suben (están excluidos).

## Paso 1. Dejar los escaneos en una carpeta
Un PDF por tipo y mes, por ejemplo `Escaneos/2026-10/liquidaciones.pdf`, `imposiciones.pdf`, `contratos.pdf`.
Escanear derecho, sin sombras, a 200–300 ppp.

## Paso 2. Pedirle a Claude que los lea
Abrir Claude en la carpeta del proyecto y decir: "Lee los PDF de la carpeta Escaneos/2026-10 y genera resultado.json según INSTRUCCIONES_ESCANEOS.md".

Claude debe producir una lista JSON. Cada documento tiene esta forma:

```json
{
  "tipo": "liquidacion",
  "rut": "12345678-9",
  "nombre": "NOMBRE DEL TRABAJADOR",
  "contratista": "NOMBRE DEL CONTRATISTA",
  "periodo": "2026-10",
  "archivo": "liquidaciones.pdf página 3",
  "datos": { "dias_trabajados": 22, "renta_imponible": 520000, "sueldo_liquido": 450000 }
}
```

Reglas para Claude:
- `tipo`: `liquidacion`, `imposicion` o `contrato`.
- `rut`: sin puntos y con guion (`12345678-9`). Si no se lee con seguridad, no inventarlo: dejar el documento fuera y avisar.
- `contratista`: el nombre de la carpeta del contratista en mayúsculas, igual a como aparece en Pagos (por ejemplo `ROBINSON ZURITA`). Es obligatorio, porque con él se libera la retención.
- `periodo`: mes de la remuneración, `AAAA-MM`.
- `datos` para **liquidacion**: `dias_trabajados`, `renta_imponible`, `sueldo_liquido`, `descuentos_previsionales` (si aparecen).
- `datos` para **imposicion**: `renta_imponible`, `afp`, `salud`, `cesantia`.
- `datos` para **contrato**: `fecha_inicio`, `fecha_termino` (o `indefinido`), `sueldo_base`, `cargo`. El `periodo` es el mes de la fecha de inicio.
- No inventar números. Si un dato no se lee, omitirlo.
- Revisar que cada número sea el del papel y no el de otra línea.

## Paso 3. Subir
```
python cargar_escaneos.py resultado.json
```
Pide el usuario y la clave de la plataforma. Si algo falla, el programa lo dice y no sube nada de ese lote.

## Paso 4. Revisar en la plataforma
Entrar a **Control → Documentos**, elegir el mes. Ahí aparecen:
- Los casos que no cuadran: días pagados distintos de la asistencia, renta imponible distinta entre liquidación e imposiciones, trabajadores sin imposición, sin liquidación o sin contrato.
- Una fila por trabajador con cuatro revisiones (asistencia, liquidación, imposiciones y contrato) y un resultado OK, Revisar o Incompleto.

Cada caso se marca como resuelto con una nota. Todo queda registrado en el Historial.

En la pestaña **Liberar retención** se ve, por contratista, lo retenido, lo ya liberado y si sus documentos están en orden. Con todo en OK se libera la retención; si quedan casos abiertos solo se puede liberar con una excepción y una nota. Cada contratista tiene un **Detalle a liberar** imprimible.
