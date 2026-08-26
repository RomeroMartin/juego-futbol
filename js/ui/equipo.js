// ==========================================
// CONSTRUCTOR DE EQUIPO (XI) — formación + mentalidades (§17, §19)
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

import {
    FORMACIONES,
    CLAVES_FORMACION,
    slotsDeFormacion,
    equipoVacioDeFormacion
} from "../config/formaciones.js";

import {
    MENTALIDADES_OF,
    MENTALIDADES_DEF,
    CLAVES_OFENSIVA,
    CLAVES_DEFENSIVA
} from "../config/mentalidades.js";

import { getPositionName, getPositionIcon } from "./componentes.js";
import { updateHeader } from "./navegacion.js";


const availablePlayersElement = document.getElementById("availablePlayers");
const teamRatingElement        = document.getElementById("teamRating");
const teamAttackElement        = document.getElementById("teamAttack");
const teamMidfieldElement      = document.getElementById("teamMidfield");
const teamDefenseElement       = document.getElementById("teamDefense");
const teamStatusElement        = document.getElementById("teamStatus");
const teamOvrMedioElement      = document.getElementById("teamOvrMedio");
const footballPitch            = document.getElementById("footballPitch");
const formationSelect          = document.getElementById("formationSelect");
const offMentalitySelect       = document.getElementById("offensiveMentalitySelect");
const defMentalitySelect       = document.getElementById("defensiveMentalitySelect");
const offMentalityDesc         = document.getElementById("offensiveMentalityDesc");
const defMentalityDesc         = document.getElementById("defensiveMentalityDesc");


// Descripción corta de cada mentalidad (para el selector). El detalle numérico
// vive en config/mentalidades.js; acá solo el perfil, en criollo.
const DESC_OFENSIVA = {
    EQUIPO_RAPIDO: "Verticalidad: muchas ocasiones, de menor calidad.",
    JUEGO_ABIERTO: "Centros al área: depende del físico y del ancho de cancha.",
    POSESION:      "Juego elaborado: pocas ocasiones, de mucha calidad.",
    EQUILIBRADO:   "Sin bonos ni penalizaciones. La opción segura."
};
const DESC_DEFENSIVA = {
    BLOQUE_COMPACTO: "Aguantar y esperar: concede menos ocasiones.",
    PRESION_ALTA:    "Alto riesgo, alta recompensa: recuperás arriba, quedás expuesto atrás.",
    LINEA_MEDIA:     "Sin bonos ni penalizaciones. La opción segura."
};

// Clase de fila en la cancha por posición (para reusar el CSS existente).
const CLASE_FILA = { DEL: "attackers", MED: "midfielders", DEF: "defenders", POR: "goalkeeper" };


// ==========================================
// CANTIDAD POSEÍDA (§16.2)
// ==========================================
//
// Las copias NUNCA se bloquean: un jugador que poseés puede estar en todos tus
// equipos a la vez. `quantity` es solo un contador (intercambio, venta,
// estadística). La única restricción sigue siendo §16.3 (no repetir la misma
// identidad dentro del mismo XI), que resuelve isPlayerInTeam().

export function getOwnedQuantity(playerId) {
    const item = estado.collection.find(
        item => item.player.id === playerId
    );

    return item ? item.quantity : 0;
}


// Nombre de un jugador desde su id (para avisos).
function nombreDe(playerId) {
    const item = estado.collection.find(e => e.player.id === playerId);
    return item ? item.player.name : playerId;
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

    // REGLA: el jugador solo puede ocupar su posición natural. Se busca el primer
    // slot libre de esa posición en la formación activa.
    const slot = Object.keys(estado.team).find(slotName => {
        const element = document.querySelector(
            `[data-slot="${slotName}"]`
        );

        return (
            estado.team[slotName] === null &&
            element &&
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
// CAMBIO DE FORMACIÓN (§17.1)
// ==========================================
//
// Reasigna los jugadores actuales a los slots de la nueva formación, por
// posición y en orden. Los que sobran (p. ej. un delantero al pasar de 4-3-3 a
// 5-3-2) quedan fuera. Si va a descartar a alguien, PIDE CONFIRMACIÓN antes de
// aplicar el cambio: perder un jugador sin querer es frustrante.

function remapearEquipo(nuevaClave) {
    // Jugadores actuales por posición, en orden de slot.
    const porPos = { POR: [], DEF: [], MED: [], DEL: [] };
    for (const { slot, position } of slotsDeFormacion(estado.formacion)) {
        const pid = estado.team[slot];
        if (pid) porPos[position].push(pid);
    }

    const nuevoTeam = equipoVacioDeFormacion(nuevaClave);
    const idx = { POR: 0, DEF: 0, MED: 0, DEL: 0 };

    for (const { slot, position } of slotsDeFormacion(nuevaClave)) {
        if (idx[position] < porPos[position].length) {
            nuevoTeam[slot] = porPos[position][idx[position]++];
        }
    }

    // Los que no entraron en ningún slot nuevo se descartan.
    const descartados = [];
    for (const pos of ["POR", "DEF", "MED", "DEL"]) {
        for (let k = idx[pos]; k < porPos[pos].length; k++) {
            descartados.push(porPos[pos][k]);
        }
    }

    return { nuevoTeam, descartados };
}

// PUNTO DE ENTRADA §17.3 (Etapa 9): dentro de un torneo, la formación y el XI
// quedan CONGELADOS y solo la mentalidad sigue editable. El modelo ya separa los
// tres campos (estado.formacion / estado.team / estado.mentalidad*), así que el
// bloqueo es una sola guarda acá y en addPlayerToTeam/removePlayerFromTeam:
//   if (estado.formacionBloqueada) return;   // los selectores de mentalidad NO se tocan
// No se implementa en esta etapa (es de la Etapa 9): se deja preparado.
function cambiarFormacion(nuevaClave) {
    if (!FORMACIONES[nuevaClave] || nuevaClave === estado.formacion) {
        return;
    }

    const { nuevoTeam, descartados } = remapearEquipo(nuevaClave);

    if (descartados.length > 0) {
        const nombres = descartados.map(nombreDe).join(", ");
        const ok = confirm(
            `Cambiar a ${nuevaClave} deja fuera del XI a: ${nombres}.\n\n` +
            `¿Confirmás el cambio de formación?`
        );

        if (!ok) {
            // Cancela: se restaura el valor previo en el selector.
            formationSelect.value = estado.formacion;
            return;
        }
    }

    estado.formacion = nuevaClave;
    estado.team = nuevoTeam;

    guardarPartida(estado);
    renderTeam();
}


// ==========================================
// CONSTRUIR LA CANCHA SEGÚN LA FORMACIÓN
// ==========================================
//
// Genera las líneas y los slots (§17.1) de la formación activa, de arriba
// (ataque) hacia abajo (arco).

function construirCancha() {
    footballPitch.innerHTML = "";

    let posActual = null;
    let fila = null;

    for (const { slot, position } of slotsDeFormacion(estado.formacion)) {
        if (position !== posActual) {
            fila = document.createElement("div");
            fila.className = `pitch-row ${CLASE_FILA[position]}`;
            footballPitch.appendChild(fila);
            posActual = position;
        }

        const div = document.createElement("div");
        div.className = "position-slot empty";
        div.dataset.position = position;
        div.dataset.slot = slot;
        fila.appendChild(div);
    }
}


// ==========================================
// RENDER EQUIPO
// ==========================================

export function renderTeam() {
    // 1. La cancha se rearma según la formación activa (§17.1).
    construirCancha();

    if (formationSelect) formationSelect.value = estado.formacion;

    // 2. Se colocan los jugadores asignados a cada slot.
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
// SELECTOR DE FORMACIÓN Y MENTALIDADES
// ==========================================

function poblarSelect(select, claves, etiqueta) {
    select.innerHTML = claves
        .map(c => `<option value="${c}">${etiqueta(c)}</option>`)
        .join("");
}

export function initTacticaEquipo() {
    // Formación: una opción por cada formación de §17.
    poblarSelect(formationSelect, CLAVES_FORMACION, c => c);
    formationSelect.value = estado.formacion;
    formationSelect.addEventListener("change", () => {
        cambiarFormacion(formationSelect.value);
    });

    // Mentalidad ofensiva.
    poblarSelect(offMentalitySelect, CLAVES_OFENSIVA, c => MENTALIDADES_OF[c].etiqueta);
    offMentalitySelect.value = estado.mentalidadOfensiva;
    offMentalitySelect.addEventListener("change", () => {
        estado.mentalidadOfensiva = offMentalitySelect.value;
        guardarPartida(estado);
        actualizarDescMentalidades();
    });

    // Mentalidad defensiva.
    poblarSelect(defMentalitySelect, CLAVES_DEFENSIVA, c => MENTALIDADES_DEF[c].etiqueta);
    defMentalitySelect.value = estado.mentalidadDefensiva;
    defMentalitySelect.addEventListener("change", () => {
        estado.mentalidadDefensiva = defMentalitySelect.value;
        guardarPartida(estado);
        actualizarDescMentalidades();
    });

    actualizarDescMentalidades();
}

function actualizarDescMentalidades() {
    if (offMentalityDesc) {
        offMentalityDesc.textContent = DESC_OFENSIVA[estado.mentalidadOfensiva] || "";
    }
    if (defMentalityDesc) {
        defMentalityDesc.textContent = DESC_DEFENSIVA[estado.mentalidadDefensiva] || "";
    }
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
