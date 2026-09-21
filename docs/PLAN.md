# Plan y arquitectura — Tikaymi Marketing Intelligence

Base funcional: `docs/Inicial.MD`. Estado ejecutado: `docs/PROGRESS.md`. Instrucciones para agentes: `CLAUDE.md`.

## Norte del producto

La aplicación no es un generador genérico de publicaciones. Su función es convertir datos reales de contenido en decisiones que puedan producir consultas, cotizaciones y reservas. La IA interviene después de entender el objetivo y el contexto disponible.

El ciclo principal es:

```text
Conectar datos → Entender resultados → Elegir recomendación
→ Crear contenido → Aprobar → Publicar → Registrar consultas
→ Aprender y repetir
```

## Arquitectura de experiencia

La navegación principal tiene cinco áreas:

| Área | Responsabilidad |
|---|---|
| Inicio | Estado, preparación y siguiente mejor acción. |
| Rendimiento | Insights, comparaciones, alertas, cohortes y aprendizajes. |
| Contenido | Publicaciones, clasificación, generación y calendario editorial. |
| Consultas | Leads, estados comerciales, enlaces y atribución. |
| Configuración | Objetivo, fuentes de datos, biblioteca aprobada e IA. |

Funciones técnicas como UTM, importación, modelos LLM y exportación de carrusel no deben competir en la navegación principal. Aparecen dentro del flujo que las necesita.

## Decisiones de UX obligatorias

- Inicio siempre debe explicar qué hacer a continuación.
- “Publicado” y “clasificado” son dimensiones independientes.
- El contenido importado desde estadísticas entra como `publicado`.
- Las publicaciones incompletas se pueden clasificar progresivamente y en grupo.
- Los nombres de implementación (`campaign_code`, LLM, JSON) se traducen a lenguaje de trabajo.
- Toda recomendación muestra evidencia, objetivo, CTA, métrica, limitación y confianza.
- La aprobación de contenido sigue siendo humana.
- El diseño debe funcionar en escritorio y móvil sin build frontend.

## Stack

Node.js 20, Express 5, better-sqlite3, cookie firmada y frontend HTML/CSS/JS vanilla. No existe pipeline de build. Tests con `node --test`.

## Arquitectura técnica

- `src/db/`: esquema y migraciones idempotentes.
- `src/adapters/`: normalización independiente por plataforma.
- `src/modules/sync.js` e `importer.js`: entrada de publicaciones y métricas.
- `src/modules/analysis.js`: confianza, rankings y recomendaciones.
- `src/modules/content.js` y `llm.js`: generación restringida a información aprobada.
- `src/modules/attribution.js`: UTM, WhatsApp y códigos.
- `src/modules/abtests.js`, `alerts.js`, `cohorts.js`, `digest.js`: análisis complementario.
- `public/`: SPA accesible sin framework.

## Modelo de datos relevante

- `objectives`: objetivo comercial por período.
- `posts`: publicación, contexto de marketing y estado editorial.
- `metrics`: snapshot normalizado; `NULL` significa dato no disponible, nunca cero.
- `leads`: consulta y avance comercial; `post_id` permite atribución.
- `approved_info` y `assets`: fuente de verdad para generación.
- `generated`: contenido generado; siempre nace en revisión.
- `learnings` y `ab_tests`: conocimiento acumulado y experimentos.
- `post_classification_audit`: procedencia y motivo de la clasificación retrospectiva. No convierte una inferencia en un dato observado.

No crear una columna de “estado de clasificación”. Se deriva de los campos obligatorios que todavía contienen `sin_clasificar`. Esto evita mezclarla con `posts.estado`.

## Reglas estadísticas que no se deben romper

- Nunca sumar métricas entre plataformas diferentes.
- Nunca convertir `NULL` en cero.
- Nunca declarar ganador por likes.
- No atribuir una consulta sin evidencia.
- Con pocos datos, presentar hipótesis y no conclusiones definitivas.
- Analizar contenido histórico publicado aunque todavía falten metadatos; excluirlo solo de los agrupamientos que requieren esos metadatos.
- Separar idiomas históricos `mixto`/`sin_clasificar` del análisis comparativo `es`/`en`; la generación nueva sigue siendo monolingüe.

## Próximas etapas

1. Validación visual y de comprensión con una persona usuaria real.
2. Mejorar clasificación asistida para sugerir no solo tema, sino objetivo, audiencia, etapa y CTA.
3. Añadir filtros de período y detalle individual de publicación.
4. Integrar TikTok y YouTube mediante API oficial cuando existan credenciales.
5. Añadir publicación oficial únicamente después de App Review y manteniendo aprobación humana.
