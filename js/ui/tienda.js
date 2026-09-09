// ==========================================
// TIENDA DE PAQUETES (§15.5)
// ==========================================
//
// Compra de paquetes con Fichas. El descuento y la validación de saldo viven en
// core/economia.js (comprarPaquete). Al comprar, el paquete se suma al
// inventario y se abre desde el home (el POSICIONAL elige posición al abrirse).

import { estado } from "../core/estado.js";
import { comprarPaqueteNube } from "../core/nube.js";
import { ECONOMIA } from "../config/economia.js";
import { updateHeader, showScreen } from "./navegacion.js";
import { renderInventario } from "./paquetes.js";


const tiendaContenido = document.getElementById("tiendaContenido");
const tiendaFichas = document.getElementById("tiendaFichas");


// Presentación de cada paquete de la tienda (§15.5).
const CATALOGO = [
    { tipo: "BASICO",     icono: "📦", nombre: "Paquete Básico",
      contenido: "6 jugadores · probabilidades estándar" },
    { tipo: "PREMIUM",    icono: "💎", nombre: "Paquete Premium",
      contenido: "6 jugadores · mínimo 1 DESTACADO garantizado" },
    { tipo: "POSICIONAL", icono: "🎯", nombre: "Paquete Posicional",
      contenido: "6 jugadores de una posición a elegir (al abrirlo)" }
];


export function renderTienda() {
    const fichas = estado.usuario.monedas.fichas;
    if (tiendaFichas) tiendaFichas.textContent = fichas;

    tiendaContenido.innerHTML = CATALOGO.map(p => {
        const precio = ECONOMIA.precios[p.tipo];
        const alcanza = fichas >= precio;
        const enInventario = estado.paquetes[p.tipo] || 0;
        return `
            <div class="tienda-card">
                <span class="tienda-icono">${p.icono}</span>
                <h3>${p.nombre}</h3>
                <p class="tienda-contenido">${p.contenido}</p>
                <p class="tienda-precio">🪙 ${precio} Fichas</p>
                <p class="tienda-inventario">Tenés ${enInventario} en el inventario</p>
                <button
                    class="main-button tienda-comprar"
                    data-comprar="${p.tipo}"
                    ${alcanza ? "" : "disabled"}
                >
                    ${alcanza ? "COMPRAR" : "FICHAS INSUFICIENTES"}
                </button>
            </div>
        `;
    }).join("");
}


let comprando = false;

async function comprar(tipo) {
    if (comprando) return;
    comprando = true;
    try {
        // 🔴 Etapa 8: el descuento de Fichas y el alta del sobre los hace el
        // servidor (§50.1). El cliente aplica los saldos que devuelve.
        const r = await comprarPaqueteNube(tipo);
        estado.usuario.monedas.fichas = r.fichas;
        estado.paquetes = r.paquetes;

        updateHeader();
        renderInventario();
        renderTienda();
    } catch (e) {
        alert(e?.message || "No se pudo comprar el paquete.");
    } finally {
        comprando = false;
    }
}


export function initTienda() {
    document.getElementById("tiendaButton")
        .addEventListener("click", () => showScreen("tiendaScreen"));

    document.getElementById("backFromTienda")
        .addEventListener("click", () => showScreen("homeScreen"));

    tiendaContenido.addEventListener("click", (e) => {
        const boton = e.target.closest("[data-comprar]");
        if (!boton) return;
        comprar(boton.dataset.comprar);
    });
}
