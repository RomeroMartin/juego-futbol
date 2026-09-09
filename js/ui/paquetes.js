// ==========================================
// PAQUETES (§13, §14) — inventario, apertura y revelado
// ==========================================
//
// La lógica de apertura (rarezas, pity, bienvenida, sin duplicados) vive en
// core/economia.js. Acá solo va la UI: mostrar el inventario, disparar la
// apertura y revelar las cartas.

import { estado, getTotalPaquetes } from "../core/estado.js";
import { abrirPaqueteNube, jugadorDeCatalogo } from "../core/nube.js";
import { POSICIONES } from "../core/economia.js";
import { etiquetaRareza } from "../config/economia.js";
import { createPlayerCard, getPositionName } from "./componentes.js";
import { showScreen, updateHeader } from "./navegacion.js";


const packCardsElement = document.getElementById("packCards");
const packInventoryElement = document.getElementById("packInventory");


// Presentación de cada tipo de paquete.
const INFO_TIPO = {
    BASICO:     { icono: "📦", nombre: "Paquete Básico",     desc: "6 jugadores · probabilidades estándar" },
    PREMIUM:    { icono: "💎", nombre: "Paquete Premium",    desc: "6 jugadores · 1 DESTACADO garantizado" },
    POSICIONAL: { icono: "🎯", nombre: "Paquete Posicional", desc: "6 jugadores de la posición que elijas" }
};
const ORDEN_TIPOS = ["BASICO", "PREMIUM", "POSICIONAL"];

// Meta de la última apertura (para los avisos de garantía en el revelado).
let ultimaMeta = null;

// Evita doble apertura mientras el servidor responde.
let abriendo = false;


// ==========================================
// INVENTARIO DE SOBRES (home)
// ==========================================

export function renderInventario() {
    if (!packInventoryElement) return;

    if (getTotalPaquetes() === 0) {
        packInventoryElement.innerHTML = `
            <p class="pack-inventory-vacio">
                No te quedan sobres. Ganá Fichas jugando y comprá más en la Tienda.
            </p>
        `;
        return;
    }

    packInventoryElement.innerHTML = ORDEN_TIPOS.map(tipo => {
        const info = INFO_TIPO[tipo];
        const cantidad = estado.paquetes[tipo] || 0;
        const sinStock = cantidad <= 0;

        // El posicional necesita elegir posición al abrir.
        const selector = tipo === "POSICIONAL"
            ? `<select class="pack-pos-select" data-pos-for="${tipo}" ${sinStock ? "disabled" : ""}>
                   ${POSICIONES.map(p => `<option value="${p}">${getPositionName(p)}</option>`).join("")}
               </select>`
            : "";

        return `
            <div class="pack-inv-row ${sinStock ? "sin-stock" : ""}">
                <span class="pack-inv-icono">${info.icono}</span>
                <div class="pack-inv-datos">
                    <strong>${info.nombre} <span class="pack-inv-cant">x${cantidad}</span></strong>
                    <small>${info.desc}</small>
                </div>
                ${selector}
                <button
                    class="main-button pack-inv-abrir"
                    data-abrir="${tipo}"
                    ${sinStock ? "disabled" : ""}
                >
                    ABRIR
                </button>
            </div>
        `;
    }).join("");
}


// ==========================================
// ABRIR UN PAQUETE
// ==========================================

async function abrir(tipo, posicion) {
    if (abriendo) return;
    if ((estado.paquetes[tipo] || 0) <= 0) {
        alert("No te quedan paquetes de ese tipo.");
        return;
    }
    if (tipo === "POSICIONAL" && !POSICIONES.includes(posicion)) {
        alert("Elegí una posición para el paquete posicional.");
        return;
    }

    // 🔴 Etapa 8: el SERVIDOR decide qué te toca (§50.1). El cliente solo pide y
    // aplica la respuesta.
    abriendo = true;
    try {
        const r = await abrirPaqueteNube(tipo, tipo === "POSICIONAL" ? posicion : null);

        // Inventario nuevo y cartas afectadas, según lo que devolvió el servidor.
        estado.paquetes = r.paquetes;
        for (const { playerId, quantity } of r.cambios) {
            const item = estado.collection.find(e => e.player.id === playerId);
            if (item) item.quantity = quantity;
            else estado.collection.push({ player: jugadorDeCatalogo(playerId), quantity });
        }

        estado.currentPack = r.cartas
            .map(id => jugadorDeCatalogo(id))
            .filter(Boolean);
        ultimaMeta = r.meta;

        renderPack();
        updateHeader();
        showScreen("packScreen");
    } catch (e) {
        alert(e?.message || "No se pudo abrir el paquete. Probá de nuevo.");
    } finally {
        abriendo = false;
    }
}


// ==========================================
// REVELADO DEL PAQUETE
// ==========================================

function avisosDeGarantia(meta) {
    if (!meta) return "";
    const avisos = [];
    if (meta.especialBienvenida) {
        avisos.push("🎁 <strong>Sobre de bienvenida</strong>: composición garantizada (1 arquero, 2 defensores, 2 medios, 1 delantero) y al menos 1 " + etiquetaRareza("ORO") + ".");
    }
    if (meta.tipo === "POSICIONAL") {
        avisos.push("🎯 Paquete posicional: las 6 cartas son de la posición elegida.");
    }
    if (meta.tipo === "PREMIUM") {
        avisos.push("💎 Premium: al menos 1 " + etiquetaRareza("DESTACADO") + " garantizado.");
    }
    if (meta.garantiaArquero) {
        avisos.push("🧤 Arquero garantizado (venías sin arqueros o con una racha larga sin uno).");
    }
    if (meta.garantiaRareza && meta.tipo !== "PREMIUM") {
        avisos.push("✨ " + etiquetaRareza("DESTACADO") + " garantizado por racha (10 paquetes sin uno).");
    }
    if (avisos.length === 0) return "";
    return `<div class="pack-avisos">${avisos.map(a => `<p>${a}</p>`).join("")}</div>`;
}

export function renderPack() {
    packCardsElement.innerHTML = "";

    estado.currentPack.forEach(player => {
        const card = createPlayerCard(player, false);
        packCardsElement.appendChild(card);
    });

    // Avisos de garantía arriba de las cartas.
    const avisos = avisosDeGarantia(ultimaMeta);
    const contenedorAvisos = document.getElementById("packAvisos");
    if (contenedorAvisos) contenedorAvisos.innerHTML = avisos;
}


// ==========================================
// ENGANCHE DE EVENTOS
// ==========================================

export function initPaquetes() {
    renderInventario();

    // Delegación: los botones del inventario se re-renderizan.
    if (packInventoryElement) {
        packInventoryElement.addEventListener("click", (e) => {
            const boton = e.target.closest("[data-abrir]");
            if (!boton) return;
            const tipo = boton.dataset.abrir;
            let posicion = null;
            if (tipo === "POSICIONAL") {
                const sel = packInventoryElement.querySelector(`[data-pos-for="POSICIONAL"]`);
                posicion = sel ? sel.value : null;
            }
            abrir(tipo, posicion);
        });
    }
}
