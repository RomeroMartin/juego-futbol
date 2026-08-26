# ESTADO — Después de la Etapa 5 (Formaciones y mentalidades) 🧠 EL JUEGO SE VUELVE ESTRATÉGICO

> Etapa del plan completada: **5**. Base: Etapas 0–4 ya en `main`.
> Acá se cumple el principio rector: **tener la mejor valoración media NO
> garantiza la victoria**. La formación, la mentalidad y el azar controlado
> mueven el resultado de verdad (medido: la mentalidad correcta vale ~±10 puntos
> de Fuerza Efectiva; un equipo 10 puntos inferior con la mentalidad correcta
> gana el **42%** de los partidos vs 17% con táctica neutra).

## 1. Qué se implementó

- **Las 6 formaciones de §17** en `config/formaciones.js` (slots, amplitud,
  densidadCentral, mod), con `validarXI(xi, formacion)` genérico (§17.1),
  generación de slots por formación y `equipoVacioDeFormacion()`.
- **Selector de formación** en el constructor: la cancha se **rearma dinámicamente**
  según la formación. Al cambiar de formación se **revalida** el XI y, si el
  cambio dejaría jugadores afuera, **pide confirmación ANTES** de aplicarlo
  (con opción de cancelar).
- **Mentalidades (§19)** en `config/mentalidades.js`: mods ofensivos/defensivos,
  **matriz de contras** (§19.3, una sola matriz) y **compatibilidad estructural**
  formación↔mentalidad (§19.4). Selectores de mentalidad ofensiva y defensiva.
- **`fuerzaEfectiva(equipo, rival)` completa (§20.5)** en `core/motor.js`, en el
  orden del doc: base → mod formación → mods mentalidad → matriz de contras (al
  ataque) → compatibilidad estructural. El motor NO se reescribió; solo se
  enriqueció esta función (+ dos perillas de varianza en config, ver §4).
- **La mentalidad del rival NO se revela antes del partido (§19.5).** La
  comparación previa muestra formación + stats base, nunca la mentalidad.
- **Análisis táctico post-partido** (`ui/partido.js`): revela la mentalidad rival
  y explica qué pasó con el % real de la matriz (ej. "Tu EQUIPO RÁPIDO encontró
  espacios contra su PRESIÓN ALTA. (+X% ataque)").
- **La IA elige mentalidad según dificultad (§31.2), a ciegas de la tuya**
  (`core/rivalIA.js`): FÁCIL neutra; NORMAL uniforme; DIFÍCIL descarta combos
  estructuralmente malos; ÉLITE coherente con su formación. La IA ahora también
  **elige formación** y arma el XI con los cupos de esa formación.
- **Re-balance completo** (§33) con el sistema activo + medición de la ventaja
  táctica (swing en puntos de FE, uso óptimo por mentalidad/formación, remontada).

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/config/mentalidades.js` | Mods ofensivos/defensivos, matriz de contras (única, escalada por `MATRIZ_ESCALA`), compatibilidad estructural (§19.4), defaults. |
| `scripts/test-formaciones-mentalidades.mjs` | Test headless: validarXI por formación, mod de formación, matriz aplicada una sola vez, `fuerzaEquipo` no revela mentalidad, la mentalidad correcta gana más, reproducibilidad con táctica. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/config/formaciones.js` | Las 6 formaciones; `slotsDeFormacion`, `equipoVacioDeFormacion`, `validarXI` genérico. **`3-5-2` medio +8→+5** (calibración de uso, ver §3). |
| `js/config/motor.js` | Recalibrado: `D 70→56`, `FACTOR_GOL 0.36→0.31`. Nuevas perillas de **varianza**: `VARIANZA_OCASION_MIN/SPAN` (0.95/0.1) y `TEMPO_POSESION` (0.9). |
| `js/core/motor.js` | `fuerzaEquipo(equipo)` = stats base (display/IA/bucketeo, rival-independiente); `fuerzaEfectiva(equipo, rival)` = §20.5 completa (motor); tempo de posesión por partido; banda de varianza desde config. |
| `js/core/rivalIA.js` | Elige formación + mentalidades por dificultad (§31.2), a ciegas; arma el XI con los cupos de la formación; targeting/areas sobre `fuerzaEquipo` (base). |
| `js/core/partido.js` | Guarda formación+mentalidades de ambos en el registro (reproducibilidad de `reVerificar`); bloque `tactica` para el análisis; `areasUsuario` desde `fuerzaEquipo`. |
| `js/core/storage.js` | El equipo persistido ahora es `{ formacion, team, mentalidadOfensiva, mentalidadDefensiva }`; `migrarEquipo()` envuelve el formato viejo (mapa de slots plano). |
| `js/core/estado.js` | Expone `estado.formacion`, `estado.team`, `estado.mentalidad*`. |
| `js/core/calculos.js` | `validateTeam` y los wrappers de stats leen los cupos de la formación **activa**, no de un 4-3-3 fijo. |
| `js/ui/equipo.js` | Cancha dinámica por formación; selector de formación con **confirmación previa** al descartar; selectores de mentalidad; punto de entrada §17.3 (Etapa 9). |
| `js/ui/partido.js` | Construye el equipo desde slots dinámicos + táctica; análisis táctico post-partido; comparación muestra la formación propia. |
| `index.html`, `css/estilos.css` | Selector de formación, panel de mentalidades, estilos del análisis táctico. |
| `js/main.js` | Llama `initTacticaEquipo()`. |
| `scripts/simular-balance.mjs` | Re-balance con sistema completo + secciones A–D de medición táctica. |
| `docs/Futbol_Figuritas_Proyecto_v3.md` | **§20.5 corregido**: se elimina `MATRIZ_CONTRAS_DEF` (era doble conteo). |

## 3. Decisiones técnicas que conviene recordar

- **Corrección de §20.5 — UNA sola matriz (no había `MATRIZ_CONTRAS_DEF`).**
  Aplicar la matriz al ataque propio Y su espejo a la defensa contaba el mismo
  enfrentamiento dos veces. Se aplica una sola vez, al ataque del atacante; como
  `fuerzaEfectiva(A,B)` se llama por cada equipo, el sistema es simétrico. El doc
  maestro quedó corregido.
- **`fuerzaEquipo` vs `fuerzaEfectiva`.** `fuerzaEquipo(equipo)` = calidad base de
  plantel (sin formación ni mentalidad, rival-independiente): es lo que se
  **muestra** antes del partido (§19.5, no filtra mentalidad), lo que usa la **IA**
  para calibrar el offset, y **la métrica de bucketeo de §33** (NO cambió). Solo
  el MOTOR usa `fuerzaEfectiva` completa.
- **Mods de mentalidad al ÁREA, no al stat** (decisión confirmada). "+12 Físico en
  ataque" sobre el stat físico (peso 0.10) daría +1.2 al área: invisible. Se
  aplican al área. Los números de §19.1/§19.2 son **puntos de partida**; los
  finales salen de la medición (documentados en `config/mentalidades.js`).
- **`frecuencia`/`calidadOcasion`/`frecuenciaRival`.** Se usan las salidas reales
  del motor: EQUIPO RÁPIDO sube su frecuencia; POSESIÓN baja frecuencia y sube
  calidad; BLOQUE COMPACTO baja la frecuencia **del rival** (`frecuenciaRival`,
  posible porque `fuerzaEfectiva` recibe al rival). No se plegó en `defensa`.
- **El registro de partido guarda formación + mentalidades** de ambos equipos.
  Sin eso, `reVerificar` daría otro marcador (la fuerza depende de la táctica).
- **Persistencia del equipo migrada**: el formato viejo (mapa de slots plano) se
  envuelve en `{ formacion, team, mentalidades }`. Formación/XI/mentalidad son
  **campos separados** → el congelamiento de torneo (§17.3, Etapa 9) es una sola
  guarda; el punto de entrada está comentado en `ui/equipo.js`.

## 4. Re-balance (§33) — resultados y calibración

Valores finales (`js/config/motor.js` y `mentalidades.js`):
`D=56`, `FACTOR_GOL=0.31`, `TEMPO_POSESION=0.9`, `VARIANZA_OCASION=0.95+0.1`,
`MATRIZ_ESCALA=3.4`.

**§33 con `node scripts/simular-balance.mjs` (medido con táctica NEUTRA, ver abajo):**

| Métrica | Objetivo | Resultado | |
|---|---|---|---|
| dif 0 → fav | 38–42% | ~39% | ✓ |
| dif 0 → empates | 18–22% | ~21% | ✓ **(deuda Etapa 2 CERRADA)** |
| dif +10 → fav | 63–68% | ~63% | ✓ |
| dif máx → fav | ≤87% | ~82% | ✓ |
| goles/partido | 2.4–3.2 | ~2.48 | ✓ |
| 0-0 | 6–10% | ~7.7% | ✓ |
| **5+ goles** | **≤11%** (ajustado, ver §5) | **~10%** | **✓** |

**§33 cumple 8/8** con el objetivo de 5+ ajustado a ≤11% (decisión del creador, §5).

**Mediciones tácticas (secciones A–D del script):**
- **Swing táctico ~±10 pts de FE** (correcta +9 / incorrecta −11). El objetivo de
  §5 es "hasta ±12"; se estabiliza en ~±10 porque subir `MATRIZ_ESCALA` para
  llegar a ±12 exacto vuelve a inflar el uso de EQUIPO RÁPIDO/JUEGO ABIERTO. Se
  priorizó el reparto de uso.
- **Uso óptimo OFENSIVO ≤40% ✓** (RÁPIDO ~38 / ABIERTO ~39 / POSESIÓN ~22 / EQUILIBRADO ~2).
- **Uso óptimo por FORMACIÓN ≤40% ✓** (máximo ~31%).
- **Uso óptimo ENTRE MENTALIDADES CON EFECTO (sección B', sin las neutras): sistema
  sano.** Ofensivas (3): RÁPIDO ~36 / ABIERTO ~38 / POSESIÓN ~27. Defensivas (2):
  BLOQUE ~38 / PRESIÓN ~63. Ninguna supera el ~65% de su subconjunto (ver §5).
- **Remontada:** equipo 10 puntos inferior con la mentalidad correcta gana **~42%**
  (vs ~17% neutra). Sí puede ganar.

**Cómo se midió §33 (importante):** el bucketeo sigue por **ΔFuerza Efectiva base**
(sin táctica, `fuerzaEfectivaMedia`, NO se cambió). §33 se mide con **táctica
NEUTRA** en ambos equipos: valida la curva calidad→victoria y la deuda de
empates/5+, que "no depende de las mentalidades". La ventaja táctica y el uso de
cada mentalidad se miden aparte (secciones A–D) — con táctica aleatoria en ambos,
el ruido táctico (±10) tapa la señal de calidad y rompe el +10.

**Perillas de varianza nuevas (cierran la deuda de empates):**
- `TEMPO_POSESION` (§24): corrimiento aleatorio de media cero en la posesión,
  sorteado una vez por partido. Con posesiones independientes, dos equipos
  parejos empatan ~26% (piso de Poisson); el tempo baja los empates a ~18-22% sin
  inflar las goleadas. Es la "varianza" que anticipaba §24.
- `VARIANZA_OCASION_MIN/SPAN`: banda de calidad de la ocasión (antes hardcodeada
  0.8+0.4 en el motor), angostada a 0.95+0.1.

## 5. Decisiones de balance cerradas con el creador (LEER)

- **`5+ goles ~10%`: objetivo de §33 ajustado de ≤8% a ≤11% (RESUELTO).** El ≤8%
  era una estimación sin datos. La medición muestra que, con goles ≥2.4 y brechas
  de calidad reales, la cola de 5+ es un **piso de Poisson ~9-10%** que
  FACTOR_GOL/varianza no bajan. El número equivocado era el objetivo, no el motor
  (mejora clara vs Etapa 2 ~13-17%). Se **rechazó el "garbage time" por diseño**
  (no por falta de tiempo): apagar el gol cuando el partido "ya está definido"
  mataría las remontadas, que son justo los partidos de los que se habla en el
  grupo. Doc maestro §33 actualizado.
- **Uso óptimo defensivo: sistema SANO, era un error de medición (RESUELTO).**
  EQUILIBRADO (ofensiva) y LÍNEA MEDIA (defensiva) son la MISMA cosa: la ausencia
  de elección táctica. Contadas como una mentalidad más inflaban el reparto (daban
  el falso ~50% defensivo). El óptimo REAL se mide entre las mentalidades **con
  efecto** (3 ofensivas: RÁPIDO/ABIERTO/POSESIÓN; 2 defensivas: BLOQUE/PRESIÓN).
  Con ese recorte (sección B' del script): ofensivas máx ~38%, defensivas
  BLOQUE ~38% / **PRESIÓN ~63%**, por **debajo del umbral ~65%** → sano. Las
  neutras siguen DISPONIBLES para el jugador; solo se excluyen del cálculo del
  óptimo. **No se agregó una 4ª mentalidad.** (Si a futuro PRESIÓN superara el
  65%, la propuesta en carpeta es una defensiva "MARCA PERSONAL / REPLIEGUE
  ORDENADO": +10 def vs ataques rápidos/contras, −8 medio, fuerte vs EQUIPO RÁPIDO
  ×1.12, débil vs POSESIÓN ×0.90 — cubre el hueco de que hoy nada castiga
  específicamente al EQUIPO RÁPIDO.)

## Pendientes conocidos (no son de esta etapa)

- **Faltas/tarjetas de PRESIÓN ALTA**: son eventos V1.5 (§27), fuera de esta etapa.
- **§17.3 (congelar formación/XI en torneos)**: es de la Etapa 9. Punto de entrada
  dejado preparado y comentado en `ui/equipo.js` (los campos ya están separados).

## 6. Advertencias para la próxima etapa (Etapa 6 — Economía)

- El equipo persistido cambió de forma (`{ formacion, team, mentalidades }`);
  `migrarEquipo()` cubre el formato viejo. Cualquier lectura del equipo debe pasar
  por `cargarEquipo()`.
- No tocar el bucketeo de `simular-balance.mjs` (ΔFuerza Efectiva base).
- Si se agregan mentalidades o formaciones, re-correr el balance: el uso óptimo
  defensivo depende del conteo 4-ofensivas/3-defensivas.

## 7. Cómo testear que esta etapa quedó bien

1. `node scripts/test-formaciones-mentalidades.mjs` → todo en verde.
2. `node scripts/test-rival-ia.mjs` y `node scripts/test-relato.mjs` → verde
   (no se rompió nada; la re-verificación por semilla ya usa la táctica guardada).
3. `node scripts/simular-balance.mjs` → §33 7/8 (5+ es el único fuera, ~10%);
   swing ~±10; uso ofensivo/formación ≤40%; remontada ~42%.
4. En el navegador (servidor estático, `README.md`):
   - Armar equipos con las 6 formaciones; cambiar de formación revalida y **avisa
     antes** de descartar jugadores.
   - Elegir mentalidad ofensiva y defensiva.
   - La comparación previa NO muestra la mentalidad rival.
   - Jugar y ver el **análisis táctico** post-partido revelando la mentalidad rival.
