// ==========================================
// STATS DE EQUIPO QUE LEEN EL ESTADO (§20)
// ==========================================
//
// Las fórmulas puras de §20 viven en core/formulas.js (para que las use también
// el motor de partido). Este módulo agrega los WRAPPERS que leen el estado del
// XI y devuelven "—" cuando el equipo está incompleto.

import {
    getTeamPlayersByPosition,
    getPlayersInTeam,
    getTeamPlayerCount,
    getPlayersBySlotPrefix,
    estado
} from "./estado.js";

import { FORMACIONES } from "../config/formaciones.js";

import {
    calcularAtaque,
    calcularMediocampo,
    calcularDefensa,
    calcularValoracion
} from "./formulas.js";

// Se re-exportan por conveniencia para quien ya importaba desde calculos.js.
export {
    PESOS,
    scoreAtaque,
    scoreMedio,
    scoreDefensor,
    scoreArquero,
    calcularAtaque,
    calcularMediocampo,
    calcularDefensa,
    calcularValoracion
} from "./formulas.js";


// ==========================================
// WRAPPERS QUE LEEN EL ESTADO DEL XI
// ==========================================
//
// Devuelven null si el área todavía no está completa (§17.2: se muestra "—").

// Los cupos por área salen de la formación ACTIVA (§17.1), no de un 4-3-3 fijo.
function slotsActivos() {
    return FORMACIONES[estado.formacion].slots;
}

export function statsAtaque() {
    const delanteros = getTeamPlayersByPosition("DEL");
    const req = slotsActivos().DEL;
    return delanteros.length === req ? calcularAtaque(delanteros) : null;
}

export function statsMediocampo() {
    const medios = getTeamPlayersByPosition("MED");
    const req = slotsActivos().MED;
    return medios.length === req ? calcularMediocampo(medios) : null;
}

export function statsDefensa() {
    const defensores = getTeamPlayersByPosition("DEF");
    const arqueros   = getTeamPlayersByPosition("POR");
    const req = slotsActivos();

    if (defensores.length !== req.DEF || arqueros.length !== req.POR) {
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

    // Los cupos requeridos salen de la formación ACTIVA (dato, §17.1).
    const slots = FORMACIONES[estado.formacion].slots;
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
