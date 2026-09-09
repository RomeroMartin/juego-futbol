// ==========================================
// NUBE: LECTURA (Firestore) + LLAMADAS AL SERVIDOR (Cloud Functions)
// ==========================================
//
// Desde la Etapa 8 el cliente NO escribe nada que otorgue valor. Este módulo:
//   - LEE la partida del usuario (Firestore) al iniciar sesión;
//   - GUARDA solo el equipo (formación / XI / mentalidades), que no da ventaja;
//   - PIDE al servidor (Cloud Functions) todo lo demás: inicializar la cuenta,
//     abrir/comprar/vender paquetes y registrar partidos. El servidor decide,
//     escribe con el Admin SDK y devuelve el resultado.
//
// 🔑 SEPARACIÓN CATÁLOGO / INVENTARIO (§54): Firestore guarda solo `playerId` +
// cantidad; el jugador completo se rehidrata desde el catálogo local. En el
// equipo NO se guardan stats calculadas (§51.1).

import { db, auth, functions } from "../config/firebase.js";
import {
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

import { JUGADORES } from "../data/jugadores.js";
import { usuarioNuevo, inventarioNuevo } from "./economia.js";
import { equipoVacio } from "./storage.js";


// Índice del catálogo por id, para rehidratar la colección en O(1).
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

// Serializa los guardados del equipo para que dos llamadas no se pisen.
let cadenaGuardado = Promise.resolve();


// ==========================================
// LECTURA DE LA PARTIDA
// ==========================================
//
// Devuelve { existe, usuario, paquetes, collection, equipo, historial }.
// `existe:false` significa usuario nuevo en la nube (sin documento todavía).
export async function leerPartida(uid) {
    const usuarioSnap = await getDoc(doc(db, "users", uid));

    if (!usuarioSnap.exists()) {
        return { existe: false };
    }

    const data = usuarioSnap.data();

    const usuario = { ...usuarioNuevo(), ...data.usuario };
    usuario.monedas = { ...usuarioNuevo().monedas, ...(data.usuario?.monedas || {}) };

    const paquetes = { ...inventarioNuevo(), ...(data.paquetes || {}) };

    // Colección: se rehidrata cada jugador desde el catálogo local; los ids que
    // ya no existen en el dataset se descartan (dataset cambiado, §10).
    const coleccionSnap = await getDocs(collection(db, "users", uid, "collection"));
    const coleccion = [];
    for (const d of coleccionSnap.docs) {
        const { playerId, quantity } = d.data();
        const player = CATALOGO.get(playerId);
        if (!player) continue;
        coleccion.push({ player, quantity });
    }

    // Equipo (§51): formación + XI + mentalidades. Default si no existe.
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

    // Historial (lo escribe el servidor al registrar partidos): más reciente primero.
    const historialSnap = await getDocs(collection(db, "users", uid, "historial"));
    const historial = historialSnap.docs
        .map(d => d.data())
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    return { existe: true, usuario, paquetes, collection: coleccion, equipo, historial };
}


// Rehidrata un jugador del catálogo local a partir de su id (para las respuestas
// del servidor, que devuelven ids y no el objeto completo).
export function jugadorDeCatalogo(id) {
    return CATALOGO.get(id) || null;
}


// ==========================================
// GUARDADO DEL EQUIPO (lo único que el cliente escribe)
// ==========================================
//
// Formación, XI y mentalidades (§51.1: sin stats calculadas). Fire-and-forget;
// la UI la llama sin await. Todo lo que da valor va por Cloud Functions.
export function guardarPartida(estado) {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve();

    cadenaGuardado = cadenaGuardado
        .then(() => setDoc(doc(db, "users", uid, "teams", "actual"), {
            schemaVersion: 3,
            formacion: estado.formacion,
            team: { ...estado.team },
            mentalidadOfensiva: estado.mentalidadOfensiva,
            mentalidadDefensiva: estado.mentalidadDefensiva,
            actualizadoEn: new Date().toISOString()
        }, { merge: true }))
        .catch(err => console.error("[nube] Error al guardar el equipo:", err));

    return cadenaGuardado;
}


// ==========================================
// LLAMADAS A CLOUD FUNCTIONS (entrega de valor)
// ==========================================
//
// Cada una devuelve `res.data` (lo que responde la función) o lanza si el
// servidor rechaza (HttpsError → el `.message` es legible para el usuario).

const llamar = (nombre) => httpsCallable(functions, nombre);

// Crea la cuenta en la nube con los 5 sobres de bienvenida (idempotente).
export async function inicializarUsuarioNube() {
    const res = await llamar("inicializarUsuario")();
    return res.data;
}

// Abre un paquete: el servidor decide las cartas. Devuelve { cartas:[id], meta,
// paquetes, cambios:[{playerId, quantity}] }.
export async function abrirPaqueteNube(tipo, posicion = null) {
    const res = await llamar("abrirPaquete")({ tipo, posicion });
    return res.data;
}

// Compra un paquete con Fichas. Devuelve { fichas, paquetes }.
export async function comprarPaqueteNube(tipo) {
    const res = await llamar("comprarPaquete")({ tipo });
    return res.data;
}

// Vende un repetido. Devuelve { fichas, playerId, quantity }.
export async function venderRepetidoNube(playerId) {
    const res = await llamar("venderRepetido")({ playerId });
    return res.data;
}

// Registra un partido vs IA (verifica por semilla y otorga Fichas).
// Devuelve { eco, usuario, paquetes }.
export async function registrarPartidoNube(registro) {
    const res = await llamar("registrarPartidoIA")({ registro });
    return res.data;
}
