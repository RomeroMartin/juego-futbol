// ==========================================
// CLOUD FUNCTIONS — Fútbol Figuritas (Etapa 8, §50.1 / §53)
// ==========================================
//
// Toda la entrega de VALOR corre acá, en el servidor, nunca en el cliente:
// abrir/comprar/vender paquetes, otorgar Fichas y registrar partidos. El cliente
// solo pide; el servidor decide y escribe. Las reglas de Firestore bloquean que
// el cliente escriba colección, fichas, puntos e inventario (ver firestore.rules).
//
// La lógica de juego (economía, motor, verificación) es la MISMA que corre en el
// cliente: está copiada en ./juego (pura y ya testeada). Solo cambia quién la
// ejecuta.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { JUGADORES } from "./juego/data/jugadores.js";
import {
    abrirPaquete as ecoAbrirPaquete,
    comprarPaquete as ecoComprarPaquete,
    venderRepetido as ecoVenderRepetido,
    registrarResultadoEconomia,
    usuarioNuevo,
    inventarioNuevo,
    reclamarBienvenidaSiCorresponde,
    POSICIONES
} from "./juego/core/economia.js";
import { reVerificar } from "./juego/core/verificar.js";


initializeApp();
const db = getFirestore();

// Catálogo por id, para reconstruir cartas (rareza, etc.) del lado servidor.
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

// Campos del modelo de usuario (§44) que viven en el documento users/{uid}.
const CAMPOS_USUARIO = [
    "schemaVersion", "monedas", "puntosAcumulados", "packsPremiumGanados",
    "amistososConPuntosHoy", "fechaContadorAmistosos",
    "paquetesDesdeUltimoArquero", "paquetesDesdeUltimoDestacado",
    "paquetesBienvenidaReclamados", "primerPaqueteEspecialPendiente",
    "ultimoPartidoDelDia"
];


// ==========================================
// HELPERS
// ==========================================

// uid autenticado o error. Ninguna función otorga valor sin sesión.
function requerirUid(request) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    return uid;
}

// Reconstruye el modelo de usuario (§44) desde el documento, completando
// defaults por si falta algún campo.
function reconstruirUsuario(data) {
    const base = usuarioNuevo();
    const u = { ...base, ...(data.usuario || {}) };
    u.monedas = { ...base.monedas, ...(data.usuario?.monedas || {}) };
    return u;
}

// Toma solo los campos §44 (sin arrastrar nada más) para guardar.
function extraerUsuario(usuario) {
    const out = {};
    for (const campo of CAMPOS_USUARIO) out[campo] = usuario[campo];
    return out;
}

const ahoraISO = () => new Date().toISOString();


// ==========================================
// inicializarUsuario — crea la cuenta con los 5 sobres de bienvenida (§13.1)
// ==========================================
//
// El cliente ya no puede regalarse sobres (las reglas lo bloquean), así que la
// bienvenida la acredita el servidor. Idempotente: si el documento ya existe, no
// hace nada.

export const inicializarUsuario = onCall(async (request) => {
    const uid = requerirUid(request);
    const token = request.auth.token || {};
    const userRef = db.doc(`users/${uid}`);

    return db.runTransaction(async (t) => {
        const snap = await t.get(userRef);
        if (snap.exists) return { creado: false };

        const usuario = usuarioNuevo();
        const paquetes = inventarioNuevo();
        reclamarBienvenidaSiCorresponde(usuario, paquetes);   // 5 BASICO (§15.1)

        const nombre = token.name
            || (token.email ? token.email.split("@")[0] : "Jugador");

        t.set(userRef, {
            nombre,
            email: token.email || null,
            fotoPerfil: token.picture || null,
            creadoEn: ahoraISO(),
            usuario: extraerUsuario(usuario),
            paquetes,
            actualizadoEn: ahoraISO()
        });

        return { creado: true };
    });
});


// ==========================================
// abrirPaquete — el servidor decide qué te toca (§13, §14)
// ==========================================

export const abrirPaquete = onCall(async (request) => {
    const uid = requerirUid(request);
    const tipo = request.data?.tipo;
    const posicion = request.data?.posicion || null;

    if (!["BASICO", "PREMIUM", "POSICIONAL"].includes(tipo)) {
        throw new HttpsError("invalid-argument", "Tipo de paquete inválido.");
    }
    if (tipo === "POSICIONAL" && !POSICIONES.includes(posicion)) {
        throw new HttpsError("invalid-argument", "Elegí una posición válida para el paquete posicional.");
    }

    const userRef = db.doc(`users/${uid}`);
    const colRef = db.collection(`users/${uid}/collection`);

    return db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new HttpsError("not-found", "Tu cuenta no está inicializada.");

        const data = userSnap.data();
        const usuario = reconstruirUsuario(data);
        const paquetes = { ...inventarioNuevo(), ...(data.paquetes || {}) };

        if ((paquetes[tipo] || 0) <= 0) {
            throw new HttpsError("failed-precondition", "No te quedan paquetes de ese tipo.");
        }

        // Colección actual (para pity de arquero y para acumular repetidos).
        const colSnap = await t.get(colRef);
        const previos = new Map();
        const coleccion = [];
        for (const d of colSnap.docs) {
            const cd = d.data();
            const player = CATALOGO.get(cd.playerId);
            if (!player) continue;
            previos.set(cd.playerId, cd);
            coleccion.push({ player, quantity: cd.quantity });
        }

        // El servidor decide (misma lógica pura que antes corría en el cliente).
        paquetes[tipo] -= 1;
        const { cartas, meta } = ecoAbrirPaquete(
            usuario, coleccion, tipo, { posicion, silencioso: true }
        );

        // Persistir: documento de usuario (§44 + inventario).
        t.set(userRef, {
            usuario: extraerUsuario(usuario),
            paquetes,
            actualizadoEn: ahoraISO()
        }, { merge: true });

        // Persistir las cartas afectadas (cantidad nueva; obtenidoEn una sola vez).
        const idsAfectados = [...new Set(cartas.map(c => c.id))];
        const cambios = [];
        for (const id of idsAfectados) {
            const entry = coleccion.find(e => e.player.id === id);
            const obtenidoEn = previos.get(id)?.obtenidoEn || ahoraISO();
            t.set(colRef.doc(String(id)), {
                playerId: id,
                quantity: entry.quantity,
                obtenidoEn
            }, { merge: true });
            cambios.push({ playerId: id, quantity: entry.quantity });
        }

        return {
            cartas: cartas.map(c => c.id),   // el cliente rehidrata desde su catálogo
            meta,
            paquetes,
            cambios
        };
    });
});


// ==========================================
// comprarPaquete — descuenta Fichas y suma el sobre (§15.5)
// ==========================================

export const comprarPaquete = onCall(async (request) => {
    const uid = requerirUid(request);
    const tipo = request.data?.tipo;
    const userRef = db.doc(`users/${uid}`);

    return db.runTransaction(async (t) => {
        const snap = await t.get(userRef);
        if (!snap.exists) throw new HttpsError("not-found", "Tu cuenta no está inicializada.");

        const data = snap.data();
        const usuario = reconstruirUsuario(data);
        const paquetes = { ...inventarioNuevo(), ...(data.paquetes || {}) };

        const r = ecoComprarPaquete(usuario, tipo);   // valida saldo y descuenta
        if (!r.ok) throw new HttpsError("failed-precondition", r.error);

        paquetes[tipo] = (paquetes[tipo] || 0) + 1;

        t.set(userRef, {
            usuario: extraerUsuario(usuario),
            paquetes,
            actualizadoEn: ahoraISO()
        }, { merge: true });

        return { fichas: usuario.monedas.fichas, paquetes };
    });
});


// ==========================================
// venderRepetido — suma Fichas por un repetido (§15.4)
// ==========================================

export const venderRepetido = onCall(async (request) => {
    const uid = requerirUid(request);
    const playerId = request.data?.playerId;
    const player = CATALOGO.get(playerId);
    if (!player) throw new HttpsError("invalid-argument", "Jugador inválido.");

    const userRef = db.doc(`users/${uid}`);
    const cardRef = db.doc(`users/${uid}/collection/${String(playerId)}`);

    return db.runTransaction(async (t) => {
        const [userSnap, cardSnap] = await Promise.all([t.get(userRef), t.get(cardRef)]);
        if (!userSnap.exists) throw new HttpsError("not-found", "Tu cuenta no está inicializada.");
        if (!cardSnap.exists) throw new HttpsError("failed-precondition", "No tenés ese jugador.");

        const usuario = reconstruirUsuario(userSnap.data());
        const coleccion = [{ player, quantity: cardSnap.data().quantity }];

        const r = ecoVenderRepetido(usuario, coleccion, playerId);   // valida quantity ≥ 2
        if (!r.ok) throw new HttpsError("failed-precondition", r.error);

        t.set(userRef, {
            usuario: extraerUsuario(usuario),
            actualizadoEn: ahoraISO()
        }, { merge: true });
        t.update(cardRef, { quantity: r.quantity });

        return { fichas: usuario.monedas.fichas, playerId, quantity: r.quantity };
    });
});


// ==========================================
// registrarPartidoIA — verifica por semilla (§53.1) y otorga Fichas (§15.4)
// ==========================================
//
// El cliente juega el partido y manda el registro (semilla + ambos equipos por
// id + marcador). El servidor RE-SIMULA con la misma semilla: si el marcador no
// coincide, el resultado es falso y se rechaza. Los partidos vs IA dan Fichas
// pero NUNCA puntos ni sobres (§15.0, §15.3).

export const registrarPartidoIA = onCall(async (request) => {
    const uid = requerirUid(request);
    const registro = request.data?.registro;
    if (!registro || !registro.equipoUsuarioIds || !registro.equipoRivalIds) {
        throw new HttpsError("invalid-argument", "Registro de partido inválido.");
    }

    // Re-verificación pura (sin tocar Firestore). Si algo no cuadra, se rechaza.
    let v;
    try {
        v = reVerificar(registro);
    } catch (e) {
        throw new HttpsError("failed-precondition", "No se pudo verificar el partido.");
    }
    if (!v.coincide) {
        throw new HttpsError("failed-precondition", "El resultado del partido no se pudo verificar.");
    }

    // Ids del XI del usuario (para verificar posesión).
    const u = registro.equipoUsuarioIds;
    const idsUsuario = [...new Set([u.arquero, ...u.defensores, ...u.medios, ...u.delanteros])];

    const userRef = db.doc(`users/${uid}`);

    const salida = await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new HttpsError("not-found", "Tu cuenta no está inicializada.");

        // Verificar que el usuario POSEE a los jugadores que dice haber usado.
        const cardSnaps = await Promise.all(
            idsUsuario.map(id => t.get(db.doc(`users/${uid}/collection/${String(id)}`)))
        );
        if (cardSnaps.some(s => !s.exists)) {
            throw new HttpsError("permission-denied", "Usaste un jugador que no poseés.");
        }

        const data = userSnap.data();
        const usuario = reconstruirUsuario(data);
        const paquetes = { ...inventarioNuevo(), ...(data.paquetes || {}) };

        // Otorga Fichas según el resultado RE-SIMULADO por el servidor (§15.4).
        const eco = registrarResultadoEconomia(usuario, "IA", v.resultado);
        // (vs IA nunca da Packs PREMIUM; el while queda por robustez.)
        if (eco.packsPremiumOtorgados > 0) {
            paquetes.PREMIUM = (paquetes.PREMIUM || 0) + eco.packsPremiumOtorgados;
        }

        t.set(userRef, {
            usuario: extraerUsuario(usuario),
            paquetes,
            actualizadoEn: ahoraISO()
        }, { merge: true });

        // Historial (lo escribe el servidor; el cliente ya no puede). Se congela
        // el marcador/resultado re-simulado, no lo que dijo el cliente.
        const registroSano = JSON.parse(JSON.stringify(registro));
        registroSano.golesUsuario = v.golesUsuario;
        registroSano.golesRival = v.golesRival;
        registroSano.resultado = v.resultado;
        t.set(db.doc(`users/${uid}/historial/${registro.id}`), registroSano);

        return { eco, usuario: extraerUsuario(usuario), paquetes };
    });

    return salida;
});
