# ESTADO — Amistosos (§32) + abandono de torneo (§39) 🤝⚽

> **Última sesión: cierra la Etapa 10B.** Amistosos entre usuarios y abandono
> 0-3, más un fix de Fichas/puntos de torneo que se encontró en el camino. El
> detalle está en la **sección 13**, al final. Secciones previas: **12** y
> **11** = mejoras post-Etapa 10 pedidas por el grupo, **9** = Etapa 10A,
> **8** = 9B, **7** = 9A, **1–6** = Etapa 8.
>
> **El plan de 10 etapas queda 100% cerrado con esta sesión.** Lo único no
> implementado del doc maestro es una mejora menor de UX señalada en la
> sección 13 (§39: liberar jugadores al abandonar **durante el armado**, un
> caso que no tiene flujo propio hoy).
>
> ⚠️ **Requiere `firebase deploy`** (hay Cloud Functions nuevas y modificadas)
> antes de poder testear.

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

---

## 11. Post-Etapa 10 — reinicio/borrado de torneos, fecha de a uno, equipo editable entre fechas

Pedido directo del grupo tras jugar varios torneos. **No es una etapa del plan
original**; toca una decisión ya cerrada del doc maestro (B6/§17.3), revisada
con el usuario antes de implementar y actualizada en el doc.

### Qué se implementó

**1. Torneos reiniciables + borrado (para no crear un torneo nuevo cada vez).**
- `reiniciarTorneo(torneoId)` (Cloud Function, solo creador, solo `FINALIZADO`):
  revalida el pool mínimo (§37, las colecciones cambiaron desde el armado
  original), libera todos los equipos armados (cada uno re-arma desde cero) y
  vuelve a `ARMADO` con una ventana de 24hs nueva. Mismo código, mismos
  participantes.
- `borrarTorneo(torneoId)` (Cloud Function, solo creador, solo `FINALIZADO`):
  borra el documento del torneo y la subcolección de equipos.
- UI: dos botones nuevos para el creador en un torneo `FINALIZADO`.

**2. Jugar la fecha de a uno, con relato (§41.5, nuevo).**
- La simulación sigue siendo atómica en el servidor (nada cambió en
  `avanzarFecha` respecto a **quién decide**). Lo que cambia es la UI: al
  terminar `JUGAR FECHA`, se abre una pantalla con la lista de los partidos de
  esa fecha (ya jugados) para ver el relato de a uno — de **cualquier**
  partido de la fecha, no solo el propio — antes de pasar a la tabla.
  Reutiliza el mecanismo de relato que ya existía para partidos históricos del
  fixture (se factorizó en `construirRegistroRelato`).

**3. Equipo editable entre fechas — revierte B6/§17.3 (decisión revisada, no
solo extendida).**
- Antes: formación y XI quedaban congelados apenas cerraba el armado inicial;
  solo la mentalidad era libre entre fechas.
- Ahora: se abre una **ventana de 1 hora** entre fecha y fecha (y antes de la
  fecha 1, al iniciar el torneo) donde formación, XI y mentalidad son
  editables con la misma pantalla y la misma exclusividad del armado inicial
  (§38: reclamar/liberar). El organizador puede jugar la fecha siguiente en
  cualquier momento, aunque no haya pasado la hora — eso cierra la ventana de
  hecho (usa el equipo tal como esté en ese instante).
- **Guardrail agregado:** como ahora se puede liberar un jugador sin
  reemplazarlo, `avanzarFecha` valida que todos los equipos que juegan esa
  fecha tengan el XI completo (mismo criterio que ya usaba `iniciarTorneo`) y
  devuelve `{ok:false, incompletos}` en vez de romperse si a alguien le falta.

### Archivos modificados
- `functions/index.js`:
  - `armadoAbierto`/`exigirArmadoAbierto` → generalizados a
    `ventanaTorneoAbierta`/`exigirEdicionAbierta` (cubren ARMADO y EN_CURSO).
  - `iniciarTorneo` y `avanzarFecha`: abren/cierran `ventanaEntreFechasCierra`
    (1h) en el doc del torneo; `avanzarFecha` valida XI completo antes de
    simular.
  - `elegirFormacionTorneo`, `reclamarJugador`, `liberarJugador`: usan la
    nueva `exigirEdicionAbierta` en vez de la vieja (solo ARMADO).
  - Nuevas: `reiniciarTorneo`, `borrarTorneo`.
- `js/core/nube.js`: wrappers `reiniciarTorneoNube`, `borrarTorneoNube`.
- `js/ui/torneos.js`:
  - `ventanaAbierta` → `edicionAbiertaCliente` (mismo criterio que el servidor,
    ahora cubre EN_CURSO).
  - Nuevo bloque reutilizable `pintarEdicionEquipo` (selector de
    formación/cancha/picker/mentalidad), usado tanto en `pintarArmado` como en
    `pintarCompeticion` cuando la ventana entre fechas está abierta.
  - Nuevas: `pintarFechaJugada`, `onVerRelatoFecha`, `construirRegistroRelato`
    (factorizado de `onVerRelato`), `pintarAccionesCreadorFinalizado`,
    `onReiniciarTorneo`, `onBorrarTorneo`.
  - `onAvanzarFecha` ahora activa la pantalla de "fecha jugada" en vez de ir
    directo a la tabla.
- `css/estilos.css`: `.torneo-acciones-fin`, `.torneo-borrar`.
- `docs/Futbol_Figuritas_Proyecto_v3.md`: §17.3 reescrita (B6 revisada, no
  cerrada), tabla del Apéndice B y sus fundamentos/condiciones de revisión
  actualizados, §35 (schema) con `ventanaEntreFechasCierra`, §41.5 nueva (ver
  fecha de a uno), §43.1 nueva (reiniciar/borrar), y la aclaración de §15.2
  sobre el sobre pre-partido (ya no dice "no se puede usar en el torneo en
  curso": ahora sí, si está libre y se reclama en la ventana entre fechas).

### Decisiones tomadas con el usuario (antes de codear)
- Formación **y** jugadores editables entre fechas (no solo mentalidad):
  confirmado explícitamente, revierte B6.
- Reiniciar torneo = re-armar todo de cero (no mantener los equipos previos),
  porque las colecciones cambian con nuevos sobres abiertos.
- El relato "de a uno" se puede ver de **todos** los partidos de la fecha
  (espectador), no solo el propio.
- Ventana entre fechas: **1 hora**, pero el organizador la puede cerrar antes
  jugando la fecha directamente (no hizo falta una Cloud Function separada de
  "cerrar ventana": jugar la fecha ya usa el equipo tal como esté en ese
  instante).

### No se tocó
- `firestore.rules`: no hizo falta. Los torneos ya eran `allow write: if
  false` para el cliente; las Cloud Functions nuevas usan el Admin SDK como
  las demás.
- `functions/juego/` (copia cliente↔servidor de config/motor): no se tocó
  ningún valor de balance ni el motor, así que no hubo que resincronizar.
- Abandono (§39) y amistosos (§32): siguen pendientes de la Etapa 10B, sin
  relación con este cambio.

### Cómo testear
1. `firebase deploy` (sube las 2 funciones nuevas y las 5 modificadas).
2. **Jugar fecha de a uno:** en un torneo `EN_CURSO`, tocar "JUGAR FECHA N" →
   debe abrir la pantalla con la lista de partidos de esa fecha (marcador ya
   definido) y un botón "▶ Ver partido" por cada uno, incluidos los que no son
   tuyos. Ver el relato de alguno, volver, confirmar que dice "✓ Ver de nuevo".
   Tocar "Continuar" → pasa a la pantalla normal de competencia.
3. **Equipo editable entre fechas:** después de jugar una fecha (o de iniciar
   el torneo, antes de la fecha 1), la pantalla de competencia debe mostrar
   "Tu equipo para la próxima fecha" con la cancha editable — liberar un
   jugador y confirmar que en otra cuenta se puede reclamar. Cambiar de
   formación y confirmar que libera los reclamos. Dejar pasar la hora (o
   simular con la fecha del sistema) y confirmar que el equipo queda
   congelado ("🔒 Equipo congelado hasta la próxima fecha").
4. **Guardrail de XI incompleto:** liberar un jugador sin reemplazarlo y tocar
   "JUGAR FECHA" → debe avisar quién tiene el equipo incompleto, sin romper
   nada ni avanzar la fecha.
5. **Reiniciar torneo:** con un torneo `FINALIZADO`, como creador, tocar "🔄
   Reiniciar torneo" → confirma, y el torneo debe volver a "Armando equipos"
   con los equipos vacíos (todos reclaman de nuevo) y el mismo código.
6. **Borrar torneo:** con un torneo `FINALIZADO`, tocar "🗑 Borrar torneo" →
   confirma, y el torneo debe desaparecer de "Mis torneos" para todos los
   participantes.

### Advertencias para la próxima sesión
- Si se toca `config/` o el motor, recordar sincronizar `js/` ↔
  `functions/juego/` (no aplica a este cambio).
- Queda pendiente, de la Etapa 10B: amistosos entre usuarios (§32) y abandono
  0-3 (§39).

---

## 12. Post-sección 11 — relato "en vivo" sin spoiler + abrir el sobre entre fechas

Dos ajustes a lo de la sección 11, mismo pedido de sesión. **No toca el
servidor** (nada nuevo para deployar acá, `firebase deploy` de la sección 11
ya alcanza).

### Qué se implementó

**1. La pantalla de "fecha jugada" ya no muestra el marcador de entrada.**
Antes mostraba el resultado de cada partido apenas se jugaba la fecha (el
servidor ya lo había decidido); ahora la lista dice `vs` hasta que tocás
"▶ Jugar partido" — el resultado se entera recién en la última línea del
relato (que siempre lo incluyó, §28: "Final del partido: X - Y"). Saltear el
relato sigue revelando el resultado al toque (opción ya prevista desde la
Etapa 4), como corresponde.
- `js/ui/torneos.js`: `pintarFechaJugada` ahora condiciona el marcador a
  `info.vistos.has(pt.id)`; el botón cambió de "Ver partido" a "Jugar
  partido"; el botón de continuar dice "Saltear e ir a la tabla" si quedan
  partidos sin ver.

**2. Se puede abrir el sobre gratis de la fecha desde la misma ventana entre
fechas, sin ir a la pantalla de Paquetes.** Antes solo avisaba "recargá para
verlo". Ahora, si tenés un `BASICO` pendiente, aparece un aviso con botón
"📦 Abrir sobre" junto al resto de la edición del equipo; al cerrar el
revelado del paquete, vuelve al mismo torneo (no al home).
- `js/ui/paquetes.js`: `abrir()` ahora devuelve `true`/`false` según si
  llegó a abrir el paquete; nuevas exportadas `abrirPaqueteExterno(tipo,
  onVolver)` y `cerrarPack()` — mismo patrón que `reproducirRelatoExterno` en
  `partido.js` (un `volverExterno` que, si está seteado, reemplaza el
  `showScreen("homeScreen")` de siempre al cerrar la pantalla del paquete).
- `js/main.js`: `closePackButton` y `backFromPack` ahora llaman a
  `cerrarPack()` en vez de tener `showScreen("homeScreen")` hardcodeado.
- `js/ui/torneos.js`: `aplicarSobreOptimista(torneoId, fecha)` — como el doc
  de usuario no tiene listener en vivo (`nube.js` lo lee una sola vez al
  iniciar sesión), el sobre que el servidor ya acreditó en `avanzarFecha` se
  refleja localmente en `estado.paquetes.BASICO` con la MISMA condición que
  usa el servidor (`ECONOMIA.sobrePorPartidoTorneo` +
  `minParticipantesParaSobre` + que tu equipo haya jugado esa fecha — en N
  impar hay una fecha libre por ronda). Es una actualización optimista: si
  algo no cuadra, se corrige solo al recargar. `onAbrirSobreTorneo()` llama a
  `abrirPaqueteExterno`.

### Decisión técnica a recordar
- El "sobre pendiente" que ve el botón de Torneos es **estado local
  optimista**, no una lectura real de Firestore. Si en el futuro se agrega un
  listener en vivo al doc de usuario (la "Nota de UX conocida" de más
  arriba), esta lógica se puede simplificar leyendo `estado.paquetes`
  directo, sin el cálculo de `aplicarSobreOptimista`.

### Cómo testear
1. Jugar una fecha → en la lista de partidos, todos dicen "vs" (sin
   resultado) hasta que se juegan de a uno.
2. Tocar "▶ Jugar partido" en uno → durante el relato no se sabe el
   resultado; recién en la última línea aparece el marcador final.
3. Con el equipo en un torneo `EN_CURSO` de tamaño par, jugar una fecha →
   debe aparecer "🎁 Tenés un sobre nuevo" con botón "Abrir sobre" en la
   ventana de edición (sin recargar la página).
4. Tocar "Abrir sobre" → revela las cartas normalmente; al volver, aterriza
   de nuevo en el mismo torneo (no en el home).
5. Con un torneo de N impar (alguien tiene fecha libre esa ronda), confirmar
   que a quien no jugó esa fecha NO le aparece el aviso de sobre nuevo.

---

## 13. Amistosos (§32) + abandono de torneo (§39) — cierra la Etapa 10B

Última pieza pendiente del plan de 10 etapas original. Se encontró y arregló
además un gap real: los partidos de torneo no daban Fichas ni puntos
individuales (§15.3/§15.4), solo el sobre por fecha y el premio final.

### 1. Fix: Fichas + puntos por partido de torneo (§15.3/§15.4)

`registrarResultadoEconomia` (Fichas, puntos, Pack PREMIUM a los 50 puntos)
está construida desde la Etapa 6 y ya se usaba para partidos vs IA, pero
`avanzarFecha` nunca la llamaba. Ahora, al jugar una fecha, cada participante
que jugó de verdad recibe Fichas + puntos según V/E/D (tabla `TORNEO` de
`ECONOMIA.puntos`), **además** del sobre (§15.2) y el premio final (§43) que
ya existían. No hizo falta tocar ningún valor de `config/` — todo ya estaba
definido, solo faltaba conectarlo.

### 2. Abandono de torneo (§39)

- **Cloud Function `abandonarTorneo(torneoId, uidObjetivo?)`**: uno mismo
  siempre se puede marcar; si `uidObjetivo` es otro participante, solo el
  creador puede hacerlo (decisión tomada con el usuario: "uno mismo o el
  creador"). Solo con el torneo `EN_CURSO`. Guarda `torneo.abandonados[uid] =
  true`; **no libera** sus jugadores reclamados (§39: los partidos ya jugados
  tienen que seguir siendo válidos).
- **`avanzarFecha`** ahora, para cada partido de la fecha:
  - si alguno de los dos ya abandonó, **no simula**: registra 0-3 en contra
    suyo directamente (0-0 si abandonaron los dos), con `semilla: null` (sin
    simulación real, sin relato posible para ese partido);
  - el chequeo de "XI completo" antes de simular ya no exige nada a quien
    abandonó;
  - el abandonado no recibe más sobres (§15.2) ni Fichas/puntos por fechas
    siguientes; su rival sí cobra la victoria por forfeit como una victoria
    normal (Fichas + puntos + 3 en la tabla).
- **`exigirEdicionAbierta`** (la que gatea reclamar/liberar/elegir formación)
  ahora rechaza a un participante ya abandonado.
- **UI** (`js/ui/torneos.js`): sección "Participantes" en la pantalla de
  competencia, con botón "Abandonar" (uno mismo) o "Marcar abandono" (el
  creador, sobre otro), confirmación explícita porque es irreversible. Los
  partidos por abandono se muestran en el fixture y en "fecha jugada" con
  "🚪 Abandono" en vez del botón de relato (no hay nada que re-simular).

### 3. Amistosos entre usuarios (§32)

- **Solo por código** (decisión tomada con el usuario): no existe sistema de
  amigos ni búsqueda de usuarios (las reglas de Firestore solo dejan leer el
  perfil propio), así que se reusa el mismo patrón de los torneos —
  `crearDesafio()` genera un código de 6 caracteres, se comparte a mano,
  `aceptarDesafio(codigo)` lo une.
- **El equipo es el del modo normal**, tal como esté armado al momento de
  confirmar (decisión tomada con el usuario): no hay una pantalla de armado
  separada para el amistoso. `confirmarDesafio(matchId)` lo confirma; cuando
  **los dos** confirmaron, la misma llamada arma los equipos frescos desde
  `users/{uid}/teams/actual` + la colección (valida posesión y XI completo,
  §17.2), simula el partido **100% en el servidor** (como las fechas de
  torneo, nunca como vs IA) con una semilla determinista, y otorga Fichas +
  puntos a ambos (`registrarResultadoEconomia(..., "AMISTOSO", ...)`, con el
  tope de 3 amistosos/día ya implementado desde la Etapa 6).
- **Nadie ve el equipo/mentalidad del otro antes de que el partido se
  decida** (§19.5): `equipos` y `resultado` quedan en `null` en el documento
  del desafío hasta que los dos confirmaron; se escriben los dos a la vez, en
  la misma transacción que simula.
- `cancelarDesafio(matchId)`: cualquiera de los participantes puede cancelar
  mientras no se jugó (no vence solo con el tiempo).
- **UI nueva** `js/ui/amistosos.js` + pantalla `amistososScreen` + botón de
  nav "🤝 Amistosos": lista de mis desafíos (en vivo), crear, aceptar por
  código, y detalle según estado (`PENDIENTE` → código para compartir;
  `CONFIRMANDO` → confirmar mi equipo, viendo si el rival ya confirmó;
  `JUGADO` → resultado + botón de relato, re-simulado en el cliente con la
  semilla guardada, mismo mecanismo que los relatos de torneo).

### Archivos modificados
- `functions/index.js`: `avanzarFecha` (Fichas/puntos + abandono),
  `exigirEdicionAbierta` (bloquea a abandonados), nueva `abandonarTorneo`;
  nuevo bloque completo de Amistosos (`crearDesafio`, `aceptarDesafio`,
  `confirmarDesafio`, `cancelarDesafio` + helpers `construirEquipoDesdeTeam`,
  `idsDelEquipo`, `generarCodigoDesafio`).
- `firestore.rules`: `matches/{matchId}` — lectura para participantes,
  escritura solo Admin SDK (mismo patrón que `torneos/{torneoId}`).
- `js/core/nube.js`: `abandonarTorneoNube` + wrappers de amistosos
  (`escucharMisDesafios`, `crearDesafioNube`, `aceptarDesafioNube`,
  `confirmarDesafioNube`, `cancelarDesafioNube`).
- `js/ui/torneos.js`: gestión de participantes/abandono, partidos por
  forfeit sin relato en fixture y en "fecha jugada".
- `js/ui/amistosos.js` (nuevo), `js/ui/navegacion.js` (+`amistososScreen`),
  `js/main.js` (init/detener amistosos), `index.html` (pantalla + nav),
  `css/estilos.css` (estilos de abandono/forfeit + fix de `min-width` del nav
  en mobile para que entren 7 botones).
- `docs/Futbol_Figuritas_Proyecto_v3.md`: §15.3 (nota del fix), §32
  (decisiones de implementación), §39 (qué se implementó y qué no), §51.2
  (esquema real de `matches/`).

### Decisiones tomadas con el usuario (antes de codear)
- Desafiar: **solo por código**, no lista de amigos.
- Equipo del amistoso: **el del modo normal**, no un armado separado.
- Abandono: **uno mismo o el creador**, no solo uno mismo.
- El fix de Fichas/puntos de torneo: **sí, en esta misma tanda**.

### No se tocó
- `functions/juego/` (config/motor): sin cambios de balance, así que no hubo
  que resincronizar `js/` ↔ `functions/juego/`.
- El caso de abandono **durante el armado** (liberar los 11 jugadores de
  golpe): no tiene flujo propio, ver la nota en §39 del doc maestro.

### Cómo testear (necesita 2 cuentas para amistosos)
1. `firebase deploy` (sube las funciones nuevas y modificadas).
2. **Fichas/puntos de torneo:** jugar una fecha de un torneo y confirmar que,
   además del sobre, suben las Fichas y el contador de puntos (⭐ del header)
   de quienes jugaron (recargar para verlo, es lectura única).
3. **Abandono:** con un torneo `EN_CURSO`, un participante toca "Abandonar" →
   confirma → aparece "Abandonaste este torneo" y desaparece su edición de
   equipo/sobre. El creador puede "Marcar abandono" sobre otro. Al jugar la
   siguiente fecha del abandonado, su partido se resuelve 0-3 sin relato
   ("🚪 Abandono" en el fixture).
4. **Amistosos:** con cuenta A, Amistosos → Desafiar → aparece el código. Con
   cuenta B, Aceptar con ese código. Ambas cuentas confirman su equipo (si a
   alguna le falta el XI completo, avisa antes de dejar confirmar) → al
   confirmar la segunda, se juega solo y las dos ven el resultado. Ver el
   relato desde cualquiera de las dos cuentas. Probar también "Cancelar
   desafío" antes de que ambos confirmen.
5. **Tope de amistosos:** jugar 4 amistosos seguidos con la misma cuenta en
   el mismo día → del cuarto en adelante, sigue dando Fichas pero no suma al
   contador de puntos (§15.3.2).

### Con esto, el plan de 10 etapas queda cerrado
Todo lo del `Futbol_Figuritas_Plan_de_Etapas.md` original está implementado.
Lo que quede de acá en más es mejora sobre lo ya construido, no plan pendiente.

---

## 14. Plan grande post-plan — Grupos A, B, C, D y E hechos (plan cerrado)

El grupo pidió una lista grande de mejoras nuevas (no forman parte de ningún
plan previo). Se agruparon por riesgo/tamaño y se van construyendo en tandas
separadas, cada una con su propio PR. **Este archivo se va a ir actualizando
a medida que se cierre cada grupo** — mirá la fecha del último commit para
saber cuál es el estado real.

### El plan completo (para no perderlo de vista)

- **Grupo A** ✅ hecho — relato marca el entretiempo; figurita muestra la
  posición natural detallada (`detailedPosition`).
- **Grupo B** ✅ hecho (esta sección) — límite diario ("stamina") de partidos
  vs IA.
- **Grupo C** ✅ hecho (esta sección) — torneos ida y vuelta al crearlos, con
  la localía pesando (+3 Ataque/Medio al local, -1 Ataque al visitante —
  confirmado con el usuario).
- **Grupo D** ✅ hecho — toca las fórmulas centrales:
  - **D1** ✅ hecho — penalización por jugar fuera de posición
    dentro de la línea (-15% categoría equivocada, -8% mismo tipo pero lado
    equivocado — confirmado con el usuario). No necesitó re-correr el script
    de balance (§33): no toca D/FACTOR_GOL/MATRIZ_CONTRAS, ver detalle abajo.
  - **D2** ✅ hecho (esta sección) — 4 mentalidades ofensivas nuevas
    (Contragolpe, Juego Directo, Ataque Total, Desborde Individual) + 3
    defensivas nuevas (Cerrojo, Línea Adelantada, Repliegue tras Pérdida),
    matriz de contras ampliada de 4×3 a 8×6 y recalibrada con
    `scripts/simular-balance.mjs`, + manual de mentalidades en pantalla
    propia dentro del juego.
- **Grupo E** ✅ hecho (esta sección) — subsistemas nuevos del motor:
  - Tarjetas (amarilla/roja), con la roja afectando el resto de ESE partido
    (-12% de Fuerza Efectiva) y suspensión de 1 fecha en torneos.
  - Penales, con el arquero pudiendo atajarlos según sus stats — frecuencia
    recalibrada con el usuario para no romper el techo de 5+ goles de §33
    (quedó bastante más rara de lo pedido originalmente, ver detalle abajo).
  - Lesiones (muy raras, 1-2 fechas, solo entre fechas de torneo — no tocan
    el partido en curso).
  - Banco de suplentes (solo torneos, no vs IA ni amistosos — confirmado),
    con auto-sustitución antes de jugar la fecha.

**Con esto el plan grande post-plan queda cerrado.** Pendiente identificado
para más adelante (no en esta sesión): recalibrar el motor entero
(D/FACTOR_GOL/VARIANZA_OCASION) para poder subir la frecuencia de penales
sin romper §33 — el usuario lo pidió explícitamente como una tarea aparte,
ver "Conflicto de calibración" en la sección de Grupo E más abajo y en
`js/config/motor.js`.

### Grupo A — hecho (post-Etapa 10, sesión previa a esta)
- `js/data/plantillasRelato.js`: `ENTRETIEMPO`/`SEGUNDO_TIEMPO` (3 variantes
  cada una, estilo "línea de marco" como INICIO).
- `js/core/relato.js`: `generarRelato` las inserta antes del primer evento
  con minuto ≥ 45 (o antes del FINAL si ninguno llega a la segunda mitad).
- `js/ui/partido.js`: esas líneas se estilizan igual que INICIO/FINAL.
- `js/ui/componentes.js`: `getDetailedPositionName` (mapea GK/CB/LB/RB/CDM/
  CM/CAM/LM/RM/LW/RW/ST a español) + subtítulo en la carta del jugador.

### Grupo B — hecho (esta sesión)
**Límite de partidos vs IA**, carga tipo stamina: 20 partidos, y al llegar a
0 arranca un cooldown de 5 horas; pasado el cooldown, se recarga **entera**
(no de a poco). Solo aplica a vs IA — torneos y amistosos no tienen este
límite (ya tienen su propio límite estructural).

- `js/config/economia.js` (+ copia `functions/juego/config/economia.js`):
  nuevo bloque `limiteIA: { maxPartidos: 20, cooldownHoras: 5 }`.
- `js/core/economia.js` (+ copia `functions/juego/core/economia.js`):
  - `usuarioNuevo()` agrega `partidosIADisponibles` (default `maxPartidos`) y
    `iaSeRenuevaEn` (default `null`).
  - `refrescarStaminaIA(usuario, ahora)`: si ya pasó `iaSeRenuevaEn`, recarga
    entera y limpia la fecha. Muta `usuario`. La usan tanto el servidor (al
    consumir) como el cliente (para MOSTRAR el número correcto sin esperar
    una respuesta del servidor — no persiste nada del lado cliente).
  - `consumirStaminaIA(usuario, ahora)`: llama a `refrescarStaminaIA` primero;
    si no queda nada devuelve `{ok:false, seRenuevaEn}`; si hay, descuenta 1 y
    arranca el cooldown si llegó a 0.
- `functions/index.js`: `CAMPOS_USUARIO` incluye los 2 campos nuevos;
  `registrarPartidoIA` llama a `consumirStaminaIA` ANTES de otorgar nada
  (Fichas incluidas) — si no hay stamina, rechaza el partido entero con
  `HttpsError("failed-precondition", ...)`.
- `js/ui/partido.js`: `renderCompetir` muestra "⚡ X/20 partidos vs IA
  disponibles hoy" o "⏳ Se renuevan a las HH:MM" (según `staminaIAActual()`,
  el cálculo liviano de solo-lectura), y deshabilita los botones de
  dificultad cuando no queda stamina.
- `index.html` (`#staminaIA`) + `css/estilos.css` (`.stamina-ia`).

**Decisión técnica:** el cliente no tiene listener en vivo del doc de
usuario (limitación ya conocida, ver sección 11), así que `staminaIAActual()`
recalcula localmente si ya pasó el cooldown, para no mostrarle a alguien "0
disponibles" cuando en realidad ya se recargó. Es de solo lectura — la
recarga real la hace el servidor la próxima vez que se llama
`registrarPartidoIA`.

### Cómo testear Grupo B
1. `firebase deploy` (Cloud Function modificada).
2. Entrar a Competir → debe verse "⚡ 20/20 partidos vs IA disponibles hoy".
3. Jugar varios partidos → el contador baja de a uno.
4. (Para probar el agotamiento sin jugar 20 veces) bajar `maxPartidos` a un
   número chico en `js/config/economia.js` + `functions/juego/config/
   economia.js` temporalmente, o jugar los 20 de una — al llegar a 0, los
   botones de dificultad se deshabilitan y aparece la hora de recarga.
5. Confirmar que jugar torneo/amistoso NO consume ni se ve afectado por este
   contador.

### Grupo C — hecho (esta sesión)
**Torneos ida y vuelta (§40.1) con localía.** Al crear un torneo, un checkbox
nuevo ("Ida y vuelta — con localía") define `dobleVuelta` en el documento del
torneo (default `false`, se mantiene el comportamiento de siempre). Con
`dobleVuelta: true`, el fixture duplica cada fecha de ida invirtiendo local y
visitante (torneo de 8: 7 fechas de ida + 7 de vuelta), y cada partido de
torneo le suma al local +3 Ataque/+3 Medio y le resta al visitante -1 Ataque
— confirmado con el usuario. En torneos a una vuelta, amistosos y vs IA la
localía NO se aplica.

- `js/config/motor.js` (+ copia `functions/juego/config/motor.js`, verificadas
  idénticas con `diff`): nueva constante `MOTOR.LOCALIA = { local: {ataque:3,
  medio:3}, visitante: {ataque:-1} }`.
- `js/core/motor.js` (+ copia `functions/juego/core/motor.js`, idénticas):
  `fuerzaEfectiva(equipo, equipoRival, extra=null)` suma `extra` DESPUÉS de
  todos los multiplicadores de mentalidad/formación (empujón fijo, no un
  factor que se agranda con el resto). `simularPartido(equipoA, equipoB,
  semilla, opciones=null)` pasa `opciones?.extraA`/`opciones?.extraB` a cada
  lado. Ambos parámetros son opcionales y no rompen ningún llamador existente
  (vs IA, amistosos, torneos a una vuelta siguen sin pasar nada = sin cambios).
- `functions/index.js`:
  - `crearTorneo` acepta `idaYVuelta` del cliente y guarda `dobleVuelta` en el
    doc del torneo.
  - `generarFixture(participantes, dobleVuelta=false)` reescrito: arma el
    fixture de ida como siempre y, si `dobleVuelta`, agrega una "vuelta"
    espejada (mismos enfrentamientos, local/visitante invertidos) a
    continuación de las fechas de ida.
  - `iniciarTorneo` pasa `torneo.dobleVuelta === true` a `generarFixture`.
  - `avanzarFecha`: al simular un partido, arma `opciones` con
    `MOTOR.LOCALIA.local`/`.visitante` SOLO si `torneo.dobleVuelta`, y se lo
    pasa a `simularPartido` (acá se decide el resultado real).
- `js/core/nube.js`: `crearTorneoNube(nombre, idaYVuelta=false)` manda el
  flag al servidor.
- `js/ui/torneos.js`:
  - Checkbox nuevo en la card de "Crear un torneo" (`#torneoIdaYVuelta`).
  - `construirRegistroRelato`: arma el mismo `opciones` que el servidor
    (a partir de `t.dobleVuelta`) antes de re-simular con
    `simularPartido` para el relato — si no, el marcador re-simulado no le
    coincidiría al ya guardado.
  - Badge "· Ida y vuelta" en el eyebrow de la sala (`pintarSala`) y de la
    competencia (`pintarCompeticion`).
- `css/estilos.css`: `.torneo-check` (fila del checkbox — no se pisa con el
  estilo `width:100%` que ya tenían los `input` de `.torneo-card`).
- `docs/Futbol_Figuritas_Proyecto_v3.md`: nueva §40.1 documentando el formato
  y la localía.

**Decisión técnica a recordar:** `simularPartido` corre en DOS lugares con la
misma semilla (servidor real y cliente para el relato) y tienen que dar
idéntico. Por eso el bono de localía viaja como parámetro opcional gateado
por `torneo.dobleVuelta` en ambos call sites, usando la misma constante
`MOTOR.LOCALIA` — nunca hardcodeado en un solo lado.

### Cómo testear Grupo C
1. `firebase deploy` (Cloud Functions modificadas: `crearTorneo`,
   `iniciarTorneo`, `avanzarFecha`).
2. Crear un torneo nuevo tildando "Ida y vuelta" → confirmar que el fixture
   tiene el doble de fechas de un torneo del mismo tamaño sin tildar (8
   participantes: 14 fechas en vez de 7).
3. Jugar una fecha de ida y la fecha "espejo" (misma pareja, local/visitante
   invertido) y confirmar que el mismo equipo de local en cada partido tiene
   una ligerísima ventaja (no determinante — puede perder igual).
4. Confirmar que un torneo SIN tildar sigue jugando exactamente igual que
   antes (sin bono de localía).
5. Ver la sala y la pantalla de competencia del torneo → debe aparecer
   "· Ida y vuelta" en el encabezado.

### Grupo D1 — hecho (esta sesión)
**Penalización por jugar fuera de posición dentro de la línea (§18.1).**
Cada slot de una formación ahora tiene, además de POR/DEF/MED/DEL, una
categoría de sub-posición: CENTRAL, IZQUIERDA o DERECHA (DEF y MED comparten
patrón por cantidad de jugadores en la línea — una línea de 3 es toda
central, de 4 o 5 tiene un lateral/banda de cada lado; DEL tiene patrón
propio — 1 y 2 son todos centrales, 3 es punta-centro-punta). Un jugador de
categoría exacta no pierde nada; mismo tipo pero lado cambiado (ej. lateral
derecho de izquierdo) pierde 8%; tipo equivocado (central de lateral/banda o
viceversa) pierde 15%. Se aplica a la Fuerza Efectiva (decide el partido),
NUNCA a la Fuerza Equipo (se muestra antes de jugar, calibra al rival IA).

Alcance decidido con el usuario: la penalización aplica también al rival IA
(no solo a equipos humanos) — para que no fuera puro ruido aleatorio, la IA
ahora arma su plantel "a propósito" por categoría (elige, para cada slot, un
jugador cuyo `detailedPosition` encaje). Como resultado, la IA prácticamente
nunca dispara la penalización sobre sí misma (arma bien, como haría un buen
armador), así que **no hizo falta re-correr el script de balance** — la
Fuerza Efectiva del rival IA no cambió respecto a antes de D1.

- `js/config/formaciones.js` (+ copia `functions/juego/config/formaciones.js`,
  verificadas idénticas con `diff`): tabla de categorías por línea/cantidad;
  `slotsDeFormacion` ahora devuelve también `categoria` por slot;
  `categoriasLinea(position, cantidad)` (exportada, la usa `rivalIA.js`);
  `conCategorias(jugadores, position)` (exportada): adosa la categoría
  esperada por ÍNDICE a un array plano ya armado (jugadores rehidratados
  desde ids guardados) — asume el mismo orden que produce `slotsDeFormacion`,
  que es como TODOS los armadores de equipo del juego arman esos arrays.
- `js/core/formulas.js` (+ copia `functions/juego/core/formulas.js`,
  idénticas): `categoriaJugador(jugador)` (mapea `detailedPosition` a
  categoría), `factorPosicion(jugador)` (lee `jugador._categoriaSlot` —la
  esperada— vs `categoriaJugador(jugador)` —la real— y devuelve 1 / 0.92 /
  0.85), `calcularAtaqueTactico`/`calcularMediocampoTactico`/
  `calcularDefensaTactico` (variantes de `calcularAtaque`/etc. QUE SÍ
  penalizan — las usa `fuerzaEfectiva`; las de siempre, sin penalizar, siguen
  siendo las que usa `fuerzaEquipo`).
- `js/core/motor.js` (+ copia `functions/juego/core/motor.js`, idénticas):
  `fuerzaEfectiva` usa las variantes `*Tactico` en vez de las planas.
- **Todo lugar que arma un equipo para el motor** necesitó adosar
  `_categoriaSlot` a cada jugador (o la Fuerza Efectiva no tendría de dónde
  leer la categoría esperada):
  - `js/ui/partido.js` (`construirEquipoUsuario`, vs IA — tu propio equipo) y
    `functions/index.js` (`construirEquipoDesdeTeam`, amistosos): iteran
    `slotsDeFormacion` directo, adosan por el slot exacto.
  - `js/ui/torneos.js` (`equipoTorneoAMotor`) y `functions/index.js`
    (`equipoMotorDesdeDoc`): **se refactorizaron** para iterar
    `slotsDeFormacion` y leer `equipoDoc.xi[slot]` en vez de
    `Object.entries(equipoDoc.xi)` — no dependen de que Firestore preserve el
    orden de inserción del mapa, y de paso adosan la categoría por el slot
    exacto.
  - `js/core/partido.js` (`equipoDesdeIds`, re-verificación cliente),
    `functions/juego/core/verificar.js` (`equipoDesdeIds`, re-verificación
    servidor) y `js/ui/amistosos.js` (`equipoIdsAMotor`): rehidratan equipos
    desde arrays planos de ids (sin slot) — usan `conCategorias` por ÍNDICE.
  - `js/core/rivalIA.js`: `POOL_CAT` (pool de jugadores por posición +
    categoría, derivado de `detailedPosition`); `elegirUnoCerca`/
    `elegirLineaCerca` reemplazan a `elegirCerca` — arman cada línea slot por
    slot, por categoría, con un `Set` de excluidos para no repetir jugador;
    `construirCandidato` ahora recibe la `formacion` (no solo los `slots`) y
    arma con las categorías reales de esa formación.
- `js/ui/equipo.js` y `js/ui/torneos.js` (`pintarCancha`): aviso visual "⚠
  Fuera de posición (-15%)" / "⚠ Lado cambiado (-8%)" en el slot cuando el
  jugador puesto ahí no es de la categoría esperada.
- `css/estilos.css`: `.slot-fuera-posicion` (armado normal) y
  `.torneo-slot-aviso` (armado de torneo).
- `docs/Futbol_Figuritas_Proyecto_v3.md`: nueva §18.1.

**Fix de reproducibilidad encontrado en el propio testeo:** `equipoMotorDesdeDoc`
(servidor) y `equipoTorneoAMotor` (cliente) armaban los arrays de jugadores
iterando `Object.entries(equipoDoc.xi)`, cuyo orden depende de que Firestore
preserve el orden de inserción del mapa — no garantizado. Se cambiaron para
iterar siempre `slotsDeFormacion` (orden determinista) y leer `xi[slot]`
directo. De paso, `scripts/test-rival-ia.mjs` tenía un helper de equipo de
prueba que armaba jugadores sin pasar por ningún armador real (sin
formación, sin categoría adosada) — al agregar D1 la re-verificación por
semilla (test 5) empezó a fallar porque la reconstrucción desde ids SÍ
adosaba categoría por índice y la simulación original no. Se corrigió el
helper del test para que arme el equipo con `conCategorias`, como haría
`construirEquipoUsuario` en un 4-3-3 real.

### Cómo testear Grupo D1
1. `firebase deploy` (Cloud Functions modificadas: `construirEquipoDesdeTeam`
   y `equipoMotorDesdeDoc` cambiaron de forma, aunque el comportamiento hacia
   afuera es el mismo salvo la nueva penalización).
2. `node scripts/test-formaciones-mentalidades.mjs`,
   `node scripts/test-rival-ia.mjs` y `node scripts/test-relato.mjs` — deben
   dar `TODOS LOS TESTS OK` (la re-verificación por semilla del test 5 de
   `test-rival-ia.mjs` es la que ejercita justo este mecanismo).
3. En el armador de equipo (Competir → Armar Equipo), poner a propósito un
   defensor central en un slot de lateral → debe aparecer el aviso "⚠ Fuera
   de posición" en el slot.
4. Poner un lateral derecho en el slot de lateral izquierdo → debe aparecer
   "⚠ Lado cambiado" (penalización menor).
5. Jugar un partido vs IA con un equipo bien armado (todos en su categoría) y
   comparar informalmente contra el mismo equipo con 2-3 jugadores mal
   puestos — debería notarse un peor rendimiento, sin que se vuelva
   imposible ganar (el principio rector: nunca por encima del 87%).
6. En un torneo, armar el equipo con algún jugador fuera de su lado en la
   pantalla de armado (`pintarCancha`) → debe verse el mismo aviso ahí.

### Grupo D2 — hecho (esta sesión)
**7 mentalidades nuevas (4 ofensivas + 3 defensivas) + matriz de contras
ampliada de 4×3 a 8×6 + manual en pantalla propia.**

- `js/config/mentalidades.js` (+ copia `functions/juego/config/
  mentalidades.js`, verificadas idénticas con `diff`):
  - `MENTALIDADES_OF`: agregadas `CONTRAGOLPE`, `JUEGO_DIRECTO`,
    `ATAQUE_TOTAL`, `DESBORDE_INDIVIDUAL`.
  - `MENTALIDADES_DEF`: agregadas `CERROJO`, `LINEA_ADELANTADA`,
    `REPLIEGUE_TRAS_PERDIDA`.
  - `MATRIZ_BASE`: de 4×3 (12 celdas) a 8×6 (48). Las 12 originales no se
    tocaron. `setMatrizEscala` (ya genérico, itera `MATRIZ_BASE`) no
    necesitó cambios.
  - `compatAtaque`: DESBORDE_INDIVIDUAL suma la misma regla de amplitud que
    JUEGO_ABIERTO (necesita banda para encarar).
  - `compatDefensa`: CERROJO suma una regla de densidad central (más
    exigente que BLOQUE_COMPACTO — vive de tener gente atrás).
  - `CLAVES_OFENSIVA`/`CLAVES_DEFENSIVA` son `Object.keys(...)`, así que
    **no hizo falta tocar ningún otro archivo** para que las 7 mentalidades
    nuevas aparezcan en los selectores (`js/ui/equipo.js`,
    `js/ui/torneos.js`) ni para que el rival IA (`js/core/rivalIA.js`) las
    elija — todo ese código ya iteraba las listas dinámicamente.
- **Calibración** (`scripts/simular-balance.mjs`, criterio igual al de
  Etapa 5 — ninguna mentalidad > 40% de uso óptimo): el primer punto de
  partida de `ATAQUE_TOTAL` (ataque +14, medio +4) dominaba con 45-46% de
  uso óptimo — se bajó a ataque +9, medio +2 y se endureció su fila de
  matriz (peor contra BLOQUE_COMPACTO/CERROJO/REPLIEGUE). `CONTRAGOLPE`
  arrancó con frecuencia ×0.75 y quedaba casi sin uso (0-1%) — se suavizó
  a ×0.90 y se subió su calidad de ocasión a ×1.40 para compensar (subió a
  ~4% de uso óptimo entre las mentalidades con efecto; sigue siendo la más
  situacional a propósito — es fuerte específicamente contra rivales que
  se adelantan, floja contra los que nunca suben). Resultado final: máximo
  ofensivo 24-30%, máximo defensivo 24-27% (ambos muy por debajo del 40%),
  swing táctico total ~22 puntos de Fuerza Efectiva (dentro del objetivo
  ±10-12 de §5), y el techo de §33 (≤87% de probabilidad del favorito)
  sigue intacto porque no depende de la matriz de mentalidad.
- `js/ui/manual.js` (nuevo): pantalla propia con las 14 mentalidades (7
  originales + 7 nuevas), cada una con resumen, "Mejora", "Empeora" y un
  tip de a quién le gana/pierde — sin números, en criollo.
  `abrirManual(origen)` recuerda desde qué pantalla se abrió (equipo propio
  o torneo) para volver ahí, no siempre al mismo lugar.
- `index.html`: nueva sección `manualScreen`; botón "📖 Manual de
  mentalidades" en el armado normal (`teamScreen`) y en el selector de
  mentalidad de torneos.
- `js/ui/navegacion.js`: `showScreen("manualScreen")` llama a
  `renderManual()`.
- `js/ui/equipo.js`: `DESC_OFENSIVA`/`DESC_DEFENSIVA` (descripciones cortas
  del selector) con las 7 entradas nuevas; botón del manual conectado en
  `initTacticaEquipo`.
- `js/ui/torneos.js`: botón del manual conectado en los dos lugares donde
  se pinta el selector de mentalidad de torneo (armado y competencia).
- `js/main.js`: `initManual()` agregado a `arrancarJuegoUnaVez`.
- `css/estilos.css`: `.manual-link`, `.manual-intro`, `.manual-seccion`,
  `.manual-grid`, `.manual-card` y estilos de línea (`.manual-mejora` verde,
  `.manual-empeora` roja, `.manual-tip`).
- `docs/Futbol_Figuritas_Proyecto_v3.md`: nueva §19.6 con los mods, la
  matriz ampliada y la nota de diseño (el doc original decía "que lo
  descubra jugando, no leyendo un manual" — el grupo pidió lo contrario).

**Decisión técnica a recordar:** el sistema ya estaba armado para esto —
`CLAVES_OFENSIVA`/`CLAVES_DEFENSIVA` se derivan de `Object.keys(...)` en vez
de estar hardcodeadas, así que agregar mentalidades nuevas fue solo tocar
`config/mentalidades.js`. Ningún otro archivo del motor, la UI de selección
o el rival IA necesitó cambios de código — la única superficie nueva de
verdad fue el manual.

### Cómo testear Grupo D2
1. `firebase deploy` (los mods de mentalidad y la matriz corren tanto
   cliente como servidor — Cloud Functions cambiaron).
2. `node scripts/test-formaciones-mentalidades.mjs`,
   `node scripts/test-rival-ia.mjs`, `node scripts/test-relato.mjs` y
   `node scripts/simular-balance.mjs` — los tres primeros deben dar
   `TODOS LOS TESTS OK`; el último debe mostrar "máximo ofensivo" y "máximo
   defensivo" con ✓ (≤40%).
3. En el armado de equipo, abrir los selectores de mentalidad ofensiva y
   defensiva → deben aparecer las 7 opciones nuevas junto a las de siempre.
4. Tocar "📖 Manual de mentalidades" → se abre la pantalla nueva con las 14
   tarjetas; "← Volver" debe volver al armado de equipo.
5. Desde un torneo, en el selector de mentalidad de la fecha, tocar el
   mismo botón → debe volver al torneo (no al armado normal) al cerrar.
6. Jugar un partido vs IA eligiendo una mentalidad nueva (ej. Contragolpe)
   y confirmar que el partido corre sin errores y el resumen post-partido
   muestra el análisis táctico con la etiqueta correcta.

### Grupo E — hecho (esta sesión): tarjetas, penales, lesiones, banco de suplentes
**Cierra el plan grande post-plan.** Aplica a todos los tipos de partido
(vs IA, amistosos, torneos), salvo el banco/suspensiones/lesiones, que son
solo de torneos.

**Tarjetas y penales (motor, §27.1):**
- `js/config/motor.js` (+ copia, idénticas): `PROB_TARJETA` (0.19),
  `MULT_TARJETA_PRESION` (1.60 — el +60% que PRESIÓN ALTA Y RUDA ya
  documentaba desde la Etapa 5 sin estar implementado), `PROB_ROJA_DIRECTA`
  (0.02), `PENALIZACION_ROJA` (0.88, -12%, confirmado con el usuario),
  `PROB_PENAL`, `PENAL_PISO`/`PENAL_RANGO` (conversión de penal).
- `js/core/motor.js` (+ copia, idénticas): `simularPartido` evalúa, por
  cada posesión, si el equipo que DEFIENDE comete una falta (tarjeta) —
  independiente de si esa posesión fue gol/atajada/cortada. Dentro de la
  ocasión generada (Fase 2), una fracción chica se resuelve como penal en
  vez de remate normal. Nuevas funciones puras: `mejorPateador` (el
  delantero con mejor `shooting`, fijo — no se sortea como el goleador de
  juego) y `elegirJugadorFalta` (uniforme entre los jugadores de campo del
  equipo que defiende). La roja penaliza `fA`/`fB` UNA vez por equipo
  (mutación in-place, no se recalcula desde cero).
- `js/core/relato.js` + `js/data/plantillasRelato.js`: nuevos tipos de
  evento `TARJETA_AMARILLA`, `TARJETA_ROJA` (con `segundaAmarilla` para
  elegir la plantilla correcta) y el flag `esPenal` en `GOL`/`ATAJADA` (se
  reusa el mismo tipo de evento — así `derivarEstadisticas`/`calcularMVP`
  los cuentan automático, sin tocarlos). 5 juegos de ≥6 plantillas cada uno.

**Conflicto de calibración con el usuario (§33, resuelto):** la frecuencia
de penales pedida originalmente era "~1 cada 4-5 partidos" (la real del
fútbol). Medido con `scripts/simular-balance.mjs`: a esa frecuencia, un
penal convierte tan por encima del techo matemático de un remate abierto
(~31%, dado por `FACTOR_GOL`) que la cola de 5+ goles subía de 10.1% a
~11.8%, rompiendo el techo de §33 (≤11%, el "piso de Poisson" de la Etapa
5). Bajar la conversión del penal casi no ayudaba — la FRECUENCIA es la que
domina la cola, no cuánto convierte. El usuario, ante la disyuntiva
(relajar el techo del 11%, o recalibrar todo el motor, o priorizar el
techo), pidió priorizar el techo por ahora y anotar la recalibración
completa del motor como una tarea aparte para después de cerrar todas las
mejoras — ver la nota extensa en `js/config/motor.js` sobre `PROB_PENAL`.
Quedó en 1 penal cada ~23 partidos.

**Lesiones y banco de suplentes (solo torneos, §39.1):**
- `functions/index.js`:
  - `BANCO_TAMANIO = 5`. `equipoTorneoVacio` ahora incluye `banco: []`.
  - `reclamarSuplente`/`liberarSuplente` (nuevas Cloud Functions): mismo
    criterio de exclusividad (`jugadoresReclamados`) y Pool de Reserva
    (§37.1) que `reclamarJugador`/`liberarJugador`, pero sin atarse a un
    slot de formación. `reclamarJugador` ahora también saca al jugador del
    banco si estaba ahí (no puede estar en los dos a la vez).
  - `torneo.noDisponibles`: `{ [playerId]: { motivo, hastaFecha } }`.
    `suspensionesDePartido` (lee `TARJETA_ROJA` de los eventos del partido
    recién simulado → 1 fecha afuera) y `lesionesDePartido` (~1.5% por
    jugador que jugó, sorteado con un PRNG propio sembrado en la semilla
    del partido — no `Math.random()`, aunque acá no hace falta
    re-verificar como en el motor — 1 o 2 fechas afuera, nunca en el
    partido recién jugado).
  - `avanzarFecha`: antes de chequear XI completo, `autoSustituirNoDisponibles`
    reemplaza a cualquier titular no disponible para ESA fecha con un
    suplente de su misma posición que también esté disponible; si no hay
    ninguno, el slot queda vacío y cae en el bloqueo de "incompletos" que
    ya existía. La escritura de la auto-sustitución se difiere hasta
    DESPUÉS de todas las lecturas de la transacción (Firestore exige que
    todas las lecturas terminen antes de la primera escritura).
- `js/core/nube.js`: `reclamarSuplenteNube`/`liberarSuplenteNube`.
- `js/ui/torneos.js`: sección "Banco de suplentes (X/5)" en el armado
  (picker propio, sin Pool de Reserva expuesto en el cliente todavía —
  el servidor sí lo soporta); aviso "🚑 Suspendido/Lesionado: vuelve en…"
  en el slot del XI cuando corresponde (`avisoNoDisponible`).
- `firestore.rules`: no necesitó cambios — `torneos/{id}` y todas sus
  subcolecciones (incluida `equipos/{uid}`) ya tenían `allow write: if
  false` de punta a punta; los campos nuevos (`banco`, `noDisponibles`)
  quedan automáticamente protegidos, solo los escribe el Admin SDK.

**Decisión técnica a recordar:** las lesiones NO son un evento del motor —
si lo fueran, habría que simular sustituciones EN VIVO durante el partido
(sacar un jugador del array a mitad de simulación), mucho más invasivo. Se
resolvió como un sorteo aparte, post-partido, que solo importa para la
fecha SIGUIENTE — comparte el mismo mecanismo de "no disponible → banco
cubre" que las suspensiones, pero nunca toca el partido que se acaba de
jugar.

### Cómo testear Grupo E
1. `firebase deploy` (Cloud Functions nuevas/cambiadas: `reclamarSuplente`,
   `liberarSuplente`, `avanzarFecha`, `reclamarJugador`).
2. `node scripts/test-tarjetas-penales.mjs` (nuevo) → `TODOS LOS TESTS OK`
   (frecuencia de amarillas 3-5/partido, aparecen penales, reproducibilidad).
3. `node scripts/test-relato.mjs` → `TODOS LOS TESTS OK` (valida también
   los 5 tipos de plantilla nuevos y que las tarjetas nombren al jugador
   correcto).
4. `node scripts/simular-balance.mjs` → "¿cumple §33? ✓ SÍ" (el 5+ goles
   tiene que dar ≤11%).
5. Jugar varios partidos vs IA o amistosos → deberían aparecer tarjetas
   amarillas cada tanto en el relato (es frecuente, ~4/partido); rojas y
   penales son más raros, puede llevar varios partidos verlos.
6. En un torneo, armar el banco de suplentes (sección nueva en el armado) →
   agregar hasta 5 jugadores, confirmar que respeta la exclusividad (no se
   puede agregar uno que otro participante ya reclamó).
7. Si en un partido de torneo un jugador ve la roja, confirmar que en la
   ventana entre fechas aparece "🚑 Suspendido" en su slot, y que al jugar
   la fecha siguiente el sistema lo cubre solo con un suplente de su
   posición (si hay uno en el banco) o bloquea con "incompletos" (si no
   hay).
8. Las lesiones son muy raras (~1.5% por jugador por partido) — difícil de
   ver sin subir `PROB_LESION` temporalmente en `functions/index.js` para
   probar a mano.
