---
name: clima
description: Obtiene temperatura y estado del clima actual (default La Paz, Bolivia) desde la API gratuita Open-Meteo. Usar cuando el usuario pida el clima, la temperatura o /clima [ciudad].
---

# clima

Clima actual vía Open-Meteo (sin API key, datos en tiempo real). Preferir sobre WebSearch, que devuelve datos viejos.

## Pasos

1. Ciudad = argumento del usuario; default **La Paz, Bolivia** (lat `-16.5`, lon `-68.15`).
2. Si es otra ciudad, geocodificar:
   `curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<ciudad>&count=1&language=es"` → tomar `latitude`, `longitude`, `name`, `country`.
3. Consultar clima:
   ```
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto"
   ```
4. Traducir `weather_code` (WMO):

   | Código | Estado |
   |---|---|
   | 0 | Despejado |
   | 1, 2 | Mayormente despejado / parcialmente nublado |
   | 3 | Nublado |
   | 45, 48 | Niebla |
   | 51, 53, 55 | Llovizna |
   | 56, 57 | Llovizna helada |
   | 61, 63, 65 | Lluvia |
   | 66, 67 | Lluvia helada |
   | 71, 73, 75, 77 | Nieve |
   | 80, 81, 82 | Chubascos |
   | 85, 86 | Chubascos de nieve |
   | 95 | Tormenta |
   | 96, 99 | Tormenta con granizo |

5. Responder muy conciso, en español, formato:
   `<Ciudad>: <temp>°C (sensación <ap>°C), <estado>. Humedad <h>%, viento <v> km/h, lluvia <p> mm. Mín/Máx hoy <min>/<max>°C. (<hora local>)`

## Notas

- Hora (`current.time`) es local de la ciudad (`timezone=auto`).
- Si `curl` falla (sin red), decirlo; no inventar datos.
