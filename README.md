# Fútbol Figuritas

Juego web de colección y competencia de fútbol argentino, para jugar entre
grupos cerrados de amigos.

## Cómo levantarlo

El juego está hecho con **módulos ES nativos**, así que hay que servirlo desde
un **servidor estático local**. No se abre con doble clic sobre `index.html`
(`file://`): bajo ese protocolo el navegador bloquea la carga de módulos por
CORS y no arranca nada.

No hace falta instalar dependencias, ni compilar, ni npm. Solo servir la
carpeta. Elegí cualquiera de estas opciones:

### Opción A — VS Code + Live Server (recomendada)

1. Instalá la extensión **Live Server** en VS Code.
2. Abrí la carpeta del proyecto.
3. Click derecho sobre `index.html` → **Open with Live Server**.

### Opción B — Python (viene preinstalado en la mayoría de los sistemas)

```bash
python3 -m http.server 8000
```

Después abrí `http://localhost:8000` en el navegador.

### Opción C — Node

```bash
npx serve .
```

(Requiere Node, pero es solo el servidor estático: el juego no usa npm ni
paquetes.)

## Dataset

El plantel real (`js/data/jugadores.js`) se genera a partir de un CSV de EA FC 26.

- **Fuente (Kaggle):** https://www.kaggle.com/datasets/flynn28/eafc26-player-database
- **Archivo:** `EAFC26Men.csv`
- **Ubicación:** se deja en `data-raw/EAFC26Men.csv`.

`data-raw/` está en `.gitignore` **a propósito**: los ratings y nombres son
propiedad de EA Sports (§10.2), así que el CSV **no se versiona**. Si se pierde,
se vuelve a bajar de la URL de arriba y se deja en `data-raw/`.

### Regenerar el plantel

```bash
# 1. (una vez) dejar el CSV en data-raw/EAFC26Men.csv
# 2. inspeccionar el pool (opcional, para ver el histograma):
node scripts/analizar-pool.js
# 3. generar js/data/jugadores.js:
node scripts/convertir-dataset.js
```

El conversor filtra la Liga Profesional argentina (`LPF` en el dataset: 869
jugadores, 30 clubes), mapea al modelo de §8 y asigna rareza por percentiles
(§11.2). **Genera un módulo `.js`, nunca un `.json`** (ver `ESTADO.md`).

> Si el plantel cambia (ids distintos), subí `DATASET_VERSION` en
> `js/config/dataset.js`: el juego detecta el cambio, resetea la colección
> guardada y le avisa al usuario.

## Estructura del proyecto

```
index.html            Punto de entrada (carga js/main.js como módulo)
css/estilos.css       Estilos
js/
  main.js             Enganche de eventos y arranque
  config/
    economia.js       Valores de economía y balance (§13, §14, §15.7)
    formaciones.js    Formaciones como dato (§17)
    dataset.js        Versión del plantel activo (para el reset de colección)
    firebase.js       Claves e init de Firebase (Etapa 7) — única dependencia externa
  data/
    jugadores.js      Plantel real, GENERADO (modelo de §8, rareza §11.2)
  core/
    estado.js         Estado en memoria + hidratación async tras el login
    auth.js           Login/registro/Google/logout (Firebase Auth, Etapa 7)
    nube.js           Persistencia en Firestore (§51) — reemplaza al guardado local
    storage.js        Lectura de localStorage SOLO para migrar a la nube (§52, §44)
    economia.js       Economía pura y testeable (paquetes, pity, Fichas, puntos, tienda)
    calculos.js       Fórmulas de stats de equipo (§20)
  ui/
    login.js          Pantalla de login/registro (Etapa 7)
    componentes.js    Carta de jugador y helpers de UI
    navegacion.js     Cambio de pantalla y header
    paquetes.js       Inventario, apertura y render de paquetes
    tienda.js         Tienda de paquetes por Fichas (§15.5)
    coleccion.js      Vista de colección + venta de repetidos
    equipo.js         Constructor del XI
firestore.rules       Reglas de seguridad de Firestore (pegar en la consola)
scripts/
  lib/dataset.js      Lógica compartida (parseo CSV, mapeo de posiciones, rareza)
  analizar-pool.js    Análisis del pool (histograma, rareza) — no es del juego
  convertir-dataset.js Genera js/data/jugadores.js desde el CSV — no es del juego
  test-economia.mjs   Tests headless de la economía (§13, §14, §15)
  test-*.mjs          Otros tests headless por consola (motor, rival IA, relato)
data-raw/             CSV crudo (NO versionado, ver arriba)

docs/                 Documento maestro y plan de etapas
ESTADO.md             Estado de la última etapa completada
```

## Firebase (Etapa 7)

Desde la Etapa 7 el juego usa **Firebase** (Authentication + Firestore) para el
login y para guardar la partida en la nube. Es la **única dependencia externa**
del proyecto y se carga como módulo ES desde el CDN de Google: sigue sin npm, sin
build y sin instalar nada. Para 10 amigos alcanza y sobra con el **plan gratuito
(Spark)**; el plan Blaze recién hace falta en la Etapa 8 (Cloud Functions).

### Puesta a punto en la consola de Firebase (una sola vez)

1. **Crear el proyecto** en https://console.firebase.google.com (podés desactivar
   Google Analytics).
2. **Registrar una app Web** (ícono `</>`). Copiar el objeto `firebaseConfig` y
   pegarlo en `js/config/firebase.js` (ya está cargado el del proyecto actual).
   ⚠️ La `apiKey` web **no es secreta**: es pública y va en el frontend. Lo que
   protege los datos son las reglas de Firestore y el login.
3. **Authentication → Sign-in method:** habilitar **Email/Password** y **Google**
   (elegí un email de soporte).
4. **Firestore Database → Create database** en modo *Production*, ubicación
   `southamerica-east1` (São Paulo). ⚠️ La ubicación no se puede cambiar después.
5. **Reglas de seguridad:** Firestore → pestaña *Rules* → pegar TODO el contenido
   de [`firestore.rules`](firestore.rules) → *Publicar*.

Para probar en `localhost` no hace falta nada más: ese dominio ya viene
autorizado para el login de Google. Al publicar el juego con Firebase Hosting,
agregá el dominio en Authentication → Settings → Authorized domains.

### Cómo se guardan los datos

- **Cada usuario ve solo lo suyo** (reglas de `firestore.rules`).
- La colección guarda solo el **id** del jugador y la cantidad; el jugador
  completo se rehidrata desde el catálogo local (§54). En el equipo **no** se
  guardan stats calculadas (§51.1): se recalculan siempre.
- La **primera vez** que entrás con tu cuenta, si tenías una partida vieja en
  `localStorage` (de antes de la Etapa 7), se migra automáticamente a la nube.

### Estructura en Firestore (§51)

```
users/{uid}                       perfil + monedas + pity + inventario de sobres
users/{uid}/collection/{playerId} { playerId, quantity, obtenidoEn }
users/{uid}/teams/actual          formación + XI (ids) + mentalidades
users/{uid}/historial/{id}        resumen de cada partido
```
