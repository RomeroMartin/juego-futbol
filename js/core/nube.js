// ==========================================
// PERSISTENCIA EN FIRESTORE (§51, Etapa 7)
// ==========================================
//
// Reemplaza a localStorage como almacén de la partida. Los datos del usuario
// viven en la nube; el juego funciona en cualquier dispositivo con la misma
// cuenta. Estructura de §51:
//
//   users/{uid}                       ← perfil + monedas + pity + inventario
//   users/{uid}/collection/{playerId} ← { playerId, quantity, obtenidoEn }
//   users/{uid}/teams/actual          ← formación + XI + mentalidades
//   users/{uid}/historial/{id}        ← resumen de cada partido
//
// 🔑 SEPARACIÓN CATÁLOGO / INVENTARIO (§54): en Firestore la colección guarda
// SOLO el `playerId` y la cantidad, NUNCA el objeto jugador completo. Al leer,
// se rehidrata el jugador desde el catálogo local (data/jugadores.js). Así, si
// se ajusta una stat del dataset, no quedan copias viejas regadas por la nube.
//
// 🔑 NO SE GUARDAN STATS CALCULADAS (§51.1): el documento del equipo lleva la
// formación, el XI (ids) y las mentalidades; ataque/medio/defensa/valoración se
// recalculan siempre en el cliente.
//
// ⚠️ Etapa 7: la economía sigue corriendo en el CLIENTE (§15.0), así que el
// cliente escribe su propia colección/fichas. La Etapa 8 mueve eso a Cloud
// Functions y endurece las reglas para que el cliente ya no pueda escribir valor.

import { db, auth } from "../config/firebase.js";
import {
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { JUGADORES } from "../data/jugadores.js";
import { usuarioNuevo, inventarioNuevo } from "./economia.js";
import { equipoVacio } from "./storage.js";


// Índice del catálogo por id, para rehidratar la colección en O(1).
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

// Tope de Firestore: un writeBatch admite hasta 500 operaciones.
const MAX_OPS_BATCH = 450;

// Campos del modelo de usuario (§44) que se guardan en el documento users/{uid}.
// El inventario de paquetes y el perfil se agregan aparte.
const CAMPOS_USUARIO = [
    "schemaVersion",
    "monedas",
    "puntosAcumulados",
    "packsPremiumGanados",
    "amistososConPuntosHoy",
    "fechaContadorAmistosos",
    "paquetesDesdeUltimoArquero",
    "paquetesDesdeUltimoDestacado",
    "paquetesBienvenidaReclamados",
    "primerPaqueteEspecialPendiente",
    "ultimoPartidoDelDia"
];


// ==========================================
// CACHÉ PARA ESCRITURA POR DELTA
// ==========================================
//
// Para no reescribir las ~30–800 cartas de la colección en cada guardado, se
// recuerda lo último persistido y solo se escriben las entradas que cambiaron.
// `obtenidoEn` se fija una sola vez (cuando la carta entra por primera vez).

let cacheCantidades = new Map();   // playerId -> quantity persistido
let cacheObtenido   = new Map();   // playerId -> fecha ISO de obtención

// Serializa los guardados para que dos llamadas concurrentes no se pisen.
let cadenaGuardado = Promise.resolve();


// Reinicia la caché (al cerrar sesión o cambiar de usuario). Sin esto, el delta
// de un usuario se “heredaría” al siguiente que entre en el mismo navegador.
export function reiniciarCacheNube() {
    cacheCantidades = new Map();
    cacheObtenido = new Map();
    cadenaGuardado = Promise.resolve();
}


// ==========================================
// LECTURA DE LA PARTIDA
// ==========================================
//
// Devuelve { existe, usuario, paquetes, collection, equipo, historial }.
// `existe:false` significa usuario nuevo en la nube (sin documento todavía).
export async function leerPartida(uid) {
    const usuarioSnap = await getDoc(doc(db, "users", uid));

    if (!usuarioSnap.exists()) {
        reiniciarCacheNube();
        return { existe: false };
    }

    const data = usuarioSnap.data();

    // Modelo de usuario (§44): defaults + lo guardado (por si falta algún campo).
    const usuario = { ...usuarioNuevo(), ...data.usuario };
    usuario.monedas = { ...usuarioNuevo().monedas, ...(data.usuario?.monedas || {}) };

    const paquetes = { ...inventarioNuevo(), ...(data.paquetes || {}) };

    // Colección: rehidrata cada jugador desde el catálogo local. Los ids que ya
    // no existen en el dataset se descartan (dataset cambiado, §10).
    const coleccionSnap = await getDocs(collection(db, "users", uid, "collection"));
    const coleccion = [];
    reiniciarCacheNube();
    for (const d of coleccionSnap.docs) {
        const { playerId, quantity, obtenidoEn } = d.data();
        const player = CATALOGO.get(playerId);
        if (!player) continue;   // jugador fuera del catálogo actual: se ignora.
        coleccion.push({ player, quantity });
        cacheCantidades.set(playerId, quantity);
        cacheObtenido.set(playerId, obtenidoEn || null);
    }

    // Equipo (§51): formación + XI + mentalidades. Se sanea con storage.equipoVacio
    // como base si el documento no existe.
    const equipoSnap = await getDoc(doc(db, "users", uid, "teams", "actual"));
    let equipo;
    if (equipoSnap.exists()) {
        const e = equipoSnap.data();
        const base = equipoVacio(e.formacion);
        equipo = {
            formacion: base.formacion,
            team: { ...base.team, ...(e.team || {}) },
            mentalidadOfensiva: e.mentalidadOfensiva || base.mentalidadOfensiva,
            mentalidadDefensiva: e.mentalidadDefensiva || base.mentalidadDefensiva
        };
    } else {
        equipo = equipoVacio();
    }

    // Historial: se ordena por fecha (más reciente primero).
    const historialSnap = await getDocs(collection(db, "users", uid, "historial"));
    const historial = historialSnap.docs
        .map(d => d.data())
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    return { existe: true, usuario, paquetes, collection: coleccion, equipo, historial };
}


// ==========================================
// ESCRITURA COMPLETA (creación / migración)
// ==========================================
//
// Sube TODA la partida. Se usa al crear el usuario en la nube o al migrar desde
// localStorage. Escribe en lotes de ≤450 operaciones (tope de Firestore).
export async function escribirPartidaCompleta(uid, estado, perfil) {
    reiniciarCacheNube();

    const ahora = new Date().toISOString();

    // Documento de usuario (perfil + §44 + inventario).
    await setDoc(doc(db, "users", uid), {
        ...perfil,
        usuario: extraerUsuario(estado.usuario),
        paquetes: { ...estado.paquetes },
        actualizadoEn: ahora
    });

    // Documento de equipo.
    await setDoc(doc(db, "users", uid, "teams", "actual"), docEquipo(estado, ahora));

    // Colección en lotes.
    let batch = writeBatch(db);
    let ops = 0;
    for (const item of estado.collection) {
        const id = item.player.id;
        batch.set(doc(db, "users", uid, "collection", id), {
            playerId: id,
            quantity: item.quantity,
            obtenidoEn: ahora
        });
        cacheCantidades.set(id, item.quantity);
        cacheObtenido.set(id, ahora);
        if (++ops >= MAX_OPS_BATCH) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
        }
    }
    if (ops > 0) await batch.commit();

    // Historial (si venía de una migración local).
    for (const registro of estado.historial || []) {
        await addDoc(collection(db, "users", uid, "historial"), registro);
    }
}


// ==========================================
// GUARDADO INCREMENTAL (lo que llama la UI)
// ==========================================
//
// Reemplazo directo de la vieja guardarPartida(estado) de storage.js. La UI la
// llama SIN await (fire-and-forget). Escribe siempre el documento de usuario y
// el equipo (chicos), y solo las cartas cuya cantidad cambió desde el último
// guardado. Los guardados se encolan para no pisarse entre sí.
export function guardarPartida(estado) {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve();   // sin sesión no hay dónde guardar.

    cadenaGuardado = cadenaGuardado
        .then(() => escribirCambios(uid, estado))
        .catch(err => console.error("[nube] Error al guardar la partida:", err));

    return cadenaGuardado;
}

async function escribirCambios(uid, estado) {
    const ahora = new Date().toISOString();
    const batch = writeBatch(db);

    // Usuario + equipo (siempre; son documentos chicos).
    batch.set(doc(db, "users", uid), {
        usuario: extraerUsuario(estado.usuario),
        paquetes: { ...estado.paquetes },
        actualizadoEn: ahora
    }, { merge: true });

    batch.set(doc(db, "users", uid, "teams", "actual"), docEquipo(estado, ahora));

    // Delta de la colección: solo las cartas cuya cantidad cambió.
    const nuevos = new Map();
    let ops = 2;
    for (const item of estado.collection) {
        const id = item.player.id;
        nuevos.set(id, item.quantity);
        if (cacheCantidades.get(id) === item.quantity) continue;

        const esNuevo = !cacheObtenido.has(id) || cacheObtenido.get(id) == null;
        const obtenidoEn = esNuevo ? ahora : cacheObtenido.get(id);
        batch.set(doc(db, "users", uid, "collection", id), {
            playerId: id,
            quantity: item.quantity,
            obtenidoEn
        }, { merge: true });
        cacheObtenido.set(id, obtenidoEn);
        ops++;

        // Si el delta fuese enorme (migración disfrazada), se corta el batch.
        if (ops >= MAX_OPS_BATCH) break;
    }

    await batch.commit();
    cacheCantidades = nuevos;
}


// Agrega un partido al historial del usuario (subcolección). Fire-and-forget.
export function agregarHistorialNube(registro) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    addDoc(collection(db, "users", uid, "historial"), registro)
        .catch(err => console.error("[nube] Error al guardar el partido en el historial:", err));
}


// ==========================================
// HELPERS
// ==========================================

// Toma solo los campos §44 del modelo de usuario (sin arrastrar basura).
function extraerUsuario(usuario) {
    const out = {};
    for (const campo of CAMPOS_USUARIO) out[campo] = usuario[campo];
    return out;
}

// Documento de equipo (§51): sin stats calculadas (§51.1).
function docEquipo(estado, ahora) {
    return {
        schemaVersion: 3,
        formacion: estado.formacion,
        team: { ...estado.team },
        mentalidadOfensiva: estado.mentalidadOfensiva,
        mentalidadDefensiva: estado.mentalidadDefensiva,
        actualizadoEn: ahora
    };
}
