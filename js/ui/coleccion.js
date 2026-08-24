// ==========================================
// COLECCIÓN
// ==========================================

import { estado } from "../core/estado.js";
import { createPlayerCard } from "./componentes.js";


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

        collectionCardsElement.appendChild(card);
    });
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
