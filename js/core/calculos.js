// ==========================================
// CÁLCULO DE STATS DE EQUIPO (§20)
// ==========================================
//
// Fórmulas cerradas del documento maestro. Regla de oro (§20.0): los pesos de
// cada fórmula suman exactamente 1.0. Todas las fórmulas devuelven un valor en
// escala 0–100. Se promedian los SCORES ponderados, nunca los Overall.

import {
    getTeamPlayersByPosition,
    getPlayersInTeam,
    getTeamPlayerCount,
    getPlayersBySlotPrefix,
    estado
} from "./estado.js";

import { FORMACIONES, FORMACION_DEFAULT } from "../config/formaciones.js";


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


// ==========================================
// WRAPPERS QUE LEEN EL ESTADO DEL XI
// ==========================================
//
// Devuelven null si el área todavía no está completa (§17.2: se muestra "—").

export function statsAtaque() {
    const delanteros = getTeamPlayersByPosition("DEL");
    return delanteros.length === 3 ? calcularAtaque(delanteros) : null;
}

export function statsMediocampo() {
    const medios = getTeamPlayersByPosition("MED");
    return medios.length === 3 ? calcularMediocampo(medios) : null;
}

export function statsDefensa() {
    const defensores = getTeamPlayersByPosition("DEF");
    const arqueros   = getTeamPlayersByPosition("POR");

    if (defensores.length !== 4 || arqueros.length !== 1) {
        return null;
    }

    return calcularDefensa(defensores, arqueros[0]);
}

// Valoración del XI: null si falta cualquiera de las tres áreas.
export function statsValoracion() {
    const ataque   = statsAtaque();
    const medio    = statsMediocampo();
    const defensa  = statsDefensa();

    if (ataque === null || medio === null || defensa === null) {
        return null;
    }

    return calcularValoracion(ataque, medio, defensa);
}


// ==========================================
// OVR MEDIO DEL PLANTEL (dato de colección, §20.4)
// ==========================================
//
// Promedio de los Overall de los 11. NO es predictivo del resultado; se muestra
// aparte y etiquetado. null hasta que el XI esté completo.

export function ovrMedioPlantel() {
    const jugadores = getPlayersInTeam()
        .map(playerId => {
            const item = estado.collection.find(
                entry => entry.player.id === playerId
            );
            return item ? item.player : null;
        })
        .filter(player => player !== null);

    if (jugadores.length !== 11) {
        return null;
    }

    const suma = jugadores.reduce(
        (acc, j) => acc + Number(j.overall),
        0
    );

    return suma / jugadores.length;
}


// ==========================================
// VALIDAR EQUIPO
// ==========================================

export function validateTeam() {
    const errors = [];

    // Los cuentos requeridos salen de la formación (dato, §17.1). Por ahora
    // solo se lee `slots`; el resto de la estructura de §17 llega en la Etapa 5.
    const slots = FORMACIONES[FORMACION_DEFAULT].slots;
    const totalRequerido = Object.values(slots).reduce((a, b) => a + b, 0);

    const playerCount = getTeamPlayerCount();

    if (playerCount !== totalRequerido) {
        errors.push(`Faltan ${totalRequerido - playerCount} jugadores.`);
    }

    const conteo = {
        POR: getPlayersBySlotPrefix("por"),
        DEF: getPlayersBySlotPrefix("def"),
        MED: getPlayersBySlotPrefix("med"),
        DEL: getPlayersBySlotPrefix("del")
    };

    const nombrePosicion = {
        POR: "arquero",
        DEF: "defensores",
        MED: "mediocampistas",
        DEL: "delanteros"
    };

    for (const pos of ["POR", "DEF", "MED", "DEL"]) {
        if (conteo[pos] !== slots[pos]) {
            errors.push(
                `Debe haber ${slots[pos]} ${nombrePosicion[pos]}.`
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
