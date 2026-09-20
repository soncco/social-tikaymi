# Adaptadores de plataforma

Este directorio contiene hoy **sólo adaptadores de importación CSV** (`meta.js`, `tiktok.js`,
`youtube.js`): convierten una exportación manual de cada plataforma en filas de `posts` + `metrics`.

Este documento define el **contrato** que deberá cumplir un futuro conector oficial por API.
Nada de lo descrito aquí está implementado: es la especificación para cuando existan las
credenciales y la aprobación de cada app (Inicial.MD §11, §14 Fase 3).

## Contrato

Cada adaptador exporta, además de `parse(csvText)`, dos funciones opcionales:

```js
// Lee estadísticas de publicaciones ya publicadas. Sólo lectura.
async function fetchStats(ids, { credentials, since, until, signal }) → {
  ok: boolean,
  items: [{ external_id, captured_at, reach, impressions, plays, retention,
            completed_plays, likes, comments, shares, saves,
            profile_visits, clicks, conversations }],
  missing: [external_id],     // ids que la API no devolvió
  errors: [{ external_id, code, message }],
  rate: { remaining, reset_at } // si la plataforma lo informa
}

// Publica un contenido ya APROBADO por una persona. Nunca se llama automáticamente.
async function publish(post, { credentials, dryRun, signal }) → {
  ok: boolean, external_id, url, published_at, errors: [...]
}
```

### Reglas obligatorias

1. **Sin invención de datos.** Una métrica que la API no devuelve se guarda como `NULL`,
   nunca como `0` ni como proxy de otra (§4). `retention` se guarda tal cual la define cada
   plataforma y no se compara entre plataformas distintas.
2. **`external_id` es la clave.** `UNIQUE(plataforma, external_id)` en `posts` evita duplicados;
   `fetchStats` nunca crea posts: sólo actualiza `metrics` de posts ya registrados.
3. **Aprobación humana previa.** `publish()` sólo puede invocarse sobre un post en estado
   `aprobado` o `programado` con contenido generado en estado `aprobado` (§8, §11). Ningún
   proceso de fondo puede llamarla: hoy la programación es sólo un recordatorio iCal
   (`GET /api/schedule.ics`).
4. **Idempotencia.** Reintentar `publish()` con el mismo post no debe crear dos publicaciones:
   comprobar antes `posts.external_id`.
5. **Errores explícitos.** Un fallo devuelve `ok: false` con código y mensaje; jamás se
   silencia ni se sustituye por datos vacíos.

## Credenciales (sólo por variables de entorno)

Nunca en la base de datos, nunca en el código, nunca en el repositorio. Declarar en `.env`
(y documentar en `.env.example`):

| Plataforma | Variables |
|---|---|
| Meta (Instagram/Facebook) | `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN` |
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID` |

Si falta una credencial, el adaptador devuelve `ok: false` con código `sin_credenciales`
(equivalente al 503 que ya usa la generación con IA) y **no** intenta la llamada.

Los tokens caducan: cada adaptador debe renovar con su `refresh_token` y, si no puede,
reportar `credenciales_caducadas` para que una persona reautorice la app.

## Límites de API

- **Respetar el rate limit publicado de cada plataforma** y el `retry-after` que devuelva.
  Backoff exponencial, máximo 3 reintentos; nunca un bucle de reintento infinito.
- Pedir estadísticas **en lotes** (`fetchStats(ids)` recibe una lista) y **como mucho una vez
  al día** por publicación: las métricas de las plataformas se consolidan con retraso y
  consultarlas más seguido gasta cuota sin añadir información.
- Las ventanas de datos son limitadas (las estadísticas antiguas dejan de estar disponibles):
  guardar siempre lo importado en `metrics` en lugar de depender de la API como fuente viva.
- Cada plataforma impone además límites de publicación diaria y políticas de contenido;
  `publish()` debe verificarlos antes de enviar y fallar de forma explícita.

## Cuando se implementen

1. Añadir las funciones al adaptador correspondiente respetando el contrato de arriba.
2. Exponerlas sólo tras aprobación humana explícita en la UI (nunca como tarea automática).
3. Añadir tests con respuestas simuladas (`fetch` inyectado), igual que en `content.js`.
