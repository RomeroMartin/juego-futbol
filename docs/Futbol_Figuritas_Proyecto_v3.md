# FÚTBOL FIGURITAS — Documento Maestro del Proyecto

**Versión:** 0.3
**Estado:** Prototipo en desarrollo (V0.3 de código completada)
**Reemplaza a:** v0.2

**Cambios respecto de v0.2:**
- **Las 7 decisiones del Apéndice B quedaron cerradas.** El apéndice pasa de ser una lista de pendientes a un registro de decisiones tomadas.
- Economía de paquetes redefinida: 5 paquetes de bienvenida, 1 sobre antes de cada partido **de torneo**, y contador de puntos con premio PREMIUM (§15).
- **Los partidos contra la IA no otorgan sobres ni puntos de progresión.** La IA queda como sandbox de prueba y fuente de Fichas (§15.3, §15.3.1).
- Tope de 3 amistosos por día que suman puntos, para cerrar el último vector de farmeo (§15.3.2).
- Torneos: modo RECLAMO confirmado como único de la V1.0, con formación congelada y mentalidad libre entre fechas (§36, §17.3).
- Pool insuficiente: se resuelve con jugadores COMÚN reales que nadie posee, no con genéricos inventados (§37).
- Avance de fecha manual, con forzado por inactividad y campos preparados para automatizar a futuro (§41).
- Monedas modeladas como objeto y registro de transacciones desde el día uno, para permitir monetización futura sin refactor (§44, §48).

**Cambios de v0.1 a v0.2 (histórico):**
- Rareza recalibrada por percentiles (la escala absoluta anterior era incompatible con datos reales del fútbol argentino).
- Fórmulas de Ataque/Mediocampo/Defensa desambiguadas y cerradas.
- Sistema de Torneos con exclusividad de jugadores.
- Sistema de Formaciones y Mentalidades con efectos reales sobre el motor.
- Motor de partido especificado con fórmulas concretas.
- Documento reordenado por prioridad de implementación.

---

# ÍNDICE

- **PARTE I** — Fundamentos
- **PARTE II** — Datos y jugadores
- **PARTE III** — Paquetes, colección y economía
- **PARTE IV** — Equipos, formaciones y mentalidades
- **PARTE V** — Motor de partido
- **PARTE VI** — Torneos (sistema central)
- **PARTE VII** — Multijugador y social
- **PARTE VIII** — Monetización y marco legal
- **PARTE IX** — Arquitectura técnica
- **PARTE X** — Roadmap y estado actual
- **APÉNDICE A** — Sistemas futuros
- **APÉNDICE B** — Decisiones tomadas
- **APÉNDICE C** — Deuda técnica conocida

---

# PARTE I — FUNDAMENTOS

## 1. Concepto

**Fútbol Figuritas** es una aplicación web de colección y competencia basada en el fútbol argentino de Primera División.

El ciclo principal es:

> **Abrir paquetes → obtener jugadores → coleccionarlos → armar un XI → competir → mejorar el equipo → volver a competir.**

La inspiración es abrir paquetes de figuritas, pero trasladada a un juego donde los jugadores obtenidos tienen utilidad estratégica.

## 2. Público objetivo y contexto de uso

El juego está pensado **primero para jugarse entre amigos**: grupos chicos y cerrados (5 a 20 personas) que se conocen entre sí, arman torneos privados y compiten.

Esto no es un detalle menor: **condiciona todo el diseño.**

| Implicancia | Consecuencia de diseño |
|---|---|
| El grupo es chico y cerrado | Los torneos deben poder crearse con código de invitación, sin matchmaking global |
| Se conocen entre sí | La rivalidad y el "hablar del partido" importan más que el ranking global |
| No hay masa crítica | El juego debe ser divertido con 4 personas, no requerir 10.000 usuarios |
| Ninguno paga al principio | El juego debe ser 100% jugable gratis. La monetización llega después y no puede ser condición para competir |

## 3. Ciclo de juego (loop principal)

```text
ABRIR PAQUETE
      ↓
OBTENER 6 JUGADORES
      ↓
SE GUARDAN AUTOMÁTICAMENTE EN LA COLECCIÓN
      ↓
ARMAR EQUIPO (formación + XI + mentalidad)
      ↓
VALIDAR REGLAS
      ↓
COMPETIR (amistoso o torneo)
      ↓
SIMULAR PARTIDO
      ↓
VER RESULTADO Y RELATO
      ↓
OBTENER PROGRESIÓN / RECOMPENSAS
      ↓
MEJORAR COLECCIÓN
      ↓
ABRIR OTRO PAQUETE
```

Este ciclo es el corazón de toda la aplicación. Toda funcionalidad nueva debe justificar cómo alimenta este ciclo.

## 4. Objetivos de experiencia

El usuario debe sentir que:

- cada paquete puede traer algo importante;
- conseguir jugadores repetidos sigue teniendo valor;
- elegir el XI requiere estrategia;
- **una valoración alta no garantiza ganar**;
- **la formación y la mentalidad son decisiones que cambian resultados**;
- un equipo bien armado puede superar a otro nominalmente superior;
- conseguir un jugador nuevo puede cambiar las posibilidades del equipo;
- la colección tiene utilidad a largo plazo.

## 5. Principios de balance

```text
calidad ≠ victoria automática
```

Un equipo superior debe tener **probabilidad mayor** de ganar. Un equipo inferior debe conservar una posibilidad **razonable** de sorpresa.

**Objetivos numéricos concretos** (a validar con simulaciones, ver §33):

| Diferencia de Fuerza Efectiva | % de victoria esperado del favorito |
|---|---|
| 0 puntos | ~40% (con ~20% de empates) |
| +5 puntos | 55–60% |
| +10 puntos | 63–68% |
| +20 puntos | 75–80% |
| +30 o más | 82–87% (techo duro) |

**Ningún equipo debe superar el 87% de probabilidad de victoria, nunca.** Si un equipo gana el 95% de los partidos, el juego dejó de ser un juego.

La ventaja táctica (formación + mentalidad bien elegidas contra el rival) debe poder aportar hasta el equivalente a **±12 puntos de Fuerza Efectiva**. Es decir: la táctica puede dar vuelta un partido contra un rival hasta ~12 puntos mejor, pero no contra uno 30 puntos mejor.

## 6. Principio de profundidad

La aplicación no debe empezar con demasiados sistemas.

Orden de implementación:

```text
1. Paquetes
2. Colección
3. Equipo (4-3-3 fijo)
4. Reglas y validaciones
5. Stats de equipo
6. Competencia vs IA
7. Motor de partido básico
8. Firebase
9. Formaciones múltiples + mentalidades
10. Torneos
11. Multijugador
12. Intercambios
13. Sistemas avanzados
```

## 7. Regla de oro

No agregar una funcionalidad simplemente porque técnicamente sea posible.

La prioridad es:

```text
DIVERTIDO → CLARO → EQUILIBRADO → PROFUNDO
```

---

# PARTE II — DATOS Y JUGADORES

## 8. Modelo de datos del jugador

```javascript
{
  id: "arg_00147",            // ID único, estable, NUNCA el nombre
  schemaVersion: 3,

  // Identidad
  name: "Jugador X",
  shortName: "Jugador",
  clubId: "club_012",
  nationality: "ARG",         // requerido por el sistema de Química (Apéndice A)
  age: 27,

  // Posición
  position: "DEL",            // POR | DEF | MED | DEL
  secondaryPosition: "MED",   // null si no tiene. Usado en §22

  // Stats
  overall: 78,
  pace: 84,
  shooting: 79,
  passing: 71,
  dribbling: 80,
  defending: 38,
  physical: 69,

  // Stats de arquero (null para jugadores de campo). Ver Deuda Técnica C1.
  gkDiving: null,
  gkHandling: null,
  gkPositioning: null,
  gkReflexes: null,
  gkKicking: null,

  // Metadata de juego
  rarity: "ORO",              // Calculado, NO hardcodeado. Ver §11
  season: "2026",
  photo: null                 // placeholder hasta resolver derechos (§45)
}
```

**Reglas duras:**

- El nombre **nunca** se usa como ID. Hay jugadores homónimos y los nombres cambian de grafía entre fuentes.
- `id` debe ser estable entre temporadas. Si un jugador cambia de club, mantiene su `id`.
- Todos los campos deben existir en el objeto aunque valgan `null`. Cambiar el schema con datos ya guardados es caro.

## 9. Posiciones

El sistema utiliza cuatro categorías:

```text
POR = Arquero
DEF = Defensor
MED = Mediocampista
DEL = Delantero
```

Se usan para: filtros, construcción del XI, validaciones, cálculos y motor de partido.

## 10. Fuentes de datos reales

> ⚠️ **Esta tarea sube de prioridad respecto de v0.1.** No se puede calibrar la rareza (§11) ni las probabilidades de paquete (§14) sin conocer la distribución real de Overall del pool. Debe resolverse **antes** de tocar el sistema de rareza.

### 10.1. Estado del relevamiento

La Liga Profesional de Fútbol de Argentina está licenciada en EA FC 26. El pool disponible es de aproximadamente **30 clubes y 869 jugadores**.

**Dato crítico para el balance:** el jugador mejor puntuado de la liga argentina ronda los **82 OVR**, y el segundo escalón los **79 OVR**. No existen jugadores de 85+, ni de 90+, en el pool argentino.

Fuentes relevadas:

| Fuente | Tipo | Notas |
|---|---|---|
| Kaggle — datasets EAFC 26 | CSV descargable | Varios, actualizados. Scrapeados, no oficiales |
| SoFIFA (`/league/353`) | Web | Filtrable por liga, con histórico de updates |
| FIFACM | Web | Incluye potencial además de OVR |
| FIFA Index / fifaratings | Web | Similar |
| Sitio oficial de ratings de EA | Web | Fuente original |
| API-Football / TheSportsDB | API | Datos **reales** (fixtures, planteles), no ratings de juego |

### 10.2. Restricción legal

⚠️ **No asumir que una base de datos de EA Sports es de uso libre por estar disponible públicamente.** Los ratings, nombres y estructura de datos son propiedad de EA Sports. Los datasets de Kaggle son scrapeados no oficiales.

Antes de usar cualquier fuente en un producto monetizado hay que resolver:

- licencia y términos de uso;
- derechos sobre ratings;
- derechos sobre nombres de jugadores (derecho de imagen, distinto del anterior);
- derechos sobre fotos, escudos y logos (problema **independiente** de las stats);
- posibilidad de uso comercial;
- posibilidad de almacenar y redistribuir.

### 10.3. Estrategia recomendada

**Fase prototipo y juego entre amigos (no monetizado):** usar el dataset como está. Riesgo práctico bajo.

**Fase monetizada:** usar el dataset real **como semilla de calibración** — para conocer la distribución de stats y ajustar el balance — y después:

- generar valores propios derivados (no copiados) a partir de datos de rendimiento reales y públicos (goles, minutos, asistencias, vía API-Football u otra fuente con términos claros);
- resolver los nombres por separado (ver §46);
- reemplazar toda imagen por arte propio o placeholders.

Ver PARTE VIII para el análisis completo.

## 11. Rareza

> 🔴 **Corrección importante respecto de v0.1.** La escala absoluta anterior (75-79 COMÚN / 80-84 ORO / 85-89 DESTACADO / 90+ ESTRELLA) es **incompatible con el pool real**: dejaría las categorías DESTACADO y ESTRELLA completamente vacías, y sin categoría a la mayoría de los 869 jugadores (que están por debajo de 75).

### 11.1. Rareza por percentil

La rareza **no se define por valores absolutos de Overall**. Se define por **posición del jugador dentro del pool activo**, calculada al momento de cargar el dataset.

```text
Percentil 99–100  →  LEYENDA     (~9 jugadores de 869)
Percentil 95–99   →  ESTRELLA    (~35 jugadores)
Percentil 80–95   →  DESTACADO   (~130 jugadores)
Percentil 50–80   →  ORO         (~260 jugadores)
Percentil 0–50    →  COMÚN       (~435 jugadores)
```

**Ventajas de este enfoque:**

- Se auto-calibra con cualquier dataset. Si mañana agregás Primera Nacional, jugadores históricos o una liga extranjera, el sistema sigue funcionando sin tocar una línea.
- Las cinco categorías siempre están pobladas.
- La escasez percibida es real y consistente.

### 11.2. Implementación

```javascript
function asignarRarezas(pool) {
  const ordenado = [...pool].sort((a, b) => a.overall - b.overall);
  const n = ordenado.length;

  ordenado.forEach((jugador, i) => {
    const percentil = (i / n) * 100;
    if      (percentil >= 99) jugador.rarity = "LEYENDA";
    else if (percentil >= 95) jugador.rarity = "ESTRELLA";
    else if (percentil >= 80) jugador.rarity = "DESTACADO";
    else if (percentil >= 50) jugador.rarity = "ORO";
    else                      jugador.rarity = "COMUN";
  });

  return ordenado;
}
```

La rareza se calcula **una vez, al cargar el dataset**, y se persiste en el objeto jugador. No se recalcula en runtime.

### 11.3. Nota de diseño

La rareza es **escasez**, no es **poder**. Un ESTRELLA es raro; si además es siempre el mejor en la cancha, el juego se vuelve pay-to-win. Ver §19 (cómo la formación y la mentalidad compensan la calidad individual).

---

# PARTE III — PAQUETES, COLECCIÓN Y ECONOMÍA

## 12. Paquetes: contenido

Cada paquete contiene **6 jugadores**.

Al abrirlo:

1. se generan 6 jugadores;
2. se muestran uno a uno con animación;
3. se agregan **automáticamente** a la colección;
4. si ya existían, aumenta su `quantity`.

El usuario **NO debe guardar manualmente cada figurita.**

## 13. Paquete de arranque y protección anti-bloqueo

> 🔴 **Problema resuelto respecto de v0.1.** Con paquetes puramente aleatorios, un usuario nuevo puede abrir 4 o 5 paquetes seguidos sin obtener un arquero. Como el XI válido exige exactamente 1 POR (§18), **el usuario queda bloqueado sin poder jugar**. En un pool real, los arqueros son ~10% del total (≈3 por plantel de 28).

### 13.1. Los 5 paquetes de bienvenida

Todo usuario nuevo recibe **5 paquetes al crear la cuenta** (30 jugadores en total).

El **primer paquete** tiene composición **garantizada**:

```text
1 POR
2 DEF
2 MED
1 DEL
```

Rarezas del primer paquete: al menos 1 ORO o superior, el resto libre.
Los 4 paquetes restantes son aleatorios estándar, pero con el pity de arquero (§13.2) ya activo.

**Por qué 5 y no 1:** con 30 jugadores, la probabilidad de no poder armar un 4-3-3 válido es prácticamente nula, incluso con distribución desfavorable. El onboarding deja de depender de la suerte y el usuario puede jugar su primer partido a los 3 minutos de registrarse.

**Efecto secundario buscado:** abrir 5 paquetes seguidos es el mejor momento del juego. Ponerlo en el minuto cero es la forma más barata de que alguien quiera seguir jugando.

### 13.2. Pity de arquero

A partir del tercer paquete, la composición es aleatoria, **pero**:

- si el usuario tiene **0 arqueros disponibles**, el próximo paquete garantiza 1 POR;
- si pasaron **5 paquetes sin ningún POR**, el sexto garantiza 1 POR.

```javascript
function debeGarantizarArquero(usuario) {
  const arqueros = usuario.coleccion.filter(c => getJugador(c.playerId).position === "POR");
  if (arqueros.length === 0) return true;
  if (usuario.paquetesDesdeUltimoArquero >= 5) return true;
  return false;
}
```

### 13.3. Pity de rareza

Cada **10 paquetes sin obtener DESTACADO o superior**, el paquete siguiente garantiza al menos 1 DESTACADO. Esto evita rachas frustrantes y es estándar en el género.

## 14. Probabilidades de paquete

Probabilidades **por carta** (cada una de las 6 se tira independientemente):

```text
COMÚN        62%
ORO          26%
DESTACADO     9%
ESTRELLA    2.7%
LEYENDA     0.3%
```

**Esperanza:** un DESTACADO cada ~1.9 paquetes, una ESTRELLA cada ~6 paquetes, una LEYENDA cada ~55 paquetes.

> ⚠️ Estos valores son un **punto de partida**, no definitivos. Deben validarse simulando 10.000 aperturas y verificando que la curva de progresión se sienta bien (ver §33).

### 14.1. Selección dentro de la rareza

Una vez determinada la rareza de la carta, el jugador concreto se elige **uniformemente al azar** dentro de esa categoría del pool. No hay ponderación por club ni por popularidad en la V1.

### 14.2. Sin duplicados dentro del mismo paquete

Un paquete no puede contener dos veces al mismo jugador. Si el sorteo repite, se vuelve a tirar.

## 15. Economía de paquetes

> ✅ **Decisión B3 — CERRADA.** El ciclo de juego termina en "abrir otro paquete" y este es **el parámetro que más define si el juego es divertido**.

### 15.0. Principio de diseño

La progresión tiene **tres canillas**, cada una con una función distinta:

| Canilla | Función | Riesgo si se abre de más |
|---|---|---|
| **Bienvenida** | Que puedas jugar ya | Ninguno, es de una sola vez |
| **Sobres de torneo** | Premiar jugar **con amigos** | Ninguno: los partidos de torneo son finitos |
| **Fichas** | Camino alternativo para el que juega solo | Inflación si se regalan demasiadas |

> 🔑 **La regla que sostiene todo el sistema: el sobre gratis se entrega antes de cada partido DE TORNEO, nunca antes de un partido contra la IA.**
>
> Esto no es un detalle. Los partidos contra la IA son ilimitados (un partido simulado dura ~15 segundos), así que atar sobres a ellos sería una canilla infinita: alguien podría abrir 240 paquetes en una hora y completar la colección en dos tardes, dejando sin sentido a las Fichas y a todo el resto de la economía.
>
> Los partidos de torneo, en cambio, son **estructuralmente finitos**: hay uno por fecha, y las fechas las dispara el creador del torneo (§41). No hay forma de spamearlos. El grifo se cierra solo, sin necesidad de topes artificiales.
>
> **Efecto secundario buscado:** el camino principal de progresión pasa por jugar con amigos. Para un juego cuyo objetivo declarado es jugarse en grupo (§2), el incentivo apunta exactamente donde debe.

### 15.1. Paquetes de bienvenida

**5 paquetes al crear la cuenta.** Ver §13.1 para la composición.

### 15.2. Sobre antes de cada partido de torneo

Antes de cada partido de torneo, el usuario recibe **1 paquete gratis** que abre en la pantalla previa al partido.

**Condiciones:**

- Solo en partidos de **torneo**. Los amistosos entre usuarios (§32) **no** otorgan sobre.
- El torneo debe tener **mínimo 4 participantes**. Sin este límite, alguien podría crear un torneo de 2 con una cuenta secundaria y farmear sobres indefinidamente.
- Un sobre por partido, no acumulable. Si no lo abrís, se abre automáticamente al confirmar el partido.

**Rendimiento:** un torneo de 8 participantes en formato liga de ida son 7 fechas → **7 sobres**. Ida y vuelta → **14 sobres**. Un grupo que juega un torneo por semana tiene flujo constante.

> ⚠️ **Aclaración obligatoria en la UI.** Los jugadores que salgan de este sobre **no se pueden usar en el torneo en curso**, porque el XI queda congelado al cerrarse la ventana de armado (§36.1) y la formación es fija (§17.3). Van a tu colección y sirven para el próximo torneo, para amistosos y para intercambios.
>
> Si esto no se comunica claramente, el usuario abre un sobre, le sale un jugadorazo, intenta meterlo y se frustra. El ritual de abrir el sobre antes del partido se mantiene — solo hay que ser explícito sobre para qué sirve.

### 15.3. Contador de puntos

Cada partido **contra otra persona** suma puntos a un contador acumulativo. **Al llegar a 50 puntos, el usuario recibe un Pack de 3 sobres PREMIUM** (cada uno con un DESTACADO garantizado). El contador se resetea a 0 y vuelve a empezar. Es un objetivo permanente.

| Contexto | Victoria | Empate | Derrota |
|---|---|---|---|
| Partido de torneo | **3 pts** | **1 pt** | 0 |
| Amistoso vs otro usuario | **3 pts** | **1 pt** | 0 |
| **Vs IA (cualquier dificultad)** | **0** | **0** | **0** |

> 🔑 **Los partidos contra la IA no otorgan sobres ni puntos. Ninguno, en ninguna dificultad.**
>
> El motivo es el mismo que sostiene toda la economía: los partidos vs IA son ilimitados y duran ~15 segundos. Cualquier recompensa de progresión atada a ellos es una canilla infinita. Con 1 punto por victoria el farmeo sería lento pero seguiría existiendo; con 0, el problema desaparece por completo y no hace falta ningún tope artificial ni distinción por dificultad.
>
> **La progresión del juego pasa exclusivamente por jugar contra personas.** Es una decisión deliberada y coherente con el objetivo del proyecto (§2): esto es un juego para jugar con amigos.

### 15.3.1. Entonces, ¿para qué sirve el modo vs IA?

La IA cumple tres funciones, ninguna de progresión:

1. **Sandbox de prueba.** Probar una formación o una mentalidad nueva antes de arriesgarla en una fecha de torneo. Es su función principal.
2. **Fuente de Fichas.** Sigue otorgando Fichas (§15.4), que es el único camino de progresión para quien no está en ningún torneo activo.
3. **Entretenimiento suelto.** Jugar un rato sin compromiso.

**Consecuencia asumida:** el usuario que solo juega contra la IA progresa mucho más lento que el que juega torneos. Eso es intencional, no un efecto colateral.

### 15.3.2. Tope de amistosos que suman puntos

> ⚠️ **Agujero derivado.** Al quitarle valor a la IA, el único vector de farmeo que queda son los **amistosos entre usuarios**. Dos amigos cómplices pueden desafiarse 50 veces seguidas y repartirse los packs, porque a diferencia de los torneos, los amistosos **no tienen límite estructural**.

**Solución: solo los primeros 3 amistosos del día suman puntos.**

```javascript
function puntosDelPartido(partido, usuario) {
  if (partido.tipo === "IA") return 0;
  if (partido.tipo === "TORNEO") return PUNTOS[resultado];   // sin tope: los torneos ya son finitos

  // Amistoso
  if (usuario.amistososConPuntosHoy >= 3) return 0;
  return PUNTOS[resultado];
}
```

Del cuarto amistoso del día en adelante, seguís jugando y seguís ganando Fichas — solo no suma al contador. Los partidos de torneo **no** necesitan tope, porque su cantidad ya está limitada por el fixture.

**Por qué el premio es PREMIUM y no 3 sobres comunes:** con ~17 victorias de torneo necesarias para llegar a 50 puntos, ya recibiste ~17 sobres gratis por el camino. Un premio de 3 sobres comunes sería el 18% de lo que ya te regalaron — el objetivo valdría menos que el ruido de fondo. El premio tiene que ser **cualitativamente distinto** de lo que conseguís gratis, no una migaja más grande.

### 15.4. Fichas

Las Fichas son la **moneda ganable** y el camino alternativo de progresión, especialmente para quien juega solo o entre torneos.

| Acción | Fichas |
|---|---|
| Jugar un partido (cualquier resultado, incluso vs IA) | +10 |
| Ganar un partido | +25 adicionales |
| Empatar | +10 adicionales |
| Primer partido del día | +50 |
| Completar un logro | 50–500 según logro |
| Ganar un torneo | 500–2000 según tamaño (§43) |
| Vender un jugador repetido (`quantity` ≥ 2) | 20 / 50 / 120 / 400 / 1500 según rareza |

### 15.5. Costo de paquetes en Fichas

| Paquete | Costo | Contenido |
|---|---|---|
| Paquete Básico | 300 Fichas | 6 jugadores, probabilidades estándar |
| Paquete Premium | 1200 Fichas | 6 jugadores, mínimo 1 DESTACADO garantizado |
| Paquete Posicional | 500 Fichas | 6 jugadores de una posición a elegir |

### 15.6. Ritmo resultante

| Escenario | Paquetes en la primera semana |
|---|---|
| Usuario en un grupo activo (1 torneo/semana, 8 participantes) | 5 + 7 + ~2 por Fichas ≈ **14** |
| Usuario que juega torneos y amistosos | 5 + 7 + ~3 por Fichas ≈ **15** |
| Usuario que **solo** juega vs IA (~5 partidos/día) | 5 + ~4 por Fichas ≈ **9** |

La brecha entre el primero y el último es deliberada. El que juega con amigos progresa ~50% más rápido, y esa diferencia es el incentivo que empuja hacia el modo que da sentido al juego.

Aun así, el jugador solitario **no queda bloqueado**: 9 paquetes en la primera semana vía Fichas alcanza de sobra para tener un equipo competitivo. Progresa más lento, no se queda afuera.

Ambos ritmos deben sentirse **generosos**, no restrictivos. En un juego entre amigos, si alguien no puede competir porque no tiene jugadores, deja de jugar y arrastra al grupo. **Es preferible errar por generoso**, sobre todo mientras no haya monetización (§48).

La escasez real del juego no está en el volumen de paquetes sino en **la cola de la distribución de rareza**: podés abrir 50 paquetes y seguir sin una LEYENDA. Eso es lo que sostiene el interés a largo plazo, no la tacañería con los sobres comunes.

### 15.7. Todos estos números son ajustables

Cada valor de esta sección debe vivir en un **objeto de configuración único**, nunca desparramado por el código:

```javascript
// config/economia.js
export const ECONOMIA = {
  paquetesBienvenida: 5,
  sobrePorPartidoTorneo: true,
  minParticipantesParaSobre: 4,
  puntosParaPack: 50,
  puntos: {
    torneo:   { victoria: 3, empate: 1, derrota: 0 },
    amistoso: { victoria: 3, empate: 1, derrota: 0 },
    ia:       { victoria: 0, empate: 0, derrota: 0 }   // la IA nunca suma puntos
  },
  topeAmistososConPuntosPorDia: 3,   // los torneos no necesitan tope
  packRecompensa: { cantidad: 3, tipo: "PREMIUM" },
  fichas: { porPartido: 10, porVictoria: 25, porEmpate: 10, primeroDelDia: 50 },
  precios: { BASICO: 300, PREMIUM: 1200, POSICIONAL: 500 }
};
```

Ajustar el balance económico debe ser cambiar un número, no buscar constantes por todo el proyecto. Esto además deja el terreno preparado para la eventual migración a monetización (§48).

## 16. Colección

La colección muestra todos los jugadores que el usuario posee.

Debe mostrar: jugador, club, posición, Overall, stats, rareza, cantidad.

Filtros: `TODOS | ARQUEROS | DEFENSAS | MEDIOS | DELANTEROS`
Filtros adicionales: por rareza, por club, ordenar por OVR.

### 16.1. Repetidos

La colección **no muestra varias cartas iguales**. Muestra una entrada con cantidad:

```text
Jugador X
DEL · ORO
OVR 78
x3
```

### 16.2. Las copias NO se bloquean

> 🔴 **Contradicción resuelta respecto de v0.1.** La v0.1 mostraba "Utilizado: 1 / Disponible: 2" (implicando que armar un equipo consume una copia) pero modelaba el equipo como un simple array de IDs. Eso genera bugs inevitables: ¿al borrar un equipo se libera la copia? ¿dos equipos con el mismo jugador necesitan dos copias?

**Decisión: las copias nunca se bloquean.**

- Un jugador que poseés puede estar en **todos** tus equipos simultáneamente.
- `quantity` es un contador que sirve únicamente para: **intercambios**, **venta por Fichas** y **estadística de colección**.
- La UI muestra `x3` y nada más. Se elimina el concepto "Utilizado / Disponible".

**Excepción única:** dentro de un torneo con exclusividad activa, aplica el bloqueo descrito en PARTE VI. Ese bloqueo es **por torneo**, no por copia, y no afecta la colección.

### 16.3. Un jugador no puede repetirse dentro del mismo XI

Tener `Jugador X x3` **no** permite alinearlo tres veces. Una identidad de jugador ocupa como máximo un puesto del XI.

---

# PARTE IV — EQUIPOS, FORMACIONES Y MENTALIDADES

## 17. Formaciones como dato, no como código

> 🟢 **Mejora respecto de v0.1.** La v0.1 tenía el 4-3-3 hardcodeado en las validaciones y las formaciones múltiples como "sistema futuro". Modelándolas como dato desde el arranque, agregar una formación pasa a ser una línea en un objeto.

```javascript
const FORMACIONES = {
  "4-3-3":   { slots: { POR:1, DEF:4, MED:3, DEL:3 }, amplitud: 70, densidadCentral: 45, mod: { ataque:  +3, medio:  0, defensa:  0 } },
  "4-4-2":   { slots: { POR:1, DEF:4, MED:4, DEL:2 }, amplitud: 60, densidadCentral: 60, mod: { ataque:  -2, medio: +4, defensa: +2 } },
  "4-2-3-1": { slots: { POR:1, DEF:4, MED:5, DEL:1 }, amplitud: 50, densidadCentral: 70, mod: { ataque:  -5, medio: +7, defensa: +3 } },
  "3-5-2":   { slots: { POR:1, DEF:3, MED:5, DEL:2 }, amplitud: 40, densidadCentral: 80, mod: { ataque:  +2, medio: +8, defensa: -6 } },
  "3-4-3":   { slots: { POR:1, DEF:3, MED:4, DEL:3 }, amplitud: 75, densidadCentral: 50, mod: { ataque:  +7, medio: +2, defensa: -9 } },
  "5-3-2":   { slots: { POR:1, DEF:5, MED:3, DEL:2 }, amplitud: 45, densidadCentral: 65, mod: { ataque:  -7, medio: -2, defensa: +9 } }
};
```

**Los dos ejes nuevos:**

- **`amplitud`** (0–100): cuánto usa el equipo los costados. Alta amplitud = más peligro por afuera, más vulnerable por el centro.
- **`densidadCentral`** (0–100): cuánta gente hay en el corredor central. Alta densidad = domina el medio, sufre los centros al área.

Estos dos ejes son los que hacen que **formación y mentalidad interactúen** en vez de ser bonos planos.

### 17.1. Validación del XI

Un equipo válido debe cumplir **exactamente** los `slots` de la formación elegida. No se puede competir con un equipo incompleto.

```javascript
function validarXI(xi, formacion) {
  const req = FORMACIONES[formacion].slots;
  const conteo = { POR:0, DEF:0, MED:0, DEL:0 };
  const idsVistos = new Set();

  for (const j of xi) {
    if (idsVistos.has(j.id)) return { valido: false, error: "JUGADOR_DUPLICADO" };
    idsVistos.add(j.id);
    conteo[j.position]++;
  }

  for (const pos of ["POR","DEF","MED","DEL"]) {
    if (conteo[pos] !== req[pos]) {
      return { valido: false, error: "POSICIONES_INCORRECTAS", faltan: req[pos] - conteo[pos], pos };
    }
  }
  return { valido: true };
}
```

### 17.2. Equipo incompleto

Mientras falten posiciones, las stats se muestran como `—` y la interfaz indica `EQUIPO INCOMPLETO` **señalando qué posiciones faltan**. El botón `COMPETIR` queda deshabilitado.

### 17.3. Formación congelada en torneos

> ✅ **Decisión B6 — CERRADA.** Dentro de un torneo: **la formación y el XI quedan congelados; la mentalidad es libre entre fechas.**

**Por qué la formación no puede cambiarse a mitad de torneo:** es una contradicción directa con el sistema de exclusividad (PARTE VI). Si pasás de 4-3-3 a 3-5-2 necesitás 2 mediocampistas más, pero los que te servían ya fueron reclamados por otros participantes. Te quedarías **con un equipo inválido y sin forma de completarlo**, imposibilitado de seguir jugando el torneo.

**Por qué la mentalidad sí es libre:** no toca el XI, así que no genera ningún conflicto con el reclamo. Y como la mentalidad del rival no se revela antes del partido (§19.5), cambiarla no es explotable — es apostar a ciegas, que es exactamente la decisión interesante que el sistema busca generar.

```javascript
// Al cerrarse la ventana de armado del torneo:
equipoTorneo.formacion    = "BLOQUEADA";   // no editable hasta que termine el torneo
equipoTorneo.players      = "BLOQUEADO";   // no editable
equipoTorneo.mentalidades = "EDITABLE";    // libre antes de cada fecha
```

**Fuera de los torneos** (amistosos y partidos vs IA) tanto la formación como el XI y las mentalidades son totalmente libres.

## 18. Posición natural

**V1:** cada jugador solo juega en su posición natural.

**V1.5 (posiciones secundarias):** un jugador con `secondaryPosition` puede alinearse ahí con una penalización:

```text
Posición natural       →  0% penalización
Posición secundaria    →  8% penalización sobre todas sus stats
Posición incompatible  →  no permitido
```

## 19. Mentalidades

> 🟢 **Sistema nuevo.** Es la principal herramienta para cumplir el objetivo de que "el equipo con mejor valoración media no gane por defecto".

El usuario elige **dos mentalidades independientes**: una ofensiva y una defensiva. Cada una tiene **trade-offs reales — ninguna es un bono gratis.**

### 19.1. Mentalidad ofensiva

| Mentalidad | Efecto positivo | Efecto negativo | Perfil |
|---|---|---|---|
| **EQUIPO RÁPIDO** (verticalidad) | +10 Ritmo efectivo en ataque. +20% frecuencia de ataques | −8 Pase efectivo. −10% calidad de ocasión | Muchas ocasiones, de menor calidad |
| **JUEGO ABIERTO** (centros al área) | +12 Físico efectivo en ataque. `amplitud` +15 | −6 Regate efectivo | Depende del físico y del ancho de cancha |
| **POSESIÓN** (juego elaborado) | +12 Pase efectivo. +15% calidad de ocasión | −10 Ritmo efectivo. −20% frecuencia de ataques | Pocas ocasiones, de mucha calidad |
| **EQUILIBRADO** | — | — | Sin bonos ni penalizaciones. Default seguro |

### 19.2. Mentalidad defensiva

| Mentalidad | Efecto positivo | Efecto negativo | Perfil |
|---|---|---|---|
| **BLOQUE COMPACTO** | +12 Defensa contra ataques por el centro. −15% ocasiones rivales | −10 Defensa contra centros al área. Cede posesión (−8 Mediocampo) | Aguantar y esperar |
| **PRESIÓN ALTA Y RUDA** | +14 Mediocampo (recuperación alta). +25% probabilidad de recuperar en campo rival | −15 Defensa ante contraataques. +60% probabilidad de faltas y tarjetas | Alto riesgo, alta recompensa |
| **LÍNEA MEDIA** | — | — | Sin bonos ni penalizaciones. Default seguro |

### 19.3. Matriz de contras (el corazón del sistema)

Este es el mecanismo que impide que el mejor equipo gane siempre. Se aplica como **multiplicador sobre la Fuerza Efectiva** del área correspondiente.

**Mi mentalidad ofensiva vs. la mentalidad defensiva del rival:**

| Mi ataque ↓ / Su defensa → | BLOQUE COMPACTO | PRESIÓN ALTA Y RUDA | LÍNEA MEDIA |
|---|---|---|---|
| **EQUIPO RÁPIDO** | ×0.88 ❌ | **×1.18 ✅** | ×1.00 |
| **JUEGO ABIERTO** | **×1.15 ✅** | ×0.94 | ×1.00 |
| **POSESIÓN** | ×0.92 | ×0.85 ❌ | ×1.02 |
| **EQUILIBRADO** | ×1.00 | ×1.00 | ×1.00 |

**Lectura del sistema:**

- El **equipo rápido** destroza a la presión alta (le deja la espalda descubierta) pero se estrella contra el bloque compacto.
- El **juego abierto** rompe el bloque compacto (los centros pasan por arriba del bloque) pero no le sirve contra la presión.
- La **posesión** es la más castigada por la presión alta y ruda (te aprietan la salida) y no rinde contra el bloque bajo.
- **Equilibrado** nunca gana ni pierde por táctica. Es la elección de quien no quiere arriesgar.

### 19.4. Interacción formación ↔ mentalidad

Además de la matriz, hay dos ajustes por compatibilidad estructural:

```javascript
// JUEGO ABIERTO necesita amplitud. Un 3-5-2 (amplitud 40) no puede tirar centros.
if (mentalidadOfensiva === "JUEGO_ABIERTO") {
  modAtaque *= 0.75 + (formacion.amplitud / 100) * 0.5;   // rango 0.95 – 1.13
}

// PRESIÓN ALTA necesita gente en el medio. Un 4-3-3 presiona peor que un 4-2-3-1.
if (mentalidadDefensiva === "PRESION_ALTA") {
  modMedio *= 0.80 + (formacion.densidadCentral / 100) * 0.4;  // rango 0.98 – 1.12
}

// BLOQUE COMPACTO con poca densidad central es un contrasentido.
if (mentalidadDefensiva === "BLOQUE_COMPACTO") {
  modDefensa *= 0.85 + (formacion.densidadCentral / 100) * 0.3; // rango 0.99 – 1.09
}
```

**Consecuencia buscada:** ciertas combinaciones son claramente buenas (`3-4-3` + `JUEGO ABIERTO`, `4-2-3-1` + `PRESIÓN ALTA`, `5-3-2` + `BLOQUE COMPACTO`) y otras son contradictorias. El jugador debe descubrir esto jugando, no leyendo un manual.

### 19.5. Información visible para el rival

**En amistosos y torneos: la mentalidad del rival NO se revela antes del partido.** Solo se ve su formación y sus stats de equipo.

Esto es deliberado: si vieras la mentalidad rival, elegirías siempre el contra perfecto y el sistema se volvería determinista. La incertidumbre es lo que lo hace un juego de decisiones.

Se revela **después** del partido, en el resumen, junto con una línea de análisis táctico:

```text
Tu EQUIPO RÁPIDO encontró espacios contra su PRESIÓN ALTA. (+18% ataque)
```

Esto enseña el sistema sin necesidad de tutorial.

## 20. Cálculo de las stats de equipo

> 🔴 **Ambigüedad resuelta respecto de v0.1.** La v0.1 daba dos fórmulas contradictorias para el Ataque: unos pesos por stat y, dos líneas después, "promedio(DEL1, DEL2, DEL3)". Nunca aclaraba si se promediaban los OVR o los scores ponderados. Acá queda cerrado.

### 20.0. Regla general

**Los pesos de cada fórmula siempre suman exactamente 1.0.** Debe validarse con un assert en el arranque:

```javascript
Object.entries(PESOS).forEach(([nombre, pesos]) => {
  const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
  console.assert(Math.abs(suma - 1.0) < 0.001, `Los pesos de ${nombre} no suman 1.0`);
});
```

Todas las fórmulas devuelven un valor en **escala 0–100**.

### 20.1. ATAQUE

> 🟢 **Ajuste de balance respecto de v0.1.** La v0.1 daba 35% a Ritmo, igualándolo al Tiro. Eso hace que un delantero con Ritmo 95 / Tiro 60 rinda casi igual que uno con Ritmo 60 / Tiro 95, y el meta del juego se vuelve "juntar delanteros rápidos". Se rebalanceó a favor del Tiro.

```javascript
const PESOS_ATAQUE = { shooting: 0.40, pace: 0.25, dribbling: 0.25, physical: 0.10 };

function scoreAtaque(jugador) {
  return jugador.shooting  * 0.40
       + jugador.pace      * 0.25
       + jugador.dribbling * 0.25
       + jugador.physical  * 0.10;
}

// Se promedian los SCORES, no los Overall.
function calcularAtaque(delanteros) {
  const suma = delanteros.reduce((acc, j) => acc + scoreAtaque(j), 0);
  return suma / delanteros.length;
}
```

### 20.2. MEDIOCAMPO

```javascript
const PESOS_MEDIO = { passing: 0.40, dribbling: 0.25, defending: 0.20, pace: 0.15 };

function scoreMedio(jugador) {
  return jugador.passing   * 0.40
       + jugador.dribbling * 0.25
       + jugador.defending * 0.20
       + jugador.pace      * 0.15;
}

function calcularMediocampo(medios) {
  const suma = medios.reduce((acc, j) => acc + scoreMedio(j), 0);
  return suma / medios.length;
}
```

### 20.3. DEFENSA

> 🔴 **Ambigüedad resuelta.** La v0.1 decía "4 defensores + arquero" sin especificar cómo se combinan. No es lo mismo un promedio simple de 5 (arquero = 20%) que una ponderación explícita.

```javascript
const PESOS_DEFENSOR = { defending: 0.50, physical: 0.20, pace: 0.15, passing: 0.15 };

function scoreDefensor(jugador) {
  return jugador.defending * 0.50
       + jugador.physical  * 0.20
       + jugador.pace      * 0.15
       + jugador.passing   * 0.15;
}

// Fórmula provisional del arquero. Ver Deuda Técnica C1.
function scoreArquero(arquero) {
  return arquero.overall   * 0.50
       + arquero.defending * 0.30
       + arquero.physical  * 0.20;
}

// Ponderación EXPLÍCITA: la línea pesa 75%, el arquero 25%.
function calcularDefensa(defensores, arquero) {
  const lineaDefensiva = defensores.reduce((acc, j) => acc + scoreDefensor(j), 0) / defensores.length;
  return lineaDefensiva * 0.75 + scoreArquero(arquero) * 0.25;
}
```

### 20.4. VALORACIÓN

> 🔴 **Corrección importante.** En v0.1 la Valoración era el promedio de los Overall de los 11, mientras que el motor usaba Ataque/Medio/Defensa. Eso permite que un equipo con Valoración 80 sea peor en las tres áreas que uno de 78. El usuario no lo lee como "sorpresa deportiva" — lo lee como que **el juego está roto**.

La Valoración pasa a **derivarse de las tres áreas**, para que sea coherente con lo que decide el partido:

```javascript
function calcularValoracion(ataque, mediocampo, defensa) {
  return ataque * 0.33 + mediocampo * 0.34 + defensa * 0.33;
}
```

El **OVR medio del plantel** se sigue mostrando, pero **aparte y etiquetado como dato de colección**, con la aclaración de que no es predictivo del resultado:

```text
VALORACIÓN DEL EQUIPO   79.4      ← esto es lo que importa
OVR medio del plantel   77.1      ← dato de colección
```

### 20.5. Fuerza Efectiva

La **Fuerza Efectiva** es lo que realmente entra al motor. Aplica, en este orden: stats base → modificador de formación → modificadores de mentalidad → matriz de contras → interacción formación/mentalidad.

```javascript
function calcularFuerzaEfectiva(equipo, equipoRival) {
  const f = FORMACIONES[equipo.formacion];

  let ataque  = calcularAtaque(equipo.delanteros)          + f.mod.ataque;
  let medio   = calcularMediocampo(equipo.medios)          + f.mod.medio;
  let defensa = calcularDefensa(equipo.defensores, equipo.arquero) + f.mod.defensa;

  // 1. Modificadores planos de mentalidad propia
  ({ ataque, medio, defensa } = aplicarMentalidades(equipo, ataque, medio, defensa));

  // 2. Matriz de contras (mi ataque vs su defensa, mi defensa vs su ataque)
  ataque  *= MATRIZ_CONTRAS[equipo.mentalidadOfensiva][equipoRival.mentalidadDefensiva];
  defensa *= MATRIZ_CONTRAS_DEF[equipo.mentalidadDefensiva][equipoRival.mentalidadOfensiva];

  // 3. Compatibilidad estructural formación ↔ mentalidad (§19.4)
  ({ ataque, medio, defensa } = aplicarCompatibilidad(equipo, f, ataque, medio, defensa));

  return { ataque, medio, defensa };
}
```

---

# PARTE V — MOTOR DE PARTIDO

## 21. Filosofía

**Nunca** usar `OVR 85 > OVR 80 = victoria segura`.

El partido es **probabilístico**. La calidad genera ventaja; no garantiza el resultado.

```text
Equipo A: 85    Equipo B: 77
A es favorito. B todavía puede ganar.
```

## 22. Función de probabilidad base

Todo duelo del motor usa la misma curva logística (tipo Elo). Es la única perilla real de balance del juego:

```javascript
// D controla la varianza. D bajo = más determinista. D alto = más aleatorio.
const D = 18;

function probabilidadDuelo(fuerzaA, fuerzaB) {
  return 1 / (1 + Math.pow(10, -(fuerzaA - fuerzaB) / D));
}
```

**Calibración de `D`:**

| D | Diferencia +10 → % victoria del favorito | Sensación |
|---|---|---|
| 10 | ~91% en el duelo | Demasiado determinista. El mejor gana siempre |
| 18 | ~78% en el duelo | **Recomendado** |
| 30 | ~68% en el duelo | Muy caótico. La calidad casi no importa |

`D = 18` es el punto de partida. Ajustar según las simulaciones de §33.

## 23. Generador aleatorio con semilla

> 🟢 **Mejora respecto de v0.1.** No usar `Math.random()`.

Se usa un PRNG con semilla (mulberry32 o similar) por dos razones:

1. **Testeo de balance:** simular 10.000 partidos de forma reproducible.
2. **Anti-trampa:** el servidor puede re-verificar un partido reproduciendo la semilla, sin necesidad de simularlo todo del lado del servidor.

```javascript
function mulberry32(semilla) {
  return function() {
    semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0;
    let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

La semilla de cada partido se guarda en el documento del partido. Un partido es **completamente reproducible** a partir de `{ semilla, equipoA, equipoB }`.

## 24. Estructura del partido: posesiones

El partido no se simula minuto a minuto. Se simula por **posesiones**.

Un partido tiene entre **18 y 26 posesiones** (ajustadas por las mentalidades: POSESIÓN reduce el total, EQUIPO RÁPIDO lo aumenta).

Cada posesión sigue tres fases:

```text
FASE 1 — DUELO DE MEDIOCAMPO
  ¿Quién se queda con la pelota?
  P(A) = probabilidadDuelo(medioA, medioB)
        ↓
FASE 2 — ¿SE GENERA OCASIÓN?
  El atacante enfrenta a la defensa rival.
  P(ocasión) = probabilidadDuelo(ataqueA, defensaB) × frecuenciaMentalidad
        ↓
FASE 3 — ¿ES GOL?
  Calidad de la ocasión vs. arquero.
  P(gol) = probabilidadDuelo(calidadOcasión, scoreArquero) × 0.42
```

El factor `0.42` de la Fase 3 es un ajuste de realismo: sin él, salen partidos 7-5. Calibrar para que el promedio de goles por partido quede entre **2.4 y 3.2**.

## 25. Ejemplo de flujo

```javascript
function simularPartido(equipoA, equipoB, semilla) {
  const rand = mulberry32(semilla);
  const fA = calcularFuerzaEfectiva(equipoA, equipoB);
  const fB = calcularFuerzaEfectiva(equipoB, equipoA);

  let golesA = 0, golesB = 0;
  const eventos = [];
  const nPosesiones = 18 + Math.floor(rand() * 9);

  for (let i = 0; i < nPosesiones; i++) {
    const minuto = Math.floor((i / nPosesiones) * 90) + Math.floor(rand() * 3);
    const atacaA = rand() < probabilidadDuelo(fA.medio, fB.medio);

    const atk = atacaA ? fA : fB;
    const def = atacaA ? fB : fA;
    const equipoAtacante = atacaA ? equipoA : equipoB;

    if (rand() < probabilidadDuelo(atk.ataque, def.defensa) * atk.frecuencia) {
      const calidad = atk.ataque * (0.8 + rand() * 0.4) * atk.calidadOcasion;
      const arquero = scoreArquero(atacaA ? equipoB.arquero : equipoA.arquero);

      if (rand() < probabilidadDuelo(calidad, arquero) * 0.42) {
        atacaA ? golesA++ : golesB++;
        eventos.push({ minuto, tipo: "GOL", equipo: equipoAtacante.id, autor: elegirGoleador(equipoAtacante, rand) });
      } else {
        eventos.push({ minuto, tipo: "ATAJADA", equipo: equipoAtacante.id });
      }
    } else {
      eventos.push({ minuto, tipo: "ATAQUE_CORTADO", equipo: equipoAtacante.id });
    }
  }

  return { golesA, golesB, eventos, semilla };
}
```

## 26. Elección del goleador

No es aleatoria uniforme. Se pondera por `scoreAtaque` y por posición:

```text
DEL  peso ×5
MED  peso ×2
DEF  peso ×1
POR  peso ×0
```

Multiplicado por el `scoreAtaque` individual. Así los delanteros buenos meten más goles, que es lo que el usuario espera ver.

## 27. Eventos del partido

**V1 (obligatorios):** `GOL`, `ATAJADA`, `ATAQUE_CORTADO`, `FINAL`.

**V1.5:** `CONTRAATAQUE`, `PALO`, `FALTA`, `TARJETA_AMARILLA`, `CORNER`.

**V2:** `TARJETA_ROJA`, `PENAL`, `FUERA_DE_JUEGO`, `CAMBIO`, `LESIÓN`.

La mentalidad `PRESIÓN ALTA Y RUDA` aumenta un 60% la frecuencia de `FALTA` y `TARJETA_AMARILLA` (implementar en V1.5).

## 28. Relato del partido

El relato se genera a partir del array de `eventos`, usando plantillas con los nombres del XI:

```text
12'  Gran recuperación de {MED_2} en mitad de cancha.
13'  Pase filtrado para {DEL_1}.
14'  ¡ATAJÓ {POR_RIVAL}!

27'  ¡GOOOOOOL DE {DEL_3}!
     Recibió dentro del área y definió cruzado.
```

Cada tipo de evento debe tener **al menos 6 plantillas distintas**, elegidas con el PRNG. Con menos, el relato se vuelve repetitivo en la tercera partida.

## 29. Estadísticas del partido

```text
Equipo A 2 - 1 Equipo B
```

Se derivan de los eventos: posesión (% de posesiones ganadas), tiros, tiros al arco, goles, MVP.
En V1.5 se agregan corners, faltas y tarjetas.

## 30. MVP del partido

```javascript
function calcularMVP(eventos, equipo) {
  // Goles ×10 · Asistencias ×6 · Atajadas ×3 · Recuperaciones ×2
  // Desempate: mayor scoreAtaque/scoreDefensor según posición
}
```

## 31. Rival IA

> 🟢 **Sección que estaba vacía en v0.1** y que es bloqueante para V0.4.

### 31.1. Generación del equipo rival

La IA **no** arma un equipo desde tu colección ni desde el pool completo al azar. Arma un equipo **calibrado a tu nivel** según la dificultad elegida:

```javascript
function generarRivalIA(valoracionUsuario, dificultad) {
  const OFFSET = { FACIL: -8, NORMAL: 0, DIFICIL: +6, ELITE: +14 };
  const objetivo = valoracionUsuario + OFFSET[dificultad];

  const formacion = elegirFormacionAleatoria();
  const xi = seleccionarJugadoresDelPool(formacion, objetivo, /* tolerancia */ 3);

  return {
    xi,
    formacion,
    mentalidadOfensiva: elegirMentalidadIA(dificultad),
    mentalidadDefensiva: elegirMentalidadDefIA(dificultad)
  };
}
```

### 31.2. Comportamiento táctico por dificultad

| Dificultad | Offset de valoración | Elección de mentalidad |
|---|---|---|
| **FÁCIL** | −8 | Siempre `EQUILIBRADO` / `LÍNEA MEDIA` |
| **NORMAL** | 0 | Aleatoria uniforme entre todas |
| **DIFÍCIL** | +6 | Aleatoria, pero descarta combinaciones estructuralmente malas (§19.4) |
| **ÉLITE** | +14 | Elige una mentalidad coherente con su formación y varía entre partidos |

**Regla dura: la IA nunca conoce tu mentalidad.** Si la IA eligiera el contra perfecto a tu elección, el juego sería injugable en dificultad alta. La IA elige a ciegas, igual que vos.

### 31.3. Nombre e identidad del rival

La IA genera un nombre de equipo desde una lista de nombres ficticios. **No usa nombres de clubes reales** para evitar el problema de derechos de §46.

## 32. Amistosos entre amigos

Además de la IA, dos usuarios pueden jugar un amistoso:

- El usuario A desafía al B (por código o desde la lista de amigos).
- B recibe la invitación y confirma su XI y sus mentalidades.
- **Recién cuando ambos confirmaron** se simula el partido en el servidor.
- Ambos ven el resultado y el relato al mismo tiempo.

Los amistosos otorgan Fichas pero **no** cuentan para el ranking del torneo.

## 33. Testeo y validación de balance

> 🟢 **Sección que no existía en v0.1.** Sin esto no hay forma de saber si el juego está equilibrado.

Debe existir un **script de simulación masiva**, ejecutable desde consola, que corra 10.000 partidos y reporte:

| Métrica | Objetivo |
|---|---|
| % victoria con diferencia 0 | 38–42% (con ~18–22% de empates) |
| % victoria con diferencia +10 | 63–68% |
| % victoria con diferencia +30 | ≤ 87% |
| Goles promedio por partido | 2.4–3.2 |
| Partidos 0-0 | 6–10% |
| Partidos con 5+ goles | ≤ 8% |
| Ventaja máxima de una mentalidad sobre otra | ≤ 12 puntos equivalentes |
| Tasa de uso de cada mentalidad (si ninguna domina) | Ninguna por encima del 40% en el uso real |

**Este script debe existir antes de la V0.5.** Ajustar `D`, el factor `0.42` y los multiplicadores de la matriz de contras hasta cumplir la tabla.

---

# PARTE VI — TORNEOS (SISTEMA CENTRAL)

> 🟢 **Sistema nuevo y central del proyecto.** Es la funcionalidad que convierte el juego de un pasatiempo individual en algo para jugar con amigos.

## 34. Concepto

Un usuario crea un torneo e invita a sus amigos con un código. Los participantes arman un equipo y compiten en un formato definido.

**La regla distintiva: dentro de un torneo, un jugador solo puede pertenecer a un participante.** Si alguien tiene a Di María en su equipo del torneo, nadie más puede usarlo — **aunque lo tenga en su colección**.

Esto genera:

- **escasez real** dentro del grupo de amigos;
- **decisiones de verdad** (¿me apuro a reclamar al mejor, o armo un conjunto coherente?);
- **conversación** (el motivo por el que se juega entre amigos);
- **valor para los jugadores de segundo nivel**, que dejan de ser descarte.

## 35. Estructura de un torneo

```javascript
{
  id: "trn_a8f3k2",
  schemaVersion: 3,
  nombre: "Torneo de los Pibes",
  codigoInvitacion: "PIBES26",
  creadorId: "user_001",

  estado: "ARMADO",            // BORRADOR | ARMADO | EN_CURSO | FINALIZADO
  modoExclusividad: "RECLAMO", // RECLAMO | LIBRE  (DRAFT llega en V1.1)
  formato: "LIGA",             // LIGA | ELIMINACION | GRUPOS

  minParticipantes: 4,         // por debajo de 4 el torneo NO otorga sobres (§15.2)
  maxParticipantes: 8,
  participantes: ["user_001", "user_002", ...],

  // Avance de fecha — decisión B2. Manual, con campos listos para automatizar.
  modoAvance: "MANUAL",              // futuro: "AUTOMATICO"
  autoAvanceHoras: null,             // futuro: 24 o 48
  forzadoPorInactividadDias: 5,      // cualquiera puede forzar si el creador no avanza
  ultimoAvanceEn: "2026-08-25T18:00:00Z",

  // Índice de exclusividad: playerId → userId que lo reclamó
  jugadoresReclamados: {
    "arg_00147": "user_001",
    "arg_00023": "user_004"
  },

  ventanaArmadoCierra: "2026-09-01T20:00:00Z",
  fixture: [ /* partidos */ ],
  tabla: [ /* posiciones */ ],
  creadoEn: "2026-08-24T15:00:00Z"
}
```

## 36. Modos de exclusividad

> ✅ **Decisión B1 — CERRADA: RECLAMO con ventana de armado de 24hs es el único modo de la V1.0.**
>
> **Por qué no DRAFT:** el problema del draft no es técnico, es social. Coordinar a 8 amigos para estar conectados 40 minutos seguidos pasa una vez y nunca más; y la variante asíncrona con turnos de 12hs tarda 4 días en armar un torneo, para cuando el entusiasmo ya se murió.
>
> **Y hay una razón más de fondo:** si el DRAFT se hace desde pool común, tu colección deja de importar en el modo más competitivo del juego. Coleccionar es el corazón de Fútbol Figuritas — un modo donde la colección es irrelevante compite contra su propia premisa. El DRAFT queda como **modo especial de V1.1**, para "el torneo grande" que el grupo organiza como evento, no como default.

### 36.1. RECLAMO (modo de la V1.0)

El primero que pone a un jugador en su equipo del torneo lo bloquea para todos los demás.

**Ventajas:** simple de entender, simple de implementar, permite armar el equipo cuando quieras.
**Desventaja:** premia al que entra primero. Quien arma el equipo a las 3 de la mañana se queda con los mejores.

**Mitigación obligatoria — ventana de armado:**

El torneo no arranca hasta que se cierra la **ventana de armado** (por defecto 24 horas). Durante la ventana:

- todos pueden reclamar y liberar jugadores libremente;
- se ve en tiempo real qué jugadores ya fueron reclamados y por quién;
- podés reorganizar tu equipo tantas veces como quieras.

Al cerrarse la ventana, los equipos quedan congelados. Esto convierte el "quién llegó primero" en una **negociación de 24 horas entre amigos**, que es exactamente la conversación que querés generar.

### 36.2. DRAFT — diferido a V1.1

Selección por turnos en formato serpentina:

```text
Ronda 1:  A → B → C → D
Ronda 2:  D → C → B → A
Ronda 3:  A → B → C → D
...11 rondas
```

**Ventaja:** perfectamente justo. Es el formato más "deportivo".
**Desventaja:** requiere que todos estén conectados al mismo tiempo, o un sistema de turnos con timeout (60 segundos por pick, con autopick si vence).

**Implementar en V1.1.** El modo RECLAMO alcanza para lanzar.

### 36.3. LIBRE (sin exclusividad)

Cada uno usa lo que quiere. Sirve para torneos casuales o cuando el grupo es demasiado grande para el pool disponible.

## 37. Requisito de pool mínimo

> ⚠️ **Restricción que hay que validar al crear el torneo.**

Con exclusividad activa, N participantes necesitan **N × 11 jugadores distintos** en la unión de sus colecciones, con la distribución posicional correcta.

El cuello de botella son los **arqueros**: 8 participantes necesitan **8 arqueros distintos**, y los arqueros son solo ~10% del pool.

**Validación obligatoria al crear el torneo:**

```javascript
function validarPoolTorneo(participantes) {
  const union = unirColecciones(participantes);
  const n = participantes.length;

  const porPosicion = {
    POR: union.filter(j => j.position === "POR").length,
    DEF: union.filter(j => j.position === "DEF").length,
    MED: union.filter(j => j.position === "MED").length,
    DEL: union.filter(j => j.position === "DEL").length
  };

  // Peor caso: la formación más exigente en cada posición
  const requerido = { POR: n * 1, DEF: n * 5, MED: n * 5, DEL: n * 3 };

  for (const pos of ["POR", "DEF", "MED", "DEL"]) {
    if (porPosicion[pos] < requerido[pos]) {
      return { valido: false, pos, faltan: requerido[pos] - porPosicion[pos] };
    }
  }
  return { valido: true };
}
```

Si no alcanza, la UI ofrece tres salidas:

1. reducir el número de participantes;
2. cambiar el modo a `LIBRE`;
3. activar el **Pool de Reserva** (ver §37.1).

### 37.1. Pool de Reserva

> ✅ **Decisión B7 — CERRADA: limitar participantes + Pool de Reserva.**

El Pool de Reserva **no son jugadores genéricos inventados**. Son **jugadores reales del dataset, de rareza COMÚN, que ningún participante del torneo posee en su colección.**

```javascript
function generarPoolReserva(torneo, poolCompleto) {
  const poseidosPorAlguien = new Set(
    torneo.participantes.flatMap(uid => getColeccion(uid).map(c => c.playerId))
  );

  return poolCompleto.filter(j =>
    j.rarity === "COMUN" && !poseidosPorAlguien.has(j.id)
  );
}
```

**Reglas del Pool de Reserva:**

- Solo se puede recurrir a él si al usuario le faltan jugadores **de una posición concreta** para completar su XI.
- Máximo **3 jugadores de reserva** por equipo. Si necesitás más, el torneo es demasiado grande para el pool disponible y hay que reducir participantes.
- Los jugadores de reserva **también quedan sujetos a exclusividad** dentro del torneo: si lo agarraste vos, nadie más lo usa.
- Al terminar el torneo **no se quedan en tu colección**. Son un préstamo, no una recompensa.

**Por qué jugadores reales y no genéricos:** un "Defensor Genérico 3" rompe la inmersión y le recuerda al usuario que está usando un parche. Un juvenil real de Barracas Central que nadie tiene resuelve exactamente el mismo problema técnico, no rompe nada, y encima genera sabor: *"me tocó un pibe de Central Córdoba y me salvó el torneo"*. Costo de implementación adicional: **cero**, el pool ya está cargado.

## 38. Atomicidad del reclamo

> 🔴 **Punto crítico de implementación.** Dos usuarios pueden intentar reclamar al mismo jugador en el mismo instante. Esto **no** se puede resolver en el cliente.

El reclamo debe ejecutarse en una **transacción de Firestore, desde una Cloud Function**:

```javascript
// Cloud Function — reclamarJugador
exports.reclamarJugador = onCall(async (request) => {
  const { torneoId, playerId } = request.data;
  const uid = request.auth.uid;

  return db.runTransaction(async (t) => {
    const ref = db.collection("torneos").doc(torneoId);
    const torneo = (await t.get(ref)).data();

    if (torneo.estado !== "ARMADO")       throw new HttpsError("failed-precondition", "TORNEO_CERRADO");
    if (!torneo.participantes.includes(uid)) throw new HttpsError("permission-denied", "NO_PARTICIPANTE");

    const dueñoActual = torneo.jugadoresReclamados[playerId];
    if (dueñoActual && dueñoActual !== uid) {
      throw new HttpsError("already-exists", "JUGADOR_YA_RECLAMADO");
    }

    // Verificar que el usuario efectivamente posee al jugador
    const coleccion = await t.get(db.doc(`users/${uid}/collection/${playerId}`));
    if (!coleccion.exists) throw new HttpsError("permission-denied", "NO_POSEE_JUGADOR");

    t.update(ref, { [`jugadoresReclamados.${playerId}`]: uid });
    return { ok: true };
  });
});
```

**Nunca** escribir el reclamo directamente desde el cliente. La regla de Firestore debe prohibir la escritura de `jugadoresReclamados` a cualquiera que no sea el Admin SDK.

## 39. Liberación de jugadores

Un jugador vuelve al pool disponible del torneo cuando:

- el dueño lo saca de su XI del torneo (solo durante la ventana de armado);
- el participante abandona el torneo → **se liberan sus 11 jugadores de golpe**;
- el torneo finaliza.

Si un participante abandona con el torneo **en curso**, su equipo queda congelado y sus jugadores **no** se liberan (los partidos ya jugados deben seguir siendo válidos). Sus partidos restantes se dan por perdidos 0-3.

## 40. Formatos de torneo

| Formato | Descripción | Prioridad |
|---|---|---|
| **LIGA** | Todos contra todos, ida (o ida y vuelta). Tabla de posiciones | **V1.0** |
| **ELIMINACIÓN** | Llave directa. Requiere potencia de 2 o byes | V1.1 |
| **GRUPOS + PLAYOFF** | Fase de grupos y llave final | V1.2 |

**Empezar solo con LIGA.** Es el formato que mejor funciona entre amigos: todos juegan la misma cantidad de partidos y nadie queda afuera en la primera fecha.

## 41. Simulación de partidos del torneo

> ✅ **Decisión B2 — CERRADA: avance MANUAL, con campos preparados para automatizar a futuro.**

Los partidos del torneo **no** se juegan en tiempo real. Se simulan en el servidor cuando se avanza la fecha.

### 41.1. Avance manual

El **creador del torneo** dispara cada fecha con un botón. Esto le da control total al grupo: se juega cuando todos están, se pausa si alguien está de viaje, se acelera si hay ganas.

Antes de avanzar, la UI muestra quién ya confirmó su mentalidad para la fecha y quién no. El creador decide si espera o avanza igual (los que no confirmaron juegan con su última mentalidad usada).

### 41.2. Seguro anti-torneo-zombie

> ⚠️ **Riesgo del modo manual:** el creador se convierte en administrador único. Si se va de vacaciones a mitad del torneo, nadie puede avanzar y el torneo queda muerto con 4 fechas sin jugar.

**Mitigación:** si pasaron **5 días** desde el último avance, **cualquier participante** puede forzar la fecha.

```javascript
function puedeAvanzarFecha(torneo, uid) {
  if (uid === torneo.creadorId) return true;

  const diasSinAvance = (Date.now() - new Date(torneo.ultimoAvanceEn)) / 86400000;
  return diasSinAvance >= torneo.forzadoPorInactividadDias;
}
```

Manual sigue siendo manual, pero el torneo deja de depender de una sola persona.

### 41.3. Preparado para automatizar

Los campos `modoAvance` y `autoAvanceHoras` ya están en el schema (§35) aunque hoy valgan `"MANUAL"` y `null`. Migrar a avance automático en el futuro es:

1. setear `modoAvance: "AUTOMATICO"` y `autoAvanceHoras: 24`;
2. agregar un **Cloud Scheduler** que recorra los torneos y avance los que corresponda.

Cloud Scheduler ya viene incluido en el plan Blaze, así que no agrega ninguna decisión de costo nueva.

### 41.4. Dónde corre la simulación

En **Cloud Functions**, nunca en el cliente. El resultado se escribe en `torneos/{id}/partidos/{partidoId}` junto con su semilla (§23), y los clientes solo leen.

**Esta es una de las razones por las que Cloud Functions no es opcional** (ver §50.1).

## 42. Tabla de posiciones

```text
#  EQUIPO              PJ  G  E  P  GF  GC  DG  PTS
1  Los Pibes FC        7   5  1  1  14   6  +8   16
2  Tincho United       7   4  2  1  11   7  +4   14
```

Puntos: 3 / 1 / 0. Desempate: puntos → diferencia de gol → goles a favor → enfrentamiento directo.

## 43. Recompensas del torneo

| Puesto | Fichas |
|---|---|
| Campeón | 500 + (100 × participantes) |
| Subcampeón | 250 + (50 × participantes) |
| Tercero | 150 |
| Participar y completar todos los partidos | 100 |

Se otorgan **por Cloud Function**, nunca desde el cliente.

---

# PARTE VII — MULTIJUGADOR Y SOCIAL

## 44. Usuario

```javascript
{
  id: "user_001",
  schemaVersion: 3,
  nombre: "Tincho",
  email: "...",
  fotoPerfil: null,
  creadoEn: "...",

  // ✅ Monedas como OBJETO, no como campo suelto. Ver §48.3.
  monedas: {
    fichas: 1250,
    premium: 0        // sin uso en V1.0, pero el campo existe desde el día uno
  },

  // Contador de puntos para el Pack PREMIUM (§15.3)
  puntosAcumulados: 34,
  packsPremiumGanados: 2,
  amistososConPuntosHoy: 1,        // tope diario de 3 (§15.3.2)
  fechaContadorAmistosos: "2026-08-23",

  // Contadores de pity (§13.2, §13.3)
  paquetesDesdeUltimoArquero: 2,
  paquetesDesdeUltimoDestacado: 4,

  // Estado de bienvenida
  paquetesBienvenidaReclamados: true,

  ultimoPartidoDelDia: "2026-08-23"
}
```

Autenticación: email/password y Google.

**Subcolecciones:** `collection/`, `teams/`, `historial/`, `transacciones/`.

## 45. Perfil y estadísticas

```text
Nombre
Jugadores totales / Jugadores únicos
% de colección completada
Partidos · Victorias · Derrotas · Empates
GF · GC · Racha actual
Mejor equipo (mayor Valoración alcanzada)
Torneos jugados · Torneos ganados
```

## 46. Intercambios

Un usuario ofrece jugadores y pide otros. El otro acepta o rechaza.

**Reglas:**

- Solo se pueden ofrecer jugadores con `quantity ≥ 2`, o `quantity ≥ 1` si no están en ningún XI activo ni reclamados en un torneo en curso.
- El intercambio debe ejecutarse de forma **atómica**, en una Cloud Function con transacción.
- Nunca confiar en JavaScript del navegador para transferir jugadores, modificar cantidades, entregar recompensas o registrar resultados.

**Anti-abuso:** limitar a 10 intercambios por día por usuario, para evitar que se use para farmear una cuenta secundaria.

## 47. Logros

```text
Primer paquete · Primer XI · Primera victoria
10 victorias · 50 victorias
100 jugadores · Colección completa de un club
5 victorias consecutivas
Primer ESTRELLA · Primera LEYENDA
Ganar un torneo · Ganar un torneo invicto
Ganar con un equipo 15 puntos inferior al rival
```

El último es importante: **premia explícitamente el uso inteligente de la táctica**, que es el corazón del juego.

---

# PARTE VIII — MONETIZACIÓN Y MARCO LEGAL

## 48. Modelo de negocio

> ✅ **Decisión B4 — CERRADA: NO se monetiza. Se diseña sin cerrar puertas.**

**Fase 1 (actual y por tiempo indefinido):** juego gratuito entre amigos. Sin monetización de ningún tipo. Objetivo único: validar que el ciclo es divertido.

**Fase 2 (condicional, sin fecha):** si el juego demuestra retención sostenida en el grupo de prueba, evaluar el modelo híbrido (cosmética + paquetes, con torneos DRAFT como modo competitivo limpio).

### 48.0. Por qué no monetizar ahora

Además de la razón obvia (todavía no está validado que sea divertido), hay una razón estructural que conviene tener explícita:

**Para que la venta de paquetes rinda dinero hace falta escala.** Con 20 amigos no se gana nada, ni cerca. El modelo solo funciona si el juego sale del círculo cerrado — y en el momento en que sale del círculo, se activa todo el problema legal de §49 (nombres, ratings, imágenes).

Es decir: **B4 y B5 son en el fondo la misma decisión.** No se puede monetizar sin abrir el juego, y no se puede abrir el juego sin resolver los derechos. Tratarlas por separado da la ilusión de que se puede avanzar en una sin tocar la otra.

### 48.3. Qué hacer AHORA para no cerrar puertas

Cuesta cero y evita un refactor doloroso más adelante:

**1. Monedas como objeto, nunca como campo suelto.**

```javascript
// ✅ correcto desde el día uno
monedas: { fichas: 1250, premium: 0 }

// ❌ obliga a refactorizar todo el proyecto el día que agregues una segunda moneda
fichas: 1250
```

**2. Todos los precios y valores económicos en un objeto de configuración único** (ver §15.7). Nunca constantes desparramadas por el código.

**3. Registro de transacciones desde el día uno:**

```javascript
// users/{uid}/transacciones/{txId}
{
  tipo: "PAQUETE_TORNEO",   // BIENVENIDA | PAQUETE_TORNEO | PACK_PUNTOS | COMPRA_FICHAS | VENTA_JUGADOR
  cantidad: 1,
  origen: "torneo:trn_a8f3k2",
  jugadoresRecibidos: ["arg_00147", ...],
  fecha: "..."
}
```

Este registro **no sirve para nada hoy**. Pero el día que entre dinero real vas a necesitar auditoría, y reconstruirla hacia atrás es imposible. Es la clase de cosa que cuesta 20 líneas hoy y es irrecuperable después.

**4. Toda entrega de valor pasa por Cloud Function** (§50.1). Ya es requisito por seguridad; también es requisito por auditoría.

### 48.1. Regla de oro (para cuando llegue el momento)

> El juego debe seguir siendo **100% jugable y competitivo gratis.** El dinero acelera; no habilita.

Concretamente:

- Todo paquete comprable con dinero debe ser también obtenible con Fichas ganadas jugando.
- No debe existir ningún jugador exclusivo de pago.
- No debe existir ninguna mentalidad, formación ni funcionalidad de juego detrás de un pago.

**Si esto se rompe, el grupo de amigos se rompe.** Nadie sigue jugando un juego donde el que puso plata gana siempre — y sin el grupo, no hay negocio.

### 48.2. Tensión: monetización + exclusividad de torneo

> ⚠️ **Riesgo de diseño que hay que tener presente desde ahora.**

El sistema de torneos con exclusividad (PARTE VI) y la venta de paquetes están en **tensión directa**: quien compra más paquetes tiene una colección más grande, y por lo tanto más y mejores jugadores para reclamar antes que los demás. Eso es pay-to-win estructural, no cosmético.

**Mitigaciones recomendadas:**

1. **Torneos DRAFT desde pool común.** En este modo, el pool de selección **no es la colección de cada uno**, sino el pool completo del juego. Todos eligen de la misma bolsa por turnos. La colección no importa. Este es el modo "competitivo puro" y debería ser el recomendado para torneos con premio.
2. **Torneos con tope de valoración.** El torneo define un techo (ej. Valoración máxima 78). Comprar más no ayuda si no podés usar a los mejores.
3. **Monetización preferentemente cosmética.** Escudos, nombres de equipo, animaciones de apertura, marcos de carta. Es el ingreso más limpio y no toca el balance.

### 48.3. Cajas aleatorias: obligaciones

La venta de paquetes con contenido aleatorio por dinero real es, legalmente, una **loot box**. Obligaciones prácticas:

- **Publicar las probabilidades** de cada rareza de forma visible dentro de la app. Es requisito de las tiendas de Apple y Google, y de la regulación de varias jurisdicciones.
- **No dirigirlo a menores** ni usar patrones oscuros (cuentas regresivas falsas, ofertas "por tiempo limitado" permanentes).
- Revisar la normativa argentina vigente al momento de monetizar (el marco puede haber cambiado).
- Considerar ofrecer también **compra directa** de jugadores concretos, además de paquetes aleatorios. Reduce el riesgo regulatorio y muchos usuarios lo prefieren.

## 49. Derechos sobre nombres e imágenes

> ✅ **Decisión B5 — CERRADA: nombres reales, uso privado, sin cobrar y sin registro público abierto.**
>
> **La buena noticia:** la arquitectura ya permite postergar esta decisión sin costo. Como la rareza se calcula por percentiles (§11) y no por valores absolutos, **cambiar de dataset real a dataset ficticio es cambiar un archivo JSON**. El balance se recalibra solo, sin tocar una línea de lógica.
>
> Eso significa que podés jugar con nombres reales entre amigos durante meses y, si el juego prende y querés abrirlo, generar un dataset propio sin reescribir nada. **No estás construyendo una dependencia.**
>
> **Condición que dispara la revisión:** el momento de resolver esto es *antes* de abrir el registro público o cobrar el primer peso. No después.

> 🔴 **Lo que sigue es el análisis para esa eventual fase. Este es el mayor riesgo legal del proyecto si se monetiza.**

Hay **tres capas de derechos independientes**:

| Capa | Titular | Riesgo si monetizás |
|---|---|---|
| **Ratings y stats** | EA Sports (si venís de su dataset) | Alto |
| **Nombres de jugadores** | Cada jugador (derecho de imagen) / su representación colectiva | Alto |
| **Fotos, escudos, logos** | Clubes, agencias fotográficas, AFA | Muy alto |

En §28 se establece que el relato usa los nombres reales del XI. Eso es correcto para el prototipo, pero **incompatible con un producto comercial sin licencia**.

**Camino recomendado si se monetiza:**

1. **Stats:** derivarlas de datos de rendimiento reales y públicos (goles, minutos, asistencias) obtenidos vía una API con términos de uso claros. Los datos deportivos objetivos tienen mucha menos protección que un rating propietario.
2. **Nombres:** consultar con un abogado. Las alternativas son licenciar (caro, poco realista a esta escala), usar nombres modificados (arruina la experiencia), o asumir el riesgo con un producto chico. **Es una decisión que debe tomarse con asesoramiento, no por analogía con otros juegos.**
3. **Imágenes:** arte propio, ilustraciones generadas o siluetas genéricas. Nunca fotos de agencias. Esta es la capa más fácil de resolver limpiamente y la más peligrosa de ignorar.

**Para la fase de juego entre amigos, sin cobrar y sin distribución pública, el riesgo práctico es bajo.** El momento de resolverlo es antes de abrir el registro público o cobrar el primer peso, no después.

---

# PARTE IX — ARQUITECTURA TÉCNICA

## 50. Stack

**Frontend:** HTML, CSS, JavaScript vanilla.
**Backend:** Firebase (Authentication, Cloud Firestore, **Cloud Functions**, Hosting).
**Persistencia del prototipo actual:** `localStorage`.

### 50.1. Cloud Functions es obligatorio, no opcional

> 🔴 **Corrección respecto de v0.1**, que lo listaba como "posiblemente".

Las siguientes operaciones **no se pueden resolver solo con reglas de Firestore** y requieren Cloud Functions:

| Operación | Por qué |
|---|---|
| Reclamo de jugador en torneo (§38) | Necesita transacción con lectura de otro documento |
| Simulación de partidos (§41) | El cliente no puede decidir el resultado |
| Intercambios (§46) | Escritura atómica en dos colecciones de usuarios distintos |
| Entrega de recompensas y Fichas | El cliente no puede acreditarse moneda |
| Apertura de paquetes | El cliente no puede decidir qué le tocó |

> ⚠️ **Implicancia de costo:** Cloud Functions requiere el **plan Blaze** de Firebase, que exige tarjeta de crédito y facturación por uso. Tiene una capa gratuita generosa (2 millones de invocaciones/mes), suficiente de sobra para un grupo de amigos, pero **es una decisión de negocio, no técnica**, y hay que tomarla antes de empezar la V0.7.

## 51. Modelo de datos en Firestore

```text
players/{playerId}                    ← catálogo global, solo lectura para clientes
clubs/{clubId}                        ← catálogo global, solo lectura

users/{userId}                        ← perfil, fichas, contadores de pity
users/{userId}/collection/{playerId}  ← { playerId, quantity, obtenidoEn }
users/{userId}/teams/{teamId}         ← ver abajo
users/{userId}/historial/{matchId}    ← resumen de partidos jugados

torneos/{torneoId}                    ← ver §35
torneos/{torneoId}/partidos/{id}      ← resultado + semilla + eventos

matches/{matchId}                     ← amistosos. { jugadores: [uidA, uidB], ... }
```

### 51.1. No guardar stats calculadas

> 🟢 **Mejora respecto de v0.1**, que guardaba `attack, midfield, defense, overall` dentro del documento del equipo.

El problema: el día que ajustes un peso de balance (§20), **todos los equipos guardados quedan con números viejos**, y no hay forma limpia de recalcularlos masivamente.

```javascript
// users/{userId}/teams/{teamId}
{
  schemaVersion: 3,
  nombre: "Mi Equipo",
  formacion: "4-3-3",
  mentalidadOfensiva: "EQUIPO_RAPIDO",
  mentalidadDefensiva: "LINEA_MEDIA",
  players: ["arg_00147", "arg_00023", ...],   // 11 IDs
  actualizadoEn: "..."
  // NO se guardan ataque, mediocampo, defensa ni valoración: se recalculan siempre
}
```

**Excepción:** en el documento de un **partido ya jugado** sí se guarda una copia congelada de las stats usadas, porque ese resultado es histórico y no debe cambiar retroactivamente.

### 51.2. Documentos de partido con dos dueños

`matches/{matchId}` tiene dos participantes. Para que las reglas de seguridad sean escribibles sin dolor, usar un array:

```javascript
{ jugadores: ["user_001", "user_002"], ... }
```

Y la regla:

```javascript
allow read: if request.auth.uid in resource.data.jugadores;
allow write: if false;  // solo el Admin SDK escribe
```

## 52. Versionado de datos

> 🟢 **Mejora que no existía en v0.1.**

**Todo objeto persistido lleva `schemaVersion`.** Sin esto, el primer cambio de estructura rompe la partida guardada de cualquiera que esté testeando, y la migración de `localStorage` a Firestore se vuelve un desastre.

```javascript
const SCHEMA_VERSION_ACTUAL = 3;

function migrar(objeto) {
  let o = { ...objeto };
  if (!o.schemaVersion)      o = migrarDe0a1(o);
  if (o.schemaVersion === 1) o = migrarDe1a2(o);
  if (o.schemaVersion === 2) o = migrarDe2a3(o);   // fichas → monedas.fichas
  return o;
}

// Ejemplo real: el cambio de moneda suelta a objeto (§48.3)
function migrarDe2a3(o) {
  return {
    ...o,
    monedas: { fichas: o.fichas ?? 0, premium: 0 },
    fichas: undefined,
    puntosAcumulados: o.puntosAcumulados ?? 0,
    packsPremiumGanados: o.packsPremiumGanados ?? 0,
    schemaVersion: 3
  };
}
```

Toda lectura de `localStorage` pasa por `migrar()` antes de usarse.

## 53. Seguridad

La versión final debe contemplar:

- manipulación del frontend;
- generación falsa de paquetes;
- modificación de cantidades;
- modificación de stats de jugadores;
- resultados de partido falsos;
- intercambios fraudulentos;
- reclamo de jugadores que no se poseen;
- acceso no autorizado a torneos ajenos.

**Regla general:** el cliente puede **leer** y puede **pedir**. Nunca puede **decidir**.

Toda lógica que otorgue valor (jugadores, fichas, resultados, reclamos) vive en Cloud Functions.

### 53.1. Verificación de partidos

Como los partidos se simulan con un PRNG con semilla (§23), el servidor puede almacenar `{semilla, equipoA, equipoB, resultado}` y re-verificar cualquier partido a pedido. Si el resultado no coincide, es un intento de manipulación.

## 54. Separación jugador / inventario

Es fundamental separar el **catálogo** del **inventario**:

```text
players/arg_00147           →  datos del jugador (compartidos por todos)
users/u1/collection/arg_00147  →  { quantity: 3 }
```

Esto simplifica colección, intercambios, equipos, sincronización y base de datos. El catálogo se descarga una vez y se cachea.

## 55. Datos de clubes

```javascript
{
  id: "club_012",
  name: "Club X",
  shortName: "CLX",
  logo: null,      // placeholder hasta resolver derechos (§49)
  colors: { primary: "#...", secondary: "#..." },
  stadium: "..."
}
```

Los colores permiten generar escudos y camisetas **propios** procedimentalmente, evitando el problema de derechos sobre logos reales. Es la solución más barata y limpia.

---

# PARTE X — ROADMAP Y ESTADO ACTUAL

## 56. Estado actual del prototipo

Implementado:

- HTML / CSS / JavaScript
- Jugadores de prueba
- Paquetes
- Colección con cantidades
- Filtros por posición
- Constructor de equipo
- Formación 4-3-3
- Reglas de posiciones
- Control de jugadores repetidos
- Ataque / Mediocampo / Defensa / Valoración
- Validación del XI

Persistencia: `localStorage`. Firebase: pendiente.

## 57. Roadmap

### V0.4 — Datos reales y recalibración ⬅️ **PRÓXIMO PASO**

> 🔴 **Esta fase se adelantó respecto de v0.1.** No se puede diseñar rareza, probabilidades ni balance sin conocer la distribución real del pool.

- Bajar el dataset de la Liga Profesional (§10)
- Convertir a `jugadores.json` limpio
- **Graficar la distribución de Overall** y verificar los supuestos de §11
- Implementar `asignarRarezas()` por percentiles
- Refactorizar las fórmulas de Ataque/Medio/Defensa según §20
- Cambiar Valoración a derivada (§20.4)
- Agregar `schemaVersion` y `migrar()` (§52)
- Eliminar el concepto "Utilizado / Disponible" (§16.2)
- Crear `config/economia.js` con todos los valores centralizados (§15.7)
- Implementar los **5 paquetes de bienvenida** (§13.1)

### V0.5 — Competir vs IA

- Pantalla de comparación (mi equipo vs rival)
- Generador de rival IA con dificultades (§31)
- Botón `COMENZAR PARTIDO`

Pantalla:

```text
MI EQUIPO                        RIVAL
Ataque       78.2                Ataque       74.9
Mediocampo   75.6                Mediocampo   77.1
Defensa      80.1                Defensa      72.4
─────────────────                ─────────────────
VALORACIÓN   78.0                VALORACIÓN   74.8
4-3-3                            4-4-2
[mentalidad oculta]              [mentalidad oculta]

           [ COMENZAR PARTIDO ]
```

### V0.6 — Motor de partido

- PRNG con semilla (§23)
- Motor por posesiones (§24, §25)
- Eventos básicos: GOL, ATAJADA, ATAQUE_CORTADO
- **Script de simulación masiva (§33)** ← no saltear
- Calibrar `D` y el factor de gol

### V0.7 — Resultado y relato

- Marcador y estadísticas
- Relato con plantillas (§28)
- MVP del partido (§30)

### V0.8 — Formaciones y mentalidades

- Formaciones como dato (§17)
- Selector de formación en el constructor
- Mentalidades ofensiva y defensiva (§19)
- Matriz de contras y compatibilidad estructural
- Análisis táctico post-partido (§19.5)
- **Re-correr el script de balance** con el sistema completo

### V0.9 — Firebase

- Authentication (email + Google)
- Migración de `localStorage` a Firestore
- Cloud Functions: apertura de paquetes, entrega de Fichas
- Reglas de seguridad

### V1.0 — Torneos

- Creación de torneo con código de invitación (mín. 4 participantes)
- Modo RECLAMO con ventana de armado de 24hs (§36.1)
- Validación de pool mínimo + Pool de Reserva (§37, §37.1)
- Cloud Function de reclamo atómico (§38)
- Formación y XI congelados al cerrar la ventana; mentalidad libre (§17.3)
- Formato LIGA con fixture y tabla
- Avance de fecha manual + forzado por inactividad (§41)
- **Sobre gratis antes de cada partido de torneo** (§15.2)
- Recompensas de torneo

### V1.1 — Social y economía

- Amistosos entre usuarios (§32)
- Intercambios (§46)
- Logros
- Modo DRAFT de torneo (§36.2) — el "torneo grande" del grupo

### V1.2 — Pulido

- Formaciones adicionales
- Posiciones secundarias (§18)
- Eventos de partido ampliados (§27)
- Formatos ELIMINACIÓN y GRUPOS

### V2.0 — Monetización (condicional)

Solo si la V1.x demostró ser divertida y sostenida en el grupo de prueba. Requiere resolver PARTE VIII completa antes de escribir una línea de código.

## 58. Definición de MVP

El MVP real es:

```text
ABRIR PAQUETE → 6 JUGADORES → COLECCIÓN → ARMAR XI
→ ELEGIR MENTALIDAD → VALIDAR → COMPETIR → PARTIDO → RESULTADO
```

**Si este ciclo es divertido para vos y tres amigos durante una semana, el proyecto tiene base sólida.** Si no lo es, ninguna cantidad de sistemas adicionales lo va a salvar.

## 59. Criterio de éxito

```text
ABRIR → COLECCIONAR → DECIDIR → ARMAR → ELEGIR TÁCTICA
→ COMPETIR → GANAR/PERDER → QUERER MEJORAR → VOLVER A ABRIR
```

**Test concreto:** si en el grupo de amigos alguien manda un mensaje diciendo "me ganaste porque jugaste con bloque bajo, la próxima te reviento con centros" — el juego funcionó. Ese mensaje es el producto.

---

# APÉNDICE A — SISTEMAS FUTUROS

Todo lo de esta sección está **fuera del alcance de la V1.0**. Se documenta para no perder las ideas, no para implementarlas.

## A1. Química

Bonus por afinidad entre jugadores del XI: mismo club, misma nacionalidad, posiciones compatibles.

```text
3 jugadores del mismo club → +2 a las áreas donde participan
```

Requiere `nationality` y `clubId` en el modelo (ya incluidos en §8).

## A2. Suplentes y sustituciones

Banco de 7. Sustituciones manuales, automáticas, por lesión, por fatiga o tácticas.

## A3. Fatiga

Los jugadores acumulan cansancio entre partidos, afectando rendimiento, ritmo y precisión. Da valor real al banco y a la profundidad de la colección.

## A4. Lesiones

Solo incorporar cuando el motor básico esté equilibrado. Alto riesgo de frustración si se implementa mal.

## A5. Temporadas

Actualización periódica de jugadores, clubes, stats y eventos. Requiere el sistema de versionado de §52.

## A6. Eventos especiales

Semana del Superclásico, Clásicos, Copa Argentina, Jugador de la Semana. Modifican temporalmente probabilidades, recompensas y desafíos.

## A7. Mercado de transferencias

Compra y venta entre usuarios con precios libres. **Advertencia:** un mercado con precios libres y monetización real convierte el juego en un mercado especulativo, con implicancias legales y de moderación mucho mayores. Evaluar con mucho cuidado.

## A8. Ranking global y ligas por división

Solo tiene sentido con una base de usuarios grande. Irrelevante para el caso de uso "amigos".

## A9. Stats específicas de arquero

Reemplazar la fórmula provisional de §20.3 por atributos propios: Reflejos, Estirada, Posicionamiento, Manejo, Saque. Los campos ya existen en el schema (§8).

---

# APÉNDICE B — DECISIONES TOMADAS

**Las 7 decisiones abiertas de la v0.2 quedaron cerradas.** Este apéndice pasa de ser una lista de pendientes a un registro de decisiones, con su fundamento y su condición de revisión.

| # | Decisión | Resuelto | Sección |
|---|---|---|---|
| **B1** | Modo de exclusividad | **RECLAMO** con ventana de 24hs. DRAFT diferido a V1.1 | §36 |
| **B2** | Avance de fechas | **MANUAL** por el creador + forzado por inactividad a los 5 días. Campos listos para automatizar | §41 |
| **B3** | Economía de paquetes | **5 de bienvenida** + **1 sobre antes de cada partido de torneo** + **3 sobres PREMIUM a los 50 pts**. **La IA no otorga sobres ni puntos** | §15 |
| **B4** | Monetización | **NO monetizar.** Diseñar sin cerrar puertas (monedas como objeto, config centralizada, registro de transacciones) | §48 |
| **B5** | Nombres reales | **Sí, en uso privado sin cobrar.** Dataset intercambiable, decisión revisable sin refactor | §49 |
| **B6** | Cambio de mentalidad en torneo | **Mentalidad libre entre fechas. Formación y XI congelados** | §17.3 |
| **B7** | Pool insuficiente en torneos | **Limitar participantes + Pool de Reserva** con jugadores COMÚN reales que nadie posee (máx. 3, en préstamo) | §37.1 |

## B.1. Fundamentos resumidos

**B1 — RECLAMO sobre DRAFT.** El problema del draft es social, no técnico: coordinar 8 personas 40 minutos pasa una vez. Y un draft desde pool común vuelve irrelevante la colección, que es el corazón del juego.

**B2 — Manual con seguro.** El manual da control al grupo, pero convierte al creador en punto único de falla. El forzado a los 5 días resuelve el torneo zombie sin quitarle el control.

**B3 — La progresión pasa exclusivamente por jugar contra personas.** Los partidos vs IA son ilimitados (~15 segundos cada uno), así que atarles sobres o puntos sería una canilla infinita: alguien podría abrir 240 paquetes en una hora de spam. Los partidos de torneo, en cambio, son estructuralmente finitos — hay uno por fecha y las fechas las dispara el creador. El grifo se cierra solo, sin topes artificiales. La IA queda como sandbox para probar tácticas y como fuente de Fichas, nada más.

**B4 y B5 son la misma decisión disfrazada de dos.** Monetizar exige escala, la escala exige abrir el juego, y abrir el juego activa el problema de derechos. No se puede avanzar en una sin tocar la otra.

**B6 — La contradicción que se detectó al cerrar B1.** Permitir cambiar formación durante un torneo con exclusividad puede dejar a un participante con un equipo inválido e incompletable, porque los jugadores que necesita ya están reclamados.

**B7 — Jugadores reales antes que genéricos.** Un "Defensor Genérico 3" rompe la inmersión; un juvenil real que nadie tiene resuelve el mismo problema técnico con costo cero y aporta sabor.

## B.2. Condiciones de revisión

Ninguna de estas decisiones es permanente. Cada una tiene un disparador explícito para reconsiderarla:

| # | Se revisa cuando... |
|---|---|
| B1 | El grupo pida un torneo "serio" → habilitar DRAFT en V1.1 |
| B2 | Los torneos se estanquen seguido → activar `modoAvance: "AUTOMATICO"` |
| B3 | El testeo muestre que el ritmo se siente lento o saturado → ajustar `config/economia.js` |
| B4 | La V1.0 demuestre retención sostenida durante 2–3 meses |
| B5 | Antes de abrir registro público o cobrar. **Nunca después** |
| B6 | Solo si se elimina la exclusividad de torneos |
| B7 | Si los grupos superan consistentemente los 8 participantes |

---

# APÉNDICE C — DEUDA TÉCNICA CONOCIDA

| # | Deuda | Por qué existe | Cuándo resolverla |
|---|---|---|---|
| **C1** | `scoreArquero()` usa `overall`, mientras todas las demás fórmulas usan stats puros. Es inconsistente | El dataset no siempre trae stats de arquero completas | Cuando se resuelva A9 |
| **C2** | Los pesos de todas las fórmulas son estimaciones no validadas | No hay datos de balance todavía | Después del script de §33 |
| **C3** | Las probabilidades de paquete (§14) son un punto de partida | Falta simular la curva de progresión | V0.9 |
| **C4** | El modo RECLAMO premia al que llega primero, aun con ventana de armado | Es el modo más simple de implementar (decisión B1) | Mitigado con DRAFT en V1.1 |
| **C5** | El relato necesita ≥6 plantillas por evento y todavía no existen | Contenido, no código | V0.7 |
| **C6** | No hay estrategia de moderación para nombres de equipo de usuarios | No hay usuarios todavía | Antes de abrir registro público |
| **C7** | El sobre pre-partido de torneo no sirve para el torneo en curso | Consecuencia inevitable de congelar el XI (B6) | Se resuelve con comunicación en la UI, no con código (§15.2) |
| **C8** | El modo vs IA no otorga ninguna progresión (ni sobres ni puntos) | Decisión deliberada: los partidos vs IA son ilimitados y cualquier recompensa sería una canilla infinita | No se resuelve — es diseño. Revisar solo si la IA queda tan vacía que nadie la usa ni para probar tácticas |
| **C9** | El jugador sin grupo de amigos depende solo de Fichas | Consecuencia de que la progresión pase por jugar con personas | Aceptado. 9 paquetes/semana alcanza para ser competitivo (§15.6) |
| **C10** | El tope de 3 amistosos con puntos por día es un número sin validar | Se puso para tapar el único vector de farmeo restante | Ajustar en `config/economia.js` si el testeo muestra que molesta a jugadores legítimos |

---

# APÉNDICE D — COMPARACIÓN CONTRA EL PRODUCTO FINAL

Actualizar esta tabla a medida que se implementa.

| Sistema | Prioridad | Estado | Notas |
|---|---|---|---|
| Paquetes de 6 | V0.1 | ✅ Hecho | |
| Colección automática | V0.1 | ✅ Hecho | |
| Repetidos y cantidades | V0.1 | ✅ Hecho | Falta eliminar "Utilizado/Disponible" |
| Filtros por posición | V0.1 | ✅ Hecho | |
| Constructor de XI | V0.2 | ✅ Hecho | Falta refactor a formación como dato |
| Stats de equipo | V0.3 | ⚠️ Parcial | Fórmulas a corregir según §20 |
| Datos reales | V0.4 | ⬜ Pendiente | |
| Rareza por percentiles | V0.4 | ⬜ Pendiente | |
| Paquete de arranque y pity | V0.4 | ⬜ Pendiente | |
| Rival IA | V0.5 | ⬜ Pendiente | |
| Motor de partido | V0.6 | ⬜ Pendiente | |
| Script de balance | V0.6 | ⬜ Pendiente | **No saltear** |
| Relato y MVP | V0.7 | ⬜ Pendiente | |
| Formaciones múltiples | V0.8 | ⬜ Pendiente | |
| Mentalidades | V0.8 | ⬜ Pendiente | |
| Firebase Auth | V0.9 | ⬜ Pendiente | |
| Cloud Functions | V0.9 | ⬜ Pendiente | Requiere plan Blaze |
| Torneos con exclusividad | V1.0 | ⬜ Pendiente | |
| Amistosos entre usuarios | V1.1 | ⬜ Pendiente | |
| Intercambios | V1.1 | ⬜ Pendiente | |
| Modo DRAFT | V1.1 | ⬜ Pendiente | |
| Química | Futuro | ⬜ Apéndice A | |
| Suplentes / Fatiga / Lesiones | Futuro | ⬜ Apéndice A | |
| Monetización | V2.0 | ⬜ Condicional | Requiere PARTE VIII resuelta |

---

# FIN DEL DOCUMENTO

**Fútbol Figuritas — Documento Maestro del Proyecto v0.2**
