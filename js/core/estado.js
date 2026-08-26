// ==========================================
// ESTADO EN MEMORIA
// ==========================================
//
// Estado mutable de la partida. Los módulos de UI leen y escriben `estado.*`
// y persisten con guardarPartida() de storage.js.

import {
    sincronizarDataset,
    cargarColeccion,
    cargarPaquetes,
    cargarEquipo
} from "./storage.js";


// Se corre ANTES de cargar la partida: si el plantel cambió, resetea la
// colección guardada (§10, Etapa 1). `datasetReseteado` indica si hay que
// avisarle al usuario.
export const datasetReseteado = sincronizarDataset();


// El equipo persistido trae formación + mapa de slots + mentalidades (§17, §19).
const equipoGuardado = cargarEquipo();

export const estado = {
    packs:               cargarPaquetes(),
    collection:          cargarColeccion(),
    formacion:           equipoGuardado.formacion,
    team:                equipoGuardado.team,
    mentalidadOfensiva:  equipoGuardado.mentalidadOfensiva,
    mentalidadDefensiva: equipoGuardado.mentalidadDefensiva,
    currentPack:         [],
    currentFilter:       "all",
    teamPlayerFilter:    "all"
};


// ==========================================
// TOTAL DE FIGURITAS
// ==========================================

export function getTotalCards() {
    return estado.collection.reduce(
        (total, item) => total + item.quantity,
        0
    );
}


// ==========================================
// JUGADORES DEL EQUIPO (ids no nulos)
// ==========================================

export function getPlayersInTeam() {
    return Object.values(estado.team)
        .filter(playerId => playerId !== null);
}


// ==========================================
// CANTIDAD DE JUGADORES EN EL XI
// ==========================================

export function getTeamPlayerCount() {
    return getPlayersInTeam().length;
}


// ==========================================
// CONTAR SLOTS OCUPADOS POR PREFIJO
// ==========================================

export function getPlayersBySlotPrefix(prefix) {
    return Object.entries(estado.team)
        .filter(
            ([slot, playerId]) =>
                slot.startsWith(prefix) &&
                playerId !== null
        )
        .length;
}


// ==========================================
// JUGADORES DEL XI POR POSICIÓN
// ==========================================

export function getTeamPlayersByPosition(position) {
    return Object.entries(estado.team)
        .map(([slot, playerId]) => {
            if (!playerId) {
                return null;
            }

            const item = estado.collection.find(
                entry => entry.player.id === playerId
            );

            if (!item) {
                return null;
            }

            if (item.player.position !== position) {
                return null;
            }

            return item.player;
        })
        .filter(player => player !== null);
}


// ==========================================
// JUGADOR YA EN EL XI
// ==========================================

export function isPlayerInTeam(playerId) {
    return getPlayersInTeam().includes(playerId);
}
