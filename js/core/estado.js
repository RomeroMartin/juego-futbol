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

import {
    equipoVacio,
    sincronizarDataset,
    leerPartidaLocal,
    hayDatosLocales,
    yaMigrado,
    marcarMigrado
} from "./storage.js";
import {
    usuarioNuevo,
    inventarioNuevo,
    reclamarBienvenidaSiCorresponde,
    totalPaquetes
} from "./economia.js";
import {
    leerPartida,
    escribirPartidaCompleta,
    agregarHistorialNube,
    reiniciarCacheNube
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
// - Si es nuevo en la nube:
//     · si hay una partida local sin migrar → se migra (una sola vez) y se sube;
//     · si no → se crea un usuario nuevo (con los 5 sobres de bienvenida, §13.1)
//       y se sube.
//
// Devuelve { migradoDesdeLocal, datasetReseteado } para que la UI pueda avisar.
export async function hidratarDesdeNube(user) {
    const uid = user.uid;
    console.log("🔎 FF: hidratarDesdeNube inicio, uid =", uid);
    const nube = await leerPartida(uid);
    console.log("🔎 FF: leerPartida devolvió, existe =", nube.existe);

    let migradoDesdeLocal = false;
    let datasetReseteado = false;

    if (nube.existe) {
        aplicar(nube);
        console.log("🔎 FF: estado aplicado desde la nube");
        return { migradoDesdeLocal, datasetReseteado };
    }

    // Usuario nuevo en la nube.
    if (!yaMigrado() && hayDatosLocales()) {
        // Antes de migrar, saneamos el local por si el dataset cambió (§10).
        datasetReseteado = sincronizarDataset();
        if (hayDatosLocales()) {
            aplicar(leerPartidaLocal());
            migradoDesdeLocal = true;
        } else {
            aplicar(nuevoJugador());
        }
    } else {
        aplicar(nuevoJugador());
    }

    console.log("🔎 FF: usuario nuevo, escribiendo partida completa…");
    await escribirPartidaCompleta(uid, estado, construirPerfil(user));
    marcarMigrado();
    console.log("🔎 FF: partida nueva creada en la nube");

    return { migradoDesdeLocal, datasetReseteado };
}


// Limpia el estado al cerrar sesión, para que nada del usuario anterior quede
// visible ni se persista por error en la cuenta siguiente.
export function limpiarEstado() {
    reiniciarCacheNube();
    aplicar(nuevoJugador(false));
    estado.historial = [];
}


// ==========================================
// HELPERS DE HIDRATACIÓN
// ==========================================

// Vuelca los datos cargados sobre el objeto `estado` (mutación in-place). Acepta
// tanto el formato de la nube (equipo anidado) como el local (campos planos).
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

// Datos de un jugador nuevo. Con `conBienvenida` acredita los 5 sobres (§13.1);
// al limpiar el estado (logout) no hace falta.
function nuevoJugador(conBienvenida = true) {
    const usuario = usuarioNuevo();
    const paquetes = inventarioNuevo();
    if (conBienvenida) reclamarBienvenidaSiCorresponde(usuario, paquetes);
    const eq = equipoVacio();
    return {
        usuario,
        paquetes,
        collection: [],
        formacion: eq.formacion,
        team: eq.team,
        mentalidadOfensiva: eq.mentalidadOfensiva,
        mentalidadDefensiva: eq.mentalidadDefensiva,
        historial: []
    };
}

// Perfil (§44) a partir del usuario de Firebase Auth.
function construirPerfil(user) {
    return {
        nombre: user.displayName || (user.email ? user.email.split("@")[0] : "Jugador"),
        email: user.email || null,
        fotoPerfil: user.photoURL || null,
        creadoEn: new Date().toISOString()
    };
}


// ==========================================
// HISTORIAL (en memoria + persistencia en la nube)
// ==========================================

// Agrega un partido al frente del historial (más reciente primero), recorta y
// lo persiste en Firestore. Reemplaza a la vieja función de storage.js.
export function agregarAlHistorial(registro) {
    estado.historial.unshift(registro);
    if (estado.historial.length > MAX_HISTORIAL) estado.historial.length = MAX_HISTORIAL;
    agregarHistorialNube(registro);
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
