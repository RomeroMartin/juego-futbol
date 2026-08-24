// ==========================================
// PAQUETES
// ==========================================

import { JUGADORES } from "../data/jugadores.js";
import { estado } from "../core/estado.js";
import { guardarPartida } from "../core/storage.js";
import { createPlayerCard } from "./componentes.js";
import { showScreen, updateHeader } from "./navegacion.js";


const packCardsElement = document.getElementById("packCards");


// ==========================================
// GENERAR PAQUETE
// ==========================================
//
// Nota: acá Math.random() es válido. La prohibición de Math.random() aplica al
// MOTOR DE PARTIDO (que no existe aún), donde se usa el PRNG con semilla.

export function generatePack() {
    if (estado.packs <= 0) {
        alert("No te quedan paquetes.");
        return;
    }

    estado.packs--;
    estado.currentPack = [];

    const availablePlayers = [...JUGADORES];

    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(
            Math.random() * availablePlayers.length
        );

        const selectedPlayer = availablePlayers.splice(randomIndex, 1)[0];

        estado.currentPack.push(selectedPlayer);
    }

    addPackToCollection(estado.currentPack);

    guardarPartida(estado);
    renderPack();
    updateHeader();
    showScreen("packScreen");
}


// ==========================================
// AGREGAR PAQUETE A LA COLECCIÓN
// ==========================================

export function addPackToCollection(pack) {
    pack.forEach(player => {
        const existing = estado.collection.find(
            item => item.player.id === player.id
        );

        if (existing) {
            existing.quantity++;
        } else {
            estado.collection.push({
                player: player,
                quantity: 1
            });
        }
    });
}


// ==========================================
// RENDER PAQUETE
// ==========================================

export function renderPack() {
    packCardsElement.innerHTML = "";

    estado.currentPack.forEach(player => {
        const card = createPlayerCard(player, false);
        packCardsElement.appendChild(card);
    });
}
