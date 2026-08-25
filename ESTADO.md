# ESTADO — Después de la Etapa 3 (Rival IA y pantalla de partido)

> Etapa del plan completada: **3**. Base: Etapas 0, 1 y 2 ya en `main`.

## 1. Qué se implementó

- **`generarRivalIA()` con las 4 dificultades (§31):** FÁCIL −8 / NORMAL 0 /
  DIFÍCIL +6 / ÉLITE +14, aplicado sobre la **Fuerza Efectiva** del usuario.
  La IA arma **a ciegas**: solo recibe la fuerza del usuario y la dificultad,
  nunca su XI ni su composición.
- **Nombres de equipo ficticios (§31.3):** nunca clubes reales (verificado por
  test contra los 30 clubes del dataset).
- **Pantalla de comparación previa:** mis 3 áreas + Valoración vs las del rival.
  **No se muestra el XI del rival.**
- **Pantalla de resultado:** marcador, estadísticas (§29) y MVP (§30).
- **Historial de partidos** (localStorage).
- **Semilla guardada en cada partido (§53.1):** el registro guarda semilla +
  Fuerzas Efectivas usadas + ids de ambos equipos → un partido se re-verifica
  re-simulando.
- **Sin recompensas:** jugar vs IA no otorga fichas, puntos ni sobres (§15.3 es
  la Etapa 6). No se tocó `economia`.

### Refuerzos pedidos (todos implementados)

- **Capado COMUNICADO.** Si el pool no alcanza el offset pedido (p. ej. ÉLITE
  contra un usuario ya fuerte), el rival se capa al máximo real **y se avisa en
  la pantalla de comparación**. El registro guarda el **offset REAL alcanzado**,
  no el solicitado.
- **Variedad del rival.** Dos rivales seguidos en la misma dificultad no dan el
  mismo XI: el generador elige AL AZAR dentro de la tolerancia (distintos
  clubes/perfiles, misma Fuerza Efectiva aproximada). Test: 20/20 XI distintos.
- **Perfiles no degenerados.** Ninguna de las tres áreas del rival se desvía más
  de 12 puntos de su propia media (nada de equipos 90/40/70).

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/data/nombresRival.js` | Tokens inventados + `generarNombreRival()`. Nunca clubes reales. |
| `js/core/rivalIA.js` | `generarRivalIA(fuerzaUsuario, dificultad)`: offset sobre Fuerza Efectiva, armado a ciegas con variedad, perfiles no degenerados, capado con `offsetReal`. |
| `js/core/partido.js` | **Puro/headless.** `prepararPartido` / `resolverPartido` / `jugarPartido`, `derivarEstadisticas` (§29), `calcularMVP` (§30), `reVerificar` (§53.1). |
| `js/ui/partido.js` | UI: arma el equipo del usuario desde el estado, pantallas de dificultad / comparación / resultado / historial, wiring. |
| `scripts/test-rival-ia.mjs` | Test headless: % victoria por dificultad, variedad, cero colisión de nombres, no degenerados, re-verificación por semilla. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/core/storage.js` | `cargarHistorial` / `agregarAlHistorial` (máx 50). El historial también se borra en el reset de dataset (ids viejos). |
| `js/ui/navegacion.js` | `showScreen` renderiza competir / historial. |
| `js/main.js` | `initPartido()` + botón COMPETIR. |
| `index.html` | Pantallas nuevas + botón "COMPETIR VS IA" + nav "Competir". |
| `css/estilos.css` | Estilos de las pantallas nuevas. |

## 3. Decisiones técnicas que conviene recordar

### 3.1. El offset va sobre FUERZA EFECTIVA (no Valoración)
`objetivo = fuerzaEfectivaMedia(usuario) + OFFSET[dificultad]`. Es la métrica
definida en la Etapa 2 (media de las tres áreas), consistente con lo que consume
el motor. Verificado: con 300 muestras el `offsetReal` medio da −8 / 0 / +6 y
ÉLITE queda capado cuando el usuario ya está cerca del techo del pool (~74.5).

### 3.2. `partido.js` es PURO; lo que lee el estado vive en `ui/partido.js`
`partido.js` no importa `estado`/`storage` (así corre headless en Node para el
test). `construirEquipoUsuario()` y el guardado en historial están en la capa de
UI. Mantener esa separación.

### 3.3. Nombres del rival: club ficticio, jugadores reales
El nombre de EQUIPO es inventado (§31.3/§46). Los JUGADORES del rival salen del
pool real (única fuente), así que sus nombres son reales — eso está permitido:
§46 es sobre clubes, no sobre nombres de jugador. El MVP puede ser del rival.

### 3.4. MVP: asistencias y recuperaciones quedan en 0 hasta V1.5
El motor V1 solo produce GOL / ATAJADA / ATAQUE_CORTADO. El MVP (§30) usa
**Goles ×10 y Atajadas ×3**; **Asistencias (×6) y Recuperaciones (×2) suman 0**
porque esos eventos son de V1.5/V2 y todavía no existen. **No es un olvido.**

### 3.5. Estadísticas (§29) sin tiros desviados
Se muestran Posesión, Llegadas al arco (GOL+ATAJADA) y Goles. En el modelo V1
todos los tiros son al arco (no hay tiro desviado hasta V1.5): no se inventan.

## 4. Resultados de los tests

- **% victoria (300 partidos, XI nivel 68):** FÁCIL 63% / NORMAL 36% (empates
  28%, simétrico con las derrotas) / DIFÍCIL 23% / ÉLITE 16%. Monótono y
  coherente: FÁCIL se gana, ÉLITE se pierde.
- **Variedad:** 20/20 XI distintos en NORMAL; se vieron los 30 clubes.
- **Nombres:** 206 nombres generables, **0 colisiones** con clubes reales.
- **No degenerados:** peor desvío de área observado 10.7 (≤ 12).
- **Re-verificación:** 30 partidos re-simulados con su semilla dan el mismo
  marcador.
- **Navegador:** 20 partidos seguidos sin errores; historial y registro OK; la
  comparación no muestra el XI del rival.

## 5. Advertencias para la próxima etapa (Etapa 4 — Relato)

- El relato (§28) se arma desde `registro.eventos` (cada evento ya trae
  `minuto`, `tipo`, `equipo` y, en los goles, `autor`). Mínimo **6 plantillas
  por tipo de evento**. Los goles del relato **deben coincidir con el marcador**
  (usar los eventos GOL, no re-sortear).
- El relato usa los nombres reales del XI (los `autor` son ids; mapear a nombre
  vía la colección / catálogo).
- El relato NO cambia el motor: es presentación de los eventos ya calculados.
- Recordatorio Etapa 5: las mentalidades y la matriz de contras entran por
  `fuerzaEfectiva(equipo, rival)` en `motor.js`; ahí también conviene revisar la
  deuda de balance de la Etapa 2 (empates / 5+ goles). El bucketeo por ΔFuerza
  Efectiva NO se cambia.
- No cambiar `js/data/jugadores.js` a `.json`.

## 6. Cómo testear que esta etapa quedó bien

1. `node scripts/test-rival-ia.mjs` → todos los checks en verde.
2. En el navegador: armar un XI válido, COMPETIR, elegir dificultad, ver la
   comparación (sin XI rival), COMENZAR, ver el resultado con MVP y stats.
3. En FÁCIL se gana la mayoría; en ÉLITE se pierde la mayoría.
4. El historial guarda los partidos; jugar 20 seguidos no rompe nada.
5. Contra un usuario fuerte, ÉLITE muestra el aviso de capado.
