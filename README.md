# Tikaymi Marketing Intelligence

Aplicación interna que convierte métricas reales de redes sociales en decisiones de contenido orientadas a consultas, cotizaciones y reservas.

La interfaz guía un ciclo simple:

> conectar datos → entender resultados → elegir una recomendación → crear → aprobar → publicar → registrar consultas → aprender

## Inicio rápido

```bash
npm install
cp .env.example .env
npm start
```

Abre `http://localhost:3000` o el puerto definido en `.env`. Ejecuta `npm test` para verificar backend, adaptadores y reglas de negocio.

## Documentación

- [Manual de uso](docs/MANUAL.md)
- [Plan y arquitectura](docs/PLAN.md)
- [Estado actual y pendientes](docs/PROGRESS.md)
- [Clasificación de publicaciones históricas](docs/CLASIFICACION-HISTORICA.md)
- [Requerimientos originales](docs/Inicial.MD)
- [Conexión de plataformas](docs/CONECTAR-PLATAFORMAS.md)
- [Contexto para Claude Code](CLAUDE.md)

Los carruseles originales y su constructor autónomo permanecen en `carruseles-claude-design/`.
