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
    economia.js       Valores de economía y balance (§15.7)
    formaciones.js    Formaciones como dato (§17)
    dataset.js        Versión del plantel activo (para el reset de colección)
  data/
    jugadores.js      Plantel real, GENERADO (modelo de §8, rareza §11.2)
  core/
    estado.js         Estado en memoria de la partida
    storage.js        Persistencia en localStorage + migración (§52) + reset de dataset
    calculos.js       Fórmulas de stats de equipo (§20)
  ui/
    componentes.js    Carta de jugador y helpers de UI
    navegacion.js     Cambio de pantalla y header
    paquetes.js       Apertura y render de paquetes
    coleccion.js      Vista de colección
    equipo.js         Constructor del XI
scripts/
  lib/dataset.js      Lógica compartida (parseo CSV, mapeo de posiciones, rareza)
  analizar-pool.js    Análisis del pool (histograma, rareza) — no es del juego
  convertir-dataset.js Genera js/data/jugadores.js desde el CSV — no es del juego
data-raw/             CSV crudo (NO versionado, ver arriba)

docs/                 Documento maestro y plan de etapas
ESTADO.md             Estado de la última etapa completada
```

## Persistencia

Los datos se guardan en `localStorage` del navegador. Firebase llega en la
Etapa 7.
