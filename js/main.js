// ==========================================
// PUNTO DE ENTRADA
// ==========================================
//
// Se carga como módulo ES desde index.html (<script type="module">).
//
// Etapa 7: el arranque es ASÍNCRONO y pasa por el login. Al iniciar, se observa
// la sesión de Firebase: si hay usuario, se carga su partida desde Firestore y
// se muestra el juego; si no, se muestra el formulario de login. El juego queda
// detrás del overlay hasta que haya sesión.

import { hidratarDesdeNube, limpiarEstado } from "./core/estado.js";
import { observarSesion, salir } from "./core/auth.js";
import {
    initLogin,
    mostrarLogin,
    authOcupado,
    ocultarAuth,
    mostrarErrorAuth
} from "./ui/login.js";

import { showScreen, updateHeader } from "./ui/navegacion.js";
import { initPaquetes } from "./ui/paquetes.js";
import { initTienda } from "./ui/tienda.js";
import { initFiltrosColeccion } from "./ui/coleccion.js";
import { renderTeam, initFiltrosEquipo, initTacticaEquipo } from "./ui/equipo.js";
import { initPartido } from "./ui/partido.js";


// ==========================================
// LISTENERS ESTÁTICOS (no dependen del estado)
// ==========================================
//
// Se enganchan una sola vez al cargar; solo cambian de pantalla. Los handlers
// que leen `estado` recién se disparan por clic, siempre después del login.

function openTeamBuilder() {
    showScreen("teamScreen");
}

document.getElementById("buildTeamButton")
    .addEventListener("click", openTeamBuilder);

document.getElementById("collectionBuildTeamButton")
    .addEventListener("click", openTeamBuilder);

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
        showScreen(button.dataset.screen);
    });
});

document.getElementById("closePackButton")
    .addEventListener("click", () => {
        showScreen("homeScreen");
    });

document.getElementById("backFromPack")
    .addEventListener("click", () => showScreen("homeScreen"));

document.getElementById("backFromCollection")
    .addEventListener("click", () => showScreen("homeScreen"));

document.getElementById("backFromTeam")
    .addEventListener("click", () => showScreen("homeScreen"));

// Cerrar sesión: observarSesion() reaccionará mostrando el login.
document.getElementById("logoutButton")
    .addEventListener("click", () => salir());

// Aviso de reset de colección (Etapa 1), ahora solo relevante tras una
// migración local en la que el dataset había cambiado.
document.getElementById("datasetNoticeClose")
    .addEventListener("click", () => {
        document.getElementById("datasetNotice").hidden = true;
    });


// ==========================================
// ARRANQUE DEL JUEGO (una sola vez por sesión de página)
// ==========================================
//
// Engancha los listeners de las pantallas de juego. Se corre después de la
// primera hidratación, para que nada intente leer el estado antes de tiempo.

let juegoArrancado = false;

function arrancarJuegoUnaVez() {
    if (juegoArrancado) return;
    juegoArrancado = true;

    initPaquetes();
    initTienda();
    initFiltrosColeccion();
    initFiltrosEquipo();
    initTacticaEquipo();
    initPartido();
}


// ==========================================
// SESIÓN
// ==========================================

// Corre `promesa`, pero si tarda más de `ms` la rechaza con un mensaje claro.
// Evita que un problema de red deje al usuario mirando el spinner para siempre.
function conTimeout(promesa, ms, mensaje) {
    let temporizador;
    const limite = new Promise((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
    });
    return Promise.race([promesa, limite])
        .finally(() => clearTimeout(temporizador));
}

initLogin();

observarSesion(async (user) => {
    if (!user) {
        limpiarEstado();
        document.getElementById("userName").textContent = "";
        mostrarLogin();
        return;
    }

    // Hay sesión: cargamos la partida (o la creamos/migramos) y mostramos todo.
    authOcupado(true);
    try {
        const { datasetReseteado } = await conTimeout(
            hidratarDesdeNube(user),
            20000,
            "No se pudo conectar con la base de datos. Puede ser la red o una " +
            "extensión del navegador bloqueando la conexión. Probá de nuevo o " +
            "desde otra red."
        );

        arrancarJuegoUnaVez();

        document.getElementById("userName").textContent =
            user.displayName || (user.email ? user.email.split("@")[0] : "Jugador");

        updateHeader();
        renderTeam();
        showScreen("homeScreen");
        ocultarAuth();

        if (datasetReseteado) {
            document.getElementById("datasetNotice").hidden = false;
        }
    } catch (error) {
        console.error("[main] No se pudo cargar la partida:", error);
        mostrarErrorAuth(error?.message || "No se pudo cargar tu partida. Reintentá.");
        await salir();
    }
});
