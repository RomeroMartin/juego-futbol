// ==========================================
// FÓRMULAS PURAS DE STATS (§20)
// ==========================================
//
// Fórmulas cerradas del documento maestro. PURAS: reciben jugadores/arrays y
// devuelven números, sin leer el estado del juego ni el DOM. Por eso son
// importables tanto por la UI (core/calculos.js) como por el MOTOR de partido
// (core/motor.js) y por los scripts de simulación en Node.
//
// Regla de oro (§20.0): los pesos de cada fórmula suman exactamente 1.0. Todas
// las fórmulas devuelven un valor en escala 0–100. Se promedian los SCORES
// ponderados, nunca los Overall.


// ==========================================
// PESOS (§20.0) — deben sumar 1.0
// ==========================================

export const PESOS = {
    ataque:     { shooting: 0.40, pace: 0.25, dribbling: 0.25, physical: 0.10 },
    medio:      { passing: 0.40, dribbling: 0.25, defending: 0.20, pace: 0.15 },
    defensor:   { defending: 0.50, physical: 0.20, pace: 0.15, passing: 0.15 },
    arquero:    { overall: 0.50, defending: 0.30, physical: 0.20 },
    valoracion: { ataque: 0.33, mediocampo: 0.34, defensa: 0.33 }
};

// Ponderación explícita línea defensiva / arquero dentro de la Defensa (§20.3).
const PESO_LINEA_DEFENSIVA = 0.75;
const PESO_ARQUERO_EN_DEFENSA = 0.25;

// Validación de pesos al cargar el módulo (§20.0).
Object.entries(PESOS).forEach(([nombre, pesos]) => {
    const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
    console.assert(
        Math.abs(suma - 1.0) < 0.001,
        `Los pesos de ${nombre} no suman 1.0`
    );
});

console.assert(
    Math.abs((PESO_LINEA_DEFENSIVA + PESO_ARQUERO_EN_DEFENSA) - 1.0) < 0.001,
    "La ponderación línea/arquero de la Defensa no suma 1.0"
);


// ==========================================
// SCORES INDIVIDUALES
// ==========================================

// §20.1
export function scoreAtaque(jugador) {
    return jugador.shooting  * PESOS.ataque.shooting
         + jugador.pace      * PESOS.ataque.pace
         + jugador.dribbling * PESOS.ataque.dribbling
         + jugador.physical  * PESOS.ataque.physical;
}

// §20.2
export function scoreMedio(jugador) {
    return jugador.passing   * PESOS.medio.passing
         + jugador.dribbling * PESOS.medio.dribbling
         + jugador.defending * PESOS.medio.defending
         + jugador.pace      * PESOS.medio.pace;
}

// §20.3
export function scoreDefensor(jugador) {
    return jugador.defending * PESOS.defensor.defending
         + jugador.physical  * PESOS.defensor.physical
         + jugador.pace      * PESOS.defensor.pace
         + jugador.passing   * PESOS.defensor.passing;
}

// §20.3 — fórmula provisional del arquero (Deuda Técnica C1).
export function scoreArquero(arquero) {
    return arquero.overall   * PESOS.arquero.overall
         + arquero.defending * PESOS.arquero.defending
         + arquero.physical  * PESOS.arquero.physical;
}


// ==========================================
// STATS DE ÁREA (§20.1 – 20.3)
// ==========================================
//
// Reciben arrays de jugadores y promedian los SCORES.

export function calcularAtaque(delanteros) {
    const suma = delanteros.reduce((acc, j) => acc + scoreAtaque(j), 0);
    return suma / delanteros.length;
}

export function calcularMediocampo(medios) {
    const suma = medios.reduce((acc, j) => acc + scoreMedio(j), 0);
    return suma / medios.length;
}

// Ponderación explícita: la línea pesa 75%, el arquero 25%.
export function calcularDefensa(defensores, arquero) {
    const lineaDefensiva =
        defensores.reduce((acc, j) => acc + scoreDefensor(j), 0) /
        defensores.length;

    return lineaDefensiva * PESO_LINEA_DEFENSIVA
         + scoreArquero(arquero) * PESO_ARQUERO_EN_DEFENSA;
}


// ==========================================
// POSICIÓN FUERA DE LUGAR (§18 ampliado, D1, post-Etapa 10)
// ==========================================
//
// Penaliza jugar a un jugador en una sub-posición que no es la suya dentro de
// su línea (ej. un lateral derecho de lateral izquierdo, o un volante central
// abierto por una banda). Usa `detailedPosition` (ya en el dataset desde la
// Etapa 2, EA FC). El slot ESPERADO viaja en `jugador._categoriaSlot`,
// adosado al armar el equipo para el motor (ver config/formaciones.js →
// slotsDeFormacion/conCategorias, y rivalIA.js para el rival); si no está
// presente (arquero, o un jugador armado sin esa info) no hay penalización.
const CATEGORIA_POR_DETALLE = {
    CB: "CENTRAL", LB: "IZQUIERDA", RB: "DERECHA",
    CDM: "CENTRAL", CM: "CENTRAL", CAM: "CENTRAL", LM: "IZQUIERDA", RM: "DERECHA",
    ST: "CENTRAL", LW: "IZQUIERDA", RW: "DERECHA"
};

export function categoriaJugador(jugador) {
    return CATEGORIA_POR_DETALLE[jugador.detailedPosition] || null;
}

// -15% si el TIPO no coincide (central en un slot lateral/banda o viceversa,
// y viceversa), -8% si el tipo coincide pero el LADO no (ej. lateral derecho
// de izquierdo), 0% si coincide exacto. Confirmado con el usuario.
const PENALIZACION_TIPO = 0.85;
const PENALIZACION_LADO = 0.92;

export function factorPosicion(jugador) {
    const esperada = jugador._categoriaSlot;
    if (!esperada) return 1;
    const real = categoriaJugador(jugador);
    if (!real || real === esperada) return 1;
    const esCentral = (c) => c === "CENTRAL";
    if (esCentral(real) !== esCentral(esperada)) return PENALIZACION_TIPO;
    return PENALIZACION_LADO;
}

function promedioPonderadoPorPosicion(jugadores, scoreFn) {
    const suma = jugadores.reduce((acc, j) => acc + scoreFn(j) * factorPosicion(j), 0);
    return suma / jugadores.length;
}

// Variantes de las stats de área CON la penalización de fuera de posición
// (D1): las usa fuerzaEfectiva (lo que decide el partido — la ubicación en
// la cancha es una decisión táctica). calcularAtaque/Mediocampo/Defensa de
// arriba NO se tocan y siguen sin penalizar: las usa fuerzaEquipo, la
// calidad de plantel "cruda" que se muestra antes de jugar y calibra al
// rival IA (§20.0) — tiene que quedar independiente de dónde se ubique a
// cada jugador, igual que ya es independiente de la formación y la mentalidad.
export function calcularAtaqueTactico(delanteros) {
    return promedioPonderadoPorPosicion(delanteros, scoreAtaque);
}

export function calcularMediocampoTactico(medios) {
    return promedioPonderadoPorPosicion(medios, scoreMedio);
}

export function calcularDefensaTactico(defensores, arquero) {
    const lineaDefensiva = promedioPonderadoPorPosicion(defensores, scoreDefensor);
    return lineaDefensiva * PESO_LINEA_DEFENSIVA
         + scoreArquero(arquero) * PESO_ARQUERO_EN_DEFENSA;
}


// ==========================================
// VALORACIÓN (§20.4)
// ==========================================
//
// Se DERIVA de las tres áreas, para ser coherente con lo que decide el partido.
// NO es el promedio de los Overall.

export function calcularValoracion(ataque, mediocampo, defensa) {
    return ataque     * PESOS.valoracion.ataque
         + mediocampo * PESOS.valoracion.mediocampo
         + defensa    * PESOS.valoracion.defensa;
}
