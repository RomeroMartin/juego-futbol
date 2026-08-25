# ESTADO — Después de la Etapa 4 (Relato del partido) 🎯 HITO: JUEGO JUGABLE

> Etapa del plan completada: **4**. Base: Etapas 0–3 ya en `main`.
> Con esta etapa el **ciclo completo** está cerrado: abrir paquete → colección →
> armar XI → competir → relato → resultado → historial.

## 1. Qué se implementó

- **Sistema de plantillas de relato (§28):** ≥6 plantillas por tipo de evento
  (GOL, ATAJADA, ATAQUE_CORTADO) + líneas de inicio y final.
- **`generarRelato(registro)`:** arma el relato con **minutos y nombres reales
  del XI**, eligiendo plantillas con un PRNG sembrado desde la semilla del
  partido (reproducible). Puro/headless.
- **Relato progresivo en la UI:** las líneas aparecen una a una (los goles
  respiran un poco más), con botón **SALTEAR** que corta y va directo al
  resultado. Flujo: comparación → COMENZAR → **relato** → resultado.
- No se tocó el motor: el relato es **pura presentación** de los eventos ya
  calculados. Los goles del relato salen de los eventos GOL, así que **coinciden
  siempre con el marcador**.

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/data/plantillasRelato.js` | Plantillas por tipo de evento (≥6 c/u) + inicio, con placeholders. |
| `js/core/relato.js` | `generarRelato(registro)` puro: reconstruye nombres desde ids, PRNG sembrado en la semilla, devuelve `[{minuto, tipo, texto, esGol}]`. |
| `scripts/test-relato.mjs` | Test headless: goles=marcador, nombres ∈ XI, ≥6 plantillas, variedad, reproducibilidad. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/ui/partido.js` | Flujo con relato progresivo (`reproducirRelato` / `terminarRelato`) entre COMENZAR y el resultado. |
| `index.html` | Pantalla `relatoScreen` + botón SALTEAR. |
| `css/estilos.css` | Estilos del relato (línea por minuto, goles resaltados, animación de aparición). |

## 3. Decisiones técnicas que conviene recordar

- **El relato es reproducible.** Usa `mulberry32(semilla ^ constante)` — un
  stream propio, separado del motor — para elegir plantillas. El mismo partido
  se relata siempre igual. No usa `Math.random()`.
- **Funciona desde el historial.** `generarRelato` reconstruye los nombres
  desde los ids guardados (catálogo `JUGADORES`), así que un partido viejo se
  puede volver a relatar sin tener los objetos jugador en memoria.
- **Los goles del relato = marcador**, por construcción (se recorren los eventos
  GOL reales; no se re-sortea nada).
- El nombre del rival en el relato es el ficticio (§31.3); los nombres de los
  jugadores son reales (del pool).

## 4. Resultados de los tests

- **Headless (`node scripts/test-relato.mjs`):** ≥6 plantillas por tipo, goles =
  marcador en 10 partidos, cada gol nombra a su autor real (∈ XI atacante), 29
  líneas de gol distintas acumuladas (variedad), relato determinista.
- **Navegador:** el relato aparece progresivamente, SALTEAR va al resultado,
  10 partidos por el flujo completo sin errores.

## 5. 🎯 HITO — PARÁ ACÁ Y JUGÁ

El juego está **jugable de punta a punta**. Según el plan (Etapa 4), este es el
momento de **jugarlo una semana y pasárselo a dos amigos**, y responder:
- ¿Dan ganas de jugar otro partido?
- ¿Dan ganas de abrir otro paquete?
- ¿Se siente injusto cuando perdés?

Si las dos primeras respuestas son "no", el problema no se arregla con torneos:
hay que revisar el diseño antes de seguir.

## 6. Pendientes conocidos (no son de esta etapa)

- **Anti-bloqueo (§13):** hoy los paquetes son 100% al azar, así que un usuario
  nuevo puede quedarse sin poder armar el XI (le faltan delanteros, la posición
  más escasa). El arreglo real —5 paquetes de bienvenida con composición
  garantizada + pity de arquero— es la **Etapa 6**. Workaround de testeo:
  `localStorage.setItem('futbolFiguritasPacks','15'); location.reload()`.
- **Deuda de balance (Etapa 2):** empates altos / cola de 5+ goles, a cerrar en
  la Etapa 5 con las mentalidades (mueven la varianza de posesiones).

## 7. Advertencias para la próxima etapa (Etapa 5 — Formaciones y mentalidades)

- Las mentalidades y la matriz de contras (§19) entran por
  `fuerzaEfectiva(equipo, rival)` en `js/core/motor.js` — el punto de entrada ya
  está preparado (hoy `frecuencia`/`calidadOcasion` = 1). **No reescribir el
  motor: solo enriquecer esa función.**
- Re-correr `scripts/simular-balance.mjs` con el sistema completo y revisar la
  deuda de empates/5+ goles. **El bucketeo por ΔFuerza Efectiva NO se cambia.**
- La mentalidad del rival NO se revela antes del partido (§19.5); el análisis
  táctico va DESPUÉS (podría sumarse al relato/resultado).
- No cambiar `js/data/jugadores.js` a `.json`.

## 8. Cómo testear que esta etapa quedó bien

1. `node scripts/test-relato.mjs` → todo en verde.
2. En el navegador: jugar un partido y ver el relato aparecer con minutos y
   nombres reales; los goles del relato coinciden con el marcador; SALTEAR
   funciona.
3. Jugar 10 partidos y verificar que el relato no se siente repetido.
