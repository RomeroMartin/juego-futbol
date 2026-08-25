# ESTADO — Después de la Etapa 2 (Motor de partido, headless)

> Etapa del plan completada: **2**. Base: Etapas 0 y 1 ya en `main`.
> Esta etapa **no produce nada visible**: es lógica pura testeada por consola.

## 1. Qué se implementó

- **PRNG con semilla `mulberry32` (§23).** Única fuente de azar del motor.
  **Cero `Math.random()`** en el motor (verificado con grep).
- **Motor de partido headless (§22–§26):** `probabilidadDuelo`, `simularPartido`
  por posesiones, `elegirGoleador` ponderado, eventos `GOL` / `ATAJADA` /
  `ATAQUE_CORTADO`.
- **`simular-balance.mjs` (§33):** simulación masiva con equipos **reales** del
  pool argentino + barrido de calibración de `D` y `FACTOR_GOL`.
- **Calibración.** Los valores de partida del documento (D=18, factor 0.42) daban
  un desastre con este pool (4.6 goles, favorito 100% a media diferencia). Se
  calibraron a **D = 70, FACTOR_GOL = 0.36**.
- Refactor de soporte: se extrajeron las **fórmulas puras de §20** a
  `js/core/formulas.js` (sin estado/DOM) para que las use tanto la UI como el
  motor y los scripts en Node.

### Estado de la tabla de §33 (con D=70 / factor=0.36, 10.000 partidos)

| Objetivo | Resultado | |
|---|---|---|
| dif 0 → 38-42% victoria | 38.1% | ✓ |
| dif 0 → 18-22% empates | **27.6%** | ✗ |
| dif +10 → 63-68% | 64.4% | ✓ |
| dif máx → ≤87% (techo) | 85.0% | ✓ |
| goles/partido 2.4-3.2 | 2.44 | ✓ |
| 0-0 en 6-10% | 8.2% | ✓ |
| 5+ goles ≤8% | **8.8%** | ✗ (rozando) |
| perfiles neutrales (sesgo) | cuotas ~49% | ✓ sin sesgo |
| reproducibilidad | idéntico byte a byte | ✓ |

**6 de 8 objetivos + los dos tests extra.** Decisión tomada con el usuario:
**aceptar 6/8 y diferir** los dos que faltan a la Etapa 5 (ver §5). No se tocó
el documento maestro.

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/package.json` | `{ "type": "module" }`. Declara que `js/` son módulos ES **para Node** (así el script de balance importa el motor REAL). No agrega npm ni dependencias; el navegador lo ignora. `scripts/` sigue en CommonJS. |
| `js/core/prng.js` | `mulberry32` (§23). Puro. |
| `js/core/formulas.js` | Fórmulas puras de §20 (PESOS, scores, calcularAtaque/Mediocampo/Defensa, calcularValoracion). Sin estado/DOM. |
| `js/config/motor.js` | Perillas de balance del motor: `D`, `FACTOR_GOL`, rango de posesiones. **Valores calibrados.** |
| `js/core/motor.js` | Motor: `probabilidadDuelo`, `fuerzaEfectiva` (punto de entrada), `fuerzaEfectivaMedia`, `elegirGoleador`, `simularPartido`. |
| `scripts/simular-balance.mjs` | Simulación §33 + barrido de calibración + perfiles + tests de reproducibilidad. `node scripts/simular-balance.mjs`. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/core/calculos.js` | Las fórmulas puras se movieron a `formulas.js`; ahora las importa y re-exporta. Los wrappers que leen el estado (`statsAtaque`, `validateTeam`, etc.) quedan igual. **Sin cambio de comportamiento** (verificado en el navegador). |

## 3. Decisiones técnicas que conviene recordar

### 3.1. Métrica de bucketeo = ΔFUERZA EFECTIVA (no Valoración) — NO cambiar
La diferencia entre equipos en la tabla de §33 se mide como **ΔFuerza Efectiva =
media de las tres áreas (ataque, mediocampo, defensa) que consume el motor**, no
como ΔValoración.

**Por qué (importante para la Etapa 5):** el motor no usa la Valoración, usa las
tres áreas por separado. Y en la Etapa 5 la **matriz de contras (§19.3)** hace
que la Fuerza Efectiva **dependa del rival** — ahí la Valoración deja de ser
predictiva **por diseño** (es el objetivo del juego). Si el bucketeo quedara
atado a la Valoración, la tabla de §33 se rompería en la Etapa 5 y no se podría
distinguir si falla el motor o la métrica. **La Etapa 5 NO debe cambiar esto por
inercia.** Hoy las dos coinciden numéricamente (no hay modificadores todavía).

### 3.2. Valores calibrados: D=70, FACTOR_GOL=0.36
El documento daba D=18 y factor 0.42 como **punto de partida** (lo dice
explícitamente). Con el pool real la Fuerza Efectiva comprime a un rango ~52–74,
así que D=18 es demasiado determinista (a Δ15 el favorito ganaba 100%). D=70 abre
la varianza y factor 0.36 baja los goles a 2.44. Están en `js/config/motor.js`.

### 3.3. `fuerzaEfectiva(equipo, equipoRival)` es el punto de entrada de la Etapa 5
Hoy devuelve las tres áreas base + `frecuencia:1` y `calidadOcasion:1` (neutros).
**Acá** la Etapa 5 inserta el modificador de formación, las mentalidades y la
matriz de contras (§20.5) — por eso `equipoRival` ya está en la firma aunque no
se use todavía. **No reescribir el motor: solo enriquecer esta función.**

### 3.4. `js/package.json` con `{"type":"module"}`
Necesario para correr el motor real desde Node (validar el balance sobre el
código que se envía, no una copia). No hay npm ni dependencias. `scripts/` no
tiene package.json, así que los scripts de la Etapa 1 (CommonJS) siguen igual.

### 3.5. Formato de "equipo" que consume el motor
```
{ id, arquero, defensores:[4], medios:[3], delanteros:[3] }
```
Objetos jugador del modelo §8. El motor calcula las áreas con `formulas.js`.

## 4. Hallazgos del pool real

- **+30 de ΔFuerza Efectiva es INALCANZABLE con equipos reales.** El máximo real
  (mejor XI vs peor XI) es **~22** (fuerzas ~74.5 vs ~52). Por eso el techo del
  87% se verifica en la banda máxima alcanzable (~20), no en +30. Ningún matchup
  real supera el 87% (máximo medido 85%).
- **El motor no tiene sesgo de perfil:** equipos ofensivos, defensivos y
  equilibrados de igual Fuerza Efectiva ganan a tasas ~iguales (cuota decisiva
  ~49% en las tres cruzas). No hay que corregir nada de eso.

## 5. Pendiente / deuda para la Etapa 5

- **Empates a dif-0 (27.6%) y 5+ goles (8.8%) no cumplen §33.** Están acoplados
  por el conteo de goles y tiran en direcciones opuestas: bajar empates pide más
  goles, lo que infla el "5+". Con **solo D y FACTOR_GOL** (las perillas de esta
  etapa) no se pueden cumplir las dos a la vez — se barrió toda la grilla. Se
  difieren a la Etapa 5, donde las **mentalidades ajustan la cantidad de
  posesiones (§24)** y aparece un tercer grado de libertad para separar la tasa
  de empate de la varianza del "5+". (27% de empates entre equipos idénticos es
  normal en fútbol real; el objetivo 18-22% de §33 es exigente para dif-0.)

## 6. Advertencias para la próxima etapa (Etapa 3 — Rival IA y pantalla)

- El motor ya está listo y **headless**. La Etapa 3 lo engancha a la UI:
  construir el objeto `equipo` (§3.5) desde el estado del jugador y llamar
  `simularPartido(equipoA, equipoB, semilla)`.
- **Generar la semilla del partido y guardarla** (§53.1): un partido se
  re-verifica desde `{ semilla, equipoA, equipoB }`.
- El rival IA (§31) y sus nombres ficticios (nunca clubes reales) son de la
  Etapa 3. El relato (§28) es Etapa 4. Nada de eso se tocó acá.
- No cambiar `js/data/jugadores.js` a `.json` (sigue siendo `.js`).

## 7. Cómo testear que esta etapa quedó bien

1. `node scripts/simular-balance.mjs` corre, imprime la tabla ANTES (D=18/0.42),
   el barrido de calibración, la tabla DESPUÉS (D=70/0.36), el análisis de
   perfiles y los tests de reproducibilidad.
2. "misma semilla → idéntico" y "semilla distinta → distinto" dan ✓.
3. El techo del 87% se respeta (máx 85%).
4. El juego en el navegador sigue funcionando igual (el motor todavía no está
   enganchado a la UI; eso es Etapa 3).
