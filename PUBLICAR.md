# Cómo publicar la plataforma (GitHub + hosting)

La plataforma son solo archivos: no se compila nada. Se guarda en GitHub (privado) y se publica con Cloudflare Pages o Netlify.

## 0. Antes de empezar
- Copia esta carpeta a un lugar tuyo (por ejemplo Documentos). La carpeta temporal de la sesión se borra si se borra la sesión.
- Revisa que dentro **no** haya `client_secret.json`, `token.json`, carpetas `pdfs` ni tu script de impresión. El archivo `.gitignore` ya los excluye, pero conviene mirar.
- Esta carpeta lleva la clave **pública** de Supabase en `js/config.js`. Es normal. Las claves secretas (clave de servicio, token de Kizeo, credenciales de Gmail) no van aquí nunca.

## 1. Subir a GitHub (repositorio privado)
1. En github.com: **New repository** → nombre `pagos-contratistas` → marcar **Private** → **Create repository**. No agregues README ni .gitignore (ya vienen).
2. Opción simple, sin instalar nada: en la página del repositorio, **uploading an existing file**, arrastra **el contenido** de la carpeta (no la carpeta misma) y pulsa **Commit changes**.
3. Opción con Git instalado, desde la carpeta:
   ```
   git init
   git add .
   git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pagos-contratistas.git
   git push -u origin main
   ```

## 2. Publicar (elige uno)
**Cloudflare Pages**: Workers & Pages → Create → Pages → Connect to Git → elige el repositorio → *Framework preset: None*, *Build command: vacío*, *Output directory: `/`* → Deploy.
**Netlify**: Add new site → Import from Git → elige el repositorio → *Build command: vacío*, *Publish directory: `.`* → Deploy.

Ambos entregan una dirección con https. El archivo `_headers` evita que los buscadores la indexen y que el navegador use versiones viejas.

## 3. Probar
1. Abre la dirección + `?demo=1` (PIN 1111): debe cargar los datos y funcionar sin escribir nada.
2. Abre la dirección normal y entra con tu PIN real. Prueba, con algo de bajo riesgo: asignar plantas, liberar un grupo, ponerle fecha de pago y deshacerlo.

## 4. Actualizar
Cada vez que cambie algo, sube los archivos nuevos al repositorio y el hosting se actualiza solo en uno o dos minutos.

## 5. Seguridad (importante)
- Mientras la tabla `usuarios_sj` siga siendo legible con la clave pública, quien la lea puede ver los PIN. Recomendado: darle a la plataforma una clave propia, cifrada.
- No compartas la dirección fuera del equipo.
- Nunca subas `client_secret.json`, `token.json`, tokens de Kizeo ni la clave de servicio de Supabase.
