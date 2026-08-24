# Fútbol Figuritas

Juego web de colección y competencia de fútbol argentino. Se juega entre grupos
cerrados de amigos (5–20 personas).

## Documentación del proyecto

Estos archivos NO están cargados en contexto. Leelos con la herramienta de lectura
cuando los necesites:

- `docs/Futbol_Figuritas_Proyecto_v3.md` — Documento maestro. Todas las
  especificaciones, fórmulas y decisiones de diseño ya cerradas. **Es la fuente
  de verdad.**
- `docs/Futbol_Figuritas_Plan_de_Etapas.md` — Plan de trabajo dividido en 10
  etapas. Leé solo la etapa en curso.
- `ESTADO.md` — Qué se hizo en la etapa anterior. Leelo siempre al arrancar.

## Stack (no negociable)

- HTML, CSS y JavaScript vanilla.
- Sin frameworks, sin build tools, sin npm, sin TypeScript.
- Única dependencia permitida: SDK de Firebase, y recién a partir de la Etapa 7.
- Todo tiene que correr abriendo `index.html` en el navegador.

Si algo parece necesitar una librería, proponelo y esperá respuesta. No la agregues.

## Reglas de trabajo

1. **Una etapa por sesión.** No implementes nada de otras etapas, aunque parezca
   obvio o "ya que estamos".
2. **El documento maestro manda.** Si define una fórmula, un valor o una regla,
   usala tal cual. No la "mejores" ni la reemplaces por tu criterio.
3. **Si algo no está definido, preguntá.** Nunca inventes valores de balance,
   probabilidades ni reglas de juego.
4. **Mostrá el plan antes de codear** y esperá confirmación.
5. **Código y comentarios en español.**
6. Al terminar: qué archivos tocaste, qué quedó pendiente, cómo testearlo.

## Reglas técnicas duras

- **Nunca `Math.random()` en el motor de partido.** Se usa el PRNG con semilla
  (`mulberry32`) para que los partidos sean reproducibles y verificables.
- **Nunca guardar stats calculadas** (ataque, mediocampo, defensa, valoración)
  en los documentos de equipo. Se recalculan siempre. Excepción: partidos ya
  jugados, que congelan una copia histórica.
- **Todo objeto persistido lleva `schemaVersion`** y pasa por `migrar()` al leerse.
- **El nombre del jugador nunca se usa como ID.** Siempre `id`.
- **Los pesos de toda fórmula suman exactamente 1.0.** Validado con `console.assert`.
- **El cliente puede leer y pedir, nunca decidir.** Todo lo que otorgue valor
  (paquetes, fichas, resultados, reclamos de torneo) va en Cloud Functions.
- Valores de economía y balance: solo en `js/config/`. Nunca hardcodeados sueltos.

## Contexto de negocio

- No se monetiza. El juego debe ser 100% jugable y competitivo gratis.
- Los datos de jugadores son de uso privado entre amigos. No exponer públicamente
  ni agregar features que impliquen distribución abierta.
- El dataset es intercambiable a propósito: la rareza se calcula por percentiles,
  nunca por valores absolutos de Overall.

## Principio de diseño rector

Tener el equipo con mejor valoración media NO debe garantizar la victoria.
La formación, la mentalidad y el azar controlado tienen que pesar en el resultado.
Ningún equipo debe superar el 87% de probabilidad de ganar, nunca.
