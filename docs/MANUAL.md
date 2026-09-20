# Manual de uso — Tikaymi Marketing Intelligence & Content Lab

## 1. Iniciar el sistema
Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env      # luego edita .env
npm start                 # http://localhost:3000
```

En `.env` define como mínimo:
- `ADMIN_PASSWORD`: la contraseña con la que entras.
- `SESSION_SECRET`: un texto largo y aleatorio (p. ej. `openssl rand -hex 32`).
- Una clave de IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `DEEPSEEK_API_KEY`) para generar contenido. En la pestaña **IA** eliges qué proveedor y modelo se usan; el sistema solo guarda esa elección, nunca las claves (ver `docs/CONECTAR-PLATAFORMAS.md`).

`.env` está en `.gitignore`: nunca se sube al repositorio. Los datos viven en `data/tikaymi.db` (haz copia de ese archivo para respaldar). `npm test` ejecuta las pruebas.

## 2. Flujo de trabajo recomendado
Sigue este orden; el sistema está pensado para que no se genere ni analice nada sin objetivo.

1. **Objetivos**: registra el objetivo de negocio del período (consulta calificada, cotización, reserva…).
2. **Info aprobada**: carga servicios, precios, testimonios verificables y fotos que la IA puede usar. Marca "autorizado" solo lo que puede usarse públicamente. Sin esto la IA no genera nada.
3. **Publicaciones**: crea cada pieza con objetivo de negocio, de marketing y de contenido, audiencia, etapa del embudo, CTA, métrica principal, plataforma e idioma. Si falta uno, no se guarda.
4. **Enlaces**: genera el enlace con UTM y el enlace de WhatsApp con el código de campaña (ej. `HUMANTAY`). Úsalo en la bio, descripción o CTA de la publicación.
5. **Publicar** manualmente (por ahora) en la red social. En **Calendario** mueve la pieza por los estados: borrador → revisión → aprobado (pide confirmación humana) → programado → publicado → analizado.
6. **Importar CSV**: exporta las estadísticas de la plataforma (ver guía) y súbelas en "Importar CSV". Las publicaciones nuevas llegan como *sin clasificar*: complétales los objetivos en "Publicaciones". El botón **Clasificar temas** del Panel asigna el tema por palabras clave del título.
7. **Leads**: cada vez que llegue una consulta, regístrala con su código de campaña (así se atribuye a la publicación). Cambia su estado: nuevo → contactado → calificado → cotizado → reservado / perdido / sin respuesta.
8. **Panel**: revisa las métricas separadas en atención, intención y negocio, la conversión y las recomendaciones. Cada conclusión indica su nivel de confianza; con pocos datos verás "datos insuficientes" o hipótesis, no recomendaciones definitivas. Descarga el informe (.md) desde el Panel.
9. **Generar**: elige una publicación, el tipo (copy, guion, prompt para Google Flow, carrusel, WhatsApp, A/B) y el idioma (es o en; nunca mezclados). El resultado queda en *revisión*: **Aprobar** o **Rechazar** manualmente.
10. **Aprendizajes**: anota qué funcionó y qué no; alimenta la siguiente decisión.

## 3. Carruseles
- Los archivos originales de Claude Design están en `carruseles-claude-design/`. El editor es `Tikaymi - Constructor de Carruseles.html`: ábrelo con doble clic en el navegador (no requiere servidor).
- Desde el sistema: pestaña **Carrusel** (o "Descargar JSON" en un carrusel generado y aprobado) descarga un `.json`. En el constructor usa **Cargar JSON** para abrirlo, ajusta las fotos (URLs públicas con CORS, p. ej. Cloudinary) y exporta PNG/JPG.
- Regla: 3 a 5 diapositivas, un solo idioma por pieza.

## 4. Otras funciones
- **Pruebas A/B** (API `/api/abtests`): compara dos publicaciones de la misma plataforma cambiando una variable; decide por consultas/intención, nunca por likes.
- **Alertas y cohortes** en el Panel: publicaciones sin métricas, leads sin contactar, período sin objetivo.
- **Resumen semanal**: `GET /api/digest.md`. Para automatizarlo, llámalo desde `cron` (ver cabecera de `src/modules/digest.js`).
- **Programación**: `GET /api/schedule.ics` exporta un calendario iCal para recordatorios manuales. La publicación automática aún no existe.

## 5. Problemas frecuentes
| Síntoma | Causa |
|---|---|
| Error al arrancar "Define ADMIN_PASSWORD y SESSION_SECRET" | Falta `.env` |
| Generar devuelve 503 | Falta la clave del proveedor activo (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `DEEPSEEK_API_KEY`), o cambia de proveedor en la pestaña IA |
| Generar devuelve 422 | No hay información aprobada y autorizada |
| Generar devuelve 400 | La publicación no tiene objetivo/audiencia/etapa/CTA/métrica/idioma |
| El CSV no importa | Columnas no reconocidas; abre un issue con los encabezados reales para ajustar el adaptador |
| Una publicación importada no puede avanzar de estado | Aún está "sin clasificar": complétale los objetivos |
