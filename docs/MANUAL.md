# Manual de uso — Tikaymi Marketing Intelligence

## Qué hace la aplicación

Tikaymi Marketing Intelligence ayuda a responder tres preguntas:

1. ¿Qué está pasando con nuestro contenido?
2. ¿Qué evidencia tenemos sobre intención o resultados comerciales?
3. ¿Cuál es la siguiente acción útil?

No es principalmente un generador de publicaciones. La generación aparece dentro del flujo de contenido y solo utiliza información autorizada.

## Primer ingreso

La pantalla **Inicio** muestra el estado de preparación y una única “siguiente mejor acción”. Para una instalación nueva, el orden recomendado es:

1. **Configuración → Objetivo del período:** define el resultado comercial y una meta.
2. **Configuración → Fuentes de datos:** sincroniza Meta o importa un CSV.
3. **Contenido → Publicaciones:** revisa y clasifica las publicaciones importadas. La clasificación rápida permite aplicar campos comunes a varias piezas.
4. **Consultas → Enlaces y rastreo:** crea códigos o enlaces diferentes para reconocer el origen de cada consulta.
5. **Consultas → Consultas y estados:** registra contactos y actualízalos hasta cotizado, reservado o perdido.
6. **Configuración → Biblioteca aprobada:** carga servicios, precios, testimonios, fotos y videos reales.
7. **Rendimiento:** revisa recomendaciones, comparaciones, alertas y aprendizajes.
8. **Contenido → Crear con IA:** convierte una publicación contextualizada en un borrador y apruébalo manualmente.

## Las cinco áreas

### Inicio

Resume publicaciones analizadas, consultas, cotizaciones y reservas. El estado de preparación explica qué falta, y la siguiente acción lleva directamente a la pantalla apropiada.

### Rendimiento

- **Resumen e insights:** recomendaciones con dato de origen, objetivo, CTA, métrica de éxito, limitaciones y confianza.
- **Comparaciones:** resultados por plataforma, formato, idioma, tema y CTA. Las barras usan el valor normalizado y muestran cobertura cuando existe.
- **Alertas y aprendizaje:** problemas de calidad de datos, cohortes y registro de aprendizajes.

Las métricas de plataformas distintas nunca se suman. Los likes no deciden qué publicación es mejor.

### Contenido

- **Publicaciones:** lista de piezas y clasificación masiva. Una pieza importada ya se considera `publicado`; puede estar publicada y a la vez pendiente de clasificación.
- **Crear con IA:** genera copys, guiones, prompts, carruseles, WhatsApp o propuestas A/B. Solo muestra publicaciones con el contexto mínimo completo.
- **Calendario editorial:** flujo borrador → revisión → aprobado → programado → publicado → analizado. La aprobación es humana.

El JSON de carruseles ya no se edita manualmente en la UI. Un carrusel generado y aprobado puede descargarse para el constructor que vive en `carruseles-claude-design/`.

### Consultas

- **Consultas y estados:** registra fuente, viaje, viajeros, notas y avance comercial.
- **Enlaces y rastreo:** genera UTM y enlaces de WhatsApp con un código de campaña. El mismo código debe registrarse cuando llega el contacto.

Sin consultas atribuidas, la aplicación declara explícitamente que no puede medir conversión.

### Configuración

Agrupa objetivo del período, sincronización/importación, biblioteca aprobada y proveedor de IA. Las claves de APIs solo viven en `.env`.

## Estados y clasificación

El estado editorial y la calidad de clasificación son conceptos diferentes:

- Una publicación sincronizada desde una red social entra como `publicado` porque ya existe en la plataforma.
- Puede conservar campos `sin_clasificar`; aun así participa en el resumen por plataforma.
- Las piezas históricas clasificadas por criterio editorial muestran **Inferida**. En **Editar** se explica el motivo; no equivale al brief original aprobado.
- `mixto` documenta copys antiguos en español e inglés, pero no está permitido al crear una pieza nueva.
- Para compararla por objetivo, audiencia, tema o CTA, completa esos campos mediante clasificación rápida o edición individual.
- Un contenido nuevo creado dentro de la app comienza como `borrador`.

## Instalación y respaldo

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
npm start
npm test
```

Configura al menos `ADMIN_PASSWORD` y `SESSION_SECRET`. Para generar contenido agrega una de `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `DEEPSEEK_API_KEY` y selecciona el proveedor en Configuración.

Los datos viven en `data/tikaymi.db`; respaldar ese archivo es suficiente. Consulta [CONECTAR-PLATAFORMAS.md](CONECTAR-PLATAFORMAS.md) para las credenciales de Meta.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| El Inicio indica publicaciones pendientes | Ve a Contenido y usa clasificación rápida. |
| No hay conversión | Registra consultas con el mismo código usado en el CTA. |
| Generar responde 422 | Falta información autorizada en Biblioteca aprobada. |
| Generar responde 503 | Falta la clave del proveedor activo en `.env`. |
| Un CSV no importa | Revisa plataforma y encabezados; cada adaptador reconoce formatos concretos. |
| Meta dejó de sincronizar | Revisa el aviso de expiración y ejecuta `npm run meta:renew`. |
