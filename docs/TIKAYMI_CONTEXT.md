# Contexto de Tikaymi

## Qué es Tikaymi

Tikaymi es una agencia de viajes enfocada en diseñar y coordinar viajes por Perú. El repositorio la describe como una agencia boutique de viajes personalizados. La aplicación asociada, Tikaymi Marketing Intelligence, convierte datos de publicaciones y consultas en decisiones editoriales y borradores revisables.

## Tipo de agencia y posicionamiento

El posicionamiento declarado en `src/modules/editorial-strategy.js`, `docs/PLAN.md` y `docs/MANUAL.md` es:

- agencia boutique;
- planificación personalizada, no venta basada únicamente en precio;
- coordinación de la ruta y de la logística antes y durante el viaje;
- trato humano asociado a Deicy Ayala, quien diseña la ruta y acompaña la coordinación;
- comunicación cálida, experta, concreta y orientada a decisiones.

La prueba social solo puede utilizarse cuando existe una fuente real y aprobada. El código no autoriza a inferir testimonios a partir de likes, estrellas o publicaciones históricas.

## Destinos y servicios

El repositorio y la clasificación histórica mencionan contenido relacionado con Cusco, Machu Picchu, Valle Sagrado, Laguna Humantay, Montaña de Colores/Vinicunca, Palcoyo, Ausangate, Maras, Quillabamba, Mosoqllacta y viajes por múltiples destinos de Perú.

El material editorial declara como prioridad el paquete de cinco días por Cusco, Valle Sagrado y Machu Picchu. También se mencionan tours de un día, rutas de varios días, itinerarios adaptables y coordinación de boletos, trenes, entradas, altura y traslados cuando esos datos están aprobados.

No debe interpretarse esta lista como un catálogo completo ni como disponibilidad vigente. La información operativa debe provenir de `approved_info` o de páginas del sitio aprobadas en la copia local.

## Público objetivo

El código configura dos audiencias principales:

- viajeros internacionales que planean su primera visita a Perú y necesitan coordinar boletos, trenes, altura y traslados;
- viajeros hispanohablantes que comparan tours de un día o rutas cortas desde Cusco.

La audiencia concreta de cada pieza debe estar en su brief. No se debe asumir que una publicación sirve indistintamente para todos los mercados.

## Objetivo comercial

El objetivo comercial principal es generar consultas calificadas, cotizaciones y reservas. La aplicación considera que likes, reproducciones y seguidores son señales de atención o interacción, no conversiones comerciales por sí mismas.

La conversión requiere leads registrados y, cuando sea posible, atribuidos a una publicación mediante `post_id`, código de campaña, UTM o palabra clave de WhatsApp.

## Canales utilizados

El sistema reconoce cuatro destinos de contenido: Instagram, Facebook, TikTok y YouTube Shorts. Instagram y Facebook tienen sincronización manual por Graph API. TikTok y YouTube Shorts tienen importadores CSV; no se identificó un conector API implementado para esas redes. WhatsApp aparece como canal de contacto y atribución, no como red social sincronizada.

## Función general de la aplicación

El ciclo previsto es:

```text
Conectar/importar datos → analizar por plataforma → planificar
→ aprobar ideas → generar borradores → aprobar contenido
→ publicar manualmente → registrar consultas → aprender
```

La aplicación ofrece análisis, clasificación, planes semanales/mensuales, generación con IA, biblioteca de información aprobada, copia local del sitio, calendario editorial, enlaces rastreables, leads, alertas, cohortes, pruebas A/B e informes Markdown.

## Límites conocidos

- La aplicación no publica automáticamente en ninguna red.
- La IA no debe usar información que no esté aprobada; si falta un dato debe marcarlo como faltante.
- La copia local del sitio se actualiza manualmente desde el sitemap y requiere aprobación editorial.
- TikTok y YouTube Shorts no tienen sincronización API identificada.
- Las métricas no se suman entre plataformas distintas y `NULL` no equivale a cero.
- La atribución comercial depende de que se registren leads reales.
- El constructor de carruseles es un HTML autónomo separado de la SPA principal.
- La autenticación es de un solo administrador; no se identificaron usuarios, roles ni permisos diferenciados.
- No existe logging persistente de prompts, respuestas, costos o tokens de IA.
