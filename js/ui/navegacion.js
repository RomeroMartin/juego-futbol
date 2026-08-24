// ==========================================
// NAVEGACIÓN Y HEADER (shell de la app)
// ==========================================

import {
    estado,
    getTotalCards,
    getTeamPlayerCount
} from "../core/estado.js";

import { renderCollection } from "./coleccion.js";
import { renderTeam } from "./equipo.js";


// ==========================================
// ELEMENTOS DEL HEADER
// ==========================================

const packCountElement       = document.getElementById("packCount");
const collectionCountElement = document.getElementById("collectionCount");
const uniquePlayersElement   = document.getElementById("uniquePlayers");
const totalFiguritasElement  = document.getElementById("totalFiguritas");
const teamPlayerCountElement = document.getElementById("teamPlayerCount");


// ==========================================
// CAMBIAR DE PANTALLA
// ==========================================

export function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = document.getElementById(screenId);

    if (screen) {
        screen.classList.add("active");
    }

    document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.remove("active");

        if (button.dataset.screen === screenId) {
            button.classList.add("active");
        }
    });

    if (screenId === "collectionScreen") {
        renderCollection();
    }

    if (screenId === "teamScreen") {
        renderTeam();
    }
}


// ==========================================
// ACTUALIZAR HEADER
// ==========================================

export function updateHeader() {
    const totalCards = getTotalCards();

    collectionCountElement.textContent =
        `${estado.collection.length} jugadores · ${totalCards} figuritas`;

    packCountElement.textContent = `${estado.packs} paquetes`;

    uniquePlayersElement.textContent = estado.collection.length;

    totalFiguritasElement.textContent = totalCards;

    teamPlayerCountElement.textContent = getTeamPlayerCount();
}
