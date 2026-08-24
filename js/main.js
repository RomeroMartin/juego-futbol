// ==========================================
// PUNTO DE ENTRADA
// ==========================================
//
// Se carga como módulo ES desde index.html (<script type="module">).
// Importa los módulos, engancha los eventos y hace el primer render.

import { estado } from "./core/estado.js";
import { guardarPartida } from "./core/storage.js";
import { showScreen, updateHeader } from "./ui/navegacion.js";
import { generatePack } from "./ui/paquetes.js";
import { initFiltrosColeccion } from "./ui/coleccion.js";
import { renderTeam, initFiltrosEquipo } from "./ui/equipo.js";


// ==========================================
// ABRIR CONSTRUCTOR DE EQUIPO
// ==========================================

function openTeamBuilder() {
    showScreen("teamScreen");
}


// ==========================================
// ENGANCHE DE EVENTOS
// ==========================================

document
    .getElementById("buildTeamButton")
    .addEventListener("click", openTeamBuilder);

document
    .getElementById("collectionBuildTeamButton")
    .addEventListener("click", openTeamBuilder);


document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
        showScreen(button.dataset.screen);
    });
});


document
    .getElementById("openPackButton")
    .addEventListener("click", generatePack);


document
    .getElementById("closePackButton")
    .addEventListener("click", () => {
        estado.currentPack = [];
        showScreen("homeScreen");
    });


document
    .getElementById("backFromPack")
    .addEventListener("click", () => {
        showScreen("homeScreen");
    });


document
    .getElementById("backFromCollection")
    .addEventListener("click", () => {
        showScreen("homeScreen");
    });


document
    .getElementById("backFromTeam")
    .addEventListener("click", () => {
        showScreen("homeScreen");
    });


// ==========================================
// FILTROS
// ==========================================

initFiltrosColeccion();
initFiltrosEquipo();


// ==========================================
// INICIO
// ==========================================

// Al cargar, la colección ya pasó por migrar() (§52). La reguardamos una vez
// para dejar persistida la versión migrada (campos §8 completos, schemaVersion).
guardarPartida(estado);

updateHeader();
renderTeam();
