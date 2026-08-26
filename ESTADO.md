# ESTADO — Después de la Etapa 6 (Economía completa) 💰 CIERRA EL CICLO DE PROGRESIÓN

> Etapa del plan completada: **6**. Base: Etapas 0–5 ya en `main`.
> Es la última etapa antes de Firebase. La apertura de paquetes sigue corriendo
> en el **cliente** con `Math.random` (inseguro a propósito): se mueve a Cloud
> Functions en la Etapa 8 (§15.0). Firebase entra en la Etapa 7.

## 1. Qué se implementó

- **Los 5 paquetes de bienvenida (§13.1).** El PRIMERO con composición garantizada
  (1 POR, 2 DEF, 2 MED, 1 DEL) y al menos 1 ORO o superior. Los otros 4 son BASICO
  estándar (con el pity de arquero ya activo).
- **Pity de arquero (§13.2)** y **pity de rareza (§13.3)**, con contadores que
  **persisten** en el modelo de usuario (recargar no resetea un pity a medias).
- **Probabilidades de paquete de §14** (62 / 26 / 9 / 2.7 / 0.3) por carta, con
  selección **uniforme** dentro de la rareza y **sin duplicados** dentro del mismo
  paquete (§14.2).
- **Sistema de Fichas (§15.4)** y **tienda de paquetes (§15.5)** con los 3 tipos
  (Básico / Premium / Posicional).
- **Venta de repetidos** (§15.4), solo con `quantity ≥ 2` (nunca la última copia).
- **Contador de puntos y Pack PREMIUM a los 50 (§15.3)**.
- **Tope de 3 amistosos con puntos por día (§15.3.2)**, implementado aunque los
  amistosos entre usuarios lleguen en la Etapa 10.

- **🔴 LA REGLA QUE SOSTIENE LA ECONOMÍA (§15.0, §15.3): los partidos vs IA
  otorgan FICHAS pero NUNCA sobres ni puntos.** Cero puntos, en toda dificultad.
  Fichas sí: +10 jugar, +25 ganar, +10 empatar, +50 el primero del día.
  El **sobre pre-partido** es exclusivo de torneos (mín. 4 participantes, §15.2):
  el código está, pero **sin forma de dispararse** hasta la Etapa 10.

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/core/economia.js` | **Núcleo puro y testeable** (sin DOM ni localStorage). Apertura de paquetes (bienvenida, pity, garantías, sin duplicados, bajada de rareza por posición), Fichas, puntos + Pack PREMIUM, tienda, venta de repetidos, modelo de usuario (§44) e inventario. Fuente de azar **inyectable** (`rand`). |
| `js/ui/tienda.js` | Pantalla de tienda (§15.5): compra con Fichas, suma al inventario. |
| `scripts/test-economia.mjs` | Tests headless deterministas (mulberry32) de toda la economía. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/config/economia.js` | Se agregó `probabilidadesRareza` (+ assert de suma 1.0), `ordenRareza`, `jugadoresPorPaquete`, `tiposPaquete`, `primerPaqueteBienvenida`, pity (`pityArqueroMax`, `pityRarezaMax`, `rarezaPityObjetivo`), `venderRepetido`, y `ETIQUETA_RAREZA`/`etiquetaRareza()`. |
| `js/core/storage.js` | Claves nuevas: `CLAVE_USUARIO`. `CLAVE_PAQUETES` pasó de **número** a **objeto** `{BASICO,PREMIUM,POSICIONAL}` (con migración). `cargarInventario()`, `cargarUsuario()` (+ `migrarUsuario`), `guardarPartida` persiste usuario + inventario, `sincronizarDataset` limpia también el usuario. |
| `js/core/estado.js` | `estado.usuario` (§44) y `estado.paquetes` (inventario). Acredita los 5 sobres de bienvenida al usuario nuevo (`reclamarBienvenidaSiCorresponde`). `getTotalPaquetes()`. |
| `js/ui/paquetes.js` | Reescrito sobre `core/economia.js`: inventario por tipo en el home, apertura por tipo (el POSICIONAL elige posición al abrir), avisos de garantía en el revelado. |
| `js/ui/coleccion.js` | Botón **Vender** en cartas con `quantity ≥ 2`. |
| `js/ui/navegacion.js` | Header con **Fichas** y **puntos** (n/50) + total de paquetes. Render de home (inventario) y tienda. |
| `js/ui/componentes.js` | La carta muestra la **etiqueta** de rareza con tilde; `getRarity` fallback ahora devuelve la clave canónica `COMUN` (sin tilde). |
| `js/ui/partido.js` | Tras un partido vs IA: `registrarResultadoEconomia(...,"IA",...)` → suma Fichas, **puntos quedan en 0**. Muestra las Fichas ganadas en el resultado. |
| `js/main.js` | `initPaquetes()` + `initTienda()`; se quitó el botón único "ABRIR PAQUETE". |
| `index.html`, `css/estilos.css` | Header (Fichas/puntos), inventario de sobres, pantalla y nav de Tienda, botón de venta, bloque de Fichas del resultado. |

## 3. Decisiones técnicas que conviene recordar

- **🔑 `COMUN` sin tilde es la clave canónica en TODO el código.** La tilde
  ("COMÚN") existe SOLO en las etiquetas que ve el usuario (`ETIQUETA_RAREZA` en
  `config/economia.js`). Motivo: si en la Etapa 9 alguien filtra el Pool de
  Reserva (§37.1) por "COMÚN" con tilde, no matchea nada y el bug es silencioso.
  El dataset (`data/jugadores.js`) ya usa `COMUN`; se unificó todo el código a esa
  clave (incluido el fallback `getRarity`).
- **Aclaración 1 — bajada de rareza por posición (regla explícita).** Cuando una
  carta tiene la **posición forzada** (bienvenida, POSICIONAL o pity de arquero) y
  la rareza sorteada **no tiene jugadores de esa posición**, se **BAJA de rareza**
  hasta encontrar una que sí tenga. **Nunca se cambia la posición** (la posición es
  una promesa explícita; la rareza es un sorteo). Cada bajada se cuenta en
  `meta.bajadasDeRareza` y se loguea por consola (salvo modo silencioso de los
  tests). En el pool actual esto solo pasa con **LEYENDA/DEF** (el pool tiene 0
  defensores LEYENDA): ~0.23% de las cartas POSICIONAL DEF.
- **Inventario por tipo, POSICIONAL elige posición al ABRIR.** Se compra el
  POSICIONAL genérico y se elige la posición al abrirlo (entre compra y apertura
  el usuario puede cambiar de idea o sacar la posición por otro lado). El
  inventario son 3 contadores (`{BASICO,PREMIUM,POSICIONAL}`), no una lista de
  paquetes con atributos.
- **El pity de arquero NO rompe la posición de un POSICIONAL.** Solo aplica a
  paquetes sin posición fija (BASICO/PREMIUM). Un POSICIONAL DEF nunca mete un
  arquero; el pity se resuelve en el próximo paquete no-posicional.
- **La apertura es PURA y con `rand` inyectable.** No usa el PRNG del motor
  (`mulberry32`) en producción — la economía no tiene nada que "re-verificar"
  todavía; eso llega con Cloud Functions (§53.1, Etapa 8). Los **tests** sí usan
  mulberry32 para ser deterministas.
- **Fichas y puntos son funciones puras** (`registrarResultadoEconomia`,
  `puntosDelPartido`). La UI solo las llama y persiste. La Etapa 8 mueve esto al
  servidor sin reescribir la lógica.
- **Migración de `estado.packs`.** Era un número plano; ahora es
  `estado.paquetes = {BASICO,PREMIUM,POSICIONAL}`. Un usuario pre-Etapa 6 (número
  guardado, sin modelo de usuario) se trata como "bienvenida ya recibida": no se le
  re-otorgan los 5 ni el paquete especial; su número viejo se envuelve como BASICO.

## 4. Tests — resultados reales medidos

`node scripts/test-economia.mjs` → **TODO EN VERDE**. Números obtenidos:

1. **100 usuarios nuevos arman un XI válido: 0 fallan.** El criterio es "alguna de
   las 6 formaciones" (§17), no obligatoriamente 4-3-3: el usuario elige la que le
   cierre. Reparto de la primera formación que cierra: **4-3-3: 96, 4-4-2: 3,
   3-5-2: 1**. (El pool argentino es MED-pesado y DEL-escaso, así que ~4% arranca
   en 4-4-2/3-5-2 en vez de 4-3-3; **todos pueden jugar**.)
2. **Con 0 arqueros, el próximo paquete trae uno: 300/300.**
3. **Pity de rareza:** con 9 sin DESTACADO todavía no; con 10, el 11 lo garantiza
   (300/300).
4. **10.000 aperturas (60.000 cartas) → distribución vs §14** (desvío máx 0.16%):

   | Rareza | Real | §14 |
   |---|---|---|
   | COMUN | 62.07% | 62.0% |
   | ORO | 25.84% | 26.0% |
   | DESTACADO | 8.98% | 9.0% |
   | ESTRELLA | 2.81% | 2.7% |
   | LEYENDA | 0.30% | 0.3% |

5. **20 partidos vs IA:** Fichas suben (495 en el test), **contador de puntos = 0**,
   0 Packs PREMIUM. Control: un partido de TORNEO sí suma (3 pts).
6. **Comprar un paquete descuenta el monto correcto** (BASICO 300: 1000→700; sin
   fichas suficientes se rechaza sin descontar).
7. **Vender un repetido con `quantity 1` no se puede**; con `quantity ≥ 2` sí.
8. **POSICIONAL 500x por posición (2000 paquetes):** TODAS las cartas respetan la
   posición pedida. **Frecuencia de bajada de rareza:** POR 0, DEF 7/3000 (0.23%),
   MED 0, DEL 0 — solo el caso LEYENDA/DEF.

Los tests de etapas anteriores siguen verdes:
`test-formaciones-mentalidades`, `test-rival-ia`, `test-relato`.

Además se corrió un **smoke de integración en navegador** (Chromium/Playwright):
inventario, apertura del sobre de bienvenida (composición 1/2/2/1), cierre,
colección (30 figuritas), tienda (3 cards, compra deshabilitada sin fichas), y un
partido completo (armar 4-3-3 → jugar → **+70 Fichas**, puntos **0/50**). Sin
errores de JS (el único 404 es `favicon.ico`, ajeno a esta etapa).

## 5. Pendientes conocidos (no son de esta etapa)

- **Sobre pre-partido de torneo (§15.2)** y **amistosos entre usuarios (§32)**: el
  código de puntos/tope ya está (`puntosDelPartido` maneja `TORNEO`/`AMISTOSO`),
  pero no hay forma de dispararlos → Etapa 10.
- **`favicon.ico`** falta (404 inofensivo, viene de antes).
- La apertura corre en el cliente (inseguro) → se mueve a Cloud Functions en la
  Etapa 8.

## 6. Advertencias para la próxima etapa (Etapa 7 — Firebase)

- **El modelo de usuario (§44) ya existe** en `core/economia.js` (`usuarioNuevo()`)
  y se persiste en localStorage (`CLAVE_USUARIO`). La migración a Firestore (§51)
  debe mapear estos campos tal cual: `monedas`, `puntosAcumulados`,
  `packsPremiumGanados`, `amistososConPuntosHoy`, `fechaContadorAmistosos`,
  `paquetesDesdeUltimoArquero`, `paquetesDesdeUltimoDestacado`,
  `paquetesBienvenidaReclamados`, `primerPaqueteEspecialPendiente`,
  `ultimoPartidoDelDia`.
- **`estado.paquetes` es un objeto por tipo**, no un número. La migración de datos
  debe respetarlo.
- **No guardar stats calculadas** sigue vigente (§51.1). El inventario y las
  monedas SÍ se guardan; las stats de equipo NO.
- Toda la lógica que **otorga valor** (abrir paquete, Fichas, puntos, venta,
  compra) está aislada en funciones puras de `core/economia.js`. La Etapa 8 las
  mueve al servidor **sin reescribir la lógica**, solo cambiando quién las ejecuta.
- El campo `primerPaqueteEspecialPendiente` es un compañero de
  `paquetesBienvenidaReclamados` (§44 lista el segundo): marca si el próximo BASICO
  abre la composición garantizada. Persistir ambos.
