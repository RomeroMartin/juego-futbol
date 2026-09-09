# ESTADO — Después de la Etapa 7 (Firebase: auth + migración) ☁️

> Etapa del plan completada: **7**. Base: Etapas 0–6 ya en `main`.
> El juego ahora tiene login y guarda la partida en la nube (Firestore). Sigue
> corriendo con Live Server / servidor estático, sin npm ni build. La única
> dependencia externa nueva es el SDK de Firebase, cargado como módulo ES desde
> el CDN de gstatic (permitido a partir de esta etapa, ver CLAUDE.md).

## 1. Qué se implementó

- **Firebase Authentication**: email/password y Google. El juego queda detrás de
  un overlay de login; sin sesión no se entra. Botón "Salir" en el header.
- **Firestore como almacén de la partida** (reemplaza a `localStorage`), con la
  estructura de §51:
  - `users/{uid}` → perfil (§44) + monedas + contadores de pity + inventario de sobres.
  - `users/{uid}/collection/{playerId}` → `{ playerId, quantity, obtenidoEn }`.
  - `users/{uid}/teams/actual` → formación + XI (ids) + mentalidades.
  - `users/{uid}/historial/{id}` → resumen de cada partido.
- **Migración automática y silenciosa `localStorage` → Firestore** en el primer
  login de cada navegador: si había una partida vieja (pre-Etapa 7), se sube una
  sola vez y se marca como migrada (`futbolFiguritasMigradoNube`).
- **Reglas de seguridad** (`firestore.rules`): cada usuario lee/escribe **solo lo
  suyo**; catálogo (`players`/`clubs`) de solo lectura; `torneos`/`matches`
  bloqueados hasta las Etapas 9–10.
- **Separación catálogo/inventario (§54)** llevada a la nube: la colección guarda
  solo el `playerId`; el jugador completo se rehidrata desde el catálogo local
  (`data/jugadores.js`) al leer. **No se guardan stats calculadas** (§51.1).

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `js/config/firebase.js` | `firebaseConfig` + init. Exporta `app`, `auth`, `db`. Acá van las claves del proyecto (la `apiKey` web es pública, no secreta). |
| `js/core/auth.js` | Envuelve Firebase Auth: `observarSesion`, `registrarConEmail`, `entrarConEmail`, `entrarConGoogle`, `salir`, `usuarioActual`, `mensajeDeError` (códigos → español). |
| `js/core/nube.js` | **Capa de datos Firestore.** `leerPartida(uid)`, `escribirPartidaCompleta(uid, estado, perfil)` (creación/migración), `guardarPartida(estado)` (incremental, lo que llama la UI), `agregarHistorialNube`, `reiniciarCacheNube`. Escritura por **delta** de la colección + guardados **encolados**. |
| `js/ui/login.js` | Pantalla de login/registro (pestañas, Google, estados de carga y error). No carga datos: eso lo dispara `main.js`. |
| `firestore.rules` | Reglas de seguridad para pegar en la consola de Firebase. |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/core/estado.js` | `estado` ya NO se carga al importar: arranca vacío y se **hidrata async** tras el login (`hidratarDesdeNube(user)`), mutando SIEMPRE el mismo objeto. Nuevos: `limpiarEstado()` (logout), `agregarAlHistorial`/`cargarHistorial` (historial en memoria + persistencia en la nube). |
| `js/core/storage.js` | Deja de ser el almacén: `localStorage` queda SOLO como origen de la migración. Se quitaron `guardarPartida` y `agregarAlHistorial`. Nuevos: `leerPartidaLocal`, `hayDatosLocales`, `yaMigrado`, `marcarMigrado`. Se mantienen `migrar()`, `sincronizarDataset()`, `equipoVacio()` y los `cargar*` (usados por la migración). |
| `js/main.js` | Arranque **asíncrono** con gate de login: `observarSesion` → si hay usuario, hidrata y muestra el juego; si no, muestra el login. Los `initX()` de juego corren una sola vez tras la primera hidratación. |
| `js/ui/partido.js` | `agregarAlHistorial`/`cargarHistorial` ahora vienen de `estado.js`; `guardarPartida` de `nube.js`. |
| `js/ui/{tienda,paquetes,coleccion,equipo}.js` | `guardarPartida` reapuntado de `storage.js` → `nube.js` (sin otros cambios). |
| `index.html` | Overlay de login (`#authOverlay`) + nombre de usuario y botón "Salir" en el header. |
| `css/estilos.css` | Estilos del login (overlay, card, tabs, inputs, spinner, error) y del botón de salir, con la paleta verde existente. |
| `README.md` | Sección de puesta a punto de Firebase (plan gratuito) + estructura actualizada. |

## 3. Decisiones técnicas que conviene recordar

- **🔑 El catálogo (`players`/`clubs`) NO se subió a Firestore todavía.** El motor
  de partido y la economía leen el plantel de forma **síncrona** desde
  `data/jugadores.js`; moverlo a Firestore obligaría a reescribir el motor a
  async sin beneficio en esta etapa, y el dataset es privado (§negocio). El seed
  del catálogo a Firestore se hace en la **Etapa 8**, que es cuando las Cloud
  Functions lo necesitan del lado del servidor para abrir paquetes. Las reglas ya
  contemplan el catálogo (solo lectura) para no tener que tocarlas de nuevo.
- **La economía sigue corriendo en el CLIENTE (§15.0).** Etapa 7 es auth +
  persistencia; el cliente todavía se acredita fichas y abre paquetes con
  `Math.random`. Por eso las reglas permiten al dueño **escribir** su colección y
  fichas. La **Etapa 8** mueve eso a Cloud Functions y endurece las reglas
  (`allow write: if false` para colección/fichas/puntos; solo el Admin SDK).
- **`estado` es un singleton que se muta in-place, nunca se reasigna.** Todos los
  módulos de UI importaron el objeto una vez; `hidratarDesdeNube`/`limpiarEstado`
  reescriben sus propiedades para que sigan viendo los datos correctos sin
  reimportar. Si en el futuro alguien hace `estado = ...`, rompe todo.
- **`guardarPartida(estado)` es fire-and-forget y encolado.** La UI la llama sin
  `await` (igual que antes). Internamente serializa los guardados (`cadenaGuardado`)
  para que dos llamadas seguidas no se pisen, y escribe **solo el delta** de la
  colección (las cartas cuya `quantity` cambió), más el doc de usuario y el de
  equipo (chicos). `obtenidoEn` se fija una vez, al entrar la carta.
- **`reiniciarCacheNube()` al cerrar/cambiar de sesión.** La caché del delta es
  por navegador; sin reiniciarla, el delta de un usuario se filtraría al
  siguiente que entre en la misma pestaña.
- **Migración local:** se dispara solo si el usuario es nuevo en la nube, no migró
  antes en ese navegador y hay datos locales reales (colección/paquetes/historial,
  no solo el usuario por defecto). El primero que entra en un navegador "adopta"
  la partida local; es el comportamiento esperado entre amigos.
- **SDK de Firebase pineado a `10.12.2`** (regla de pinear versiones). Se importa
  por URL de gstatic en `config/firebase.js`, `core/auth.js` y `core/nube.js`.

## 4. Cómo testear (criterio del plan, Etapa 7)

> Requiere haber hecho la puesta a punto de Firebase del README (auth + Firestore
> + reglas publicadas). Servir con Live Server y abrir `localhost`.

1. **Crear cuenta** (email/password o Google) → arma un XI → jugá un partido.
2. **Cerrar sesión y volver a entrar**: la colección, fichas, equipo e historial
   siguen ahí.
3. **Entrar desde otro navegador** con la misma cuenta: los datos están.
4. **Aislamiento**: con la cuenta A logueada, intentar leer `users/{uid_de_B}`
   desde la consola del navegador → la lectura falla (reglas de seguridad).
5. **Migración**: en un navegador con una partida vieja en `localStorage`
   (pre-Etapa 7), al crear/entrar por primera vez la partida aparece en la nube.

Tests headless de etapas anteriores: siguen **en verde**
(`test-economia`, `test-formaciones-mentalidades`, `test-rival-ia`, `test-relato`).
No cubren Firebase (requiere navegador + proyecto real).

## 5. Pendientes conocidos (no son de esta etapa)

- **Seed del catálogo `players`/`clubs` a Firestore** → Etapa 8 (lo consumen las
  Cloud Functions). Hoy el catálogo es local.
- La entrega de valor (abrir paquete, fichas, puntos) sigue en el cliente →
  Etapa 8 la mueve a Cloud Functions y bloquea la escritura del cliente.
- **Firebase Hosting**: opcional. Para publicar online, agregar el dominio en
  Authentication → Authorized domains.
- `favicon.ico` sigue faltando (404 inofensivo, viene de antes).

## 6. Advertencias para la próxima etapa (Etapa 8 — Cloud Functions)

> ⚠️ **Decisión previa del creador:** activar el **plan Blaze** (§50.1). Cloud
> Functions no corre en el plan gratuito.

- La lógica que otorga valor ya está aislada en funciones **puras** de
  `core/economia.js` (`abrirPaquete`, `registrarResultadoEconomia`,
  `comprarPaquete`, `venderRepetido`). La Etapa 8 las mueve al servidor **sin
  reescribir la lógica**, solo cambiando quién las ejecuta.
- Para abrir paquetes del lado del servidor, la Function necesita el catálogo:
  **ahí se sube `players`/`clubs` a Firestore** (o se empaqueta el dataset con la
  Function). Recién entonces conviene hacer que el cliente lea el catálogo de la
  nube, si se quiere.
- **Endurecer `firestore.rules`**: cambiar el `allow write` del dueño sobre
  `collection`, `monedas`/fichas y puntos a `if false`; esos campos pasan a
  escribirse solo por Admin SDK. El resto (equipo, mentalidades) puede seguir
  siendo escribible por el dueño.
- El guardado incremental de `nube.js` da por sentado que el cliente manda la
  colección entera en `estado.collection`. Cuando el servidor sea el dueño de la
  colección, el cliente dejará de escribirla: revisar `guardarPartida` para que no
  intente pisar lo que ahora controla la Function.
- Verificación de partidos por semilla (§53.1): el registro de partido ya lleva
  `semilla`; la Function puede re-simular y validar.
