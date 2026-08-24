# ESTADO — Después de la Etapa 1 (Datos reales y rareza)

> Etapa del plan completada: **1**. Base: la Etapa 0 ya está en `main`.

## 1. Qué se implementó en esta etapa

- **Dataset real de la Liga Profesional argentina.** Se reemplazó el plantel de
  prueba de 18 jugadores por los **869 reales** (30 clubes), extraídos del CSV
  de EA FC 26.
- **`scripts/convertir-dataset.js`** — genera `js/data/jugadores.js` desde el
  CSV: filtra la liga argentina, mapea al modelo §8 y asigna rareza por
  percentiles (§11.2).
- **`scripts/analizar-pool.js`** — análisis del pool (total, por posición con
  foco en arqueros, por rareza, histograma de Overall). Fue el primer
  entregable, antes de congelar la rareza.
- **`scripts/lib/dataset.js`** — lógica compartida por ambos scripts (parseo
  CSV, mapeo de posiciones, rareza). Única copia del mapeo, para que no se
  desincronice.
- **Rareza por percentiles (§11.2)** precalculada en cada jugador (campo
  `rarity`). La carta de UI ahora usa `player.rarity`.
- **Reset explícito y avisado de la colección**: al detectar que el plantel
  cambió, se resetea la partida al estado inicial y se le muestra al usuario un
  aviso ("el plantel se actualizó… tu colección se reinició").
- README con la fuente del dataset (Kaggle) y cómo regenerarlo.

### Verificación del pool (checkpoint del histograma)

El pool real **coincide casi exacto** con lo que asume §11 — **no hizo falta
recalibrar** §11 ni §14:

| | Pool real | §11 espera |
|---|---|---|
| Total | 869 | ~869 |
| Clubes | 30 | ~30 |
| OVR (mín/máx/media/mediana) | 50 / 82 / 67.6 / 68 | tope ~82, sin 85+ |
| Arqueros | 88 | ≥60 (test) |
| LEYENDA / ESTRELLA / DESTACADO / ORO / COMÚN | 8 / 35 / 130 / 261 / 435 | 9 / 35 / 130 / 260 / 435 |

## 2. Archivos y qué hace cada uno

Nuevos:

| Archivo | Qué hace |
|---|---|
| `scripts/lib/dataset.js` | Tooling Node (CommonJS): parseo CSV, `MAPA_POSICION`, `asignarRarezas` (§11.2). Única copia de esa lógica. |
| `scripts/analizar-pool.js` | Reporta la composición del pool. Se corre con `node scripts/analizar-pool.js`. |
| `scripts/convertir-dataset.js` | Genera `js/data/jugadores.js` desde el CSV. `node scripts/convertir-dataset.js`. |
| `js/config/dataset.js` | `DATASET_VERSION` del plantel activo (dispara el reset de colección). |
| `.gitignore` | Ignora `data-raw/` (CSV con licencia de EA, §10.2). |
| `data-raw/EAFC26Men.csv` | CSV crudo. **NO versionado.** Se baja de Kaggle (ver README). |

Modificados:

| Archivo | Cambio |
|---|---|
| `js/data/jugadores.js` | **Regenerado**: 869 jugadores reales, modelo §8 + `detailedPosition`, rareza precalculada. Archivo generado, no editar a mano. |
| `js/core/storage.js` | `sincronizarDataset()`: reset explícito de la colección cuando cambia el plantel. |
| `js/core/estado.js` | Corre `sincronizarDataset()` antes de cargar; exporta `datasetReseteado`. |
| `js/main.js` | Muestra el aviso de reset si `datasetReseteado`. |
| `js/ui/componentes.js` | La carta usa `player.rarity` (fallback a `getRarity`). |
| `index.html` + `css/estilos.css` | Aviso de reset de colección (banner descartable). |
| `README.md` | Sección Dataset: URL de Kaggle, archivo, cómo regenerar. |

## 3. Decisiones técnicas que conviene recordar

### 3.1. Liga argentina = `"LPF"` en el dataset
De las 45 ligas del CSV, la argentina figura como **`LPF`** (869 jugadores, 30
clubes). Ojo: `Libertadores` y `Sudamericana` son torneos continentales con
clubes de otros países — **no** entran.

### 3.2. Mapeo de posiciones: 4 categorías + se guarda la granular
El dataset trae 12 posiciones granulares (GK, CB, RB, LB, CDM, CM, CAM, LM, RM,
ST, LW, RW). El juego usa 4 (§9). Mapeo (decisión de esta etapa, **estándar**):
- `GK→POR` · `CB/RB/LB→DEF` · `CDM/CM/CAM/LM/RM→MED` · `ST/LW/RW→DEL`.
- **Además se guarda la posición granular en `detailedPosition`** para no perder
  el dato. No se descartó nada del dataset. Queda disponible para un eventual
  sistema de posiciones más rico (§18, posiciones secundarias) sin reconvertir.
- El mapeo vive en **un solo lugar**: `scripts/lib/dataset.js`.

### 3.3. `id` = ID de EA (numérico)
El `id` es la columna `ID` del dataset (numérico, único, estable). Sigue siendo
numérico, como venía de la Etapa 0.

### 3.4. `jugadores.js` es `.js`, NUNCA `.json`
El conversor genera `export const JUGADORES = [...]`. Un `.json` obligaría a
`fetch()` async y a volver asíncrono todo el arranque, sin ganancia. **Que la
Etapa siguiente no lo cambie por inercia.**

### 3.5. Reset de colección por versión de dataset
`js/config/dataset.js` tiene `DATASET_VERSION`. Al cargar, `sincronizarDataset()`
compara con lo guardado; si difiere, resetea colección/equipo/paquetes al estado
inicial y sella la nueva versión. Solo avisa si el usuario **tenía** datos (a un
usuario nuevo no se le muestra nada). El "estado inicial" es el de hoy (colección
vacía + paquetes de bienvenida de `ECONOMIA`); los **5 paquetes de bienvenida
reales (§13.1) son de la Etapa 6**.

### 3.6. Los scripts son CommonJS; el juego es ESM
`scripts/` es tooling de Node (CommonJS, corre sin config ni npm). `js/` es
módulos ES para el navegador. Es una separación deliberada.

## 4. Pendientes / diferido

- `shortName` y `clubId` quedan en `null` (los clubes como catálogo son §55).
- La rareza `"COMUN"` se guarda sin tilde, tal como el código de §11.2. Es solo
  el string interno.
- Las **probabilidades de paquete (§14)** NO se tocaron: la generación de
  paquetes sigue siendo aleatoria uniforme desde el pool (heredado). El sistema
  de probabilidades por rareza y los pity (§13, §14) son de la Etapa 6.

## 5. Advertencias para la próxima etapa (Etapa 2 — Motor de partido)

- La Etapa 2 es el **motor de partido headless**. Regla dura: **prohibido
  `Math.random()` en el motor** — se usa `mulberry32` con semilla (§23). (El
  `Math.random()` que hay en la generación de paquetes NO es del motor y queda
  como está hasta la Etapa 6.)
- El histograma ya validó §11 y §14 en cuanto a distribución del pool. Las
  probabilidades de paquete de §14 se validan por **simulación** (§33) recién
  cuando exista el motor.
- `detailedPosition` está disponible en cada jugador si el motor quisiera
  distinguir perfiles, pero el motor de §22–§26 trabaja con las **4 categorías**.
- Para regenerar el plantel: dejar el CSV en `data-raw/` y correr
  `node scripts/convertir-dataset.js` (ver README). El CSV no está versionado.

## 6. Cómo testear que esta etapa quedó bien

1. `node scripts/analizar-pool.js` corre y muestra los números (869 / 30 clubes
   / 88 arqueros / las 5 rarezas pobladas).
2. Servir el juego y abrir paquetes: salen **jugadores reales** (nombres y
   clubes de la Liga Profesional) con su rareza.
3. Un usuario que venía de la V0.3 ve el aviso de reset y su colección arranca
   vacía; un usuario nuevo no ve ningún aviso.
4. Recargar no vuelve a mostrar el aviso ni pierde datos.

Verificado con Chromium: reset + aviso para usuario viejo, sin aviso para nuevo,
paquetes con datos reales, sin errores de consola.
