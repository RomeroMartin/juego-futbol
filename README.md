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

## Estructura del proyecto

```
index.html            Punto de entrada (carga js/main.js como módulo)
css/estilos.css       Estilos
js/
  main.js             Enganche de eventos y arranque
  config/
    economia.js       Valores de economía y balance (§15.7)
    formaciones.js    Formaciones como dato (§17)
  data/
    jugadores.js      Plantel (modelo de §8)
  core/
    estado.js         Estado en memoria de la partida
    storage.js        Persistencia en localStorage + migración de datos (§52)
    calculos.js       Fórmulas de stats de equipo (§20)
  ui/
    componentes.js    Carta de jugador y helpers de UI
    navegacion.js     Cambio de pantalla y header
    paquetes.js       Apertura y render de paquetes
    coleccion.js      Vista de colección
    equipo.js         Constructor del XI

docs/                 Documento maestro y plan de etapas
ESTADO.md             Estado de la última etapa completada
```

## Persistencia

Los datos se guardan en `localStorage` del navegador. Firebase llega en la
Etapa 7.
