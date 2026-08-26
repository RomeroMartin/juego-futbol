// ==========================================
// COLECCIÓN
// ==========================================

import { estado } from "../core/estado.js";
import { guardarPartida } from "../core/storage.js";
import { venderRepetido } from "../core/economia.js";
import { ECONOMIA } from "../config/economia.js";
import { createPlayerCard } from "./componentes.js";
import { updateHeader } from "./navegacion.js";


const collectionCardsElement = document.getElementById("collectionCards");


// ==========================================
// RENDER COLECCIÓN
// ==========================================

export function renderCollection() {
    collectionCardsElement.innerHTML = "";

    let filtered = [...estado.collection];

    if (estado.currentFilter !== "all") {
        filtered = filtered.filter(
            item => item.player.position === estado.currentFilter
        );
    }

    if (filtered.length === 0) {
        collectionCardsElement.innerHTML = `

            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 80px 20px;
                color: #91a49a;
            ">

                No tenés jugadores
                en esta categoría.

            </div>

        `;

        return;
    }

    filtered.forEach(item => {
        const card = createPlayerCard(
            item.player,
            true,
            item.quantity
        );

        // Venta de repetidos (§15.4): solo con quantity ≥ 2 (nunca la última copia).
        if (item.quantity >= 2) {
            const valor = ECONOMIA.venderRepetido[item.player.rarity];
            const boton = document.createElement("button");
            boton.className = "card-sell";
            boton.textContent = `Vender · +${valor} 🪙`;
            boton.dataset.playerId = item.player.id;
            boton.addEventListener("click", (e) => {
                e.stopPropagation();
                vender(item.player.id);
            });
            card.appendChild(boton);
        }

        collectionCardsElement.appendChild(card);
    });
}


// ==========================================
// VENDER UN REPETIDO
// ==========================================

function vender(playerId) {
    const r = venderRepetido(estado.usuario, estado.collection, playerId);
    if (!r.ok) {
        alert(r.error);
        return;
    }
    guardarPartida(estado);
    updateHeader();
    renderCollection();
}


// ==========================================
// FILTROS DE COLECCIÓN
// ==========================================

export function initFiltrosColeccion() {
    document.querySelectorAll(".filter-button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".filter-button").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            estado.currentFilter = button.dataset.filter;

            renderCollection();
        });
    });
}
