// ==========================================
// PUNTO DE ENTRADA
// ==========================================
//
// Se carga como módulo ES desde index.html (<script type="module">).
// Importa los módulos, engancha los eventos y hace el primer render.

import { estado, datasetReseteado } from "./core/estado.js";
import { guardarPartida } from "./core/storage.js";
import { showScreen, updateHeader } from "./ui/navegacion.js";
import { initPaquetes } from "./ui/paquetes.js";
import { initTienda } from "./ui/tienda.js";
import { initFiltrosColeccion } from "./ui/coleccion.js";
import { renderTeam, initFiltrosEquipo, initTacticaEquipo } from "./ui/equipo.js";
import { initPartido } from "./ui/partido.js";


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

initPaquetes();
initTienda();
initFiltrosColeccion();
initFiltrosEquipo();
initTacticaEquipo();
initPartido();


// ==========================================
// AVISO DE RESET DE COLECCIÓN (Etapa 1)
// ==========================================

if (datasetReseteado) {
    const aviso = document.getElementById("datasetNotice");
    aviso.hidden = false;

    document
        .getElementById("datasetNoticeClose")
        .addEventListener("click", () => {
            aviso.hidden = true;
        });
}


// ==========================================
// INICIO
// ==========================================

// Al cargar, la colección ya pasó por migrar() (§52). La reguardamos una vez
// para dejar persistida la versión migrada (campos §8 completos, schemaVersion).
guardarPartida(estado);

updateHeader();
renderTeam();
