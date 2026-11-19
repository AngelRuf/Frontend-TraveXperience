# FrontEnd TraveXperience

## Clima, riesgos y soporte offline

El frontend consume las condiciones actuales mediante `GET /weather?lat=&lng=`. La respuesta debe incluir `data.weather` con `temperature`, `description`, `icon`, `rainProbability` y, opcionalmente, `humidity`, `feelsLike`, `fog`, `alerts`, `observedAt` y `cached`.

Para habilitar el pronóstico extendido, el backend debe exponer:

```text
GET /weather/forecast?lat=&lng=
```

La respuesta esperada es `data.forecast`, un arreglo de periodos con `date`, `minTemperature`, `maxTemperature`, `description`, `rainProbability` e `icon`.

Las zonas de riesgo requieren una fuente oficial/verificada y este endpoint:

```text
GET /risks/nearby?lat=&lng=&radius=&municipality=
```

Debe responder `data.risks` con `id`, `title`, `type`, `severity` (`bajo`, `moderado` o `alto`), `description`, `recommendation`, `municipality`, `location.coordinates` en GeoJSON `[lng, lat]`, `updatedAt`, `expiresAt`, `source` y `status`. El cliente no incluye alertas de ejemplo: si el servicio no está disponible, lo indica y no muestra datos inventados.

Workbox aplica `NetworkFirst` al clima y a las alertas; las alertas se conservan hasta 15 minutos para uso offline. La interfaz advierte que los avisos almacenados pueden estar desactualizados. La URL del backend se configura con `VITE_API_URL`.


