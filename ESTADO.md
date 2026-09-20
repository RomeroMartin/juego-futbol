# ESTADO — Después de la Etapa 10A (Torneos: jugar la liga) 🏆⚽

> **Última sesión: Etapa 10A** (fixture de liga, jugar/avanzar fechas con
> simulación en el servidor, tabla de posiciones y mentalidad editable por fecha).
> El detalle está en la **sección 9**, al final. Secciones previas: **8** = 9B
> (armado con exclusividad), **7** = 9A (sala), **1–6** = Etapa 8.
>
> **Sigue: Etapa 10B** — recompensas al finalizar (§43), sobre pre-partido de
> torneo (§15.2), puntos por partido (§15.3), abandono 0-3 (§39) y amistosos
> entre usuarios (§32).

---

# ESTADO — Después de la Etapa 8 (Cloud Functions) 🔒

> Etapa del plan completada: **8**. Base: Etapas 0–7 ya en `main`.
> El cliente ya NO decide nada que otorgue valor: abrir/comprar/vender paquetes,
> otorgar Fichas y registrar partidos corren en **Cloud Functions** (plan Blaze).
> Las reglas de Firestore bloquean que el cliente escriba colección, fichas,
> puntos e inventario. El frontend sigue siendo vanilla; el backend usa Node+npm
> (permitido, es código de servidor).

## 1. Qué se implementó

- **5 Cloud Functions** (`onCall`, en `functions/index.js`):
  - `inicializarUsuario` — crea la cuenta con los **5 sobres de bienvenida** (§13.1). Idempotente.
  - `abrirPaquete` — el **servidor decide** las cartas (rareza, pity, garantías) y las suma a la colección. Transacción.
  - `comprarPaquete` — descuenta Fichas y suma el sobre (§15.5).
  - `venderRepetido` — suma Fichas por un repetido (§15.4).
  - `registrarPartidoIA` — **re-verifica el partido por semilla (§53.1)**: re-simula con la misma semilla y solo otorga Fichas si el marcador coincide. Verifica también que el usuario **posea** los jugadores del XI. Vs IA: Fichas sí, **puntos/sobres nunca** (§15.0/§15.3). Escribe el historial.
- **Reglas de Firestore endurecidas** (§53): el cliente **solo lee** su documento de usuario, su colección y su historial; solo puede **escribir su equipo** (formación/XI/mentalidades, que no da ventaja). Todo lo demás lo escribe el Admin SDK (las Functions, que ignoran las reglas).
- **Cliente reconvertido**: abrir/comprar/vender/registrar-partido pasaron de cálculo local a **llamadas al servidor** (`httpsCallable`) que esperan respuesta y aplican los saldos que devuelve el servidor.
- **Catálogo del lado servidor**: el dataset y la lógica pura (economía, motor, fórmulas, PRNG) están **empaquetados dentro de `functions/`** (no se subieron a Firestore `players/`): la Function los tiene localmente, sin lecturas extra.

## 2. Archivos y qué hace cada uno

Nuevos (backend):

| Archivo | Qué hace |
|---|---|
| `functions/package.json` | Proyecto Node del backend (ESM, Node 20, `firebase-functions` + `firebase-admin`). Único lugar con npm. |
| `functions/index.js` | Las 5 Cloud Functions. Transacciones, validaciones y `HttpsError` con mensajes en español. |
| `functions/juego/` | **Copia de la lógica pura del cliente** (config, data/jugadores, core/{prng,formulas,motor,economia}) + `core/verificar.js` (re-verificación §53.1). Misma lógica ya testeada; solo cambia quién la corre. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/config/firebase.js` | Exporta `functions = getFunctions(app)` (región por defecto us-central1). |
| `js/core/nube.js` | `guardarPartida` ahora escribe **solo el equipo** (`teams/actual`). Se quitaron la escritura del doc de usuario/colección y el historial cliente. Se agregaron los wrappers: `inicializarUsuarioNube`, `abrirPaqueteNube`, `comprarPaqueteNube`, `venderRepetidoNube`, `registrarPartidoNube`, y `jugadorDeCatalogo(id)` para rehidratar respuestas. |
| `js/core/estado.js` | `hidratarDesdeNube`: si el usuario es nuevo, llama a `inicializarUsuario` (servidor) y relee. **Se retiró la migración desde localStorage** (las reglas ya no dejan al cliente escribir eso). `agregarAlHistorial` es solo en memoria (el servidor persiste). |
| `js/ui/paquetes.js` | Abrir = `abrirPaqueteNube` (async); aplica `paquetes` + `cambios` + `cartas` que devuelve el servidor. |
| `js/ui/tienda.js` | Comprar = `comprarPaqueteNube` (async). |
| `js/ui/coleccion.js` | Vender = `venderRepetidoNube` (async). |
| `js/ui/partido.js` | Tras simular local (para el relato), llama a `registrarPartidoNube` y aplica los saldos; el botón se deshabilita mientras responde. |
| `firestore.rules` | Endurecidas (ver arriba). Se despliegan con `firebase deploy`. |
| `firebase.json` | Nueva sección `functions` (`source: "functions"`) y `functions/**` agregado al ignore de hosting (no publicar el backend). |
| `README.md` | Deploy actualizado: `firebase deploy` sube hosting + reglas + functions. |

## 3. Decisiones técnicas que conviene recordar

- **🔑 Modelo de anti-trampa de partido = RE-VERIFICACIÓN (§53.1), no rival server-side.** El cliente genera el rival (con `Math.random`) y simula; manda el registro `{semilla, ambos equipos por id, marcador}`; el servidor **re-simula** con la misma semilla y solo paga si coincide. Probado: **200/200 partidos coinciden y un marcador mentido se rechaza**.
  - **Limitación conocida (no la pide el doc):** como el cliente elige la composición del rival, un tramposo podría armarse un rival trivialmente débil y ganar honestamente para farmear Fichas. Vs IA es una canilla intencional (§15.0) y el doc solo exige rechazar *resultados falsos*, cosa que se cumple. Si algún día molesta, se endurece haciendo que el servidor genere el rival con semilla.
- **El catálogo NO se subió a Firestore** (`players/`/`clubs/`): se empaquetó en `functions/juego/`. Es estático y privado; la Function lo tiene local. Las reglas de `players/` quedan por si en el futuro se sube.
- **Lógica duplicada cliente ↔ servidor.** `functions/juego/` es una **copia** de `js/`. Si se cambia una fórmula, un valor de balance (`config/economia.js`) o el motor, **hay que actualizar las dos copias**. (Es el precio de no tener bundler; la alternativa era un paso de build, fuera del stack.)
- **La migración localStorage→nube se retiró** (Etapa 7 la usó una vez). Un usuario nuevo se crea 100% en el servidor. Los que ya migraron en la Etapa 7 conservan sus datos en la nube.
- **`guardarPartida` quedó solo para el equipo.** Cualquier intento del cliente de escribir colección/fichas es rechazado por reglas (a propósito).
- **Región de las Functions:** us-central1 (default). El cliente usa `getFunctions(app)` sin región → coincide. Si algún día se mueven de región, hay que pasar la región en ambos lados.

## 4. Tests

- **`reVerificar` (nuevo, §53.1):** 200 partidos jugados por el cliente re-verificados por el servidor → **200/200 coinciden**; marcador adulterado → **rechazado**. (script headless de esta sesión).
- Tests de etapas previas: siguen **en verde** (`test-economia`, `test-formaciones-mentalidades`, `test-rival-ia`, `test-relato`). La economía server-side es la misma que valida `test-economia`.
- **No se pudieron probar las Functions desplegadas desde el entorno de desarrollo** (requieren el proyecto y `firebase deploy`). Es esperable **una o dos rondas de deploy-y-revisar** hasta afinar (versiones de deps, permisos). Igual que con Firestore en la Etapa 7.

### Cómo testear (criterio del plan, Etapa 8)
1. Abrir un paquete → funciona normal (las cartas las decide el servidor).
2. En la consola del navegador, intentar sumarse fichas a mano
   (`setDoc(doc(db,'users',<uid>), {usuario:{monedas:{fichas:99999}}}, {merge:true})`)
   → **la escritura se rechaza** (permiso denegado).
3. Intentar agregarse un jugador a mano en `users/<uid>/collection` → **rechazado**.
4. Jugar un partido vs IA → suma Fichas (verificadas), **0 puntos**.

## 5. Pendientes conocidos (no son de esta etapa)

- **Torneos (Etapas 9 y 10):** creación, código de invitación, exclusividad con `reclamarJugador` (§38), fixture, tabla, premios, y el **sobre pre-partido de torneo** (§15.2). Las reglas de `torneos/` y `matches/` están **bloqueadas** (`allow write: if false`) hasta que existan sus Functions.
- **Amistosos entre usuarios (§32):** Etapa 10.
- Endurecer el rival vs IA server-side (limitación de §3, opcional).

## 6. Advertencias para la próxima etapa (Etapa 9 — Torneos: armado)

- **La infraestructura ya está**: carpeta `functions/`, Admin SDK, patrón `onCall` + transacción, y la lógica de juego (economía/motor) server-side. La Etapa 9 agrega la Function `reclamarJugador` (§38, hay un ejemplo en el documento maestro) y las de crear/unirse a torneo.
- **Reglas:** abrir el match de `torneos/{id}` — lectura para participantes, escritura solo Admin (como en el ejemplo del doc, §38/§51.2). Hoy están en `if false`.
- **El sobre de torneo (§15.2)** reutiliza `abrirPaquete` pero con la condición de mínimo 4 participantes; conviene una Function específica que valide el torneo antes de otorgar.
- **Duplicación cliente/servidor:** si Etapa 9 toca `config/` o el motor, recordar sincronizar `js/` y `functions/juego/`.
- **Deploy:** `firebase deploy` ya sube hosting + reglas + functions juntos. El primer deploy de functions habilita APIs de Google Cloud (automático) y puede tardar unos minutos.

---

## 7. Etapa 9A — Torneos: la sala (creación / unión / apertura)

### Qué se implementó
- **Esquema `torneos/{id}`** en Firestore (§35): nombre, `codigoInvitacion`, creador,
  estado (BORRADOR→ARMADO→EN_CURSO→FINALIZADO), participantes, `nombres` (uid→nombre,
  para mostrar sin leer docs ajenos), `jugadoresReclamados` (vacío hasta 9B),
  `ventanaArmadoCierra`, y los campos de avance/fixture/tabla listos para 9B/Etapa 10.
- **3 Cloud Functions** (en `functions/index.js`):
  - `crearTorneo(nombre)` — genera un código único (alfabeto sin I/O/0/1), deja el
    torneo en BORRADOR con el creador como primer participante.
  - `unirseTorneo(codigo)` — suma al usuario (solo en BORRADOR, respeta el máximo de 8).
  - `abrirArmado(torneoId)` — solo el creador; valida **mínimo 4** participantes y el
    **pool mínimo** (§37: peor caso `{POR:n, DEF:5n, MED:5n, DEL:3n}` sobre la unión de
    colecciones, jugadores DISTINTOS). Si no alcanza, devuelve `{ok:false, validacion}`
    con qué posición falta; si alcanza, pasa a ARMADO con ventana de 24 hs.
- **Reglas** (`firestore.rules`): un torneo lo **lee** solo un participante
  (`uid in resource.data.participantes`), y **nadie lo escribe** desde el cliente. La
  consulta "mis torneos" (`array-contains`) queda cubierta por esa misma regla.
- **UI nueva "Torneos"** (`js/ui/torneos.js` + nav 🏆 + pantalla en index.html):
  lista de mis torneos **en vivo** (Firestore realtime), crear, unirse por código, y
  vista de detalle con el código para compartir, los participantes en vivo y el botón
  del creador para abrir el armado (muestra el aviso de pool insuficiente si aplica).

### Archivos
- Nuevo: `js/ui/torneos.js`.
- Modificados: `functions/index.js` (+3 funciones y helpers de código/pool),
  `firestore.rules` (bloque `torneos/`), `js/core/nube.js` (listeners
  `escucharMisTorneos`/`escucharTorneo` + wrappers `crearTorneoNube`/`unirseTorneoNube`/
  `abrirArmadoNube`), `js/ui/navegacion.js` (render al abrir la pantalla), `js/main.js`
  (`initTorneos` + `detenerTorneos` al cerrar sesión), `index.html`, `css/estilos.css`.

### Decisiones
- **Formato: solo LIGA en V1.0** (§40). ELIMINACION/GRUPOS quedan para después.
- **`nombres` en el doc del torneo:** como el cliente no puede leer el `users/{uid}` de
  otros (reglas), el nombre visible de cada participante se guarda en el propio torneo.
- **La vista en vivo** usa `onSnapshot`; funciona igual con el long-polling forzado.
- **Validación de pool** corre server-side leyendo las colecciones; el flip de estado va
  en transacción re-chequeando estado y mínimo.

### Cómo testear (necesita varias cuentas)
1. Con tu cuenta: Torneos → Crear → aparece el código.
2. Con 3 cuentas más (otro navegador/incógnito o amigas): Unirse con ese código.
3. Con < 4 participantes, el botón de abrir no aparece (avisa cuántos faltan).
4. Con 4+, el creador toca **Abrir armado**: si el pool no alcanza, muestra qué posición
   falta (§37); si alcanza, el torneo pasa a "Armando equipos".

### Advertencias para la Etapa 9B (lo que sigue)
- Agregar `reclamarJugador` (§38, ejemplo en el doc) y `liberarJugador` — transacción
  atómica sobre `jugadoresReclamados`; verificar posesión del jugador.
- **Pool de Reserva** (§37.1): jugadores COMÚN que nadie del torneo posee, máx. 3, en
  préstamo, con exclusividad.
- Guardar el **XI de torneo** por participante (¿subcolección `torneos/{id}/equipos/{uid}`?
  Las reglas de subcolección ya están: lectura para participantes, escritura Admin).
- **Cierre de ventana** (§17.3): al vencer `ventanaArmadoCierra`, congelar formación+XI,
  dejar la mentalidad editable. Hoy el estado ARMADO ya se setea con la fecha de cierre.
- Recordar la **duplicación cliente/servidor** si se toca `config/` o el motor.

---

## 8. Etapa 9B — Torneos: armado del equipo (§36.1, §37.1, §38)

### Qué se implementó
- Durante la ventana de 24 hs, cada participante **arma su equipo del torneo**
  reclamando jugadores con **exclusividad** (§36.1): el primero que reclama a un
  jugador lo bloquea para el resto. Todo lo que da exclusividad corre **en el
  servidor, en transacción** (§38).
- **4 Cloud Functions nuevas** (en `functions/index.js`):
  - `elegirFormacionTorneo(torneoId, formacion)` — fija la formación del torneo.
    **Cambiarla libera todos los jugadores que tenías reclamados** (los slots
    cambian y vuelven al pool) — decisión confirmada con el usuario.
  - `reclamarJugador(torneoId, playerId, slot)` — **el punto crítico (§38)**:
    transacción atómica que valida estado `ARMADO` + ventana abierta, que seas
    participante, que la posición del slot coincida, que el slot esté libre, que
    **nadie más** lo haya reclamado y que **poseas** al jugador (o que aplique el
    Pool de Reserva). Escribe el índice global (`jugadoresReclamados`) **y** el
    slot del equipo en la misma transacción.
  - `liberarJugador(torneoId, playerId)` — vuelve el jugador al pool y vacía su
    slot (§39). Solo con la ventana abierta.
  - `listarPoolReserva(torneoId, posicion)` — **Pool de Reserva (§37.1)**:
    jugadores COMÚN reales que **ningún** participante posee y que están sin
    reclamar. El cliente no puede calcularlo (no lee colecciones ajenas), así que
    lo arma el servidor. El reclamo de reserva se valida en `reclamarJugador`:
    COMÚN, nadie lo posee, **máx. 3 por equipo**, en **préstamo** (marcado en
    `reservaUsados`, no queda en la colección).
- **Congelado (§17.3):** las 3 funciones de escritura rechazan cambios si la
  ventana ya venció (`Date.now() >= ventanaArmadoCierra`). La UI muestra el equipo
  en modo solo-lectura. La mentalidad editable entre fechas y el flip a `EN_CURSO`
  son de la **Etapa 10**.

### Modelo de datos nuevo
- Subcolección **`torneos/{torneoId}/equipos/{uid}`**:
  `{ schemaVersion, formacion, xi: { slot → playerId }, mentalidadOfensiva,
  mentalidadDefensiva, reservaUsados: [ids], actualizadoEn }`.
- El índice de exclusividad sigue en el doc del torneo: `jugadoresReclamados`
  (`playerId → uid`), como ya preveía la Etapa 9A.

### Archivos
- Modificados: `functions/index.js` (+4 funciones y helpers: `slotsPorPosicion`,
  `armadoAbierto`, `exigirArmadoAbierto`, `idsPoseidosPorTorneo(+Tx)`,
  `equipoTorneoVacio`), `js/core/nube.js` (listener `escucharEquipoTorneo` +
  wrappers `elegirFormacionTorneoNube`/`reclamarJugadorNube`/`liberarJugadorNube`/
  `listarPoolReservaNube`), `js/ui/torneos.js` (vista de armado: selector de
  formación, cancha por líneas, selector de jugador con estado en vivo de quién
  reclamó qué, y acceso al pool de reserva), `css/estilos.css` (estilos del
  armado).
- **`firestore.rules` NO se tocó:** las reglas de la subcolección
  `torneos/{id}/equipos/{uid}` (lectura para participantes, escritura solo Admin)
  ya estaban desde la 9A y cubren todo esto.

### Decisiones
- **Cambiar formación = liberar reclamos.** Como cada formación tiene distintos
  slots, mantener jugadores sería inconsistente. Confirmado con el usuario.
- **La comprobación "nadie lo posee" del reclamo de reserva** usa lecturas
  transaccionales (`idsPoseidosPorTorneoTx`). La exclusividad dura la garantiza,
  igual, el chequeo transaccional de `jugadoresReclamados`.
- **Sin cambios de balance ni de `config/`**, así que no hubo que re-sincronizar
  `js/` ↔ `functions/juego/` (solo se importó `formaciones.js`/`mentalidades.js`,
  que ya estaban copiadas).

### Cómo testear (necesita varias cuentas + deploy de functions)
1. `firebase deploy` (sube las 4 functions nuevas).
2. Con el torneo en "Armando equipos": elegir formación → aparece la cancha.
3. Reclamar jugadores propios → quedan en los slots; en otra cuenta se ven como
   "reclamado por …".
4. **Dos cuentas reclaman el mismo jugador** → una gana, la otra recibe error claro.
5. Reclamar un jugador que no tenés → falla (salvo por el pool de reserva).
6. Sin arqueros propios → "Buscar en el pool de reserva" trae COMÚN que nadie tiene;
   máx. 3 de reserva por equipo.
7. Cambiar de formación → libera lo reclamado (pide confirmación).
8. Al vencer la ventana → el equipo queda congelado (solo lectura).

### Advertencias para la Etapa 10 (lo que sigue)
- **Jugar las fechas.** Generar el fixture (liga todos contra todos), avance
  MANUAL por el creador (§41.1) + forzado por inactividad a los 5 días (§41.2),
  simulación de cada fecha en Cloud Function con semilla (§41.4), tabla (§42) y
  premios (§43). El flip `ARMADO → EN_CURSO` va acá.
- **Mentalidad editable entre fechas** (§17.3): el equipo ya guarda
  `mentalidadOfensiva`/`mentalidadDefensiva`; falta la UI de cambiarla antes de
  cada fecha (la formación y el XI quedan congelados).
- **Sobre pre-partido de torneo** (§15.2) con el aviso de que no sirve para el
  torneo en curso.
- Al abandonar con el torneo en curso: partidos restantes 0-3 (§39); los
  jugadores **no** se liberan (§39).
- Recordar la **duplicación cliente/servidor** si se toca `config/` o el motor.

---

## 9. Etapa 10A — Torneos: jugar la liga (§40–§42)

### Qué se implementó
- El torneo ya se **juega de punta a punta**: fixture de liga, fechas jugadas en el
  servidor y tabla de posiciones en vivo. (Recompensas, sobres, puntos, abandono y
  amistosos son la **Etapa 10B**.)
- **3 Cloud Functions nuevas** (`functions/index.js`):
  - `iniciarTorneo(torneoId)` — el creador cierra el armado y arranca: valida que
    **todos** tengan el XI completo (si no, devuelve `{ok:false, incompletos}`),
    **genera el fixture** (liga todos contra todos, ida, método del círculo),
    inicializa la tabla y pasa a `EN_CURSO` con `fechaActual: 1`. Puede iniciarse
    aunque la ventana de 24 hs no haya vencido (la cierra en el acto).
  - `avanzarFecha(torneoId)` — **juega la fecha actual**: simula sus partidos en el
    servidor (§41.4) con **semilla determinista por partido** (FNV-1a de
    `torneoId:partidoId`, reproducible y verificable, sin `Math.random`), actualiza
    la tabla (§42) y avanza a la fecha siguiente o pasa a `FINALIZADO`. La dispara
    el creador (§41.1) o cualquiera tras 5 días sin avance (§41.2).
  - `guardarMentalidadTorneo(torneoId, of, def)` — mentalidad editable entre fechas
    (§17.3); formación y XI siguen congelados.
- **Tabla (§42):** puntos 3/1/0; desempate puntos → DG → GF → **enfrentamiento
  directo** → nombre. Se recalcula desde los partidos jugados y se guarda ordenada.

### Modelo de datos (se completan campos ya previstos en el doc del torneo)
- `fixture`: `[{ fecha, partidos: [{ id, local, visitante, golesLocal,
  golesVisitante, semilla }] }]`. Los partidos jugados guardan su marcador y
  semilla (copia histórica congelada, permitida por las reglas duras).
- `tabla`: filas ordenadas `{ uid, nombre, pj, g, e, p, gf, gc, dg, pts }`.
- `fechaActual`, `totalFechas`, `estado` (`EN_CURSO`/`FINALIZADO`), `ultimoAvanceEn`.
- **Decisión:** los resultados se embeben en `fixture` dentro del doc del torneo
  (que el cliente ya escucha en vivo), en lugar de la subcolección
  `torneos/{id}/partidos/` que sugería §41.4. Es más simple y sin listeners extra;
  el volumen es chico (≤ 28 partidos). Si en el futuro se guardan relatos por
  partido, conviene mover eso a la subcolección.

### Archivos
- Modificados: `functions/index.js` (+3 funciones y helpers: `xiCompleto`,
  `equipoMotorDesdeDoc`, `generarFixture`, `semillaPartido`, `calcularTabla`,
  `enfrentamientoDirecto`), `js/core/nube.js` (wrappers `iniciarTorneoNube`/
  `avanzarFechaNube`/`guardarMentalidadTorneoNube`), `js/ui/torneos.js` (vista de
  competencia: tabla, fixture, botón de jugar fecha, selector de mentalidad, y
  botón de iniciar en el armado), `css/estilos.css` (estilos de tabla/fixture/
  mentalidad).
- **`firestore.rules` NO se tocó.**

### Decisiones
- **Simulación 100% en el servidor** (§41.4), a diferencia del partido vs IA (que
  el cliente simula y el servidor re-verifica). Reusa `functions/juego/core/motor.js`.
- **Semilla derivada del torneo** (no `Math.random`): cumple la regla dura del
  motor y hace cada resultado reproducible/verificable.
- **Sin cambios de balance ni de `config/`** → no hubo que re-sincronizar
  `js/` ↔ `functions/juego/`. `PUNTOS_TABLA` (3/1/0) es puntaje deportivo, no
  economía, y vive junto a la función de tabla.
- **Iniciar requiere XI completo de todos.** Los forfeits/0-3 (§39) son 10B.

### Cómo testear
- **Headless (ya corrido):** determinismo del motor, fixture (cada par una sola
  vez para N=4..8) y semillas — todo en verde
  (`scratchpad/test-liga.mjs`, lógica copiada verbatim).
- **Con deploy + varias cuentas:** `firebase deploy`; armar equipos completos;
  el creador toca **Iniciar torneo** → aparece el fixture y la tabla; **Jugar
  fecha** simula la fecha y actualiza la tabla; cambiar mentalidad antes de la
  fecha; al terminar todas las fechas → `FINALIZADO` con el campeón.

### Fix importante — persistencia del XI del torneo (servidor)
- **Bug:** en `reclamarJugador`/`liberarJugador` se escribía el slot con
  `t.set(equipoRef, { ["xi."+slot]: valor }, {merge:true})`. En `set(merge)` una
  clave con punto NO es un campo anidado (eso es solo en `update`), así que el
  mapa `xi` real nunca se actualizaba: cada jugador nuevo "borraba" al anterior y
  no se podía tener más de uno en el equipo.
- **Fix:** ahora se lee `equipo.xi`, se arma el mapa completo y se escribe
  `{ xi: nuevoXi }` (correcto con `set(merge)`). Requiere **deploy de functions**.

### Fix — "INTERNAL" al cambiar de formación / copiar equipo (servidor)
- **Bug:** `elegirFormacionTorneo` hacía `t.update(ref, liberar)` (escritura) y
  después `t.get(equipoRef)` (lectura) en la misma transacción. Firestore exige
  todas las lecturas ANTES que las escrituras → lanzaba `INTERNAL` cuando el
  usuario ya tenía jugadores reclamados (p. ej. al usar "Copiar equipo del modo
  normal", que primero fija la formación).
- **Fix:** se reordenó (todas las lecturas primero). Requiere deploy de functions.

### Mentalidad editable en el armado (cliente)
- El selector de mentalidad (ofensiva/defensiva) ahora también aparece **durante
  el armado**, no solo entre fechas (§17.3; `guardarMentalidadTorneo` ya lo
  permitía en estado ARMADO). Los avisos de iniciar/avanzar/mentalidad pasaron a
  banner en pantalla (mobile-friendly).

### Ajustes de UX (post-deploy 10A, mismo alcance)
- **Aviso en pantalla** en el armado en lugar de `alert()` (en mobile los `alert`
  de error no se veían → parecía que "no pasaba nada" al reclamar). Ahora
  reclamar/liberar/elegir formación muestran un banner y **refrescan siempre**
  (con actualización optimista del XI, sin depender solo del listener).
- **Botón "Copiar mi equipo del modo normal"** en el armado (§34/§36.1): pone la
  formación del equipo vs IA y reclama los jugadores que estén **libres**,
  salteando (y avisando) los que ya tomó otro participante. Respeta la
  exclusividad; es solo un atajo sobre `reclamarJugador`.
- Solo tocó `js/ui/torneos.js` y `css/estilos.css` (no hubo cambios de servidor).

### Advertencias para la Etapa 10B (lo que sigue)
- **Recompensas (§43)** al pasar a `FINALIZADO` (Fichas por puesto) — van en
  `js/config/economia.js` (+copia en `functions/juego/config/`), otorgadas por CF.
- **Sobre pre-partido (§15.2)** y **puntos por partido de torneo (§15.3)** con el
  tope de amistosos (§15.3.2).
- **Abandono (§39):** partidos restantes 0-3; jugadores no se liberan en curso.
- **Amistosos entre usuarios (§32).**
- El `avanzarFecha` de 10A ya deja el hook para otorgar recompensas al finalizar
  (hoy solo marca `FINALIZADO`).
- Recordar la **duplicación cliente/servidor** si 10B toca `config/` o el motor.

---

## 10. Post-testeo con amigos + Etapa 10B (parcial)

Devolución del grupo tras jugar un torneo completo. Se hizo:

### Ajustes rápidos
- **Precios de paquetes** 300/1200/500 → **1000/3500/1500** (config cliente +
  servidor + doc §15.5/§15.7). El farmeo vs IA abría paquetes muy barato.
- **Relato**: dura ~1 min (ritmo adaptativo a la cantidad de líneas) y los **goles
  en contra van en rojo** (`relato-gol-contra`), a favor en verde. (`js/ui/partido.js`,
  css).
- **Cambiar nombre** desde el header (✏️): Cloud Function `cambiarNombre` (perfil +
  `nombres[uid]` y filas de tabla en cada torneo) + `actualizarNombreVisible`
  (displayName de Auth, para torneos nuevos). Antes en los torneos figuraba el mail.

### Etapa 10B — hecho
- **Premios del torneo (§43)**: al pasar a `FINALIZADO`, `avanzarFecha` acredita
  Fichas por puesto (1º: 500+100·N, 2º: 250+50·N, 3º: 150, 4º+: 100). Config en
  `ECONOMIA.premiosTorneo` (cliente+servidor). Flag `premiosOtorgados` para no
  duplicar. La UI muestra el puesto y las Fichas ganadas.
- **Sobre gratis por partido (§15.2)**: `avanzarFecha` da **+1 BÁSICO** a cada uno
  que jugó la fecha, si el torneo tiene ≥4 participantes
  (`ECONOMIA.sobrePorPartidoTorneo`/`minParticipantesParaSobre`). Todo en la misma
  transacción (lecturas de user docs antes de escribir).

### Etapa 10B — A3 hecho (relatos en partidos de torneo)
- **Botón "📖 Ver relato"** en cada partido jugado del fixture. Re-simula el partido
  en el cliente con la **semilla guardada** (mismo marcador) leyendo ambos equipos
  (`obtenerEquipoTorneo` en `nube.js`), y reusa la pantalla de relato.
- `generarRelato` ahora acepta `registro.nombreUsuario` (antes hardcodeaba "Tu
  equipo"), así el relato de torneo usa los nombres reales.
- `partido.js`: `reproducirRelatoExterno(registro, onVolver)` + `terminarRelato`
  vuelve a `onVolver` en vez de ir al resultado vs IA (se limpia `volverExterno` en
  el flujo vs IA para no arrastrar callbacks).
- **Clave de determinismo:** el motor NO es simétrico, así que el cliente simula
  siempre en el orden **local→visitante** (como el servidor) y solo cambia qué lado
  lleva la etiqueta `"USUARIO"` (para el color de goles a favor/en contra). Verificado
  headless: el marcador re-simulado coincide desde ambas perspectivas.
- Falta (menor): que el amistoso (§32) reuse el mismo `reproducirRelatoExterno`.

### Etapa 10B — PENDIENTE
- **§32 — Amistosos entre usuarios.** Es una feature completa: abrir reglas de
  `matches/` (hoy `if false`), Cloud Functions (desafiar / aceptar+confirmar XI /
  simular server-side), y pantallas nuevas (desafío por código o amigo, bandeja de
  invitaciones, confirmar XI). Da Fichas y puntos (§15.3) con tope diario de 3
  (§15.3.2). Los amistosos NO dan sobre (§15.2).
- **Abandono 0-3 (§39)** y el tope de amistosos con puntos (§15.3.2) van junto con §32.

### Nota de UX conocida
- El header (Fichas / paquetes) no se refresca en vivo tras ganar premios o recibir
  el sobre: hay que recargar. Se avisa en pantalla. Mejorable con una re-hidratación
  puntual del doc de usuario.
