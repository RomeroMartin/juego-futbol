# ESTADO — Después de la Etapa 9A (Torneos: sala) 🏆

> **Última sesión: Etapa 9A** (crear torneo, unirse por código, abrir armado con
> validación de pool). Falta **9B** (reclamar jugadores con exclusividad, pool de
> reserva, congelado del XI). El detalle de la Etapa 9A está en la **sección 7**,
> al final. Lo de abajo (secciones 1–6) es de la Etapa 8 y sigue vigente.

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
