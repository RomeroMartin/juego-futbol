// ==========================================
// CÁLCULOS DE STATS DE EQUIPO
// ==========================================
//
// ⚠️ PASO 1 DE LA ETAPA 0: este archivo conserva TODAVÍA las fórmulas viejas
// de la V0.3, movidas sin cambios. Las fórmulas correctas de §20 (pesos,
// valoración derivada, ponderación explícita del arquero) se aplican en un
// paso posterior de esta misma etapa. No es un descuido: es para separar el
// riesgo del refactor a módulos del riesgo de cambiar la matemática.

import {
    getTeamPlayersByPosition,
    getPlayersInTeam,
    getTeamPlayerCount,
    getPlayersBySlotPrefix,
    estado
} from "./estado.js";


// ==========================================
// PROMEDIO
// ==========================================

export function calculateAverage(playersList) {
    if (playersList.length === 0) {
        return null;
    }

    const total = playersList.reduce(
        (sum, player) => sum + Number(player.overall),
        0
    );

    return total / playersList.length;
}


// ==========================================
// ATAQUE (fórmula vieja V0.3)
// ==========================================

export function calculateAttack() {
    const attackers = getTeamPlayersByPosition("DEL");

    if (attackers.length !== 3) {
        return null;
    }

    const values = attackers.map(
        player =>
            Number(player.pace)      * 0.35 +
            Number(player.shooting)  * 0.35 +
            Number(player.dribbling) * 0.20 +
            Number(player.physical)  * 0.10
    );

    return calculateAverage(
        values.map(value => ({ overall: value }))
    );
}


// ==========================================
// MEDIOCAMPO (fórmula vieja V0.3)
// ==========================================

export function calculateMidfield() {
    const midfielders = getTeamPlayersByPosition("MED");

    if (midfielders.length !== 3) {
        return null;
    }

    const values = midfielders.map(
        player =>
            Number(player.passing)   * 0.40 +
            Number(player.dribbling) * 0.30 +
            Number(player.pace)      * 0.15 +
            Number(player.defending) * 0.15
    );

    return calculateAverage(
        values.map(value => ({ overall: value }))
    );
}


// ==========================================
// DEFENSA (fórmula vieja V0.3)
// ==========================================

export function calculateDefense() {
    const defenders  = getTeamPlayersByPosition("DEF");
    const goalkeeper = getTeamPlayersByPosition("POR");

    if (defenders.length !== 4 || goalkeeper.length !== 1) {
        return null;
    }

    const defenderValues = defenders.map(
        player =>
            Number(player.defending) * 0.50 +
            Number(player.physical)  * 0.20 +
            Number(player.pace)      * 0.15 +
            Number(player.passing)   * 0.15
    );

    const goalkeeperValue =
        Number(goalkeeper[0].overall)    * 0.50 +
        Number(goalkeeper[0].defending)  * 0.30 +
        Number(goalkeeper[0].physical)   * 0.20;

    const allValues = [...defenderValues, goalkeeperValue];

    return calculateAverage(
        allValues.map(value => ({ overall: value }))
    );
}


// ==========================================
// VALORACIÓN GENERAL (vieja: promedio de OVR)
// ==========================================

export function calculateTeamRating() {
    const allPlayers = getPlayersInTeam()
        .map(playerId => {
            const item = estado.collection.find(
                entry => entry.player.id === playerId
            );

            return item ? item.player : null;
        })
        .filter(player => player !== null);

    if (allPlayers.length !== 11) {
        return null;
    }

    return calculateAverage(allPlayers);
}


// ==========================================
// VALIDAR EQUIPO
// ==========================================

export function validateTeam() {
    const errors = [];

    const playerCount = getTeamPlayerCount();

    if (playerCount !== 11) {
        errors.push(`Faltan ${11 - playerCount} jugadores.`);
    }

    const goalkeeperCount = getPlayersBySlotPrefix("por");
    const defenderCount   = getPlayersBySlotPrefix("def");
    const midfieldCount   = getPlayersBySlotPrefix("med");
    const attackerCount   = getPlayersBySlotPrefix("del");

    if (goalkeeperCount !== 1) {
        errors.push("Debe haber 1 arquero.");
    }

    if (defenderCount !== 4) {
        errors.push("Debe haber 4 defensores.");
    }

    if (midfieldCount !== 3) {
        errors.push("Debe haber 3 mediocampistas.");
    }

    if (attackerCount !== 3) {
        errors.push("Debe haber 3 delanteros.");
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
