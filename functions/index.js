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
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { JUGADORES } from "./juego/data/jugadores.js";
import { FORMACIONES, slotsDeFormacion } from "./juego/config/formaciones.js";
import { MENTALIDAD_OF_DEFAULT, MENTALIDAD_DEF_DEFAULT } from "./juego/config/mentalidades.js";
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


// ==========================================
// TORNEOS — creación / unión / apertura de armado (Etapa 9A, §35–§37)
// ==========================================
//
// El cliente pide; el servidor crea y valida. Las reglas de Firestore dejan al
// cliente LEER un torneo solo si es participante, y NUNCA escribirlo.

// Código de invitación legible: sin caracteres ambiguos (I, O, 0, 1).
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generarCodigo() {
    let s = "";
    for (let i = 0; i < 6; i++) s += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
    return s;
}

// Nombre visible del que llama (para mostrar participantes sin leer docs ajenos).
function nombreDe(token) {
    return token?.name || (token?.email ? token.email.split("@")[0] : "Jugador");
}

// Cuenta jugadores DISTINTOS por posición en la unión de las colecciones (§37).
async function unionPorPosicion(participantes) {
    const vistos = new Set();
    const conteo = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    for (const uid of participantes) {
        const snap = await db.collection(`users/${uid}/collection`).get();
        for (const d of snap.docs) {
            const pid = d.data().playerId;
            if (vistos.has(pid)) continue;
            vistos.add(pid);
            const pl = CATALOGO.get(pid);
            if (pl && conteo[pl.position] !== undefined) conteo[pl.position]++;
        }
    }
    return conteo;
}


// Crea un torneo en estado BORRADOR (juntando participantes). Devuelve el id y
// el código de invitación para compartir.
export const crearTorneo = onCall(async (request) => {
    const uid = requerirUid(request);
    const nombre = (request.data?.nombre || "").trim().slice(0, 40) || "Torneo";
    const formato = "LIGA";   // V1.0: solo liga (§40). ELIMINACION/GRUPOS: futuro.

    // Código único (reintenta ante una colisión, muy improbable).
    let codigo = null;
    for (let i = 0; i < 8; i++) {
        const c = generarCodigo();
        const ex = await db.collection("torneos").where("codigoInvitacion", "==", c).limit(1).get();
        if (ex.empty) { codigo = c; break; }
    }
    if (!codigo) throw new HttpsError("internal", "No se pudo generar un código. Probá de nuevo.");

    const ref = db.collection("torneos").doc();
    await ref.set({
        schemaVersion: 3,
        nombre,
        codigoInvitacion: codigo,
        creadorId: uid,
        estado: "BORRADOR",              // BORRADOR | ARMADO | EN_CURSO | FINALIZADO
        modoExclusividad: "RECLAMO",     // §36.1
        formato,
        minParticipantes: 4,             // §15.2 / §37
        maxParticipantes: 8,
        participantes: [uid],
        nombres: { [uid]: nombreDe(request.auth.token) },
        modoAvance: "MANUAL",
        autoAvanceHoras: null,
        forzadoPorInactividadDias: 5,
        ultimoAvanceEn: null,
        jugadoresReclamados: {},         // playerId → uid (Etapa 9B)
        ventanaArmadoCierra: null,
        fixture: [],
        tabla: [],
        creadoEn: ahoraISO()
    });

    return { torneoId: ref.id, codigoInvitacion: codigo };
});


// Une al usuario a un torneo por código (solo mientras está en BORRADOR).
export const unirseTorneo = onCall(async (request) => {
    const uid = requerirUid(request);
    const codigo = (request.data?.codigo || "").trim().toUpperCase();
    if (!codigo) throw new HttpsError("invalid-argument", "Escribí un código de invitación.");

    const q = await db.collection("torneos").where("codigoInvitacion", "==", codigo).limit(1).get();
    if (q.empty) throw new HttpsError("not-found", "No existe un torneo con ese código.");
    const ref = q.docs[0].ref;

    return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const t = s.data();
        if (t.participantes.includes(uid)) return { torneoId: ref.id, yaUnido: true };
        if (t.estado !== "BORRADOR") {
            throw new HttpsError("failed-precondition", "Ese torneo ya cerró las inscripciones.");
        }
        if (t.participantes.length >= t.maxParticipantes) {
            throw new HttpsError("failed-precondition", "El torneo está lleno.");
        }
        tx.update(ref, {
            participantes: [...t.participantes, uid],
            [`nombres.${uid}`]: nombreDe(request.auth.token)
        });
        return { torneoId: ref.id };
    });
});


// El creador abre la ventana de armado: valida mínimo de participantes y pool
// mínimo (§37). Si no alcanza, devuelve { ok:false, validacion } para que la UI
// ofrezca las salidas de §37. Si alcanza, pasa a ARMADO con ventana de 24hs.
export const abrirArmado = onCall(async (request) => {
    const uid = requerirUid(request);
    const torneoId = request.data?.torneoId;
    if (!torneoId) throw new HttpsError("invalid-argument", "Falta el torneo.");

    const ref = db.doc(`torneos/${torneoId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "El torneo no existe.");
    const t = snap.data();

    if (t.creadorId !== uid) throw new HttpsError("permission-denied", "Solo el creador puede abrir el armado.");
    if (t.estado !== "BORRADOR") throw new HttpsError("failed-precondition", "El torneo ya cerró la inscripción.");

    const n = t.participantes.length;
    if (n < t.minParticipantes) {
        throw new HttpsError("failed-precondition",
            `Necesitás al menos ${t.minParticipantes} participantes (hay ${n}).`);
    }

    // Pool mínimo (§37): peor caso por posición sobre la unión de colecciones.
    const conteo = await unionPorPosicion(t.participantes);
    const requerido = { POR: n * 1, DEF: n * 5, MED: n * 5, DEL: n * 3 };
    for (const pos of ["POR", "DEF", "MED", "DEL"]) {
        if (conteo[pos] < requerido[pos]) {
            return {
                ok: false,
                validacion: { pos, faltan: requerido[pos] - conteo[pos], conteo, requerido }
            };
        }
    }

    // Alcanza: abrir ventana de armado de 24hs (transacción para re-chequear).
    const cierra = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const tt = s.data();
        if (tt.estado !== "BORRADOR") throw new HttpsError("failed-precondition", "El torneo ya cambió de estado.");
        if (tt.participantes.length < tt.minParticipantes) {
            throw new HttpsError("failed-precondition", "Se fueron participantes; ya no llegás al mínimo.");
        }
        tx.update(ref, {
            estado: "ARMADO",
            ventanaArmadoCierra: cierra,
            ultimoAvanceEn: ahoraISO()
        });
    });

    return { ok: true, ventanaArmadoCierra: cierra };
});


// ==========================================
// TORNEOS — armado del equipo con exclusividad (Etapa 9B, §36.1, §37.1, §38)
// ==========================================
//
// Durante la ventana de armado, cada participante arma SU equipo del torneo
// reclamando jugadores. El primero que reclama a un jugador lo bloquea para el
// resto (§36.1). El índice de exclusividad vive en el doc del torneo
// (jugadoresReclamados: playerId → uid); el layout del XI de cada uno vive en
// la subcolección torneos/{id}/equipos/{uid}. TODO corre en transacción: dos
// usuarios pueden pedir el mismo jugador en el mismo instante (§38).

// Mapa slot → posición de una formación (ej. { por1:"POR", def1:"DEF", ... }).
function slotsPorPosicion(formacion) {
    const m = {};
    for (const { slot, position } of slotsDeFormacion(formacion)) m[slot] = position;
    return m;
}

// Un torneo admite cambios de armado solo en estado ARMADO y con la ventana de
// 24hs todavía abierta. Cerrada la ventana, el equipo está congelado (§17.3).
function armadoAbierto(t) {
    return t.estado === "ARMADO"
        && t.ventanaArmadoCierra
        && Date.now() < new Date(t.ventanaArmadoCierra).getTime();
}

// Exige que el que llama sea participante de un torneo con el armado abierto.
// Devuelve los datos del torneo. Tira HttpsError con mensaje en español si no.
function exigirArmadoAbierto(t, uid) {
    if (!t) throw new HttpsError("not-found", "El torneo no existe.");
    if (!t.participantes.includes(uid)) throw new HttpsError("permission-denied", "No sos participante de este torneo.");
    if (t.estado !== "ARMADO") throw new HttpsError("failed-precondition", "El armado de este torneo no está abierto.");
    if (!armadoAbierto(t)) throw new HttpsError("failed-precondition", "La ventana de armado ya cerró; el equipo quedó congelado.");
}

// Conjunto de playerIds que ALGÚN participante del torneo posee en su colección.
// Sirve para el Pool de Reserva (§37.1): reserva = COMÚN que NADIE posee.
async function idsPoseidosPorTorneo(participantes) {
    const poseidos = new Set();
    for (const uid of participantes) {
        const snap = await db.collection(`users/${uid}/collection`).get();
        for (const d of snap.docs) poseidos.add(d.data().playerId);
    }
    return poseidos;
}

// Igual que idsPoseidosPorTorneo, pero con lecturas transaccionales (para usar
// dentro de reclamarJugador, donde las lecturas deben ir antes que las escrituras).
async function idsPoseidosPorTorneoTx(t, participantes) {
    const poseidos = new Set();
    for (const uid of participantes) {
        const snap = await t.get(db.collection(`users/${uid}/collection`));
        for (const d of snap.docs) poseidos.add(d.data().playerId);
    }
    return poseidos;
}

// Equipo de torneo vacío para una formación (todos los slots en null).
function equipoTorneoVacio(formacion) {
    const xi = {};
    for (const { slot } of slotsDeFormacion(formacion)) xi[slot] = null;
    return {
        schemaVersion: 3,
        formacion,
        xi,
        mentalidadOfensiva: MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: MENTALIDAD_DEF_DEFAULT,
        reservaUsados: [],
        actualizadoEn: ahoraISO()
    };
}


// Elegir / cambiar la formación del equipo del torneo. Cambiar de formación
// LIBERA todos los jugadores que el usuario tenía reclamados (los slots cambian
// y quedan a disposición del resto), tal como se decidió con el usuario.
export const elegirFormacionTorneo = onCall(async (request) => {
    const uid = requerirUid(request);
    const torneoId = request.data?.torneoId;
    const formacion = request.data?.formacion;
    if (!torneoId) throw new HttpsError("invalid-argument", "Falta el torneo.");
    if (!FORMACIONES[formacion]) throw new HttpsError("invalid-argument", "Formación inválida.");

    const ref = db.doc(`torneos/${torneoId}`);
    const equipoRef = db.doc(`torneos/${torneoId}/equipos/${uid}`);

    return db.runTransaction(async (t) => {
        const torneo = (await t.get(ref)).data();
        exigirArmadoAbierto(torneo, uid);

        // Liberar todos los reclamos de este usuario (los slots de la nueva
        // formación son otros): se borran del índice global del torneo.
        const reclamados = torneo.jugadoresReclamados || {};
        const liberar = {};
        for (const [pid, dueno] of Object.entries(reclamados)) {
            if (dueno === uid) liberar[`jugadoresReclamados.${pid}`] = FieldValue.delete();
        }
        if (Object.keys(liberar).length > 0) t.update(ref, liberar);

        // Equipo nuevo y vacío para la formación elegida (se conservan las
        // mentalidades previas si ya había equipo).
        const prev = (await t.get(equipoRef)).data();
        const nuevo = equipoTorneoVacio(formacion);
        if (prev) {
            nuevo.mentalidadOfensiva = prev.mentalidadOfensiva || nuevo.mentalidadOfensiva;
            nuevo.mentalidadDefensiva = prev.mentalidadDefensiva || nuevo.mentalidadDefensiva;
        }
        t.set(equipoRef, nuevo);

        return { ok: true, formacion };
    });
});


// Reclamar un jugador para un slot del XI del torneo (§38, punto crítico).
// Atómico: valida posesión (o Pool de Reserva §37.1) y exclusividad, y escribe
// el índice global + el slot del equipo en la MISMA transacción.
export const reclamarJugador = onCall(async (request) => {
    const uid = requerirUid(request);
    const torneoId = request.data?.torneoId;
    const playerId = request.data?.playerId;
    const slot = request.data?.slot;
    if (!torneoId || !slot) throw new HttpsError("invalid-argument", "Faltan datos del reclamo.");

    const player = CATALOGO.get(playerId);
    if (!player) throw new HttpsError("invalid-argument", "Jugador inválido.");

    const ref = db.doc(`torneos/${torneoId}`);
    const equipoRef = db.doc(`torneos/${torneoId}/equipos/${uid}`);

    return db.runTransaction(async (t) => {
        const torneo = (await t.get(ref)).data();
        exigirArmadoAbierto(torneo, uid);

        const equipo = (await t.get(equipoRef)).data();
        if (!equipo) throw new HttpsError("failed-precondition", "Elegí una formación antes de reclamar jugadores.");

        // El slot tiene que existir en la formación y ser de la posición del jugador.
        const posDeSlot = slotsPorPosicion(equipo.formacion);
        if (!(slot in posDeSlot)) throw new HttpsError("invalid-argument", "Ese puesto no existe en tu formación.");
        if (posDeSlot[slot] !== player.position) {
            throw new HttpsError("failed-precondition", "Ese jugador no juega en ese puesto.");
        }

        // El puesto no puede estar ocupado por OTRO jugador (primero hay que liberar).
        const ocupante = equipo.xi?.[slot] || null;
        if (ocupante && ocupante !== playerId) {
            throw new HttpsError("failed-precondition", "Ese puesto ya tiene un jugador; liberalo primero.");
        }

        // Exclusividad (§36.1): si otro ya lo reclamó, no se puede.
        const reclamados = torneo.jugadoresReclamados || {};
        const duenoActual = reclamados[playerId];
        if (duenoActual && duenoActual !== uid) {
            throw new HttpsError("already-exists", "Otro participante ya reclamó a ese jugador.");
        }

        // Posesión propia, o Pool de Reserva (§37.1).
        const propioSnap = await t.get(db.doc(`users/${uid}/collection/${String(playerId)}`));
        const reservaUsados = Array.isArray(equipo.reservaUsados) ? [...equipo.reservaUsados] : [];
        let esReserva = false;

        if (!propioSnap.exists) {
            // No lo tenés: solo vale como reserva si es COMÚN, NADIE del torneo lo
            // posee, y no superás el tope de 3 jugadores de reserva.
            if (player.rarity !== "COMUN") {
                throw new HttpsError("permission-denied", "No tenés a ese jugador.");
            }
            const poseidos = await idsPoseidosPorTorneoTx(t, torneo.participantes);
            if (poseidos.has(playerId)) {
                throw new HttpsError("permission-denied", "Ese jugador no está disponible como reserva.");
            }
            if (!reservaUsados.includes(playerId) && reservaUsados.length >= 3) {
                throw new HttpsError("failed-precondition", "Llegaste al máximo de 3 jugadores de reserva (§37.1).");
            }
            esReserva = true;
            if (!reservaUsados.includes(playerId)) reservaUsados.push(playerId);
        }

        // Escribir: índice global del torneo + slot del equipo (misma transacción).
        t.update(ref, { [`jugadoresReclamados.${playerId}`]: uid });
        t.set(equipoRef, {
            [`xi.${slot}`]: playerId,
            reservaUsados,
            actualizadoEn: ahoraISO()
        }, { merge: true });

        return { ok: true, playerId, slot, esReserva };
    });
});


// Liberar un jugador del XI del torneo (§39): vuelve al pool disponible y su
// slot queda vacío. Solo con la ventana abierta.
export const liberarJugador = onCall(async (request) => {
    const uid = requerirUid(request);
    const torneoId = request.data?.torneoId;
    const playerId = request.data?.playerId;
    if (!torneoId || playerId === undefined) throw new HttpsError("invalid-argument", "Faltan datos.");

    const ref = db.doc(`torneos/${torneoId}`);
    const equipoRef = db.doc(`torneos/${torneoId}/equipos/${uid}`);

    return db.runTransaction(async (t) => {
        const torneo = (await t.get(ref)).data();
        exigirArmadoAbierto(torneo, uid);

        const reclamados = torneo.jugadoresReclamados || {};
        if (reclamados[playerId] !== uid) {
            throw new HttpsError("failed-precondition", "No tenés reclamado a ese jugador.");
        }

        const equipo = (await t.get(equipoRef)).data() || { xi: {}, reservaUsados: [] };

        // Vaciar el slot que lo tenía y sacarlo de la lista de reserva.
        const cambios = { actualizadoEn: ahoraISO() };
        for (const [slot, pid] of Object.entries(equipo.xi || {})) {
            if (pid === playerId) cambios[`xi.${slot}`] = null;
        }
        const reservaUsados = (equipo.reservaUsados || []).filter(id => id !== playerId);

        t.update(ref, { [`jugadoresReclamados.${playerId}`]: FieldValue.delete() });
        t.set(equipoRef, { ...cambios, reservaUsados }, { merge: true });

        return { ok: true, playerId };
    });
});


// Pool de Reserva (§37.1): jugadores COMÚN reales que NINGÚN participante posee,
// para una posición, todavía sin reclamar. El cliente no puede calcularlo (no lee
// las colecciones ajenas), así que lo arma el servidor y lo devuelve.
export const listarPoolReserva = onCall(async (request) => {
    const uid = requerirUid(request);
    const torneoId = request.data?.torneoId;
    const posicion = request.data?.posicion;
    if (!torneoId) throw new HttpsError("invalid-argument", "Falta el torneo.");
    if (!["POR", "DEF", "MED", "DEL"].includes(posicion)) {
        throw new HttpsError("invalid-argument", "Posición inválida.");
    }

    const torneo = (await db.doc(`torneos/${torneoId}`).get()).data();
    if (!torneo) throw new HttpsError("not-found", "El torneo no existe.");
    if (!torneo.participantes.includes(uid)) throw new HttpsError("permission-denied", "No sos participante.");

    const poseidos = await idsPoseidosPorTorneo(torneo.participantes);
    const reclamados = torneo.jugadoresReclamados || {};

    const candidatos = JUGADORES
        .filter(j => j.position === posicion
            && j.rarity === "COMUN"
            && !poseidos.has(j.id)
            && !reclamados[j.id])
        .map(j => ({ id: j.id, name: j.name, club: j.club, overall: j.overall, position: j.position }))
        .sort((a, b) => (b.overall || 0) - (a.overall || 0));

    return { candidatos };
});
