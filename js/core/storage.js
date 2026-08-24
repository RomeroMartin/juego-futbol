// ==========================================
// PERSISTENCIA (localStorage) + MIGRACIÓN
// ==========================================
//
// Carga y guardado del estado en localStorage. Toda lectura de una colección
// guardada pasa por migrar() antes de usarse (§52), para que partidas viejas
// no se rompan al cambiar el modelo de datos.

import { ECONOMIA } from "../config/economia.js";
import { DATASET_VERSION } from "../config/dataset.js";

const CLAVE_COLECCION = "futbolFiguritasCollection";
const CLAVE_PAQUETES  = "futbolFiguritasPacks";
const CLAVE_EQUIPO    = "futbolFiguritasTeam";
const CLAVE_DATASET   = "futbolFiguritasDatasetVersion";


// ==========================================
// VERSIONADO DE DATOS (§52)
// ==========================================

export const SCHEMA_VERSION_ACTUAL = 3;


// Campos del modelo de jugador §8 con su valor por defecto. Se usan para
// completar jugadores guardados con un modelo viejo (V0.3), que solo tenían
// id, name, club, position y las 6 stats de campo.
const CAMPOS_JUGADOR_DEFAULT = {
    shortName:         null,
    clubId:            null,
    nationality:       null,
    age:               null,
    secondaryPosition: null,
    gkDiving:          null,
    gkHandling:        null,
    gkPositioning:     null,
    gkReflexes:        null,
    gkKicking:         null,
    rarity:            null,
    season:            null,
    photo:             null
};


// Migra un objeto persistido a la versión de schema actual.
//
// Sigue el patrón de §52: cada paso lleva el objeto de una versión a la
// siguiente. En esta etapa el único cambio real es 0→1 (pasar del modelo de
// jugador de la V0.3 al modelo completo de §8). Los pasos 1→2 y 2→3 solo suben
// el número de versión: los cambios que definen (p. ej. fichas → monedas.fichas
// de §48.3) pertenecen a etapas posteriores y se implementan cuando lleguen.
export function migrar(objeto) {
    let o = { ...objeto };

    if (!o.schemaVersion)      o = migrarDe0a1(o);
    if (o.schemaVersion === 1) o = migrarDe1a2(o);
    if (o.schemaVersion === 2) o = migrarDe2a3(o);

    return o;
}


// 0 → 1: modelo de jugador V0.3 → modelo completo de §8.
// Agrega todos los campos faltantes en null sin pisar los que ya existan.
function migrarDe0a1(o) {
    const migrado = { ...o };

    for (const [campo, valor] of Object.entries(CAMPOS_JUGADOR_DEFAULT)) {
        if (migrado[campo] === undefined) {
            migrado[campo] = valor;
        }
    }

    migrado.schemaVersion = 1;
    return migrado;
}


// 1 → 2: sin cambios de estructura en esta etapa.
function migrarDe1a2(o) {
    return { ...o, schemaVersion: 2 };
}


// 2 → 3: sin cambios de estructura en esta etapa.
// (El cambio fichas → monedas.fichas de §48.3 se implementa en la Etapa 6/8.)
function migrarDe2a3(o) {
    return { ...o, schemaVersion: 3 };
}


// ==========================================
// SINCRONIZACIÓN DEL DATASET (§10, Etapa 1)
// ==========================================
//
// Cuando el plantel cambia (se regeneró jugadores.js con ids nuevos), las
// colecciones guardadas referencian jugadores que ya no existen. En vez de
// dejar referencias rotas, se resetea la partida al estado inicial de un
// usuario nuevo. El reset es EXPLÍCITO y se le avisa al usuario.
//
// Devuelve true si hubo un reset con datos previos (para mostrar el aviso).
// A un usuario nuevo (sin nada guardado) solo se le sella la versión, sin aviso.
//
// Nota: los 5 paquetes de bienvenida (§13.1) son de la Etapa 6. Por ahora el
// "estado inicial" es el mismo que ve hoy un usuario nuevo: colección vacía,
// equipo vacío y los paquetes de bienvenida de ECONOMIA.
export function sincronizarDataset() {
    const versionGuardada = localStorage.getItem(CLAVE_DATASET);

    if (versionGuardada === DATASET_VERSION) {
        return false;
    }

    const teniaDatos =
        localStorage.getItem(CLAVE_COLECCION) !== null ||
        localStorage.getItem(CLAVE_PAQUETES) !== null ||
        localStorage.getItem(CLAVE_EQUIPO) !== null;

    // Reset al estado inicial.
    localStorage.removeItem(CLAVE_COLECCION);
    localStorage.removeItem(CLAVE_EQUIPO);
    localStorage.removeItem(CLAVE_PAQUETES);
    localStorage.setItem(CLAVE_DATASET, DATASET_VERSION);

    return teniaDatos;
}


// ==========================================
// EQUIPO VACÍO POR DEFECTO (4-3-3)
// ==========================================

export function equipoVacio() {
    return {
        por1: null,

        def1: null,
        def2: null,
        def3: null,
        def4: null,

        med1: null,
        med2: null,
        med3: null,

        del1: null,
        del2: null,
        del3: null
    };
}


// ==========================================
// CARGA
// ==========================================

export function cargarColeccion() {
    const guardada = JSON.parse(
        localStorage.getItem(CLAVE_COLECCION)
    ) || [];

    // Cada jugador guardado pasa por migrar() antes de usarse (§52).
    return guardada.map(item => ({
        ...item,
        player: migrar(item.player)
    }));
}


export function cargarPaquetes() {
    const guardado = localStorage.getItem(CLAVE_PAQUETES);

    // Si no hay nada guardado, arranca con los paquetes de bienvenida (§15.1).
    if (guardado === null) {
        return ECONOMIA.paquetesBienvenida;
    }

    return Number(guardado) || 0;
}


export function cargarEquipo() {
    return JSON.parse(
        localStorage.getItem(CLAVE_EQUIPO)
    ) || equipoVacio();
}


// ==========================================
// GUARDADO
// ==========================================

export function guardarPartida(estado) {
    localStorage.setItem(
        CLAVE_COLECCION,
        JSON.stringify(estado.collection)
    );

    localStorage.setItem(
        CLAVE_PAQUETES,
        estado.packs.toString()
    );

    localStorage.setItem(
        CLAVE_EQUIPO,
        JSON.stringify(estado.team)
    );
}
