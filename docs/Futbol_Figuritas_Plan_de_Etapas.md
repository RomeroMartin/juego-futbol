# FÚTBOL FIGURITAS — Plan de Etapas para Claude Code

**Acompaña a:** `Futbol_Figuritas_Proyecto_v3.md`
**Versión:** 1.0

---

## CÓMO USAR ESTE DOCUMENTO

Este archivo divide el desarrollo en **10 etapas**. Cada etapa es **una sesión de trabajo con Claude Code**.

**Reglas de uso:**

1. **Una etapa por conversación.** No arrancar la siguiente en la misma sesión, aunque sobre contexto. Cada etapa arranca con contexto limpio.
2. **Testear antes de avanzar.** Cada etapa tiene un bloque `CÓMO TESTEAR`. Si no pasa, se corrige en esa misma sesión, no en la siguiente.
3. **No saltear etapas.** El orden está armado por dependencias reales.
4. **Los dos archivos van juntos.** En cada sesión hay que pasarle a Claude Code el documento maestro (`v3`) **y** este archivo.

**Hitos de validación:**

| Después de... | Podés... |
|---|---|
| **Etapa 4** | Jugar el ciclo completo de punta a punta. **Momento de validar si es divertido.** |
| **Etapa 6** | Probarlo con amigos en distintas computadoras |
| **Etapa 9** | Jugar el primer torneo real del grupo |

---

## PROMPT DE ARRANQUE

> Copiar y pegar esto al inicio de **cada** sesión, cambiando el número de etapa.

```text
Estoy desarrollando "Fútbol Figuritas", un juego web de colección y competencia
de fútbol argentino. Te adjunto dos archivos:

1. Futbol_Figuritas_Proyecto_v3.md → el documento maestro con TODAS las
   especificaciones, fórmulas y decisiones de diseño ya cerradas.
2. Futbol_Figuritas_Plan_de_Etapas.md → el plan de trabajo por etapas.

Vamos a trabajar SOLO la ETAPA [N]. No implementes nada de otras etapas.

STACK (no negociable):
- HTML, CSS y JavaScript vanilla. Sin frameworks, sin build tools, sin npm.
- Sin dependencias externas salvo el SDK de Firebase cuando corresponda (Etapa 7+).
- Todo tiene que correr abriendo un index.html en el navegador.

REGLAS DE TRABAJO:
- Si el documento maestro define una fórmula, un valor o una regla, USALA TAL CUAL.
  No la "mejores" ni la reemplaces por tu criterio.
- Si algo NO está definido en el documento, PREGUNTAME antes de decidirlo.
  No inventes valores de balance ni reglas de juego.
- No agregues features que no estén en la etapa actual, aunque parezcan obvias
  o "ya que estamos".
- Código comentado en español.
- Al terminar, decime: qué archivos creaste/modificaste, qué quedó pendiente,
  y cómo testear que funciona.

Antes de escribir código, mostrame tu plan de ataque para esta etapa y esperá
mi confirmación.
```

---

## ETAPA 0 — Auditoría y alineación del código existente

> 🔴 **Etapa obligatoria. No saltear.** Ya existe código de la V0.3 escrito con las fórmulas y estructuras viejas. Si se apilan features encima, los errores se arrastran a todo el proyecto.

**Objetivo:** que el código actual quede alineado con el documento maestro. **Cero features nuevas.**

**Tareas:**

1. Leer todo el código existente y reportar en qué estado está.
2. Reorganizar en esta estructura de carpetas:
   ```
   /index.html
   /css/
   /js/
     /config/economia.js
     /config/formaciones.js
     /data/jugadores.json
     /core/calculos.js
     /core/storage.js
     /ui/
   ```
3. Corregir las fórmulas de Ataque, Mediocampo y Defensa según **§20** (con el `console.assert` de pesos de §20.0).
4. Cambiar Valoración a **derivada de las tres áreas** (§20.4). Mostrar el OVR medio aparte y etiquetado.
5. Agregar `schemaVersion` y la función `migrar()` (§52).
6. Eliminar el concepto **"Utilizado / Disponible"** de la colección (§16.2). Solo `xN`.
7. Crear `config/economia.js` con todos los valores de §15.7.
8. Agregar los campos faltantes al modelo de jugador (§8), aunque queden en `null`.

**NO hacer:** ningún cambio visual, ninguna feature nueva, no tocar el motor de partido (no existe todavía).

**CÓMO TESTEAR:**
- El juego funciona exactamente igual que antes de la etapa.
- Los números de Ataque/Medio/Defensa cambiaron (es lo esperado).
- La Valoración ya no es el promedio de OVR.
- En consola no salta ningún assert de pesos.
- Recargar la página no pierde datos.

---

## ETAPA 1 — Datos reales y rareza

**Objetivo:** reemplazar los jugadores de prueba por el plantel real de la Liga Profesional, con rareza calculada por percentiles.

> ⚠️ **Tarea previa tuya, no de Claude Code:** bajar el CSV del dataset (§10.1) y ponerlo en la carpeta del proyecto. Claude Code no puede descargarlo.

**Tareas:**

1. Script `convertir-dataset.js` que tome el CSV y genere `data/jugadores.json` con el modelo de §8.
2. Filtrar solo Liga Profesional Argentina.
3. Implementar `asignarRarezas()` por percentiles (§11.2).
4. Script `analizar-pool.js` que imprima en consola:
   - total de jugadores;
   - cantidad por posición;
   - cantidad por rareza;
   - histograma de Overall (mín, máx, media, mediana);
   - **cuántos arqueros hay** (es el cuello de botella de los torneos, §37).
5. Cargar el JSON en el juego y verificar que todo sigue funcionando.

**NO hacer:** no tocar el balance ni las probabilidades de paquete todavía.

**CÓMO TESTEAR:**
- `analizar-pool.js` corre y muestra los números.
- Las 5 rarezas tienen jugadores (ninguna en 0).
- Hay al menos 60 arqueros en el pool.
- La colección muestra nombres y clubes reales.

> 📌 **Mirá bien el histograma antes de seguir.** Si la distribución no se parece a lo que asume el documento, avisame y recalibramos §11 y §14 antes de la Etapa 2.

---

## ETAPA 2 — Motor de partido (sin interfaz)

> Esta etapa **no produce nada visible**. Es lógica pura, testeada por consola. Es la etapa más importante del proyecto.

**Objetivo:** que exista un motor que simule partidos y que esté equilibrado, antes de gastar tiempo en la UI.

**Tareas:**

1. Implementar `mulberry32()` (§23). **Prohibido usar `Math.random()` en el motor.**
2. Implementar `probabilidadDuelo()` con `D = 18` (§22).
3. Implementar `simularPartido()` por posesiones (§24, §25).
4. Implementar `elegirGoleador()` con pesos por posición (§26).
5. Eventos: `GOL`, `ATAJADA`, `ATAQUE_CORTADO`.
6. **Script `simular-balance.js`** (§33) que corra 10.000 partidos y reporte la tabla de objetivos.
7. Ajustar `D` y el factor `0.42` hasta cumplir la tabla de §33.

**NO hacer:** nada de interfaz, nada de mentalidades (llegan en la Etapa 5), nada de rival IA.

**CÓMO TESTEAR:**
- `simular-balance.js` cumple **todos** los objetivos de §33.
- Dos simulaciones con la misma semilla dan **exactamente** el mismo resultado.
- Con equipos parejos, ningún lado supera el 45% de victorias.
- Promedio de goles entre 2.4 y 3.2.

> 🔑 **No avanzar si la tabla de §33 no da.** Todo el juego depende de este balance. Es mucho más barato corregirlo acá que después de tener 6 etapas construidas encima.

---

## ETAPA 3 — Rival IA y pantalla de partido

**Objetivo:** poder apretar un botón y jugar un partido contra la máquina.

**Tareas:**

1. Implementar `generarRivalIA()` con las 4 dificultades (§31).
2. Nombres de equipo ficticios para la IA (§31.3). **Nunca clubes reales.**
3. Pantalla de comparación previa (el mockup de la V0.5 del roadmap).
4. Botón `COMENZAR PARTIDO`.
5. Pantalla de resultado: marcador, estadísticas (§29), MVP (§30).
6. Historial de partidos jugados.

**NO hacer:** relato todavía (Etapa 4), mentalidades (Etapa 5).

**CÓMO TESTEAR:**
- Se puede jugar contra las 4 dificultades.
- En FÁCIL ganás la mayoría; en ÉLITE perdés la mayoría.
- La IA nunca usa nombres de clubes reales.
- Jugar 20 partidos seguidos sin que rompa nada.

---

## ETAPA 4 — Relato del partido 🎯 **HITO: JUEGO JUGABLE**

**Objetivo:** que el partido se sienta como un partido, no como una operación matemática.

**Tareas:**

1. Sistema de plantillas de relato (§28).
2. **Mínimo 6 plantillas por tipo de evento.** Con menos, se vuelve repetitivo en el tercer partido.
3. Las plantillas usan los nombres reales del XI.
4. Relato con minutos, mostrado progresivamente (no todo de golpe).
5. Poder saltear el relato e ir directo al resultado.

**CÓMO TESTEAR:**
- Jugar 10 partidos y verificar que el relato no se siente repetido.
- Los nombres del relato coinciden con los del XI.
- Los goles del relato coinciden con el marcador.

> 🎯 **PARÁ ACÁ Y JUGÁ.**
>
> En este punto tenés el ciclo completo: abrir paquete → colección → armar XI → competir → resultado → relato.
>
> **Jugalo una semana. Pasáselo a dos amigos.** Las preguntas a responder son:
> - ¿Dan ganas de jugar otro partido?
> - ¿Dan ganas de abrir otro paquete?
> - ¿Se siente injusto cuando perdés?
>
> Si la respuesta a las primeras dos es "no", **el problema no se arregla agregando torneos.** Avisame y revisamos el diseño antes de seguir.

---

## ETAPA 5 — Formaciones y mentalidades

**Objetivo:** que las decisiones tácticas cambien resultados de verdad.

**Tareas:**

1. `FORMACIONES` como objeto de datos (§17) con las 6 formaciones.
2. `validarXI()` genérico según formación (§17.1).
3. Selector de formación en el constructor de equipo.
4. Mentalidad ofensiva y defensiva (§19.1, §19.2).
5. Matriz de contras (§19.3) y compatibilidad estructural (§19.4).
6. `calcularFuerzaEfectiva()` completa (§20.5).
7. **La mentalidad rival NO se muestra antes del partido** (§19.5).
8. Análisis táctico post-partido revelando la mentalidad rival.
9. **Re-correr `simular-balance.js`** con el sistema completo y verificar que ninguna mentalidad supere el 40% de uso óptimo.

**CÓMO TESTEAR:**
- Se pueden armar equipos con las 6 formaciones.
- Cambiar de formación revalida el XI correctamente.
- Un equipo 10 puntos inferior con la mentalidad correcta puede ganar.
- Ninguna mentalidad gana siempre.
- El análisis post-partido explica qué pasó.

---

## ETAPA 6 — Economía completa

**Objetivo:** que la progresión funcione.

**Tareas:**

1. Los 5 paquetes de bienvenida, el primero con composición garantizada (§13.1).
2. Pity de arquero y pity de rareza (§13.2, §13.3).
3. Probabilidades de paquete de §14.
4. Sistema de Fichas (§15.4).
5. Tienda de paquetes (§15.5).
6. Venta de repetidos.
7. Contador de puntos y Pack PREMIUM (§15.3). **Los partidos vs IA no suman puntos.**
8. Tope de 3 amistosos con puntos por día (§15.3.2) — dejarlo implementado aunque los amistosos lleguen en la Etapa 10.

**CÓMO TESTEAR:**
- Usuario nuevo puede armar un XI válido con los 5 paquetes de bienvenida.
- Con 0 arqueros, el próximo paquete trae uno.
- Ganar partidos vs IA da Fichas pero **no** suma puntos al contador.
- Se pueden comprar paquetes con Fichas.

---

## ETAPA 7 — Firebase: autenticación y migración

> ⚠️ **Decisión previa tuya:** activar el plan Blaze (§50.1). Hace falta desde la Etapa 8.

**Objetivo:** que los datos vivan en la nube y el juego funcione en cualquier dispositivo.

**Tareas:**

1. Firebase Authentication (email/password + Google).
2. Estructura de Firestore según §51.
3. Migración de `localStorage` a Firestore, sin pérdida de datos.
4. Reglas de seguridad: el catálogo es de solo lectura, cada usuario solo accede a lo suyo.
5. **No guardar stats calculadas** en el documento del equipo (§51.1).
6. Subcolección `transacciones/` (§48.3).

**CÓMO TESTEAR:**
- Crear cuenta, cerrar sesión, volver a entrar: los datos están.
- Entrar desde otro navegador con la misma cuenta: los datos están.
- Intentar leer los datos de otro usuario desde la consola: falla.

---

## ETAPA 8 — Cloud Functions

**Objetivo:** que el cliente no pueda decidir nada que otorgue valor.

**Tareas:**

1. Setup de Cloud Functions.
2. `abrirPaquete()` — el servidor decide qué te tocó.
3. `otorgarFichas()` — el cliente nunca se acredita moneda.
4. `registrarResultadoPartido()` con verificación por semilla (§53.1).
5. Reglas de Firestore que **prohíban** al cliente escribir colección, fichas y puntos.

**CÓMO TESTEAR:**
- Modificar `fichas` desde la consola del navegador: la escritura se rechaza.
- Intentar agregarse un jugador a mano: se rechaza.
- Abrir un paquete: funciona normal.

---

## ETAPA 9 — Torneos: creación y armado

> La etapa más compleja del proyecto. Va dividida en dos.

**Objetivo:** crear un torneo, invitar amigos y armar equipos con exclusividad.

**Tareas:**

1. Crear torneo con código de invitación (mín. 4 participantes).
2. Unirse por código.
3. Validación de pool mínimo (§37) al crear.
4. Pool de Reserva (§37.1): jugadores COMÚN que nadie posee, máx. 3, en préstamo.
5. **Cloud Function `reclamarJugador()` con transacción** (§38). Crítica: dos usuarios pueden reclamar al mismo jugador en el mismo instante.
6. Ventana de armado de 24hs con vista en vivo de quién reclamó qué.
7. Al cerrar la ventana: formación y XI congelados, mentalidad editable (§17.3).

**CÓMO TESTEAR:**
- Crear un torneo con 4 cuentas de prueba.
- Dos cuentas reclaman al mismo jugador: una gana, la otra recibe error claro.
- Intentar reclamar un jugador que no poseés: falla.
- Crear un torneo con pool insuficiente: avisa y ofrece las salidas de §37.

---

## ETAPA 10 — Torneos: competencia

**Objetivo:** jugar el torneo.

**Tareas:**

1. Generación de fixture (liga de todos contra todos).
2. Avance de fecha manual por el creador (§41.1).
3. Forzado por inactividad a los 5 días (§41.2).
4. Simulación de fechas en Cloud Function.
5. **Sobre gratis antes de cada partido de torneo** (§15.2), con el aviso de UI de que no sirve para el torneo en curso.
6. Tabla de posiciones (§42).
7. Recompensas al finalizar (§43).
8. Amistosos entre usuarios (§32).

**CÓMO TESTEAR:**
- Torneo completo de 4 participantes de punta a punta.
- La tabla ordena bien y desempata bien.
- El sobre pre-partido se entrega una sola vez por partido.
- Un participante abandona: sus partidos se dan 0-3 (§39).

---

## PROMPT DE CIERRE DE ETAPA

> Pegar al final de cada sesión, antes de cerrarla.

```text
Terminamos la etapa. Antes de cerrar, generame un archivo ESTADO.md con:

1. Qué se implementó en esta etapa.
2. Qué archivos se crearon o modificaron, y qué hace cada uno.
3. Decisiones técnicas que tomaste y que convenga recordar.
4. Qué quedó pendiente o a medias, si algo quedó.
5. Advertencias para la próxima etapa (cosas que pueden romperse).

Escribilo para que otra sesión sin contexto pueda retomar leyendo solo ese archivo.
```

Ese `ESTADO.md` se le pasa a la sesión siguiente junto con los otros dos archivos. Es la forma de que Claude Code no se pierda entre etapas.

---

## SI ALGO SALE MAL

| Situación | Qué hacer |
|---|---|
| Claude Code implementa cosas de otra etapa | Cortarlo y recordarle la restricción del prompt de arranque |
| Inventa un valor de balance | Frenarlo y señalarle la sección del documento maestro que lo define |
| Propone agregar una librería o framework | No. El stack es vanilla y no se negocia |
| Una etapa se hace muy larga | Dividirla en dos sesiones, pero **terminar la mitad completa y testeada** antes de cortar |
| El testeo de una etapa no pasa | Corregir en esa misma sesión. Nunca arrastrar un test roto a la etapa siguiente |
| Se te acaba el contexto a mitad de etapa | Pedir el `ESTADO.md` y arrancar sesión nueva con los 3 archivos |

---

## RESUMEN VISUAL

```text
E0  Auditoría y alineación          ← obligatoria, sin features
E1  Datos reales y rareza           ← necesitás bajar el CSV vos
E2  Motor de partido (headless)     ← la etapa más importante
E3  Rival IA y pantalla de partido
E4  Relato                          ← 🎯 JUGABLE. PARÁ Y TESTEÁ CON AMIGOS
E5  Formaciones y mentalidades      ← acá el juego se vuelve estratégico
E6  Economía completa
E7  Firebase auth                   ← decidir plan Blaze
E8  Cloud Functions
E9  Torneos: armado y exclusividad
E10 Torneos: competencia            ← 🎯 PRIMER TORNEO REAL DEL GRUPO
```
