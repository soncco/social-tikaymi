# Conectar plataformas y obtener API Keys

> Las plataformas cambian sus requisitos con frecuencia. Verifica cada paso en su documentación oficial antes de invertir tiempo. **Hoy el sistema usa CSV**; los conectores por API son la Fase 3 (contrato en `src/adapters/README.md`). Nunca pegues tokens en el código ni en el chat: solo en `.env`.

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
Requisitos previos: cuenta de Instagram **profesional** (Business o Creator) vinculada a una **Página de Facebook**, y acceso de administrador a esa Página.
1. Ve a https://developers.facebook.com y crea una cuenta de desarrollador (con tu Facebook).
2. **Mis apps → Crear app**, tipo *Business* (o el que ofrezca acceso a Instagram Graph API).
3. Añade los productos **Instagram Graph API** (y **Facebook Login for Business** si lo pide).
4. Permisos habituales para estadísticas: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `read_insights`.
5. En modo *Desarrollo*, la app funciona con tu propia cuenta (admins/testers) **sin App Review**: suficiente para leer las estadísticas de Tikaymi. Para uso de terceros o publicar necesitas *App Review* y verificación del negocio.
6. Genera un token de usuario con esos permisos (Graph API Explorer) y cámbialo por un **token de larga duración** (~60 días; hay que renovarlo). Mejor: token de sistema desde Business Manager (Usuarios del sistema).
7. Guarda en `.env`: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID`.
8. Publicación automática (más adelante): Content Publishing API de Instagram, requiere permiso `instagram_content_publish` y App Review.

## 3. TikTok
1. Crea cuenta en https://developers.tiktok.com y **Manage apps → Connect an app**.
2. Añade productos: **Login Kit** y **Display API** (lectura de tus videos y sus estadísticas básicas: vistas, likes, comentarios, compartidos). Scopes típicos: `user.info.basic`, `video.list`.
3. Completa la ficha de la app (descripción, URLs de privacidad/términos, redirect URI) y envíala a **revisión**; la aprobación puede tardar.
4. Para analítica más profunda (retención, etc.) revisa si aplica **TikTok Business/Marketing API** con una cuenta Business; puede exigir aprobación adicional.
5. Publicar por API (**Content Posting API**) exige auditoría; sin ella los videos se limitan a privados. Empieza por CSV y por publicar manualmente.
6. Guarda en `.env`: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` y los tokens que obtengas por OAuth.

## 4. YouTube (Shorts)
1. Entra a https://console.cloud.google.com y crea un proyecto (ej. `tikaymi-lab`).
2. **APIs y servicios → Biblioteca**: habilita **YouTube Data API v3** y **YouTube Analytics API**.
3. **Pantalla de consentimiento OAuth**: tipo *Externo*, agrega tu correo como usuario de prueba.
4. **Credenciales → Crear credenciales → ID de cliente OAuth** (tipo *Aplicación web* o *Escritorio*).
5. Scopes de solo lectura: `youtube.readonly` y `yt-analytics.readonly`. (Publicar requiere `youtube.upload`; los proyectos sin auditoría dejan los videos subidos como privados.)
6. Nota: en modo *Testing* los refresh tokens caducan a los 7 días; pasa la app a *En producción* para que duren. Hay una cuota diaria (10 000 unidades por defecto).
7. Guarda en `.env`: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID`.

## 5. Orden sugerido
1. Hoy: CSV de las tres plataformas + una clave de IA.
2. Meta (mayor volumen de datos y la más simple en modo desarrollo).
3. YouTube.
4. TikTok (la revisión es la más lenta).
Cuando tengas las credenciales de una plataforma, avísame y se implementa su conector siguiendo `src/adapters/README.md` (lectura de estadísticas primero; publicación automática después, siempre con aprobación humana previa).
