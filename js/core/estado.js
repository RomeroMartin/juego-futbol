// ==========================================
// ESTADO EN MEMORIA
// ==========================================
//
// Estado mutable de la partida. Los módulos de UI leen y escriben `estado.*` y
// persisten con guardarPartida() de core/nube.js.
//
// Etapa 7: el estado YA NO se carga solo al importar el módulo. Arranca con
// valores por defecto seguros y se HIDRATA de forma asíncrona tras el login,
// mutando SIEMPRE el mismo objeto `estado` (nunca se reasigna), para que los
// módulos que lo importaron sigan viendo los datos nuevos.

import { equipoVacio } from "./storage.js";
import {
    usuarioNuevo,
    inventarioNuevo,
    totalPaquetes
} from "./economia.js";
import {
    leerPartida,
    inicializarUsuarioNube
} from "./nube.js";


// Máximo de partidos guardados en el historial en memoria (§ Etapa 3).
const MAX_HISTORIAL = 50;


// Estado inicial vacío (antes de que haya sesión). No se persiste nunca.
const equipoInicial = equipoVacio();

export const estado = {
    usuario:             usuarioNuevo(),      // modelo §44 (fichas, puntos, pity, bienvenida)
    paquetes:            inventarioNuevo(),   // { BASICO, PREMIUM, POSICIONAL }
    collection:          [],
    formacion:           equipoInicial.formacion,
    team:                equipoInicial.team,
    mentalidadOfensiva:  equipoInicial.mentalidadOfensiva,
    mentalidadDefensiva: equipoInicial.mentalidadDefensiva,
    historial:           [],
    currentPack:         [],
    currentFilter:       "all",
    teamPlayerFilter:    "all"
};


// ==========================================
// HIDRATACIÓN DESDE LA NUBE (tras el login)
// ==========================================
//
// - Si el usuario YA tiene datos en Firestore → se cargan.
// - Si es nuevo → el SERVIDOR crea la cuenta con los 5 sobres de bienvenida
//   (§13.1) vía Cloud Function `inicializarUsuario`, y después se relee.
//
// El cliente ya no crea ni migra datos: las reglas de Firestore (Etapa 8) le
// prohíben escribir colección, fichas e inventario.
//
// Devuelve { datasetReseteado } por compatibilidad con el arranque (hoy siempre
// false: la migración desde localStorage se retiró al blindar la escritura).
export async function hidratarDesdeNube(user) {
    const uid = user.uid;
    let nube = await leerPartida(uid);

    if (!nube.existe) {
        // El servidor crea el documento con la bienvenida y volvemos a leer.
        await inicializarUsuarioNube();
        nube = await leerPartida(uid);
    }

    aplicar(nube);
    return { datasetReseteado: false };
}


// Limpia el estado al cerrar sesión, para que nada del usuario anterior quede
// visible ni se persista por error en la cuenta siguiente.
export function limpiarEstado() {
    aplicar(estadoVacio());
}


// ==========================================
// HELPERS DE HIDRATACIÓN
// ==========================================

// Vuelca los datos cargados sobre el objeto `estado` (mutación in-place).
function aplicar(datos) {
    estado.usuario = datos.usuario;
    estado.paquetes = datos.paquetes;
    estado.collection = datos.collection || [];
    estado.historial = datos.historial || [];

    const eq = datos.equipo || datos;
    estado.formacion = eq.formacion;
    estado.team = eq.team;
    estado.mentalidadOfensiva = eq.mentalidadOfensiva;
    estado.mentalidadDefensiva = eq.mentalidadDefensiva;

    estado.currentPack = [];
}

// Estado vacío (sin sesión / logout). No trae bienvenida: eso lo da el servidor
// al crear la cuenta.
function estadoVacio() {
    const eq = equipoVacio();
    return {
        usuario: usuarioNuevo(),
        paquetes: inventarioNuevo(),
        collection: [],
        historial: [],
        equipo: eq
    };
}


// ==========================================
// HISTORIAL (en memoria; el servidor lo persiste al registrar el partido)
// ==========================================

// Agrega un partido al frente del historial en memoria (más reciente primero) y
// recorta. La persistencia la hace la Cloud Function `registrarPartidoIA`.
export function agregarAlHistorial(registro) {
    estado.historial.unshift(registro);
    if (estado.historial.length > MAX_HISTORIAL) estado.historial.length = MAX_HISTORIAL;
    return estado.historial;
}

// Historial en memoria (ya hidratado desde la nube al iniciar sesión).
export function cargarHistorial() {
    return estado.historial;
}


// ==========================================
// TOTAL DE PAQUETES EN EL INVENTARIO
// ==========================================

export function getTotalPaquetes() {
    return totalPaquetes(estado.paquetes);
}


// ==========================================
// TOTAL DE FIGURITAS
// ==========================================

export function getTotalCards() {
    return estado.collection.reduce(
        (total, item) => total + item.quantity,
        0
    );
}


// ==========================================
// JUGADORES DEL EQUIPO (ids no nulos)
// ==========================================

export function getPlayersInTeam() {
    return Object.values(estado.team)
        .filter(playerId => playerId !== null);
}


// ==========================================
// CANTIDAD DE JUGADORES EN EL XI
// ==========================================

export function getTeamPlayerCount() {
    return getPlayersInTeam().length;
}


// ==========================================
// CONTAR SLOTS OCUPADOS POR PREFIJO
// ==========================================

export function getPlayersBySlotPrefix(prefix) {
    return Object.entries(estado.team)
        .filter(
            ([slot, playerId]) =>
                slot.startsWith(prefix) &&
                playerId !== null
        )
        .length;
}


// ==========================================
// JUGADORES DEL XI POR POSICIÓN
// ==========================================

export function getTeamPlayersByPosition(position) {
    return Object.entries(estado.team)
        .map(([slot, playerId]) => {
            if (!playerId) {
                return null;
            }

            const item = estado.collection.find(
                entry => entry.player.id === playerId
            );

            if (!item) {
                return null;
            }

            if (item.player.position !== position) {
                return null;
            }

            return item.player;
        })
        .filter(player => player !== null);
}


// ==========================================
// JUGADOR YA EN EL XI
// ==========================================

export function isPlayerInTeam(playerId) {
    return getPlayersInTeam().includes(playerId);
}
