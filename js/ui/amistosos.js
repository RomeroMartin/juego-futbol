// ==========================================
// AMISTOSOS ENTRE USUARIOS (§32)
// ==========================================
//
// Toda la escritura pasa por Cloud Functions; acá solo se pide y se muestra en
// vivo (Firestore en tiempo real). Se desafía por código (mismo patrón que los
// torneos): A crea el desafío, comparte el código, B lo ingresa. Cada uno
// confirma su equipo del modo normal (tal como esté armado); recién cuando los
// dos confirmaron, el servidor simula el partido (§32) y otorga Fichas +
// puntos (§15.3/§15.4).

import { usuarioActual } from "../core/auth.js";
import { estado } from "../core/estado.js";
import { JUGADORES } from "../data/jugadores.js";
import { MENTALIDADES_OF, MENTALIDADES_DEF } from "../config/mentalidades.js";
import { simularPartido } from "../core/motor.js";
import { reproducirRelatoExterno, construirEquipoUsuario } from "./partido.js";
import { showScreen } from "./navegacion.js";
import {
    escucharMisDesafios,
    crearDesafioNube,
    aceptarDesafioNube,
    confirmarDesafioNube,
    cancelarDesafioNube
} from "../core/nube.js";


const cont = () => document.getElementById("amistososContenido");

// Catálogo por id: para rehidratar los jugadores del relato (§54).
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

let unsubLista = null;      // suscripción en vivo a "mis desafíos"
let desafios = [];          // último estado recibido
let detalleId = null;       // desafío abierto en la vista de detalle (o null = lista)
let ocupado = false;        // evita doble submit mientras responde el servidor
let mensaje = null;         // aviso visible en pantalla { tipo:'ok'|'error'|'info', texto }

// Desafíos JUGADOS cuyo relato ya se vio en esta sesión: hasta entonces, ni la
// lista ni el detalle muestran el marcador (se entera al final del relato,
// mismo criterio que "fecha jugada" en torneos.js).
let vistosAmistoso = new Set();

const ESTADO_ETIQUETA = {
    PENDIENTE: "Esperando rival",
    CONFIRMANDO: "Confirmando equipos",
    JUGADO: "Jugado",
    CANCELADO: "Cancelado"
};


// ==========================================
// SUSCRIPCIÓN EN VIVO
// ==========================================

export function renderAmistosos() {
    const uid = usuarioActual()?.uid;
    if (!uid) return;

    if (!unsubLista) {
        unsubLista = escucharMisDesafios(uid, (lista) => {
            desafios = lista;
            pintar();
        });
    }
    pintar();
}

// Corta la suscripción (al cerrar sesión).
export function detenerAmistosos() {
    if (unsubLista) { unsubLista(); unsubLista = null; }
    desafios = [];
    detalleId = null;
    mensaje = null;
    vistosAmistoso = new Set();
}


// ==========================================
// PINTAR
// ==========================================

function pintar() {
    const c = cont();
    if (!c) return;
    if (detalleId) pintarDetalle(c);
    else pintarLista(c);
}


function pintarLista(c) {
    const uid = usuarioActual()?.uid;
    const mios = [...desafios].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

    const listaHtml = mios.length === 0
        ? `<p class="torneo-vacio">Todavía no tenés ningún amistoso. Desafiá a un amigo o unite con un código.</p>`
        : mios.map(m => {
            const rivalUid = m.participantes.find(p => p !== uid);
            const rival = rivalUid ? (m.nombres?.[rivalUid] || "Jugador") : "esperando rival";
            let extra = "";
            if (m.estado === "JUGADO" && m.resultado) {
                if (vistosAmistoso.has(m.id)) {
                    const soyLocal = m.participantes[0] === uid;
                    const gp = soyLocal ? m.resultado.golesLocal : m.resultado.golesVisitante;
                    const gr = soyLocal ? m.resultado.golesVisitante : m.resultado.golesLocal;
                    extra = ` · ${gp}-${gr}`;
                } else {
                    extra = " · sin ver";
                }
            }
            return `
                <button class="torneo-item" data-abrir-desafio="${m.id}">
                    <div class="torneo-item-datos">
                        <strong>vs ${escapar(rival)}</strong>
                        <small>${ESTADO_ETIQUETA[m.estado] || m.estado}${extra}</small>
                    </div>
                    ${m.estado === "PENDIENTE" ? `<span class="torneo-item-codigo">${m.codigoInvitacion}</span>` : ""}
                </button>`;
        }).join("");

    c.innerHTML = `
        <div class="torneo-lista">${listaHtml}</div>

        <div class="torneo-acciones">
            <div class="torneo-card">
                <h3>Desafiar a un amigo</h3>
                <p class="torneo-nota">Se genera un código para pasarle.</p>
                <button id="amistosoCrear" class="main-button">DESAFIAR</button>
            </div>

            <div class="torneo-card">
                <h3>Aceptar un desafío</h3>
                <input id="amistosoCodigo" type="text" maxlength="6" placeholder="Código del desafío" style="text-transform:uppercase">
                <button id="amistosoAceptar" class="secondary-button">ACEPTAR</button>
            </div>
        </div>
    `;

    document.getElementById("amistosoCrear").addEventListener("click", onCrear);
    document.getElementById("amistosoAceptar").addEventListener("click", onAceptar);
    c.querySelectorAll("[data-abrir-desafio]").forEach(b =>
        b.addEventListener("click", () => {
            detalleId = b.dataset.abrirDesafio;
            mensaje = null;
            pintar();
        })
    );
}


function pintarDetalle(c) {
    const m = desafios.find(x => x.id === detalleId);
    if (!m) { detalleId = null; pintarLista(c); return; }

    const uid = usuarioActual()?.uid;
    if (m.estado === "PENDIENTE") { pintarPendiente(c, m); return; }
    if (m.estado === "CONFIRMANDO") { pintarConfirmando(c, m, uid); return; }
    if (m.estado === "JUGADO") { pintarJugado(c, m, uid); return; }
    pintarCancelado(c, m);
}


// Estado PENDIENTE: solo el creador, esperando que alguien acepte por código.
function pintarPendiente(c, m) {
    c.innerHTML = `
        <button class="back-button" id="amistosoVolver">← Mis amistosos</button>
        <div class="torneo-detalle">
            <span class="eyebrow">Esperando rival</span>
            <h2>Desafío</h2>
            ${bannerMensaje()}
            <div class="torneo-codigo-box">
                <span>Código para compartir</span>
                <strong>${m.codigoInvitacion}</strong>
            </div>
            <p class="torneo-nota">Pasale este código a tu rival. Cuando lo ingrese, van a poder confirmar sus equipos.</p>
            <button id="amistosoCancelar" class="secondary-button torneo-borrar">Cancelar desafío</button>
        </div>`;

    document.getElementById("amistosoVolver").addEventListener("click", volverALista);
    document.getElementById("amistosoCancelar").addEventListener("click", () => onCancelar(m.id));
}


// Estado CONFIRMANDO: cada uno confirma su equipo del modo normal (§32).
function pintarConfirmando(c, m, uid) {
    const rivalUid = m.participantes.find(p => p !== uid);
    const rival = rivalUid ? (m.nombres?.[rivalUid] || "Jugador") : null;
    const yoConfirme = !!m.confirmados?.[uid];
    const rivalConfirmo = rivalUid ? !!m.confirmados?.[rivalUid] : false;

    let bloqueConfirmar;
    if (yoConfirme) {
        bloqueConfirmar = `<p class="torneo-nota">✓ Confirmaste tu equipo. Esperando a ${escapar(rival || "tu rival")}.</p>`;
    } else {
        const miEquipo = construirEquipoUsuario();   // equipo del modo normal (§17.2)
        if (!miEquipo) {
            bloqueConfirmar = `
                <div class="torneo-aviso torneo-aviso-error">
                    Tu equipo del modo normal está incompleto. Andá a "Mi equipo" a completarlo antes de confirmar.
                </div>`;
        } else {
            const of = MENTALIDADES_OF[estado.mentalidadOfensiva]?.etiqueta || estado.mentalidadOfensiva;
            const def = MENTALIDADES_DEF[estado.mentalidadDefensiva]?.etiqueta || estado.mentalidadDefensiva;
            bloqueConfirmar = `
                <div class="torneo-aviso torneo-aviso-ok">
                    Vas a jugar con tu equipo del modo normal: <strong>${estado.formacion}</strong>,
                    mentalidad <strong>${of}</strong> / <strong>${def}</strong>.
                </div>
                <button id="amistosoConfirmar" class="main-button">CONFIRMAR MI EQUIPO</button>
                <p class="torneo-nota">Recién cuando los dos confirmen se juega el partido. Si querés cambiar algo,
                andá a "Mi equipo" antes de confirmar.</p>`;
        }
    }

    c.innerHTML = `
        <button class="back-button" id="amistosoVolver">← Mis amistosos</button>
        <div class="torneo-detalle">
            <span class="eyebrow">Confirmando equipos</span>
            <h2>Vos vs ${escapar(rival || "?")}</h2>
            ${bannerMensaje()}
            <p class="torneo-nota">${rivalConfirmo
                ? `${escapar(rival)} ya confirmó su equipo.`
                : `${escapar(rival || "Tu rival")} todavía no confirmó.`}</p>
            ${bloqueConfirmar}
            <button id="amistosoCancelar" class="secondary-button torneo-borrar">Cancelar desafío</button>
        </div>`;

    document.getElementById("amistosoVolver").addEventListener("click", volverALista);
    document.getElementById("amistosoCancelar").addEventListener("click", () => onCancelar(m.id));
    const btnConf = document.getElementById("amistosoConfirmar");
    if (btnConf) btnConf.addEventListener("click", () => onConfirmar(m.id));
}


// Estado JUGADO: resultado + relato (re-simulado con la semilla guardada).
function pintarJugado(c, m, uid) {
    const rivalUid = m.participantes.find(p => p !== uid);
    const rival = m.nombres?.[rivalUid] || "Rival";
    const visto = vistosAmistoso.has(m.id);

    // Sin ver todavía: nada de marcador ni de "ganaste/perdiste". El resultado
    // se entera recién al final del relato (§28), como en la fecha de torneo.
    if (!visto) {
        c.innerHTML = `
            <button class="back-button" id="amistosoVolver">← Mis amistosos</button>
            <div class="torneo-detalle">
                <span class="eyebrow">Jugado</span>
                <h2>Vos vs ${escapar(rival)}</h2>
                ${bannerMensaje()}
                <p class="torneo-nota">El partido ya se jugó. Mirá el relato para enterarte del resultado.</p>
                <button id="amistosoVerRelato" class="main-button">▶ Jugar partido</button>
            </div>`;
        document.getElementById("amistosoVolver").addEventListener("click", volverALista);
        document.getElementById("amistosoVerRelato").addEventListener("click", () => onVerRelato(m));
        return;
    }

    const soyLocal = m.participantes[0] === uid;
    const gp = soyLocal ? m.resultado.golesLocal : m.resultado.golesVisitante;
    const gr = soyLocal ? m.resultado.golesVisitante : m.resultado.golesLocal;
    const texto = gp > gr ? "Ganaste" : gp < gr ? "Perdiste" : "Empataste";

    c.innerHTML = `
        <button class="back-button" id="amistosoVolver">← Mis amistosos</button>
        <div class="torneo-detalle">
            <span class="eyebrow">Jugado</span>
            <h2>Vos ${gp} - ${gr} ${escapar(rival)}</h2>
            ${bannerMensaje()}
            <div class="torneo-aviso ${gp >= gr ? "torneo-aviso-ok" : ""}">
                <strong>${texto}.</strong> Sumaste Fichas y puntos por este partido.
                <em>(recargá para ver tu saldo actualizado)</em>
            </div>
            <button id="amistosoVerRelato" class="main-button">✓ Ver de nuevo</button>
        </div>`;

    document.getElementById("amistosoVolver").addEventListener("click", volverALista);
    document.getElementById("amistosoVerRelato").addEventListener("click", () => onVerRelato(m));
}


function pintarCancelado(c, m) {
    c.innerHTML = `
        <button class="back-button" id="amistosoVolver">← Mis amistosos</button>
        <div class="torneo-detalle">
            <span class="eyebrow">Cancelado</span>
            <h2>Desafío cancelado</h2>
        </div>`;
    document.getElementById("amistosoVolver").addEventListener("click", volverALista);
}


// ==========================================
// RELATO (§32, re-simulado en el cliente con la semilla guardada)
// ==========================================

// Arma, desde los ids guardados en el desafío, el equipo que consume el motor
// (objetos completos, con `id` para etiquetar los eventos) y los ids para el
// relato. Mismo criterio que torneos.js (equipoTorneoAMotor).
function equipoIdsAMotor(eqIds, id) {
    return {
        motor: {
            id,
            arquero: CATALOGO.get(eqIds.arquero),
            defensores: eqIds.defensores.map(i => CATALOGO.get(i)),
            medios: eqIds.medios.map(i => CATALOGO.get(i)),
            delanteros: eqIds.delanteros.map(i => CATALOGO.get(i)),
            formacion: eqIds.formacion,
            mentalidadOfensiva: eqIds.mentalidadOfensiva,
            mentalidadDefensiva: eqIds.mentalidadDefensiva
        },
        ids: eqIds
    };
}

// El motor SIEMPRE corre local→visitante con la semilla, igual que el
// servidor (no es simétrico); solo cambia qué lado lleva "USUARIO" (color de
// goles a favor/en contra).
function construirRegistroRelatoAmistoso(m) {
    const uid = usuarioActual()?.uid;
    const [localUid, visitanteUid] = m.participantes;
    const viewerVis = uid === visitanteUid;

    const localM = equipoIdsAMotor(m.equipos[localUid], viewerVis ? "RIVAL" : "USUARIO");
    const visM = equipoIdsAMotor(m.equipos[visitanteUid], viewerVis ? "USUARIO" : "RIVAL");
    const r = simularPartido(localM.motor, visM.motor, m.resultado.semilla);

    return {
        equipoUsuarioIds: viewerVis ? visM.ids : localM.ids,
        equipoRivalIds: viewerVis ? localM.ids : visM.ids,
        nombreUsuario: m.nombres?.[viewerVis ? visitanteUid : localUid] || "Vos",
        rivalNombre: m.nombres?.[viewerVis ? localUid : visitanteUid] || "Rival",
        semilla: m.resultado.semilla,
        golesUsuario: viewerVis ? m.resultado.golesVisitante : m.resultado.golesLocal,
        golesRival: viewerVis ? m.resultado.golesLocal : m.resultado.golesVisitante,
        eventos: r.eventos
    };
}

async function onVerRelato(m) {
    if (ocupado) return;
    ocupado = true;
    mensaje = { tipo: "info", texto: "Cargando el relato…" };
    pintar();
    try {
        const registro = construirRegistroRelatoAmistoso(m);
        mensaje = null;
        vistosAmistoso.add(m.id);
        reproducirRelatoExterno(registro, () => { showScreen("amistososScreen"); pintar(); });
    } catch (e) {
        mensaje = { tipo: "error", texto: e?.message || "No se pudo abrir el relato." };
        pintar();
    } finally {
        ocupado = false;
    }
}


// ==========================================
// ACCIONES
// ==========================================

async function onCrear() {
    if (ocupado) return;
    ocupado = true;
    try {
        const r = await crearDesafioNube();
        detalleId = r.matchId;
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo crear el desafío.");
    } finally {
        ocupado = false;
    }
}

async function onAceptar() {
    if (ocupado) return;
    const codigo = document.getElementById("amistosoCodigo").value.trim().toUpperCase();
    if (!codigo) { alert("Escribí el código del desafío."); return; }
    ocupado = true;
    try {
        const r = await aceptarDesafioNube(codigo);
        detalleId = r.matchId;
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo aceptar el desafío.");
    } finally {
        ocupado = false;
    }
}

async function onCancelar(matchId) {
    if (ocupado) return;
    if (!confirm("¿Cancelar este desafío?")) return;
    ocupado = true;
    try {
        await cancelarDesafioNube(matchId);
        volverALista();
    } catch (e) {
        mensaje = { tipo: "error", texto: e?.message || "No se pudo cancelar el desafío." };
        pintar();
    } finally {
        ocupado = false;
    }
}

async function onConfirmar(matchId) {
    if (ocupado) return;
    ocupado = true;
    mensaje = null;
    try {
        const r = await confirmarDesafioNube(matchId);
        mensaje = r?.jugado ? { tipo: "ok", texto: "¡Se jugó el partido!" } : null;
    } catch (e) {
        mensaje = { tipo: "error", texto: e?.message || "No se pudo confirmar." };
    } finally {
        ocupado = false;
        pintar();
    }
}


// ==========================================
// UTILIDADES
// ==========================================

function volverALista() {
    detalleId = null;
    mensaje = null;
    pintar();
}

// Aviso visible en pantalla (mismo patrón que torneos.js).
function bannerMensaje() {
    if (!mensaje) return "";
    const clase = mensaje.tipo === "ok" ? "torneo-aviso torneo-aviso-ok"
        : mensaje.tipo === "info" ? "torneo-aviso torneo-aviso-info"
        : "torneo-aviso torneo-aviso-error";
    return `<div class="${clase}">${escapar(mensaje.texto)}</div>`;
}

function escapar(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}


export function initAmistosos() {
    document.getElementById("backFromAmistosos")
        .addEventListener("click", () => {
            document.querySelector('.nav-button[data-screen="homeScreen"]')?.click();
        });
}
