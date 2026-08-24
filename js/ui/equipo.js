// ==========================================
// CONSTRUCTOR DE EQUIPO (XI)
// ==========================================

import {
    estado,
    isPlayerInTeam
} from "../core/estado.js";

import { guardarPartida } from "../core/storage.js";

import {
    statsAtaque,
    statsMediocampo,
    statsDefensa,
    statsValoracion,
    ovrMedioPlantel,
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
const teamOvrMedioElement      = document.getElementById("teamOvrMedio");


// ==========================================
// CANTIDAD POSEÍDA (§16.2)
// ==========================================
//
// Las copias NUNCA se bloquean: un jugador que poseés puede estar en todos tus
// equipos a la vez. `quantity` es solo un contador (intercambio, venta,
// estadística). Devolvemos la cantidad poseída tal cual, sin restar las copias
// usadas en el XI. La única restricción sigue siendo §16.3 (no repetir la misma
// identidad dentro del mismo XI), que resuelve isPlayerInTeam().

export function getOwnedQuantity(playerId) {
    const item = estado.collection.find(
        item => item.player.id === playerId
    );

    return item ? item.quantity : 0;
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

    if (getOwnedQuantity(playerId) <= 0) {
        alert("No poseés ese jugador.");
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

        const poseidas = getOwnedQuantity(player.id);

        const alreadyInTeam = isPlayerInTeam(player.id);

        const element = document.createElement("div");

        element.className = "available-player";

        // Solo se deshabilita si ya está en el XI (§16.3). Las copias no se
        // bloquean (§16.2), así que la cantidad poseída nunca deshabilita.
        if (alreadyInTeam) {
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
                x${poseidas}
            </div>

        `;

        if (!alreadyInTeam) {
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
    const ataque     = statsAtaque();
    const mediocampo = statsMediocampo();
    const defensa    = statsDefensa();
    const valoracion = statsValoracion();
    const ovrMedio   = ovrMedioPlantel();

    teamAttackElement.textContent =
        ataque === null ? "—" : ataque.toFixed(1);

    teamMidfieldElement.textContent =
        mediocampo === null ? "—" : mediocampo.toFixed(1);

    teamDefenseElement.textContent =
        defensa === null ? "—" : defensa.toFixed(1);

    // Valoración DERIVADA de las tres áreas (§20.4), no promedio de OVR.
    teamRatingElement.textContent =
        valoracion === null ? "—" : valoracion.toFixed(1);

    // OVR medio del plantel: dato de colección, no predictivo (§20.4).
    if (teamOvrMedioElement) {
        teamOvrMedioElement.textContent =
            ovrMedio === null ? "—" : ovrMedio.toFixed(1);
    }

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
