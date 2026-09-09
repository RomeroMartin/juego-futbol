// ==========================================
// PERSISTENCIA (localStorage) + MIGRACIÓN
// ==========================================
//
// Carga y guardado del estado en localStorage. Toda lectura de una colección
// guardada pasa por migrar() antes de usarse (§52), para que partidas viejas
// no se rompan al cambiar el modelo de datos.

import { DATASET_VERSION } from "../config/dataset.js";
import {
    FORMACION_DEFAULT,
    FORMACIONES,
    equipoVacioDeFormacion,
    slotsDeFormacion
} from "../config/formaciones.js";
import {
    MENTALIDAD_OF_DEFAULT,
    MENTALIDAD_DEF_DEFAULT,
    MENTALIDADES_OF,
    MENTALIDADES_DEF
} from "../config/mentalidades.js";
import {
    usuarioNuevo,
    inventarioNuevo,
    SCHEMA_USUARIO
} from "./economia.js";

const CLAVE_COLECCION = "futbolFiguritasCollection";
const CLAVE_PAQUETES  = "futbolFiguritasPacks";     // Etapa 6: inventario por tipo (antes: número)
const CLAVE_EQUIPO    = "futbolFiguritasTeam";
const CLAVE_DATASET   = "futbolFiguritasDatasetVersion";
const CLAVE_HISTORIAL = "futbolFiguritasHistorial";
const CLAVE_USUARIO   = "futbolFiguritasUsuario";   // Etapa 6: modelo de usuario (§44)


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

    // Reset al estado inicial. También el historial: sus partidos referencian
    // ids de jugadores que ya no existen en el plantel nuevo. Y el usuario:
    // colección, fichas y pity vuelven al estado de un usuario nuevo.
    localStorage.removeItem(CLAVE_COLECCION);
    localStorage.removeItem(CLAVE_EQUIPO);
    localStorage.removeItem(CLAVE_PAQUETES);
    localStorage.removeItem(CLAVE_HISTORIAL);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.setItem(CLAVE_DATASET, DATASET_VERSION);

    return teniaDatos;
}


// ==========================================
// HISTORIAL DE PARTIDOS (lectura local, solo migración)
// ==========================================
//
// Etapa 7: el historial vivo pasó a Firestore (subcolección) y a estado.js. Esta
// lectura local queda SOLO como fuente de la migración desde localStorage.

function cargarHistorialLocal() {
    return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL)) || [];
}


// ==========================================
// EQUIPO VACÍO POR DEFECTO
// ==========================================
//
// El equipo persistido ya NO es solo el mapa de slots: lleva la formación
// elegida y las dos mentalidades (§17, §19). El mapa de slots depende de la
// formación (§17.1), así que se genera desde formaciones.js.

export function equipoVacio(formacion = FORMACION_DEFAULT) {
    return {
        schemaVersion: SCHEMA_VERSION_ACTUAL,
        formacion,
        team: equipoVacioDeFormacion(formacion),
        mentalidadOfensiva: MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: MENTALIDAD_DEF_DEFAULT
    };
}


// ==========================================
// MIGRACIÓN DEL EQUIPO GUARDADO
// ==========================================
//
// Formato viejo (Etapas 0–4): el localStorage guardaba SOLO el mapa de slots
// (por1..del3), sin formación ni mentalidades. Se envuelve en el formato nuevo
// conservando los jugadores ya elegidos (eran 4-3-3). Cualquier clave inválida
// (mentalidad que ya no existe, formación desconocida) cae al default.

function migrarEquipo(guardado) {
    if (!guardado || typeof guardado !== "object") {
        return equipoVacio();
    }

    // Formato viejo: es directamente el mapa de slots (no tiene `team`).
    if (!("team" in guardado)) {
        return {
            schemaVersion: SCHEMA_VERSION_ACTUAL,
            formacion: FORMACION_DEFAULT,
            team: { ...equipoVacioDeFormacion(FORMACION_DEFAULT), ...guardado },
            mentalidadOfensiva: MENTALIDAD_OF_DEFAULT,
            mentalidadDefensiva: MENTALIDAD_DEF_DEFAULT
        };
    }

    // Formato nuevo: saneo de claves.
    const formacion = FORMACIONES[guardado.formacion] ? guardado.formacion : FORMACION_DEFAULT;

    // El mapa de slots debe corresponder a la formación; se completa lo que falte.
    const base = equipoVacioDeFormacion(formacion);
    const team = { ...base };
    for (const { slot } of slotsDeFormacion(formacion)) {
        if (guardado.team && guardado.team[slot] !== undefined) {
            team[slot] = guardado.team[slot];
        }
    }

    return {
        schemaVersion: SCHEMA_VERSION_ACTUAL,
        formacion,
        team,
        mentalidadOfensiva: MENTALIDADES_OF[guardado.mentalidadOfensiva]
            ? guardado.mentalidadOfensiva : MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: MENTALIDADES_DEF[guardado.mentalidadDefensiva]
            ? guardado.mentalidadDefensiva : MENTALIDAD_DEF_DEFAULT
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


// Inventario de paquetes por tipo { BASICO, PREMIUM, POSICIONAL }.
//
// Migración: hasta la Etapa 5 esta clave guardaba un NÚMERO plano (la cuenta de
// paquetes, todos estándar). Ese número se envuelve como BASICO. La acreditación
// de los 5 paquetes de bienvenida la hace estado.js con reclamarBienvenida...().
export function cargarInventario() {
    const guardado = localStorage.getItem(CLAVE_PAQUETES);
    if (guardado === null) return inventarioNuevo();

    const parsed = JSON.parse(guardado);
    if (typeof parsed === "number") {
        return { ...inventarioNuevo(), BASICO: parsed };
    }
    return { ...inventarioNuevo(), ...parsed };
}


// Modelo de usuario (§44), migrando saldos parciales al modelo completo.
export function cargarUsuario() {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_USUARIO));

    if (guardado) {
        return migrarUsuario(guardado);
    }

    // No hay usuario guardado. Si YA había paquetes guardados (número o objeto),
    // es un usuario pre-Etapa 6 que ya recibió su bienvenida en el flujo viejo:
    // no se le re-otorgan los 5 ni el paquete especial garantizado.
    const usuario = usuarioNuevo();
    if (localStorage.getItem(CLAVE_PAQUETES) !== null) {
        usuario.paquetesBienvenidaReclamados = true;
        usuario.primerPaqueteEspecialPendiente = false;
    }
    return usuario;
}


// Completa un usuario guardado con los campos §44 que falten (saldos parciales,
// campos nuevos), sin pisar los valores existentes.
function migrarUsuario(guardado) {
    const base = usuarioNuevo();
    const u = { ...base, ...guardado };
    u.monedas = { ...base.monedas, ...(guardado.monedas || {}) };
    u.schemaVersion = SCHEMA_USUARIO;
    return u;
}


// Devuelve el equipo COMPLETO { formacion, team, mentalidadOfensiva,
// mentalidadDefensiva }, migrando el formato viejo si hace falta.
export function cargarEquipo() {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_EQUIPO));
    return migrarEquipo(guardado);
}


// ==========================================
// MIGRACIÓN localStorage → FIRESTORE (Etapa 7)
// ==========================================
//
// Etapa 7: el guardado pasó a Firestore (core/nube.js). localStorage ya no se
// escribe; queda como ORIGEN de una migración única. La primera vez que un
// usuario entra con su cuenta y NO tiene datos en la nube, si había una partida
// local se sube a Firestore (una sola vez) y se marca como migrada.

const CLAVE_MIGRADO = "futbolFiguritasMigradoNube";

// Lee la partida completa guardada en localStorage y la devuelve en el mismo
// formato que usa `estado`. La colección viene rehidratada (jugador completo).
export function leerPartidaLocal() {
    const usuario = cargarUsuario();
    const inventario = cargarInventario();
    const equipo = cargarEquipo();
    const collection = cargarColeccion();
    const historial = cargarHistorialLocal();

    return {
        usuario,
        paquetes: inventario,
        collection,
        formacion: equipo.formacion,
        team: equipo.team,
        mentalidadOfensiva: equipo.mentalidadOfensiva,
        mentalidadDefensiva: equipo.mentalidadDefensiva,
        historial
    };
}

// ¿Hay una partida local con datos reales que valga la pena migrar? (No basta
// con que exista el modelo de usuario por defecto: tiene que haber colección,
// paquetes o historial.)
export function hayDatosLocales() {
    const tienePaquetes = localStorage.getItem(CLAVE_PAQUETES) !== null;
    const tieneColeccion = cargarColeccion().length > 0;
    const tieneHistorial = cargarHistorialLocal().length > 0;
    return tienePaquetes || tieneColeccion || tieneHistorial;
}

// La migración local es de una sola vez por navegador.
export function yaMigrado() {
    return localStorage.getItem(CLAVE_MIGRADO) === "true";
}

export function marcarMigrado() {
    localStorage.setItem(CLAVE_MIGRADO, "true");
}
