# Conectar plataformas y obtener API Keys

> Las plataformas cambian sus requisitos con frecuencia. Verifica cada paso en su documentación oficial antes de invertir tiempo. **Hoy el sistema usa CSV para las plataformas sin conector API implementado; Meta ya tiene sincronización API de solo lectura.** TikTok y YouTube API son trabajo futuro (contrato orientativo en `src/adapters/README.md`). Nunca pegues tokens en el código ni en el chat: solo en `.env`.

## 0. Empieza YA con CSV (sin API keys)
Es el camino más rápido y no requiere aprobaciones.
- **Instagram / Facebook**: Meta Business Suite → Estadísticas (Insights) → Exportar datos (CSV).
- **TikTok**: TikTok Studio → Analytics → descargar datos.
- **YouTube Shorts**: YouTube Studio → Analytics → Modo avanzado → Exportar (CSV), filtrando por Shorts.
Luego súbelos en la pestaña "Importar CSV" eligiendo la plataforma. Si algún CSV no se reconoce, pásame los encabezados y ajusto el adaptador.

## 1. Proveedores de IA (generación de contenido)
Basta con **uno**. Puedes configurar varios y alternar desde la pestaña **IA** sin reiniciar. Las claves van solo en `.env`.

**Anthropic (Claude)**
1. https://console.anthropic.com → configura facturación/créditos.
2. **API Keys → Create Key** (se muestra una sola vez) → `ANTHROPIC_API_KEY=...`

**OpenAI**
1. https://platform.openai.com → configura facturación (Billing).
2. **API keys → Create new secret key** → `OPENAI_API_KEY=...`

**DeepSeek**
1. https://platform.deepseek.com → recarga saldo.
2. **API keys → Create API key** → `DEEPSEEK_API_KEY=...`

Los modelos por defecto (`claude-sonnet-5`, `gpt-4o`, `deepseek-chat`) se pueden cambiar en la pestaña **IA** o con `ANTHROPIC_MODEL` / `OPENAI_MODEL` / `DEEPSEEK_MODEL`; verifica los nombres vigentes en la documentación de cada proveedor. Después reinicia con `npm start` y prueba en **Generar** (necesitas antes información aprobada). Nota: la calidad del resultado (idioma, formato JSON de carruseles, respeto de las reglas de no inventar datos) puede variar entre proveedores; revisa siempre antes de aprobar.

## 2. Meta (Instagram + Facebook)

**Requisitos previos (verifícalos antes de empezar)**
- Cuenta de Instagram **profesional** (Business o Creator): en Instagram → Configuración → Tipo de cuenta y herramientas → *Cambiar a cuenta profesional*.
- Una **Página de Facebook** de Tikaymi vinculada a esa cuenta de Instagram: en la Página → Configuración → *Cuentas vinculadas* → Instagram.
- Tu usuario de Facebook es **administrador** de esa Página.

Meta ofrece dos formas de acceso. Usa la **A** (con Facebook Login) porque también cubre las estadísticas de la Página de Facebook.

**Paso 1 · Crear la cuenta de desarrollador y la app**
1. Entra a https://developers.facebook.com e inicia sesión → *Comenzar* y acepta los términos.
2. **Mis apps → Crear app**. Elige el caso de uso que hable de Instagram/gestionar mensajes y contenido (los nombres cambian; si te pide tipo, elige **Empresa/Business**).
3. Nombre: `Tikaymi Lab`. Correo de contacto: el tuyo.
4. En el panel de la app → **Agregar productos**: añade *Instagram* (API de Instagram) y *Inicio de sesión con Facebook para empresas*.

**Paso 2 · Permisos** (Facebook Login): `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `read_insights`. (Con *Instagram Login* los equivalentes se llaman `instagram_business_basic` e `instagram_business_manage_insights`.)
- Mientras la app esté en modo **Desarrollo** funciona con las cuentas que tengan rol en la app (tú como admin) **sin App Review**. Es suficiente para leer los datos de Tikaymi.

**Paso 3 · Obtener el token**
1. Abre https://developers.facebook.com/tools/explorer → elige tu app → *Generar token de acceso de usuario* → marca los permisos del paso 2 → acepta y selecciona la Página y la cuenta de Instagram cuando lo pida.
2. Cambia por un token de **larga duración** (~60 días):
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
       ?grant_type=fb_exchange_token&client_id=APP_ID
       &client_secret=APP_SECRET&fb_exchange_token=TOKEN_CORTO
   ```
   (Ajusta `v21.0` a la versión vigente. Ejecútalo desde tu terminal con `curl`; no lo pegues en sitios ajenos.)
   El App ID y App Secret están en **Configuración de la app → Básica**.
3. Consigue tus IDs:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token=TOKEN      → id de la Página (PAGE_ID)
   GET https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN
                                                                            → IG_USER_ID
   ```

**Paso 4 · Probar que ves datos**
```
GET https://graph.facebook.com/v21.0/IG_USER_ID/media?fields=id,caption,media_type,timestamp,like_count,comments_count&access_token=TOKEN
GET https://graph.facebook.com/v21.0/ID_DE_UN_MEDIA/insights?metric=reach,saved,shares&access_token=TOKEN
```
- Endpoint de estadísticas por publicación: `GET /<MEDIA_ID>/insights`. La documentación oficial cita `engagement`, `impressions` y `reach` como ejemplo.
- **Los nombres de métricas cambian por versión.** La siguiente observación es un registro externo de una prueba realizada el 2026-09-20 con la API v23.0; no es una garantía reproducible solo desde este repositorio: en un carrusel y un Reel de @tikaymi se reportaron `reach`, `views`, `saved`, `shares`, `likes`, `comments`, `total_interactions` y `profile_visits`. Se reportó que `impressions` (retirada desde la v22) y `plays` (sustituida por `views`) no funcionaban. El código actual guarda `views` como reproducciones en Reels/video y como impresiones en el resto; `retention` queda `NULL`.
- Si `me/accounts` devuelve lista vacía no es un error: los IDs de la Página y de Instagram salen de `debug_token` → `granular_scopes[].target_ids`.
- **Con el modo Desarrollo no hace falta enviar la app a revisión** (la pantalla "Solicitudes de revisión de apps" se ignora) mientras solo uses tu propia cuenta.

**Paso 5 · Guardar en `.env`** (nunca en código): `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`. Anota la fecha: el token de larga duración caduca (~60 días) y hay que renovarlo. Ojo: cada variable va en su propia línea (si el archivo no termina en salto de línea, al añadir otra con `>>` se pega a la anterior). Alternativa sin caducidad práctica: **usuario del sistema** en Business Manager (business.facebook.com → Configuración → Usuarios → Usuarios del sistema → generar token con los permisos).

**Publicación automática (más adelante)**: requiere `instagram_content_publish` y **App Review** más verificación del negocio; no la necesitas para leer estadísticas.

**Renovar el token**: `npm run meta:renew` (con el token aún vigente) lo cambia por uno nuevo y reescribe solo `META_ACCESS_TOKEN` en `.env`, sin mostrarlo. Si ya caducó, genera uno nuevo en el Graph API Explorer y repite el paso 3.

**Facebook (Página)**: no necesita permisos extra. Leer sus publicaciones exige un token de *Página*, que el conector pide solo con `GET /{PAGE_ID}?fields=access_token` a partir del token de usuario (basta con `META_PAGE_ID` en `.env`). El código solicita `post_media_view`, `post_total_media_view_unique` y `post_clicks`, además de reacciones/comentarios/compartidos como campos del post. Las afirmaciones de compatibilidad de métricas con una versión concreta de Graph API requieren verificación externa. Los compartidos ausentes en la respuesta cuentan como 0 según el adaptador actual.

**Sincronizar desde la app**: `POST /api/sync/instagram` (o `/facebook`) (acción manual, solo lectura) trae las últimas publicaciones y sus métricas. Las nuevas entran como `publicado` con campos de clasificación `sin_clasificar`; las existentes conservan sus objetivos y no se pisan con valores `NULL` los datos que vengan del CSV. Consulta cada publicación como mucho una vez cada 20 h (`{"force":true}` lo salta) y la respuesta incluye el estado del token y un aviso si caduca en 7 días o menos.

**Lo que aporta Meta al sistema**: alcance, interacciones, guardados, compartidos y, según la métrica disponible, reproducciones. Las **visitas al perfil, clics y conversaciones** suelen venir mejor por CSV de Business Suite.

## 3. TikTok (preparación futura; no implementado en la aplicación)

Esta sección documenta una posible conexión futura. El repositorio actual solo implementa importación CSV mediante `src/adapters/tiktok.js`; no implementa OAuth, renovación de tokens ni llamadas a TikTok Display API.

**Qué API te sirve y su límite real (verificado en la documentación oficial):** la *Display API* solo devuelve por video: `id`, `title`, `video_description`, `create_time`, `duration`, `share_url`, `view_count`, `like_count`, `comment_count`, `share_count`. **No entrega retención, alcance, guardados ni visitas al perfil.** Solo lista videos **públicos**. Para esas métricas seguirás usando el **CSV de TikTok Studio**. La API te ahorra el CSV solo para vistas/likes/comentarios/compartidos.

**Paso 1 · Cuenta y app**
1. https://developers.tiktok.com → *Log in* con la cuenta de TikTok de Tikaymi → completa el registro de desarrollador.
2. **Manage apps → Connect an app** (o *Create app*). Rellena: nombre, icono, categoría, descripción de para qué usas los datos (analítica propia de Tikaymi), **URL de política de privacidad** y **términos** (puedes usar páginas de tikaymi.com).
3. En la app → **Add products**: agrega **Login Kit** y **Display API**.
4. En *Login Kit* configura la **Redirect URI**. Para pruebas locales usa una URL que controles, p. ej. `https://tikaymi.com/callback` (o el servicio que te permita recibir el `code`).
5. En *Scopes* solicita `user.info.basic` y `video.list`.
6. **Envía la app a revisión** (la documentación exige aprobación de Login Kit y de la Display API). Anota el **Client Key** y el **Client Secret** (Configuración de la app).

**Paso 2 · Autorizar y obtener tokens** (tras la aprobación, o con tu cuenta en modo sandbox si el portal lo ofrece)
1. Abre en el navegador (una sola línea):
   `https://www.tiktok.com/v2/auth/authorize/?client_key=CLIENT_KEY&scope=user.info.basic,video.list&response_type=code&redirect_uri=REDIRECT_URI&state=abc123`
2. Acepta con la cuenta de Tikaymi; te redirige a tu URI con `?code=...`. Copia el `code`.
3. Cámbialo por tokens:
   ```
   POST https://open.tiktokapis.com/v2/oauth/token/
   Content-Type: application/x-www-form-urlencoded
   client_key=...&client_secret=...&code=CODE&grant_type=authorization_code&redirect_uri=REDIRECT_URI
   ```
   Devuelve `access_token` (dura **24 h**) y `refresh_token` (dura **1 año**), más `open_id`. El conector debe renovar el access token con el refresh token automáticamente.

**Paso 3 · Probar**
```
POST https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,view_count,like_count,comment_count,share_count
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
{"max_count": 20}
```
Máximo 20 videos por página; pagina con `cursor` mientras `has_more` sea `true`.

**Paso 4 · Guardar en `.env`**: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.

**Publicar por API (Content Posting API)**: exige auditoría adicional; hasta pasarla los videos publicados quedan restringidos. No es prioridad.

## 4. YouTube (Shorts) (preparación futura; no implementado en la aplicación)

Esta sección documenta una posible conexión futura. El repositorio actual solo implementa importación CSV mediante `src/adapters/youtube.js`; no implementa OAuth, renovación de tokens ni llamadas a YouTube Data/Analytics API.

**Paso 1 · Proyecto y APIs**
1. https://console.cloud.google.com → selector de proyecto → **Proyecto nuevo** → `tikaymi-lab` → Crear.
2. Menú ☰ → **APIs y servicios → Biblioteca**. Busca y pulsa **Habilitar** en: **YouTube Data API v3** y **YouTube Analytics API**.

**Paso 2 · Pantalla de consentimiento**
1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o *Google Auth Platform*) → tipo **Externo** → nombre de la app `Tikaymi Lab`, correo de soporte y de contacto.
2. **Usuarios de prueba**: agrega el Gmail que administra el canal de Tikaymi.
3. Importante: en estado **Testing** el refresh token **caduca a los 7 días** (confirmado en la documentación de Google). Para que dure, pasa la app a **En producción** (los scopes de solo lectura mostrarán una advertencia de "app no verificada"; puedes continuar como usuario propietario).

**Paso 3 · Credenciales OAuth**
1. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación web**.
2. En *URI de redireccionamiento autorizados* agrega `https://developers.google.com/oauthplayground`.
3. Guarda el **Client ID** y el **Client Secret**.

**Paso 4 · Obtener el refresh token (OAuth Playground)**
1. Abre https://developers.google.com/oauthplayground → engranaje ⚙ → marca **Use your own OAuth credentials** → pega Client ID y Secret.
2. En el paso 1 escribe estos scopes y pulsa *Authorize APIs*:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
3. Inicia sesión con la cuenta dueña del canal (elige el canal de Tikaymi si tienes varios) y acepta.
4. Paso 2 → **Exchange authorization code for tokens** → copia el **Refresh token**.

**Paso 5 · Probar**
1. Con un access token (Playground o renovado con el refresh token):
   ```
   GET https://youtubeanalytics.googleapis.com/v2/reports
       ?ids=channel==MINE&startDate=2026-08-01&endDate=2026-09-20
       &metrics=views,averageViewPercentage,likes,comments,shares,estimatedMinutesWatched
       &dimensions=video&sort=-views&maxResults=50
   Authorization: Bearer ACCESS_TOKEN
   ```
2. Los títulos y el formato Short se obtienen con la Data API (`videos.list`) usando los IDs devueltos. `averageViewPercentage` es la retención que el sistema guarda en `retention` (% promedio visto; no comparable con otras plataformas).

**Paso 6 · Guardar en `.env`**: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`. Cuota por defecto de la Data API: 10 000 unidades/día (leer estadísticas cuesta muy poco). Subir videos por API (`youtube.upload`) en proyectos sin auditoría deja los videos como privados.

## 5. Cómo verificar que todo quedó bien
Marca cada casilla antes de pedirme el conector:
- [ ] Puedo ejecutar la prueba (curl) de la plataforma y veo datos de **mis** publicaciones.
- [ ] Tengo guardadas en `.env` todas las variables de su sección y `.env` **no** está en git (`git status` no lo muestra).
- [ ] Anoté cuándo caduca cada token (Meta ~60 días; TikTok access 24 h / refresh 1 año; YouTube: refresh 7 días si la app sigue en Testing).

**Seguridad:** no me envíes tokens ni secretos por el chat; ponlos tú directamente en `.env`. Dime únicamente qué pruebas funcionaron y qué error viste (sin el token).

## 6. Orden recomendado
1. Hoy: CSV de las tres plataformas + una clave de IA (secciones 0 y 1).
2. YouTube (la más directa y con retención real por video).
3. Meta (más datos, pero con más pasos y métricas por verificar).
4. TikTok (revisión lenta y datos limitados; el CSV sigue siendo necesario para retención).
Cuando una prueba funcione, dímelo y se implementa su conector siguiendo `src/adapters/README.md`.

## 7. Fuentes consultadas
- TikTok Display API: https://developers.tiktok.com/doc/display-api-get-started · https://developers.tiktok.com/doc/tiktok-api-v2-video-list · https://developers.tiktok.com/doc/tiktok-api-v2-video-object
- YouTube Analytics: https://developers.google.com/youtube/analytics/reference/reports/query
- Google OAuth (caducidad en Testing): https://developers.google.com/identity/protocols/oauth2
- Instagram Insights: https://developers.facebook.com/documentation/instagram-platform/insights
