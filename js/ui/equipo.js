// ==========================================
// CONSTRUCTOR DE EQUIPO (XI)
// ==========================================

import {
    estado,
    getPlayersInTeam,
    getTeamPlayersByPosition,
    isPlayerInTeam
} from "../core/estado.js";

import { guardarPartida } from "../core/storage.js";

import {
    calculateAttack,
    calculateMidfield,
    calculateDefense,
    calculateTeamRating,
    validateTeam
} from "../core/calculos.js";

import { getPositionName, getPositionIcon } from "./componentes.js";
import { updateHeader } from "./navegacion.js";


const availablePlayersElement = document.getElementById("availablePlayers");
const teamRatingElement       = document.getElementById("teamRating");
const teamAttackElement        = document.getElementById("teamAttack");
const teamMidfieldElement      = document.getElementById("teamMidfield");
const teamDefenseElement       = document.getElementById("teamDefense");
const teamStatusElement        = document.getElementById("teamStatus");


// ==========================================
// CANTIDAD DISPONIBLE
// ==========================================
//
// ⚠️ PASO 1: conserva TODAVÍA la lógica "Utilizado / Disponible" de la V0.3
// (resta las copias usadas en el XI). Se elimina en un paso posterior de esta
// etapa según §16.2: las copias nunca se bloquean.

export function getAvailableQuantity(playerId) {
    const item = estado.collection.find(
        item => item.player.id === playerId
    );

    if (!item) {
        return 0;
    }

    const used = getPlayersInTeam()
        .filter(id => id === playerId)
        .length;

    return item.quantity - used;
}


// ==========================================
// AGREGAR JUGADOR AL XI
// ==========================================

export function addPlayerToTeam(playerId, position) {
    const playerItem = estado.collection.find(
        item => item.player.id === playerId
    );

    if (!playerItem) {
        return;
    }

    // REGLA: un mismo jugador no puede ocupar dos lugares del XI (§16.3).
    if (isPlayerInTeam(playerId)) {
        alert("Ese jugador ya está en tu XI.");
        return;
    }

    if (getAvailableQuantity(playerId) <= 0) {
        alert("No tenés una copia disponible.");
        return;
    }

    // REGLA: el jugador solo puede ocupar su posición natural.
    const slot = Object.keys(estado.team).find(slotName => {
        const element = document.querySelector(
            `[data-slot="${slotName}"]`
        );

        return (
            estado.team[slotName] === null &&
            element.dataset.position === position
        );
    });

    if (!slot) {
        alert(
            `No hay posiciones disponibles de ${getPositionName(position)}.`
        );
        return;
    }

    estado.team[slot] = playerId;

    guardarPartida(estado);
    renderTeam();
}


// ==========================================
// QUITAR JUGADOR DEL XI
// ==========================================

export function removePlayerFromTeam(slot) {
    estado.team[slot] = null;

    guardarPartida(estado);
    renderTeam();
}


// ==========================================
// RENDER EQUIPO
// ==========================================

export function renderTeam() {
    document.querySelectorAll(".position-slot").forEach(slot => {
        slot.innerHTML = "";
        slot.classList.add("empty");
    });

    Object.entries(estado.team).forEach(([slotName, playerId]) => {
        if (!playerId) {
            return;
        }

        const slot = document.querySelector(
            `[data-slot="${slotName}"]`
        );

        const playerItem = estado.collection.find(
            item => item.player.id === playerId
        );

        if (!slot || !playerItem) {
            return;
        }

        const player = playerItem.player;

        slot.classList.remove("empty");

        slot.innerHTML = `

            <div
                class="slot-player"
                title="Click para quitar"
            >

                <div class="slot-rating">
                    ${player.overall}
                </div>


                <div class="slot-position">
                    ${getPositionName(player.position)}
                </div>


                <div class="slot-name">
                    ${player.name}
                </div>


                <div class="slot-club">
                    ${player.club}
                </div>


                <div class="remove-hint">
                    QUITAR
                </div>

            </div>

        `;

        slot.querySelector(".slot-player").addEventListener("click", () => {
            removePlayerFromTeam(slotName);
        });
    });

    renderAvailablePlayers();
    updateTeamStats();
    updateHeader();
}


// ==========================================
// RENDER JUGADORES DISPONIBLES
// ==========================================

export function renderAvailablePlayers() {
    availablePlayersElement.innerHTML = "";

    let filteredCollection = [...estado.collection];

    if (estado.teamPlayerFilter !== "all") {
        filteredCollection = filteredCollection.filter(
            item => item.player.position === estado.teamPlayerFilter
        );
    }

    filteredCollection.sort(
        (a, b) => b.player.overall - a.player.overall
    );

    if (filteredCollection.length === 0) {
        availablePlayersElement.innerHTML = `

            <div style="
                text-align:center;
                padding:30px 10px;
                color:#91a49a;
                font-size:12px;
            ">

                No tenés jugadores
                de esta posición.

            </div>

        `;

        return;
    }

    filteredCollection.forEach(item => {
        const player = item.player;

        const available = getAvailableQuantity(player.id);

        const alreadyInTeam = isPlayerInTeam(player.id);

        const element = document.createElement("div");

        element.className = "available-player";

        if (available <= 0 || alreadyInTeam) {
            element.classList.add("disabled");
        }

        element.innerHTML = `

            <div class="available-player-avatar">
                ${getPositionIcon(player.position)}
            </div>


            <div class="available-player-info">

                <div class="available-player-name">
                    ${player.name}
                </div>


                <div class="available-player-meta">
                    ${getPositionName(player.position)}
                    ·
                    ${player.club}
                </div>

            </div>


            <div class="available-player-rating">
                ${player.overall}
            </div>


            <div class="available-player-quantity">
                x${available}
            </div>

        `;

        if (available > 0 && !alreadyInTeam) {
            element.addEventListener("click", () => {
                addPlayerToTeam(player.id, player.position);
            });
        }

        availablePlayersElement.appendChild(element);
    });
}


// ==========================================
// ACTUALIZAR ESTADÍSTICAS
// ==========================================

export function updateTeamStats() {
    const attack   = calculateAttack();
    const midfield = calculateMidfield();
    const defense  = calculateDefense();
    const rating   = calculateTeamRating();

    teamAttackElement.textContent =
        attack === null ? "—" : attack.toFixed(1);

    teamMidfieldElement.textContent =
        midfield === null ? "—" : midfield.toFixed(1);

    teamDefenseElement.textContent =
        defense === null ? "—" : defense.toFixed(1);

    teamRatingElement.textContent =
        rating === null ? "—" : rating.toFixed(1);

    updateTeamStatus();
}


// ==========================================
// ESTADO DEL EQUIPO
// ==========================================

export function updateTeamStatus() {
    const validation = validateTeam();

    if (validation.valid) {
        teamStatusElement.classList.add("complete");

        teamStatusElement.innerHTML = `

            <span class="status-icon">
                ✓
            </span>

            <div>

                <strong>
                    EQUIPO COMPLETO
                </strong>

                <span>
                    Tu XI cumple todas las reglas
                    y está listo para competir.
                </span>

            </div>

        `;

        return;
    }

    teamStatusElement.classList.remove("complete");

    const missing = validation.errors.join(" ");

    teamStatusElement.innerHTML = `

        <span class="status-icon">
            ⚠
        </span>

        <div>

            <strong>
                EQUIPO INCOMPLETO
            </strong>

            <span>
                ${missing}
            </span>

        </div>

    `;
}


// ==========================================
// FILTROS DEL CONSTRUCTOR DE EQUIPO
// ==========================================

export function initFiltrosEquipo() {
    document.querySelectorAll(".team-filter-button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".team-filter-button").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            estado.teamPlayerFilter = button.dataset.teamFilter;

            renderAvailablePlayers();
        });
    });
}
