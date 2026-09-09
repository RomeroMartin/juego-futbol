// ==========================================
// COLECCIÓN
// ==========================================

import { estado } from "../core/estado.js";
import { venderRepetidoNube } from "../core/nube.js";
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

let vendiendo = false;

async function vender(playerId) {
    if (vendiendo) return;
    vendiendo = true;
    try {
        // 🔴 Etapa 8: la venta (que otorga Fichas) la hace el servidor (§50.1).
        const r = await venderRepetidoNube(playerId);
        estado.usuario.monedas.fichas = r.fichas;
        const item = estado.collection.find(e => e.player.id === r.playerId);
        if (item) item.quantity = r.quantity;

        updateHeader();
        renderCollection();
    } catch (e) {
        alert(e?.message || "No se pudo vender el jugador.");
    } finally {
        vendiendo = false;
    }
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
