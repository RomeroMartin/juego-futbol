// ==========================================
// NAVEGACIÓN Y HEADER (shell de la app)
// ==========================================

import {
    estado,
    getTotalCards,
    getTeamPlayerCount,
    getTotalPaquetes
} from "../core/estado.js";
import { ECONOMIA } from "../config/economia.js";

import { renderCollection } from "./coleccion.js";
import { renderTeam } from "./equipo.js";
import { renderCompetir, renderHistorial } from "./partido.js";
import { renderInventario } from "./paquetes.js";
import { renderTienda } from "./tienda.js";


// ==========================================
// ELEMENTOS DEL HEADER
// ==========================================

const packCountElement       = document.getElementById("packCount");
const fichasCountElement      = document.getElementById("fichasCount");
const puntosCountElement      = document.getElementById("puntosCount");
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

    if (screenId === "competirScreen") {
        renderCompetir();
    }

    if (screenId === "historialScreen") {
        renderHistorial();
    }

    if (screenId === "homeScreen") {
        renderInventario();
    }

    if (screenId === "tiendaScreen") {
        renderTienda();
    }
}


// ==========================================
// ACTUALIZAR HEADER
// ==========================================

export function updateHeader() {
    const totalCards = getTotalCards();

    collectionCountElement.textContent =
        `${estado.collection.length} jugadores · ${totalCards} figuritas`;

    packCountElement.textContent = `${getTotalPaquetes()} paquetes`;

    fichasCountElement.textContent = `🪙 ${estado.usuario.monedas.fichas} Fichas`;
    puntosCountElement.textContent = `⭐ ${estado.usuario.puntosAcumulados}/${ECONOMIA.puntosParaPack}`;

    uniquePlayersElement.textContent = estado.collection.length;

    totalFiguritasElement.textContent = totalCards;

    teamPlayerCountElement.textContent = getTeamPlayerCount();
}
