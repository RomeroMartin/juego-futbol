# ESTADO — Después de la Etapa 0 (Auditoría y alineación)

> Código base: **V0.3** (versión del código). Etapa del plan completada: **0**.
> Recordá: "V0.3" es la versión del CÓDIGO; "Etapa N" es del plan de trabajo.
> No están relacionados.

## 1. Qué se implementó en esta etapa

La Etapa 0 era alinear el código existente con el documento maestro, **sin
features nuevas** ni cambios visuales de fondo. Se hizo todo lo de §Etapa 0:

- **Reorganización a módulos ES nativos.** El `app.js` monolítico (2121 líneas)
  se repartió en módulos con `import`/`export`. `index.html` carga
  `js/main.js` con `<script type="module">`.
- **Fórmulas de Ataque / Mediocampo / Defensa corregidas según §20**, con la
  ponderación explícita del arquero (línea 75% / arquero 25%) y el
  `console.assert` de pesos de §20.0.
- **Valoración derivada de las tres áreas (§20.4)** en vez del promedio de OVR.
  Se agregó el **OVR medio del plantel** como dato de colección aparte y
  etiquetado, con su fila propia en la pantalla de equipo.
- **`schemaVersion` + `migrar()` funcionando (§52).** Toda colección leída de
  `localStorage` pasa por `migrar()`; una guardada con el modelo viejo se
  normaliza al modelo §8 (campos nuevos en `null`).
- **Se eliminó "Utilizado / Disponible" (§16.2).** Las copias no se bloquean:
  un jugador puede estar en todos los equipos a la vez. La única traba es no
  repetir la misma identidad dentro del mismo XI (§16.3).
- **`config/economia.js` (§15.7)** con todos los valores centralizados.
- **Modelo de jugador completo (§8)**: todos los campos existen, los nuevos en
  `null`.
- **`config/formaciones.js` (§17)** con la 4-3-3 modelada con estructura
  completa (ver decisión 3.2).

## 2. Archivos y qué hace cada uno

Nuevos / reorganizados:

| Archivo | Qué hace |
|---|---|
| `index.html` | Punto de entrada. Carga `js/main.js` como módulo. Se le agregó la fila "OVR medio del plantel". |
| `css/estilos.css` | (era `style.css`) Estilos. Se agregó el bloque `.ovr-medio-nota`. |
| `js/main.js` | Enganche de eventos y arranque. Reguarda el estado migrado al cargar. |
| `js/config/economia.js` | Valores de economía y balance (§15.7). Solo se usa `paquetesBienvenida` en esta etapa. |
| `js/config/formaciones.js` | Formaciones como dato (§17). Solo 4-3-3, estructura completa. |
| `js/data/jugadores.js` | (era `players.js`) Plantel de prueba con modelo §8. `export const JUGADORES`. |
| `js/core/estado.js` | Estado mutable en memoria + helpers de acceso (jugadores del XI, conteos). |
| `js/core/storage.js` | Persistencia en `localStorage` + `SCHEMA_VERSION_ACTUAL` + `migrar()` (§52). |
| `js/core/calculos.js` | `PESOS` + assert (§20.0), scores y stats de área (§20.1–20.3), valoración derivada (§20.4), OVR medio, `validateTeam` (lee slots de la formación). |
| `js/ui/componentes.js` | Carta de jugador, `getRarity` (provisional), nombres/íconos de posición. |
| `js/ui/navegacion.js` | Cambio de pantalla (`showScreen`) y header (`updateHeader`). |
| `js/ui/paquetes.js` | Apertura y render de paquetes. |
| `js/ui/coleccion.js` | Vista de colección y sus filtros. |
| `js/ui/equipo.js` | Constructor del XI, render de cancha, stats, filtros. |

Docs:

| Archivo | Qué hace |
|---|---|
| `README.md` | **Nuevo.** Cómo levantar el juego con servidor estático (Live Server / Python / Node) y estructura del proyecto. |
| `CLAUDE.md` | Actualizado el stack: módulos ES, se sirve con servidor local (ya no doble clic). |
| `ESTADO.md` | Este archivo. |

Eliminados: `app.js`, `players.js`, `style.css` (su contenido se repartió).

## 3. Decisiones técnicas que conviene recordar

### 3.1. Módulos ES + servidor local (NO doble clic)
Se pasó a `<script type="module">` con `import`/`export`. Consecuencia: el juego
**ya no se abre con doble clic** sobre `index.html` (`file://` bloquea los
módulos por CORS). **Hay que servirlo con Live Server o cualquier servidor
estático** (ver `README.md`). Sigue sin bundlers, sin transpiladores y sin npm:
módulos nativos y nada más. La regla vieja de "abrir index.html" en `CLAUDE.md`
quedó reemplazada.

### 3.2. `formaciones.js` con estructura completa de §17
Aunque en esta etapa solo existe la 4-3-3, se modeló con **toda** la estructura
de §17 (`slots`, `amplitud`, `densidadCentral`, `mod`) con los valores del
documento. Los campos `amplitud`, `densidadCentral` y `mod` **no se usan
todavía** (llevan comentario). `validateTeam` **solo lee `slots`**. Así la
Etapa 5 suma entradas al objeto sin refactorizar la estructura.

### 3.3. `id` numérico — NO se migró a string
El `id` de jugador queda **numérico** en esta etapa. No se pasó a string
(`"arg_00147"` de §8) porque en la **Etapa 1** la colección guardada se
**resetea** de todos modos: referencia jugadores de prueba que dejan de existir
cuando entra el dataset real. No es una migración de formato de id, es un reset,
y se resuelve allá.

### 3.4. `migrar()` está implementado y funcionando (no es un stub)
Sigue el patrón de §52 (cadena `0→1→2→3`). El único paso con cambio real en
esta etapa es `0→1` (modelo de jugador V0.3 → modelo §8: agrega los campos
faltantes en `null`). Los pasos `1→2` y `2→3` solo suben el número de versión;
los cambios que definen (p. ej. `fichas → monedas.fichas`, §48.3) pertenecen a
etapas posteriores. Probado: un jugador sin `schemaVersion` termina en
`schemaVersion: 3` con los 13 campos §8 en `null` y las stats intactas.

## 4. Pendientes / cosas explícitamente diferidas

- **`getRarity()` sigue siendo PROVISIONAL**, con **umbrales absolutos** de OVR
  (≥85 ESTRELLA, ≥80 DESTACADO, ≥75 ORO, resto COMÚN) y solo 4 rarezas. **La
  rareza por percentiles (§11), con las 5 rarezas reales (LEYENDA incluida), es
  tarea de la Etapa 1**, junto con el dataset real. No quedó pasado por alto: es
  una decisión, no un olvido. Vive en `js/ui/componentes.js` con un comentario.
- El campo `rarity` de cada jugador está en `null` (se llena en la Etapa 1).
- Los valores de `economia.js` distintos de `paquetesBienvenida` están
  definidos pero **no se usan** hasta la Etapa 6.
- La estructura `amplitud`/`densidadCentral`/`mod` de las formaciones está
  cargada pero **no se usa** hasta la Etapa 5.

## 5. Advertencias para la próxima etapa (Etapa 1)

- **`jugadores.js` DEBE seguir siendo `.js`, no `.json`.** El script de
  conversión del CSV tiene que generar `export const JUGADORES = [...]` (módulo
  ES), **no** un `.json`. Motivo: un `.json` obliga a `fetch()` asíncrono y a
  volver async todo el arranque, sin ninguna ganancia. Es una decisión tomada,
  no la cambies por inercia.
- **La colección guardada se resetea en la Etapa 1.** Los jugadores de prueba
  (ids 1–18) desaparecen al entrar el dataset real. Hay que limpiar / invalidar
  las colecciones viejas de `localStorage` (o migrarlas a vacío), porque
  referencian ids que ya no existen.
- Al asignar rarezas por percentiles (§11.2), reemplazar `getRarity()` de
  `componentes.js` por la rareza almacenada en cada jugador (`player.rarity`),
  no seguir calculándola por umbral de OVR.
- **Mirar el histograma de Overall** del pool real antes de avanzar (lo pide el
  plan): si la distribución no se parece a lo que asume §11/§14, avisar y
  recalibrar antes de la Etapa 2.

## 6. Cómo testear que esta etapa quedó bien

1. Servir el proyecto (`python3 -m http.server 8000`) y abrir `http://localhost:8000`.
2. Abrir la consola del navegador: **no debe saltar ningún assert de pesos**.
3. Abrir paquetes, ver la colección, armar un XI completo (1-4-3-3).
4. La **Valoración** del equipo **no** coincide con el **OVR medio del plantel**
   (que aparece como fila aparte): confirma que la valoración ya es derivada.
5. Recargar la página: los datos siguen (colección + XI).
6. Los números de Ataque/Medio/Defensa son distintos de los de la V0.3 (es lo
   esperado tras corregir las fórmulas).

Verificado con Chromium en un test automatizado: XI de 11, Valoración 79.5
derivada (= 0.33·Atq + 0.34·Med + 0.33·Def) distinta del OVR medio 81.5, sin
asserts, persistencia OK tras recargar.
