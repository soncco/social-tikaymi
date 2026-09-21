# Contexto de trabajo para Claude Code

Lee este archivo antes de modificar el proyecto. Después lee, en este orden:

1. `docs/Inicial.MD` — contrato de producto y restricciones.
2. `docs/PLAN.md` — arquitectura técnica y de experiencia vigente.
3. `docs/PROGRESS.md` — implementación real y pendientes.
4. `docs/MANUAL.md` — flujo que ve la persona usuaria.
5. `docs/CLASIFICACION-HISTORICA.md` — criterio aplicado a los posts pasados y límites de evidencia.

## Qué es este producto

Tikaymi Marketing Intelligence es una aplicación interna para una agencia de viajes de Cusco. Relaciona contenido publicado con atención, intención y resultados comerciales. No es un generador genérico de posts.

La promesa de la interfaz es: **mostrar qué ocurre, explicar qué significa y proponer la siguiente acción útil**.

## Norte y ciclo principal

```text
Conectar datos → Entender resultados → Elegir recomendación
→ Crear contenido → Aprobar → Publicar → Registrar consultas
→ Aprender y repetir
```

Antes de añadir una pantalla o enlace a la navegación, identifica en qué paso de este ciclo vive. La navegación principal solo tiene Inicio, Rendimiento, Contenido, Consultas y Configuración.

## Invariantes de negocio

- Nunca sumar métricas de plataformas distintas.
- `NULL` significa dato no disponible; nunca convertirlo automáticamente en cero.
- Nunca declarar éxito o ganador por likes.
- Sin lead atribuido no existe evidencia de conversión.
- Toda conclusión lleva confianza: datos insuficientes, señal inicial, patrón probable o confirmado.
- La IA solo usa `approved_info.autorizado_publicar=1` y recursos reales.
- Todo contenido generado nace en `revision` y requiere aprobación humana.
- Una sola lengua por pieza.
- No inventar precios, disponibilidad, horarios, servicios, reseñas, testimonios ni estadísticas.

## Distinción crítica: publicación vs. clasificación

`posts.estado` es el estado editorial. Una publicación descargada de Instagram, Facebook o un CSV de estadísticas ya existe públicamente y debe entrar como `publicado`.

La clasificación se deriva de campos que siguen en `sin_clasificar`. Una pieza puede ser `publicado` y estar pendiente de contexto. Participa de inmediato en análisis por plataforma, pero no en comparaciones que requieren tema, objetivo o CTA.

No reviertas esta decisión. `src/db/index.js` contiene la migración idempotente `migration_ux_v2` para datos históricos.

## UX actual

- `public/index.html`: shell, sidebar y acceso.
- `public/app.css`: sistema visual responsive sin dependencias.
- `public/app.js`: SPA con cinco vistas principales y subvistas.
- Inicio calcula el estado de preparación y elige una siguiente acción.
- Contenido permite clasificación parcial masiva mediante `PUT /api/posts/bulk`.
- `post_classification_audit` registra que 44 piezas se clasificaron retrospectivamente desde Meta. No presentar objetivos inferidos como el brief histórico de Tikaymi.
- `idioma='mixto'` y `idioma='sin_clasificar'` son válidos solo para describir piezas históricas; las publicaciones nuevas y el contenido generado deben ser `es` o `en`.
- Las métricas del análisis son objetos `{ valor, n_total, n_datos, cobertura }`; la UI debe leer `valor`, no tratar el objeto como número.
- Las funciones técnicas deben mantenerse dentro de su flujo: enlaces en Consultas; sincronización, biblioteca y LLM en Configuración; carrusel dentro de generación.

## Stack y comandos

```bash
npm start       # servidor Express; el puerto puede venir de .env
npm test        # suite node:test
node --check public/app.js
```

No hay bundler, TypeScript ni framework frontend. No introduzcas uno sin una decisión explícita: la simplicidad operativa es intencional.

## Datos locales y secretos

- Base: `data/tikaymi.db`.
- Secretos: `.env`, nunca imprimirlos ni versionarlos.
- Meta real está conectado; `npm run meta:renew` reemplaza únicamente la línea del token sin mostrarlo.
- No borres ni reconstruyas la base para probar. Usa `open(':memory:')` en tests.

Estado conocido al 2026-09-21: 25 publicaciones Instagram + 25 Facebook; 49 históricas analizables; 44 clasificadas con auditoría; nueve con algún campo pendiente (seis sin texto y tres sin CTA); 0 leads; biblioteca aprobada vacía.

## Verificación esperada

Toda modificación de lógica debe incluir o actualizar pruebas. Antes de entregar:

1. Ejecuta `node --check public/app.js` si tocaste frontend.
2. Ejecuta `npm test` (los tests HTTP necesitan permiso para abrir puertos locales en algunos sandboxes).
3. Revisa `docs/PROGRESS.md` y `docs/MANUAL.md` si cambió el comportamiento visible.
4. No declares la UI validada visualmente si solo se verificó por código o API.

Los TODO actuales están en `docs/PROGRESS.md` y no deben presentarse como funciones terminadas.
