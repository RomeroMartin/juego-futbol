// ==========================================
// TORNEOS — sala: crear, unirse, abrir armado (Etapa 9A, §35–§37)
// ==========================================
//
// Toda la escritura pasa por Cloud Functions; acá solo se pide y se muestra la
// sala EN VIVO (Firestore en tiempo real). El armado del equipo con exclusividad
// (reclamar jugadores) llega en la Etapa 9B.

import { usuarioActual } from "../core/auth.js";
import {
    escucharMisTorneos,
    crearTorneoNube,
    unirseTorneoNube,
    abrirArmadoNube
} from "../core/nube.js";


const cont = () => document.getElementById("torneosContenido");

let unsubLista = null;      // suscripción en vivo a "mis torneos"
let torneos = [];           // último estado recibido
let detalleId = null;       // torneo abierto en la vista de detalle (o null = lista)
let ocupado = false;        // evita doble submit mientras responde el servidor
let avisoValidacion = "";   // mensaje de pool insuficiente (§37), si lo hubo

const POS_NOMBRE = { POR: "arqueros", DEF: "defensores", MED: "mediocampistas", DEL: "delanteros" };
const ESTADO_ETIQUETA = {
    BORRADOR: "Inscripción abierta",
    ARMADO: "Armando equipos",
    EN_CURSO: "En curso",
    FINALIZADO: "Finalizado"
};


// ==========================================
// SUSCRIPCIÓN EN VIVO
// ==========================================

export function renderTorneos() {
    const uid = usuarioActual()?.uid;
    if (!uid) return;

    if (!unsubLista) {
        unsubLista = escucharMisTorneos(uid, (lista) => {
            torneos = lista;
            pintar();
        });
    }
    pintar();
}

// Corta la suscripción (al cerrar sesión).
export function detenerTorneos() {
    if (unsubLista) { unsubLista(); unsubLista = null; }
    torneos = [];
    detalleId = null;
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
    const mios = [...torneos].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

    const listaHtml = mios.length === 0
        ? `<p class="torneo-vacio">Todavía no estás en ningún torneo. Creá uno e invitá a tus amigas, o unite con un código.</p>`
        : mios.map(t => `
            <button class="torneo-item" data-abrir-torneo="${t.id}">
                <div class="torneo-item-datos">
                    <strong>${escapar(t.nombre)}</strong>
                    <small>${t.participantes.length} participante(s) · ${ESTADO_ETIQUETA[t.estado] || t.estado}</small>
                </div>
                <span class="torneo-item-codigo">${t.codigoInvitacion}</span>
            </button>
        `).join("");

    c.innerHTML = `
        <div class="torneo-lista">${listaHtml}</div>

        <div class="torneo-acciones">
            <div class="torneo-card">
                <h3>Crear un torneo</h3>
                <input id="torneoNombre" type="text" maxlength="40" placeholder="Nombre del torneo">
                <button id="torneoCrear" class="main-button">CREAR</button>
            </div>

            <div class="torneo-card">
                <h3>Unirme con un código</h3>
                <input id="torneoCodigo" type="text" maxlength="6" placeholder="Ej. PIBES2" style="text-transform:uppercase">
                <button id="torneoUnirse" class="secondary-button">UNIRME</button>
            </div>
        </div>
    `;

    document.getElementById("torneoCrear").addEventListener("click", onCrear);
    document.getElementById("torneoUnirse").addEventListener("click", onUnirse);
    c.querySelectorAll("[data-abrir-torneo]").forEach(b =>
        b.addEventListener("click", () => { detalleId = b.dataset.abrirTorneo; avisoValidacion = ""; pintar(); })
    );
}


function pintarDetalle(c) {
    const t = torneos.find(x => x.id === detalleId);
    if (!t) { detalleId = null; pintarLista(c); return; }

    const uid = usuarioActual()?.uid;
    const esCreador = t.creadorId === uid;

    const participantes = t.participantes
        .map(u => `<li>${escapar(t.nombres?.[u] || "Jugador")}${u === t.creadorId ? " 👑" : ""}</li>`)
        .join("");

    // Botón de abrir armado (solo el creador, solo en BORRADOR).
    let accionCreador = "";
    if (esCreador && t.estado === "BORRADOR") {
        const faltan = t.minParticipantes - t.participantes.length;
        accionCreador = faltan > 0
            ? `<p class="torneo-nota">Faltan ${faltan} participante(s) para poder empezar (mínimo ${t.minParticipantes}).</p>`
            : `<button id="torneoAbrir" class="main-button">ABRIR ARMADO (ventana de 24 hs)</button>`;
    }

    const aviso = avisoValidacion ? `<div class="torneo-aviso">${avisoValidacion}</div>` : "";

    let estadoBloque = "";
    if (t.estado === "ARMADO") {
        estadoBloque = `
            <div class="torneo-aviso torneo-aviso-ok">
                🟢 <strong>Ventana de armado abierta.</strong> El armado del equipo con
                exclusividad (reclamar jugadores) llega en la próxima actualización del juego.
            </div>`;
    }

    c.innerHTML = `
        <button class="back-button" id="torneoVolverLista">← Mis torneos</button>

        <div class="torneo-detalle">
            <span class="eyebrow">${ESTADO_ETIQUETA[t.estado] || t.estado}</span>
            <h2>${escapar(t.nombre)}</h2>

            <div class="torneo-codigo-box">
                <span>Código para invitar</span>
                <strong>${t.codigoInvitacion}</strong>
            </div>

            <h3>Participantes (${t.participantes.length}/${t.maxParticipantes})</h3>
            <ul class="torneo-participantes">${participantes}</ul>

            ${aviso}
            ${estadoBloque}
            ${accionCreador}
        </div>
    `;

    document.getElementById("torneoVolverLista")
        .addEventListener("click", () => { detalleId = null; avisoValidacion = ""; pintar(); });

    const btnAbrir = document.getElementById("torneoAbrir");
    if (btnAbrir) btnAbrir.addEventListener("click", () => onAbrirArmado(t.id));
}


// ==========================================
// ACCIONES
// ==========================================

async function onCrear() {
    if (ocupado) return;
    const nombre = document.getElementById("torneoNombre").value.trim();
    if (!nombre) { alert("Ponele un nombre al torneo."); return; }
    ocupado = true;
    try {
        const r = await crearTorneoNube(nombre);
        detalleId = r.torneoId;      // abrimos su detalle; la lista llega por el listener
        avisoValidacion = "";
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo crear el torneo.");
    } finally {
        ocupado = false;
    }
}

async function onUnirse() {
    if (ocupado) return;
    const codigo = document.getElementById("torneoCodigo").value.trim().toUpperCase();
    if (!codigo) { alert("Escribí el código de invitación."); return; }
    ocupado = true;
    try {
        const r = await unirseTorneoNube(codigo);
        detalleId = r.torneoId;
        avisoValidacion = "";
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo unir al torneo.");
    } finally {
        ocupado = false;
    }
}

async function onAbrirArmado(torneoId) {
    if (ocupado) return;
    ocupado = true;
    avisoValidacion = "";
    try {
        const r = await abrirArmadoNube(torneoId);
        if (!r.ok) {
            // Pool insuficiente (§37): mostrar qué falta y las 3 salidas.
            const v = r.validacion;
            avisoValidacion = `
                ⚠️ <strong>No alcanza el plantel del grupo.</strong> Faltan
                <strong>${v.faltan} ${POS_NOMBRE[v.pos] || v.pos}</strong> distintos
                entre todos (hay ${v.conteo[v.pos]}, se necesitan ${v.requerido[v.pos]}).<br>
                Opciones (§37): abrir más sobres para conseguir esos jugadores,
                jugar con menos participantes, o (más adelante) usar el modo libre / el
                pool de reserva.`;
        }
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo abrir el armado.");
    } finally {
        ocupado = false;
    }
}


// ==========================================
// UTILIDADES
// ==========================================

// Escapa texto para no romper el HTML (nombres los eligen los usuarios).
function escapar(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}


export function initTorneos() {
    document.getElementById("backFromTorneos")
        .addEventListener("click", () => {
            // Volver al home desde la sala.
            document.querySelector('.nav-button[data-screen="homeScreen"]')?.click();
        });
}
